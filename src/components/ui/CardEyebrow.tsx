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
        'text-[12px] font-sans text-faint truncate',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
};

export default CardEyebrow;
