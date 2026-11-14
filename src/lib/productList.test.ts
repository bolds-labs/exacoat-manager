import { describe, expect, it } from 'vitest';
import type { ConfiguratorProfileSummary } from '../types';
import {
  buildWebstoreQuery,
  configuratorCounts,
  configuratorIdsFor,
  configuratorStatus,
  detailsChanges,
  draftFromProduct,
  formatIdr,
  matchesConfiguratorFilter,
  needsAllSummaries,
  parsePriceInput,
  parseProductIdFromHash,
  productPriceView,
  shopeePrice,
  sortListings,
  configuratorPriceSync,
  textureScaleLabel,
  matchesListingName,
  tiktokStatusMeta,
  wpStatusMeta,
} from './productList';

const s = (over: Partial<ConfiguratorProfileSummary>): ConfiguratorProfileSummary => ({
  product_id: 1,
  name: 'iPhone 17 Pro Skins',
  slug: 'iphone-17-pro-skins',
  price: 129000,
  categories: ['iPhone'],
  is_migrated: true,
  is_configurable: true,
  is_configurator: true,
  layers_count: 3,
  views_count: 1,
  family: 'phone',
  size_multiplier: 1,
  ...over,
});

const clean = s({ product_id: 1, last_audited_at: '2026-11-01T00:00:00Z', audit_status: 'clean', audit_issues: 0 });
const issues = s({ product_id: 2, last_audited_at: '2026-11-01T00:00:00Z', audit_status: 'issues', audit_issues: 3, audit_details: ['Broken chassis'] });
const unaudited = s({ product_id: 3, last_audited_at: null });
const markedUnaudited = s({ product_id: 4, last_audited_at: '2026-11-01T00:00:00Z', audit_status: 'unaudited' });
const excluded = s({ product_id: 5, is_configurator: false });
const none = s({ product_id: 6, is_configurable: false, is_configurator: undefined, layers_count: 0 });
const issuesByCount = s({ product_id: 7, last_audited_at: '2026-11-01T00:00:00Z', audit_status: 'clean', audit_issues: 1 });
const summaries = [clean, issues, unaudited, markedUnaudited, excluded, none, issuesByCount];

describe('configuratorStatus', () => {
  it('maps audit data to one state', () => {
    expect(configuratorStatus(clean)).toMatchObject({ state: 'clean', label: 'Clean', issues: 0, family: 'done' });
    expect(configuratorStatus(issues)).toMatchObject({ state: 'issues', label: '3 issues', issues: 3, family: 'stop' });
    expect(configuratorStatus(issuesByCount)).toMatchObject({ state: 'issues', label: '1 issue' });
    expect(configuratorStatus(unaudited)).toMatchObject({ state: 'unaudited', label: 'Unaudited', family: 'wait' });
    // A stored "unaudited" status wins over an old check date (the old Studio badge said Clean here).
    expect(configuratorStatus(markedUnaudited).state).toBe('unaudited');
    expect(configuratorStatus(excluded)).toMatchObject({ state: 'excluded', label: 'Excluded', family: 'neutral' });
    expect(configuratorStatus(none)).toMatchObject({ state: 'none', label: 'No configurator' });
    expect(configuratorStatus(undefined)).toMatchObject({ state: 'none' });
  });

  it('never reports zero issues for an issues status', () => {
    expect(configuratorStatus(s({ last_audited_at: 'x', audit_status: 'issues', audit_issues: 0 }))).toMatchObject({ state: 'issues', issues: 1 });
  });
});

describe('configurator filters', () => {
  it('matches states', () => {
    expect(matchesConfiguratorFilter('clean', 'has')).toBe(true);
    expect(matchesConfiguratorFilter('issues', 'has')).toBe(true);
    expect(matchesConfiguratorFilter('excluded', 'has')).toBe(false);
    expect(matchesConfiguratorFilter('none', 'none')).toBe(true);
    expect(matchesConfiguratorFilter('excluded', 'excluded')).toBe(true);
    expect(matchesConfiguratorFilter('none', 'all')).toBe(true);
    expect(matchesConfiguratorFilter('unaudited', 'issues')).toBe(false);
  });

  it('counts every filter', () => {
    expect(configuratorCounts(summaries)).toEqual({ all: 7, has: 5, clean: 1, issues: 2, unaudited: 2, excluded: 1, none: 1 });
  });

  it('returns product ids for a restricting filter and null for all', () => {
    expect(configuratorIdsFor(summaries, 'all')).toBeNull();
    expect(configuratorIdsFor(summaries, 'issues')).toEqual([2, 7]);
    expect(configuratorIdsFor(summaries, 'clean')).toEqual([1]);
  });

  it('knows which filters need non-configurator summaries', () => {
    expect(needsAllSummaries('all')).toBe(true);
    expect(needsAllSummaries('none')).toBe(true);
    expect(needsAllSummaries('excluded')).toBe(true);
    expect(needsAllSummaries('has')).toBe(false);
    expect(needsAllSummaries('issues')).toBe(false);
  });
});

describe('buildWebstoreQuery', () => {
  const base = { query: '', status: 'any', category: '', sort: 'updated_desc' as const, configurator: 'all' as const, page: 2 };

  it('passes search, status, category and sort to WooCommerce', () => {
    expect(buildWebstoreQuery({ ...base, query: ' iphone 17 ', status: 'draft', category: '15', sort: 'price_asc' }, null)).toEqual({
      page: 2,
      per_page: 24,
      search: 'iphone 17',
      status: 'draft',
      category: '15',
      orderby: 'price',
      order: 'asc',
    });
  });

  it('treats an all-digits query as a product id', () => {
    expect(buildWebstoreQuery({ ...base, query: '542788' }, null)).toMatchObject({ include: [542788], page: 1 });
  });

  it('restricts to configurator ids and intersects with an id query', () => {
    expect(buildWebstoreQuery({ ...base, configurator: 'issues' }, summaries)).toMatchObject({ include: [2, 7], page: 2 });
    expect(buildWebstoreQuery({ ...base, configurator: 'issues', query: '7' }, summaries)).toMatchObject({ include: [7], page: 1 });
    expect(buildWebstoreQuery({ ...base, configurator: 'issues', query: '1' }, summaries)).toEqual({ empty: true });
    expect(buildWebstoreQuery({ ...base, configurator: 'excluded' }, [clean])).toEqual({ empty: true });
  });

  it('cannot filter by configurator without summaries', () => {
    expect(buildWebstoreQuery({ ...base, configurator: 'issues' }, null)).toEqual({ unavailable: true });
  });

  it('sorts by name and date', () => {
    expect(buildWebstoreQuery({ ...base, sort: 'title_desc' }, null)).toMatchObject({ orderby: 'title', order: 'desc' });
    expect(buildWebstoreQuery({ ...base, sort: 'updated_asc' }, null)).toMatchObject({ orderby: 'date', order: 'asc' });
  });
});

describe('prices', () => {
  it('formats rupiah', () => {
    expect(formatIdr(129000)).toBe('Rp 129.000');
    expect(formatIdr('99000')).toBe('Rp 99.000');
    expect(formatIdr('')).toBe('');
    expect(formatIdr(null)).toBe('');
    expect(formatIdr('abc')).toBe('');
  });

  it('reads regular and sale prices', () => {
    expect(productPriceView({ price: '99000', regular_price: '129000', sale_price: '99000' })).toEqual({ current: 99000, regular: 129000, onSale: true });
    expect(productPriceView({ price: '129000', regular_price: '129000', sale_price: '' })).toEqual({ current: 129000, regular: 129000, onSale: false });
    expect(productPriceView({ price: '', regular_price: '', sale_price: '' })).toEqual({ current: null, regular: null, onSale: false });
  });

  it('parses typed prices', () => {
    expect(parsePriceInput('129000')).toBe(129000);
    expect(parsePriceInput('Rp 129.000')).toBe(129000);
    expect(parsePriceInput(' 99,000 ')).toBe(99000);
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('12a')).toBe('invalid');
    expect(parsePriceInput('-5')).toBe('invalid');
  });

  it('never invents a Shopee price', () => {
    expect(shopeePrice({ price_info: [{ original_price: 159000, current_price: 149000 }] } as any)).toBe(159000);
    expect(shopeePrice({ price_info: [{ original_price: 0, current_price: 149000 }] } as any)).toBe(149000);
    expect(shopeePrice({} as any)).toBeNull();
  });
});

describe('details draft', () => {
  const product = {
    id: 9,
    name: 'iPhone 17 Pro Skins',
    status: 'publish',
    price: '129000',
    regular_price: '129000',
    sale_price: '',
    categories: [{ id: 15, name: 'iPhone', slug: 'iphone' }],
  };

  it('starts from the product', () => {
    expect(draftFromProduct(product)).toEqual({ name: 'iPhone 17 Pro Skins', regular: '129000', sale: '', status: 'publish', categoryIds: [15] });
  });

  it('sends only changed fields', () => {
    const draft = { ...draftFromProduct(product), sale: '99.000' };
    expect(detailsChanges(product, draft)).toEqual({ payload: { sale_price: '99000' }, regularChanged: false, errors: [] });
    expect(detailsChanges(product, draftFromProduct(product))).toEqual({ payload: {}, regularChanged: false, errors: [] });
  });

  it('flags a regular price change and category changes', () => {
    const draft = { ...draftFromProduct(product), regular: '139000', categoryIds: [16, 15] };
    expect(detailsChanges(product, draft)).toEqual({
      payload: { regular_price: '139000', categories: [{ id: 16 }, { id: 15 }] },
      regularChanged: true,
      errors: [],
    });
    expect(detailsChanges(product, { ...draftFromProduct(product), categoryIds: [15] }).payload).toEqual({});
  });

  it('clears a sale price', () => {
    const onSale = { ...product, sale_price: '99000', price: '99000' };
    expect(detailsChanges(onSale, { ...draftFromProduct(onSale), sale: '' }).payload).toEqual({ sale_price: '' });
  });

  it('reads numeric prices from plugin-filtered responses', () => {
    const numeric = { ...product, regular_price: 129000 as unknown as string, sale_price: null as unknown as string };
    expect(draftFromProduct(numeric)).toMatchObject({ regular: '129000', sale: '' });
    expect(detailsChanges(numeric, draftFromProduct(numeric)).payload).toEqual({});
    expect(parsePriceInput(129000)).toBe(129000);
  });

  it('validates', () => {
    expect(detailsChanges(product, { ...draftFromProduct(product), name: ' ' }).errors).toContain('Enter a product name.');
    expect(detailsChanges(product, { ...draftFromProduct(product), regular: 'abc' }).errors).toContain('Regular price must be a whole number of rupiah.');
    expect(detailsChanges(product, { ...draftFromProduct(product), regular: '' }).errors).toContain('Enter a regular price.');
    expect(detailsChanges(product, { ...draftFromProduct(product), sale: '129000' }).errors).toContain('Sale price must be lower than the regular price.');
    expect(detailsChanges(product, { ...draftFromProduct(product), categoryIds: [] }).errors).toContain('Pick at least one category.');
  });
});

describe('misc', () => {
  it('reads the product id from the hash', () => {
    expect(parseProductIdFromHash('#products?product=542788')).toBe(542788);
    expect(parseProductIdFromHash('#configurator?product=12&x=1')).toBe(12);
    expect(parseProductIdFromHash('#products')).toBeNull();
    expect(parseProductIdFromHash('#products?product=abc')).toBeNull();
  });

  it('matches listing names word by word', () => {
    expect(matchesListingName('[EXACOAT] Heritage Skin / Garskin', 'heritage')).toBe(true);
    expect(matchesListingName('iPhone 17 Pro Max Skin', 'iphone 17 pro')).toBe(true);
    expect(matchesListingName('iPhone 16 Pro Skin', 'iphone 17 pro')).toBe(false);
    expect(tiktokStatusMeta('SELLER_DEACTIVATED').label).toBe('Deactivated');
  });

  it('maps webstore statuses', () => {
    expect(wpStatusMeta('publish')).toEqual({ label: 'Published', family: 'done' });
    expect(wpStatusMeta('draft')).toEqual({ label: 'Draft', family: 'wait' });
    expect(wpStatusMeta('weird')).toEqual({ label: 'weird', family: 'neutral' });
  });

  it('sorts marketplace listings on the loaded page', () => {
    const rows = [
      { title: 'B', price: 2, updated: 1 },
      { title: 'A', price: 3, updated: 3 },
      { title: 'C', price: null, updated: 2 },
    ];
    expect(sortListings(rows, 'title_asc').map((r) => r.title)).toEqual(['A', 'B', 'C']);
    expect(sortListings(rows, 'price_desc').map((r) => r.title)).toEqual(['A', 'B', 'C']);
    expect(sortListings(rows, 'price_asc').map((r) => r.title)).toEqual(['B', 'A', 'C']);
    expect(sortListings(rows, 'updated_desc').map((r) => r.title)).toEqual(['A', 'C', 'B']);
  });
});

describe('configuratorPriceSync', () => {
  const base = { regularChanged: true, summary: clean, summariesFailed: false, onSaleAfterSave: false, pluginKeepsSale: false };
  it('syncs only a real regular price change on a stored profile', () => {
    expect(configuratorPriceSync(base)).toBe('sync');
    expect(configuratorPriceSync({ ...base, regularChanged: false })).toBe('none');
    expect(configuratorPriceSync({ ...base, summary: s({ is_migrated: false }) })).toBe('no-profile');
    expect(configuratorPriceSync({ ...base, summary: undefined })).toBe('no-profile');
  });
  it('never syncs when summaries failed', () => {
    expect(configuratorPriceSync({ ...base, summariesFailed: true })).toBe('unknown');
  });
  it('never risks ending a sale on an older plugin', () => {
    expect(configuratorPriceSync({ ...base, onSaleAfterSave: true })).toBe('sale-needs-plugin');
    expect(configuratorPriceSync({ ...base, onSaleAfterSave: true, pluginKeepsSale: true })).toBe('sync');
  });
});

describe('fix round 1 parsing', () => {
  it('reads WooCommerce decimal prices', () => {
    expect(parsePriceInput('129000.00')).toBe(129000);
    expect(parsePriceInput('129000.5')).toBe('invalid');
    expect(parsePriceInput('129.000')).toBe(129000);
    expect(parsePriceInput('Rp 1.290.000')).toBe(1290000);
    expect(parsePriceInput('129,000.00')).toBe(129000);
  });
});

describe('textureScaleLabel', () => {
  it('shows the primary view scale', () => {
    expect(textureScaleLabel(s({ texture_scale: 0.75 }))).toBe('75%');
    expect(textureScaleLabel(s({ texture_scale: 1 }))).toBe('100%');
    expect(textureScaleLabel(s({ texture_scale: undefined }))).toBe('not set');
  });
});
