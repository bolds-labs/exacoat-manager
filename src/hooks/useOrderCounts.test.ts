// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { OrderCounts } from '../types';

let impl: () => Promise<unknown> = async () => ({ success: false });
let calls = 0;
vi.mock('../lib/wordpressBridge', () => ({
  fetchOrderCountsDirect: () => {
    calls += 1;
    return impl();
  },
}));

import { useOrderCounts } from './useOrderCounts';

const sample: OrderCounts = {
  webstore: {
    all: 10, awaiting_payment: 1, to_prepare: 4, preparing: 2, waiting_for_courier: 0,
    ready_for_pickup: 0, picked_up: 0, shipped: 1, completed: 2, warranty: 0,
    warranty_pending: 3, redeem: 0, endorsement: 0,
  },
  shipped_last_7_days: 5,
  channels: { webstore: 10, shopee: 2, tiktok: 1 },
};

describe('useOrderCounts', () => {
  beforeEach(() => {
    calls = 0;
    impl = async () => ({ success: false });
  });

  it('sets counts on success', async () => {
    impl = async () => ({ success: true, counts: sample });
    const { result } = renderHook(() => useOrderCounts());
    await waitFor(() => expect(result.current.counts).toEqual(sample));
    expect(result.current.loaded).toBe(true);
  });

  it('keeps counts null when the request resolves unsuccessfully', async () => {
    impl = async () => ({ success: false });
    const { result } = renderHook(() => useOrderCounts());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.counts).toBeNull();
  });

  it('keeps counts null and does not throw when the request rejects', async () => {
    impl = () => Promise.reject(new Error('boom'));
    const { result } = renderHook(() => useOrderCounts());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.counts).toBeNull();
  });

  it('refresh refetches', async () => {
    impl = async () => ({ success: false });
    const { result } = renderHook(() => useOrderCounts());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    impl = async () => ({ success: true, counts: sample });
    await act(async () => { await result.current.refresh(); });
    expect(calls).toBe(2);
    expect(result.current.counts).toEqual(sample);
  });
});
