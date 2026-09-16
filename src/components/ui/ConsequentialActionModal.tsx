import React, { useState } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  ArrowRight, 
  Clock, 
  Calendar,
  Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './dialog';
import { clsx } from 'clsx';

export interface ConsequentialBulletPoint {
  text: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}

export interface ConsequentialActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description?: string;
  targetName?: string;
  targetBadge?: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  bulletPoints?: ConsequentialBulletPoint[];
  progressionSteps?: string[];
  currentStepIndex?: number;
  scheduledDateLabel?: string;
  scheduledDateValue?: string;
  additionalContent?: React.ReactNode;
  isLoading?: boolean;
}

export const ConsequentialActionModal: React.FC<ConsequentialActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetName,
  targetBadge,
  variant = 'warning',
  confirmText = 'Confirm Action',
  cancelText = 'Cancel',
  bulletPoints = [],
  progressionSteps = [],
  currentStepIndex = 1,
  scheduledDateLabel,
  scheduledDateValue,
  additionalContent,
  isLoading = false,
}) => {
  const [internalLoading, setInternalLoading] = useState(false);

  const handleConfirmClick = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  const isBusy = isLoading || internalLoading;

  const headerIcons = {
    danger: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-[#f3aa18] shrink-0" />,
  };

  const headerIconBg = {
    danger: 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-sm shadow-rose-500/10',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-sm shadow-amber-500/10',
    info: 'bg-[#f3aa18]/10 border-[#f3aa18]/20 text-[#f3aa18] shadow-sm shadow-[#f3aa18]/10',
  };

  const confirmBtnStyles = {
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-950/40',
    warning: 'bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold shadow-md shadow-amber-500/20',
    info: 'bg-[#f3aa18] hover:bg-[#f5b838] text-zinc-950 font-bold shadow-md shadow-[#f3aa18]/20',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isBusy) onClose(); }}>
      <DialogContent className="max-w-md bg-[#0a0c10]/95 border border-white/[0.08] p-5 sm:p-6 space-y-4 rounded-3xl backdrop-blur-2xl shadow-2xl text-white overflow-hidden font-sans select-none">
        {/* Header */}
        <DialogHeader className="space-y-0">
          <div className="flex items-start gap-3">
            <div className={clsx("p-2.5 rounded-xl border flex items-center justify-center shrink-0 mt-0.5", headerIconBg[variant])}>
              {headerIcons[variant]}
            </div>

            <div className="space-y-0.5 text-left flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight">
                  {title}
                </DialogTitle>
                {targetBadge && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-white/[0.06] text-zinc-400 border border-white/10 shrink-0">
                    {targetBadge.toLowerCase()}
                  </span>
                )}
              </div>

              {targetName && (
                <p className="text-xs text-zinc-400 truncate">
                  Item: <span className="text-zinc-200 font-semibold">{targetName}</span>
                </p>
              )}

              {description && (
                <DialogDescription className="text-xs text-zinc-400 leading-relaxed pt-1">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Minimal Inline Progression Transition */}
        {progressionSteps.length > 0 && (
          <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            {progressionSteps.map((step, idx) => {
              const isPassed = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <React.Fragment key={step}>
                  {idx > 0 && <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                  <div
                    className={clsx(
                      "flex-1 px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all min-w-0 truncate",
                      isCurrent 
                        ? variant === 'danger'
                          ? "bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold"
                          : "bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold"
                        : isPassed
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-zinc-500"
                    )}
                  >
                    {isPassed && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                    <span className="truncate">{step}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Bulleted Points */}
        {bulletPoints.length > 0 && (
          <div className="py-1">
            <ul className="space-y-2 text-xs">
              {bulletPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-zinc-400 leading-relaxed">
                  <span className="shrink-0 mt-0.5 text-zinc-400">
                    {point.icon || <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 inline-block mt-1.5" />}
                  </span>
                  <span className={clsx("text-xs", point.highlight ? "text-zinc-200 font-medium" : "text-zinc-400")}>
                    {point.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Scheduled Date Banner */}
        {scheduledDateLabel && scheduledDateValue && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-amber-300">
              <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{scheduledDateLabel}</span>
            </div>
            <strong className="text-white font-bold">{scheduledDateValue}</strong>
          </div>
        )}

        {additionalContent}

        <DialogFooter className="pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isBusy}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer',
              confirmBtnStyles[variant]
            )}
          >
            {isBusy ? 'Processing...' : confirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
