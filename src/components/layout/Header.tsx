import React from 'react';
import { 
  Search, 
  RefreshCw, 
  Sun, 
  Moon, 
  Menu
} from 'lucide-react';
import { NavItemKey } from './Sidebar';
import { useTheme } from '../../context/ThemeContext';

const pageTitles: Record<NavItemKey, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  customers: 'Customers',
  products: 'Products',
  rma: 'RMA Claims',
  warranty: 'RMA Claims',
  export: 'Export Shipments',
  tracking_pool: 'Tracking Pool',
  configurator: 'Configurator Studio',
  materials: 'Materials & Stock',
  reviews: 'Reviews',
  reports: 'Reports',
  ai_tools: 'AI Tools',
  emails: 'Emails',
  team: 'Team',
  testing: 'Testing',
  health: 'Health',
  audit: 'Audit Logs',
  settings: 'Settings',
};


export interface HeaderProps {
  currentTab?: NavItemKey;
  onOpenCommandPalette?: () => void;
  onRefreshData: () => void;
  onNavigateToLogs?: () => void;
  isRefreshing?: boolean;
  dbLatencyMs?: number;
  dbStatus?: 'healthy' | 'warning' | 'error';
  onOpenMobileNav?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab = 'dashboard',
  onOpenCommandPalette,
  onRefreshData,
  onNavigateToLogs,
  isRefreshing = false,
  dbLatencyMs = 38,
  dbStatus = 'healthy',
  onOpenMobileNav,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 px-3 sm:px-5 border-b border-zinc-200 dark:border-white/[0.07] bg-white/88 dark:bg-[#0a0a0c]/88 backdrop-blur-2xl flex items-center justify-between sticky top-0 z-20 font-sans select-none transition-colors duration-200 gap-3">
      <div className="flex items-center gap-3 min-w-0 lg:w-48 xl:w-56">
        {/* Mobile Hamburger Button */}
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.04] hover:bg-zinc-200 dark:hover:bg-white/[0.08] border border-zinc-200 dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer shrink-0"
            aria-label="Open navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {pageTitles[currentTab]}
        </p>
      </div>

      <div className="hidden sm:flex flex-1 max-w-md lg:max-w-lg">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 sm:px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.03] hover:bg-zinc-200/70 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.07] hover:border-zinc-300 dark:hover:border-white/[0.14] text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <span className="truncate text-xs">Search workspace</span>
          </span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] text-[10px] text-zinc-600 dark:text-zinc-400 font-mono shrink-0 shadow-xs">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onNavigateToLogs}
          className="hidden md:flex h-9 items-center gap-2 px-3 rounded-xl bg-zinc-100 dark:bg-white/[0.035] border border-zinc-200 dark:border-white/[0.07] text-[11px] font-mono text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/[0.07] transition-colors"
          title="Open audit logs"
          aria-label={`Database ${dbStatus}, ${dbLatencyMs} milliseconds. Open audit logs`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              dbStatus === 'healthy'
                ? 'bg-lime-500 dark:bg-[#f3aa18] shadow-[0_0_8px_rgba(169,255,93,0.8)]'
                : dbStatus === 'warning'
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }`}
          />
          <span>{dbLatencyMs} ms</span>
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="sm:hidden p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400"
          aria-label="Search workspace"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Dark / Light Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.03] hover:bg-zinc-200 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all shadow-xs"
          title={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-700" />
          )}
        </button>

        {/* Sync Button */}
        <button
          type="button"
          onClick={onRefreshData}
          disabled={isRefreshing}
          className="p-2 rounded-xl bg-zinc-100 dark:bg-white/[0.03] hover:bg-zinc-200 dark:hover:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all shadow-xs disabled:opacity-50"
          title="Refresh workspace data"
          aria-label="Refresh workspace data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-lime-600 dark:text-[#f3aa18]' : ''}`} />
        </button>
      </div>
    </header>
  );
};
