import type { MouseEvent } from 'react';
import { Check, Copy, Eye, Package, Printer, ShieldAlert, Store } from 'lucide-react';
import { Order, getOrderRma } from '../../../types';
import { formatCurrency, formatDateTime } from '../../../lib/formatters';
import { getOrderCourierDisplay, isStorePickupOrder } from '../../../lib/orderUtils';
import { resolveCountryName } from '../../../lib/countries';
import { formatCleanText } from '../../../lib/utils';
import { cleanItemTitle } from '../../../lib/orderItems';
import { getRedeemClaimMeta, getWarrantyClaimMeta } from '../../../lib/orderStatus';
import { WarrantyChip } from '../../ds/WarrantyChip';

// WooCommerce Indonesia province codes, so the row can show "City, Province"
const ID_PROVINCES: Record<string, string> = {
  AC: 'Aceh', SU: 'Sumatera Utara', SB: 'Sumatera Barat', RI: 'Riau', KR: 'Kepulauan Riau',
  JA: 'Jambi', SS: 'Sumatera Selatan', BB: 'Bangka Belitung', BE: 'Bengkulu', LA: 'Lampung',
  JK: 'DKI Jakarta', JB: 'Jawa Barat', BT: 'Banten', JT: 'Jawa Tengah', JI: 'Jawa Timur',
  YO: 'DI Yogyakarta', BA: 'Bali', NB: 'Nusa Tenggara Barat', NT: 'Nusa Tenggara Timur',
  KB: 'Kalimantan Barat', KT: 'Kalimantan Tengah', KI: 'Kalimantan Timur', KS: 'Kalimantan Selatan',
  KU: 'Kalimantan Utara', SA: 'Sulawesi Utara', ST: 'Sulawesi Tengah', SG: 'Sulawesi Tenggara',
  SR: 'Sulawesi Barat', SN: 'Sulawesi Selatan', GO: 'Gorontalo', MA: 'Maluku', MU: 'Maluku Utara',
  PA: 'Papua', PB: 'Papua Barat', PS: 'Papua Selatan', PT: 'Papua Tengah', PE: 'Papua Pegunungan',
  PD: 'Papua Barat Daya',
};

export function orderNumber(order: Partial<Order>): string {
  return String(order.order_number || order.id || '').replace(/^#+/, '');
}

/** "City, Province" for Indonesian addresses, "City, Country" elsewhere (as today). */
export function formatDestination(order: Partial<Order>): string {
  const city = order.shipping?.city ? formatCleanText(order.shipping.city) : '';
  const country = String(order.shipping?.country || '').toUpperCase();
  const rawState = String(order.shipping?.state || '').trim();
  let region = '';
  if ((country === 'ID' || country === '') && rawState) {
    region = ID_PROVINCES[rawState.toUpperCase()] || (rawState.length > 3 ? formatCleanText(rawState) : '');
  }
  if (!region) region = resolveCountryName(order.shipping?.country);
  return city ? `${city}, ${region}` : region;
}

/** Same rule as the old PENDING REVIEW badge: a warranty or redeem claim whose proof waits for review. */
export function needsClaimReview(order: Order): boolean {
  const rma = getOrderRma(order);
  const isRmaClaim = Boolean(rma?.order_type === 'Warranty' || rma?.order_type === 'Redeem');
  const effectiveStatus = rma?.status || order.warranty_claim_status;
  return isRmaClaim && effectiveStatus === 'pending_review' && rma?.status !== 'approved' && rma?.status !== 'rejected';
}

export function getResi(order: Partial<Order>): string {
  const raw = String(order.tracking?.tracking_number || '').trim();
  return raw.length > 0 && !raw.startsWith('field_') ? raw : '';
}

function isEndorsementOrder(order: Partial<Order>): boolean {
  return (order.meta_data || []).some(
    (m: any) => (m.key === '_order_badge' && m.value === 'ENDORSEMENT') || (m.key === '_is_endorsement' && m.value === 'yes')
  );
}

/** Small neutral tags kept from the old row badges (Endorsement, claimed parent orders). Redeem claims get a claim chip. */
function orderTypeTags(order: Order): string[] {
  const tags: string[] = [];
  const rma = getOrderRma(order);
  if (rma?.order_type === 'Redeem' && rma.is_parent_order) tags.push('Redeem claimed');
  else if (rma?.order_type === 'Redeem' && getRedeemClaimMeta(order) === null) tags.push('Redeem');
  if (rma?.order_type === 'Warranty' && rma.is_parent_order) tags.push('Warranty claimed');
  if (isEndorsementOrder(order)) tags.push('Endorsement');
  if (order.meta_data?.some(m => m.key === '_order_badge' && m.value === 'REPLACEMENT')) tags.push('Replacement');
  return tags;
}

const subClass = 'mt-[3px] truncate text-[13px] text-muted';

export function OrderIdCell({ order }: { order: Order }) {
  const tags = orderTypeTags(order);
  return (
    <div className="min-w-0">
      <div className="truncate font-mono text-[13.5px] font-medium tracking-[-0.01em] text-fg">#{orderNumber(order)}</div>
      <div className={subClass}>{formatDateTime(order.created_at)}</div>
      <WarrantyRowTags order={order} tags={tags} />
    </div>
  );
}

function WarrantyRowTags({ order, tags }: { order: Order; tags: string[] }) {
  const hasWarranty = getWarrantyClaimMeta(order) !== null;
  const hasRedeem = getRedeemClaimMeta(order) !== null;
  if (tags.length === 0 && !hasWarranty && !hasRedeem) return null;
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
      {hasWarranty && <WarrantyChip order={order} />}
      {hasRedeem && <WarrantyChip order={order} kind="redeem" />}
      {tags.map((t) => (
        <span key={t} className="truncate rounded-full bg-chip px-2 py-[2px] text-[12px] font-medium text-muted">
          {t}
        </span>
      ))}
    </div>
  );
}

export function CustomerCell({ order }: { order: Order }) {
  const handle = (order.meta_data || []).find((m: any) => m.key === '_influencer_handle')?.value;
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-fg">
        {formatCleanText(order.customer_name) || 'Customer'}
        {handle && <span className="ml-1.5 font-normal text-faint">{String(handle)}</span>}
      </div>
      <div className={subClass}>{isStorePickupOrder(order) ? 'Store Pickup' : formatDestination(order) || <span className="text-faint">No address</span>}</div>
    </div>
  );
}

export function ItemsCell({ order }: { order: Order }) {
  // Same count and "Nx name" list as the pre-redesign row
  const count = order.item_count ?? (order.items?.length || 0);
  const names = (order.items || []).map((it) => `${it.quantity}x ${cleanItemTitle(it.name)}`).join(', ');
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-fg">
        <Package className="h-[15px] w-[15px] flex-none text-faint" strokeWidth={1.8} aria-hidden />
        {count} {count === 1 ? 'item' : 'items'}
      </div>
      <div className={subClass} title={names}>{names || <span className="text-faint">No items</span>}</div>
    </div>
  );
}

export function TotalCell({ order }: { order: Order }) {
  return (
    <div className="min-w-0 text-right">
      <div className="truncate font-mono text-[13.5px] font-medium tracking-[-0.01em] text-fg">
        {formatCurrency(order.total, order.currency)}
      </div>
      <div className={subClass}>{order.payment_method_title || order.payment_method || 'Direct'}</div>
    </div>
  );
}

export interface CourierCellProps {
  order: Order;
  copied?: boolean;
  onCopy?: (resi: string, e: MouseEvent) => void;
}

export function CourierCell({ order, copied = false, onCopy }: CourierCellProps) {
  if (isStorePickupOrder(order)) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-medium text-fg">
          <Store className="h-[15px] w-[15px] flex-none text-accent-fg" strokeWidth={1.8} aria-hidden />
          Store pickup
        </div>
        <div className={subClass}>Summarecon Bekasi</div>
      </div>
    );
  }
  const resi = getResi(order);
  const courier = getOrderCourierDisplay(order).replace(/\s+-\s+/g, ' · ');
  return (
    <div className="min-w-0">
      <div className="truncate text-fg">{courier}</div>
      {resi ? (
        <div className="mt-[3px] flex min-w-0 items-center gap-1">
          <span className="truncate font-mono text-[12.5px] font-medium text-fg">{resi}</span>
          <button
            type="button"
            onClick={(e) => onCopy?.(resi, e)}
            className="grid h-6 w-6 flex-none place-items-center rounded-md text-faint hover:bg-chip hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Copy resi"
            title="Copy resi"
          >
            {copied ? (
              <Check className="h-[13px] w-[13px] text-st-done-fg" strokeWidth={2} aria-hidden />
            ) : (
              <Copy className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
            )}
          </button>
        </div>
      ) : (
        <div className="mt-[3px] truncate text-[13px] text-faint">Resi not assigned yet</div>
      )}
    </div>
  );
}

export interface ActionsCellProps {
  order: Order;
  /** Order is confirmed and its label has not been printed yet. */
  showPrint: boolean;
  onPrint: (e: MouseEvent) => void;
  onOpen: () => void;
}

const actionBtn =
  'grid h-[30px] w-[30px] flex-none place-items-center rounded-[8px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function ActionsCell({ order, showPrint, onPrint, onOpen }: ActionsCellProps) {
  const review = needsClaimReview(order);
  return (
    <div className="flex items-center justify-end gap-1.5">
      {showPrint && (
        <button
          type="button"
          onClick={onPrint}
          className={`${actionBtn} border-st-act-border bg-st-act-bg text-st-act-fg hover:brightness-110`}
          aria-label="Print 4x6 label (not printed yet)"
          title="Print 4x6 label (not printed yet)"
        >
          <Printer className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
        </button>
      )}
      {review && (
        <button
          type="button"
          onClick={onOpen}
          className={`${actionBtn} border-st-wait-border bg-st-wait-bg text-st-wait-fg hover:brightness-110`}
          aria-label="Review claim proof"
          title="Review claim proof"
        >
          <ShieldAlert className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        className={`${actionBtn} border-card-border text-muted hover:bg-chip hover:text-fg`}
        aria-label="Open order"
        title="Open order"
      >
        <Eye className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
      </button>
    </div>
  );
}
