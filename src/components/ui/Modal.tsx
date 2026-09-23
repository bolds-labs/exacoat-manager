import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { lockBodyScroll } from '../../lib/bodyScrollLock';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  className?: string;
  zIndex?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerActions,
  footer,
  children,
  maxWidth = 'lg',
  className,
  zIndex = 'z-50',
}) => {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 16);
      return () => clearTimeout(timer);
    } else if (isMounted) {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMounted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      const unlock = lockBodyScroll();
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        unlock();
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isMounted || typeof document === 'undefined') return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-[95vw]',
  };

  const modalContent = (
    <div
      className={clsx("fixed inset-0 flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto font-sans", zIndex)}
      onClick={onClose}
    >
      {/* Pure Monochrome Dark Backdrop with Blur & Transition */}
      <div
        className={clsx(
          "fixed inset-0 bg-black/80 backdrop-blur-xl transition-opacity duration-280 ease-out cursor-pointer",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Exacoat Glass Modal Dialog with Smooth Scale/Fade Transition */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={clsx(
          'relative w-full rounded-3xl glass-panel border border-zinc-200 dark:border-white/15 bg-white/95 dark:bg-[#0d0f12]/95 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.75)] z-10 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] transition-all duration-280 transform overscroll-contain cursor-default',
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3',
          maxWidthStyles[maxWidth],
          className
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header with Standardized Responsive Spacing & Subtle Glass Tint */}
        {(title || subtitle || headerActions) && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-200 dark:border-white/[0.08] bg-zinc-50/70 dark:bg-white/[0.02] shrink-0">
            <div className="flex-1 min-w-0 pr-3 sm:pr-6 space-y-1">
              {typeof title === 'string' ? (
                <h3 className="text-base sm:text-lg font-semibold text-zinc-950 dark:text-white font-sans tracking-tight leading-snug truncate sm:whitespace-normal">{title}</h3>
              ) : (
                title
              )}
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-neutral-400 font-sans leading-normal line-clamp-1 sm:line-clamp-none">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {headerActions}
              <button
                onClick={onClose}
                className="p-2 sm:p-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.08] border border-transparent hover:border-white/[0.1] transition-all cursor-pointer"
                title="Close modal"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Body with Standard Responsive Spacing */}
        <div className="record-detail p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 min-h-0 font-sans text-zinc-700 dark:text-zinc-200 bg-transparent custom-scrollbar">{children}</div>

        {/* Modal Footer with Standard Responsive Spacing */}
        {footer && (
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-zinc-200 dark:border-white/[0.08] bg-zinc-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
