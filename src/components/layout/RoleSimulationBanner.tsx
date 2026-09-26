import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ExacoatRole } from '../../types';
import { 
  Eye, 
  Shield, 
  ShoppingBag, 
  X,
  Crown,
  Share2
} from 'lucide-react';
import { clsx } from 'clsx';

export const RoleSimulationBanner: React.FC = () => {
  const { user, simulatedRole, setSimulatedRole, isSimulatingRole } = useAuth();

  if (!isSimulatingRole || !simulatedRole) {
    return null;
  }

  const roleMeta: Record<ExacoatRole, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; accentColor: string }> = {
    super_admin: {
      title: 'Super Admin',
      subtitle: 'Full System Control',
      icon: Crown,
      accentColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    },
    manager: {
      title: 'Operations Manager',
      subtitle: 'Catalog, Inventory, Fulfillment & Orders',
      icon: Shield,
      accentColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20'
    },
    shop_manager: {
      title: 'Shop Manager',
      subtitle: 'Customer Orders & Shipping Fulfillment Only',
      icon: ShoppingBag,
      accentColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20'
    },
    affiliate: {
      title: 'Affiliate Partner',
      subtitle: 'Referral Links, Traffic & Commissions',
      icon: Share2,
      accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    }
  };

  const currentMeta = roleMeta[simulatedRole] || roleMeta.manager;
  const RoleIcon = currentMeta.icon;

  return (
    <div 
      role="region" 
      aria-label="Role Simulation Active Banner"
      className="bg-zinc-900 border-b border-white/[0.12] text-white px-4 py-2.5 z-40 transition-all shadow-md select-none shrink-0"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Role Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", currentMeta.accentColor)}>
            <RoleIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                Simulation Active
              </span>
              <span className="text-xs font-bold text-white truncate">
                {currentMeta.title}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate hidden sm:block">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Quick Switcher & Exit */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setSimulatedRole('manager')}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                simulatedRole === 'manager'
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Operations Manager</span>
            </button>
            <button
              type="button"
              onClick={() => setSimulatedRole('shop_manager')}
              className={clsx(
                "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer",
                simulatedRole === 'shop_manager'
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Shop Manager</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSimulatedRole(null)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
            title="Exit simulation and return to Super Admin"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit Simulation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
