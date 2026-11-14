import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, SHOP_MANAGER_ALLOWED_TABS, navForRole, type NavItem } from './sidebarNav';

const keysOf = (groups: { items: NavItem[] }[]) => {
  const out: string[] = [];
  const walk = (items: NavItem[]) => items.forEach((i) => { out.push(i.key); if (i.children) walk(i.children); });
  groups.forEach((g) => walk(g.items));
  return out;
};

// Every key today's Sidebar.tsx shows for a non-shop role.
const LEGACY_FULL_KEYS = [
  'dashboard', 'orders', 'custom_label', 'rma', 'export', 'tracking_pool', 'products', 'configurator',
  'materials', 'reviews', 'reports', 'skin_performance', 'customers', 'affiliates', 'marketing_emails',
  'emails', 'ai_tools', 'team', 'testing', 'health', 'audit', 'settings',
];

describe('navForRole', () => {
  it('shop_manager only sees allowed tabs', () => {
    const keys = keysOf(navForRole('shop_manager'));
    expect(keys.length).toBeGreaterThan(0);
    keys.forEach((k) => expect(SHOP_MANAGER_ALLOWED_TABS).toContain(k));
    expect(keys).toContain('orders');
    expect(keys).toContain('reviews');
  });
  it('shows the Staff dashboard first in Operations for shop managers and admins', () => {
    const shop = navForRole('shop_manager');
    expect(shop[0].label).toBe('Operations');
    expect(shop[0].items[0].key).toBe('staff');
    const admin = navForRole('super_admin');
    expect(admin[0].items.map((i) => i.key).slice(0, 2)).toEqual(['dashboard', 'staff']);
  });
  it('super_admin sees every legacy key', () => {
    const keys = keysOf(navForRole('super_admin'));
    LEGACY_FULL_KEYS.forEach((k) => expect(keys).toContain(k));
  });
  it('never shows the hidden design_system tab', () => {
    expect(keysOf(NAV_GROUPS)).not.toContain('design_system');
  });
  it('has no empty groups for any role', () => {
    (['super_admin', 'manager', 'shop_manager', 'affiliate'] as const).forEach((r) => {
      const groups = navForRole(r);
      expect(groups.length).toBeGreaterThan(0);
      groups.forEach((g) => expect(g.items.length).toBeGreaterThan(0));
    });
  });
});
