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
  X, 
  ArrowRight, 
  RefreshCw, 
  Link2, 
  Sliders, 
  Search, 
  Percent 
} from 'lucide-react';
import { 
  AffiliateProfile, 
  AffiliateCommission, 
  AffiliateClick, 
  AffiliateDailyStat,
  AffiliatePayout 
} from '../../types';
import { requestAffiliatePayout } from '../../lib/wordpressBridge';
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

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  const unpaidBalance = Number(metrics.unpaid_balance) || 0;
  const minPayout = Number(metrics.min_payout_amount) || 250000;
  const payoutProgressPercent = Math.min(100, Math.round((unpaidBalance / minPayout) * 100));
  const hasValidBank = Boolean(profile.bank_name && profile.bank_account_number);
  const hasPendingPayout = Boolean(payouts && payouts.some((p) => p.status === 'pending'));
  const canRequestPayout = unpaidBalance >= minPayout && hasValidBank && !hasPendingPayout && profile.status === 'active';

  const handleConfirmPayout = async () => {
    setIsSubmittingPayout(true);
    try {
      const res = await requestAffiliatePayout(profile.id);
      if (res.success) {
        showToast('success', 'Payout Requested', res.message || 'Your payout request has been submitted.');
        setShowPayoutModal(false);
        onRefresh();
      } else {
        showToast('error', 'Request Failed', res.message || 'Failed to submit payout request.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Unexpected network error.');
    } finally {
      setIsSubmittingPayout(false);
    }
  };

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

      {/* Referral Link & Sharing Bar */}
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
              Share this link across your bio or descriptions to attribute customer purchases for 30 days.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                value={referralUrl}
                className="w-full bg-[#050506] border border-white/[0.1] rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-zinc-200 select-all focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60"
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

      {/* Direct Customer Discount Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx(
              "text-[11px] font-semibold px-2.5 py-0.5 rounded-full border font-mono flex items-center gap-1",
              discountRate > 0 
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : "text-neutral-400 bg-white/[0.05] border-white/10"
            )}>
              <Percent className="w-3 h-3 text-neutral-400" />
              {discountRate > 0 ? `CUSTOMER DISCOUNT: ${discountRate}% OFF` : 'STANDARD CREATOR LINK (0% OFF)'}
            </span>
            <span className="text-[11px] font-semibold text-[#f3aa18] bg-[#f3aa18]/10 px-2.5 py-0.5 rounded-full border border-[#f3aa18]/25 font-mono">
              YOUR COMMISSION: {commissionRate}% CASH
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              (Total Pool: {maxPool}%)
            </span>
          </div>
          <p className="text-xs text-zinc-300">
            {discountRate > 0 ? (
              <>
                Shoppers clicking your link automatically receive a <strong className="text-white">{discountRate}% discount</strong> from <strong className="text-[#f3aa18]">{profile.display_name || profile.username}</strong> without entering any coupon code.
              </>
            ) : (
              <>
                Shoppers clicking your link shop at standard store prices while you earn your full <strong className="text-white">{commissionRate}% commission</strong> on every order.
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('settings')}
            leftIcon={<Sliders className="w-3.5 h-3.5 text-[#f3aa18]" />}
          >
            Adjust Split Slider
          </Button>
        </div>
      </div>

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
            {hasPendingPayout ? (
              <div className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Request Under Review</span>
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('payouts')}
                  className="text-[10px] text-amber-300 hover:text-white underline cursor-pointer"
                >
                  View
                </button>
              </div>
            ) : canRequestPayout ? (
              <button
                type="button"
                onClick={() => setShowPayoutModal(true)}
                className="w-full mt-1.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-zinc-950" />
                <span>Request Payout</span>
              </button>
            ) : unpaidBalance >= minPayout && !hasValidBank ? (
              <div className="space-y-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => onNavigateTab('settings')}
                  className="w-full py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Add Bank Info to Withdraw</span>
                </button>
                <p className="text-[10px] text-amber-400/80 text-center">
                  BCA or Mandiri details required
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-400">
                {formatIDR(minPayout - unpaidBalance)} remaining to withdraw (min. Rp 250k)
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

        {/* Card 4: Orders & Conversion Rate */}
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
            <span className="font-mono text-[#f3aa18] font-bold">{commissionRate}% Net</span>
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

      {/* Payout Request Confirmation Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md pointer-events-auto transition-opacity"
            onClick={() => !isSubmittingPayout && setShowPayoutModal(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-0 z-10 overflow-y-auto flex items-center justify-center p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payout-modal-title"
          >
            <div className="pointer-events-auto relative w-full max-w-md bg-[#0e0e11] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="payout-modal-title" className="text-sm font-bold text-white font-['Chakra_Petch'] uppercase tracking-wider">
                      Request Payout
                    </h3>
                    <p className="text-xs text-zinc-400">Direct creator balance withdrawal</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmittingPayout}
                  onClick={() => setShowPayoutModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Payout Amount</span>
                  <span className="font-mono text-base font-bold text-emerald-400">
                    {formatIDR(unpaidBalance)}
                  </span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Destination Bank:</span>
                    <span className="text-zinc-200 font-semibold">{profile.bank_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Account Number:</span>
                    <span className="text-zinc-200">{profile.bank_account_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Account Holder:</span>
                    <span className="text-zinc-200">{profile.bank_account_name || profile.display_name || profile.username}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                An instant Pushover notification will be sent to the Exacoat admin team upon submission. Transfers will be completed to your verified bank account.
              </p>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="flex-1"
                  disabled={isSubmittingPayout}
                  onClick={() => setShowPayoutModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="default"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold border-none"
                  disabled={isSubmittingPayout}
                  onClick={handleConfirmPayout}
                  isLoading={isSubmittingPayout}
                  leftIcon={!isSubmittingPayout && <Check className="w-4 h-4 text-zinc-950" />}
                >
                  Confirm Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
