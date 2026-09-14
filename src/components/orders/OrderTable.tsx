import React from 'react';
import { Order } from '../../types';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatDate, getStatusBadgeStyle, stripEmDashes } from '../../lib/formatters';
import { Eye, Printer, Truck, Package, Layers } from 'lucide-react';

interface OrderTableProps {
  orders: Order[];
  isLoading: boolean;
  onSelectOrder: (order: Order) => void;
  onPrintA6: (order: Order) => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  isLoading,
  onSelectOrder,
  onPrintA6,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#f3aa18] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-zinc-400">Fetching live orders from WooCommerce...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-12 text-center space-y-3 bg-[#0d0d11] rounded-2xl border border-white/[0.08]">
        <Package className="w-10 h-10 text-zinc-600 mx-auto" />
        <h3 className="text-base font-bold text-white font-chakra">No Orders Found</h3>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          No orders match the current search filter or status selection.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0d0d11]">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.02] text-zinc-400 uppercase tracking-wider font-semibold">
            <th className="p-4">Order</th>
            <th className="p-4">Customer</th>
            <th className="p-4">Items & Skin Config</th>
            <th className="p-4">Shipping / Courier</th>
            <th className="p-4">Total</th>
            <th className="p-4">Status</th>
            <th className="p-4">Tracking</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {orders.map((order) => {
            const statusStyle = getStatusBadgeStyle(order.status);
            const customer = order.shipping || order.billing;
            const customerName = stripEmDashes((customer.first_name + ' ' + customer.last_name).trim() || 'Customer');
            const courierName = order.shipping_lines?.[0]?.method_title || 'Standard';

            // Check if any line item has custom configurator layers
            const hasConfigurator = order.line_items.some(
              (i) => i.parsed_configurator && i.parsed_configurator.length > 0
            );

            return (
              <tr
                key={order.id}
                className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => onSelectOrder(order)}
              >
                {/* Order # & Date */}
                <td className="p-4 font-mono font-bold text-white">
                  <div>#{order.number}</div>
                  <div className="text-[11px] text-zinc-500 font-sans font-normal mt-0.5">
                    {formatDate(order.date_created)}
                  </div>
                </td>

                {/* Customer */}
                <td className="p-4">
                  <div className="font-semibold text-zinc-200">{customerName}</div>
                  <div className="text-zinc-500 text-[11px] truncate max-w-[140px]">
                    {customer.email || 'No email'}
                  </div>
                </td>

                {/* Items & Configurator summary */}
                <td className="p-4">
                  <div className="font-medium text-zinc-300">
                    {order.line_items.length} item{order.line_items.length > 1 ? 's' : ''}
                  </div>
                  {hasConfigurator ? (
                    <div className="inline-flex items-center gap-1 mt-1 text-[10px] text-[#f3aa18] bg-[#f3aa18]/10 px-2 py-0.5 rounded-full border border-[#f3aa18]/25 font-semibold">
                      <Layers className="w-3 h-3" />
                      <span>Custom Skin</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-zinc-500">Standard SKU</span>
                  )}
                </td>

                {/* Courier & Destination */}
                <td className="p-4">
                  <div className="text-zinc-300 font-medium truncate max-w-[150px]">
                    {courierName}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate max-w-[150px]">
                    {order.shipping_district || customer.city || customer.country}
                  </div>
                </td>

                {/* Total */}
                <td className="p-4 font-bold text-[#f3aa18]">
                  {formatCurrency(order.total, order.currency)}
                </td>

                {/* Status */}
                <td className="p-4">
                  <span
                    className={
                      'inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold border ' +
                      statusStyle.bg +
                      ' ' +
                      statusStyle.text +
                      ' ' +
                      statusStyle.border
                    }
                  >
                    {statusStyle.label}
                  </span>
                </td>

                {/* Tracking */}
                <td className="p-4">
                  {order.tracking_number ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <Truck className="w-3 h-3" />
                      <span>{order.tracking_number}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-600">Pending</span>
                  )}
                </td>

                {/* Actions */}
                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onSelectOrder(order)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Inspect Order"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onPrintA6(order)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-[#f3aa18] hover:bg-[#f3aa18]/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Print A6 Label"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
