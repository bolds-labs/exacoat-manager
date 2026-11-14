import { afterEach, describe, it, expect } from 'vitest';
import {
  getOrderStatusMeta,
  getWarrantyClaimMeta,
  getStatusSteps,
  getCurrentStepIndex,
  setStatusLabelOverrides,
} from './orderStatus';

const pickup = { is_store_pickup: true } as const;

describe('getOrderStatusMeta', () => {
  it.each([
    ['pending', 'Pending payment', 'wait'],
    ['on-hold', 'Waiting for Payment', 'wait'],
    ['pending-payment', 'Pending payment', 'wait'],
    ['processing', 'Payment confirmed', 'act'],
    ['preparing-order', 'Preparing order', 'prog'],
    ['in-production', 'In Production', 'prog'],
    ['ready-to-ship', 'Waiting for Courier Pickup', 'prog'],
    ['awaiting-pickup', 'Awaiting Courier Pickup', 'prog'],
    ['smb-ready', 'SMB Ready (Store Pickup)', 'prog'],
    ['smb-picked', 'SMB Picked (Store Collected)', 'done'],
    ['shipped', 'Shipped', 'prog'],
    ['delivered', 'Delivered', 'done'],
    ['completed', 'Completed', 'done'],
    ['cancelled', 'Cancelled', 'stop'],
    ['refunded', 'Refunded', 'stop'],
    ['failed', 'Failed', 'stop'],
  ])('maps %s to %s (%s)', (status, label, family) => {
    const meta = getOrderStatusMeta({ status });
    expect(meta.label).toBe(label);
    expect(meta.family).toBe(family);
    expect(meta.icon).toBeTruthy();
  });

  it('strips the wc- prefix', () => {
    expect(getOrderStatusMeta({ status: 'wc-processing' }).label).toBe('Payment confirmed');
  });

  it('uses the WooCommerce status name for store pickup orders too', () => {
    expect(getOrderStatusMeta({ status: 'smb-ready', ...pickup }).label).toBe('SMB Ready (Store Pickup)');
    const done = getOrderStatusMeta({ status: 'completed', ...pickup });
    expect(done.label).toBe('Completed');
    expect(done.family).toBe('done');
  });

  it('falls back to a neutral humanised label for unknown statuses', () => {
    const meta = getOrderStatusMeta({ status: 'awaiting-qc' });
    expect(meta.label).toBe('Awaiting qc');
    expect(meta.family).toBe('neutral');
  });
});

describe('setStatusLabelOverrides', () => {
  afterEach(() => setStatusLabelOverrides(null));

  it('uses the store WooCommerce names for chips and steps when provided', () => {
    setStatusLabelOverrides({ 'wc-on-hold': 'Menunggu', processing: 'Paid' });
    expect(getOrderStatusMeta({ status: 'on-hold' }).label).toBe('Menunggu');
    expect(getStatusSteps({ status: 'processing' }).map((s) => s.label).slice(0, 2)).toEqual(['Menunggu', 'Paid']);
  });

  it('keeps the default names for statuses without an override', () => {
    setStatusLabelOverrides({ processing: 'Paid' });
    expect(getOrderStatusMeta({ status: 'shipped' }).label).toBe('Shipped');
  });
});

describe('getWarrantyClaimMeta', () => {
  it('returns null for non-warranty orders', () => {
    expect(getWarrantyClaimMeta({ status: 'processing' })).toBeNull();
  });

  it('prefers rma.status over stale warranty_claim_status', () => {
    const meta = getWarrantyClaimMeta({
      rma: { order_type: 'Warranty', status: 'approved' },
      warranty_claim_status: 'pending',
    } as any);
    expect(meta).toEqual({ label: 'Approved', family: 'done' });
  });

  it('maps pending and in_review to Pending', () => {
    for (const s of ['pending', 'in_review']) {
      expect(
        getWarrantyClaimMeta({ rma: { order_type: 'warranty', status: s } } as any)
      ).toEqual({ label: 'Pending', family: 'act' });
    }
  });

  it('maps rejected to Rejected', () => {
    expect(
      getWarrantyClaimMeta({ rma: { order_type: 'Warranty', status: 'rejected' } } as any)
    ).toEqual({ label: 'Rejected', family: 'stop' });
  });

  it('detects warranty orders through meta and falls back to warranty_claim_status', () => {
    const meta = getWarrantyClaimMeta({
      meta_data: [{ key: '_order_badge', value: 'WARRANTY' }],
      warranty_claim_status: 'rejected',
    } as any);
    expect(meta?.label).toBe('Rejected');
  });
});

describe('getStatusSteps and getCurrentStepIndex', () => {
  it('returns the courier flow', () => {
    const steps = getStatusSteps({ status: 'processing' });
    expect(steps.map((s) => s.label)).toEqual([
      'Waiting for Payment', 'Payment confirmed', 'Preparing order', 'Waiting for Courier Pickup', 'Shipped', 'Completed',
    ]);
    expect(steps.map((s) => s.status)).toEqual([
      'on-hold', 'processing', 'preparing-order', 'ready-to-ship', 'shipped', 'completed',
    ]);
  });

  it('returns the pickup flow', () => {
    const steps = getStatusSteps({ status: 'processing', ...pickup });
    expect(steps.map((s) => s.label)).toEqual([
      'Waiting for Payment', 'Payment confirmed', 'Preparing order', 'SMB Ready (Store Pickup)', 'Completed',
    ]);
    expect(steps.map((s) => s.status)).toEqual([
      'on-hold', 'processing', 'preparing-order', 'smb-ready', 'completed',
    ]);
  });

  it('computes the current step index', () => {
    const idx = (o: any) => getCurrentStepIndex(o, getStatusSteps(o));
    expect(idx({ status: 'processing' })).toBe(1);
    expect(idx({ status: 'pending' })).toBe(0);
    expect(idx({ status: 'delivered' })).toBe(5);
    expect(idx({ status: 'in-production' })).toBe(2);
    expect(idx({ status: 'awaiting-pickup' })).toBe(3);
    expect(idx({ status: 'smb-picked', ...pickup })).toBe(4);
    expect(idx({ status: 'ready-to-ship', ...pickup })).toBe(3);
    expect(idx({ status: 'cancelled' })).toBe(-1);
  });
});
