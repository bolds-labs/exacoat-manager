import { describe, it, expect } from 'vitest';
import { getShopeeStatusMeta, getTikTokStatusMeta } from './marketplaceStatus';

describe('getShopeeStatusMeta', () => {
  it.each([
    ['READY_TO_SHIP', 'Perlu Diproses', 'act'],
    ['UNPAID', 'Belum Bayar', 'wait'],
    ['PROCESSED', 'Telah Diproses', 'prog'],
    ['SHIPPED', 'Dikirim', 'prog'],
    ['TO_CONFIRM_RECEIVE', 'Telah Sampai', 'done'],
    ['COMPLETED', 'Selesai', 'done'],
    ['CANCELLED', 'Dibatalkan', 'stop'],
    ['IN_CANCEL', 'Dibatalkan', 'stop'],
    ['TO_RETURN', 'Pengembalian', 'stop'],
  ])('maps %s to %s (%s)', (status, label, family) => {
    const meta = getShopeeStatusMeta({ order_status: status });
    expect(meta.label).toBe(label);
    expect(meta.family).toBe(family);
    expect(meta.key).toBe(status);
  });

  it('is case-insensitive', () => {
    expect(getShopeeStatusMeta({ order_status: 'ready_to_ship' }).family).toBe('act');
  });

  it('falls back to neutral with the raw label for unknown statuses', () => {
    const meta = getShopeeStatusMeta({ order_status: 'SOMETHING_NEW' });
    expect(meta.family).toBe('neutral');
    expect(meta.label).toBe('SOMETHING_NEW');
    expect(meta.icon).toBeTruthy();
  });

  it('labels a missing status N/A', () => {
    const meta = getShopeeStatusMeta({ order_status: '' });
    expect(meta.family).toBe('neutral');
    expect(meta.label).toBe('N/A');
  });
});

describe('getTikTokStatusMeta', () => {
  it.each([
    ['AWAITING_SHIPMENT', 'Perlu Diproses', 'act'],
    ['READY_TO_SHIP', 'Perlu Diproses', 'act'],
    ['UNPAID', 'Belum Bayar', 'wait'],
    ['AWAITING_COLLECTION', 'Menunggu Penjemputan', 'prog'],
    ['IN_TRANSIT', 'Dalam Pengiriman', 'prog'],
    ['SHIPPED', 'Dalam Pengiriman', 'prog'],
    ['DELIVERED', 'Telah Sampai', 'done'],
    ['COMPLETED', 'Selesai', 'done'],
    ['CANCELLED', 'Dibatalkan', 'stop'],
    ['IN_CANCEL', 'Dibatalkan', 'stop'],
    ['TO_RETURN', 'Pengembalian', 'stop'],
  ])('maps %s to %s (%s)', (status, label, family) => {
    const meta = getTikTokStatusMeta({ order_status: status });
    expect(meta.label).toBe(label);
    expect(meta.family).toBe(family);
  });

  it('falls back to neutral with the raw label for unknown statuses', () => {
    const meta = getTikTokStatusMeta({ order_status: 'PARTIALLY_SHIPPING' });
    expect(meta.family).toBe('neutral');
    expect(meta.label).toBe('PARTIALLY_SHIPPING');
  });
});
