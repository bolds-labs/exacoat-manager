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

/**
 * What the app-wide Refresh reloads: store counts and self-loading screens (through
 * workspaceRefresh) always, the large order list only where the tab uses it.
 */
export function refreshPlan(tab: string, isShopManager: boolean): { counts: boolean; screens: boolean; orderList: boolean } {
  return { counts: true, screens: true, orderList: tabNeedsOrderList(tab, isShopManager) };
}
