import type { OrderCounts } from '../../../types';

export interface OrderTabDef {
  /** Filter value OrderTable sends to the server (unchanged from the pre-redesign tab keys). */
  key: string;
  label: string;
  countKey?: keyof OrderCounts['webstore'];
  hot?: boolean;
  inMore?: boolean;
}

export const ORDER_TABS: OrderTabDef[] = [
  { key: 'all', label: 'All', countKey: 'all' },
  { key: 'on-hold', label: 'Awaiting payment', countKey: 'awaiting_payment', hot: true },
  { key: 'processing', label: 'To prepare', countKey: 'to_prepare', hot: true },
  { key: 'preparing-order', label: 'Preparing', countKey: 'preparing' },
  // Today's "Waiting for Pickup" tab (courier orders only)
  { key: 'ready-to-ship', label: 'Waiting for courier', countKey: 'waiting_for_courier' },
  // Pickup-only, today's "Store Pickup: Ready" filter
  { key: 'store-pickup-ready', label: 'Ready for pickup', countKey: 'ready_for_pickup' },
  { key: 'shipped', label: 'Shipped', countKey: 'shipped' },
  { key: 'completed', label: 'Completed', countKey: 'completed' },
  { key: 'warranty', label: 'Warranty claims', countKey: 'warranty', hot: true },
  { key: 'redeem', label: 'Redeem', countKey: 'redeem', inMore: true },
  { key: 'endorsement', label: 'Endorsements', countKey: 'endorsement', inMore: true },
  { key: 'store-pickup', label: 'Store pickup: all', inMore: true },
  { key: 'store-pickup-picked', label: 'Store pickup: picked up', countKey: 'picked_up', inMore: true },
];

export const PRIMARY_ORDER_TABS = ORDER_TABS.filter((t) => !t.inMore);
export const MORE_ORDER_TABS = ORDER_TABS.filter((t) => t.inMore);

/** Count for a tab, or undefined when counts are not loaded (show no number, never 0). */
export function tabCount(tab: OrderTabDef, counts: OrderCounts | null): number | undefined {
  if (!counts || !tab.countKey) return undefined;
  const value = counts.webstore?.[tab.countKey];
  return typeof value === 'number' ? value : undefined;
}
