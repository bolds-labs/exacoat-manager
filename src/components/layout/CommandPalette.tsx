import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowRight, X, LayoutDashboard, ShoppingBag, Star, FileText, Bot, Mail, Users, FlaskConical, Activity, ShieldCheck, Settings } from 'lucide-react';
import { NavItemKey } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: NavItemKey) => void;
}

interface WorkspaceAction {
  id: string;
  label: string;
  description: string;
  tab: NavItemKey;
  icon: React.ComponentType<{ className?: string }>;
  roleRestricted?: boolean;
}

const WORKSPACE_PAGES: WorkspaceAction[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Store performance overview and vital metrics', tab: 'dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders & Fulfillment', description: 'Review, process and track customer orders', tab: 'orders', icon: ShoppingBag },
  { id: 'reviews', label: 'Product Reviews', description: 'Moderate customer skin photos and testimonials', tab: 'reviews', icon: Star },
  { id: 'reports', label: 'Sales & Analytics', description: 'Financial trends, volume breakdown and exports', tab: 'reports', icon: FileText },
  { id: 'emails', label: 'Email Templates', description: 'Customer transactional email previews and tests', tab: 'emails', icon: Mail },
  { id: 'ai_tools', label: 'AI Copy & SEO Tools', description: 'Generate product descriptions and social copy', tab: 'ai_tools', icon: Bot },
  { id: 'team', label: 'Team Roles', description: 'Manage staff roles and access control', tab: 'team', icon: Users, roleRestricted: true },
  { id: 'testing', label: 'Testing Sandbox', description: 'Validate endpoints and simulated customer events', tab: 'testing', icon: FlaskConical, roleRestricted: true },
  { id: 'health', label: 'Store Health', description: 'API latency, database uptime and system status', tab: 'health', icon: Activity, roleRestricted: true },
  { id: 'audit', label: 'Audit Logs', description: 'Trace operations and administrative events', tab: 'audit', icon: ShieldCheck, roleRestricted: true },
  { id: 'settings', label: 'Settings', description: 'Store preferences, credentials and integrations', tab: 'settings', icon: Settings, roleRestricted: true },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const isShopManager = user?.role === 'shop_manager';
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = WORKSPACE_PAGES.filter(p => !isShopManager || !p.roleRestricted);

    if (!q) return available;
    return available.filter(
      p => p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [query, isShopManager]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] sm:pt-20 p-3 sm:p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      <div role="dialog" aria-modal="true" aria-label="Search workspace" className="relative w-full max-w-xl rounded-2xl bg-white/95 dark:bg-[#101014]/95 border border-zinc-200 dark:border-white/[0.12] shadow-2xl backdrop-blur-2xl overflow-hidden z-10 text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-200 dark:border-white/[0.08]">
          <Search className="w-5 h-5 text-[#f3aa18] shrink-0 mr-3" />
          <input
            type="text"
            placeholder="Search workspace sections or features..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-zinc-950 dark:text-white placeholder:text-zinc-500 text-sm focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 ml-2 rounded bg-zinc-100 dark:bg-white/10 text-[10px] font-mono text-zinc-500 border border-zinc-200 dark:border-white/10">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2 space-y-1">
          {filteredPages.length > 0 ? (
            filteredPages.map(page => {
              const Icon = page.icon;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => {
                    onNavigateTab(page.tab);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-600 dark:text-zinc-300 group-hover:text-amber-500 transition-colors shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {page.label}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {page.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-amber-500 shrink-0" />
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching workspace sections found for "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
