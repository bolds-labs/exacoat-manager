/**
 * Exacoat Manager Logistics Export Manager
 * Bridge and client-side utilities for JNE & Goorita exports,
 * file generation, and US shipment WhatsApp/clipboard automation.
 */

import { Order } from '../types';
import { getWordPressBaseUrl } from './env';

export interface ExportStatus {
  jne: {
    pendingCount: number;
    lastGenerated: string | null;
    hasFiles: boolean;
    xlsxUrl: string | null;
    csvUrl: string | null;
  };
  goorita: {
    pendingCount: number;
    lastGenerated: string | null;
    hasFiles: boolean;
    xlsxUrl: string | null;
    uploadPortal: string;
  };
}

export interface ExportGenerationResult {
  success: boolean;
  xlsx_url?: string;
  csv_url?: string;
  file_url?: string;
  count?: number;
  error?: string;
}

/**
 * Format Goorita WhatsApp / Clipboard Shipment Form Text
 */
export function formatGooritaShipmentText(order: Order): string {
  const orderNumber = order.order_number || order.number || String(order.id);
  const fullName = [
    order.shipping?.first_name || order.billing?.first_name || '',
    order.shipping?.last_name || order.billing?.last_name || ''
  ].join(' ').trim() || 'Customer';

  const addressParts = [
    order.shipping?.address_1 || order.billing?.address_1 || '',
    order.shipping?.address_2 || order.billing?.address_2 || '',
    order.shipping?.city || order.billing?.city || '',
    order.shipping?.state || order.billing?.state || '',
    order.shipping?.country || order.billing?.country || '',
    order.shipping?.postcode || order.billing?.postcode || '',
  ].filter(Boolean);
  const address = addressParts.join(', ');

  const phone = order.billing?.phone || order.shipping?.phone || '';
  const email = order.billing?.email || '';

  const items = (order.items && order.items.length > 0) ? order.items : (order.line_items || []);
  const itemsText = items.map((item: any, idx: number) => {
    const name = item.name || 'Custom Skin';
    const qty = Math.max(1, Number(item.quantity) || 1);
    const totalVal = Number(item.total) || 0;
    const unitPrice = totalVal > 0 ? totalVal / qty : 0;
    const currency = (order.currency || 'USD').toUpperCase();
    const priceFormatted = currency === 'USD'
      ? `$${unitPrice.toFixed(2)}`
      : `${unitPrice.toFixed(2)} ${currency}`;
    return `${idx + 1}. ${name} - ${qty}x - ${priceFormatted}`;
  }).join('\n');

  return `FORM SHIPMENT GOORITA

1. DATA PENGIRIM
a. Nama    : Exacoat
b. Alamat  : Ruby Commercial TB12, Jl. Bulevar Selatan, Marga Mulya, Bekasi Utara
c. Telp    : +628975556000
d. Email   : support@exacoat.com

2. DATA PENERIMA
a. Nama         : ${fullName}
b. Alamat       : ${address}
c. Telp         : ${phone}
d. Email        : ${email}
e. Order number : ${orderNumber}

No. Produk
${itemsText}`.trim();
}

/**
 * Open WhatsApp with pre-filled Goorita shipment text
 */
export function openGooritaWhatsApp(order: Order, customPhone = '6281806734618'): void {
  const text = formatGooritaShipmentText(order);
  const encoded = encodeURIComponent(text);
  const waUrl = `https://wa.me/${customPhone}?text=${encoded}`;
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Check export readiness status from WordPress backend
 */
export async function fetchExportStatus(): Promise<{ success: boolean; status?: ExportStatus; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/exports/status?_t=${Date.now()}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, status: data };
    }
    return { success: false, error: data?.error || 'Failed to fetch export status' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error fetching export status' };
  }
}

/**
 * Trigger JNE Export generation on backend
 */
export async function generateJneExportDirect(): Promise<ExportGenerationResult> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/exports/generate-jne`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        xlsx_url: data.xlsx_url,
        csv_url: data.csv_url,
        count: data.count,
      };
    }
    return { success: false, error: data?.error || 'Failed to generate JNE export' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error generating JNE export' };
  }
}

/**
 * Trigger Goorita Export generation on backend
 */
export async function generateGooritaExportDirect(): Promise<ExportGenerationResult> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/exports/generate-goorita`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        file_url: data.file_url,
        count: data.count,
      };
    }
    return { success: false, error: data?.error || 'Failed to generate Goorita export' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error generating Goorita export' };
  }
}
