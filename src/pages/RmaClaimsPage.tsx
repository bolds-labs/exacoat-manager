import React, { useState, useEffect, useCallback } from 'react';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { useToast } from '../context/ToastContext';
import {
  fetchRmaClaimsLogDirect,
  RmaClaimLogEntry,
  RmaClaimsStats,
  fetchGuaranteeClaimsDirect,
  GuaranteeClaimEntry,
  GuaranteeClaimsStats,
  processGuaranteeActionDirect,
  fetchOrderDetailDirect,
} from '../lib/wordpressBridge';
import { Order } from '../types';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';
import { WarrantyReviewModal } from '../components/orders/WarrantyReviewModal';
import { ManualWarrantyModal } from '../components/orders/ManualWarrantyModal';
import { formatCurrency } from '../lib/formatters';
import {
  ShieldCheck,
  RotateCcw,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  ExternalLink,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  VideoOff,
  Video,
  Plus,
  MapPin,
  Copy,
  Check,
  CheckCheck,
} from 'lucide-react';
import { clsx } from 'clsx';

export const RmaClaimsPage: React.FC = () => {
  const { showToast } = useToast();

  // Active Tab: Replacements (Warranty & Redeem) vs 30-Day Guarantee Returns
  const [activeTab, setActiveTab] = useState<'replacements' | 'guarantee'>('replacements');

  // Filter States for Replacements
  const [typeFilter, setTypeFilter] = useState<'all' | 'Warranty' | 'Redeem'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // Filter States for 30-Day Guarantee
  const [guaranteeStatusFilter, setGuaranteeStatusFilter] = useState<
    'all' | 'pending_return' | 'package_received' | 'refunded' | 'rejected' | 'expired'
  >('all');

  // Common Search & Paging
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 15;

  // Data States
  const [claims, setClaims] = useState<RmaClaimLogEntry[]>([]);
  const [stats, setStats] = useState<RmaClaimsStats>({
    total: 0,
    warranty_count: 0,
    redeem_count: 0,
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    waived_count: 0,
  });

  const [guaranteeClaims, setGuaranteeClaims] = useState<GuaranteeClaimEntry[]>([]);
  const [guaranteeStats, setGuaranteeStats] = useState<GuaranteeClaimsStats>({
    total: 0,
    pending_return: 0,
    package_received: 0,
    refunded: 0,
    rejected: 0,
    expired: 0,
  });

  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isActioningGuarantee, setIsActioningGuarantee] = useState<number | null>(null);
  const [copiedResi, setCopiedResi] = useState<string | null>(null);

  // Drawer and Modal States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualClaimType, setManualClaimType] = useState<'Warranty' | 'Redeem'>('Warranty');

  const loadClaims = useCallback(async () => {
    setIsLoading(true);

    try {
      if (activeTab === 'replacements') {
        const res = await fetchRmaClaimsLogDirect({
          type: typeFilter,
          status: statusFilter,
          channel: channelFilter,
          search: searchQuery.trim(),
          page,
          per_page: perPage,
        });

        if (res.success) {
          setClaims(res.claims || []);
          if (res.stats) {
            setStats(res.stats);
          }
          if (res.pagination) {
            setTotalPages(res.pagination.total_pages || 1);
            setTotalItems(res.pagination.total_items || 0);
          }
        } else {
          showToast('error', 'Log Fetch Failed', res.error || 'Failed to load RMA claims log');
        }
      } else {
        const res = await fetchGuaranteeClaimsDirect({
          status: guaranteeStatusFilter,
          search: searchQuery.trim(),
          page,
          per_page: perPage,
        });

        if (res.success) {
          // Strict Safeguard: Exclude regular orders from appearing in 30-day guarantee returns.
          // Real submissions from /money-back-guarantee ALWAYS have:
          // 1. Non-empty refund_destination OR non-empty reason OR claimed items OR return tracking resi OR refund amount > 0.
          // 2. An order with 0 refund amount, no destination, no reason, and no items is a standard order and must NEVER be shown.
          const verifiedClaims = (res.claims || []).filter((c) => {
            if (!c || !c.order_id) return false;
            const hasGuaranteeDetails = Boolean(
              (c.refund_amount && c.refund_amount > 0) ||
              (c.refund_destination && c.refund_destination !== '-' && c.refund_destination.trim() !== '') ||
              (c.reason && c.reason.trim() !== '') ||
              (c.claimed_items && c.claimed_items.length > 0) ||
              (c.return_tracking_number && c.return_tracking_number.trim() !== '')
            );
            return hasGuaranteeDetails;
          });

          // Check for overdue returns (>30 days since customer submitted return claim without sending back package)
          const now = Date.now();
          const processedClaims: GuaranteeClaimEntry[] = verifiedClaims.map((claim) => {
            let daysSinceClaim = claim.days_since_claim;
            if (daysSinceClaim === undefined && claim.submitted_at) {
              const subTs = new Date(claim.submitted_at).getTime();
              if (!isNaN(subTs) && subTs > 0) {
                daysSinceClaim = Math.max(0, Math.floor((now - subTs) / (1000 * 60 * 60 * 24)));
              }
            }

            const isOverdue = Boolean(daysSinceClaim !== undefined && daysSinceClaim > 30);
            const effectiveStatus =
              claim.guarantee_status === 'pending_return' && isOverdue ? 'expired' : claim.guarantee_status;

            return {
              ...claim,
              days_since_claim: daysSinceClaim,
              days_remaining_to_return: Math.max(0, 30 - (daysSinceClaim || 0)),
              is_expired: isOverdue || claim.guarantee_status === 'expired',
              guarantee_status: effectiveStatus,
            };
          });

          // Filter by active status if client-side post-processing adjusted statuses
          const filteredClaims = processedClaims.filter((c) => {
            if (guaranteeStatusFilter === 'all') return true;
            return c.guarantee_status === guaranteeStatusFilter;
          });

          setGuaranteeClaims(filteredClaims);

          // Recompute stats strictly from genuine claims to avoid bogus counts (e.g. 18653 from unindexed legacy endpoints):
          const isBogusStats =
            !res.stats ||
            res.stats.pending_return > 500 ||
            (res.stats.total === 0 && res.stats.pending_return > 0) ||
            res.stats.pending_return === res.stats.package_received;

          if (isBogusStats) {
            setGuaranteeStats({
              total: processedClaims.length,
              pending_return: processedClaims.filter((c) => c.guarantee_status === 'pending_return').length,
              package_received: processedClaims.filter((c) => c.guarantee_status === 'package_received').length,
              refunded: processedClaims.filter((c) => c.guarantee_status === 'refunded').length,
              rejected: processedClaims.filter((c) => c.guarantee_status === 'rejected').length,
              expired: processedClaims.filter((c) => c.guarantee_status === 'expired').length,
            });
            setTotalItems(filteredClaims.length);
            setTotalPages(Math.max(1, Math.ceil(filteredClaims.length / perPage)));
          } else {
            setGuaranteeStats(res.stats);
            setTotalItems(res.pagination?.total_items ?? filteredClaims.length);
            setTotalPages(res.pagination?.total_pages ?? 1);
          }
        } else {
          showToast('error', 'Guarantee Fetch Failed', res.error || 'Failed to load guarantee returns');
        }
      }
    } catch (err: any) {
      showToast('error', 'Network Error', err.message || 'Failed connecting to store');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, typeFilter, statusFilter, channelFilter, guaranteeStatusFilter, searchQuery, page, perPage, showToast]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleOpenOrder = async (orderId: number) => {
    try {
      const res = await fetchOrderDetailDirect(orderId);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setIsDrawerOpen(true);
      } else {
        showToast('error', 'Order Not Found', `Could not load order #${orderId}`);
      }
    } catch {
      showToast('error', 'Fetch Error', `Failed loading order #${orderId}`);
    }
  };

  const handleOpenReview = (orderId: number) => {
    setReviewOrderId(orderId);
    setIsReviewModalOpen(true);
  };

  const handleOpenManualClaim = (type: 'Warranty' | 'Redeem') => {
    setManualClaimType(type);
    setIsManualModalOpen(true);
  };

  const handleGuaranteeAction = async (
    orderId: number,
    action: 'mark_received' | 'approve_refund' | 'reject' | 'expire' | 'auto_expire_overdue'
  ) => {
    try {
      setIsActioningGuarantee(orderId);
      const res = await processGuaranteeActionDirect(orderId, action);
      if (res.success) {
        if (action === 'approve_refund') {
          showToast('success', 'Refund Approved and Paid', res.message || 'Refund issued and customer email dispatched.');
        } else if (action === 'mark_received') {
          showToast('success', 'Package Received', 'Return marked as received at Ruby Commercial TB12.');
        } else if (action === 'expire') {
          showToast('info', 'Return Authorization Expired', 'Claim marked as expired (closed).');
        } else if (action === 'auto_expire_overdue') {
          showToast('success', 'Sweep Complete', res.message || 'All overdue return claims older than 30 days expired.');
        } else {
          showToast('info', 'Claim Rejected', 'Guarantee claim marked as rejected.');
        }
        await loadClaims();
      } else {
        showToast('error', 'Action Failed', res.error || 'Failed executing action');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Action failed');
    } finally {
      setIsActioningGuarantee(null);
    }
  };

  const handleCopy = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedResi(id);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedResi(null), 2000);
  };

  const handleResetFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setChannelFilter('all');
    setGuaranteeStatusFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Hero Header */}
      <PageHeroHeader
        title="RMA Claims"
        subtitle="Review, approve, and track warranty claims, fault redeems, and 30-day guarantee return submissions."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenManualClaim('Warranty')}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manual Claim</span>
            </button>
            <button
              type="button"
              onClick={loadClaims}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-[#141414] hover:bg-zinc-200 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-[#f3aa18]')} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Module Mode Switcher Tabs */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-zinc-200/70 dark:bg-neutral-900/80 border border-zinc-300 dark:border-white/10 w-fit">
        <button
          type="button"
          onClick={() => {
            setActiveTab('replacements');
            setPage(1);
          }}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'replacements'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
              : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <Layers className={clsx('w-3.5 h-3.5', activeTab === 'replacements' ? 'text-amber-500 dark:text-amber-600' : 'text-zinc-400')} />
          <span>Warranty Claims</span>
          <span
            className={clsx(
              'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
              activeTab === 'replacements'
                ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-950'
                : 'bg-zinc-300 dark:bg-white/10 text-zinc-600 dark:text-neutral-400'
            )}
          >
            {stats.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('guarantee');
            setPage(1);
          }}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'guarantee'
              ? 'bg-purple-600 text-white font-bold shadow-xs'
              : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
          <span>30-Day Guarantee</span>
          <span
            className={clsx(
              'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
              activeTab === 'guarantee'
                ? 'bg-purple-800 text-purple-100'
                : 'bg-zinc-300 dark:bg-white/10 text-zinc-600 dark:text-neutral-400'
            )}
          >
            {guaranteeStats.total}
          </span>
        </button>
      </div>

      {/* 1. Warranty Claims View */}
      {activeTab === 'replacements' && (
        <div className="space-y-4">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px]">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-neutral-400 uppercase tracking-wider font-mono">
                Total Claims
              </span>
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mt-1">{stats.total}</div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px] border-emerald-500/20">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Warranty</span>
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-300 mt-1">
                {stats.warranty_count}
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px] border-amber-500/20">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                <span>Redeem</span>
              </span>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-300 mt-1">
                {stats.redeem_count}
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px] border-sky-500/20">
              <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Pending</span>
              </span>
              <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-300 mt-1">
                {stats.pending_count}
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px]">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-neutral-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <Truck className="w-3 h-3 text-zinc-400" />
                <span>Free Shipping</span>
              </span>
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mt-1">
                {stats.waived_count}
              </div>
            </GlassCard>
          </div>

          {/* Filters Bar */}
          <GlassCard className="p-3 sm:p-4 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search order, invoice, customer, phone..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-neutral-950 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-neutral-950 p-0.5 rounded-xl border border-zinc-200 dark:border-white/[0.08]">
              {(['all', 'Warranty', 'Redeem'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTypeFilter(t);
                    setPage(1);
                  }}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                    typeFilter === t
                      ? t === 'Redeem'
                        ? 'bg-amber-500 text-neutral-950 font-bold'
                        : t === 'Warranty'
                        ? 'bg-emerald-500 text-neutral-950 font-bold'
                        : 'bg-zinc-900 text-white dark:bg-white/20 dark:text-white font-bold'
                      : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-neutral-950 border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">All Review Statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>

            {/* Channel Select */}
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-neutral-950 border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">All Channels</option>
              <option value="web">Online Store (Web)</option>
              <option value="Shopee">Shopee</option>
              <option value="TikTok Shop">TikTok Shop</option>
              <option value="Tokopedia">Tokopedia</option>
              <option value="Manual / WhatsApp">Manual / WhatsApp</option>
            </select>
          </GlassCard>

          {/* Claims Table Container */}
          <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-neutral-900/60 text-zinc-500 dark:text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Claim Order / Date</th>
                    <th className="py-3.5 px-4">Type & Channel</th>
                    <th className="py-3.5 px-4">Original Reference</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Claimed Items & Parts</th>
                    <th className="py-3.5 px-4">Shipping Fee</th>
                    <th className="py-3.5 px-4">Review Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-zinc-500 dark:text-neutral-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#f3aa18]" />
                        <span className="text-xs">Loading warranty submissions...</span>
                      </td>
                    </tr>
                  ) : claims.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-zinc-500 dark:text-neutral-400">
                        <Layers className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-400" />
                        <div className="font-semibold text-zinc-800 dark:text-neutral-300">No Warranty Claims Found</div>
                        <div className="text-xs text-zinc-500 mt-1">No claims matching your filter or search query.</div>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-3 px-3 py-1 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-xs text-zinc-700 dark:text-neutral-300 cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    claims.map((claim) => {
                      const isRedeem = claim.type === 'Redeem';
                      return (
                        <tr key={claim.order_id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                          {/* Order & Date */}
                          <td className="py-3.5 px-4 font-mono">
                            <button
                              type="button"
                              onClick={() => handleOpenOrder(claim.order_id)}
                              className="font-bold text-zinc-900 dark:text-white hover:text-amber-500 transition-colors cursor-pointer text-xs"
                            >
                              #{claim.order_number}
                            </button>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              {claim.created_at ? claim.created_at.split(' ')[0] : ''}
                            </div>
                          </td>

                          {/* Type & Channel */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={clsx(
                                  'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                                  isRedeem
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300'
                                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                                )}
                              >
                                {isRedeem ? 'REDEEM' : 'WARRANTY'}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500 dark:text-neutral-400">
                                {claim.channel || 'Web'}
                              </span>
                            </div>
                          </td>

                          {/* Original Reference */}
                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-700 dark:text-neutral-300">
                            {claim.original_invoice ? (
                              <span className="bg-zinc-100 dark:bg-white/[0.03] px-2 py-1 rounded-lg border border-zinc-200 dark:border-white/[0.06] text-[11px] block truncate max-w-[150px]">
                                {claim.original_invoice}
                              </span>
                            ) : (
                              <span className="text-zinc-400">-</span>
                            )}
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4 min-w-[140px]">
                            <div className="font-semibold text-zinc-900 dark:text-white truncate max-w-[160px]">
                              {claim.customer_name || 'Customer'}
                            </div>
                            {claim.customer_phone && (
                              <div className="text-[10px] font-mono text-zinc-500 dark:text-neutral-400 mt-0.5">
                                {claim.customer_phone}
                              </div>
                            )}
                          </td>

                          {/* Claimed Items & Parts */}
                          <td className="py-3.5 px-4 max-w-[240px]">
                            {claim.items && claim.items.length > 0 ? (
                              <div className="space-y-1">
                                {claim.items.map((it, idx) => (
                                  <div key={idx} className="text-[11px] leading-snug">
                                    <span className="text-zinc-800 dark:text-neutral-200 font-medium">{it.name}</span>
                                    {it.claimed_parts && it.claimed_parts.length > 0 ? (
                                      <div className="text-[10px] text-amber-600 dark:text-amber-300 font-mono">
                                        Part: {it.claimed_parts.join(', ')}
                                      </div>
                                    ) : it.configuration ? (
                                      <div className="text-[10px] text-zinc-500 truncate max-w-[200px]">
                                        {it.configuration}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-zinc-500">1 Item</span>
                            )}
                          </td>

                          {/* Shipping Fee */}
                          <td className="py-3.5 px-4 font-mono">
                            {claim.waived_shipping ? (
                              <span className="text-xs font-bold text-amber-500">Rp 0 (Free)</span>
                            ) : (
                              <span className="text-xs text-zinc-700 dark:text-neutral-300">
                                {formatCurrency(claim.shipping_cost, 'IDR')}
                              </span>
                            )}
                          </td>

                          {/* Review Status & Video Indicator */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={clsx(
                                  'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                                  claim.status === 'approved'
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                                    : claim.status === 'rejected'
                                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300'
                                    : 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-300'
                                )}
                              >
                                {claim.status === 'approved'
                                  ? 'Approved'
                                  : claim.status === 'rejected'
                                  ? 'Rejected'
                                  : 'Pending'}
                              </span>

                              {claim.video_deleted ? (
                                <span className="text-[10px] text-zinc-400 dark:text-neutral-500 flex items-center gap-1">
                                  <VideoOff className="w-3 h-3" />
                                  <span>Video purged</span>
                                </span>
                              ) : claim.video_url ? (
                                <span className="text-[10px] text-sky-500 flex items-center gap-1 font-medium">
                                  <Video className="w-3 h-3" />
                                  <span>Video attached</span>
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenReview(claim.order_id)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Review, approve, or reject claim"
                              >
                                <span>Review</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenOrder(claim.order_id)}
                                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-500 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                                title="View order details"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-neutral-900/40 text-xs text-zinc-600 dark:text-neutral-400 font-mono">
              <div>
                Showing {claims.length} of {totalItems} claims (Page {page} of {totalPages})
              </div>
              <div className="flex items-center gap-1 font-sans">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-neutral-900 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-xs font-mono">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-neutral-900 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 2. 30-Day Guarantee Returns View */}
      {activeTab === 'guarantee' && (
        <div className="space-y-4">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px]">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-neutral-400 uppercase tracking-wider font-mono">
                Total Returns
              </span>
              <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mt-1">{guaranteeStats.total}</div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px] border-amber-500/20">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Awaiting Package</span>
              </span>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-300 mt-1">
                {guaranteeStats.pending_return}
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px] border-sky-500/20">
              <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <Package className="w-3 h-3" />
                <span>Package Received</span>
              </span>
              <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-300 mt-1">
                {guaranteeStats.package_received}
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px] border-emerald-500/20">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Refund Paid</span>
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-300 mt-1">
                {guaranteeStats.refunded}
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px] border-rose-500/20">
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                <span>Rejected</span>
              </span>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-300 mt-1">
                {guaranteeStats.rejected}
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between min-h-[90px] border-zinc-500/20">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-neutral-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>Expired (&gt;30d)</span>
              </span>
              <div className="text-2xl font-bold font-mono text-zinc-500 dark:text-neutral-300 mt-1">
                {guaranteeStats.expired ?? 0}
              </div>
            </GlassCard>
          </div>

          {/* Filter Bar with Hub location & Sweep Overdue */}
          <GlassCard className="p-3 sm:p-4 rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search order #, customer, email, resi..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-neutral-950 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-neutral-950 p-0.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] flex-wrap">
              {[
                { key: 'all', label: 'All Returns' },
                { key: 'pending_return', label: 'Awaiting Package' },
                { key: 'package_received', label: 'Package Received' },
                { key: 'refunded', label: 'Refund Paid' },
                { key: 'rejected', label: 'Rejected' },
                { key: 'expired', label: 'Expired (>30d)' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setGuaranteeStatusFilter(s.key as any);
                    setPage(1);
                  }}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                    guaranteeStatusFilter === s.key
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleGuaranteeAction(0, 'auto_expire_overdue')}
                disabled={isActioningGuarantee !== null}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-neutral-900 hover:bg-zinc-200 dark:hover:bg-white/[0.08] text-zinc-600 dark:text-neutral-300 border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Automatically scan and mark pending claims older than 30 days as expired"
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Sweep Overdue (&gt;30d)</span>
              </button>

              <div className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-[11px] font-mono text-zinc-600 dark:text-neutral-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span>Hub: Ruby Commercial TB12</span>
              </div>
            </div>
          </GlassCard>

          {/* Guarantee Claims Table */}
          <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-neutral-900/60 text-zinc-500 dark:text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Order / Submitted</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Return Window</th>
                    <th className="py-3.5 px-4">Refund Payout</th>
                    <th className="py-3.5 px-4">Destination</th>
                    <th className="py-3.5 px-4">Return Resi</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-zinc-500 dark:text-neutral-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                        <span className="text-xs">Loading user-submitted returns...</span>
                      </td>
                    </tr>
                  ) : guaranteeClaims.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-zinc-500 dark:text-neutral-400">
                        <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-400" />
                        <div className="font-semibold text-zinc-800 dark:text-neutral-300">No Guarantee Returns Submitted</div>
                        <div className="text-xs text-zinc-500 mt-1">
                          Only requests submitted by customers through the /money-back-guarantee portal will appear here for review.
                        </div>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-3 px-3 py-1 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-xs text-zinc-700 dark:text-neutral-300 cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    guaranteeClaims.map((claim) => {
                      const isActioning = isActioningGuarantee === claim.order_id;
                      return (
                        <tr key={claim.order_id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                          {/* Order / Submitted */}
                          <td className="py-3.5 px-4 font-mono">
                            <button
                              type="button"
                              onClick={() => handleOpenOrder(claim.order_id)}
                              className="font-bold text-zinc-900 dark:text-white hover:text-purple-400 transition-colors cursor-pointer text-xs"
                            >
                              #{claim.order_number}
                            </button>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                              {claim.submitted_at ? claim.submitted_at.split(' ')[0] : 'Online Claim'}
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="py-3.5 px-4 min-w-[140px]">
                            <div className="font-semibold text-zinc-900 dark:text-white truncate max-w-[150px]">
                              {claim.customer_name || 'Customer'}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 dark:text-neutral-400 mt-0.5 truncate max-w-[150px]">
                              {claim.customer_email}
                            </div>
                          </td>

                          {/* Return Window */}
                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-700 dark:text-neutral-300">
                            {claim.is_expired || claim.guarantee_status === 'expired' ? (
                              <div>
                                <span className="text-rose-500 dark:text-rose-400 font-bold">Expired (&gt;30d)</span>
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                  {claim.days_since_claim ? `${claim.days_since_claim}d since claim` : 'Window closed'}
                                </div>
                              </div>
                            ) : claim.guarantee_status === 'pending_return' ? (
                              <div>
                                <span className="text-amber-500 dark:text-amber-400 font-bold">
                                  {claim.days_remaining_to_return ?? Math.max(0, 30 - (claim.days_since_claim || 0))}d left to return
                                </span>
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                  Claimed {claim.days_since_claim ?? 0}d ago
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-zinc-900 dark:text-white font-medium">{claim.shipped_at || 'Shipped'}</div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                  {claim.days_since_shipped}d since shipping
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Refund Payout */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="font-bold text-amber-500 dark:text-amber-400">
                              {claim.refund_amount_fmt}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5 capitalize">
                              {claim.refund_method?.replace('_', ' ') || 'Store Credit'}
                            </div>
                          </td>

                          {/* Destination */}
                          <td className="py-3.5 px-4 max-w-[160px]">
                            <span className="text-xs text-zinc-800 dark:text-neutral-300 truncate block" title={claim.refund_destination}>
                              {claim.refund_destination || '-'}
                            </span>
                          </td>

                          {/* Return Resi */}
                          <td className="py-3.5 px-4 font-mono">
                            {claim.return_tracking_number ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  {claim.return_tracking_number}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopy(claim.return_tracking_number || '', `resi_${claim.order_id}`, e)}
                                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                                  title="Copy Resi"
                                >
                                  {copiedResi === `resi_${claim.order_id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-zinc-400 italic">Not submitted yet</span>
                            )}
                            {claim.return_courier && (
                              <span className="text-[10px] text-zinc-500 block mt-0.5">{claim.return_courier}</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap',
                                claim.guarantee_status === 'refunded'
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                                  : claim.guarantee_status === 'package_received'
                                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-300'
                                  : claim.guarantee_status === 'rejected'
                                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300'
                                  : claim.guarantee_status === 'expired'
                                  ? 'bg-zinc-500/15 border-zinc-500/30 text-zinc-500 dark:text-neutral-400'
                                  : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300'
                              )}
                            >
                              {claim.guarantee_status === 'refunded'
                                ? 'Refund Paid'
                                : claim.guarantee_status === 'package_received'
                                ? 'Package Received'
                                : claim.guarantee_status === 'rejected'
                                ? 'Rejected'
                                : claim.guarantee_status === 'expired'
                                ? 'Expired (>30d)'
                                : 'Awaiting Package'}
                            </span>
                          </td>

                          {/* Approval Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {claim.guarantee_status === 'pending_return' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isActioning}
                                    onClick={() => handleGuaranteeAction(claim.order_id, 'mark_received')}
                                    className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                    title="Mark physical package as received at Ruby Commercial TB12"
                                  >
                                    <Package className="w-3 h-3" />
                                    <span>Mark Received</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isActioning}
                                    onClick={() => handleGuaranteeAction(claim.order_id, 'expire')}
                                    className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-600 dark:bg-neutral-800 dark:hover:bg-rose-500/20 dark:text-neutral-400 dark:hover:text-rose-300 border border-zinc-200 dark:border-white/10 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                    title="Close return authorization (customer did not send item)"
                                  >
                                    <Clock className="w-3 h-3" />
                                    <span>Expire</span>
                                  </button>
                                </>
                              )}

                              {claim.guarantee_status === 'package_received' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isActioning}
                                    onClick={() => handleGuaranteeAction(claim.order_id, 'approve_refund')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                  >
                                    <CheckCheck className="w-3 h-3" />
                                    <span>Approve Refund</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isActioning}
                                    onClick={() => handleGuaranteeAction(claim.order_id, 'reject')}
                                    className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                    title="Reject claim"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {claim.guarantee_status === 'expired' && (
                                <button
                                  type="button"
                                  disabled={isActioning}
                                  onClick={() => handleGuaranteeAction(claim.order_id, 'mark_received')}
                                  className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-sky-500/10 text-zinc-500 hover:text-sky-600 dark:bg-neutral-800 dark:hover:bg-sky-500/20 dark:text-neutral-400 dark:hover:text-sky-300 border border-zinc-200 dark:border-white/10 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                  title="Package arrived late, mark received"
                                >
                                  <Package className="w-3 h-3" />
                                  <span>Reopen</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenOrder(claim.order_id)}
                                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-500 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                                title="View order details"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-neutral-900/40 text-xs text-zinc-600 dark:text-neutral-400 font-mono">
              <div>
                Showing {guaranteeClaims.length} of {totalItems} returns (Page {page} of {totalPages})
              </div>
              <div className="flex items-center gap-1 font-sans">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-neutral-900 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-xs font-mono">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-white/10 bg-white dark:bg-neutral-900 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOrderUpdated={() => loadClaims()}
        onSelectOrderById={async (orderId: number) => {
          const res = await fetchOrderDetailDirect(orderId);
          if (res.success && res.order) {
            setSelectedOrder(res.order);
          }
        }}
      />

      {/* Review Warranty Claim Modal */}
      {reviewOrderId && (
        <WarrantyReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setReviewOrderId(null);
          }}
          orderId={reviewOrderId}
          onClaimReviewed={() => {
            loadClaims();
          }}
          onSelectParentOrder={(parentId) => {
            setIsReviewModalOpen(false);
            handleOpenOrder(parentId);
          }}
        />
      )}

      {/* Manual / Marketplace Warranty Claim Modal */}
      <ManualWarrantyModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        initialClaimType={manualClaimType}
        onSuccess={() => loadClaims()}
      />
    </div>
  );
};
