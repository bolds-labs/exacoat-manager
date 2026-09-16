import React from 'react';
import { clsx } from 'clsx';

export interface CardEyebrowProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
  className?: string;
  as?: 'p' | 'span' | 'h4' | 'div';
}

export const CardEyebrow: React.FC<CardEyebrowProps> = ({
  children,
  className,
  as: Component = 'p',
  ...props
}) => {
  return (
    <Component
      className={clsx(
        'text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
};

export default CardEyebrow;
