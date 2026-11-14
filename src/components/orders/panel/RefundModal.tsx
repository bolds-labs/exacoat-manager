import type { FormEvent } from 'react';
import { CreditCard, Info, RotateCcw, Wallet } from 'lucide-react';
import type { Order } from '../../../types';
import { Modal } from '../../ds/Modal';
import { Button } from '../../ds/Button';
import { TextField, fieldLabelClass } from '../../ds/TextField';
import { Checkbox } from '../../ds/Checkbox';
import { RadioCardGroup } from '../../ds/RadioCard';
import { formatCurrency } from '../../../lib/formatters';
import { InsetBox } from './cardParts';

export type RefundMethod = 'original' | 'store_credit';

/**
 * When the refund destination changes, the amount follows the store credit shipping subsidy rule
 * (AGENTS.md 11b): the full balance becomes the subsidized net for store credit and back again.
 * A hand-typed amount is left alone.
 */
export function amountAfterMethodSwitch(next: RefundMethod, current: string, remaining: number, shippingDiscount: number): string {
  if (shippingDiscount <= 0) return current;
  const net = Math.max(0, remaining - shippingDiscount);
  if (next === 'store_credit' && Number(current) === remaining) return String(net);
  if (next === 'original' && Number(current) === net) return String(remaining);
  return current;
}

export interface RefundModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  order: Order;
  orderRef: string;
  totalRefunded: number;
  remainingAvailableRefund: number;
  shippingDiscount: number;
  amount: string;
  onAmountChange(v: string): void;
  reason: string;
  onReasonChange(v: string): void;
  method: RefundMethod;
  onMethodChange(m: RefundMethod): void;
  restock: boolean;
  onRestockChange(v: boolean): void;
  markAsRefunded: boolean;
  onMarkAsRefundedChange(v: boolean): void;
  isProcessing: boolean;
  onSubmit(e: FormEvent): void;
}

const FORM_ID = 'order-refund-form';

export function RefundModal({
  open,
  onOpenChange,
  order,
  orderRef,
  totalRefunded,
  remainingAvailableRefund,
  shippingDiscount,
  amount,
  onAmountChange,
  reason,
  onReasonChange,
  method,
  onMethodChange,
  restock,
  onRestockChange,
  markAsRefunded,
  onMarkAsRefundedChange,
  isProcessing,
  onSubmit,
}: RefundModalProps) {
  const cur = order.currency;
  const amt = Number(amount);
  const net = Math.max(0, remainingAvailableRefund - shippingDiscount);
  const isFull = amt >= remainingAvailableRefund && remainingAvailableRefund > 0;
  const invalid = !amount || amt <= 0 || amt > remainingAvailableRefund;
  const statusLabel = String(order.status || '').replace(/[-_]/g, ' ');

  const switchMethod = (v: string) => {
    const next = v as RefundMethod;
    if (next === method) return;
    onMethodChange(next);
    const nextAmount = amountAfterMethodSwitch(next, amount, remainingAvailableRefund, shippingDiscount);
    if (nextAmount !== amount) onAmountChange(nextAmount);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o && isProcessing) return;
        onOpenChange(o);
      }}
      title="Issue refund"
      reference={orderRef}
      width={500}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            icon={method === 'store_credit' ? Wallet : RotateCcw}
            disabled={isProcessing || invalid}
          >
            {isProcessing
              ? method === 'store_credit' ? 'Crediting...' : 'Refunding...'
              : `Refund ${formatCurrency(amt > 0 ? amt : 0, cur)}`}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5 rounded-[10px] bg-chip px-3.5 py-3 text-[13.5px]">
          <div className="flex justify-between text-muted">
            <span>Order total</span>
            <span className="font-mono">{formatCurrency(order.total, cur)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Already refunded</span>
            <span className="font-mono">{formatCurrency(totalRefunded, cur)}</span>
          </div>
          <div className="flex justify-between font-medium text-fg">
            <span>Available to refund</span>
            <span className="font-mono">{formatCurrency(remainingAvailableRefund, cur)}</span>
          </div>
        </div>

        <div>
          <span id="refund-to-label" className={fieldLabelClass}>Refund to</span>
          <RadioCardGroup
            aria-labelledby="refund-to-label"
            value={method}
            onChange={switchMethod}
            className="grid grid-cols-2 gap-2.5"
            options={[
              {
                value: 'original',
                icon: CreditCard,
                title: 'Original payment',
                description: order.payment_method_title ? `Back to ${order.payment_method_title}` : 'Refund to original payment',
              },
              {
                value: 'store_credit',
                icon: Wallet,
                title: 'Store credit',
                description: order.customer_id ? 'Customer account balance' : 'Guest order (no account)',
                disabled: !order.customer_id,
              },
            ]}
          />
        </div>

        {method === 'store_credit' && (
          <InsetBox tone="wait" className="flex flex-col gap-1.5 text-[12.5px]">
            {order.customer_store_credit_balance !== undefined && (
              <div className="flex justify-between text-muted">
                <span>Current store credit balance</span>
                <span className="font-mono">{formatCurrency(order.customer_store_credit_balance, cur)}</span>
              </div>
            )}
            {shippingDiscount > 0 && (
              <>
                <div className="flex justify-between text-muted">
                  <span>Shipping subsidy deduction</span>
                  <span className="font-mono text-st-stop-fg">-{formatCurrency(shippingDiscount, cur)}</span>
                </div>
                <div className="flex justify-between font-medium text-fg">
                  <span>Suggested net refund</span>
                  <span className="font-mono">{formatCurrency(net, cur)}</span>
                </div>
                <Button size="sm" className="mt-1 self-start" onClick={() => onAmountChange(String(net))}>
                  Apply subsidized net ({formatCurrency(net, cur)})
                </Button>
              </>
            )}
          </InsetBox>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <TextField
            label="Amount"
            type="number"
            step="any"
            min="1"
            max={remainingAvailableRefund}
            required
            mono
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0"
            trailing={<span className="text-[12px] text-faint">{cur}</span>}
          />
          <TextField
            label="Reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="e.g. Customer request"
          />
        </div>

        <Checkbox label="Restock items" checked={restock} onChange={(e) => onRestockChange(e.target.checked)} />

        {isFull ? (
          <p className="m-0 flex items-center gap-2 text-[12.5px] text-muted">
            <Info className="h-3.5 w-3.5 flex-none text-faint" strokeWidth={1.8} aria-hidden />
            A full refund marks the order as Refunded.
          </p>
        ) : (
          <>
            <Checkbox
              label="Update status to Refunded"
              checked={markAsRefunded}
              onChange={(e) => onMarkAsRefundedChange(e.target.checked)}
            />
            <p className="m-0 flex items-center gap-2 text-[12.5px] text-muted">
              <Info className="h-3.5 w-3.5 flex-none text-faint" strokeWidth={1.8} aria-hidden />
              <span>
                Partial refund. Current status: <span className="capitalize">{statusLabel}</span>. Leave unticked to keep it for ongoing fulfillment.
              </span>
            </p>
          </>
        )}
      </form>
    </Modal>
  );
}
