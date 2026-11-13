import { Order } from '../types';
import { renderPdfFirstPageToImage } from './pdfRenderer';
import { getGooritaAwbDocumentUrl, authenticatedFetch } from './wordpressBridge';

const awbImageCache = new Map<string, string>();

/**
 * Check if the order is shipped via Goorita or has Goorita AWB metadata
 */
export function isGooritaOrder(order?: Order | null): boolean {
  if (!order) return false;

  // Domestic consolidation shipments sent TO Goorita HQ are handled by domestic couriers (JNE)
  const isConsolidation = Boolean(
    (order.meta_data || []).some((m: any) => m.key === '_is_consolidation_order' && (m.value === 'yes' || m.value === true || m.value === '1')) ||
    (order.meta_data || []).some((m: any) => m.key === '_goorita_consolidated_orders' && Array.isArray(m.value) && m.value.length > 0) ||
    String(order.shipping?.company || '').toLowerCase().includes('goorita')
  );
  if (isConsolidation) return false;

  const carrier = (order.tracking?.carrier_id || order.tracking?.courier || '').toLowerCase();
  const methodId = (order.shipping_lines?.[0]?.method_id || '').toLowerCase();
  const methodTitle = (order.shipping_lines?.[0]?.method_title || '').toLowerCase();
  const hasMeta = Boolean(
    order.goorita_order_id ||
    order.goorita_awb_url ||
    (order.meta_data || []).some((m: any) => m.key === '_goorita_order_id' || m.key === '_goorita_awb_url')
  );

  return carrier === 'goorita' || methodId.includes('goorita') || methodTitle.includes('goorita') || hasMeta;
}

/**
 * Check if the order has an existing booked Goorita AWB
 */
export function isOrderGooritaBooked(order?: Order | null): boolean {
  if (!order) return false;

  const isConsolidation = Boolean(
    (order.meta_data || []).some((m: any) => m.key === '_is_consolidation_order' && (m.value === 'yes' || m.value === true || m.value === '1')) ||
    (order.meta_data || []).some((m: any) => m.key === '_goorita_consolidated_orders' && Array.isArray(m.value) && m.value.length > 0) ||
    String(order.shipping?.company || '').toLowerCase().includes('goorita')
  );
  if (isConsolidation) return false;

  return Boolean(
    getOrderGooritaAwbUrl(order) ||
    order.goorita_order_id ||
    (order.meta_data || []).some((m: any) => (m.key === '_goorita_order_id' || m.key === 'goorita_order_id') && m.value)
  );
}

/**
 * Get resolved Goorita AWB URL from order properties or meta_data
 */
export function getOrderGooritaAwbUrl(order?: Order | null): string | null {
  if (!order) return null;
  if (order.goorita_awb_url && order.goorita_awb_url.startsWith('http')) {
    return order.goorita_awb_url;
  }
  const meta = (order.meta_data || []).find(
    (m: any) => (m.key === '_goorita_awb_url' || m.key === 'goorita_awb_url') && m.value
  );
  if (meta && typeof meta.value === 'string' && meta.value.startsWith('http')) {
    return meta.value;
  }
  return null;
}

/**
 * Load and render the Goorita official AWB PDF to a high-resolution PNG data URL
 */
export async function loadGooritaAwbImage(order: Order): Promise<string | null> {
  const awbUrl = getOrderGooritaAwbUrl(order);
  const cacheKey = `goorita-awb-${order.id}-${awbUrl || 'none'}`;

  if (awbImageCache.has(cacheKey)) {
    return awbImageCache.get(cacheKey)!;
  }

  // Fetch through the exacoat-core proxy, which holds the Goorita key server-side
  try {
    const proxyUrl = getGooritaAwbDocumentUrl(order.id);
    const response = await authenticatedFetch(proxyUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const dataUrl = await renderPdfFirstPageToImage(arrayBuffer, cacheKey);
      awbImageCache.set(cacheKey, dataUrl);
      return dataUrl;
    } else {
      console.warn(`Proxy Goorita AWB fetch returned HTTP ${response.status}`);
    }
  } catch (err) {
    console.warn('Proxy Goorita AWB fetch failed:', err);
  }

  return null;
}
