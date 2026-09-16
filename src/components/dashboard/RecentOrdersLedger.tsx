import React from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Order } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { ShoppingBag, Eye, ArrowRight, Truck, Clock, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

interface RecentOrdersLedgerProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onViewAll: () => void;
}

export const RecentOrdersLedger: React.FC<RecentOrdersLedgerProps> = ({
  orders,
  onSelectOrder,
  onViewAll,
}) => {
  const recentOrders = orders.slice(0, 8);

  const getStatusBadge = (status: string) => {
    const clean = String(status || '').replace('wc-', '').toLowerCase();
    if (clean === 'processing') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
          Processing
        </span>
      );
    }
    if (clean === 'ready-to-ship' || clean === 'awaiting-pickup') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f3aa18]/15 text-[#f3aa18] border border-[#f3aa18]/25">
          Ready to Ship
        </span>
      );
    }
    if (clean === 'shipped') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/25">
          Shipped
        </span>
      );
    }
    if (clean === 'completed' || clean === 'delivered') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
          Delivered
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/[0.06] text-neutral-400 border border-white/10">
        {clean}
      </span>
    );
  };

  return (
    <GlassCard className="p-5 font-sans">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-[#f3aa18]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Recent Orders Activity
          </h3>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-[#f3aa18] hover:text-[#f5b838] font-semibold flex items-center gap-1 transition-colors cursor-pointer group"
        >
          <span>View All Orders</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-neutral-500">
              <th className="pb-2.5 font-bold">Order Ref</th>
              <th className="pb-2.5 font-bold">Customer</th>
              <th className="pb-2.5 font-bold">Items</th>
              <th className="pb-2.5 font-bold">Status</th>
              <th className="pb-2.5 font-bold text-right">Total</th>
              <th className="pb-2.5 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {recentOrders.map(order => {
              const cleanNum = String(order.order_number || order.id).replace(/^#+/, '');
              const firstItem = order.items?.[0];
              const otherCount = (order.items?.length || 1) - 1;

              return (
                <tr 
                  key={order.id} 
                  className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  onClick={() => onSelectOrder(order)}
                >
                  <td className="py-3 font-mono font-bold text-white whitespace-nowrap">
                    #{cleanNum}
                    <span className="block text-[10px] text-neutral-500 font-normal">
                      {formatDate(order.created_at)}
                    </span>
                  </td>

                  <td className="py-3 min-w-[140px]">
                    <p className="font-bold text-neutral-200 truncate">
                      {order.customer_name || 'Customer'}
                    </p>
                    <p className="text-[10px] text-neutral-500 truncate font-mono">
                      {order.shipping?.city || order.billing?.city || ''}{' '}
                      {order.shipping?.country ? `(${order.shipping.country})` : ''}
                    </p>
                  </td>

                  <td className="py-3 min-w-[180px]">
                    <p className="text-neutral-300 truncate font-medium">
                      {firstItem ? `${firstItem.quantity}x ${firstItem.name}` : 'Product Skin'}
                    </p>
                    {otherCount > 0 && (
                      <span className="text-[10px] text-neutral-500 italic">
                        +{otherCount} more item{otherCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>

                  <td className="py-3 whitespace-nowrap">
                    {getStatusBadge(order.status)}
                  </td>

                  <td className="py-3 text-right font-mono font-bold text-white whitespace-nowrap">
                    {formatCurrency(order.total, order.currency)}
                  </td>

                  <td className="py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder(order);
                      }}
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#f3aa18]/10 text-neutral-400 hover:text-[#f3aa18] border border-white/[0.06] hover:border-[#f3aa18]/30 transition-all cursor-pointer"
                      title="Inspect Order Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {recentOrders.length === 0 && (
          <div className="py-8 text-center text-neutral-500 text-xs font-mono">
            No recent orders to display
          </div>
        )}
      </div>
    </GlassCard>
  );
};
