import { ShieldCheck } from 'lucide-react';
import type { Order } from '../../types';
import { getWarrantyClaimMeta } from '../../lib/orderStatus';
import { familyChipClass } from './StatusChip';

export function WarrantyChip({ order }: { order: Partial<Order> }) {
  const meta = getWarrantyClaimMeta(order);
  if (!meta) return null;
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-full border border-st-done-border text-[12px] font-medium">
      <span className="inline-flex items-center gap-[5px] bg-st-done-bg px-2 py-[2px] text-st-done-fg">
        <ShieldCheck className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
        Warranty
      </span>
      <span className={`border-l border-line px-[9px] py-[2px] ${familyChipClass[meta.family]}`}>{meta.label}</span>
    </span>
  );
}
