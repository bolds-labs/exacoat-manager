import React from 'react';
import { clsx } from 'clsx';

export interface PageHeroHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: {
    label: string;
    variant?: 'default' | 'lime' | 'amber' | 'cyan' | 'purple';
  };
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}

export const PageHeroHeader: React.FC<PageHeroHeaderProps> = ({
  title,
  subtitle,
  icon,
  badge,
  actions,
  className,
  titleClassName,
}) => {
  const getBadgeStyle = (variant: string = 'default') => {
    switch (variant) {
      case 'lime':
        return 'bg-accent-soft text-accent-fg border-accent-border';
      case 'amber':
        return 'bg-st-act-bg text-st-act-fg border-st-act-border';
      case 'cyan':
        return 'bg-st-prog-bg text-st-prog-fg border-st-prog-border';
      case 'purple':
        return 'bg-st-wait-bg text-st-wait-fg border-st-wait-border';
      default:
        return 'bg-chip text-muted border-card-border';
    }
  };

  return (
    <section className={clsx("flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-1", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className={clsx(
            "text-[26px] font-semibold text-fg tracking-[-0.02em] font-heading flex flex-wrap items-center gap-2.5 leading-tight",
            titleClassName
          )}>
            {title}
            {badge && (
              <span className={clsx(
                "inline-flex h-5 shrink-0 items-center whitespace-nowrap px-2 rounded-full text-[10px] leading-none font-medium border",
                getBadgeStyle(badge.variant)
              )}>
                {badge.label}
              </span>
            )}
          </h1>
        </div>
        {subtitle && (
          <p className="text-sm text-muted font-sans mt-1.5 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </section>
  );
};
