import type { ConfiguratorProfileSummary } from '../types';
import type { StatusFamily } from './orderStatus';
import { formatCurrency } from './formatters';

/** Pure rules for the shared product list (Products and Configurator Studio) and the product panel. */

export type ConfiguratorState = 'clean' | 'issues' | 'unaudited' | 'excluded' | 'none';
export type ConfiguratorFilter = 'all' | 'has' | 'clean' | 'issues' | 'unaudited' | 'excluded' | 'none';

export interface ConfiguratorStatus {
  state: ConfiguratorState;
  label: string;
  issues: number;
  family: StatusFamily;
}

/**
 * One status per product from its configurator summary. A product counts as a configurator when it has
 * a profile or layers (`is_configurable`) and was not excluded (`is_configurator === false`). A stored
 * "unaudited" status wins over an old check date.
 */
export function configuratorStatus(summary?: ConfiguratorProfileSummary | null): ConfiguratorStatus {
  if (!summary || !summary.is_configurable) return { state: 'none', label: 'No configurator', issues: 0, family: 'neutral' };
  if (summary.is_configurator === false) return { state: 'excluded', label: 'Excluded', issues: 0, family: 'neutral' };
  if (!summary.last_audited_at || summary.audit_status === 'unaudited') {
    return { state: 'unaudited', label: 'Unaudited', issues: 0, family: 'wait' };
  }
  const count = Number(summary.audit_issues) || 0;
  if (summary.audit_status === 'issues' || count > 0) {
    const issues = Math.max(1, count);
    return { state: 'issues', label: `${issues} ${issues === 1 ? 'issue' : 'issues'}`, issues, family: 'stop' };
  }
  return { state: 'clean', label: 'Clean', issues: 0, family: 'done' };
}

export function matchesConfiguratorFilter(state: ConfiguratorState, filter: ConfiguratorFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'has') return state === 'clean' || state === 'issues' || state === 'unaudited';
  return state === filter;
}

export const CONFIGURATOR_FILTERS: { value: ConfiguratorFilter; label: string }[] = [
  { value: 'all', label: 'All products' },
  { value: 'has', label: 'Has configurator' },
  { value: 'clean', label: 'Clean' },
  { value: 'issues', label: 'Issues' },
  { value: 'unaudited', label: 'Unaudited' },
  { value: 'excluded', label: 'Excluded' },
  { value: 'none', label: 'No configurator' },
];

export function configuratorCounts(summaries: ConfiguratorProfileSummary[]): Record<ConfiguratorFilter, number> {
  const out: Record<ConfiguratorFilter, number> = { all: 0, has: 0, clean: 0, issues: 0, unaudited: 0, excluded: 0, none: 0 };
  summaries.forEach((s) => {
    const state = configuratorStatus(s).state;
    CONFIGURATOR_FILTERS.forEach(({ value }) => {
      if (matchesConfiguratorFilter(state, value)) out[value] += 1;
    });
  });
  return out;
}

/** Product ids that pass a configurator filter, or null when the filter does not restrict. */
export function configuratorIdsFor(summaries: ConfiguratorProfileSummary[], filter: ConfiguratorFilter): number[] | null {
  if (filter === 'all') return null;
  return summaries.filter((s) => matchesConfiguratorFilter(configuratorStatus(s).state, filter)).map((s) => s.product_id);
}

/** Filters that can match products without a configurator, so Studio must load every product's summary. */
export function needsAllSummaries(filter: ConfiguratorFilter): boolean {
  return filter === 'all' || filter === 'excluded' || filter === 'none';
}

export type SortOption = 'updated_desc' | 'updated_asc' | 'title_asc' | 'title_desc' | 'price_desc' | 'price_asc';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'updated_desc', label: 'Newest first' },
  { value: 'updated_asc', label: 'Oldest first' },
  { value: 'title_asc', label: 'Name A to Z' },
  { value: 'title_desc', label: 'Name Z to A' },
  { value: 'price_desc', label: 'Price high to low' },
  { value: 'price_asc', label: 'Price low to high' },
];

const SORT_TO_ORDER: Record<SortOption, { orderby: 'date' | 'title' | 'price'; order: 'asc' | 'desc' }> = {
  updated_desc: { orderby: 'date', order: 'desc' },
  updated_asc: { orderby: 'date', order: 'asc' },
  title_asc: { orderby: 'title', order: 'asc' },
  title_desc: { orderby: 'title', order: 'desc' },
  price_desc: { orderby: 'price', order: 'desc' },
  price_asc: { orderby: 'price', order: 'asc' },
};

export const PAGE_SIZE = 24;

export interface WebstoreQuery {
  page: number;
  per_page: number;
  search?: string;
  include?: number[];
  status: string;
  category?: string;
  orderby: 'date' | 'title' | 'price';
  order: 'asc' | 'desc';
}

export interface WebstoreFilters {
  query: string;
  status: string;
  category: string;
  sort: SortOption;
  configurator: ConfiguratorFilter;
  page: number;
}

/**
 * WooCommerce request for the webstore tab. Configurator filters become an `include` id list from the
 * summaries; an all-digits query is a product id. `empty` means nothing can match; `unavailable` means
 * the configurator filter needs summaries that did not load.
 */
export function buildWebstoreQuery(
  f: WebstoreFilters,
  summaries: ConfiguratorProfileSummary[] | null,
): WebstoreQuery | { empty: true } | { unavailable: true } {
  const q = f.query.trim();
  const idQuery = /^\d+$/.test(q) ? Number(q) : null;
  let include: number[] | undefined;
  if (f.configurator !== 'all') {
    if (!summaries) return { unavailable: true };
    include = configuratorIdsFor(summaries, f.configurator) || [];
  }
  if (idQuery !== null) include = include ? include.filter((id) => id === idQuery) : [idQuery];
  if (include && include.length === 0) return { empty: true };
  const { orderby, order } = SORT_TO_ORDER[f.sort];
  const out: WebstoreQuery = { page: idQuery !== null ? 1 : f.page, per_page: PAGE_SIZE, status: f.status, orderby, order };
  if (q && idQuery === null) out.search = q;
  if (include) out.include = include;
  if (f.category) out.category = f.category;
  return out;
}

export function formatIdr(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return formatCurrency(n, 'IDR');
}

const toPrice = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function productPriceView(p: { price?: string; regular_price?: string; sale_price?: string }): {
  current: number | null;
  regular: number | null;
  onSale: boolean;
} {
  const regular = toPrice(p.regular_price);
  const sale = toPrice(p.sale_price);
  const current = toPrice(p.price) ?? sale ?? regular;
  const onSale = sale !== null && regular !== null && sale < regular;
  return { current: onSale ? sale : current, regular, onSale };
}

/** Rupiah typed by staff: "Rp 129.000", "129,000" and "129000" all read as 129000. Empty is null. */
export function parsePriceInput(raw: string | number | null | undefined): number | null | 'invalid' {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim().replace(/^rp\.?\s*/i, '').replace(/[.,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+$/.test(cleaned)) return 'invalid';
  return Number(cleaned);
}

/** Shopee's own price; null when Shopee sent none (never a made-up amount). */
export function shopeePrice(item: { price_info?: Array<{ original_price?: number; current_price?: number }> }): number | null {
  const info = item.price_info?.[0];
  if (!info) return null;
  const orig = Number(info.original_price);
  if (orig > 0) return orig;
  const curr = Number(info.current_price);
  return curr > 0 ? curr : null;
}

export interface DetailsDraft {
  name: string;
  regular: string;
  sale: string;
  status: string;
  categoryIds: number[];
}

interface DraftSource {
  name: string;
  status: string;
  // WooCommerce sends strings, but some plugin filters return numbers.
  regular_price?: string | number | null;
  sale_price?: string | number | null;
  categories?: Array<{ id: number }>;
}

export function draftFromProduct(p: DraftSource): DetailsDraft {
  return {
    name: p.name || '',
    regular: p.regular_price === null || p.regular_price === undefined ? '' : String(p.regular_price),
    sale: p.sale_price === null || p.sale_price === undefined ? '' : String(p.sale_price),
    status: p.status || 'draft',
    categoryIds: (p.categories || []).map((c) => c.id),
  };
}

export interface DetailsPayload {
  name?: string;
  regular_price?: string;
  sale_price?: string;
  status?: string;
  categories?: Array<{ id: number }>;
}

/** The WooCommerce update for a details draft: only changed fields, plus validation errors. */
export function detailsChanges(
  product: DraftSource,
  draft: DetailsDraft,
): { payload: DetailsPayload; regularChanged: boolean; errors: string[] } {
  const errors: string[] = [];
  const payload: DetailsPayload = {};
  const original = draftFromProduct(product);

  const name = draft.name.trim();
  if (!name) errors.push('Enter a product name.');
  else if (name !== original.name.trim()) payload.name = name;

  const regular = parsePriceInput(draft.regular);
  const sale = parsePriceInput(draft.sale);
  if (regular === 'invalid') errors.push('Regular price must be a whole number of rupiah.');
  else if (regular === null) errors.push('Enter a regular price.');
  if (sale === 'invalid') errors.push('Sale price must be a whole number of rupiah.');
  if (typeof regular === 'number' && typeof sale === 'number' && sale >= regular) {
    errors.push('Sale price must be lower than the regular price.');
  }

  const origRegular = parsePriceInput(original.regular);
  const origSale = parsePriceInput(original.sale);
  let regularChanged = false;
  if (typeof regular === 'number' && regular !== origRegular) {
    payload.regular_price = String(regular);
    regularChanged = true;
  }
  if (sale !== 'invalid' && sale !== origSale) payload.sale_price = sale === null ? '' : String(sale);

  if (draft.status !== original.status) payload.status = draft.status;

  if (draft.categoryIds.length === 0) errors.push('Pick at least one category.');
  const sameCategories =
    draft.categoryIds.length === original.categoryIds.length && draft.categoryIds.every((id) => original.categoryIds.includes(id));
  if (!sameCategories && draft.categoryIds.length > 0) payload.categories = draft.categoryIds.map((id) => ({ id }));

  return { payload, regularChanged, errors };
}

export function isDetailsDirty(product: DraftSource, draft: DetailsDraft): boolean {
  const o = draftFromProduct(product);
  return (
    draft.name !== o.name ||
    draft.regular !== o.regular ||
    draft.sale !== o.sale ||
    draft.status !== o.status ||
    draft.categoryIds.length !== o.categoryIds.length ||
    draft.categoryIds.some((id) => !o.categoryIds.includes(id))
  );
}

/** `#products?product=123` or `#configurator?product=123` */
export function parseProductIdFromHash(hash: string): number | null {
  const query = hash.split('?')[1];
  if (!query) return null;
  const raw = new URLSearchParams(query).get('product');
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

const WP_STATUS: Record<string, { label: string; family: StatusFamily }> = {
  publish: { label: 'Published', family: 'done' },
  draft: { label: 'Draft', family: 'wait' },
  pending: { label: 'Pending review', family: 'wait' },
  private: { label: 'Private', family: 'neutral' },
  trash: { label: 'Trash', family: 'stop' },
};

export function wpStatusMeta(status: string): { label: string; family: StatusFamily } {
  return WP_STATUS[status] || { label: status, family: 'neutral' };
}

export const WP_STATUS_OPTIONS = [
  { value: 'publish', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending review' },
  { value: 'private', label: 'Private' },
];

const SHOPEE_STATUS: Record<string, { label: string; family: StatusFamily }> = {
  NORMAL: { label: 'Live', family: 'done' },
  UNLIST: { label: 'Draft', family: 'wait' },
  BANNED: { label: 'Banned', family: 'stop' },
  DELETED: { label: 'Deleted', family: 'stop' },
};

const TIKTOK_STATUS: Record<string, { label: string; family: StatusFamily }> = {
  ACTIVATE: { label: 'Live', family: 'done' },
  DEACTIVATE: { label: 'Deactivated', family: 'wait' },
  DRAFT: { label: 'Draft', family: 'wait' },
  PENDING: { label: 'In review', family: 'prog' },
  FAILED: { label: 'Failed', family: 'stop' },
  FREEZE: { label: 'Frozen', family: 'stop' },
  SELLER_DEACTIVATED: { label: 'Deactivated', family: 'wait' },
  PLATFORM_DEACTIVATED: { label: 'Deactivated by TikTok', family: 'stop' },
  UNKNOWN: { label: 'Unknown', family: 'neutral' },
};

export const shopeeStatusMeta = (s: string) => SHOPEE_STATUS[s] || { label: s || 'Unknown', family: 'neutral' as StatusFamily };
export const tiktokStatusMeta = (s: string) => TIKTOK_STATUS[s] || { label: s || 'Unknown', family: 'neutral' as StatusFamily };

/** Marketplace lists sort the loaded page (their APIs do not sort); listings without a price sort last. */
export function sortListings<T extends { title: string; price: number | null; updated: number }>(rows: T[], sort: SortOption): T[] {
  const list = [...rows];
  list.sort((a, b) => {
    if (sort === 'title_asc') return a.title.localeCompare(b.title);
    if (sort === 'title_desc') return b.title.localeCompare(a.title);
    if (sort === 'price_asc' || sort === 'price_desc') {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return sort === 'price_asc' ? a.price - b.price : b.price - a.price;
    }
    return sort === 'updated_asc' ? a.updated - b.updated : b.updated - a.updated;
  });
  return list;
}

/** Listing title contains every word of the search (marketplace searches can return unrelated listings). */
export function matchesListingName(title: string, term: string): boolean {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  const t = (title || '').toLowerCase();
  return words.every((w) => t.includes(w));
}
