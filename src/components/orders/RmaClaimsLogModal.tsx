import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  fetchRmaClaimsLogDirect,
  RmaClaimLogEntry,
  RmaClaimsStats,
  fetchGuaranteeClaimsDirect,
  GuaranteeClaimEntry,
  GuaranteeClaimsStats,
  processGuaranteeActionDirect,
} from '../../lib/wordpressBridge';
import { formatCurrency } from '../../lib/formatters';
import {
  ShieldCheck,
  RotateCcw,
  Search,
  RefreshCw,
  Filter,
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
} from 'lucide-react';
import { clsx } from 'clsx';

interface RmaClaimsLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (orderId: number) => void;
  onOpenManualClaim?: (initialType?: 'Warranty' | 'Redeem') => void;
}

export const RmaClaimsLogModal: React.FC<RmaClaimsLogModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
  onOpenManualClaim,
}) => {
  const { showToast } = useToast();

  // Active Tab: Replacements (Warranty & Redeem) vs 30-Day Guarantee Returns
  const [activeTab, setActiveTab] = useState<'replacements' | 'guarantee'>('replacements');

  // Filter States for Replacements
  const [typeFilter, setTypeFilter] = useState<'all' | 'Warranty' | 'Redeem'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  // Filter States for 30-Day Guarantee
  const [guaranteeStatusFilter, setGuaranteeStatusFilter] = useState<'all' | 'pending_return' | 'package_received' | 'refunded' | 'rejected'>('all');

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
  });

  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isActioningGuarantee, setIsActioningGuarantee] = useState<number | null>(null);

  const loadClaims = useCallback(async () => {
    if (!isOpen) return;
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
          setGuaranteeClaims(res.claims || []);
          if (res.stats) {
            setGuaranteeStats(res.stats);
          }
          if (res.pagination) {
            setTotalPages(res.pagination.total_pages || 1);
            setTotalItems(res.pagination.total_items || 0);
          }
        } else {
          showToast('error', 'Guarantee Fetch Failed', res.error || 'Failed to load guarantee returns');
        }
      }
    } catch (err: any) {
      showToast('error', 'Network Error', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, activeTab, typeFilter, statusFilter, channelFilter, guaranteeStatusFilter, searchQuery, page, perPage, showToast]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleGuaranteeActionModal = async (orderId: number, action: 'mark_received' | 'approve_refund') => {
    try {
      setIsActioningGuarantee(orderId);
      const res = await processGuaranteeActionDirect(orderId, action);
      if (res.success) {
        if (action === 'approve_refund') {
          showToast('success', 'Refund Approved & Paid', res.message || 'Refund issued and customer email dispatched.');
        } else {
          showToast('success', 'Package Received', 'Return marked as received at Ruby Commercial TB12.');
        }
        await loadClaims();
      } else {
        showToast('error', 'Action Failed', res.error || 'Failed executing action');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    } finally {
      setIsActioningGuarantee(null);
    }
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="6xl"
      title={
        <div className="flex items-center gap-2.5 font-sans">
          <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center text-amber-400 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">
              RMA Claims & Returns Audit Log
            </span>
          </div>
        </div>
      }
      subtitle="Unified operational registry of installation warranty claims, company-fault redeem orders, and 30-day guarantee returns."
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-3">
          <div className="text-xs text-neutral-400 font-mono">
            Showing {activeTab === 'replacements' ? claims.length : guaranteeClaims.length} of {totalItems} {activeTab === 'replacements' ? 'claims' : 'returns'} (Page {page} of {totalPages})
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="text-xs font-mono text-neutral-400 px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar font-sans text-sm">
        {/* Module Switcher: Replacements vs 30-Day Guarantee */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-900 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('replacements');
                setPage(1);
              }}
              className={clsx(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'replacements'
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Warranty & Redeem Replacements</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-white/10 text-neutral-300">
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
                "px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans transition-all flex items-center gap-2 cursor-pointer",
                activeTab === 'guarantee'
                  ? "bg-purple-500/20 text-purple-200 border border-purple-500/30 shadow-sm"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
              <span>30-Day Guarantee Returns</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300">
                {guaranteeStats.total}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadClaims}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-neutral-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-amber-400')} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 1. Replacements Tab View */}
        {activeTab === 'replacements' && (
          <div className="space-y-4">
            {/* Quick Actions Bar */}
            {onOpenManualClaim && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Quick Actions:</span>
                <button
                  type="button"
                  onClick={() => onOpenManualClaim('Warranty')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manual Warranty Claim</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenManualClaim('Redeem')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Manual Redeem (Fault)</span>
                </button>
              </div>
            )}

        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-2xl bg-neutral-900/70 border border-white/[0.08]">
            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Total Claims</div>
            <div className="text-xl font-bold font-mono text-white mt-1">{stats.total}</div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Warranty</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-1">{stats.warranty_count}</div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/20">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              <span>Redeem (Fault)</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1">{stats.redeem_count}</div>
          </div>

          <div className="p-3 rounded-2xl bg-sky-950/20 border border-sky-500/20">
            <div className="text-[11px] font-medium text-sky-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Pending Review</span>
            </div>
            <div className="text-xl font-bold font-mono text-sky-300 mt-1">{stats.pending_count}</div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/20">
            <div className="text-[11px] font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <Truck className="w-3 h-3" />
              <span>Free Shipping</span>
            </div>
            <div className="text-xl font-bold font-mono text-purple-300 mt-1">{stats.waived_count}</div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-3 rounded-2xl bg-neutral-900 border border-white/[0.08] flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search order #, invoice, customer, phone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-950 border border-white/[0.08] text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Type Toggle Pills */}
          <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-xl border border-white/[0.08]">
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
                      : 'bg-white/20 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                {t === 'all' ? 'All Types' : t}
              </button>
            ))}
          </div>

          {/* Review Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
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
            className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="all">All Channels</option>
            <option value="web">Online Store (Web)</option>
            <option value="Tokopedia">Tokopedia</option>
            <option value="Shopee">Shopee</option>
            <option value="TikTok Shop">TikTok Shop</option>
            <option value="Manual / WhatsApp">Manual / WhatsApp</option>
          </select>
        </div>

        {/* Claims Log Table */}
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-neutral-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-neutral-900/60 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3.5">Order / Date</th>
                  <th className="py-3 px-3.5">Type & Channel</th>
                  <th className="py-3 px-3.5">Original Reference</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5">Claimed Items & Parts</th>
                  <th className="py-3 px-3.5">Shipping Fee</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                      <span>Loading claims audit registry...</span>
                    </td>
                  </tr>
                ) : claims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-500">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <div className="font-semibold text-neutral-400">No RMA Claims Found</div>
                      <div className="text-xs text-neutral-500 mt-1">Try clearing filters or search terms.</div>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-neutral-300 cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => {
                    const isRedeem = claim.type === 'Redeem';
                    return (
                      <tr
                        key={claim.order_id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Order & Date */}
                        <td className="py-3 px-3.5 font-mono">
                          <button
                            type="button"
                            onClick={() => onSelectOrder?.(claim.order_id)}
                            className="font-bold text-white hover:text-amber-400 transition-colors cursor-pointer text-xs"
                          >
                            #{claim.order_number}
                          </button>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {claim.created_at ? claim.created_at.split(' ')[0] : ''}
                          </div>
                        </td>

                        {/* Type & Channel */}
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                                isRedeem
                                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              )}
                            >
                              {isRedeem ? 'REDEEM' : 'WARRANTY'}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400">
                              {claim.channel || 'Web'}
                            </span>
                          </div>
                        </td>

                        {/* Original Ref */}
                        <td className="py-3 px-3.5 font-mono text-xs text-neutral-300">
                          {claim.original_invoice ? (
                            <span className="bg-white/[0.03] px-2 py-1 rounded-lg border border-white/[0.06] text-[11px] block truncate max-w-[150px]">
                              {claim.original_invoice}
                            </span>
                          ) : (
                            <span className="text-neutral-500">-</span>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-3.5 min-w-[140px]">
                          <div className="font-semibold text-white truncate max-w-[160px]">
                            {claim.customer_name || 'Customer'}
                          </div>
                          {claim.customer_phone && (
                            <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                              {claim.customer_phone}
                            </div>
                          )}
                        </td>

                        {/* Claimed Items & Parts */}
                        <td className="py-3 px-3.5 max-w-[240px]">
                          {claim.items && claim.items.length > 0 ? (
                            <div className="space-y-1">
                              {claim.items.map((it, idx) => (
                                <div key={idx} className="text-[11px] leading-snug">
                                  <span className="text-neutral-200 font-medium">{it.name}</span>
                                  {it.claimed_parts && it.claimed_parts.length > 0 ? (
                                    <div className="text-[10px] text-amber-300 font-mono">
                                      Part: {it.claimed_parts.join(', ')}
                                    </div>
                                  ) : it.configuration ? (
                                    <div className="text-[10px] text-neutral-500 truncate max-w-[200px]">
                                      {it.configuration}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-neutral-500">1 Item</span>
                          )}
                        </td>

                        {/* Shipping Fee */}
                        <td className="py-3 px-3.5 font-mono">
                          {claim.waived_shipping ? (
                            <span className="text-xs font-bold text-amber-400">Rp 0 (Free)</span>
                          ) : (
                            <span className="text-xs text-neutral-300">
                              {formatCurrency(claim.shipping_cost, 'IDR')}
                            </span>
                          )}
                        </td>

                        {/* Review Status & Disk Video indicator */}
                        <td className="py-3 px-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded-md text-[10px] font-bold border',
                                claim.status === 'approved'
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                  : claim.status === 'rejected'
                                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                  : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                              )}
                            >
                              {claim.status === 'approved'
                                ? 'Approved'
                                : claim.status === 'rejected'
                                ? 'Rejected'
                                : 'Pending'}
                            </span>

                            {claim.video_deleted ? (
                              <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                                <VideoOff className="w-3 h-3 text-neutral-500" />
                                <span>Video purged</span>
                              </span>
                            ) : claim.video_url ? (
                              <span className="text-[10px] text-sky-400 flex items-center gap-1">
                                <Video className="w-3 h-3 text-sky-400" />
                                <span>Video attached</span>
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectOrder?.(claim.order_id)}
                            className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-xs font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

    {/* 2. 30-Day Guarantee Returns Tab View */}
    {activeTab === 'guarantee' && (
      <div className="space-y-4">
        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-2xl bg-neutral-900/70 border border-white/[0.08]">
            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Total Returns</div>
            <div className="text-xl font-bold font-mono text-white mt-1">{guaranteeStats.total}</div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/20">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Awaiting Package</span>
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 mt-1">{guaranteeStats.pending_return}</div>
          </div>

          <div className="p-3 rounded-2xl bg-sky-950/20 border border-sky-500/20">
            <div className="text-[11px] font-medium text-sky-400 uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3 h-3" />
              <span>Package Received</span>
            </div>
            <div className="text-xl font-bold font-mono text-sky-300 mt-1">{guaranteeStats.package_received}</div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Refund Paid</span>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300 mt-1">{guaranteeStats.refunded}</div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-500/20">
            <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              <span>Rejected</span>
            </div>
            <div className="text-xl font-bold font-mono text-rose-300 mt-1">{guaranteeStats.rejected}</div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-3 rounded-2xl bg-neutral-900 border border-white/[0.08] flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search order #, customer, email, resi..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-950 border border-white/[0.08] text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Status Toggle Pills */}
          <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-xl border border-white/[0.08] flex-wrap">
            {[
              { key: 'all', label: 'All Returns' },
              { key: 'pending_return', label: 'Awaiting Package' },
              { key: 'package_received', label: 'Package Received' },
              { key: 'refunded', label: 'Refund Paid' },
              { key: 'rejected', label: 'Rejected' },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setGuaranteeStatusFilter(s.key as any);
                  setPage(1);
                }}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer',
                  guaranteeStatusFilter === s.key
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-500/40 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-[#f3aa18]" />
            <span>Hub: Ruby Commercial TB12</span>
          </div>
        </div>

        {/* Guarantee Returns Table */}
        <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-neutral-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-neutral-900/60 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3.5">Order</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5">Shipment Date</th>
                  <th className="py-3 px-3.5">Refund Payout</th>
                  <th className="py-3 px-3.5">Destination</th>
                  <th className="py-3 px-3.5">Return Package / Resi</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
                      <span>Loading guarantee return claims...</span>
                    </td>
                  </tr>
                ) : guaranteeClaims.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-500">
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-400" />
                      <div className="font-semibold text-neutral-400">No Guarantee Returns Found</div>
                      <div className="text-xs text-neutral-500 mt-1">No claims matching your filter or search.</div>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-3 px-3 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-neutral-300 cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  guaranteeClaims.map((claim) => {
                    const isActioning = isActioningGuarantee === claim.order_id;
                    return (
                      <tr key={claim.order_id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Order */}
                        <td className="py-3 px-3.5 font-mono">
                          <button
                            type="button"
                            onClick={() => onSelectOrder?.(claim.order_id)}
                            className="font-bold text-white hover:text-purple-300 transition-colors cursor-pointer text-xs"
                          >
                            #{claim.order_number}
                          </button>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {claim.submitted_at ? claim.submitted_at.split(' ')[0] : ''}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-3.5 min-w-[140px]">
                          <div className="font-semibold text-white truncate max-w-[150px]">
                            {claim.customer_name || 'Customer'}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-400 mt-0.5 truncate max-w-[150px]">
                            {claim.customer_email}
                          </div>
                        </td>

                        {/* Shipment Date */}
                        <td className="py-3 px-3.5 font-mono text-xs text-neutral-300">
                          <div>{claim.shipped_at}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">
                            {claim.days_since_shipped}d elapsed
                          </div>
                        </td>

                        {/* Refund Payout */}
                        <td className="py-3 px-3.5 font-mono">
                          <div className="font-bold text-amber-400">
                            {claim.refund_amount_fmt}
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            {claim.refund_method === 'store_credit' 
                              ? 'Store Credit (100%)' 
                              : claim.refund_method === 'bank_transfer'
                              ? 'Bank Transfer (70%)'
                              : 'PayPal (70%)'}
                          </div>
                        </td>

                        {/* Destination */}
                        <td className="py-3 px-3.5 max-w-[180px]">
                          <span className="font-mono text-neutral-300 text-[11px] block truncate">
                            {claim.refund_destination || 'N/A'}
                          </span>
                        </td>

                        {/* Return Package & Resi */}
                        <td className="py-3 px-3.5">
                          {claim.return_tracking_number ? (
                            <div className="font-mono text-[11px] text-emerald-400">
                              <span className="text-neutral-400 text-[10px] block uppercase">Return Resi:</span>
                              {claim.return_courier} #{claim.return_tracking_number}
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-400/80 italic">Awaiting customer resi</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3.5">
                          <span
                            className={clsx(
                              'px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap',
                              claim.guarantee_status === 'refunded'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : claim.guarantee_status === 'package_received'
                                ? 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                                : claim.guarantee_status === 'rejected'
                                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            )}
                          >
                            {claim.guarantee_status === 'refunded'
                              ? 'Refund Paid'
                              : claim.guarantee_status === 'package_received'
                              ? 'Package Received'
                              : claim.guarantee_status === 'rejected'
                              ? 'Rejected'
                              : 'Awaiting Return'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-right whitespace-nowrap space-x-1.5">
                          {claim.guarantee_status === 'pending_return' && (
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleGuaranteeActionModal(claim.order_id, 'mark_received')}
                              className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                              title="Confirm package has arrived and verified at Ruby Commercial TB12"
                            >
                              <Package className="w-3 h-3" />
                              <span>Received</span>
                            </button>
                          )}

                          {(claim.guarantee_status === 'pending_return' || claim.guarantee_status === 'package_received') && (
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleGuaranteeActionModal(claim.order_id, 'approve_refund')}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                              title="Approve refund and dispatch confirmation email"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onSelectOrder?.(claim.order_id)}
                            className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-xs font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
  </div>
</Modal>
  );
};
