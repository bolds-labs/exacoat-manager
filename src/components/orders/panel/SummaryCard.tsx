import { CreditCard, RotateCcw } from 'lucide-react';
import type { Order } from '../../../types';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { formatCurrency, formatDate, formatFeeLabel } from '../../../lib/formatters';
import { MoneyRow, Pill } from './cardParts';

export interface SummaryCardProps {
  order: Order;
  currentStatus: string;
  shippingDiscount: number;
  originalShippingRate: number;
  shippingPromoCode: string;
  /** Remaining refundable amount; the Refund button shows only when it is above zero. */
  remainingAvailableRefund: number;
  onRefund: () => void;
}

const CONFIRMED_STATUSES = ['processing', 'completed', 'in-production', 'ready-to-ship', 'shipped'];

export type PaymentState =
  | { kind: 'paid'; text: string }
  | { kind: 'confirmed'; text: string }
  | { kind: 'pending'; text: string };

/** Same three outcomes as the previous panel: paid with date, confirmed by status, or pending. */
export function paymentState(order: Order, currentStatus: string): PaymentState {
  const method = String(order.payment_method_title || order.payment_method || 'Online Payment');
  if (order.date_paid) {
    return { kind: 'paid', text: `${formatCurrency(order.total, order.currency)} paid ${formatDate(order.date_paid)} via ${method}` };
  }
  if (CONFIRMED_STATUSES.includes(currentStatus)) {
    return { kind: 'confirmed', text: `Confirmed (${method})` };
  }
  return { kind: 'pending', text: `Awaiting ${formatCurrency(order.total, order.currency)}` };
}

export function SummaryCard({
  order,
  currentStatus,
  shippingDiscount,
  originalShippingRate,
  shippingPromoCode,
  remainingAvailableRefund,
  onRefund,
}: SummaryCardProps) {
  const meta = order.meta_data || [];
  const metaValue = (k: string) => meta.find((m) => m.key === k)?.value;
  const cur = order.currency;
  const bcaCode = metaValue('_bca_unique_code');
  const midtransId = metaValue('_midtrans_transaction_id');
  const bcaMutation = metaValue('_bca_mutation_desc');
  const shippingLabel = `Shipping (${order.shipping_method_name || 'Standard Delivery'})`;
  const pay = paymentState(order, currentStatus);

  return (
    <Card
      icon={CreditCard}
      title="Order summary"
      actions={
        remainingAvailableRefund > 0 ? (
          <Button size="sm" icon={RotateCcw} onClick={onRefund}>
            Refund
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-[9px] text-[13.5px]">
        <MoneyRow label="Currency" value={cur || 'USD'} />
        <MoneyRow label="Items subtotal" value={formatCurrency(order.subtotal || order.total, cur)} />
        {Number(order.discount_total || 0) > 0 && (
          <MoneyRow
            tone="act"
            label={`Discount${order.coupon_codes && order.coupon_codes.length > 0 ? ` (${order.coupon_codes.join(', ')})` : ''}`}
            value={`-${formatCurrency(order.discount_total!, cur)}`}
          />
        )}
        {order.fees && order.fees.length > 0
          ? order.fees.map((f) => (
              <MoneyRow
                key={f.id}
                tone={f.total < 0 ? 'act' : undefined}
                label={formatFeeLabel(f.name, order)}
                value={`${f.total < 0 ? '-' : '+'}${formatCurrency(Math.abs(f.total), cur)}`}
              />
            ))
          : order.fee_total !== undefined && order.fee_total !== 0 && (
              <MoneyRow
                tone={order.fee_total < 0 ? 'act' : undefined}
                label={order.fee_total < 0 ? 'Discount' : 'Adjustment'}
                value={`${order.fee_total < 0 ? '-' : '+'}${formatCurrency(Math.abs(order.fee_total), cur)}`}
              />
            )}
        {shippingDiscount > 0 ? (
          <>
            <MoneyRow
              label={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {shippingLabel}
                  <Pill tone="done">Promo</Pill>
                </span>
              }
              value={formatCurrency(originalShippingRate, cur)}
            />
            <MoneyRow
              tone="done"
              label={`Shipping discount${shippingPromoCode ? ` (${shippingPromoCode.toUpperCase()})` : ''}`}
              value={`-${formatCurrency(shippingDiscount, cur)}`}
            />
          </>
        ) : (
          <MoneyRow label={shippingLabel} value={formatCurrency(order.shipping_total || 0, cur)} />
        )}
        {Number(order.total_tax) > 0 && <MoneyRow label="Tax" value={formatCurrency(order.total_tax, cur)} />}
        {bcaCode && <MoneyRow tone="act" label="Unique payment code" value={`+${formatCurrency(Number(bcaCode), cur)}`} />}
        <MoneyRow strong label="Order total" value={formatCurrency(order.total, cur)} />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        <Pill tone={pay.kind === 'pending' ? 'wait' : 'done'}>{pay.kind === 'paid' ? 'Paid' : pay.kind === 'confirmed' ? 'Confirmed' : 'Pending'}</Pill>
        <span className="min-w-0 break-words text-[12.5px] text-muted">{pay.text}</span>
      </div>

      {midtransId && (
        <div className="mt-1 break-all font-mono text-[12.5px] text-muted">
          Midtrans ref {String(midtransId)}
        </div>
      )}
      {bcaMutation && (
        <div className="mt-1 break-all text-[12.5px] text-muted">
          <span className="text-faint">BCA webhook mutation: </span>
          <span className="font-mono">{String(bcaMutation)}</span>
        </div>
      )}
    </Card>
  );
}
