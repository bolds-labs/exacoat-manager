import { forwardRef, useId, type ButtonHTMLAttributes } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { controlClass, fieldLabelClass } from './TextField';

export interface SelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

export interface SelectProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange'> {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange(v: string): void;
  tag?: string;
}

// Radix Select forbids empty-string item values, so '' travels as a sentinel.
const EMPTY = '__ds_empty__';
const toInternal = (v: string) => (v === '' ? EMPTY : v);
const toExternal = (v: string) => (v === EMPTY ? '' : v);

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { label, value, options, onChange, tag, id, className = '', disabled, name, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const selected = options.find((o) => o.value === value);
  return (
    <div className={className}>
      {label && <label htmlFor={selectId} className={fieldLabelClass}>{label}</label>}
      <SelectPrimitive.Root
        value={toInternal(value)}
        onValueChange={(v) => onChange(toExternal(v))}
        disabled={disabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={selectId}
          className={`${controlClass} w-full cursor-pointer text-left outline-none focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-accent`}
          {...rest}
        >
          <span className="min-w-0 flex-1 truncate">
            <SelectPrimitive.Value>{selected?.label ?? ''}</SelectPrimitive.Value>
          </span>
          {tag && (
            <span className="rounded-md bg-chip px-[7px] py-px text-[12px] text-muted">{tag}</span>
          )}
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-[15px] w-[15px] flex-none text-faint" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            align="start"
            className="z-[300] max-h-[320px] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-card-border bg-pop p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
          >
            <SelectPrimitive.Viewport className="max-h-[300px]">
              {options.map((o) => {
                const Icon = o.icon;
                const isSelected = o.value === value;
                return (
                  <SelectPrimitive.Item
                    key={o.value}
                    value={toInternal(o.value)}
                    className={`group flex h-[34px] cursor-pointer select-none items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] outline-none data-[highlighted]:bg-chip ${isSelected ? 'text-fg' : 'text-muted'}`}
                  >
                    {Icon && <Icon className="h-4 w-4 flex-none text-muted" strokeWidth={1.8} aria-hidden />}
                    <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                    <span className="ml-auto flex-none pl-3">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4 text-accent-fg" strokeWidth={2} aria-hidden />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
});
