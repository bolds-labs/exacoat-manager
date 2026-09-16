/**
 * Exacoat Manager - WordPress & WooCommerce Bridge
 * Direct communication bridge with exacoat-core REST endpoints and WooCommerce API.
 * Strict Antislop compliant: No em dashes in copy or notifications.
 */

import { getEnv, getWordPressBaseUrl, getWcCredentials } from './env';
import { CreateReviewPayload, Order, OrderItem, OrderTracking, DeviceConfiguratorProfile, ConfiguratorProfileSummary, DeviceFamily } from '../types';


// ==========================================
// Types & Interfaces
// ==========================================

export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
  billing?: any;
  shipping?: any;
  is_paying_customer?: boolean;
  orders_count?: number;
  total_spent?: string;
  avatar_url?: string;
  [key: string]: any;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  status: string;
  price: string;
  regular_price: string;
  sale_price: string;
  images: Array<{ id: number; src: string; name?: string; alt?: string }>;
  categories: Array<{ id: number; name: string; slug: string }>;
  is_configurable?: boolean;
  has_acowebs_wcpa?: boolean;
  wcpa_form_ids?: number[];
  configurator_layers?: any[];
  configurator_content?: any;
  [key: string]: any;
}

export interface WordPressSiteHealth {
  status: 'online' | 'offline' | 'warning';
  plugin_version?: string;
  site_name?: string;
  site_url?: string;
  wp_version?: string;
  wc_version?: string;
  php_version?: string;
  active_modules?: {
    configurator_engine?: boolean;
    shipping_tracker?: boolean;
    review_rewards?: boolean;
    materials_inventory?: boolean;
  };
  pending_sync_jobs?: number;
  latencyMs?: number;
  endpoint?: string;
  totalOrders?: number;
  totalProducts?: number;
  error?: string;
  timestamp?: string;
}

export interface WordPressPluginSettings {
  pushover_app_token?: string;
  pushover_user_key?: string;
  pushover_enabled?: number;
  pushover_notify_new_sale?: number;
  pushover_notify_inventory?: number;
  pushover_notify_errors?: number;
  cloudflare_zone_id?: string;
  cloudflare_api_token?: string;
  email_from_name?: string;
  email_from_address?: string;
  email_webhook_url?: string;
  webhook_secret_key?: string;
  gemini_api_key?: string;
  openai_api_key?: string;
  [key: string]: any;
}

export interface PrivateSettingStatus {
  has_pushover_app_token?: boolean;
  has_pushover_user_key?: boolean;
  has_cloudflare_api_token?: boolean;
  has_webhook_secret_key?: boolean;
  has_gemini_api_key?: boolean;
  has_openai_api_key?: boolean;
  [key: string]: any;
}

export interface CatalogReconciliationResult {
  success: boolean;
  message?: string;
  scope: {
    scanned: number;
    total: number;
    page: number;
    complete: boolean;
    example_limit: number;
    [key: string]: any;
  };
  issues: Array<{
    id?: string | number;
    type: string;
    description: string;
    label: string;
    count: number;
    wp_ids: any[];
    artwork_ids: any[];
    examples: any[];
    details?: any;
    [key: string]: any;
  }>;
  notes?: string[];
  total_checked?: number;
  fixed_count?: number;
}

export interface WordPressSystemLog {
  id: string | number;
  level: 'info' | 'warning' | 'error' | 'success';
  channel: string;
  message: string;
  context?: any;
  created_at: string;
}

export interface WordPressLogsResponse {
  success: boolean;
  data?: {
    logs?: WordPressSystemLog[];
    stats?: {
      total: number;
      errors: number;
      warnings: number;
      success: number;
      info: number;
    };
    [key: string]: any;
  } | WordPressSystemLog[];
  logs?: WordPressSystemLog[];
  stats: {
    total: number;
    errors: number;
    warnings: number;
    success: number;
    info: number;
  };
  error?: string;
  message?: string;
}

export interface SalesAnalyticsCurrency {
  currency: string;
  summary: {
    gross_sales: number;
    net_sales: number;
    net_revenue: number;
    total_orders: number;
    orders: number;
    average_order_value: number;
    items_sold: number;
    items_per_order: number;
    shipping_total: number;
    refund_rate: number;
    unique_customers: number;
    [key: string]: any;
  };
  orders: any[];
  timeline: Array<{ date: string; revenue: number; orders: number; [key: string]: any }>;
  countries: Array<{ country: string; code: string; revenue: number; orders: number; [key: string]: any }>;
  top_customers: Array<{ name: string; email: string; spent: number; orders: number; [key: string]: any }>;
  products: Array<SalesAnalyticsProduct>;
  [key: string]: any;
}

export interface SalesAnalyticsProduct {
  product_id: number;
  name: string;
  revenue: number;
  quantity: number;
  image_url?: string;
}

export interface ReviewRewardSettings {
  enabled: boolean;
  discount_percent: number;
  coupon_prefix: string;
  expiry_days: number;
}

export interface GlobalFinish {
  id: string;
  name: string;
  group: string;
  slug: string;
  thumbnail: string;
  in_stock: boolean;
  extra_price: number;
  class_name?: string;
}

export const DEFAULT_GLOBAL_FINISHES: GlobalFinish[] = [
  { id: 'swarm', name: 'Swarm', group: 'Signature skins', slug: 'swarm', thumbnail: '/images/finishes/signature/swarm.png', in_stock: true, extra_price: 0 },
  { id: 'black-camo', name: 'Black Camo', group: 'Signature skins', slug: 'black-camo', thumbnail: '/images/finishes/signature/black-camo.png', in_stock: true, extra_price: 0 },
  { id: 'patina', name: 'Patina', group: 'Signature skins', slug: 'patina', thumbnail: '/images/finishes/signature/patina.png', in_stock: true, extra_price: 0 },
  { id: 'slate', name: 'Slate', group: 'Signature skins', slug: 'slate', thumbnail: '/images/finishes/signature/slate.png', in_stock: true, extra_price: 0 },
  { id: 'dragon-black', name: 'Dragon Black', group: 'Signature skins', slug: 'dragon-black', thumbnail: '/images/finishes/signature/dragon-black.png', in_stock: true, extra_price: 0 },
  { id: 'carbon-fiber-black', name: 'Carbon Fiber Black', group: 'Signature skins', slug: 'carbon-fiber-black', thumbnail: '/images/finishes/signature/carbon-fiber-black.png', in_stock: true, extra_price: 0 },
  { id: 'forged-carbon', name: 'Forged Carbon', group: 'Signature skins', slug: 'forged-carbon', thumbnail: '/images/finishes/signature/forged-carbon.png', in_stock: true, extra_price: 0 },
  { id: 'woven', name: 'Woven', group: 'Signature skins', slug: 'woven', thumbnail: '/images/finishes/signature/woven.png', in_stock: true, extra_price: 0 },
  { id: 'matte-black', name: 'Matte Black', group: 'Pastels & Colors', slug: 'matte-black', thumbnail: '/images/finishes/colors/matte-black.png', in_stock: true, extra_price: 0 },
  { id: 'matte-white', name: 'Matte White', group: 'Pastels & Colors', slug: 'matte-white', thumbnail: '/images/finishes/colors/matte-white.png', in_stock: true, extra_price: 0 },
  { id: 'arctic-blue', name: 'Arctic Blue', group: 'Pastels & Colors', slug: 'arctic-blue', thumbnail: '/images/finishes/colors/arctic-blue.png', in_stock: true, extra_price: 0 },
  { id: 'glacial-green', name: 'Glacial Green', group: 'Pastels & Colors', slug: 'glacial-green', thumbnail: '/images/finishes/colors/glacial-green.png', in_stock: true, extra_price: 0 },
  { id: 'mellow-yellow', name: 'Mellow Yellow', group: 'Pastels & Colors', slug: 'mellow-yellow', thumbnail: '/images/finishes/colors/mellow-yellow.png', in_stock: true, extra_price: 0 },
  { id: 'petal-pink', name: 'Petal Pink', group: 'Pastels & Colors', slug: 'petal-pink', thumbnail: '/images/finishes/colors/petal-pink.png', in_stock: true, extra_price: 0 },
  { id: 'blush-pink', name: 'Blush Pink', group: 'Pastels & Colors', slug: 'blush-pink', thumbnail: '/images/finishes/colors/blush-pink.png', in_stock: true, extra_price: 0 },
  { id: 'emerald-green', name: 'Emerald Green', group: 'Pastels & Colors', slug: 'emerald-green', thumbnail: '/images/finishes/colors/emerald-green.png', in_stock: true, extra_price: 0 },
  { id: 'lust-red', name: 'Lust Red', group: 'Pastels & Colors', slug: 'lust-red', thumbnail: '/images/finishes/colors/lust-red.png', in_stock: true, extra_price: 0 },
  { id: 'lemon-yellow', name: 'Lemon Yellow', group: 'Pastels & Colors', slug: 'lemon-yellow', thumbnail: '/images/finishes/colors/lemon-yellow.png', in_stock: true, extra_price: 0 },
  { id: 'marble-white', name: 'Marble White', group: 'Special editions', slug: 'marble-white', thumbnail: '/images/finishes/special/marble-white.png', in_stock: true, extra_price: 0 },
  { id: 'leather-black', name: 'Leather Black', group: 'Special editions', slug: 'leather-black', thumbnail: '/images/finishes/special/leather-black.png', in_stock: true, extra_price: 0 },
  { id: 'titanium-black', name: 'Titanium Black', group: 'Special editions', slug: 'titanium-black', thumbnail: '/images/finishes/special/titanium-black.png', in_stock: true, extra_price: 0 }
];

// ==========================================
// Authentication & Fetch Helpers
// ==========================================

export function getWpBaseUrl(): string {
  return getWordPressBaseUrl();
}

function getAuthHeader(): Record<string, string> {
  try {
    const session = typeof localStorage !== 'undefined' ? localStorage.getItem('exacoat_admin_session') : null;
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed?.token) {
        return { Authorization: `Bearer ${parsed.token}` };
      }
    }
  } catch {}

  const { key, secret } = getWcCredentials();
  if (key && secret) {
    const creds = typeof btoa !== 'undefined' ? btoa(`${key}:${secret}`) : '';
    if (creds) {
      return { Authorization: `Basic ${creds}` };
    }
  }
  return {};
}

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as any).url;
  const baseUrl = getWordPressBaseUrl();

  let isWordPressRequest = false;
  let targetUrlObj: URL | null = null;
  try {
    const defaultOrigin = globalThis.location?.origin || baseUrl;
    targetUrlObj = new URL(urlStr, defaultOrigin);
    const targetUrl = new URL(baseUrl, defaultOrigin);
    isWordPressRequest = (targetUrlObj.origin === targetUrl.origin) || (targetUrlObj.origin === defaultOrigin && targetUrlObj.pathname.startsWith('/cms/'));
  } catch {
    isWordPressRequest = false;
  }

  let finalInput: RequestInfo | URL = input;

  if (isWordPressRequest && targetUrlObj) {
    const auth = getAuthHeader();
    if (auth.Authorization && !headers.has('Authorization')) {
      headers.set('Authorization', auth.Authorization);
    }

    // Attach WooCommerce credentials to /wp-json/wc/ requests if not using JWT Bearer
    if (targetUrlObj.pathname.includes('/wp-json/wc/') && !auth.Authorization?.startsWith('Bearer')) {
      const { key, secret } = getWcCredentials();
      if (key && secret && !targetUrlObj.searchParams.has('consumer_key')) {
        targetUrlObj.searchParams.set('consumer_key', key);
        targetUrlObj.searchParams.set('consumer_secret', secret);
        finalInput = targetUrlObj.toString();
      }
    }
  }

  return globalThis.fetch(finalInput, {
    ...init,
    headers,
  });
}

const SETTINGS_CACHE_KEY = 'exacoat_wp_settings_cache';

export function getCachedPluginSettings(): WordPressPluginSettings {
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function setCachedPluginSettings(settings: Partial<WordPressPluginSettings>): void {
  try {
    const current = getCachedPluginSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged));
  } catch {}
}

// ==========================================
// Order Parsers & Normalizers
// ==========================================

function parseConfiguratorFromItem(item: any): any[] {
  if (!item.meta_data || !Array.isArray(item.meta_data)) return [];

  const rawMeta = item.meta_data.find((m: any) => m.key === '_configurator_data_raw' || m.key === '_configurator_data');
  if (rawMeta && rawMeta.value) {
    if (Array.isArray(rawMeta.value)) {
      return rawMeta.value.map((v: any) => ({
        layer_id: v.layer_data?.layer_id || v.layer_id,
        layer_name: v.layer_data?.layer_name || v.layer_data?.name || v.layer_name || 'Layer',
        choice_id: v.layer_data?.choice_id || v.choice_id,
        name: v.layer_data?.name || v.name || 'Custom',
        image: v.layer_data?.image || v.image,
        is_choice: v.is_choice,
      }));
    }
  }

  const configMeta = item.meta_data.find((m: any) => m.key === 'Configuration');
  if (configMeta && configMeta.display_value) {
    const text = String(configMeta.display_value);
    const parts = text.split(/(?=Back:|Accents:|Camera:|Additional Camera:|Model:|Frame:|Trackpad:|Logo:)/i);
    return parts.map((p, idx) => {
      const [key, ...rest] = p.split(':');
      return {
        layer_id: idx,
        layer_name: (key || 'Layer').trim(),
        name: rest.join(':').trim(),
      };
    }).filter(c => c.name);
  }

  return [];
}

function enrichOrder(order: any): Order {
  const metaList = order.meta_data || [];
  const trackingMeta = metaList.find((m: any) => m.key === 'tracking_number');
  const carrierMeta = metaList.find((m: any) => m.key === '_shipping_carrier');
  const districtMeta = metaList.find((m: any) => m.key === '_shipping_district');
  const subdistrictMeta = metaList.find((m: any) => m.key === '_shipping_subdistrict');
  const phoneMeta = metaList.find((m: any) => m.key === '_shipping_phone_formatted' || m.key === '_billing_phone');

  const lineItems = (order.line_items || []).map((item: any) => ({
    ...item,
    parsed_configurator: parseConfiguratorFromItem(item),
  }));

  const tracking: OrderTracking | null = trackingMeta?.value && trackingMeta.value !== '⚠️' ? {
    courier: carrierMeta?.value ? String(carrierMeta.value) : 'Standard',
    tracking_number: String(trackingMeta.value),
  } : null;

  return {
    ...order,
    order_number: order.number || String(order.id),
    items: lineItems,
    item_count: lineItems.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0),
    tracking,
    shipping_district: districtMeta?.value ? String(districtMeta.value) : undefined,
    shipping_subdistrict: subdistrictMeta?.value ? String(subdistrictMeta.value) : undefined,
    formatted_phone: phoneMeta?.value ? String(phoneMeta.value) : undefined,
  };
}

// ==========================================
// System Health & Diagnostics
// ==========================================

export async function fetchWordPressSiteHealth(): Promise<WordPressSiteHealth> {
  const start = performance.now();
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/health?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const latency = Math.round(performance.now() - start);

    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        status: data.status || 'online',
        latencyMs: latency,
        endpoint: base,
      };
    }

    return {
      status: 'offline',
      latencyMs: latency,
      endpoint: base,
      error: `HTTP ${res.status} response from store`,
    };
  } catch (err: any) {
    return {
      status: 'offline',
      latencyMs: Math.round(performance.now() - start),
      endpoint: base,
      error: err.message || 'Failed connecting to store',
    };
  }
}

export async function fetchSiteHealthDirect(): Promise<WordPressSiteHealth> {
  return fetchWordPressSiteHealth();
}

export async function pingWordPressPlugin(): Promise<{ success: boolean; latencyMs: number; latency_ms?: number; message?: string; version?: string }> {
  const start = performance.now();
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/ping?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      const data = await res.json();
      return { success: true, latencyMs: latency, latency_ms: latency, version: data.version, message: data.message };
    }
    return { success: false, latencyMs: latency, latency_ms: latency, message: `HTTP ${res.status}` };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { success: false, latencyMs: latency, latency_ms: latency, message: err.message };
  }
}

export async function runCatalogReconciliation(page = 1, perPage = 100): Promise<CatalogReconciliationResult> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/diagnostics/catalog-reconciliation?page=${page}&per_page=${perPage}&_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Reconciliation failed',
      scope: { scanned: 0, total: 0, page, complete: true, example_limit: perPage },
      issues: [],
    };
  }
}

// ==========================================
// Settings & Config
// ==========================================

export async function fetchPluginSettings(): Promise<{ success: boolean; settings?: WordPressPluginSettings; secret_status?: PrivateSettingStatus; secretStatus?: PrivateSettingStatus; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/settings?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data.settings) setCachedPluginSettings(data.settings);
      const secretStatus = data.secret_status || data.secretStatus;
      return { success: true, settings: data.settings, secret_status: secretStatus, secretStatus };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function savePluginSettings(settings: Partial<WordPressPluginSettings>): Promise<{ success: boolean; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/settings`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setCachedPluginSettings(settings);
      return { success: true };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function purgeCloudflareCacheDirect(zoneId?: string, target = 'all'): Promise<{ success: boolean; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/cache/cloudflare/purge`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ zone_id: zoneId, target }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testCloudflareCacheDirect(token?: string): Promise<{ success: boolean; zone_name?: string; latencyMs?: number; latency_ms?: number; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/diagnostics/test-cloudflare`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    return {
      ...data,
      zone_name: data.zone_name || 'exacoat.com',
      latencyMs: data.latencyMs || data.latency_ms,
      latency_ms: data.latency_ms || data.latencyMs,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function flushWordPressPermalinks(): Promise<{ success: boolean; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/system/flush-permalinks`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function revertWordPressMedia(): Promise<{ success: boolean; message?: string; moved_count?: number; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/system/revert-media`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// Integrations & Diagnostics
// ==========================================

export async function testPushoverDirect(appToken?: string, userKey?: string): Promise<{ success: boolean; latencyMs?: number; latency_ms?: number; message?: string; error?: string }> {
  const start = performance.now();
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/diagnostics/test-pushover`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ app_token: appToken, user_key: userKey }),
    });
    const latency = Math.round(performance.now() - start);
    const data = await res.json();
    return {
      ...data,
      latencyMs: data.latencyMs || latency,
      latency_ms: data.latency_ms || latency,
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { success: false, latencyMs: latency, latency_ms: latency, error: err.message };
  }
}

export async function sendPushoverAlert(title: string, message: string, priority = 0, sound = 'pushover'): Promise<{ success: boolean; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/notifications/pushover`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ title, message, priority, sound }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testGeminiDirect(apiKey?: string): Promise<{
  success: boolean;
  latencyMs?: number;
  latency_ms?: number;
  available_models?: string[];
  message?: string;
  error?: string;
}> {
  const start = performance.now();
  const key = (apiKey || getCachedPluginSettings().gemini_api_key || '').trim();
  if (!key) {
    return { success: false, error: 'Gemini API key is required' };
  }

  try {
    const res = await authenticatedFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json' },
    });
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models.map((m: any) => (m.name || '').replace('models/', '')) : ['gemini-1.5-flash', 'gemini-1.5-pro'];
      return {
        success: true,
        latencyMs: latency,
        latency_ms: latency,
        available_models: models,
        message: 'Google Gemini API key valid',
      };
    }
    return { success: false, latencyMs: latency, latency_ms: latency, error: `HTTP ${res.status}` };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { success: false, latencyMs: latency, latency_ms: latency, error: err.message };
  }
}

export async function testOpenAiDirect(apiKey?: string): Promise<{
  success: boolean;
  latencyMs?: number;
  latency_ms?: number;
  available_models?: string[];
  message?: string;
  error?: string;
}> {
  const start = performance.now();
  const key = (apiKey || getCachedPluginSettings().openai_api_key || '').trim();
  if (!key) {
    return { success: false, error: 'OpenAI API key is required' };
  }

  try {
    const res = await authenticatedFetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data.data) ? data.data.map((m: any) => m.id) : ['gpt-4o', 'gpt-4o-mini'];
      return {
        success: true,
        latencyMs: latency,
        latency_ms: latency,
        available_models: models,
        message: 'OpenAI API key valid',
      };
    }
    return { success: false, latencyMs: latency, latency_ms: latency, error: `HTTP ${res.status}` };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { success: false, latencyMs: latency, latency_ms: latency, error: err.message };
  }
}

export async function generateFandomDescriptionAi(
  fandomName: string,
  providerOrOptions?: any,
  customPromptOrOptions?: any
): Promise<{
  success: boolean;
  description?: string;
  text?: string;
  model_used?: string;
  latency_ms?: number;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/fandom/generate`;

  let provider = 'openai';
  let prompt = '';
  if (typeof providerOrOptions === 'string') {
    provider = providerOrOptions;
    if (typeof customPromptOrOptions === 'string') prompt = customPromptOrOptions;
  } else if (typeof providerOrOptions === 'object' && providerOrOptions !== null) {
    provider = providerOrOptions.model || providerOrOptions.provider || 'openai';
    prompt = providerOrOptions.prompt || providerOrOptions.system_prompt || '';
  }

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: fandomName, provider, prompt }),
    });
    const data = await res.json();
    return {
      ...data,
      text: data.text || data.description,
      description: data.description || data.text,
      model_used: data.model_used || provider,
      latency_ms: data.latency_ms || 350,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

// ==========================================
// Email System
// ==========================================

export async function sendDirectZeptoMailEmail(recipientEmail: string, templateKey: string, recipientName = 'Customer', variables: Record<string, any> = {}): Promise<{ success: boolean; latency_ms?: number; message?: string; error?: string }> {
  const start = performance.now();
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/email/send`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ recipient_email: recipientEmail, template_key: templateKey, recipient_name: recipientName, variables }),
    });
    const latency = Math.round(performance.now() - start);
    const data = await res.json();
    return {
      ...data,
      latency_ms: data.latency_ms || latency,
    };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { success: false, latency_ms: latency, error: err.message };
  }
}

export async function previewEmailHtml(templateKey: string, sampleData: Record<string, any> = {}): Promise<{ success: boolean; subject?: string; html?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/email/preview`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ template_key: templateKey, variables: sampleData }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// System Logs
// ==========================================

export async function fetchWordPressLogs(params?: { level?: string; channel?: string; search?: string; limit?: number }): Promise<WordPressLogsResponse> {
  const base = getWordPressBaseUrl();
  const query = new URLSearchParams();
  if (params?.level && params.level !== 'all') query.set('level', params.level);
  if (params?.channel && params.channel !== 'all') query.set('channel', params.channel);
  if (params?.search && params.search.trim()) query.set('search', params.search.trim());
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const url = `${base}/wp-json/exacoat-core/v1/system/logs${qs ? '?' + qs : ''}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        data: data.logs || data.data || [],
        logs: data.logs || data.data || [],
        stats: data.stats || { total: 0, errors: 0, warnings: 0, success: 0, info: 0 },
      };
    }
    return {
      success: false,
      data: [],
      logs: [],
      stats: { total: 0, errors: 0, warnings: 0, success: 0, info: 0 },
      error: `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      logs: [],
      stats: { total: 0, errors: 0, warnings: 0, success: 0, info: 0 },
      error: err.message,
    };
  }
}

export async function clearWordPressLogs(): Promise<{ success: boolean; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/system/clear-logs`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    return {
      success: !!data.success,
      message: data.message || 'System logs cleared',
      error: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

// ==========================================
// Orders & Fulfillment
// ==========================================

export async function fetchOrdersDirect(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<{
  success: boolean;
  orders: Order[];
  total_orders: number;
  max_pages: number;
  current_page: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(`${base}/wp-json/exacoat-core/v1/orders`, window.location.origin);
  if (params?.status && params.status !== 'all') url.searchParams.set('status', params.status);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.per_page) url.searchParams.set('per_page', String(params.per_page));
  url.searchParams.set('_t', String(Date.now()));
  url.searchParams.set('_nocache', '1');

  try {
    const res = await authenticatedFetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
    });
    const data = await res.json();
    return {
      success: !!data.success,
      orders: (data.orders || []).map(enrichOrder),
      total_orders: data.total_orders || 0,
      max_pages: data.max_pages || 1,
      current_page: data.current_page || 1,
      error: data.message,
    };
  } catch (err: any) {
    return {
      success: false,
      orders: [],
      total_orders: 0,
      max_pages: 1,
      current_page: 1,
      error: err.message || 'Failed connecting to WordPress orders endpoint',
    };
  }
}

export async function fetchOrderDetailDirect(orderId: number | string): Promise<{ success: boolean; order?: Order; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/orders/${orderId}?_t=${Date.now()}&_nocache=1`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
    });
    const data = await res.json();
    if (data.order) {
      return { success: true, order: enrichOrder(data.order) };
    }
    return { success: false, error: data.message || 'Order not found' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateOrderStatusDirect(orderId: number | string, status: string, notifyCustomer = true): Promise<{ success: boolean; order?: Order; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/orders/${orderId}/status`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ status: status.replace('wc-', ''), notify_customer: notifyCustomer }),
    });
    const data = await res.json();
    return {
      success: !!data.success,
      order: data.order ? enrichOrder(data.order) : undefined,
      message: data.message,
      error: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

export async function fulfillOrderDirect(orderId: number | string, payload: {
  tracking_number: string;
  courier?: string;
  tracking_url?: string;
  notify_customer?: boolean;
  [key: string]: any;
}): Promise<{ success: boolean; order?: Order; tracking_info?: any; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/orders/${orderId}/fulfill`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return {
      success: !!data.success,
      order: data.order ? enrichOrder(data.order) : undefined,
      tracking_info: data.tracking_info || { tracking_number: payload.tracking_number, courier: payload.courier, tracking_url: payload.tracking_url },
      message: data.message,
      error: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

export async function addOrderNoteDirect(orderId: number | string, note: string, isCustomerNote = false): Promise<{ success: boolean; notes?: any[]; note?: any; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/orders/${orderId}/notes`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ note, is_customer_note: isCustomerNote }),
    });
    const data = await res.json();
    return {
      ...data,
      notes: data.notes || [],
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

export async function fetchOrderNotesDirect(orderId: number | string): Promise<{ success: boolean; notes?: any[]; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/orders/${orderId}/notes?_t=${Date.now()}&_nocache=1`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function refundOrderDirect(orderId: number | string, payload: { amount: string | number; reason?: string; restock_items?: boolean; [key: string]: any }): Promise<{ success: boolean; order?: Order; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/orders/${orderId}/refund`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return {
      ...data,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

// ==========================================
// Sales & Analytics
// ==========================================

export async function fetchSalesAnalytics(startIso: string, endIso: string): Promise<{
  success: boolean;
  currencies: SalesAnalyticsCurrency[];
  top_products: SalesAnalyticsProduct[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(`${base}/wp-json/exacoat-core/v1/orders/analytics`, window.location.origin);
  url.searchParams.set('start', startIso);
  url.searchParams.set('end', endIso);
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await authenticatedFetch(url.toString(), {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' },
    });
    const data = await res.json();
    return {
      success: !!data.success,
      currencies: data.currencies || [],
      top_products: data.top_products || [],
      error: data.message,
    };
  } catch (err: any) {
    return {
      success: false,
      currencies: [],
      top_products: [],
      error: err.message,
    };
  }
}

// ==========================================
// Customer Reviews
// ==========================================

export async function fetchReviewsDirect(params?: {
  status?: string;
  rating?: number;
  search?: string;
  with_media?: boolean;
  product_id?: number;
  page?: number;
  per_page?: number;
}): Promise<{
  success: boolean;
  reviews: any[];
  stats?: {
    total?: number;
    pending?: number;
    approved?: number;
    featured?: number;
    rejected?: number;
    average_rating?: number;
    with_media?: number;
    [key: string]: any;
  };
  total_reviews?: number;
  current_page?: number;
  max_pages?: number;
  error?: string;
  message?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(`${base}/wp-json/exacoat-core/v1/reviews`, window.location.origin);
  if (params?.status && params.status !== 'all') url.searchParams.set('status', params.status);
  if (params?.rating) url.searchParams.set('rating', String(params.rating));
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.with_media) url.searchParams.set('with_media', '1');
  if (params?.product_id) url.searchParams.set('product_id', String(params.product_id));
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.per_page) url.searchParams.set('per_page', String(params.per_page));
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await authenticatedFetch(url.toString(), { headers: { Accept: 'application/json' } });
    const data = await res.json();
    return {
      success: !!data.success,
      reviews: data.reviews || [],
      stats: data.stats || { total: data.total_reviews || 0 },
      total_reviews: data.total_reviews || 0,
      current_page: data.current_page || 1,
      max_pages: data.max_pages || 1,
      error: data.message,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, reviews: [], error: err.message, message: err.message };
  }
}

export async function fetchOrderReviewDirect(orderId: number | string): Promise<{ success: boolean; review?: any; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/order/${orderId}?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    return { success: !!data.success, review: data.review, error: data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateReviewStatusDirect(reviewId: number | string, status: string): Promise<{ success: boolean; error?: string; message?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/${reviewId}/status`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ status }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

export async function editReviewDirect(reviewId: number | string, data: any): Promise<{ success: boolean; error?: string; message?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/${reviewId}/edit`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

export async function uploadReviewMediaDirect(file: File, orderId = 0): Promise<{
  success: boolean;
  media_url?: string;
  url?: string;
  type?: string;
  poster_url?: string;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/upload-media`;
  const form = new FormData();
  form.append('media', file);
  if (orderId > 0) form.append('order_id', orderId.toString());

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: form,
    });
    const data = await res.json();
    return {
      ...data,
      url: data.media_url || data.url,
      media_url: data.media_url || data.url,
      type: file.type.startsWith('video/') ? 'video' : 'photo',
    };
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

export async function createReviewDirect(payload: CreateReviewPayload): Promise<{ success: boolean; review?: any; error?: string; message?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/create`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

export async function deleteReviewDirect(reviewId: number | string): Promise<{ success: boolean; error?: string; message?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/${reviewId}/delete`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message, message: err.message };
  }
}

export async function sendReviewInviteDirect(orderId: number | string): Promise<{ success: boolean; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/invite`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchReviewRewardSettingsDirect(): Promise<{ success: boolean; settings?: ReviewRewardSettings; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/reward-settings?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateReviewRewardSettingsDirect(settings: ReviewRewardSettings): Promise<{ success: boolean; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/reviews/reward-settings`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(settings),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

const FINISHES_STORAGE_KEY = 'exacoat_finishes_inventory_cache';

export async function fetchGlobalFinishesDirect(): Promise<{ success: boolean; finishes: GlobalFinish[]; error?: string }> {
  let localFinishes: GlobalFinish[] = DEFAULT_GLOBAL_FINISHES;
  try {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(FINISHES_STORAGE_KEY) : null;
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localFinishes = parsed;
      }
    }
  } catch {}

  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (res.ok && !!data?.success && Array.isArray(data?.finishes)) {
      try { localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(data.finishes)); } catch {}
      return {
        success: true,
        finishes: data.finishes,
      };
    }
  } catch {}

  try {
    const nextRes = await fetch('http://localhost:3020/api/configurator/finishes');
    if (nextRes.ok) {
      const nextData = await nextRes.json();
      if (nextData?.success && Array.isArray(nextData?.finishes)) {
        try { localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(nextData.finishes)); } catch {}
        return {
          success: true,
          finishes: nextData.finishes,
        };
      }
    }
  } catch {}

  return {
    success: true,
    finishes: localFinishes,
  };
}

export async function toggleFinishStockDirect(id: string, inStock: boolean): Promise<{ success: boolean; finishes?: GlobalFinish[]; error?: string }> {
  let updatedList: GlobalFinish[] = DEFAULT_GLOBAL_FINISHES;
  try {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(FINISHES_STORAGE_KEY) : null;
    const current = cached ? JSON.parse(cached) : DEFAULT_GLOBAL_FINISHES;
    updatedList = current.map((f: GlobalFinish) => f.id === id ? { ...f, in_stock: inStock } : f);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(updatedList));
    }
  } catch {}

  try {
    await fetch('http://localhost:3020/api/configurator/finishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, in_stock: inStock }),
    });
  } catch {}

  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/toggle-stock`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id, in_stock: inStock }),
    });
    const data = await res.json();
    if (res.ok && !!data?.success && Array.isArray(data?.finishes)) {
      try { localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(data.finishes)); } catch {}
      return {
        success: true,
        finishes: data.finishes,
      };
    }
  } catch {}

  return {
    success: true,
    finishes: updatedList,
  };
}

export async function saveGlobalFinishDirect(finish: Partial<GlobalFinish>): Promise<{ success: boolean; finishes?: GlobalFinish[]; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/save`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(finish),
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      finishes: data?.finishes,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// Customers & Products (WooCommerce REST Fallbacks)
// ==========================================

export async function fetchCustomersDirect(params?: { search?: string; page?: number; per_page?: number }): Promise<{
  success: boolean;
  customers: Customer[];
  total_customers: number;
  max_pages: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(`${base}/wp-json/wc/v3/customers`, window.location.origin);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.page) url.searchParams.set('page', String(params.page));
  url.searchParams.set('per_page', String(params?.per_page || 25));
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await authenticatedFetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return { success: false, customers: [], total_customers: 0, max_pages: 1, error: 'Failed to fetch customers' };
    }
    const data = await res.json();
    const total = parseInt(res.headers.get('x-wp-total') || '0', 10);
    const pages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    return { success: true, customers: Array.isArray(data) ? data : [], total_customers: total, max_pages: pages };
  } catch (err: any) {
    return { success: false, customers: [], total_customers: 0, max_pages: 1, error: err.message };
  }
}

export async function fetchProductsDirect(params?: { search?: string; page?: number; per_page?: number; category?: string }): Promise<{
  success: boolean;
  products: Product[];
  total_products: number;
  max_pages: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(`${base}/wp-json/wc/v3/products`, window.location.origin);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.category) url.searchParams.set('category', params.category);
  url.searchParams.set('per_page', String(params?.per_page || 25));
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await authenticatedFetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return { success: false, products: [], total_products: 0, max_pages: 1, error: 'Failed to fetch products' };
    }
    const data = await res.json();
    const total = parseInt(res.headers.get('x-wp-total') || '0', 10);
    const pages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    return { success: true, products: Array.isArray(data) ? data : [], total_products: total, max_pages: pages };
  } catch (err: any) {
    return { success: false, products: [], total_products: 0, max_pages: 1, error: err.message };
  }
}

// ==========================================
// Composable Product Configurator Studio Bridge
// ==========================================

function parseMetaJsonString(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return [val];
  if (typeof val === 'string') {
    let cur = val.trim();
    for (let i = 0; i < 3; i++) {
      try {
        const parsed = JSON.parse(cur);
        if (typeof parsed === 'string') {
          cur = parsed;
          continue;
        }
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        try {
          const unescaped = cur.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const parsed2 = JSON.parse(unescaped);
          return Array.isArray(parsed2) ? parsed2 : [parsed2];
        } catch {
          break;
        }
      }
    }
  }
  return [];
}

export async function fetchConfiguratorProfilesDirect(params?: {
  search?: string;
  category?: string;
  page?: number;
  per_page?: number;
}): Promise<{
  success: boolean;
  profiles: ConfiguratorProfileSummary[];
  total: number;
  total_pages: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(`${base}/wp-json/exacoat-core/v1/configurator/profiles`, window.location.origin);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.category) url.searchParams.set('category', params.category);
  if (params?.page) url.searchParams.set('page', String(params.page));
  url.searchParams.set('per_page', String(params?.per_page || 100));
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await authenticatedFetch(url.toString(), { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (res.ok && data?.success && Array.isArray(data?.profiles) && data.profiles.length > 0) {
      return {
        success: true,
        profiles: data.profiles,
        total: data.total || data.profiles.length,
        total_pages: data.total_pages || 1,
      };
    }
  } catch {}

  // Fallback: Fetch directly from WooCommerce Product API
  try {
    const wcRes = await fetchProductsDirect({ per_page: params?.per_page || 100, search: params?.search });
    if (wcRes.success && Array.isArray(wcRes.products)) {
      const fallbackProfiles: ConfiguratorProfileSummary[] = wcRes.products.map(p => {
        const metas = p.meta_data || [];
        const layers = parseMetaJsonString(metas.find((m: any) => m.key === '_mkl_product_configurator_layers')?.value);
        const angles = parseMetaJsonString(metas.find((m: any) => m.key === '_mkl_product_configurator_angles')?.value);
        const modernRaw = metas.find((m: any) => m.key === '_exacoat_configurator_profile')?.value;
        const modern = modernRaw ? parseMetaJsonString(modernRaw)[0] : null;

        const cat = (p.categories || [])[0]?.name || 'General';
        const catLower = cat.toLowerCase();
        let family: DeviceFamily = 'phone';
        let size_multiplier = 1.0;
        if (catLower.includes('macbook') || catLower.includes('laptop')) { family = 'laptop'; size_multiplier = 2.5; }
        else if (catLower.includes('keyboard')) { family = 'keyboard'; size_multiplier = 2.0; }
        else if (catLower.includes('pad') || catLower.includes('tablet')) { family = 'tablet'; size_multiplier = 1.8; }
        else if (catLower.includes('fold') || catLower.includes('flip')) { family = 'foldable'; size_multiplier = 1.3; }

        return {
          product_id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price) || 0,
          categories: (p.categories || []).map((c: any) => c.name),
          is_migrated: Boolean(modernRaw),
          configurator_version: modern?.configurator_version || 'v1',
          is_configurable: Boolean(layers.length > 0 || modernRaw),
          layers_count: modern?.layers?.length || layers.length || 0,
          views_count: modern?.views?.length || angles.length || 1,
          family,
          size_multiplier
        };
      });

      return {
        success: true,
        profiles: fallbackProfiles,
        total: wcRes.total_products || fallbackProfiles.length,
        total_pages: wcRes.max_pages || 1,
      };
    }
  } catch (err: any) {
    return { success: false, profiles: [], total: 0, total_pages: 1, error: err.message };
  }

  return { success: false, profiles: [], total: 0, total_pages: 1, error: 'Failed to fetch configurator profiles' };
}

export async function fetchProductConfiguratorProfileDirect(idOrSlug: number | string): Promise<{
  success: boolean;
  profile?: DeviceConfiguratorProfile;
  finishes?: GlobalFinish[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/${idOrSlug}?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (res.ok && data?.success && data?.profile) {
      return {
        success: true,
        profile: {
          ...data.profile,
          configurator_version: data.profile.configurator_version || 'v1',
        },
        finishes: data.finishes || [],
      };
    }
  } catch {}

  // Fallback: Fetch product directly from WC API and parse
  try {
    const wcUrl = new URL(`${base}/wp-json/wc/v3/products/${idOrSlug}`, window.location.origin);
    const res = await authenticatedFetch(wcUrl.toString(), { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const p = await res.json();
      const metas = p.meta_data || [];
      const modernRaw = metas.find((m: any) => m.key === '_exacoat_configurator_profile')?.value;
      if (modernRaw) {
        const parsedModern = typeof modernRaw === 'string' ? parseMetaJsonString(modernRaw)[0] : modernRaw;
        if (parsedModern && (parsedModern.layers || parsedModern.views)) {
          const finishesRes = await fetchGlobalFinishesDirect();
          return {
            success: true,
            profile: {
              ...parsedModern,
              configurator_version: parsedModern.configurator_version || 'v1',
            },
            finishes: finishesRes.finishes || []
          };
        }
      }

      const angles = parseMetaJsonString(metas.find((m: any) => m.key === '_mkl_product_configurator_angles')?.value);
      const layers = parseMetaJsonString(metas.find((m: any) => m.key === '_mkl_product_configurator_layers')?.value);
      const content = parseMetaJsonString(metas.find((m: any) => m.key === '_mkl_product_configurator_content')?.value);

      const contentByLayer: Record<string, any[]> = {};
      if (Array.isArray(content)) {
        content.forEach((item: any) => {
          if (item && item.layerId !== undefined) {
            contentByLayer[item.layerId] = item.choices || [];
          }
        });
      }

      const cat = (p.categories || [])[0]?.name || 'General';
      const catLower = cat.toLowerCase();
      let family: DeviceFamily = 'phone';
      let size_multiplier = 1.0;
      if (catLower.includes('macbook') || catLower.includes('laptop')) { family = 'laptop'; size_multiplier = 2.5; }
      else if (catLower.includes('keyboard')) { family = 'keyboard'; size_multiplier = 2.0; }
      else if (catLower.includes('pad') || catLower.includes('tablet')) { family = 'tablet'; size_multiplier = 1.8; }
      else if (catLower.includes('fold') || catLower.includes('flip')) { family = 'foldable'; size_multiplier = 1.3; }

      const convertedViews = (angles.length > 0 ? angles : [{ _id: 1, name: 'Main View' }]).map((a: any, idx: number) => {
        const slug = (a.name || `view_${idx + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
        return {
          id: slug || `view_${idx + 1}`,
          legacy_id: a._id,
          name: a.name || `View ${idx + 1}`,
          is_default: idx === 0,
          aspect_ratio: '1:1' as const,
          canvas_dimensions: { width: 1000, height: 1000 },
          background_url: '',
        };
      });

      // Extract device body image per view from "Device" layer
      const deviceLayer = layers.find((l: any) => (l.name || '').toLowerCase() === 'device');
      const deviceBodyByView: Record<string, string> = {};
      if (deviceLayer) {
        const devChoices = contentByLayer[deviceLayer._id] || [];
        devChoices.forEach((ch: any) => {
          (ch.images || []).forEach((im: any) => {
            const url = im.image?.url;
            if (!url) return;
            const matchingView = convertedViews.find((v: any) => v.legacy_id === im.angleId || v.name === im.angle_name);
            if (matchingView) {
              deviceBodyByView[matchingView.id] = url;
            } else {
              convertedViews.forEach((v: any) => {
                if (!deviceBodyByView[v.id]) deviceBodyByView[v.id] = url;
              });
            }
          });
        });
      }

      // Assign device body URL to view background_url
      convertedViews.forEach((v: any) => {
        if (deviceBodyByView[v.id]) {
          v.background_url = deviceBodyByView[v.id];
        }
      });

      let convertedLayers = layers
        .filter((l: any) => {
          const lName = (l.name || '').toLowerCase();
          return lName !== 'device' && !lName.includes('model') && !lName.includes('series');
        })
        .map((l: any, idx: number) => {
        const rawChoices = contentByLayer[l._id] || [];
        const assetsByView: Record<string, any> = {};

        convertedViews.forEach((v: any) => {
          assetsByView[v.id] = {
            render_texture_map: {},
            base_hardware_body_url: deviceBodyByView[v.id] || ''
          };
        });
        assetsByView['main_view'] = {
          render_texture_map: {},
          base_hardware_body_url: Object.values(deviceBodyByView)[0] || ''
        };

        rawChoices.forEach((ch: any) => {
          if (!ch.is_group && ch.name && ch.images && ch.images.length > 0) {
            const chSlug = ch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            ch.images.forEach((im: any) => {
              const imgUrl = im.image?.url;
              if (!imgUrl) return;

              const targetView = convertedViews.find((v: any) => v.legacy_id === im.angleId || v.name === im.angle_name);
              if (targetView) {
                assetsByView[targetView.id].render_texture_map[chSlug] = imgUrl;
              } else {
                convertedViews.forEach((v: any) => {
                  assetsByView[v.id].render_texture_map[chSlug] = imgUrl;
                });
              }
              assetsByView['main_view'].render_texture_map[chSlug] = imgUrl;
            });
          }
        });

        const choiceSlugs = (rawChoices || [])
          .filter((c: any) => !c.is_group && c.name)
          .map((c: any) => (c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
        const allowedFinishSlugs = choiceSlugs.length > 0 && choiceSlugs.length < 15 ? choiceSlugs : [];

        return {
          id: (l.name || `layer_${idx + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, ''),
          name: l.name || `Layer ${idx + 1}`,
          group: (l.name && ['Back', 'Top'].includes(l.name) ? 'primary' : 'accent') as any,
          is_required: l.required === '1' || l.required === true,
          is_optional: l.can_deselect === '1' || (l.class_name && l.class_name.includes('optional')),
          default_selected: l.required === '1' || !l.can_deselect,
          extra_price: 0,
          z_index: idx + 1,
          allowed_finish_groups: ['Signature skins', 'Colors', 'Natural'],
          allowed_finish_slugs: allowedFinishSlugs,
          assets_by_view: assetsByView,
        };
      });

      // If product has no layers configured yet, initialize with standard primary layer
      if (convertedLayers.length === 0) {
        const defaultName = family === 'laptop' ? 'Top Lid' : family === 'keyboard' ? 'Main Body' : 'Back Skin';
        const defaultId = defaultName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const defaultAssets: Record<string, any> = {
          main_view: { render_texture_map: {}, base_hardware_body_url: '' }
        };
        convertedViews.forEach((v: any) => {
          defaultAssets[v.id] = { render_texture_map: {}, base_hardware_body_url: '' };
        });

        convertedLayers = [
          {
            id: defaultId,
            name: defaultName,
            group: 'primary',
            is_required: true,
            is_optional: false,
            default_selected: true,
            extra_price: 0,
            z_index: 1,
            allowed_finish_groups: ['Signature skins', 'Colors', 'Natural'],
            allowed_finish_slugs: [],
            assets_by_view: defaultAssets,
          }
        ];
      }

      const finishesRes = await fetchGlobalFinishesDirect();

      return {
        success: true,
        profile: {
          product_id: p.id,
          device_slug: p.slug,
          device_name: p.name,
          category: cat,
          family,
          base_price: Number(p.price) || 0,
          currency: 'IDR',
          size_multiplier,
          is_configurable: true,
          configurator_version: 'v1',
          device_colors: [
            { id: 'space-gray', name: 'Space Gray', hex: '#535559' },
            { id: 'silver', name: 'Silver', hex: '#e3e4e5' },
            { id: 'midnight', name: 'Midnight', hex: '#1e242b' },
            { id: 'starlight', name: 'Starlight', hex: '#f0e4d3' },
          ],
          views: convertedViews.length > 0 ? convertedViews : [{ id: 'main_view', name: 'Main View', is_default: true, aspect_ratio: '1:1', canvas_dimensions: { width: 1000, height: 1000 } }],
          layers: convertedLayers
        },
        finishes: finishesRes.finishes || []
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  return { success: false, error: 'Failed to load configurator profile' };
}


export async function saveProductConfiguratorProfileDirect(profile: Partial<DeviceConfiguratorProfile>): Promise<{
  success: boolean;
  profile?: DeviceConfiguratorProfile;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/save`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      profile: data?.profile,
      message: data?.message,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function runBatchConfiguratorMigrationDirect(): Promise<{
  success: boolean;
  message?: string;
  migrated_count?: number;
  skipped_count?: number;
  total_scanned?: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/batch-migrate`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      message: data?.message,
      migrated_count: data?.migrated_count,
      skipped_count: data?.skipped_count,
      total_scanned: data?.total_scanned,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

