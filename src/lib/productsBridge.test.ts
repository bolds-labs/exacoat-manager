// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchConfiguratorProfilesDirect,
  fetchFinishSurchargeTiersDirect,
  fetchProductConfiguratorProfileDirect,
  fetchProductByIdDirect,
  fetchPluginFeaturesDirect,
  resetPluginFeaturesCache,
  fetchProductCategoriesDirect,
  fetchProductsDirect,
  saveProductConfiguratorProfileDirect,
  setProductPriceDirect,
  updateProductDirect,
} from './wordpressBridge';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const calledUrl = (i = 0) => new URL(String(fetchMock.mock.calls[i][0]));
const calledBody = (i = 0) => JSON.parse(String(fetchMock.mock.calls[i][1]?.body));

describe('product requests', () => {
  it('lists products with include, sort and rupiah prices', async () => {
    fetchMock.mockResolvedValue(json(200, [], { 'x-wp-total': '2', 'x-wp-totalpages': '1' }));
    await fetchProductsDirect({ page: 1, per_page: 24, include: [5, 7], orderby: 'price', order: 'asc', status: 'any' });
    const url = calledUrl();
    expect(url.pathname).toMatch(/\/wp-json\/wc\/v3\/products$/);
    expect(url.searchParams.get('include')).toBe('5,7');
    expect(url.searchParams.get('orderby')).toBe('price');
    expect(url.searchParams.get('order')).toBe('asc');
    expect(url.searchParams.get('aelia_cs_currency')).toBe('IDR');
  });

  it('reads one product in rupiah', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 9, name: 'X' }));
    expect(await fetchProductByIdDirect(9)).toMatchObject({ success: true, product: { id: 9 } });
    expect(calledUrl().searchParams.get('aelia_cs_currency')).toBe('IDR');
  });

  it('reports a missing product', async () => {
    fetchMock.mockResolvedValue(json(404, { code: 'woocommerce_rest_product_invalid_id', message: 'Invalid ID.' }));
    expect(await fetchProductByIdDirect(9)).toEqual({ success: false, error: 'Invalid ID.' });
  });

  it('pages through categories', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, [{ id: 1, name: 'iPhone', slug: 'iphone', parent: 0, count: 3 }], { 'x-wp-totalpages': '2' }))
      .mockResolvedValueOnce(json(200, [{ id: 2, name: 'Samsung &amp; Co', slug: 'samsung', parent: 0, count: 1 }], { 'x-wp-totalpages': '2' }));
    const res = await fetchProductCategoriesDirect();
    expect(res.success).toBe(true);
    expect(res.categories.map((c) => c.name)).toEqual(['iPhone', 'Samsung & Co']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends categories with a product update', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 9 }));
    await updateProductDirect(9, { categories: [{ id: 3 }], sale_price: '' });
    expect(calledBody()).toEqual({ categories: [{ id: 3 }], sale_price: '' });
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PUT');
  });
});

describe('single price editor', () => {
  it('never sends a base price with a Studio profile save', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, profile: {} }));
    await saveProductConfiguratorProfileDirect({ product_id: 9, base_price: 1, device_name: 'X', layers: [], views: [] } as any);
    const body = calledBody();
    expect(body.product_id).toBe(9);
    expect('base_price' in body).toBe(false);
  });

  it('reports a failed price sync instead of silently writing WooCommerce', async () => {
    fetchMock.mockResolvedValue(json(500, { success: false, message: 'Boom' }));
    expect(await setProductPriceDirect(9, 139000)).toEqual({ success: false, error: 'Boom' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('no invented configurator data', () => {
  it('reports a failed profile load instead of converting WooCommerce meta', async () => {
    fetchMock.mockResolvedValue(json(500, { success: false, message: 'Server error' }));
    expect(await fetchProductConfiguratorProfileDirect(9)).toEqual({ success: false, error: 'Server error' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('marks a product without a configurator as new', async () => {
    fetchMock.mockResolvedValue(json(200, { success: true, profile: null, finishes: [] }));
    expect(await fetchProductConfiguratorProfileDirect(9)).toMatchObject({ success: true, isNew: true });
  });

  it('accepts an empty profile list and never guesses one from WooCommerce', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, profiles: [] }));
    expect(await fetchConfiguratorProfilesDirect()).toMatchObject({ success: true, profiles: [] });
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await fetchConfiguratorProfilesDirect()).toMatchObject({ success: false, profiles: [], error: 'offline' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports failed price tiers instead of returning built-in ones', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await fetchFinishSurchargeTiersDirect()).toEqual({ success: false, tiers: [], error: 'offline' });
  });
});

describe('plugin features', () => {
  it('reads features from /health and treats an older plugin as having none', async () => {
    resetPluginFeaturesCache();
    fetchMock.mockResolvedValueOnce(json(200, { status: 'online', features: ['set_price_keeps_sale'] }));
    expect(await fetchPluginFeaturesDirect()).toEqual(['set_price_keeps_sale']);
    resetPluginFeaturesCache();
    fetchMock.mockResolvedValueOnce(json(200, { status: 'online', plugin_version: '0.1.228' }));
    expect(await fetchPluginFeaturesDirect()).toEqual([]);
    resetPluginFeaturesCache();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchPluginFeaturesDirect()).toBeNull();
  });
});
