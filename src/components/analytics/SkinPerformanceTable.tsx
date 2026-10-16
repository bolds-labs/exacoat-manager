import React, { useState, useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { SkinMetricItem, normalizeThumbnailUrl } from '../../lib/skinPerformanceService';
import { formatCurrency } from '../../lib/formatters';
import {
  Search,
  Filter,
  ArrowUpDown,
  Smartphone,
  Layers,
  ChevronRight,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SkinPerformanceTableProps {
  skins: SkinMetricItem[];
  onSelectSkin?: (skin: SkinMetricItem) => void;
}

type SortField = 'unitsSold' | 'grossRevenueIdr' | 'shareOfTotalUnits' | 'name';
type SortOrder = 'asc' | 'desc';

export const SkinPerformanceTable: React.FC<SkinPerformanceTableProps> = ({
  skins,
  onSelectSkin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('unitsSold');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [inspectedSkin, setInspectedSkin] = useState<SkinMetricItem | null>(null);

  // Extract distinct collection groups
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    skins.forEach((s) => {
      if (s.group) set.add(s.group);
    });
    return Array.from(set).sort();
  }, [skins]);

  // Filter and sort items
  const processedSkins = useMemo(() => {
    let result = skins;

    // Filter by group
    if (selectedGroup !== 'all') {
      result = result.filter((s) => s.group === selectedGroup);
    }

    // Filter by search query (name, slug, or devices)
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((s) => {
        if (s.name.toLowerCase().includes(q)) return true;
        if (s.slug.toLowerCase().includes(q)) return true;
        if (s.group.toLowerCase().includes(q)) return true;
        return s.topDevices.some((d) => d.deviceName.toLowerCase().includes(q));
      });
    }

    // Sort
    return [...result].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [skins, selectedGroup, searchQuery, sortField, sortOrder]);

  const maxUnits = useMemo(() => {
    return Math.max(1, ...skins.map((s) => s.unitsSold));
  }, [skins]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <>
      <GlassCard className="p-5 font-sans">
        {/* Controls Bar: Search & Group Filter Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/[0.06]">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by skin finish or device model..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#090a0d] border border-white/[0.08] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#f3aa18]/50 transition-all font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Group Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Collection:
            </span>
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                selectedGroup === 'all'
                  ? 'bg-[#f3aa18] text-zinc-950 font-bold shadow-xs'
                  : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
              )}
            >
              All Finishes
            </button>
            {availableGroups.map((grp) => (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  selectedGroup === grp
                    ? 'bg-[#f3aa18] text-zinc-950 font-bold shadow-xs'
                    : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                )}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-3 px-1">
          <span>
            Showing <strong className="text-white">{processedSkins.length}</strong> of{' '}
            {skins.length} finishes
          </span>
          <span className="font-mono text-[11px]">
            Sorted by {sortField} ({sortOrder})
          </span>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#090a0d] text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Finish / Skin</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Collection</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('unitsSold')}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Units Sold</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('shareOfTotalUnits')}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Share %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('grossRevenueIdr')}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Gross Revenue</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 hidden lg:table-cell">Top Paired Devices</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {processedSkins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500 font-sans">
                    No skin finishes matched your filter criteria.
                  </td>
                </tr>
              ) : (
                processedSkins.map((skin, idx) => {
                  const relativePct = (skin.unitsSold / maxUnits) * 100;
                  return (
                    <tr
                      key={skin.slug}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Finish Name & Swatch */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-neutral-600 text-[11px] w-4">
                            #{idx + 1}
                          </span>
                          <div
                            className="w-7 h-7 rounded-lg overflow-hidden border border-white/20 bg-black shrink-0 relative flex items-center justify-center shadow-xs"
                            style={{ backgroundColor: skin.colorHex || '#18181b' }}
                          >
                            {skin.thumbnailUrl ? (
                              <img
                                src={normalizeThumbnailUrl(skin.thumbnailUrl)}
                                alt={skin.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div
                                className="w-full h-full"
                                style={{ backgroundColor: skin.colorHex || '#18181b' }}
                              />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-white block group-hover:text-[#f3aa18] transition-colors text-xs">
                              {skin.name}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500">
                              slug: {skin.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Collection Badge */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.05] border border-white/[0.08] text-neutral-300">
                          {skin.group}
                        </span>
                      </td>

                      {/* Units Sold + Relative Bar */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="space-y-1 max-w-[120px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">
                              {skin.unitsSold.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              ({skin.orderCount} orders)
                            </span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#f3aa18]"
                              style={{ width: `${skin.unitsSold > 0 ? Math.max(4, relativePct) : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Market Share */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <span className={clsx('font-bold', skin.unitsSold > 0 ? 'text-[#f3aa18]' : 'text-neutral-600')}>
                          {skin.shareOfTotalUnits}%
                        </span>
                      </td>

                      {/* Gross Revenue */}
                      <td className="py-3.5 px-4 font-mono text-xs text-white">
                        <span className={clsx('font-semibold', skin.unitsSold === 0 && 'text-neutral-500')}>
                          {formatCurrency(skin.grossRevenueIdr, 'IDR')}
                        </span>
                        {skin.unitsSold > 0 && (
                          <span className="block text-[10px] text-neutral-500">
                            avg: {formatCurrency(skin.averageItemPriceIdr, 'IDR')}
                          </span>
                        )}
                      </td>

                      {/* Top Paired Devices */}
                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-sm">
                          {skin.topDevices.length === 0 ? (
                            <span className="text-[11px] text-neutral-600 font-mono italic">No orders yet</span>
                          ) : (
                            <>
                              {skin.topDevices.slice(0, 2).map((dev, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[#090a0d] border border-white/[0.06] text-neutral-300"
                                  title={`${dev.deviceName}: ${dev.units} units (${dev.percentage.toFixed(0)}%)`}
                                >
                                  <Smartphone className="w-2.5 h-2.5 text-[#f3aa18]" />
                                  <span className="truncate max-w-[120px]">{dev.deviceName}</span>
                                  <span className="text-neutral-500">({dev.units})</span>
                                </span>
                              ))}
                              {skin.topDevices.length > 2 && (
                                <span className="text-[10px] font-mono text-neutral-500">
                                  +{skin.topDevices.length - 2} more
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedSkin(skin);
                            onSelectSkin?.(skin);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-[#f3aa18]/10 text-neutral-400 hover:text-[#f3aa18] border border-white/[0.08] hover:border-[#f3aa18]/30 transition-all text-[11px] font-sans font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Drill-down Modal for a Selected Skin */}
      {inspectedSkin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#121316] border border-white/10 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 bg-black shrink-0 relative flex items-center justify-center"
                  style={{ backgroundColor: inspectedSkin.colorHex || '#18181b' }}
                >
                  {inspectedSkin.thumbnailUrl ? (
                    <img
                      src={normalizeThumbnailUrl(inspectedSkin.thumbnailUrl)}
                      alt={inspectedSkin.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: inspectedSkin.colorHex || '#18181b' }}
                    />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white font-sans flex items-center gap-2">
                    <span>{inspectedSkin.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-neutral-300">
                      {inspectedSkin.group}
                    </span>
                  </h4>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    Total: {inspectedSkin.unitsSold} units | {formatCurrency(inspectedSkin.grossRevenueIdr, 'IDR')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedSkin(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Device Popularity Breakdown */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 font-mono flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#f3aa18]" />
                Device Pairings for this Base Skin:
              </h5>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 rounded-xl">
                {inspectedSkin.topDevices.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-2">No device breakdown recorded.</p>
                ) : (
                  inspectedSkin.topDevices.map((dev, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#090a0d] border border-white/[0.04] flex items-center justify-between text-xs font-sans"
                    >
                      <div className="min-w-0 pr-3">
                        <span className="font-semibold text-white block truncate">
                          {dev.deviceName}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {dev.percentage.toFixed(1)}% of all {inspectedSkin.name} purchases
                        </span>
                      </div>
                      <div className="text-right font-mono shrink-0">
                        <span className="font-bold text-[#f3aa18] block">
                          {dev.units} units
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {formatCurrency(dev.revenue, 'IDR')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="border-t border-white/[0.08] pt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectedSkin(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-white transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
