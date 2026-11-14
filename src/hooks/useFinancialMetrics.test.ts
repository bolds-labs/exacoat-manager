// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { FinancialChannel, UnifiedFinancialRecord } from '../lib/financialAnalyticsService';

vi.mock('../lib/wordpressBridge', () => ({
  fetchOrdersDirect: vi.fn(async () => ({ success: true, orders: [] })),
  fetchShopeeOrdersDirect: vi.fn(async () => ({ success: true, orders: [] })),
  fetchTikTokOrdersDirect: vi.fn(async () => ({ success: true, orders: [] })),
  syncShopeeOrdersDirect: vi.fn(async () => ({ success: true, orders: [] })),
  syncTikTokOrdersDirect: vi.fn(async () => ({ success: true, orders: [] })),
}));

import { buildPeriodComparison, useFinancialMetrics } from './useFinancialMetrics';
import { emitWorkspaceRefresh } from '../lib/workspaceRefresh';
import * as bridge from '../lib/wordpressBridge';

afterEach(cleanup);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CUR = { startMs: 10 * DAY, endMs: 11 * DAY - 1 };
const PREV = { startMs: 9 * DAY, endMs: 10 * DAY - 1 };

function rec(channel: FinancialChannel, timestamp: number, gross: number): UnifiedFinancialRecord {
  return {
    id: `${channel}-${timestamp}`,
    orderNumber: String(timestamp),
    channel,
    timestamp,
    dateIso: '',
    dateFormatted: '',
    dateTimeFormatted: '',
    grossRevenue: gross,
    potentialGrossRevenue: gross,
    originalProductPrice: gross,
    sellerDiscount: 0,
    sellerVoucher: 0,
    platformSubsidy: 0,
    platformFee: 0,
    commissionFee: 0,
    serviceFee: 0,
    transactionFee: 0,
    affiliateCommission: 0,
    otherPlatformFee: 0,
    cleanRevenue: gross,
    potentialCleanRevenue: gross,
    escrowSynced: true,
    shippingAndFees: 0,
    buyerPaidAmount: gross,
    potentialBuyerPaidAmount: gross,
    netRevenue: gross,
    refundedAmount: 0,
    currency: 'IDR',
    status: 'completed',
    statusNormalized: 'paid',
    isPaid: true,
    hadPayTime: true,
    itemsCount: 1,
    items: [],
    customerName: 'Buyer',
  };
}

const records = [
  rec('webstore', CUR.startMs + HOUR, 120),
  rec('webstore', PREV.startMs + HOUR, 100),
  rec('shopee', CUR.startMs + HOUR, 50),
  rec('shopee', PREV.startMs + HOUR, 50),
];
const complete = { webstore: null, shopee: null, tiktok: null };
const ALL: FinancialChannel[] = ['webstore', 'shopee', 'tiktok'];

describe('buildPeriodComparison', () => {
  it('compares when every channel loaded and reaches back', () => {
    const r = buildPeriodComparison(records, ALL, CUR, PREV, complete);
    expect(r.covered).toBe(true);
    expect(r.metrics.sales.state).toBe('up');
    expect(r.comparable).toBe(true);
  });

  it('treats a failed channel as no history, for totals and for that channel', () => {
    const r = buildPeriodComparison(records, ALL, CUR, PREV, complete, ['tiktok']);
    expect(r.covered).toBe(false);
    expect(r.metrics.sales.state).toBe('no-history');
    expect(r.channelSales.tiktok.state).toBe('no-history');
    expect(r.channelSales.webstore.state).toBe('up');
    expect(r.comparable).toBe(true);
  });

  it('ignores a failed channel that is not selected', () => {
    const r = buildPeriodComparison(records, ['webstore'], CUR, PREV, complete, ['tiktok']);
    expect(r.covered).toBe(true);
    expect(r.metrics.sales.state).toBe('up');
  });

  it('is not comparable at all when every selected channel failed', () => {
    const r = buildPeriodComparison([], ALL, CUR, PREV, complete, ALL);
    expect(r.comparable).toBe(false);
  });

  it('marks a marketplace cache that starts 10 hours into the previous window as no history', () => {
    const r = buildPeriodComparison(records, ALL, CUR, PREV, { ...complete, shopee: PREV.startMs + 10 * HOUR });
    expect(r.metrics.sales.state).toBe('no-history');
    expect(r.channelSales.shopee.state).toBe('no-history');
  });
});

describe('useFinancialMetrics', () => {
  it('reloads when the app-wide refresh fires', async () => {
    const fetchOrders = vi.mocked(bridge.fetchOrdersDirect);
    fetchOrders.mockClear();
    const { result } = renderHook(() => useFinancialMetrics());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchOrders).toHaveBeenCalledTimes(1);
    await act(async () => {
      emitWorkspaceRefresh();
    });
    await waitFor(() => expect(fetchOrders).toHaveBeenCalledTimes(2));
  });
});
