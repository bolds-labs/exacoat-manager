import React, { useEffect, useState } from 'react';
import { Sidebar, NavItemKey } from './Sidebar';
import { Header } from './Header';
import { RoleSimulationBanner } from './RoleSimulationBanner';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Star, 
  FileText 
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  currentTab: NavItemKey;
  onTabChange: (tab: NavItemKey) => void;
  onRefreshData: () => void;
  isRefreshing?: boolean;
  pendingOrdersCount?: number;
  pendingReviewsCount?: number;
  dbLatencyMs?: number;
  dbStatus?: 'healthy' | 'warning' | 'error';
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentTab,
  onTabChange,
  onRefreshData,
  isRefreshing,
  pendingOrdersCount = 0,
  pendingReviewsCount = 0,
  dbLatencyMs,
  dbStatus,
}) => {
  const { user } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="manager-workspace h-screen w-screen bg-[#f6f6f3] dark:bg-[#080808] text-zinc-900 dark:text-zinc-100 flex relative overflow-hidden font-sans transition-colors duration-200">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[500px] bg-[#f3aa18]/5 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-subtle" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[400px] bg-zinc-400/5 dark:bg-white/[0.02] rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="fixed top-1/2 right-0 w-[400px] h-[400px] bg-zinc-400/5 dark:bg-zinc-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Sidebar with Desktop Fixed & Mobile Drawer Modes */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={onTabChange}
        pendingReviewCount={pendingReviewsCount}
        isMobileOpen={isMobileNavOpen}
        onMobileClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Workspace with Local Scroll */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <RoleSimulationBanner />
        <Header
          currentTab={currentTab}
          onOpenCommandPalette={() => {}}
          onRefreshData={onRefreshData}
          onNavigateToLogs={user?.role === 'super_admin' ? () => onTabChange('audit') : undefined}
          isRefreshing={isRefreshing}
          dbLatencyMs={dbLatencyMs}
          dbStatus={dbStatus}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {/* Scroll container on the far right edge (with padding for mobile bottom nav) */}
        <div className="flex-1 overflow-y-auto w-full pb-16 lg:pb-0 scroll-smooth">
          <main className="manager-content">
            <div key={currentTab} className="animate-page-enter space-y-4 sm:space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Visible only on < lg screens) */}
      <nav 
        aria-label="Mobile Navigation" 
        className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#0c0c0e]/95 border-t border-zinc-200 dark:border-white/10 backdrop-blur-2xl z-30 grid grid-cols-4 items-center px-3 font-sans select-none shadow-[0_-10px_30px_rgba(0,0,0,0.28)] pb-safe"
      >
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => onTabChange('dashboard')}
          className={clsx(
            "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 cursor-pointer text-center active:scale-90 group",
            currentTab === 'dashboard'
              ? "text-lime-600 dark:text-[#f3aa18]"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          )}
        >
          <div className={clsx("transition-transform duration-200", currentTab === 'dashboard' && "scale-110")}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-mono mt-1 font-medium tracking-tight">Dashboard</span>
        </button>

        {/* 2. Orders */}
        <button
          type="button"
          onClick={() => onTabChange('orders')}
          className={clsx(
            "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 cursor-pointer text-center relative active:scale-90 group",
            currentTab === 'orders'
              ? "text-lime-600 dark:text-[#f3aa18]"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          )}
        >
          <div className={clsx("relative transition-transform duration-200", currentTab === 'orders' && "scale-110")}>
            <ShoppingBag className="w-5 h-5" />
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-mono font-bold leading-none animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono mt-1 font-medium tracking-tight">Orders</span>
        </button>

        {/* 3. Reviews */}
        <button
          type="button"
          onClick={() => onTabChange('reviews')}
          className={clsx(
            "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 cursor-pointer text-center relative active:scale-90 group",
            currentTab === 'reviews'
              ? "text-lime-600 dark:text-[#f3aa18]"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          )}
        >
          <div className={clsx("relative transition-transform duration-200", currentTab === 'reviews' && "scale-110")}>
            <Star className="w-5 h-5" />
            {pendingReviewsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-mono font-bold leading-none animate-pulse">
                {pendingReviewsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono mt-1 font-medium tracking-tight">Reviews</span>
        </button>

        {/* 4. Reports */}
        <button
          type="button"
          onClick={() => onTabChange('reports')}
          className={clsx(
            "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 cursor-pointer text-center active:scale-90 group",
            currentTab === 'reports'
              ? "text-lime-600 dark:text-[#f3aa18]"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          )}
        >
          <div className={clsx("transition-transform duration-200", currentTab === 'reports' && "scale-110")}>
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-mono mt-1 font-medium tracking-tight">Reports</span>
        </button>
      </nav>
    </div>
  );
};
