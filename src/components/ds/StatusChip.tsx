import type { Order } from '../../types';
import { getOrderStatusMeta, type StatusFamily, type StatusMeta } from '../../lib/orderStatus';

export const familyChipClass: Record<StatusFamily, string> = {
  act: 'text-st-act-fg bg-st-act-bg',
  wait: 'text-st-wait-fg bg-st-wait-bg',
  prog: 'text-st-prog-fg bg-st-prog-bg',
  done: 'text-st-done-fg bg-st-done-bg',
  stop: 'text-st-stop-fg bg-st-stop-bg',
  neutral: 'text-muted bg-chip',
};

export interface StatusChipProps {
  order?: Partial<Order>;
  meta?: StatusMeta;
  size?: 'md' | 'sm';
}

export function StatusChip({ order, meta, size = 'md' }: StatusChipProps) {
  const resolved = order ? getOrderStatusMeta({ status: '', ...order }) : meta;
  if (!resolved) return null;
  const Icon = resolved.icon;
  const sizing = size === 'sm' ? 'gap-1 px-2 py-[2px] text-[12px]' : 'gap-1.5 py-1 pl-2 pr-2.5 text-[12.5px]';
  return (
    <span className={`inline-flex items-center rounded-[7px] font-medium ${sizing} ${familyChipClass[resolved.family]}`}>
      <Icon className={size === 'sm' ? 'h-[13px] w-[13px]' : 'h-3.5 w-3.5'} strokeWidth={1.8} aria-hidden />
      {resolved.label}
    </span>
  );
}
