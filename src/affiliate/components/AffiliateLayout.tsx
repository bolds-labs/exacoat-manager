import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Link2, 
  Wallet, 
  Settings, 
  LogOut, 
  ExternalLink, 
  Menu, 
  X, 
  ShieldCheck, 
  Clock, 
  AlertTriangle,
  User
} from 'lucide-react';
import { ExacoatLogo } from '../../components/ui/ExacoatLogo';
import { SectionPill } from '../../components/ui/SectionPill';
import { AffiliateProfile } from '../../types';
import { APP_VERSION } from '../../config/version';
import { clsx } from 'clsx';

export type AffiliateTabKey = 'dashboard' | 'links' | 'payouts' | 'settings';

interface AffiliateLayoutProps {
  currentTab: AffiliateTabKey;
  onTabChange: (tab: AffiliateTabKey) => void;
  profile: AffiliateProfile | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AffiliateLayout: React.FC<AffiliateLayoutProps> = ({
  currentTab,
  onTabChange,
  profile,
  onLogout,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { key: 'dashboard' as AffiliateTabKey, label: 'Overview', icon: LayoutDashboard },
    { key: 'links' as AffiliateTabKey, label: 'Product Links', icon: Link2 },
    { key: 'payouts' as AffiliateTabKey, label: 'Payouts', icon: Wallet },
    { key: 'settings' as AffiliateTabKey, label: 'Settings', icon: Settings },
  ];

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/25">
            <Clock className="w-3.5 h-3.5" />
            Under Review
          </span>
        );
      case 'suspended':
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Suspended
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="manager-workspace dark min-h-screen bg-[#070709] text-zinc-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-[#f3aa18]/30 selection:text-white">
      {/* Ambient luxury lighting */}
      <div 
        aria-hidden="true" 
        className="fixed top-0 left-1/4 w-[600px] h-[500px] bg-[#f3aa18]/5 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-subtle" 
      />
      <div 
        aria-hidden="true" 
        className="fixed bottom-0 right-1/4 w-[500px] h-[400px] bg-white/[0.02] rounded-full blur-[130px] pointer-events-none -z-10" 
      />

      {/* Top Header */}
      <header className="h-16 px-4 sm:px-6 md:px-8 border-b border-white/[0.07] bg-[#0a0a0c]/88 backdrop-blur-2xl flex items-center justify-between sticky top-0 z-40 select-none transition-colors duration-200 gap-4">
        <div className="flex items-center gap-4">
          <a 
            href="https://exacoat.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3aa18] rounded-md p-1"
            title="Visit Exacoat Store"
          >
            <ExacoatLogo
              variant="white"
              width={140}
              height={24}
              className="h-5 sm:h-6 w-auto opacity-95 hover:opacity-100 transition-opacity"
            />
          </a>
          <div className="h-4 w-[1px] bg-white/[0.1] hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <SectionPill dot dotColor="bg-[#f3aa18]" surface="dark">
              CREATOR PORTAL
            </SectionPill>
            {profile && getStatusBadge(profile.status)}
          </div>
        </div>

        {/* Center Segmented Pill Navigation */}
        <nav className="hidden md:flex items-center p-1 rounded-xl bg-[#141414] border border-white/[0.08] gap-1 shadow-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={clsx(
                  'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f3aa18]',
                  isActive
                    ? 'bg-[#f3aa18] text-[#080808] shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <Icon className={clsx('w-3.5 h-3.5', isActive ? 'text-[#080808]' : 'text-zinc-400')} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Profile and Logout Actions */}
        <div className="flex items-center gap-2.5">
          {profile && (
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="w-6 h-6 rounded-lg bg-[#f3aa18]/15 border border-[#f3aa18]/25 flex items-center justify-center text-[#f3aa18] shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-xs font-semibold text-white">
                  {profile.first_name} {profile.last_name}
                </span>
                <span className="text-[10px] font-mono text-[#f3aa18]">
                  @{profile.slug}
                </span>
              </div>
            </div>
          )}

          <a
            href="https://exacoat.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex h-9 items-center gap-1.5 px-3 rounded-xl bg-[#141414] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
            title="Open Exacoat Store"
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            <span>Store</span>
          </a>

          <button
            type="button"
            onClick={onLogout}
            className="h-9 px-3 rounded-xl bg-white/[0.035] hover:bg-rose-500/15 text-zinc-400 hover:text-rose-300 border border-white/[0.07] hover:border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            title="Sign out of creator workstation"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-[#141414] border border-white/[0.08] text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-[#0c0c0e] px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onTabChange(item.key);
                  setMobileMenuOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left',
                  isActive
                    ? 'bg-[#f3aa18] text-[#080808]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                <Icon className={clsx('w-4 h-4', isActive ? 'text-[#080808]' : 'text-zinc-400')} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <main className="manager-content flex-1 w-full max-w-[1680px] mx-auto px-4 py-6 sm:px-6 md:px-8">
        <div className="animate-page-enter space-y-6">
          {children}
        </div>
      </main>

      {/* Luxury Obsidian Footer */}
      <footer className="border-t border-white/[0.06] py-5 px-4 text-center text-[11px] font-mono text-zinc-500">
        <p>Exacoat Creator Platform v{APP_VERSION} &bull; 20% Net Commission Direct Tracking</p>
      </footer>
    </div>
  );
};
