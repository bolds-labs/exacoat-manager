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
import { PageHeroHeader } from '../../components/ui/PageHeroHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/25">
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.05] text-zinc-400 border border-white/[0.08]">
            {status}
          </span>
        );
    }
  };

  // Progress to minimum payout threshold
  const progressPercent = Math.min(100, Math.round((unpaidBalance / minPayout) * 100));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <PageHeroHeader
        title="Payouts & Balance"
        subtitle="Review withdrawable earnings, request transfers to your registered bank account, and audit historical payments."
        actions={
          <Button
            variant="primary"
            size="sm"
            disabled={!canRequestPayout || hasPendingPayout}
            onClick={() => setShowConfirmModal(true)}
            leftIcon={<Wallet className="w-3.5 h-3.5" />}
          >
            {hasPendingPayout ? 'Payout Under Review' : 'Request Payout'}
          </Button>
        }
      />

      {/* Primary Balance and Action Card */}
      <GlassCard className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Available Balance</span>
            <div className="text-3xl sm:text-4xl font-extrabold font-['Chakra_Petch'] text-white tracking-tight">
              {formatIDR(unpaidBalance)}
            </div>
            <p className="text-xs text-zinc-400">
              Minimum payout threshold: <strong className="text-zinc-200">{formatIDR(minPayout)}</strong>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!canRequestPayout || hasPendingPayout}
              onClick={() => setShowConfirmModal(true)}
              leftIcon={<Wallet className="w-4 h-4" />}
            >
              {hasPendingPayout ? 'Payout Request Pending' : 'Request Payout'}
            </Button>
          </div>
        </div>

        {/* Progress Bar toward Rp 250.000 */}
        {unpaidBalance < minPayout && (
          <div className="space-y-2 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Progress to next payout threshold</span>
              <span className="font-mono text-[#f3aa18] font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden border border-white/[0.08]">
              <div
                className="bg-[#f3aa18] h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              You need {formatIDR(minPayout - unpaidBalance)} more in cleared commissions to request your next payout.
            </p>
          </div>
        )}

        {/* Bank Account Overview or Missing Warning */}
        <div className="pt-3 border-t border-white/[0.06]">
          {hasValidBank ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white/[0.02] p-4 rounded-2xl border border-white/[0.06]">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-white text-xs">
                    Bank {profile.bank_name}
                  </span>
                  <p className="text-zinc-400 font-mono mt-0.5">
                    {profile.bank_account_number} &bull; a.n. {profile.bank_account_name}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onNavigateTab('settings')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Change Bank
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#f3aa18]/[0.08] border border-[#f3aa18]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-[#f3aa18]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Payout destination bank is not configured yet. Payouts require a registered BCA or Mandiri account.</span>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onNavigateTab('settings')}
              >
                Set Bank Info
              </Button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Payout History Ledger */}
      <GlassCard className="p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Payout History</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit of all requested and completed bank transfers.
          </p>
        </div>

        {payouts.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-2">
            <Wallet className="w-8 h-8 text-zinc-500 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-300">No payout requests recorded</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Once your withdrawable balance reaches {formatIDR(minPayout)}, click Request Payout above to initiate a bank transfer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-400 font-mono uppercase tracking-wider text-[11px] bg-white/[0.02]">
                  <th className="py-3.5 pl-4">Request ID</th>
                  <th className="py-3.5">Date</th>
                  <th className="py-3.5">Amount</th>
                  <th className="py-3.5">Destination</th>
                  <th className="py-3.5">Reference / Notes</th>
                  <th className="py-3.5 pr-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pl-4 font-mono text-zinc-300">
                      PAY-{p.id}
                    </td>
                    <td className="py-3 text-zinc-400 font-mono text-[11px]">
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
                      <span className="font-semibold text-[#f3aa18]">{p.bank_name}</span> &bull; {p.bank_account_number}
                    </td>
                    <td className="py-3 text-zinc-400 font-mono text-[11px]">
                      {p.transfer_reference || (p.admin_notes ?? '-')}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {getPayoutBadge(p.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0c0c0e] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-semibold text-white">Confirm Payout Request</h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
                <span className="text-zinc-400 font-mono text-[11px] uppercase tracking-wider">Withdrawal Amount</span>
                <div className="text-2xl font-bold text-[#f3aa18] font-['Chakra_Petch']">
                  {formatIDR(unpaidBalance)}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                <span className="text-zinc-400 font-mono text-[11px] uppercase tracking-wider">Destination</span>
                <p className="text-white font-medium">
                  Bank {profile.bank_name} &bull; {profile.bank_account_number}
                </p>
                <p className="text-zinc-400">
                  Account Holder: <strong>{profile.bank_account_name}</strong>
                </p>
              </div>

              <p className="text-zinc-400 leading-relaxed pt-1">
                Your request will be queued for the next scheduled finance payout batch. You will receive an email confirmation once the bank transfer is dispatched.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={handleConfirmPayoutRequest}
                isLoading={isSubmitting}
              >
                Confirm Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
