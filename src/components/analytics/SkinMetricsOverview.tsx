import React from 'react';
import { GlassCard } from '../ui/GlassCard';
import { SkinPerformanceReport } from '../../lib/skinPerformanceService';
import { formatCurrency } from '../../lib/formatters';
import {
  Layers,
  DollarSign,
  Crown,
  Palette,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface SkinMetricsOverviewProps {
  report: SkinPerformanceReport;
}

export const SkinMetricsOverview: React.FC<SkinMetricsOverviewProps> = ({ report }) => {
  const {
    totalBaseSkinsSold,
    totalOrdersWithBaseSkins,
    totalRevenueIdr,
    topSkinByVolume,
    groups,
    uniqueSkinsCount,
  } = report;

  const topGroup = groups.length > 0 ? groups[0] : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 font-sans">
      {/* 1. Total Base Skins Sold */}
      <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-neutral-400">
            Base Skins Sold
          </span>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] group-hover:bg-[#f3aa18]/10 text-zinc-500 dark:text-neutral-400 group-hover:text-[#f3aa18] transition-colors border border-zinc-200 dark:border-white/[0.06]">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-white">
            {totalBaseSkinsSold.toLocaleString('id-ID')}
            <span className="text-xs font-normal text-neutral-400 ml-1.5">units</span>
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-0.5">
            Across {totalOrdersWithBaseSkins.toLocaleString('id-ID')} verified orders
          </p>
        </div>
      </GlassCard>

      {/* 2. Gross Base Skin Revenue */}
      <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-neutral-400">
            Skins Revenue
          </span>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] group-hover:bg-[#f3aa18]/10 text-zinc-500 dark:text-neutral-400 group-hover:text-[#f3aa18] transition-colors border border-zinc-200 dark:border-white/[0.06]">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-white truncate">
            {formatCurrency(totalRevenueIdr, 'IDR')}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-0.5">
            Gross base layer revenue
          </p>
        </div>
      </GlassCard>

      {/* 3. #1 Top Selling Skin */}
      <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-neutral-400">
            #1 Top Finish
          </span>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] group-hover:bg-[#f3aa18]/10 text-zinc-500 dark:text-neutral-400 group-hover:text-[#f3aa18] transition-colors border border-zinc-200 dark:border-white/[0.06]">
            <Crown className="w-4 h-4 text-[#f3aa18]" />
          </div>
        </div>
        <div className="mt-2">
          {topSkinByVolume ? (
            <>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-xs"
                  style={{ backgroundColor: topSkinByVolume.colorHex }}
                />
                <p className="text-lg sm:text-xl font-black font-sans tracking-tight text-zinc-900 dark:text-white truncate">
                  {topSkinByVolume.name}
                </p>
              </div>
              <p className="text-[11px] text-[#f3aa18] font-mono font-semibold mt-0.5">
                {topSkinByVolume.unitsSold} units ({topSkinByVolume.shareOfTotalUnits}%)
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-500">No data</p>
          )}
        </div>
      </GlassCard>

      {/* 4. Top Category Share */}
      <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-neutral-400">
            Top Collection
          </span>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] group-hover:bg-[#f3aa18]/10 text-zinc-500 dark:text-neutral-400 group-hover:text-[#f3aa18] transition-colors border border-zinc-200 dark:border-white/[0.06]">
            <Palette className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          {topGroup ? (
            <>
              <p className="text-lg sm:text-xl font-black font-sans tracking-tight text-zinc-900 dark:text-white truncate">
                {topGroup.group}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-0.5">
                {topGroup.sharePercentage}% share ({topGroup.units} units)
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-500">No data</p>
          )}
        </div>
      </GlassCard>

      {/* 5. Active Textures Count */}
      <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px] col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-neutral-400">
            Texture Variety
          </span>
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] group-hover:bg-[#f3aa18]/10 text-zinc-500 dark:text-neutral-400 group-hover:text-[#f3aa18] transition-colors border border-zinc-200 dark:border-white/[0.06]">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-white">
            {uniqueSkinsCount}
            <span className="text-xs font-normal text-neutral-400 ml-1.5">finishes</span>
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-neutral-400 mt-0.5">
            Ordered in selected window
          </p>
        </div>
      </GlassCard>
    </div>
  );
};
