import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { controlClass, fieldLabelClass } from './TextField';

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange(v: string): void;
  tag?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, value, options, onChange, tag, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className}>
      {label && <label htmlFor={selectId} className={fieldLabelClass}>{label}</label>}
      <div className={`${controlClass} relative`}>
        <select
          ref={ref}
          id={selectId}
          data-ds=""
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 outline-none"
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {tag && (
          <span className="rounded-md bg-chip px-[7px] py-px text-[12px] text-muted">{tag}</span>
        )}
        <ChevronDown className="pointer-events-none absolute right-3 h-[15px] w-[15px] text-faint" aria-hidden />
      </div>
    </div>
  );
});
