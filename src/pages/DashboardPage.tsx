import React, { useState, useMemo } from 'react';
import { Order } from '../types';
import { SalesMetricsOverview } from '../components/dashboard/SalesMetricsOverview';
import { SalesRevenueChart } from '../components/dashboard/SalesRevenueChart';
import { OrderStatusDistribution } from '../components/dashboard/OrderStatusDistribution';
import { RecentOrdersLedger } from '../components/dashboard/RecentOrdersLedger';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { 
  RefreshCw, 
  ShoppingBag, 
  Star, 
  Mail, 
  Activity, 
  ArrowRight,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import { clsx } from 'clsx';

export type DashboardDatePreset = 'today' | '7d' | '30d' | 'this_month' | 'all';

interface DashboardPageProps {
  orders: Order[];
  onNavigate: (tab: any, filter?: string) => void;
  onSelectOrder: (order: Order) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  orders,
  onNavigate,
  onSelectOrder,
  onRefresh = () => {},
  isLoading = false,
}) => {
  const [datePreset, setDatePreset] = useState<DashboardDatePreset>('30d');

  // Filter orders according to date horizon
  const filteredOrders = useMemo(() => {
    if (datePreset === 'all') return orders;

    const now = new Date();
    let startMs = 0;

    if (datePreset === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startMs = today.getTime();
    } else if (datePreset === '7d') {
      startMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    } else if (datePreset === '30d') {
      startMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    } else if (datePreset === 'this_month') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startMs = firstOfMonth.getTime();
    }

    return orders.filter(o => {
      if (!o.created_at) return true;
      const t = new Date(o.created_at).getTime();
      return isNaN(t) || t >= startMs;
    });
  }, [orders, datePreset]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Horizon Switcher */}
      <PageHeroHeader
        title="Operations Dashboard"
        subtitle="Live sales metrics, order fulfillment queues, and platform health."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Horizon Pills */}
            <div className="p-1 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center gap-1 font-mono text-xs">
              {(['today', '7d', '30d', 'this_month', 'all'] as DashboardDatePreset[]).map(preset => {
                const labels: Record<DashboardDatePreset, string> = {
                  today: 'Today',
                  '7d': '7D',
                  '30d': '30D',
                  this_month: 'Month',
                  all: 'All',
                };
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDatePreset(preset)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                      datePreset === preset
                        ? 'bg-[#f3aa18] text-[#080808] shadow-xs'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    {labels[preset]}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="px-3.5 py-2 rounded-xl bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30 text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Open Multi-Channel Money & Revenue Reports"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Financial Reports</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="Refresh store metrics"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-[#f3aa18]')} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* 1. Core Sales KPI Cards */}
      <SalesMetricsOverview
        orders={filteredOrders}
        onNavigateToOrders={(filter) => onNavigate('orders', filter)}
      />

      {/* 2. Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2">
          <SalesRevenueChart orders={filteredOrders} />
        </div>
        <div className="lg:col-span-1">
          <OrderStatusDistribution 
            orders={filteredOrders}
            onSelectStatus={(st) => onNavigate('orders', st)}
          />
        </div>
      </div>

      {/* 3. Recent Orders Activity Table */}
      <RecentOrdersLedger
        orders={orders}
        onSelectOrder={onSelectOrder}
        onViewAll={() => onNavigate('orders')}
      />

      {/* 4. Quick Operational Modules Launcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
        <GlassCard 
          onClick={() => onNavigate('orders')}
          className="p-4 hover:border-white/20 transition-all cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-[#f3aa18] transition-colors">Orders Queue</h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">Filter, fulfill & pack</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </GlassCard>

        <GlassCard 
          onClick={() => onNavigate('reviews')}
          className="p-4 hover:border-white/20 transition-all cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-[#f3aa18] transition-colors">Reviews & Ratings</h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">Customer feedback</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </GlassCard>

        <GlassCard 
          onClick={() => onNavigate('emails')}
          className="p-4 hover:border-white/20 transition-all cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-[#f3aa18] transition-colors">Transactional Emails</h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">Live template preview</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </GlassCard>

        <GlassCard 
          onClick={() => onNavigate('health')}
          className="p-4 hover:border-white/20 transition-all cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white group-hover:text-[#f3aa18] transition-colors">Store Health</h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">API & ping diagnostics</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </GlassCard>
      </div>
    </div>
  );
};
