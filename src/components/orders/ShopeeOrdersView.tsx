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
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { formatOrderNumber } from '../../lib/orderUtils';
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
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { Checkbox } from '../ds/Checkbox';
import { Tabs } from '../ds/Tabs';
import { StatusChip } from '../ds/StatusChip';
import type { StatusMeta } from '../../lib/orderStatus';
import { getShopeeStatusMeta, marketplaceChip } from '../../lib/marketplaceStatus';
import {
  channelTagClass,
  copyBtnClass,
  fieldInputClass,
  menuItemClass,
  menuPanelClass,
  noteClass,
  wellClass,
} from './marketplaceClasses';

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
        setActiveTab('ALL');
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

  // Shipping status chip based on actual fulfillment progression
  const getShippingStatusMeta = (order: ShopeeOrder): StatusMeta => {
    const isCancelled = ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes(order.order_status);
    const st = (order.order_status || '').toUpperCase();
    if (isCancelled) return marketplaceChip('Dibatalkan', 'stop', XCircle);
    if (order.is_delivered || ['COMPLETED', 'DELIVERED'].includes(st)) return marketplaceChip('Telah Sampai', 'done', CheckCircle2);
    if (st === 'TO_CONFIRM_RECEIVE') return marketplaceChip('Dalam Pengiriman', 'prog', Truck);
    if (st === 'SHIPPED') return marketplaceChip('Sedang Dikirim', 'prog', Truck);
    if (st === 'PROCESSED' || order.is_arranged) return marketplaceChip('Telah Diatur', 'prog', Truck);
    return marketplaceChip('Perlu Diatur', 'act', AlertTriangle);
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
    const q = searchQuery.toLowerCase().trim();
    const baseOrders = q ? orders : ordersInActiveTab;

    return baseOrders.filter((order) => {
      // Grouped / Individual Courier filter
      if (courierFilter !== 'all' && !matchesCourierFilter(order.shipping_carrier, courierFilter)) {
        if (!q || !(order.order_sn || '').toLowerCase().includes(q)) {
          return false;
        }
      }

      // Print status filter (Label Pengiriman)
      if (printFilter !== 'all') {
        const isPrinted = isOrderLabelPrinted(order);
        if (printFilter === 'printed' && !isPrinted) return false;
        if (printFilter === 'unprinted' && (isPrinted || order.order_status !== 'PROCESSED')) return false;
      }

      // Search filter
      if (q) {
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
  }, [orders, ordersInActiveTab, courierFilter, printFilter, searchQuery]);

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
      <div className="flex flex-col justify-between gap-4 rounded-[14px] border border-card-border bg-card p-4 sm:p-5 md:flex-row md:items-center">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-chip text-muted">
            <Store className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
                {settings?.shop_name || 'Toko Shopee Indonesia'}
              </h2>
              <StatusChip
                size="sm"
                meta={
                  settings?.environment === 'sandbox'
                    ? marketplaceChip('Mode Sandbox', 'act', AlertTriangle)
                    : marketplaceChip('Toko Aktif (Live)', 'done', CheckCircle2)
                }
              />
              <span className="font-mono text-[12px] text-faint">
                Shop ID: {settings?.shop_id || 227918647}
              </span>
              <span className="font-mono text-[12px] text-muted">
                • {orders.length} pesanan tersimpan
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-muted">
              Kanal integrasi Shopee Indonesia. Menampilkan pesanan, batas waktu kirim, status pickup/dropoff, no. resi resmi, dan Claim Warranty.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 self-start md:self-auto">
          <MarketplaceSyncButton
            brand="shopee"
            isSyncing={isSyncing}
            onSync={handleSync}
            syncDays={syncDays}
            onSyncDaysChange={setSyncDays}
          />

          <Button icon={Settings} onClick={() => setIsSettingsOpen(true)}>
            Pengaturan API
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-center">
        <div className="overflow-x-auto">
          <Tabs
            value={activeTab}
            onChange={(key) => handleTabChange(key as StatusTab)}
            items={(
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
            ).map((tab) => ({
              key: tab.id,
              label: tab.label,
              count: typeof tab.count === 'number' && tab.count > 0 ? tab.count : undefined,
              hot: tab.id !== 'CANCELLED',
            }))}
          />
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-faint" />
          <input
            type="text"
            data-ds=""
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleLiveSearch();
              }
            }}
            placeholder="Cari No. Pesanan, Pembeli, Resi, No. HP..."
            aria-label="Cari No. Pesanan, Pembeli, Resi, No. HP"
            className={`${fieldInputClass} pl-9 pr-20`}
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={copyBtnClass}
                title="Hapus pencarian"
                aria-label="Hapus pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={isLiveSearching || !searchQuery.trim()}
              onClick={handleLiveSearch}
              className={clsx(
                'flex h-[26px] cursor-pointer items-center gap-1 rounded-[7px] px-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed',
                searchQuery.trim() ? 'bg-accent text-accent-on hover:brightness-95' : 'bg-chip text-faint'
              )}
              title="Cari langsung ke API Shopee"
            >
              {isLiveSearching ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span>Cari</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Filter Bar (Grouped Courier & Printed Resi) */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-card-border bg-card px-4 py-2.5 text-[13px]">
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
              className="cursor-pointer text-[13px] text-muted underline hover:text-fg"
            >
              Reset filter
            </button>
          )}
        </div>

        {/* Select-All Toggle on right */}
        {filteredOrders.length > 0 && (
          <Checkbox
            checked={isAllSelected}
            ref={(input) => {
              if (input) {
                input.indeterminate = !isAllSelected && isSomeSelected;
              }
            }}
            onChange={handleToggleSelectAll}
            label={`Pilih semua (${filteredOrders.length})`}
            className="select-none font-medium"
          />
        )}
      </div>

      {/* Row 3: Multiselect Bulk Action Bar (Rendered directly under filters/pills when items are selected) */}
      {selectedSns.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-accent-border bg-accent-soft px-4 py-2.5 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-semibold text-fg">
              {selectedSns.size} pesanan dipilih
            </span>
            <span className="text-faint">|</span>
            <button
              type="button"
              onClick={() => setSelectedSns(new Set())}
              className="cursor-pointer text-muted underline hover:text-fg"
            >
              Batalkan Pilihan
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" icon={Printer} onClick={handleBulkPrint}>
              Cetak Label Massal
            </Button>

            <Button size="sm" icon={Truck} onClick={handleBulkArrange}>
              Atur Pengiriman Massal
            </Button>

            <Button size="sm" icon={Download} onClick={handleBulkExport}>
              Ekspor CSV
            </Button>
          </div>
        </div>
      )}

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-3 rounded-[14px] border border-card-border bg-card p-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-faint" />
          <p className="text-[13px] text-muted">Memuat pesanan Shopee...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="space-y-3 rounded-[14px] border border-card-border bg-card p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-faint" />
          <p className="text-[14px] font-semibold text-fg">Tidak ada pesanan Shopee yang sesuai</p>
          <p className="text-[13px] text-muted">
            {searchQuery ? 'Coba ubah kata kunci pencarian atau cari langsung ke API Shopee.' : 'Sinkronisasikan pesanan dari Shopee atau sesuaikan filter tab.'}
          </p>
          {searchQuery.trim().length >= 6 && (
            <Button
              icon={Search}
              onClick={handleLiveSearch}
              disabled={isLiveSearching}
              className={clsx('mt-2', isLiveSearching && '[&>svg]:animate-spin')}
            >
              {isLiveSearching ? 'Mencari di API Shopee...' : `Cari langsung di API Shopee untuk "${searchQuery.trim()}"`}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pagedOrders.map((order) => {
            const isCancelled = ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes(order.order_status);
            const statusMeta = getShopeeStatusMeta(order);
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
                  'cursor-pointer rounded-[14px] border bg-card p-4 transition-colors sm:p-5',
                  isSelected
                    ? 'border-accent-border'
                    : isClaimed
                    ? 'border-st-act-border'
                    : 'border-card-border hover:border-field-border'
                )}
              >
                {/* Top Header Bar */}
                <div className="mb-3 flex flex-col justify-between gap-4 border-b border-line pb-3 lg:flex-row lg:items-center">
                  {/* Left: Checkbox, Channel tag, Order SN, Buyer, Countdown */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleToggleSelect(order.order_sn, e as any)}
                      aria-label={`Pilih pesanan ${order.order_sn}`}
                      className="shrink-0"
                    />

                    <span className={channelTagClass}>Shopee</span>

                    <span className="font-mono text-[13px] font-semibold text-fg">
                      #{order.order_sn}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(order.order_sn, `sn_${order.order_sn}`);
                      }}
                      className={copyBtnClass}
                      title="Salin No. Pesanan"
                      aria-label="Salin No. Pesanan"
                    >
                      {copiedId === `sn_${order.order_sn}` ? (
                        <Check className="h-3.5 w-3.5 text-st-done-fg" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <span className="text-faint">•</span>
                    <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
                      <Clock className="h-3.5 w-3.5 text-faint" />
                      <span>{formatDateTime(order.create_time)}</span>
                    </div>

                    <span className="text-faint">•</span>
                    <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
                      <User className="h-3.5 w-3.5 text-faint" />
                      <span>@{order.buyer_username}</span>
                    </div>

                    {!isCancelled && (
                      <ShipCountdownBadge
                        shipByTimestamp={order.ship_by_timestamp}
                        orderStatus={order.order_status}
                      />
                    )}

                    {isClaimed && (
                      <StatusChip
                        size="sm"
                        meta={marketplaceChip(`Claimed: ${formatOrderNumber(order.existing_claim?.existing_order_num)}`, 'act', ShieldCheck)}
                      />
                    )}
                  </div>

                  {/* Right: Status badge, Label Pengiriman, Arrange Ship, Menu */}
                  <div className="flex items-center gap-2 self-start lg:self-auto" onClick={(e) => e.stopPropagation()}>
                    {/* Status badge: Perlu Diproses, Telah Diproses, Dikirim, Selesai, etc. */}
                    <StatusChip meta={statusMeta} size="sm" />

                    {/* Arrange Shipment Button if ready and unscheduled */}
                    {!isCancelled && isReadyToShip && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Truck}
                        onClick={() => {
                          setSelectedArrangeOrder(order);
                          setIsArrangeModalOpen(true);
                        }}
                      >
                        Atur Pengiriman
                      </Button>
                    )}

                    {/* Quick Print Button or Printed Badge */}
                    {!isCancelled && (
                      isPrinted ? (
                        <span title="Label pengiriman resmi telah dicetak (Cetak ulang tersedia di menu ⋮)">
                          <StatusChip size="sm" meta={marketplaceChip('Telah Dicetak', 'done', CheckCircle2)} />
                        </span>
                      ) : order.order_status === 'PROCESSED' ? (
                        <Button
                          size="sm"
                          icon={Printer}
                          onClick={() => handlePrintShopeeLabel(order)}
                          title="Klik untuk mengunduh & mencetak label resmi Shopee"
                        >
                          Cetak Label
                        </Button>
                      ) : null
                    )}

                    {/* Dropdown Menu for Warranty / Redeem / Print (Hidden for cancelled orders) */}
                    {!isCancelled && (
                      <div className="relative" data-action-menu>
                        <IconButton
                          size="sm"
                          icon={MoreVertical}
                          label="Aksi lainnya"
                          aria-haspopup="menu"
                          aria-expanded={activeActionMenuSn === order.order_sn}
                          onClick={() =>
                            setActiveActionMenuSn(activeActionMenuSn === order.order_sn ? null : order.order_sn)
                          }
                        />

                      {activeActionMenuSn === order.order_sn && (
                        <div className={menuPanelClass}>
                          {canPrint && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuSn(null);
                                handlePrintShopeeLabel(order);
                              }}
                              className={menuItemClass}
                            >
                              <Printer className="h-3.5 w-3.5 text-muted" />
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
                              className={clsx(menuItemClass, 'text-accent-fg')}
                            >
                              <Truck className="h-3.5 w-3.5 text-accent-fg" />
                              <span>Atur Pengiriman</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuSn(null);
                              handleTogglePrintStatus(order, !isPrinted);
                            }}
                            className={menuItemClass}
                          >
                            <Printer className="h-3.5 w-3.5 text-muted" />
                            <span>{isPrinted ? 'Tandai Perlu Dicetak' : 'Tandai Telah Dicetak'}</span>
                          </button>

                          <div className="mx-1 my-[5px] h-px bg-line" />

                          <button
                            type="button"
                            disabled={isClaimed}
                            onClick={() => {
                              setActiveActionMenuSn(null);
                              onClaimWarranty(order);
                            }}
                            className={menuItemClass}
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-muted" />
                            <span>Claim Warranty</span>
                          </button>

                          <button
                            type="button"
                            disabled={isClaimed}
                            onClick={() => {
                              setActiveActionMenuSn(null);
                              onClaimRedeem(order);
                            }}
                            className={menuItemClass}
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-muted" />
                            <span>Claim Redeem (Defect)</span>
                          </button>

                          <div className="mx-1 my-[5px] h-px bg-line" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuSn(null);
                              handleCopy(order.order_sn, `sn_${order.order_sn}`);
                            }}
                            className={menuItemClass}
                          >
                            <Copy className="h-3.5 w-3.5 text-muted" />
                            <span>Salin No. Pesanan</span>
                          </button>

                          {order.tracking_number && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuSn(null);
                                handleCopy(order.tracking_number, `resi_${order.order_sn}`);
                              }}
                              className={menuItemClass}
                            >
                              <Copy className="h-3.5 w-3.5 text-muted" />
                              <span>Salin No. Resi</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                    <div className="pl-1 text-faint transition-colors hover:text-fg">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Items and Delivery Grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* Column 1 & 2: Items List */}
                  <div className="space-y-2 md:col-span-2">
                    {(order.items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-3 p-2.5 ${wellClass}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.item_name}
                              className="h-10 w-10 shrink-0 rounded-[9px] border border-line bg-chip object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] border border-line bg-chip">
                              <Tag className="h-4 w-4 text-faint" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium leading-tight text-fg">
                              {item.item_name}
                            </p>
                            {item.model_name && (
                              <p className="mt-0.5 truncate font-mono text-[12px] text-faint">
                                Varian: <span className="text-muted">{item.model_name}</span>
                              </p>
                            )}
                            {Boolean(item.note || item.item_note || item.order_item_note || item.buyer_note) && (
                              <div className={`mt-1 ${noteClass}`}>
                                <span className="shrink-0 font-semibold">Catatan:</span>
                                <span className="break-words">{item.note || item.item_note || item.order_item_note || item.buyer_note}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="font-mono text-[13px] font-semibold text-fg">
                            x{item.quantity}
                          </span>
                          <p className="font-mono text-[12px] text-faint">
                            {formatCurrency(item.price, 'IDR')}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1 text-[13px]">
                      <span className="font-mono text-[12px] text-faint">
                        {order.items?.length || 0} produk
                      </span>
                      <div className="font-mono text-[13px] text-muted">
                        Total: <span className="font-semibold text-fg">{formatCurrency(order.total_amount, 'IDR')}</span>
                      </div>
                    </div>

                    {order.buyer_note && (
                      <div className={`${noteClass} italic`}>
                        Catatan: {order.buyer_note}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Logistics and Destination */}
                  <div className={`space-y-2 p-3.5 text-[12.5px] ${wellClass}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-faint">Jasa Kirim</span>
                      <span className="text-right font-medium text-fg">{order.shipping_carrier || 'Jasa Kirim Standar'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-faint">Status Pengiriman</span>
                      <StatusChip size="sm" meta={getShippingStatusMeta(order)} />
                    </div>

                    {!isCancelled && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-faint">No. Resi</span>
                        {order.tracking_number ? (
                          <span className="font-mono font-semibold text-fg">{order.tracking_number}</span>
                        ) : (
                          <span className="font-mono text-[12px] text-faint">N/A</span>
                        )}
                      </div>
                    )}

                    {!isCancelled && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-faint">Label Pengiriman</span>
                        {isPrinted || ['SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes(order.order_status) || order.is_delivered ? (
                          <StatusChip size="sm" meta={marketplaceChip('Tercetak', 'done', CheckCircle2)} />
                        ) : order.order_status === 'PROCESSED' ? (
                          <StatusChip size="sm" meta={marketplaceChip('Siap Cetak', 'act', Printer)} />
                        ) : (
                          <span className="text-[12px] text-faint">Atur pengiriman dahulu</span>
                        )}
                      </div>
                    )}

                    {!isCancelled && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-faint">Batas Kirim</span>
                        <span className="font-mono text-[12px] text-muted">
                          {order.ship_by_date || 'N/A'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start gap-2 border-t border-line pt-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                      <div className="min-w-0">
                        <p className="font-medium text-fg">{order.recipient_name || order.buyer_username}</p>
                        {order.recipient_phone && (
                          <p className="font-mono text-[12px] text-faint">{formatDisplayPhone(order.recipient_phone)}</p>
                        )}
                        <p className="max-w-[200px] truncate text-[12px] leading-tight text-muted" title={order.recipient_address}>
                          {order.recipient_address}
                        </p>
                        <p className="mt-0.5 font-mono text-[11.5px] text-faint">
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
        <div className="flex flex-col items-center justify-between gap-3 rounded-[14px] border border-card-border bg-card px-4 py-3 text-[13px] text-muted sm:flex-row">
          <div>
            Menampilkan <span className="font-mono font-semibold text-fg">{(currentPage - 1) * pageSize + 1}</span> hingga{' '}
            <span className="font-mono font-semibold text-fg">
              {Math.min(currentPage * pageSize, filteredOrders.length)}
            </span>{' '}
            dari <span className="font-mono font-semibold text-fg">{filteredOrders.length}</span> pesanan
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
              <Button
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                Sebelumnya
              </Button>
              <span className="px-2 font-mono text-[12px] text-muted">
                Hal {currentPage} dari {totalPages}
              </span>
              <Button
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Berikutnya
              </Button>
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
