import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ChevronRight,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import type { OrderCounts } from '../types';
import { Card } from '../components/ds/Card';
import { KpiCard } from '../components/ds/KpiCard';
import { Tabs } from '../components/ds/Tabs';
import { IconButton } from '../components/ds/IconButton';
import { ChangeChip } from '../components/dashboard/ChangeChip';
import { ChannelSalesList } from '../components/dashboard/ChannelSalesList';
import { SalesTrendChart } from '../components/dashboard/SalesTrendChart';
import { TopProductsList } from '../components/analytics/TopProductsList';
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  buildPeriodComparison,
  useFinancialMetrics,
  type ComparedMetricKey,
} from '../hooks/useFinancialMetrics';
import { hasHistory, periodWindows, previousPeriodLabel, type ComparePreset } from '../lib/periodComparison';
import { buildTrendSeries } from '../lib/trendSeries';
import { formatCurrency, formatStoreDateFull } from '../lib/formatters';
import { formatCompactMoney } from '../lib/compactMoney';
import { joinList } from '../lib/listFormat';

const PERIOD_KEY = 'exacoat_dashboard_period';
const PERIODS: { key: ComparePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'this_month', label: 'This month' },
];

const readPeriod = (): ComparePreset => {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    if (PERIODS.some((p) => p.key === v)) return v as ComparePreset;
  } catch {
    /* storage blocked: use the default */
  }
  return '7d';
};

interface DashboardPageProps {
  onNavigate: (tab: any, filter?: string) => void;
  /** Store-wide order counts from App (shared with the sidebar badges); null until they load. */
  orderCounts?: OrderCounts | null;
  /** Processing-order count App reads when the counts endpoint is unavailable (same as the sidebar badge). */
  fallbackPaymentConfirmed?: number;
  onRefreshCounts?: () => Promise<void> | void;
}

const dateRange = (startMs: number, endMs: number) => {
  const a = formatStoreDateFull(startMs);
  const b = formatStoreDateFull(endMs);
  return a === b ? a : `${a} to ${b}`;
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, orderCounts = null, fallbackPaymentConfirmed, onRefreshCounts }) => {
  const [period, setPeriod] = useState<ComparePreset>(readPeriod);
  const { records, oldestByChannel, failedChannels, isLoading, isRefreshing, error, lastRefreshedAt, reload } = useFinancialMetrics();

  const choosePeriod = (key: string) => {
    setPeriod(key as ComparePreset);
    try {
      localStorage.setItem(PERIOD_KEY, key);
    } catch {
      /* per-viewer convenience only */
    }
  };

  const now = useMemo(() => (lastRefreshedAt ? lastRefreshedAt.getTime() : Date.now()), [lastRefreshedAt]);
  const windows = useMemo(() => periodWindows(period, now), [period, now]);
  const result = useMemo(
    () => buildPeriodComparison(records, ALL_CHANNELS, windows.current, windows.previous, oldestByChannel, failedChannels),
    [records, windows, oldestByChannel, failedChannels],
  );
  const trend = useMemo(
    () => buildTrendSeries(result.current, result.previous, windows, result.covered, now),
    [result, windows, now],
  );

  const s = result.current;
  const currency = s.primaryCurrency || 'IDR';
  const prevLabel = previousPeriodLabel(period);
  const money = (v: number) => formatCurrency(v, currency);
  const count = (v: number) => v.toLocaleString('en-US');
  const ready = !isLoading;
  const missingHistory = ALL_CHANNELS.filter((ch) => !failedChannels.includes(ch) && !hasHistory(oldestByChannel[ch], windows.previous.startMs));

  const kpis: { key: ComparedMetricKey; label: string; value: number; format: (v: number) => string; display: string }[] = [
    { key: 'sales', label: 'Sales', value: s.totalGrossRevenue, format: money, display: formatCompactMoney(s.totalGrossRevenue, currency) },
    { key: 'orders', label: 'Orders', value: s.totalOrders, format: count, display: count(s.totalOrders) },
    { key: 'aov', label: 'Avg order value', value: s.averageOrderValue, format: money, display: formatCompactMoney(s.averageOrderValue, currency) },
    { key: 'payout', label: 'Payout after fees', value: s.totalCleanRevenue, format: money, display: formatCompactMoney(s.totalCleanRevenue, currency) },
    { key: 'units', label: 'Items sold', value: s.totalUnitsSold, format: count, display: count(s.totalUnitsSold) },
  ];

  const attention = [
    {
      icon: Package,
      label: 'Payment confirmed',
      hint: 'Paid webstore orders to prepare',
      value: orderCounts?.webstore.to_prepare ?? fallbackPaymentConfirmed,
      onClick: () => onNavigate('orders', 'processing'),
    },
    {
      icon: ShieldCheck,
      label: 'Warranty to review',
      hint: 'Claims waiting for a decision',
      value: orderCounts?.webstore.warranty_pending,
      onClick: () => onNavigate('rma'),
    },
  ];

  const links = [
    { icon: BarChart3, label: 'Full sales report', hint: 'Fees, payouts and every order', tab: 'reports' },
    { icon: ShoppingBag, label: 'Orders', hint: 'Prepare, pack and ship', tab: 'orders' },
    { icon: Star, label: 'Reviews', hint: 'Customer ratings', tab: 'reviews' },
    { icon: Activity, label: 'Store health', hint: 'API and connection checks', tab: 'health' },
  ];

  const busy = isLoading || isRefreshing;

  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-fg">Dashboard</h1>
          <p className="mt-0.5 text-[14px] text-muted">Sales across the webstore, Shopee and TikTok Shop, compared with the period before.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Tabs items={PERIODS} value={period} onChange={choosePeriod} />
          <IconButton
            icon={RefreshCw}
            label="Refresh"
            onClick={() => {
              void onRefreshCounts?.();
              void reload({ quiet: true });
            }}
            disabled={busy}
            className={busy ? '[&>svg]:animate-spin' : ''}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-st-stop-border bg-st-stop-bg px-4 py-2.5 text-[13px] text-st-stop-fg" role="alert">
          <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden />
          Could not load sales: {error}
        </div>
      )}
      {ready && failedChannels.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-[12px] border border-st-wait-border bg-st-wait-bg px-4 py-2.5 text-[13px] text-st-wait-fg" role="status">
          <AlertTriangle className="h-4 w-4 flex-none" strokeWidth={1.8} aria-hidden />
          {joinList(failedChannels.map((c) => CHANNEL_LABELS[c]))} could not be loaded. The numbers below leave {failedChannels.length > 1 ? 'them' : 'it'} out.
        </div>
      )}

      {/* KPIs */}
      <section aria-label="Key numbers" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => (
            <KpiCard
              key={k.key}
              label={k.label}
              value={ready ? <span title={k.format(k.value)}>{k.display}</span> : <span className="text-faint">-</span>}
              footer={ready && result.comparable ? <ChangeChip comparison={result.metrics[k.key]} periodLabel={prevLabel} formatValue={k.format} /> : undefined}
            />
          ))}
        </div>
        <p className="px-1 text-[12px] text-faint">
          {dateRange(windows.current.startMs, Math.min(now, windows.current.endMs))} compared with {period === 'today' ? 'yesterday' : `the ${prevLabel}`} ({dateRange(windows.previous.startMs, windows.previous.endMs)}), up to the same time.
          {ready && missingHistory.length > 0 &&
            ` Loaded ${joinList(missingHistory.map((c) => CHANNEL_LABELS[c]))} orders do not reach back that far, so there is no comparison.`}
          {' '}Cancelled, refunded and unpaid orders are left out.
        </p>
      </section>

      {/* Trend and channels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          icon={TrendingUp}
          title={trend.hourly ? 'Sales so far today' : 'Sales by day'}
          className="flex flex-col lg:col-span-2"
          actions={
            <div className="flex items-center gap-3 text-[12px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 rounded-full bg-accent-fg" aria-hidden />
                This period
              </span>
              {trend.points.some((p) => p.previous !== null) && (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-faint" aria-hidden />
                  {prevLabel.charAt(0).toUpperCase() + prevLabel.slice(1)}
                </span>
              )}
            </div>
          }
        >
          {ready ? (
            <div className="min-h-0 flex-1">
              <SalesTrendChart points={trend.points} currency={currency} previousName={prevLabel} fill />
            </div>
          ) : (
            <div className="grid h-[184px] place-items-center text-[13px] text-muted">Loading sales...</div>
          )}
        </Card>
        <Card icon={Store} title="Sales by channel">
          {ready ? (
            <ChannelSalesList
              channels={ALL_CHANNELS}
              breakdown={s.channelBreakdown}
              changes={result.channelSales}
              currency={currency}
              periodLabel={prevLabel}
              failedChannels={failedChannels}
              labels={CHANNEL_LABELS}
            />
          ) : (
            <div className="grid h-[180px] place-items-center text-[13px] text-muted">Loading channels...</div>
          )}
        </Card>
      </div>

      {/* Products, attention, links */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card
          icon={Trophy}
          title="Top products"
          actions={
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="flex items-center gap-1 rounded-[7px] px-1.5 py-1 text-[12.5px] text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Full report
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            </button>
          }
        >
          {ready ? (
            <TopProductsList products={s.topProducts} currency={currency} limit={5} />
          ) : (
            <div className="grid h-[180px] place-items-center text-[13px] text-muted">Loading products...</div>
          )}
        </Card>

        <Card icon={AlertTriangle} title="Needs attention">
          <ul className="flex flex-col gap-2">
            {attention.map((a) => (
              <li key={a.label}>
                <button
                  type="button"
                  onClick={a.onClick}
                  className="group flex w-full items-center gap-3 rounded-[10px] border border-line px-3 py-2.5 text-left transition-colors hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-st-act-bg text-st-act-fg">
                    <a.icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-fg">{a.label}</span>
                    <span className="block text-[12px] text-muted">{a.hint}</span>
                  </span>
                  {typeof a.value === 'number' && (
                    <span className="font-mono text-[18px] font-medium text-fg">{a.value.toLocaleString('en-US')}</span>
                  )}
                  <ChevronRight className="h-4 w-4 flex-none text-faint group-hover:text-fg" strokeWidth={1.8} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card icon={ArrowRight} title="Quick links" className="md:col-span-2 xl:col-span-1">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {links.map((l) => (
              <li key={l.tab}>
                <button
                  type="button"
                  onClick={() => onNavigate(l.tab)}
                  className="group flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-chip text-muted">
                    <l.icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-fg">{l.label}</span>
                    <span className="block text-[12px] text-muted">{l.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-faint group-hover:text-fg" strokeWidth={1.8} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};
