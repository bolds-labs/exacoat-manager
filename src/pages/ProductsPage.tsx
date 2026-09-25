import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';

const formatIDR = (val: number | string | null | undefined): string => {
  return formatCurrency(val, 'IDR');
};
import { ShopeeProductDuplicatorModal } from '../components/orders/ShopeeProductDuplicatorModal';
import { ProductImageManagerModal } from '../components/products/ProductImageManagerModal';
import { ProductSeoModal } from '../components/products/ProductSeoModal';
import {
  Package,
  Globe,
  ShoppingBag,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  Copy,
  ExternalLink,
  Layers,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Check,
  ChevronDown,
  LayoutGrid,
  List,
  ArrowUpDown,
  X,
  Video,
} from 'lucide-react';
import { clsx } from 'clsx';

type ProductChannel = 'wordpress' | 'shopee' | 'tiktok';
type ViewMode = 'grid' | 'table';
type SortOption =
  | 'updated_desc'
  | 'updated_asc'
  | 'title_asc'
  | 'title_desc'
  | 'price_desc'
  | 'price_asc';

interface SortItemConfig {
  value: SortOption;
  label: string;
}

const SORT_OPTIONS: SortItemConfig[] = [
  { value: 'updated_desc', label: 'Recently Updated' },
  { value: 'updated_asc', label: 'Oldest Updated' },
  { value: 'title_asc', label: 'Product Name: A to Z' },
  { value: 'title_desc', label: 'Product Name: Z to A' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'price_asc', label: 'Price: Low to High' },
];

export const ProductsPage: React.FC = () => {
  const { showToast } = useToast();

  // Active channel & view mode
  const [activeChannel, setActiveChannel] = useState<ProductChannel>('wordpress');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('exacoat_products_view_mode');
      if (saved === 'table' || saved === 'grid') return saved;
    }
    return 'grid';
  });

  // Search, Status, and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('updated_desc');

  // Custom Dropdown Open States
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

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

  // Webstore SEO & Short Description Modal State
  const [selectedProductForSeo, setSelectedProductForSeo] = useState<Product | null>(null);
  const [isSeoModalOpen, setIsSeoModalOpen] = useState(false);

  const handleProductSeoUpdated = (updatedProduct: Product) => {
    setWpProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p))
    );
  };

  // Webstore (WooCommerce) Duplicator Modal State
  const [duplicateWpModal, setDuplicateWpModal] = useState<{
    productId: number;
    name: string;
    slug?: string;
    price?: number;
  } | null>(null);
  const [duplicateWpName, setDuplicateWpName] = useState('');
  const [duplicateWpSlug, setDuplicateWpSlug] = useState('');
  const [duplicateWpPrice, setDuplicateWpPrice] = useState(0);
  const [duplicateWpCopyConfig, setDuplicateWpCopyConfig] = useState(true);
  const [isDuplicatingWp, setIsDuplicatingWp] = useState(false);

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

  // Save view mode preference
  const handleToggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('exacoat_products_view_mode', mode);
    }
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setIsSortDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          per_page: 24,
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
    async (offset = shopeeOffset, search = debouncedSearch, status = statusFilter) => {
      setIsLoadingShopee(true);
      setShopeeError(null);
      try {
        const queryStatus = status === 'all' ? 'NORMAL' : status;
        const res = await fetchShopeeProductsDirect({
          offset,
          page_size: 24,
          item_status: queryStatus,
          search: search.trim() || undefined,
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
    [shopeeOffset, debouncedSearch, statusFilter]
  );

  // Load TikTok Products
  const loadTikTokProducts = useCallback(
    async (pageToken = tiktokPageToken, search = debouncedSearch, status = statusFilter) => {
      setIsLoadingTiktok(true);
      setTiktokError(null);
      try {
        const queryStatus = status === 'all' ? 'ALL' : status;
        const res = await fetchTikTokProductsDirect({
          page_size: 24,
          page_token: pageToken || undefined,
          status: queryStatus,
          search: search.trim() || undefined,
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
    [tiktokPageToken, debouncedSearch, statusFilter]
  );

  // Fetch when active channel, search, or status changes
  useEffect(() => {
    if (activeChannel === 'wordpress') {
      loadWordPressProducts(wpPage, debouncedSearch, statusFilter);
    } else if (activeChannel === 'shopee') {
      loadShopeeProducts(shopeeOffset, debouncedSearch, statusFilter);
    } else if (activeChannel === 'tiktok') {
      loadTikTokProducts(tiktokPageToken, debouncedSearch, statusFilter);
    }
  }, [
    activeChannel,
    wpPage,
    shopeeOffset,
    tiktokPageToken,
    debouncedSearch,
    statusFilter,
    loadWordPressProducts,
    loadShopeeProducts,
    loadTikTokProducts,
  ]);

  // Reset pagination offset when search query changes
  useEffect(() => {
    setWpPage(1);
    setShopeeOffset(0);
    setTiktokPageToken('');
  }, [debouncedSearch, statusFilter]);

  // Webstore: Open Duplicate Modal
  const handleOpenWpDuplicate = (product: Product) => {
    const rawPrice = parseFloat(product.regular_price || product.price || '0');
    setDuplicateWpModal({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: isNaN(rawPrice) ? 0 : rawPrice,
    });
    setDuplicateWpName(`${product.name} (Copy)`);
    const initialSlug = (product.slug || product.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setDuplicateWpSlug(`${initialSlug}-copy`);
    setDuplicateWpPrice(isNaN(rawPrice) ? 0 : rawPrice);
    setDuplicateWpCopyConfig(true);
  };

  // Webstore: Execute Duplicate
  const handleExecuteWpDuplicate = async () => {
    if (!duplicateWpModal || !duplicateWpName.trim()) return;
    setIsDuplicatingWp(true);
    try {
      const res = await duplicateProductDirect({
        source_product_id: duplicateWpModal.productId,
        new_name: duplicateWpName.trim(),
        new_slug: duplicateWpSlug.trim(),
        new_price: duplicateWpPrice,
        copy_configurator: duplicateWpCopyConfig,
      });

      if (res.success && res.productId) {
        showToast(
          'success',
          'Product Duplicated',
          `Created "${res.name || duplicateWpName}" with ID #${res.productId} in draft status.`
        );
        setDuplicateWpModal(null);
        // Refresh catalog to display new draft product
        loadWordPressProducts(1, debouncedSearch, statusFilter);
      } else {
        showToast('error', 'Duplication Failed', res.error || 'Failed to duplicate product.');
      }
    } catch (err: any) {
      showToast('error', 'Duplication Error', err.message || 'Network error duplicating product.');
    } finally {
      setIsDuplicatingWp(false);
    }
  };

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
    const targetUnlist = !isCurrentlyUnlisted;

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
        const res = await deleteProductDirect(numId, false);
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

  // Helper to extract reliable price for Shopee items
  const getShopeeItemPrice = (item: ShopeeListingItem): number => {
    if (item.price_info && item.price_info[0]) {
      const orig = Number(item.price_info[0].original_price);
      if (orig > 0) return orig;
      const curr = Number(item.price_info[0].current_price);
      if (curr > 0) return curr;
    }
    return 149000;
  };

  // Filter options for current channel
  const filterOptions = useMemo(() => {
    if (activeChannel === 'wordpress') {
      return [
        { value: 'all', label: 'All Statuses', dot: 'bg-zinc-400' },
        { value: 'publish', label: 'Published (Live)', dot: 'bg-emerald-400' },
        { value: 'draft', label: 'Draft', dot: 'bg-amber-400' },
        { value: 'private', label: 'Private', dot: 'bg-indigo-400' },
        { value: 'trash', label: 'Trash', dot: 'bg-rose-400' },
      ];
    }
    if (activeChannel === 'shopee') {
      return [
        { value: 'all', label: 'All Listings', dot: 'bg-zinc-400' },
        { value: 'NORMAL', label: 'Active (Live)', dot: 'bg-emerald-400' },
        { value: 'UNLIST', label: 'Draft (UNLIST)', dot: 'bg-amber-400' },
        { value: 'BANNED', label: 'Banned', dot: 'bg-rose-400' },
      ];
    }
    return [
      { value: 'all', label: 'All Listings', dot: 'bg-zinc-400' },
      { value: 'ACTIVATE', label: 'Active', dot: 'bg-emerald-400' },
      { value: 'DEACTIVATE', label: 'Deactivated', dot: 'bg-amber-400' },
      { value: 'DRAFT', label: 'Draft', dot: 'bg-indigo-400' },
    ];
  }, [activeChannel]);

  // Sorted WordPress Products
  const sortedWpProducts = useMemo(() => {
    let list = [...wpProducts];
    const rawSearch = debouncedSearch.trim().toLowerCase();
    const tokens = rawSearch.split(/\s+/).filter(Boolean);

    // If searching, filter out any products where title/SKU/ID does not contain all query tokens
    if (tokens.length > 0) {
      list = list.filter((p) => {
        const titleLower = (p.name || '').toLowerCase();
        const skuLower = (p.sku || '').toLowerCase();
        const idStr = String(p.id);

        if (idStr === rawSearch || skuLower.includes(rawSearch)) {
          return true;
        }

        // All search tokens must appear in product title
        return tokens.every((token) => titleLower.includes(token));
      });
    }

    list.sort((a, b) => {
      // Prioritize exact phrase matches in title when searching
      if (rawSearch) {
        const aTitle = (a.name || '').toLowerCase();
        const bTitle = (b.name || '').toLowerCase();
        const aExact = aTitle.includes(rawSearch);
        const bExact = bTitle.includes(rawSearch);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }

      if (sortOption === 'title_asc') return a.name.localeCompare(b.name);
      if (sortOption === 'title_desc') return b.name.localeCompare(a.name);
      const priceA = parseFloat(a.price || a.regular_price || '0');
      const priceB = parseFloat(b.price || b.regular_price || '0');
      if (sortOption === 'price_desc') return priceB - priceA;
      if (sortOption === 'price_asc') return priceA - priceB;
      if (sortOption === 'updated_asc') return a.id - b.id;
      return b.id - a.id;
    });
    return list;
  }, [wpProducts, sortOption, debouncedSearch]);

  // Sorted Shopee Listings
  const sortedShopeeItems = useMemo(() => {
    let list = [...shopeeItems];
    const rawSearch = debouncedSearch.trim().toLowerCase();
    const tokens = rawSearch.split(/\s+/).filter(Boolean);

    // If searching, filter out any Shopee items where title or ID does not contain all query tokens
    if (tokens.length > 0) {
      list = list.filter((item) => {
        const titleLower = (item.item_name || '').toLowerCase();
        const idStr = String(item.item_id);
        if (idStr === rawSearch || idStr.includes(rawSearch)) {
          return true;
        }
        return tokens.every((token) => titleLower.includes(token));
      });
    }

    list.sort((a, b) => {
      if (rawSearch) {
        const aTitle = (a.item_name || '').toLowerCase();
        const bTitle = (b.item_name || '').toLowerCase();
        const aExact = aTitle.includes(rawSearch);
        const bExact = bTitle.includes(rawSearch);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }

      if (sortOption === 'title_asc') return a.item_name.localeCompare(b.item_name);
      if (sortOption === 'title_desc') return b.item_name.localeCompare(a.item_name);
      const priceA = getShopeeItemPrice(a);
      const priceB = getShopeeItemPrice(b);
      if (sortOption === 'price_desc') return priceB - priceA;
      if (sortOption === 'price_asc') return priceA - priceB;
      const updateA = a.update_time || a.create_time || 0;
      const updateB = b.update_time || b.create_time || 0;
      if (sortOption === 'updated_asc') return updateA - updateB;
      return updateB - updateA;
    });
    return list;
  }, [shopeeItems, sortOption, debouncedSearch]);

  // Sorted TikTok Listings
  const sortedTikTokItems = useMemo(() => {
    let list = [...tiktokItems];
    const rawSearch = debouncedSearch.trim().toLowerCase();
    const tokens = rawSearch.split(/\s+/).filter(Boolean);

    // If searching, filter out any TikTok items where title or ID does not contain all query tokens
    if (tokens.length > 0) {
      list = list.filter((item) => {
        const titleLower = (item.title || '').toLowerCase();
        const idStr = String(item.id);
        if (idStr === rawSearch || idStr.includes(rawSearch)) {
          return true;
        }
        return tokens.every((token) => titleLower.includes(token));
      });
    }

    list.sort((a, b) => {
      if (rawSearch) {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        const aExact = aTitle.includes(rawSearch);
        const bExact = bTitle.includes(rawSearch);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
      }

      if (sortOption === 'title_asc') return a.title.localeCompare(b.title);
      if (sortOption === 'title_desc') return b.title.localeCompare(a.title);
      const priceA = parseFloat(a.skus?.[0]?.price || '0');
      const priceB = parseFloat(b.skus?.[0]?.price || '0');
      if (sortOption === 'price_desc') return priceB - priceA;
      if (sortOption === 'price_asc') return priceA - priceB;
      const updateA = a.update_time || a.create_time || 0;
      const updateB = b.update_time || b.create_time || 0;
      if (sortOption === 'updated_asc') return updateA - updateB;
      return updateB - updateA;
    });
    return list;
  }, [tiktokItems, sortOption, debouncedSearch]);

  const activeSortLabel =
    SORT_OPTIONS.find((s) => s.value === sortOption)?.label || 'Recently Updated';

  const activeStatusLabel =
    filterOptions.find((f) => f.value === statusFilter)?.label || 'All Listings';

  const isCurrentlyLoading =
    activeChannel === 'wordpress'
      ? isLoadingWp
      : activeChannel === 'shopee'
      ? isLoadingShopee
      : isLoadingTiktok;

  const handleRefreshCurrent = () => {
    if (activeChannel === 'wordpress') loadWordPressProducts(wpPage, debouncedSearch, statusFilter);
    if (activeChannel === 'shopee') loadShopeeProducts(shopeeOffset, debouncedSearch, statusFilter);
    if (activeChannel === 'tiktok') loadTikTokProducts(tiktokPageToken, debouncedSearch, statusFilter);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Top Banner & Multi-Channel Switcher */}
      <PageHeroHeader
        title="Products Hub"
        subtitle="Multi-channel catalog management across Exacoat Webstore, Shopee Indonesia, and TikTok Shop."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Channel Switcher Pills */}
            <div className="p-1 rounded-2xl bg-neutral-900/80 border border-white/10 w-fit flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveChannel('wordpress');
                  setStatusFilter('all');
                }}
                className={clsx(
                  'min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
                  activeChannel === 'wordpress'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span>Exacoat Webstore</span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono',
                    activeChannel === 'wordpress'
                      ? 'bg-black/20 text-neutral-950 font-bold'
                      : 'bg-white/10 text-neutral-400'
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
                  'min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
                  activeChannel === 'shopee'
                    ? 'bg-orange-500 text-white font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                )}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span>Shopee Indonesia</span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono',
                    activeChannel === 'shopee'
                      ? 'bg-black/20 text-white font-bold'
                      : 'bg-white/10 text-neutral-400'
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
                  'min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
                  activeChannel === 'tiktok'
                    ? 'bg-rose-500 text-white font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Video className="w-4 h-4 shrink-0" />
                <span>TikTok Shop</span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono',
                    activeChannel === 'tiktok'
                      ? 'bg-black/20 text-white font-bold'
                      : 'bg-white/10 text-neutral-400'
                  )}
                >
                  {tiktokTotal}
                </span>
              </button>
            </div>
          </div>
        }
      />

      {/* Control Bar: Search, Status Filters & View Controls */}
      <GlassCard className="p-3 sm:p-4 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] space-y-3 overflow-visible relative z-20">
        {/* Row 1: Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {filterOptions.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={clsx(
                'min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-2',
                statusFilter === tab.value
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-transparent'
              )}
            >
              <span className={clsx('w-2 h-2 rounded-full shrink-0', tab.dot)} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Row 2: Search Input and View Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-zinc-100 dark:border-white/5">
          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={`Search ${activeChannel === 'wordpress' ? 'WooCommerce' : activeChannel === 'shopee' ? 'Shopee' : 'TikTok'} products by name, ID, or SKU...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] pl-9 pr-8 py-2 rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-[#f3aa18]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 rounded-md transition cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Controls: Sort Dropdown, View Toggle, Refresh */}
          <div className="flex items-center gap-2 justify-end flex-wrap">
            {/* Sort Selector */}
            <div ref={sortDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141414] dark:hover:bg-white/[0.06] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span className="truncate max-w-[130px]">{activeSortLabel}</span>
                <ChevronDown
                  className={clsx(
                    'w-3.5 h-3.5 text-zinc-400 transition-transform duration-200',
                    isSortDropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              {isSortDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 shadow-xl py-1.5 z-50 text-xs">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortOption(opt.value);
                        setIsSortDropdownOpen(false);
                      }}
                      className={clsx(
                        'min-h-[40px] w-full px-3.5 py-2 text-left flex items-center justify-between transition cursor-pointer',
                        sortOption === opt.value
                          ? 'bg-amber-500/10 text-[#f3aa18] font-bold'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5'
                      )}
                    >
                      <span>{opt.label}</span>
                      {sortOption === opt.value && <Check className="w-3.5 h-3.5 text-[#f3aa18]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View Mode Toggle: Grid vs Table */}
            <div className="p-1 rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleToggleViewMode('grid')}
                className={clsx(
                  'min-h-[36px] min-w-[36px] p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center',
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-white/10 text-[#f3aa18] shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                )}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('table')}
                className={clsx(
                  'min-h-[36px] min-w-[36px] p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center',
                  viewMode === 'table'
                    ? 'bg-white dark:bg-white/10 text-[#f3aa18] shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
                )}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefreshCurrent}
              disabled={isCurrentlyLoading}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141414] dark:hover:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh catalog"
            >
              <RefreshCw
                className={clsx(
                  'w-3.5 h-3.5 text-[#f3aa18]',
                  isCurrentlyLoading && 'animate-spin'
                )}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Active Search Filter Banner */}
      {debouncedSearch && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Searching for: <strong className="text-zinc-100 font-semibold">{debouncedSearch}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs text-amber-400 hover:text-amber-200 underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHANNEL 1: EXACOAT WEBSTORE (WOOCOMMERCE) */}
      {/* ========================================================================= */}
      {activeChannel === 'wordpress' && (
        <div className="space-y-4">
          {isLoadingWp ? (
            <div className="p-16 rounded-2xl bg-zinc-950/40 border border-zinc-800/80 flex flex-col items-center justify-center gap-3">
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
          ) : sortedWpProducts.length === 0 ? (
            <div className="p-16 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2">
              <Package className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm font-medium text-zinc-300">No products found</p>
              <p className="text-xs text-zinc-500">
                Try searching for another device or reset the status filter.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedWpProducts.map((p) => {
                const featuredImg = p.images && p.images[0] ? p.images[0].src : null;
                const galleryCount = p.images ? p.images.length : 0;
                const formattedPrice = p.regular_price
                  ? formatIDR(parseFloat(p.regular_price))
                  : p.price
                  ? formatIDR(parseFloat(p.price))
                  : 'Rp 0';

                return (
                  <GlassCard
                    key={p.id}
                    hoverEffect={true}
                    className="p-4 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] flex flex-col justify-between space-y-3.5 group transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center relative group/img">
                          {featuredImg ? (
                            <img src={featuredImg} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-zinc-400" />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductForImages(p);
                              setIsImageModalOpen(true);
                            }}
                            className="absolute inset-0 bg-black/70 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition text-[#f3aa18] cursor-pointer"
                            title="Edit Images"
                          >
                            <ImageIcon className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-zinc-400">#{p.id}</span>
                            <select
                              value={p.status}
                              onChange={(e) => handleToggleWpStatus(p, e.target.value)}
                              className={clsx(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-md border focus:outline-none cursor-pointer font-mono',
                                p.status === 'publish'
                                  ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20'
                                  : p.status === 'draft'
                                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-white/[0.08]'
                              )}
                            >
                              <option value="publish" className="bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100">
                                Published
                              </option>
                              <option value="draft" className="bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100">
                                Draft
                              </option>
                              <option value="private" className="bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100">
                                Private
                              </option>
                            </select>
                          </div>

                          <h3 className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#f3aa18] transition-colors">
                            {p.name}
                          </h3>

                          <div className="text-xs font-mono font-bold text-[#f3aa18] tabular-nums">
                            {formattedPrice}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] font-mono">
                          {galleryCount} image(s)
                        </span>
                        {p.categories && p.categories[0] && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] truncate max-w-[140px]">
                            {p.categories[0].name}
                          </span>
                        )}
                        {p.is_configurable && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 font-semibold">
                            Configurable
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductForImages(p);
                            setIsImageModalOpen(true);
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-800 dark:text-neutral-200 border border-zinc-300 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-[#f3aa18]" />
                          <span>Images</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductForSeo(p);
                            setIsSeoModalOpen(true);
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-800 dark:text-neutral-200 border border-zinc-300 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Manage SEO metadata & short description with AI"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                          <span>SEO & Copy</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenWpDuplicate(p)}
                          className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          title="Duplicate product & configurator profile"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Duplicate</span>
                        </button>

                        {p.permalink && (
                          <a
                            href={p.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-600 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white border border-zinc-300 dark:border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                            title="View product on live store"
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
                        className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                        title="Move to trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0d0d0d]/80 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">ID / SKU</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                    {sortedWpProducts.map((p) => {
                      const featuredImg = p.images && p.images[0] ? p.images[0].src : null;
                      const formattedPrice = p.regular_price
                        ? formatIDR(parseFloat(p.regular_price))
                        : p.price
                        ? formatIDR(parseFloat(p.price))
                        : 'Rp 0';

                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                                {featuredImg ? (
                                  <img src={featuredImg} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-zinc-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-zinc-900 dark:text-white line-clamp-1">{p.name}</div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {p.categories?.[0]?.name || 'Uncategorized'} | {p.images?.length || 0} image(s)
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-zinc-500 dark:text-zinc-400">
                            #{p.id}
                            {p.sku && <div className="text-[10px] text-zinc-400 dark:text-zinc-500">{p.sku}</div>}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#f3aa18]">
                            {formattedPrice}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={p.status}
                              onChange={(e) => handleToggleWpStatus(p, e.target.value)}
                              className={clsx(
                                'text-[10px] font-semibold px-2.5 py-1 rounded-md border focus:outline-none cursor-pointer font-mono',
                                p.status === 'publish'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : p.status === 'draft'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-white/[0.08]'
                              )}
                            >
                              <option value="publish" className="bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100">
                                Published
                              </option>
                              <option value="draft" className="bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100">
                                Draft
                              </option>
                              <option value="private" className="bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100">
                                Private
                              </option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForImages(p);
                                  setIsImageModalOpen(true);
                                }}
                                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer"
                              >
                                Images
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForSeo(p);
                                  setIsSeoModalOpen(true);
                                }}
                                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer flex items-center gap-1.5"
                                title="Manage SEO metadata & short description with AI"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                <span>SEO & Copy</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenWpDuplicate(p)}
                                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                title="Duplicate product & configurator profile"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Duplicate</span>
                              </button>

                              {p.permalink && (
                                <a
                                  href={p.permalink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-600 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer flex items-center justify-center"
                                  title="View on store"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setProductToDelete({
                                    id: p.id,
                                    name: p.name,
                                    channel: 'wordpress',
                                  })
                                }
                                className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                                title="Move to trash"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* WordPress Pagination */}
          {wpMaxPages > 1 && (
            <GlassCard className="flex items-center justify-between p-3.5 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111]">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                Page {wpPage} of {wpMaxPages} ({wpTotal} total items)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWpPage((prev) => Math.max(1, prev - 1))}
                  disabled={wpPage <= 1 || isLoadingWp}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141414] dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWpPage((prev) => Math.min(wpMaxPages, prev + 1))}
                  disabled={wpPage >= wpMaxPages || isLoadingWp}
                  className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141414] dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHANNEL 2: SHOPEE OFFICIAL */}
      {/* ========================================================================= */}
      {activeChannel === 'shopee' && (
        <div className="space-y-4">
          {isLoadingShopee ? (
            <GlassCard className="p-16 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#f3aa18] animate-spin" />
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Loading Shopee Open Platform listings...</p>
            </GlassCard>
          ) : shopeeError ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-200">Unable to load Shopee listings</p>
                <p className="text-[11px] text-rose-300/80">{shopeeError}</p>
                <button
                  type="button"
                  onClick={() => loadShopeeProducts()}
                  className="mt-2 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-200 font-semibold text-xs hover:bg-rose-500/30 transition-colors cursor-pointer"
                >
                  Retry Load
                </button>
              </div>
            </div>
          ) : sortedShopeeItems.length === 0 ? (
            <GlassCard className="p-16 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] text-center space-y-2">
              <ShoppingBag className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">No Shopee listings found</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {debouncedSearch
                  ? `No Shopee products matched "${debouncedSearch}". Check item ID or keywords.`
                  : 'No items returned for the current status filter.'}
              </p>
            </GlassCard>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedShopeeItems.map((item) => {
                const img = item.image?.image_url_list?.[0];
                const price = getShopeeItemPrice(item);
                const formattedPrice = formatIDR(price);
                const isUnlisted = item.item_status === 'UNLIST';

                return (
                  <GlassCard
                    key={item.item_id}
                    hoverEffect={true}
                    className="p-4 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] flex flex-col justify-between space-y-4 shadow-xs group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                          {img ? (
                            <img src={img} alt={item.item_name} className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-6 h-6 text-zinc-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-zinc-400">ID #{item.item_id}</span>
                            <span
                              className={clsx(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-md border font-mono',
                                isUnlisted
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              )}
                            >
                              {isUnlisted ? 'UNLIST (Draft)' : 'NORMAL (Live)'}
                            </span>
                          </div>

                          <h3 className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#f3aa18] transition-colors">
                            {item.item_name}
                          </h3>

                          <div className="text-xs font-mono font-bold text-[#f3aa18] tabular-nums">
                            {formattedPrice}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        {item.brand && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] font-mono">
                            {item.brand.original_brand_name}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] font-mono">
                          Cat #{item.category_id}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleShopeeStatus(item)}
                          className={clsx(
                            'min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer',
                            isUnlisted
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                          )}
                          title={isUnlisted ? 'Tampilkan Listing ke Publik' : 'Arsipkan ke Status Draft (UNLIST)'}
                        >
                          {isUnlisted ? 'Tampilkan' : 'Arsipkan'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenShopeeDuplicator(item)}
                          className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          title="Duplikasi listing Shopee ini ke device baru"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Duplikasi</span>
                        </button>
                      </div>

                      {item.seller_centre_url && (
                        <a
                          href={item.seller_centre_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-600 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white border border-zinc-200 dark:border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                          title="Open in Shopee Seller Centre"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0d0d0d]/80 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Shopee Product</th>
                      <th className="py-3 px-4">Item ID</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                    {sortedShopeeItems.map((item) => {
                      const img = item.image?.image_url_list?.[0];
                      const price = getShopeeItemPrice(item);
                      const formattedPrice = formatIDR(price);
                      const isUnlisted = item.item_status === 'UNLIST';

                      return (
                        <tr key={item.item_id} className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                                {img ? (
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <ShoppingBag className="w-4 h-4 text-zinc-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-zinc-900 dark:text-white line-clamp-1">{item.item_name}</div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {item.brand?.original_brand_name || 'Exacoat'} | Cat #{item.category_id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-zinc-500 dark:text-zinc-400">
                            #{item.item_id}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#f3aa18]">
                            {formattedPrice}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={clsx(
                                'text-[10px] font-semibold px-2.5 py-1 rounded-md border font-mono',
                                isUnlisted
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              )}
                            >
                              {isUnlisted ? 'UNLIST (Draft)' : 'NORMAL (Live)'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleShopeeStatus(item)}
                                className={clsx(
                                  'min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer',
                                  isUnlisted
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                                )}
                              >
                                {isUnlisted ? 'Tampilkan' : 'Arsipkan'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenShopeeDuplicator(item)}
                                className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Duplikasi</span>
                              </button>
                              {item.seller_centre_url && (
                                <a
                                  href={item.seller_centre_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-600 hover:text-zinc-900 dark:text-neutral-400 dark:hover:text-white border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer flex items-center justify-center"
                                  title="Open in Seller Centre"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Shopee Offset Navigation */}
          <GlassCard className="flex items-center justify-between p-3.5 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111]">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              Showing offset {shopeeOffset} ({shopeeTotal} total listings)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShopeeOffset((prev) => Math.max(0, prev - 24))}
                disabled={shopeeOffset === 0 || isLoadingShopee}
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141414] dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShopeeOffset((prev) => prev + 24)}
                disabled={!shopeeHasNext || isLoadingShopee}
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#141414] dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHANNEL 3: TIKTOK SHOP */}
      {/* ========================================================================= */}
      {activeChannel === 'tiktok' && (
        <div className="space-y-4">
          {isLoadingTiktok ? (
            <GlassCard className="p-16 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#f3aa18] animate-spin" />
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Loading TikTok Shop listings...</p>
            </GlassCard>
          ) : tiktokError ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-200">Unable to load TikTok Shop listings</p>
                <p className="text-[11px] text-rose-300/80">{tiktokError}</p>
                <button
                  type="button"
                  onClick={() => loadTikTokProducts()}
                  className="mt-2 min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-200 font-semibold text-xs hover:bg-rose-500/30 transition-colors cursor-pointer"
                >
                  Retry Load
                </button>
              </div>
            </div>
          ) : sortedTikTokItems.length === 0 ? (
            <GlassCard className="p-16 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] text-center space-y-2">
              <Video className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">No TikTok Shop listings found</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {debouncedSearch
                  ? `No TikTok products matched "${debouncedSearch}".`
                  : 'No items returned for the current status filter.'}
              </p>
            </GlassCard>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedTikTokItems.map((item) => {
                const img = item.main_images?.[0];
                const sku = item.skus?.[0];
                const price = sku ? formatIDR(parseFloat(sku.price || '0')) : 'Rp 0';
                const isActive = item.status === 'ACTIVATE';

                return (
                  <GlassCard
                    key={item.id}
                    hoverEffect={true}
                    className="p-4 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] flex flex-col justify-between space-y-4 shadow-xs group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                          {img ? (
                            <img src={img} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <Video className="w-6 h-6 text-zinc-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[100px]">
                              #{item.id}
                            </span>
                            <span
                              className={clsx(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-md border font-mono',
                                isActive
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-white/[0.08]'
                              )}
                            >
                              {item.status}
                            </span>
                          </div>

                          <h3 className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug group-hover:text-[#f3aa18] transition-colors">
                            {item.title}
                          </h3>

                          <div className="text-xs font-mono font-bold text-[#f3aa18] tabular-nums">
                            {price}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] font-mono">
                          {item.skus?.length || 0} SKU(s)
                        </span>
                        {sku?.available_stock !== undefined && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] font-mono">
                            Stock: {sku.available_stock}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleTikTokStatus(item)}
                        className={clsx(
                          'min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer',
                          isActive
                            ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
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
                        className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                        title="Deactivate / Remove product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0d0d0d]/80 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">TikTok Product</th>
                      <th className="py-3 px-4">Product ID</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                    {sortedTikTokItems.map((item) => {
                      const img = item.main_images?.[0];
                      const sku = item.skus?.[0];
                      const price = sku ? formatIDR(parseFloat(sku.price || '0')) : 'Rp 0';
                      const isActive = item.status === 'ACTIVATE';

                      return (
                        <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                                {img ? (
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Video className="w-4 h-4 text-zinc-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-zinc-900 dark:text-white line-clamp-1">{item.title}</div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {item.skus?.length || 0} variant(s)
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-zinc-500 dark:text-zinc-400">
                            #{item.id}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#f3aa18]">
                            {price}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={clsx(
                                'text-[10px] font-semibold px-2.5 py-1 rounded-md border font-mono',
                                isActive
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-white/[0.08]'
                              )}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleTikTokStatus(item)}
                                className={clsx(
                                  'min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer',
                                  isActive
                                    ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
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
                                className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                                title="Deactivate"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
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

      {/* Webstore (WooCommerce) Product Duplicator Dialog */}
      <Modal
        isOpen={Boolean(duplicateWpModal)}
        onClose={() => setDuplicateWpModal(null)}
        maxWidth="lg"
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#f3aa18] shrink-0">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                Duplicate Webstore Product
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-xs">
                Source: {duplicateWpModal?.name} (#{duplicateWpModal?.productId})
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setDuplicateWpModal(null)}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteWpDuplicate}
              disabled={isDuplicatingWp || !duplicateWpName.trim()}
              className="min-h-[44px] px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-xs"
            >
              {isDuplicatingWp ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Duplicating...</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate Product</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              New Product Name
            </label>
            <input
              type="text"
              value={duplicateWpName}
              onChange={(e) => {
                setDuplicateWpName(e.target.value);
                setDuplicateWpSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '')
                );
              }}
              autoFocus
              className="w-full min-h-[44px] px-3.5 py-2.5 text-xs rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white focus:outline-none focus:border-[#f3aa18]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                New Product Slug
              </label>
              <input
                type="text"
                value={duplicateWpSlug}
                onChange={(e) => setDuplicateWpSlug(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white focus:outline-none focus:border-[#f3aa18]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Base Price (IDR)
              </label>
              <input
                type="number"
                step="5000"
                value={duplicateWpPrice}
                onChange={(e) => setDuplicateWpPrice(Number(e.target.value) || 0)}
                className="w-full min-h-[44px] px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white focus:outline-none focus:border-[#f3aa18]"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] cursor-pointer">
            <input
              type="checkbox"
              checked={duplicateWpCopyConfig}
              onChange={(e) => setDuplicateWpCopyConfig(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-0 focus:outline-none accent-amber-500 mt-0.5 cursor-pointer"
            />
            <div>
              <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                Copy Full Configurator Setup
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug block mt-0.5">
                Duplicates viewing angles, composable skin layers, finish restrictions, and texture image mappings.
              </span>
            </div>
          </label>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
            <span className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong className="text-[#f3aa18] font-semibold">Status: Draft</strong>. The duplicated product is created in Draft status. Featured image, gallery, descriptions, menu order, categories, and tags are preserved.
            </span>
          </div>
        </div>
      </Modal>

      {/* Shopee Duplicator Modal */}
      <ShopeeProductDuplicatorModal
        isOpen={isShopeeDuplicatorOpen}
        onClose={() => {
          setIsShopeeDuplicatorOpen(false);
          setDuplicatorInitialIdOrUrl(undefined);
        }}
        initialUrlOrId={duplicatorInitialIdOrUrl}
      />

      {/* Webstore Product SEO & Short Description Modal */}
      <ProductSeoModal
        isOpen={isSeoModalOpen}
        onClose={() => {
          setIsSeoModalOpen(false);
          setSelectedProductForSeo(null);
        }}
        product={selectedProductForSeo}
        onUpdated={handleProductSeoUpdated}
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
