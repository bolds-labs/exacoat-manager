import { authenticatedFetch } from './wordpressBridge';
import { getWordPressBaseUrl } from './env';
import {
  parseNotesResponse,
  parseOverdueResponse,
  parseStaffNote,
  type OverdueOrder,
  type StaffNote,
} from './staffDashboard';

/** missing: the plugin on the store is older and has no staff routes yet (WordPress answers rest_no_route). */
export type StaffResult<T> = { ok: true; data: T } | { ok: false; missing: boolean; error: string };

const NOTE_ID = /^[a-z0-9]{1,32}$/;
const base = () => `${getWordPressBaseUrl()}/wp-json/exacoat-core/v1/staff`;

async function request<T>(url: string, init: RequestInit, parse: (data: unknown) => T | null): Promise<StaffResult<T>> {
  try {
    const res = await authenticatedFetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    if (!res.ok) {
      const missing = res.status === 404 && (data === null || body.code === 'rest_no_route');
      const message = typeof body.message === 'string' && body.message ? body.message : `Request failed (${res.status})`;
      return { ok: false, missing, error: missing ? 'Install the latest plugin' : message };
    }
    const parsed = parse(data);
    if (parsed === null) return { ok: false, missing: false, error: 'Unexpected response from the store' };
    return { ok: true, data: parsed };
  } catch (err) {
    return { ok: false, missing: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

const noteFrom = (data: unknown): StaffNote | null =>
  typeof data === 'object' && data !== null && (data as Record<string, unknown>).success === true
    ? parseStaffNote((data as Record<string, unknown>).note)
    : null;

const badId = (): StaffResult<never> => ({ ok: false, missing: false, error: 'Unknown note' });

export function fetchStaffNotesDirect(): Promise<StaffResult<{ notes: StaffNote[]; currentUserId: number; canModerate: boolean }>> {
  return request(`${base()}/notes?_t=${Date.now()}`, { method: 'GET' }, parseNotesResponse);
}

export function createStaffNoteDirect(text: string): Promise<StaffResult<StaffNote>> {
  return request(`${base()}/notes`, { method: 'POST', body: JSON.stringify({ text }) }, noteFrom);
}

export function updateStaffNoteDirect(id: string, patch: { pinned?: boolean; done?: boolean }): Promise<StaffResult<StaffNote>> {
  if (!NOTE_ID.test(id)) return Promise.resolve(badId());
  return request(`${base()}/notes/${id}`, { method: 'POST', body: JSON.stringify(patch) }, noteFrom);
}

export function deleteStaffNoteDirect(id: string): Promise<StaffResult<{ id: string }>> {
  if (!NOTE_ID.test(id)) return Promise.resolve(badId());
  return request(`${base()}/notes/${id}`, { method: 'DELETE' }, (data) => {
    const d = data as Record<string, unknown> | null;
    return d && d.success === true && d.id === id ? { id } : null;
  });
}

export function fetchOverdueInternationalDirect(): Promise<StaffResult<{ orders: OverdueOrder[]; truncated: boolean }>> {
  return request(`${base()}/overdue-international?_t=${Date.now()}`, { method: 'GET' }, parseOverdueResponse);
}
