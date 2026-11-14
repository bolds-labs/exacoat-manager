import { describe, it, expect } from 'vitest';
import { tabNeedsOrderList } from './workspaceTabs';

describe('tabNeedsOrderList', () => {
  it('loads the order list for the dashboard and skin performance', () => {
    expect(tabNeedsOrderList('dashboard', false)).toBe(true);
    expect(tabNeedsOrderList('skin_performance', false)).toBe(true);
  });

  it('does not load it for screens that fetch their own data', () => {
    for (const tab of ['orders', 'rma', 'warranty', 'export', 'reports', 'settings', 'configurator', 'products']) {
      expect(tabNeedsOrderList(tab, false)).toBe(false);
    }
  });

  it('never loads it for shop managers, who cannot open those screens', () => {
    expect(tabNeedsOrderList('dashboard', true)).toBe(false);
    expect(tabNeedsOrderList('skin_performance', true)).toBe(false);
  });

  it('loads it for unknown tabs, which fall back to the dashboard', () => {
    expect(tabNeedsOrderList('something-else', false)).toBe(true);
  });
});
