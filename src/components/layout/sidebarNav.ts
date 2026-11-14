import {
  LayoutDashboard, FileText, Activity, Settings, ShieldCheck, Bot, Mail, FlaskConical, ShoppingBag,
  Star, Layers, Sliders, FileSpreadsheet, Package, UserCog, Share2, Tag, Users, ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import type { ExacoatRole } from '../../types';

export type NavItemKey =
  | 'dashboard'
  | 'staff'
  | 'orders'
  | 'custom_label'
  | 'customers'
  | 'products'
  | 'rma'
  | 'warranty'
  | 'export'
  | 'tracking_pool'
  | 'configurator'
  | 'materials'
  | 'reviews'
  | 'reports'
  | 'skin_performance'
  | 'ai_tools'
  | 'emails'
  | 'marketing_emails'
  | 'affiliates'
  | 'team'
  | 'testing'
  | 'health'
  | 'audit'
  | 'settings'
  | 'design_system';

export interface NavItem {
  key: NavItemKey;
  label: string;
  icon: LucideIcon;
  children?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const SHOP_MANAGER_ALLOWED_TABS: NavItemKey[] = ['staff', 'orders', 'custom_label', 'reviews', 'rma', 'warranty', 'export', 'tracking_pool'];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'staff', label: 'Staff dashboard', icon: ClipboardList },
      {
        key: 'orders',
        label: 'Orders',
        icon: ShoppingBag,
        children: [
          { key: 'orders', label: 'All Orders', icon: ShoppingBag },
          { key: 'custom_label', label: 'Custom Label', icon: Tag },
          { key: 'rma', label: 'RMA Claims', icon: Layers },
          { key: 'export', label: 'Export Shipments', icon: FileSpreadsheet },
          { key: 'tracking_pool', label: 'Tracking Pool', icon: Package },
        ],
      },
      { key: 'reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { key: 'products', label: 'Products', icon: Package },
      { key: 'configurator', label: 'Configurator Studio', icon: Sliders },
      { key: 'materials', label: 'Materials & Stock', icon: Layers },
    ],
  },
  {
    label: 'Growth',
    items: [
      { key: 'reports', label: 'Sales & Reports', icon: FileText },
      { key: 'skin_performance', label: 'Skin Performance', icon: Layers },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'affiliates', label: 'Affiliates', icon: Share2 },
      {
        key: 'marketing_emails',
        label: 'Email Hub',
        icon: Mail,
        children: [
          { key: 'marketing_emails', label: 'Marketing Studio', icon: Mail },
          { key: 'emails', label: 'Transactional Templates', icon: Mail },
        ],
      },
      { key: 'ai_tools', label: 'AI Tools', icon: Bot },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'team', label: 'Team Roles', icon: UserCog },
      { key: 'testing', label: 'Testing Sandbox', icon: FlaskConical },
      { key: 'health', label: 'Store Health', icon: Activity },
      { key: 'audit', label: 'Audit Logs', icon: ShieldCheck },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function navForRole(role: ExacoatRole): NavGroup[] {
  if (role !== 'shop_manager') return NAV_GROUPS;
  const allowed = (k: NavItemKey) => SHOP_MANAGER_ALLOWED_TABS.includes(k);
  return NAV_GROUPS
    .map((g) => ({
      label: g.label,
      items: g.items
        .filter((i) => allowed(i.key))
        .map((i) => (i.children ? { ...i, children: i.children.filter((c) => allowed(c.key)) } : i)),
    }))
    .filter((g) => g.items.length > 0);
}

export const getTabHref = (key: NavItemKey): string => {
  if (typeof window === 'undefined') return `#${key}`;
  if (window.location.pathname.includes('admin.php') || window.location.search.includes('page=exacoat-manager')) {
    return `admin.php?page=exacoat-manager#${key}`;
  }
  return `/#${key}`;
};

export function groupLabelForTab(tab: NavItemKey): string {
  for (const g of NAV_GROUPS) {
    for (const i of g.items) {
      if (i.key === tab || i.children?.some((c) => c.key === tab)) return g.label;
    }
  }
  return 'Operations';
}
