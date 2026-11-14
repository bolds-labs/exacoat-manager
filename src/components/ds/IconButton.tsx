import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { buttonBaseClass, buttonVariantClass, type ControlSize } from './Button';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  size?: ControlSize;
  variant?: 'secondary' | 'ghost';
}

const sizeClass: Record<ControlSize, string> = {
  md: 'h-9 w-9 rounded-[9px]',
  sm: 'h-[30px] w-[30px] rounded-[8px]',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = 'md', variant = 'secondary', className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`${buttonBaseClass} p-0 ${sizeClass[size]} ${buttonVariantClass[variant]} ${className}`}
      {...rest}
    >
      <Icon className="h-[15px] w-[15px] text-muted" strokeWidth={1.8} aria-hidden />
    </button>
  );
});
