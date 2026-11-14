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

  return (
    <div ref={containerRef} className="relative inline-flex items-stretch font-sans">
      {/* Primary Sync Action */}
      <button
        type="button"
        onClick={() => onSync(syncDays)}
        disabled={isSyncing}
        className={clsx(
          'flex h-9 cursor-pointer select-none items-center gap-2 rounded-l-[9px] bg-accent px-[13px] text-[13px] font-semibold text-accent-on transition-colors hover:brightness-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
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
          'flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-r-[9px] border-l border-accent-border bg-accent px-2.5 text-[13px] font-semibold text-accent-on transition-colors hover:brightness-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
        )}
        title="Pilih rentang hari sinkronisasi"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="font-mono text-[12px] font-semibold">{syncDays} hari</span>
        <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-card-border bg-pop p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <div className="mb-1 flex items-center justify-between border-b border-line px-2.5 py-1.5 text-[12px] font-medium text-faint">
            <span>Rentang Waktu</span>
            <span className="rounded-[6px] bg-st-done-bg px-1.5 py-px text-[11px] font-medium text-st-done-fg">
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
                    'flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-fg transition-colors hover:bg-chip',
                    isSelected && 'bg-chip'
                  )}
                >
                  <div>
                    <div className="font-medium">{opt.label}</div>
                    {opt.desc && (
                      <div className="mt-0.5 text-[12px] text-faint">
                        {opt.desc}
                      </div>
                    )}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-accent-fg" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
