import { forwardRef, type HTMLAttributes } from 'react';

export interface CountPillProps extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  tone?: 'neutral' | 'hot';
}

export const CountPill = forwardRef<HTMLSpanElement, CountPillProps>(function CountPill(
  { value, tone = 'neutral', className = '', ...rest },
  ref,
) {
  const toneClass = tone === 'hot' ? 'bg-accent-soft text-accent-fg' : 'bg-chip text-muted';
  return (
    <span
      ref={ref}
      className={`inline-block rounded-full px-1.5 py-px text-[11.5px] font-medium tabular-nums ${toneClass} ${className}`}
      {...rest}
    >
      {value}
    </span>
  );
});
