import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarRange, Layers, Loader2, RefreshCw, Trophy } from 'lucide-react';
import type { DatePreset } from '../components/ui/DateRangePicker';
import { Button } from '../components/ds/Button';
import { Card } from '../components/ds/Card';
import { KpiCard } from '../components/ds/KpiCard';
import { Select } from '../components/ds/Select';
import { Tabs } from '../components/ds/Tabs';
import { TextField } from '../components/ds/TextField';
import { ChangeChip } from '../components/dashboard/ChangeChip';
import { CHANNEL_DOT } from '../components/dashboard/ChannelSalesList';
import { ChannelReconciliationCard } from '../components/analytics/ChannelReconciliationCard';
import { RevenueChart } from '../components/analytics/RevenueChart';
import { TopProductsList } from '../components/analytics/TopProductsList';
import { FinancialLedgerTable } from '../components/analytics/FinancialLedgerTable';
import { FinancialChannel, exportFinancialReportToCsv } from '../lib/financialAnalyticsService';
import { ALL_CHANNELS, CHANNEL_LABELS, buildPeriodComparison, useFinancialMetrics } from '../hooks/useFinancialMetrics';
import { periodWindows, previousPeriodLabel, previousWindowFor, requiredSyncDays, type ComparePreset, type TimeWindow } from '../lib/periodComparison';
import { joinList } from '../lib/listFormat';
import { formatCurrency, getStoreDateKey, getStoreDayStartMs, getStoreDayEndMs, formatStoreDateFull } from '../lib/formatters';

interface ReportsPageProps {
  onNavigate?: (tab: string, filter?: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const MAIN_RANGES: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'this_month', label: 'This month' },
];
const MORE_RANGES: { value: DatePreset; label: string }[] = [
  { value: 'last_month', label: 'Last month' },
  { value: '90d', label: '90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];
/** Ranges the Dashboard also offers: same windows on both pages. */
const COMPARE_PRESETS: DatePreset[] = ['today', '7d', '30d', 'this_month'];

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigate }) => {
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedChannels, setSelectedChannels] = useState<FinancialChannel[]>(['webstore', 'shopee', 'tiktok']);

  const { startMs, endMs, dateLabel } = useMemo(() => {
    const todayKey = getStoreDateKey(Date.now());
    const todayStartMs = getStoreDayStartMs(todayKey);
    const todayEndMs = getStoreDayEndMs(todayKey);
    const [currY, currM] = todayKey.split('-').map(Number);

    if (datePreset === 'today') return { startMs: todayStartMs, endMs: todayEndMs, dateLabel: 'Today' };
    if (datePreset === '7d') return { startMs: todayStartMs - 6 * DAY_MS, endMs: todayEndMs, dateLabel: 'Last 7 Days' };
    if (datePreset === '30d') return { startMs: todayStartMs - 29 * DAY_MS, endMs: todayEndMs, dateLabel: 'Last 30 Days' };
    if (datePreset === 'this_month') {
      const monthStartKey = `${currY}-${String(currM).padStart(2, '0')}-01`;
      return { startMs: getStoreDayStartMs(monthStartKey), endMs: todayEndMs, dateLabel: 'This Month' };
    }
    if (datePreset === 'last_month') {
      const prevY = currM === 1 ? currY - 1 : currY;
      const prevM = currM === 1 ? 12 : currM - 1;
      const daysInPrevMonth = new Date(Date.UTC(currY, currM - 1, 0)).getUTCDate();
      const lastMonthStartKey = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
      const lastMonthEndKey = `${prevY}-${String(prevM).padStart(2, '0')}-${String(daysInPrevMonth).padStart(2, '0')}`;
      return { startMs: getStoreDayStartMs(lastMonthStartKey), endMs: getStoreDayEndMs(lastMonthEndKey), dateLabel: 'Last Month' };
    }
    if (datePreset === '90d') return { startMs: todayStartMs - 89 * DAY_MS, endMs: todayEndMs, dateLabel: 'Last 90 Days' };
    if (datePreset === 'year') return { startMs: getStoreDayStartMs(`${currY}-01-01`), endMs: todayEndMs, dateLabel: 'This Year' };
    if (datePreset === 'all') return { startMs: getStoreDayStartMs('2020-01-01'), endMs: todayEndMs, dateLabel: 'All Time' };
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
    return { startMs: todayStartMs - 29 * DAY_MS, endMs: todayEndMs, dateLabel: 'Last 30 Days' };
  }, [datePreset, customStart, customEnd]);

  // Days the marketplace sync must cover for the selected range (2-day buffer, 7 to 365 days)
  const requiredHorizonDays = useMemo(() => {
    const days = Math.ceil(Math.max(0, Date.now() - startMs) / DAY_MS);
    return Math.max(7, Math.min(365, days + 2));
  }, [startMs]);

  const {
    records: allRecords,
    shopeeOrders,
    oldestByChannel,
    failedChannels,
    isLoading,
    isRefreshing,
    error,
    lastRefreshedAt,
    reload,
  } = useFinancialMetrics({ horizonDays: requiredHorizonDays, autoSyncEscrow: true });

  const loadFinancialData = (quiet = false, syncChannels = false, days?: number) => reload({ quiet, syncChannels, days });

  // Shopee cache coverage against the selected range (cache keeps a limited window)
  const shopeeCoverage = useMemo(() => {
    const timestamps = shopeeOrders.map((o) => (o.create_timestamp ? o.create_timestamp * 1000 : 0)).filter((t) => t > 0);
    if (timestamps.length === 0) return { hasOrders: false, oldestMs: 0, coverageDays: 0, missingCoverage: false };
    const oldestMs = Math.min(...timestamps);
    const coverageDays = Math.max(1, Math.floor((Date.now() - oldestMs) / DAY_MS));
    // Range starts more than a day before the oldest cached Shopee order
    const missingCoverage = startMs < oldestMs - DAY_MS;
    return { hasOrders: true, oldestMs, coverageDays, missingCoverage };
  }, [shopeeOrders, startMs]);

  // Same windows as the Dashboard for its four ranges; other ranges compare with the same length before
  const now = lastRefreshedAt ? lastRefreshedAt.getTime() : Date.now();
  const previousWindow: TimeWindow | null = useMemo(() => {
    if (datePreset === 'all') return null;
    if (COMPARE_PRESETS.includes(datePreset)) return periodWindows(datePreset as ComparePreset, now).previous;
    return previousWindowFor({ startMs, endMs }, now);
  }, [datePreset, startMs, endMs, now]);

  // Refresh and sync must also load the previous window, or comparisons can never appear
  const syncDays = useMemo(() => requiredSyncDays(startMs, previousWindow ? previousWindow.startMs : null, Date.now()), [startMs, previousWindow]);

  const comparison = useMemo(
    () => buildPeriodComparison(allRecords, selectedChannels, { startMs, endMs }, previousWindow, oldestByChannel, failedChannels),
    [allRecords, selectedChannels, startMs, endMs, previousWindow, oldestByChannel, failedChannels],
  );
  const summary = comparison.current;
  const currency = summary.primaryCurrency || 'IDR';
  const money = (v: number) => formatCurrency(v, currency);
  const count = (v: number) => v.toLocaleString('en-US');
  const prevLabel = previousPeriodLabel(datePreset);

  const handleToggleChannel = (ch: FinancialChannel) => {
    setSelectedChannels((prev) => {
      if (prev.includes(ch)) return prev.length === 1 ? prev : prev.filter((c) => c !== ch);
      return ALL_CHANNELS.filter((c) => c === ch || prev.includes(c));
    });
  };

  const handleExportCsv = () => exportFinancialReportToCsv(summary, dateLabel);

  const totalSellerDeductions = summary.totalPlatformFees + summary.totalSellerVouchers;
  const pctOfGross = (v: number) => (summary.totalGrossRevenue > 0 ? ((v / summary.totalGrossRevenue) * 100).toFixed(1) : '0.0');
  const busy = isLoading || isRefreshing;
  const caption = (text: string) => <span className="text-[12px] text-faint">{text}</span>;
  const chip = (key: 'sales' | 'orders' | 'aov' | 'payout') =>
    previousWindow && comparison.comparable ? (
      <ChangeChip comparison={comparison.metrics[key]} periodLabel={prevLabel} formatValue={key === 'orders' ? count : money} />
    ) : null;
  const moreValue = MORE_RANGES.some((r) => r.value === datePreset) ? datePreset : '';
  const allSelected = selectedChannels.length === ALL_CHANNELS.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg">Sales &amp; Reports</h1>
          <p className="mt-0.5 text-[14px] text-muted">Gross sales, marketplace fees and the payout you can withdraw, for every channel.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {lastRefreshedAt && (
            <span className="hidden text-[12px] text-faint md:inline">
              Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {onNavigate && (
            <Button icon={Layers} onClick={() => onNavigate('skin_performance')}>
              Skin analytics
            </Button>
          )}
          <Button
            icon={RefreshCw}
            onClick={() => loadFinancialData(true, true, syncDays)}
            disabled={busy}
            className={busy ? '[&>svg:first-child]:animate-spin' : ''}
            title={`Pull Shopee and TikTok Shop orders and escrow for ${dateLabel} and the period before (${syncDays} days)`}
          >
            {isRefreshing ? `Syncing ${syncDays} days...` : 'Refresh and sync'}
          </Button>
        </div>
      </div>

      {/* Range and channels */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs items={MAIN_RANGES} value={datePreset} onChange={(k) => setDatePreset(k as DatePreset)} />
          <Select
            aria-label="More date ranges"
            className="w-[150px]"
            value={moreValue}
            onChange={(v) => {
              if (!v) return;
              if (v === 'custom' && !customStart) {
                const today = getStoreDateKey(Date.now());
                setCustomStart(today);
                setCustomEnd(today);
              }
              setDatePreset(v as DatePreset);
            }}
            options={[{ value: '', label: 'More ranges' }, ...MORE_RANGES]}
          />
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <TextField
                aria-label="From"
                type="date"
                className="w-[150px]"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span className="text-[13px] text-faint">to</span>
              <TextField
                aria-label="To"
                type="date"
                className="w-[150px]"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          )}

          <div className="ml-auto inline-flex flex-wrap items-center gap-1 rounded-[12px] border border-line bg-chip p-1" role="group" aria-label="Channels">
            <button
              type="button"
              aria-pressed={allSelected}
              onClick={() => setSelectedChannels([...ALL_CHANNELS])}
              className={`rounded-[9px] border px-3 py-[6px] text-[13px] font-[450] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                allSelected ? 'border-field-border bg-field text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              All channels
            </button>
            {ALL_CHANNELS.map((ch) => {
              const on = selectedChannels.includes(ch) && !allSelected;
              return (
                <button
                  key={ch}
                  type="button"
                  aria-pressed={on}
                  onClick={() => (allSelected ? setSelectedChannels([ch]) : handleToggleChannel(ch))}
                  title={allSelected ? `Show only ${CHANNEL_LABELS[ch]}` : `Add or remove ${CHANNEL_LABELS[ch]}`}
                  className={`flex items-center gap-2 rounded-[9px] border px-3 py-[6px] text-[13px] font-[450] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    on ? 'border-field-border bg-field text-fg' : 'border-transparent text-muted hover:text-fg'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${CHANNEL_DOT[ch]}`} aria-hidden />
                  {CHANNEL_LABELS[ch]}
                </button>
              );
            })}
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 px-1 text-[12px] text-faint">
          <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          {dateLabel}: {count(summary.totalOrders)} paid orders ({count(summary.totalUnitsSold)} units)
          {previousWindow
            ? `, compared with ${datePreset === 'today' ? 'yesterday' : `the ${prevLabel}`} (${formatStoreDateFull(previousWindow.startMs)} to ${formatStoreDateFull(previousWindow.endMs)}).`
            : '.'}{' '}
          Cancelled, refunded and unpaid orders are left out.
        </p>
      </div>

      {/* Shopee history notice */}
      {!isLoading && !error && selectedChannels.includes('shopee') && shopeeCoverage.missingCoverage && (
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-st-wait-border bg-st-wait-bg px-4 py-3" role="status">
          <AlertTriangle className="h-4 w-4 flex-none text-st-wait-fg" strokeWidth={1.8} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">Shopee orders are cached for the latest {shopeeCoverage.coverageDays} days only</p>
            <p className="text-[12.5px] text-muted">
              {dateLabel} reaches further back, so Shopee totals are incomplete. Sync to fetch older orders and escrow from the Shopee API.
            </p>
          </div>
          <Button
            variant="primary"
            icon={RefreshCw}
            onClick={() => loadFinancialData(true, true, syncDays)}
            disabled={isRefreshing}
            className={isRefreshing ? '[&>svg:first-child]:animate-spin' : ''}
          >
            {isRefreshing ? 'Syncing Shopee...' : `Sync ${syncDays} days from Shopee`}
          </Button>
        </div>
      )}
      {!isLoading && !error && failedChannels.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-st-wait-border bg-st-wait-bg px-4 py-2.5 text-[13px] text-st-wait-fg" role="status">
          <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden />
          {joinList(failedChannels.map((c) => CHANNEL_LABELS[c]))} could not be loaded. The numbers below leave {failedChannels.length > 1 ? 'them' : 'it'} out.
        </div>
      )}

      {isLoading && (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 rounded-[14px] border border-card-border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-accent-fg" aria-hidden />
          <p className="text-[13.5px] text-fg">Loading sales for {dateLabel}...</p>
          <p className="text-[12.5px] text-muted">Webstore, Shopee and TikTok Shop orders and escrow settlements.</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-[14px] border border-card-border bg-card p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-st-stop-fg" strokeWidth={1.8} aria-hidden />
          <h2 className="text-[15px] font-semibold text-fg">Could not load sales</h2>
          <p className="max-w-md text-[13px] text-muted">{error}</p>
          <Button variant="primary" className="mt-2" onClick={() => loadFinancialData(false)}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* KPIs */}
          <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-3 min-[1700px]:grid-cols-6">
            <KpiCard
              label="Gross sales"
              value={money(summary.totalGrossRevenue)}
              footer={
                <>
                  {chip('sales')}
                  {summary.totalPaidThenCancelledGross > 0 &&
                    caption(`${money(summary.totalGrossRevenue + summary.totalPaidThenCancelledGross)} with paid then cancelled`)}
                </>
              }
            />
            <KpiCard
              label="Paid orders"
              value={count(summary.totalOrders)}
              footer={
                <>
                  {chip('orders')}
                  {caption(
                    `${count(summary.totalUnitsSold)} units${summary.totalCancelledOrders > 0 ? `, ${count(summary.totalCancelledOrders)} cancelled left out` : ''}`,
                  )}
                </>
              }
            />
            <KpiCard
              label="Avg order value"
              value={money(summary.averageOrderValue)}
              footer={
                <>
                  {chip('aov')}
                  {caption(`Payout per order ${money(summary.averageCleanOrderValue)}`)}
                </>
              }
            />
            <KpiCard
              label="Platform fees and vouchers"
              value={
                <span className={totalSellerDeductions > 0 ? 'text-st-stop-fg' : ''}>
                  {totalSellerDeductions > 0 ? `-${money(totalSellerDeductions)}` : money(0)}
                </span>
              }
              footer={caption(
                totalSellerDeductions > 0
                  ? `${pctOfGross(totalSellerDeductions)}% of gross (admin, service, transaction, AMS)`
                  : isRefreshing
                    ? 'Syncing marketplace fee details...'
                    : 'Admin, service, transaction and seller vouchers',
              )}
            />
            <KpiCard
              label="Payout after fees"
              value={<span className="text-st-done-fg">{money(summary.totalCleanRevenue)}</span>}
              footer={
                <>
                  {chip('payout')}
                  {caption(`${pctOfGross(summary.totalCleanRevenue)}% of gross, withdrawable`)}
                </>
              }
            />
            <KpiCard
              label="Buyer paid at checkout"
              value={money(summary.totalBuyerPaid)}
              footer={caption(
                summary.totalPlatformSubsidy > 0 ? `Platform buyer vouchers -${money(summary.totalPlatformSubsidy)}` : 'What buyers paid out of pocket',
              )}
            />
          </section>

          {/* Chart and top products */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RevenueChart timeline={summary.timeline} selectedChannels={selectedChannels} channelLabels={CHANNEL_LABELS} currency={currency} />
            </div>
            <Card icon={Trophy} title="Top products" count={Math.min(10, summary.topProducts.length)}>
              <TopProductsList
                products={summary.topProducts}
                currency={currency}
                limit={10}
                totalSales={summary.totalGrossRevenue}
                showChannels
                channelLabels={CHANNEL_LABELS}
              />
            </Card>
          </div>

          {/* Channel reconciliation */}
          <section aria-label="Channel reconciliation" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {ALL_CHANNELS.map((ch) => (
              <ChannelReconciliationCard
                key={ch}
                label={CHANNEL_LABELS[ch]}
                dotClass={CHANNEL_DOT[ch]}
                metric={summary.channelBreakdown[ch]}
                currency={currency}
                change={previousWindow && comparison.comparable ? comparison.channelSales[ch] : undefined}
                periodLabel={prevLabel}
                selected={selectedChannels.includes(ch)}
                failed={failedChannels.includes(ch)}
                onShowOnly={selectedChannels.length === 1 && selectedChannels[0] === ch ? undefined : () => setSelectedChannels([ch])}
              />
            ))}
          </section>

          <FinancialLedgerTable
            records={summary.filteredRecords}
            allWindowRecords={summary.allWindowRecords}
            onExportCsv={handleExportCsv}
            primaryCurrency={currency}
          />
        </>
      )}
    </div>
  );
};
