import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  mono?: boolean;
  trailing?: ReactNode;
}

export const fieldLabelClass = 'mb-1.5 block text-[12px] text-faint';
export const controlClass =
  'flex h-9 items-center gap-2 rounded-[9px] border border-field-border bg-field px-3 text-[13.5px] text-fg focus-within:border-accent';

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, mono = false, trailing, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={className}>
      {label && <label htmlFor={inputId} className={fieldLabelClass}>{label}</label>}
      <div className={controlClass}>
        <input
          ref={ref}
          id={inputId}
          data-ds=""
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint ${mono ? 'font-mono' : ''}`}
          {...rest}
        />
        {trailing}
      </div>
    </div>
  );
});
