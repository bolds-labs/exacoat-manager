import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Package, RefreshCw, AlertCircle } from 'lucide-react';
import {
  fetchProductCategoriesDirect,
  fetchProductsDirect,
  type Product,
  type ProductCategory,
} from '../../lib/wordpressBridge';
import type { ConfiguratorProfileSummary } from '../../types';
import {
  CONFIGURATOR_FILTERS,
  PAGE_SIZE,
  SORT_OPTIONS,
  buildWebstoreQuery,
  configuratorCounts,
  type ConfiguratorFilter,
  type SortOption,
} from '../../lib/productList';
import { onWorkspaceRefresh } from '../../lib/workspaceRefresh';
import { Tabs } from '../ds/Tabs';
import { Select } from '../ds/Select';
import { SearchField } from '../ds/SearchField';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { Menu, type MenuItem } from '../ds/Menu';
import { ConfiguratorChip } from './ConfiguratorChip';
import { PriceCell, Thumb, WpStatusChip } from './ProductCells';
import { MarketplaceList, type MarketplaceChannel } from './MarketplaceList';

export type ProductChannel = 'webstore' | MarketplaceChannel;

const WEBSTORE_STATUS_FILTERS = [
  { value: 'any', label: 'All statuses' },
  { value: 'publish', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending review' },
  { value: 'private', label: 'Private' },
  { value: 'trash', label: 'Trash' },
];

export interface ProductListProps {
  mode: 'products' | 'studio';
  /** Configurator summaries keyed by product; null when they failed to load. */
  summaries: ConfiguratorProfileSummary[] | null;
  summariesLoading: boolean;
  summariesError?: string | null;
  onReloadSummaries(): void;
  initialConfigurator: ConfiguratorFilter;
  /** Studio reloads its summaries with every product when a filter needs non-configurators. */
  onConfiguratorFilterChange?(filter: ConfiguratorFilter): void;
  /** Row click (Products: open the panel; Studio: open the editor). */
  onOpenProduct(product: Product): void;
  rowMenuItems(product: Product, summary: ConfiguratorProfileSummary | undefined): MenuItem[];
  /** Studio: the issues chip opens the asset check. */
  onIssuesClick?(productId: number): void;
  /** Studio: read-only price with this link to the Products panel. */
  onEditPrice?(productId: number): void;
  /** Buttons shown at the right of the toolbar (per channel). */
  toolbarActions?(channel: ProductChannel, loadedProducts: Product[], total: number): ReactNode;
  /** Bump to reload the current page (after a duplicate, save or trash). */
  reloadToken?: number;
  /** Saved products shown at once, before the reload answers. */
  overrides?: Record<number, Product>;
  /** Product hidden at once after it was moved to trash. */
  hiddenIds?: number[];
}

const th = 'border-b border-line px-3 py-2.5 text-left text-[12px] font-[450] text-faint whitespace-nowrap';
const td = 'border-b border-line px-3 py-[11px] align-middle';

/** Shared product list for Products (`mode="products"`) and Configurator Studio (`mode="studio"`). */
export function ProductList({
  mode,
  summaries,
  summariesLoading,
  summariesError,
  onReloadSummaries,
  initialConfigurator,
  onConfiguratorFilterChange,
  onOpenProduct,
  rowMenuItems,
  onIssuesClick,
  onEditPrice,
  toolbarActions,
  reloadToken = 0,
  overrides,
  hiddenIds,
}: ProductListProps) {
  const studio = mode === 'studio';
  const [channel, setChannel] = useState<ProductChannel>('webstore');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('any');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortOption>('updated_desc');
  const [configurator, setConfigurator] = useState<ConfiguratorFilter>(initialConfigurator);
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [maxPages, setMaxPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState(false);
  const [marketTotals, setMarketTotals] = useState<Record<MarketplaceChannel, number | undefined>>({ shopee: undefined, tiktok: undefined });
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debounced, status, category, sort, configurator, channel]);

  const loadCategories = useCallback(async () => {
    setCategoriesError(false);
    const res = await fetchProductCategoriesDirect();
    if (res.success) setCategories(res.categories);
    else setCategoriesError(true);
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const summaryById = useMemo(() => {
    const map = new Map<number, ConfiguratorProfileSummary>();
    (summaries || []).forEach((s) => map.set(s.product_id, s));
    return map;
  }, [summaries]);

  const request = useMemo(
    () => buildWebstoreQuery({ query: debounced, status, category, sort, configurator, page }, summaries),
    [debounced, status, category, sort, configurator, page, summaries],
  );

  const requestId = useRef(0);
  useEffect(() => {
    if (channel !== 'webstore') return;
    if ('unavailable' in request) {
      // A configurator filter needs the summaries; wait for them (or their error) instead of guessing.
      setLoading(summariesLoading);
      setProducts([]);
      setTotal(null);
      setError(summariesLoading ? null : 'Configurator data did not load, so this filter cannot be applied.');
      return;
    }
    if ('empty' in request) {
      setProducts([]);
      setTotal(0);
      setMaxPages(1);
      setLoading(false);
      setError(null);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    fetchProductsDirect(request)
      .then((res) => {
        if (id !== requestId.current) return;
        if (res.success) {
          setProducts(res.products);
          setTotal(res.total_products);
          setMaxPages(Math.max(1, res.max_pages));
        } else {
          setProducts([]);
          setTotal(null);
          setError(res.error || 'Products did not load.');
        }
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setProducts([]);
        setError(err instanceof Error ? err.message : 'Products did not load.');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [channel, request, summariesLoading, reloadToken, refreshTick]);

  useEffect(
    () =>
      onWorkspaceRefresh(() => {
        setRefreshTick((t) => t + 1);
        void loadCategories();
      }),
    [loadCategories],
  );

  const counts = useMemo(() => (summaries ? configuratorCounts(summaries) : null), [summaries]);
  const configuratorOptions = CONFIGURATOR_FILTERS.map((f) => ({
    value: f.value,
    label: counts && f.value !== 'all' ? `${f.label} (${counts[f.value]})` : f.label,
  }));
  const categoryOptions = [
    { value: '', label: categoriesError ? 'Categories did not load' : 'All categories' },
    ...(categories || []).map((c) => ({ value: String(c.id), label: c.count ? `${c.name} (${c.count})` : c.name })),
  ];

  const hidden = new Set(hiddenIds || []);
  const rows = products.filter((p) => !hidden.has(p.id)).map((p) => (overrides && overrides[p.id] ? { ...p, ...overrides[p.id] } : p));

  const handleConfigurator = (v: string) => {
    const next = v as ConfiguratorFilter;
    setConfigurator(next);
    onConfiguratorFilterChange?.(next);
  };

  const clearFilters = () => {
    setQuery('');
    setStatus('any');
    setCategory('');
    setConfigurator(studio ? 'has' : 'all');
    onConfiguratorFilterChange?.(studio ? 'has' : 'all');
  };

  const channelTabs = [
    { key: 'webstore', label: 'Webstore', count: total ?? undefined },
    { key: 'shopee', label: 'Shopee', count: marketTotals.shopee },
    { key: 'tiktok', label: 'TikTok', count: marketTotals.tiktok },
  ];

  const from = rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + rows.length;
  const configSummaryFailed = !summariesLoading && summaries === null;

  return (
    <section className="overflow-hidden rounded-[14px] border border-card-border bg-card font-sans text-[14px]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        {!studio && (
          <div className="flex min-w-0 items-center overflow-x-auto [&_button]:whitespace-nowrap">
            <Tabs items={channelTabs} value={channel} onChange={(k) => setChannel(k as ProductChannel)} />
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {toolbarActions?.(channel, rows, total ?? 0)}
          <IconButton
            icon={RefreshCw}
            label="Refresh list"
            onClick={() => {
              setRefreshTick((t) => t + 1);
              if (configSummaryFailed) onReloadSummaries();
            }}
            disabled={loading}
            className={loading ? '[&>svg]:animate-spin' : ''}
          />
        </div>
      </div>

      {channel === 'webstore' ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
            <SearchField
              className="w-full sm:w-[260px]"
              placeholder={studio ? 'Search devices, slug or id' : 'Search products or id'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select aria-label="Category" className="w-full sm:w-[190px]" value={category} options={categoryOptions} onChange={setCategory} disabled={!categories} />
            <Select aria-label="Status" className="w-full sm:w-[150px]" value={status} options={WEBSTORE_STATUS_FILTERS} onChange={setStatus} />
            <Select
              aria-label="Configurator"
              className="w-full sm:w-[200px]"
              value={configurator}
              options={configuratorOptions}
              onChange={handleConfigurator}
            />
            <Select aria-label="Sort" className="w-full sm:w-[170px]" value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v as SortOption)} />
          </div>

          {configSummaryFailed && (
            <div role="status" className="flex flex-wrap items-center gap-3 border-b border-line bg-st-wait-bg px-4 py-2.5">
              <AlertCircle className="h-4 w-4 flex-none text-st-wait-fg" strokeWidth={1.8} aria-hidden />
              <p className="min-w-0 flex-1 text-[13px] text-st-wait-fg">
                Configurator data did not load{summariesError ? `: ${summariesError}` : ''}. The Configurator column and filter are off until it loads.
              </p>
              <Button size="sm" icon={RefreshCw} onClick={onReloadSummaries}>
                Retry
              </Button>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
              <AlertCircle className="h-7 w-7 text-st-stop-fg" strokeWidth={1.6} aria-hidden />
              <div>
                <p className="text-[14px] font-medium text-fg">Products did not load</p>
                <p className="mt-1 text-[13px] text-muted">{error}</p>
              </div>
              <Button icon={RefreshCw} onClick={() => (configSummaryFailed ? onReloadSummaries() : setRefreshTick((t) => t + 1))}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1000px] table-fixed border-collapse">
                  <colgroup>
                    <col />
                    {studio && <col className="w-[150px]" />}
                    <col className="w-[130px]" />
                    <col className="w-[170px]" />
                    <col className="w-[150px]" />
                    <col className="w-[140px]" />
                    <col className="w-[56px]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={th}>Product</th>
                      {studio && <th className={th}>Setup</th>}
                      <th className={th}>Status</th>
                      <th className={th}>Category</th>
                      <th className={th}>Configurator</th>
                      <th className={`${th} text-right`}>Price</th>
                      <th className={th}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={studio ? 7 : 6} className="py-14 text-center">
                          <EmptyState loading={loading} onClear={clearFilters} />
                        </td>
                      </tr>
                    ) : (
                      rows.map((p) => {
                        const summary = summaryById.get(p.id);
                        return (
                          <tr
                            key={p.id}
                            onClick={() => onOpenProduct(p)}
                            className={`cursor-pointer transition-colors hover:bg-chip [&:last-child>td]:border-b-0 ${loading ? 'opacity-60' : ''}`}
                          >
                            <td className={td}>
                              <ProductCell product={p} />
                            </td>
                            {studio && (
                              <td className={`${td} text-[12.5px] text-muted`}>
                                {summary ? (
                                  <span className="font-mono tabular-nums">
                                    {summary.views_count} {summary.views_count === 1 ? 'view' : 'views'}, {summary.layers_count}{' '}
                                    {summary.layers_count === 1 ? 'layer' : 'layers'}
                                    {(summary.presets_count || 0) > 0 ? `, ${summary.presets_count} looks` : ''}
                                  </span>
                                ) : (
                                  <span className="text-faint">None</span>
                                )}
                              </td>
                            )}
                            <td className={td}>
                              <WpStatusChip status={p.status} />
                            </td>
                            <td className={`${td} truncate text-[13px] text-muted`} title={(p.categories || []).map((c) => c.name).join(', ')}>
                              {(p.categories || []).map((c) => c.name).join(', ') || 'Uncategorized'}
                            </td>
                            <td className={td}>
                              <ConfiguratorChip
                                summary={summary}
                                unknown={configSummaryFailed}
                                loading={summariesLoading && !summaries}
                                onIssuesClick={onIssuesClick ? () => onIssuesClick(p.id) : undefined}
                              />
                            </td>
                            <td className={`${td} text-right`}>
                              <div className="flex flex-col items-end gap-0.5">
                                <PriceCell product={p} />
                                {onEditPrice && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditPrice(p.id);
                                    }}
                                    className="rounded text-[12px] text-accent-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                  >
                                    Edit price
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className={td} onClick={(e) => e.stopPropagation()}>
                              <RowMenu items={rowMenuItems(p, summary)} name={p.name} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden">
                {rows.length === 0 ? (
                  <div className="py-10 text-center">
                    <EmptyState loading={loading} onClear={clearFilters} />
                  </div>
                ) : (
                  rows.map((p) => {
                    const summary = summaryById.get(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => onOpenProduct(p)}
                        className="flex cursor-pointer flex-col gap-2 border-b border-line p-3.5 last:border-b-0 hover:bg-chip"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <ProductCell product={p} />
                          <span onClick={(e) => e.stopPropagation()}>
                            <RowMenu items={rowMenuItems(p, summary)} name={p.name} />
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <WpStatusChip status={p.status} />
                          <ConfiguratorChip summary={summary} unknown={configSummaryFailed} loading={summariesLoading && !summaries} onIssuesClick={onIssuesClick ? () => onIssuesClick(p.id) : undefined} />
                          <span className="ml-auto">
                            <PriceCell product={p} />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
                <span>{total !== null ? `${from} to ${to} of ${total}` : loading ? 'Loading...' : ''}</span>
                <div className="flex items-center gap-1.5">
                  <IconButton icon={ChevronLeft} size="sm" label="Previous page" onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1 || loading} />
                  <span className="min-w-[64px] text-center tabular-nums">
                    Page {page} of {maxPages}
                  </span>
                  <IconButton icon={ChevronRight} size="sm" label="Next page" onClick={() => setPage((n) => Math.min(maxPages, n + 1))} disabled={page >= maxPages || loading} />
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <MarketplaceList
          key={channel}
          channel={channel}
          refreshTick={refreshTick}
          onTotal={(n) => setMarketTotals((prev) => ({ ...prev, [channel]: n }))}
        />
      )}
    </section>
  );
}

function ProductCell({ product }: { product: Product }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Thumb src={product.images?.[0]?.src} alt="" />
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-fg" title={product.name}>
          {product.name}
        </p>
        <p className="truncate font-mono text-[12px] text-faint">
          #{product.id}
          {product.sku ? ` · ${product.sku}` : ''}
        </p>
      </div>
    </div>
  );
}

function RowMenu({ items, name }: { items: MenuItem[]; name: string }) {
  if (items.length === 0) return null;
  return (
    <Menu
      items={items}
      trigger={
        <button
          type="button"
          aria-label={`Actions for ${name}`}
          className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-muted hover:bg-chip hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </button>
      }
    />
  );
}

function EmptyState({ loading, onClear }: { loading: boolean; onClear(): void }) {
  if (loading) return <p className="text-[13px] text-muted">Loading products...</p>;
  return (
    <div className="flex flex-col items-center gap-2">
      <Package className="h-7 w-7 text-faint" strokeWidth={1.5} aria-hidden />
      <p className="text-[14px] font-medium text-fg">No products match</p>
      <p className="text-[13px] text-muted">Clear the search or pick another filter.</p>
      <Button size="sm" className="mt-1" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
