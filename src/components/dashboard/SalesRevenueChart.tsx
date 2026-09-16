import React, { useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Order } from '../../types';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';

interface SalesRevenueChartProps {
  orders: Order[];
}

export const SalesRevenueChart: React.FC<SalesRevenueChartProps> = ({ orders }) => {
  // Aggregate daily revenue and order volume
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; label: string; revenue: number; orders: number }> = {};

    orders.forEach(order => {
      const d = order.created_at ? new Date(order.created_at) : new Date();
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

      if (!map[key]) {
        map[key] = { date: key, label, revenue: 0, orders: 0 };
      }
      map[key].revenue += Number(order.total) || 0;
      map[key].orders += 1;
    });

    const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-14); // Last 14 active days
  }, [orders]);

  const currency = orders[0]?.currency || 'USD';
  const totalRevenue = chartData.reduce((acc, d) => acc + d.revenue, 0);

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#f3aa18]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Revenue & Order Volume
            </h3>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Daily performance from current orders window
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-neutral-500 uppercase block">Window Total</span>
          <span className="text-sm font-bold font-mono text-[#f3aa18]">
            {formatCurrency(totalRevenue, currency)}
          </span>
        </div>
      </div>

      <div className="w-full h-64 sm:h-72">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f3aa18" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f3aa18" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="label" 
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-2.5 rounded-xl bg-zinc-950/95 border border-white/10 shadow-xl backdrop-blur-md text-xs font-sans">
                        <p className="text-neutral-400 text-[10px] font-mono mb-1">{data.date}</p>
                        <p className="text-[#f3aa18] font-bold font-mono text-sm">
                          {formatCurrency(data.revenue, currency)}
                        </p>
                        <p className="text-white text-[11px] mt-0.5">
                          {data.orders} Order{data.orders !== 1 ? 's' : ''}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#f3aa18" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#revenueGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 text-xs font-mono">
            No revenue recorded in this horizon
          </div>
        )}
      </div>
    </GlassCard>
  );
};
