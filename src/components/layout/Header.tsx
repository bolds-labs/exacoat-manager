import React from 'react';
import { Search, RefreshCw, Radio } from 'lucide-react';
import { Button } from '../ui/Button';

interface HeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  globalSearch?: string;
  onSearchChange?: (term: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isRefreshing = false,
  globalSearch = '',
  onSearchChange,
}) => {
  return (
    <header className="h-16 border-b border-white/[0.08] bg-[#000000]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search orders, tracking, or customers..."
            value={globalSearch}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            className="w-full bg-[#0d0d11] border border-white/[0.08] text-sm text-zinc-200 placeholder-zinc-500 pl-10 pr-4 py-2 rounded-full focus:border-[#f3aa18] min-h-[44px] transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>WooCommerce REST Connected</span>
        </div>

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            isLoading={isRefreshing}
            className="gap-1.5 text-xs text-zinc-300"
          >
            <RefreshCw className={isRefreshing ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />
            <span>Sync</span>
          </Button>
        )}
      </div>
    </header>
  );
};
