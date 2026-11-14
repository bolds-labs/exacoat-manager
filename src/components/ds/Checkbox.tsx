import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={`inline-flex cursor-pointer items-center gap-2.5 text-[13.5px] text-fg ${className}`}>
      <span className="relative inline-flex h-4 w-4 flex-none">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-faint bg-transparent checked:border-accent checked:bg-accent focus-visible:ring-2 focus-visible:ring-accent"
          {...rest}
        />
        <Check className="pointer-events-none absolute inset-0 hidden h-4 w-4 p-0.5 text-accent-on peer-checked:block" strokeWidth={3} aria-hidden />
      </span>
      {label}
    </label>
  );
});
