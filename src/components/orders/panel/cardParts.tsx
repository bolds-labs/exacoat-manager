import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type Tone = 'act' | 'wait' | 'prog' | 'done' | 'stop' | 'neutral';

export const toneText: Record<Tone, string> = {
  act: 'text-st-act-fg',
  wait: 'text-st-wait-fg',
  prog: 'text-st-prog-fg',
  done: 'text-st-done-fg',
  stop: 'text-st-stop-fg',
  neutral: 'text-muted',
};

const tonePill: Record<Tone, string> = {
  act: 'bg-st-act-bg text-st-act-fg',
  wait: 'bg-st-wait-bg text-st-wait-fg',
  prog: 'bg-st-prog-bg text-st-prog-fg',
  done: 'bg-st-done-bg text-st-done-fg',
  stop: 'bg-st-stop-bg text-st-stop-fg',
  neutral: 'bg-chip text-muted',
};

const toneBox: Record<Tone, string> = {
  act: 'border-st-act-border bg-st-act-bg',
  wait: 'border-st-wait-border bg-st-wait-bg',
  prog: 'border-st-prog-border bg-st-prog-bg',
  done: 'border-st-done-border bg-st-done-bg',
  stop: 'border-st-stop-border bg-st-stop-bg',
  neutral: 'border-card-border bg-chip',
};

/** Small rounded state pill (11.5px), as in the mockup card headers. */
export function Pill({ tone = 'neutral', icon: Icon, children, className = '' }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-[2px] text-[11.5px] font-medium ${tonePill[tone]} ${className}`}>
      {Icon && <Icon className="h-3 w-3 flex-none" strokeWidth={1.8} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Label above a value (12px faint). */
export function FieldLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`mb-1 block text-[12px] text-faint ${className}`}>{children}</span>;
}

export function EmptyText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`m-0 text-[13px] text-faint ${className}`}>{children}</p>;
}

/** Tinted inset box used for sub-sections inside a card (consolidation, Goorita, guarantee and similar). */
export function InsetBox({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div className={`rounded-[10px] border px-3.5 py-3 ${toneBox[tone]} ${className}`}>{children}</div>;
}

/** Label / value row for money breakdowns. */
export function MoneyRow({
  label,
  value,
  tone,
  strong = false,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  strong?: boolean;
}) {
  const color = tone ? toneText[tone] : strong ? 'text-fg' : 'text-muted';
  return (
    <div
      className={`flex items-start justify-between gap-3 ${color} ${
        strong ? 'mt-[3px] border-t border-line pt-[11px] font-semibold' : ''
      }`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span className={`flex-none text-right font-mono ${strong || tone ? '' : 'text-fg'}`}>{value}</span>
    </div>
  );
}

/** Text link styled as the mockup's amber links. */
export const linkClass =
  'inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent-fg hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm';
