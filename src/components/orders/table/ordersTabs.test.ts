import { describe, expect, it } from 'vitest';
import { ORDER_TABS } from './ordersTabs';

// Filter keys the pre-redesign OrderTable.tsx tab row and Store Pickup dropdown sent to the server
const TODAY_KEYS = [
  'all',
  'on-hold',
  'processing',
  'preparing-order',
  'ready-to-ship',
  'shipped',
  'completed',
  'warranty',
  'redeem',
  'endorsement',
  'store-pickup',
  'store-pickup-ready',
  'store-pickup-picked',
];

describe('ORDER_TABS', () => {
  it('contains every filter key supported today exactly once', () => {
    const keys = ORDER_TABS.map((t) => t.key);
    for (const key of TODAY_KEYS) {
      expect(keys.filter((k) => k === key)).toHaveLength(1);
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...TODAY_KEYS].sort());
  });

  it('shows the nine primary tabs in order before the More items', () => {
    const primary = ORDER_TABS.slice(0, 9);
    expect(primary.map((t) => t.label)).toEqual([
      'All',
      'Awaiting payment',
      'Payment confirmed',
      'Preparing order',
      'Waiting for Courier Pickup',
      'Ready for pickup',
      'Shipped',
      'Completed',
      'Warranty claims',
    ]);
    expect(primary.every((t) => !t.inMore)).toBe(true);
    expect(ORDER_TABS.slice(9).every((t) => t.inMore)).toBe(true);
  });

  it('maps Waiting for courier to the old Waiting for Pickup key and Ready for pickup to store pickup ready', () => {
    expect(ORDER_TABS.find((t) => t.label === 'Waiting for Courier Pickup')?.key).toBe('ready-to-ship');
    expect(ORDER_TABS.find((t) => t.label === 'Ready for pickup')?.key).toBe('store-pickup-ready');
  });

  it('marks exactly Awaiting payment, Payment confirmed and Warranty claims as hot', () => {
    expect(ORDER_TABS.filter((t) => t.hot).map((t) => t.label)).toEqual([
      'Awaiting payment',
      'Payment confirmed',
      'Warranty claims',
    ]);
  });

  it('uses the warranty count key for Warranty claims', () => {
    expect(ORDER_TABS.find((t) => t.key === 'warranty')?.countKey).toBe('warranty');
  });
});
