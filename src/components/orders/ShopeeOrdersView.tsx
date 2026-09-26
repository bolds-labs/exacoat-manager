import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShopeeOrder,
  ShopeeSettings,
  fetchShopeeOrdersDirect,
  syncShopeeOrdersDirect,
  fetchShopeeSettingsDirect,
  downloadShopeeShippingLabelDirect,
  downloadShopeeBatchShippingLabelsDirect,
  toggleShopeeOrderPrintDirect,
} from '../../lib/wordpressBridge';
import { buildGroupedCourierOptions, matchesCourierFilter } from '../../lib/courierGrouping';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { matchesPhoneQuery, formatDisplayPhone } from '../../lib/phoneUtils';
import { ShopeeSettingsModal } from '../settings/ShopeeSettingsModal';
import { ArrangeShipmentModal } from './ArrangeShipmentModal';
import { ShopeeOrderDetailModal } from './ShopeeOrderDetailModal';
import { FilterSelect } from '../ui/FilterSelect';
import { ShipCountdownBadge } from './ShipCountdownBadge';
import { MarketplaceSyncButton } from './MarketplaceSyncButton';
import { ShopeeProductDuplicatorModal } from './ShopeeProductDuplicatorModal';
import { downloadCsv } from '../../lib/csvExport';
import {
  Store,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  RotateCcw,
  Package,
  Truck,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Tag,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Printer,
  CheckCircle2,
  Download,
  X,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShopeeOrdersViewProps {
  onClaimWarranty: (order: ShopeeOrder) => void;
  onClaimRedeem: (order: ShopeeOrder) => void;
}

type StatusTab = 'ALL' | 'READY_TO_SHIP' | 'TO_PROCESS' | 'PROCESSED' | 'SHIPPED' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';

export const ShopeeOrdersView: React.FC<ShopeeOrdersViewProps> = ({
  onClaimWarranty,
  onClaimRedeem,
}) => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<ShopeeOrder[]>([]);
  const [settings, setSettings] = useState<ShopeeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDuplicatorOpen, setIsDuplicatorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeActionMenuSn, setActiveActionMenuSn] = useState<string | null>(null);
  const [selectedArrangeOrder, setSelectedArrangeOrder] = useState<ShopeeOrder | null>(null);
  const [isArrangeModalOpen, setIsArrangeModalOpen] = useState(false);
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [printFilter, setPrintFilter] = useState<'all' | 'printed' | 'unprinted'>('all');
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('exacoat_orders_per_page');
      const parsed = parseInt(saved || '50', 10);
      return [50, 100, 200].includes(parsed) ? parsed : 50;
    } catch {
      return 50;
    }
  });
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    try {
      localStorage.setItem('exacoat_orders_per_page', String(newSize));
    } catch {
      // Ignore
    }
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, courierFilter, printFilter, searchQuery]);

  // Selection & Detail Modal state
  const [selectedSns, setSelectedSns] = useState<Set<string>>(new Set());
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<ShopeeOrder | null>(null);
  const [syncDays, setSyncDays] = useState<number>(30);
  const [isLiveSearching, setIsLiveSearching] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const isOrderLabelPrinted = useCallback((order: ShopeeOrder) => {
    const st = (order.order_status || '').toUpperCase();
    return Boolean(
      order.is_printed ||
      order.shipping_document_status === 'PRINTED' ||
      ['SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes(st) ||
      order.is_delivered
    );
  }, []);

  const handleShipmentArranged = (orderSn: string, trackingNumber: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.order_sn === orderSn
          ? { ...o, order_status: 'PROCESSED', is_arranged: true, tracking_number: trackingNumber }
          : o
      )
    );
  };

  // Close action dropdown on outside click or Escape key
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setActiveActionMenuSn(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveActionMenuSn(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Load orders and settings directly from backend
  const loadData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);

      const [ordersRes, settingsRes] = await Promise.all([
        fetchShopeeOrdersDirect(),
        fetchShopeeSettingsDirect(),
      ]);

      if (ordersRes.success && Array.isArray(ordersRes.orders)) {
        setOrders(ordersRes.orders);
      } else {
        setOrders([]);
        if (!quiet && ordersRes.error) {
          showToast('error', 'Gagal Memuat Pesanan', ordersRes.error);
        }
      }

      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
        // Auto-sync from Shopee API on page open if store is connected
        if (settingsRes.settings.is_connected && !quiet) {
          syncShopeeOrdersDirect().then((syncRes) => {
            if (syncRes.success && Array.isArray(syncRes.orders) && syncRes.orders.length > 0) {
              setOrders(syncRes.orders);
            }
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      setOrders([]);
      if (!quiet) {
        showToast('error', 'Gagal Memuat Pesanan', err?.message || 'Tidak dapat menghubungi server.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync directly from Shopee API
  const handleSync = async (days = syncDays) => {
    setIsSyncing(true);
    try {
      const res = await syncShopeeOrdersDirect(days, 500);
      if (res.success && Array.isArray(res.orders)) {
        if (res.orders.length > 0) {
          setOrders(res.orders);
          showToast(
            'success',
            'Shopee Synced',
            `Successfully synchronized ${res.total_synced || res.orders.length} orders (${res.total_cached || res.orders.length} total orders in cache).`
          );
        } else {
          showToast(
            'info',
            'Shopee Sync',
            '0 live orders found on Shopee shop for selected range. Preserving cached orders.'
          );
        }
        loadData(true);
      } else {
        showToast('error', 'Shopee Sync Failed', res.error || 'Could not sync orders from Shopee.');
      }
    } catch (err: any) {
      showToast('error', 'Shopee Sync Error', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLiveSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsLiveSearching(true);
    try {
      const res = await fetchShopeeOrdersDirect({ search: q });
      if (res.success && res.orders && res.orders.length > 0) {
        setOrders((prev) => {
          const map = new Map(prev.map((o) => [o.order_sn, o]));
          res.orders!.forEach((o) => map.set(o.order_sn, o));
          return Array.from(map.values());
        });
        showToast('success', 'Order Found', `Found order #${q} directly from Shopee API.`);
      } else {
        showToast('info', 'Order Not Found', `No live order found on Shopee for "${q}".`);
      }
    } catch (err: any) {
      showToast('error', 'Live Search Error', err.message);
    } finally {
      setIsLiveSearching(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintShopeeLabel = async (order: ShopeeOrder) => {
    showToast(
      'info',
      'Memuat Label Shopee',
      `Mengunduh dokumen PDF resmi dari Shopee untuk ${order.order_sn}...`
    );

    try {
      const res = await downloadShopeeShippingLabelDirect(order.order_sn);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
        setOrders((prev) =>
          prev.map((o) =>
            o.order_sn === order.order_sn
              ? { ...o, is_printed: true, shipping_document_status: 'PRINTED' }
              : o
          )
        );
        toggleShopeeOrderPrintDirect(order.order_sn, true).catch(() => {});
        showToast('success', 'Label Terbuka', `Label resmi Shopee untuk ${order.order_sn} berhasil dimuat.`);
        return;
      }

      // If Shopee says shipment must be arranged first, guide operator to arrange modal
      const errLower = (res.error || '').toLowerCase();
      if (
        errLower.includes('atur') ||
        errLower.includes('arrange') ||
        errLower.includes('not arranged') ||
        errLower.includes('ship_order') ||
        errLower.includes('not_ready')
      ) {
        showToast(
          'warning',
          'Atur Pengiriman Diperlukan',
          `Shopee mengharuskan pickup/drop off diatur terlebih dahulu untuk pesanan ${order.order_sn}.`
        );
        setSelectedArrangeOrder(order);
        setIsArrangeModalOpen(true);
        return;
      }

      showToast('error', 'Gagal Mengunduh Label', res.error || 'Shopee tidak dapat memuat PDF label pengiriman.');
    } catch (err: any) {
      showToast('error', 'Gagal Mengunduh Label', err?.message || 'Koneksi ke API Shopee gagal.');
    }
  };

  const handleTogglePrintStatus = async (order: ShopeeOrder, markPrinted: boolean) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.order_sn === order.order_sn
          ? { ...o, is_printed: markPrinted, shipping_document_status: markPrinted ? 'PRINTED' : 'UNPRINTED' }
          : o
      )
    );
    try {
      await toggleShopeeOrderPrintDirect(order.order_sn, markPrinted);
      showToast(
        'success',
        markPrinted ? 'Telah Dicetak' : 'Perlu Dicetak',
        `Status label pesanan #${order.order_sn} diubah menjadi ${markPrinted ? 'Telah Dicetak' : 'Perlu Dicetak'}.`
      );
    } catch (e: any) {
      showToast('error', 'Gagal Memperbarui Status Label', e.message);
    }
  };

  // Status mapping and badge helper (Indonesian marketplace terminology)
  const getStatusBadge = (status: string, _order?: ShopeeOrder) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'READY_TO_SHIP':
        return { label: 'Perlu Diproses', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' };
      case 'PROCESSED':
        return { label: 'Telah Diproses', bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' };
      case 'SHIPPED':
        return { label: 'Dikirim', bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20' };
      case 'TO_CONFIRM_RECEIVE':
        return { label: 'Telah Sampai', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'COMPLETED':
        return { label: 'Selesai', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'CANCELLED':
      case 'IN_CANCEL':
        return { label: 'Dibatalkan', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20' };
      case 'TO_RETURN':
        return { label: 'Pengembalian', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' };
      case 'UNPAID':
        return { label: 'Belum Bayar', bg: 'bg-neutral-800', text: 'text-neutral-400', border: 'border-white/10' };
      default:
        return { label: status || 'N/A', bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-white/10' };
    }
  };

  // Shipping status badge helper based on actual fulfillment progression
  const getShippingStatusBadge = (order: ShopeeOrder) => {
    const isCancelled = ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes(order.order_status);
    const st = (order.order_status || '').toUpperCase();
    if (isCancelled) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
          <XCircle className="w-2.5 h-2.5" />
          <span>Dibatalkan</span>
        </span>
      );
    }
    if (order.is_delivered || ['COMPLETED', 'DELIVERED'].includes(st)) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>Telah Sampai</span>
        </span>
      );
    }
    if (st === 'TO_CONFIRM_RECEIVE') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
          <Truck className="w-2.5 h-2.5" />
          <span>Dalam Pengiriman</span>
        </span>
      );
    }
    if (st === 'SHIPPED') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
          <Truck className="w-2.5 h-2.5" />
          <span>Sedang Dikirim</span>
        </span>
      );
    }
    if (st === 'PROCESSED' || order.is_arranged) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
          <Truck className="w-2.5 h-2.5" />
          <span>Telah Diatur</span>
        </span>
      );
    }
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
        <AlertTriangle className="w-2.5 h-2.5" />
        <span>Perlu Diatur</span>
      </span>
    );
  };

  // Orders matching current status tab
  const ordersInActiveTab = useMemo(() => {
    return orders.filter((order) => {
      if (activeTab === 'ALL' && ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes(order.order_status)) return false;
      if (activeTab === 'READY_TO_SHIP' && !['READY_TO_SHIP', 'PROCESSED'].includes(order.order_status)) return false;
      if (activeTab === 'TO_PROCESS' && order.order_status !== 'READY_TO_SHIP') return false;
      if (activeTab === 'PROCESSED' && order.order_status !== 'PROCESSED') return false;
      if (activeTab === 'SHIPPED' && order.order_status !== 'SHIPPED') return false;
      if (activeTab === 'COMPLETED' && !['COMPLETED', 'TO_CONFIRM_RECEIVE'].includes(order.order_status) && !order.is_delivered) return false;
      if (activeTab === 'CLAIMED' && !order.already_claimed) return false;
      if (activeTab === 'CANCELLED' && !['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes(order.order_status)) return false;
      return true;
    });
  }, [orders, activeTab]);

  // Contextual courier options matching orders strictly in the current tab
  const courierOptions = useMemo(() => buildGroupedCourierOptions(ordersInActiveTab), [ordersInActiveTab]);

  const readyToShipCount = useMemo(
    () => orders.filter((o) => ['READY_TO_SHIP', 'PROCESSED'].includes(o.order_status)).length,
    [orders]
  );
  const toProcessCount = useMemo(
    () => orders.filter((o) => o.order_status === 'READY_TO_SHIP').length,
    [orders]
  );
  const processedCount = useMemo(
    () => orders.filter((o) => o.order_status === 'PROCESSED').length,
    [orders]
  );
  const cancelledCount = useMemo(
    () => orders.filter((o) => ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes(o.order_status)).length,
    [orders]
  );

  // Print counts within the active tab: only orders in PROCESSED status are actively awaiting label printing
  const tabUnprintedCount = useMemo(
    () =>
      ordersInActiveTab.filter(
        (o) => o.order_status === 'PROCESSED' && !isOrderLabelPrinted(o)
      ).length,
    [ordersInActiveTab, isOrderLabelPrinted]
  );
  const tabPrintedCount = useMemo(
    () =>
      ordersInActiveTab.filter(
        (o) => isOrderLabelPrinted(o)
      ).length,
    [ordersInActiveTab, isOrderLabelPrinted]
  );

  // Dynamic Label Pengiriman options (only show options that have orders)
  const printStatusOptions = useMemo(() => {
    const opts: Array<{
      value: 'all' | 'unprinted' | 'printed';
      label: string;
      count?: number;
      badge?: string;
      badgeVariant?: 'emerald' | 'amber' | 'rose' | 'zinc' | 'sky' | 'orange';
    }> = [
      { value: 'all', label: 'Semua Label', count: ordersInActiveTab.length },
    ];

    if (tabUnprintedCount > 0) {
      opts.push({
        value: 'unprinted',
        label: 'Perlu Dicetak',
        count: tabUnprintedCount,
        badge: 'Menunggu',
        badgeVariant: 'amber',
      });
    }

    if (tabPrintedCount > 0) {
      opts.push({
        value: 'printed',
        label: 'Telah Dicetak',
        count: tabPrintedCount,
        badge: 'Selesai',
        badgeVariant: 'emerald',
      });
    }

    return opts;
  }, [ordersInActiveTab.length, tabUnprintedCount, tabPrintedCount]);

  // Tab change handler that resets courier and print filters
  const handleTabChange = (newTab: StatusTab) => {
    setActiveTab(newTab);
    setCourierFilter('all');
    setPrintFilter('all');
    setCurrentPage(1);
  };

  // Auto-reset courier or print filter if selected value has 0 matches in the active tab
  useEffect(() => {
    if (courierFilter !== 'all') {
      const exists = ordersInActiveTab.some((o) =>
        matchesCourierFilter(o.shipping_carrier, courierFilter)
      );
      if (!exists) {
        setCourierFilter('all');
      }
    }
    if (printFilter !== 'all') {
      if (printFilter === 'unprinted' && tabUnprintedCount === 0) {
        setPrintFilter('all');
      } else if (printFilter === 'printed' && tabPrintedCount === 0) {
        setPrintFilter('all');
      }
    }
  }, [ordersInActiveTab, courierFilter, printFilter, tabUnprintedCount, tabPrintedCount]);

  // Filtered orders computation
  const filteredOrders = useMemo(() => {
    return ordersInActiveTab.filter((order) => {
      // Grouped / Individual Courier filter
      if (!matchesCourierFilter(order.shipping_carrier, courierFilter)) return false;

      // Print status filter (Label Pengiriman)
      if (printFilter !== 'all') {
        const isPrinted = isOrderLabelPrinted(order);
        if (printFilter === 'printed' && !isPrinted) return false;
        if (printFilter === 'unprinted' && (isPrinted || order.order_status !== 'PROCESSED')) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const sn = (order.order_sn || '').toLowerCase();
        const buyer = (order.buyer_username || '').toLowerCase();
        const recipient = (order.recipient_name || '').toLowerCase();
        const tracking = (order.tracking_number || '').toLowerCase();
        const phoneMatch = matchesPhoneQuery(order.recipient_phone, q);
        const itemMatch = (order.items || []).some(
          (i) =>
            (i.item_name || '').toLowerCase().includes(q) ||
            (i.model_name || '').toLowerCase().includes(q)
        );

        return (
          sn.includes(q) ||
          buyer.includes(q) ||
          recipient.includes(q) ||
          tracking.includes(q) ||
          phoneMatch ||
          itemMatch
        );
      }

      return true;
    });
  }, [ordersInActiveTab, courierFilter, printFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Selection handlers
  const isAllSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedSns.has(o.order_sn));
  const isSomeSelected = filteredOrders.some((o) => selectedSns.has(o.order_sn));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSns(new Set());
    } else {
      setSelectedSns(new Set(filteredOrders.map((o) => o.order_sn)));
    }
  };

  const handleToggleSelect = (orderSn: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSns((prev) => {
      const next = new Set(prev);
      if (next.has(orderSn)) next.delete(orderSn);
      else next.add(orderSn);
      return next;
    });
  };

  const selectedOrdersList = useMemo(() => {
    return orders.filter((o) => selectedSns.has(o.order_sn));
  }, [orders, selectedSns]);

  // Bulk Print Shopee Labels with official multi-page PDF
  const handleBulkPrint = async () => {
    if (selectedOrdersList.length === 0) return;

    const unarrangedOrders = selectedOrdersList.filter(
      (o) => o.order_status === 'READY_TO_SHIP'
    );

    if (unarrangedOrders.length > 0) {
      showToast(
        'warning',
        'Pesanan Belum Diatur',
        `Ada ${unarrangedOrders.length} pesanan yang belum diatur pengirimannya (${unarrangedOrders.map((o) => o.order_sn).slice(0, 3).join(', ')}${unarrangedOrders.length > 3 ? '...' : ''}). Atur pengiriman terlebih dahulu.`
      );
      return;
    }

    showToast(
      'info',
      'Memuat Batch Label Shopee',
      `Mengunduh dokumen PDF resmi dari Shopee untuk ${selectedOrdersList.length} pesanan...`
    );

    try {
      const res = await downloadShopeeBatchShippingLabelsDirect(selectedOrdersList.map((o) => o.order_sn));
      if (res.success && res.url) {
        window.open(res.url, '_blank');
        const printedSns = new Set(selectedOrdersList.map((o) => o.order_sn));
        setOrders((prev) =>
          prev.map((o) =>
            printedSns.has(o.order_sn)
              ? { ...o, is_printed: true, shipping_document_status: 'PRINTED' }
              : o
          )
        );
        selectedOrdersList.forEach((o) => {
          toggleShopeeOrderPrintDirect(o.order_sn, true).catch(() => {});
        });
        showToast(
          'success',
          'Batch Label Terbuka',
          `${selectedOrdersList.length} label resmi Shopee berhasil dimuat.`
        );
        return;
      }
      showToast('error', 'Gagal Batch Cetak', res.error || 'Shopee tidak dapat memuat PDF batch label.');
    } catch (err: any) {
      showToast('error', 'Gagal Batch Cetak', err?.message || 'Koneksi ke API Shopee gagal.');
    }
  };

  // Bulk Arrange Shipment trigger
  const handleBulkArrange = () => {
    const readyOrders = selectedOrdersList.filter(
      (o) => o.order_status === 'READY_TO_SHIP'
    );
    if (readyOrders.length === 0) {
      showToast('warning', 'Tidak Ada Pesanan', 'Tidak ada pesanan terpilih yang berstatus Perlu Diatur Pengiriman.');
      return;
    }
    setSelectedArrangeOrder(readyOrders[0]);
    setIsArrangeModalOpen(true);
  };

  // Bulk Export to CSV
  const handleBulkExport = () => {
    if (selectedOrdersList.length === 0) return;
    const headers = [
      'No. Pesanan',
      'Waktu Pesanan',
      'Username Pembeli',
      'Status Pesanan',
      'Jasa Kirim',
      'No. Resi',
      'Batas Waktu Kirim',
      'Nama Penerima',
      'No. Telepon',
      'Kota',
      'Alamat',
      'Total Belanja (IDR)',
      'Rincian Produk',
    ];

    const rows = selectedOrdersList.map((o) => [
      o.order_sn,
      o.create_time,
      o.buyer_username,
      o.order_status,
      o.shipping_carrier,
      o.tracking_number || '',
      o.ship_by_date || '',
      o.recipient_name,
      o.recipient_phone,
      o.recipient_city,
      o.recipient_address,
      o.total_amount,
      (o.items || []).map((i) => `${i.item_name} (${i.model_name || 'Standard'}) x${i.quantity}`).join('; '),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`exacoat-shopee-pesanan-${dateStr}.csv`, headers, rows);
    showToast('success', 'Ekspor CSV Berhasil', `Berhasil mengekspor ${selectedOrdersList.length} pesanan ke CSV.`);
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Shopee Integration Sub-Header */}
      <div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-neutral-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight">
                {settings?.shop_name || 'Toko Shopee Indonesia'}
              </h2>
              <span
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                  settings?.environment === 'sandbox'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                )}
              >
                {settings?.environment === 'sandbox' ? 'Mode Sandbox' : 'Toko Aktif (Live)'}
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                Shop ID: {settings?.shop_id || 227918647}
              </span>
              <span className="text-[11px] text-orange-400/90 font-mono">
                • {orders.length} pesanan tersimpan
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Kanal integrasi Shopee Indonesia. Menampilkan pesanan, batas waktu kirim, status pickup/dropoff, no. resi resmi, dan Claim Warranty.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <MarketplaceSyncButton
            brand="shopee"
            isSyncing={isSyncing}
            onSync={handleSync}
            syncDays={syncDays}
            onSyncDaysChange={setSyncDays}
          />

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span>Pengaturan API</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-white/10 overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'Semua' },
              { id: 'READY_TO_SHIP', label: 'Perlu Dikirim', count: readyToShipCount },
              { id: 'TO_PROCESS', label: 'Perlu Diproses', count: toProcessCount },
              { id: 'PROCESSED', label: 'Telah Diproses', count: processedCount },
              { id: 'SHIPPED', label: 'Dikirim' },
              { id: 'COMPLETED', label: 'Selesai' },
              { id: 'CLAIMED', label: 'Claim Warranty' },
              { id: 'CANCELLED', label: 'Dibatalkan', count: cancelledCount },
            ] as Array<{ id: StatusTab; label: string; count?: number }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer',
                activeTab === tab.id
                  ? 'bg-white text-neutral-950 font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={clsx(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
                    activeTab === tab.id ? 'bg-black/20 text-neutral-950' : 'bg-orange-500/20 text-orange-400'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari No. Pesanan, Pembeli, Resi, No. HP..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Row 2: Secondary Filter Bar (Grouped Courier & Printed Resi) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-neutral-900/50 border border-white/10 text-xs relative z-20">
        <div className="flex flex-wrap items-center gap-3">
          {/* Courier Filter with Instant, Same Day, and Reguler/YES Groups */}
          <FilterSelect
            label="Jasa Kirim"
            value={courierFilter}
            onChange={setCourierFilter}
            icon={<Truck className="w-3.5 h-3.5" />}
            options={courierOptions}
          />

          {/* Label Pengiriman Status Filter */}
          <FilterSelect
            label="Label Pengiriman"
            value={printFilter}
            onChange={(val) => setPrintFilter(val as any)}
            icon={<Printer className="w-3.5 h-3.5" />}
            options={printStatusOptions}
          />

          {/* Clear Filters */}
          {(courierFilter !== 'all' || printFilter !== 'all' || activeTab !== 'ALL' || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setCourierFilter('all');
                setPrintFilter('all');
                setActiveTab('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Reset filter
            </button>
          )}
        </div>

        {/* Select-All Toggle on right */}
        {filteredOrders.length > 0 && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(input) => {
                if (input) {
                  input.indeterminate = !isAllSelected && isSomeSelected;
                }
              }}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded border-white/20 bg-neutral-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-neutral-300 font-medium">
              Pilih semua ({filteredOrders.length})
            </span>
          </label>
        )}
      </div>

      {/* Row 3: Multiselect Bulk Action Bar (Rendered directly under filters/pills when items are selected) */}
      {selectedSns.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="font-bold text-white">
              {selectedSns.size} pesanan dipilih
            </span>
            <span className="text-neutral-600">|</span>
            <button
              type="button"
              onClick={() => setSelectedSns(new Set())}
              className="text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Batalkan Pilihan
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkPrint}
              className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Label Massal</span>
            </button>

            <button
              type="button"
              onClick={handleBulkArrange}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Atur Pengiriman Massal</span>
            </button>

            <button
              type="button"
              onClick={handleBulkExport}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
          <RefreshCw className="w-6 h-6 text-orange-400 animate-spin mx-auto" />
          <p className="text-xs text-neutral-400">Memuat pesanan Shopee...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
          <Package className="w-8 h-8 text-neutral-600 mx-auto" />
          <p className="text-sm font-semibold text-neutral-300">Tidak ada pesanan Shopee yang sesuai</p>
          <p className="text-xs text-neutral-500">
            {searchQuery ? 'Coba ubah kata kunci pencarian atau cari langsung ke API Shopee.' : 'Sinkronisasikan pesanan dari Shopee atau sesuaikan filter tab.'}
          </p>
          {searchQuery.trim().length >= 6 && (
            <button
              type="button"
              onClick={handleLiveSearch}
              disabled={isLiveSearching}
              className="mt-2 px-4 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/40 text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Search className={clsx('w-3.5 h-3.5', isLiveSearching && 'animate-spin')} />
              <span>{isLiveSearching ? 'Mencari di API Shopee...' : `Cari langsung di API Shopee untuk "${searchQuery.trim()}"`}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pagedOrders.map((order) => {
            const isCancelled = ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes(order.order_status);
            const statusBadge = getStatusBadge(order.order_status, order);
            const isClaimed = order.already_claimed;
            const isPrinted = isOrderLabelPrinted(order);
            const isArranged = ['PROCESSED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes(order.order_status) || Boolean(order.is_arranged);
            const isReadyToShip = order.order_status === 'READY_TO_SHIP';
            const canPrint = Boolean(order.order_status === 'PROCESSED' || ['SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes(order.order_status) || order.is_arranged);
            const isSelected = selectedSns.has(order.order_sn);

            return (
              <div
                key={order.order_sn}
                onClick={() => setSelectedDetailOrder(order)}
                className={clsx(
                  'p-4 sm:p-5 rounded-2xl bg-neutral-900/70 border transition-all cursor-pointer hover:border-white/25 active:scale-[0.999]',
                  isSelected
                    ? 'border-orange-500/50 bg-orange-500/[0.03]'
                    : isClaimed
                    ? 'border-amber-500/20 bg-amber-500/[0.02]'
                    : 'border-white/10'
                )}
              >
                {/* Top Header Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-3 mb-3">
                  {/* Left: Checkbox, Channel tag, Order SN, Buyer, Countdown */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleToggleSelect(order.order_sn, e as any)}
                      className="w-4 h-4 rounded border-white/20 bg-neutral-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 cursor-pointer shrink-0"
                    />

                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      Shopee
                    </span>

                    <span className="text-xs font-mono font-bold text-white">
                      #{order.order_sn}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(order.order_sn, `sn_${order.order_sn}`);
                      }}
                      className="text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                      title="Salin No. Pesanan"
                    >
                      {copiedId === `sn_${order.order_sn}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className="text-neutral-600">•</span>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{order.create_time}</span>
                    </div>

                    <span className="text-neutral-600">•</span>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium">
                      <User className="w-3.5 h-3.5 text-neutral-500" />
                      <span>@{order.buyer_username}</span>
                    </div>

                    {!isCancelled && (
                      <ShipCountdownBadge
                        shipByTimestamp={order.ship_by_timestamp}
                        orderStatus={order.order_status}
                      />
                    )}

                    {isClaimed && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Claimed: #{order.existing_claim?.existing_order_num}</span>
                      </span>
                    )}
                  </div>

                  {/* Right: Status badge, Label Pengiriman, Arrange Ship, Menu */}
                  <div className="flex items-center gap-2 self-start lg:self-auto" onClick={(e) => e.stopPropagation()}>
                    {/* Status badge: Perlu Diproses, Telah Diproses, Dikirim, Selesai, etc. */}
                    <span
                      className={clsx(
                        'text-[10px] px-2.5 py-1 rounded-full font-semibold border',
                        statusBadge.bg,
                        statusBadge.text,
                        statusBadge.border
                      )}
                    >
                      {statusBadge.label}
                    </span>

                    {/* Arrange Shipment Button if ready and unscheduled */}
                    {!isCancelled && isReadyToShip && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedArrangeOrder(order);
                          setIsArrangeModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-orange-500/20 active:scale-95"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Atur Pengiriman</span>
                      </button>
                    )}

                    {/* Quick Print Button or Printed Badge */}
                    {!isCancelled && (
                      isPrinted ? (
                        <span
                          className="text-[10px] px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                          title="Label pengiriman resmi telah dicetak (Cetak ulang tersedia di menu ⋮)"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Telah Dicetak</span>
                        </span>
                      ) : order.order_status === 'PROCESSED' ? (
                        <button
                          type="button"
                          onClick={() => handlePrintShopeeLabel(order)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                          title="Klik untuk mengunduh & mencetak label resmi Shopee"
                        >
                          <Printer className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="text-[10px]">Cetak Label</span>
                        </button>
                      ) : null
                    )}

                    {/* Dropdown Menu for Warranty / Redeem / Print (Hidden for cancelled orders) */}
                    {!isCancelled && (
                      <div className="relative" data-action-menu>
                        <button
                        type="button"
                        onClick={() =>
                          setActiveActionMenuSn(activeActionMenuSn === order.order_sn ? null : order.order_sn)
                        }
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-white/10 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeActionMenuSn === order.order_sn && (
                        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl bg-neutral-900 border border-white/10 shadow-xl py-1 z-30 font-sans">
                          {canPrint && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuSn(null);
                                handlePrintShopeeLabel(order);
                              }}
                              className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer font-medium text-neutral-300 hover:bg-white/5"
                            >
                              <Printer className="w-3.5 h-3.5 text-neutral-400" />
                              <span>{isPrinted ? 'Cetak Ulang Label' : 'Cetak Label Shopee'}</span>
                            </button>
                          )}

                          {isReadyToShip && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuSn(null);
                                setSelectedArrangeOrder(order);
                                setIsArrangeModalOpen(true);
                              }}
                              className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer font-medium text-orange-400 hover:bg-white/5"
                            >
                              <Truck className="w-3.5 h-3.5 text-orange-400" />
                              <span>Atur Pengiriman</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuSn(null);
                              handleTogglePrintStatus(order, !isPrinted);
                            }}
                            className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer font-medium text-neutral-300 hover:bg-white/5"
                          >
                            <Printer className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{isPrinted ? 'Tandai Perlu Dicetak' : 'Tandai Telah Dicetak'}</span>
                          </button>

                          <div className="my-1 border-t border-white/10" />

                          <button
                            type="button"
                            disabled={isClaimed}
                            onClick={() => {
                              setActiveActionMenuSn(null);
                              onClaimWarranty(order);
                            }}
                            className={clsx(
                              'w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer font-medium',
                              isClaimed
                                ? 'opacity-40 cursor-not-allowed text-neutral-500'
                                : 'text-emerald-400 hover:bg-emerald-500/10'
                            )}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Claim Warranty</span>
                          </button>

                          <button
                            type="button"
                            disabled={isClaimed}
                            onClick={() => {
                              setActiveActionMenuSn(null);
                              onClaimRedeem(order);
                            }}
                            className={clsx(
                              'w-full px-3 py-2 text-left text-xs flex items-center gap-2 cursor-pointer font-medium',
                              isClaimed
                                ? 'opacity-40 cursor-not-allowed text-neutral-500'
                                : 'text-amber-400 hover:bg-amber-500/10'
                            )}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Claim Redeem (Defect)</span>
                          </button>

                          <div className="my-1 border-t border-white/10" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuSn(null);
                              handleCopy(order.order_sn, `sn_${order.order_sn}`);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-neutral-300 hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-neutral-500" />
                            <span>Salin No. Pesanan</span>
                          </button>

                          {order.tracking_number && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuSn(null);
                                handleCopy(order.tracking_number, `resi_${order.order_sn}`);
                              }}
                              className="w-full px-3 py-2 text-left text-xs text-neutral-300 hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Salin No. Resi</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                    <div className="pl-1 text-neutral-500 hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Items and Delivery Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1 & 2: Items List */}
                  <div className="md:col-span-2 space-y-2">
                    {(order.items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-neutral-950/40 border border-white/5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.item_name}
                              className="w-10 h-10 rounded-lg object-cover bg-neutral-800 shrink-0 border border-white/5"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 border border-white/5">
                              <Tag className="w-4 h-4 text-neutral-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white leading-tight truncate">
                              {item.item_name}
                            </p>
                            {item.model_name && (
                              <p className="text-[11px] font-mono text-neutral-400 mt-0.5 truncate">
                                Varian: <span className="text-neutral-200">{item.model_name}</span>
                              </p>
                            )}
                            {Boolean(item.note || item.item_note || item.order_item_note || item.buyer_note) && (
                              <div className="mt-1 flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-sans">
                                <span className="font-bold text-amber-400 shrink-0">Catatan:</span>
                                <span className="break-words">{item.note || item.item_note || item.order_item_note || item.buyer_note}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-white">
                            x{item.quantity}
                          </span>
                          <p className="text-[11px] font-mono text-neutral-400">
                            {formatCurrency(item.price, 'IDR')}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-neutral-500 font-mono text-[11px]">
                        {order.items?.length || 0} produk
                      </span>
                      <div className="font-mono text-xs font-bold text-white">
                        Total: <span className="text-orange-400">{formatCurrency(order.total_amount, 'IDR')}</span>
                      </div>
                    </div>

                    {order.buyer_note && (
                      <div className="text-xs p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-300/90 italic">
                        Catatan: {order.buyer_note}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Logistics and Destination */}
                  <div className="p-3.5 rounded-xl bg-neutral-950/40 border border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-neutral-500">Jasa Kirim</span>
                      <span className="font-semibold text-neutral-200">{order.shipping_carrier || 'Jasa Kirim Standar'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-neutral-500">Status Pengiriman</span>
                      {getShippingStatusBadge(order)}
                    </div>

                    {!isCancelled && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-neutral-500">No. Resi</span>
                        {order.tracking_number ? (
                          <span className="font-mono font-bold text-orange-400">{order.tracking_number}</span>
                        ) : (
                          <span className="text-neutral-500 font-mono text-[11px]">N/A</span>
                        )}
                      </div>
                    )}

                    {!isCancelled && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-neutral-500">Label Pengiriman</span>
                        {isPrinted || ['SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes(order.order_status) || order.is_delivered ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Tercetak</span>
                          </span>
                        ) : order.order_status === 'PROCESSED' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                            <Printer className="w-2.5 h-2.5" />
                            <span>Siap Cetak</span>
                          </span>
                        ) : (
                          <span className="text-neutral-500 font-mono text-[10px]">Atur pengiriman dahulu</span>
                        )}
                      </div>
                    )}

                    {!isCancelled && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-neutral-500">Batas Kirim</span>
                        <span className="font-mono text-[11px] text-neutral-300">
                          {order.ship_by_date || 'N/A'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-200">{order.recipient_name || order.buyer_username}</p>
                        {order.recipient_phone && (
                          <p className="text-[10px] font-mono text-neutral-400">{formatDisplayPhone(order.recipient_phone)}</p>
                        )}
                        <p className="text-[11px] text-neutral-400 leading-tight truncate max-w-[200px]" title={order.recipient_address}>
                          {order.recipient_address}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          {order.recipient_city} {order.recipient_postcode ? `(${order.recipient_postcode})` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {filteredOrders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-xl bg-neutral-900/60 border border-white/10 text-xs text-neutral-400">
          <div>
            Menampilkan <span className="font-mono font-bold text-white">{(currentPage - 1) * pageSize + 1}</span> hingga{' '}
            <span className="font-mono font-bold text-white">
              {Math.min(currentPage * pageSize, filteredOrders.length)}
            </span>{' '}
            dari <span className="font-mono font-bold text-white">{filteredOrders.length}</span> pesanan
          </div>

          <div className="flex items-center gap-3">
            {/* Per Page Selector */}
            <FilterSelect
              label="Per halaman"
              value={String(pageSize)}
              onChange={(val) => handlePageSizeChange(Number(val))}
              dropUp={true}
              options={[
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
                { value: '200', label: '200' },
              ]}
            />

            {/* Page Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1 rounded-lg border border-white/10 bg-neutral-900 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Sebelumnya
              </button>
              <span className="px-2 py-1 font-mono text-[11px] text-neutral-300">
                Hal {currentPage} dari {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-white/10 bg-neutral-900 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shopee Order Detail Modal */}
      <ShopeeOrderDetailModal
        order={selectedDetailOrder}
        isOpen={Boolean(selectedDetailOrder)}
        onClose={() => setSelectedDetailOrder(null)}
        onPrintLabel={handlePrintShopeeLabel}
        onArrangeShipment={(ord) => {
          setSelectedArrangeOrder(ord);
          setIsArrangeModalOpen(true);
        }}
        onClaimWarranty={onClaimWarranty}
        onClaimRedeem={onClaimRedeem}
        isPrinted={selectedDetailOrder ? isOrderLabelPrinted(selectedDetailOrder) : false}
      />

      {/* Shopee Settings Modal */}
      <ShopeeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => loadData(true)}
      />

      {/* Shopee Arrange Shipment Modal */}
      <ArrangeShipmentModal
        isOpen={isArrangeModalOpen}
        onClose={() => {
          setIsArrangeModalOpen(false);
          setSelectedArrangeOrder(null);
        }}
        order={selectedArrangeOrder}
        onShipmentArranged={handleShipmentArranged}
      />

      {/* Shopee Product Duplicator Modal */}
      <ShopeeProductDuplicatorModal
        isOpen={isDuplicatorOpen}
        onClose={() => setIsDuplicatorOpen(false)}
      />
    </div>
  );
};
