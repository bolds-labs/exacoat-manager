import { Order } from '../types';
import { matchesPhoneQuery } from './phoneUtils';

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


  // 1. Check if checkout customer note or shipping lines explicitly specify courier delivery
  const customerNote = String(order.customer_note || '').toLowerCase();
  const isExplicitCourierNote = customerNote.includes('shipping courier:') ||
    customerNote.includes('jasa kirim:') ||
    customerNote.includes('courier:');

  // 2. Check shipping method name & title from various WooCommerce properties
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

  // If a standard courier was explicitly selected at checkout (e.g. SICEPAT, JNE, POS), it is NOT store pickup
  const courierBrands = ['sicepat', 'jne', 'pos', 'j&t', 'jnt', 'lion', 'tiki', 'anteraja', 'goorita', 'dhl', 'fedex', 'biteship'];
  const hasCourierBrand = courierBrands.some(brand => 
    shippingMethodName.includes(brand) || 
    shippingMethodId.includes(brand) || 
    allShippingLinesStr.includes(brand) ||
    customerNote.includes(`courier: ${brand}`) ||
    customerNote.includes(`courier: ${brand.toUpperCase()}`)
  );

  if (hasCourierBrand && !shippingMethodName.includes('pickup') && !shippingMethodId.includes('pickup')) {
    return false;
  }

  const pickupKeywords = [
    'local_pickup',
    'local pickup',
    'store pickup',
    'store_pickup',
    'ambil di toko',
    'ambil sendiri',
    'self pickup',
    'self_pickup',
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

  // 3. Check Courier / Carrier info
  const courier = String(order.tracking?.courier || '').toLowerCase().trim();
  const carrierId = String(order.tracking?.carrier_id || '').toLowerCase().trim();
  if (
    courier === 'pickup' ||
    courier === 'store pickup' ||
    carrierId === 'pickup' ||
    carrierId === 'local_pickup'
  ) {
    return true;
  }

  // 4. Check Order Customer Notes (only if NOT an explicit courier note)
  if (!isExplicitCourierNote) {
    if (
      customerNote.includes('ambil di toko') ||
      customerNote.includes('store pickup') ||
      customerNote.includes('ambil sendiri')
    ) {
      return true;
    }
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
      (v.includes('pickup') || v.includes('local_pickup'))
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

    // Extract service code if present (e.g. from "SICEPAT - BEST" -> "BEST", "JNE - REG" -> "REG", "JNE (REG)" -> "REG")
    const serviceMatch = text.match(/(?:sicepat|jne|j&t|jnt|pos|lion|goorita|dhl|fedex|anteraja|ninja|spx|shopee)\s*[-:]\s*([A-Za-z0-9_\s]+)/i) ||
                         text.match(/(?:sicepat|jne|j&t|jnt|pos|lion|goorita|dhl|fedex|anteraja|ninja|spx|shopee)\s*\(([A-Za-z0-9_\s]+)\)/i);
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

/**
 * Formats a clean, professional courier and service tier display for an order.
 * E.g. "JNE - REG", "SiCepat - BEST", "POS - Pos Reguler", "Goorita", "Store Pickup (SMB)"
 */
export function getOrderCourierDisplay(order: any): string {
  if (!order) return 'Courier';
  if (isStorePickupOrder(order)) return 'Store Pickup (SMB)';

  // If backend already resolved a formatted courier like "JNE - REG", use it directly
  const backendCourier = String(order.tracking?.courier || order.shipping_courier_name || '').trim();
  if (backendCourier && backendCourier.includes('-') && !backendCourier.toLowerCase().includes('unknown')) {
    return backendCourier;
  }

  const resolved = resolveOrderCourier(order);

  // If a specific service tier was detected (e.g. "REG", "BEST", "YES")
  if (resolved.serviceName) {
    let prefix = 'Courier';
    if (resolved.courierId === 'jne') prefix = 'JNE';
    else if (resolved.courierId === 'sicepat') prefix = 'SiCepat';
    else if (resolved.courierId === 'pos') prefix = 'POS';
    else if (resolved.courierId === 'goorita') prefix = 'Goorita';
    else if (resolved.courierId === 'dhl') prefix = 'DHL';
    else if (resolved.courierId === 'fedex') prefix = 'FedEx';
    else if (resolved.courierName) prefix = resolved.courierName.split(' ')[0];

    return `${prefix} - ${resolved.serviceName}`;
  }

  // If raw match already has courier and service code separated by hyphen
  if (resolved.rawMatch && resolved.rawMatch.includes('-')) {
    const cleanMatch = resolved.rawMatch
      .replace(/^(?:shipping courier|jasa kirim|courier)\s*:\s*/i, '')
      .trim();
    if (cleanMatch.includes('-')) {
      const parts = cleanMatch.split('-').map(s => s.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        let p0 = parts[0];
        const p0Lower = p0.toLowerCase();
        if (p0Lower.includes('jne')) p0 = 'JNE';
        else if (p0Lower.includes('sicepat')) p0 = 'SiCepat';
        else if (p0Lower.includes('pos')) p0 = 'POS';
        else if (p0Lower.includes('goorita')) p0 = 'Goorita';
        return `${p0} - ${parts.slice(1).join('-').trim().toUpperCase()}`;
      }
    }
  }

  if (backendCourier && backendCourier !== 'Express Courier') {
    if (backendCourier.toLowerCase() === 'jne express') return 'JNE';
    return backendCourier;
  }

  if (resolved.courierId === 'jne') return 'JNE';
  return resolved.courierName || order.shipping_method_name || 'Courier';
}

/**
 * Comprehensive client-side order search matching across:
 * - Order number & ID (#1234, 1234)
 * - Customer name (customer_name, billing first/last, shipping first/last)
 * - Customer email (customer_email, billing email)
 * - Phone numbers (with digit normalization via matchesPhoneQuery)
 * - Tracking / resi numbers (tracking object and metadata)
 * - Destination & billing address (address_1, address_2, city, state, postcode, country)
 * - Ordered items (item names, variations, attributes, finish, SKU)
 * - Courier and service tier (JNE - REG, SiCepat - BEST, etc.)
 * - Customer note
 */
export function matchesOrderSearch(order: any, query: string): boolean {
  if (!order || !query || !query.trim()) return true;

  const q = query.toLowerCase().trim();
  const cleanQ = q.replace(/^#+/, '');

  // 1. Order ID & Order Number
  const num = String(order.order_number || order.id || '').toLowerCase().replace(/^#+/, '');
  if (num.includes(cleanQ)) return true;

  // 2. Customer Name (direct, shipping, billing)
  const custName = String(order.customer_name || '').toLowerCase();
  const billFirst = String(order.billing?.first_name || '').toLowerCase();
  const billLast = String(order.billing?.last_name || '').toLowerCase();
  const shipFirst = String(order.shipping?.first_name || '').toLowerCase();
  const shipLast = String(order.shipping?.last_name || '').toLowerCase();
  if (
    custName.includes(q) ||
    billFirst.includes(q) ||
    billLast.includes(q) ||
    `${billFirst} ${billLast}`.trim().includes(q) ||
    shipFirst.includes(q) ||
    shipLast.includes(q) ||
    `${shipFirst} ${shipLast}`.trim().includes(q)
  ) {
    return true;
  }

  // 3. Customer Email
  const custEmail = String(order.customer_email || order.billing?.email || '').toLowerCase();
  if (custEmail.includes(q)) return true;

  // 4. Phone (using matchesPhoneQuery for international/local format tolerance)
  const phone = order.customer_phone || order.billing?.phone || order.shipping?.phone;
  if (phone) {
    const rawPhone = String(phone).toLowerCase();
    if (rawPhone.includes(q) || matchesPhoneQuery(phone, q)) return true;
  }

  // 5. Tracking / Resi
  const trackNum = String(order.tracking?.tracking_number || '').toLowerCase();
  if (trackNum && trackNum.includes(q)) return true;
  if (Array.isArray(order.meta_data)) {
    const hasTrackMeta = order.meta_data.some((m: any) => {
      const k = String(m?.key || '').toLowerCase();
      if (k.includes('tracking') || k.includes('carrier') || k === '_ywot_tracking_code') {
        return String(m?.value || '').toLowerCase().includes(q);
      }
      return false;
    });
    if (hasTrackMeta) return true;
  }

  // 6. Destination & Billing Address
  const addrFields = [
    order.shipping?.address_1,
    order.shipping?.address_2,
    order.shipping?.city,
    order.shipping?.state,
    order.shipping?.postcode,
    order.shipping?.country,
    order.billing?.address_1,
    order.billing?.address_2,
    order.billing?.city,
    order.billing?.state,
    order.billing?.postcode,
    order.billing?.country,
  ];
  if (addrFields.some((f) => f && String(f).toLowerCase().includes(q))) {
    return true;
  }

  // 7. Items (Name, SKU, variation metadata, custom options)
  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : (Array.isArray(order.line_items) ? order.line_items : []);

  const itemsMatched = items.some((item: any) => {
    const itemName = String(item.name || '').toLowerCase();
    const itemSku = String(item.sku || '').toLowerCase();
    const itemMeta = String(item.meta || (Array.isArray(item.meta_data) ? JSON.stringify(item.meta_data) : '')).toLowerCase();
    return itemName.includes(q) || itemSku.includes(q) || itemMeta.includes(q);
  });
  if (itemsMatched) return true;

  // 8. Courier & Shipping Method
  const courierDisplay = getOrderCourierDisplay(order).toLowerCase();
  const shipMethod = String(order.shipping_method_name || order.shipping_method || '').toLowerCase();
  if (courierDisplay.includes(q) || shipMethod.includes(q)) return true;

  // 9. Customer Note
  const custNote = String(order.customer_note || '').toLowerCase();
  if (custNote.includes(q)) return true;

  return false;
}


