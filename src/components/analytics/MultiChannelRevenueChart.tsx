import React, { useState } from 'react';
import { DailyFinancialPoint, FinancialChannel } from '../../lib/financialAnalyticsService';
import { GlassCard } from '../ui/GlassCard';
import { formatCurrency } from '../../lib/formatters';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, Layers, BarChart2 } from 'lucide-react';
import { clsx } from 'clsx';

interface MultiChannelRevenueChartProps {
  timeline: DailyFinancialPoint[];
  selectedChannels: FinancialChannel[];
  totalRevenue: number;
}

export const MultiChannelRevenueChart: React.FC<MultiChannelRevenueChartProps> = ({
  timeline,
  selectedChannels,
  totalRevenue,
}) => {
  const [chartMode, setChartMode] = useState<'stacked' | 'total'>('stacked');

  const hasWebstore = selectedChannels.includes('webstore');
  const hasShopee = selectedChannels.includes('shopee');
  const hasTikTok = selectedChannels.includes('tiktok');

  // Format compact currency for YAxis
  const formatYAxis = (val: number) => {
    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)}k`;
    return `Rp ${val}`;
  };

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div>
        {/* Header and Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.06] pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#f3aa18]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Revenue Horizon & Channel Inflow
              </h3>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Daily incoming net revenue across selected sales channels
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* View Mode Switcher */}
            <div className="p-1 rounded-xl bg-[#090a0d] border border-white/[0.08] flex items-center gap-1 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setChartMode('stacked')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold flex items-center gap-1.5',
                  chartMode === 'stacked'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <Layers className="w-3 h-3" />
                <span>By Channel</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('total')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold flex items-center gap-1.5',
                  chartMode === 'total'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <BarChart2 className="w-3 h-3" />
                <span>Total Net</span>
              </button>
            </div>

            <div className="text-right pl-2 border-l border-white/[0.08] hidden md:block">
              <span className="text-[10px] font-mono text-neutral-400 uppercase block">Selected Horizon</span>
              <span className="text-sm font-bold font-mono text-[#f3aa18]">
                {formatCurrency(totalRevenue, 'IDR')}
              </span>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div className="w-full h-72 sm:h-80">
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timeline}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  {/* Webstore Gradient (Amber) */}
                  <linearGradient id="webstoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f3aa18" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f3aa18" stopOpacity={0.0} />
                  </linearGradient>

                  {/* Shopee Gradient (Orange) */}
                  <linearGradient id="shopeeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ee4d2d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ee4d2d" stopOpacity={0.0} />
                  </linearGradient>

                  {/* TikTok Gradient (Cyan) */}
                  <linearGradient id="tiktokGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>

                  {/* Total Inflow Gradient */}
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
                  tickFormatter={formatYAxis}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                  width={68}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as DailyFinancialPoint;
                      return (
                        <div className="p-3 rounded-xl bg-zinc-950/95 border border-white/10 shadow-2xl backdrop-blur-md text-xs font-sans min-w-[200px]">
                          <div className="text-[11px] font-mono font-bold text-white border-b border-white/10 pb-1.5 mb-2 flex items-center justify-between">
                            <span>{data.date}</span>
                            <span className="text-neutral-400 font-normal">
                              {data.orders} {data.orders === 1 ? 'order' : 'orders'}
                            </span>
                          </div>

                          <div className="space-y-1.5 font-mono text-[11px]">
                            {hasWebstore && (
                              <div className="flex items-center justify-between gap-3 text-neutral-300">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-[#f3aa18]" />
                                  <span>Webstore:</span>
                                </span>
                                <span className="font-bold text-white tabular-nums">
                                  {formatCurrency(data.webstore, 'IDR')}
                                </span>
                              </div>
                            )}

                            {hasShopee && (
                              <div className="flex items-center justify-between gap-3 text-neutral-300">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-[#ee4d2d]" />
                                  <span>Shopee:</span>
                                </span>
                                <span className="font-bold text-white tabular-nums">
                                  {formatCurrency(data.shopee, 'IDR')}
                                </span>
                              </div>
                            )}

                            {hasTikTok && (
                              <div className="flex items-center justify-between gap-3 text-neutral-300">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-[#06b6d4]" />
                                  <span>TikTok:</span>
                                </span>
                                <span className="font-bold text-white tabular-nums">
                                  {formatCurrency(data.tiktok, 'IDR')}
                                </span>
                              </div>
                            )}

                            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#10b981]">
                              <span>Total Day Net:</span>
                              <span className="tabular-nums">
                                {formatCurrency(data.total, 'IDR')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {chartMode === 'stacked' ? (
                  <>
                    {hasWebstore && (
                      <Area
                        type="monotone"
                        dataKey="webstore"
                        name="Webstore"
                        stackId="1"
                        stroke="#f3aa18"
                        strokeWidth={1.8}
                        fill="url(#webstoreGrad)"
                      />
                    )}
                    {hasShopee && (
                      <Area
                        type="monotone"
                        dataKey="shopee"
                        name="Shopee"
                        stackId="1"
                        stroke="#ee4d2d"
                        strokeWidth={1.8}
                        fill="url(#shopeeGrad)"
                      />
                    )}
                    {hasTikTok && (
                      <Area
                        type="monotone"
                        dataKey="tiktok"
                        name="TikTok"
                        stackId="1"
                        stroke="#06b6d4"
                        strokeWidth={1.8}
                        fill="url(#tiktokGrad)"
                      />
                    )}
                  </>
                ) : (
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Combined Total"
                    stroke="#10b981"
                    strokeWidth={2.2}
                    fill="url(#totalGrad)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center text-neutral-500 font-mono text-xs">
              <span>No timeline points found for current date horizon and channels.</span>
            </div>
          )}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-neutral-400">
        <div className="flex items-center gap-4 flex-wrap">
          {hasWebstore && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f3aa18]" />
              <span className="text-neutral-300">Webstore</span>
            </div>
          )}
          {hasShopee && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ee4d2d]" />
              <span className="text-neutral-300">Shopee</span>
            </div>
          )}
          {hasTikTok && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#06b6d4]" />
              <span className="text-neutral-300">TikTok Shop</span>
            </div>
          )}
        </div>

        <span className="text-[10px] text-neutral-500">
          Showing {timeline.length} ledger days in window
        </span>
      </div>
    </GlassCard>
  );
};
