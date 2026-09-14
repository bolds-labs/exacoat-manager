import React, { useState, useEffect } from 'react';
import { PageHeroHeader } from '../ui/PageHeroHeader';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { fetchOrdersDirect } from '../../lib/wordpressBridge';
import { formatCurrency, formatDate, getStatusBadgeStyle } from '../../lib/formatters';
import { Order } from '../../types';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Truck, 
  Clock, 
  Layers, 
  ArrowRight,
  TrendingUp,
  Package
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToOrders: () => void;
  onNavigateToConfigurator: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToOrders,
  onNavigateToConfigurator,
}) => {
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetchOrdersDirect({ per_page: 8 });
        if (res.success) {
          setRecentOrders(res.orders);
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const processingOrders = recentOrders.filter(
    (o) => o.status.replace('wc-', '') === 'processing'
  );

  return (
    <div className="space-y-6">
      <PageHeroHeader
        title="Exacoat ERP Operations Hub"
        subtitle="Real-time order pipeline, device skin production, and shipping tracking"
        icon={<LayoutDashboard className="w-5 h-5" />}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={onNavigateToOrders}
            className="gap-2 text-xs font-bold"
          >
            <span>Fulfillment Pipeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        }
      />

      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#f3aa18]/15 via-[#f3aa18]/5 to-transparent border border-[#f3aa18]/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#f3aa18]">
              Live Storefront Connected
            </span>
          </div>
          <h2 className="text-xl font-bold text-white font-chakra">
            Precision Skin Manufacturing Operations
          </h2>
          <p className="text-xs text-zinc-400 max-w-xl">
            Managing WooCommerce v3 Store API line items with full stacked skin configuration choices, A6 thermal label printing, and courier AWB injection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" onClick={onNavigateToConfigurator}>
            <span>Catalog & Skins</span>
          </Button>
          <Button variant="primary" size="md" onClick={onNavigateToOrders}>
            <span>View Orders</span>
          </Button>
        </div>
      </div>

      {/* Recent Orders Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-chakra flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#f3aa18]" />
            <span>Latest Incoming Orders</span>
          </h3>
          <button
            onClick={onNavigateToOrders}
            className="text-xs text-[#f3aa18] hover:underline font-medium min-h-[44px] flex items-center"
          >
            View all orders &rarr;
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-[#f3aa18] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400">Loading incoming orders...</p>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center bg-[#0d0d11] rounded-2xl border border-white/[0.08] text-xs text-zinc-400">
            No recent orders available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentOrders.map((o) => {
              const status = getStatusBadgeStyle(o.status);
              const customer = o.shipping || o.billing;
              const name = (customer.first_name + ' ' + customer.last_name).trim() || 'Valued Customer';

              return (
                <GlassCard
                  key={o.id}
                  hoverEffect
                  className="p-4 space-y-2.5 cursor-pointer"
                  onClick={onNavigateToOrders}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-sm">#{o.number}</span>
                    <span className={'px-2 py-0.5 rounded-full text-[10px] font-semibold border ' + status.bg + ' ' + status.text + ' ' + status.border}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="font-semibold">{name}</span>
                    <span className="font-bold text-[#f3aa18]">{formatCurrency(o.total, o.currency)}</span>
                  </div>

                  <div className="text-[11px] text-zinc-400 truncate">
                    {o.line_items.map((i) => i.quantity + 'x ' + i.name).join(', ')}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
