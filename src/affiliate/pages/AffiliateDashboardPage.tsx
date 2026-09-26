import React, { useState, useMemo } from 'react';
import { 
  Copy, 
  Check, 
  QrCode, 
  ExternalLink, 
  Wallet, 
  TrendingUp, 
  ShoppingBag, 
  MousePointerClick, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  X,
  ArrowRight,
  RefreshCw,
  Calendar,
  Sparkles,
  ChevronDown,
  Search,
  Filter,
  Layers
} from 'lucide-react';
import { 
  AffiliateProfile, 
  AffiliateCommission, 
  AffiliateClick, 
  AffiliateDailyStat 
} from '../../types';
import { useToast } from '../../context/ToastContext';
import { PageHeroHeader } from '../../components/ui/PageHeroHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { clsx } from 'clsx';

export type AffiliateHorizon = 'today' | '7d' | '30d' | 'this_month' | 'all';
export type ChartMetricView = 'combined' | 'earnings' | 'visits';
export type CommissionFilterStatus = 'all' | 'pending' | 'unpaid' | 'paid' | 'rejected';

interface AffiliateDashboardPageProps {
  profile: AffiliateProfile;
  metrics: {
    lifetime_earnings: number;
    unpaid_balance: number;
    total_clicks: number;
    total_orders: number;
    commission_rate: number;
    min_payout_amount: number;
    can_request_payout: boolean;
  };
  commissions: AffiliateCommission[];
  clicks?: AffiliateClick[];
  dailyStats?: AffiliateDailyStat[];
  onRefresh?: () => void;
  isLoading?: boolean;
  onNavigateTab: (tab: 'dashboard' | 'links' | 'payouts' | 'settings') => void;
}

export const AffiliateDashboardPage: React.FC<AffiliateDashboardPageProps> = ({
  profile,
  metrics,
  commissions,
  clicks = [],
  dailyStats = [],
  onRefresh = () => {},
  isLoading = false,
  onNavigateTab,
}) => {
  const { showToast } = useToast();
  const [horizon, setHorizon] = useState<AffiliateHorizon>('30d');
  const [chartView, setChartView] = useState<ChartMetricView>('combined');
  const [statusFilter, setStatusFilter] = useState<CommissionFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const referralUrl = profile.referral_url || `https://exacoat.com/?x=${profile.slug}`;

  const formatIDR = (val: number): string => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedLink(true);
      showToast('success', 'Link Copied', referralUrl);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('error', 'Copy Failed', 'Please manually copy the URL from the input.');
    }
  };

  // Horizon cutoff timestamp calculation
  const horizonCutoffMs = useMemo(() => {
    const now = new Date();
    if (horizon === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    if (horizon === '7d') {
      return now.getTime() - 7 * 24 * 60 * 60 * 1000;
    }
    if (horizon === '30d') {
      return now.getTime() - 30 * 24 * 60 * 60 * 1000;
    }
    if (horizon === 'this_month') {
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
    return 0; // 'all'
  }, [horizon]);

  // Filter commissions by horizon
  const horizonCommissions = useMemo(() => {
    if (horizonCutoffMs === 0) return commissions;
    return commissions.filter(c => {
      if (!c.created_at) return true;
      const t = new Date(c.created_at).getTime();
      return isNaN(t) || t >= horizonCutoffMs;
    });
  }, [commissions, horizonCutoffMs]);

  // Filter clicks by horizon
  const horizonClicks = useMemo(() => {
    if (horizonCutoffMs === 0) return clicks;
    return clicks.filter(c => {
      if (!c.created_at) return true;
      const t = new Date(c.created_at).getTime();
      return isNaN(t) || t >= horizonCutoffMs;
    });
  }, [clicks, horizonCutoffMs]);

  // Dynamic window KPIs
  const windowEarnings = useMemo(() => {
    return horizonCommissions
      .filter(c => c.status !== 'rejected')
      .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
  }, [horizonCommissions]);

  const windowOrders = useMemo(() => {
    return horizonCommissions.filter(c => c.status !== 'rejected').length;
  }, [horizonCommissions]);

  const windowVisits = useMemo(() => {
    if (horizon === 'all') {
      return metrics.total_clicks || horizonClicks.length;
    }
    return horizonClicks.length;
  }, [horizon, metrics.total_clicks, horizonClicks]);

  const conversionRate = useMemo(() => {
    if (windowVisits > 0) {
      return ((windowOrders / windowVisits) * 100).toFixed(1) + '%';
    }
    return windowOrders > 0 ? '100%' : '0.0%';
  }, [windowOrders, windowVisits]);

  const unpaidBalance = Number(metrics.unpaid_balance) || 0;
  const minPayout = Number(metrics.min_payout_amount) || 250000;
  const payoutProgressPercent = Math.min(100, Math.round((unpaidBalance / minPayout) * 100));

  // Build Time-Series Performance Chart Data
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; label: string; earnings: number; visits: number; orders: number }> = {};

    // 1. Ingest backend dailyStats if available
    dailyStats.forEach(st => {
      if (!st.date) return;
      const d = new Date(st.date);
      if (horizonCutoffMs > 0 && d.getTime() < horizonCutoffMs) return;

      const key = st.date.split('T')[0];
      const label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      if (!map[key]) {
        map[key] = { date: key, label, earnings: 0, visits: 0, orders: 0 };
      }
      map[key].earnings += Number(st.earnings) || 0;
      map[key].visits += Number(st.visits) || 0;
      map[key].orders += Number(st.orders) || 0;
    });

    // 2. Ingest commissions for real-time accuracy
    horizonCommissions.forEach(c => {
      if (c.status === 'rejected') return;
      const d = c.created_at ? new Date(c.created_at) : new Date();
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

      if (!map[key]) {
        map[key] = { date: key, label, earnings: 0, visits: 0, orders: 0 };
      }
      if (dailyStats.length === 0) {
        map[key].earnings += Number(c.commission_amount) || 0;
        map[key].orders += 1;
      }
    });

    // 3. Ingest clicks if dailyStats is empty
    if (dailyStats.length === 0) {
      horizonClicks.forEach(cl => {
        const d = cl.created_at ? new Date(cl.created_at) : new Date();
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

        if (!map[key]) {
          map[key] = { date: key, label, earnings: 0, visits: 0, orders: 0 };
        }
        map[key].visits += 1;
      });
    }

    // Sort chronologically
    const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));

    // Fill minimum date points if dataset is sparse for smooth visualization
    if (sorted.length === 0) {
      const todayKey = new Date().toISOString().split('T')[0];
      const label = new Date().toLocaleDateString('default', { month: 'short', day: 'numeric' });
      return [{ date: todayKey, label, earnings: 0, visits: 0, orders: 0 }];
    }

    return sorted;
  }, [dailyStats, horizonCommissions, horizonClicks, horizonCutoffMs]);

  // Filtered Commission Ledger Rows
  const displayedCommissions = useMemo(() => {
    return horizonCommissions.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = (c.order_number || '').toLowerCase().includes(q);
        const matchEmail = (c.customer_email || '').toLowerCase().includes(q);
        if (!matchNum && !matchEmail) return false;
      }
      return true;
    });
  }, [horizonCommissions, statusFilter, searchQuery]);

  const getCommissionBadge = (
    status: string, 
    reason?: string | null, 
    maturesAt?: string | null
  ) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Paid
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Cleared (Unpaid)
          </span>
        );
      case 'pending': {
        if (maturesAt) {
          const maturesDate = new Date(maturesAt);
          const now = new Date();
          const daysLeft = Math.max(0, Math.ceil((maturesDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          return (
            <span 
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/25"
              title={`Delivered. 7-day grace period matures on ${maturesDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}`}
            >
              Grace Period ({daysLeft > 0 ? `${daysLeft}d left` : 'clearing'})
            </span>
          );
        }
        return (
          <span 
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
            title="Awaiting verified parcel delivery to start 7-day grace period"
          >
            Processing Order
          </span>
        );
      }
      case 'rejected':
        return (
          <span 
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"
            title={reason || 'Commission rejected'}
          >
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner and Horizon Switcher */}
      <PageHeroHeader
        title="Creator Overview"
        subtitle="Live performance analytics, tracking metrics, and commission ledger."
        badge={{ label: 'CREATOR WORKSTATION', variant: 'amber' }}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Horizon Switcher */}
            <div className="p-1 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center gap-1 font-mono text-xs">
              {(['today', '7d', '30d', 'this_month', 'all'] as AffiliateHorizon[]).map((preset) => {
                const labels: Record<AffiliateHorizon, string> = {
                  today: 'Today',
                  '7d': '7D',
                  '30d': '30D',
                  this_month: 'Month',
                  all: 'All',
                };
                const isActive = horizon === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setHorizon(preset)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg transition-all cursor-pointer font-semibold',
                      isActive
                        ? 'bg-[#f3aa18] text-[#080808] shadow-xs'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    )}
                  >
                    {labels[preset]}
                  </button>
                );
              })}
            </div>

            {/* Quick Action Button */}
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => onNavigateTab('links')}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />}
            >
              Get Product Links
            </Button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="Refresh affiliate performance data"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-[#f3aa18]')} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Referral Link & Quick Sharing Banner */}
      <GlassCard className="p-5 sm:p-6 border border-white/[0.08] relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold text-[#f3aa18] bg-[#f3aa18]/10 px-2.5 py-0.5 rounded-full border border-[#f3aa18]/25 font-mono">
                @{profile.slug}
              </span>
              <span className="text-xs font-bold text-white font-['Chakra_Petch'] uppercase tracking-wider">
                Branded Referral Link
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Share this base link across your socials or bio to attribute customer sales for 30 days.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={referralUrl}
                className="w-full bg-[#0a0a0c]/90 border border-white/[0.1] rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-zinc-200 select-all focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Copy referral link"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="default"
              onClick={() => setShowQrModal(true)}
              leftIcon={<QrCode className="w-4 h-4" />}
            >
              QR Code
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              asChild
              title="Test referral link in new tab"
            >
              <a href={referralUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Unpaid Available Balance */}
        <GlassCard className="p-5 border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 font-mono">
                Available Balance
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold font-['Chakra_Petch'] text-white">
                {formatIDR(unpaidBalance)}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400 font-sans">Payout Target: Rp 250k</span>
              <span className="font-mono text-zinc-300 font-semibold">{payoutProgressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-[#f3aa18] transition-all duration-500 rounded-full"
                style={{ width: `${payoutProgressPercent}%` }}
              />
            </div>
            {metrics.can_request_payout ? (
              <button
                type="button"
                onClick={() => onNavigateTab('payouts')}
                className="w-full mt-1 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Request Payout</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <p className="text-[10px] text-zinc-400">
                {unpaidBalance >= minPayout 
                  ? 'Ready for transfer' 
                  : `${formatIDR(minPayout - unpaidBalance)} remaining to withdraw`}
              </p>
            )}
          </div>
        </GlassCard>

        {/* Card 2: Horizon Earnings */}
        <GlassCard className="p-5 border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 font-mono">
                {horizon === 'all' ? 'Lifetime Earnings' : 'Window Earnings'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/20 text-[#f3aa18] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold font-['Chakra_Petch'] text-[#f3aa18]">
                {formatIDR(windowEarnings)}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>Lifetime:</span>
            <span className="font-mono text-zinc-200 font-semibold">
              {formatIDR(metrics.lifetime_earnings)}
            </span>
          </div>
        </GlassCard>

        {/* Card 3: Visits & Clicks */}
        <GlassCard className="p-5 border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 font-mono">
                {horizon === 'all' ? 'Total Visits' : 'Window Visits'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <MousePointerClick className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold font-['Chakra_Petch'] text-white">
                {windowVisits.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>Cookie Attribution:</span>
            <span className="font-mono text-zinc-300 font-semibold">30 Days</span>
          </div>
        </GlassCard>

        {/* Card 4: Orders & Conversion */}
        <GlassCard className="p-5 border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 font-mono">
                Orders &amp; Rate
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-['Chakra_Petch'] text-white">
                {windowOrders}
              </span>
              <span className="text-xs font-semibold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {conversionRate}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>Commission Rate:</span>
            <span className="font-mono text-[#f3aa18] font-bold">{metrics.commission_rate}% Net</span>
          </div>
        </GlassCard>
      </div>

      {/* Interactive Performance Time-Series Chart */}
      <GlassCard className="p-6 border border-white/[0.08] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#f3aa18]" />
              <h3 className="text-sm font-bold text-white font-['Chakra_Petch'] uppercase tracking-wider">
                Performance Dynamics
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Daily earnings and incoming visits attributed to your referral links.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="p-1 rounded-xl bg-[#141416] border border-white/[0.08] flex items-center gap-1 font-sans text-xs">
            <button
              type="button"
              onClick={() => setChartView('combined')}
              className={clsx(
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold',
                chartView === 'combined'
                  ? 'bg-white/[0.1] text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Combined
            </button>
            <button
              type="button"
              onClick={() => setChartView('earnings')}
              className={clsx(
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold',
                chartView === 'earnings'
                  ? 'bg-[#f3aa18] text-[#080808] shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Earnings (IDR)
            </button>
            <button
              type="button"
              onClick={() => setChartView('visits')}
              className={clsx(
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold',
                chartView === 'visits'
                  ? 'bg-sky-500 text-[#080808] shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              Visits &amp; Clicks
            </button>
          </div>
        </div>

        {/* Chart Viewport */}
        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="affiliateEarningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f3aa18" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f3aa18" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="affiliateVisitsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="label" 
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(val) => {
                  if (chartView === 'visits') return `${val}`;
                  if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}M`;
                  if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)}k`;
                  return `Rp ${val}`;
                }}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="p-3 rounded-2xl bg-[#09090b]/95 border border-white/[0.12] shadow-2xl backdrop-blur-xl text-xs font-sans space-y-1.5 min-w-[170px]">
                        <p className="font-mono text-zinc-400 font-semibold border-b border-white/[0.08] pb-1">
                          {d.label} ({d.date})
                        </p>
                        <div className="flex items-center justify-between text-zinc-300">
                          <span>Earnings:</span>
                          <span className="font-mono font-bold text-[#f3aa18]">
                            {formatIDR(d.earnings)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-300">
                          <span>Visits:</span>
                          <span className="font-mono font-bold text-sky-400">
                            {d.visits} clicks
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-300">
                          <span>Orders:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {d.orders} orders
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {(chartView === 'combined' || chartView === 'earnings') && (
                <Area 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="#f3aa18" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#affiliateEarningsGrad)" 
                />
              )}
              {(chartView === 'combined' || chartView === 'visits') && (
                <Area 
                  type="monotone" 
                  dataKey="visits" 
                  stroke="#38bdf8" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#affiliateVisitsGrad)" 
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Commission Activity Ledger & Filter Bar */}
      <GlassCard className="p-6 border border-white/[0.08] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#f3aa18]" />
              <h3 className="text-sm font-bold text-white font-['Chakra_Petch'] uppercase tracking-wider">
                Commission Activity
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Auditable order attribution records subject to a 7-day post-delivery grace period.
            </p>
          </div>

          {/* Search and Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order number..."
                className="pl-9 pr-3 py-1.5 bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all font-mono"
              />
            </div>

            {/* Custom Styled Beautiful Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CommissionFilterStatus)}
                className="appearance-none bg-[#121214] border border-white/[0.1] rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 cursor-pointer transition-all"
              >
                <option value="all" className="bg-[#121214] text-white">All Statuses</option>
                <option value="pending" className="bg-[#121214] text-white">Grace Period (7D)</option>
                <option value="unpaid" className="bg-[#121214] text-white">Cleared (Unpaid)</option>
                <option value="paid" className="bg-[#121214] text-white">Paid</option>
                <option value="rejected" className="bg-[#121214] text-white">Rejected</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        {displayedCommissions.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-zinc-400 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">No commissions recorded in this window</p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Customer purchases made via your referral links will appear here after orders reach processing.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-zinc-400 uppercase tracking-wider text-[10px] font-mono">
                  <th className="py-3 px-3">Order Number</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Order Subtotal</th>
                  <th className="py-3 px-3">Rate</th>
                  <th className="py-3 px-3">Commission</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {displayedCommissions.map((comm) => (
                  <tr key={comm.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-3 font-mono text-white font-medium">
                      #{comm.order_number || comm.order_id}
                    </td>
                    <td className="py-3.5 px-3 text-zinc-400 font-mono text-[11px]">
                      {new Date(comm.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-zinc-300">
                      {formatIDR(Number(comm.order_subtotal))}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-zinc-400">
                      {comm.commission_rate}%
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-[#f3aa18]">
                      {formatIDR(Number(comm.commission_amount))}
                    </td>
                    <td className="py-3.5 px-3">
                      {getCommissionBadge(comm.status, comm.rejection_reason, comm.matures_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0c0c0e] border border-white/[0.1] rounded-3xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl animate-modal-enter">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Your Referral QR Code</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-white rounded-2xl inline-block shadow-sm">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralUrl)}`}
                alt="Affiliate QR Code"
                className="w-48 h-48 mx-auto"
                loading="lazy"
              />
            </div>
            <p className="text-xs text-zinc-400 font-mono break-all px-2">
              {referralUrl}
            </p>
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={handleCopyLink}
            >
              Copy Link URL
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
