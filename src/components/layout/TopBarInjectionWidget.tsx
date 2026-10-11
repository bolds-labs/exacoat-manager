import React from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useMarketplaceInjection } from '../../context/MarketplaceInjectionContext';

export const TopBarInjectionWidget: React.FC = () => {
  const { activeJob, dismissJob, openInjectorModal } = useMarketplaceInjection();

  if (!activeJob) return null;

  const isRunning = activeJob.status === 'running';
  const isCompleted = activeJob.status === 'completed';
  const isFailed = activeJob.status === 'failed';

  const handleClickWidget = () => {
    openInjectorModal({
      item: activeJob.shopeeItem,
      tiktokItem: activeJob.tiktokItem,
      channel: activeJob.channel,
    });
  };

  return (
    <>
      {/* Ultra-thin top edge animated progress line */}
      {isRunning && (
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-zinc-800/40 overflow-hidden z-50 pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-[#f3aa18] to-yellow-300 shadow-[0_0_10px_rgba(243,170,24,0.9)] transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, activeJob.percent)}%` }}
          />
        </div>
      )}

      {/* Top Bar Status Capsule */}
      <div className="flex items-center gap-1.5 shrink-0 animate-fadeIn">
        {isRunning && (
          <button
            type="button"
            onClick={handleClickWidget}
            className="relative overflow-hidden h-9 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/35 hover:border-amber-500/50 text-amber-200 text-xs font-medium flex items-center gap-2 transition-all cursor-pointer shadow-xs max-w-[280px] sm:max-w-[380px]"
            title={`${activeJob.stage}: ${activeJob.details} (Click to open)`}
          >
            {/* Background progress fill */}
            <div
              className="absolute inset-y-0 left-0 bg-amber-500/15 pointer-events-none transition-all duration-300 ease-out"
              style={{ width: `${activeJob.percent}%` }}
            />

            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#f3aa18] shrink-0 relative z-10" />

            <div className="flex items-center gap-1.5 min-w-0 relative z-10">
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#f3aa18]/25 text-[#f3aa18] border border-[#f3aa18]/30 shrink-0">
                {activeJob.channelLabel}
              </span>
              <span className="truncate font-semibold text-zinc-100 text-[11px]">
                {activeJob.itemTitle}
              </span>
              <span className="text-[11px] font-mono text-amber-300 shrink-0 font-bold">
                {activeJob.percent}%
              </span>
            </div>
          </button>
        )}

        {isCompleted && (
          <div className="h-9 px-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2 shadow-xs max-w-[320px] sm:max-w-[420px] animate-fadeIn">
            <button
              type="button"
              onClick={handleClickWidget}
              className="flex items-center gap-1.5 min-w-0 hover:text-emerald-100 transition cursor-pointer text-left"
              title="Click to view injection summary"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate text-[11px] font-medium text-emerald-200">
                <strong className="font-bold">{activeJob.channelLabel}</strong> Injected:{' '}
                {activeJob.itemTitle}
              </span>
            </button>

            {activeJob.result?.seller_centre_url && (
              <a
                href={activeJob.result.seller_centre_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-100 transition shrink-0"
                title="View listing in Seller Centre"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            <button
              type="button"
              onClick={() => dismissJob(activeJob.id)}
              className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400/80 hover:text-emerald-200 transition shrink-0 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {isFailed && (
          <div className="h-9 px-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2 shadow-xs max-w-[320px] sm:max-w-[420px] animate-fadeIn">
            <button
              type="button"
              onClick={handleClickWidget}
              className="flex items-center gap-1.5 min-w-0 hover:text-rose-100 transition cursor-pointer text-left"
              title="Click to inspect failure and retry"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate text-[11px] font-medium text-rose-200">
                <strong className="font-bold">{activeJob.channelLabel} Failed:</strong>{' '}
                {activeJob.error || 'Injection error'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => dismissJob(activeJob.id)}
              className="p-1 rounded hover:bg-rose-500/20 text-rose-400/80 hover:text-rose-200 transition shrink-0 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
