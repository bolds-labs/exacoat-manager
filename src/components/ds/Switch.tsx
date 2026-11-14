import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface SwitchBaseProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'aria-label'> {
  checked: boolean;
  onCheckedChange(v: boolean): void;
}

/** A switch needs an accessible name: a visible `label`, or `aria-label` when there is none. */
export type SwitchProps = SwitchBaseProps &
  ({ label: string; 'aria-label'?: string } | { label?: undefined; 'aria-label': string });

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
      {...rest}
      onClick={() => onCheckedChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-md text-[13px] text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      <span
        className={`relative h-[18px] w-[30px] flex-none rounded-full border transition-colors ${
          checked ? 'border-transparent bg-accent' : 'border-field-border bg-chip'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${
            checked ? 'left-3.5 bg-accent-on' : 'left-0.5 bg-faint'
          }`}
        />
      </span>
      {label}
    </button>
  );
});
