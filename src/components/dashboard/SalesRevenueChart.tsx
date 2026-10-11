import React, { useMemo, useState } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Order } from '../../types';
import { 
  formatCurrency, 
  convertToIdr, 
  isRevenueOrder,
  getStoreDateKey,
  formatStoreDateFull,
  generateContinuousDays,
  parseStoreDate,
  getStoreDayStartMs,
  getStoreDayEndMs
} from '../../lib/formatters';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { DashboardDatePreset } from '../../pages/DashboardPage';

interface SalesRevenueChartProps {
  orders: Order[];
  datePreset?: DashboardDatePreset;
}

export const SalesRevenueChart: React.FC<SalesRevenueChartProps> = ({ 
  orders,
  datePreset = '30d' 
}) => {
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily');

  // Compute continuous date points covering every calendar day in the horizon strictly in store timezone
  const { chartData, totalRevenue, totalBuyerPaid, totalDays } = useMemo(() => {
    const todayKey = getStoreDateKey(Date.now());
    const todayStartMs = getStoreDayStartMs(todayKey);
    const todayEndMs = getStoreDayEndMs(todayKey);

    let startMs: number;
    const endMs = todayEndMs;

    if (datePreset === 'today') {
      startMs = todayStartMs;
    } else if (datePreset === '7d') {
      startMs = todayStartMs - 6 * 24 * 60 * 60 * 1000;
    } else if (datePreset === '30d') {
      startMs = todayStartMs - 29 * 24 * 60 * 60 * 1000;
    } else if (datePreset === 'this_month') {
      const [currY, currM] = todayKey.split('-').map(Number);
      startMs = getStoreDayStartMs(`${currY}-${String(currM).padStart(2, '0')}-01`);
    } else if (datePreset === 'all') {
      // Find earliest order date in available orders, fallback to 30 days
      let earliest = todayStartMs - 29 * 24 * 60 * 60 * 1000;
      orders.forEach(o => {
        if (!o.created_at) return;
        const d = parseStoreDate(o.created_at) || new Date(o.created_at);
        if (d && !isNaN(d.getTime()) && d.getTime() < earliest) {
          earliest = d.getTime();
        }
      });
      startMs = getStoreDayStartMs(earliest);
    } else {
      startMs = todayStartMs - 29 * 24 * 60 * 60 * 1000;
    }

    // Generate continuous days in store timezone so zero transaction days are NEVER skipped
    const continuousDays = generateContinuousDays(startMs, endMs);
    const map: Record<string, { date: string; label: string; fullLabel: string; revenue: number; buyerPaid: number; orders: number }> = {};

    continuousDays.forEach(d => {
      map[d.key] = {
        date: d.key,
        label: d.label,
        fullLabel: formatStoreDateFull(d.timestamp),
        revenue: 0,
        buyerPaid: 0,
        orders: 0,
      };
    });

    // Ingest confirmed paid orders into corresponding day key
    orders.forEach(order => {
      if (!isRevenueOrder(order)) return;

      const key = getStoreDateKey(order.created_at);
      if (!key) return;

      const buyerPaidIdr = Number((order as any).total_idr) || convertToIdr(order.total, order.currency);
      const rawSubtotal = Number((order as any).subtotal) > 0
        ? convertToIdr((order as any).subtotal, order.currency)
        : 0;
      const itemsGross = (order.items || []).reduce((s, it) => {
        const lineSub = Number((it as any).subtotal || it.total || 0);
        return s + (lineSub > 0 ? convertToIdr(lineSub, order.currency) : 0);
      }, 0);
      const grossRevenue = Math.max(rawSubtotal, itemsGross, buyerPaidIdr);

      if (map[key]) {
        map[key].revenue += grossRevenue;
        map[key].buyerPaid += buyerPaidIdr;
        map[key].orders += 1;
      }
    });

    const dailyPoints = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    const calculatedTotalRevenue = dailyPoints.reduce((acc, d) => acc + d.revenue, 0);
    const calculatedTotalBuyerPaid = dailyPoints.reduce((acc, d) => acc + d.buyerPaid, 0);

    // If weekly granularity is chosen and date span is sufficiently long, aggregate points by week
    if (granularity === 'weekly' && continuousDays.length > 7) {
      const weeklyMap: Record<string, { date: string; label: string; fullLabel: string; revenue: number; buyerPaid: number; orders: number }> = {};

      dailyPoints.forEach(point => {
        const [yearStr, monthStr, dayStr] = point.date.split('-');
        const d = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 12, 0, 0));

        const dayOfWeek = d.getUTCDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setUTCDate(d.getUTCDate() + diffToMonday);

        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);

        const monYear = monday.getUTCFullYear();
        const monMonth = String(monday.getUTCMonth() + 1).padStart(2, '0');
        const monDay = String(monday.getUTCDate()).padStart(2, '0');
        const weekKey = `${monYear}-${monMonth}-${monDay}`;

        const monLabel = monday.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
        const sunLabel = sunday.toLocaleDateString('en-US', {
          timeZone: 'UTC',
          month: monday.getUTCMonth() === sunday.getUTCMonth() ? undefined : 'short',
          day: 'numeric',
        });
        const weekRangeLabel = `${monLabel} - ${sunLabel}`;

        if (!weeklyMap[weekKey]) {
          weeklyMap[weekKey] = {
            date: weekKey,
            label: monLabel,
            fullLabel: weekRangeLabel,
            revenue: 0,
            buyerPaid: 0,
            orders: 0,
          };
        }

        weeklyMap[weekKey].revenue += point.revenue;
        weeklyMap[weekKey].buyerPaid += point.buyerPaid;
        weeklyMap[weekKey].orders += point.orders;
      });

      const weeklyPoints = Object.values(weeklyMap).sort((a, b) => a.date.localeCompare(b.date));
      return {
        chartData: weeklyPoints,
        totalRevenue: calculatedTotalRevenue,
        totalBuyerPaid: calculatedTotalBuyerPaid,
        totalDays: continuousDays.length,
      };
    }

    return {
      chartData: dailyPoints,
      totalRevenue: calculatedTotalRevenue,
      totalBuyerPaid: calculatedTotalBuyerPaid,
      totalDays: continuousDays.length,
    };
  }, [orders, datePreset, granularity]);

  const currency = 'IDR';

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.06] pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#f3aa18]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Gross Sales & Order Volume
            </h3>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Continuous {granularity} timeline from orders window (no transaction days shown as Rp 0)
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Granularity switch: Daily vs Weekly when span allows */}
          {totalDays > 7 && (
            <div className="p-1 rounded-xl bg-[#090a0d] border border-white/[0.08] flex items-center gap-1 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setGranularity('daily')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                  granularity === 'daily'
                    ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
                title="View every calendar day"
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setGranularity('weekly')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                  granularity === 'weekly'
                    ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
                title="Group into weekly totals"
              >
                Weekly
              </button>
            </div>
          )}

          <div className="text-right pl-2 sm:border-l sm:border-white/[0.08]">
            <span className="text-[10px] font-mono text-neutral-500 uppercase block">Window Gross</span>
            <span className="text-sm font-bold font-mono text-[#f3aa18] block">
              {formatCurrency(totalRevenue, currency)}
            </span>
            <span className="text-[10px] font-mono text-neutral-400 block">
              Paid: {formatCurrency(totalBuyerPaid, currency)}
            </span>
          </div>
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
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis 
                domain={[0, 'auto']}
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                tickFormatter={(v) => {
                  if (v >= 1000000) return `Rp ${(v / 1000000).toFixed(1)}M`;
                  if (v >= 1000) return `Rp ${(v / 1000).toFixed(0)}k`;
                  return `Rp ${v}`;
                }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-2.5 rounded-xl bg-zinc-950/95 border border-white/10 shadow-xl backdrop-blur-md text-xs font-sans min-w-[180px]">
                        <p className="text-neutral-400 text-[10px] font-mono mb-1">{data.fullLabel || data.date}</p>
                        <p className="text-[#f3aa18] font-bold font-mono text-sm">
                          {formatCurrency(data.revenue, currency)}
                        </p>
                        <p className="text-neutral-400 text-[10px] font-mono mt-0.5">
                          Paid: {formatCurrency(data.buyerPaid, currency)}
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
