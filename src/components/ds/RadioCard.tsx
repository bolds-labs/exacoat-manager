import { forwardRef, useRef, type ButtonHTMLAttributes, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface RadioCardProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'role' | 'onSelect'> {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  description?: string;
  onSelect(): void;
}

/**
 * One radio option. Use it inside `RadioCardGroup`, which provides `role="radiogroup"`,
 * roving tabindex and arrow key navigation. A bare RadioCard must sit in an element with
 * `role="radiogroup"` and an accessible name.
 */
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
      {...rest}
      onClick={onSelect}
      className={`flex items-center gap-2.5 rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? 'border-accent-border bg-accent-soft' : 'border-field-border bg-transparent'
      } ${className}`}
    >
      <Icon className="h-[15px] w-[15px] flex-none text-muted" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 flex-1">
        <b className="block text-[13.5px] font-medium text-fg">{title}</b>
        {description && <span className="block text-[12px] text-faint">{description}</span>}
      </span>
      <span
        data-radio-dot=""
        aria-hidden="true"
        className={`h-4 w-4 flex-none rounded-full ${
          selected ? 'border-[5px] border-accent' : 'border-[1.5px] border-faint'
        }`}
      />
    </button>
  );
});

export interface RadioCardOption {
  value: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioCardGroupProps {
  value: string;
  onChange(value: string): void;
  options: RadioCardOption[];
  /** Accessible name for the group. Provide this or `aria-labelledby`. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
  cardClassName?: string;
}

const NEXT_KEYS = ['ArrowDown', 'ArrowRight'];
const PREV_KEYS = ['ArrowUp', 'ArrowLeft'];

/** Radio group of RadioCards with roving tabindex; arrow keys move focus and select, wrapping at the ends. */
export function RadioCardGroup({
  value,
  onChange,
  options,
  className = 'flex flex-col gap-2.5',
  cardClassName = '',
  ...aria
}: RadioCardGroupProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const selectedIndex = options.findIndex((o) => o.value === value && !o.disabled);
  const tabStop = selectedIndex >= 0 ? selectedIndex : enabled[0];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = NEXT_KEYS.includes(e.key) ? 1 : PREV_KEYS.includes(e.key) ? -1 : 0;
    if (!step || enabled.length === 0) return;
    e.preventDefault();
    const current = refs.current.findIndex((el) => el === document.activeElement);
    const pos = enabled.indexOf(current >= 0 ? current : tabStop);
    const next = enabled[(pos + step + enabled.length) % enabled.length];
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div role="radiogroup" {...aria} className={className} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <RadioCard
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          icon={o.icon}
          title={o.title}
          description={o.description}
          disabled={o.disabled}
          selected={o.value === value}
          tabIndex={i === tabStop ? 0 : -1}
          onSelect={() => onChange(o.value)}
          className={cardClassName}
        />
      ))}
    </div>
  );
}
