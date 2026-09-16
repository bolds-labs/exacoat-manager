import React from 'react';
import { clsx } from 'clsx';

interface ModalCardProps {
  title?: React.ReactNode;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const ModalCard: React.FC<ModalCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  badge,
  headerAction,
  children,
  className,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-white/[0.025] border border-zinc-200 dark:border-white/[0.07] space-y-4 hover:border-zinc-300 dark:hover:border-white/[0.12] transition-all font-sans text-zinc-900 dark:text-zinc-100',
        onClick && 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/[0.045]',
        className
      )}
    >
      {(title || Icon || badge || headerAction) && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-[#f3aa18]" />}
            <div>
              {typeof title === 'string' ? (
                <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 font-sans">{title}</h4>
              ) : (
                title
              )}
              {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans mt-0.5 leading-relaxed">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {badge}
            {headerAction}
          </div>
        </div>
      )}

      <div>{children}</div>
    </div>
  );
};
