import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hoverEffect = false,
  ...props
}) => {
  const isOverflowSpecified = className.includes('overflow-');

  return (
    <div
      className={twMerge(
        clsx(
          'rounded-[14px] border border-card-border bg-card text-fg relative transition-colors duration-150',
          !isOverflowSpecified && 'overflow-hidden',
          hoverEffect && 'cursor-pointer hover:bg-chip',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
