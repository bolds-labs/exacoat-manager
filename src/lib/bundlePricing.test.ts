import { describe, it, expect } from 'vitest';
import { bundlePricingParts, hasBundlePricingParts, setBundleAllPartsPrice, setBundlePartSurcharge } from './bundlePricing';

const layers = [
  { id: 'back-glass', name: 'Back Glass' },
  { id: 'camera', name: 'Camera' },
];

describe('bundle pricing (Camera & Back Glass)', () => {
  it('shows the card for products with a back glass and a camera part', () => {
    expect(hasBundlePricingParts({ layers })).toBe(true);
    expect(hasBundlePricingParts({ layers: [{ id: 'back', name: 'Back' }] })).toBe(false);
    expect(hasBundlePricingParts({ layers: [{ id: 'back', name: 'Back' }], bundle_pricing: { all_parts_price: 1 } })).toBe(true);
  });

  it('lists every part with its surcharge', () => {
    expect(bundlePricingParts({ layers, bundle_pricing: { part_finish_surcharges: { camera: 5000 } } })).toEqual([
      { id: 'back-glass', name: 'Back Glass', surcharge: undefined },
      { id: 'camera', name: 'Camera', surcharge: 5000 },
    ]);
  });

  it('sets and clears values without touching the others', () => {
    let bp = setBundleAllPartsPrice(undefined, 90000);
    bp = setBundlePartSurcharge(bp, 'back-glass', 15000);
    bp = setBundlePartSurcharge(bp, 'camera', 5000);
    expect(bp).toEqual({ all_parts_price: 90000, part_finish_surcharges: { 'back-glass': 15000, camera: 5000 } });
    bp = setBundlePartSurcharge(bp, 'camera', null);
    expect(bp).toEqual({ all_parts_price: 90000, part_finish_surcharges: { 'back-glass': 15000 } });
    bp = setBundleAllPartsPrice(bp, null);
    bp = setBundlePartSurcharge(bp, 'back-glass', null);
    expect(bp).toBeNull();
  });

  it('keeps 0 as a real surcharge and ignores negative or invalid numbers', () => {
    expect(setBundlePartSurcharge(undefined, 'camera', 0)).toEqual({ part_finish_surcharges: { camera: 0 } });
    expect(setBundlePartSurcharge(undefined, 'camera', -5)).toBeNull();
    expect(setBundleAllPartsPrice(undefined, Number.NaN)).toBeNull();
  });

  it('matches layer ids in any case and stores keys the way WordPress does (lowercase)', () => {
    const profile = { layers: [{ id: 'Back-Glass', name: 'Back Glass' }], bundle_pricing: { part_finish_surcharges: { 'back-glass': 15000 } } };
    expect(bundlePricingParts(profile)[0].surcharge).toBe(15000);
    expect(setBundlePartSurcharge({ part_finish_surcharges: { 'back-glass': 15000 } }, 'Back-Glass', 20000)).toEqual({
      part_finish_surcharges: { 'back-glass': 20000 },
    });
  });
});
