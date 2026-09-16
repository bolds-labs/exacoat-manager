import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Mail, 
  Key, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Loader2
} from 'lucide-react';

interface LoginPageProps {
  onGoToRegister?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const { login, loginAsDevAdmin } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('admin@exacoat.com');
  const [password, setPassword] = useState('••••••••••••');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden select-none font-sans">
      {/* Subtle ambient luxury studio glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] bg-gradient-to-b from-white/[0.025] via-[#f3aa18]/[0.015] to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Main Studio Card (440–450px wide) */}
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
                placeholder="admin@exacoat.com"
                className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-zinc-900/80 border border-white/[0.08] focus:border-[#f3aa18] rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-all font-sans"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label htmlFor="password-field" className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
              Password
            </label>
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
                placeholder="••••••••••••"
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

          {/* Local Dev Fast Access */}
          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            <button
              type="button"
              onClick={() => {
                loginAsDevAdmin();
                showToast('success', 'Admin Session Active', 'Logged in as Exacoat Administrator.');
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 border border-[#f3aa18]/25 text-[#f3aa18] font-mono font-bold text-xs shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#f3aa18]" />
              <span>Quick Access (Admin)</span>
            </button>
            <p className="text-[10px] text-zinc-500 text-center font-mono">
              Instant local access to Exacoat ERP
            </p>
          </div>
        </form>

        <div className="pt-3 border-t border-white/[0.06] text-center">
          <p className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
            Exacoat Operations Platform
          </p>
        </div>
      </div>
    </div>
  );
};
