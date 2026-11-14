import { Tag } from 'lucide-react';
import type { Order } from '../../../types';
import { Card } from '../../ds/Card';
import { formatCurrency, formatFeeLabel } from '../../../lib/formatters';
import { EmptyText, Pill } from './cardParts';

export interface CouponsCardProps {
  order: Order;
  shippingDiscount: number;
  shippingPromoCode: string;
}

export function isShippingCoupon(code: string, order: Order, shippingDiscount: number, shippingPromoCode: string): boolean {
  return (
    (Boolean(shippingPromoCode) && shippingPromoCode.toLowerCase() === code.toLowerCase()) ||
    code.toLowerCase().includes('ongkir') ||
    Boolean(shippingDiscount > 0 && order.coupon_codes?.length === 1)
  );
}

export function CouponsCard({ order, shippingDiscount, shippingPromoCode }: CouponsCardProps) {
  const coupons = order.coupon_codes || [];
  const fees = order.fees || [];
  const cur = order.currency;

  return (
    <Card icon={Tag} title="Coupons & adjustments">
      {coupons.length === 0 && fees.length === 0 ? (
        <EmptyText>No coupons or adjustments</EmptyText>
      ) : (
        <div className="flex flex-col gap-[9px] text-[13.5px]">
          {coupons.map((code) => {
            const shipping = isShippingCoupon(code, order, shippingDiscount, shippingPromoCode);
            const amount =
              shipping && shippingDiscount > 0
                ? `-${formatCurrency(shippingDiscount, cur)}`
                : Number(order.discount_total || 0) > 0
                ? `-${formatCurrency(order.discount_total!, cur)}`
                : 'Applied';
            return (
              <div key={code} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="break-all rounded-md bg-chip px-2 py-[1px] font-mono text-[12.5px] text-fg">{code}</span>
                  {shipping && <Pill tone="done">Shipping promo</Pill>}
                </span>
                <span className="flex-none font-mono text-st-done-fg">{amount}</span>
              </div>
            );
          })}
          {fees.map((f) => {
            const negative = f.total < 0;
            return (
              <div key={f.id} className="flex items-start justify-between gap-3">
                <span className={`min-w-0 break-words ${negative ? 'text-st-act-fg' : 'text-muted'}`}>{formatFeeLabel(f.name, order)}</span>
                <span className="flex-none text-right font-mono">
                  <span className={negative ? 'text-st-act-fg' : 'text-fg'}>
                    {negative ? '-' : '+'}
                    {formatCurrency(Math.abs(f.total), cur)}
                  </span>
                  {f.tax !== 0 && <span className="block text-[12px] text-faint">DDP: {formatCurrency(f.tax, cur)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
