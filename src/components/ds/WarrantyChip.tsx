import { RotateCcw, ShieldCheck } from 'lucide-react';
import type { Order } from '../../types';
import { getRedeemClaimMeta, getWarrantyClaimMeta } from '../../lib/orderStatus';
import { familyChipClass } from './StatusChip';

/** Split claim chip: claim kind on the left, review state (Pending / Approved / Rejected) on the right. */
export function WarrantyChip({ order, kind = 'warranty' }: { order: Partial<Order>; kind?: 'warranty' | 'redeem' }) {
  const meta = kind === 'redeem' ? getRedeemClaimMeta(order) : getWarrantyClaimMeta(order);
  const Icon = kind === 'redeem' ? RotateCcw : ShieldCheck;
  if (!meta) return null;
  return (
    <span className="inline-flex items-stretch overflow-hidden rounded-full border border-st-done-border text-[12px] font-medium">
      <span className="inline-flex items-center gap-[5px] bg-st-done-bg px-2 py-[2px] text-st-done-fg">
        <Icon className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
        {kind === 'redeem' ? 'Redeem' : 'Warranty'}
      </span>
      <span className={`border-l border-line px-[9px] py-[2px] ${familyChipClass[meta.family]}`}>{meta.label}</span>
    </span>
  );
}
