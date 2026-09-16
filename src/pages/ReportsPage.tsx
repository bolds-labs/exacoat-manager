import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  ShoppingBag,
  UserCheck,
  X,
} from 'lucide-react';
import { DateRangePicker, DatePreset } from '../components/ui/DateRangePicker';
import { GlassCard } from '../components/ui/GlassCard';
import { CardEyebrow } from '../components/ui/CardEyebrow';
import {
  fetchSalesAnalytics,
  SalesAnalyticsCurrency,
  SalesAnalyticsProduct,
} from '../lib/wordpressBridge';
import {
  formatCurrency,
} from '../lib/formatters';
import { clsx } from 'clsx';

interface ReportsPageProps {
  onNavigate?: (tab: string) => void;
}

const formatIsoDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const compactCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

export const ReportsPage: React.FC<ReportsPageProps> = ({
  onNavigate,
}) => {
  // Time horizon preset matching DashboardPage
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const [currencies, setCurrencies] = useState<SalesAnalyticsCurrency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestKey, setRequestKey] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Lightbox modal for skin inspection
  const [previewProduct, setPreviewProduct] = useState<{
    product: SalesAnalyticsProduct;
  } | null>(null);

  // Customer email copy notification state
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Toggle to show all customers vs top 5
  const [showAllCustomers, setShowAllCustomers] = useState(false);

  // Compute startDate and endDate string based on preset
  const { startDate, endDate, dateLabel } = useMemo(() => {
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
      label = 'All Time (Lifetime)';
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
      startDate: formatIsoDate(start),
      endDate: formatIsoDate(end),
      dateLabel: label,
    };
  }, [datePreset, customStart, customEnd]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError('');

    fetchSalesAnalytics(startDate, endDate).then(result => {
      if (!active) return;
      if (!result.success) {
        setCurrencies([]);
        setError(result.error || 'Sales analytics could not be loaded.');
        setIsLoading(false);
        return;
      }

      setCurrencies(result.currencies);
      setSelectedCurrency(current =>
        result.currencies.some(item => item.currency === current)
          ? current
          : (result.currencies[0]?.currency || '')
      );
      setLastRefreshedAt(new Date());
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [startDate, endDate, requestKey]);

  // Selected currency dataset
  const analytics = useMemo(
    () => currencies.find(item => item.currency === selectedCurrency) || currencies[0],
    [currencies, selectedCurrency]
  );

  // Sparkline data for net revenue trend
  const sparklineData = useMemo(() => {
    if (!analytics?.timeline || analytics.timeline.length < 2) {
      return [{ value: 0 }, { value: 0 }];
    }
    return analytics.timeline.map(t => ({ value: t.revenue }));
  }, [analytics]);

  // Calculate repeat buyer stats
  const repeatCustomerStats = useMemo(() => {
    if (!analytics?.top_customers || analytics.top_customers.length === 0) {
      return { repeatCount: 0, repeatRate: 0 };
    }
    const repeatBuyers = analytics.top_customers.filter(c => c.orders > 1);
    const rate = analytics.summary.unique_customers > 0
      ? Math.round((repeatBuyers.length / analytics.summary.unique_customers) * 100)
      : 0;
    return {
      repeatCount: repeatBuyers.length,
      repeatRate: rate,
    };
  }, [analytics]);

  // Handle email copying
  const copyEmailToClipboard = (email: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2200);
  };

  const topCountryRevenue = analytics?.countries[0]?.revenue || 0;

  return (
    <div className="space-y-6">
      {/* 1. Dashboard-Style Header & Breadcrumb */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Manager / Sales Reports
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08]">
              {dateLabel}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Sales & Revenue Analytics
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Store performance, net margins, fulfillment volume, and buyer intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {lastRefreshedAt && (
            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 hidden md:inline-block">
              Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => setRequestKey(k => k + 1)}
            disabled={isLoading}
            className="min-h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/[0.08] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh sales data"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* 2. Platform Standard Date Horizon Toolbar */}
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
        subtitle={
          analytics
            ? `Analyzing ${analytics.summary.orders.toLocaleString()} paid orders, ${analytics.summary.items_sold.toLocaleString()} skins sold, and ${analytics.summary.unique_customers.toLocaleString()} unique buyers`
            : 'Analyzing store sales performance'
        }
      />

      {/* Currency Switcher Tabs (when store has multi-currency orders) */}
      {currencies.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Order currency selection">
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 shrink-0 mr-1">
            Order Currency:
          </span>
          {currencies.map(item => (
            <button
              type="button"
              key={item.currency}
              onClick={() => setSelectedCurrency(item.currency)}
              className={clsx(
                'min-h-9 px-3.5 rounded-lg border text-xs font-semibold shrink-0 transition-all cursor-pointer',
                selectedCurrency === item.currency
                  ? 'bg-zinc-950 border-zinc-950 text-white dark:bg-white dark:border-white dark:text-zinc-950 shadow-xs'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 dark:bg-white/[0.03] dark:border-white/10 dark:text-zinc-300 dark:hover:border-white/20'
              )}
            >
              {item.currency} ({item.summary.orders} {item.summary.orders === 1 ? 'order' : 'orders'})
            </button>
          ))}
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 ml-auto hidden sm:inline-block">
            Currencies are accounted separately without synthetic conversions.
          </span>
        </div>
      )}

      {/* 3. Loading State */}
      {isLoading && (
        <div className="min-h-[420px] flex flex-col items-center justify-center gap-3" role="status">
          <Loader2 className="w-7 h-7 animate-spin text-[#f3aa18]" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Fetching sales analytics for {dateLabel}...
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Querying completed and paid WooCommerce order ledgers.
          </p>
        </div>
      )}

      {/* 4. Error State */}
      {!isLoading && error && (
        <GlassCard className="min-h-[360px] p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-3">
            <AlertCircle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-zinc-950 dark:text-white">
            Sales overview unavailable
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-md">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setRequestKey(k => k + 1)}
            className="mt-5 min-h-11 px-5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs hover:opacity-90"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>
        </GlassCard>
      )}

      {/* 5. Empty State */}
      {!isLoading && !error && (!analytics || analytics.summary.orders === 0) && (
        <GlassCard className="min-h-[360px] p-8 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-400 mb-3">
            <ShoppingBag className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-zinc-950 dark:text-white">
            No paid orders found for {dateLabel}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-md">
            No customer purchases were recorded during this period in {selectedCurrency || 'store currencies'}. Try choosing a wider date horizon.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <button
              type="button"
              onClick={() => setDatePreset('90d')}
              className="min-h-11 px-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-semibold text-zinc-800 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/[0.08] cursor-pointer"
            >
              View Last 90 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('all')}
              className="min-h-11 px-4 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              View All Time
            </button>
          </div>
        </GlassCard>
      )}

      {/* 6. Active Analytics Content */}
      {!isLoading && !error && analytics && analytics.summary.orders > 0 && (
        <>
          {/* Executive KPI Metric Cards (6-Grid Dashboard Style) */}
          <section
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
            aria-label="Executive financial KPIs"
          >
            {/* 1. Net Revenue */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between min-h-[142px]">
              <div className="flex items-center justify-between gap-2">
                <CardEyebrow>Net Sales Revenue</CardEyebrow>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06]">
                  {analytics.currency}
                </span>
              </div>
              <div className="my-1 space-y-1">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white font-mono tabular-nums">
                  {formatCurrency(analytics.summary.net_revenue, analytics.currency)}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {analytics.summary.refunded > 0
                    ? `${formatCurrency(analytics.summary.refunded, analytics.currency)} refunded deducted`
                    : `Full gross of ${formatCurrency(analytics.summary.gross_revenue, analytics.currency)}`}
                </p>
              </div>
              {/* Sparkline Ribbon */}
              {sparklineData.length > 1 && (
                <div className="w-full h-7 my-1 select-none pointer-events-none">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="netRevSpark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f3aa18" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#f3aa18" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#f3aa18"
                        strokeWidth={1.8}
                        fill="url(#netRevSpark)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                <span>Gross Volume</span>
                <span className="tabular-nums">{formatCurrency(analytics.summary.gross_revenue, analytics.currency)}</span>
              </div>
            </GlassCard>

            {/* 2. Store Retained Net Revenue */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between min-h-[142px] border-lime-500/30 dark:border-[#f3aa18]/20 bg-lime-500/[0.02] dark:bg-[#f3aa18]/[0.02]">
              <div className="flex items-center justify-between gap-2">
                <CardEyebrow>Store Retained Net</CardEyebrow>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-lime-500/10 text-lime-700 dark:text-[#f3aa18] border border-lime-500/20">
                  Retained
                </span>
              </div>
              <div className="my-1 space-y-1">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-lime-600 dark:text-[#f3aa18] font-mono tabular-nums">
                  {formatCurrency(
                    analytics.summary.real_net_revenue ?? analytics.summary.net_revenue,
                    analytics.currency
                  )}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Net sales revenue retained by store after refunds and taxes
                </p>
              </div>
              <div className="pt-2 border-t border-lime-500/10 dark:border-[#f3aa18]/10 flex items-center justify-between text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span>Net Conversion</span>
                <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
                  {analytics.summary.orders} paid orders
                </span>
              </div>
            </GlassCard>

            {/* 3. Average Order Value (AOV) */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between min-h-[142px]">
              <div className="flex items-center justify-between gap-2">
                <CardEyebrow>Average Order Value</CardEyebrow>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                  AOV
                </span>
              </div>
              <div className="my-1 space-y-1">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white font-mono tabular-nums">
                  {formatCurrency(
                    analytics.summary.orders > 0 ? analytics.summary.net_revenue / analytics.summary.orders : 0,
                    analytics.currency
                  )}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Average spend per customer order
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                <span>Basket Size</span>
                <span className="tabular-nums">Across {analytics.summary.items_sold} skins sold</span>
              </div>
            </GlassCard>

            {/* 4. Paid Orders & Volume */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between min-h-[142px]">
              <div className="flex items-center justify-between gap-2">
                <CardEyebrow>Paid Orders & Pieces</CardEyebrow>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06]">
                  {analytics.summary.items_sold} Pieces
                </span>
              </div>
              <div className="my-1 space-y-1">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white font-mono tabular-nums">
                  {analytics.summary.orders.toLocaleString()}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Completed & processing customer checkouts
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                <span>Basket Density</span>
                <span className="tabular-nums">
                  {analytics.summary.items_per_order ??
                    (analytics.summary.orders ? (analytics.summary.items_sold / analytics.summary.orders).toFixed(1) : 0)}{' '}
                  pieces per order
                </span>
              </div>
            </GlassCard>

            {/* 5. Average Order Value (AOV) */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between min-h-[142px]">
              <div className="flex items-center justify-between gap-2">
                <CardEyebrow>Average Order Value</CardEyebrow>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06]">
                  AOV
                </span>
              </div>
              <div className="my-1 space-y-1">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white font-mono tabular-nums">
                  {formatCurrency(analytics.summary.average_order_value, analytics.currency)}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Net transaction value per completed checkout
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                <span>Refund Impact</span>
                <span className="tabular-nums">
                  {analytics.summary.refund_rate !== undefined ? `${analytics.summary.refund_rate}% refund rate` : 'Low refunds'}
                </span>
              </div>
            </GlassCard>

            {/* 6. Customer Reach & Repeat Rate */}
            <GlassCard className="p-4 sm:p-5 flex flex-col justify-between min-h-[142px]">
              <div className="flex items-center justify-between gap-2">
                <CardEyebrow>Buyer Intelligence</CardEyebrow>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06]">
                  {repeatCustomerStats.repeatRate}% Repeat
                </span>
              </div>
              <div className="my-1 space-y-1">
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white font-mono tabular-nums">
                  {analytics.summary.unique_customers.toLocaleString()}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Unique verified customer accounts
                </p>
              </div>
              <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                <span>Repeat Buyers</span>
                <span className="tabular-nums">
                  {repeatCustomerStats.repeatCount} customers with multiple orders
                </span>
              </div>
            </GlassCard>
          </section>

          {/* 7. Dual-Axis Visual Trends Chart (Net Revenue & Royalties) */}
          <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.9fr)] gap-5 sm:gap-6 items-stretch">
            <GlassCard className="p-4 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                      Daily Revenue & Royalty Dynamics
                    </h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      Net revenue tracking alongside creator royalty accrual by order date.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f3aa18]" />
                      <span className="text-zinc-700 dark:text-zinc-300">Net Sales</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#818cf8]" />
                      <span className="text-zinc-700 dark:text-zinc-300">Creator Royalties</span>
                    </div>
                  </div>
                </div>

                <div className="h-[280px] sm:h-[340px] w-full" aria-label={`Revenue and commission timeline in ${analytics.currency}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.timeline} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesRevFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f3aa18" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#f3aa18" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="salesCommFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 4" stroke="#71717a" opacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={val => val.slice(5)}
                        stroke="#71717a"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={28}
                      />
                      <YAxis
                        tickFormatter={val => compactCurrency(Number(val), analytics.currency)}
                        stroke="#71717a"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={64}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#09090b',
                          border: '1px solid rgba(255,255,255,.12)',
                          borderRadius: 12,
                          color: '#fff',
                          fontSize: 12,
                        }}
                        formatter={(value: any, name: any) => [
                          formatCurrency(Number(value) || 0, analytics.currency),
                          name === 'revenue' ? 'Net Sales' : 'Creator Royalties',
                        ]}
                        labelFormatter={val =>
                          new Date(`${val}T00:00:00`).toLocaleDateString(undefined, {
                            dateStyle: 'medium',
                          })
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="revenue"
                        stroke="#f3aa18"
                        strokeWidth={2}
                        fill="url(#salesRevFill)"
                        activeDot={{ r: 4, fill: '#f3aa18', stroke: '#09090b', strokeWidth: 2 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="commission"
                        name="commission"
                        stroke="#818cf8"
                        strokeWidth={1.8}
                        fill="url(#salesCommFill)"
                        activeDot={{ r: 3, fill: '#818cf8', stroke: '#09090b', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-500">
                <span>Timeline Period: {dateLabel}</span>
                <span>Active Ledger Entries: {analytics.timeline.length} days</span>
              </div>
            </GlassCard>

            {/* Geographic Delivery Breakdown */}
            <GlassCard className="p-4 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                    Delivery Destinations
                  </h2>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
                  Customer shipments ranked by destination country.
                </p>

                <ol className="space-y-3.5">
                  {analytics.countries.map((country, idx) => (
                    <li key={country.code} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-zinc-400 dark:text-zinc-500 text-[10px] w-4">
                            {idx + 1}.
                          </span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {country.name}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-zinc-950 dark:text-white font-semibold tabular-nums shrink-0">
                          {formatCurrency(country.revenue, analytics.currency)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-800 dark:bg-zinc-200 transition-all duration-300"
                          style={{
                            width: `${
                              topCountryRevenue > 0
                                ? Math.max(4, (country.revenue / topCountryRevenue) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>
                          {country.orders} {country.orders === 1 ? 'order' : 'orders'}
                        </span>
                        <span>
                          {analytics.summary.net_revenue > 0
                            ? `${Math.round((country.revenue / analytics.summary.net_revenue) * 100)}% of sales`
                            : ''}
                        </span>
                      </div>
                    </li>
                  ))}
                  {analytics.countries.length === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-8">
                      No country breakdown available for this range.
                    </p>
                  )}
                </ol>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/[0.06] text-[11px] font-mono text-zinc-500 text-right">
                {analytics.countries.length} active delivery territories
              </div>
            </GlassCard>
          </section>

          {/* 8. Top VIP Customers Section */}
          <section>
            <GlassCard className="overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-white">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                      Top Customers by Net Spend
                    </h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      Leading collectors and patrons ranked by verified completed checkouts.
                    </p>
                  </div>
                </div>

                {analytics.top_customers && analytics.top_customers.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCustomers(s => !s)}
                    className="text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <span>{showAllCustomers ? 'Show top 5' : `Show all ${analytics.top_customers.length}`}</span>
                    <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showAllCustomers && 'rotate-180')} />
                  </button>
                )}
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-white/[0.07]">
                {(showAllCustomers
                  ? analytics.top_customers || []
                  : (analytics.top_customers || []).slice(0, 5)
                ).map((customer, index) => {
                  const initials = customer.name
                    .split(' ')
                    .map(n => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'CU';

                  return (
                    <div
                      key={customer.email || index}
                      className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Left: Customer Badge & Details */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 tabular-nums w-5 shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>

                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/10 flex items-center justify-center text-xs font-mono font-bold text-zinc-800 dark:text-white shrink-0">
                          {initials}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {customer.name}
                            </span>
                            {customer.orders > 1 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                VIP Patron
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                            <button
                              type="button"
                              onClick={() => copyEmailToClipboard(customer.email)}
                              className="flex items-center gap-1 text-[11px] font-mono hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                              title="Click to copy customer email"
                            >
                              <Mail className="w-3 h-3 text-zinc-400" />
                              <span className="truncate max-w-[200px] sm:max-w-none">{customer.email}</span>
                              {copiedEmail === customer.email ? (
                                <Check className="w-3 h-3 text-lime-500" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 opacity-60" />
                              )}
                            </button>

                            {(customer.city || customer.country) && (
                              <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                                <MapPin className="w-3 h-3" />
                                <span>{[customer.city, customer.country].filter(Boolean).join(', ')}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Spent & Orders */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100 dark:border-white/[0.04] shrink-0">
                        <span className="text-sm sm:text-base font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                          {formatCurrency(customer.spent, analytics.currency)}
                        </span>
                        <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {customer.orders} {customer.orders === 1 ? 'order' : 'orders'}
                          {customer.last_order && ` · Last ${customer.last_order}`}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {(!analytics.top_customers || analytics.top_customers.length === 0) && (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    No customer transaction history available in this period.
                  </div>
                )}
              </div>
            </GlassCard>
          </section>

          {/* 9. Top-Selling Precision Skins */}
          <section>
            <GlassCard className="overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-white">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                      Top-Selling Precision Skins
                    </h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                      Ranked by pieces sold with device skin previews and volume performance.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  {analytics.products.length} distinct skin models purchased
                </span>
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-white/[0.07]">
                {analytics.products.map((product, index) => {
                  const displayImg = product.image_url || '';

                  return (
                    <div
                      key={`${product.product_id}-${product.name}-${index}`}
                      className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Left: Rank, Thumbnail & Metadata */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 tabular-nums w-5 shrink-0">
                          {String(index + 1).padStart(2, '0')}
                        </span>

                        {/* Thumbnail Frame */}
                        <div
                          onClick={() => {
                            if (displayImg) {
                              setPreviewProduct({ product });
                            }
                          }}
                          className="w-14 h-18 sm:w-16 sm:h-20 rounded-xl bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0 group/img relative cursor-pointer shadow-2xs hover:border-zinc-300 dark:hover:border-white/25 transition-all"
                          title="Click to preview skin in full resolution"
                        >
                          {displayImg ? (
                            <>
                              <img
                                src={displayImg}
                                alt={product.name}
                                loading="lazy"
                                className="max-w-full max-h-full object-contain drop-shadow-sm group-hover/img:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="w-4 h-4" />
                              </div>
                            </>
                          ) : (
                            <ImageIcon className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4
                            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate hover:text-lime-600 dark:hover:text-[#f3aa18] transition-colors cursor-pointer"
                            onClick={() => {
                              if (displayImg) {
                                setPreviewProduct({ product });
                              }
                            }}
                            title={product.name}
                          >
                            {product.name}
                          </h4>

                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                            <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                              {(product as any).sku ? `SKU: ${(product as any).sku}` : 'Precision Device Skin'}
                            </span>
                          </div>

                          {/* Action links */}
                          <div className="flex items-center gap-3 mt-1.5">
                            {displayImg && (
                              <button
                                type="button"
                                onClick={() => setPreviewProduct({ product })}
                                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview skin</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity Sold & Revenue */}
                      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-zinc-100 dark:border-white/[0.04] shrink-0 gap-1">
                        <div className="text-left md:text-right">
                          <span className="text-base font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                            {formatCurrency(product.revenue, analytics.currency)}
                          </span>
                          <span className="block text-xs font-mono text-zinc-500 dark:text-zinc-400">
                            {product.quantity} {product.quantity === 1 ? 'piece sold' : 'pieces sold'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {analytics.products.length === 0 && (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    No product line items recorded in this date range.
                  </div>
                )}
              </div>
            </GlassCard>
          </section>
        </>
      )}

      {/* 10. Lightbox Modal for Skin Preview */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setPreviewProduct(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Precision skin preview"
        >
          <div
            className="relative max-w-4xl w-full bg-[#0d0d0f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white truncate max-w-md sm:max-w-xl">
                  {previewProduct.product.name}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  High-resolution device skin preview
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Image Display */}
            <div className="flex-1 p-6 bg-black/60 flex items-center justify-center overflow-auto min-h-[300px]">
              {previewProduct.product.image_url ? (
                <img
                  src={previewProduct.product.image_url}
                  alt={previewProduct.product.name}
                  className="max-w-full max-h-[58vh] object-contain rounded-lg shadow-xl"
                />
              ) : (
                <div className="text-center text-zinc-500 py-12">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Product image unavailable</p>
                </div>
              )}
            </div>

            {/* Modal Footer with Performance Context */}
            <div className="px-6 py-4 bg-zinc-950 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 font-mono text-zinc-400">
                <span>
                  Sold:{' '}
                  <strong className="text-white">
                    {previewProduct.product.quantity} units
                  </strong>
                </span>
                <span>
                  Net Sales:{' '}
                  <strong className="text-[#f3aa18]">
                    {formatCurrency(previewProduct.product.revenue, analytics?.currency || 'USD')}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {previewProduct.product.image_url && (
                  <a
                    href={previewProduct.product.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <span>Open Raw Asset</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
