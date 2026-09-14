import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Layers, 
  Activity, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';

export type NavigationTab = 'dashboard' | 'orders' | 'customers' | 'configurator' | 'health';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  ordersBadge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  ordersBadge,
}) => {
  const navigationItems = [
    { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders' as NavigationTab, label: 'Orders & Fulfillment', icon: ShoppingBag, badge: ordersBadge },
    { id: 'customers' as NavigationTab, label: 'Customers CRM', icon: Users },
    { id: 'configurator' as NavigationTab, label: 'Products & Skins', icon: Layers },
    { id: 'health' as NavigationTab, label: 'Store Status', icon: Activity },
  ];

  return (
    <aside className="w-64 border-r border-white/[0.08] bg-[#08080a] flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-18 px-5 flex items-center gap-3 border-b border-white/[0.08]">
        <div className="w-9 h-9 rounded-xl bg-[#f3aa18] flex items-center justify-center text-black font-bold text-lg font-chakra shadow-sm shadow-[#f3aa18]/30">
          E
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white tracking-wide font-chakra text-base">EXACOAT</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f3aa18]/20 text-[#f3aa18]">ERP</span>
          </div>
          <p className="text-xs text-zinc-400">Order Hub</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1.5">
        {navigationItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={clsx(
                'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 min-h-[44px]',
                isActive
                  ? 'bg-[#f3aa18]/10 text-[#f3aa18] font-semibold border border-[#f3aa18]/25'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={clsx('w-4 h-4', isActive ? 'text-[#f3aa18]' : 'text-zinc-400')} />
                <span>{item.label}</span>
              </div>
              {item.badge ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f3aa18] text-black">
                  {item.badge}
                </span>
              ) : (
                isActive && <ChevronRight className="w-3.5 h-3.5 text-[#f3aa18]/70" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Live Link */}
      <div className="p-3 border-t border-white/[0.08]">
        <a
          href="https://exacoat.com"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors min-h-[44px]"
        >
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>exacoat.com (Live)</span>
          </span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </aside>
  );
};
