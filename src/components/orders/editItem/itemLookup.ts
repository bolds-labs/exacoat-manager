import type { Order, OrderItem } from '../../../types';
import { cleanItemTitle } from '../../../lib/orderItems';
import { getRedeemClaimMeta, getWarrantyClaimMeta } from '../../../lib/orderStatus';

/** Placeholder product used by warranty replacement items. */
const WARRANTY_PLACEHOLDER_PRODUCT_ID = 507022;

/** True when the item points at a real WooCommerce product (not a marketplace item id or a placeholder). */
export function isLinkedProductId(id: number | undefined | null): id is number {
  return typeof id === 'number' && id > 0 && id !== WARRANTY_PLACEHOLDER_PRODUCT_ID && id < 1_000_000_000;
}

/** Device name from a marketplace or warranty item title, used to find the webstore product. */
export function extractDeviceKeywords(rawName: string): string {
  if (!rawName) return '';
  let text = cleanItemTitle(rawName).replace(/^(?:\s*\[[^\]]*\]\s*)+/, '');
  text = text.replace(/^(?:Warranty\s*(?:Replacement)?|Redeem|Claim|Replacement)\s*[-:]\s*/gi, '');
  const segments = text.split(/\s*[-|/:]\s*/);
  let bestSegment = segments[0] || text;
  if (/^(?:skin\s*hp|garskin|sticker|case|pelindung)$/i.test(bestSegment.trim()) && segments.length > 1) {
    bestSegment = segments[1];
  }
  return bestSegment
    .replace(/\b(?:Skins?|Garskin|Sticker|Pelindung|Case|Cover|Vinyl|Wrap|Exacoat|Compatible|Premium|3M)\b/gi, ' ')
    .replace(/\((?:Model Cut|360|Full Body|Back Only|Case Friendly)[^)]*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MARKETPLACE = /shopee|tiktok|tokopedia|lazada/i;

/**
 * Warranty, redeem, endorsement and marketplace items carry a price that is not a webstore price, so Edit
 * configuration leaves it alone unless staff press "Use webstore price".
 */
export function keepsOwnPrice(order: Order, item: OrderItem | null): boolean {
  if (getWarrantyClaimMeta(order) || getRedeemClaimMeta(order)) return true;
  const rmaType = String(order.rma?.order_type || '').toLowerCase();
  if (!order.rma?.is_parent_order && (rmaType === 'warranty' || rmaType === 'redeem')) return true;
  const meta = Array.isArray(order.meta_data) ? order.meta_data : [];
  // Same endorsement detection as financialAnalyticsService.
  if (meta.some((m) => (m.key === '_order_badge' && m.value === 'ENDORSEMENT') || (m.key === '_is_endorsement' && m.value === 'yes'))) {
    return true;
  }
  if (meta.some((m) => (m.key === '_rma_marketplace_channel' || m.key === '_marketplace_invoice') && String(m.value ?? '').trim())) {
    return true;
  }
  const via = `${(order as { created_via?: string }).created_via || ''} ${order.payment_method || ''}`;
  if (MARKETPLACE.test(via)) return true;
  if (item && !isLinkedProductId(item.product_id)) return true;
  return false;
}
