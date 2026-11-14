/**
 * Screens that load their own data. Everything else renders the dashboard,
 * which needs the recent-orders list.
 */
const SELF_LOADING_TABS = new Set([
  'orders', 'custom_label', 'customers', 'rma', 'warranty', 'export', 'tracking_pool',
  'products', 'configurator', 'materials', 'reviews', 'reports', 'marketing_emails',
  'emails', 'affiliates', 'ai_tools', 'team', 'testing', 'health', 'audit', 'settings',
  'design_system',
]);

/** Whether the app-wide recent-orders list (a large download) is needed for this tab. */
export function tabNeedsOrderList(tab: string, isShopManager: boolean): boolean {
  if (isShopManager) return false;
  return !SELF_LOADING_TABS.has(tab);
}
