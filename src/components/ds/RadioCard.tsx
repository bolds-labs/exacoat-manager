import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface RadioCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'role' | 'onSelect'> {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  description?: string;
  onSelect(): void;
}

export const RadioCard = forwardRef<HTMLButtonElement, RadioCardProps>(function RadioCard(
  { selected, icon: Icon, title, description, onSelect, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex items-center gap-2.5 rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? 'border-accent/55 bg-accent-soft' : 'border-field-border bg-transparent'
      } ${className}`}
      {...rest}
    >
      <Icon className="h-[15px] w-[15px] flex-none text-muted" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="block text-[13.5px] font-medium text-fg">{title}</b>
        {description && <span className="block text-[12px] text-faint">{description}</span>}
      </span>
      <span
        className={`h-4 w-4 flex-none rounded-full ${
          selected ? 'border-[5px] border-accent' : 'border-[1.5px] border-faint'
        }`}
      />
    </button>
  );
});
