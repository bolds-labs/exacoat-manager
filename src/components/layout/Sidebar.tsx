import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Activity, 
  Settings, 
  LogOut,
  ShieldCheck,
  Bot,
  Mail,
  FlaskConical,
  ShoppingBag,
  Shield,
  Eye,
  ExternalLink,
  X,
  Star,
  Layers,
  Sliders,
  LucideIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';
import { APP_VERSION } from '../../config/version';
import { lockBodyScroll } from '../../lib/bodyScrollLock';

export type NavItemKey = 
  | 'dashboard'
  | 'orders'
  | 'configurator'
  | 'materials'
  | 'reviews'
  | 'reports'
  | 'ai_tools'
  | 'emails'
  | 'team'
  | 'testing'
  | 'health'
  | 'audit'
  | 'settings';


interface NavChildItem {
  key: NavItemKey;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  badgeVariant?: 'amber' | 'lime' | 'purple';
}

interface NavItem {
  key: NavItemKey;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeVariant?: 'amber' | 'lime' | 'purple';
  children?: NavChildItem[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export interface SidebarProps {
  currentTab: string;
  onTabChange?: (tab: any) => void;
  onSelectTab?: (tab: any) => void;
  pendingReviewCount?: number;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onSelectTab,
  pendingReviewCount = 0,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const { 
    user, 
    logout, 
    simulatedRole, 
    setSimulatedRole, 
    canSimulateRoles, 
    isSimulatingRole 
  } = useAuth();
  const handleSelect = onTabChange || onSelectTab || (() => {});

  const [isRendered, setIsRendered] = React.useState(isMobileOpen);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (isMobileOpen) {
      setIsRendered(true);
      const timer = setTimeout(() => setIsVisible(true), 20);
      const unlock = lockBodyScroll();
      return () => {
        clearTimeout(timer);
        unlock();
      };
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isMobileOpen]);

  const isShopManager = user?.role === 'shop_manager';

  const fullNavSections: NavSection[] = [
    {
      title: 'Workspace',
      items: [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { key: 'orders', label: 'Orders', icon: ShoppingBag },
        { key: 'configurator', label: 'Configurator Studio', icon: Sliders },
        { key: 'materials', label: 'Materials & Stock', icon: Layers },
        { key: 'reviews', label: 'Reviews', icon: Star, badge: pendingReviewCount > 0 ? pendingReviewCount : undefined, badgeVariant: 'amber' },
      ]
    },
    {
      title: 'Analytics',
      items: [
        { key: 'reports', label: 'Sales & Reports', icon: FileText },
      ]
    },
    {
      title: 'Marketing & Tools',
      items: [
        { key: 'emails', label: 'Email Templates', icon: Mail },
        { key: 'ai_tools', label: 'AI Tools', icon: Bot },
      ]
    },
    {
      title: 'Administration',
      items: [
        { key: 'team', label: 'Team Roles', icon: Users },
        { key: 'testing', label: 'Testing Sandbox', icon: FlaskConical },
        { key: 'health', label: 'Store Health', icon: Activity },
        { key: 'audit', label: 'Audit Logs', icon: ShieldCheck },
        { key: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  const shopNavSections: NavSection[] = [
    {
      title: 'Workspace',
      items: [
        { key: 'orders', label: 'Orders', icon: ShoppingBag },
      ]
    }
  ];


  const navSections: NavSection[] = isShopManager 
    ? shopNavSections 
    : fullNavSections;

  const renderContent = (isMobile = false) => (
    <>
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-white/[0.06] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center text-sm font-black text-[#f3aa18] shadow-sm shrink-0 font-mono tracking-tighter">
              EX
            </div>
            <div className="h-9 flex flex-col justify-center min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-wide text-zinc-900 dark:text-white uppercase font-sans">
                  Exacoat
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-white/[0.06] text-[#f3aa18] border border-white/10">
                  ERP
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 block leading-none mt-1 truncate">
                Manager v{APP_VERSION}
              </span>
            </div>
          </div>

          {isMobile && onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
        {navSections.map(section => (
          <div key={section.title} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
              {section.title}
            </h3>

            <div className="space-y-0.5 pt-1">
              {section.items.map(item => {
                const Icon = item.icon;
                const isItemActive = currentTab === item.key;
                const isChildActive = Boolean(item.children && item.children.some(c => c.key === currentTab));
                const isSectionActive = isItemActive || isChildActive;

                return (
                  <div key={item.key} className="space-y-0.5">
                    <button
                      onClick={() => {
                        handleSelect(item.key);
                        if (isMobile) onMobileClose?.();
                      }}
                      className={clsx(
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group relative border cursor-pointer',
                        isSectionActive
                          ? 'bg-white dark:bg-white/[0.08] text-zinc-950 dark:text-white border-zinc-200 dark:border-white/[0.1] shadow-sm font-bold'
                          : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-white/[0.03]'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={clsx(
                          'w-4 h-4 transition-colors shrink-0',
                          isSectionActive ? 'text-lime-600 dark:text-[#f3aa18]' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
                        )} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge !== undefined && (
                        <span className={clsx(
                          'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold shrink-0',
                          item.badgeVariant === 'amber'
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                            : 'bg-zinc-200 dark:bg-white/[0.06] text-zinc-800 dark:text-[#f3aa18] border border-zinc-300 dark:border-white/[0.1]'
                        )}>
                          {item.badge}
                        </span>
                      )}

                      {isSectionActive && (
                        <div className="w-1 h-3.5 rounded-full bg-lime-500 dark:bg-[#f3aa18] absolute left-0 top-1/2 -translate-y-1/2" />
                      )}
                    </button>

                    {/* Sub-menu items for parent containers */}
                    {item.children && isSectionActive && (
                      <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-zinc-200 dark:border-white/[0.06] ml-4 mt-0.5">
                        {item.children.map(child => {
                          const isSubActive = currentTab === child.key;
                          return (
                            <button
                              key={child.key}
                              onClick={() => {
                                handleSelect(child.key);
                                if (isMobile) onMobileClose?.();
                              }}
                              className={clsx(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer',
                                isSubActive
                                  ? 'bg-lime-500/10 text-lime-700 dark:text-[#f3aa18] font-bold'
                                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-200/40 dark:hover:bg-white/[0.02]'
                              )}
                            >
                              <span className="truncate">{child.label}</span>
                              {child.badge !== undefined && (
                                <span className={clsx(
                                  'px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold',
                                  child.badgeVariant === 'lime' 
                                    ? 'bg-lime-500/20 text-lime-700 dark:text-[#f3aa18] border border-lime-500/30'
                                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                                )}>
                                  {child.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User / Bottom Control Section */}
      <div className="p-3 border-t border-zinc-200 dark:border-white/[0.06] space-y-2 shrink-0 bg-[#ebebe5] dark:bg-[#070707]">
        <a
          href="https://exacoat.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.05] text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors shadow-xs"
        >
          <span>Visit exacoat.com</span>
          <ExternalLink className="w-3 h-3 text-zinc-400" />
        </a>

        {/* Role Simulation Switcher (Super Admins Only) */}
        {canSimulateRoles && (
          <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-[#f3aa18]" />
                <span>Simulate Role</span>
              </span>
              {isSimulatingRole && (
                <button
                  type="button"
                  onClick={() => setSimulatedRole(null)}
                  className="text-[10px] font-mono font-bold text-amber-500 hover:text-amber-400 transition-colors cursor-pointer"
                  title="Reset simulation back to Super Admin"
                >
                  Exit
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setSimulatedRole(simulatedRole === 'manager' ? null : 'manager')}
                className={clsx(
                  "px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border active:scale-95",
                  simulatedRole === 'manager'
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold"
                    : "bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-white/[0.06]"
                )}
                title="Preview Studio Manager view"
              >
                <Shield className="w-3 h-3 text-sky-400" />
                <span>Manager</span>
              </button>
              <button
                type="button"
                onClick={() => setSimulatedRole(simulatedRole === 'shop_manager' ? null : 'shop_manager')}
                className={clsx(
                  "px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border active:scale-95",
                  simulatedRole === 'shop_manager'
                    ? "bg-violet-500/20 text-violet-300 border-violet-500/40 font-bold"
                    : "bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-zinc-200 dark:border-white/[0.06]"
                )}
                title="Preview Shop Manager view (Orders only)"
              >
                <ShoppingBag className="w-3 h-3 text-violet-400" />
                <span>Shop</span>
              </button>
            </div>
          </div>
        )}

        {/* User Badge */}
        <div className="p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User'}
                className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-white/10 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-xs font-bold text-zinc-800 dark:text-white shrink-0">
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-900 dark:text-white truncate leading-tight">
                {user?.name || 'Team member'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={clsx(
                  "text-[9px] font-mono px-1 py-0.2 rounded font-bold capitalize",
                  isSimulatingRole
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-[#f3aa18]"
                )}>
                  {isSimulatingRole 
                    ? `Sim: ${user?.role ? user.role.replace('_', ' ') : 'super admin'}`
                    : (user?.role ? user.role.replace('_', ' ') : 'super admin')
                  }
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 1. Desktop Fixed Sidebar (lg+ displays) */}
      <aside className="hidden lg:flex w-64 h-full bg-[#f0f0eb] dark:bg-[#080808] border-r border-zinc-200 dark:border-white/[0.07] flex-col justify-between select-none z-30 shrink-0 font-sans transition-colors duration-200">
        {renderContent(false)}
      </aside>

      {/* 2. Mobile Slide-Over Drawer (< lg displays) */}
      {isRendered && (
        <div className="fixed inset-0 z-50 lg:hidden flex font-sans pointer-events-none">
          {/* Backdrop with smooth blur & opacity transition */}
          <div 
            className={clsx(
              "fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 ease-out pointer-events-auto cursor-pointer",
              isVisible ? "opacity-100" : "opacity-0"
            )}
            onClick={onMobileClose}
          />
          
          {/* Drawer Body sliding smoothly from left with spring curve */}
          <aside 
            style={{
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className={clsx(
              "relative w-72 max-w-[85vw] h-full bg-[#f0f0eb] dark:bg-[#080808] border-r border-zinc-200 dark:border-white/[0.08] flex flex-col justify-between z-10 shadow-2xl overflow-hidden pb-safe pointer-events-auto transform transition-transform duration-300 ease-out",
              isVisible ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
