import React, { useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Order } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Layers } from 'lucide-react';
import { clsx } from 'clsx';

interface OrderStatusDistributionProps {
  orders: Order[];
  onSelectStatus?: (status: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dotClass: string }> = {
  'processing': { label: 'Processing', color: '#f59e0b', dotClass: 'bg-amber-400' },
  'in-production': { label: 'In Production', color: '#06b6d4', dotClass: 'bg-cyan-400' },
  'ready-to-ship': { label: 'Ready to Ship', color: '#f3aa18', dotClass: 'bg-[#f3aa18]' },
  'awaiting-pickup': { label: 'Ready to Ship', color: '#f3aa18', dotClass: 'bg-[#f3aa18]' },
  'shipped': { label: 'Shipped', color: '#38bdf8', dotClass: 'bg-sky-400' },
  'completed': { label: 'Delivered', color: '#10b981', dotClass: 'bg-emerald-400' },
  'delivered': { label: 'Delivered', color: '#10b981', dotClass: 'bg-emerald-400' },
  'cancelled': { label: 'Cancelled', color: '#f43f5e', dotClass: 'bg-rose-400' },
  'refunded': { label: 'Refunded', color: '#a855f7', dotClass: 'bg-purple-400' },
};

export const OrderStatusDistribution: React.FC<OrderStatusDistributionProps> = ({
  orders,
  onSelectStatus,
}) => {
  const data = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      const st = String(o.status || 'processing').replace('wc-', '').toLowerCase();
      counts[st] = (counts[st] || 0) + 1;
    });

    return Object.entries(counts).map(([key, value]) => {
      const conf = STATUS_CONFIG[key] || { label: key, color: '#71717a', dotClass: 'bg-neutral-500' };
      return {
        key,
        name: conf.label,
        value,
        color: conf.color,
        dotClass: conf.dotClass,
      };
    }).sort((a, b) => b.value - a.value);
  }, [orders]);

  const total = orders.length;

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#f3aa18]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Order Status Mix
          </h3>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">
          {total} Total
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
        {/* Donut Chart */}
        <div className="w-36 h-36 relative shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={36}
                outerRadius={56}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                      <div className="p-2 rounded-lg bg-zinc-950 border border-white/10 text-xs font-mono shadow-lg">
                        <span className="text-white font-bold">{item.name}</span>: {item.value} ({pct}%)
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-black font-mono text-white leading-none">{total}</span>
            <span className="text-[9px] font-mono text-neutral-500 uppercase mt-0.5">Orders</span>
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 w-full space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {data.map(item => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div 
                key={item.key}
                onClick={() => onSelectStatus?.(item.key)}
                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={clsx("w-2 h-2 rounded-full shrink-0", item.dotClass)} />
                  <span className="text-neutral-300 truncate font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                  <span className="font-bold text-white">{item.value}</span>
                  <span className="text-neutral-500 text-[10px]">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
};
