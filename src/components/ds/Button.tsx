import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ControlSize = 'md' | 'sm';

export const buttonSizeClass: Record<ControlSize, string> = {
  md: 'h-9 px-[13px] text-[13px] rounded-[9px]',
  sm: 'h-[30px] px-2.5 text-[12.5px] rounded-[8px]',
};

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-[#111] border-transparent font-semibold',
  secondary: 'bg-field text-fg border-field-border font-[450]',
  ghost: 'bg-transparent text-fg border-transparent font-[450]',
  danger: 'text-st-stop-fg bg-st-stop-bg border-st-stop-fg/30 font-[450]',
};

export const buttonBaseClass =
  'inline-flex items-center justify-center gap-2 border whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, trailingIcon: TrailingIcon, className = '', children, type = 'button', ...rest },
  ref,
) {
  const iconColor = variant === 'primary' ? 'text-[#111]' : variant === 'danger' ? 'text-st-stop-fg' : 'text-muted';
  return (
    <button
      ref={ref}
      type={type}
      className={`${buttonBaseClass} ${buttonSizeClass[size]} ${buttonVariantClass[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon className={`h-[15px] w-[15px] ${iconColor}`} strokeWidth={1.8} aria-hidden />}
      {children}
      {TrailingIcon && <TrailingIcon className={`h-[15px] w-[15px] ${iconColor}`} strokeWidth={1.8} aria-hidden />}
    </button>
  );
});
