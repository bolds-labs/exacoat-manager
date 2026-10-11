import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
  formatStoreDateFull,
} from '../lib/formatters';
import { Order } from '../types';
import {
  RefreshCw,
  DollarSign,
  ShoppingBag,
  Wallet,
  CreditCard,
  Receipt,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ReportsPageProps {
  onNavigate?: (tab: string, filter?: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = () => {
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const [selectedChannels, setSelectedChannels] = useState<FinancialChannel[]>([
    'webstore',
    'shopee',
    'tiktok',
  ]);

  const [webOrders, setWebOrders] = useState<Order[]>([]);
  const [shopeeOrders, setShopeeOrders] = useState<ShopeeOrder[]>([]);
  const [tiktokOrders, setTikTokOrders] = useState<TikTokOrder[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const hasAutoSyncedEscrowRef = useRef(false);

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

  const loadFinancialData = useCallback(async (quiet = false, syncChannels = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const webPromise = fetchOrdersDirect({ per_page: 500 });

      const shopeePromise = syncChannels
        ? syncShopeeOrdersDirect(60, 500)
            .then(res => {
              if (res.success && Array.isArray(res.orders)) return res;
              return fetchShopeeOrdersDirect();
            })
            .catch(() => fetchShopeeOrdersDirect())
        : fetchShopeeOrdersDirect();

      const tiktokPromise = syncChannels
        ? syncTikTokOrdersDirect(60, 500)
            .then(res => {
              if (res.success && Array.isArray(res.orders)) return res;
              return fetchTikTokOrdersDirect();
            })
            .catch(() => fetchTikTokOrdersDirect())
        : fetchTikTokOrdersDirect();

      const [webRes, shpRes, ttRes] = await Promise.allSettled([
        webPromise,
        shopeePromise,
        tiktokPromise,
      ]);

      if (webRes.status === 'fulfilled' && webRes.value.success && Array.isArray(webRes.value.orders)) {
        setWebOrders(webRes.value.orders);
      } else {
        setWebOrders([]);
      }

      let loadedShopee: ShopeeOrder[] = [];
      if (shpRes.status === 'fulfilled' && shpRes.value.success && Array.isArray(shpRes.value.orders)) {
        loadedShopee = shpRes.value.orders;
        setShopeeOrders(loadedShopee);
      } else {
        setShopeeOrders([]);
      }

      let loadedTikTok: TikTokOrder[] = [];
      if (ttRes.status === 'fulfilled' && ttRes.value.success && Array.isArray(ttRes.value.orders)) {
        loadedTikTok = ttRes.value.orders;
        setTikTokOrders(loadedTikTok);
      } else {
        setTikTokOrders([]);
      }

      setLastRefreshedAt(new Date());

      // If cached marketplace orders do not yet have escrow fee details synced, trigger a background sync once
      if (!syncChannels && !hasAutoSyncedEscrowRef.current) {
        const needsShopeeEscrow = loadedShopee.some(
          o => o.pay_time && o.order_status !== 'CANCELLED' && !o.escrow_synced
        );
        const needsTikTokEscrow = loadedTikTok.some(
          o => o.pay_time && o.order_status !== 'CANCELLED' && !o.escrow_synced
        );
        if (needsShopeeEscrow || needsTikTokEscrow) {
          hasAutoSyncedEscrowRef.current = true;
          loadFinancialData(true, true);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load multi-channel financial data:', err);
      setError(err?.message || 'Could not synchronize financial data.');
    } finally {
      setIsLoading(false);
      if (syncChannels || hasAutoSyncedEscrowRef.current === false) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  const allRecords = useMemo(() => {
    const list: UnifiedFinancialRecord[] = [];
    webOrders.forEach(o => list.push(normalizeWebstoreOrder(o)));
    shopeeOrders.forEach(o => list.push(normalizeShopeeOrder(o)));
    tiktokOrders.forEach(o => list.push(normalizeTikTokOrder(o)));
    return list;
  }, [webOrders, shopeeOrders, tiktokOrders]);

  const summary = useMemo(() => {
    return aggregateFinancialMetrics(allRecords, selectedChannels, startMs, endMs);
  }, [allRecords, selectedChannels, startMs, endMs]);

  const handleToggleChannel = (ch: FinancialChannel) => {
    setSelectedChannels(prev => {
      if (prev.includes(ch)) {
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

  const totalSellerDeductions = summary.totalPlatformFees + summary.totalSellerVouchers;
  const effectiveFeeRatePct =
    summary.totalGrossRevenue > 0
      ? ((totalSellerDeductions / summary.totalGrossRevenue) * 100).toFixed(1)
      : '0.0';
  const cleanMarginPct =
    summary.totalGrossRevenue > 0
      ? ((summary.totalCleanRevenue / summary.totalGrossRevenue) * 100).toFixed(1)
      : '0.0';

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
            Gross product sales, marketplace fee deductions, and clean withdrawable payout ledger.
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
            title="Sync live Shopee and TikTok Shop orders & escrow settlement fees"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', (isLoading || isRefreshing) && 'animate-spin text-[#f3aa18]')} />
            <span>{isRefreshing ? 'Syncing Escrow...' : 'Refresh & Sync'}</span>
          </button>
        </div>
      </header>

      {/* 2. Timespan Horizon Selector */}
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
            Querying Webstore, Shopee, and TikTok Shop transactions and escrow settlements.
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
          {/* Executive Money KPI Cards (Left-to-Right Reconciliation Flow) */}
          <section
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 font-sans"
            aria-label="Executive financial metrics"
          >
            {/* 1. Gross Product Sales */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[132px] border-[#f3aa18]/25 bg-[#f3aa18]/[0.02]">
              <div className="flex items-center justify-between">
                <CardEyebrow>1. Gross Sales</CardEyebrow>
                <div className="p-2 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                  {formatCurrency(summary.totalGrossRevenue, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-1 leading-relaxed">
                  {summary.totalPaidThenCancelledGross > 0
                    ? `Incl. paid-cancelled (${summary.totalOrders + summary.totalPaidThenCancelledOrders}): ${formatCurrency(
                        summary.totalGrossRevenue + summary.totalPaidThenCancelledGross,
                        summary.primaryCurrency
                      )}`
                    : 'Product selling price before fees'}
                </p>
              </div>
            </GlassCard>

            {/* 2. Platform Fees & Seller Deductions */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[132px] border-rose-500/20 bg-rose-500/[0.02]">
              <div className="flex items-center justify-between">
                <CardEyebrow>2. Platform Fees</CardEyebrow>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-rose-400 tabular-nums">
                  {totalSellerDeductions > 0
                    ? `-${formatCurrency(totalSellerDeductions, summary.primaryCurrency)}`
                    : formatCurrency(0, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-400 mt-1 leading-relaxed">
                  {totalSellerDeductions > 0
                    ? `${effectiveFeeRatePct}% take rate (Admin, Service, Trans, AMS)`
                    : isRefreshing
                    ? 'Syncing marketplace escrow fee breakdown...'
                    : 'Admin, service, transaction & seller vouchers'}
                </p>
              </div>
            </GlassCard>

            {/* 3. Clean Revenue (Withdrawable Payout) */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[132px] border-emerald-500/30 bg-emerald-500/[0.03]">
              <div className="flex items-center justify-between">
                <CardEyebrow>3. Clean Revenue</CardEyebrow>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-emerald-400 tabular-nums">
                  {formatCurrency(summary.totalCleanRevenue, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-neutral-300 mt-1 leading-relaxed">
                  Withdrawable payout ({cleanMarginPct}% net of gross)
                </p>
              </div>
            </GlassCard>

            {/* 4. Buyer Checkout & Platform Voucher Subsidy */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[132px]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Buyer Checkout</CardEyebrow>
                <div className="p-2 rounded-xl bg-white/[0.04] text-sky-400 border border-white/[0.06]">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                  {formatCurrency(summary.totalBuyerPaid, summary.primaryCurrency)}
                </p>
                <p className="text-[10px] font-mono text-amber-400/90 mt-1 leading-relaxed">
                  {summary.totalPlatformSubsidy > 0
                    ? `Buyer Vouchers (Platform): -${formatCurrency(summary.totalPlatformSubsidy, summary.primaryCurrency)}`
                    : 'Out-of-pocket buyer payment'}
                </p>
              </div>
            </GlassCard>

            {/* 5. Paid Orders, Units & Clean AOV */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[132px]">
              <div className="flex items-center justify-between">
                <CardEyebrow>Paid Orders & AOV</CardEyebrow>
                <div className="p-2 rounded-xl bg-white/[0.04] text-neutral-300 border border-white/[0.06]">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
                    {summary.totalOrders.toLocaleString()}
                  </p>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {summary.totalUnitsSold.toLocaleString()} units
                  </span>
                </div>
                <p className="text-[10px] font-mono text-neutral-400 mt-1 leading-relaxed">
                  Clean AOV: {formatCurrency(summary.averageCleanOrderValue, summary.primaryCurrency)}
                  {summary.totalCancelledOrders > 0 ? ` · Excl. ${summary.totalCancelledOrders} cancel` : ''}
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
                totalCleanRevenue={summary.totalCleanRevenue}
                totalPlatformFees={totalSellerDeductions}
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
