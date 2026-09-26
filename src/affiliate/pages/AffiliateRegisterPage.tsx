import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  AlertCircle,
  ExternalLink 
} from 'lucide-react';
import { ExacoatLogo } from '../../components/ui/ExacoatLogo';
import { registerAffiliateApplicant } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { clsx } from 'clsx';

interface AffiliateRegisterPageProps {
  onNavigateToLogin: () => void;
}

const AFFILIATE_TYPE_OPTIONS = [
  'Tech Reviewer / YouTube Creator',
  'Instagram / TikTok Tech Influencer',
  'Tech Blogger / Media Publication',
  'Gadget Community / Forum Admin',
  'Designer / Digital Creator',
  'Other Promotional Channel',
];

export const AffiliateRegisterPage: React.FC<AffiliateRegisterPageProps> = ({ onNavigateToLogin }) => {
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [promotionChannel, setPromotionChannel] = useState('');
  const [promotionNotes, setPromotionNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const toggleTypeOption = (opt: string) => {
    if (selectedTypes.includes(opt)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== opt));
    } else {
      setSelectedTypes([...selectedTypes, opt]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      showToast('error', 'Missing Information', 'Please complete all required fields marked with an asterisk.');
      return;
    }

    if (selectedTypes.length === 0) {
      showToast('error', 'Affiliate Type Required', 'Please select at least one affiliate type.');
      return;
    }

    if (!promotionChannel.trim()) {
      showToast('error', 'Channel Required', 'Please provide your channel, username, or website.');
      return;
    }

    if (!promotionNotes.trim()) {
      showToast('error', 'Promotion Plan Required', 'Please briefly describe how you intend to promote Exacoat.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerAffiliateApplicant({
        username: username.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        affiliate_type: selectedTypes,
        promotion_channel: promotionChannel.trim(),
        promotion_notes: promotionNotes.trim(),
      });

      if (res.success) {
        setSubmittedSuccess(true);
        showToast('success', 'Application Submitted', res.message);
      } else {
        showToast('error', 'Registration Error', res.message || 'Unable to register application.');
      }
    } catch (err: any) {
      showToast('error', 'Registration Error', err.message || 'An unexpected network error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-500/30 selection:text-amber-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center space-y-3">
        <a 
          href="https://exacoat.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="inline-block p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md"
        >
          <ExacoatLogo className="h-8 w-auto mx-auto text-white" />
        </a>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Exacoat Creator Affiliate Program
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
          Earn a <strong>20% net commission</strong> on every verified order. Benefit from a 30-day tracking cookie window and automated BCA and Mandiri payouts.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        {submittedSuccess ? (
          <div className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <Check className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white">Application Received</h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
                Thank you for applying to the Exacoat Creator Program. Our partnerships team will review your channel and promotional plan. You will receive an approval email shortly at <span className="font-mono text-zinc-200 font-medium">{email}</span>.
              </p>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="flex-1 py-3 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
              >
                Sign In to Creator Portal
              </button>
              <a
                href="https://exacoat.com"
                className="flex-1 py-3 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <span>Return to Store</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">
                  Username <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="e.g. techreviewid"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <p className="text-[11px] text-zinc-400">
                  This will form your initial referral link: exacoat.com/?ref={username || 'username'}
                </p>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-300">
                    First Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-medium text-zinc-300">
                    Last Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">
                  Email Address <span className="text-amber-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="creator@gmail.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">
                  Password <span className="text-amber-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* What type of affiliate are you? (Checkboxes) */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <label className="font-semibold text-zinc-200 block">
                  What type of affiliate are you? <span className="text-amber-400">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AFFILIATE_TYPE_OPTIONS.map((opt) => {
                    const isChecked = selectedTypes.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={clsx(
                          'flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors',
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTypeOption(opt)}
                          className="mt-0.5 rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="leading-tight">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Your channel, username, or website */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">
                  Your channel, username, or website <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={promotionChannel}
                  onChange={(e) => setPromotionChannel(e.target.value)}
                  placeholder="https://youtube.com/@channel or @tiktok_username"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* How will you promote us? */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300">
                  How will you promote us? <span className="text-amber-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={promotionNotes}
                  onChange={(e) => setPromotionNotes(e.target.value)}
                  placeholder="Describe your audience, product review formats, or where you will place your referral links..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              {/* Program Terms Disclaimer */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Program Policy Summary</span>
                </div>
                <p>
                  Commissions are 20% on product subtotal (excluding shipping and taxes). Self referrals are strictly prohibited. Cancelled or refunded orders forfeit commission. Payout minimum is Rp 250.000 via BCA or Mandiri.
                </p>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Submit Affiliate Application</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="text-center pt-2 border-t border-zinc-800/80">
              <p className="text-xs text-zinc-400">
                Already an approved affiliate?{' '}
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="font-semibold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Sign in here
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
