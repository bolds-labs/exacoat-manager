import React, { useState } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { AffiliateProfile, AffiliateCommission } from '../../types';
import { useToast } from '../../context/ToastContext';
import { PageHeroHeader } from '../../components/ui/PageHeroHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { clsx } from 'clsx';

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
  onNavigateTab: (tab: 'dashboard' | 'links' | 'payouts' | 'settings') => void;
}

export const AffiliateDashboardPage: React.FC<AffiliateDashboardPageProps> = ({
  profile,
  metrics,
  commissions,
  onNavigateTab,
}) => {
  const { showToast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const referralUrl = profile.referral_url || `https://exacoat.com/?ref=${profile.slug}`;

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

  const getCommissionBadge = (
    status: string, 
    reason?: string | null, 
    maturesAt?: string | null, 
    deliveredAt?: string | null
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
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/25"
            title="Order is in fulfillment. Grace period begins once delivered."
          >
            Pending Delivery
          </span>
        );
      }
      case 'rejected':
        return (
          <span 
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"
            title={reason || 'Refunded or cancelled'}
          >
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

  return (
    <div className="space-y-6">
      {/* Page Hero Header */}
      <PageHeroHeader
        title="Creator Dashboard"
        subtitle="Live tracking of your referral revenue, active links, and order conversion performance."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigateTab('links')}
              leftIcon={<ExternalLink className="w-3.5 h-3.5 text-zinc-400" />}
            >
              Product Links
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigateTab('payouts')}
              leftIcon={<Wallet className="w-3.5 h-3.5" />}
            >
              Payouts
            </Button>
          </div>
        }
      />

      {/* Review Notice if Pending Approval */}
      {profile.status === 'pending_approval' && (
        <div className="p-4 rounded-2xl bg-[#f3aa18]/[0.08] border border-[#f3aa18]/25 flex items-start gap-3.5 shadow-xs">
          <div className="p-2 rounded-xl bg-[#f3aa18]/15 text-[#f3aa18] shrink-0 mt-0.5">
            <Clock className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#f3aa18] font-mono">Application Under Review</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Our partnerships team is reviewing your profile and promotional channels. You can explore the portal and generate links now, and referral tracking will activate once approved.
            </p>
          </div>
        </div>
      )}

      {/* Primary Referral Link Card */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Primary Referral Link</h2>
            <p className="text-xs text-zinc-300 mt-1">
              Share your primary link across social bios, video descriptions, or chat channels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowQrModal(true)}
              leftIcon={<QrCode className="w-3.5 h-3.5 text-zinc-400" />}
            >
              QR Code
            </Button>
            <a
              href={referralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              <span>Test Link</span>
            </a>
          </div>
        </div>

        {/* Input and Copy button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              readOnly
              value={referralUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="h-11 w-full pl-4 pr-4 rounded-xl border border-white/[0.09] bg-white/[0.035] font-mono text-xs sm:text-sm text-white select-all outline-none transition-all hover:border-white/[0.16] focus:border-[#f3aa18]/70 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#f3aa18]/[0.08]"
            />
          </div>
          <Button
            type="button"
            variant={copiedLink ? 'success' : 'primary'}
            size="lg"
            onClick={handleCopyLink}
            leftIcon={copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          >
            {copiedLink ? 'Copied to Clipboard' : 'Copy Referral Link'}
          </Button>
        </div>

        {/* Attribution Guarantee */}
        <div className="pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>30-Day Cookie Attribution Window (Last Affiliate Credited)</span>
          </div>
          <span className="text-zinc-400">
            Commission Rate: <strong className="text-[#f3aa18]">20% Net</strong> (excluding shipping and tax)
          </span>
        </div>
      </GlassCard>

      {/* Stat Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unpaid Balance */}
        <GlassCard className="p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Withdrawable Balance</span>
            <div className="p-2 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-['Chakra_Petch'] text-white tracking-tight">
            {formatIDR(metrics.unpaid_balance)}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
            <span className="text-[11px] text-zinc-400 font-mono">
              Min: {formatIDR(metrics.min_payout_amount)}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('payouts')}
              className={clsx(
                'text-[11px] font-semibold transition-colors cursor-pointer',
                metrics.can_request_payout
                  ? 'text-[#f3aa18] hover:text-[#ffbe3b] underline'
                  : 'text-zinc-500 hover:text-zinc-400'
              )}
            >
              Request Payout &rarr;
            </button>
          </div>
        </GlassCard>

        {/* Lifetime Earnings */}
        <GlassCard className="p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Lifetime Earnings</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-['Chakra_Petch'] text-emerald-400 tracking-tight">
            {formatIDR(metrics.lifetime_earnings)}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1 border-t border-white/[0.06]">
            Total verified commissions since enrollment
          </p>
        </GlassCard>

        {/* Total Referred Orders */}
        <GlassCard className="p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Referred Orders</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-['Chakra_Petch'] text-white tracking-tight">
            {metrics.total_orders.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1 border-t border-white/[0.06]">
            Total customer checkout orders completed
          </p>
        </GlassCard>

        {/* Total Clicks */}
        <GlassCard className="p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Link Clicks</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-['Chakra_Petch'] text-white tracking-tight">
            {metrics.total_clicks.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1 border-t border-white/[0.06]">
            Total clicks tracked via your referral URLs
          </p>
        </GlassCard>
      </section>

      {/* Recent Referral Commissions Ledger */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Referral Activity</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live audit of orders placed by customers through your referral link.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('payouts')}
            className="text-xs font-semibold text-[#f3aa18] hover:text-[#ffbe3b] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>View Payouts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {commissions.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 space-y-2">
            <ShoppingBag className="w-8 h-8 text-zinc-500 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-300">No referral orders yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Share your referral link on social platforms, videos, or chats. When customers order, your 20% commission appears here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-400 font-mono uppercase tracking-wider text-[11px] bg-white/[0.02]">
                  <th className="py-3.5 pl-4">Order #</th>
                  <th className="py-3.5">Date</th>
                  <th className="py-3.5">Product Subtotal</th>
                  <th className="py-3.5">Your 20% Commission</th>
                  <th className="py-3.5 pr-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {commissions.map((comm) => (
                  <tr key={comm.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pl-4 font-mono font-semibold text-white">
                      #{comm.order_number}
                    </td>
                    <td className="py-3 text-zinc-400 font-mono text-[11px]">
                      {new Date(comm.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 text-zinc-300 font-mono">
                      {formatIDR(comm.order_subtotal)}
                    </td>
                    <td className="py-3 font-mono font-bold text-emerald-400">
                      {formatIDR(comm.commission_amount)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {getCommissionBadge(comm.status, comm.rejection_reason, comm.matures_at, comm.delivered_at)}
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
          <div className="bg-[#0c0c0e] border border-white/[0.1] rounded-3xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
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
