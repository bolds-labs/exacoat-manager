import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface KpiCardProps {
  /** Optional; leave it out where values are long and space is tight. */
  icon?: LucideIcon;
  value: ReactNode;
  label: string;
  highlight?: boolean;
  /** Optional line under the label, e.g. a change against the previous period. */
  footer?: ReactNode;
}

export function KpiCard({ icon: Icon, value, label, highlight = false, footer }: KpiCardProps) {
  const tile = highlight ? 'bg-accent-soft text-accent-fg' : 'bg-chip text-muted';
  return (
    <div className={`flex ${footer ? 'items-start' : 'items-center'} gap-3.5 rounded-[14px] border border-card-border bg-card px-5 py-[18px]`}>
      {Icon && (
        <span className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] ${tile}`}>
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[22px] font-medium leading-tight tracking-[-0.01em] text-fg">{value}</div>
        <div className="text-[12.5px] text-muted">{label}</div>
        {footer && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{footer}</div>}
      </div>
    </div>
  );
}
