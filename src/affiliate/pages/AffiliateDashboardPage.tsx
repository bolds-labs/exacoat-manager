import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  X, 
  ArrowRight, 
  RefreshCw, 
  Link2, 
  Sliders, 
  Search, 
  Percent,
  Globe,
  ArrowUpRight
} from 'lucide-react';
import { 
  AffiliateProfile, 
  AffiliateCommission, 
  AffiliateClick, 
  AffiliateDailyStat,
  AffiliatePayout 
} from '../../types';
import { useToast } from '../../context/ToastContext';
import { PageHeroHeader } from '../../components/ui/PageHeroHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { CustomSelect } from '../../components/ui/CustomSelect';
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
    max_commission_rate?: number;
    commission_rate: number;
    min_payout_amount: number;
    can_request_payout: boolean;
  };
  commissions: AffiliateCommission[];
  clicks?: AffiliateClick[];
  dailyStats?: AffiliateDailyStat[];
  payouts?: AffiliatePayout[];
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
  payouts = [],
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
  const commissionRate = Number(profile.commission_rate) || Number(metrics.commission_rate) || 15;
  const discountRate = profile.discount_rate != null ? Number(profile.discount_rate) : 0;
  const maxPool = Number(profile.max_commission_rate) || Number(metrics.max_commission_rate) || 25;

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

  // Clicks and visits: a sale requires at least 1 visit
  const windowVisits = useMemo(() => {
    let rawVisits = 0;
    if (horizon === 'all') {
      rawVisits = Number(metrics.total_clicks) || horizonClicks.length;
    } else {
      rawVisits = horizonClicks.length;
    }
    return Math.max(rawVisits, windowOrders);
  }, [horizon, metrics.total_clicks, horizonClicks, windowOrders]);

  const conversionRate = useMemo(() => {
    if (windowVisits > 0) {
      return ((windowOrders / windowVisits) * 100).toFixed(1) + '%';
    }
    return windowOrders > 0 ? '100%' : '0.0%';
  }, [windowOrders, windowVisits]);

  // Upcoming / Pending Commissions (clearing in 7-day grace period)
  const pendingCommissionsAmount = useMemo(() => {
    return commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0);
  }, [commissions]);

  const pendingCommissionsCount = useMemo(() => {
    return commissions.filter(c => c.status === 'pending').length;
  }, [commissions]);

  const pendingPayoutsAmount = useMemo(() => {
    return payouts
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payouts]);

  const unpaidBalance = Number(metrics.unpaid_balance) || 0;
  const minPayout = Number(metrics.min_payout_amount) || 250000;

  // Build Time-Series Performance Chart Data
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; label: string; earnings: number; visits: number; orders: number }> = {};

    // 1. Ingest backend dailyStats
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

    // 2. Ingest commissions for real-time accuracy and full historical coverage
    horizonCommissions.forEach(c => {
      if (c.status === 'rejected') return;
      const d = c.created_at ? new Date(c.created_at) : new Date();
      if (horizonCutoffMs > 0 && d.getTime() < horizonCutoffMs) return;

      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

      if (!map[key]) {
        map[key] = { date: key, label, earnings: 0, visits: 0, orders: 0 };
      }
      const hasDailyStatsEarnings = dailyStats.some(
        s => s.date && s.date.split('T')[0] === key && (Number(s.earnings) > 0 || Number(s.orders) > 0)
      );
      if (!hasDailyStatsEarnings) {
        map[key].earnings += Number(c.commission_amount) || 0;
        map[key].orders += 1;
      }
    });

    // 3. Ingest clicks if not already captured in dailyStats
    horizonClicks.forEach(cl => {
      const d = cl.created_at ? new Date(cl.created_at) : new Date();
      if (horizonCutoffMs > 0 && d.getTime() < horizonCutoffMs) return;

      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

      if (!map[key]) {
        map[key] = { date: key, label, earnings: 0, visits: 0, orders: 0 };
      }
      const hasDailyStatsVisits = dailyStats.some(
        s => s.date && s.date.split('T')[0] === key && Number(s.visits) > 0
      );
      if (!hasDailyStatsVisits) {
        map[key].visits += 1;
      }
    });

    // Enforce physical visit consistency across all entries: visits must be >= orders
    const sorted = Object.values(map)
      .map(entry => ({
        ...entry,
        visits: Math.max(entry.visits, entry.orders),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Fill minimum date points if dataset is sparse
    if (sorted.length === 0) {
      const todayKey = new Date().toISOString().split('T')[0];
      const label = new Date().toLocaleDateString('default', { month: 'short', day: 'numeric' });
      return [{ date: todayKey, label, earnings: 0, visits: 0, orders: 0 }];
    }

    return sorted;
  }, [dailyStats, horizonCommissions, horizonClicks, horizonCutoffMs]);

  // Filtered Commission Ledger Rows - Full creator history, filtered by status and search
  const displayedCommissions = useMemo(() => {
    return commissions.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = (c.order_number || (c as any).order_id || '').toString().toLowerCase().includes(q);
        const matchEmail = (c.customer_email || '').toLowerCase().includes(q);
        if (!matchNum && !matchEmail) return false;
      }
      return true;
    });
  }, [commissions, statusFilter, searchQuery]);

  // Derive traffic sources from clicks
  const creatorTrafficSources = useMemo(() => {
    if (!horizonClicks || horizonClicks.length === 0) return [];
    const map: Record<string, { source: string; count: number; percentage: number }> = {};
    const total = horizonClicks.length;

    horizonClicks.forEach((c) => {
      const ref = (c.referrer_url || '').toLowerCase();
      let label = 'Direct / Bio Link';
      if (ref.includes('instagram') || ref.includes('cdninstagram')) label = 'Instagram';
      else if (ref.includes('youtube') || ref.includes('youtu.be')) label = 'YouTube';
      else if (ref.includes('tiktok')) label = 'TikTok';
      else if (ref.includes('twitter') || ref.includes('t.co') || ref.includes('x.com')) label = 'X (Twitter)';
      else if (ref.includes('facebook') || ref.includes('fb.me')) label = 'Facebook';
      else if (ref.includes('google') || ref.includes('bing')) label = 'Google / Search';
      else if (ref.includes('threads')) label = 'Threads';
      else if (ref.includes('wa.me') || ref.includes('whatsapp')) label = 'WhatsApp';
      else if (ref) {
        try {
          const u = new URL(ref);
          label = u.hostname.replace(/^www\./, '');
        } catch {
          label = ref;
        }
      }

      if (!map[label]) map[label] = { source: label, count: 0, percentage: 0 };
      map[label].count += 1;
    });

    const arr = Object.values(map);
    arr.forEach((item) => {
      item.percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
    });
    arr.sort((a, b) => b.count - a.count);
    return arr;
  }, [horizonClicks]);

  const getCommissionBadge = (status: string, reason?: string | null, maturesAt?: string | null) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-white/[0.08]">
            Paid
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            Cleared
          </span>
        );
      case 'pending':
        return (
          <span 
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/25"
            title={maturesAt ? `Clears on ${new Date(maturesAt).toLocaleDateString()}` : 'Under 7-day grace period'}
          >
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span 
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25"
            title={reason || 'Order cancelled or refunded'}
          >
            Void
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.05] text-zinc-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner and Horizon Switcher */}
      <PageHeroHeader
        title="Creator Overview"
        subtitle="Live performance metrics, audience discount attribution, and commission ledger."
        badge={{ label: 'CREATOR WORKSTATION', variant: 'amber' }}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Horizon Switcher */}
            <div className="p-1 rounded-xl bg-[#121214] border border-white/[0.08] flex items-center gap-1 font-mono text-xs">
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
                      'px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold',
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

            {/* Product Links Navigation Button */}
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => onNavigateTab('links')}
              leftIcon={<Link2 className="w-3.5 h-3.5 text-[#f3aa18]" />}
            >
              Get Product Links
            </Button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#121214] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="Refresh affiliate performance data"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-[#f3aa18]')} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Referral Link & Sharing Bar (Unified Minimalist Bar) */}
      <GlassCard className="p-4 sm:p-5 border border-white/[0.08] relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-white leading-none">Your Tracking Link</span>
              <span className="inline-flex items-center justify-center h-5 px-2 text-[11px] font-mono leading-none text-[#f3aa18] bg-[#f3aa18]/10 rounded border border-[#f3aa18]/25">
                @{profile.slug}
              </span>
              {discountRate > 0 && (
                <span className="inline-flex items-center justify-center h-5 px-2 text-[11px] font-mono leading-none text-emerald-400 bg-emerald-500/10 rounded border border-emerald-500/25">
                  {discountRate}% customer discount active
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {discountRate > 0
                ? `Visitors get ${discountRate}% off automatically. You earn ${commissionRate}% net commission on every order.`
                : `Earn your full ${commissionRate}% net commission on orders attributed within 30 days.`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={referralUrl}
                className="w-full bg-[#050506] border border-white/[0.1] rounded-xl pl-3 pr-9 py-2 text-xs font-mono text-zinc-200 select-all focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                title="Copy referral link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowQrModal(true)}
              leftIcon={<QrCode className="w-3.5 h-3.5" />}
            >
              QR
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('settings')}
              leftIcon={<Sliders className="w-3.5 h-3.5 text-[#f3aa18]" />}
              title="Adjust commission split"
            >
              Split
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              asChild
              title="Test referral link in new tab"
            >
              <a href={referralUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available Balance */}
        <GlassCard className="p-4 sm:p-5 border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-400 font-mono">
                Available Balance
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-semibold font-mono text-white">
                {formatIDR(unpaidBalance)}
              </span>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>Threshold:</span>
            <span className="font-mono text-zinc-300 font-medium">Min. {formatIDR(minPayout)}</span>
          </div>
        </GlassCard>

        {/* Card 2: Lifetime Earnings */}
        <GlassCard className="p-4 sm:p-5 border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-400 font-mono">
                Lifetime Earnings
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-semibold font-mono text-[#f3aa18]">
                {formatIDR(metrics.lifetime_earnings)}
              </span>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>In Window:</span>
            <span className="font-mono text-zinc-200 font-medium">
              {formatIDR(windowEarnings)}
            </span>
          </div>
        </GlassCard>

        {/* Card 3: Visits & Clicks */}
        <GlassCard className="p-4 sm:p-5 border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-400 font-mono">
                {horizon === 'all' ? 'Total Visits' : 'Window Visits'}
              </span>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-semibold font-mono text-white">
                {windowVisits.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            <span>Attribution:</span>
            <span className="font-mono text-zinc-300 font-medium">30 Days</span>
          </div>
        </GlassCard>

        {/* Card 4: Upcoming / Pending Payment */}
        <GlassCard className="p-4 sm:p-5 border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-400 font-mono">
                Pending Payment
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono text-white">
                {formatIDR(pendingCommissionsAmount)}
              </span>
              <span className="text-xs font-medium text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {pendingCommissionsCount} {pendingCommissionsCount === 1 ? 'order' : 'orders'}
              </span>
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
            {pendingPayoutsAmount > 0 ? (
              <>
                <span>In Review:</span>
                <span className="font-mono text-amber-300 font-medium">{formatIDR(pendingPayoutsAmount)}</span>
              </>
            ) : (
              <>
                <span>Review Cycle:</span>
                <span className="font-mono text-zinc-300 font-medium">Order Clearing</span>
              </>
            )}
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
          <div className="p-1 rounded-xl bg-[#121214] border border-white/[0.08] flex items-center gap-1 font-sans text-xs">
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
            <AreaChart 
              data={chartData} 
              margin={{ 
                top: 10, 
                right: chartView === 'combined' ? 25 : 10, 
                left: -10, 
                bottom: 0 
              }}
            >
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
              {(chartView === 'combined' || chartView === 'earnings') && (
                <YAxis 
                  yAxisId="earnings"
                  orientation="left"
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)}k`;
                    return `Rp ${val}`;
                  }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
              )}
              {(chartView === 'combined' || chartView === 'visits') && (
                <YAxis 
                  yAxisId="visits"
                  orientation={chartView === 'visits' ? 'left' : 'right'}
                  allowDecimals={false}
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                  tickFormatter={(val) => `${val}`}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
              )}
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
                  yAxisId="earnings"
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
                  yAxisId="visits"
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

      {/* Referral Traffic & Channel Sources */}
      <GlassCard className="p-6 border border-white/[0.08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/20 text-[#f3aa18] flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Chakra_Petch'] uppercase tracking-wider">
                Audience Traffic Sources
              </h3>
              <p className="text-xs text-zinc-400">
                Where your shoppers and incoming referral visits are coming from.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs text-neutral-400 px-3 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] self-start sm:self-auto">
            {horizonClicks.length.toLocaleString('id-ID')} Total Clicks
          </span>
        </div>

        {creatorTrafficSources.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-500 italic">
            No referral traffic sources recorded yet. Share your branded link to start tracking channels.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {creatorTrafficSources.map((item) => (
              <div
                key={item.source}
                className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate max-w-[110px]" title={item.source}>
                    {item.source}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#f3aa18]">
                    {item.percentage}%
                  </span>
                </div>
                <div className="mt-2 text-xs font-mono text-zinc-400 flex items-center justify-between">
                  <span>Visits:</span>
                  <span className="text-zinc-200 font-semibold">{item.count.toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
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
                className="pl-9 pr-3 py-1.5 bg-[#050506] border border-white/[0.1] rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all font-mono"
              />
            </div>

            {/* Beautiful Custom Dropdown */}
            <div className="w-48">
              <CustomSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as CommissionFilterStatus)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: 'Grace Period (7D)', badge: 'Pending', badgeVariant: 'amber' },
                  { value: 'unpaid', label: 'Cleared (Unpaid)', badge: 'Cleared', badgeVariant: 'lime' },
                  { value: 'paid', label: 'Paid Out', badge: 'Paid', badgeVariant: 'zinc' },
                  { value: 'rejected', label: 'Rejected', badge: 'Void', badgeVariant: 'rose' },
                ]}
              />
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
              <p className="text-sm font-semibold text-white">No commissions recorded yet</p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Customer purchases made via your referral links will appear here after orders are placed.
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
                      #{comm.order_number || (comm as any).order_id || comm.id}
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
                      {comm.commission_rate != null ? `${comm.commission_rate}%` : `${commissionRate}%`}
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

      {/* QR Code Modal (Mounted to document.body for true edge-to-edge fullscreen backdrop) */}
      {showQrModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md pointer-events-auto transition-opacity"
            onClick={() => setShowQrModal(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-[#0c0c0e] border border-white/[0.1] rounded-3xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl animate-modal-enter pointer-events-auto">
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
        </div>,
        document.body
      )}

    </div>
  );
};
