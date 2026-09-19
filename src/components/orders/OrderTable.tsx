import React, { useState, useMemo } from 'react';
import { Order, getOrderRma } from '../../types';
import { Badge } from '../ui/Badge';
import { GlassCard } from '../ui/GlassCard';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { matchesPhoneQuery } from '../../lib/phoneUtils';
import { updateOrderStatusDirect } from '../../lib/wordpressBridge';
import { downloadCsv } from '../../lib/csvExport';
import { ShippingLabelA6Modal } from './ShippingLabelA6Modal';
import { useToast } from '../../context/ToastContext';
import { FilterSelect } from '../ui/FilterSelect';
import { isStorePickupOrder } from '../../lib/orderUtils';
import {
  Search,
  RefreshCw,
  Eye,
  Package,
  Truck,
  ShieldCheck,
  RotateCcw,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  Download,
  X,
  ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface OrderTableProps {
  orders: Order[];
  isLoading: boolean;
  onSelectOrder: (order: Order) => void;
  onRefresh?: () => void;
  onPrintA6?: (order: Order) => void;
  currentPage?: number;
  maxPages?: number;
  totalOrders?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  isLoading,
  onSelectOrder,
  onRefresh,
  onPrintA6,
  currentPage = 1,
  maxPages = 1,
  totalOrders,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
}) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [printFilter, setPrintFilter] = useState<'all' | 'printed' | 'unprinted'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Printed tracking state
  const [printedOrderIds, setPrintedOrderIds] = useState<Set<number>>(() => {
    try {
      const cached = localStorage.getItem('_exacoat_direct_printed_orders');
      return cached ? new Set(JSON.parse(cached)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markOrderPrinted = (orderId: number) => {
    setPrintedOrderIds((prev) => {
      const next = new Set(prev).add(orderId);
      try {
        localStorage.setItem('_exacoat_direct_printed_orders', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const toggleOrderPrinted = (orderId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPrintedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      try {
        localStorage.setItem('_exacoat_direct_printed_orders', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<string>('processing');

  // Internal A6 print modal state
  const [printModalOrders, setPrintModalOrders] = useState<Order[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handleCopy = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusCounts = useMemo(() => {
    let onHold = 0;
    let confirmed = 0;
    let preparing = 0;
    let readyToShip = 0;
    let storePickup = 0;
    let shipped = 0;
    let completed = 0;
    let warranty = 0;
    let redeem = 0;

    orders.forEach((o) => {
      const cleanStatus = String(o.status || '').replace('wc-', '').toLowerCase();
      const rma = getOrderRma(o);
      if (rma?.order_type === 'Warranty') warranty++;
      if (rma?.order_type === 'Redeem') redeem++;

      if (['on-hold', 'pending-payment', 'pending'].includes(cleanStatus)) {
        onHold++;
      } else if (cleanStatus === 'processing') {
        confirmed++;
      } else if (['preparing-order', 'preparing_order', 'in-production', 'in_production'].includes(cleanStatus)) {
        preparing++;
      }

      if (['ready-to-ship', 'ready_to_ship', 'awaiting-pickup', 'awaiting_pickup', 'smb-ready'].includes(cleanStatus)) {
        readyToShip++;
      }

      const isPickup = isStorePickupOrder(o);
      if (isPickup) {
        storePickup++;
      }

      if (cleanStatus === 'shipped') {
        shipped++;
      } else if (cleanStatus === 'completed' || cleanStatus === 'delivered') {
        completed++;
      }
    });

    return { onHold, confirmed, preparing, readyToShip, storePickup, shipped, completed, warranty, redeem };
  }, [orders]);

  const availableCouriers = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      const raw = String(o.tracking?.courier || (o as any).shipping_lines?.[0]?.method_title || o.shipping_method_name || '').trim();
      if (!raw) return;
      const clean = raw.replace(/[-–—:].*$/, '').trim();
      if (clean && !clean.startsWith('field_') && clean.toUpperCase() !== 'UNKNOWN') {
        const key = clean.toUpperCase();
        if (!map.has(key)) {
          map.set(key, clean);
        }
      }
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'warranty') {
          const rma = getOrderRma(order);
          if (rma?.order_type !== 'Warranty') return false;
        } else if (statusFilter === 'redeem') {
          const rma = getOrderRma(order);
          if (rma?.order_type !== 'Redeem') return false;
        } else {
          const cleanStatus = String(order.status || '').replace('wc-', '').toLowerCase();
          if (statusFilter === 'store-pickup') {
            if (!isStorePickupOrder(order)) return false;
          } else if (statusFilter === 'ready-to-ship') {
            if (!['ready-to-ship', 'ready_to_ship', 'awaiting-pickup', 'awaiting_pickup', 'smb-ready'].includes(cleanStatus)) return false;
          } else if (statusFilter === 'preparing-order') {
            if (!['preparing-order', 'preparing_order', 'in-production', 'in_production'].includes(cleanStatus)) return false;
          } else if (statusFilter === 'on-hold') {
            if (!['on-hold', 'pending-payment', 'pending'].includes(cleanStatus)) return false;
          } else if (cleanStatus !== statusFilter) {
            return false;
          }
        }
      }

      // Courier filter
      if (courierFilter !== 'all') {
        const orderCourier = String(order.tracking?.courier || (order as any).shipping_lines?.[0]?.method_title || order.shipping_method_name || '').toUpperCase();
        if (courierFilter === 'PICKUP') {
          if (!isStorePickupOrder(order)) return false;
        } else if (!orderCourier.includes(courierFilter)) {
          return false;
        }
      }

      // Print status filter
      if (printFilter !== 'all') {
        const isPrinted = printedOrderIds.has(order.id);
        if (printFilter === 'printed' && !isPrinted) return false;
        if (printFilter === 'unprinted' && isPrinted) return false;
      }

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = String(order.order_number || order.id || '').toLowerCase();
        const custName = String(order.customer_name || '').toLowerCase();
        const custEmail = String(order.customer_email || '').toLowerCase();
        const trackNum = String(order.tracking?.tracking_number || '').toLowerCase();
        const phone = order.customer_phone || order.billing?.phone || order.shipping?.phone;
        const phoneMatch = matchesPhoneQuery(phone, q);
        const itemNames = (order.items || []).map((i) => i.name.toLowerCase()).join(' ');

        return (
          num.includes(q) ||
          custName.includes(q) ||
          custEmail.includes(q) ||
          trackNum.includes(q) ||
          phoneMatch ||
          itemNames.includes(q)
        );
      }
      return true;
    });
  }, [orders, statusFilter, courierFilter, printFilter, printedOrderIds, searchQuery]);

  // Selection handlers
  const isAllSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id));
  const isSomeSelected = filteredOrders.some((o) => selectedIds.has(o.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const handleToggleSelect = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedOrdersList = useMemo(() => {
    return orders.filter((o) => selectedIds.has(o.id));
  }, [orders, selectedIds]);

  // Bulk Change Status
  const handleBulkChangeStatus = async () => {
    if (selectedOrdersList.length === 0) return;
    setIsBulkUpdating(true);
    showToast(
      'info',
      'Updating Status',
      `Updating status of ${selectedOrdersList.length} orders to "${bulkStatusTarget}"...`
    );

    let successCount = 0;
    for (const ord of selectedOrdersList) {
      try {
        const res = await updateOrderStatusDirect(ord.id, bulkStatusTarget);
        if (res.success) successCount++;
      } catch {
        // Continue processing batch
      }
    }

    setIsBulkUpdating(false);
    showToast(
      'success',
      'Bulk Status Updated',
      `Updated ${successCount} of ${selectedOrdersList.length} orders to ${bulkStatusTarget}.`
    );
    setSelectedIds(new Set());
    if (onRefresh) onRefresh();
  };

  // Bulk Print A6
  const handleBulkPrintA6 = () => {
    if (selectedOrdersList.length === 0) return;
    selectedOrdersList.forEach((o) => markOrderPrinted(o.id));
    setPrintModalOrders(selectedOrdersList);
    setIsPrintModalOpen(true);
  };

  const handleSinglePrintA6 = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    markOrderPrinted(order.id);
    if (onPrintA6) {
      onPrintA6(order);
    } else {
      setPrintModalOrders([order]);
      setIsPrintModalOpen(true);
    }
  };

  // Bulk Export to CSV
  const handleBulkExport = () => {
    if (selectedOrdersList.length === 0) return;
    const headers = [
      'Order Number',
      'Created Date',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Status',
      'Courier',
      'Tracking Number',
      'Destination City',
      'Destination Address',
      'Currency',
      'Total Amount',
      'Items Count',
      'Items Breakdown',
    ];

    const rows = selectedOrdersList.map((o) => {
      const phone = o.customer_phone || o.billing?.phone || o.shipping?.phone || '';
      const email = o.customer_email || o.billing?.email || '';
      const itemsStr = (o.items || []).map((i) => `${i.name} x${i.quantity}`).join('; ');
      return [
        String(o.order_number || o.id).replace(/^#+/, ''),
        o.created_at,
        o.customer_name || 'Customer',
        phone,
        email,
        o.status,
        o.tracking?.courier || o.shipping_method_name || '',
        o.tracking?.tracking_number || '',
        o.shipping?.city || '',
        `${o.shipping?.address_1 || ''} ${o.shipping?.address_2 || ''}`.trim(),
        o.currency || 'IDR',
        o.total,
        o.item_count || o.items?.length || 1,
        itemsStr,
      ];
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`exacoat-direct-orders-${dateStr}.csv`, headers, rows);
    showToast('success', 'CSV Exported', `Exported ${selectedOrdersList.length} orders to CSV.`);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Control Bar: Search & Status Filters */}
      <GlassCard className="p-3 sm:p-4 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] space-y-3 overflow-visible relative z-20">
        {/* Row 1: Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {[
            { key: 'all', label: 'All Orders' },
            { key: 'on-hold', label: 'Waiting for Payment', count: statusCounts.onHold },
            { key: 'processing', label: 'Confirmed', count: statusCounts.confirmed },
            { key: 'preparing-order', label: 'Preparing order', count: statusCounts.preparing },
            { key: 'ready-to-ship', label: 'Waiting for Pickup', count: statusCounts.readyToShip },
            { key: 'store-pickup', label: 'Store Pickup (SMB)', count: statusCounts.storePickup },
            { key: 'shipped', label: 'Shipped', count: statusCounts.shipped },
            { key: 'completed', label: 'Completed', count: statusCounts.completed },
            { key: 'warranty', label: 'Warranty Claims', count: statusCounts.warranty },
            { key: 'redeem', label: 'Redeem', count: statusCounts.redeem },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5',
                statusFilter === tab.key
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-transparent'
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={clsx(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold',
                    statusFilter === tab.key
                      ? tab.key === 'redeem'
                        ? 'bg-amber-500 text-black font-extrabold'
                        : 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                      : tab.key === 'redeem'
                      ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-white/10'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Row 2: Secondary Filters & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-zinc-100 dark:border-white/5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Courier Filter */}
            <FilterSelect
              label="Courier"
              value={courierFilter}
              onChange={setCourierFilter}
              icon={<Truck className="w-3.5 h-3.5" />}
              options={[
                { value: 'all', label: 'All Couriers' },
                ...availableCouriers.map((c) => ({ value: c.key, label: c.name })),
                { value: 'PICKUP', label: 'Store Pickup (SMB)' },
              ]}
            />

            {/* Print Status Filter */}
            <FilterSelect
              label="Label Status"
              value={printFilter}
              onChange={(val) => setPrintFilter(val as any)}
              icon={<Printer className="w-3.5 h-3.5" />}
              options={[
                { value: 'all', label: 'All Orders' },
                { value: 'printed', label: 'Printed Labels' },
                { value: 'unprinted', label: 'Not Printed' },
              ]}
            />

            {/* Clear Filters */}
            {(courierFilter !== 'all' || printFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setCourierFilter('all');
                  setPrintFilter('all');
                  setStatusFilter('all');
                }}
                className="px-2 py-1 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white text-xs underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Search Input and Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search orders, phone, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-[#f3aa18]"
              />
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-[#141414] hover:bg-zinc-200 dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-white/[0.08] transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                title="Refresh Orders"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin text-[#f3aa18]')} />
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Multiselect Bulk Action Bar (Displayed under pills when items are selected) */}
        {selectedIds.size > 0 && (
          <div className="pt-3 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-3 bg-amber-500/[0.06] dark:bg-amber-500/[0.08] rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#f3aa18] animate-pulse" />
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                {selectedIds.size} {selectedIds.size === 1 ? 'order' : 'orders'} selected
              </span>
              <span className="text-zinc-400 dark:text-zinc-600">|</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer"
              >
                Deselect All
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Bulk Change Status Selector */}
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <FilterSelect
                  value={bulkStatusTarget}
                  onChange={setBulkStatusTarget}
                  options={[
                    { value: 'processing', label: 'Confirmed (Processing)' },
                    { value: 'preparing-order', label: 'Preparing Order' },
                    { value: 'ready-to-ship', label: 'Waiting for Pickup' },
                    { value: 'shipped', label: 'Shipped' },
                    { value: 'completed', label: 'Completed' },
                  ]}
                />

                <button
                  type="button"
                  onClick={handleBulkChangeStatus}
                  disabled={isBulkUpdating}
                  className="px-3.5 py-1.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
                >
                  <RefreshCw className={clsx('w-3.5 h-3.5', isBulkUpdating && 'animate-spin')} />
                  <span>{isBulkUpdating ? 'Updating...' : 'Update Status'}</span>
                </button>
              </div>

              {/* Bulk Print A6 */}
              <button
                type="button"
                onClick={handleBulkPrintA6}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-800 dark:text-neutral-200 border border-zinc-300 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-neutral-400" />
                <span>Bulk Print A6</span>
              </button>

              {/* Bulk Export CSV */}
              <button
                type="button"
                onClick={handleBulkExport}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-zinc-800 dark:text-neutral-200 border border-zinc-300 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-zinc-500 dark:text-neutral-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Orders Table Container */}
      <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans select-none">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0d0d0d]/80 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = !isAllSelected && isSomeSelected;
                      }
                    }}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-white/20 bg-white dark:bg-neutral-800 text-[#f3aa18] focus:ring-[#f3aa18] focus:ring-offset-0 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Order</th>
                <th className="py-3.5 px-4">Customer & Destination</th>
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4 text-right">Total</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Courier & Tracking Resi</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-zinc-500 font-sans">
                    <Package className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">
                      {isLoading ? 'Fetching live orders...' : 'No orders match these criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const rawTrackingNum = String(order.tracking?.tracking_number || '').trim();
                  const hasValidTracking = rawTrackingNum.length > 0 && !rawTrackingNum.startsWith('field_');
                  const isSelected = selectedIds.has(order.id);
                  const isPickup = isStorePickupOrder(order);
                  const isPrinted = printedOrderIds.has(order.id);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className={clsx(
                        'hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group',
                        isSelected && 'bg-[#f3aa18]/[0.04] dark:bg-[#f3aa18]/[0.04]'
                      )}
                    >
                      {/* Checkbox Column */}
                      <td className="py-3.5 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelect(order.id, e as any)}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-white/20 bg-white dark:bg-neutral-800 text-[#f3aa18] focus:ring-[#f3aa18] focus:ring-offset-0 cursor-pointer"
                        />
                      </td>

                      {/* Order Number & Date */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white">
                            #{String(order.order_number || order.id).replace(/^#+/, '')}
                          </span>
                          {getOrderRma(order)?.order_type === 'Redeem' && (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold text-amber-500 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 rounded shadow-xs">
                              <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                              REDEEM
                            </span>
                          )}
                          {getOrderRma(order)?.order_type === 'Warranty' && (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.5 rounded shadow-xs">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              WARRANTY
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono block mt-0.5">
                          {formatDateTime(order.created_at)}
                        </span>
                      </td>

                      {/* Customer Name & Destination */}
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-zinc-900 dark:text-white">
                          {order.customer_name || 'Customer'}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[180px]">
                          {isPickup ? (
                            <span className="text-[#f3aa18] font-medium">Summarecon Bekasi Store</span>
                          ) : (
                            `${order.shipping?.city ? `${order.shipping.city}, ` : ''}${order.shipping?.country || 'Indonesia'}`
                          )}
                        </p>
                      </td>

                      {/* Items Count & Products */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">
                          <Package className="w-3 h-3 text-zinc-400" />
                          {order.item_count ?? (order.items?.length || 0)} {order.item_count === 1 ? 'item' : 'items'}
                        </span>
                        <div className="text-[10.5px] text-zinc-500 truncate max-w-[180px]">
                          {order.items?.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          {order.payment_method_title || order.payment_method || 'Direct'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge type="orderStatus" value={order.status} size="xs" />
                          {getOrderRma(order)?.order_type === 'Redeem' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-amber-500 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 whitespace-nowrap">
                              <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                              Redeem
                            </span>
                          )}
                          {getOrderRma(order)?.order_type === 'Warranty' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              Warranty Claim
                            </span>
                          )}
                          {isPickup && (
                            <span className="inline-flex items-center text-[9px] font-mono font-semibold text-[#f3aa18] bg-[#f3aa18]/10 px-1.5 py-0.5 rounded border border-[#f3aa18]/20 whitespace-nowrap">
                              Store Pickup (SMB)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tracking Resi & Courier */}
                      <td className="py-3.5 px-4">
                        {isPickup ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center text-[10px] font-mono font-semibold text-[#f3aa18] bg-[#f3aa18]/10 px-2 py-0.5 rounded border border-[#f3aa18]/20 whitespace-nowrap">
                              Store Pickup
                            </span>
                            <span className="text-[10px] text-zinc-500 block truncate max-w-[140px]">
                              Summarecon Bekasi
                            </span>
                          </div>
                        ) : hasValidTracking ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <Truck className="w-3 h-3 text-emerald-500" />
                                {rawTrackingNum}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopy(rawTrackingNum, `track_${order.id}`, e)}
                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                                title="Copy Resi"
                              >
                                {copiedId === `track_${order.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <span className="text-[10px] text-zinc-500 truncate max-w-[140px] font-medium block">
                              {order.tracking?.courier || order.shipping_method_name || 'Courier'}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono block">
                              Resi pending
                            </span>
                            <span className="text-[10px] text-zinc-500 block truncate max-w-[140px]">
                              {order.shipping_method_name || 'Standard'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print Thermal Label - Subtle difference if printed vs unprinted */}
                          <button
                            type="button"
                            onClick={(e) => handleSinglePrintA6(order, e)}
                            className={clsx(
                              'p-1.5 rounded-lg border transition-all cursor-pointer relative',
                              isPrinted
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 dark:text-zinc-500 hover:text-zinc-950 dark:hover:text-white border-transparent hover:border-zinc-300 dark:hover:border-white/10'
                            )}
                            title={isPrinted ? 'A6 Shipping Label (Printed - Click to print again)' : 'Print A6 Shipping Label'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            {isPrinted && (
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-neutral-900" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectOrder(order)}
                            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border border-transparent hover:border-zinc-300 dark:hover:border-white/10 transition-colors cursor-pointer"
                            title="Inspect Order Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-white/[0.04]">
          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 font-sans">
              <Package className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2 opacity-50" />
              <p className="text-xs">
                {isLoading ? 'Fetching live orders...' : 'No orders found.'}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isSelected = selectedIds.has(order.id);
              const rawTrackingNum = String(order.tracking?.tracking_number || '').trim();
              const hasValidTracking = rawTrackingNum.length > 0 && !rawTrackingNum.startsWith('field_');

              return (
                <div
                  key={order.id}
                  onClick={() => onSelectOrder(order)}
                  className={clsx(
                    'p-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer space-y-2.5',
                    isSelected && 'bg-[#f3aa18]/[0.04] dark:bg-[#f3aa18]/[0.04]'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleToggleSelect(order.id, e as any)}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-white/20 bg-white dark:bg-neutral-800 text-[#f3aa18] focus:ring-[#f3aa18] focus:ring-offset-0 cursor-pointer shrink-0"
                      />
                      <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                        #{String(order.order_number || order.id).replace(/^#+/, '')}
                      </span>
                      {getOrderRma(order)?.order_type === 'Redeem' && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold text-amber-500 dark:text-amber-400 bg-amber-500/20 border border-amber-500/40 px-1 py-0.2 rounded">
                          <RotateCcw className="w-2 h-2 text-amber-400" />
                          REDEEM
                        </span>
                      )}
                      {getOrderRma(order)?.order_type === 'Warranty' && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold text-sky-500 dark:text-sky-400 bg-sky-500/20 border border-sky-500/40 px-1 py-0.2 rounded">
                          <ShieldCheck className="w-2 h-2 text-sky-400" />
                          WARRANTY
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatDateTime(order.created_at)}
                      </span>
                    </div>
                    <Badge type="orderStatus" value={order.status} size="xs" />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {order.customer_name || 'Customer'}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {order.shipping?.city ? `${order.shipping.city}, ` : ''}{order.shipping?.country || 'Indonesia'}
                      </p>
                    </div>
                    <p className="font-mono font-bold text-zinc-900 dark:text-white text-sm">
                      {formatCurrency(order.total, order.currency)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-100 dark:border-white/5">
                    <span className="text-zinc-500">{order.tracking?.courier || 'Courier'}</span>
                    <div className="flex items-center gap-2">
                      {hasValidTracking && (
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {rawTrackingNum}
                        </span>
                      )}
                      {/* Subtle Print Quick Action */}
                      <button
                        type="button"
                        onClick={(e) => handleSinglePrintA6(order, e)}
                        className={clsx(
                          'p-1.5 rounded-lg border transition-all cursor-pointer relative',
                          printedOrderIds.has(order.id)
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-400 dark:text-zinc-500 border-transparent hover:border-zinc-300 dark:hover:border-white/10'
                        )}
                        title={printedOrderIds.has(order.id) ? 'A6 Shipping Label (Printed - Click to print again)' : 'Print A6 Shipping Label'}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {printedOrderIds.has(order.id) && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-neutral-900" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Table Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0e0e0e]/80 text-xs text-zinc-600 dark:text-zinc-400 font-sans">
          <div className="flex items-center gap-2">
            <span>
              Showing <span className="font-mono font-bold text-zinc-900 dark:text-white">{filteredOrders.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}</span> to{' '}
              <span className="font-mono font-bold text-zinc-900 dark:text-white">
                {Math.min(currentPage * pageSize, totalOrders ?? filteredOrders.length)}
              </span>{' '}
              of <span className="font-mono font-bold text-zinc-900 dark:text-white">{totalOrders ?? orders.length}</span> orders
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Per Page Selector */}
            <FilterSelect
              label="Per page"
              value={pageSize}
              onChange={(val) => onPageSizeChange && onPageSizeChange(Number(val))}
              dropUp={true}
              options={[
                { value: 50, label: '50' },
                { value: 100, label: '100' },
                { value: 200, label: '200' },
              ]}
            />

            {/* Page Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPageChange && onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-neutral-900 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors font-sans"
              >
                Prev
              </button>
              <span className="px-2 py-1 font-mono text-[11px]">
                Page {currentPage} of {Math.max(1, maxPages || 1)}
              </span>
              <button
                type="button"
                onClick={() => onPageChange && onPageChange(currentPage + 1)}
                disabled={currentPage >= (maxPages || 1)}
                className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-neutral-900 hover:bg-zinc-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors font-sans"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Internal A6 Thermal Label Modal for Bulk / Row Print */}
      <ShippingLabelA6Modal
        orders={printModalOrders}
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintModalOrders([]);
        }}
      />
    </div>
  );
};
