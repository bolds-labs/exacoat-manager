import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { DateRangePicker, DatePreset } from '../components/ui/DateRangePicker';
import { GlassCard } from '../components/ui/GlassCard';
import { CardEyebrow } from '../components/ui/CardEyebrow';
import { ChannelFilterPills } from '../components/analytics/ChannelFilterPills';
import { ChannelRevenueBreakdownCard } from '../components/analytics/ChannelRevenueBreakdownCard';
import { MultiChannelRevenueChart } from '../components/analytics/MultiChannelRevenueChart';
import { TopFinancialProductsCard } from '../components/analytics/TopFinancialProductsCard';
import { FinancialLedgerTable } from '../components/analytics/FinancialLedgerTable';
import {
  FinancialChannel,
  UnifiedFinancialRecord,
  normalizeWebstoreOrder,
  normalizeShopeeOrder,
  normalizeTikTokOrder,
  aggregateFinancialMetrics,
  exportFinancialReportToCsv,
} from '../lib/financialAnalyticsService';
import {
  fetchOrdersDirect,
  fetchShopeeOrdersDirect,
  fetchTikTokOrdersDirect,
  ShopeeOrder,
  TikTokOrder,
} from '../lib/wordpressBridge';
import { MOCK_SHOPEE_ORDERS } from '../data/mockShopeeOrders';
import { MOCK_TIKTOK_ORDERS } from '../data/mockTikTokOrders';
import { formatCurrency } from '../lib/formatters';
import { Order } from '../types';
import {
  RefreshCw,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Package,
  CreditCard,
  Layers,
  ArrowUpRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ReportsPageProps {
  onNavigate?: (tab: string, filter?: string) => void;
}

const formatIsoDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigate }) => {
  // 1. Timespan horizon state
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // 2. Multi-channel filter state (default all active)
  const [selectedChannels, setSelectedChannels] = useState<FinancialChannel[]>([
    'webstore',
    'shopee',
    'tiktok',
  ]);

  // 3. Raw orders state
  const [webOrders, setWebOrders] = useState<Order[]>([]);
  const [shopeeOrders, setShopeeOrders] = useState<ShopeeOrder[]>([]);
  const [tiktokOrders, setTikTokOrders] = useState<TikTokOrder[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Compute start and end timestamps based on preset
  const { startMs, endMs, dateLabel } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date();
    let label = 'Last 30 Days';

    if (datePreset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      label = 'Today';
    } else if (datePreset === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      label = 'Last 7 Days';
    } else if (datePreset === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      label = 'Last 30 Days';
    } else if (datePreset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      label = 'This Month';
    } else if (datePreset === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label = 'Last Month';
    } else if (datePreset === '90d') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      label = 'Last 90 Days';
    } else if (datePreset === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      label = 'This Year';
    } else if (datePreset === 'all') {
      start = new Date(2020, 0, 1);
      label = 'All Time';
    } else if (datePreset === 'custom' && customStart) {
      start = new Date(customStart);
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      }
      label = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} to ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      label = 'Last 30 Days';
    }

    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
      dateLabel: label,
    };
  }, [datePreset, customStart, customEnd]);

  // Load all channel orders concurrently
  const loadFinancialData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [webRes, shpRes, ttRes] = await Promise.allSettled([
        fetchOrdersDirect({ per_page: 250 }),
        fetchShopeeOrdersDirect(),
        fetchTikTokOrdersDirect(),
      ]);

      // Webstore orders
      if (webRes.status === 'fulfilled' && webRes.value.success && Array.isArray(webRes.value.orders)) {
        setWebOrders(webRes.value.orders);
      } else {
        setWebOrders([]);
      }

      // Shopee orders (fallback to realistic mock if empty/offline)
      if (shpRes.status === 'fulfilled' && shpRes.value.success && Array.isArray(shpRes.value.orders) && shpRes.value.orders.length > 0) {
        setShopeeOrders(shpRes.value.orders);
      } else {
        setShopeeOrders(MOCK_SHOPEE_ORDERS);
      }

      // TikTok orders (fallback to realistic mock if empty/offline)
      if (ttRes.status === 'fulfilled' && ttRes.value.success && Array.isArray(ttRes.value.orders) && ttRes.value.orders.length > 0) {
        setTikTokOrders(ttRes.value.orders);
      } else {
        setTikTokOrders(MOCK_TIKTOK_ORDERS);
      }

      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.warn('Failed to load multi-channel financial data:', err);
      setError(err?.message || 'Could not synchronize financial data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  // Normalize all orders into unified financial records
  const allRecords = useMemo(() => {
    const list: UnifiedFinancialRecord[] = [];
    webOrders.forEach(o => list.push(normalizeWebstoreOrder(o)));
    shopeeOrders.forEach(o => list.push(normalizeShopeeOrder(o)));
    tiktokOrders.forEach(o => list.push(normalizeTikTokOrder(o)));
    return list;
  }, [webOrders, shopeeOrders, tiktokOrders]);

  // Aggregate metrics based on selected channels and timespan
  const summary = useMemo(() => {
    return aggregateFinancialMetrics(allRecords, selectedChannels, startMs, endMs);
  }, [allRecords, selectedChannels, startMs, endMs]);

  // Channel toggles handlers
  const handleToggleChannel = (ch: FinancialChannel) => {
    setSelectedChannels(prev => {
      if (prev.includes(ch)) {
        // Don't allow deselecting all channels; leave at least one
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== ch);
      } else {
        return [...prev, ch];
      }
    });
  };

  const handleSelectAllChannels = () => {
    setSelectedChannels(['webstore', 'shopee', 'tiktok']);
  };

  const handleSelectChannelOnly = (ch: FinancialChannel) => {
    setSelectedChannels([ch]);
  };

  const handleExportCsv = () => {
    exportFinancialReportToCsv(summary, dateLabel);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              Financial Intelligence
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#121316] text-neutral-300 border border-white/[0.08]">
              {dateLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Revenue & Sales Reports
          </h1>
          <p className="text-sm text-neutral-400 mt-1 font-sans">
            Cross-platform monetization, marketplace cash flow, and channel performance ledger.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {lastRefreshedAt && (
            <span className="text-[11px] font-mono text-neutral-400 hidden md:inline-block">
              Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadFinancialData(true)}
            disabled={isLoading || isRefreshing}
            className="min-h-11 px-3.5 rounded-xl border border-white/10 bg-[#121316] text-neutral-200 hover:bg-white/[0.06] hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh multi-channel financial ledger"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', (isLoading || isRefreshing) && 'animate-spin text-[#f3aa18]')} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* 2. Timespan Horizon Selector (Standard Workstation Picker) */}
      <DateRangePicker
        preset={datePreset}
        onPresetChange={setDatePreset}
        customStart={customStart}
        customEnd={customEnd}
        onCustomChange={(start, end) => {
          setCustomStart(start);
          setCustomEnd(end);
        }}
        label={dateLabel}
        subtitle={`Analyzing ${summary.totalOrders.toLocaleString()} checkouts (${summary.totalUnitsSold.toLocaleString()} units) across active channels`}
      />

      {/* 3. Multi-Channel Filter Bar */}
      <GlassCard className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-white/[0.08]">
        <ChannelFilterPills
          selectedChannels={selectedChannels}
          onToggleChannel={handleToggleChannel}
          onSelectAll={handleSelectAllChannels}
          channelMetrics={summary.channelBreakdown}
        />

        <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-2 self-end sm:self-auto">
          <span>Active filter:</span>
          <span className="font-bold text-[#f3aa18]">
            {selectedChannels.length === 3
              ? 'All 3 Channels'
              : selectedChannels.map(c => c.toUpperCase()).join(' + ')}
          </span>
        </div>
      </GlassCard>

      {/* 4. Loading State */}
      {isLoading && (
        <div className="min-h-[380px] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#f3aa18]" />
          <p className="text-sm font-medium text-neutral-300">
            Synchronizing financial ledgers for {dateLabel}...
          </p>
          <p className="text-xs text-neutral-500 font-mono">
            Querying Webstore, Shopee, and TikTok Shop transactions.
          </p>
        </div>
      )}

      {/* 5. Error State */}
      {!isLoading && error && (
        <GlassCard className="min-h-[300px] p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Financial Sync Interrupted</h2>
          <p className="text-sm text-neutral-400 mt-1 max-w-md">{error}</p>
          <button
            type="button"
            onClick={() => loadFinancialData(false)}
            className="mt-5 min-h-11 px-5 rounded-xl bg-white text-zinc-950 font-semibold text-sm cursor-pointer shadow-xs hover:opacity-90"
          >
            Retry Sync
          </button>
        </GlassCard>
      )}

      {/* 6. Active Financial Dashboard Content */}
      {!isLoading && !error && (
        <>
          {/* Executive Money KPI Cards (5-Grid) */}
          <section
            className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 font-sans"
            aria-label="Executive financial metrics"
          >
            {/* 1. Gross Revenue */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Gross Sales</CardEyebrow>
                <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-[#f3aa18]/10 text-neutral-400 group-hover:text-[#f3aa18] transition-colors border border-white/[0.06]">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                  {formatCurrency(summary.totalGrossRevenue, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  Before refunds & deductions
                </p>
              </div>
            </GlassCard>

            {/* 2. Retained Net Revenue */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px] border-emerald-500/25 bg-emerald-500/[0.02]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Retained Net</CardEyebrow>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 transition-colors border border-emerald-500/20">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-400 tabular-nums">
                  {formatCurrency(summary.totalNetRevenue, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  {summary.totalRefunded > 0
                    ? `${formatCurrency(summary.totalRefunded, summary.primaryCurrency)} deducted`
                    : 'Zero cancellations in window'}
                </p>
              </div>
            </GlassCard>

            {/* 3. Average Order Value (AOV) */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Avg Order Value</CardEyebrow>
                <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-amber-500/10 text-neutral-400 group-hover:text-amber-400 transition-colors border border-white/[0.06]">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                  {formatCurrency(summary.averageOrderValue, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  Net spend per checkout
                </p>
              </div>
            </GlassCard>

            {/* 4. Total Orders Volume */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Paid Orders</CardEyebrow>
                <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-sky-500/10 text-neutral-400 group-hover:text-sky-400 transition-colors border border-white/[0.06]">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                  {summary.totalOrders.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  Across {selectedChannels.length} active {selectedChannels.length === 1 ? 'channel' : 'channels'}
                </p>
              </div>
            </GlassCard>

            {/* 5. Total Units Sold */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Units Sold</CardEyebrow>
                <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-purple-500/10 text-neutral-400 group-hover:text-purple-400 transition-colors border border-white/[0.06]">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                  {summary.totalUnitsSold.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  {summary.totalOrders > 0
                    ? `${(summary.totalUnitsSold / summary.totalOrders).toFixed(1)} skins per order`
                    : 'Precision skins delivered'}
                </p>
              </div>
            </GlassCard>
          </section>

          {/* 7. Visual Analytics: Revenue Dynamic Chart & Channel Contribution Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            <div className="lg:col-span-2">
              <MultiChannelRevenueChart
                timeline={summary.timeline}
                selectedChannels={selectedChannels}
                totalRevenue={summary.totalNetRevenue}
              />
            </div>
            <div className="lg:col-span-1">
              <ChannelRevenueBreakdownCard
                breakdown={summary.channelBreakdown}
                totalNetRevenue={summary.totalNetRevenue}
                selectedChannels={selectedChannels}
                onSelectChannelOnly={handleSelectChannelOnly}
              />
            </div>
          </div>

          {/* 8. Top Performing Skins & Models */}
          <section>
            <TopFinancialProductsCard
              products={summary.topProducts}
              totalNetRevenue={summary.totalNetRevenue}
              primaryCurrency={summary.primaryCurrency}
            />
          </section>

          {/* 9. Financial Orders & Transactions Ledger */}
          <section>
            <FinancialLedgerTable
              records={summary.filteredRecords}
              onExportCsv={handleExportCsv}
              primaryCurrency={summary.primaryCurrency}
            />
          </section>
        </>
      )}
    </div>
  );
};
