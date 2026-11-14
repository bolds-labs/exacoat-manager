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
  bridge.fetchGlobalFinishesDirect.mockResolvedValue({
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
    await waitFor(() => expect(bridge.saveAllGlobalFinishesDirect).toHaveBeenCalledTimes(1));
    const [sent, groups] = bridge.saveAllGlobalFinishesDirect.mock.calls[0];
    const order = Object.fromEntries((sent as GlobalFinish[]).map((f) => [f.slug, f.order]));
    expect(order).toMatchObject({ 'black-camo': 0, swarm: 1, 'matte-black': 0 });
    expect(groups).toEqual(['Limited', 'Signature skins', 'Colors']);
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
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(bridge.saveGlobalFinishDirect).toHaveBeenCalledTimes(1));
    expect(bridge.saveGlobalFinishDirect.mock.calls[0][0]).toMatchObject({
      id: 'swarm',
      extra_price: 35000,
      accent_extra_price: 10000,
      badge_text: 'HOT',
      is_custom_per_device: true,
      is_active: true,
      order: 0,
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
});
