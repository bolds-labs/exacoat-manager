import { describe, it, expect } from 'vitest';
import { refreshPlan, tabNeedsOrderList } from './workspaceTabs';

describe('tabNeedsOrderList', () => {
  it('loads the order list only for skin performance', () => {
    expect(tabNeedsOrderList('skin_performance', false)).toBe(true);
  });

  it('does not load it for the dashboard, which loads its own sales data', () => {
    expect(tabNeedsOrderList('dashboard', false)).toBe(false);
  });

  it('does not load it for screens that fetch their own data', () => {
    for (const tab of ['staff', 'orders', 'rma', 'warranty', 'export', 'reports', 'settings', 'configurator', 'products']) {
      expect(tabNeedsOrderList(tab, false)).toBe(false);
    }
  });

  it('does not load it for the design system page', () => {
    expect(tabNeedsOrderList('design_system', false)).toBe(false);
  });

  it('never loads it for shop managers, who cannot open those screens', () => {
    expect(tabNeedsOrderList('dashboard', true)).toBe(false);
    expect(tabNeedsOrderList('skin_performance', true)).toBe(false);
    expect(tabNeedsOrderList('staff', true)).toBe(false);
  });

  it('does not load it for unknown tabs, which fall back to the dashboard', () => {
    expect(tabNeedsOrderList('something-else', false)).toBe(false);
  });
});

describe('refreshPlan', () => {
  it('reloads the order list only where the tab uses it', () => {
    expect(refreshPlan('dashboard', false).orderList).toBe(false);
    expect(refreshPlan('reports', false).orderList).toBe(false);
    expect(refreshPlan('skin_performance', false).orderList).toBe(true);
    expect(refreshPlan('skin_performance', true).orderList).toBe(false);
  });
  it('always refreshes counts and self-loading screens', () => {
    const p = refreshPlan('dashboard', false);
    expect(p.counts).toBe(true);
    expect(p.screens).toBe(true);
  });
});
