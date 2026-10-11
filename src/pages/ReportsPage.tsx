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
  syncShopeeOrdersDirect,
  syncTikTokOrdersDirect,
  ShopeeOrder,
  TikTokOrder,
} from '../lib/wordpressBridge';
import { 
  formatCurrency, 
  getStoreDateKey, 
  getStoreDayStartMs, 
  getStoreDayEndMs, 
  formatStoreDateFull 
} from '../lib/formatters';
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

  // Compute start and end timestamps based on preset strictly in store timezone (Asia/Jakarta, UTC+7)
  const { startMs, endMs, dateLabel } = useMemo(() => {
    const todayKey = getStoreDateKey(Date.now());
    const todayStartMs = getStoreDayStartMs(todayKey);
    const todayEndMs = getStoreDayEndMs(todayKey);

    const [currY, currM] = todayKey.split('-').map(Number);

    if (datePreset === 'today') {
      return {
        startMs: todayStartMs,
        endMs: todayEndMs,
        dateLabel: 'Today',
      };
    }

    if (datePreset === '7d') {
      return {
        startMs: todayStartMs - 6 * 24 * 60 * 60 * 1000,
        endMs: todayEndMs,
        dateLabel: 'Last 7 Days',
      };
    }

    if (datePreset === '30d') {
      return {
        startMs: todayStartMs - 29 * 24 * 60 * 60 * 1000,
        endMs: todayEndMs,
        dateLabel: 'Last 30 Days',
      };
    }

    if (datePreset === 'this_month') {
      const monthStartKey = `${currY}-${String(currM).padStart(2, '0')}-01`;
      return {
        startMs: getStoreDayStartMs(monthStartKey),
        endMs: todayEndMs,
        dateLabel: 'This Month',
      };
    }

    if (datePreset === 'last_month') {
      const prevY = currM === 1 ? currY - 1 : currY;
      const prevM = currM === 1 ? 12 : currM - 1;
      const daysInPrevMonth = new Date(Date.UTC(currY, currM - 1, 0)).getUTCDate();
      const lastMonthStartKey = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
      const lastMonthEndKey = `${prevY}-${String(prevM).padStart(2, '0')}-${String(daysInPrevMonth).padStart(2, '0')}`;
      return {
        startMs: getStoreDayStartMs(lastMonthStartKey),
        endMs: getStoreDayEndMs(lastMonthEndKey),
        dateLabel: 'Last Month',
      };
    }

    if (datePreset === '90d') {
      return {
        startMs: todayStartMs - 89 * 24 * 60 * 60 * 1000,
        endMs: todayEndMs,
        dateLabel: 'Last 90 Days',
      };
    }

    if (datePreset === 'year') {
      const yearStartKey = `${currY}-01-01`;
      return {
        startMs: getStoreDayStartMs(yearStartKey),
        endMs: todayEndMs,
        dateLabel: 'This Year',
      };
    }

    if (datePreset === 'all') {
      return {
        startMs: getStoreDayStartMs('2020-01-01'),
        endMs: todayEndMs,
        dateLabel: 'All Time',
      };
    }

    if (datePreset === 'custom' && customStart) {
      const startMsVal = getStoreDayStartMs(customStart);
      const endMsVal = getStoreDayEndMs(customEnd || customStart);
      const sLabel = formatStoreDateFull(startMsVal);
      const eLabel = formatStoreDateFull(endMsVal);
      return {
        startMs: startMsVal,
        endMs: endMsVal,
        dateLabel: customStart === (customEnd || customStart) ? sLabel : `${sLabel} to ${eLabel}`,
      };
    }

    return {
      startMs: todayStartMs - 29 * 24 * 60 * 60 * 1000,
      endMs: todayEndMs,
      dateLabel: 'Last 30 Days',
    };
  }, [datePreset, customStart, customEnd]);

  // Load all channel orders concurrently with optional full channel API sync
  const loadFinancialData = useCallback(async (quiet = false, syncChannels = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      // 1. Webstore orders
      const webPromise = fetchOrdersDirect({ per_page: 500 });

      // 2. Shopee orders: sync live from Shopee API when requested; fallback to cached orders
      const shopeePromise = syncChannels
        ? syncShopeeOrdersDirect(60, 500).then(res => {
            if (res.success && Array.isArray(res.orders)) return res;
            return fetchShopeeOrdersDirect();
          }).catch(() => fetchShopeeOrdersDirect())
        : fetchShopeeOrdersDirect();

      // 3. TikTok orders: sync live from TikTok Shop API when requested; fallback to cached orders
      const tiktokPromise = syncChannels
        ? syncTikTokOrdersDirect(60, 500).then(res => {
            if (res.success && Array.isArray(res.orders)) return res;
            return fetchTikTokOrdersDirect();
          }).catch(() => fetchTikTokOrdersDirect())
        : fetchTikTokOrdersDirect();

      const [webRes, shpRes, ttRes] = await Promise.allSettled([
        webPromise,
        shopeePromise,
        tiktokPromise,
      ]);

      // Webstore orders
      if (webRes.status === 'fulfilled' && webRes.value.success && Array.isArray(webRes.value.orders)) {
        setWebOrders(webRes.value.orders);
      } else {
        setWebOrders([]);
      }

      // Shopee orders
      if (shpRes.status === 'fulfilled' && shpRes.value.success && Array.isArray(shpRes.value.orders)) {
        setShopeeOrders(shpRes.value.orders);
      } else {
        setShopeeOrders([]);
      }

      // TikTok orders
      if (ttRes.status === 'fulfilled' && ttRes.value.success && Array.isArray(ttRes.value.orders)) {
        setTikTokOrders(ttRes.value.orders);
      } else {
        setTikTokOrders([]);
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
            onClick={() => loadFinancialData(true, true)}
            disabled={isLoading || isRefreshing}
            className="min-h-11 px-3.5 rounded-xl border border-white/10 bg-[#121316] text-neutral-200 hover:bg-white/[0.06] hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Sync live Shopee and TikTok Shop APIs and refresh multi-channel financial ledger"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', (isLoading || isRefreshing) && 'animate-spin text-[#f3aa18]')} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
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
        subtitle={`Analyzing ${summary.totalOrders.toLocaleString()} verified paid orders (${summary.totalUnitsSold.toLocaleString()} units) across active channels (cancelled and unpaid excluded)`}
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
            {/* 1. Gross Product Sales */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px] border-[#f3aa18]/25 bg-[#f3aa18]/[0.02]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Gross Sales</CardEyebrow>
                <div className="p-2 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] transition-colors border border-[#f3aa18]/20">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                  {formatCurrency(summary.totalGrossRevenue, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  {summary.totalPaidThenCancelledGross > 0
                    ? `Incl. paid-cancelled (${summary.totalOrders + summary.totalPaidThenCancelledOrders}): ${formatCurrency(
                        summary.totalGrossRevenue + summary.totalPaidThenCancelledGross,
                        summary.primaryCurrency
                      )}`
                    : 'Product sales before platform vouchers'}
                </p>
              </div>
            </GlassCard>

            {/* 2. Buyer Paid (Out-of-Pocket Checkout Total) */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px] border-emerald-500/25 bg-emerald-500/[0.02]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Buyer Paid</CardEyebrow>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 transition-colors border border-emerald-500/20">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-400 tabular-nums">
                  {formatCurrency(summary.totalBuyerPaid, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  {summary.totalShippingAndFees > 0
                    ? `Includes +${formatCurrency(summary.totalShippingAndFees, summary.primaryCurrency)} ship & fees`
                    : 'Out-of-pocket buyer checkout total'}
                </p>
              </div>
            </GlassCard>

            {/* 3. Platform Vouchers & Seller Discounts */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Vouchers & Promos</CardEyebrow>
                <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-amber-500/10 text-neutral-400 group-hover:text-amber-400 transition-colors border border-white/[0.06]">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-amber-400 tabular-nums">
                  {formatCurrency(
                    summary.totalPlatformSubsidy + summary.totalSellerDiscount,
                    summary.primaryCurrency
                  )}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  Platform: {formatCurrency(summary.totalPlatformSubsidy, summary.primaryCurrency)} · Promo:{' '}
                  {formatCurrency(summary.totalSellerDiscount, summary.primaryCurrency)}
                </p>
              </div>
            </GlassCard>

            {/* 4. Total Paid Orders & Cancelled Info */}
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
                  {summary.totalCancelledOrders > 0
                    ? `Excl. ${summary.totalCancelledOrders} cancelled (${formatCurrency(
                        summary.totalCancelledGross,
                        summary.primaryCurrency
                      )})`
                    : `${summary.totalUnitsSold.toLocaleString()} units across ${selectedChannels.length} channels`}
                </p>
              </div>
            </GlassCard>

            {/* 5. Average Order Value & Units Sold */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[130px] col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <CardEyebrow>Avg Order Value</CardEyebrow>
                <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-purple-500/10 text-neutral-400 group-hover:text-purple-400 transition-colors border border-white/[0.06]">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                  {formatCurrency(summary.averageOrderValue, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                  {summary.totalUnitsSold.toLocaleString()} units · Paid AOV:{' '}
                  {formatCurrency(summary.averageBuyerPaidValue, summary.primaryCurrency)}
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
                totalRevenue={summary.totalGrossRevenue}
                totalBuyerPaid={summary.totalBuyerPaid}
              />
            </div>
            <div className="lg:col-span-1">
              <ChannelRevenueBreakdownCard
                breakdown={summary.channelBreakdown}
                totalNetRevenue={summary.totalGrossRevenue}
                selectedChannels={selectedChannels}
                onSelectChannelOnly={handleSelectChannelOnly}
              />
            </div>
          </div>

          {/* 8. Top Performing Skins & Models */}
          <section>
            <TopFinancialProductsCard
              products={summary.topProducts}
              totalNetRevenue={summary.totalGrossRevenue}
              primaryCurrency={summary.primaryCurrency}
            />
          </section>

          {/* 9. Financial Orders & Transactions Ledger */}
          <section>
            <FinancialLedgerTable
              records={summary.filteredRecords}
              allWindowRecords={summary.allWindowRecords}
              onExportCsv={handleExportCsv}
              primaryCurrency={summary.primaryCurrency}
            />
          </section>
        </>
      )}
    </div>
  );
};
