import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

export interface SyncRangeOption {
  days: number;
  label: string;
  desc?: string;
}

interface MarketplaceSyncButtonProps {
  isSyncing: boolean;
  onSync: (days: number) => void;
  syncDays: number;
  onSyncDaysChange: (days: number) => void;
  brand: 'shopee' | 'tiktok';
  options?: SyncRangeOption[];
}

const DEFAULT_OPTIONS: SyncRangeOption[] = [
  { days: 15, label: '15 hari', desc: 'Sinkronisasi cepat' },
  { days: 30, label: '30 hari', desc: 'Standar operasional' },
  { days: 60, label: '60 hari', desc: 'Riwayat 2 bulan' },
  { days: 90, label: '90 hari', desc: 'Riwayat maksimal' },
];

export const MarketplaceSyncButton: React.FC<MarketplaceSyncButtonProps> = ({
  isSyncing,
  onSync,
  syncDays,
  onSyncDaysChange,
  brand,
  options = DEFAULT_OPTIONS,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isShopee = brand === 'shopee';

  const brandStyles = isShopee
    ? {
        container: 'shadow-orange-500/15 ring-orange-500/30',
        mainBtn: 'bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white',
        splitBorder: 'border-orange-400/30',
        toggleBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
        activeOption: 'text-orange-400 bg-orange-500/15 font-semibold',
        checkIcon: 'text-orange-400',
        badge: 'bg-orange-500/20 text-orange-200 border-orange-500/30',
      }
    : {
        container: 'shadow-rose-500/15 ring-rose-500/30',
        mainBtn: 'bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white',
        splitBorder: 'border-rose-400/30',
        toggleBtn: 'bg-pink-600 hover:bg-pink-700 text-white',
        activeOption: 'text-rose-400 bg-rose-500/15 font-semibold',
        checkIcon: 'text-rose-400',
        badge: 'bg-rose-500/20 text-rose-200 border-rose-500/30',
      };

  return (
    <div ref={containerRef} className="relative inline-flex items-stretch rounded-xl shadow-lg font-sans">
      {/* Primary Sync Action */}
      <button
        type="button"
        onClick={() => onSync(syncDays)}
        disabled={isSyncing}
        className={clsx(
          'px-4 py-2 text-xs font-bold flex items-center gap-2 rounded-l-xl transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99] select-none shadow-sm',
          brandStyles.mainBtn
        )}
      >
        <RefreshCw className={clsx('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
        <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Pesanan'}</span>
      </button>

      {/* Days Range Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSyncing}
        className={clsx(
          'px-3 py-2 text-xs font-semibold flex items-center gap-1.5 rounded-r-xl border-l transition-all cursor-pointer disabled:opacity-50 select-none shadow-sm',
          brandStyles.splitBorder,
          brandStyles.toggleBtn
        )}
        title="Pilih rentang hari sinkronisasi"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="font-mono text-[11px] font-bold">{syncDays} hari</span>
        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-neutral-900 border border-white/10 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400 border-b border-white/10 mb-1 flex items-center justify-between">
            <span>Rentang Waktu</span>
            <span className={clsx('text-[10px] px-1.5 py-0.2 rounded border font-mono', brandStyles.badge)}>
              API Live
            </span>
          </div>
          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.days === syncDays;
              return (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => {
                    onSyncDaysChange(opt.days);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-colors cursor-pointer',
                    isSelected ? brandStyles.activeOption : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <div>
                    <div className="font-bold text-xs">{opt.label}</div>
                    {opt.desc && (
                      <div className="text-[10px] text-neutral-400 font-normal mt-0.5">
                        {opt.desc}
                      </div>
                    )}
                  </div>
                  {isSelected && <Check className={clsx('w-3.5 h-3.5 shrink-0', brandStyles.checkIcon)} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
