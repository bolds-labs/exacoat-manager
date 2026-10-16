import React, { useState } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { SkinMetricItem, SkinGroupSummary } from '../../lib/skinPerformanceService';
import { PieChart, Palette } from 'lucide-react';
import { clsx } from 'clsx';

interface SkinDistributionChartProps {
  skins: SkinMetricItem[];
  groups: SkinGroupSummary[];
  totalUnits: number;
}

export const SkinDistributionChart: React.FC<SkinDistributionChartProps> = ({
  skins,
  groups,
  totalUnits,
}) => {
  const [viewMode, setViewMode] = useState<'skins' | 'groups'>('skins');

  const activeSkins = skins.filter((s) => s.unitsSold > 0);
  const topSkins = activeSkins.slice(0, 6);
  const otherUnits = activeSkins.slice(6).reduce((s, it) => s + it.unitsSold, 0);
  const otherShare = totalUnits > 0 ? Number(((otherUnits / totalUnits) * 100).toFixed(1)) : 0;

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div>
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#f3aa18]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Market Share Distribution
              </h3>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Relative volume share across {viewMode === 'skins' ? 'individual finishes' : 'collections'}
            </p>
          </div>

          <div className="p-1 rounded-xl bg-[#090a0d] border border-white/[0.08] flex items-center gap-1 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('skins')}
              className={clsx(
                'px-2 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                viewMode === 'skins'
                  ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              Finishes
            </button>
            <button
              type="button"
              onClick={() => setViewMode('groups')}
              className={clsx(
                'px-2 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                viewMode === 'groups'
                  ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              Collections
            </button>
          </div>
        </div>

        {/* Breakdown Items List */}
        <div className="space-y-3">
          {viewMode === 'skins' ? (
            topSkins.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-xs">
                No finish sales recorded in this timeframe.
              </div>
            ) : (
              <>
                {topSkins.map((skin) => (
                <div key={skin.slug} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: skin.colorHex }}
                      />
                      <span className="font-semibold text-white truncate text-xs">
                        {skin.name}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500 uppercase">
                        {skin.group.split(' ')[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="text-neutral-400">{skin.unitsSold} units</span>
                      <span className="font-bold text-[#f3aa18] w-12 text-right">
                        {skin.shareOfTotalUnits}%
                      </span>
                    </div>
                  </div>
                  {/* Visual Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(3, skin.shareOfTotalUnits))}%`,
                        backgroundColor: skin.colorHex !== '#18181b' ? skin.colorHex : '#f3aa18',
                      }}
                    />
                  </div>
                </div>
              ))}

              {otherUnits > 0 && (
                <div className="space-y-1 pt-1 border-t border-white/[0.04]">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-neutral-600" />
                      <span className="text-neutral-400 font-medium">Other Finishes ({skins.length - 6})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="text-neutral-400">{otherUnits} units</span>
                      <span className="font-bold text-neutral-300 w-12 text-right">
                        {otherShare}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-neutral-600 transition-all duration-500"
                      style={{ width: `${Math.min(100, otherShare)}%` }}
                    />
                  </div>
                </div>
              )}
              </>
            )
          ) : (
            <>
              {groups.map((grp) => (
                <div key={grp.group} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Palette className="w-3.5 h-3.5 text-[#f3aa18] shrink-0" />
                      <span className="font-semibold text-white truncate">
                        {grp.group}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        ({grp.skinsCount} textures)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                      <span className="text-neutral-400">{grp.units} units</span>
                      <span className="font-bold text-[#f3aa18] w-12 text-right">
                        {grp.sharePercentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#f3aa18] transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(3, grp.sharePercentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400">
        <span>Active Categories</span>
        <span className="font-mono text-white font-bold">{groups.length} collections</span>
      </div>
    </GlassCard>
  );
};
