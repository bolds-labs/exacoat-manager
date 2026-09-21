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
        return 'bg-[#f3aa18]/10 text-[#f3aa18] border-[#f3aa18]/30';
      case 'amber':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'cyan':
        return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
      case 'purple':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <section className={clsx("flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-1", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className={clsx(
            "text-xl sm:text-2xl font-semibold text-zinc-950 dark:text-white tracking-tight font-sans flex flex-wrap items-center gap-2.5 leading-tight",
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-sans mt-1.5 max-w-3xl leading-relaxed">
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
