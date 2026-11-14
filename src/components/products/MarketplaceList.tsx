import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  EyeOff,
  ImagePlus,
  MoreHorizontal,
  Package,
  RefreshCw,
  Rocket,
  Trash2,
} from 'lucide-react';
import {
  deleteTikTokProductDirect,
  fetchShopeeProductsDirect,
  fetchTikTokProductsDirect,
  setShopeeProductStatusDirect,
  setTikTokProductStatusDirect,
  type ShopeeListingItem,
  type TikTokListingItem,
} from '../../lib/wordpressBridge';
import { PAGE_SIZE, SORT_OPTIONS, formatIdr, shopeePrice, shopeeStatusMeta, sortListings, tiktokStatusMeta, type SortOption } from '../../lib/productList';
import { useMarketplaceInjection } from '../../context/MarketplaceInjectionContext';
import { Select } from '../ds/Select';
import { SearchField } from '../ds/SearchField';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { Menu, type MenuItem } from '../ds/Menu';
import { familyChipClass } from '../ds/StatusChip';
import { toast } from '../ds/toast';
import { ConfirmModal, ConfirmText } from '../orders/panel/ConfirmModal';
import { Thumb } from './ProductCells';

const ShopeeProductDuplicatorModal = lazy(() =>
  import('../orders/ShopeeProductDuplicatorModal').then((m) => ({ default: m.ShopeeProductDuplicatorModal })),
);

export type MarketplaceChannel = 'shopee' | 'tiktok';

const STATUS_FILTERS: Record<MarketplaceChannel, { value: string; label: string }[]> = {
  shopee: [
    { value: 'ALL', label: 'All listings' },
    { value: 'NORMAL', label: 'Live' },
    { value: 'UNLIST', label: 'Draft' },
    { value: 'BANNED', label: 'Banned' },
  ],
  tiktok: [
    { value: 'ALL', label: 'All listings' },
    { value: 'ACTIVATE', label: 'Live' },
    { value: 'DEACTIVATE', label: 'Deactivated' },
    { value: 'DRAFT', label: 'Draft' },
  ],
};

interface Row {
  id: string;
  title: string;
  image?: string;
  price: number | null;
  stock?: number;
  variants?: number;
  status: string;
  updated: number;
  url?: string;
  shopee?: ShopeeListingItem;
  tiktok?: TikTokListingItem;
}

const toRowShopee = (it: ShopeeListingItem): Row => ({
  id: String(it.item_id),
  title: it.item_name || `Item ${it.item_id}`,
  image: it.image?.image_url_list?.[0],
  price: shopeePrice(it),
  stock: it.stock_info_v2?.summary_info?.total_available_stock,
  status: it.item_status,
  updated: it.update_time || it.create_time || 0,
  url: it.seller_centre_url,
  shopee: it,
});

const toRowTikTok = (it: TikTokListingItem): Row => {
  const sku = it.skus?.[0];
  const price = sku ? Number(sku.price) : NaN;
  return {
    id: it.id,
    title: it.title || it.id,
    image: it.main_images?.[0],
    price: Number.isFinite(price) && price > 0 ? price : null,
    stock: sku?.available_stock,
    variants: it.skus?.length || 0,
    status: it.status,
    updated: it.update_time || it.create_time || 0,
    tiktok: it,
  };
};

type Pending =
  | { kind: 'shopee-status'; row: Row; unlist: boolean }
  | { kind: 'tiktok-status'; row: Row; target: 'ACTIVATE' | 'DEACTIVATE' }
  | { kind: 'tiktok-remove'; row: Row };

const th = 'border-b border-line px-3 py-2.5 text-left text-[12px] font-[450] text-faint whitespace-nowrap';
const td = 'border-b border-line px-3 py-[11px] align-middle';

/** Shopee and TikTok listings for the Products screen: list, status, duplicate and image injection. */
export function MarketplaceList({
  channel,
  refreshTick,
  onTotal,
}: {
  channel: MarketplaceChannel;
  refreshTick: number;
  onTotal(total: number): void;
}) {
  const { openInjectorModal } = useMarketplaceInjection();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState<SortOption>('updated_desc');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  // TikTok pages by token: tokens[n] opens page n.
  const [tokens, setTokens] = useState<string[]>(['']);
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [duplicator, setDuplicator] = useState<{ open: boolean; source?: string }>({ open: false });

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(0);
    setTokens(['']);
  }, [debounced, status]);

  const onTotalRef = useRef(onTotal);
  onTotalRef.current = onTotal;
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      if (channel === 'shopee') {
        const res = await fetchShopeeProductsDirect({ offset: page * PAGE_SIZE, page_size: PAGE_SIZE, item_status: status, search: debounced.trim() || undefined });
        if (id !== requestId.current) return;
        if (!res.success) throw new Error(res.error || 'Shopee listings did not load.');
        setRows(res.items.map(toRowShopee));
        setTotal(res.total);
        setHasNext(res.has_next_page);
        onTotalRef.current(res.total);
      } else {
        const res = await fetchTikTokProductsDirect({ page_size: PAGE_SIZE, page_token: tokens[page] || undefined, status, search: debounced.trim() || undefined });
        if (id !== requestId.current) return;
        if (!res.success) throw new Error(res.error || 'TikTok listings did not load.');
        setRows(res.products.map(toRowTikTok));
        setTotal(res.total_count);
        setHasNext(Boolean(res.next_page_token));
        if (res.next_page_token) {
          setTokens((prev) => {
            const next = prev.slice(0, page + 1);
            next[page + 1] = res.next_page_token as string;
            return next;
          });
        }
        onTotalRef.current(res.total_count);
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setRows([]);
      setError(err instanceof Error ? err.message : 'Listings did not load.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    // tokens is read for the current page only; adding it would refetch after every token update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, page, status, debounced]);

  useEffect(() => {
    void load();
  }, [load, refreshTick, tick]);

  const sorted = useMemo(() => sortListings(rows, sort), [rows, sort]);
  const label = channel === 'shopee' ? 'Shopee' : 'TikTok';
  const statusMeta = channel === 'shopee' ? shopeeStatusMeta : tiktokStatusMeta;

  const menuFor = (row: Row): MenuItem[] => {
    const items: MenuItem[] = [];
    if (row.shopee) {
      const live = row.status === 'NORMAL';
      items.push(
        { icon: Copy, title: 'Duplicate listing', description: 'Copy it to another device model', onSelect: () => setDuplicator({ open: true, source: row.id }) },
        { icon: ImagePlus, title: 'Inject images', description: 'Cover and variant images from the generator', onSelect: () => openInjectorModal({ item: row.shopee!, channel: 'shopee', onSuccess: () => setTick((t) => t + 1) }) },
      );
      if (row.url) items.push({ icon: ExternalLink, title: 'Open in Seller Centre', onSelect: () => window.open(row.url, '_blank', 'noopener') });
      if (row.status === 'NORMAL' || row.status === 'UNLIST') {
        items.push('separator', {
          icon: live ? EyeOff : Rocket,
          title: live ? 'Move to draft' : 'Set live',
          onSelect: () => setPending({ kind: 'shopee-status', row, unlist: live }),
        });
      }
    } else if (row.tiktok) {
      const live = row.status === 'ACTIVATE';
      items.push({ icon: ImagePlus, title: 'Inject images', description: 'Cover image from the generator', onSelect: () => openInjectorModal({ tiktokItem: row.tiktok!, channel: 'tiktok', onSuccess: () => setTick((t) => t + 1) }) });
      items.push('separator', {
        icon: live ? EyeOff : Rocket,
        title: live ? 'Deactivate' : 'Activate',
        onSelect: () => setPending({ kind: 'tiktok-status', row, target: live ? 'DEACTIVATE' : 'ACTIVATE' }),
      });
      items.push({ icon: Trash2, title: 'Remove from TikTok', danger: true, onSelect: () => setPending({ kind: 'tiktok-remove', row }) });
    }
    return items;
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'shopee-status') {
        const res = await setShopeeProductStatusDirect(Number(pending.row.id), pending.unlist);
        if (!res.success) throw new Error(res.error || 'Shopee did not accept the change.');
        const next = pending.unlist ? 'UNLIST' : 'NORMAL';
        setRows((prev) => prev.map((r) => (r.id === pending.row.id ? { ...r, status: next } : r)));
        toast.success(pending.unlist ? 'Moved to draft' : 'Listing is live', pending.row.title);
      } else if (pending.kind === 'tiktok-status') {
        const res = await setTikTokProductStatusDirect(pending.row.id, pending.target);
        if (!res.success) throw new Error(res.error || 'TikTok did not accept the change.');
        setRows((prev) => prev.map((r) => (r.id === pending.row.id ? { ...r, status: pending.target } : r)));
        toast.success(pending.target === 'ACTIVATE' ? 'Listing is live' : 'Listing deactivated', pending.row.title);
      } else {
        const res = await deleteTikTokProductDirect(pending.row.id);
        if (!res.success) throw new Error(res.error || 'TikTok did not remove the listing.');
        setRows((prev) => prev.filter((r) => r.id !== pending.row.id));
        toast.success('Removed from TikTok', pending.row.title);
      }
      setPending(null);
    } catch (err) {
      toast.error('Not changed', err instanceof Error ? err.message : 'Could not reach the marketplace.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCopy = (() => {
    if (!pending) return { title: '', label: '', text: '' };
    if (pending.kind === 'shopee-status')
      return pending.unlist
        ? { title: 'Move listing to draft?', label: 'Move to draft', text: 'Buyers can no longer see or order it on Shopee until it is set live again.' }
        : { title: 'Set listing live?', label: 'Set live', text: 'Buyers can see and order it on Shopee right away.' };
    if (pending.kind === 'tiktok-status')
      return pending.target === 'DEACTIVATE'
        ? { title: 'Deactivate listing?', label: 'Deactivate', text: 'Buyers can no longer see or order it on TikTok Shop.' }
        : { title: 'Activate listing?', label: 'Activate', text: 'Buyers can see and order it on TikTok Shop right away.' };
    return { title: 'Remove from TikTok?', label: 'Remove', text: 'The listing is removed from TikTok Shop. This cannot be undone from the manager.' };
  })();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <SearchField className="w-full sm:w-[260px]" placeholder={`Search ${label} listings or id`} value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select aria-label="Status" className="w-full sm:w-[160px]" value={status} options={STATUS_FILTERS[channel]} onChange={setStatus} />
        <Select aria-label="Sort this page" className="w-full sm:w-[170px]" value={sort} options={SORT_OPTIONS} onChange={(v) => setSort(v as SortOption)} />
        {channel === 'shopee' && (
          <Button className="sm:ml-auto" icon={Copy} onClick={() => setDuplicator({ open: true })}>
            Duplicate listing
          </Button>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
          <AlertCircle className="h-7 w-7 text-st-stop-fg" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="text-[14px] font-medium text-fg">{label} listings did not load</p>
            <p className="mt-1 text-[13px] text-muted">{error}</p>
          </div>
          <Button icon={RefreshCw} onClick={() => setTick((t) => t + 1)}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed border-collapse">
              <colgroup>
                <col />
                <col className="w-[170px]" />
                <col className="w-[130px]" />
                <col className="w-[120px]" />
                <col className="w-[140px]" />
                <col className="w-[56px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={th}>{label} listing</th>
                  <th className={th}>{channel === 'shopee' ? 'Item id' : 'Product id'}</th>
                  <th className={th}>Status</th>
                  <th className={th}>Stock</th>
                  <th className={`${th} text-right`}>Price</th>
                  <th className={th}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center">
                      {loading ? (
                        <p className="text-[13px] text-muted">Loading listings...</p>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-7 w-7 text-faint" strokeWidth={1.5} aria-hidden />
                          <p className="text-[14px] font-medium text-fg">No {label} listings match</p>
                          <p className="text-[13px] text-muted">Clear the search or pick another status.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  sorted.map((row) => {
                    const meta = statusMeta(row.status);
                    return (
                      <tr key={row.id} className={`[&:last-child>td]:border-b-0 ${loading ? 'opacity-60' : ''}`}>
                        <td className={td}>
                          <div className="flex min-w-0 items-center gap-3">
                            <Thumb src={row.image} alt="" />
                            <p className="min-w-0 truncate text-[13.5px] font-medium text-fg" title={row.title}>
                              {row.title}
                            </p>
                          </div>
                        </td>
                        <td className={`${td} truncate font-mono text-[12.5px] text-muted`}>{row.id}</td>
                        <td className={td}>
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2 py-[2px] text-[12px] font-medium ${familyChipClass[meta.family]}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                            {meta.label}
                          </span>
                        </td>
                        <td className={`${td} text-[12.5px] text-muted`}>
                          {row.stock !== undefined ? <span className="tabular-nums">{row.stock}</span> : <span className="text-faint">Unknown</span>}
                          {row.variants ? <span className="block text-[12px] text-faint">{row.variants} variants</span> : null}
                        </td>
                        <td className={`${td} text-right font-mono text-[13px] tabular-nums`}>
                          {row.price !== null ? <span className="text-fg">{formatIdr(row.price)}</span> : <span className="font-sans text-faint">No price</span>}
                        </td>
                        <td className={td}>
                          <Menu
                            items={menuFor(row)}
                            trigger={
                              <button
                                type="button"
                                aria-label={`Actions for ${row.title}`}
                                className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-muted hover:bg-chip hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                              >
                                <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                              </button>
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
            <span>{total !== null ? `${sorted.length} on this page, ${total} in total` : loading ? 'Loading...' : ''}</span>
            <div className="flex items-center gap-1.5">
              <IconButton icon={ChevronLeft} size="sm" label="Previous page" onClick={() => setPage((n) => Math.max(0, n - 1))} disabled={page === 0 || loading} />
              <span className="min-w-[52px] text-center tabular-nums">Page {page + 1}</span>
              <IconButton icon={ChevronRight} size="sm" label="Next page" onClick={() => setPage((n) => n + 1)} disabled={!hasNext || loading} />
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null);
        }}
        title={confirmCopy.title}
        reference={pending ? `#${pending.row.id}` : undefined}
        confirmLabel={confirmCopy.label}
        busyLabel="Working..."
        tone={pending?.kind === 'tiktok-remove' ? 'danger' : 'primary'}
        isLoading={busy}
        onConfirm={() => void confirm()}
      >
        <ConfirmText>
          <span className="font-medium text-fg">{pending?.row.title}</span>. {confirmCopy.text}
        </ConfirmText>
      </ConfirmModal>

      {duplicator.open && (
        <Suspense fallback={null}>
          <ShopeeProductDuplicatorModal
            isOpen={duplicator.open}
            onClose={() => {
              setDuplicator({ open: false });
              setTick((t) => t + 1);
            }}
            initialUrlOrId={duplicator.source}
          />
        </Suspense>
      )}
    </>
  );
}
