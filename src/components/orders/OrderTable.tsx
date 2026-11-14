import React, { useState, useMemo, useEffect } from 'react';
import { Order, OrderCounts, getOrderRma } from '../../types';
import { updateOrderStatusDirect } from '../../lib/wordpressBridge';
import { downloadCsv } from '../../lib/csvExport';
import { ShippingLabelA6Modal } from './ShippingLabelA6Modal';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { isStorePickupOrder, getOrderCourierDisplay, matchesOrderSearch } from '../../lib/orderUtils';
import {
  RefreshCw,
  Package,
  Printer,
  Download,
  X,
  ChevronDown,
  Layers,
  Store,
  PackageCheck,
  RotateCcw,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { Button, Checkbox, CountPill, Menu, SearchField, Select, StatusChip, Tabs, type MenuItem } from '../ds';
import { MORE_ORDER_TABS, PRIMARY_ORDER_TABS, tabCount } from './table/ordersTabs';
import {
  ActionsCell,
  CourierCell,
  CustomerCell,
  ItemsCell,
  OrderIdCell,
  TotalCell,
  orderNumber,
} from './table/OrderRowCells';

const MORE_TAB_ICONS: Record<string, LucideIcon> = {
  redeem: RotateCcw,
  endorsement: Megaphone,
  'store-pickup': Store,
  'store-pickup-picked': PackageCheck,
};

export function isOrderConfirmed(status: string | null | undefined): boolean {
  const clean = String(status || '').replace(/^wc-/, '').toLowerCase().trim();
  return clean === 'processing' || clean === 'confirmed';
}

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
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  courierFilter?: string;
  onCourierFilterChange?: (courier: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /** Store-wide counts for the tab pills; null hides the numbers. */
  counts?: OrderCounts | null;
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
  statusFilter: propStatusFilter,
  onStatusFilterChange,
  courierFilter: propCourierFilter,
  onCourierFilterChange,
  searchQuery: propSearchQuery,
  onSearchQueryChange,
  counts = null,
}) => {
  const { showToast } = useToast();
  const [internalSearch, setInternalSearch] = useState(propSearchQuery ?? '');
  const [internalStatus, setInternalStatus] = useState('all');
  const [internalCourier, setInternalCourier] = useState('all');
  const [printFilter, setPrintFilter] = useState<'all' | 'printed' | 'unprinted'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeStatus = propStatusFilter !== undefined ? propStatusFilter : internalStatus;
  const activeCourier = propCourierFilter !== undefined ? propCourierFilter : internalCourier;
  const activeSearch = propSearchQuery !== undefined ? propSearchQuery : internalSearch;

  // Sub-status filter for Store Pickup (SMB): 'all' | 'ready' | 'picked'
  const [storePickupSubFilter, setStorePickupSubFilter] = useState<'all' | 'ready' | 'picked'>('all');

  useEffect(() => {
    if (propStatusFilter === 'store-pickup-ready') {
      setStorePickupSubFilter('ready');
    } else if (propStatusFilter === 'store-pickup-picked') {
      setStorePickupSubFilter('picked');
    } else if (propStatusFilter === 'store-pickup') {
      setStorePickupSubFilter('all');
    }
  }, [propStatusFilter]);

  // Sync propSearchQuery changes to internalSearch
  useEffect(() => {
    if (propSearchQuery !== undefined) {
      setInternalSearch(propSearchQuery);
    }
  }, [propSearchQuery]);

  // Debounced search trigger for server-side search
  useEffect(() => {
    if (onSearchQueryChange) {
      const handler = setTimeout(() => {
        if (internalSearch !== (propSearchQuery ?? '')) {
          onSearchQueryChange(internalSearch);
        }
      }, 350);
      return () => clearTimeout(handler);
    }
  }, [internalSearch, onSearchQueryChange, propSearchQuery]);

  const handleStatusChange = (status: string) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(status);
    } else {
      setInternalStatus(status);
    }
  };

  const handleSelectStorePickupSub = (sub: 'all' | 'ready' | 'picked') => {
    setStorePickupSubFilter(sub);
    const targetStatus = sub === 'ready' 
      ? 'store-pickup-ready' 
      : (sub === 'picked' ? 'store-pickup-picked' : 'store-pickup');
    handleStatusChange(targetStatus);
  };

  const handleCourierChange = (courier: string) => {
    if (onCourierFilterChange) {
      onCourierFilterChange(courier);
    } else {
      setInternalCourier(courier);
    }
  };

  const handleSearchChange = (query: string) => {
    setInternalSearch(query);
  };

  // Printed tracking state
  const [printedOrderIds, setPrintedOrderIds] = useState<Set<number>>(() => {
    try {
      const cached = localStorage.getItem('_exacoat_direct_printed_orders');
      return cached ? new Set(JSON.parse(cached)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Listen to cross-component print events
  useEffect(() => {
    const handlePrintedEvent = (e: any) => {
      const ids = e?.detail?.orderIds;
      if (Array.isArray(ids) && ids.length > 0) {
        setPrintedOrderIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id: number) => next.add(id));
          return next;
        });
      }
    };
    window.addEventListener('exacoat_order_printed', handlePrintedEvent);
    return () => window.removeEventListener('exacoat_order_printed', handlePrintedEvent);
  }, []);

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

  // Post-print advance to Preparing order modal state
  const [showPreparingModal, setShowPreparingModal] = useState(false);
  const [ordersToMarkPreparing, setOrdersToMarkPreparing] = useState<Order[]>([]);
  const [isMarkingPreparing, setIsMarkingPreparing] = useState(false);

  const handleCopy = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const availableCouriers = useMemo(() => {
    const map = new Map<string, string>();

    // Normalize courier names to canonical keys & labels
    const normalizeCourier = (rawStr: string): { key: string; name: string } | null => {
      const s = rawStr.toLowerCase().trim();
      if (!s || s === 'unknown' || s.startsWith('field_')) return null;

      // Exclude unused couriers
      if (s.includes('paxel') || s.includes('lion') || s.includes('anteraja') || s.includes('j&t') || s.includes('jnt')) {
        return null;
      }

      if (s.includes('sicepat') || s.includes('si cepat')) return { key: 'SICEPAT', name: 'SiCepat' };
      if (s.includes('jne')) return { key: 'JNE', name: 'JNE' };
      if (s.includes('pos indonesia') || /\bpos\b/.test(s)) return { key: 'POS', name: 'POS Indonesia' };
      if (s.includes('goorita')) return { key: 'GOORITA', name: 'Goorita' };
      if (s.includes('dhl')) return { key: 'DHL', name: 'DHL Express' };
      if (s.includes('fedex')) return { key: 'FEDEX', name: 'FedEx' };

      const clean = rawStr.split('-')[0].split(':')[0].trim();
      if (!clean) return null;
      return { key: clean.toUpperCase(), name: clean };
    };

    orders.forEach((o) => {
      if (isStorePickupOrder(o)) return;

      const targetStr = String(
        o.tracking?.courier ||
        (o as any).shipping_lines?.[0]?.method_title ||
        o.shipping_method_name ||
        (o as any).detected_courier ||
        (o as any).shipping_courier_name ||
        ''
      ).trim();

      const norm = normalizeCourier(targetStr);
      if (norm) {
        map.set(norm.key, norm.name);
      }
    });

    // Fallback standard options if orders list is currently empty
    if (map.size === 0) {
      map.set('JNE', 'JNE');
      map.set('SICEPAT', 'SiCepat');
      map.set('POS', 'POS Indonesia');
      map.set('GOORITA', 'Goorita');
    }

    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const hasSearch = Boolean(activeSearch && activeSearch.trim());

    return orders.filter((order) => {
      const cleanStatus = String(order.status || '').replace('wc-', '').toLowerCase();

      // Waiting for Pickup (strictly couriers: always exclude Store Pickup orders)
      if (!hasSearch && activeStatus === 'ready-to-ship' && isStorePickupOrder(order)) {
        return false;
      }

      // Store Pickup views: always ensure order is a Store Pickup order
      if (!hasSearch && ['store-pickup', 'store-pickup-ready', 'store-pickup-picked'].includes(activeStatus)) {
        if (!isStorePickupOrder(order)) return false;

        const effectiveSub = activeStatus === 'store-pickup-ready'
          ? 'ready'
          : (activeStatus === 'store-pickup-picked' ? 'picked' : storePickupSubFilter);

        if (effectiveSub === 'ready') {
          if (!['smb-ready', 'ready-to-ship', 'ready_to_ship', 'awaiting-pickup', 'awaiting_pickup'].includes(cleanStatus)) {
            return false;
          }
        } else if (effectiveSub === 'picked') {
          if (!['smb-picked', 'completed', 'delivered'].includes(cleanStatus)) {
            return false;
          }
        }
      }

      // Specialized virtual tabs (warranty, redeem, endorsement) must ALWAYS enforce strict client-side validation
      // whether searching or not, ensuring no parent orders or non-warranty items slip through:
      if (activeStatus === 'warranty') {
        const rma = getOrderRma(order);
        const orderBadge = String((order.meta_data || []).find((m: any) => m.key === '_order_badge')?.value || '').toUpperCase();
        const isWarranty = rma?.order_type === 'Warranty' || orderBadge === 'WARRANTY';
        if (!isWarranty || rma?.is_parent_order || (order as any).has_warranty_claim) return false;
      } else if (activeStatus === 'redeem') {
        const rma = getOrderRma(order);
        const orderBadge = String((order.meta_data || []).find((m: any) => m.key === '_order_badge')?.value || '').toUpperCase();
        const isRedeem = rma?.order_type === 'Redeem' || orderBadge === 'REDEEM';
        if (!isRedeem || rma?.is_parent_order || (order as any).has_redeem_claim) return false;
      } else if (activeStatus === 'endorsement') {
        const isEndorsement = (order.meta_data || []).some(
          (m: any) => (m.key === '_order_badge' && String(m.value).toUpperCase() === 'ENDORSEMENT') || (m.key === '_is_endorsement' && m.value === 'yes')
        );
        if (!isEndorsement) return false;
      }

      // If parent didn't handle status filtering on server, filter client-side (bypassed if searching):
      if (!hasSearch && !onStatusFilterChange && activeStatus !== 'all') {
        if (['store-pickup', 'store-pickup-ready', 'store-pickup-picked', 'warranty', 'redeem', 'endorsement'].includes(activeStatus)) {
          // Already filtered above
        } else if (activeStatus === 'ready-to-ship') {
          if (!['ready-to-ship', 'ready_to_ship', 'awaiting-pickup', 'awaiting_pickup'].includes(cleanStatus)) return false;
        } else if (activeStatus === 'preparing-order') {
          if (!['preparing-order', 'preparing_order', 'in-production', 'in_production'].includes(cleanStatus)) return false;
        } else if (activeStatus === 'on-hold') {
          if (!['on-hold', 'pending-payment', 'pending'].includes(cleanStatus)) return false;
        } else if (cleanStatus !== activeStatus) {
          return false;
        }
      }

      // If parent didn't handle courier filtering on server, filter client-side (bypassed if searching):
      if (!hasSearch && !onCourierFilterChange && activeCourier !== 'all') {
        if (activeCourier === 'PICKUP') {
          if (!isStorePickupOrder(order)) return false;
        } else {
          const courierDisplay = getOrderCourierDisplay(order).toUpperCase();
          const rawCourier = String(
            order.tracking?.courier ||
            (order as any).shipping_lines?.[0]?.method_title ||
            order.shipping_method_name ||
            (order as any).shipping_courier_name ||
            ''
          ).toUpperCase();
          if (!courierDisplay.includes(activeCourier) && !rawCourier.includes(activeCourier)) {
            return false;
          }
        }
      }

      // Print status filter is ALWAYS evaluated client-side based on printedOrderIds
      if (printFilter !== 'all') {
        const isPrinted = printedOrderIds.has(order.id);
        if (printFilter === 'printed' && !isPrinted) return false;
        if (printFilter === 'unprinted' && isPrinted) return false;
      }

      // Search matching across all orders
      if (hasSearch) {
        if (onSearchQueryChange && propSearchQuery && propSearchQuery.trim() === activeSearch.trim()) {
          return true;
        }
        return matchesOrderSearch(order, activeSearch);
      }
      return true;
    });
  }, [orders, activeStatus, activeCourier, printFilter, printedOrderIds, activeSearch, onStatusFilterChange, onCourierFilterChange, onSearchQueryChange, storePickupSubFilter]);

  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  // Selection handlers
  const isAllSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id));
  const isSomeSelected = filteredOrders.some((o) => selectedIds.has(o.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
      setLastSelectedId(null);
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
      setLastSelectedId(null);
    }
  };

  const handleToggleSelect = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (e?.shiftKey && lastSelectedId !== null && lastSelectedId !== id) {
      const ids = filteredOrders.map((o) => o.id);
      const lastIdx = ids.indexOf(lastSelectedId);
      const currIdx = ids.indexOf(id);

      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        const rangeIds = ids.slice(start, end + 1);

        setSelectedIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rangeId) => next.add(rangeId));
          return next;
        });
        setLastSelectedId(id);
        return;
      }
    }

    setLastSelectedId(id);
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
    let successCount = 0;

    for (const order of selectedOrdersList) {
      try {
        const res = await updateOrderStatusDirect(order.id, bulkStatusTarget, true);
        if (res.success) successCount++;
      } catch (e) {
        console.error('Failed to update order in bulk', order.id, e);
      }
    }

    setIsBulkUpdating(false);
    showToast('success', 'Bulk Update Complete', `Updated ${successCount} orders to ${bulkStatusTarget}.`);
    setSelectedIds(new Set());
    setLastSelectedId(null);
    if (onRefresh) onRefresh();
  };

  // Bulk Print A6
  const handleBulkPrintA6 = () => {
    if (selectedOrdersList.length === 0) return;
    setPrintModalOrders(selectedOrdersList);
    setIsPrintModalOpen(true);
  };

  const handleSinglePrintA6 = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPrintA6) {
      onPrintA6(order);
    } else {
      setPrintModalOrders([order]);
      setIsPrintModalOpen(true);
    }
  };

  const handleConfirmMarkPreparing = async () => {
    if (ordersToMarkPreparing.length === 0) return;
    setIsMarkingPreparing(true);
    let successCount = 0;

    for (const order of ordersToMarkPreparing) {
      try {
        const res = await updateOrderStatusDirect(order.id, 'preparing-order', true);
        if (res.success) successCount++;
      } catch (e) {
        console.error('Failed to update order status to preparing-order', order.id, e);
      }
    }

    setIsMarkingPreparing(false);
    setShowPreparingModal(false);

    if (successCount > 0) {
      const msg =
        ordersToMarkPreparing.length === 1
          ? `Order #${String(ordersToMarkPreparing[0].order_number || ordersToMarkPreparing[0].id).replace(/^#+/, '')} marked as Preparing order.`
          : `Marked ${successCount} orders as Preparing order.`;
      showToast('success', 'Status Updated', msg);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        ordersToMarkPreparing.forEach((o) => next.delete(o.id));
        return next;
      });

      if (onRefresh) onRefresh();
    } else {
      showToast('error', 'Update Failed', 'Failed to update order status to Preparing order.');
    }

    setOrdersToMarkPreparing([]);
  };

  const handleCancelMarkPreparing = () => {
    setShowPreparingModal(false);
    setOrdersToMarkPreparing([]);
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
        getOrderCourierDisplay(o),
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

  const handleTabSelect = (key: string) => {
    if (key === 'store-pickup') handleSelectStorePickupSub('all');
    else if (key === 'store-pickup-ready') handleSelectStorePickupSub('ready');
    else if (key === 'store-pickup-picked') handleSelectStorePickupSub('picked');
    else handleStatusChange(key);
  };

  const activeMoreTab = MORE_ORDER_TABS.find((t) => t.key === activeStatus);
  const primaryTabItems = PRIMARY_ORDER_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    count: tabCount(t, counts),
    hot: t.hot,
  }));
  const moreMenuItems: MenuItem[] = MORE_ORDER_TABS.map((t) => {
    const n = tabCount(t, counts);
    return {
      icon: MORE_TAB_ICONS[t.key] || Layers,
      title: t.label,
      description: typeof n === 'number' ? `${n} ${n === 1 ? 'order' : 'orders'}` : undefined,
      onSelect: () => handleTabSelect(t.key),
      selected: t.key === activeStatus,
    };
  });

  const hasActiveFilters =
    activeCourier !== 'all' || printFilter !== 'all' || activeStatus !== 'all' || activeSearch.trim() !== '';

  const showPrintFor = (order: Order) => isOrderConfirmed(order.status) && !printedOrderIds.has(order.id);

  const shownFrom = filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const shownTo =
    filteredOrders.length === 0
      ? 0
      : totalOrders && totalOrders > 0
      ? Math.min((currentPage - 1) * pageSize + filteredOrders.length, totalOrders)
      : (currentPage - 1) * pageSize + filteredOrders.length;
  const shownTotal = totalOrders && totalOrders > 0 ? totalOrders : (currentPage - 1) * pageSize + filteredOrders.length;

  const th = 'border-b border-line px-3 py-2.5 text-left text-[12px] font-[450] text-faint whitespace-nowrap';
  const td = 'border-b border-line px-3 py-[13px] align-middle';

  return (
    <section className="overflow-hidden rounded-[14px] border border-card-border bg-card font-sans text-[14px]">
      {/* Tabs, More and filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <Tabs items={primaryTabItems} value={activeStatus} onChange={handleTabSelect} />
          <Menu
            align="start"
            items={moreMenuItems}
            trigger={
              <button
                type="button"
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border px-[11px] py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  activeMoreTab ? 'border-card-border bg-chip text-fg' : 'border-transparent text-muted hover:text-fg'
                }`}
              >
                {activeMoreTab ? activeMoreTab.label : 'More'}
                {activeMoreTab && typeof tabCount(activeMoreTab, counts) === 'number' && (
                  <CountPill value={tabCount(activeMoreTab, counts) as number} />
                )}
                <ChevronDown className="h-[14px] w-[14px] text-faint" strokeWidth={1.8} aria-hidden />
              </button>
            }
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                handleCourierChange('all');
                handleStatusChange('all');
                setPrintFilter('all');
                if (onSearchQueryChange) onSearchQueryChange('');
                setInternalSearch('');
              }}
            >
              Reset filters
            </Button>
          )}
          <Select
            aria-label="Courier"
            className="w-[136px]"
            value={activeCourier}
            onChange={handleCourierChange}
            options={[
              { value: 'all', label: 'All couriers' },
              ...availableCouriers.map((c) => ({ value: c.key, label: c.name })),
              { value: 'PICKUP', label: 'Store pickup' },
            ]}
          />
          <Select
            aria-label="Label status"
            className="w-[124px]"
            value={printFilter}
            onChange={(val) => setPrintFilter(val as 'all' | 'printed' | 'unprinted')}
            options={[
              { value: 'all', label: 'All labels' },
              { value: 'printed', label: 'Printed' },
              { value: 'unprinted', label: 'Not printed' },
            ]}
          />
          <div className="relative w-[220px]">
            <SearchField
              placeholder="Search orders, resi, phone"
              value={internalSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (onSearchQueryChange) {
                    onSearchQueryChange(internalSearch);
                  }
                }
              }}
              className="pr-8 [&_input::-webkit-search-cancel-button]:appearance-none"
            />
            {internalSearch && (
              <button
                type="button"
                onClick={() => {
                  handleSearchChange('');
                  if (onSearchQueryChange) onSearchQueryChange('');
                }}
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-faint hover:bg-chip hover:text-fg"
                aria-label="Clear search"
                title="Clear search"
              >
                <X className="h-[14px] w-[14px]" strokeWidth={1.8} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk actions for the selected rows */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-accent-soft px-4 py-2.5">
          <span className="text-[13px] font-medium text-fg">
            {selectedIds.size} {selectedIds.size === 1 ? 'order' : 'orders'} selected
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Deselect all
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              aria-label="New status"
              className="w-[190px]"
              value={bulkStatusTarget}
              onChange={setBulkStatusTarget}
              options={[
                { value: 'processing', label: 'To prepare' },
                { value: 'preparing-order', label: 'Preparing' },
                { value: 'ready-to-ship', label: 'Waiting for courier' },
                { value: 'shipped', label: 'Shipped' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
            <Button
              variant="primary"
              icon={RefreshCw}
              onClick={handleBulkChangeStatus}
              disabled={isBulkUpdating}
              className={isBulkUpdating ? '[&>svg:first-child]:animate-spin' : ''}
            >
              {isBulkUpdating ? 'Updating...' : 'Update status'}
            </Button>
            <Button icon={Printer} onClick={handleBulkPrintA6}>
              Print A6 labels
            </Button>
            <Button icon={Download} onClick={handleBulkExport}>
              Export CSV
            </Button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1180px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[44px]" />
            <col className="w-[200px]" />
            <col className="w-[230px]" />
            <col />
            <col className="w-[140px]" />
            <col className="w-[190px]" />
            <col className="w-[230px]" />
            <col className="w-[124px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${th} pr-0`}>
                <Checkbox
                  aria-label="Select all orders on this page"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = !isAllSelected && isSomeSelected;
                    }
                  }}
                  onChange={handleToggleSelectAll}
                />
              </th>
              <th className={th}>Order</th>
              <th className={th}>Customer &amp; destination</th>
              <th className={th}>Items</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Status</th>
              <th className={th}>Courier &amp; resi</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-faint" strokeWidth={1.5} aria-hidden />
                  <p className="text-[13px] text-muted">
                    {isLoading ? 'Fetching live orders...' : 'No orders match these criteria.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedIds.has(order.id);
                return (
                  <tr
                    key={order.id}
                    onClick={() => onSelectOrder(order)}
                    className={`cursor-pointer whitespace-nowrap transition-colors [&:last-child>td]:border-b-0 ${
                      isSelected ? 'bg-accent-soft' : 'hover:bg-chip'
                    }`}
                  >
                    <td className={`${td} pr-0`} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select order ${orderNumber(order)}`}
                        checked={isSelected}
                        onClick={(e) => handleToggleSelect(order.id, e)}
                        onChange={() => {}}
                      />
                    </td>
                    <td className={td}><OrderIdCell order={order} /></td>
                    <td className={td}><CustomerCell order={order} /></td>
                    <td className={td}><ItemsCell order={order} /></td>
                    <td className={td}><TotalCell order={order} /></td>
                    <td className={`${td} overflow-hidden`}><StatusChip order={order} /></td>
                    <td className={td}>
                      <CourierCell
                        order={order}
                        copied={copiedId === `track_${order.id}`}
                        onCopy={(resi, e) => handleCopy(resi, `track_${order.id}`, e)}
                      />
                    </td>
                    <td className={td} onClick={(e) => e.stopPropagation()}>
                      <ActionsCell
                        order={order}
                        showPrint={showPrintFor(order)}
                        onPrint={(e) => handleSinglePrintA6(order, e)}
                        onOpen={() => onSelectOrder(order)}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="md:hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="mx-auto mb-2 h-8 w-8 text-faint" strokeWidth={1.5} aria-hidden />
            <p className="text-[13px] text-muted">{isLoading ? 'Fetching live orders...' : 'No orders found.'}</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const isSelected = selectedIds.has(order.id);
            return (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className={`cursor-pointer space-y-2.5 border-b border-line p-3.5 transition-colors last:border-b-0 ${
                  isSelected ? 'bg-accent-soft' : 'hover:bg-chip'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                      <Checkbox
                        aria-label={`Select order ${orderNumber(order)}`}
                        checked={isSelected}
                        onChange={(e) => handleToggleSelect(order.id, e as any)}
                      />
                    </span>
                    <OrderIdCell order={order} />
                  </div>
                  <StatusChip order={order} size="sm" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <CustomerCell order={order} />
                  <TotalCell order={order} />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
                  <CourierCell
                    order={order}
                    copied={copiedId === `track_${order.id}`}
                    onCopy={(resi, e) => handleCopy(resi, `track_${order.id}`, e)}
                  />
                  <span onClick={(e) => e.stopPropagation()}>
                    <ActionsCell
                      order={order}
                      showPrint={showPrintFor(order)}
                      onPrint={(e) => handleSinglePrintA6(order, e)}
                      onOpen={() => onSelectOrder(order)}
                    />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-muted sm:flex-row">
        <div className="flex items-center gap-2">
          <span>
            Showing <span className="font-mono font-medium text-fg">{shownFrom}</span> to{' '}
            <span className="font-mono font-medium text-fg">{shownTo}</span> of{' '}
            <span className="font-mono font-medium text-fg">{shownTotal}</span> orders
          </span>
          {Boolean(activeSearch && activeSearch.trim()) && (
            <span className="rounded-full bg-accent-soft px-2 py-px text-[12px] font-medium text-accent-fg">Search results</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-faint">Per page</span>
            <Select
              aria-label="Orders per page"
              className="w-[84px]"
              value={String(pageSize)}
              onChange={(val) => onPageSizeChange && onPageSizeChange(Number(val))}
              options={[
                { value: '50', label: '50' },
                { value: '100', label: '100' },
                { value: '200', label: '200' },
              ]}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => onPageChange && onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
              Prev
            </Button>
            <span className="px-1.5 font-mono text-[12.5px] text-fg">
              Page {currentPage} of {Math.max(1, maxPages || 1)}
            </span>
            <Button
              size="sm"
              onClick={() => onPageChange && onPageChange(currentPage + 1)}
              disabled={currentPage >= (maxPages || 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Internal A6 Thermal Label Modal for Bulk / Row Print */}
      <ShippingLabelA6Modal
        orders={printModalOrders}
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintModalOrders([]);
        }}
        onPrinted={(orderIds) => {
          setPrintedOrderIds((prev) => {
            const next = new Set(prev);
            orderIds.forEach((id) => next.add(id));
            return next;
          });

          // Filter printed orders to those that are confirmed
          const confirmedPrinted = printModalOrders.filter((ord) => {
            const clean = String(ord.status || '').replace(/^wc-/, '').toLowerCase().trim();
            return clean === 'processing' || clean === 'confirmed';
          });

          const targets = confirmedPrinted.length > 0 ? confirmedPrinted : printModalOrders;
          if (targets.length > 0) {
            setIsPrintModalOpen(false);
            setOrdersToMarkPreparing(targets);
            setShowPreparingModal(true);
          }
        }}
      />

      {/* Post-Print Advance to Preparing Order Confirmation Modal */}
      <Modal
        isOpen={showPreparingModal}
        onClose={handleCancelMarkPreparing}
        maxWidth="md"
        title={
          <div className="flex items-center gap-2 text-fg">
            <Layers className="h-5 w-5 text-accent-fg" strokeWidth={1.8} aria-hidden />
            <span className="text-[15px] font-semibold">
              {ordersToMarkPreparing.length === 1
                ? 'Move order to Preparing?'
                : `Move ${ordersToMarkPreparing.length} orders to Preparing?`}
            </span>
          </div>
        }
        subtitle={
          ordersToMarkPreparing.length === 1
            ? 'The shipping label was sent to print. Move the order on to start fulfillment.'
            : `${ordersToMarkPreparing.length} shipping labels were sent to print. Move the orders on to start fulfillment.`
        }
        footer={
          <div className="flex w-full items-center justify-end gap-2.5">
            <Button variant="ghost" disabled={isMarkingPreparing} onClick={handleCancelMarkPreparing}>
              Keep as To prepare
            </Button>
            <Button
              variant="primary"
              disabled={isMarkingPreparing}
              onClick={handleConfirmMarkPreparing}
              icon={isMarkingPreparing ? RefreshCw : undefined}
              className={isMarkingPreparing ? '[&>svg:first-child]:animate-spin' : ''}
            >
              {isMarkingPreparing
                ? 'Updating...'
                : ordersToMarkPreparing.length === 1
                ? 'Move to Preparing'
                : `Move ${ordersToMarkPreparing.length} orders to Preparing`}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-[13.5px]">
          <p className="text-muted">
            {ordersToMarkPreparing.length === 1 ? (
              <>
                Update order{' '}
                <strong className="font-mono font-medium text-fg">#{orderNumber(ordersToMarkPreparing[0])}</strong> from To
                prepare to Preparing?
              </>
            ) : (
              <>
                Update <strong className="font-medium text-fg">{ordersToMarkPreparing.length} orders</strong> from To prepare
                to Preparing?
              </>
            )}
          </p>

          <div className="max-h-48 divide-y divide-line overflow-y-auto rounded-[10px] border border-card-border">
            {ordersToMarkPreparing.map((ord) => (
              <div key={ord.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-mono font-medium text-fg">#{orderNumber(ord)}</span>
                  <span className="truncate text-muted">{ord.customer_name || 'Customer'}</span>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <span className="text-[12.5px] text-faint">{getOrderCourierDisplay(ord)}</span>
                  <StatusChip order={{ status: 'preparing-order' }} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </section>
  );
};
