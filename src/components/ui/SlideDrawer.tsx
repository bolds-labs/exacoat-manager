import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { lockBodyScroll } from '../../lib/bodyScrollLock';

interface SlideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

export const SlideDrawer: React.FC<SlideDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerActions,
  children,
  width = '2xl',
  className,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Small timeout to trigger CSS transition on mount
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
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isRendered || typeof document === 'undefined') return null;

  const widthStyles: Record<string, string> = {
    md: 'w-full sm:w-[480px] max-w-[calc(100vw-1rem)]',
    lg: 'w-full sm:w-[580px] max-w-[calc(100vw-1rem)]',
    xl: 'w-full sm:w-[680px] max-w-[calc(100vw-1rem)]',
    '2xl': 'w-full sm:w-[760px] max-w-[calc(100vw-1rem)]',
    '3xl': 'w-full sm:w-[880px] max-w-[calc(100vw-1rem)]',
  };

  const drawerElement = (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans pointer-events-none">
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out pointer-events-auto',
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex justify-end pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : 'Details'}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className={clsx(
            'pointer-events-auto h-full max-h-screen bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100 border-l border-zinc-200 dark:border-white/[0.08] shadow-[-25px_0_60px_rgba(0,0,0,0.65)] flex flex-col transform transition-transform duration-300 ease-out',
            isVisible ? 'translate-x-0' : 'translate-x-full',
            widthStyles[width] || widthStyles['2xl'],
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-200 dark:border-white/[0.08] bg-zinc-50/90 dark:bg-[#0f0f0f]/80 backdrop-blur-xl shrink-0 gap-3">
            <div className="flex-1 min-w-0 pr-2 sm:pr-4">
              {typeof title === 'string' ? (
                <h3 className="text-base sm:text-lg font-semibold text-zinc-950 dark:text-white leading-tight font-sans tracking-tight truncate">{title}</h3>
              ) : (
                title
              )}
              {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">{subtitle}</p>}
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {headerActions}
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors border border-transparent hover:border-white/[0.08] cursor-pointer"
                title="Close details"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="record-detail flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 scrollbar-thin scrollbar-thumb-zinc-800">{children}</div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerElement, document.body);
};
