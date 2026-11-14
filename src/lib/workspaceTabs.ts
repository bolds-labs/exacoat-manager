/**
 * Screens that use the app-wide recent-orders list (latest 500 webstore orders, a large download).
 * Every other screen, including the dashboard and the unknown-tab fallback to it, loads its own data.
 */
const ORDER_LIST_TABS = new Set(['skin_performance']);

/** Whether the app-wide recent-orders list is needed for this tab. */
export function tabNeedsOrderList(tab: string, isShopManager: boolean): boolean {
  if (isShopManager) return false;
  return ORDER_LIST_TABS.has(tab);
}
