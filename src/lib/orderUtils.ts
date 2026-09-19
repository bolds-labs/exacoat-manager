import { Order } from '../types';

const STORE_PICKUP_STORAGE_KEY = '_exacoat_store_pickup_orders';

/**
 * Retrieves the set of order IDs manually marked as store pickup in localStorage
 */
export function getLocalStorePickupOrderIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORE_PICKUP_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map(Number).filter((n) => !isNaN(n)));
      }
    }
  } catch {
    // ignore
  }
  return new Set();
}

/**
 * Persists manual store pickup toggle
 */
export function toggleLocalStorePickupOrder(orderId: number, forceState?: boolean): boolean {
  try {
    const set = getLocalStorePickupOrderIds();
    const shouldAdd = forceState !== undefined ? forceState : !set.has(orderId);
    if (shouldAdd) {
      set.add(orderId);
    } else {
      set.delete(orderId);
    }
    localStorage.setItem(STORE_PICKUP_STORAGE_KEY, JSON.stringify(Array.from(set)));
    return shouldAdd;
  } catch {
    return false;
  }
}

/**
 * Comprehensive detection for whether an order is a Store Pickup (SMB) order.
 * Checks WooCommerce method names, method IDs, carrier tags, address fragments,
 * status codes, customer notes, and metadata across both legacy and new schema.
 */
export function isStorePickupOrder(order: Partial<Order> | any): boolean {
  if (!order) return false;

  const orderId = Number(order.id);
  if (orderId && getLocalStorePickupOrderIds().has(orderId)) {
    return true;
  }

  const cleanStatus = String(order.status || '').replace('wc-', '').toLowerCase().trim();
  if (cleanStatus === 'smb-ready' || cleanStatus === 'smb-picked') {
    return true;
  }

  // 1. Check shipping method name & title from various WooCommerce properties
  const shippingMethodName = String(
    order.shipping_method_name ||
    order.shipping_method ||
    order.shipping_lines?.[0]?.method_title ||
    ''
  ).toLowerCase().trim();

  const shippingMethodId = String(
    order.shipping_lines?.[0]?.method_id ||
    ''
  ).toLowerCase().trim();

  // All shipping_lines titles/IDs if multiple
  const allShippingLinesStr = Array.isArray(order.shipping_lines)
    ? order.shipping_lines
        .map((sl: any) => `${sl.method_id || ''} ${sl.method_title || ''}`)
        .join(' ')
        .toLowerCase()
    : '';

  const pickupKeywords = [
    'pickup',
    'pick up',
    'pick-up',
    'local_pickup',
    'local pickup',
    'store pickup',
    'toko',
    'ambil di toko',
    'ambil sendiri',
    'smb',
    'summarecon',
    'self pickup',
    'store collection',
  ];

  for (const kw of pickupKeywords) {
    if (
      shippingMethodName.includes(kw) ||
      shippingMethodId.includes(kw) ||
      allShippingLinesStr.includes(kw)
    ) {
      return true;
    }
  }

  // 2. Check Courier / Carrier info
  const courier = String(order.tracking?.courier || '').toLowerCase().trim();
  const carrierId = String(order.tracking?.carrier_id || '').toLowerCase().trim();
  if (
    courier.includes('pickup') ||
    courier.includes('smb') ||
    courier.includes('store') ||
    carrierId === 'pickup' ||
    carrierId === 'smb'
  ) {
    return true;
  }

  // 3. Check Address strings (often set to Summarecon Bekasi / Ruko Ruby Commercial for store pickup)
  const shipAddr = `${order.shipping?.address_1 || ''} ${order.shipping?.address_2 || ''} ${order.shipping?.city || ''} ${order.shipping?.state || ''} ${order.shipping?.postcode || ''}`.toLowerCase();
  const billAddr = `${order.billing?.address_1 || ''} ${order.billing?.address_2 || ''} ${order.billing?.city || ''} ${order.billing?.state || ''} ${order.billing?.postcode || ''}`.toLowerCase();

  const storeLocationKeywords = [
    'summarecon',
    'bekasi store',
    'ruby commercial',
    'ruko ruby',
    'store pickup',
    'ambil di toko',
  ];

  for (const kw of storeLocationKeywords) {
    if (shipAddr.includes(kw) || billAddr.includes(kw)) {
      return true;
    }
  }

  // 4. Check Order Customer Notes
  const customerNote = String(order.customer_note || '').toLowerCase();
  if (
    customerNote.includes('ambil di toko') ||
    customerNote.includes('store pickup') ||
    customerNote.includes('ambil summarecon') ||
    customerNote.includes('ambil di summarecon')
  ) {
    return true;
  }

  // 5. Check Order Meta Data
  const metaList = Array.isArray(order.meta_data) ? order.meta_data : [];
  for (const m of metaList) {
    const k = String(m?.key || '').toLowerCase();
    const v = String(m?.value || '').toLowerCase();
    if (
      (k === 'is_store_pickup' || k === '_is_store_pickup' || k === '_store_pickup') &&
      (v === '1' || v === 'yes' || v === 'true')
    ) {
      return true;
    }
    if (
      (k === '_shipping_method' || k === '_chosen_shipping_methods' || k === '_order_shipping_type') &&
      (v.includes('pickup') || v.includes('smb') || v.includes('local'))
    ) {
      return true;
    }
    if (k === '_biteship_courier_code' && v === 'pickup') {
      return true;
    }
  }

  return false;
}
