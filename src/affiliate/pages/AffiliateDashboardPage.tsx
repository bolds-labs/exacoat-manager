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
  X
} from 'lucide-react';
import { AffiliateProfile, AffiliateCommission } from '../../types';
import { useToast } from '../../context/ToastContext';
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

  const getCommissionBadge = (status: string, reason?: string | null) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Paid
          </span>
        );
      case 'unpaid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Cleared (Unpaid)
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Pending Order
          </span>
        );
      case 'rejected':
        return (
          <span 
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20"
            title={reason || 'Refunded or cancelled'}
          >
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Review Notice if Pending Approval */}
      {profile.status === 'pending_approval' && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-amber-300">Application Under Review</h3>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Our partnerships team is reviewing your profile and promotional channels. You can explore the portal and test link generation now, but commissions will activate as soon as your account is approved.
            </p>
          </div>
        </div>
      )}

      {/* Hero Referral Link Card */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Your Primary Referral Link</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Share this link across social bios, video descriptions, or chat channels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/80 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-zinc-400" />
              <span>QR Code</span>
            </button>
            <a
              href={referralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/80 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
              <span>Test Link</span>
            </a>
          </div>
        </div>

        {/* Input and Copy button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              readOnly
              value={referralUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm font-mono text-zinc-200 select-all focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className={clsx(
              'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm',
              copiedLink
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold'
            )}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Copied to Clipboard' : 'Copy Referral Link'}</span>
          </button>
        </div>

        {/* Attribution Guarantee */}
        <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>30-Day Cookie Attribution Window (Last Affiliate Credited)</span>
          </div>
          <span className="text-zinc-400">
            Commission Rate: <strong className="text-amber-400">20% Net</strong> (excluding shipping and tax)
          </span>
        </div>
      </section>

      {/* Stat Cards Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unpaid Balance */}
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Unpaid Balance</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatIDR(metrics.unpaid_balance)}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-400">
              Min. Payout: {formatIDR(metrics.min_payout_amount)}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('payouts')}
              className={clsx(
                'text-[11px] font-semibold transition-colors cursor-pointer',
                metrics.can_request_payout
                  ? 'text-amber-400 hover:text-amber-300 underline'
                  : 'text-zinc-400 hover:text-zinc-400'
              )}
            >
              Request Payout
            </button>
          </div>
        </div>

        {/* Lifetime Earnings */}
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Lifetime Earnings</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatIDR(metrics.lifetime_earnings)}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1">
            Total verified commissions since enrollment
          </p>
        </div>

        {/* Total Referred Orders */}
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Referred Orders</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.total_orders.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1">
            Total completed customer checkouts
          </p>
        </div>

        {/* Total Clicks */}
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Link Clicks</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics.total_clicks.toLocaleString('id-ID')}
          </div>
          <p className="text-[11px] text-zinc-400 pt-1">
            Total visitor clicks via your referral links
          </p>
        </div>
      </section>

      {/* Recent Referral Commissions Ledger */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Recent Referral Activity</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live log of orders credited to your affiliate link.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('links')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            Create Product Link &rarr;
          </button>
        </div>

        {commissions.length === 0 ? (
          <div className="py-12 text-center rounded-xl bg-zinc-950/50 border border-zinc-800/60 p-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-300">No referral orders yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Share your custom link on YouTube, Instagram, TikTok, or your website. When visitors purchase within 30 days, your commissions will appear here automatically.
            </p>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Primary Link</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                  <th className="pb-3 pl-2">Order</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Eligible Subtotal</th>
                  <th className="pb-3">Commission (20%)</th>
                  <th className="pb-3 pr-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {commissions.map((comm) => (
                  <tr key={comm.id} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="py-3 pl-2 font-mono text-zinc-200 font-medium">
                      #{comm.order_number}
                    </td>
                    <td className="py-3 text-zinc-400">
                      {new Date(comm.created_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 text-zinc-300 font-mono">
                      {formatIDR(comm.order_subtotal)}
                    </td>
                    <td className="py-3 font-mono font-semibold text-emerald-400">
                      {formatIDR(comm.commission_amount)}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      {getCommissionBadge(comm.status, comm.rejection_reason)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Your Referral QR Code</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-white rounded-xl inline-block shadow-sm">
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
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
            >
              Copy Link URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
