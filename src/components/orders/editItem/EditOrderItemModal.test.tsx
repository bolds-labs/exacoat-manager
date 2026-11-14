// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fixture from '../../../lib/__fixtures__/webstore-configurator-iphone-17-pro.json';

const updateOrderDirect = vi.fn();
const fetchProductsDirect = vi.fn();
vi.mock('../../../lib/wordpressBridge', () => ({
  updateOrderDirect: (...a: unknown[]) => updateOrderDirect(...a),
  fetchProductsDirect: (...a: unknown[]) => fetchProductsDirect(...a),
}));
vi.mock('../../../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { EditOrderItemModal } from '../EditOrderItemModal';

const BASE = fixture.basePrice;

const item = {
  id: 11,
  product_id: 537268,
  name: 'iPhone 17 Pro Skins',
  quantity: 1,
  price: 129000,
  subtotal: 129000,
  total: 129000,
  specs: [
    { label: 'Back', value: 'Matte Black' },
    { label: 'Coverage', value: 'Model Cut' },
    { label: 'Logo', value: 'With Logo Cutout' },
  ],
} as any;

const webOrder = { id: 900, order_number: '900', status: 'processing', currency: 'IDR', items: [item], meta_data: [] } as any;
const warrantyOrder = {
  ...webOrder,
  items: [{ ...item, price: 0, subtotal: 0, total: 0 }],
  meta_data: [{ key: '_order_badge', value: 'WARRANTY' }],
  rma: { order_type: 'Warranty', status: 'approved' },
} as any;

function mockFetch(response: () => Response | Promise<Response>) {
  const fn = vi.fn(async () => response());
  vi.stubGlobal('fetch', fn);
  return fn;
}

const ok = () => new Response(JSON.stringify(fixture), { status: 200 });

function open(order = webOrder, it = order.items[0]) {
  render(<EditOrderItemModal order={order} item={it} isOpen onClose={vi.fn()} onSaved={vi.fn()} />);
}

const unitPrice = () => screen.getByLabelText('Unit price') as HTMLInputElement;
const total = () => screen.getByTestId('webstore-total').textContent;
const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

beforeEach(() => {
  updateOrderDirect.mockReset();
  fetchProductsDirect.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('EditOrderItemModal on webstore data', () => {
  it('renders the webstore layers and finish groups in order', async () => {
    mockFetch(ok);
    open();
    expect(await screen.findByText('Additional Camera & Back Glass')).toBeTruthy();
    const groups = screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Back: Limited', 'Back: Signature skins', 'Back: Natural', 'Back: Colors']);
    expect(screen.getByRole('radiogroup', { name: 'Coverage' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Logo cutout' })).toBeTruthy();
  });

  it('shows out of stock finishes as not selectable', async () => {
    mockFetch(ok);
    open();
    const patina = (await screen.findByText('Patina')).closest('button')!;
    expect(patina.hasAttribute('disabled')).toBe(true);
    expect(within(patina).getByText('Out of stock')).toBeTruthy();
  });

  it('keeps the saved price on open, then follows the webstore total on a change', async () => {
    mockFetch(ok);
    open(webOrder, { ...item, price: 120000, subtotal: 120000, total: 120000 });
    await screen.findByText('Additional Camera & Back Glass');
    expect(unitPrice().value).toBe('120000');
    fireEvent.click(screen.getByRole('button', { name: /Swarm/ }));
    expect(total()).toBe(rp(BASE + 30000));
    expect(unitPrice().value).toBe(String(BASE + 30000));
    fireEvent.click(screen.getByRole('radio', { name: /Model 360/ }));
    expect(unitPrice().value).toBe(String(BASE + 70000));
  });

  it('keeps a price staff typed and offers a reset', async () => {
    mockFetch(ok);
    open();
    await screen.findByText('Additional Camera & Back Glass');
    fireEvent.change(unitPrice(), { target: { value: '99000' } });
    fireEvent.click(screen.getByRole('button', { name: /Swarm/ }));
    expect(unitPrice().value).toBe('99000');
    fireEvent.click(screen.getByRole('button', { name: 'Reset to webstore price' }));
    expect(unitPrice().value).toBe(String(BASE + 30000));
  });

  it('leaves a warranty item price alone until Use webstore price', async () => {
    mockFetch(ok);
    open(warrantyOrder);
    await screen.findByText('Additional Camera & Back Glass');
    fireEvent.click(screen.getByRole('button', { name: /Swarm/ }));
    expect(unitPrice().value).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Use webstore price' }));
    expect(unitPrice().value).toBe(String(BASE + 30000));
  });

  it('forces No Logo Cutout when the back finish disables it', async () => {
    mockFetch(ok);
    open();
    await screen.findByText('Additional Camera & Back Glass');
    fireEvent.click(screen.getByRole('button', { name: /Burgundy/ }));
    const withLogo = screen.getByRole('radio', { name: /With Logo Cutout/ });
    expect(withLogo.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('radio', { name: /No Logo Cutout/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('saves the same spec wording as before', async () => {
    mockFetch(ok);
    updateOrderDirect.mockResolvedValue({ success: true, order: webOrder });
    open();
    await screen.findByText('Additional Camera & Back Glass');
    fireEvent.click(screen.getByRole('button', { name: /Swarm/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Model 360/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(updateOrderDirect).toHaveBeenCalled());
    const sent = updateOrderDirect.mock.calls[0][1].items[0];
    expect(sent.specs).toEqual([
      { label: 'Back', value: 'Swarm' },
      { label: 'Coverage', value: '360° Full Coverage' },
      { label: 'Logo', value: 'With Logo Cutout' },
    ]);
    expect(sent.price).toBe(BASE + 70000);
  });

  it('leaves options the item never recorded unpicked and unsaved', async () => {
    mockFetch(ok);
    updateOrderDirect.mockResolvedValue({ success: true, order: webOrder });
    open(webOrder, { ...item, specs: [{ label: 'Back', value: 'Matte Black' }] });
    await screen.findByText('Additional Camera & Back Glass');
    expect(screen.getAllByText(/Not recorded on this item/).length).toBe(2);
    const coverage = screen.getByRole('radiogroup', { name: 'Coverage' });
    expect(within(coverage).queryByRole('radio', { checked: true })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(updateOrderDirect).toHaveBeenCalled());
    expect(updateOrderDirect.mock.calls[0][1].items[0].specs).toEqual([{ label: 'Back', value: 'Matte Black' }]);
  });

  it('flags a saved finish that no longer exists', async () => {
    mockFetch(ok);
    open(webOrder, { ...item, specs: [{ label: 'Back', value: 'Shadow Camo' }] });
    expect(await screen.findByText(/Not available any more:/)).toBeTruthy();
    expect(screen.getAllByText(/Shadow Camo/).length).toBeGreaterThan(0);
  });

  it('shows an error with Retry when the webstore cannot be reached, and retries', async () => {
    let fail = true;
    const fn = mockFetch(() => {
      if (fail) throw new TypeError('Failed to fetch');
      return ok();
    });
    open();
    expect(await screen.findByText(/Could not reach exacoat.com/)).toBeTruthy();
    expect(screen.getByText('Current details')).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Additional Camera & Back Glass')).toBeTruthy();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('says the product has no configurator on a 404', async () => {
    mockFetch(() => new Response('{}', { status: 404 }));
    open();
    expect(await screen.findByText(/has no configurator for this product/)).toBeTruthy();
  });

  it('finds the webstore product for a marketplace item by device name', async () => {
    const fn = mockFetch(ok);
    fetchProductsDirect.mockResolvedValue({ success: true, products: [{ id: 537268, name: 'iPhone 17 Pro Skins', images: [] }] });
    open(webOrder, { ...item, product_id: 2_000_000_000, name: '[EXACOAT] Skin HP - iPhone 17 Pro Garskin', specs: [{ label: 'Finish', value: 'Woven' }] });
    expect(await screen.findByText('Additional Camera & Back Glass')).toBeTruthy();
    expect(fetchProductsDirect).toHaveBeenCalledWith({ search: 'iPhone 17 Pro', per_page: 5 });
    expect(String((fn.mock.calls[0] as unknown[])[0])).toMatch(/\/api\/configurator\/537268$/);
    expect(screen.getAllByText('Woven').length).toBeGreaterThan(0);
  });
});

describe('fix round 1', () => {
  it('lets staff edit, add and remove details when the product has no configurator', async () => {
    mockFetch(() => new Response('{}', { status: 404 }));
    updateOrderDirect.mockResolvedValue({ success: true, order: webOrder });
    open(webOrder, { ...item, specs: [{ label: 'Color', value: 'Black' }, { label: 'Size', value: 'M' }] });
    await screen.findByText(/has no configurator for this product/);
    fireEvent.change(screen.getByDisplayValue('Black'), { target: { value: 'White' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove detail Size' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add detail' }));
    const labels = screen.getAllByLabelText('Detail name');
    fireEvent.change(labels[labels.length - 1], { target: { value: 'Note' } });
    const values = screen.getAllByLabelText('Detail value');
    fireEvent.change(values[values.length - 1], { target: { value: 'Gift' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(updateOrderDirect).toHaveBeenCalled());
    expect(updateOrderDirect.mock.calls[0][1].items[0].specs).toEqual([
      { label: 'Color', value: 'White' },
      { label: 'Note', value: 'Gift' },
    ]);
  });

  it('keeps specs read-only when the webstore is unreachable', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    open();
    await screen.findByText(/Could not reach exacoat.com/);
    expect(screen.queryByRole('button', { name: 'Add detail' })).toBeNull();
    expect(screen.queryByLabelText('Detail value')).toBeNull();
  });

  it('blocks Save when the new device fails to load', async () => {
    let fail = false;
    mockFetch(() => {
      if (fail) throw new TypeError('Failed to fetch');
      return ok();
    });
    fetchProductsDirect.mockResolvedValue({ success: true, products: [{ id: 999, name: 'Galaxy S26 Skins', images: [] }] });
    open();
    await screen.findByText('Additional Camera & Back Glass');
    fail = true;
    fireEvent.click(screen.getByRole('button', { name: 'Change device' }));
    fireEvent.click(await screen.findByRole('button', { name: /Galaxy S26 Skins/ }));
    await screen.findByText(/Could not load the options for this device/);
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    expect(updateOrderDirect).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Retry, or cancel to keep the item as it is/).length).toBeGreaterThan(0);
  });

  it('shows the unreachable error when the product search fails', async () => {
    mockFetch(ok);
    fetchProductsDirect.mockResolvedValue({ success: false, products: [] });
    open(webOrder, { ...item, product_id: 2_000_000_000, name: 'iPhone 17 Pro Skin' });
    expect(await screen.findByText(/Could not reach exacoat.com/)).toBeTruthy();
  });

  it('does not reprice non-IDR orders and formats webstore prices in IDR', async () => {
    mockFetch(ok);
    const usdOrder = { ...webOrder, currency: 'USD', items: [{ ...item, price: 39, subtotal: 39, total: 39 }] };
    open(usdOrder);
    await screen.findByText('Additional Camera & Back Glass');
    fireEvent.click(screen.getByRole('button', { name: /Swarm/ }));
    expect(unitPrice().value).toBe('39');
    expect(total()).toBe(rp(BASE + 30000));
    expect(screen.queryByRole('button', { name: /webstore price/ })).toBeNull();
    expect(screen.getByText(/Webstore prices are in IDR/)).toBeTruthy();
  });

  it('keeps an endorsement item price', async () => {
    mockFetch(ok);
    const endorsement = { ...webOrder, meta_data: [{ key: '_order_badge', value: 'ENDORSEMENT' }], items: [{ ...item, price: 0, subtotal: 0, total: 0 }] };
    open(endorsement);
    await screen.findByText('Additional Camera & Back Glass');
    fireEvent.click(screen.getByRole('button', { name: /Swarm/ }));
    expect(unitPrice().value).toBe('0');
    expect(screen.getByRole('button', { name: 'Use webstore price' })).toBeTruthy();
  });
});

describe('fix round 1: variants and logo', () => {
  const ipad = {
    ...fixture,
    variants: [{ id: 'series', name: 'Series', options: [{ id: '11', name: '11"', price_diff: 0 }, { id: '13', name: '13"', price_diff: 40000 }] }],
  };

  it('shows an unrecorded variant as not picked and does not save it', async () => {
    mockFetch(() => new Response(JSON.stringify(ipad), { status: 200 }));
    updateOrderDirect.mockResolvedValue({ success: true, order: webOrder });
    open();
    await screen.findByText('Additional Camera & Back Glass');
    expect(screen.getByText(/Series is not recorded on this item/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(updateOrderDirect).toHaveBeenCalled());
    expect(updateOrderDirect.mock.calls[0][1].items[0].specs.some((sp: any) => sp.label === 'Series')).toBe(false);
  });

  it('keeps a saved With Logo Cutout on a finish that disables it, with a note', async () => {
    mockFetch(ok);
    updateOrderDirect.mockResolvedValue({ success: true, order: webOrder });
    open(webOrder, { ...item, specs: [{ label: 'Back', value: 'Burgundy' }, { label: 'Coverage', value: 'Model Cut' }, { label: 'Logo', value: 'With Logo Cutout' }] });
    await screen.findByText('Additional Camera & Back Glass');
    expect(screen.getByText(/saved value stays until you change something/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(updateOrderDirect).toHaveBeenCalled());
    expect(updateOrderDirect.mock.calls[0][1].items[0].specs).toContainEqual({ label: 'Logo', value: 'With Logo Cutout' });
  });
});
