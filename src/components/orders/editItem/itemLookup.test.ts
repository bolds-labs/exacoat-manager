import { describe, expect, it } from 'vitest';
import { extractDeviceKeywords, isLinkedProductId, keepsOwnPrice } from './itemLookup';

describe('extractDeviceKeywords', () => {
  it('reads the device from marketplace titles', () => {
    expect(extractDeviceKeywords('[EXACOAT] Skin HP - iPhone 17 Pro Garskin')).toBe('iPhone 17 Pro');
  });
  it('drops warranty tags and listing words', () => {
    expect(
      extractDeviceKeywords('[Warranty Replacement] Exacoat iPhone 13 Compatible Premium 3M Skin / Garskin - Model 360 - Emerald Green'),
    ).toBe('iPhone 13');
    expect(extractDeviceKeywords('Warranty Replacement - Galaxy S24 Ultra Skins')).toBe('Galaxy S24 Ultra');
  });
});

describe('isLinkedProductId', () => {
  it('rejects placeholders and marketplace ids', () => {
    expect(isLinkedProductId(537268)).toBe(true);
    expect(isLinkedProductId(507022)).toBe(false);
    expect(isLinkedProductId(2_000_000_000)).toBe(false);
    expect(isLinkedProductId(0)).toBe(false);
  });
});

describe('keepsOwnPrice', () => {
  const item = { id: 1, product_id: 537268 } as any;
  it('is false for a plain webstore order', () => {
    expect(keepsOwnPrice({ id: 1, meta_data: [] } as any, item)).toBe(false);
  });
  it('is true for warranty, redeem and marketplace orders', () => {
    expect(keepsOwnPrice({ id: 1, meta_data: [{ key: '_order_badge', value: 'WARRANTY' }] } as any, item)).toBe(true);
    expect(keepsOwnPrice({ id: 1, meta_data: [{ key: '_order_badge', value: 'REDEEM' }] } as any, item)).toBe(true);
    expect(keepsOwnPrice({ id: 1, meta_data: [{ key: '_rma_marketplace_channel', value: 'Shopee' }] } as any, item)).toBe(true);
    expect(keepsOwnPrice({ id: 1, meta_data: [] } as any, { id: 1, product_id: 2_000_000_000 } as any)).toBe(true);
  });
});

describe('keepsOwnPrice for endorsements', () => {
  it('is true for endorsement orders', () => {
    const item = { id: 1, product_id: 537268 } as any;
    expect(keepsOwnPrice({ id: 1, meta_data: [{ key: '_order_badge', value: 'ENDORSEMENT' }] } as any, item)).toBe(true);
    expect(keepsOwnPrice({ id: 1, meta_data: [{ key: '_is_endorsement', value: 'yes' }] } as any, item)).toBe(true);
  });
});
