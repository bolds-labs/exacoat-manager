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

export interface ResolvedOrderCourier {
  courierId: string;       // preset code: 'sicepat', 'jne', 'pos', 'jnt', 'lion', 'goorita', 'dhl', 'fedex', 'biteship', 'custom'
  courierName: string;     // display name: 'SiCepat', 'JNE Express', 'POS Indonesia', etc.
  serviceName?: string;    // specific service tier: 'BEST', 'REG', 'EZ', etc.
  rawMatch?: string;       // matched source string
  isCustom: boolean;
}

/**
 * Intelligently resolves the intended shipping courier for an order.
 * Inspects customer note (e.g. "Shipping Courier: SICEPAT - BEST"),
 * shipping method name, shipping lines, and order tracking metadata.
 */
export function resolveOrderCourier(order: any): ResolvedOrderCourier {
  if (!order) {
    return { courierId: 'jne', courierName: 'JNE Express', isCustom: false };
  }

  // If this is a store pickup order, return pickup
  if (isStorePickupOrder(order)) {
    return {
      courierId: 'custom',
      courierName: 'Store Pickup (SMB)',
      serviceName: 'Summarecon Bekasi',
      isCustom: true,
    };
  }

  // Gather candidate text sources in prioritized order
  const candidateTexts: string[] = [];

  // 1. Customer note (highest priority because buyer selected shipping at checkout)
  const customerNote = String(order.customer_note || '').trim();
  if (customerNote) {
    const noteMatch = customerNote.match(/shipping courier\s*:\s*([^\r\n]+)/i) ||
                      customerNote.match(/courier\s*:\s*([^\r\n]+)/i) ||
                      customerNote.match(/jasa kirim\s*:\s*([^\r\n]+)/i);
    if (noteMatch && noteMatch[1]) {
      candidateTexts.push(noteMatch[1].trim());
    }
    candidateTexts.push(customerNote);
  }

  // 2. Shipping method name and title
  if (order.shipping_method_name) candidateTexts.push(String(order.shipping_method_name));
  if (order.shipping_method) candidateTexts.push(String(order.shipping_method));

  // 3. Shipping lines items
  if (Array.isArray(order.shipping_lines)) {
    for (const sl of order.shipping_lines) {
      if (sl?.method_title) candidateTexts.push(String(sl.method_title));
      if (sl?.method_id) candidateTexts.push(String(sl.method_id));
    }
  }

  // 4. Order meta data
  if (Array.isArray(order.meta_data)) {
    for (const m of order.meta_data) {
      const k = String(m?.key || '').toLowerCase();
      if (k === 'carrier_id' || k === 'courier' || k === '_biteship_courier_code' || k === 'shipping_carrier') {
        if (m?.value && typeof m.value === 'string') candidateTexts.push(m.value);
      }
    }
  }

  // 5. Backend detected carrier fields if present
  if (order.detected_courier) candidateTexts.push(String(order.detected_courier));
  if (order.shipping_courier_name) candidateTexts.push(String(order.shipping_courier_name));

  // Scan texts for recognized Indonesian & International couriers
  for (const text of candidateTexts) {
    const t = text.toLowerCase();

    // Extract service code if present (e.g. from "SICEPAT - BEST" -> "BEST", "JNE - REG" -> "REG")
    const serviceMatch = text.match(/(?:sicepat|jne|j&t|jnt|pos|lion|goorita|dhl|fedex|anteraja|ninja|spx|shopee)\s*[-:]\s*([A-Za-z0-9_\s]+)/i);
    const serviceName = serviceMatch ? serviceMatch[1].trim().toUpperCase() : undefined;

    if (t.includes('sicepat')) {
      return {
        courierId: 'sicepat',
        courierName: 'SiCepat',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
    if (t.includes('jne')) {
      return {
        courierId: 'jne',
        courierName: 'JNE Express',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
    if (t.includes('j&t') || t.includes('jnt')) {
      return {
        courierId: 'jnt',
        courierName: 'J&T Express',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
    if (t.includes('pos indonesia') || /\bpos\b/.test(t)) {
      return {
        courierId: 'pos',
        courierName: 'POS Indonesia',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
    if (t.includes('lion parcel') || t.includes('lion')) {
      return {
        courierId: 'lion',
        courierName: 'Lion Parcel',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
    if (t.includes('goorita')) {
      return {
        courierId: 'goorita',
        courierName: 'Goorita Send USA',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
    if (t.includes('dhl')) {
      return {
        courierId: 'dhl',
        courierName: 'DHL Express',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
    if (t.includes('fedex')) {
      return {
        courierId: 'fedex',
        courierName: 'FedEx International',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
    if (t.includes('biteship')) {
      return {
        courierId: 'biteship',
        courierName: 'Biteship (Auto)',
        serviceName,
        rawMatch: text,
        isCustom: false,
      };
    }
  }

  // 6. Check tracking object if already saved on the order
  if (order.tracking?.carrier_id) {
    const cid = String(order.tracking.carrier_id).toLowerCase().trim();
    const PRESET_MAP: Record<string, string> = {
      jne: 'JNE Express',
      sicepat: 'SiCepat',
      pos: 'POS Indonesia',
      goorita: 'Goorita Send USA',
      dhl: 'DHL Express',
      fedex: 'FedEx International',
      biteship: 'Biteship (Auto)',
      lion: 'Lion Parcel',
      jnt: 'J&T Express',
    };
    if (PRESET_MAP[cid]) {
      return { courierId: cid, courierName: PRESET_MAP[cid], isCustom: false };
    }
  }

  if (order.tracking?.courier && order.tracking.courier !== 'Express Courier' && order.tracking.courier !== 'JNE Express') {
    return {
      courierId: 'custom',
      courierName: order.tracking.courier,
      isCustom: true,
    };
  }

  // Default fallback
  return { courierId: 'jne', courierName: 'JNE Express', isCustom: false };
}
