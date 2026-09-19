import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Mail, 
  Key, 
  ArrowRight, 
  AlertCircle, 
  Loader2
} from 'lucide-react';

interface LoginPageProps {
  onGoToRegister?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const { login, resetPassword } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setErrorMsg(err?.message || 'Authentication error');
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
      setErrorMsg(err?.message || 'Failed to request reset link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden select-none font-sans">
      {/* Subtle ambient luxury studio glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] bg-gradient-to-b from-white/[0.025] via-[#f3aa18]/[0.015] to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Main Studio Card (440-450px wide) */}
      <div className="w-full max-w-[440px] p-8 sm:p-10 rounded-3xl space-y-6 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.08)] bg-[#0e0e10]/95 border border-white/[0.1] relative overflow-hidden backdrop-blur-2xl">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center text-base font-black text-[#f3aa18] shadow-sm font-mono tracking-tighter">
              EX
            </div>
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-lg tracking-wide text-white uppercase font-sans leading-tight">
                Exacoat
              </span>
              <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
                OPERATIONS ERP
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20 tracking-wider">
              ADMIN WORKSPACE
            </span>
          </div>
        </div>

        {/* Error Notice Banner */}
        {errorMsg && (
          <div className="p-3.5 bg-zinc-900/90 border border-rose-500/30 rounded-2xl text-xs space-y-1 animate-fade-in font-sans shadow-lg">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <p className="font-semibold text-rose-300 text-xs">{errorMsg}</p>
            </div>
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
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
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-zinc-900/80 border border-white/[0.08] focus:border-[#f3aa18] rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-all font-sans"
                />
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                Enter your registered administrator or manager email to receive password reset instructions.
              </p>
            </div>

            {resetSent && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs space-y-1 text-center font-sans">
                <p className="font-bold text-amber-300">Recovery Instructions Dispatched</p>
                <p className="text-zinc-400 text-[11px]">
                  If that account is registered in Exacoat, a secure reset link has been sent.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#f3aa18] hover:bg-[#f5b838] text-zinc-950 font-bold text-xs sm:text-sm shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-3 font-sans"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Dispatching Link...</span>
                </>
              ) : (
                <span>Send Password Reset Link</span>
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
              <label htmlFor="login-email" className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
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
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-zinc-900/80 border border-white/[0.08] focus:border-[#f3aa18] rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-all font-sans"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password-field" className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
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
                  type="password"
                  id="password-field"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-zinc-900/80 border border-white/[0.08] focus:border-[#f3aa18] rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-all font-sans"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-3 font-sans"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Exacoat</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="pt-3 border-t border-white/[0.06] text-center">
          <p className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
            Exacoat Operations Platform
          </p>
        </div>
      </div>
    </div>
  );
};
