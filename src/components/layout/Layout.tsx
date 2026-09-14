import React, { ReactNode } from 'react';
import { Sidebar, NavigationTab } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  ordersBadge?: number;
  globalSearch?: string;
  onSearchChange?: (term: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentTab,
  onSelectTab,
  onRefresh,
  isRefreshing,
  ordersBadge,
  globalSearch,
  onSearchChange,
}) => {
  return (
    <div className="flex min-h-screen bg-[#000000] text-[#f4f4f5]">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        ordersBadge={ordersBadge}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          globalSearch={globalSearch}
          onSearchChange={onSearchChange}
        />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
