import React from 'react';
import { Search, RefreshCw, Sun, Moon, Menu } from 'lucide-react';
import { NavItemKey, groupLabelForTab } from './sidebarNav';
import { SearchField } from '../ds/SearchField';
import { useTheme } from '../../context/ThemeContext';
import { TopBarInjectionWidget } from './TopBarInjectionWidget';

const pageTitles: Record<NavItemKey, string> = {
  dashboard: 'Dashboard',
  staff: 'Staff dashboard',
  orders: 'Orders',
  custom_label: 'Custom Label',
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
  skin_performance: 'Skin Performance',
  ai_tools: 'AI Tools',
  emails: 'Emails',
  marketing_emails: 'Marketing Studio',
  affiliates: 'Affiliates',
  team: 'Team',
  testing: 'Testing',
  health: 'Health',
  audit: 'Audit Logs',
  settings: 'Settings',
  design_system: 'Design System',
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
    <header className="sticky top-0 z-20 flex h-[58px] select-none items-center justify-between gap-3 border-b border-line bg-bg px-3 font-sans sm:px-7">
      <div className="flex min-w-0 items-center gap-3 lg:w-56">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="shrink-0 cursor-pointer rounded-[9px] border border-field-border bg-field p-2 text-muted transition-colors hover:text-fg lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <p className="truncate text-[13.5px] text-faint">
          {groupLabelForTab(currentTab)} <span className="px-0.5">/</span> <b className="font-medium text-fg">{pageTitles[currentTab]}</b>
        </p>
      </div>

      <div className="hidden max-w-md flex-1 sm:flex lg:max-w-lg">
        <SearchField
          readOnly
          placeholder="Search workspace"
          shortcut="Ctrl K"
          onClick={onOpenCommandPalette}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpenCommandPalette?.();
          }}
          className="w-full cursor-pointer"
        />
      </div>

      <TopBarInjectionWidget />

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onNavigateToLogs}
          className="hidden h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-field-border bg-field px-3 font-mono text-[11px] text-muted transition-colors hover:text-fg md:flex"
          title="Open audit logs"
          aria-label={`Database ${dbStatus}, ${dbLatencyMs} milliseconds. Open audit logs`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              dbStatus === 'healthy' ? 'bg-st-done-fg' : dbStatus === 'warning' ? 'bg-st-wait-fg' : 'bg-st-stop-fg'
            }`}
          />
          <span>{dbLatencyMs} ms</span>
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="cursor-pointer rounded-[9px] border border-field-border bg-field p-2 text-muted sm:hidden"
          aria-label="Search workspace"
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-field-border bg-field px-3 text-[13px] text-muted transition-colors hover:text-fg"
          title={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>

        <button
          type="button"
          onClick={onRefreshData}
          disabled={isRefreshing}
          className="cursor-pointer rounded-[9px] border border-field-border bg-field p-2 text-muted transition-colors hover:text-fg disabled:opacity-50"
          title="Refresh workspace data"
          aria-label="Refresh workspace data"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-accent' : ''}`} />
        </button>
      </div>
    </header>
  );
};
