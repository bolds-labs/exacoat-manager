import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ClipboardCheck, Copy, FileText, Play, Printer, X, type LucideIcon } from 'lucide-react';
import { getOrderRma, type Order } from '../../../types';
import { formatDateTime } from '../../../lib/formatters';
import { Button, IconButton, Menu, WarrantyChip, type MenuItem } from '../../ds';

export interface PanelHeaderProps {
  order: Order;
  onClose: () => void;
  onPrintLabel: () => void;
  onInvoice: () => void;
  onPackingSlip: () => void;
  moreItems: MenuItem[];
  banner?: ReactNode;
  /** Status navigator or any other pinned row under the title. */
  children?: ReactNode;
  /** Store pickup state as the panel resolves it (includes the local override). */
  isStorePickup?: boolean;
  /** Extra chips after the claim chip (endorsement, guarantee). */
  extraChips?: ReactNode;
  isPrinted?: boolean;
  onCopyId?: (orderNumber: string) => void;
}

export function orderNumberOf(order: Pick<Order, 'id'> & Partial<Order>): string {
  return String(order.order_number || order.id || '').replace(/^#+/, '');
}

export function PanelHeader({
  order,
  onClose,
  onPrintLabel,
  onInvoice,
  onPackingSlip,
  moreItems,
  banner,
  children,
  isStorePickup = false,
  extraChips,
  isPrinted = true,
  onCopyId,
}: PanelHeaderProps) {
  const [copied, setCopied] = useState(false);
  const orderNumber = orderNumberOf(order);
  // Claim chips read the same RMA details as the rest of the panel (order.rma or the _rma_* meta fallback).
  const claimOrder = { ...order, rma: getOrderRma(order) };
  const meta = [
    formatDateTime(order.created_at),
    order.payment_method_title || order.payment_method || 'Direct Payment',
    order.customer_ip ? `IP ${order.customer_ip}` : '',
  ].filter(Boolean);

  const copy = () => {
    if (onCopyId) onCopyId(orderNumber);
    else navigator.clipboard?.writeText(orderNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const printTitle = `${isStorePickup ? 'Print workshop label' : 'Print 4x6 label'}${isPrinted ? '' : ' (not printed yet)'}`;

  return (
    <div className="px-4 pb-4 pt-4 md:px-7 md:pb-5 md:pt-[22px]">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 font-mono text-[22px] font-semibold tracking-[-0.03em] text-fg">#{orderNumber}</h2>
            <IconButton
              icon={copied ? Check : Copy}
              label={copied ? 'Copied' : `Copy order #${orderNumber}`}
              size="sm"
              variant="ghost"
              onClick={copy}
            />
            <WarrantyChip order={claimOrder} />
            <WarrantyChip order={claimOrder} kind="redeem" />
            {isStorePickup && (
              <span className="inline-flex items-center rounded-full bg-chip px-2.5 py-[2px] text-[12px] font-medium text-muted">
                Store Pickup
              </span>
            )}
            {extraChips}
          </div>
          {/* Phone width: one part per line, so a wrap never strands a separator before the payment method. */}
          <div className="mt-1.5 flex flex-col text-[13px] text-muted sm:flex-row sm:flex-wrap sm:items-center">
            {meta.map((part, i) => (
              <span key={i} className="inline-flex min-w-0 items-center break-words">
                {i > 0 && (
                  <span className="mx-2 hidden text-faint sm:inline" aria-hidden>
                    ·
                  </span>
                )}
                {part}
              </span>
            ))}
          </div>
        </div>

        <div className="order-3 flex w-full flex-wrap items-center gap-2 md:order-none md:ml-auto md:w-auto">
          <Button variant="primary" icon={Printer} onClick={onPrintLabel} title={printTitle} className="relative">
            Print label
            {!isPrinted && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-accent-on" aria-hidden />
                <span className="sr-only">(not printed yet)</span>
              </>
            )}
          </Button>
          <Button icon={FileText} onClick={onInvoice} title="View, download and print the customer invoice">
            Invoice
          </Button>
          <Button icon={ClipboardCheck} onClick={onPackingSlip} title="View and print the packing slip">
            Packing slip
          </Button>
          {moreItems.length > 0 && (
            <Menu trigger={<Button trailingIcon={ChevronDown}>More</Button>} items={moreItems} />
          )}
        </div>
        <IconButton icon={X} label="Close details" variant="ghost" onClick={onClose} className="order-2 flex-none md:order-none" />
      </div>

      {banner}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export interface ClaimBannerProps {
  icon: LucideIcon;
  title: string;
  /** Original order reference, shown in mono. */
  reference?: string;
  onOpenReference?: () => void;
  channel?: string;
  reason?: string;
  note?: string;
  status?: ReactNode;
  onReview?: () => void;
  reviewLabel?: string;
}

/** Warranty or redeem replacement banner shown under the header title row. */
export function ClaimBanner({
  icon: Icon,
  title,
  reference,
  onOpenReference,
  channel,
  reason,
  note,
  status,
  onReview,
  reviewLabel = 'Review claim proof',
}: ClaimBannerProps) {
  return (
    // Narrow widths stack the text above the button; from sm up the button sits on the right as before.
    <div className="mt-3.5 flex flex-col gap-3 rounded-[10px] border border-st-act-border bg-st-act-bg px-3 py-2.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-chip text-st-act-fg">
          <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[13.5px] font-medium text-fg">{title}</b>
            {status}
          </div>
          <div className="text-[12.5px] text-muted">
            Original{' '}
            {reference && onOpenReference ? (
              <button
                type="button"
                onClick={onOpenReference}
                className="font-mono font-medium text-fg underline underline-offset-2 hover:text-accent-fg"
              >
                #{reference}
              </button>
            ) : (
              <span className="font-mono font-medium text-fg">#{reference || 'N/A'}</span>
            )}
            {channel && <span> on {channel}</span>}
            {reason && <span> · Reason: {reason}</span>}
          </div>
          {note && <div className="text-[12px] text-faint">{note}</div>}
        </div>
      </div>
      {onReview && (
        <Button icon={Play} onClick={onReview} className="flex-none self-start sm:self-auto">
          {reviewLabel}
        </Button>
      )}
    </div>
  );
}

/** Review state pill for the claim banner, from the RMA status (approved, rejected, anything else pending). */
export function ClaimStatusPill({ status }: { status?: string }) {
  const raw = String(status || '').toLowerCase();
  const [label, tone] =
    raw === 'approved'
      ? ['Approved', 'bg-st-done-bg text-st-done-fg']
      : raw === 'rejected'
      ? ['Rejected', 'bg-st-stop-bg text-st-stop-fg']
      : ['Pending review', 'bg-chip text-st-act-fg'];
  return <span className={`inline-flex items-center rounded-full px-2 py-[1px] text-[12px] font-medium ${tone}`}>{label}</span>;
}
