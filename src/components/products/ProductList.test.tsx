// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const bridge = vi.hoisted(() => ({ fetchProductsDirect: vi.fn(), fetchProductCategoriesDirect: vi.fn() }));
vi.mock('../../lib/wordpressBridge', async (orig) => ({ ...(await orig<object>()), ...bridge }));
vi.mock('../../context/MarketplaceInjectionContext', () => ({ useMarketplaceInjection: () => ({ openInjectorModal: vi.fn() }) }));

import { ProductList } from './ProductList';

const product = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, slug: name.toLowerCase(), permalink: '', status: 'publish', price: '129000', regular_price: '129000', sale_price: '', images: [], categories: [], ...extra,
});

beforeEach(() => {
  bridge.fetchProductCategoriesDirect.mockResolvedValue({ success: true, categories: [] });
  bridge.fetchProductsDirect.mockResolvedValue({ success: true, products: [product(1, 'Alpha'), product(2, 'Beta')], total_products: 2, max_pages: 1 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const props = {
  summaries: [],
  summariesLoading: false,
  onReloadSummaries: () => {},
  initialConfigurator: 'all' as const,
  onOpenProduct: () => {},
  rowMenuItems: () => [],
};

describe('ProductList', () => {
  it('reports loaded ids, hides trashed rows and shows saved copies until fresh data arrives', async () => {
    const onLoaded = vi.fn();
    render(
      <ProductList {...props} mode="products" hiddenIds={[2]} overrides={{ 1: product(1, 'Alpha saved') as any }} onLoaded={onLoaded} />,
    );
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith([1, 2]));
    expect(screen.getAllByText('Alpha saved').length).toBeGreaterThan(0);
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('studio search does not promise slug search and shows the texture scale', async () => {
    render(
      <ProductList
        {...props}
        mode="studio"
        initialConfigurator="has"
        summaries={[{ product_id: 1, name: 'Alpha', slug: 'alpha', price: 1, categories: [], is_migrated: true, is_configurable: true, layers_count: 2, views_count: 1, family: 'phone', size_multiplier: 1, texture_scale: 0.75 }]}
      />,
    );
    expect(screen.getByPlaceholderText('Search devices or id')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText('Texture scale 75%').length).toBeGreaterThan(0));
  });
});
