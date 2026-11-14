import { describe, it, expect } from 'vitest';
import {
  canDeleteNote,
  formatDays,
  notesReducer,
  parseNotesResponse,
  parseOverdueResponse,
  parseStaffNote,
  pickupSourceLabel,
  normalizePendingReviews,
  splitNotes,
  type StaffNote,
} from './staffDashboard';

const note = (over: Partial<StaffNote> = {}): StaffNote => ({
  id: 'n1',
  text: 'Restock matte black',
  author_id: 7,
  author_name: 'Rina',
  created_at: '2026-11-10T08:00:00Z',
  updated_at: '2026-11-10T08:00:00Z',
  pinned: false,
  done: false,
  ...over,
});

describe('parseStaffNote', () => {
  it('accepts a well-formed note', () => {
    expect(parseStaffNote(note())).toEqual(note());
  });
  it('rejects notes with missing or wrong fields', () => {
    expect(parseStaffNote(null)).toBeNull();
    expect(parseStaffNote({ ...note(), id: '' })).toBeNull();
    expect(parseStaffNote({ ...note(), text: 5 })).toBeNull();
    expect(parseStaffNote({ ...note(), pinned: 'yes' })).toBeNull();
    expect(parseStaffNote({ ...note(), author_id: '7' })).toBeNull();
    expect(parseStaffNote({ ...note(), created_at: 'not a date' })).toBeNull();
  });
});

describe('parseNotesResponse', () => {
  it('reads notes, the signed-in user and moderation right', () => {
    const r = parseNotesResponse({ success: true, notes: [note()], current_user_id: 7, can_moderate: false });
    expect(r).toEqual({ notes: [note()], currentUserId: 7, canModerate: false });
  });
  it('rejects a response without a notes array or with a bad note', () => {
    expect(parseNotesResponse({ success: true })).toBeNull();
    expect(parseNotesResponse({ success: false, notes: [] })).toBeNull();
    expect(parseNotesResponse({ success: true, notes: [{ id: 'x' }], current_user_id: 1, can_moderate: true })).toBeNull();
    expect(parseNotesResponse('<html>')).toBeNull();
  });
});

describe('parseOverdueResponse', () => {
  const row = {
    id: 542901,
    number: '542901',
    customer_name: 'Jane Doe',
    country: 'US',
    country_name: 'United States (US)',
    courier: 'goorita',
    pickup_at: '2026-11-10T03:00:00Z',
    pickup_source: 'goorita',
    days: 4,
  };
  it('reads overdue orders', () => {
    expect(parseOverdueResponse({ success: true, orders: [row], truncated: false })).toEqual({ orders: [row], truncated: false });
  });
  it('rejects unknown pickup sources and bad rows', () => {
    expect(parseOverdueResponse({ success: true, orders: [{ ...row, pickup_source: 'guess' }], truncated: false })).toBeNull();
    expect(parseOverdueResponse({ success: true, orders: [{ ...row, id: '1' }], truncated: false })).toBeNull();
    expect(parseOverdueResponse({ success: true, orders: [{ ...row, days: -1 }], truncated: false })).toBeNull();
    expect(parseOverdueResponse({ success: true })).toBeNull();
  });
});

describe('splitNotes', () => {
  it('puts pinned first, then newest first, and folds done notes away', () => {
    const notes = [
      note({ id: 'old', created_at: '2026-11-01T00:00:00Z' }),
      note({ id: 'new', created_at: '2026-11-12T00:00:00Z' }),
      note({ id: 'pin-old', pinned: true, created_at: '2026-10-01T00:00:00Z' }),
      note({ id: 'pin-new', pinned: true, created_at: '2026-11-05T00:00:00Z' }),
      note({ id: 'done-old', done: true, created_at: '2026-11-02T00:00:00Z' }),
      note({ id: 'done-new', done: true, pinned: true, created_at: '2026-11-11T00:00:00Z' }),
    ];
    const { open, done } = splitNotes(notes);
    expect(open.map((n) => n.id)).toEqual(['pin-new', 'pin-old', 'new', 'old']);
    expect(done.map((n) => n.id)).toEqual(['done-new', 'done-old']);
  });
});

describe('notesReducer', () => {
  it('loads, adds, updates and removes notes', () => {
    let s = notesReducer([], { type: 'loaded', notes: [note()] });
    expect(s).toHaveLength(1);
    s = notesReducer(s, { type: 'upsert', note: note({ id: 'n2', text: 'Call back' }) });
    expect(s.map((n) => n.id)).toEqual(['n1', 'n2']);
    s = notesReducer(s, { type: 'upsert', note: note({ id: 'n1', pinned: true }) });
    expect(s.find((n) => n.id === 'n1')?.pinned).toBe(true);
    expect(s).toHaveLength(2);
    s = notesReducer(s, { type: 'patch', id: 'n2', patch: { done: true } });
    expect(s.find((n) => n.id === 'n2')?.done).toBe(true);
    s = notesReducer(s, { type: 'removed', id: 'n1' });
    expect(s.map((n) => n.id)).toEqual(['n2']);
  });
});

describe('canDeleteNote', () => {
  it('allows the author and administrators only', () => {
    expect(canDeleteNote(note(), 7, false)).toBe(true);
    expect(canDeleteNote(note(), 8, false)).toBe(false);
    expect(canDeleteNote(note(), 8, true)).toBe(true);
    expect(canDeleteNote(note({ author_id: 0 }), 0, false)).toBe(false);
  });
});

describe('labels', () => {
  it('names the pickup time source', () => {
    expect(pickupSourceLabel('goorita')).toBe('Goorita booked');
    expect(pickupSourceLabel('rayspeed')).toBe('Rayspeed booked');
    expect(pickupSourceLabel('status_note')).toBe('Waiting for pickup since');
    expect(pickupSourceLabel('modified')).toBe('Last updated');
  });
  it('formats whole days', () => {
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(4)).toBe('4 days');
  });
});

describe('normalizePendingReviews', () => {
  it('turns string ids and ratings into numbers and keeps only pending rows', () => {
    const rows = normalizePendingReviews([
      { id: '1204', status: 'pending', rating: '5', media: [{ url: 'a' }] },
      { id: '1203', status: 'approved', rating: 5 },
      { id: 'x', status: 'pending', rating: 4 },
      { id: 12, status: 'pending', rating: 4.5 },
      null,
    ]);
    expect(rows.map((r) => [r.id, r.rating, r.media.length])).toEqual([
      [1204, 5, 1],
      [12, 4.5, 0],
    ]);
  });
  it('returns nothing for a non-array', () => {
    expect(normalizePendingReviews(undefined)).toEqual([]);
  });
});
