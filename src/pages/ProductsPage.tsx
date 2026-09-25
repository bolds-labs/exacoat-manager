import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  fetchProductsDirect,
  updateProductDirect,
  deleteProductDirect,
  duplicateProductDirect,
  fetchShopeeProductsDirect,
  setShopeeProductStatusDirect,
  deleteShopeeProductDirect,
  ShopeeListingItem,
  fetchTikTokProductsDirect,
  setTikTokProductStatusDirect,
  deleteTikTokProductDirect,
  TikTokListingItem,
} from '../lib/wordpressBridge';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/formatters';
import { Modal } from '../components/ui/Modal';
import { ShopeeProductDuplicatorModal } from '../components/orders/ShopeeProductDuplicatorModal';
import { ProductImageManagerModal } from '../components/products/ProductImageManagerModal';
import {
  Package,
  Globe,
  ShoppingBag,
  Store,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  Copy,
  ExternalLink,
  Eye,
  Layers,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Check,
  ChevronDown,
  Smartphone,
  Video,
} from 'lucide-react';
import { clsx } from 'clsx';

type ProductChannel = 'wordpress' | 'shopee' | 'tiktok';

export const ProductsPage: React.FC = () => {
  const { showToast } = useToast();

  // Active channel
  const [activeChannel, setActiveChannel] = useState<ProductChannel>('wordpress');

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // WordPress Products State
  const [wpProducts, setWpProducts] = useState<Product[]>([]);
  const [wpTotal, setWpTotal] = useState(0);
  const [wpPage, setWpPage] = useState(1);
  const [wpMaxPages, setWpMaxPages] = useState(1);
  const [isLoadingWp, setIsLoadingWp] = useState(false);
  const [wpError, setWpError] = useState<string | null>(null);

  // Shopee Products State
  const [shopeeItems, setShopeeItems] = useState<ShopeeListingItem[]>([]);
  const [shopeeTotal, setShopeeTotal] = useState(0);
  const [shopeeOffset, setShopeeOffset] = useState(0);
  const [shopeeHasNext, setShopeeHasNext] = useState(false);
  const [isLoadingShopee, setIsLoadingShopee] = useState(false);
  const [shopeeError, setShopeeError] = useState<string | null>(null);

  // TikTok Products State
  const [tiktokItems, setTiktokItems] = useState<TikTokListingItem[]>([]);
  const [tiktokTotal, setTiktokTotal] = useState(0);
  const [tiktokPageToken, setTiktokPageToken] = useState('');
  const [tiktokNextPageToken, setTiktokNextPageToken] = useState('');
  const [isLoadingTiktok, setIsLoadingTiktok] = useState(false);
  const [tiktokError, setTiktokError] = useState<string | null>(null);

  // Modal States
  const [selectedProductForImages, setSelectedProductForImages] = useState<Product | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Shopee Duplicator Modal State
  const [isShopeeDuplicatorOpen, setIsShopeeDuplicatorOpen] = useState(false);
  const [duplicatorInitialIdOrUrl, setDuplicatorInitialIdOrUrl] = useState<string | undefined>(undefined);

  // Delete Confirmation Modal State
  const [productToDelete, setProductToDelete] = useState<{
    id: number | string;
    name: string;
    channel: ProductChannel;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load WordPress Products
  const loadWordPressProducts = useCallback(
    async (page = wpPage, search = debouncedSearch, status = statusFilter) => {
      setIsLoadingWp(true);
      setWpError(null);
      try {
        const queryStatus = status === 'all' ? 'any' : status;
        const res = await fetchProductsDirect({
          page,
          per_page: 20,
          search: search.trim() || undefined,
          status: queryStatus,
        });

        if (res.success) {
          setWpProducts(res.products);
          setWpTotal(res.total_products);
          setWpMaxPages(res.max_pages);
        } else {
          setWpError(res.error || 'Failed to fetch WordPress products.');
          setWpProducts([]);
        }
      } catch (err: any) {
        setWpError(err.message || 'Network error fetching WordPress products.');
        setWpProducts([]);
      } finally {
        setIsLoadingWp(false);
      }
    },
    [wpPage, debouncedSearch, statusFilter]
  );

  // Load Shopee Products
  const loadShopeeProducts = useCallback(
    async (offset = shopeeOffset, status = statusFilter) => {
      setIsLoadingShopee(true);
      setShopeeError(null);
      try {
        const queryStatus = status === 'all' ? 'NORMAL' : status;
        const res = await fetchShopeeProductsDirect({
          offset,
          page_size: 20,
          item_status: queryStatus,
        });

        if (res.success) {
          setShopeeItems(res.items);
          setShopeeTotal(res.total);
          setShopeeHasNext(res.has_next_page);
        } else {
          setShopeeError(res.error || 'Failed to fetch Shopee listings.');
          setShopeeItems([]);
        }
      } catch (err: any) {
        setShopeeError(err.message || 'Network error fetching Shopee listings.');
        setShopeeItems([]);
      } finally {
        setIsLoadingShopee(false);
      }
    },
    [shopeeOffset, statusFilter]
  );

  // Load TikTok Products
  const loadTikTokProducts = useCallback(
    async (pageToken = tiktokPageToken, status = statusFilter) => {
      setIsLoadingTiktok(true);
      setTiktokError(null);
      try {
        const queryStatus = status === 'all' ? 'ALL' : status;
        const res = await fetchTikTokProductsDirect({
          page_size: 20,
          page_token: pageToken || undefined,
          status: queryStatus,
        });

        if (res.success) {
          setTiktokItems(res.products);
          setTiktokTotal(res.total_count);
          setTiktokNextPageToken(res.next_page_token || '');
        } else {
          setTiktokError(res.error || 'Failed to fetch TikTok Shop listings.');
          setTiktokItems([]);
        }
      } catch (err: any) {
        setTiktokError(err.message || 'Network error fetching TikTok Shop listings.');
        setTiktokItems([]);
      } finally {
        setIsLoadingTiktok(false);
      }
    },
    [tiktokPageToken, statusFilter]
  );

  // Trigger loads on channel change
  useEffect(() => {
    if (activeChannel === 'wordpress') {
      loadWordPressProducts(wpPage, debouncedSearch, statusFilter);
    } else if (activeChannel === 'shopee') {
      loadShopeeProducts(shopeeOffset, statusFilter);
    } else if (activeChannel === 'tiktok') {
      loadTikTokProducts(tiktokPageToken, statusFilter);
    }
  }, [
    activeChannel,
    wpPage,
    debouncedSearch,
    statusFilter,
    shopeeOffset,
    tiktokPageToken,
    loadWordPressProducts,
    loadShopeeProducts,
    loadTikTokProducts,
  ]);

  // WordPress: Toggle Status (publish / draft / private)
  const handleToggleWpStatus = async (product: Product, newStatus: string) => {
    try {
      const res = await updateProductDirect(product.id, { status: newStatus });
      if (res.success && res.product) {
        setWpProducts((prev) =>
          prev.map((p) => (p.id === product.id ? (res.product as Product) : p))
        );
        showToast('success', 'Status Updated', `Updated ${product.name} to ${newStatus}.`);
      } else {
        showToast('error', 'Update Failed', res.error || 'Failed to change status.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    }
  };

  // Shopee: Toggle Status (NORMAL vs UNLIST)
  const handleToggleShopeeStatus = async (item: ShopeeListingItem) => {
    const isCurrentlyUnlisted = item.item_status === 'UNLIST';
    const targetUnlist = !isCurrentlyUnlisted; // if unlisted, set unlist=false to publish

    try {
      const res = await setShopeeProductStatusDirect(item.item_id, targetUnlist);
      if (res.success) {
        setShopeeItems((prev) =>
          prev.map((it) =>
            it.item_id === item.item_id
              ? { ...it, item_status: targetUnlist ? 'UNLIST' : 'NORMAL' }
              : it
          )
        );
        showToast(
          'success',
          'Shopee Status Changed',
          targetUnlist
            ? `Item #${item.item_id} set to unlisted draft.`
            : `Item #${item.item_id} published live.`
        );
      } else {
        showToast('error', 'Status Change Failed', res.error || 'Unable to update Shopee item status.');
      }
    } catch (err: any) {
      showToast('error', 'Shopee Error', err.message);
    }
  };

  // TikTok: Toggle Status (ACTIVATE vs DEACTIVATE)
  const handleToggleTikTokStatus = async (item: TikTokListingItem) => {
    const isCurrentlyActive = item.status === 'ACTIVATE';
    const targetStatus = isCurrentlyActive ? 'DEACTIVATE' : 'ACTIVATE';

    try {
      const res = await setTikTokProductStatusDirect(item.id, targetStatus);
      if (res.success) {
        setTiktokItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: targetStatus } : it))
        );
        showToast(
          'success',
          'TikTok Status Changed',
          targetStatus === 'ACTIVATE'
            ? `Product ${item.title} activated.`
            : `Product ${item.title} deactivated.`
        );
      } else {
        showToast('error', 'Status Change Failed', res.error || 'Unable to update TikTok item status.');
      }
    } catch (err: any) {
      showToast('error', 'TikTok Error', err.message);
    }
  };

  // Delete product action confirmation
  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);

    try {
      if (productToDelete.channel === 'wordpress') {
        const numId = Number(productToDelete.id);
        const res = await deleteProductDirect(numId, false); // moves to trash
        if (res.success) {
          setWpProducts((prev) => prev.filter((p) => p.id !== numId));
          setWpTotal((prev) => Math.max(0, prev - 1));
          showToast('success', 'Moved to Trash', `Product ${productToDelete.name} moved to trash.`);
        } else {
          showToast('error', 'Delete Failed', res.error || 'Failed to delete product.');
        }
      } else if (productToDelete.channel === 'shopee') {
        const numId = Number(productToDelete.id);
        const res = await deleteShopeeProductDirect(numId);
        if (res.success) {
          setShopeeItems((prev) => prev.filter((it) => it.item_id !== numId));
          setShopeeTotal((prev) => Math.max(0, prev - 1));
          showToast('success', 'Deleted from Shopee', `Listing #${numId} deleted successfully.`);
        } else {
          showToast('error', 'Delete Failed', res.error || 'Failed to delete Shopee listing.');
        }
      } else if (productToDelete.channel === 'tiktok') {
        const idStr = String(productToDelete.id);
        const res = await deleteTikTokProductDirect(idStr);
        if (res.success) {
          setTiktokItems((prev) => prev.filter((it) => it.id !== idStr));
          setTiktokTotal((prev) => Math.max(0, prev - 1));
          showToast('success', 'Deactivated on TikTok', `Product ${productToDelete.name} deactivated.`);
        } else {
          showToast('error', 'Delete Failed', res.error || 'Failed to deactivate TikTok product.');
        }
      }
    } catch (err: any) {
      showToast('error', 'Delete Error', err.message);
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  // Open Duplicator for a specific Shopee listing
  const handleOpenShopeeDuplicator = (item: ShopeeListingItem) => {
    setDuplicatorInitialIdOrUrl(String(item.item_id));
    setIsShopeeDuplicatorOpen(true);
  };

  // Filter options for current channel
  const filterOptions = useMemo(() => {
    if (activeChannel === 'wordpress') {
      return [
        { value: 'all', label: 'All Statuses' },
        { value: 'publish', label: 'Published' },
        { value: 'draft', label: 'Draft' },
        { value: 'private', label: 'Private' },
        { value: 'trash', label: 'Trash' },
      ];
    }
    if (activeChannel === 'shopee') {
      return [
        { value: 'all', label: 'All Listings' },
        { value: 'NORMAL', label: 'Active (Live)' },
        { value: 'UNLIST', label: 'Draft (UNLIST)' },
        { value: 'BANNED', label: 'Banned' },
      ];
    }
    return [
      { value: 'all', label: 'All Listings' },
      { value: 'ACTIVATE', label: 'Active' },
      { value: 'DEACTIVATE', label: 'Deactivated' },
      { value: 'DRAFT', label: 'Draft' },
    ];
  }, [activeChannel]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Products Hub
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real multi-channel product management across Exacoat Webstore, Shopee, and TikTok Shop.
          </p>
        </div>

        {/* Global Action: Open Duplicator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDuplicatorInitialIdOrUrl(undefined);
              setIsShopeeDuplicatorOpen(true);
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <Copy className="w-4 h-4 text-amber-400" />
            <span>Duplikasi Produk (Shopee Draft)</span>
          </button>
        </div>
      </div>

      {/* Channel Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveChannel('wordpress');
            setStatusFilter('all');
          }}
          className={clsx(
            'min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer',
            activeChannel === 'wordpress'
              ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/10 font-bold'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          )}
        >
          <Globe className="w-4 h-4" />
          <span>Exacoat Webstore</span>
          <span
            className={clsx(
              'px-2 py-0.5 rounded-full text-[10px] font-mono',
              activeChannel === 'wordpress' ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
            )}
          >
            {wpTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveChannel('shopee');
            setStatusFilter('all');
          }}
          className={clsx(
            'min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer',
            activeChannel === 'shopee'
              ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/10 font-bold'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          )}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Shopee Official</span>
          <span
            className={clsx(
              'px-2 py-0.5 rounded-full text-[10px] font-mono',
              activeChannel === 'shopee' ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
            )}
          >
            {shopeeTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveChannel('tiktok');
            setStatusFilter('all');
          }}
          className={clsx(
            'min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer',
            activeChannel === 'tiktok'
              ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/10 font-bold'
              : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          )}
        >
          <Video className="w-4 h-4" />
          <span>TikTok Shop</span>
          <span
            className={clsx(
              'px-2 py-0.5 rounded-full text-[10px] font-mono',
              activeChannel === 'tiktok' ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
            )}
          >
            {tiktokTotal}
          </span>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-950/40 p-3 rounded-2xl border border-zinc-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeChannel === 'wordpress' ? 'WooCommerce' : activeChannel === 'shopee' ? 'Shopee' : 'TikTok'} products...`}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/60 cursor-pointer"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              if (activeChannel === 'wordpress') loadWordPressProducts(wpPage, debouncedSearch, statusFilter);
              if (activeChannel === 'shopee') loadShopeeProducts(shopeeOffset, statusFilter);
              if (activeChannel === 'tiktok') loadTikTokProducts(tiktokPageToken, statusFilter);
            }}
            disabled={isLoadingWp || isLoadingShopee || isLoadingTiktok}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={clsx(
                'w-3.5 h-3.5 text-zinc-400',
                (isLoadingWp || isLoadingShopee || isLoadingTiktok) && 'animate-spin text-amber-400'
              )}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Channel 1: WordPress (WooCommerce) Products */}
      {activeChannel === 'wordpress' && (
        <div className="space-y-4">
          {isLoadingWp ? (
            <div className="p-12 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-zinc-400">Loading WooCommerce product catalog...</p>
            </div>
          ) : wpError ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Unable to load WordPress products</p>
                <p className="mt-1 text-[11px] text-rose-300/80">{wpError}</p>
                <button
                  type="button"
                  onClick={() => loadWordPressProducts()}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 font-medium text-xs hover:bg-rose-500/30 transition cursor-pointer"
                >
                  Retry Load
                </button>
              </div>
            </div>
          ) : wpProducts.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2">
              <Package className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-medium text-zinc-300">No products found</p>
              <p className="text-xs text-zinc-500">
                Try searching for another device or reset the status filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wpProducts.map((p) => {
                const featuredImg = p.images && p.images[0] ? p.images[0].src : null;
                const galleryCount = p.images ? p.images.length : 0;
                const formattedPrice = p.regular_price
                  ? formatCurrency(parseFloat(p.regular_price))
                  : p.price
                  ? formatCurrency(parseFloat(p.price))
                  : 'Rp0';

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700/80 transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Thumbnail & Status Header */}
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center relative group">
                          {featuredImg ? (
                            <img src={featuredImg} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-zinc-600" />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductForImages(p);
                              setIsImageModalOpen(true);
                            }}
                            className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-amber-400"
                            title="Edit Images"
                          >
                            <ImageIcon className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-zinc-500">ID #{p.id}</span>
                            {/* Status Selector Dropdown */}
                            <select
                              value={p.status}
                              onChange={(e) => handleToggleWpStatus(p, e.target.value)}
                              className={clsx(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full border focus:outline-none cursor-pointer',
                                p.status === 'publish'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : p.status === 'draft'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                              )}
                            >
                              <option value="publish" className="bg-zinc-900 text-zinc-100">
                                Published
                              </option>
                              <option value="draft" className="bg-zinc-900 text-zinc-100">
                                Draft
                              </option>
                              <option value="private" className="bg-zinc-900 text-zinc-100">
                                Private
                              </option>
                            </select>
                          </div>

                          <h3 className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-tight">
                            {p.name}
                          </h3>

                          <div className="text-[11px] font-mono font-medium text-amber-400">
                            {formattedPrice}
                          </div>
                        </div>
                      </div>

                      {/* Meta Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          {galleryCount} image(s)
                        </span>
                        {p.categories && p.categories[0] && (
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 truncate max-w-[140px]">
                            {p.categories[0].name}
                          </span>
                        )}
                        {p.is_configurable && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            Configurable
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductForImages(p);
                            setIsImageModalOpen(true);
                          }}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 text-xs font-medium flex items-center gap-1.5 border border-zinc-800 transition cursor-pointer"
                          title="Manage Featured Image & Gallery"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                          <span>Images</span>
                        </button>

                        {p.permalink && (
                          <a
                            href={p.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium flex items-center gap-1 border border-zinc-800 transition cursor-pointer"
                            title="View on store"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setProductToDelete({
                            id: p.id,
                            name: p.name,
                            channel: 'wordpress',
                          })
                        }
                        className="min-h-[36px] p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Move product to trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* WordPress Pagination */}
          {wpMaxPages > 1 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
              <span className="text-xs text-zinc-400">
                Page {wpPage} of {wpMaxPages} ({wpTotal} total items)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWpPage((prev) => Math.max(1, prev - 1))}
                  disabled={wpPage <= 1 || isLoadingWp}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWpPage((prev) => Math.min(wpMaxPages, prev + 1))}
                  disabled={wpPage >= wpMaxPages || isLoadingWp}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Channel 2: Shopee Products */}
      {activeChannel === 'shopee' && (
        <div className="space-y-4">
          {isLoadingShopee ? (
            <div className="p-12 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-zinc-400">Loading Shopee Open Platform listings...</p>
            </div>
          ) : shopeeError ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Unable to load Shopee listings</p>
                <p className="mt-1 text-[11px] text-rose-300/80">{shopeeError}</p>
                <button
                  type="button"
                  onClick={() => loadShopeeProducts()}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 font-medium text-xs hover:bg-rose-500/30 transition cursor-pointer"
                >
                  Retry Load
                </button>
              </div>
            </div>
          ) : shopeeItems.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2">
              <ShoppingBag className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-medium text-zinc-300">No Shopee listings found</p>
              <p className="text-xs text-zinc-500">
                No items returned for the current status filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shopeeItems.map((item) => {
                const img = item.image?.image_url_list?.[0];
                const price = item.price_info?.[0]?.original_price;
                const formattedPrice = price ? formatCurrency(price) : 'Rp0';
                const isUnlisted = item.item_status === 'UNLIST';

                return (
                  <div
                    key={item.item_id}
                    className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700/80 transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {img ? (
                            <img src={img} alt={item.item_name} className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-6 h-6 text-zinc-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-zinc-500">ID #{item.item_id}</span>
                            <span
                              className={clsx(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                                isUnlisted
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              )}
                            >
                              {isUnlisted ? 'UNLIST (Draft)' : 'NORMAL (Live)'}
                            </span>
                          </div>

                          <h3 className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-tight">
                            {item.item_name}
                          </h3>

                          <div className="text-[11px] font-mono font-medium text-amber-400">
                            {formattedPrice}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                        {item.brand && (
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                            {item.brand.original_brand_name}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          Cat #{item.category_id}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleShopeeStatus(item)}
                          className={clsx(
                            'min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer',
                            isUnlisted
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                          )}
                          title={isUnlisted ? 'Tampilkan Listing ke Publik' : 'Arsipkan ke Status Draft (UNLIST)'}
                        >
                          {isUnlisted ? 'Tampilkan' : 'Arsipkan (Draft)'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenShopeeDuplicator(item)}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          title="Duplikasi listing Shopee ini ke device baru"
                        >
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Duplikasi</span>
                        </button>
                      </div>

                      {item.seller_centre_url && (
                        <a
                          href={item.seller_centre_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[36px] p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-800 transition cursor-pointer"
                          title="Open in Shopee Seller Centre"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shopee Offset Navigation */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-zinc-800">
            <span className="text-xs text-zinc-400">
              Showing offset {shopeeOffset} ({shopeeTotal} total listings)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShopeeOffset((prev) => Math.max(0, prev - 20))}
                disabled={shopeeOffset === 0 || isLoadingShopee}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShopeeOffset((prev) => prev + 20)}
                disabled={!shopeeHasNext || isLoadingShopee}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel 3: TikTok Shop Products */}
      {activeChannel === 'tiktok' && (
        <div className="space-y-4">
          {isLoadingTiktok ? (
            <div className="p-12 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-zinc-400">Loading TikTok Shop Open Platform listings...</p>
            </div>
          ) : tiktokError ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Unable to load TikTok Shop listings</p>
                <p className="mt-1 text-[11px] text-rose-300/80">{tiktokError}</p>
                <button
                  type="button"
                  onClick={() => loadTikTokProducts()}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 font-medium text-xs hover:bg-rose-500/30 transition cursor-pointer"
                >
                  Retry Load
                </button>
              </div>
            </div>
          ) : tiktokItems.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2">
              <Video className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-medium text-zinc-300">No TikTok Shop listings found</p>
              <p className="text-xs text-zinc-500">
                No items returned for the current status filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tiktokItems.map((item) => {
                const img = item.main_images?.[0];
                const sku = item.skus?.[0];
                const price = sku ? formatCurrency(parseFloat(sku.price || '0')) : 'Rp0';
                const isActive = item.status === 'ACTIVATE';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700/80 transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {img ? (
                            <img src={img} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <Video className="w-6 h-6 text-zinc-600" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[100px]">
                              #{item.id}
                            </span>
                            <span
                              className={clsx(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                                isActive
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                              )}
                            >
                              {item.status}
                            </span>
                          </div>

                          <h3 className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-tight">
                            {item.title}
                          </h3>

                          <div className="text-[11px] font-mono font-medium text-amber-400">
                            {price}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          {item.skus?.length || 0} SKU(s)
                        </span>
                        {sku?.available_stock !== undefined && (
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                            Stock: {sku.available_stock}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleTikTokStatus(item)}
                        className={clsx(
                          'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer',
                          isActive
                            ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                        )}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setProductToDelete({
                            id: item.id,
                            name: item.title,
                            channel: 'tiktok',
                          })
                        }
                        className="min-h-[36px] p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Deactivate / Remove product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Image Manager Modal */}
      <ProductImageManagerModal
        isOpen={isImageModalOpen}
        onClose={() => {
          setIsImageModalOpen(false);
          setSelectedProductForImages(null);
        }}
        product={selectedProductForImages}
        onUpdated={(updatedProduct) => {
          setWpProducts((prev) =>
            prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
          );
        }}
      />

      {/* Shopee Duplicator Modal */}
      <ShopeeProductDuplicatorModal
        isOpen={isShopeeDuplicatorOpen}
        onClose={() => {
          setIsShopeeDuplicatorOpen(false);
          setDuplicatorInitialIdOrUrl(undefined);
        }}
        initialUrlOrId={duplicatorInitialIdOrUrl}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(productToDelete)}
        onClose={() => setProductToDelete(null)}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2 text-rose-400">
            <Trash2 className="w-5 h-5" />
            <span className="font-semibold text-zinc-100">Confirm Deletion</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setProductToDelete(null)}
              disabled={isDeleting}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-rose-100 bg-rose-600 hover:bg-rose-500 transition shadow cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Product</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-zinc-300">
          <p>
            Are you sure you want to remove <span className="font-semibold text-zinc-100">{productToDelete?.name}</span>?
          </p>
          <p className="text-[11px] text-zinc-400">
            {productToDelete?.channel === 'wordpress' &&
              'This product will be moved to the WooCommerce trash, where it can be recovered or permanently deleted.'}
            {productToDelete?.channel === 'shopee' &&
              'This listing will be deleted from your Shopee Official Store.'}
            {productToDelete?.channel === 'tiktok' &&
              'This product will be deactivated on TikTok Shop.'}
          </p>
        </div>
      </Modal>
    </div>
  );
};
