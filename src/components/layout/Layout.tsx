import React, { useEffect, useState } from 'react';
import { Sidebar, NavItemKey, getTabHref } from './Sidebar';
import { Header } from './Header';
import { RoleSimulationBanner } from './RoleSimulationBanner';
import { CommandPalette } from './CommandPalette';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Star, 
  FileText 
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { useMarketplaceInjection } from '../../context/MarketplaceInjectionContext';
import { ShopeeImageInjectorModal } from '../orders/ShopeeImageInjectorModal';

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
  const { isModalOpen, modalParams, closeInjectorModal, activeJob } = useMarketplaceInjection();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global keyboard shortcut to toggle Command Palette (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isShopManager = user?.role === 'shop_manager';

  return (
    <div className="manager-workspace h-screen w-screen bg-bg text-fg flex relative overflow-hidden font-sans">
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
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onRefreshData={onRefreshData}
          onNavigateToLogs={user?.role === 'super_admin' ? () => onTabChange('audit') : undefined}
          isRefreshing={isRefreshing}
          dbLatencyMs={dbLatencyMs}
          dbStatus={dbStatus}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {/* Scroll container on the far right edge (with padding for mobile bottom nav) */}
        <div className={clsx("flex-1 overflow-y-auto w-full scroll-smooth", !isShopManager ? "pb-16 lg:pb-0" : "pb-0")}>
          <main className="manager-content">
            <div key={currentTab} className="animate-page-enter space-y-4 sm:space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Visible only on < lg screens for non-shop managers) */}
      {!isShopManager && (
      <nav 
        aria-label="Mobile Navigation" 
        className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-panel border-t border-line z-30 grid grid-cols-4 items-center px-3 font-sans select-none pb-safe"
      >
        {/* 1. Dashboard */}
        <a
          href={getTabHref('dashboard')}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onTabChange('dashboard');
          }}
          className={clsx(
            "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 cursor-pointer text-center active:scale-90 group select-none no-underline",
            currentTab === 'dashboard'
              ? "text-accent"
              : "text-muted hover:text-fg"
          )}
        >
          <div className={clsx("transition-transform duration-200", currentTab === 'dashboard' && "scale-110")}>
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-mono mt-1 font-medium tracking-tight">Dashboard</span>
        </a>

        {/* 2. Orders */}
        <a
          href={getTabHref('orders')}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onTabChange('orders');
          }}
          className={clsx(
            "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 cursor-pointer text-center relative active:scale-90 group select-none no-underline",
            currentTab === 'orders'
              ? "text-accent"
              : "text-muted hover:text-fg"
          )}
        >
          <div className={clsx("relative transition-transform duration-200", currentTab === 'orders' && "scale-110")}>
            <ShoppingBag className="w-5 h-5" />
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-accent text-accent-on text-[9px] font-mono font-bold leading-none">
                {pendingOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono mt-1 font-medium tracking-tight">Orders</span>
        </a>

        {/* 3. Reviews */}
        <a
          href={getTabHref('reviews')}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onTabChange('reviews');
          }}
          className={clsx(
            "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 cursor-pointer text-center relative active:scale-90 group select-none no-underline",
            currentTab === 'reviews'
              ? "text-accent"
              : "text-muted hover:text-fg"
          )}
        >
          <div className={clsx("relative transition-transform duration-200", currentTab === 'reviews' && "scale-110")}>
            <Star className="w-5 h-5" />
            {pendingReviewsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-accent text-accent-on text-[9px] font-mono font-bold leading-none">
                {pendingReviewsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono mt-1 font-medium tracking-tight">Reviews</span>
        </a>

        {/* 4. Reports */}
        <a
          href={getTabHref('reports')}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onTabChange('reports');
          }}
          className={clsx(
            "flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200 cursor-pointer text-center active:scale-90 group select-none no-underline",
            currentTab === 'reports'
              ? "text-accent"
              : "text-muted hover:text-fg"
          )}
        >
          <div className={clsx("transition-transform duration-200", currentTab === 'reports' && "scale-110")}>
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-mono mt-1 font-medium tracking-tight">Reports</span>
        </a>
      </nav>
      )}

      {/* Global Command Palette / Search Workspace Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={onTabChange}
      />

      {/* Global Marketplace Image Injector Modal */}
      <ShopeeImageInjectorModal
        isOpen={isModalOpen}
        onClose={closeInjectorModal}
        item={modalParams?.item ?? activeJob?.shopeeItem ?? null}
        tiktokItem={modalParams?.tiktokItem ?? activeJob?.tiktokItem ?? null}
        channel={modalParams?.channel ?? activeJob?.channel}
        onSuccess={modalParams?.onSuccess}
      />
    </div>
  );
};
