import { Eye, Package, Pencil, Plus, RotateCcw, ShieldCheck, Video } from 'lucide-react';
import type { Order, OrderItem } from '../../../types';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { extractItemSpecs } from '../../../lib/orderItems';
import { formatCurrency } from '../../../lib/formatters';
import { EmptyText, InsetBox, Pill } from './cardParts';

export interface LinkedClaim {
  kind: 'warranty' | 'redeem';
  orderId: number;
  /** Display reference (claim invoice or order ID). */
  reference: string;
  /** Warranty claim review state; redeem orders have none. */
  status?: string;
}

export interface ItemsCardProps {
  order: Order;
  items: OrderItem[];
  /** RMA order type of this order (Warranty or Redeem replacement), when it is one. */
  claimType?: 'Warranty' | 'Redeem' | string;
  linkedClaims: LinkedClaim[];
  onAddItem: () => void;
  onEditItem: (item: OrderItem) => void;
  onPreviewCustom: (item: OrderItem) => void;
  onOpenOrder?: (orderId: number) => void;
  onReviewClaim: (orderId: number) => void;
}

const isMediaSpec = (sp: { label: string; value: string }) =>
  /^(image_url|image|composite_url|thumbnail_url)$/i.test(sp.label) || /^https?:\/\//i.test(sp.value);

export const isCustomItem = (item: OrderItem) => item.name.toLowerCase().startsWith('custom order') || Boolean((item as any).is_custom);

function claimStatusPill(status?: string) {
  if (status === 'approved') return <Pill tone="done">Approved</Pill>;
  if (status === 'rejected') return <Pill tone="stop">Rejected</Pill>;
  if (status === 'pending_review') return <Pill tone="act">Pending review</Pill>;
  return null;
}

function ItemRow({
  item,
  order,
  claimType,
  onEditItem,
  onPreviewCustom,
}: {
  item: OrderItem;
  order: Order;
  claimType?: string;
  onEditItem: (item: OrderItem) => void;
  onPreviewCustom: (item: OrderItem) => void;
}) {
  const discount = Number(item.discount || 0);
  const tax = Number(item.tax || 0);
  const specs = extractItemSpecs(item).filter((sp) => !isMediaSpec(sp));
  const custom = isCustomItem(item);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-[10px] bg-chip">
          {item.image_url ? (
            <img src={item.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="h-6 w-6 text-faint" strokeWidth={1.6} aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="flex-none font-mono text-[13px] text-faint">{item.quantity}×</span>
            <b className={`min-w-0 break-words font-medium ${item.is_refunded ? 'text-faint line-through' : 'text-fg'}`}>{item.name}</b>
            <span className="font-mono text-[12.5px] text-muted">#{item.product_id}</span>
            {item.sku && <span className="font-mono text-[12px] text-faint">SKU {item.sku}</span>}
          </div>

          {(claimType === 'Redeem' || claimType === 'Warranty' || custom || (item.qty_refunded || 0) > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {claimType === 'Redeem' && <Pill tone="act" icon={RotateCcw}>Redeem replacement (free)</Pill>}
              {claimType === 'Warranty' && <Pill tone="prog" icon={ShieldCheck}>Warranty replacement</Pill>}
              {custom && <Pill tone="wait">Custom order</Pill>}
              {(item.qty_refunded || 0) > 0 && <Pill tone="stop">Refunded ({item.qty_refunded}×)</Pill>}
            </div>
          )}

          {specs.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {specs.map((sp, i) => (
                <span key={i} className="max-w-full break-words rounded-md bg-chip px-[9px] py-[3px] text-[12.5px] text-fg">
                  <em className="mr-[5px] not-italic text-faint">{sp.label}</em>
                  {sp.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-row-reverse items-center justify-between gap-2 sm:flex-col sm:items-end">
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1.5">
            {discount > 0 && (
              <span className="font-mono text-[12px] text-faint line-through">{formatCurrency(item.subtotal, order.currency)}</span>
            )}
            <b className={`font-mono font-medium ${item.is_refunded ? 'text-faint line-through' : 'text-fg'}`}>
              {formatCurrency(item.total, order.currency)}
            </b>
          </div>
          {(item.amount_refunded || 0) > 0 && (
            <span className="block font-mono text-[12px] text-st-stop-fg">-{formatCurrency(item.amount_refunded!, order.currency)} refunded</span>
          )}
          {discount > 0 && (
            <span className="block font-mono text-[12px] text-st-act-fg">-{formatCurrency(discount, order.currency)} discount</span>
          )}
          {tax > 0 && <span className="block font-mono text-[12px] text-muted">+{formatCurrency(tax, order.currency)} DDP</span>}
          {item.commission_amount ? (
            <span className="block font-mono text-[12px] text-accent-fg">
              Cut: {formatCurrency(item.commission_amount, order.currency)} ({item.commission_rate || 12.5}%)
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {custom && item.image_url && (
            <Button size="sm" icon={Eye} onClick={() => onPreviewCustom(item)}>
              View custom skin
            </Button>
          )}
          <Button
            size="sm"
            icon={Pencil}
            onClick={() => onEditItem(item)}
            title="Edit product, quantity, configuration layers or add-on specifications"
          >
            Edit configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ItemsCard({
  order,
  items,
  claimType,
  linkedClaims,
  onAddItem,
  onEditItem,
  onPreviewCustom,
  onOpenOrder,
  onReviewClaim,
}: ItemsCardProps) {
  const units = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  return (
    <Card
      icon={Package}
      title="Items"
      count={items.length}
      actions={
        <>
          <span className="whitespace-nowrap text-[12.5px] text-muted">Total units {units}</span>
          <Button size="sm" icon={Plus} onClick={onAddItem} title="Add a precision skin or product to this order">
            Add item
          </Button>
        </>
      }
    >
      {linkedClaims.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {linkedClaims.map((c) => (
            <InsetBox key={`${c.kind}-${c.orderId}`} tone={c.kind === 'redeem' ? 'act' : 'prog'} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[13px] text-fg">
                {c.kind === 'redeem' ? (
                  <RotateCcw className="h-4 w-4 flex-none text-st-act-fg" strokeWidth={1.8} aria-hidden />
                ) : (
                  <ShieldCheck className="h-4 w-4 flex-none text-st-prog-fg" strokeWidth={1.8} aria-hidden />
                )}
                <span>{c.kind === 'redeem' ? 'Redeem replacement order filed:' : '48-hour warranty replacement claim filed:'}</span>
                {onOpenOrder ? (
                  <button
                    type="button"
                    onClick={() => onOpenOrder(c.orderId)}
                    className="font-mono font-medium underline underline-offset-2 hover:text-accent-fg"
                  >
                    #{c.reference}
                  </button>
                ) : (
                  <span className="font-mono font-medium">#{c.reference}</span>
                )}
                {c.kind === 'warranty' && claimStatusPill(c.status)}
              </div>
              {c.kind === 'warranty' && (
                <Button size="sm" icon={Video} onClick={() => onReviewClaim(c.orderId)} className="self-start sm:self-auto">
                  Review claim proof
                </Button>
              )}
            </InsetBox>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyText>No items on this order</EmptyText>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="py-4 first:pt-0 last:pb-0">
              <ItemRow item={item} order={order} claimType={claimType} onEditItem={onEditItem} onPreviewCustom={onPreviewCustom} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
