import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShopeeOrder,
  ShopeeSettings,
  fetchShopeeOrdersDirect,
  syncShopeeOrdersDirect,
  fetchShopeeSettingsDirect,
  downloadShopeeShippingLabelDirect,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { MOCK_SHOPEE_ORDERS } from '../../data/mockShopeeOrders';
import { matchesPhoneQuery, formatDisplayPhone } from '../../lib/phoneUtils';
import { ShopeeSettingsModal } from '../settings/ShopeeSettingsModal';
import { ArrangeShipmentModal } from './ArrangeShipmentModal';
import { ShopeeOrderDetailModal } from './ShopeeOrderDetailModal';
import { FilterSelect } from '../ui/FilterSelect';
import { generateShopeeAwbHtml, generateShopeeBatchAwbHtml } from '../../lib/shopeeAwbGenerator';
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
  Database,
  CheckCircle2,
  Download,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShopeeOrdersViewProps {
  onClaimWarranty: (order: ShopeeOrder) => void;
  onClaimRedeem: (order: ShopeeOrder) => void;
}

type StatusTab = 'ALL' | 'READY_TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';

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
  const [activeTab, setActiveTab] = useState<StatusTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
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

  const [printedOrderSns, setPrintedOrderSns] = useState<Set<string>>(() => {
    try {
      const cached = localStorage.getItem('_exacoat_shopee_printed_labels');
      return cached ? new Set(JSON.parse(cached)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markLabelPrinted = useCallback((orderSn: string) => {
    setPrintedOrderSns((prev) => {
      const next = new Set(prev).add(orderSn);
      try {
        localStorage.setItem('_exacoat_shopee_printed_labels', JSON.stringify(Array.from(next)));
      } catch {
        // Continue gracefully
      }
      return next;
    });
  }, []);

  const handleShipmentArranged = (orderSn: string, trackingNumber: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.order_sn === orderSn
          ? { ...o, order_status: 'PROCESSED', tracking_number: trackingNumber }
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

  // Load orders and settings
  const loadData = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);

      const [ordersRes, settingsRes] = await Promise.all([
        fetchShopeeOrdersDirect(),
        fetchShopeeSettingsDirect(),
      ]);

      if (ordersRes.success && Array.isArray(ordersRes.orders) && ordersRes.orders.length > 0) {
        setOrders(ordersRes.orders);
        setIsDemoMode(false);
      } else {
        setOrders(MOCK_SHOPEE_ORDERS);
        setIsDemoMode(true);
        if (!quiet && ordersRes.error) {
          showToast('info', 'Shopee Preview', 'Showing simulated Shopee orders for testing.');
        }
      }

      if (settingsRes.success && settingsRes.settings) {
        setSettings(settingsRes.settings);
      }
    } catch {
      setOrders(MOCK_SHOPEE_ORDERS);
      setIsDemoMode(true);
      if (!quiet) {
        showToast('info', 'Shopee Preview', 'Showing simulated Shopee orders for testing.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync directly from Shopee API
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncShopeeOrdersDirect();
      if (res.success && Array.isArray(res.orders)) {
        if (res.orders.length > 0) {
          setOrders(res.orders);
          setIsDemoMode(false);
          showToast(
            'success',
            'Shopee Synced',
            `Successfully synchronized ${res.total_synced || res.orders.length} orders from Shopee.`
          );
        } else {
          showToast(
            'info',
            'Shopee Sync',
            '0 live orders found on Shopee shop. Preserving simulated sample orders for UI inspection.'
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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrintShopeeLabel = async (order: ShopeeOrder) => {
    if (!order.tracking_number && order.order_status === 'READY_TO_SHIP') {
      showToast(
        'warning',
        'Shipment Not Arranged',
        `Order ${order.order_sn} must be arranged first to allocate a tracking resi before printing label.`
      );
      setSelectedArrangeOrder(order);
      setIsArrangeModalOpen(true);
      return;
    }

    showToast(
      'info',
      'Shopee Thermal Label',
      `Loading official 100x150mm Air Waybill label for ${order.order_sn}.`
    );

    markLabelPrinted(order.order_sn);

    try {
      const res = await downloadShopeeShippingLabelDirect(order.order_sn);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
        return;
      }
    } catch {
      // Continue to local high-fidelity generator
    }

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (printWindow) {
      printWindow.document.write(generateShopeeAwbHtml(order));
      printWindow.document.close();
    }
  };

  // Status mapping and badge helper
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'READY_TO_SHIP':
        return { label: 'Ready to Ship', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' };
      case 'PROCESSED':
        return { label: 'Processed', bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' };
      case 'SHIPPED':
        return { label: 'Shipped', bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20' };
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'CANCELLED':
      case 'IN_CANCEL':
        return { label: 'Cancelled', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20' };
      case 'UNPAID':
        return { label: 'Unpaid', bg: 'bg-neutral-800', text: 'text-neutral-400', border: 'border-white/10' };
      default:
        return { label: status || 'Unknown', bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-white/10' };
    }
  };

  const availableCouriers = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      const raw = (o.shipping_carrier || '').trim();
      if (!raw) return;
      const clean = raw.replace(/[-–—:].*$/, '').trim();
      if (clean) {
        const key = clean.toUpperCase();
        if (!map.has(key)) map.set(key, clean);
      }
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  // Filtered orders computation
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === 'READY_TO_SHIP' && !['READY_TO_SHIP', 'PROCESSED'].includes(order.order_status)) return false;
      if (activeTab === 'SHIPPED' && order.order_status !== 'SHIPPED') return false;
      if (activeTab === 'COMPLETED' && order.order_status !== 'COMPLETED') return false;
      if (activeTab === 'CLAIMED' && !order.already_claimed) return false;
      if (activeTab === 'CANCELLED' && !['CANCELLED', 'IN_CANCEL'].includes(order.order_status)) return false;

      // Courier filter
      if (courierFilter !== 'all') {
        const carrier = (order.shipping_carrier || '').toUpperCase();
        if (!carrier.includes(courierFilter)) return false;
      }

      // Print status filter
      if (printFilter !== 'all') {
        const isPrinted = printedOrderSns.has(order.order_sn);
        if (printFilter === 'printed' && !isPrinted) return false;
        if (printFilter === 'unprinted' && isPrinted) return false;
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
  }, [orders, activeTab, courierFilter, printFilter, printedOrderSns, searchQuery]);

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

  // Bulk Print Shopee Labels
  const handleBulkPrint = () => {
    if (selectedOrdersList.length === 0) return;
    selectedOrdersList.forEach((o) => markLabelPrinted(o.order_sn));
    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (printWindow) {
      printWindow.document.write(generateShopeeBatchAwbHtml(selectedOrdersList));
      printWindow.document.close();
      showToast(
        'info',
        'Batch Shopee Label Print',
        `Opened print window for ${selectedOrdersList.length} Shopee orders.`
      );
    }
  };

  // Bulk Arrange Shipment trigger
  const handleBulkArrange = () => {
    const readyOrders = selectedOrdersList.filter((o) => o.order_status === 'READY_TO_SHIP');
    if (readyOrders.length === 0) {
      showToast('warning', 'No Orders to Arrange', 'None of the selected orders are in Ready to Ship status.');
      return;
    }
    setSelectedArrangeOrder(readyOrders[0]);
    setIsArrangeModalOpen(true);
  };

  // Bulk Export to CSV
  const handleBulkExport = () => {
    if (selectedOrdersList.length === 0) return;
    const headers = [
      'Order SN',
      'Create Time',
      'Buyer Username',
      'Order Status',
      'Shipping Carrier',
      'Tracking Resi',
      'Recipient Name',
      'Recipient Phone',
      'Recipient City',
      'Recipient Address',
      'Total Amount (IDR)',
      'Items Summary',
    ];

    const rows = selectedOrdersList.map((o) => [
      o.order_sn,
      o.create_time,
      o.buyer_username,
      o.order_status,
      o.shipping_carrier,
      o.tracking_number || '',
      o.recipient_name,
      o.recipient_phone,
      o.recipient_city,
      o.recipient_address,
      o.total_amount,
      (o.items || []).map((i) => `${i.item_name} (${i.model_name || 'Standard'}) x${i.quantity}`).join('; '),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`exacoat-shopee-orders-${dateStr}.csv`, headers, rows);
    showToast('success', 'CSV Exported', `Exported ${selectedOrdersList.length} orders to CSV.`);
  };

  const readyToShipCount = orders.filter((o) =>
    ['READY_TO_SHIP', 'PROCESSED'].includes(o.order_status)
  ).length;

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
                {settings?.shop_name || 'Shopee Indonesia Store'}
              </h2>
              <span
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                  settings?.environment === 'sandbox'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                )}
              >
                {settings?.environment === 'sandbox' ? 'Sandbox Mode' : 'Live Production'}
              </span>
              {isDemoMode && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Database className="w-3 h-3 text-amber-400" />
                  <span>Simulated Sample Data</span>
                </span>
              )}
              <span className="text-[11px] text-neutral-400 font-mono">
                Shop ID: {settings?.shop_id || 227918647}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Shopee Indonesia store channel. Ingests orders, tracking numbers, and handles warranty claims with duplicate invoice checks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          {isDemoMode && (
            <button
              type="button"
              onClick={() => {
                setOrders(MOCK_SHOPEE_ORDERS);
                showToast('info', 'Sample Orders', 'Reset simulated Shopee orders.');
              }}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Reset Sample Data"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset Samples</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-orange-500/20"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Shopee'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span>API Settings</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-white/10 overflow-x-auto">
          {(
            [
              { id: 'ALL', label: 'All Orders' },
              { id: 'READY_TO_SHIP', label: 'Ready to Ship', count: readyToShipCount },
              { id: 'SHIPPED', label: 'Shipped' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'CLAIMED', label: 'In RMA / Claimed' },
              { id: 'CANCELLED', label: 'Cancelled' },
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
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Order SN, Buyer, Resi, Phone..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-white/10 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Row 2: Secondary Filter Bar (Courier & Printed Resi) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-neutral-900/50 border border-white/10 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Courier Filter */}
          <FilterSelect
            label="Courier"
            value={courierFilter}
            onChange={setCourierFilter}
            icon={<Truck className="w-3.5 h-3.5" />}
            options={[
              { value: 'all', label: 'All Couriers' },
              ...availableCouriers.map((c) => ({ value: c.key, label: c.name })),
            ]}
          />

          {/* Print Status Filter */}
          <FilterSelect
            label="Label Status"
            value={printFilter}
            onChange={(val) => setPrintFilter(val as any)}
            icon={<Printer className="w-3.5 h-3.5" />}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'printed', label: 'Printed Labels' },
              { value: 'unprinted', label: 'Not Printed' },
            ]}
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
              Reset filters
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
              Select all ({filteredOrders.length})
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
              {selectedSns.size} {selectedSns.size === 1 ? 'order' : 'orders'} selected
            </span>
            <span className="text-neutral-600">|</span>
            <button
              type="button"
              onClick={() => setSelectedSns(new Set())}
              className="text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBulkPrint}
              className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Bulk Print Labels</span>
            </button>

            <button
              type="button"
              onClick={handleBulkArrange}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Bulk Arrange</span>
            </button>

            <button
              type="button"
              onClick={handleBulkExport}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
          <RefreshCw className="w-6 h-6 text-orange-400 animate-spin mx-auto" />
          <p className="text-xs text-neutral-400">Loading Shopee orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
          <Package className="w-8 h-8 text-neutral-600 mx-auto" />
          <p className="text-sm font-semibold text-neutral-300">No Shopee orders match this view</p>
          <p className="text-xs text-neutral-500">
            {searchQuery ? 'Try clearing the search query.' : 'Sync orders from Shopee or adjust tab filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pagedOrders.map((order) => {
            const statusBadge = getStatusBadge(order.order_status);
            const isClaimed = order.already_claimed;
            const isReadyToShip = order.order_status === 'READY_TO_SHIP';
            const isSelected = selectedSns.has(order.order_sn);
            const isPrinted = printedOrderSns.has(order.order_sn);

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
                  {/* Left: Checkbox, Channel tag, Order SN, Buyer */}
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
                      title="Copy Order SN"
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

                    {isClaimed && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Claimed in #{order.existing_claim?.existing_order_num}</span>
                      </span>
                    )}
                  </div>

                  {/* Right: Status badge, Label, Arrange Ship, Menu, Chevron */}
                  <div className="flex items-center gap-2 self-start lg:self-auto" onClick={(e) => e.stopPropagation()}>
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

                    {/* Quick Print Thermal Label */}
                    <button
                      type="button"
                      onClick={() => handlePrintShopeeLabel(order)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Print Shopee Air Waybill"
                    >
                      <Printer className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Label</span>
                    </button>

                    {/* Arrange Shipment Button if ready */}
                    {isReadyToShip && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedArrangeOrder(order);
                          setIsArrangeModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-orange-500/20"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Arrange Ship</span>
                      </button>
                    )}

                    {/* Dropdown Menu for Warranty / Redeem */}
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
                            <span>Copy Order SN</span>
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
                              <span>Copy Tracking Resi</span>
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
                            {item.model_name && (
                              <p className="text-[11px] font-mono text-neutral-400 mt-0.5 truncate">
                                Variant: <span className="text-neutral-200">{item.model_name}</span>
                              </p>
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
                        {order.items?.length || 0} line item(s)
                      </span>
                      <div className="font-mono text-xs font-bold text-white">
                        Total: <span className="text-orange-400">{formatCurrency(order.total_amount, 'IDR')}</span>
                      </div>
                    </div>

                    {order.buyer_note && (
                      <div className="text-xs p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-300/90 italic">
                        Note: {order.buyer_note}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Logistics and Destination */}
                  <div className="p-3.5 rounded-xl bg-neutral-950/40 border border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-neutral-500">Logistics</span>
                      <span className="font-semibold text-neutral-200">{order.shipping_carrier || 'Standard Courier'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-neutral-500">Tracking Resi</span>
                      {order.tracking_number ? (
                        <div className="flex items-center gap-1 font-mono font-bold text-orange-400">
                          <span>{order.tracking_number}</span>
                          {isPrinted && (
                            <span className="text-[9px] px-1 py-0.2 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Printed</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-500 font-mono">Pending</span>
                      )}
                    </div>

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
            Showing <span className="font-mono font-bold text-white">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-mono font-bold text-white">
              {Math.min(currentPage * pageSize, filteredOrders.length)}
            </span>{' '}
            of <span className="font-mono font-bold text-white">{filteredOrders.length}</span> orders
          </div>

          <div className="flex items-center gap-3">
            {/* Per Page Selector */}
            <FilterSelect
              label="Per page"
              value={String(pageSize)}
              onChange={(val) => handlePageSizeChange(Number(val))}
              options={[
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
                Prev
              </button>
              <span className="px-2 py-1 font-mono text-[11px] text-neutral-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-white/10 bg-neutral-900 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next
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
        isPrinted={selectedDetailOrder ? printedOrderSns.has(selectedDetailOrder.order_sn) : false}
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
    </div>
  );
};
