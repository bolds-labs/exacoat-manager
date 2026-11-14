// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { GlobalFinish } from '../lib/wordpressBridge';

const finishes: GlobalFinish[] = [
  { id: 'swarm', slug: 'swarm', name: 'Swarm', group: 'Signature skins', thumbnail: '', in_stock: true, extra_price: 30000, order: 0, accent_extra_price: 10000, badge_text: 'HOT', is_custom_per_device: true },
  { id: 'black-camo', slug: 'black-camo', name: 'Black Camo', group: 'Signature skins', thumbnail: '', in_stock: true, extra_price: 30000, order: 1 },
  { id: 'matte-black', slug: 'matte-black', name: 'Matte Black', group: 'Colors', thumbnail: '', in_stock: true, extra_price: 0, order: 0, is_active: false },
];

const bridge = vi.hoisted(() => ({
  fetchGlobalFinishesDirect: vi.fn(),
  toggleFinishStockDirect: vi.fn(),
  toggleFinishActiveDirect: vi.fn(),
  saveGlobalFinishDirect: vi.fn(),
  saveAllGlobalFinishesDirect: vi.fn(),
  updateAllGlobalFinishesDirect: vi.fn(),
  fetchLiveGlobalFinishesDirect: vi.fn(),
  deleteGlobalFinishDirect: vi.fn(),
  reorderFinishGroupsDirect: vi.fn(),
  renameFinishGroupDirect: vi.fn(),
  saveFinishGroupSettingsDirect: vi.fn(),
}));

vi.mock('../lib/wordpressBridge', async (orig) => ({ ...(await orig<object>()), ...bridge }));
vi.mock('../components/ds/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/modals/FinishSurchargeTiersModal', () => ({ FinishSurchargeTiersModal: () => null }));
vi.mock('../components/modals/MediaLibraryModal', () => ({ MediaLibraryModal: () => null }));

import { MaterialsStockPage } from './MaterialsStockPage';

beforeEach(() => {
  Object.values(bridge).forEach((m) => m.mockReset());
  const liveResponse = () => ({
    success: true,
    source: 'live',
    finishes: structuredClone(finishes),
    groups: ['Limited', 'Signature skins', 'Colors'],
    group_settings: { Colors: { display_style: 'compact_dots', show_more_limit: 6 } },
  });
  bridge.fetchLiveGlobalFinishesDirect.mockImplementation(async () => liveResponse());
  bridge.updateAllGlobalFinishesDirect.mockResolvedValue({ success: true });
  bridge.saveFinishGroupSettingsDirect.mockImplementation(async (v: unknown) => ({ success: true, group_settings: v }));
  bridge.renameFinishGroupDirect.mockResolvedValue({ success: true, groups: ['Limited', 'Signature skins', 'Pastels'], updated_count: 1 });
  bridge.fetchGlobalFinishesDirect.mockResolvedValue({
    source: 'live',
    success: true,
    finishes: structuredClone(finishes),
    groups: ['Limited', 'Signature skins', 'Colors'],
    group_settings: { Colors: { display_style: 'compact_dots', show_more_limit: 6 } },
  });
  bridge.toggleFinishStockDirect.mockResolvedValue({ success: true });
  bridge.toggleFinishActiveDirect.mockResolvedValue({ success: true });
  bridge.saveAllGlobalFinishesDirect.mockResolvedValue({ success: true });
  bridge.saveGlobalFinishDirect.mockResolvedValue({ success: true });
  bridge.reorderFinishGroupsDirect.mockImplementation(async (groups: string[]) => ({ success: true, groups }));
});
afterEach(cleanup);

const loaded = async () => {
  render(<MaterialsStockPage />);
  await screen.findByText('Swarm');
};

describe('Finishes & Stock screen', () => {
  it('lists groups in storefront order, keeps empty groups, shows display settings', async () => {
    await loaded();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Limited0', 'Signature skins2', 'Colors1']);
    expect(screen.getByText('No finishes in this group yet. Pick it as the group when you edit or add a finish.')).toBeTruthy();
    expect(screen.getByText('Dots, show 6')).toBeTruthy();
  });

  it('filters by status tab and search', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('tab', { name: /Inactive/ }));
    expect(screen.queryByText('Swarm')).toBeNull();
    expect(screen.getByText('Matte Black')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /^All/ }));
    fireEvent.change(screen.getByPlaceholderText('Search finishes'), { target: { value: 'camo' } });
    expect(screen.queryByText('Swarm')).toBeNull();
    expect(screen.getByText('Black Camo')).toBeTruthy();
  });

  it('switching Active saves immediately through toggle-active', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('switch', { name: 'Show Matte Black on the storefront' }));
    await waitFor(() => expect(bridge.toggleFinishActiveDirect).toHaveBeenCalledWith('matte-black', true));
  });

  it('moving a finish down saves the renumbered group through save-all with the stored groups', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Move Swarm down' }));
    await waitFor(() => expect(bridge.updateAllGlobalFinishesDirect).toHaveBeenCalledTimes(1));
    expect(bridge.saveAllGlobalFinishesDirect).not.toHaveBeenCalled();
    // The move is applied to the fresh list the bridge hands over, not to the screen's copy.
    const transform = bridge.updateAllGlobalFinishesDirect.mock.calls[0][0] as (l: GlobalFinish[], g: string[]) => GlobalFinish[] | null;
    const fresh = [...structuredClone(finishes), { ...finishes[1], id: 'new', slug: 'new', name: 'New', order: 2 }];
    const out = transform(fresh, ['Signature skins'])!;
    const order = Object.fromEntries(out.map((f) => [f.slug, f.order]));
    expect(order).toMatchObject({ 'black-camo': 0, swarm: 1, new: 2, 'matte-black': 0 });
    expect(transform(fresh.filter((f) => f.id !== 'swarm'), [])).toBeNull();
  });

  it('first and last rows cannot move further', async () => {
    await loaded();
    expect((screen.getByRole('button', { name: 'Move Swarm up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move Black Camo down' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the Edit panel saves the whole finish, keeping fields it does not show as changed', async () => {
    await loaded();
    const row = screen.getByText('Swarm').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    const save = await screen.findByRole('button', { name: 'Save' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Main skin extra (Rp)'), { target: { value: '35000' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    // Someone else moved Swarm and marked it coming soon meanwhile; the save keeps that.
    bridge.fetchLiveGlobalFinishesDirect.mockImplementationOnce(async () => ({
      success: true,
      source: 'live',
      finishes: structuredClone(finishes).map((f) => (f.id === 'swarm' ? { ...f, order: 5, status: 'coming_soon', in_stock: false } : f)),
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(bridge.saveGlobalFinishDirect).toHaveBeenCalledTimes(1));
    expect(bridge.saveGlobalFinishDirect.mock.calls[0][0]).toMatchObject({
      order: 5,
      status: 'coming_soon',
      id: 'swarm',
      extra_price: 35000,
      accent_extra_price: 10000,
      badge_text: 'HOT',
      is_custom_per_device: true,
      is_active: true,
    });
  });

  it('Add finish blocks a slug that already exists', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Add finish' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Swarm' } });
    expect(screen.getByText('A finish with the slug "swarm" already exists.')).toBeTruthy();
    const adds = screen.getAllByRole('button', { name: 'Add finish' });
    const add = adds[adds.length - 1] as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });

  it('adding a group saves the new order', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    fireEvent.change(await screen.findByLabelText('New group'), { target: { value: 'Wood series' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
    await waitFor(() =>
      expect(bridge.reorderFinishGroupsDirect).toHaveBeenCalledWith(['Limited', 'Signature skins', 'Colors', 'Wood series']),
    );
  });

  it('a group with finishes cannot be deleted', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    const btn = await screen.findByRole('button', { name: 'Colors has 1 finish; move them first' });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Delete Limited' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('blocks every write while showing a fallback copy and offers Retry', async () => {
    bridge.fetchGlobalFinishesDirect.mockResolvedValueOnce({ success: true, source: 'fallback', finishes: structuredClone(finishes) });
    await loaded();
    expect(screen.getByText('Showing a saved copy, edits are off until finishes load.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add finish' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Groups' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Price tiers' }) as HTMLButtonElement).disabled).toBe(true);
    const row = screen.getByText('Swarm').closest('li')!;
    expect((within(row).getByRole('button', { name: 'Edit' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(row).getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move Swarm down' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('Showing a saved copy, edits are off until finishes load.')).toBeNull());
    expect((screen.getByRole('button', { name: 'Add finish' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('a refresh that only gets a fallback keeps the live list and stays editable', async () => {
    await loaded();
    bridge.fetchGlobalFinishesDirect.mockResolvedValueOnce({ success: true, source: 'fallback', finishes: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(bridge.fetchGlobalFinishesDirect).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Swarm')).toBeTruthy();
    expect(screen.queryByText('Showing a saved copy, edits are off until finishes load.')).toBeNull();
  });

  it('a failed Active toggle switches back', async () => {
    bridge.toggleFinishActiveDirect.mockResolvedValue({ success: false, error: 'offline' });
    await loaded();
    const sw = screen.getByRole('switch', { name: 'Show Matte Black on the storefront' });
    fireEvent.click(sw);
    await waitFor(() => expect(bridge.toggleFinishActiveDirect).toHaveBeenCalled());
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
  });

  it('renaming a group carries its display settings to the new name', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Colors' }));
    fireEvent.change(screen.getByLabelText('New name for Colors'), { target: { value: 'Pastels' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(bridge.renameFinishGroupDirect).toHaveBeenCalledWith('Colors', 'Pastels'));
    await waitFor(() =>
      expect(bridge.saveFinishGroupSettingsDirect).toHaveBeenCalledWith({ Pastels: { display_style: 'compact_dots', show_more_limit: 6 } }),
    );
  });

  it('Escape while renaming cancels only the rename', async () => {
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Colors' }));
    const field = screen.getByLabelText('New name for Colors');
    fireEvent.keyDown(field, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('New name for Colors')).toBeNull());
    expect(screen.getByText('Finish groups')).toBeTruthy();
  });

  it('keeps the panel open with a notice when its finish was deleted elsewhere', async () => {
    await loaded();
    const row = screen.getByText('Swarm').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('button', { name: 'Save' });
    bridge.fetchGlobalFinishesDirect.mockResolvedValueOnce({
      success: true,
      source: 'live',
      finishes: structuredClone(finishes).filter((f) => f.id !== 'swarm'),
      groups: ['Limited', 'Signature skins', 'Colors'],
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Refresh' })[0]);
    expect(await screen.findByText('This finish was deleted elsewhere. Close the panel; nothing here can be saved.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
