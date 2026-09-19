import React from 'react';
import { FinancialChannel, ChannelMetrics } from '../../lib/financialAnalyticsService';
import { GlassCard } from '../ui/GlassCard';
import { formatCurrency } from '../../lib/formatters';
import { Globe, ShoppingBag, Store, TrendingUp, Layers } from 'lucide-react';
import { clsx } from 'clsx';

interface ChannelRevenueBreakdownCardProps {
  breakdown: Record<FinancialChannel, ChannelMetrics>;
  totalNetRevenue: number;
  selectedChannels: FinancialChannel[];
  onSelectChannelOnly?: (channel: FinancialChannel) => void;
}

export const ChannelRevenueBreakdownCard: React.FC<ChannelRevenueBreakdownCardProps> = ({
  breakdown,
  totalNetRevenue,
  selectedChannels,
  onSelectChannelOnly,
}) => {
  const channels: Array<{
    id: FinancialChannel;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    barColor: string;
    borderColor: string;
    bgTint: string;
  }> = [
    {
      id: 'webstore',
      name: 'Webstore (Direct)',
      icon: Globe,
      accentColor: 'text-[#f3aa18]',
      barColor: 'bg-[#f3aa18]',
      borderColor: 'border-[#f3aa18]/30',
      bgTint: 'bg-[#f3aa18]/[0.03]',
    },
    {
      id: 'shopee',
      name: 'Shopee Official',
      icon: ShoppingBag,
      accentColor: 'text-[#ee4d2d]',
      barColor: 'bg-[#ee4d2d]',
      borderColor: 'border-[#ee4d2d]/30',
      bgTint: 'bg-[#ee4d2d]/[0.03]',
    },
    {
      id: 'tiktok',
      name: 'TikTok Shop',
      icon: Store,
      accentColor: 'text-[#06b6d4]',
      barColor: 'bg-[#06b6d4]',
      borderColor: 'border-[#06b6d4]/30',
      bgTint: 'bg-[#06b6d4]/[0.03]',
    },
  ];

  const safeTotal = totalNetRevenue > 0 ? totalNetRevenue : 1;

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans">
      <div>
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#f3aa18]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Channel Contribution & Split
            </h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            {selectedChannels.length} active {selectedChannels.length === 1 ? 'channel' : 'channels'}
          </span>
        </div>

        {/* Stacked Percentage Bar */}
        <div className="space-y-2 mb-5">
          <div className="h-3 w-full bg-white/[0.06] rounded-full overflow-hidden flex">
            {channels.map(ch => {
              const metric = breakdown[ch.id];
              const pct = totalNetRevenue > 0 ? (metric.netRevenue / safeTotal) * 100 : 0;
              if (pct <= 0) return null;

              return (
                <div
                  key={ch.id}
                  className={clsx('h-full transition-all duration-500', ch.barColor)}
                  style={{ width: `${pct}%` }}
                  title={`${ch.name}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>

          {/* Bar Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-400">
            {channels.map(ch => {
              const metric = breakdown[ch.id];
              const pct = totalNetRevenue > 0 ? Math.round((metric.netRevenue / safeTotal) * 100) : 0;
              return (
                <div key={ch.id} className="flex items-center gap-1.5">
                  <span className={clsx('w-2 h-2 rounded-full', ch.barColor)} />
                  <span className="text-neutral-300 font-sans">{ch.name}:</span>
                  <span className="font-bold tabular-nums text-white">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Detail Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {channels.map(ch => {
            const metric = breakdown[ch.id];
            const Icon = ch.icon;
            const isSelected = selectedChannels.includes(ch.id);

            return (
              <div
                key={ch.id}
                onClick={() => onSelectChannelOnly && onSelectChannelOnly(ch.id)}
                className={clsx(
                  'p-3.5 rounded-xl border transition-all flex flex-col justify-between group cursor-pointer',
                  isSelected
                    ? `${ch.bgTint} ${ch.borderColor} hover:border-white/30`
                    : 'bg-white/[0.02] border-white/[0.06] opacity-60 hover:opacity-100 hover:border-white/20'
                )}
                title={`Click to focus solely on ${ch.name}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={clsx('w-4 h-4', ch.accentColor)} />
                    <span className="text-xs font-bold text-white tracking-tight">
                      {ch.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300 border border-white/[0.06]">
                    {metric.percentageOfTotal}%
                  </span>
                </div>

                <div className="my-1">
                  <div className="text-base font-black font-mono tracking-tight text-white tabular-nums">
                    {formatCurrency(metric.netRevenue, 'IDR')}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                    {metric.ordersCount} {metric.ordersCount === 1 ? 'order' : 'orders'} · {metric.unitsSold} units
                  </div>
                </div>

                <div className="pt-2 mt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>AOV:</span>
                  <span className="font-semibold text-neutral-200 tabular-nums">
                    {formatCurrency(metric.aov, 'IDR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
};
