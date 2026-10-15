import React, { useState, useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { SkinPerformanceTimelinePoint } from '../../lib/skinPerformanceService';
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
import { TrendingUp, Layers, DollarSign } from 'lucide-react';
import { clsx } from 'clsx';

interface SkinVolumeTrendChartProps {
  timeline: SkinPerformanceTimelinePoint[];
  dateHorizonLabel: string;
}

export const SkinVolumeTrendChart: React.FC<SkinVolumeTrendChartProps> = ({
  timeline,
  dateHorizonLabel,
}) => {
  const [metricMode, setMetricMode] = useState<'units' | 'revenue'>('units');
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily');

  // Aggregate daily points into weekly if requested
  const chartPoints = useMemo(() => {
    if (granularity === 'daily' || timeline.length <= 14) {
      return timeline;
    }

    const weeklyPoints: SkinPerformanceTimelinePoint[] = [];
    const chunkSize = 7;
    for (let i = 0; i < timeline.length; i += chunkSize) {
      const chunk = timeline.slice(i, i + chunkSize);
      const startPoint = chunk[0];
      const endPoint = chunk[chunk.length - 1];

      let totUnits = 0;
      let totRev = 0;
      const combinedTopSkins: Record<string, number> = {};

      chunk.forEach((p) => {
        totUnits += p.totalUnits;
        totRev += p.totalRevenue;
        Object.entries(p.topSkins || {}).forEach(([name, count]) => {
          combinedTopSkins[name] = (combinedTopSkins[name] || 0) + count;
        });
      });

      weeklyPoints.push({
        date: startPoint.date,
        label: `${startPoint.label} - ${endPoint.label}`,
        fullLabel: `${startPoint.fullLabel} to ${endPoint.fullLabel}`,
        totalUnits: totUnits,
        totalRevenue: totRev,
        topSkins: combinedTopSkins,
      });
    }

    return weeklyPoints;
  }, [timeline, granularity]);

  const totalUnits = useMemo(
    () => timeline.reduce((s, p) => s + p.totalUnits, 0),
    [timeline]
  );
  const totalRev = useMemo(
    () => timeline.reduce((s, p) => s + p.totalRevenue, 0),
    [timeline]
  );

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div>
        {/* Header with Title and Mode Switchers */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.06] pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#f3aa18]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Skin Purchase Velocity & Trend
              </h3>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Continuous {granularity} base skin purchases across {dateHorizonLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Units vs Revenue Switcher */}
            <div className="p-1 rounded-xl bg-[#090a0d] border border-white/[0.08] flex items-center gap-1 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => setMetricMode('units')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold flex items-center gap-1',
                  metricMode === 'units'
                    ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <Layers className="w-3 h-3" />
                <span>Units</span>
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('revenue')}
                className={clsx(
                  'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold flex items-center gap-1',
                  metricMode === 'revenue'
                    ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                <DollarSign className="w-3 h-3" />
                <span>Revenue</span>
              </button>
            </div>

            {/* Granularity Switcher (if sufficient days) */}
            {timeline.length >= 14 && (
              <div className="p-1 rounded-xl bg-[#090a0d] border border-white/[0.08] flex items-center gap-1 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setGranularity('daily')}
                  className={clsx(
                    'px-2 py-1 rounded-lg transition-all cursor-pointer',
                    granularity === 'daily'
                      ? 'bg-white/10 text-white font-bold'
                      : 'text-neutral-400 hover:text-white'
                  )}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setGranularity('weekly')}
                  className={clsx(
                    'px-2 py-1 rounded-lg transition-all cursor-pointer',
                    granularity === 'weekly'
                      ? 'bg-white/10 text-white font-bold'
                      : 'text-neutral-400 hover:text-white'
                  )}
                >
                  Weekly
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chart Container */}
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartPoints}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient id="skinGoldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f3aa18" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f3aa18" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={8}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#71717a"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) =>
                  metricMode === 'units'
                    ? `${val}`
                    : val >= 1000000
                    ? `${(val / 1000000).toFixed(1)}M`
                    : val >= 1000
                    ? `${(val / 1000).toFixed(0)}k`
                    : `${val}`
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload as SkinPerformanceTimelinePoint;
                  const topList = Object.entries(data.topSkins || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4);

                  return (
                    <div className="rounded-xl border border-white/10 bg-[#0d0e12]/95 backdrop-blur-md p-3 shadow-2xl text-xs font-sans min-w-[200px]">
                      <p className="font-bold text-white mb-1.5 border-b border-white/[0.08] pb-1">
                        {data.fullLabel || data.label}
                      </p>
                      <div className="flex items-center justify-between text-neutral-300 py-0.5">
                        <span>Units Sold:</span>
                        <span className="font-mono font-bold text-[#f3aa18]">
                          {data.totalUnits} units
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-neutral-300 py-0.5">
                        <span>Gross Revenue:</span>
                        <span className="font-mono font-bold text-white">
                          {formatCurrency(data.totalRevenue, 'IDR')}
                        </span>
                      </div>

                      {topList.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/[0.08]">
                          <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold mb-1">
                            Finishes Ordered:
                          </p>
                          {topList.map(([name, count]) => (
                            <div
                              key={name}
                              className="flex items-center justify-between text-[11px] text-neutral-400 py-0.5"
                            >
                              <span className="truncate pr-2">{name}</span>
                              <span className="font-mono text-white shrink-0">
                                {count}x
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey={metricMode === 'units' ? 'totalUnits' : 'totalRevenue'}
                stroke="#f3aa18"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#skinGoldGrad)"
                dot={chartPoints.length <= 14 ? { fill: '#f3aa18', r: 3 } : false}
                activeDot={{ r: 5, fill: '#f3aa18', stroke: '#080808', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Summary Metric */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400">
        <span className="font-mono">
          Horizon Total: <strong className="text-white">{totalUnits.toLocaleString('id-ID')} units</strong>
        </span>
        <span className="font-mono text-[#f3aa18] font-bold">
          {formatCurrency(totalRev, 'IDR')}
        </span>
      </div>
    </GlassCard>
  );
};
