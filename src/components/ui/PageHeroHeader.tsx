import React from 'react';
import { clsx } from 'clsx';

interface PageHeroHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const PageHeroHeader: React.FC<PageHeroHeaderProps> = ({
  title,
  subtitle,
  action,
  icon,
  className,
}) => {
  return (
    <div className={clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2', className)}>
      <div className="flex items-start gap-3.5">
        {icon && (
          <div className="p-2.5 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20 shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-chakra">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-zinc-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {action}
        </div>
      )}
    </div>
  );
};
