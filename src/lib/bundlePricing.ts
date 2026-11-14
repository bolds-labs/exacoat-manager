/**
 * Part bundle prices on a configurator profile (`bundle_pricing`), used by the
 * Camera & Back Glass product page and by the storefront's server-side cart pricing:
 * - all_parts_price: price when every part is selected (Camera & Back Glass: 90,000).
 * - part_finish_surcharges: flat surcharge per layer id for finishes whose extra price
 *   is above 0 (back glass 15,000, camera 5,000; a finish accent price wins on the camera).
 * Single parts keep their normal prices: the product price for the first layer and
 * each layer's own extra price.
 */
export interface BundlePricing {
  all_parts_price?: number;
  part_finish_surcharges?: Record<string, number>;
}

interface ProfileLike {
  layers?: Array<{ id: string; name: string }>;
  bundle_pricing?: BundlePricing | null;
}

const isBackGlass = (l: { id: string; name: string }) => /back[-\s]?glass/i.test(`${l.id} ${l.name}`);
const isCamera = (l: { id: string; name: string }) => /camera/i.test(`${l.id} ${l.name}`);

export function hasBundlePricingParts(profile: ProfileLike): boolean {
  if (profile.bundle_pricing) return true;
  const layers = profile.layers || [];
  return layers.some(isBackGlass) && layers.some(isCamera);
}

export function bundlePricingParts(profile: ProfileLike): Array<{ id: string; name: string; surcharge: number | undefined }> {
  const surcharges = profile.bundle_pricing?.part_finish_surcharges || {};
  return (profile.layers || []).map((l) => ({ id: l.id, name: l.name, surcharge: surcharges[l.id] }));
}

function clean(bp: BundlePricing): BundlePricing | null {
  const out: BundlePricing = {};
  if (typeof bp.all_parts_price === 'number') out.all_parts_price = bp.all_parts_price;
  if (bp.part_finish_surcharges && Object.keys(bp.part_finish_surcharges).length > 0) {
    out.part_finish_surcharges = bp.part_finish_surcharges;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** null clears the value. A price must be above 0. */
export function setBundleAllPartsPrice(current: BundlePricing | null | undefined, value: number | null): BundlePricing | null {
  const next: BundlePricing = { ...(current || {}) };
  if (value === null || !Number.isFinite(value) || value <= 0) delete next.all_parts_price;
  else next.all_parts_price = value;
  return clean(next);
}

/** null clears the value. 0 is a real surcharge (finish adds nothing on this part). */
export function setBundlePartSurcharge(
  current: BundlePricing | null | undefined,
  layerId: string,
  value: number | null,
): BundlePricing | null {
  const parts = { ...(current?.part_finish_surcharges || {}) };
  if (value === null || !Number.isFinite(value) || value < 0) delete parts[layerId];
  else parts[layerId] = value;
  return clean({ ...(current || {}), part_finish_surcharges: parts });
}
