import { ArrowDownRight, ArrowUpRight, Minus, Plus } from 'lucide-react';
import type { MetricComparison } from '../../lib/periodComparison';

/** Signed percentage: one decimal under 10%, whole percent above, grouped thousands. */
export function formatChange(delta: number): string {
  const pct = delta * 100;
  const abs = Math.abs(pct);
  const text = abs < 10 ? abs.toFixed(1).replace(/\.0$/, '') : Math.round(abs).toLocaleString('en-US');
  return `${pct < 0 ? '-' : '+'}${text}%`;
}

export interface ChangeChipProps {
  comparison: MetricComparison;
  /** e.g. "previous 7 days" */
  periodLabel: string;
  /** Formats the previous value for the hover text (currency, count). */
  formatValue?: (v: number) => string;
  size?: 'md' | 'sm';
}

const base = 'inline-flex items-center gap-1 rounded-[6px] font-medium tabular-nums whitespace-nowrap';

/** Change against the previous period. Rises and falls use the done and stop families; never a wrong percentage. */
export function ChangeChip({ comparison, periodLabel, formatValue = (v) => v.toLocaleString('en-US'), size = 'md' }: ChangeChipProps) {
  const sizing = size === 'sm' ? 'px-1.5 py-px text-[11.5px]' : 'px-[7px] py-[2px] text-[12px]';
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-[13px] w-[13px]';
  const { state, delta, previous } = comparison;

  if (state === 'no-history') {
    return (
      <span
        className={`${base} ${sizing} bg-chip text-faint`}
        title={`The loaded orders do not reach back to the ${periodLabel}, so there is no comparison.`}
      >
        Not enough history
      </span>
    );
  }

  const title = `vs ${periodLabel}: ${formatValue(previous ?? 0)}`;

  if (state === 'new') {
    return (
      <span className={`${base} ${sizing} bg-st-prog-bg text-st-prog-fg`} title={title}>
        <Plus className={icon} strokeWidth={2} aria-hidden />
        New
      </span>
    );
  }

  if (state === 'flat' || delta === null) {
    return (
      <span className={`${base} ${sizing} bg-chip text-muted`} title={title}>
        <Minus className={icon} strokeWidth={2} aria-hidden />
        No change
      </span>
    );
  }

  const up = state === 'up';
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`${base} ${sizing} ${up ? 'bg-st-done-bg text-st-done-fg' : 'bg-st-stop-bg text-st-stop-fg'}`} title={title}>
      <Icon className={icon} strokeWidth={2} aria-hidden />
      {formatChange(delta)}
      <span className="sr-only">{up ? ' increase' : ' decrease'} {title}</span>
    </span>
  );
}
