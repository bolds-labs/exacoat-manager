import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface KpiCardProps {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  highlight?: boolean;
}

export function KpiCard({ icon: Icon, value, label, highlight = false }: KpiCardProps) {
  const tile = highlight ? 'bg-accent-soft text-accent-fg' : 'bg-chip text-muted';
  return (
    <div className="flex items-center gap-3.5 rounded-[14px] border border-card-border bg-card px-5 py-[18px]">
      <span className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] ${tile}`}>
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[22px] font-medium leading-tight tracking-[-0.01em] text-fg">{value}</div>
        <div className="text-[12.5px] text-muted">{label}</div>
      </div>
    </div>
  );
}
