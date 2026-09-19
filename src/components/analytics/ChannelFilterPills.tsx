import React from 'react';
import { FinancialChannel, ChannelMetrics } from '../../lib/financialAnalyticsService';
import { Globe, ShoppingBag, Store, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { formatCurrency } from '../../lib/formatters';

interface ChannelFilterPillsProps {
  selectedChannels: FinancialChannel[];
  onToggleChannel: (channel: FinancialChannel) => void;
  onSelectAll: () => void;
  channelMetrics?: Record<FinancialChannel, ChannelMetrics>;
  className?: string;
}

export const ChannelFilterPills: React.FC<ChannelFilterPillsProps> = ({
  selectedChannels,
  onToggleChannel,
  onSelectAll,
  channelMetrics,
  className,
}) => {
  const isAll = selectedChannels.length === 3;

  const channelsConfig: Array<{
    id: FinancialChannel;
    name: string;
    subLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    activeBg: string;
    activeBorder: string;
    badgeColor: string;
  }> = [
    {
      id: 'webstore',
      name: 'Webstore',
      subLabel: 'Direct Store',
      icon: Globe,
      accentColor: 'text-[#f3aa18]',
      activeBg: 'bg-[#f3aa18]/10',
      activeBorder: 'border-[#f3aa18]/40 shadow-xs',
      badgeColor: 'bg-[#f3aa18]/20 text-[#f3aa18]',
    },
    {
      id: 'shopee',
      name: 'Shopee',
      subLabel: 'Marketplace',
      icon: ShoppingBag,
      accentColor: 'text-[#ee4d2d]',
      activeBg: 'bg-[#ee4d2d]/10',
      activeBorder: 'border-[#ee4d2d]/40 shadow-xs',
      badgeColor: 'bg-[#ee4d2d]/20 text-[#ee4d2d]',
    },
    {
      id: 'tiktok',
      name: 'TikTok Shop',
      subLabel: 'Social Commerce',
      icon: Store,
      accentColor: 'text-[#06b6d4]',
      activeBg: 'bg-[#06b6d4]/10',
      activeBorder: 'border-[#06b6d4]/40 shadow-xs',
      badgeColor: 'bg-[#06b6d4]/20 text-[#06b6d4]',
    },
  ];

  return (
    <div className={clsx('flex flex-wrap items-center gap-2.5', className)}>
      <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 mr-0.5 select-none hidden sm:inline-block">
        Channel Filter:
      </span>

      {/* 1. All Channels Button */}
      <button
        type="button"
        onClick={onSelectAll}
        className={clsx(
          'min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer font-sans select-none',
          isAll
            ? 'bg-white text-zinc-950 border-white shadow-xs font-bold'
            : 'bg-[#121316] text-neutral-300 border-white/[0.08] hover:border-white/20 hover:text-white'
        )}
      >
        <div
          className={clsx(
            'w-4 h-4 rounded flex items-center justify-center border transition-all',
            isAll
              ? 'bg-zinc-950 border-zinc-950 text-white'
              : 'border-white/20 bg-white/[0.04]'
          )}
        >
          {isAll && <Check className="w-3 h-3 stroke-[3]" />}
        </div>
        <span>All Channels</span>
      </button>

      {/* 2. Specific Channel Toggles */}
      {channelsConfig.map(channel => {
        const isSelected = selectedChannels.includes(channel.id);
        const Icon = channel.icon;
        const metrics = channelMetrics ? channelMetrics[channel.id] : null;

        return (
          <button
            key={channel.id}
            type="button"
            onClick={() => onToggleChannel(channel.id)}
            className={clsx(
              'min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition-all cursor-pointer font-sans select-none',
              isSelected
                ? `${channel.activeBg} ${channel.activeBorder} text-white`
                : 'bg-[#121316] text-neutral-400 border-white/[0.08] hover:border-white/20 hover:text-neutral-200'
            )}
          >
            {/* Custom Checkbox */}
            <div
              className={clsx(
                'w-4 h-4 rounded flex items-center justify-center border transition-all',
                isSelected
                  ? `${channel.badgeColor} border-current`
                  : 'border-white/20 bg-white/[0.04]'
              )}
            >
              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
            </div>

            <Icon className={clsx('w-3.5 h-3.5', channel.accentColor)} />

            <div className="flex flex-col text-left">
              <span className="leading-tight">{channel.name}</span>
            </div>

            {/* Metric pill */}
            {metrics && metrics.netRevenue > 0 && (
              <span
                className={clsx(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded-md tabular-nums border border-white/[0.06]',
                  isSelected ? 'bg-white/10 text-white' : 'bg-white/[0.04] text-neutral-400'
                )}
              >
                {formatCurrency(metrics.netRevenue, 'IDR')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
