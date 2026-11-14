// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchGlobalFinishesDirect,
  saveAllGlobalFinishesDirect,
  saveGlobalFinishDirect,
  toggleFinishActiveDirect,
  toggleFinishStockDirect,
  updateAllGlobalFinishesDirect,
  type GlobalFinish,
} from './wordpressBridge';

const CACHE = 'exacoat_finishes_inventory_cache';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const live: GlobalFinish[] = [
  { id: 'a', slug: 'a', name: 'A', group: 'G', thumbnail: '', in_stock: true, extra_price: 0, order: 0 },
  { id: 'b', slug: 'b', name: 'B', group: 'G', thumbnail: '', in_stock: true, extra_price: 0, order: 1 },
];

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('stock and active toggles', () => {
  it('report failure when the request fails and write nothing to the local cache', async () => {
    localStorage.setItem(CACHE, JSON.stringify(live));
    fetchMock.mockRejectedValue(new Error('offline'));
    const stock = await toggleFinishStockDirect('a', 'out_of_stock');
    const active = await toggleFinishActiveDirect('a', false);
    expect(stock.success).toBe(false);
    expect(active.success).toBe(false);
    expect(stock.error).toBeTruthy();
    expect(localStorage.getItem(CACHE)).toBe(JSON.stringify(live));
  });

  it('report failure when the store rejects the change', async () => {
    fetchMock.mockImplementation(async () => json(403, { success: false, message: 'Forbidden' }));
    expect(await toggleFinishStockDirect('a', 'coming_soon')).toMatchObject({ success: false, error: 'Forbidden' });
    expect(await toggleFinishActiveDirect('a', true)).toMatchObject({ success: false, error: 'Forbidden' });
  });

  it('succeed on a live answer without touching the local cache', async () => {
    fetchMock.mockImplementation(async () => json(200, { success: true, finishes: live }));
    expect((await toggleFinishStockDirect('a', 'in_stock')).success).toBe(true);
    expect((await toggleFinishActiveDirect('a', true)).success).toBe(true);
    expect(localStorage.getItem(CACHE)).toBeNull();
  });
});

describe('fetchGlobalFinishesDirect source', () => {
  it('is live when WordPress answers', async () => {
    fetchMock.mockImplementation(async () => json(200, { success: true, finishes: live, groups: ['G'] }));
    const res = await fetchGlobalFinishesDirect();
    expect(res.source).toBe('live');
    expect(localStorage.getItem(CACHE)).toBeNull();
  });

  it('is fallback when WordPress and the storefront both fail', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect((await fetchGlobalFinishesDirect()).source).toBe('fallback');
  });

  it('is fallback when only the storefront list answers', async () => {
    fetchMock.mockResolvedValueOnce(json(500, {})).mockResolvedValueOnce(json(200, { success: true, finishes: live }));
    expect((await fetchGlobalFinishesDirect()).source).toBe('fallback');
  });
});

describe('saves never write the per-PC cache', () => {
  it('single and whole-list saves leave localStorage alone', async () => {
    fetchMock.mockImplementation(async () => json(200, { success: true, finishes: live, groups: ['G'] }));
    await saveGlobalFinishDirect(live[0]);
    await saveAllGlobalFinishesDirect(live, ['G']);
    expect(localStorage.getItem(CACHE)).toBeNull();
  });
});

describe('updateAllGlobalFinishesDirect', () => {
  it('re-fetches the live list, applies the change to it and saves with the live groups', async () => {
    const fresh = [...live, { ...live[0], id: 'c', slug: 'c', name: 'C', order: 2 }];
    fetchMock
      .mockResolvedValueOnce(json(200, { success: true, finishes: fresh, groups: ['G', 'H'] }))
      .mockResolvedValueOnce(json(200, { success: true, finishes: fresh, groups: ['G', 'H'] }));
    const transform = vi.fn((list: GlobalFinish[]) => list.map((f) => (f.id === 'a' ? { ...f, order: 9 } : f)));
    const res = await updateAllGlobalFinishesDirect(transform);
    expect(res.success).toBe(true);
    expect(transform.mock.calls[0][0].map((f) => f.id)).toEqual(['a', 'b', 'c']);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.groups).toEqual(['G', 'H']);
    expect(body.finishes.map((f: GlobalFinish) => [f.id, f.order])).toEqual([['a', 9], ['b', 1], ['c', 2]]);
  });

  it('saves nothing when the live list cannot be loaded', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const transform = vi.fn((l: GlobalFinish[]) => l);
    const res = await updateAllGlobalFinishesDirect(transform);
    expect(res.success).toBe(false);
    expect(transform).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes('save-all'))).toBe(true);
  });

  it('saves nothing when the change no longer applies', async () => {
    fetchMock.mockImplementation(async () => json(200, { success: true, finishes: live, groups: ['G'] }));
    const res = await updateAllGlobalFinishesDirect(() => null);
    expect(res).toMatchObject({ success: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
