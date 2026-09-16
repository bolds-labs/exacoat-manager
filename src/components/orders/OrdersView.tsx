import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Order } from '../../types';
import { OrderTable } from './OrderTable';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { fetchOrdersDirect, fetchOrderDetailDirect } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { RefreshCw } from 'lucide-react';
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

  const inProductionCount = orders.filter(o => ['in-production', 'in_production'].includes(String(o.status).replace('wc-', ''))).length;
  const processingCount = orders.filter(o => String(o.status).replace('wc-', '') === 'processing').length;
  const shippedCount = orders.filter(o => String(o.status).replace('wc-', '') === 'shipped').length;
  const deliveredCount = orders.filter(o => ['completed', 'delivered'].includes(String(o.status).replace('wc-', ''))).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <PageHeroHeader
        title="Orders"
        subtitle="Orders, production, and delivery."
        actions={
          <button
            onClick={() => loadOrders(true)}
            disabled={isLoading || isRefreshing}
            className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', (isLoading || isRefreshing) && 'animate-spin text-[#f3aa18]')} />
            Refresh
          </button>
        }
      />

      {/* Metric KPI Cards Header (Obsidian Glass Design System) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
        {/* Total Orders */}
        <GlassCard className="p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
              All Orders
            </p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/[0.04] text-zinc-400 border border-white/[0.06] shrink-0">
              All
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
              {orders.length}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              Store orders placed
            </p>
          </div>
        </GlassCard>

        {/* Processing Queue */}
        <GlassCard className={clsx(
          "p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]",
          processingCount > 0 && "border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
        )}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
              Confirmed
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
              Ready for production
            </p>
          </div>
        </GlassCard>

        {/* In Production */}
        <GlassCard className={clsx(
          "p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]",
          inProductionCount > 0 && "border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.08)]"
        )}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
              In Production
            </p>
            <span className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 border",
              inProductionCount > 0
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
            )}>
              Active
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className={clsx(
              "text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums",
              inProductionCount > 0 ? "text-cyan-400 font-medium" : "text-white"
            )}>
              {inProductionCount}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              Being prepared
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
              {deliveredCount} delivered
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

      {/* Order Detail & Fulfillment Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOrderUpdated={() => loadOrders(true)}
      />
    </div>
  );
};
