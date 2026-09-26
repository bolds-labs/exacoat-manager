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
  AlertTriangle 
} from 'lucide-react';
import { ExacoatLogo } from '../../components/ui/ExacoatLogo';
import { AffiliateProfile } from '../../types';
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Approved Creator
          </span>
        );
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Under Review
          </span>
        );
      case 'suspended':
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Account Suspended
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a 
              href="https://exacoat.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md p-1"
              title="Visit Exacoat Store"
            >
              <ExacoatLogo className="h-6 w-auto text-white" />
            </a>
            <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                Affiliate
              </span>
              {profile && getStatusBadge(profile.status)}
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTabChange(item.key)}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                    isActive
                      ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  )}
                >
                  <Icon className={clsx('w-4 h-4', isActive ? 'text-amber-400' : 'text-zinc-400')} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Profile and Logout */}
          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-medium text-zinc-200 leading-tight">
                  {profile.first_name} {profile.last_name}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  @{profile.slug}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Sign out of affiliate portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-3 space-y-1">
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
                    'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                    isActive
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  )}
                >
                  <Icon className={clsx('w-4 h-4', isActive ? 'text-amber-400' : 'text-zinc-400')} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-400">
        <p>Exacoat Creator Affiliate Program. 20% Net Commission on Eligible Direct Referrals.</p>
      </footer>
    </div>
  );
};
