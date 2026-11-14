import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Order } from '../../types';
import { OrderTable } from './OrderTable';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { ExportShipmentsModal } from './ExportShipmentsModal';
import { TrackingPoolModal } from './TrackingPoolModal';
import { ManualWarrantyModal } from './ManualWarrantyModal';
import { EndorsementOrderModal } from './EndorsementOrderModal';
import { RmaClaimsLogModal } from './RmaClaimsLogModal';
import { ShopeeOrdersView } from './ShopeeOrdersView';
import { TikTokOrdersView } from './TikTokOrdersView';
import { fetchOrdersDirect, fetchOrderDetailDirect, syncActiveShipmentsDirect, ShopeeOrder, TikTokOrder } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { RefreshCw, Package, ShieldCheck, RotateCcw, Tag, Megaphone, Plus, ChevronDown, Clock, Store, Truck } from 'lucide-react';
import type { OrderCounts } from '../../types';
import { Button, IconButton, KpiCard, Menu, type MenuItem } from '../ds';

interface OrdersViewProps {
  initialStatus?: string;
  onNavigateToCustomer?: (customerId: number, customerEmail?: string, customerName?: string) => void;
  /** Store-wide counts from App's useOrderCounts (shared with the sidebar badges); null until the endpoint answers. */
  orderCounts?: OrderCounts | null;
  onRefreshCounts?: () => Promise<void> | void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ 
  initialStatus = 'all',
  onNavigateToCustomer,
  orderCounts = null,
  onRefreshCounts,
}) => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTrackingPoolModalOpen, setIsTrackingPoolModalOpen] = useState(false);
  const [isManualWarrantyModalOpen, setIsManualWarrantyModalOpen] = useState(false);
  const [isEndorsementModalOpen, setIsEndorsementModalOpen] = useState(false);
  const [isRmaLogModalOpen, setIsRmaLogModalOpen] = useState(false);
  const [manualClaimInitialType, setManualClaimInitialType] = useState<'Warranty' | 'Redeem'>('Warranty');
  const [activeChannel, setActiveChannel] = useState<'web' | 'shopee' | 'tiktok'>('web');
  const [selectedShopeeOrder, setSelectedShopeeOrder] = useState<ShopeeOrder | null>(null);
  const [selectedTikTokOrder, setSelectedTikTokOrder] = useState<TikTokOrder | null>(null);

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
  const [totalOrders, setTotalOrders] = useState(0);
  const [maxPages, setMaxPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [courierFilter, setCourierFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Only the newest list request may update state (arrowing across tabs fires one load per tab)
  const latestRequestRef = useRef(0);

  const loadOrders = useCallback(async (
    quiet = false,
    page = currentPage,
    limit = pageSize,
    status = statusFilter,
    courier = courierFilter,
    search = searchQuery
  ) => {
    const requestId = ++latestRequestRef.current;
    const isStale = () => requestId !== latestRequestRef.current;
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      if (status === 'shipped') {
        syncActiveShipmentsDirect().catch(() => {});
      }

      const hasSearch = Boolean(search && search.trim());
      const res = await fetchOrdersDirect({
        page,
        per_page: limit,
        status: !hasSearch && status !== 'all' ? status : undefined,
        courier: !hasSearch && courier !== 'all' ? courier : undefined,
        search: hasSearch ? search.trim() : undefined,
      });
      if (isStale()) return;
      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders as Order[]);
        const fetchedTotal = typeof res.total_orders === 'number' && res.total_orders > 0 
          ? res.total_orders 
          : res.orders.length;
        setTotalOrders(fetchedTotal);

        const fetchedMax = typeof res.max_pages === 'number' && res.max_pages > 0
          ? res.max_pages
          : Math.max(1, Math.ceil(fetchedTotal / limit));
        setMaxPages(fetchedMax);
      } else {
        if (!quiet) {
          showToast('warning', 'Orders Sync Warning', res.error || 'Could not fetch orders from store.');
        }
      }
    } catch (err: any) {
      if (!quiet && !isStale()) {
        showToast('error', 'Orders Fetch Failed', err.message);
      }
    } finally {
      if (!isStale()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [currentPage, pageSize, statusFilter, courierFilter, searchQuery, showToast]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (maxPages > 0 && newPage > maxPages) || newPage === currentPage) return;
    setCurrentPage(newPage);
    loadOrders(false, newPage, pageSize, statusFilter, courierFilter, searchQuery);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    try {
      localStorage.setItem('exacoat_orders_per_page', String(newSize));
    } catch {
      // ignore
    }
    loadOrders(false, 1, newSize, statusFilter, courierFilter, searchQuery);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    setSearchQuery('');
    loadOrders(false, 1, pageSize, status, courierFilter, '');
  };

  const handleCourierFilterChange = (courier: string) => {
    setCourierFilter(courier);
    setCurrentPage(1);
    setSearchQuery('');
    loadOrders(false, 1, pageSize, statusFilter, courier, '');
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    loadOrders(false, 1, pageSize, statusFilter, courierFilter, query);
  };

  useEffect(() => {
    setStatusFilter(initialStatus);
    setCurrentPage(1);
    loadOrders(false, 1, pageSize, initialStatus, courierFilter, searchQuery);
  }, [initialStatus]);

  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('order', String(order.id));
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }

    try {
      const res = await fetchOrderDetailDirect(order.id);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
      }
    } catch (e) {
      console.warn('Could not fetch fresh order details', e);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('order') || url.searchParams.has('order_id')) {
        url.searchParams.delete('order');
        url.searchParams.delete('order_id');
        window.history.replaceState(null, '', url.toString());
      }
    } catch {
      // ignore
    }
  };

  // Auto-open order drawer if an order ID was passed via query params (?order=123) or hash (#orders?order=123)
  useEffect(() => {
    const parseOrderIdFromUrl = (): string | null => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const searchOrder = searchParams.get('order') || searchParams.get('order_id');
        if (searchOrder) return searchOrder;

        if (window.location.hash.includes('?')) {
          const hashQuery = window.location.hash.split('?')[1];
          const hashParams = new URLSearchParams(hashQuery);
          return hashParams.get('order') || hashParams.get('order_id');
        }
      } catch (err) {
        console.warn('Failed parsing order ID from URL:', err);
      }
      return null;
    };

    const targetOrderId = parseOrderIdFromUrl();
    if (!targetOrderId) return;

    let isMounted = true;
    fetchOrderDetailDirect(targetOrderId).then(res => {
      if (!isMounted) return;
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setIsDrawerOpen(true);
      }
    }).catch(err => {
      console.warn('Failed to auto-load order from URL', err);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Header Refresh, table refresh and every successful change reload the list and the store-wide counts
  const reloadAfterChange = (quiet = true) => {
    void onRefreshCounts?.();
    return loadOrders(quiet);
  };

  const countOrBlank = (value: number | undefined) =>
    typeof value === 'number' ? value : <span className="text-faint" aria-label="Count not available">-</span>;

  const createItems: MenuItem[] = [
    {
      icon: ShieldCheck,
      title: 'Warranty claim',
      description: 'Replace a faulty skin for a customer',
      onSelect: () => {
        setManualClaimInitialType('Warranty');
        setIsManualWarrantyModalOpen(true);
      },
    },
    {
      icon: RotateCcw,
      title: 'Redeem',
      description: 'Redeem a gift or voucher code',
      onSelect: () => {
        setManualClaimInitialType('Redeem');
        setIsManualWarrantyModalOpen(true);
      },
    },
    {
      icon: Megaphone,
      title: 'Endorsement',
      description: 'Free order for a creator or partner',
      onSelect: () => setIsEndorsementModalOpen(true),
    },
    'separator',
    {
      icon: Tag,
      title: 'Custom label',
      description: 'Print a shipping label without an order',
      onSelect: () => {
        window.location.hash = 'custom_label';
      },
    },
  ];

  const channels: { key: 'web' | 'shopee' | 'tiktok'; label: string; count?: number }[] = [
    { key: 'web', label: 'Exacoat webstore', count: orderCounts?.channels.webstore },
    { key: 'shopee', label: 'Shopee Indonesia', count: orderCounts?.channels.shopee },
    { key: 'tiktok', label: 'TikTok Shop', count: orderCounts?.channels.tiktok },
  ];

  const busy = isLoading || isRefreshing;

  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg">Orders</h1>
          <p className="mt-0.5 text-[14px] text-muted">Webstore, Shopee and TikTok orders, production and delivery.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <IconButton
            icon={RefreshCw}
            label="Refresh"
            onClick={() => {
              if (statusFilter === 'shipped') {
                syncActiveShipmentsDirect({ force: true }).catch(() => {});
              }
              reloadAfterChange(true);
            }}
            disabled={busy}
            className={busy ? '[&>svg]:animate-spin' : ''}
          />
          <Menu
            items={createItems}
            trigger={
              <Button variant="primary" icon={Plus} trailingIcon={ChevronDown}>
                Create
              </Button>
            }
          />
        </div>
      </div>

      {/* Sales channel switcher */}
      <div className="inline-flex w-fit items-center gap-1 rounded-[12px] border border-line bg-chip p-1" role="group" aria-label="Sales channel">
        {channels.map((c) => {
          const active = activeChannel === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveChannel(c.key)}
              className={`flex items-center gap-2 rounded-[9px] border px-3.5 py-[7px] text-[13px] font-[450] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active ? 'border-field-border bg-field text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              {c.label}
              {typeof c.count === 'number' && (
                <span className={`text-[12px] font-medium tabular-nums ${active ? 'text-accent-fg' : 'text-faint'}`}>{c.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {activeChannel === 'tiktok' ? (
        <TikTokOrdersView
          onClaimWarranty={(tiktokOrder) => {
            setSelectedTikTokOrder(tiktokOrder);
            setSelectedShopeeOrder(null);
            setManualClaimInitialType('Warranty');
            setIsManualWarrantyModalOpen(true);
          }}
          onClaimRedeem={(tiktokOrder) => {
            setSelectedTikTokOrder(tiktokOrder);
            setSelectedShopeeOrder(null);
            setManualClaimInitialType('Redeem');
            setIsManualWarrantyModalOpen(true);
          }}
        />
      ) : activeChannel === 'shopee' ? (
        <ShopeeOrdersView
          onClaimWarranty={(shopeeOrder) => {
            setSelectedShopeeOrder(shopeeOrder);
            setSelectedTikTokOrder(null);
            setManualClaimInitialType('Warranty');
            setIsManualWarrantyModalOpen(true);
          }}
          onClaimRedeem={(shopeeOrder) => {
            setSelectedShopeeOrder(shopeeOrder);
            setSelectedTikTokOrder(null);
            setManualClaimInitialType('Redeem');
            setIsManualWarrantyModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Store-wide KPIs (blank until the counts endpoint answers) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={Package} value={countOrBlank(orderCounts?.webstore.to_prepare)} label="To prepare" highlight />
            <KpiCard icon={Clock} value={countOrBlank(orderCounts?.webstore.awaiting_payment)} label="Awaiting payment" />
            <KpiCard icon={Store} value={countOrBlank(orderCounts?.webstore.ready_for_pickup)} label="Ready for pickup" />
            <KpiCard icon={Truck} value={countOrBlank(orderCounts?.shipped_last_7_days)} label="Shipped, last 7 days" />
          </div>
      {/* Orders Table */}
      <OrderTable
        orders={orders}
        isLoading={isLoading}
        onSelectOrder={handleSelectOrder}
        onRefresh={() => {
          void onRefreshCounts?.();
          loadOrders(false, currentPage, pageSize, statusFilter, courierFilter, searchQuery);
        }}
        counts={orderCounts}
        currentPage={currentPage}
        maxPages={maxPages}
        totalOrders={totalOrders}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        courierFilter={courierFilter}
        onCourierFilterChange={handleCourierFilterChange}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
      />
        </>
      )}

      {/* Order Detail & Fulfillment Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onOrderUpdated={() => reloadAfterChange(true)}
        onNavigateToCustomer={onNavigateToCustomer}
        onSelectOrderById={async (orderId: number) => {
          const found = orders.find(o => o.id === orderId);
          if (found) {
            handleSelectOrder(found);
          } else {
            const res = await fetchOrderDetailDirect(orderId);
            if (res.success && res.order) {
              handleSelectOrder(res.order);
            }
          }
        }}
      />

      {/* Logistics Bulk Export Modal (JNE & Goorita) */}
      <ExportShipmentsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExportSuccess={() => reloadAfterChange(true)}
      />

      {/* Internal Tracking Number Pool Modal */}
      <TrackingPoolModal
        isOpen={isTrackingPoolModalOpen}
        onClose={() => setIsTrackingPoolModalOpen(false)}
        onInventoryChanged={() => reloadAfterChange(true)}
      />

      {/* Centralized RMA Claims & Redeem Audit Log Modal */}
      <RmaClaimsLogModal
        isOpen={isRmaLogModalOpen}
        onClose={() => setIsRmaLogModalOpen(false)}
        onSelectOrder={async (orderId) => {
          setIsRmaLogModalOpen(false);
          const found = orders.find((o) => o.id === orderId);
          if (found) {
            handleSelectOrder(found);
          } else {
            const res = await fetchOrderDetailDirect(orderId);
            if (res.success && res.order) {
              handleSelectOrder(res.order);
            }
          }
        }}
        onOpenManualClaim={(initialType) => {
          setIsRmaLogModalOpen(false);
          setManualClaimInitialType(initialType || 'Warranty');
          setIsManualWarrantyModalOpen(true);
        }}
      />

      {/* Manual / Marketplace Warranty Claim Modal */}
      <ManualWarrantyModal
        isOpen={isManualWarrantyModalOpen}
        onClose={() => {
          setIsManualWarrantyModalOpen(false);
          setSelectedShopeeOrder(null);
          setSelectedTikTokOrder(null);
        }}
        initialShopeeOrder={selectedShopeeOrder}
        initialTikTokOrder={selectedTikTokOrder}
        initialClaimType={manualClaimInitialType}
        onSuccess={() => reloadAfterChange(true)}
      />

      {/* Influencer Endorsement / PR Order Modal */}
      <EndorsementOrderModal
        isOpen={isEndorsementModalOpen}
        onClose={() => setIsEndorsementModalOpen(false)}
        onSuccess={() => reloadAfterChange(true)}
      />
    </div>
  );
};
