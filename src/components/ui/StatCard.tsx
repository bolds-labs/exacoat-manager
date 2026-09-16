import React from 'react';
import { GlassCard } from './GlassCard';
import { CardEyebrow } from './CardEyebrow';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number | string;
    isPositive?: boolean;
    label?: string;
  };
  chartData?: { value: number }[];
  onClick?: () => void;
  className?: string;
  refined?: boolean;
  chartColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  chartData,
  onClick,
  className,
  refined = false,
  chartColor = '#71717a',
}) => {
  return (
    <GlassCard
      onClick={onClick}
      hoverEffect={!!onClick}
      className={clsx(
        'p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[132px]',
        onClick && 'cursor-pointer hover:border-zinc-300 dark:hover:border-white/20',
        className
      )}
    >
      {/* Top Header: Title & Minimalist Badge */}
      <div className="flex items-center justify-between gap-2">
        <CardEyebrow>{title}</CardEyebrow>

        {trend && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.06] shrink-0">
            {trend.value}
          </span>
        )}
      </div>

      {/* Main Metric Value & Full-Width Subtitle (No Truncation) */}
      <div className="my-1 space-y-1">
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-mono tabular-nums group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
          {value}
        </h3>
        {subtitle && (
          <p className={clsx('text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-1', !refined && 'font-mono')}>{subtitle}</p>
        )}
      </div>

      {/* Full-Width Ambient Sparkline Ribbon Below Text */}
      {chartData && chartData.length > 1 && (
        <div className="w-full h-7 my-1 select-none pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`limeSpark-${title.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={1.8}
                fill={`url(#limeSpark-${title.replace(/[^a-zA-Z0-9]/g, '')})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Supporting metric context */}
      {trend?.label && (
        <div className={clsx('pt-2 border-t border-zinc-100 dark:border-white/[0.04] flex items-center text-[10px] text-zinc-400 dark:text-zinc-500', refined ? 'justify-end' : 'justify-between font-mono')}>
          {!refined && <span>Activity</span>}
          <span className="truncate">{trend.label}</span>
        </div>
      )}
    </GlassCard>
  );
};
