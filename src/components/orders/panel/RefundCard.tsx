import { CheckCircle2, Package, RotateCcw, X } from 'lucide-react';
import type { Order, OrderGuaranteeDetails } from '../../../types';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { formatCurrency, formatDate } from '../../../lib/formatters';
import { FieldLabel, MoneyRow, Pill, type Tone } from './cardParts';

export interface RefundCardProps {
  order: Order;
  totalRefunded: number;
  netSettledTotal: number;
  guarantee: OrderGuaranteeDetails | null;
  isProcessingGuarantee: boolean;
  onGuaranteeAction: (action: 'mark_received' | 'approve_refund') => void;
  onRejectGuarantee: () => void;
}

export function guaranteeStatusMeta(status: OrderGuaranteeDetails['status']): { label: string; tone: Tone } {
  if (status === 'refunded') return { label: 'Refund paid', tone: 'done' };
  if (status === 'package_received') return { label: 'Package received at Ruby Commercial TB12', tone: 'prog' };
  if (status === 'rejected') return { label: 'Rejected', tone: 'stop' };
  return { label: 'Awaiting return package', tone: 'wait' };
}

const methodLabel = (m: OrderGuaranteeDetails['refund_method']) =>
  m === 'store_credit' ? 'Store credit (100%)' : m === 'bank_transfer' ? 'Bank transfer (70%)' : 'PayPal (70%)';

/** Renders only when the order has refunds or a 30-day guarantee claim. */
export function shouldShowRefundCard(totalRefunded: number, guarantee: OrderGuaranteeDetails | null): boolean {
  return totalRefunded > 0 || Boolean(guarantee);
}

export function RefundCard({
  order,
  totalRefunded,
  netSettledTotal,
  guarantee,
  isProcessingGuarantee,
  onGuaranteeAction,
  onRejectGuarantee,
}: RefundCardProps) {
  if (!shouldShowRefundCard(totalRefunded, guarantee)) return null;
  const cur = order.currency;
  const gStatus = guarantee ? guaranteeStatusMeta(guarantee.status) : null;

  return (
    <Card icon={RotateCcw} title="Refunds">
      {totalRefunded > 0 && (
        <div className="flex flex-col gap-[9px] text-[13.5px]">
          <MoneyRow tone="stop" label="Amount refunded" value={`-${formatCurrency(totalRefunded, cur)}`} />
          <MoneyRow label="Net amount" value={formatCurrency(netSettledTotal, cur)} />
          {order.refunds && order.refunds.length > 0 && (
            <div className="mt-1 border-t border-line pt-3">
              <FieldLabel>Refund history ({order.refunds.length})</FieldLabel>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {order.refunds.map((ref) => (
                  <li key={ref.id} className="flex items-start justify-between gap-3 text-[13px]">
                    <span className="min-w-0 break-words">
                      <span className="font-mono text-fg">Refund #{ref.id}</span>
                      {ref.reason && <span className="text-muted"> ({ref.reason})</span>}
                    </span>
                    <span className="flex-none text-right font-mono">
                      <span className="text-st-stop-fg">-{formatCurrency(ref.amount, cur)}</span>
                      {ref.date_created && <span className="block text-[12px] text-faint">{formatDate(ref.date_created)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {guarantee && gStatus && (
        <div className={totalRefunded > 0 ? 'mt-4 border-t border-line pt-4' : ''}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium text-fg">30-day money back guarantee return</span>
            <Pill tone={gStatus.tone}>{gStatus.label}</Pill>
          </div>
          <dl className="m-0 flex flex-col gap-1.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Method</dt>
              <dd className="m-0 text-right text-fg">{methodLabel(guarantee.refund_method)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Amount</dt>
              <dd className="m-0 text-right font-mono text-fg">{formatCurrency(guarantee.refund_amount, cur)}</dd>
            </div>
            {guarantee.destination && (
              <div className="flex justify-between gap-3">
                <dt className="flex-none text-faint">Destination</dt>
                <dd className="m-0 min-w-0 break-all text-right font-mono text-fg">{guarantee.destination}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="flex-none text-faint">Return hub</dt>
              <dd className="m-0 min-w-0 text-right text-muted">Exacoat Returns Hub, Ruby Commercial TB12, Jl. Bulevar Selatan, Bekasi 17142</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="flex-none text-faint">Return courier</dt>
              <dd className="m-0 min-w-0 break-all text-right">
                {guarantee.return_tracking ? (
                  <span className="font-mono text-fg">
                    {guarantee.return_courier || 'Courier'} #{guarantee.return_tracking}
                  </span>
                ) : (
                  <span className="text-st-act-fg">Return resi not uploaded by the customer yet</span>
                )}
              </dd>
            </div>
            {guarantee.claim_data?.reason && (
              <div className="flex justify-between gap-3">
                <dt className="flex-none text-faint">Reason</dt>
                <dd className="m-0 min-w-0 break-words text-right text-fg">{String(guarantee.claim_data.reason)}</dd>
              </div>
            )}
          </dl>

          {(guarantee.status === 'pending_return' || guarantee.status === 'package_received') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {guarantee.status === 'pending_return' && (
                <Button
                  size="sm"
                  icon={Package}
                  disabled={isProcessingGuarantee}
                  onClick={() => onGuaranteeAction('mark_received')}
                  title="Confirm the package has been received and inspected at Ruby Commercial TB12"
                >
                  Mark package received
                </Button>
              )}
              <Button
                size="sm"
                variant="primary"
                icon={CheckCircle2}
                disabled={isProcessingGuarantee}
                onClick={() => onGuaranteeAction('approve_refund')}
                title="Approve the refund, record it in WooCommerce and send the confirmation email"
              >
                Approve & issue refund
              </Button>
              <Button size="sm" variant="danger" icon={X} disabled={isProcessingGuarantee} onClick={onRejectGuarantee} title="Reject the guarantee return claim">
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
