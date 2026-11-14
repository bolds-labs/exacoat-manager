import { describe, it, expect } from 'vitest';
import { isCancelledMarketplaceStatus, tikTokOrderMatchesTab } from './marketplaceStatus';

describe('isCancelledMarketplaceStatus', () => {
  it.each(['CANCELLED', 'IN_CANCEL', 'TO_RETURN', 'in_cancel'])('treats %s as cancelled', (s) => {
    expect(isCancelledMarketplaceStatus(s)).toBe(true);
  });

  it.each(['AWAITING_SHIPMENT', 'READY_TO_SHIP', 'IN_TRANSIT', 'COMPLETED', '', undefined, null])(
    'does not treat %s as cancelled',
    (s) => {
      expect(isCancelledMarketplaceStatus(s)).toBe(false);
    }
  );
});

describe('tikTokOrderMatchesTab', () => {
  const cancelled = ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'];

  it('keeps every cancelled status out of the Semua tab', () => {
    for (const st of cancelled) {
      expect(tikTokOrderMatchesTab({ order_status: st }, 'ALL')).toBe(false);
    }
    expect(tikTokOrderMatchesTab({ order_status: 'AWAITING_SHIPMENT' }, 'ALL')).toBe(true);
  });

  it('lists every cancelled status under Dibatalkan and nothing else', () => {
    for (const st of cancelled) {
      expect(tikTokOrderMatchesTab({ order_status: st }, 'CANCELLED')).toBe(true);
    }
    expect(tikTokOrderMatchesTab({ order_status: 'COMPLETED' }, 'CANCELLED')).toBe(false);
  });

  it('never puts cancelled orders in the ready-to-ship tab', () => {
    for (const st of cancelled) {
      expect(tikTokOrderMatchesTab({ order_status: st }, 'READY_TO_SHIP')).toBe(false);
    }
    expect(tikTokOrderMatchesTab({ order_status: 'AWAITING_COLLECTION' }, 'READY_TO_SHIP')).toBe(true);
  });
});
