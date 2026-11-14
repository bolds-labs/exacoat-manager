import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TikTokOrder,
  TikTokSettings,
  fetchTikTokOrdersDirect,
  syncTikTokOrdersDirect,
  fetchTikTokSettingsDirect,
  refreshTikTokShopsDirect,
  downloadTikTokShippingLabelDirect,
  arrangeTikTokShipmentDirect,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { TikTokSettingsModal } from '../settings/TikTokSettingsModal';
import { TikTokOrderDetailModal } from './TikTokOrderDetailModal';
import { FilterSelect } from '../ui/FilterSelect';
import { ShipCountdownBadge } from './ShipCountdownBadge';
import { MarketplaceSyncButton } from './MarketplaceSyncButton';
import { buildGroupedCourierOptions, matchesCourierFilter } from '../../lib/courierGrouping';
import { generateTikTokAwbHtml, generateTikTokBatchAwbHtml } from '../../lib/tiktokAwbGenerator';
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
  Download,
  CheckSquare,
  Square,
  X,
  Layers,
  XCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../ds/Button';
import { IconButton } from '../ds/IconButton';
import { Checkbox } from '../ds/Checkbox';
import { Tabs } from '../ds/Tabs';
import { StatusChip } from '../ds/StatusChip';
import { getTikTokStatusMeta, marketplaceChip } from '../../lib/marketplaceStatus';
import {
  channelTagClass,
  copyBtnClass,
  fieldInputClass,
  menuItemClass,
  menuPanelClass,
  noteClass,
  wellClass,
} from './marketplaceClasses';

interface TikTokOrdersViewProps {
  onClaimWarranty: (order: TikTokOrder) => void;
  onClaimRedeem: (order: TikTokOrder) => void;
}

type StatusTab = 'ALL' | 'READY_TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';

export const TikTokOrdersView: React.FC<TikTokOrdersViewProps> = ({
  onClaimWarranty,
  onClaimRedeem,
}) => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<TikTokOrder[]>([]);
  const [settings, setSettings] = useState<TikTokSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [isArrangingId, setIsArrangingId] = useState<string | null>(null);
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [trackingFilter, setTrackingFilter] = useState<'all' | 'has-resi' | 'no-resi'>('all');
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
  }, [activeTab, courierFilter, trackingFilter, searchQuery]);

  // Selection & Detail Modal states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<TikTokOrder | null>(null);
  const [isBulkArranging, setIsBulkArranging] = useState(false);
  const [syncDays, setSyncDays] = useState<number>(30);
  const [isLiveSearching, setIsLiveSearching] = useState(false);

  // Close action dropdown on outside click or Escape key
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setActiveActionMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveActionMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);

      const [ordersRes, settingsRes] = await Promise.all([
        fetchTikTokOrdersDirect(),
        fetchTikTokSettingsDirect(),
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
        // Auto-sync from TikTok API on page open if shop is connected
        if (settingsRes.settings.is_connected && !quiet) {
          syncTikTokOrdersDirect().then((syncRes) => {
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

  const handleSync = async (days = syncDays) => {
    setIsSyncing(true);
    try {
      let res = await syncTikTokOrdersDirect(days, 500);

      if (
        !res.success &&
        res.error &&
        (res.error.toLowerCase().includes('shop_cipher') || res.error.toLowerCase().includes('cipher'))
      ) {
        showToast('info', 'Mendeteksi Kredensial Toko', 'Mengambil cipher toko terotorisasi dari TikTok...');
        const detectRes = await refreshTikTokShopsDirect();
        if (detectRes.success && detectRes.shop_cipher) {
          showToast(
            'success',
            'Cipher Toko Terhubung',
            `Cipher terhubung: ${detectRes.shop_cipher}. Mengulang sinkronisasi pesanan...`
          );
          res = await syncTikTokOrdersDirect(days, 500);
        }
      }

      if (res.success && Array.isArray(res.orders)) {
        if (res.orders.length > 0) {
          setOrders(res.orders);
          showToast(
            'success',
            'TikTok Tersinkronisasi',
            `Berhasil menyinkronkan ${res.total_synced || res.orders.length} pesanan (${res.total_cached || res.orders.length} total pesanan di cache).`
          );
        } else {
          showToast(
            'info',
            'Sinkronisasi TikTok',
            'Tidak ada pesanan baru ditemukan pada rentang waktu ini. Menyimpan data cache yang ada.'
          );
        }
        loadData(true);
      } else {
        showToast('error', 'Sinkronisasi TikTok Gagal', res.error || 'Gagal menyinkronkan pesanan dari TikTok Shop.');
      }
    } catch (err: any) {
      showToast('error', 'Kesalahan Sinkronisasi', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLiveSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsLiveSearching(true);
    try {
      const res = await fetchTikTokOrdersDirect({ search: q });
      if (res.success && res.orders && res.orders.length > 0) {
        setOrders((prev) => {
          const map = new Map(prev.map((o) => [o.order_id, o]));
          res.orders!.forEach((o) => map.set(o.order_id, o));
          return Array.from(map.values());
        });
        setActiveTab('ALL');
        showToast('success', 'Pesanan Ditemukan', `Ditemukan pesanan #${q} langsung dari API TikTok Shop.`);
      } else {
        showToast('info', 'Pesanan Tidak Ditemukan', `Tidak ditemukan pesanan langsung dari TikTok Shop untuk "${q}".`);
      }
    } catch (err: any) {
      showToast('error', 'Kesalahan Pencarian', err.message);
    } finally {
      setIsLiveSearching(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('info', 'Tersalin ke Clipboard', text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintLabel = async (order: TikTokOrder) => {
    const packageId = order.package_id || order.order_id;

    showToast(
      'info',
      'Label Thermal TikTok',
      `Memuat dokumen Air Waybill untuk Pesanan #${order.order_id}...`
    );

    try {
      const res = await downloadTikTokShippingLabelDirect(packageId);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
        return;
      }
      if (res.success && res.doc_url) {
        window.open(res.doc_url, '_blank');
        return;
      }
    } catch {
      // Continue to local thermal generation
    }

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (printWindow) {
      printWindow.document.write(generateTikTokAwbHtml(order));
      printWindow.document.close();
    }
  };

  const handleArrangeShipment = async (order: TikTokOrder) => {
    const packageId = order.package_id || order.order_id;
    setIsArrangingId(order.order_id);

    try {
      const res = await arrangeTikTokShipmentDirect(packageId, {
        pick_up_type: 1, // Dropoff default
        order_id: order.order_id,
      });

      if (res.success) {
        showToast('success', 'Pengiriman Diatur', `Pesanan #${order.order_id} siap diserahkan ke kurir.`);
        setOrders((prev) =>
          prev.map((o) =>
            o.order_id === order.order_id
              ? { ...o, order_status: 'AWAITING_COLLECTION' }
              : o
          )
        );
      } else {
        showToast('error', 'Gagal Mengatur Pengiriman', res.error || 'Periksa konfigurasi kurir TikTok Shop.');
      }
    } catch (err: any) {
      showToast('error', 'Kesalahan', err.message);
    } finally {
      setIsArrangingId(null);
    }
  };

  // Orders matching current status tab
  const ordersInActiveTab = useMemo(() => {
    return orders.filter((order) => {
      const st = (order.order_status || '').toUpperCase();
      if (activeTab === 'ALL') {
        if (st === 'CANCELLED') return false;
      } else if (activeTab === 'READY_TO_SHIP') {
        if (!['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes(st)) return false;
      } else if (activeTab === 'SHIPPED') {
        if (!['IN_TRANSIT', 'SHIPPED'].includes(st)) return false;
      } else if (activeTab === 'COMPLETED') {
        if (!['DELIVERED', 'COMPLETED'].includes(st)) return false;
      } else if (activeTab === 'CLAIMED') {
        if (!order.already_claimed) return false;
      } else if (activeTab === 'CANCELLED') {
        if (st !== 'CANCELLED') return false;
      }
      return true;
    });
  }, [orders, activeTab]);

  const courierOptions = useMemo(() => buildGroupedCourierOptions(ordersInActiveTab), [ordersInActiveTab]);

  const tabWithResiCount = useMemo(
    () => ordersInActiveTab.filter((o) => Boolean(o.tracking_number && o.tracking_number.trim().length > 0)).length,
    [ordersInActiveTab]
  );
  const tabNoResiCount = useMemo(
    () => ordersInActiveTab.filter((o) => !o.tracking_number || o.tracking_number.trim().length === 0).length,
    [ordersInActiveTab]
  );

  const trackingOptions = useMemo(() => {
    const opts: Array<{
      value: 'all' | 'has-resi' | 'no-resi';
      label: string;
      count?: number;
      badge?: string;
      badgeVariant?: 'emerald' | 'amber' | 'rose' | 'zinc' | 'sky' | 'orange';
    }> = [
      { value: 'all', label: 'Semua Status Resi', count: ordersInActiveTab.length },
    ];
    if (tabWithResiCount > 0) {
      opts.push({
        value: 'has-resi',
        label: 'Ada No. Resi',
        count: tabWithResiCount,
        badge: 'Resi Siap',
        badgeVariant: 'emerald',
      });
    }
    if (tabNoResiCount > 0) {
      opts.push({
        value: 'no-resi',
        label: 'Belum Ada Resi',
        count: tabNoResiCount,
        badge: 'Menunggu',
        badgeVariant: 'amber',
      });
    }
    return opts;
  }, [ordersInActiveTab.length, tabWithResiCount, tabNoResiCount]);

  const handleTabChange = (newTab: StatusTab) => {
    setActiveTab(newTab);
    setCourierFilter('all');
    setTrackingFilter('all');
    setCurrentPage(1);
  };

  useEffect(() => {
    if (courierFilter !== 'all') {
      const exists = ordersInActiveTab.some((o) =>
        matchesCourierFilter(o.shipping_carrier, courierFilter)
      );
      if (!exists) {
        setCourierFilter('all');
      }
    }
    if (trackingFilter !== 'all') {
      if (trackingFilter === 'has-resi' && tabWithResiCount === 0) {
        setTrackingFilter('all');
      } else if (trackingFilter === 'no-resi' && tabNoResiCount === 0) {
        setTrackingFilter('all');
      }
    }
  }, [ordersInActiveTab, courierFilter, trackingFilter, tabWithResiCount, tabNoResiCount]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const baseOrders = q ? orders : ordersInActiveTab;

    return baseOrders.filter((order) => {
      // Grouped / Individual Courier filter
      if (courierFilter !== 'all' && !matchesCourierFilter(order.shipping_carrier, courierFilter)) {
        if (!q || !(order.order_id || '').toLowerCase().includes(q)) {
          return false;
        }
      }

      // Tracking Resi filter
      if (trackingFilter !== 'all') {
        const hasResi = Boolean(order.tracking_number && order.tracking_number.trim().length > 0);
        if (trackingFilter === 'has-resi' && !hasResi) return false;
        if (trackingFilter === 'no-resi' && hasResi) return false;
      }

      // Search filter
      if (q) {
        const matchesId = (order.order_id || '').toLowerCase().includes(q);
        const matchesBuyer = (order.buyer_username || '').toLowerCase().includes(q);
        const matchesName = (order.recipient_name || '').toLowerCase().includes(q);
        const matchesPhone = (order.recipient_phone || '').toLowerCase().includes(q);
        const matchesResi = (order.tracking_number || '').toLowerCase().includes(q);
        const matchesItem = (order.items || []).some((item) =>
          `${item.item_name} ${item.sku_name}`.toLowerCase().includes(q)
        );
        return matchesId || matchesBuyer || matchesName || matchesPhone || matchesResi || matchesItem;
      }

      return true;
    });
  }, [orders, ordersInActiveTab, courierFilter, trackingFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const readyToShipCount = orders.filter((o) =>
    ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes((o.order_status || '').toUpperCase())
  ).length;

  const cancelledCount = orders.filter((o) =>
    (o.order_status || '').toUpperCase() === 'CANCELLED'
  ).length;

  // Selection handlers
  const isAllSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.order_id));
  const isSomeSelected = filteredOrders.some((o) => selectedIds.has(o.order_id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.order_id)));
    }
  };

  const handleToggleSelect = (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const selectedOrdersList = useMemo(() => {
    return orders.filter((o) => selectedIds.has(o.order_id));
  }, [orders, selectedIds]);

  // Bulk Print AWBs
  const handleBulkPrint = () => {
    if (selectedOrdersList.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (printWindow) {
      printWindow.document.write(generateTikTokBatchAwbHtml(selectedOrdersList));
      printWindow.document.close();
      showToast(
        'info',
        'Cetak Label Massal',
        `Membuka jendela cetak untuk ${selectedOrdersList.length} pesanan TikTok Shop.`
      );
    }
  };

  // Bulk Arrange Shipment
  const handleBulkArrangeShipment = async () => {
    const readyOrders = selectedOrdersList.filter(
      (o) =>
        ['AWAITING_SHIPMENT', 'READY_TO_SHIP'].includes((o.order_status || '').toUpperCase()) &&
        !o.tracking_number
    );

    if (readyOrders.length === 0) {
      showToast('warning', 'Tidak Ada Tindakan', 'Pesanan yang dipilih sudah diatur pengiriman atau memiliki nomor resi.');
      return;
    }

    setIsBulkArranging(true);
    showToast('info', 'Mengatur Pengiriman', `Memproses pengiriman untuk ${readyOrders.length} pesanan...`);

    let successCount = 0;
    for (const ord of readyOrders) {
      try {
        const pkgId = ord.package_id || ord.order_id;
        const res = await arrangeTikTokShipmentDirect(pkgId, { pick_up_type: 1, order_id: ord.order_id });
        if (res.success) {
          successCount++;
          setOrders((prev) =>
            prev.map((o) => (o.order_id === ord.order_id ? { ...o, order_status: 'AWAITING_COLLECTION' } : o))
          );
        }
      } catch {
        // Continue processing batch
      }
    }

    setIsBulkArranging(false);
    showToast('success', 'Pengiriman Massal Berhasil', `Berhasil mengatur ${successCount} dari ${readyOrders.length} paket.`);
  };

  // Bulk Export to CSV
  const handleBulkExport = () => {
    if (selectedOrdersList.length === 0) return;
    const headers = [
      'No. Pesanan',
      'Waktu Dibuat',
      'Batas Kirim',
      'Username Pembeli',
      'Status Pesanan',
      'Jasa Kirim',
      'No. Resi',
      'Nama Penerima',
      'No. HP Penerima',
      'Kota Penerima',
      'Alamat Penerima',
      'Total Biaya (IDR)',
      'Ringkasan Produk',
    ];

    const rows = selectedOrdersList.map((o) => [
      o.order_id,
      o.create_time,
      o.ship_by_date || 'N/A',
      o.buyer_username,
      o.order_status,
      o.shipping_carrier || 'N/A',
      o.tracking_number || 'N/A',
      o.recipient_name,
      o.recipient_phone,
      o.recipient_city,
      o.recipient_address,
      o.total_amount,
      (o.items || []).map((i) => `${i.item_name} (${i.sku_name || 'Standar'}) x${i.quantity}`).join('; '),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`exacoat-tiktok-orders-${dateStr}.csv`, headers, rows);
    showToast('success', 'Ekspor CSV Berhasil', `Berhasil mengekspor ${selectedOrdersList.length} pesanan ke CSV.`);
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Top Banner and Actions */}
      <div className="flex flex-col justify-between gap-4 rounded-[14px] border border-card-border bg-card p-4 sm:p-5 md:flex-row md:items-center">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-line bg-chip font-mono text-[14px] font-semibold text-muted">
            TT
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
                {settings?.shop_name || 'Operasional TikTok Shop'}
              </h2>
              <StatusChip
                size="sm"
                meta={
                  settings?.is_connected
                    ? marketplaceChip('Terhubung', 'done', CheckCircle2)
                    : marketplaceChip('Belum Terhubung', 'act', AlertTriangle)
                }
              />
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
              <span>ID Layanan: {settings?.service_id || 'N/A'}</span>
              <span className="text-faint">•</span>
              <span>
                Sinkronisasi Terakhir: {settings?.last_synced_at || 'Baru saja'}
              </span>
              <span className="text-faint">•</span>
              <span className="font-mono font-medium text-fg">
                {orders.length} pesanan tersimpan
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 self-start md:self-auto">
          <Button icon={Settings} onClick={() => setIsSettingsOpen(true)}>
            Pengaturan
          </Button>

          <MarketplaceSyncButton
            brand="tiktok"
            isSyncing={isSyncing}
            onSync={handleSync}
            syncDays={syncDays}
            onSyncDaysChange={setSyncDays}
          />
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="overflow-x-auto">
          <Tabs
            value={activeTab}
            onChange={(key) => handleTabChange(key as StatusTab)}
            items={(
              [
                { id: 'ALL', label: 'Semua' },
                { id: 'READY_TO_SHIP', label: 'Perlu Dikirim', count: readyToShipCount },
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
            placeholder="Cari No. Pesanan, Pembeli, Resi..."
            aria-label="Cari No. Pesanan, Pembeli, Resi"
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
              title="Cari langsung ke API TikTok Shop"
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

      {/* Row 2: Secondary Filter Bar (Courier & Tracking Resi) */}
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

          {/* Tracking Resi Filter */}
          <FilterSelect
            label="Status Resi"
            value={trackingFilter}
            onChange={(val) => setTrackingFilter(val as any)}
            icon={<Printer className="w-3.5 h-3.5" />}
            options={trackingOptions}
          />

          {/* Clear Filters */}
          {(courierFilter !== 'all' || trackingFilter !== 'all' || activeTab !== 'ALL' || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setCourierFilter('all');
                setTrackingFilter('all');
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
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-accent-border bg-accent-soft px-4 py-2.5 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-semibold text-fg">
              {selectedIds.size} pesanan dipilih
            </span>
            <span className="text-faint">|</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="cursor-pointer text-muted underline hover:text-fg"
            >
              Batalkan Pilihan
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" icon={Printer} onClick={handleBulkPrint}>
              Cetak Label Massal
            </Button>

            <Button
              size="sm"
              icon={Truck}
              onClick={handleBulkArrangeShipment}
              disabled={isBulkArranging}
              className={isBulkArranging ? '[&>svg]:animate-spin' : ''}
            >
              {isBulkArranging ? 'Memproses...' : 'Atur Pengiriman Massal'}
            </Button>

            <Button size="sm" icon={Download} onClick={handleBulkExport}>
              Ekspor CSV
            </Button>
          </div>
        </div>
      )}

      {/* Orders List / Table */}
      {isLoading ? (
        <div className="space-y-3 rounded-[14px] border border-card-border bg-card p-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-faint" />
          <p className="text-[13px] text-muted">Memuat pesanan TikTok Shop...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="space-y-3 rounded-[14px] border border-card-border bg-card p-12 text-center">
          <Package className="mx-auto h-8 w-8 text-faint" />
          <p className="text-[14px] font-semibold text-fg">Tidak ada pesanan ditemukan</p>
          <p className="text-[13px] text-muted">
            {searchQuery ? 'Coba ubah kata kunci pencarian atau cari langsung dari API TikTok Shop.' : 'Sinkronkan pesanan dari TikTok Shop atau sesuaikan filter.'}
          </p>
          {searchQuery.trim().length >= 6 && (
            <Button
              icon={Search}
              onClick={handleLiveSearch}
              disabled={isLiveSearching}
              className={clsx('mt-2', isLiveSearching && '[&>svg]:animate-spin')}
            >
              {isLiveSearching ? 'Mencari di API TikTok Shop...' : `Cari di API TikTok untuk "${searchQuery.trim()}"`}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pagedOrders.map((order) => {
            const isCancelled = (order.order_status || '').toUpperCase() === 'CANCELLED';
            const statusMeta = getTikTokStatusMeta(order);
            const isReadyToShip = ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes(
              (order.order_status || '').toUpperCase()
            );
            const isSelected = selectedIds.has(order.order_id);

            return (
              <div
                key={order.order_id}
                onClick={() => setSelectedDetailOrder(order)}
                className={clsx(
                  'cursor-pointer rounded-[14px] border bg-card p-4 transition-colors sm:p-5',
                  isSelected
                    ? 'border-accent-border'
                    : order.already_claimed
                    ? 'border-st-act-border'
                    : 'border-card-border hover:border-field-border'
                )}
              >
                {/* Top Header Bar */}
                <div className="mb-3 flex flex-col justify-between gap-4 border-b border-line pb-3 lg:flex-row lg:items-center">
                  {/* Left: Checkbox, Channel tag, Order ID, Countdown, Buyer */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleToggleSelect(order.order_id, e as any)}
                      aria-label={`Pilih pesanan ${order.order_id}`}
                      className="shrink-0"
                    />

                    <span className={channelTagClass}>TikTok</span>

                    <span className="font-mono text-[13px] font-semibold text-fg">
                      #{order.order_id}
                    </span>

                    {!isCancelled && (
                      <ShipCountdownBadge
                        shipByDate={order.ship_by_date}
                        shipByTimestamp={order.ship_by_timestamp}
                      />
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(order.order_id, `id_${order.order_id}`);
                      }}
                      className={copyBtnClass}
                      title="Salin No. Pesanan"
                      aria-label="Salin No. Pesanan"
                    >
                      {copiedId === `id_${order.order_id}` ? (
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

                    {order.already_claimed && (
                      <StatusChip size="sm" meta={marketplaceChip('Claimed', 'act', ShieldCheck)} />
                    )}
                  </div>

                  {/* Right: Status badge, AWB, Arrange Ship, Menu, Chevron */}
                  <div className="flex items-center gap-2 self-start lg:self-auto" onClick={(e) => e.stopPropagation()}>
                    <StatusChip meta={statusMeta} size="sm" />

                    {/* Quick Print Thermal Label */}
                    {!isCancelled && (
                      <Button
                        size="sm"
                        icon={Printer}
                        onClick={() => handlePrintLabel(order)}
                        title="Cetak Label Pengiriman"
                      >
                        Cetak Label
                      </Button>
                    )}

                    {/* Arrange Shipment Button if ready */}
                    {!isCancelled && isReadyToShip && !order.tracking_number && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={isArrangingId === order.order_id ? RefreshCw : Truck}
                        onClick={() => handleArrangeShipment(order)}
                        disabled={isArrangingId === order.order_id}
                        className={isArrangingId === order.order_id ? '[&>svg]:animate-spin' : ''}
                      >
                        Atur Pengiriman
                      </Button>
                    )}

                    {/* Dropdown Menu for Warranty / Redeem */}
                    {!isCancelled && (
                      <div className="relative" data-action-menu>
                        <IconButton
                          size="sm"
                          icon={MoreVertical}
                          label="Aksi lainnya"
                          aria-haspopup="menu"
                          aria-expanded={activeActionMenuId === order.order_id}
                          onClick={() =>
                            setActiveActionMenuId(activeActionMenuId === order.order_id ? null : order.order_id)
                          }
                        />

                        {activeActionMenuId === order.order_id && (
                          <div className={menuPanelClass}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
                                onClaimWarranty(order);
                              }}
                              className={menuItemClass}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-muted" />
                              <span>Claim Warranty</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveActionMenuId(null);
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
                                setActiveActionMenuId(null);
                                handleCopy(order.order_id, `id_${order.order_id}`);
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
                                  setActiveActionMenuId(null);
                                  handleCopy(order.tracking_number, `resi_${order.order_id}`);
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
                            {item.sku_name && (
                              <p className="mt-0.5 truncate font-mono text-[12px] text-faint">
                                Varian: <span className="text-muted">{item.sku_name}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="font-mono text-[13px] font-semibold text-fg">
                            x{item.quantity}
                          </span>
                          <p className="font-mono text-[12px] text-faint">
                            {formatCurrency(item.price, order.currency || 'IDR')}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1 text-[13px]">
                      <span className="font-mono text-[12px] text-faint">
                        {order.items?.length || 0} jenis produk
                      </span>
                      <div className="font-mono text-[13px] text-muted">
                        Total: <span className="font-semibold text-fg">{formatCurrency(order.total_amount, order.currency || 'IDR')}</span>
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
                      <span className="text-right font-medium text-fg">{order.shipping_carrier || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] text-faint">Status Pengiriman</span>
                      <StatusChip
                        size="sm"
                        meta={
                          isCancelled
                            ? marketplaceChip('Dibatalkan', 'stop', XCircle)
                            : marketplaceChip(statusMeta.label, 'neutral', statusMeta.icon)
                        }
                      />
                    </div>

                    {!isCancelled && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] text-faint">No. Resi</span>
                        <span className={clsx('font-mono', order.tracking_number ? 'font-semibold text-fg' : 'text-[12px] text-faint')}>
                          {order.tracking_number || 'N/A'}
                        </span>
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
                        <p className="font-medium text-fg">{order.recipient_name || 'N/A'}</p>
                        <p className="max-w-[200px] truncate text-[12px] leading-tight text-muted" title={order.recipient_address}>
                          {order.recipient_address || 'N/A'}
                        </p>
                        <p className="mt-0.5 font-mono text-[11.5px] text-faint">
                          {order.recipient_city || ''} {order.recipient_postcode || ''}
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
            Menampilkan <span className="font-mono font-semibold text-fg">{(currentPage - 1) * pageSize + 1}</span> sampai{' '}
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
                Halaman {currentPage} dari {totalPages}
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

      {/* Order Detail Modal */}
      <TikTokOrderDetailModal
        order={selectedDetailOrder}
        isOpen={Boolean(selectedDetailOrder)}
        onClose={() => setSelectedDetailOrder(null)}
        onPrintAwb={handlePrintLabel}
        onArrangeShipment={handleArrangeShipment}
        onClaimWarranty={onClaimWarranty}
        onClaimRedeem={onClaimRedeem}
      />

      {/* Settings Modal */}
      <TikTokSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => loadData(true)}
      />
    </div>
  );
};
