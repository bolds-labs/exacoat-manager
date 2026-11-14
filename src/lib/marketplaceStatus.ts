/**
 * Marketplace order statuses that count as cancelled (AGENTS.md section 5).
 * Cancelled orders are hidden from the Semua tab, listed only under
 * Dibatalkan, and show no countdown, resi, print or Atur Pengiriman actions.
 */
export const CANCELLED_MARKETPLACE_STATUSES = ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'] as const;

export function isCancelledMarketplaceStatus(status?: string | null): boolean {
  const s = (status || '').toUpperCase();
  return (CANCELLED_MARKETPLACE_STATUSES as readonly string[]).includes(s);
}

export type TikTokStatusTab = 'ALL' | 'READY_TO_SHIP' | 'SHIPPED' | 'COMPLETED' | 'CLAIMED' | 'CANCELLED';

export const TIKTOK_READY_TO_SHIP_STATUSES = ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'];

/** Whether a TikTok order belongs in the given status tab. */
export function tikTokOrderMatchesTab(
  order: { order_status?: string | null; already_claimed?: boolean },
  tab: TikTokStatusTab
): boolean {
  const st = (order.order_status || '').toUpperCase();
  const cancelled = isCancelledMarketplaceStatus(st);
  switch (tab) {
    case 'ALL':
      return !cancelled;
    case 'READY_TO_SHIP':
      return TIKTOK_READY_TO_SHIP_STATUSES.includes(st);
    case 'SHIPPED':
      return ['IN_TRANSIT', 'SHIPPED'].includes(st);
    case 'COMPLETED':
      return ['DELIVERED', 'COMPLETED'].includes(st);
    case 'CLAIMED':
      return Boolean(order.already_claimed);
    case 'CANCELLED':
      return cancelled;
    default:
      return true;
  }
}
