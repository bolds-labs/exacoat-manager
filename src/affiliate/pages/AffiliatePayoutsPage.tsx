import React, { useState } from 'react';
import { 
  Wallet, 
  Clock, 
  CheckCircle2, 
  Building2, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Loader2,
  X,
  CreditCard
} from 'lucide-react';
import { AffiliateProfile, AffiliatePayout } from '../../types';
import { requestAffiliatePayout } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { clsx } from 'clsx';

interface AffiliatePayoutsPageProps {
  profile: AffiliateProfile;
  payouts: AffiliatePayout[];
  onRefresh: () => void;
  onNavigateTab: (tab: 'dashboard' | 'links' | 'payouts' | 'settings') => void;
}

export const AffiliatePayoutsPage: React.FC<AffiliatePayoutsPageProps> = ({
  profile,
  payouts,
  onRefresh,
  onNavigateTab,
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const minPayout = 250000;
  const unpaidBalance = Number(profile.unpaid_balance || 0);
  const hasValidBank = Boolean(profile.bank_name && profile.bank_account_number && profile.bank_account_name);
  const canRequestPayout = unpaidBalance >= minPayout && hasValidBank && profile.status === 'active';

  // Check if open pending payout request exists
  const hasPendingPayout = payouts.some((p) => p.status === 'pending');

  const formatIDR = (val: number): string => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const handleConfirmPayoutRequest = async () => {
    setIsSubmitting(true);
    try {
      const res = await requestAffiliatePayout();
      if (res.success) {
        showToast('success', 'Payout Requested', res.message || 'Your payout request has been submitted.');
        setShowConfirmModal(false);
        onRefresh();
      } else {
        showToast('error', 'Request Failed', res.error || 'Failed to submit payout request.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Unexpected network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPayoutBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Transferred
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Under Review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800 text-zinc-400">
            {status}
          </span>
        );
    }
  };

  // Progress to minimum payout threshold
  const progressPercent = Math.min(100, Math.round((unpaidBalance / minPayout) * 100));

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Affiliate Payouts and Balance</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Review your withdrawable earnings, request transfers to your BCA or Mandiri account, and audit historical payouts.
        </p>
      </div>

      {/* Primary Balance and Action Card */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-medium text-zinc-400">Available Balance</span>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {formatIDR(unpaidBalance)}
            </div>
            <p className="text-xs text-zinc-400">
              Minimum payout threshold: <strong>{formatIDR(minPayout)}</strong>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              disabled={!canRequestPayout || hasPendingPayout}
              onClick={() => setShowConfirmModal(true)}
              className={clsx(
                'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm',
                canRequestPayout && !hasPendingPayout
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold'
                  : 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700/50'
              )}
            >
              <Wallet className="w-4 h-4" />
              <span>{hasPendingPayout ? 'Payout Request Pending' : 'Request Payout'}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar toward Rp 250.000 */}
        {unpaidBalance < minPayout && (
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Progress to next payout threshold</span>
              <span className="font-mono text-zinc-300">{progressPercent}%</span>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              You need {formatIDR(minPayout - unpaidBalance)} more in verified commissions to request your next payout.
            </p>
          </div>
        )}

        {/* Bank Account Overview or Missing Warning */}
        <div className="pt-4 border-t border-zinc-800/80">
          {hasValidBank ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-zinc-950/60 p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-white">
                    Bank {profile.bank_name}
                  </span>
                  <p className="text-zinc-400 font-mono mt-0.5">
                    {profile.bank_account_number} &bull; a.n. {profile.bank_account_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors self-start sm:self-auto cursor-pointer"
              >
                Change Bank &rarr;
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Payout destination bank is not configured yet. Payouts require a registered BCA or Mandiri account.</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('settings')}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 shrink-0 transition-colors"
              >
                Set Bank Info
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Payout History Ledger */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Payout History</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit of all requested and completed bank transfers.
          </p>
        </div>

        {payouts.length === 0 ? (
          <div className="py-12 text-center rounded-xl bg-zinc-950/50 border border-zinc-800/60 p-6 space-y-2">
            <Wallet className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-300">No payout requests recorded</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Once your unpaid balance reaches {formatIDR(minPayout)}, click Request Payout above to initiate a bank transfer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                  <th className="pb-3 pl-2">Request ID</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Destination</th>
                  <th className="pb-3">Reference / Notes</th>
                  <th className="pb-3 pr-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="py-3 pl-2 font-mono text-zinc-300">
                      PAY-{p.id}
                    </td>
                    <td className="py-3 text-zinc-400">
                      {new Date(p.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 font-mono font-bold text-white">
                      {formatIDR(p.amount)}
                    </td>
                    <td className="py-3 text-zinc-300">
                      <span className="font-semibold text-amber-400">{p.bank_name}</span> &bull; {p.bank_account_number}
                    </td>
                    <td className="py-3 text-zinc-400 font-mono text-[11px]">
                      {p.transfer_reference || (p.admin_notes ?? '-')}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      {getPayoutBadge(p.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white">Confirm Payout Request</h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-zinc-400">Withdrawal Amount:</span>
                <div className="text-2xl font-bold text-amber-400 font-mono">
                  {formatIDR(unpaidBalance)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1">
                <span className="text-zinc-400">Recipient Account:</span>
                <p className="text-zinc-200 font-medium">
                  Bank {profile.bank_name} - {profile.bank_account_number}
                </p>
                <p className="text-zinc-400">
                  Account Holder: <strong>{profile.bank_account_name}</strong>
                </p>
              </div>

              <p className="text-zinc-400 leading-relaxed pt-1">
                Your request will be queued for the next scheduled finance payout batch. You will receive an email confirmation once the transfer is completed.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayoutRequest}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Request</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
