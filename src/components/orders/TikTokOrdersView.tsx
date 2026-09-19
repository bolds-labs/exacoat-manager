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
import { formatCurrency } from '../../lib/formatters';
import { TikTokSettingsModal } from '../settings/TikTokSettingsModal';
import { TikTokOrderDetailModal } from './TikTokOrderDetailModal';
import { FilterSelect } from '../ui/FilterSelect';
import { ShipCountdownBadge } from './ShipCountdownBadge';
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
} from 'lucide-react';
import { clsx } from 'clsx';

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
      let res = await syncTikTokOrdersDirect(days, 200);

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
          res = await syncTikTokOrdersDirect(days, 200);
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

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'AWAITING_SHIPMENT':
      case 'READY_TO_SHIP':
        return { label: 'Perlu Diproses', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' };
      case 'AWAITING_COLLECTION':
        return { label: 'Menunggu Penjemputan', bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' };
      case 'IN_TRANSIT':
      case 'SHIPPED':
        return { label: 'Dalam Pengiriman', bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/20' };
      case 'DELIVERED':
        return { label: 'Telah Sampai', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'COMPLETED':
        return { label: 'Selesai', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'CANCELLED':
        return { label: 'Dibatalkan', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20' };
      default:
        return { label: status || 'N/A', bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-white/10' };
    }
  };

  const availableCouriers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const carrier = (o.shipping_carrier || '').trim();
      if (carrier) set.add(carrier);
    });
    return Array.from(set).sort().map((c) => ({ key: c.toUpperCase(), name: c }));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === 'READY_TO_SHIP') {
        const st = (order.order_status || '').toUpperCase();
        if (!['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes(st)) return false;
      } else if (activeTab === 'SHIPPED') {
        const st = (order.order_status || '').toUpperCase();
        if (!['IN_TRANSIT', 'SHIPPED'].includes(st)) return false;
      } else if (activeTab === 'COMPLETED') {
        const st = (order.order_status || '').toUpperCase();
        if (!['DELIVERED', 'COMPLETED'].includes(st)) return false;
      } else if (activeTab === 'CLAIMED') {
        if (!order.already_claimed) return false;
      } else if (activeTab === 'CANCELLED') {
        const st = (order.order_status || '').toUpperCase();
        if (st !== 'CANCELLED') return false;
      }

      // Courier filter
      if (courierFilter !== 'all') {
        const carrier = (order.shipping_carrier || '').toUpperCase();
        if (!carrier.includes(courierFilter)) return false;
      }

      // Tracking Resi filter
      if (trackingFilter !== 'all') {
        const hasResi = Boolean(order.tracking_number && order.tracking_number.trim().length > 0);
        if (trackingFilter === 'has-resi' && !hasResi) return false;
        if (trackingFilter === 'no-resi' && hasResi) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = (order.order_id || '').toLowerCase().includes(q);
        const matchesBuyer = (order.buyer_username || '').toLowerCase().includes(q);
        const matchesName = (order.recipient_name || '').toLowerCase().includes(q);
        const matchesResi = (order.tracking_number || '').toLowerCase().includes(q);
        const matchesItem = (order.items || []).some((item) =>
          `${item.item_name} ${item.sku_name}`.toLowerCase().includes(q)
        );
        return matchesId || matchesBuyer || matchesName || matchesResi || matchesItem;
      }

      return true;
    });
  }, [orders, activeTab, courierFilter, trackingFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const readyToShipCount = orders.filter((o) =>
    ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes((o.order_status || '').toUpperCase())
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
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 font-bold font-mono text-base shadow-sm shrink-0">
            TT
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight">
                {settings?.shop_name || 'Operasional TikTok Shop'}
              </h2>
              <span
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase',
                  settings?.is_connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                )}
              >
                {settings?.is_connected ? 'Terhubung' : 'Belum Terhubung'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>ID Layanan: {settings?.service_id || 'N/A'}</span>
              <span>•</span>
              <span>
                Sinkronisasi Terakhir: {settings?.last_synced_at || 'Baru saja'}
              </span>
              <span>•</span>
              <span className="text-rose-400 font-mono">
                {orders.length} pesanan tersimpan
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span>Pengaturan</span>
          </button>

          <div className="flex items-center rounded-xl bg-rose-500 overflow-hidden shadow-md shadow-rose-500/20">
            <button
              type="button"
              onClick={() => handleSync(syncDays)}
              disabled={isSyncing}
              className="px-3.5 py-2 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Pesanan'}</span>
            </button>
            <select
              value={syncDays}
              onChange={(e) => setSyncDays(Number(e.target.value))}
              disabled={isSyncing}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold py-2 px-2 border-l border-rose-400/30 outline-none cursor-pointer"
              title="Pilih rentang hari pesanan"
            >
              <option value={15}>15 hari</option>
              <option value={30}>30 hari</option>
              <option value={60}>60 hari</option>
              <option value={90}>90 hari</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-white/10 overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'Semua' },
              { id: 'READY_TO_SHIP', label: 'Perlu Dikirim', count: readyToShipCount },
              { id: 'SHIPPED', label: 'Dikirim' },
              { id: 'COMPLETED', label: 'Selesai' },
              { id: 'CLAIMED', label: 'Klaim Garansi' },
              { id: 'CANCELLED', label: 'Dibatalkan' },
            ] as Array<{ id: StatusTab; label: string; count?: number }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
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
                    activeTab === tab.id ? 'bg-black/20 text-neutral-950' : 'bg-rose-500/20 text-rose-400'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari No. Pesanan, Pembeli, Resi..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Row 2: Secondary Filter Bar (Courier & Tracking Resi) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-neutral-900/50 border border-white/10 text-xs relative z-20">
        <div className="flex flex-wrap items-center gap-3">
          {/* Courier Filter */}
          <FilterSelect
            label="Jasa Kirim"
            value={courierFilter}
            onChange={setCourierFilter}
            icon={<Truck className="w-3.5 h-3.5" />}
            options={[
              { value: 'all', label: 'Semua Jasa Kirim' },
              ...availableCouriers.map((c) => ({ value: c.key, label: c.name })),
            ]}
          />

          {/* Tracking Resi Filter */}
          <FilterSelect
            label="Status Resi"
            value={trackingFilter}
            onChange={(val) => setTrackingFilter(val as any)}
            icon={<Printer className="w-3.5 h-3.5" />}
            options={[
              { value: 'all', label: 'Semua Status Resi' },
              { value: 'has-resi', label: 'Ada No. Resi' },
              { value: 'no-resi', label: 'Belum Ada Resi' },
            ]}
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
              className="w-4 h-4 rounded border-white/20 bg-neutral-800 text-rose-500 focus:ring-rose-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-neutral-300 font-medium">
              Pilih semua ({filteredOrders.length})
            </span>
          </label>
        )}
      </div>

      {/* Row 3: Multiselect Bulk Action Bar (Rendered directly under filters/pills when items are selected) */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-bold text-white">
              {selectedIds.size} pesanan dipilih
            </span>
            <span className="text-neutral-600">|</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Batalkan Pilihan
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkPrint}
              className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Label Massal</span>
            </button>

            <button
              type="button"
              onClick={handleBulkArrangeShipment}
              disabled={isBulkArranging}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Truck className={clsx('w-3.5 h-3.5', isBulkArranging && 'animate-spin')} />
              <span>{isBulkArranging ? 'Memproses...' : 'Atur Pengiriman Massal'}</span>
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

      {/* Orders List / Table */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
          <RefreshCw className="w-6 h-6 text-rose-400 animate-spin mx-auto" />
          <p className="text-xs text-neutral-400">Memuat pesanan TikTok Shop...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
          <Package className="w-8 h-8 text-neutral-600 mx-auto" />
          <p className="text-sm font-semibold text-neutral-300">Tidak ada pesanan ditemukan</p>
          <p className="text-xs text-neutral-500">
            {searchQuery ? 'Coba ubah kata kunci pencarian atau cari langsung dari API TikTok Shop.' : 'Sinkronkan pesanan dari TikTok Shop atau sesuaikan filter.'}
          </p>
          {searchQuery.trim().length >= 6 && (
            <button
              type="button"
              onClick={handleLiveSearch}
              disabled={isLiveSearching}
              className="mt-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Search className={clsx('w-3.5 h-3.5', isLiveSearching && 'animate-spin')} />
              <span>{isLiveSearching ? 'Mencari di API TikTok Shop...' : `Cari di API TikTok untuk "${searchQuery.trim()}"`}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pagedOrders.map((order) => {
            const badge = getStatusBadge(order.order_status);
            const isReadyToShip = ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes(
              (order.order_status || '').toUpperCase()
            );
            const isSelected = selectedIds.has(order.order_id);

            return (
              <div
                key={order.order_id}
                onClick={() => setSelectedDetailOrder(order)}
                className={clsx(
                  'p-4 sm:p-5 rounded-2xl bg-neutral-900/70 border transition-all cursor-pointer hover:border-white/25 active:scale-[0.999]',
                  isSelected
                    ? 'border-rose-500/50 bg-rose-500/[0.03]'
                    : order.already_claimed
                    ? 'border-amber-500/20 bg-amber-500/[0.02]'
                    : 'border-white/10'
                )}
              >
                {/* Top Header Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-3 mb-3">
                  {/* Left: Checkbox, Channel tag, Order ID, Countdown, Buyer */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleToggleSelect(order.order_id, e as any)}
                      className="w-4 h-4 rounded border-white/20 bg-neutral-800 text-rose-500 focus:ring-rose-500 focus:ring-offset-0 cursor-pointer shrink-0"
                    />

                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      TikTok
                    </span>

                    <span className="text-xs font-mono font-bold text-white">
                      #{order.order_id}
                    </span>

                    <ShipCountdownBadge
                      shipByDate={order.ship_by_date}
                      shipByTimestamp={order.ship_by_timestamp}
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(order.order_id, `id_${order.order_id}`);
                      }}
                      className="text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                      title="Salin No. Pesanan"
                    >
                      {copiedId === `id_${order.order_id}` ? (
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

                    {order.already_claimed && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Garansi Tercatat</span>
                      </span>
                    )}
                  </div>

                  {/* Right: Status badge, AWB, Arrange Ship, Menu, Chevron */}
                  <div className="flex items-center gap-2 self-start lg:self-auto" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={clsx(
                        'text-[10px] px-2.5 py-1 rounded-full font-semibold border',
                        badge.bg,
                        badge.text,
                        badge.border
                      )}
                    >
                      {badge.label}
                    </span>

                    {/* Quick Print Thermal Label */}
                    <button
                      type="button"
                      onClick={() => handlePrintLabel(order)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Cetak Label Pengiriman"
                    >
                      <Printer className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Cetak Label</span>
                    </button>

                    {/* Arrange Shipment Button if ready */}
                    {isReadyToShip && !order.tracking_number && (
                      <button
                        type="button"
                        onClick={() => handleArrangeShipment(order)}
                        disabled={isArrangingId === order.order_id}
                        className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-rose-500/20"
                      >
                        {isArrangingId === order.order_id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Truck className="w-3.5 h-3.5" />
                        )}
                        <span>Atur Pengiriman</span>
                      </button>
                    )}

                    {/* Dropdown Menu for Warranty / Redeem */}
                    <div className="relative" data-action-menu>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveActionMenuId(activeActionMenuId === order.order_id ? null : order.order_id)
                        }
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-white/10 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeActionMenuId === order.order_id && (
                        <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-neutral-900 border border-white/10 shadow-xl py-1 z-30 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              onClaimWarranty(order);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Klaim Garansi</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              onClaimRedeem(order);
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 cursor-pointer font-medium"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Redeem Hadiah (Cacat)</span>
                          </button>

                          <div className="my-1 border-t border-white/10" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              handleCopy(order.order_id, `id_${order.order_id}`);
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
                                setActiveActionMenuId(null);
                                handleCopy(order.tracking_number, `resi_${order.order_id}`);
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
                            {item.sku_name && (
                              <p className="text-[11px] font-mono text-neutral-400 mt-0.5 truncate">
                                Varian: <span className="text-neutral-200">{item.sku_name}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono font-bold text-white">
                            x{item.quantity}
                          </span>
                          <p className="text-[11px] font-mono text-neutral-400">
                            {formatCurrency(item.price, order.currency || 'IDR')}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-neutral-500 font-mono text-[11px]">
                        {order.items?.length || 0} jenis produk
                      </span>
                      <div className="font-mono text-xs font-bold text-white">
                        Total: <span className="text-rose-400">{formatCurrency(order.total_amount, order.currency || 'IDR')}</span>
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
                      <span className="font-semibold text-neutral-200">{order.shipping_carrier || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-neutral-500">No. Resi</span>
                      <span className="font-mono font-bold text-rose-400">
                        {order.tracking_number || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-neutral-500">Batas Kirim</span>
                      <span className="font-mono text-neutral-300">
                        {order.ship_by_date || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-start gap-2 pt-2 border-t border-white/5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-200">{order.recipient_name || 'N/A'}</p>
                        <p className="text-[11px] text-neutral-400 leading-tight truncate max-w-[200px]" title={order.recipient_address}>
                          {order.recipient_address || 'N/A'}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-xl bg-neutral-900/60 border border-white/10 text-xs text-neutral-400">
          <div>
            Menampilkan <span className="font-mono font-bold text-white">{(currentPage - 1) * pageSize + 1}</span> sampai{' '}
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
                Halaman {currentPage} dari {totalPages}
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
