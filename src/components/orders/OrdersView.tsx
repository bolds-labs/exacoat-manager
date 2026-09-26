import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Order } from '../../types';
import { OrderTable } from './OrderTable';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { ExportShipmentsModal } from './ExportShipmentsModal';
import { TrackingPoolModal } from './TrackingPoolModal';
import { ManualWarrantyModal } from './ManualWarrantyModal';
import { RmaClaimsLogModal } from './RmaClaimsLogModal';
import { ShopeeOrdersView } from './ShopeeOrdersView';
import { TikTokOrdersView } from './TikTokOrdersView';
import { fetchOrdersDirect, fetchOrderDetailDirect, ShopeeOrder, TikTokOrder } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { RefreshCw, FileSpreadsheet, Package, ShieldCheck, RotateCcw, Layers, HelpCircle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { PageHeroHeader } from '../ui/PageHeroHeader';
import { Tooltip } from '../ui/Tooltip';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

interface OrdersViewProps {
  initialStatus?: string;
  onNavigateToCustomer?: (customerId: number, customerEmail?: string, customerName?: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ 
  initialStatus = 'all',
  onNavigateToCustomer,
}) => {
  const { showToast } = useToast();
  const { user, simulatedRole } = useAuth();
  const effectiveRole = simulatedRole || user?.role;
  const isShopManager = effectiveRole === 'shop_manager';

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTrackingPoolModalOpen, setIsTrackingPoolModalOpen] = useState(false);
  const [isManualWarrantyModalOpen, setIsManualWarrantyModalOpen] = useState(false);
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

  const loadOrders = useCallback(async (
    quiet = false,
    page = currentPage,
    limit = pageSize,
    status = statusFilter,
    courier = courierFilter,
    search = searchQuery
  ) => {
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const hasSearch = Boolean(search && search.trim());
      const res = await fetchOrdersDirect({
        page,
        per_page: limit,
        status: !hasSearch && status !== 'all' ? status : undefined,
        courier: !hasSearch && courier !== 'all' ? courier : undefined,
        search: hasSearch ? search.trim() : undefined,
      });
      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders as Order[]);
        if (typeof res.total_orders === 'number') setTotalOrders(res.total_orders);
        if (typeof res.max_pages === 'number') setMaxPages(res.max_pages);
      } else {
        if (!quiet) {
          showToast('warning', 'Orders Sync Warning', res.error || 'Could not fetch orders from store.');
        }
      }
    } catch (err: any) {
      if (!quiet) {
        showToast('error', 'Orders Fetch Failed', err.message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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
      const res = await fetchOrderDetailDirect(order.id);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
      }
    } catch (e) {
      console.warn('Could not fetch fresh order details', e);
    }
  };

  // Multicurrency Metric Computations
  const currencyBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    orders.forEach(o => {
      const curr = (o.currency || 'USD').toUpperCase().trim();
      if (!map[curr]) {
        map[curr] = { total: 0, count: 0 };
      }
      map[curr].total += Number(o.total) || 0;
      map[curr].count += 1;
    });
    return map;
  }, [orders]);

  const currencyKeys = Object.keys(currencyBreakdown);
  const primaryCurrency = currencyKeys.includes('IDR') ? 'IDR' : (currencyKeys[0] || 'USD');
  const otherCurrencies = currencyKeys.filter(c => c !== primaryCurrency);

  const preparingCount = orders.filter(o => ['preparing-order', 'preparing_order', 'in-production', 'in_production'].includes(String(o.status).replace('wc-', ''))).length;
  const processingCount = orders.filter(o => String(o.status).replace('wc-', '') === 'processing').length;
  const waitingPickupCount = orders.filter(o => ['ready-to-ship', 'ready_to_ship', 'awaiting-pickup', 'awaiting_pickup', 'smb-ready'].includes(String(o.status).replace('wc-', ''))).length;
  const shippedCount = orders.filter(o => ['shipped', 'smb-picked'].includes(String(o.status).replace('wc-', ''))).length;
  const deliveredCount = orders.filter(o => ['completed', 'delivered'].includes(String(o.status).replace('wc-', ''))).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <PageHeroHeader
        title="Orders"
        subtitle="Orders, production, and delivery."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setManualClaimInitialType('Warranty');
                setIsManualWarrantyModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-semibold font-sans flex items-center gap-1.5 transition-all shrink-0 self-start sm:self-auto cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Warranty</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setManualClaimInitialType('Redeem');
                setIsManualWarrantyModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold font-sans flex items-center gap-1.5 transition-all shrink-0 self-start sm:self-auto cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Redeem</span>
            </button>
            <button
              type="button"
              onClick={() => loadOrders(true)}
              disabled={isLoading || isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', (isLoading || isRefreshing) && 'animate-spin text-[#f3aa18]')} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Sales Channel Tabs: WooCommerce Direct Web vs Shopee Indonesia */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-neutral-900/80 border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setActiveChannel('web')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
            activeChannel === 'web'
              ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/5'
          )}
        >
          <span>Exacoat Webstore</span>
          <span
            className={clsx(
              'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
              activeChannel === 'web'
                ? 'bg-black/20 text-neutral-950 font-bold'
                : 'bg-white/10 text-neutral-400'
            )}
          >
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveChannel('shopee')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
            activeChannel === 'shopee'
              ? 'bg-orange-500 text-white font-bold shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/5'
          )}
        >
          <span>Shopee Indonesia</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveChannel('tiktok')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
            activeChannel === 'tiktok'
              ? 'bg-rose-500 text-white font-bold shadow-sm'
              : 'text-neutral-400 hover:text-white hover:bg-white/5'
          )}
        >
          <span>TikTok Shop</span>
        </button>
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
          {/* Multicurrency Revenue & Status Metrics */}
          <div className={clsx(
            "grid gap-3 sm:gap-4",
            isShopManager ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
          )}>
        {/* Payment Confirmed */}
        <GlassCard className={clsx(
          "p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]",
          processingCount > 0 && "border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
        )}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
              Payment confirmed
            </p>
            <span className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 border",
              processingCount > 0
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
            )}>
              {processingCount > 0 ? 'To prepare' : 'Clear'}
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className={clsx(
              "text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums",
              processingCount > 0 ? "text-amber-400 font-medium" : "text-white"
            )}>
              {processingCount}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              Payment confirmed
            </p>
          </div>
        </GlassCard>

        {/* Preparing Order */}
        <GlassCard className={clsx(
          "p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]",
          preparingCount > 0 && "border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.08)]"
        )}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
              Preparing order
            </p>
            <span className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 border",
              preparingCount > 0
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
            )}>
              Active
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className={clsx(
              "text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums",
              preparingCount > 0 ? "text-cyan-400 font-medium" : "text-white"
            )}>
              {preparingCount}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              {waitingPickupCount} waiting for pickup
            </p>
          </div>
        </GlassCard>

        {/* Shipped & Dispatched */}
        <GlassCard className="p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
              Shipped
            </p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
              On the way
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-sky-400 font-mono tabular-nums">
              {shippedCount}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              {deliveredCount} completed
            </p>
          </div>
        </GlassCard>

        {/* Gross Revenue - Only visible to administrators, hidden for shop manager */}
        {!isShopManager && (
          <GlassCard className="p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px] col-span-2 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
                Total Sales
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20 shrink-0">
                Revenue
              </span>
            </div>
            <div className="my-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f3aa18] font-mono tabular-nums">
                  {formatCurrency(currencyBreakdown[primaryCurrency]?.total || 0, primaryCurrency)}
                </h3>
                {otherCurrencies.length > 0 && (
                  <Tooltip
                    position="top"
                    content={
                      <div className="space-y-1.5 p-1 font-mono text-left max-w-xs">
                        <p className="font-sans font-bold text-[11px] text-zinc-300 border-b border-white/10 pb-1">
                          Other Currencies
                        </p>
                        {otherCurrencies.map((curr) => (
                          <div key={curr} className="flex items-center justify-between gap-3 text-[10px] text-zinc-200">
                            <span className="font-semibold text-zinc-400">{curr}:</span>
                            <span>{formatCurrency(currencyBreakdown[curr].total, curr)} ({currencyBreakdown[curr].count} orders)</span>
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <button
                      type="button"
                      className="p-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition-colors cursor-pointer border border-white/[0.08]"
                      title="View currency breakdown"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400/80" />
                    </button>
                  </Tooltip>
                )}
              </div>
              <div className="flex flex-col gap-0.5 pt-0.5">
                <span className="text-[10px] text-zinc-400 font-mono">
                  {orders.length} total orders placed
                </span>
              </div>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Orders Table */}
      <OrderTable
        orders={orders}
        isLoading={isLoading}
        onSelectOrder={handleSelectOrder}
        onRefresh={() => loadOrders(false, currentPage, pageSize, statusFilter, courierFilter, searchQuery)}
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
        onClose={() => setIsDrawerOpen(false)}
        onOrderUpdated={() => loadOrders(true)}
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
        onExportSuccess={() => loadOrders(true)}
      />

      {/* Internal Tracking Number Pool Modal */}
      <TrackingPoolModal
        isOpen={isTrackingPoolModalOpen}
        onClose={() => setIsTrackingPoolModalOpen(false)}
        onInventoryChanged={() => loadOrders(true)}
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
        onSuccess={() => loadOrders(true)}
      />
    </div>
  );
};
