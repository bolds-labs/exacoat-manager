import React, { useState, useEffect, useCallback } from 'react';
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
  FileSpreadsheet,
  Check,
  X,
  Loader2,
  Filter
} from 'lucide-react';
import { 
  fetchAdminAffiliates, 
  updateAdminAffiliateStatus, 
  fetchAdminAffiliateCommissions, 
  fetchAdminAffiliatePayouts, 
  updateAdminAffiliatePayout,
  getAdminExportPayoutsUrl 
} from '../lib/wordpressBridge';
import { AffiliateCommission, AffiliatePayout } from '../types';
import { useToast } from '../context/ToastContext';
import { clsx } from 'clsx';

type TabKey = 'applications' | 'affiliates' | 'commissions' | 'payouts';

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

  // Modals
  const [rejectingApp, setRejectingApp] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [payingPayout, setPayingPayout] = useState<AffiliatePayout | null>(null);
  const [transferRef, setTransferRef] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

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

  const formatIDR = (val: number): string => {
    return 'Rp ' + Math.round(Number(val || 0)).toLocaleString('id-ID');
  };

  const pendingApps = affiliates.filter((a) => a.status === 'pending_approval');
  const pendingPayoutsCount = payouts.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-400" />
            <span>Affiliate &amp; Creator Program</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Review incoming creator applications, audit 20% order attribution, and process BCA and Mandiri bulk payouts.
          </p>
        </div>

        {/* Quick Bulk Export buttons */}
        <div className="flex items-center gap-2">
          <a
            href={getAdminExportPayoutsUrl('BCA')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors shadow-sm"
            title="Download BCA KlikBCA Bisnis Payroll CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export BCA CSV</span>
          </a>
          <a
            href={getAdminExportPayoutsUrl('MANDIRI')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors shadow-sm"
            title="Download Mandiri Cash Management (MCM) CSV"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Mandiri CSV</span>
          </a>
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin text-amber-400')} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => { setActiveTab('applications'); setStatusFilter('all'); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
            activeTab === 'applications'
              ? 'border-amber-400 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          )}
        >
          <span>Applications</span>
          {pendingApps.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {pendingApps.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('affiliates'); setStatusFilter('all'); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
            activeTab === 'affiliates'
              ? 'border-amber-400 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          )}
        >
          <span>Affiliate Directory</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('commissions'); setStatusFilter('all'); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
            activeTab === 'commissions'
              ? 'border-amber-400 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          )}
        >
          <span>Commissions Ledger</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('payouts'); setStatusFilter('all'); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer',
            activeTab === 'payouts'
              ? 'border-amber-400 text-white'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          )}
        >
          <span>Payout Requests</span>
          {pendingPayoutsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {pendingPayoutsCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Applications */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
            <span>
              Creators applying to join the program. Approving an application will set their status to <strong>active</strong>, assign their referral slug, and send them a welcome email.
            </span>
            <span className="font-mono text-zinc-300">
              {pendingApps.length} pending
            </span>
          </div>

          {pendingApps.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-semibold text-white">All caught up</h3>
              <p className="text-xs text-zinc-400">There are no pending affiliate applications at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApps.map((app) => (
                <div
                  key={app.id}
                  className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 hover:border-zinc-700/80 transition-colors shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">
                          {app.display_name || app.user_login}
                        </h3>
                        <span className="font-mono text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                          @{app.slug}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">{app.user_email}</p>
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      Applied {new Date(app.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <span className="text-zinc-400 font-medium">Affiliate Type:</span>
                      <p className="text-zinc-200">{app.affiliate_type || 'Creator'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <span className="text-zinc-400 font-medium">Channel / Website:</span>
                      <p className="text-zinc-200 font-mono truncate" title={app.promotion_channel}>
                        {app.promotion_channel || 'Not provided'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                      <span className="text-zinc-400 font-medium">Bank Details:</span>
                      <p className="text-zinc-200">
                        {app.bank_name ? `${app.bank_name} - ${app.bank_account_number}` : 'Not configured yet'}
                      </p>
                    </div>
                  </div>

                  {app.promotion_notes && (
                    <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs space-y-1">
                      <span className="text-zinc-400 font-medium">Promotion Plan:</span>
                      <p className="text-zinc-300 leading-relaxed">{app.promotion_notes}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isProcessingAction}
                      onClick={() => setRejectingApp(app)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                    >
                      Reject Application
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingAction}
                      onClick={() => handleApproveApplicant(app)}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Creator</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Affiliate Directory */}
      {activeTab === 'affiliates' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by slug, username, email, or account name..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-medium bg-zinc-950/40">
                    <th className="py-3 pl-4">Creator / Slug</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Clicks</th>
                    <th className="py-3">Orders</th>
                    <th className="py-3">Unpaid Balance</th>
                    <th className="py-3">Lifetime Earned</th>
                    <th className="py-3">Bank Destination</th>
                    <th className="py-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {affiliates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-400">
                        No affiliates match the current filters.
                      </td>
                    </tr>
                  ) : (
                    affiliates.map((aff) => (
                      <tr key={aff.id} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="py-3 pl-4">
                          <span className="font-semibold text-white block">
                            {aff.display_name || aff.user_login}
                          </span>
                          <span className="font-mono text-[11px] text-amber-400">
                            @{aff.slug}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider',
                            aff.status === 'active' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                            aff.status === 'pending_approval' && 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                            aff.status === 'suspended' && 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                            aff.status === 'rejected' && 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          )}>
                            {aff.status}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-zinc-300">
                          {Number(aff.total_clicks || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 font-mono text-zinc-300">
                          {Number(aff.total_orders || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 font-mono font-bold text-amber-400">
                          {formatIDR(aff.unpaid_balance)}
                        </td>
                        <td className="py-3 font-mono text-emerald-400">
                          {formatIDR(aff.lifetime_earnings)}
                        </td>
                        <td className="py-3 text-zinc-300">
                          {aff.bank_name ? (
                            <span className="font-mono text-[11px]">
                              <strong>{aff.bank_name}</strong> {aff.bank_account_number}
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">Unset</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {aff.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => updateAdminAffiliateStatus(aff.id, 'suspended').then(loadData)}
                              className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateAdminAffiliateStatus(aff.id, 'active').then(loadData)}
                              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
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
        </div>
      )}

      {/* Tab 3: Commissions Ledger */}
      {activeTab === 'commissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200"
            >
              <option value="all">All Commission Statuses</option>
              <option value="pending">Pending Orders</option>
              <option value="unpaid">Unpaid / Cleared</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected (Refunded/Self)</option>
            </select>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-medium bg-zinc-950/40">
                    <th className="py-3 pl-4">Order #</th>
                    <th className="py-3">Date</th>
                    <th className="py-3">Affiliate Slug</th>
                    <th className="py-3">Eligible Subtotal</th>
                    <th className="py-3">20% Commission</th>
                    <th className="py-3">Buyer Email</th>
                    <th className="py-3 pr-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {commissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-400">
                        No commissions found.
                      </td>
                    </tr>
                  ) : (
                    commissions.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="py-3 pl-4 font-mono font-medium text-white">
                          #{c.order_number}
                        </td>
                        <td className="py-3 text-zinc-400">
                          {new Date(c.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-3 font-mono text-amber-400">
                          @{c.affiliate_slug}
                        </td>
                        <td className="py-3 font-mono text-zinc-300">
                          {formatIDR(c.order_subtotal)}
                        </td>
                        <td className="py-3 font-mono font-bold text-emerald-400">
                          {formatIDR(c.commission_amount)}
                        </td>
                        <td className="py-3 text-zinc-400 font-mono text-[11px]">
                          {c.customer_email}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider',
                            c.status === 'paid' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                            c.status === 'unpaid' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                            c.status === 'pending' && 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                            c.status === 'rejected' && 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          )}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Payout Requests */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200"
            >
              <option value="all">All Payout Statuses</option>
              <option value="pending">Pending Transfers</option>
              <option value="paid">Completed Transfers</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-medium bg-zinc-950/40">
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
                <tbody className="divide-y divide-zinc-850">
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-400">
                        No payout requests found.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="py-3 pl-4 font-mono text-zinc-200">
                          PAY-{p.id}
                        </td>
                        <td className="py-3 text-zinc-400">
                          {new Date(p.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-3 font-mono text-amber-400">
                          @{p.affiliate_slug}
                        </td>
                        <td className="py-3 font-mono font-bold text-white">
                          {formatIDR(p.amount)}
                        </td>
                        <td className="py-3 text-zinc-300">
                          <span className="font-semibold text-amber-400">{p.bank_name}</span> &bull; {p.bank_account_number} ({p.bank_account_name})
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
                        <td className="py-3 font-mono text-[11px] text-zinc-400">
                          {p.transfer_reference || '-'}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {p.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleRejectPayout(p.id)}
                                className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => { setPayingPayout(p); setTransferRef(`TRF-${p.bank_name}-${Date.now().toString().slice(-6)}`); }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                              >
                                Mark Paid
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-zinc-400">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reject Application Modal */}
      {rejectingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">
              Reject Application for @{rejectingApp.slug}
            </h3>
            <p className="text-xs text-zinc-400">
              Provide optional feedback to the applicant explaining why their channel was not accepted at this time.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Channel does not currently match our gadget accessories focus..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmRejectApplicant}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Payout Paid Modal */}
      {payingPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">
              Record Transfer for PAY-{payingPayout.id}
            </h3>
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
              <span className="text-zinc-400">Recipient Account:</span>
              <p className="font-semibold text-white">
                {payingPayout.bank_name} &bull; {payingPayout.bank_account_number}
              </p>
              <p className="text-zinc-400">a.n. {payingPayout.bank_account_name}</p>
              <p className="text-amber-400 font-mono font-bold pt-1">{formatIDR(payingPayout.amount)}</p>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="font-medium text-zinc-300">
                Bank Transfer Reference Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                placeholder="e.g. BCA-98218902 or Mandiri-MCM-310"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayingPayout(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingAction}
                onClick={handleConfirmPayPayout}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Confirm Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
