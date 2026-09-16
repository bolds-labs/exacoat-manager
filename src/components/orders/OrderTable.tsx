import React, { useState, useMemo } from 'react';
import { Order } from '../../types';
import { Badge } from '../ui/Badge';
import { GlassCard } from '../ui/GlassCard';
import { formatCurrency, formatDateTime } from '../../lib/formatters';
import { 
  Search, 
  RefreshCw, 
  Eye, 
  Package, 
  Truck, 
  Calendar,
  Layers
} from 'lucide-react';
import { clsx } from 'clsx';

export interface OrderTableProps {
  orders: Order[];
  isLoading: boolean;
  onSelectOrder: (order: Order) => void;
  onRefresh?: () => void;
  onPrintA6?: (order: Order) => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  isLoading,
  onSelectOrder,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      if (statusFilter !== 'all') {
        const cleanStatus = String(order.status || '').replace('wc-', '').toLowerCase();
        if (cleanStatus !== statusFilter) return false;
      }

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = String(order.order_number || order.id || '').toLowerCase();
        const custName = String(order.customer_name || '').toLowerCase();
        const custEmail = String(order.customer_email || '').toLowerCase();
        const trackNum = String(order.tracking?.tracking_number || '').toLowerCase();
        const itemNames = (order.items || []).map(i => i.name.toLowerCase()).join(' ');

        return (
          num.includes(q) ||
          custName.includes(q) ||
          custEmail.includes(q) ||
          trackNum.includes(q) ||
          itemNames.includes(q)
        );
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Control Bar: Search & Status Filters */}
      <GlassCard className="p-3 sm:p-4 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111]">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar">
            {[
              { key: 'all', label: 'All Orders' },
              { key: 'processing', label: 'Processing' },
              { key: 'in-production', label: 'In Production' },
              { key: 'shipped', label: 'Shipped' },
              { key: 'completed', label: 'Delivered' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={clsx(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border',
                  statusFilter === tab.key
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-zinc-900 dark:border-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-transparent'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input and Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search orders, customers, skins..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:border-[#f3aa18]"
              />
            </div>

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-[#141414] hover:bg-zinc-200 dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-white/[0.08] transition-colors disabled:opacity-50 cursor-pointer"
                title="Refresh Orders"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin text-[#f3aa18]')} />
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Orders Table Container */}
      <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans select-none">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0d0d0d]/80 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Order</th>
                <th className="py-3.5 px-4">Customer & Destination</th>
                <th className="py-3.5 px-4">Precision Skins & Items</th>
                <th className="py-3.5 px-4 text-right">Total</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Courier & Tracking</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-zinc-500 font-sans">
                    <Package className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">
                      {isLoading ? 'Fetching live orders...' : 'No orders match these criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const rawTrackingNum = String(order.tracking?.tracking_number || '').trim();
                  const hasValidTracking = rawTrackingNum.length > 0 && !rawTrackingNum.startsWith('field_');

                  return (
                    <tr
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      {/* Order Number & Date */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-zinc-900 dark:text-white block">
                          {order.order_number || `#${order.id}`}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                          {formatDateTime(order.created_at)}
                        </span>
                      </td>

                      {/* Customer & Destination */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-zinc-900 dark:text-white block">
                          {order.customer_name || 'Customer'}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block truncate max-w-[180px]">
                          {order.shipping?.city ? `${order.shipping.city}, ` : ''}{order.shipping?.country || 'Indonesia'}
                        </span>
                      </td>

                      {/* Items & Skin Config */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {(order.items || []).slice(0, 3).map((it, idx) => (
                            <div
                              key={it.id || idx}
                              className="w-8 h-10 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] overflow-hidden shrink-0 relative"
                              title={`${it.name} (${it.quantity}x)`}
                            >
                              {it.image_url ? (
                                <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-zinc-400 dark:text-zinc-600 m-auto mt-3" />
                              )}
                              {it.quantity > 1 && (
                                <span className="absolute bottom-0.5 right-0.5 text-[8px] font-mono bg-black/80 text-white px-0.5 rounded">
                                  {it.quantity}
                                </span>
                              )}
                            </div>
                          ))}
                          {(order.items || []).length > 3 && (
                            <span className="text-[10px] font-mono text-zinc-500">
                              +{(order.items || []).length - 3}
                            </span>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 block truncate max-w-[200px]">
                              {order.items?.[0]?.name || 'Precision Device Skin'}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {order.item_count || order.items?.length || 1} item(s)
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-zinc-900 dark:text-white text-xs block">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <Badge type="orderStatus" value={order.status} size="xs" />
                      </td>

                      {/* Tracking */}
                      <td className="py-3.5 px-4">
                        {hasValidTracking ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              <Truck className="w-3 h-3" />
                              {rawTrackingNum}
                            </span>
                            <span className="text-[10px] text-zinc-500 block truncate max-w-[120px]">
                              {order.tracking?.courier || order.shipping_method_name || 'Courier'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">
                            {order.shipping_method_name || 'Standard'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onSelectOrder(order)}
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                          title="Inspect Order Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
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
            filteredOrders.map(order => (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="p-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                      {order.order_number || `#${order.id}`}
                    </span>
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
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
};
