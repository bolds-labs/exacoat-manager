import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Mail, 
  Key, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  CheckCircle2 
} from 'lucide-react';
import { ExacoatLogo } from '../components/ui/ExacoatLogo';
import { SectionPill } from '../components/ui/SectionPill';
import { APP_VERSION } from '../config/version';

interface LoginPageProps {
  onGoToRegister?: () => void;
  portalMode?: 'admin' | 'affiliate';
}

export const LoginPage: React.FC<LoginPageProps> = ({ 
  onGoToRegister, 
  portalMode = 'admin' 
}) => {
  const { login, resetPassword } = useAuth();
  const { showToast } = useToast();

  const isAffiliateMode = portalMode === 'affiliate';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setErrorMsg(res.error || 'Invalid credentials');
        showToast('error', 'Authentication Failed', res.error || 'Invalid email or password');
      } else {
        showToast('success', 'Signed In', 'Welcome to Exacoat Manager.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your account email address.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setResetSent(true);
      showToast('success', 'Recovery Dispatched', `If an account exists for ${email}, a reset link has been sent.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to dispatch recovery instructions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden select-none font-sans text-white">
      {/* Ambient luxury lighting */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[900px] h-[480px] bg-[radial-gradient(circle_at_50%_0%,rgba(243,170,24,0.08)_0%,transparent_70%)] blur-[90px] -z-10" 
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[360px] bg-[#f3aa18]/[0.025] rounded-full blur-[140px] -z-10" 
      />

      {/* Main Card */}
      <div className="w-full max-w-[420px] p-7 sm:p-9 rounded-3xl space-y-6 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.08)] bg-[#0c0c0e]/95 border border-white/[0.09] relative overflow-hidden backdrop-blur-2xl">
        
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
              {isAffiliateMode ? 'CREATOR PORTAL' : 'OPERATIONS ERP'}
            </SectionPill>
          </div>

          <div className="pt-1">
            <h1 className="text-xl sm:text-2xl font-bold font-['Chakra_Petch'] text-white tracking-tight">
              {isForgotPassword ? 'Reset Password' : (isAffiliateMode ? 'Creator Sign In' : 'Admin Sign In')}
            </h1>
            <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">
              {isForgotPassword
                ? (isAffiliateMode 
                    ? 'Enter your registered affiliate email to receive a password reset link.' 
                    : 'Enter your registered administrator email to receive a password reset link.')
                : (isAffiliateMode 
                    ? 'Sign in to access your referral links, track earnings, and request payouts.' 
                    : 'Sign in to access fulfillment, orders, and production workstation.')}
            </p>
          </div>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div 
            role="alert" 
            className="p-3.5 bg-rose-500/[0.08] border border-rose-500/25 rounded-2xl text-xs space-y-1 font-sans animate-fade-in shadow-xs"
          >
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <p className="font-medium text-rose-200 text-xs leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label 
                htmlFor="reset-email" 
                className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block"
              >
                Account Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  id="reset-email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@exacoat.com"
                  className="h-11 w-full pl-10 pr-4 rounded-xl border border-white/[0.09] bg-white/[0.035] font-sans text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-all hover:border-white/[0.16] focus:border-[#f3aa18]/70 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#f3aa18]/[0.08]"
                />
              </div>
            </div>

            {resetSent && (
              <div className="p-3.5 bg-[#f3aa18]/[0.08] border border-[#f3aa18]/25 rounded-2xl text-xs space-y-1 font-sans">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Recovery Link Dispatched</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed pl-6">
                  If that email exists in the Exacoat database, instructions have been sent.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl bg-[#f3aa18] hover:bg-[#ffbe3b] text-zinc-950 font-['Chakra_Petch'] text-xs sm:text-sm font-bold uppercase tracking-wider shadow-[0_0_24px_rgba(243,170,24,0.18)] transition-all hover:shadow-[0_0_30px_rgba(243,170,24,0.28)] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Dispatching Link...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetSent(false);
                  setErrorMsg('');
                }}
                className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer font-mono"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label 
                htmlFor="login-email" 
                className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block"
              >
                Account Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAffiliateMode ? "creator@exacoat.com" : "admin@exacoat.com"}
                  className="h-11 w-full pl-10 pr-4 rounded-xl border border-white/[0.09] bg-white/[0.035] font-sans text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-all hover:border-white/[0.16] focus:border-[#f3aa18]/70 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#f3aa18]/[0.08]"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="password-field" 
                  className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setErrorMsg('');
                  }}
                  className="text-xs text-zinc-400 hover:text-[#f3aa18] transition-colors cursor-pointer font-mono"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password-field"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 w-full pl-10 pr-11 rounded-xl border border-white/[0.09] bg-white/[0.035] font-sans text-xs sm:text-sm text-white placeholder-zinc-500 outline-none transition-all hover:border-white/[0.16] focus:border-[#f3aa18]/70 focus:bg-white/[0.05] focus:ring-4 focus:ring-[#f3aa18]/[0.08]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl bg-[#f3aa18] hover:bg-[#ffbe3b] text-zinc-950 font-['Chakra_Petch'] text-xs sm:text-sm font-bold uppercase tracking-wider shadow-[0_0_24px_rgba(243,170,24,0.18)] transition-all hover:shadow-[0_0_30px_rgba(243,170,24,0.28)] active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>{isAffiliateMode ? 'Sign In to Creator Portal' : 'Sign In to Workstation'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Affiliate Apply Action */}
        {isAffiliateMode && onGoToRegister && !isForgotPassword && (
          <div className="pt-2 text-center border-t border-white/[0.06]">
            <p className="text-xs text-zinc-400">
              Want to earn commissions with Exacoat?{' '}
              <button
                type="button"
                onClick={onGoToRegister}
                className="font-semibold text-[#f3aa18] hover:text-[#ffbe3b] underline-offset-4 hover:underline cursor-pointer"
              >
                Apply now &rarr;
              </button>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-white/[0.06] text-center">
          <p className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
            {isAffiliateMode ? `Exacoat Creator Platform v${APP_VERSION}` : `Exacoat Operations Platform v${APP_VERSION}`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
