import { forwardRef, type ButtonHTMLAttributes } from 'react';

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> {
  checked: boolean;
  onCheckedChange(v: boolean): void;
  label?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, label, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-md text-[13px] text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      {...rest}
    >
      <span
        className={`relative h-[18px] w-[30px] flex-none rounded-full border transition-colors ${
          checked ? 'border-transparent bg-accent' : 'border-field-border bg-chip'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${
            checked ? 'left-3.5 bg-[#111]' : 'left-0.5 bg-faint'
          }`}
        />
      </span>
      {label}
    </button>
  );
});
