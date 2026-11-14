// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const bridge = vi.hoisted(() => ({
  updateProductDirect: vi.fn(),
  setProductPriceDirect: vi.fn(),
  fetchPluginFeaturesDirect: vi.fn(),
  fetchProductCategoriesDirect: vi.fn(),
}));
vi.mock('../../lib/wordpressBridge', async (orig) => ({ ...(await orig<object>()), ...bridge }));
vi.mock('../ds/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../context/MarketplaceInjectionContext', () => ({ useMarketplaceInjection: () => ({ openInjectorModal: vi.fn() }) }));

import { ProductPanel } from './ProductPanel';

const product = (over: Record<string, unknown> = {}) =>
  ({ id: 9, name: 'Heritage Skins', slug: 'heritage', permalink: '', status: 'publish', price: '149000', regular_price: '169000', sale_price: '149000', images: [], categories: [{ id: 3, name: 'Limited', slug: 'limited' }], ...over }) as any;
const summary = { product_id: 9, name: 'Heritage', slug: 'heritage', price: 169000, categories: [], is_migrated: true, is_configurable: true, layers_count: 1, views_count: 1, family: 'phone' as const, size_multiplier: 1 };

const renderPanel = (extra: Record<string, unknown> = {}) =>
  render(
    <ProductPanel
      product={product()}
      summary={summary}
      onClose={() => {}}
      onSaved={() => {}}
      onDuplicate={() => {}}
      onTrash={() => {}}
      onOpenStudio={() => {}}
      {...extra}
    />,
  );

const changeRegularAndSave = async () => {
  fireEvent.change(screen.getByLabelText('Regular price (Rp)'), { target: { value: '179000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(bridge.updateProductDirect).toHaveBeenCalled());
};

beforeEach(() => {
  bridge.fetchProductCategoriesDirect.mockResolvedValue({ success: true, categories: [{ id: 3, name: 'Limited', slug: 'limited', parent: 0, count: 1 }] });
  bridge.updateProductDirect.mockResolvedValue({ success: true, product: product({ regular_price: '179000' }) });
  bridge.setProductPriceDirect.mockResolvedValue({ success: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProductPanel price sync', () => {
  it('does not risk a running sale on a plugin without set_price_keeps_sale', async () => {
    bridge.fetchPluginFeaturesDirect.mockResolvedValue([]);
    renderPanel();
    await changeRegularAndSave();
    expect(bridge.updateProductDirect.mock.calls[0][1]).toEqual({ regular_price: '179000' });
    await screen.findByText(/A sale is running/);
    expect(bridge.setProductPriceDirect).not.toHaveBeenCalled();
  });

  it('syncs the configurator base price when the plugin keeps sales', async () => {
    bridge.fetchPluginFeaturesDirect.mockResolvedValue(['set_price_keeps_sale']);
    renderPanel();
    await changeRegularAndSave();
    await waitFor(() => expect(bridge.setProductPriceDirect).toHaveBeenCalledWith(9, 179000));
  });

  it('skips the sync with a notice when configurator data did not load', async () => {
    renderPanel({ summary: undefined, summaryUnknown: true });
    await changeRegularAndSave();
    await screen.findByText(/Configurator data did not load, so the configurator base price was not touched/);
    expect(bridge.setProductPriceDirect).not.toHaveBeenCalled();
  });

  it('skips products without a stored profile', async () => {
    renderPanel({ summary: { ...summary, is_migrated: false, is_configurable: false } });
    await changeRegularAndSave();
    await waitFor(() => expect(bridge.updateProductDirect).toHaveBeenCalled());
    expect(bridge.setProductPriceDirect).not.toHaveBeenCalled();
  });
});
