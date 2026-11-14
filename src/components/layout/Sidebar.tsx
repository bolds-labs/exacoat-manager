import React from 'react';
import { LogOut, Shield, ShoppingBag, Eye, ExternalLink, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';
import { APP_VERSION } from '../../config/version';
import { lockBodyScroll } from '../../lib/bodyScrollLock';
import { ExacoatLogo } from '../ui/ExacoatLogo';
import { CountPill } from '../ds/CountPill';
import { getTabHref, navForRole, type NavItemKey } from './sidebarNav';

export type { NavItemKey };
export { getTabHref };

export interface SidebarProps {
  currentTab: string;
  onTabChange?: (tab: any) => void;
  onSelectTab?: (tab: any) => void;
  pendingReviewCount?: number;
  counts?: Partial<Record<NavItemKey, number>>;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const isPlainClick = (e: React.MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onSelectTab,
  pendingReviewCount = 0,
  counts,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const { user, logout, simulatedRole, setSimulatedRole, canSimulateRoles, isSimulatingRole } = useAuth();
  const handleSelect = onTabChange || onSelectTab || (() => {});

  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));

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
    }
    setIsVisible(false);
    const timer = setTimeout(() => setIsRendered(false), 300);
    return () => clearTimeout(timer);
  }, [isMobileOpen]);

  const effectiveRole = simulatedRole || user?.role || 'super_admin';
  const groups = navForRole(effectiveRole);

  const countFor = (key: NavItemKey): number | undefined => {
    const fromProp = counts?.[key];
    if (fromProp !== undefined) return fromProp;
    if (key === 'reviews' && pendingReviewCount > 0) return pendingReviewCount;
    return undefined;
  };

  const roleLabel = user?.role ? user.role.replace('_', ' ') : 'super admin';

  const renderContent = (isMobile = false) => (
    <>
      <div className="flex shrink-0 items-center justify-between px-[14px] pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <ExacoatLogo variant="current" width={112} height={20} className="h-4 w-auto shrink-0 text-fg" />
          <span className="shrink-0 rounded-md border border-accent-border bg-accent-soft px-1.5 py-px font-mono text-[10px] font-semibold text-accent-fg">
            ERP
          </span>
        </div>
        {isMobile && onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="cursor-pointer rounded-lg p-1.5 text-muted hover:bg-chip hover:text-fg"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav aria-label="Main navigation" className="custom-scrollbar flex-1 overflow-y-auto px-3 pb-3">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="px-2.5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isItemActive = currentTab === item.key;
                const isChildActive = Boolean(item.children?.some((c) => c.key === currentTab));
                const isSectionActive = isItemActive || isChildActive;
                const isExpanded = openSections[item.key] ?? isSectionActive;
                const count = countFor(item.key);

                return (
                  <div key={item.key}>
                    <a
                      href={getTabHref(item.key)}
                      aria-current={isSectionActive ? 'page' : undefined}
                      onClick={(e) => {
                        if (!isPlainClick(e)) return;
                        e.preventDefault();
                        handleSelect(item.key);
                        if (item.children) setOpenSections((prev) => ({ ...prev, [item.key]: true }));
                        else if (isMobile) onMobileClose?.();
                      }}
                      className={clsx(
                        'relative flex cursor-pointer select-none items-center gap-[11px] rounded-[9px] px-2.5 py-2 text-[13.5px] font-medium no-underline transition-colors',
                        isSectionActive ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-chip hover:text-fg',
                      )}
                    >
                      {isSectionActive && (
                        <span aria-hidden className="absolute -left-3 top-1/2 h-[14px] w-1 -translate-y-1/2 rounded-full bg-accent" />
                      )}
                      <Icon className={clsx('h-[17px] w-[17px] shrink-0', isSectionActive ? 'text-accent' : 'text-faint')} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {count !== undefined && <CountPill value={count} tone={isSectionActive ? 'hot' : 'neutral'} />}
                      {item.children && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Toggle ${item.label} sub-menu`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSection(item.key);
                          }}
                          onAuxClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleSection(item.key);
                            }
                          }}
                          className="inline-flex cursor-pointer items-center justify-center rounded p-0.5 hover:bg-chip"
                        >
                          <ChevronDown className={clsx('h-3.5 w-3.5 text-faint transition-transform duration-200', isExpanded && 'rotate-180')} />
                        </span>
                      )}
                    </a>

                    {item.children && isExpanded && (
                      <div className="ml-[19px] mt-0.5 space-y-0.5 border-l border-line pl-3">
                        {item.children.map((child) => {
                          const isSubActive = currentTab === child.key;
                          return (
                            <a
                              key={child.key}
                              href={getTabHref(child.key)}
                              aria-current={isSubActive ? 'page' : undefined}
                              onClick={(e) => {
                                if (!isPlainClick(e)) return;
                                e.preventDefault();
                                handleSelect(child.key);
                                if (isMobile) onMobileClose?.();
                              }}
                              className={clsx(
                                'block cursor-pointer select-none truncate rounded-lg px-2.5 py-1.5 text-[13px] no-underline transition-colors',
                                isSubActive ? 'bg-chip font-medium text-fg' : 'text-muted hover:bg-chip hover:text-fg',
                              )}
                            >
                              {child.label}
                            </a>
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
      </nav>

      <div className="shrink-0 space-y-2 border-t border-line p-3">
        <a
          href="https://exacoat.com"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-[9px] border border-card-border bg-card px-3 py-2 text-[12.5px] text-muted no-underline transition-colors hover:text-fg"
        >
          <span>Visit exacoat.com</span>
          <ExternalLink className="h-3 w-3 text-faint" />
        </a>

        {canSimulateRoles && (
          <div className="space-y-2 rounded-[9px] border border-card-border bg-card p-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
                <Eye className="h-3 w-3 text-accent" />
                <span>Simulate Role</span>
              </span>
              {isSimulatingRole && (
                <button
                  type="button"
                  onClick={() => setSimulatedRole(null)}
                  className="cursor-pointer text-[11px] font-semibold text-accent-fg hover:underline"
                  title="Reset simulation back to Super Admin"
                >
                  Exit
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { role: 'manager', label: 'Manager', icon: Shield, title: 'Preview Studio Manager view' },
                { role: 'shop_manager', label: 'Shop', icon: ShoppingBag, title: 'Preview Shop Manager view (Orders only)' },
              ] as const).map(({ role, label, icon: RoleIcon, title }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSimulatedRole(simulatedRole === role ? null : role)}
                  title={title}
                  className={clsx(
                    'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors',
                    simulatedRole === role
                      ? 'border-accent-border bg-accent-soft text-accent-fg'
                      : 'border-field-border bg-field text-muted hover:text-fg',
                  )}
                >
                  <RoleIcon className="h-3 w-3" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-[9px] border border-card-border bg-card p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name || 'User'} className="h-8 w-8 shrink-0 rounded-full border border-line object-cover" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-fg">
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight text-fg">{user?.name || 'Team member'}</p>
              <p className="mt-0.5 truncate text-[11.5px] capitalize text-faint">
                {isSimulatingRole ? `Sim: ${roleLabel}` : roleLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="shrink-0 cursor-pointer rounded-lg p-1.5 text-faint transition-colors hover:bg-chip hover:text-st-stop-fg"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <p className="px-1 font-mono text-[10px] text-faint">Manager v{APP_VERSION}</p>
      </div>
    </>
  );

  return (
    <>
      <aside className="z-30 hidden h-full w-[248px] shrink-0 select-none flex-col border-r border-line bg-panel font-sans lg:flex">
        {renderContent(false)}
      </aside>

      {isRendered && (
        <div className="pointer-events-none fixed inset-0 z-50 flex font-sans lg:hidden">
          <div
            className={clsx(
              'pointer-events-auto fixed inset-0 cursor-pointer bg-black transition-opacity duration-300 ease-out',
              isVisible ? 'opacity-70' : 'opacity-0',
            )}
            onClick={onMobileClose}
          />
          <aside
            className={clsx(
              'pb-safe pointer-events-auto relative z-10 flex h-full w-72 max-w-[85vw] transform flex-col overflow-hidden border-r border-line bg-panel shadow-2xl transition-transform duration-300 ease-out',
              isVisible ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
