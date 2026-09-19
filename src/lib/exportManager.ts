/**
 * Exacoat Manager Logistics Export Manager
 * Bridge and client-side utilities for JNE & Goorita exports,
 * file generation, and US shipment WhatsApp/clipboard automation.
 */

import { Order } from '../types';
import { getWordPressBaseUrl } from './env';
import { authenticatedFetch, fetchPluginSettings, savePluginSettings } from './wordpressBridge';

export interface ExportStatus {
  jne: {
    pendingCount: number;
    lastGenerated: string | null;
    hasFiles: boolean;
    xlsxUrl: string | null;
    csvUrl: string | null;
    lastEmailSent?: {
      time: string;
      to: string[];
      cc: string[];
      subject: string;
      attachments_sent: string[];
    } | null;
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
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: 'Invalid response from server' };
    }
    if (res.ok && data?.success) {
      return { success: true, status: data };
    }
    return { success: false, error: data?.error || data?.message || 'Failed to fetch export status' };
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
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: 'Invalid response from server' };
    }
    if (res.ok && data?.success) {
      return {
        success: true,
        xlsx_url: data.xlsx_url,
        csv_url: data.csv_url,
        count: data.count,
      };
    }
    return { success: false, error: data?.error || data?.message || 'Failed to generate JNE export' };
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
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: 'Invalid response from server' };
    }
    if (res.ok && data?.success) {
      return {
        success: true,
        file_url: data.file_url,
        count: data.count,
      };
    }
    return { success: false, error: data?.error || data?.message || 'Failed to generate Goorita export' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error generating Goorita export' };
  }
}

/**
 * JNE Batch Export Email Configuration
 */
export interface JneEmailConfig {
  recipients: string;
  cc: string;
  subject: string;
  body: string;
}

export const DEFAULT_JNE_EMAIL_CONFIG: JneEmailConfig = {
  recipients: 'bki.project@jne.co.id,bki.ccc1@jne.co.id,bayuriskanda83@gmail.com',
  cc: 'exacoat.cs@gmail.com',
  subject: '{date} - econnote exacoat',
  body: 'Dear Mas Bayu,\n\nBerikut kami lampirkan Master Data dan Data Loader pengiriman exacoat untuk hari ini.\n\nMohon diproses, terima kasih!',
};

export const JNE_EMAIL_CONFIG_STORAGE_KEY = 'exacoat_jne_email_config';

/**
 * Format date as YYYY.MM.DD
 */
export function getFormattedExportDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

/**
 * Build mailto link for sending JNE batch exports
 */
export function buildJneMailtoUrl(config?: Partial<JneEmailConfig>, date?: Date): string {
  const activeRecipients = config?.recipients?.trim() || DEFAULT_JNE_EMAIL_CONFIG.recipients;
  const activeCc = config?.cc !== undefined ? config.cc.trim() : DEFAULT_JNE_EMAIL_CONFIG.cc;
  const activeSubject = config?.subject?.trim() || DEFAULT_JNE_EMAIL_CONFIG.subject;
  const activeBody = config?.body !== undefined ? config.body : DEFAULT_JNE_EMAIL_CONFIG.body;

  const dateStr = getFormattedExportDate(date || new Date());
  const resolvedSubject = activeSubject.replace(/{date}/gi, dateStr);
  const resolvedBody = activeBody.replace(/{date}/gi, dateStr);

  const cleanRecipients = activeRecipients
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .join(',');

  const cleanCc = activeCc
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .join(',');

  const params = new URLSearchParams();
  if (cleanCc) {
    params.set('cc', cleanCc);
  }
  params.set('subject', resolvedSubject);
  params.set('body', resolvedBody);

  return `mailto:${cleanRecipients}?${params.toString()}`;
}

/**
 * Load JNE email configuration from localStorage and WordPress settings
 */
export async function loadJneEmailConfig(): Promise<JneEmailConfig> {
  let resolved: JneEmailConfig = { ...DEFAULT_JNE_EMAIL_CONFIG };

  // 1. First check local storage for instant sync
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(JNE_EMAIL_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        resolved = {
          recipients: parsed.recipients?.trim() || DEFAULT_JNE_EMAIL_CONFIG.recipients,
          cc: parsed.cc !== undefined ? parsed.cc.trim() : DEFAULT_JNE_EMAIL_CONFIG.cc,
          subject: parsed.subject?.trim() || DEFAULT_JNE_EMAIL_CONFIG.subject,
          body: parsed.body !== undefined ? parsed.body : DEFAULT_JNE_EMAIL_CONFIG.body,
        };
      }
    } catch {
      // Non-critical local storage parse error
    }
  }

  // 2. Fetch server configuration from WordPress settings
  try {
    const res = await fetchPluginSettings();
    if (res.success && res.settings) {
      const s = res.settings;
      if (s.jne_email_recipients || s.jne_email_cc || s.jne_email_subject || s.jne_email_body !== undefined) {
        resolved = {
          recipients: s.jne_email_recipients?.trim() || resolved.recipients,
          cc: s.jne_email_cc !== undefined ? s.jne_email_cc.trim() : resolved.cc,
          subject: s.jne_email_subject?.trim() || resolved.subject,
          body: s.jne_email_body !== undefined ? s.jne_email_body : resolved.body,
        };

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(JNE_EMAIL_CONFIG_STORAGE_KEY, JSON.stringify(resolved));
          } catch {
            // Non-critical storage quota error
          }
        }
      }
    }
  } catch {
    // Non-critical server fetch error, keep local configuration
  }

  return resolved;
}

/**
 * Save JNE email configuration to localStorage and WordPress server
 */
export async function saveJneEmailConfig(config: JneEmailConfig): Promise<{ success: boolean; error?: string }> {
  // 1. Immediately cache in local storage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(JNE_EMAIL_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Non-critical local storage save error
    }
  }

  // 2. Persist to WordPress exacoat_core_settings
  try {
    const res = await savePluginSettings({
      jne_email_recipients: config.recipients,
      jne_email_cc: config.cc,
      jne_email_subject: config.subject,
      jne_email_body: config.body,
    });
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed saving JNE email settings to WordPress' };
  }
}

export interface SendJneEmailResult {
  success: boolean;
  message?: string;
  error?: string;
  recipients?: string;
  cc?: string;
  attachments_sent?: string[];
  sent_at?: string;
}

/**
 * Trigger automated email dispatch to JNE from WordPress server with attached XLSX & CSV
 */
export async function sendJneEmailDirect(params?: {
  recipients?: string;
  cc?: string;
  subject?: string;
  body?: string;
}): Promise<SendJneEmailResult> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/exports/send-jne-email`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params || {}),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: 'Invalid response from server' };
    }

    if (res.ok && data?.success) {
      return {
        success: true,
        message: data.message || 'Email sent with attachments',
        recipients: data.recipients,
        cc: data.cc,
        attachments_sent: data.attachments_sent,
        sent_at: data.sent_at,
      };
    }

    return {
      success: false,
      error: data?.error || data?.message || 'Failed to send JNE export email via server',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while sending JNE export email',
    };
  }
}
