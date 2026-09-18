import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Order } from '../../types';
import { OrderTable } from './OrderTable';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { ExportShipmentsModal } from './ExportShipmentsModal';
import { TrackingPoolModal } from './TrackingPoolModal';
import { ManualWarrantyModal } from './ManualWarrantyModal';
import { RmaClaimsLogModal } from './RmaClaimsLogModal';
import { ShopeeOrdersView } from './ShopeeOrdersView';
import { fetchOrdersDirect, fetchOrderDetailDirect, ShopeeOrder } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { RefreshCw, FileSpreadsheet, Package, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { PageHeroHeader } from '../ui/PageHeroHeader';
import { clsx } from 'clsx';

interface OrdersViewProps {}

export const OrdersView: React.FC<OrdersViewProps> = () => {
  const { showToast } = useToast();
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
  const [activeChannel, setActiveChannel] = useState<'web' | 'shopee'>('web');
  const [selectedShopeeOrder, setSelectedShopeeOrder] = useState<ShopeeOrder | null>(null);

  const loadOrders = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const res = await fetchOrdersDirect({ per_page: 50 });
      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders as Order[]);
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
  }, [showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

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
              onClick={() => setIsRmaLogModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-white/10 text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>RMA Claims Log</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setManualClaimInitialType('Warranty');
                setIsManualWarrantyModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Warranty</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setManualClaimInitialType('Redeem');
                setIsManualWarrantyModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>+ Redeem</span>
            </button>
            <button
              type="button"
              onClick={() => setIsTrackingPoolModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-amber-400" />
              <span>Tracking Pool</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Shipments</span>
            </button>
            <button
              type="button"
              onClick={() => loadOrders(true)}
              disabled={isLoading || isRefreshing}
              className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto disabled:opacity-50 cursor-pointer"
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
          <span>Exacoat Direct Web</span>
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
          <span
            className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full font-semibold',
              activeChannel === 'shopee'
                ? 'bg-black/25 text-white'
                : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
            )}
          >
            Open API v2
          </span>
        </button>
      </div>

      {activeChannel === 'shopee' ? (
        <ShopeeOrdersView
          onClaimWarranty={(shopeeOrder) => {
            setSelectedShopeeOrder(shopeeOrder);
            setManualClaimInitialType('Warranty');
            setIsManualWarrantyModalOpen(true);
          }}
          onClaimRedeem={(shopeeOrder) => {
            setSelectedShopeeOrder(shopeeOrder);
            setManualClaimInitialType('Redeem');
            setIsManualWarrantyModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Multicurrency Revenue & Status Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

        {/* Gross Revenue */}
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
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f3aa18] font-mono tabular-nums">
              {formatCurrency(currencyBreakdown[primaryCurrency]?.total || 0, primaryCurrency)}
            </h3>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <span className="text-[10px] text-zinc-400 font-mono">
                {orders.length} total orders placed
              </span>
              {otherCurrencies.map(curr => (
                <span key={curr} className="text-[9px] text-zinc-500 font-mono">
                  + {formatCurrency(currencyBreakdown[curr].total, curr)} ({currencyBreakdown[curr].count} orders)
                </span>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Orders Table */}
      <OrderTable
        orders={orders}
        isLoading={isLoading}
        onSelectOrder={handleSelectOrder}
        onRefresh={() => loadOrders(false)}
      />
        </>
      )}

      {/* Order Detail & Fulfillment Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOrderUpdated={() => loadOrders(true)}
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
        }}
        initialShopeeOrder={selectedShopeeOrder}
        initialClaimType={manualClaimInitialType}
        onSuccess={() => loadOrders(true)}
      />
    </div>
  );
};
