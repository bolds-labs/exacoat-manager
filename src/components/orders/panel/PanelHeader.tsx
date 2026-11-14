import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ClipboardCheck, Copy, FileText, Play, Printer, X, type LucideIcon } from 'lucide-react';
import type { Order } from '../../../types';
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
    <div className="px-7 pb-5 pt-[22px]">
      <div className="flex items-start gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 font-mono text-[22px] font-semibold tracking-[-0.03em] text-fg">#{orderNumber}</h2>
            <IconButton
              icon={copied ? Check : Copy}
              label={copied ? 'Copied' : `Copy order #${orderNumber}`}
              size="sm"
              variant="ghost"
              onClick={copy}
            />
            <WarrantyChip order={order} />
            <WarrantyChip order={order} kind="redeem" />
            {isStorePickup && (
              <span className="inline-flex items-center rounded-full bg-chip px-2.5 py-[2px] text-[12px] font-medium text-muted">
                Store Pickup
              </span>
            )}
            {extraChips}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center text-[13px] text-muted">
            {meta.map((part, i) => (
              <span key={i} className="inline-flex items-center">
                {i > 0 && (
                  <span className="mx-2 text-faint" aria-hidden>
                    ·
                  </span>
                )}
                {part}
              </span>
            ))}
          </div>
        </div>

        <div className="ml-auto flex flex-none items-center gap-2">
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
          <IconButton icon={X} label="Close details" variant="ghost" onClick={onClose} />
        </div>
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
    <div className="mt-3.5 flex items-center gap-3 rounded-[10px] border border-st-act-border bg-st-act-bg px-3 py-2.5">
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
      {onReview && (
        <Button icon={Play} onClick={onReview} className="flex-none">
          {reviewLabel}
        </Button>
      )}
    </div>
  );
}
