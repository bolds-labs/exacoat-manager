/**
 * Staff dashboard data: team notes and overdue international orders from the exacoat-core
 * staff endpoints. Parsers reject anything that does not match the documented shape, so a
 * missing plugin (HTML 404 page) or an older response never reaches the screen.
 */

export interface StaffNote {
  id: string;
  text: string;
  author_id: number;
  author_name: string;
  created_at: string;
  updated_at: string;
  pinned: boolean;
  done: boolean;
}

export type PickupSource = 'goorita' | 'rayspeed' | 'status_note' | 'modified';

export interface OverdueOrder {
  id: number;
  number: string;
  customer_name: string;
  country: string;
  country_name: string;
  courier: string;
  pickup_at: string;
  pickup_source: PickupSource;
  days: number;
}

const PICKUP_SOURCES: readonly PickupSource[] = ['goorita', 'rayspeed', 'status_note', 'modified'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isDate = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v));

export function parseStaffNote(v: unknown): StaffNote | null {
  if (!isObj(v)) return null;
  const { id, text, author_id, author_name, created_at, updated_at, pinned, done } = v;
  if (!isStr(id) || !id || !isStr(text) || !isInt(author_id) || !isStr(author_name)) return null;
  if (!isDate(created_at) || !isDate(updated_at) || typeof pinned !== 'boolean' || typeof done !== 'boolean') return null;
  return { id, text, author_id, author_name, created_at, updated_at, pinned, done };
}

export function parseNotesResponse(data: unknown): { notes: StaffNote[]; currentUserId: number; canModerate: boolean } | null {
  if (!isObj(data) || data.success !== true || !Array.isArray(data.notes)) return null;
  if (!isInt(data.current_user_id) || typeof data.can_moderate !== 'boolean') return null;
  const notes: StaffNote[] = [];
  for (const raw of data.notes) {
    const n = parseStaffNote(raw);
    if (!n) return null;
    notes.push(n);
  }
  return { notes, currentUserId: data.current_user_id, canModerate: data.can_moderate };
}

export function parseOverdueOrder(v: unknown): OverdueOrder | null {
  if (!isObj(v)) return null;
  const { id, number, customer_name, country, country_name, courier, pickup_at, pickup_source, days } = v;
  if (!isInt(id) || id <= 0 || !isStr(number) || !isStr(customer_name) || !isStr(country) || !isStr(country_name) || !isStr(courier)) return null;
  if (!isDate(pickup_at) || !PICKUP_SOURCES.includes(pickup_source as PickupSource) || !isInt(days) || days < 0) return null;
  return { id, number, customer_name, country, country_name, courier, pickup_at, pickup_source: pickup_source as PickupSource, days };
}

export function parseOverdueResponse(data: unknown): { orders: OverdueOrder[]; truncated: boolean } | null {
  if (!isObj(data) || data.success !== true || !Array.isArray(data.orders) || typeof data.truncated !== 'boolean') return null;
  const orders: OverdueOrder[] = [];
  for (const raw of data.orders) {
    const o = parseOverdueOrder(raw);
    if (!o) return null;
    orders.push(o);
  }
  return { orders, truncated: data.truncated };
}

const newestFirst = (a: StaffNote, b: StaffNote) => Date.parse(b.created_at) - Date.parse(a.created_at);

/** Open notes (pinned first, then newest first) and done notes (newest first, shown folded). */
export function splitNotes(notes: StaffNote[]): { open: StaffNote[]; done: StaffNote[] } {
  const open = notes.filter((n) => !n.done).sort((a, b) => Number(b.pinned) - Number(a.pinned) || newestFirst(a, b));
  const done = notes.filter((n) => n.done).sort(newestFirst);
  return { open, done };
}

export type NotesAction =
  | { type: 'loaded'; notes: StaffNote[] }
  | { type: 'upsert'; note: StaffNote }
  | { type: 'patch'; id: string; patch: Partial<Pick<StaffNote, 'pinned' | 'done'>> }
  | { type: 'removed'; id: string };

export function notesReducer(state: StaffNote[], action: NotesAction): StaffNote[] {
  switch (action.type) {
    case 'loaded':
      return action.notes;
    case 'upsert':
      return state.some((n) => n.id === action.note.id)
        ? state.map((n) => (n.id === action.note.id ? action.note : n))
        : [...state, action.note];
    case 'patch':
      return state.map((n) => (n.id === action.id ? { ...n, ...action.patch } : n));
    case 'removed':
      return state.filter((n) => n.id !== action.id);
    default:
      return state;
  }
}

export function canDeleteNote(note: StaffNote, userId: number, canModerate: boolean): boolean {
  if (canModerate) return true;
  return userId > 0 && note.author_id === userId;
}

export function pickupSourceLabel(source: PickupSource): string {
  switch (source) {
    case 'goorita':
      return 'Goorita booked';
    case 'rayspeed':
      return 'Rayspeed booked';
    case 'status_note':
      return 'Waiting for pickup since';
    default:
      return 'Last updated';
  }
}

export function formatDays(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * Pending reviews from GET /reviews?status=pending. The endpoint sends ids and order ids as strings,
 * so they are converted to numbers; rows without a usable id or no longer pending are dropped.
 */
export function normalizePendingReviews<T extends { id?: unknown; status?: unknown; rating?: unknown; media?: unknown }>(
  raw: unknown,
): (Omit<T, 'id' | 'rating' | 'media'> & { id: number; rating: number; media: unknown[] })[] {
  if (!Array.isArray(raw)) return [];
  const out: (Omit<T, 'id' | 'rating' | 'media'> & { id: number; rating: number; media: unknown[] })[] = [];
  for (const r of raw as T[]) {
    if (!isObj(r) || r.status !== 'pending') continue;
    const id = Number(r.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const rating = Number(r.rating);
    out.push({ ...r, id, rating: Number.isFinite(rating) ? rating : 0, media: Array.isArray(r.media) ? r.media : [] });
  }
  return out;
}
