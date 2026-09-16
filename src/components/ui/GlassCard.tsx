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
          'glass-panel exacoat-glass rounded-2xl relative transition-[background-color,border-color,box-shadow,transform] duration-200 animate-card-enter',
          !isOverflowSpecified && 'overflow-hidden',
          hoverEffect && 'glass-panel-hover exacoat-glass-hover cursor-pointer',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
