import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./wordpressBridge', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('./env', () => ({ getWordPressBaseUrl: () => 'https://cms.test' }));

import { authenticatedFetch } from './wordpressBridge';
import {
  createStaffNoteDirect,
  deleteStaffNoteDirect,
  fetchOverdueInternationalDirect,
  fetchStaffNotesDirect,
  updateStaffNoteDirect,
} from './staffDashboardApi';

const fetchMock = vi.mocked(authenticatedFetch);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const note = {
  id: 'nabc',
  text: 'Hi',
  author_id: 3,
  author_name: 'Andi',
  created_at: '2026-11-14T01:00:00Z',
  updated_at: '2026-11-14T01:00:00Z',
  pinned: false,
  done: false,
};

beforeEach(() => {
  fetchMock.mockReset();
});

describe('staff notes requests', () => {
  it('lists notes from the staff endpoint', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, notes: [note], current_user_id: 3, can_moderate: false }));
    const r = await fetchStaffNotesDirect();
    expect(r).toEqual({ ok: true, data: { notes: [note], currentUserId: 3, canModerate: false } });
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://cms.test/wp-json/exacoat-core/v1/staff/notes');
  });

  it('reports a missing plugin when the route does not exist', async () => {
    fetchMock.mockResolvedValue(json(404, { code: 'rest_no_route', message: 'No route' }));
    const r = await fetchStaffNotesDirect();
    expect(r).toMatchObject({ ok: false, missing: true });
  });

  it('treats a non-JSON 404 page as a missing plugin too', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Not found</html>', { status: 404 }));
    expect(await fetchOverdueInternationalDirect()).toMatchObject({ ok: false, missing: true });
  });

  it('keeps a missing note apart from a missing plugin', async () => {
    fetchMock.mockResolvedValue(json(404, { code: 'exacoat_staff_note_missing', message: 'This note no longer exists.' }));
    expect(await deleteStaffNoteDirect('nabc')).toEqual({ ok: false, missing: false, error: 'This note no longer exists.' });
  });

  it('rejects a malformed success response', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, notes: [{ id: 1 }], current_user_id: 3, can_moderate: false }));
    expect(await fetchStaffNotesDirect()).toMatchObject({ ok: false, missing: false });
  });

  it('creates, updates and deletes with the right method and body', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, note }));
    expect(await createStaffNoteDirect('Hi')).toEqual({ ok: true, data: note });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ text: 'Hi' }) });

    fetchMock.mockResolvedValueOnce(json(200, { success: true, note: { ...note, pinned: true } }));
    const u = await updateStaffNoteDirect('nabc', { pinned: true });
    expect(u).toEqual({ ok: true, data: { ...note, pinned: true } });
    expect(String(fetchMock.mock.calls[1][0])).toContain('/staff/notes/nabc');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ pinned: true }) });

    fetchMock.mockResolvedValueOnce(json(200, { success: true, id: 'nabc' }));
    expect(await deleteStaffNoteDirect('nabc')).toEqual({ ok: true, data: { id: 'nabc' } });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'DELETE' });
  });

  it('refuses ids that are not note ids before sending', async () => {
    expect(await deleteStaffNoteDirect('../x')).toMatchObject({ ok: false, missing: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns a network failure into an error', async () => {
    fetchMock.mockImplementation(() => {
      throw new Error('offline');
    });
    expect(await fetchStaffNotesDirect()).toEqual({ ok: false, missing: false, error: 'offline' });
  });
});
