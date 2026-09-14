import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Order } from '../../types';
import { OrderTable } from './OrderTable';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { ShippingLabelA6Modal } from './ShippingLabelA6Modal';
import { PageHeroHeader } from '../ui/PageHeroHeader';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { fetchOrdersDirect, fetchOrderDetailDirect } from '../../lib/wordpressBridge';
import { formatCurrency } from '../../lib/formatters';
import { useToast } from '../../context/ToastContext';
import { 
  ShoppingBag, 
  Clock, 
  Truck, 
  CheckCircle2, 
  Layers, 
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

interface OrdersViewProps {
  searchFilter?: string;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ searchFilter = '' }) => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState(searchFilter);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [labelOrder, setLabelOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const res = await fetchOrdersDirect({ 
        status: activeTab === 'all' ? undefined : activeTab,
        search: localSearch || undefined,
        per_page: 50 
      });

      if (res.success) {
        setOrders(res.orders);
      } else {
        if (!quiet) {
          showToast('warning', 'Orders Fetch Warning', res.error || 'Could not fetch orders.');
        }
      }
    } catch (err: any) {
      if (!quiet) {
        showToast('error', 'Orders Fetch Error', err.message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, localSearch, showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);
    // Fetch fresh detail in background
    try {
      const res = await fetchOrderDetailDirect(order.id);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
      }
    } catch (e) {
      console.warn('Could not refresh order details', e);
    }
  };

  const handleOrderUpdated = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    if (selectedOrder?.id === updated.id) {
      setSelectedOrder(updated);
    }
  };

  // KPIs
  const processingCount = orders.filter((o) => o.status.replace('wc-', '') === 'processing').length;
  const readyToShipCount = orders.filter((o) => ['ready-to-ship', 'ready_to_ship'].includes(o.status.replace('wc-', ''))).length;
  const completedCount = orders.filter((o) => ['completed', 'delivered'].includes(o.status.replace('wc-', ''))).length;

  const currencyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const curr = (o.currency || 'IDR').toUpperCase();
      map[curr] = (map[curr] || 0) + (parseFloat(o.total) || 0);
    });
    return map;
  }, [orders]);

  const primaryCurr = Object.keys(currencyTotals)[0] || 'IDR';

  return (
    <div className="space-y-6">
      <PageHeroHeader
        title="Orders & Fulfillment Pipeline"
        subtitle="Manage live orders, custom skin layer specs, and Biteship/JNE tracking resi"
        icon={<ShoppingBag className="w-5 h-5" />}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadOrders(true)}
            isLoading={isRefreshing}
            className="gap-2 text-xs"
          >
            <RefreshCw className={isRefreshing ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
            <span>Refresh</span>
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Processing</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-chakra">{processingCount}</div>
          <p className="text-[11px] text-zinc-500">Awaiting skin cutting & packing</p>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Ready to Ship</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-chakra">{readyToShipCount}</div>
          <p className="text-[11px] text-zinc-500">Packed and courier label printed</p>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-chakra">{completedCount}</div>
          <p className="text-[11px] text-zinc-500">Fulfilled customer orders</p>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Revenue</span>
            <Layers className="w-4 h-4 text-[#f3aa18]" />
          </div>
          <div className="text-2xl font-bold text-[#f3aa18] font-chakra">
            {formatCurrency(currencyTotals[primaryCurr] || 0, primaryCurr)}
          </div>
          <p className="text-[11px] text-zinc-500">
            {Object.keys(currencyTotals).length > 1
              ? Object.entries(currencyTotals)
                  .filter(([c]) => c !== primaryCurr)
                  .map(([c, v]) => formatCurrency(v, c))
                  .join(' | ')
              : 'Direct from store API'}
          </p>
        </GlassCard>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-[#0d0d11] border border-white/[0.08] rounded-xl self-start">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'processing', label: 'Processing' },
            { id: 'ready-to-ship', label: 'Ready to Ship' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] ' + (
                activeTab === tab.id
                  ? 'bg-[#f3aa18] text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search order #, customer, resi..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full bg-[#0d0d11] border border-white/[0.08] text-xs text-zinc-200 placeholder-zinc-500 pl-9 pr-3 py-2 rounded-xl focus:border-[#f3aa18] min-h-[44px]"
          />
        </div>
      </div>

      {/* Orders Table */}
      <OrderTable
        orders={orders}
        isLoading={isLoading}
        onSelectOrder={handleSelectOrder}
        onPrintA6={(ord) => setLabelOrder(ord)}
      />

      {/* Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* A6 Print Modal */}
      {labelOrder && (
        <ShippingLabelA6Modal
          order={labelOrder}
          isOpen={!!labelOrder}
          onClose={() => setLabelOrder(null)}
        />
      )}
    </div>
  );
};
