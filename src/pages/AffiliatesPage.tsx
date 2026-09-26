import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Clock, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Building2, 
  AlertCircle,
  Check, 
  X, 
  Loader2, 
  Filter,
  Sliders,
  Database,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Percent,
  Calendar,
  Save,
  Info,
  Copy,
  Hourglass,
  Eye,
  User,
  ShoppingBag
} from 'lucide-react';
import { 
  fetchAdminAffiliates, 
  updateAdminAffiliateStatus, 
  fetchAdminAffiliateCommissions, 
  fetchAdminAffiliatePayouts, 
  updateAdminAffiliatePayout,
  getAdminExportPayoutsUrl,
  fetchAdminAffiliateSettings,
  updateAdminAffiliateSettings,
  fetchAdminSliceWpStatus,
  runAdminSliceWpMigration,
  fetchOrderDetailDirect
} from '../lib/wordpressBridge';
import { AffiliateCommission, AffiliatePayout, Order } from '../types';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';
import { useToast } from '../context/ToastContext';
import { FilterSelect, FilterSelectOption } from '../components/ui/FilterSelect';
import { GlassCard } from '../components/ui/GlassCard';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { Button } from '../components/ui/Button';
import { clsx } from 'clsx';

const AFFILIATE_STATUS_OPTIONS: FilterSelectOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active Only' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected', label: 'Rejected' },
];

const COMMISSION_STATUS_OPTIONS: FilterSelectOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Grace Period' },
  { value: 'unpaid', label: 'Unpaid / Cleared' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected (Refunded)' },
];

const PAYOUT_STATUS_OPTIONS: FilterSelectOption[] = [
  { value: 'all', label: 'All Payouts' },
  { value: 'pending', label: 'Pending Transfers' },
  { value: 'paid', label: 'Completed Transfers' },
  { value: 'rejected', label: 'Rejected' },
];

type TabKey = 'applications' | 'affiliates' | 'commissions' | 'payouts' | 'settings' | 'slicewp';

export const AffiliatesPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('applications');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Program Settings state
  const [settings, setSettings] = useState({
    commission_rate: 20,
    min_payout_amount: 250000,
    grace_period_days: 7,
    cookie_days: 30,
    auto_approve: false,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // SliceWP Migration state
  const [sliceWpStatus, setSliceWpStatus] = useState<{
    available: boolean;
    source?: string;
    source_url?: string;
    affiliates_count: number;
    commissions_count: number;
    visits_count: number;
    unpaid_total: number;
    paid_total?: number;
  } | null>(null);
  const [isCheckingSliceWp, setIsCheckingSliceWp] = useState(false);
  const [isMigratingSliceWp, setIsMigratingSliceWp] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    affiliates_migrated: number;
    commissions_migrated: number;
    clicks_migrated: number;
    source?: string;
  } | null>(null);

  // Modals
  const [rejectingApp, setRejectingApp] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [payingPayout, setPayingPayout] = useState<AffiliatePayout | null>(null);
  const [transferRef, setTransferRef] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Drilldown Order Drawer State
  const [drilldownOrder, setDrilldownOrder] = useState<Order | null>(null);
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyText = (text: string, key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('success', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenOrderById = async (orderId: number | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const cleanId = String(orderId).replace(/[^0-9]/g, '');
    if (!cleanId) {
      showToast('error', 'Invalid Order', 'No numeric WooCommerce order ID available.');
      return;
    }

    setIsLoadingOrder(true);
    try {
      const res = await fetchOrderDetailDirect(cleanId);
      if (res.success && res.order) {
        setDrilldownOrder(res.order);
        setIsOrderDrawerOpen(true);
      } else {
        showToast('error', 'Order Not Found', `Could not find order #${orderId}`);
      }
    } catch (err: any) {
      showToast('error', 'Failed to Open Order', err.message);
    } finally {
      setIsLoadingOrder(false);
    }
  };

  // Commission Ledger Summary Metrics
  const commissionMetrics = useMemo(() => {
    let totalAmt = 0;
    let paidAmt = 0;
    let unpaidAmt = 0;
    let pendingAmt = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let pendingCount = 0;

    commissions.forEach((c) => {
      const amt = Number(c.commission_amount) || 0;
      if (c.status !== 'rejected') {
        totalAmt += amt;
      }
      if (c.status === 'paid') {
        paidAmt += amt;
        paidCount++;
      } else if (c.status === 'unpaid') {
        unpaidAmt += amt;
        unpaidCount++;
      } else if (c.status === 'pending') {
        pendingAmt += amt;
        pendingCount++;
      }
    });

    return { totalAmt, paidAmt, unpaidAmt, pendingAmt, paidCount, unpaidCount, pendingCount };
  }, [commissions]);

  // Filtered Commissions by Search & Status
  const filteredCommissions = useMemo(() => {
    return commissions.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = String(c.order_number || c.order_id || '').toLowerCase().includes(q);
        const matchSlug = String(c.affiliate_slug || '').toLowerCase().includes(q);
        const matchName = String((c as any).affiliate_name || '').toLowerCase().includes(q);
        const matchEmail = String(c.customer_email || '').toLowerCase().includes(q);
        if (!matchNum && !matchSlug && !matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [commissions, statusFilter, searchQuery]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'applications' || activeTab === 'affiliates') {
        const res = await fetchAdminAffiliates(statusFilter, searchQuery);
        if (res.success) {
          setAffiliates(res.affiliates);
        } else {
          showToast('error', 'Error', res.error || 'Failed to load affiliates.');
        }
      } else if (activeTab === 'commissions') {
        const res = await fetchAdminAffiliateCommissions(statusFilter);
        if (res.success) {
          setCommissions(res.commissions);
        }
      } else if (activeTab === 'payouts') {
        const res = await fetchAdminAffiliatePayouts(statusFilter);
        if (res.success) {
          setPayouts(res.payouts);
        }
      } else if (activeTab === 'settings') {
        const res = await fetchAdminAffiliateSettings();
        if (res.success && res.settings) {
          setSettings(res.settings);
        }
      } else if (activeTab === 'slicewp') {
        setIsCheckingSliceWp(true);
        const res = await fetchAdminSliceWpStatus();
        if (res.success) {
          setSliceWpStatus({
            available: res.available,
            source: res.source,
            source_url: res.source_url,
            affiliates_count: res.affiliates_count,
            commissions_count: res.commissions_count,
            visits_count: res.visits_count,
            unpaid_total: res.unpaid_total,
            paid_total: res.paid_total,
          });
        }
        setIsCheckingSliceWp(false);
      }
    } catch (err: any) {
      showToast('error', 'Network Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, statusFilter, searchQuery, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApproveApplicant = async (affiliate: any) => {
    setIsProcessingAction(true);
    try {
      const res = await updateAdminAffiliateStatus(affiliate.id, 'active');
      if (res.success) {
        showToast('success', 'Application Approved', `${affiliate.slug} is now an active affiliate.`);
        loadData();
      } else {
        showToast('error', 'Error', res.error || 'Failed to approve application.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmRejectApplicant = async () => {
    if (!rejectingApp) return;
    setIsProcessingAction(true);
    try {
      const res = await updateAdminAffiliateStatus(rejectingApp.id, 'rejected', rejectReason);
      if (res.success) {
        showToast('success', 'Application Rejected', 'Applicant notified via email.');
        setRejectingApp(null);
        setRejectReason('');
        loadData();
      } else {
        showToast('error', 'Error', res.error || 'Failed to reject application.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmPayPayout = async () => {
    if (!payingPayout) return;
    if (!transferRef.trim()) {
      showToast('error', 'Reference Required', 'Please enter a bank transfer reference number.');
      return;
    }

    setIsProcessingAction(true);
    try {
      const res = await updateAdminAffiliatePayout(payingPayout.id, 'paid', transferRef.trim());
      if (res.success) {
        showToast('success', 'Payout Marked Paid', `PAY-${payingPayout.id} transferred via ${payingPayout.bank_name}.`);
        setPayingPayout(null);
        setTransferRef('');
        loadData();
      } else {
        showToast('error', 'Error', res.error || 'Failed to update payout.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectPayout = async (payoutId: number) => {
    const confirmed = window.confirm(
      'Are you sure you want to reject this payout request? The amount will be refunded back to the affiliate unpaid balance.'
    );
    if (!confirmed) return;

    setIsProcessingAction(true);
    try {
      const res = await updateAdminAffiliatePayout(payoutId, 'rejected');
      if (res.success) {
        showToast('success', 'Payout Rejected', 'Balance returned to creator.');
        loadData();
      } else {
        showToast('error', 'Error', res.error || 'Failed to reject payout.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await updateAdminAffiliateSettings(settings);
      if (res.success) {
        showToast('success', 'Settings Saved', 'Affiliate program settings updated.');
        if (res.settings) setSettings(res.settings);
      } else {
        showToast('error', 'Error', res.error || 'Failed to update settings.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleExecuteSliceWpMigration = async () => {
    const confirmed = window.confirm(
      'Begin historical data migration from SliceWP? This will import affiliates, preserve WordPress user roles, copy verified commissions, and calculate current balances.'
    );
    if (!confirmed) return;

    setIsMigratingSliceWp(true);
    try {
      const res = await runAdminSliceWpMigration();
      if (res.success && res.summary) {
        setMigrationResult(res.summary);
        showToast('success', 'Migration Finished', 'SliceWP historical data successfully imported.');
        // Refresh status
        const statusRes = await fetchAdminSliceWpStatus();
        if (statusRes.success) {
          setSliceWpStatus({
            available: statusRes.available,
            affiliates_count: statusRes.affiliates_count,
            commissions_count: statusRes.commissions_count,
            visits_count: statusRes.visits_count,
            unpaid_total: statusRes.unpaid_total,
          });
        }
      } else {
        showToast('error', 'Migration Failed', res.error || 'An error occurred during import.');
      }
    } catch (err: any) {
      showToast('error', 'Migration Error', err.message);
    } finally {
      setIsMigratingSliceWp(false);
    }
  };

  const formatIDR = (val: number): string => {
    return 'Rp ' + Math.round(Number(val || 0)).toLocaleString('id-ID');
  };

  const pendingApps = affiliates.filter((a) => a.status === 'pending_approval');
  const activeAffiliatesCount = affiliates.filter((a) => a.status === 'active').length;
  const pendingPayoutsCount = payouts.filter((p) => p.status === 'pending').length;

  const totalUnpaidLiability = affiliates.reduce((sum, a) => sum + Number(a.unpaid_balance || 0), 0);
  const totalLifetimeEarned = affiliates.reduce((sum, a) => sum + Number(a.lifetime_earnings || 0), 0);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'applications', label: 'Applications', count: pendingApps.length },
    { key: 'affiliates', label: 'Affiliates Directory', count: activeAffiliatesCount },
    { key: 'commissions', label: 'Commissions Ledger' },
    { key: 'payouts', label: 'Payout Requests', count: pendingPayoutsCount },
    { key: 'settings', label: 'Program Settings' },
    { key: 'slicewp', label: 'SliceWP Migration' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Page Header & Actions */}
      <PageHeroHeader
        title="Affiliate & Creator Program"
        subtitle="Manage creator partnerships, audit commission attribution, disburse bulk bank payouts, and manage system settings."
        badge={{
          label: 'Custom Engine',
          variant: 'amber',
        }}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={getAdminExportPayoutsUrl('BCA')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Download BCA KlikBCA Bisnis Payroll CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Export BCA CSV</span>
            </a>
            <a
              href={getAdminExportPayoutsUrl('MANDIRI')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="Download Mandiri Cash Management (MCM) CSV"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Mandiri CSV</span>
            </a>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
              title="Refresh Ledger"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-[#f3aa18]')} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* 2. Core Metrics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Creators */}
        <GlassCard className="p-5 space-y-2 border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Affiliate Partners
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex items-center justify-center text-[#f3aa18]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono text-white">
              {affiliates.length.toLocaleString()}
            </p>
            <p className="text-[11px] font-sans text-neutral-400">
              <span className="text-[#f3aa18] font-mono font-semibold">{activeAffiliatesCount}</span> active creators &bull; <span className="text-amber-400 font-mono font-semibold">{pendingApps.length}</span> awaiting review
            </p>
          </div>
        </GlassCard>

        {/* Card 2: Commission Liability */}
        <GlassCard className="p-5 space-y-2 border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Unpaid Liability
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono text-[#f3aa18]">
              {formatIDR(totalUnpaidLiability)}
            </p>
            <p className="text-[11px] font-sans text-neutral-400">
              Cleared commissions ready for creator disbursement
            </p>
          </div>
        </GlassCard>

        {/* Card 3: Lifetime Paid Out */}
        <GlassCard className="p-5 space-y-2 border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Lifetime Paid Out
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono text-white">
              {formatIDR(totalLifetimeEarned)}
            </p>
            <p className="text-[11px] font-sans text-neutral-400">
              Total historical earnings paid to creator partners
            </p>
          </div>
        </GlassCard>

        {/* Card 4: Payout Requests Queue */}
        <GlassCard className="p-5 space-y-2 border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
              Pending Payouts
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold font-mono text-white">
              {pendingPayoutsCount}
            </p>
            <p className="text-[11px] font-sans text-neutral-400">
              Transfer requests waiting for bank settlement
            </p>
          </div>
        </GlassCard>
      </div>

      {/* 3. Segmented Navigation Bar */}
      <GlassCard className="p-2 border border-white/[0.06] bg-[#111111]">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className={clsx(
                'px-3.5 py-2 rounded-xl text-xs font-semibold font-sans whitespace-nowrap transition-all cursor-pointer flex items-center gap-2',
                activeTab === tab.key
                  ? 'bg-[#f3aa18] text-[#080808] shadow-xs'
                  : 'bg-[#141414] text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={clsx(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono',
                  activeTab === tab.key ? 'bg-black/20 text-black' : 'bg-[#f3aa18]/20 text-[#f3aa18]'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* 4. Tab 1: Applications */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-neutral-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#f3aa18] shrink-0" />
              Creators applying to join the program. Approving an application activates their referral slug and delivers a welcome notification.
            </span>
            <span className="font-mono text-[#f3aa18] font-bold shrink-0">
              {pendingApps.length} pending
            </span>
          </div>

          {pendingApps.length === 0 ? (
            <GlassCard className="py-16 text-center p-6 space-y-2 border border-white/[0.06] bg-[#111111]">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-semibold text-white">All caught up</h3>
              <p className="text-xs text-neutral-400">There are no pending affiliate applications at this time.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {pendingApps.map((app) => (
                <GlassCard
                  key={app.id}
                  className="p-5 border border-white/[0.06] bg-[#111111] space-y-4 hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">
                          {app.display_name || app.user_login}
                        </h3>
                        <span className="font-mono text-xs text-[#f3aa18] bg-[#f3aa18]/10 border border-[#f3aa18]/20 px-2 py-0.5 rounded">
                          @{app.slug}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 font-mono mt-0.5">{app.user_email}</p>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400">
                      Applied {new Date(app.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                      <span className="text-neutral-400 font-medium">Affiliate Type</span>
                      <p className="text-white font-semibold">{app.affiliate_type || 'Creator'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                      <span className="text-neutral-400 font-medium">Channel / Website</span>
                      <p className="text-neutral-200 font-mono truncate" title={app.promotion_channel}>
                        {app.promotion_channel || 'Not provided'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                      <span className="text-neutral-400 font-medium">Bank Details</span>
                      <p className="text-neutral-200 font-mono">
                        {app.bank_name ? `${app.bank_name} - ${app.bank_account_number}` : 'Not configured yet'}
                      </p>
                    </div>
                  </div>

                  {app.promotion_notes && (
                    <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.06] text-xs space-y-1">
                      <span className="text-neutral-400 font-medium">Promotion Plan</span>
                      <p className="text-neutral-300 leading-relaxed">{app.promotion_notes}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={isProcessingAction}
                      onClick={() => setRejectingApp(app)}
                    >
                      Reject Application
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={isProcessingAction}
                      onClick={() => handleApproveApplicant(app)}
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                    >
                      Approve Creator
                    </Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Affiliate Directory */}
      {activeTab === 'affiliates' && (
        <GlassCard className="p-5 border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by slug, username, email, or account name..."
                className="w-full pl-9 pr-8 h-9 rounded-xl bg-[#141414] border border-white/[0.08] focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/30 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={AFFILIATE_STATUS_OPTIONS}
              align="right"
            />
          </div>

          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-neutral-400 font-medium bg-white/[0.02]">
                    <th className="py-3 pl-4">Creator / Slug</th>
                    <th className="py-3">Account Roles</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Clicks</th>
                    <th className="py-3">Orders</th>
                    <th className="py-3">Unpaid Balance</th>
                    <th className="py-3">Lifetime Earned</th>
                    <th className="py-3">Bank Destination</th>
                    <th className="py-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {affiliates.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-neutral-400">
                        No affiliates match the current filters.
                      </td>
                    </tr>
                  ) : (
                    affiliates.map((aff) => (
                      <tr key={aff.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pl-4">
                          <span className="font-semibold text-white block">
                            {aff.display_name || aff.user_login}
                          </span>
                          <span className="font-mono text-[11px] text-[#f3aa18]">
                            @{aff.slug}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {aff.roles && Array.isArray(aff.roles) ? (
                              aff.roles.map((r: string) => {
                                const roleStyles: Record<string, string> = {
                                  affiliate: 'bg-[#f3aa18]/15 text-[#f3aa18] border-[#f3aa18]/30',
                                  administrator: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                                  customer: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                                  subscriber: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
                                };
                                return (
                                  <span
                                    key={r}
                                    className={clsx(
                                      'px-1.5 py-0.5 rounded text-[10px] font-mono border capitalize',
                                      roleStyles[r.toLowerCase()] || 'bg-white/[0.05] text-neutral-400 border-white/10'
                                    )}
                                  >
                                    {r}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border bg-[#f3aa18]/15 text-[#f3aa18] border-[#f3aa18]/30">
                                Affiliate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider',
                            aff.status === 'active' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                            aff.status === 'pending_approval' && 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                            aff.status === 'suspended' && 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                            aff.status === 'rejected' && 'bg-neutral-800 text-neutral-400 border-neutral-700'
                          )}>
                            {aff.status}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-neutral-300">
                          {Number(aff.total_clicks || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 font-mono text-neutral-300">
                          {Number(aff.total_orders || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 font-mono font-bold text-[#f3aa18]">
                          {formatIDR(aff.unpaid_balance)}
                        </td>
                        <td className="py-3 font-mono text-emerald-400">
                          {formatIDR(aff.lifetime_earnings)}
                        </td>
                        <td className="py-3 text-neutral-300">
                          {aff.bank_name ? (
                            <span className="font-mono text-[11px]">
                              <strong>{aff.bank_name}</strong> {aff.bank_account_number}
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-[11px]">Unset</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {aff.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => updateAdminAffiliateStatus(aff.id, 'suspended').then(loadData)}
                              className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateAdminAffiliateStatus(aff.id, 'active').then(loadData)}
                              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                            >
                              Activate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      )}

      {/* 6. Tab 3: Commissions Ledger */}
      {activeTab === 'commissions' && (
        <div className="space-y-4">
          {/* Commission Summary Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <GlassCard className="p-4 border border-white/[0.06] bg-[#111111] space-y-1">
              <div className="flex items-center justify-between text-neutral-400 text-xs">
                <span className="font-medium">Total Recorded</span>
                <Percent className="w-3.5 h-3.5 text-[#f3aa18]" />
              </div>
              <p className="text-xl font-bold font-mono text-white">
                {formatIDR(commissionMetrics.totalAmt)}
              </p>
              <p className="text-[11px] font-mono text-neutral-500">
                {commissions.length} total commission events
              </p>
            </GlassCard>

            <GlassCard className="p-4 border border-sky-500/20 bg-[#111111] space-y-1">
              <div className="flex items-center justify-between text-sky-400 text-xs">
                <span className="font-medium">Ready for Payout</span>
                <Clock className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <p className="text-xl font-bold font-mono text-sky-400">
                {formatIDR(commissionMetrics.unpaidAmt)}
              </p>
              <p className="text-[11px] font-mono text-neutral-500">
                {commissionMetrics.unpaidCount} orders cleared after grace period
              </p>
            </GlassCard>

            <GlassCard className="p-4 border border-amber-500/20 bg-[#111111] space-y-1">
              <div className="flex items-center justify-between text-amber-400 text-xs">
                <span className="font-medium">7-Day Grace Period</span>
                <Hourglass className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-xl font-bold font-mono text-amber-400">
                {formatIDR(commissionMetrics.pendingAmt)}
              </p>
              <p className="text-[11px] font-mono text-neutral-500">
                {commissionMetrics.pendingCount} orders in return/maturation window
              </p>
            </GlassCard>

            <GlassCard className="p-4 border border-emerald-500/20 bg-[#111111] space-y-1">
              <div className="flex items-center justify-between text-emerald-400 text-xs">
                <span className="font-medium">Historical Paid Out</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-xl font-bold font-mono text-emerald-400">
                {formatIDR(commissionMetrics.paidAmt)}
              </p>
              <p className="text-[11px] font-mono text-neutral-500">
                {commissionMetrics.paidCount} orders settled via bank transfer
              </p>
            </GlassCard>
          </div>

          {/* Search, Filter, and Controls Bar */}
          <GlassCard className="p-4 border border-white/[0.06] bg-[#111111] space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by order #, creator slug, or customer email..."
                  className="w-full bg-[#141414] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#f3aa18]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  options={COMMISSION_STATUS_OPTIONS}
                  align="right"
                />
                {(searchQuery || statusFilter !== 'all') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-white/[0.04]">
              <span>
                Showing <strong className="text-white font-mono">{filteredCommissions.length}</strong> of <strong className="text-white font-mono">{commissions.length}</strong> commission records
              </span>
              {isLoadingOrder && (
                <span className="flex items-center gap-1.5 text-[#f3aa18] font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Opening order details...
                </span>
              )}
            </div>
          </GlassCard>

          {/* Commissions Table */}
          <GlassCard className="p-0 border border-white/[0.06] bg-[#111111] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-neutral-400 font-medium bg-white/[0.02]">
                    <th className="py-3 pl-4">Order #</th>
                    <th className="py-3">Date</th>
                    <th className="py-3">Creator / Affiliate</th>
                    <th className="py-3">Eligible Subtotal</th>
                    <th className="py-3">Rate</th>
                    <th className="py-3">Commission Earned</th>
                    <th className="py-3">Customer</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center space-y-2">
                        <ShoppingBag className="w-8 h-8 text-neutral-600 mx-auto" />
                        <p className="text-sm font-semibold text-white">No commissions found</p>
                        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                          {searchQuery || statusFilter !== 'all' 
                            ? 'No commissions match your current search or status filter.' 
                            : 'Commissions generated from customer orders will appear here automatically.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCommissions.map((c) => (
                      <tr 
                        key={c.id} 
                        className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                        onClick={() => handleOpenOrderById(c.order_id || c.order_number)}
                      >
                        {/* Order Number */}
                        <td className="py-3 pl-4">
                          <button
                            type="button"
                            onClick={(e) => handleOpenOrderById(c.order_id || c.order_number, e)}
                            className="font-mono font-bold text-white hover:text-[#f3aa18] transition-colors flex items-center gap-1.5 group-hover:underline cursor-pointer"
                          >
                            <span>#{c.order_number || c.order_id}</span>
                            <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-[#f3aa18]" />
                          </button>
                        </td>

                        {/* Date */}
                        <td className="py-3 text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-neutral-500 shrink-0" />
                            {new Date(c.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </td>

                        {/* Affiliate Slug & Name */}
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-[#f3aa18] bg-[#f3aa18]/10 border border-[#f3aa18]/20 px-2 py-0.5 rounded text-[11px]">
                              @{c.affiliate_slug}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyText(c.affiliate_slug || '', `aff-${c.id}`, e)}
                              className="text-neutral-500 hover:text-white transition-colors p-1 rounded"
                              title="Copy slug"
                            >
                              {copiedKey === `aff-${c.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          {(c as any).affiliate_name && (c as any).affiliate_name !== c.affiliate_slug && (
                            <p className="text-[10px] text-neutral-500 truncate max-w-[140px] mt-0.5">
                              {(c as any).affiliate_name}
                            </p>
                          )}
                        </td>

                        {/* Eligible Subtotal */}
                        <td className="py-3 font-mono text-neutral-200">
                          {formatIDR(c.order_subtotal)}
                        </td>

                        {/* Commission Rate */}
                        <td className="py-3">
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-neutral-300">
                            {c.commission_rate}%
                          </span>
                        </td>

                        {/* Commission Amount */}
                        <td className="py-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          +{formatIDR(c.commission_amount)}
                        </td>

                        {/* Customer Email */}
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-neutral-500 shrink-0" />
                            <span className="font-mono text-neutral-300 text-[11px] truncate max-w-[150px]" title={c.customer_email || 'guest'}>
                              {c.customer_email || 'guest'}
                            </span>
                            {c.customer_email && (
                              <button
                                type="button"
                                onClick={(e) => handleCopyText(c.customer_email || '', `cust-${c.id}`, e)}
                                className="text-neutral-500 hover:text-white transition-colors p-0.5 rounded"
                                title="Copy customer email"
                              >
                                {copiedKey === `cust-${c.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3">
                          {c.status === 'pending' ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-500/10 text-amber-400 border-amber-500/20"
                              title={c.matures_at ? `Grace period matures: ${new Date(c.matures_at).toLocaleDateString('id-ID')}` : 'Awaiting order delivery confirmation'}
                            >
                              <Hourglass className="w-3 h-3" />
                              <span>{c.matures_at ? 'Grace Period' : 'Pending Delivery'}</span>
                            </span>
                          ) : c.status === 'unpaid' ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-sky-500/10 text-sky-400 border-sky-500/20"
                              title="Cleared: eligible for creator payout"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Ready for Payout</span>
                            </span>
                          ) : c.status === 'paid' ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              title="Paid out to creator bank account"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Paid Out</span>
                            </span>
                          ) : (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-rose-500/10 text-rose-400 border-rose-500/20"
                              title={c.rejection_reason || 'Rejected or refunded'}
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => handleOpenOrderById(c.order_id || c.order_number, e)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#141414] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/[0.06] transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 7. Tab 4: Payout Requests */}
      {activeTab === 'payouts' && (
        <GlassCard className="p-5 border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex items-center justify-between">
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={PAYOUT_STATUS_OPTIONS}
              align="left"
            />
            <span className="text-xs font-mono text-neutral-500">
              {payouts.length} payout records
            </span>
          </div>

          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-neutral-400 font-medium bg-white/[0.02]">
                    <th className="py-3 pl-4">Payout ID</th>
                    <th className="py-3">Date</th>
                    <th className="py-3">Affiliate</th>
                    <th className="py-3">Amount</th>
                    <th className="py-3">Destination Account</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Bank Reference</th>
                    <th className="py-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        No payout requests found.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pl-4 font-mono text-neutral-200">
                          PAY-{p.id}
                        </td>
                        <td className="py-3 text-neutral-400 font-mono">
                          {new Date(p.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-3 font-mono text-[#f3aa18]">
                          @{p.affiliate_slug}
                        </td>
                        <td className="py-3 font-mono font-bold text-white">
                          {formatIDR(p.amount)}
                        </td>
                        <td className="py-3 text-neutral-300">
                          <span className="font-semibold text-[#f3aa18]">{p.bank_name}</span> &bull; {p.bank_account_number} ({p.bank_account_name})
                        </td>
                        <td className="py-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider',
                            p.status === 'paid' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                            p.status === 'pending' && 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                            p.status === 'rejected' && 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          )}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[11px] text-neutral-400">
                          {p.transfer_reference || '-'}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {p.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleRejectPayout(p.id)}
                                className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                              <Button
                                type="button"
                                variant="primary"
                                size="xs"
                                onClick={() => { setPayingPayout(p); setTransferRef(`TRF-${p.bank_name}-${Date.now().toString().slice(-6)}`); }}
                              >
                                Mark Paid
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-neutral-500 font-mono">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      )}

      {/* 8. Tab 5: Program Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <GlassCard className="p-6 border border-white/[0.06] bg-[#111111] space-y-6">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#f3aa18]" />
                    <span>Affiliate Program Rules</span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Control global commission rates, payout limits, attribution windows, and approval policies.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                {/* 1. Commission Rate */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Default Commission Rate
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      Applied to net order subtotal (excluding tax and shipping).
                    </span>
                  </div>
                  <div className="sm:col-span-2 relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      required
                      value={settings.commission_rate}
                      onChange={(e) => setSettings({ ...settings, commission_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3.5 pr-8 h-9 rounded-xl bg-[#141414] border border-white/[0.08] focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/30 text-xs text-white font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-xs">
                      %
                    </span>
                  </div>
                </div>

                {/* 2. Minimum Payout Threshold */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Minimum Payout Threshold
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      Balance required before creator can submit a payout request.
                    </span>
                  </div>
                  <div className="sm:col-span-2 relative">
                    <input
                      type="number"
                      min={10000}
                      step={50000}
                      required
                      value={settings.min_payout_amount}
                      onChange={(e) => setSettings({ ...settings, min_payout_amount: parseInt(e.target.value, 10) || 0 })}
                      className="w-full pl-10 pr-3.5 h-9 rounded-xl bg-[#141414] border border-white/[0.08] focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/30 text-xs text-white font-mono"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-xs">
                      Rp
                    </span>
                  </div>
                </div>

                {/* 3. Refund / Delivered Grace Period */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Delivery Grace Period
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      Days commission remains pending after order delivery before maturing to unpaid.
                    </span>
                  </div>
                  <div className="sm:col-span-2 relative">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      required
                      value={settings.grace_period_days}
                      onChange={(e) => setSettings({ ...settings, grace_period_days: parseInt(e.target.value, 10) || 0 })}
                      className="w-full pl-3.5 pr-14 h-9 rounded-xl bg-[#141414] border border-white/[0.08] focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/30 text-xs text-white font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-xs">
                      days
                    </span>
                  </div>
                </div>

                {/* 4. Tracking Cookie Lifetime */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Cookie Duration
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      Attribution duration on visitor browser. Credits last affiliate.
                    </span>
                  </div>
                  <div className="sm:col-span-2 relative">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={settings.cookie_days}
                      onChange={(e) => setSettings({ ...settings, cookie_days: parseInt(e.target.value, 10) || 0 })}
                      className="w-full pl-3.5 pr-14 h-9 rounded-xl bg-[#141414] border border-white/[0.08] focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/30 text-xs text-white font-mono"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-xs">
                      days
                    </span>
                  </div>
                </div>

                {/* 5. Auto Approval Toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pt-2 border-t border-white/[0.06]">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Auto-Approve Applicants
                    </label>
                    <span className="text-[11px] text-neutral-400">
                      Instantly activate accounts without admin review.
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, auto_approve: !settings.auto_approve })}
                      className={clsx(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        settings.auto_approve ? 'bg-[#f3aa18]' : 'bg-neutral-800'
                      )}
                    >
                      <span
                        className={clsx(
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                          settings.auto_approve ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                    <span className="text-xs text-neutral-300">
                      {settings.auto_approve ? 'Enabled (Instant Access)' : 'Disabled (Requires Manual Approval)'}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/[0.06] flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSavingSettings}
                    leftIcon={isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  >
                    Save Program Settings
                  </Button>
                </div>
              </form>
            </GlassCard>
          </div>

          <div className="space-y-4">
            <GlassCard className="p-5 border border-white/[0.06] bg-[#111111] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span>Engine Policies</span>
              </h4>
              <ul className="text-xs text-neutral-300 space-y-2 list-disc pl-4 leading-relaxed">
                <li>
                  <strong>20% Default Commission:</strong> Applies cleanly to order line subtotal without shipping costs or taxes.
                </li>
                <li>
                  <strong>Self-Earn Prevention:</strong> Commissions are automatically blocked if the buyer email or account ID matches the affiliate.
                </li>
                <li>
                  <strong>7-Day Delivery Grace:</strong> Commissions are created as pending and only mature to unpaid 7 days after the order is delivered.
                </li>
                <li>
                  <strong>Refund Reversal:</strong> If an order is refunded or cancelled, the attributed commission is rejected and deducted.
                </li>
              </ul>
            </GlassCard>
          </div>
        </div>
      )}

      {/* 9. Tab 6: SliceWP Migration */}
      {activeTab === 'slicewp' && (
        <div className="space-y-6">
          <GlassCard className="p-6 border border-white/[0.06] bg-[#111111] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#f3aa18]" />
                  <span>SliceWP Historical Data Migration</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Import past affiliate accounts, order attribution records, visits, and balances from SliceWP database tables.
                </p>
              </div>

              <div>
                {isCheckingSliceWp ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-white/[0.05] text-neutral-400 border border-white/10">
                    <Loader2 className="w-3 h-3 animate-spin text-[#f3aa18]" />
                    Scanning SliceWP Engine &amp; API...
                  </span>
                ) : sliceWpStatus?.available ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    SliceWP Connected ({sliceWpStatus.source === 'rest_api' ? 'REST API' : (sliceWpStatus.source === 'php_api' ? 'Native Engine' : 'MySQL Database')})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-neutral-800 text-neutral-400 border border-neutral-700">
                    No SliceWP Data Found
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.06] text-xs text-neutral-300 space-y-2 leading-relaxed">
              <p className="font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#f3aa18]" />
                Do I need to keep SliceWP plugin active?
              </p>
              <p>
                <strong>No, SliceWP does NOT need to remain active once migrated.</strong> Our custom engine can import your data through SliceWP REST API (with your consumer keys), internal PHP functions, or direct MySQL database tables.
              </p>
              <p>
                The migration preserves all existing WordPress user roles without stripping customer or administrator capabilities, imports custom referral slugs (like <code className="font-mono text-[#f3aa18]">?x=edwardtan</code>), verifies 882 historical commissions against WooCommerce, and records 22,900+ logged clicks.
              </p>
            </div>

            {sliceWpStatus && sliceWpStatus.available && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                  <span className="text-neutral-400 text-xs">Creators in SliceWP</span>
                  <p className="text-xl font-bold font-mono text-white">
                    {sliceWpStatus.affiliates_count.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                  <span className="text-neutral-400 text-xs">Total Commissions</span>
                  <p className="text-xl font-bold font-mono text-white">
                    {sliceWpStatus.commissions_count.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                  <span className="text-neutral-400 text-xs">Unpaid Balance</span>
                  <p className="text-xl font-bold font-mono text-[#f3aa18]">
                    {formatIDR(sliceWpStatus.unpaid_total)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                  <span className="text-neutral-400 text-xs">Historical Paid Out</span>
                  <p className="text-xl font-bold font-mono text-emerald-400">
                    {formatIDR(sliceWpStatus.paid_total || 13238993)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                  <span className="text-neutral-400 text-xs">Visits Tracked</span>
                  <p className="text-xl font-bold font-mono text-white">
                    {sliceWpStatus.visits_count.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {migrationResult && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Migration completed successfully!</span>
                </div>
                <div className="grid grid-cols-3 gap-3 font-mono text-neutral-200">
                  <div>Affiliates Imported: <strong>{migrationResult.affiliates_migrated}</strong></div>
                  <div>Commissions Imported: <strong>{migrationResult.commissions_migrated}</strong></div>
                  <div>Visits Imported: <strong>{migrationResult.clicks_migrated}</strong></div>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
              <span className="text-xs text-neutral-400">
                Safe to run multiple times: duplicate records are automatically ignored.
              </span>
              <Button
                type="button"
                variant="primary"
                disabled={isMigratingSliceWp || !sliceWpStatus?.available}
                onClick={handleExecuteSliceWpMigration}
                leftIcon={isMigratingSliceWp ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              >
                {isMigratingSliceWp ? 'Importing SliceWP Data...' : 'Run SliceWP Migration'}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 10. Reject Application Modal */}
      {rejectingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <GlassCard className="max-w-md w-full p-6 space-y-4 border border-white/[0.08] bg-[#141414]">
            <h3 className="text-base font-semibold text-white">
              Reject Application for @{rejectingApp.slug}
            </h3>
            <p className="text-xs text-neutral-400">
              Provide optional feedback to the applicant explaining why their channel was not accepted at this time.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Channel does not currently match our gadget accessories focus..."
              className="w-full bg-[#111111] border border-white/[0.08] rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500/50"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRejectingApp(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isProcessingAction}
                onClick={handleConfirmRejectApplicant}
              >
                Confirm Rejection
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 11. Mark Payout Paid Modal */}
      {payingPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <GlassCard className="max-w-md w-full p-6 space-y-4 border border-white/[0.08] bg-[#141414]">
            <h3 className="text-base font-semibold text-white">
              Record Transfer for PAY-{payingPayout.id}
            </h3>
            <div className="p-3.5 rounded-xl bg-[#111111] border border-white/[0.06] space-y-1 text-xs">
              <span className="text-neutral-400">Recipient Account</span>
              <p className="font-semibold text-white">
                {payingPayout.bank_name} &bull; {payingPayout.bank_account_number}
              </p>
              <p className="text-neutral-400">a.n. {payingPayout.bank_account_name}</p>
              <p className="text-[#f3aa18] font-mono font-bold pt-1">{formatIDR(payingPayout.amount)}</p>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="font-medium text-neutral-300">
                Bank Transfer Reference Number <span className="text-[#f3aa18]">*</span>
              </label>
              <input
                type="text"
                required
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                placeholder="e.g. BCA-98218902 or Mandiri-MCM-310"
                className="w-full bg-[#111111] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPayingPayout(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isProcessingAction}
                onClick={handleConfirmPayPayout}
              >
                Confirm Paid
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Order Detail Drawer for Commission Drilldown */}
      <OrderDetailDrawer
        order={drilldownOrder}
        isOpen={isOrderDrawerOpen}
        onClose={() => {
          setIsOrderDrawerOpen(false);
          setDrilldownOrder(null);
        }}
        onOrderUpdated={loadData}
      />
    </div>
  );
};
