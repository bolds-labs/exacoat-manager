import React, { useState, useMemo } from 'react';
import {
  DailyFinancialPoint,
  FinancialChannel,
  FinancialGranularity,
  aggregateTimelineByGranularity,
} from '../../lib/financialAnalyticsService';
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
} from 'recharts';
import { TrendingUp, Layers, BarChart2 } from 'lucide-react';
import { clsx } from 'clsx';

interface MultiChannelRevenueChartProps {
  timeline: DailyFinancialPoint[];
  selectedChannels: FinancialChannel[];
  totalRevenue: number;
  totalCleanRevenue?: number;
  totalPlatformFees?: number;
  totalBuyerPaid?: number;
}

export const MultiChannelRevenueChart: React.FC<MultiChannelRevenueChartProps> = ({
  timeline,
  selectedChannels,
  totalRevenue,
  totalCleanRevenue,
  totalPlatformFees,
  totalBuyerPaid,
}) => {
  const [chartMode, setChartMode] = useState<'channels' | 'stacked' | 'clean'>('channels');
  const [granularity, setGranularity] = useState<FinancialGranularity>('daily');

  const hasWebstore = selectedChannels.includes('webstore');
  const hasShopee = selectedChannels.includes('shopee');
  const hasTikTok = selectedChannels.includes('tiktok');

  const chartPoints = useMemo(() => {
    return aggregateTimelineByGranularity(timeline, granularity);
  }, [timeline, granularity]);

  const formatYAxis = (val: number) => {
    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)}k`;
    return `Rp ${val}`;
  };

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div>
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-white/[0.06] pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#f3aa18]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Revenue Horizon & Platform Inflow
              </h3>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Continuous {granularity} gross sales vs clean withdrawable payouts (hover for fee deductions and escrow payout)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
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
                title="View every calendar day (including days with zero transactions)"
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
              {timeline.length >= 25 && (
                <button
                  type="button"
                  onClick={() => setGranularity('monthly')}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                    granularity === 'monthly'
                      ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  )}
                  title="Group into monthly totals"
                >
                  Monthly
                </button>
              )}
            </div>

            <div className="p-1 rounded-xl bg-[#090a0d] border border-white/[0.08] flex items-center gap-1 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setChartMode('channels')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold flex items-center gap-1.5',
                  chartMode === 'channels'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
                title="Individual channel gross sales curves"
              >
                <TrendingUp className="w-3 h-3" />
                <span>By Channel</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('stacked')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold flex items-center gap-1.5',
                  chartMode === 'stacked'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
                title="Cumulative stacked area breakdown"
              >
                <Layers className="w-3 h-3" />
                <span>Stacked</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('clean')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold flex items-center gap-1.5',
                  chartMode === 'clean'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
                title="Compare Gross Sales vs Clean Withdrawable Revenue"
              >
                <BarChart2 className="w-3 h-3" />
                <span>Gross vs Clean</span>
              </button>
            </div>

            <div className="text-right pl-2 border-l border-white/[0.08] hidden sm:block">
              <span className="text-[10px] font-mono text-neutral-400 uppercase block">Gross Sales</span>
              <span className="text-sm font-bold font-mono text-white block">
                {formatCurrency(totalRevenue, 'IDR')}
              </span>
              {typeof totalCleanRevenue === 'number' && (
                <span className="text-[10px] font-mono text-emerald-400 block font-semibold">
                  Clean: {formatCurrency(totalCleanRevenue, 'IDR')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="w-full h-72 sm:h-80">
          {chartPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartPoints}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="webstoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f3aa18" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f3aa18" stopOpacity={0.0} />
                  </linearGradient>

                  <linearGradient id="shopeeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ee4d2d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ee4d2d" stopOpacity={0.0} />
                  </linearGradient>

                  <linearGradient id="tiktokGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>

                  <linearGradient id="totalGrossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f3aa18" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f3aa18" stopOpacity={0.0} />
                  </linearGradient>

                  <linearGradient id="totalCleanGrad" x1="0" y1="0" x2="0" y2="1">
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
                  interval="preserveStartEnd"
                  minTickGap={28}
                />

                <YAxis
                  domain={[0, 'auto']}
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
                      const dayPlatformFees = data.totalPlatformFees || 0;
                      return (
                        <div className="p-3.5 rounded-xl bg-zinc-950/95 border border-white/10 shadow-2xl backdrop-blur-md text-xs font-sans min-w-[250px]">
                          <div className="text-[11px] font-mono font-bold text-white border-b border-white/10 pb-1.5 mb-2 flex items-center justify-between gap-4">
                            <span>{data.fullLabel || data.date}</span>
                            <span className="text-neutral-400 font-normal">
                              {data.orders} {data.orders === 1 ? 'paid order' : 'paid orders'}
                            </span>
                          </div>

                          <div className="space-y-1.5 font-mono text-[11px]">
                            {hasWebstore && (
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between gap-3 text-neutral-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#f3aa18]" />
                                    <span>Webstore Gross:</span>
                                  </span>
                                  <span className="font-bold text-white tabular-nums">
                                    {formatCurrency(data.webstore, 'IDR')}
                                  </span>
                                </div>
                                {data.webstoreClean > 0 && (
                                  <div className="flex items-center justify-between gap-3 text-[10px] text-emerald-400/90 pl-3.5">
                                    <span>Clean Payout:</span>
                                    <span className="tabular-nums">{formatCurrency(data.webstoreClean, 'IDR')}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {hasShopee && (
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between gap-3 text-neutral-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#ee4d2d]" />
                                    <span>Shopee Gross:</span>
                                  </span>
                                  <span className="font-bold text-white tabular-nums">
                                    {formatCurrency(data.shopee, 'IDR')}
                                  </span>
                                </div>
                                {data.shopeeClean > 0 && (
                                  <div className="flex items-center justify-between gap-3 text-[10px] text-emerald-400/90 pl-3.5">
                                    <span>Clean Payout:</span>
                                    <span className="tabular-nums">{formatCurrency(data.shopeeClean, 'IDR')}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {hasTikTok && (
                              <div className="space-y-0.5">
                                <div className="flex items-center justify-between gap-3 text-neutral-300">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#06b6d4]" />
                                    <span>TikTok Gross:</span>
                                  </span>
                                  <span className="font-bold text-white tabular-nums">
                                    {formatCurrency(data.tiktok, 'IDR')}
                                  </span>
                                </div>
                                {data.tiktokClean > 0 && (
                                  <div className="flex items-center justify-between gap-3 text-[10px] text-emerald-400/90 pl-3.5">
                                    <span>Clean Payout:</span>
                                    <span className="tabular-nums">{formatCurrency(data.tiktokClean, 'IDR')}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="pt-2 border-t border-white/10 space-y-1">
                              <div className="flex items-center justify-between text-xs font-bold text-white">
                                <span>Total Gross Sales:</span>
                                <span className="tabular-nums">
                                  {formatCurrency(data.total, 'IDR')}
                                </span>
                              </div>

                              {dayPlatformFees > 0 && (
                                <div className="flex items-center justify-between text-[10px] text-rose-400">
                                  <span>Platform Fees Deducted:</span>
                                  <span className="tabular-nums">-{formatCurrency(dayPlatformFees, 'IDR')}</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-xs font-black text-emerald-400">
                                <span>Clean Withdrawable Revenue:</span>
                                <span className="tabular-nums">{formatCurrency(data.totalClean, 'IDR')}</span>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-white/[0.04]">
                                <span>Buyer Paid Total:</span>
                                <span className="tabular-nums">{formatCurrency(data.totalBuyerPaid, 'IDR')}</span>
                              </div>

                              {data.totalVoucherSubsidy > 0 && (
                                <div className="flex items-center justify-between text-[10px] text-amber-400/90">
                                  <span>Buyer Voucher Subsidies:</span>
                                  <span className="tabular-nums">-{formatCurrency(data.totalVoucherSubsidy, 'IDR')}</span>
                                </div>
                              )}

                              {data.cancelledOrders > 0 && (
                                <div className="flex items-center justify-between text-[10px] text-rose-400/90 pt-1 border-t border-white/[0.06]">
                                  <span>Cancelled (Excl.):</span>
                                  <span className="tabular-nums">
                                    {data.cancelledOrders} ({formatCurrency(data.cancelledGross, 'IDR')})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                {chartMode === 'channels' && (
                  <>
                    {hasWebstore && (
                      <Area
                        type="monotone"
                        dataKey="webstore"
                        name="Webstore"
                        stroke="#f3aa18"
                        strokeWidth={2}
                        fill="url(#webstoreGrad)"
                        fillOpacity={0.15}
                      />
                    )}
                    {hasShopee && (
                      <Area
                        type="monotone"
                        dataKey="shopee"
                        name="Shopee"
                        stroke="#ee4d2d"
                        strokeWidth={2}
                        fill="url(#shopeeGrad)"
                        fillOpacity={0.15}
                      />
                    )}
                    {hasTikTok && (
                      <Area
                        type="monotone"
                        dataKey="tiktok"
                        name="TikTok"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="url(#tiktokGrad)"
                        fillOpacity={0.15}
                      />
                    )}
                  </>
                )}

                {chartMode === 'stacked' && (
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
                )}

                {chartMode === 'clean' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Gross Sales"
                      stroke="#f3aa18"
                      strokeWidth={2.2}
                      fill="url(#totalGrossGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="totalClean"
                      name="Clean Withdrawable"
                      stroke="#10b981"
                      strokeWidth={2.2}
                      fill="url(#totalCleanGrad)"
                    />
                  </>
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

      <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-neutral-400">
        <div className="flex items-center gap-4 flex-wrap">
          {chartMode !== 'clean' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f3aa18]" />
                <span className="text-neutral-300">Gross Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                <span className="text-neutral-300 font-bold">Clean Withdrawable (Payout)</span>
              </div>
            </>
          )}
        </div>

        <span className="text-[10px] text-neutral-500">
          Showing {chartPoints.length} {granularity === 'daily' ? 'calendar days' : granularity === 'weekly' ? 'calendar weeks' : 'calendar months'} in horizon (0-transaction days included)
        </span>
      </div>
    </GlassCard>
  );
};
