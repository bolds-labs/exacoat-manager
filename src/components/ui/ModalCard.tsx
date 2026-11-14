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
        'p-4 sm:p-5 rounded-[14px] bg-card border border-card-border space-y-4 transition-colors font-sans text-fg',
        onClick && 'cursor-pointer hover:bg-chip',
        className
      )}
    >
      {(title || Icon || badge || headerAction) && (
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-[15px] h-[15px] text-faint" />}
            <div>
              {typeof title === 'string' ? (
                <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-fg font-sans">{title}</h4>
              ) : (
                title
              )}
              {subtitle && <p className="text-xs text-faint font-sans mt-0.5 leading-relaxed">{subtitle}</p>}
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
