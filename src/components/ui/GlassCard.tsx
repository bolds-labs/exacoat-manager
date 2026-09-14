import React from 'react';
import { clsx } from 'clsx';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  hoverEffect = false,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'bg-[#0d0d11] border border-white/[0.08] rounded-2xl p-5 relative overflow-hidden',
        hoverEffect && 'transition-all duration-200 hover:border-white/[0.16] hover:bg-[#121217]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
