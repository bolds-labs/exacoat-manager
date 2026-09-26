import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  AlertCircle,
  ExternalLink,
  User,
  Mail,
  Lock,
  Globe,
  FileText
} from 'lucide-react';
import { ExacoatLogo } from '../../components/ui/ExacoatLogo';
import { SectionPill } from '../../components/ui/SectionPill';
import { Button } from '../../components/ui/Button';
import { registerAffiliateApplicant } from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { clsx } from 'clsx';

interface AffiliateRegisterPageProps {
  onNavigateToLogin: () => void;
}

const AFFILIATE_TYPE_OPTIONS = [
  'Tech Reviewer / YouTube Creator',
  'Instagram / TikTok Influencer',
  'Tech Blogger / Media Publication',
  'Gadget Community / Forum Admin',
  'Designer / Digital Creator',
  'Other Promotional Channel',
];

const TURNSTILE_SITE_KEY = '0x4AAAAAAFEWyzSLkA95XBCd';

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
  const [turnstileToken, setTurnstileToken] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const turnstileContainerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);

  // Load and render Cloudflare Turnstile widget
  React.useEffect(() => {
    const scriptId = 'cf-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderWidget = () => {
      const turnstile = (window as any).turnstile;
      if (turnstile && turnstileContainerRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = turnstile.render(turnstileContainerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            theme: 'dark',
            callback: (token: string) => {
              setTurnstileToken(token);
            },
            'expired-callback': () => {
              setTurnstileToken('');
            },
            'error-callback': () => {
              setTurnstileToken('');
            },
          });
        } catch (err) {
          console.warn('Turnstile render notice:', err);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        renderWidget();
      };
      document.head.appendChild(script);
    } else if ((window as any).turnstile) {
      renderWidget();
    }

    return () => {
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch {}
      }
    };
  }, []);

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

    if (!turnstileToken) {
      showToast('warning', 'Verification Required', 'Please complete the Cloudflare security verification challenge.');
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
        turnstile_token: turnstileToken,
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
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden select-none font-sans text-white">
      {/* Ambient luxury lighting */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[960px] h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(243,170,24,0.08)_0%,transparent_70%)] blur-[90px] -z-10" 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed bottom-10 left-1/2 -translate-x-1/2 w-[540px] h-[380px] bg-[#f3aa18]/[0.025] rounded-full blur-[140px] -z-10" 
      />

      {/* Main Container */}
      <div className="w-full max-w-[620px] my-6">
        {submittedSuccess ? (
          <div className="p-8 sm:p-10 rounded-3xl space-y-6 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.08)] bg-[#0c0c0e]/95 border border-white/[0.09] text-center backdrop-blur-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Check className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-['Chakra_Petch'] text-white tracking-wide uppercase">
                Application Received
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
                Thank you for applying to the Exacoat Creator Program. Our partnerships team will review your channel and promotional plan. You will receive an approval email shortly at <span className="font-mono text-zinc-200 font-semibold">{email}</span>.
              </p>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onNavigateToLogin}
              >
                Sign In to Creator Portal
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                asChild
              >
                <a
                  href="https://exacoat.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <span>Return to Store</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-7 sm:p-10 rounded-3xl space-y-7 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.08)] bg-[#0c0c0e]/95 border border-white/[0.09] relative overflow-hidden backdrop-blur-2xl">
            
            {/* Header Branding */}
            <div className="text-center space-y-3 pt-1">
              <div className="flex justify-center">
                <ExacoatLogo
                  variant="white"
                  width={160}
                  height={28}
                  className="h-6 sm:h-7 w-auto opacity-95 transition-opacity hover:opacity-100 drop-shadow-[0_2px_16px_rgba(243,170,24,0.18)]"
                />
              </div>

              <div className="flex items-center justify-center pt-1">
                <SectionPill dot dotColor="bg-[#f3aa18]" surface="dark">
                  AFFILIATE PARTNER PROGRAM
                </SectionPill>
              </div>

              <div className="pt-1">
                <h1 className="text-xl sm:text-2xl font-bold font-['Chakra_Petch'] text-white tracking-tight">
                  Creator Application
                </h1>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-md mx-auto">
                  Earn a <strong className="text-white">20% net commission</strong> on verified customer orders with a 30-day cookie window and direct BCA and Mandiri bank transfers.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Username</span>
                  <span className="text-[#f3aa18]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="e.g. techreviewid"
                  className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                />
                <p className="text-[11px] text-zinc-400">
                  Initial referral URL: <span className="font-mono text-[#f3aa18]">exacoat.com/?x={username || 'username'}</span>
                </p>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    First Name <span className="text-[#f3aa18]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Last Name <span className="text-[#f3aa18]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Email Address</span>
                  <span className="text-[#f3aa18]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="creator@gmail.com"
                  className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Password</span>
                  <span className="text-[#f3aa18]">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                />
              </div>

              {/* What type of affiliate are you? */}
              <div className="space-y-2 pt-2 border-t border-white/[0.07]">
                <label className="text-xs font-semibold text-zinc-200 block">
                  What type of affiliate are you? <span className="text-[#f3aa18]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AFFILIATE_TYPE_OPTIONS.map((opt) => {
                    const isChecked = selectedTypes.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={clsx(
                          'flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all',
                          isChecked
                            ? 'bg-[#f3aa18]/10 border-[#f3aa18]/40 text-white'
                            : 'bg-[#0a0a0c]/60 border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTypeOption(opt)}
                          className="mt-0.5 rounded border-white/20 bg-black/40 text-[#f3aa18] focus:ring-[#f3aa18]"
                        />
                        <span className="leading-tight select-none">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Your channel, username, or website */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Your Channel, Handle, or Website</span>
                  <span className="text-[#f3aa18]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={promotionChannel}
                  onChange={(e) => setPromotionChannel(e.target.value)}
                  placeholder="https://youtube.com/@channel or @tiktok_username"
                  className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all"
                />
              </div>

              {/* How will you promote us? */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>How will you promote Exacoat?</span>
                  <span className="text-[#f3aa18]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={promotionNotes}
                  onChange={(e) => setPromotionNotes(e.target.value)}
                  placeholder="Describe your audience, review formats, or where you will share your referral links..."
                  className="w-full bg-[#0a0a0c]/80 border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 focus:ring-1 focus:ring-[#f3aa18]/60 transition-all resize-none"
                />
              </div>

              {/* Program Terms Summary */}
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-zinc-400 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Program Policy Highlights</span>
                </div>
                <p className="leading-relaxed">
                  Commissions are 20% on product subtotal (excluding shipping and taxes). Self referrals are strictly prohibited. Cancelled or refunded orders forfeit commission. Payout minimum is Rp 250.000 via BCA or Mandiri.
                </p>
              </div>

              {/* Cloudflare Turnstile Bot Prevention */}
              <div className="p-3.5 rounded-2xl bg-[#09090b]/80 border border-white/[0.08] flex flex-col items-center justify-center min-h-[75px] space-y-1.5">
                <div ref={turnstileContainerRef} />
                {!turnstileToken && (
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <span>Please verify the security check above to submit application</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={isSubmitting}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Submit Affiliate Application
                </Button>
              </div>
            </form>

            <div className="text-center pt-2 border-t border-white/[0.07]">
              <p className="text-xs text-zinc-400">
                Already an approved creator?{' '}
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="font-semibold text-[#f3aa18] hover:text-[#f8ba3a] underline underline-offset-4 cursor-pointer"
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
