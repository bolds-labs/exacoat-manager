import { Order } from '../types';
import { renderPdfFirstPageToImage } from './pdfRenderer';
import { getGooritaAwbDocumentUrl } from './wordpressBridge';
import { GOORITA_CONFIG } from './gooritaService';

const awbImageCache = new Map<string, string>();

/**
 * Check if the order is shipped via Goorita or has Goorita AWB metadata
 */
export function isGooritaOrder(order?: Order | null): boolean {
  if (!order) return false;
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

  // 1. Try direct fetch from Goorita API with Bearer token
  if (awbUrl) {
    try {
      const apiKey = GOORITA_CONFIG.PROD_API_KEY;
      const response = await fetch(awbUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const dataUrl = await renderPdfFirstPageToImage(arrayBuffer, cacheKey);
        awbImageCache.set(cacheKey, dataUrl);
        return dataUrl;
      } else {
        console.warn(`Direct Goorita AWB fetch returned HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn('Direct Goorita AWB fetch failed, attempting proxy fallback:', err);
    }
  }

  // 2. Fallback: Fetch via Exacoat WordPress proxy endpoint
  try {
    const proxyUrl = getGooritaAwbDocumentUrl(order.id);
    const response = await fetch(proxyUrl);
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
