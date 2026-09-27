import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Search, 
  ArrowRight, 
  X, 
  LayoutDashboard, 
  ShoppingBag, 
  Star, 
  FileText, 
  Bot, 
  Mail, 
  Users, 
  FlaskConical, 
  Activity, 
  ShieldCheck, 
  Settings, 
  Sparkles,
  Layers,
  FileSpreadsheet,
  Package,
  Sliders,
  Share2,
  UserCog,
  CornerDownLeft
} from 'lucide-react';
import { NavItemKey } from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { lockBodyScroll } from '../../lib/bodyScrollLock';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: NavItemKey) => void;
}

interface WorkspaceAction {
  id: string;
  label: string;
  category: 'Workspace' | 'Analytics' | 'Marketing & Tools' | 'Administration';
  description: string;
  tab: NavItemKey;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

const WORKSPACE_PAGES: WorkspaceAction[] = [
  // Workspace
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    category: 'Workspace',
    description: 'Store performance overview, live sales, and vital operational metrics', 
    tab: 'dashboard', 
    icon: LayoutDashboard,
    keywords: ['metrics', 'overview', 'stats', 'analytics', 'revenue', 'home'] 
  },
  { 
    id: 'orders', 
    label: 'Orders & Fulfillment', 
    category: 'Workspace',
    description: 'Process customer orders, marketplace sync, packing and fulfillment', 
    tab: 'orders', 
    icon: ShoppingBag,
    keywords: ['orders', 'fulfill', 'shipping', 'shopee', 'tiktok', 'woocommerce', 'status', 'invoice'] 
  },
  { 
    id: 'rma', 
    label: 'RMA Claims', 
    category: 'Workspace',
    description: 'Manage replacement claims, warranty requests, and damaged items', 
    tab: 'rma', 
    icon: Layers,
    keywords: ['warranty', 'claims', 'replacements', 'returns', 'damages', 'support'] 
  },
  { 
    id: 'export', 
    label: 'Export Shipments', 
    category: 'Workspace',
    description: 'Bulk carrier export manifests, logistics labels, and batch CSV files', 
    tab: 'export', 
    icon: FileSpreadsheet,
    keywords: ['manifest', 'bulk', 'carrier', 'shipping', 'labels', 'csv', 'excel', 'logistics'] 
  },
  { 
    id: 'tracking_pool', 
    label: 'Tracking Pool', 
    category: 'Workspace',
    description: 'Pre-allocated courier tracking numbers, AWB reservations, and usage', 
    tab: 'tracking_pool', 
    icon: Package,
    keywords: ['tracking', 'awb', 'resi', 'courier', 'pool', 'shipment'] 
  },
  { 
    id: 'products', 
    label: 'Products', 
    category: 'Workspace',
    description: 'Manage skins catalog, device specifications, pricing, and variants', 
    tab: 'products', 
    icon: Package,
    keywords: ['catalog', 'devices', 'skins', 'pricing', 'variants', 'models', 'inventory'] 
  },
  { 
    id: 'configurator', 
    label: 'Configurator Studio', 
    category: 'Workspace',
    description: 'Interactive visual skins customizer, 3D device preview, and profile editor', 
    tab: 'configurator', 
    icon: Sliders,
    keywords: ['studio', 'customizer', 'editor', 'preview', 'profiles', 'device', 'mockup', 'design'] 
  },
  { 
    id: 'materials', 
    label: 'Materials & Stock', 
    category: 'Workspace',
    description: 'Vinyl roll inventory, surface finishes, textures, and stock tracking', 
    tab: 'materials', 
    icon: Layers,
    keywords: ['vinyl', 'stock', 'finishes', 'textures', 'rolls', 'inventory', 'raw material'] 
  },
  { 
    id: 'reviews', 
    label: 'Product Reviews', 
    category: 'Workspace',
    description: 'Moderate customer skin photos, testimonials, and star ratings', 
    tab: 'reviews', 
    icon: Star,
    keywords: ['reviews', 'testimonials', 'photos', 'ratings', 'feedback', 'moderation'] 
  },

  // Analytics
  { 
    id: 'reports', 
    label: 'Sales & Reports', 
    category: 'Analytics',
    description: 'Financial trends, channel breakdowns, sales reports, and revenue analytics', 
    tab: 'reports', 
    icon: FileText,
    keywords: ['analytics', 'sales', 'revenue', 'financials', 'charts', 'trends', 'exports'] 
  },
  { 
    id: 'customers', 
    label: 'Customers', 
    category: 'Analytics',
    description: 'Customer profiles, order histories, contact information, and CRM details', 
    tab: 'customers', 
    icon: Users,
    keywords: ['buyers', 'clients', 'users', 'crm', 'emails', 'history', 'profiles'] 
  },

  // Marketing & Tools
  { 
    id: 'affiliates', 
    label: 'Affiliates', 
    category: 'Marketing & Tools',
    description: 'Creator partnerships, referral commission tracking, and payout management', 
    tab: 'affiliates', 
    icon: Share2,
    keywords: ['creators', 'referrals', 'payouts', 'partners', 'commissions', 'earnings'] 
  },
  { 
    id: 'marketing_emails', 
    label: 'Marketing Studio', 
    category: 'Marketing & Tools',
    description: 'Email marketing campaigns, promotional broadcasts, and Acumbamail dispatch', 
    tab: 'marketing_emails', 
    icon: Sparkles,
    keywords: ['campaigns', 'broadcast', 'acumbamail', 'newsletter', 'promotions', 'marketing'] 
  },
  { 
    id: 'emails', 
    label: 'Transactional Templates', 
    category: 'Marketing & Tools',
    description: 'Automated order notifications, shipping updates, and email template customization', 
    tab: 'emails', 
    icon: Mail,
    keywords: ['templates', 'transactional', 'notifications', 'order email', 'receipts'] 
  },
  { 
    id: 'ai_tools', 
    label: 'AI Tools', 
    category: 'Marketing & Tools',
    description: 'Generate product descriptions, SEO metadata, and promotional copy with AI', 
    tab: 'ai_tools', 
    icon: Bot,
    keywords: ['seo', 'copywriting', 'generator', 'descriptions', 'prompts', 'ai'] 
  },

  // Administration
  { 
    id: 'team', 
    label: 'Team Roles', 
    category: 'Administration',
    description: 'Manage staff accounts, assign roles, and configure administrative access', 
    tab: 'team', 
    icon: UserCog,
    keywords: ['roles', 'members', 'permissions', 'access', 'staff', 'admins', 'users'] 
  },
  { 
    id: 'testing', 
    label: 'Testing Sandbox', 
    category: 'Administration',
    description: 'Validate API endpoints, simulate marketplace webhooks, and test order events', 
    tab: 'testing', 
    icon: FlaskConical,
    keywords: ['sandbox', 'webhooks', 'simulation', 'endpoints', 'test', 'events', 'mock'] 
  },
  { 
    id: 'health', 
    label: 'Store Health', 
    category: 'Administration',
    description: 'Real-time database latency, API status, uptime monitoring, and connection tests', 
    tab: 'health', 
    icon: Activity,
    keywords: ['system', 'latency', 'database', 'uptime', 'status', 'ping', 'connection'] 
  },
  { 
    id: 'audit', 
    label: 'Audit Logs', 
    category: 'Administration',
    description: 'Review security events, administrative actions, and chronological change logs', 
    tab: 'audit', 
    icon: ShieldCheck,
    keywords: ['logs', 'history', 'activity', 'security', 'events', 'changes', 'audit trail'] 
  },
  { 
    id: 'settings', 
    label: 'Settings', 
    category: 'Administration',
    description: 'Store preferences, API keys, marketplace credentials, and system settings', 
    tab: 'settings', 
    icon: Settings,
    keywords: ['configuration', 'credentials', 'api', 'env', 'preferences', 'keys', 'integrations'] 
  },
];

const SHOP_MANAGER_ALLOWED_TABS: NavItemKey[] = [
  'orders', 
  'reviews', 
  'rma', 
  'warranty', 
  'export', 
  'tracking_pool'
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const isShopManager = user?.role === 'shop_manager';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Body scroll locking when open
  useEffect(() => {
    if (!isOpen) return;
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [isOpen]);

  // Focus input on open and reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = WORKSPACE_PAGES.filter(p => {
      if (isShopManager) {
        return SHOP_MANAGER_ALLOWED_TABS.includes(p.tab);
      }
      return true;
    });

    if (!q) return available;
    return available.filter(p => {
      if (p.label.toLowerCase().includes(q)) return true;
      if (p.description.toLowerCase().includes(q)) return true;
      if (p.category.toLowerCase().includes(q)) return true;
      if (p.keywords.some(k => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [query, isShopManager]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredPages.length, query]);

  // Scroll active item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelectPage = useCallback((tab: NavItemKey) => {
    onNavigateTab(tab);
    onClose();
  }, [onNavigateTab, onClose]);

  // Key navigation within the command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredPages.length > 0 ? (prev + 1) % filteredPages.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredPages.length > 0 ? (prev - 1 + filteredPages.length) % filteredPages.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredPages[selectedIndex];
      if (target) {
        handleSelectPage(target.tab);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Keyboard shortcut listener to close when Ctrl+K / Cmd+K is pressed while open
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] sm:pt-16 p-3 sm:p-4 select-none"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search workspace"
        className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-white/[0.1] shadow-2xl overflow-hidden z-10 text-zinc-900 dark:text-zinc-100 flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-200 dark:border-white/[0.08] gap-3 shrink-0">
          <Search className="w-5 h-5 text-amber-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filteredPages.length > 0}
            aria-controls="workspace-search-results"
            placeholder="Search workspace sections, features, keywords..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-sm focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Clear search query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.06] text-[10px] font-mono text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div 
          id="workspace-search-results"
          role="listbox"
          aria-label="Search results"
          className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-0"
        >
          {filteredPages.length > 0 ? (
            filteredPages.map((page, index) => {
              const Icon = page.icon;
              const isSelected = selectedIndex === index;

              return (
                <button
                  key={page.id}
                  ref={el => { itemRefs.current[index] = el; }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectPage(page.tab)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/30 dark:border-amber-500/30'
                      : 'border-transparent hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <div 
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 shadow-sm'
                          : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold truncate ${
                          isSelected ? 'text-zinc-950 dark:text-white' : 'text-zinc-900 dark:text-zinc-200'
                        }`}>
                          {page.label}
                        </p>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.06] shrink-0">
                          {page.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {page.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ArrowRight className={`w-3.5 h-3.5 transition-all ${
                      isSelected 
                        ? 'text-amber-600 dark:text-amber-400 translate-x-0.5 opacity-100' 
                        : 'opacity-0 text-zinc-400'
                    }`} />
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">No matching sections found</p>
              <p>No workspace sections matched &ldquo;{query}&rdquo;.</p>
            </div>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-zinc-200/80 dark:bg-white/10 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">↑</kbd>
              <kbd className="px-1 py-0.2 rounded bg-zinc-200/80 dark:bg-white/10 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">↓</kbd>
              <span className="ml-0.5">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="flex items-center px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-white/10 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">
                <CornerDownLeft className="w-2.5 h-2.5 mr-0.5 inline" /> Enter
              </kbd>
              <span className="ml-0.5">Select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-white/10 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">ESC</kbd>
            <span className="ml-0.5">Close</span>
          </span>
        </div>
      </div>
    </div>
  );
};
