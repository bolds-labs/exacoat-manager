import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Order } from '../types';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { DateRangePicker, DatePreset } from '../components/ui/DateRangePicker';
import {
  filterOrdersByHorizon,
  aggregateSkinPerformance,
  exportSkinReportToCsv,
} from '../lib/skinPerformanceService';
import { SkinMetricsOverview } from '../components/analytics/SkinMetricsOverview';
import { SkinVolumeTrendChart } from '../components/analytics/SkinVolumeTrendChart';
import { SkinDistributionChart } from '../components/analytics/SkinDistributionChart';
import { SkinPerformanceTable } from '../components/analytics/SkinPerformanceTable';
import { fetchOrdersDirect } from '../lib/wordpressBridge';
import {
  RefreshCw,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SkinPerformancePageProps {
  orders?: Order[];
  onNavigate?: (tab: any, filter?: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export type HorizonPreset = 'today' | '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'all';

export const SkinPerformancePage: React.FC<SkinPerformancePageProps> = ({
  orders: propOrders = [],
  onNavigate,
  onRefresh,
  isLoading: propLoading = false,
}) => {
  const [horizonPreset, setHorizonPreset] = useState<HorizonPreset>('30d');
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isCustomActive, setIsCustomActive] = useState(false);

  // Local orders cache to allow deep loading if needed
  const [localOrders, setLocalOrders] = useState<Order[]>(propOrders);
  const [isFetchingFresh, setIsFetchingFresh] = useState(false);

  // Keep localOrders synced with propOrders when updated from parent workspace
  useEffect(() => {
    if (propOrders && propOrders.length > 0) {
      setLocalOrders(propOrders);
    }
  }, [propOrders]);

  // Load fresh orders from backend on manual refresh or horizon change if needed
  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      onRefresh();
    }
    try {
      setIsFetchingFresh(true);
      const res = await fetchOrdersDirect({ per_page: 500 });
      if (res.success && Array.isArray(res.orders)) {
        setLocalOrders(res.orders);
      }
    } catch (err) {
      console.warn('Skin performance orders fetch warning:', err);
    } finally {
      setIsFetchingFresh(false);
    }
  }, [onRefresh]);

  // 1. Filter orders according to selected date horizon
  const { filtered: horizonOrders, horizonLabel } = useMemo(() => {
    const preset = isCustomActive ? 'custom' : horizonPreset;
    return filterOrdersByHorizon(localOrders, preset, customStart, customEnd);
  }, [localOrders, horizonPreset, isCustomActive, customStart, customEnd]);

  // 2. Aggregate Base Skin performance
  const report = useMemo(() => {
    const preset = isCustomActive ? 'custom' : horizonPreset;
    const { startMs, endMs } = filterOrdersByHorizon(localOrders, preset, customStart, customEnd);
    return aggregateSkinPerformance(horizonOrders, startMs, endMs);
  }, [horizonOrders, localOrders, horizonPreset, isCustomActive, customStart, customEnd]);

  const handleExportCsv = () => {
    exportSkinReportToCsv(report, horizonLabel);
  };

  const handlePresetSelect = (preset: HorizonPreset) => {
    setIsCustomActive(false);
    setHorizonPreset(preset);
  };

  const handleCustomRangeApply = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setIsCustomActive(true);
    setIsCustomPickerOpen(false);
  };

  const isLoading = propLoading || isFetchingFresh;

  return (
    <div className="space-y-6 font-sans">
      {/* Page Hero Header & Controls Bar */}
      <PageHeroHeader
        title="Skin Performance Analytics"
        subtitle="Purchase volume, finish popularity, and revenue performance for configurator base skins."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Horizon Pills (Today, 7D, 30D, 90D, Month, All) */}
            <div className="p-1 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center gap-1 font-mono text-xs">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: '7d', label: '7D' },
                  { id: '30d', label: '30D' },
                  { id: '90d', label: '90D' },
                  { id: 'this_month', label: 'Month' },
                  { id: 'all', label: 'All' },
                ] as { id: HorizonPreset; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePresetSelect(item.id)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                    !isCustomActive && horizonPreset === item.id
                      ? 'bg-[#f3aa18] text-[#080808] shadow-xs'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  )}
                >
                  {item.label}
                </button>
              ))}

              {/* Custom Date Range Toggle */}
              <button
                type="button"
                onClick={() => setIsCustomPickerOpen((prev) => !prev)}
                className={clsx(
                  'px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1',
                  isCustomActive
                    ? 'bg-[#f3aa18] text-[#080808] font-bold shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                )}
                title="Select custom date range"
              >
                <Calendar className="w-3 h-3" />
                <span className="hidden sm:inline">
                  {isCustomActive ? `${customStart.slice(5)} to ${customEnd.slice(5)}` : 'Custom'}
                </span>
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={report.skins.length === 0}
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shrink-0"
              title="Download skin performance metrics as CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#f3aa18]" />
              <span>Export CSV</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="Refresh store orders"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-[#f3aa18]')} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Custom Date Range Modal / Popover */}
      {isCustomPickerOpen && (
        <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-300">
            <Calendar className="w-4 h-4 text-[#f3aa18]" />
            <span className="font-semibold">Custom Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#090a0d] border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-[#f3aa18]"
            />
            <span className="text-neutral-500 text-xs">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#090a0d] border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-[#f3aa18]"
            />
          </div>
          <button
            type="button"
            onClick={() => handleCustomRangeApply(customStart, customEnd)}
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 rounded-xl bg-[#f3aa18] text-zinc-950 font-bold text-xs disabled:opacity-40 cursor-pointer shadow-xs"
          >
            Apply Range
          </button>
          <button
            type="button"
            onClick={() => setIsCustomPickerOpen(false)}
            className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 1. Core Skin Metric Cards */}
      <SkinMetricsOverview report={report} />

      {/* 2. Visual Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2">
          <SkinVolumeTrendChart
            timeline={report.timeline}
            dateHorizonLabel={horizonLabel}
          />
        </div>
        <div className="lg:col-span-1">
          <SkinDistributionChart
            skins={report.skins}
            groups={report.groups}
            totalUnits={report.totalBaseSkinsSold}
          />
        </div>
      </div>

      {/* 3. Detailed Skin Performance Table & Device Pairings */}
      <SkinPerformanceTable skins={report.skins} />
    </div>
  );
};
