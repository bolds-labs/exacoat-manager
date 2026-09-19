/**
 * Exacoat Manager - WordPress & WooCommerce Bridge
 * Direct communication bridge with exacoat-core REST endpoints and WooCommerce API.
 * Strict Antislop compliant: No em dashes in copy or notifications.
 */

import { getEnv, getWordPressBaseUrl, getWcCredentials } from './env';
import { CreateReviewPayload, Order, OrderItem, OrderTracking, DeviceConfiguratorProfile, ConfiguratorProfileSummary, DeviceFamily, AdminUser, ExacoatRole } from '../types';
import { renderEmailHtmlLocally } from './emailRenderer';
import { extractItemSpecs } from './orderItems';


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
  currency_rates?: Record<string, CurrencyRateConfig>;
  currency_global_markup?: number;
  shipping_zones?: Record<string, ShippingZoneConfig>;
  shipping_target_method_ids?: string;
  logistics_carriers?: Record<string, LogisticsCarrierConfig>;
  jne_email_recipients?: string;
  jne_email_subject?: string;
  jne_email_body?: string;
  [key: string]: any;
}

export interface CurrencyRateConfig {
  code?: string;
  symbol: string;
  rate: number;
  rounding: '9_end' | '90_end' | '50_step' | '500_step' | 'none';
}

export interface CurrencySettings {
  currency_rates: Record<string, CurrencyRateConfig>;
  currency_global_markup: number;
}

export interface ShippingZoneConfig {
  name: string;
  countries: string;
  currency: string;
  free: number;
  filter_text?: string;
}

export interface LogisticsCarrierConfig {
  key?: string;
  name: string;
  url: string;
}

export interface ShippingSettings {
  shipping_zones: Record<string, ShippingZoneConfig>;
  shipping_target_method_ids: string;
  logistics_carriers: Record<string, LogisticsCarrierConfig>;
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

export interface ShopeeOrderItem {
  item_id: number;
  item_name: string;
  model_id: number;
  model_name: string;
  quantity: number;
  price: number;
  image_url: string;
  item_sku?: string;
  model_sku?: string;
}

export interface ShopeeExistingClaim {
  already_claimed: boolean;
  existing_order_id?: number;
  existing_order_num?: string;
  claim_type?: 'Warranty' | 'Redeem';
  created_at?: string;
}

export interface ShopeeOrder {
  order_sn: string;
  order_status: string;
  create_time: string;
  create_timestamp: number;
  pay_time?: string | null;
  buyer_username: string;
  buyer_user_id: number;
  total_amount: number;
  currency: string;
  shipping_carrier: string;
  tracking_number: string;
  buyer_note: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_city: string;
  recipient_district?: string;
  recipient_postcode: string;
  items: ShopeeOrderItem[];
  is_delivered?: boolean;
  delivered_time?: string | null;
  is_arranged?: boolean;
  is_printed?: boolean;
  logistics_status?: string;
  shipping_document_status?: string;
  already_claimed: boolean;
  existing_claim?: ShopeeExistingClaim;
}

export interface ShopeePickupAddress {
  address_id: number;
  region?: string;
  state?: string;
  city?: string;
  address?: string;
  zipcode?: string;
  district?: string;
  town?: string;
}

export interface ShopeePickupTimeSlot {
  pickup_time_id: string;
  date: number;
  time_text: string;
}

export interface ShopeeDropoffBranch {
  branch_id: number;
  branch_name: string;
  address?: string;
}

export interface ShopeeShippingParameter {
  dropoff?: {
    branch_list?: ShopeeDropoffBranch[];
    slug_list?: string[];
  };
  pickup?: {
    address_list?: ShopeePickupAddress[];
    time_slot_list?: ShopeePickupTimeSlot[];
  };
}

export interface ArrangeShipmentPayload {
  dropoff?: {
    branch_id?: number;
    sender_real_name?: string;
    tracking_number?: string;
  };
  pickup?: {
    address_id?: number;
    pickup_time_id?: string;
  };
}

export interface ShopeeSettings {
  environment: 'sandbox' | 'live';
  test_partner_id: number;
  test_partner_key?: string;
  test_partner_key_set?: boolean;
  has_test_key?: boolean;
  test_push_partner_key?: string;
  has_test_push_key?: boolean;
  live_partner_id: number;
  live_partner_key?: string;
  live_partner_key_set?: boolean;
  has_live_key?: boolean;
  live_push_partner_key?: string;
  has_live_push_key?: boolean;
  redirect_url: string;
  push_callback_url?: string;
  shop_id: number;
  shop_name: string;
  is_connected: boolean;
  token_expires_at: number;
  last_synced_at: number;
}

export interface TikTokOrderItem {
  item_id: string;
  item_name: string;
  sku_id: string;
  sku_name: string;
  quantity: number;
  price: number;
  image_url: string;
}

export interface TikTokOrder {
  order_id: string;
  order_sn: string;
  order_status: string;
  create_time: string;
  create_timestamp: number;
  pay_time?: string | null;
  buyer_username: string;
  buyer_uid?: string;
  total_amount: number;
  currency: string;
  shipping_carrier: string;
  tracking_number: string;
  package_id?: string;
  buyer_note: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_city: string;
  recipient_postcode: string;
  items: TikTokOrderItem[];
  already_claimed: boolean;
  existing_claim?: ShopeeExistingClaim;
}

export interface TikTokSettings {
  environment: 'sandbox' | 'live';
  service_id: string;
  app_key: string;
  app_secret?: string;
  has_secret?: boolean;
  shop_cipher: string;
  shop_name: string;
  redirect_url: string;
  webhook_url: string;
  is_connected: boolean;
  token_expires_at: number;
  is_expired?: boolean;
  last_synced_at: string | null;
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

  // Do NOT return Basic auth header for WooCommerce consumer keys (ck_ / cs_).
  // WordPress core Application Passwords intercepts "Authorization: Basic" on all /wp-json/ routes
  // and rejects ck_ as an "Unknown username". WooCommerce consumer keys are safely passed via query params.
  return {};
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
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

    // Attach WooCommerce credentials to /wp-json/wc/, /wp-json/exacoat-core/, and /wp-json/artmatter-core/ requests if not using JWT Bearer
    const isWcOrPluginRoute = targetUrlObj.pathname.includes('/wp-json/wc/') ||
      targetUrlObj.pathname.includes('/wp-json/exacoat-core/') ||
      targetUrlObj.pathname.includes('/wp-json/artmatter-core/');

    if (isWcOrPluginRoute && !auth.Authorization?.startsWith('Bearer')) {
      const { key, secret } = getWcCredentials();
      if (key && secret) {
        targetUrlObj.searchParams.set('consumer_key', key);
        targetUrlObj.searchParams.set('consumer_secret', secret);
        finalInput = targetUrlObj.toString();
        // Remove any Authorization header so WordPress Application Passwords does not intercept ck_ as a WP username
        headers.delete('Authorization');
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
  if (!item) return [];

  // 1. Raw configurator array check
  const metaList = Array.isArray(item.meta_data) ? item.meta_data : [];
  const rawMeta = metaList.find((m: any) => m.key === '_configurator_data_raw' || m.key === '_configurator_data');
  if (rawMeta && rawMeta.value && Array.isArray(rawMeta.value)) {
    return rawMeta.value.map((v: any) => ({
      layer_id: v.layer_data?.layer_id || v.layer_id,
      layer_name: v.layer_data?.layer_name || v.layer_data?.name || v.layer_name || 'Part',
      choice_id: v.layer_data?.choice_id || v.choice_id,
      name: v.layer_data?.name || v.choice_title || v.name || 'Custom',
      image: v.layer_data?.image || v.image,
      is_choice: v.is_choice,
    }));
  }

  // 2. Extract item specs from configuration string, formatted_meta, or meta_data
  const specs = extractItemSpecs(item);
  if (specs.length > 0) {
    return specs.map((s, idx) => ({
      layer_id: idx,
      layer_name: s.label,
      choice_id: idx,
      name: s.value,
      choice_title: s.value,
    }));
  }

  return [];
}

function enrichOrder(order: any): Order {
  const metaList = order.meta_data || [];
  const trackingMeta = metaList.find((m: any) => m.key === 'tracking_number' || m.key === '_tracking_number' || m.key === '_artmatter_tracking_number');
  const carrierMeta = metaList.find((m: any) => m.key === '_shipping_carrier' || m.key === 'carrier_id' || m.key === '_carrier_id');
  const checkpointsMeta = metaList.find((m: any) => m.key === '_artmatter_tracking_checkpoints');
  const latestStatusMeta = metaList.find((m: any) => m.key === '_biteship_latest_status' || m.key === '_artmatter_trackingmore_latest_status' || m.key === '_artmatter_17track_latest_status');
  const districtMeta = metaList.find((m: any) => m.key === '_shipping_district');
  const subdistrictMeta = metaList.find((m: any) => m.key === '_shipping_subdistrict');
  const phoneMeta = metaList.find((m: any) => m.key === '_shipping_phone_formatted' || m.key === '_billing_phone');

  const rawItems = (Array.isArray(order.items) && order.items.length > 0)
    ? order.items
    : (Array.isArray(order.line_items) ? order.line_items : (Array.isArray(order.items) ? order.items : []));

  const lineItems = rawItems.map((item: any) => ({
    ...item,
    parsed_configurator: item.parsed_configurator || parseConfiguratorFromItem(item),
  }));

  const tracking: OrderTracking | null = trackingMeta?.value && trackingMeta.value !== '⚠️' ? {
    courier: carrierMeta?.value ? String(carrierMeta.value) : 'Standard',
    carrier_id: carrierMeta?.value ? String(carrierMeta.value) : undefined,
    tracking_number: String(trackingMeta.value),
    latest_status: latestStatusMeta?.value ? String(latestStatusMeta.value) : undefined,
    checkpoints: Array.isArray(checkpointsMeta?.value) ? checkpointsMeta.value : undefined,
  } : (order.tracking || null);

  const rawOrderNumber = order.order_number || order.number || String(order.id);
  const cleanOrderNumber = `#${String(rawOrderNumber).replace(/^#+/, '')}`;

  return {
    ...order,
    order_number: cleanOrderNumber,
    items: lineItems,
    line_items: lineItems,
    item_count: lineItems.reduce((acc: number, it: any) => acc + (it.quantity || 1), 0),
    tracking,
    shipping_district: districtMeta?.value ? String(districtMeta.value) : (order.shipping_district || undefined),
    shipping_subdistrict: subdistrictMeta?.value ? String(subdistrictMeta.value) : (order.shipping_subdistrict || undefined),
    formatted_phone: phoneMeta?.value ? String(phoneMeta.value) : (order.formatted_phone || undefined),
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

export function calculateSimulatedPrice(
  amountIdr: number,
  rate: number,
  markup: number,
  rounding: CurrencyRateConfig['rounding']
): number {
  if (amountIdr <= 0 || rate <= 0) return 0;
  const raw = amountIdr * rate * markup;
  switch (rounding) {
    case '90_end':
      return Math.max(0, Math.ceil(raw / 100) * 100 - 10);
    case '500_step':
      return Math.max(0, Math.ceil(raw / 500) * 500);
    case '50_step':
      return Math.max(0, Math.ceil(raw / 50) * 50);
    case 'none':
      return Math.max(0, Number(raw.toFixed(2)));
    case '9_end':
    default:
      return Math.max(0, Math.ceil(raw / 10) * 10 - 1);
  }
}

export async function fetchCurrencySettingsDirect(): Promise<{
  success: boolean;
  currency_rates?: Record<string, CurrencyRateConfig>;
  currency_global_markup?: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/settings/currency?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        currency_rates: data.currency_rates,
        currency_global_markup: data.currency_global_markup,
      };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveCurrencySettingsDirect(payload: Partial<CurrencySettings>): Promise<{
  success: boolean;
  message?: string;
  currency_rates?: Record<string, CurrencyRateConfig>;
  currency_global_markup?: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/settings/currency`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        message: data.message,
        currency_rates: data.currency_rates,
        currency_global_markup: data.currency_global_markup,
      };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchShippingSettingsDirect(): Promise<{
  success: boolean;
  shipping_zones?: Record<string, ShippingZoneConfig>;
  shipping_target_method_ids?: string;
  logistics_carriers?: Record<string, LogisticsCarrierConfig>;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/settings/shipping?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        shipping_zones: data.shipping_zones,
        shipping_target_method_ids: data.shipping_target_method_ids,
        logistics_carriers: data.logistics_carriers,
      };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveShippingSettingsDirect(payload: Partial<ShippingSettings>): Promise<{
  success: boolean;
  message?: string;
  shipping_zones?: Record<string, ShippingZoneConfig>;
  shipping_target_method_ids?: string;
  logistics_carriers?: Record<string, LogisticsCarrierConfig>;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/settings/shipping`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        message: data.message,
        shipping_zones: data.shipping_zones,
        shipping_target_method_ids: data.shipping_target_method_ids,
        logistics_carriers: data.logistics_carriers,
      };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
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

export async function sendDirectZeptoMailEmail(
  arg1: string,
  arg2: string,
  recipientName = 'Customer',
  variables: Record<string, any> = {}
): Promise<{ success: boolean; latency_ms?: number; message?: string; error?: string }> {
  const start = performance.now();
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/email/send`;

  // Support both calling patterns: (recipientEmail, templateKey) and (templateKey, recipientEmail)
  const isArg1Email = typeof arg1 === 'string' && arg1.includes('@');
  const recipientEmail = isArg1Email ? arg1 : arg2;
  const templateKey = isArg1Email ? arg2 : arg1;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        recipient_email: recipientEmail,
        template_key: templateKey,
        template_slug: templateKey,
        slug: templateKey,
        event: templateKey,
        recipient_name: recipientName,
        variables,
      }),
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

export async function previewEmailHtml(
  templateKey: string,
  sampleData: Record<string, any> = {}
): Promise<{ success: boolean; subject?: string; html?: string; error?: string }> {
  // 1. Attempt client-side render first for instant, reliable, zero-latency preview
  try {
    const local = renderEmailHtmlLocally(templateKey, sampleData);
    if (local && local.html) {
      return {
        success: true,
        subject: local.subject,
        html: local.html,
      };
    }
  } catch (err: any) {
    console.warn('[previewEmailHtml] Local render fallback to remote:', err);
  }

  // 2. Fallback to WordPress REST endpoint
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/email/preview`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        template_key: templateKey,
        template_slug: templateKey,
        slug: templateKey,
        event: templateKey,
        variables: sampleData,
      }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    // 3. If remote fails, attempt local render again as safeguard
    try {
      const local = renderEmailHtmlLocally(templateKey, sampleData);
      return { success: true, subject: local.subject, html: local.html };
    } catch {
      return { success: false, error: err.message };
    }
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
  courier?: string;
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
  if (params?.courier && params.courier !== 'all') url.searchParams.set('courier', params.courier);
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

export async function syncOrderTrackingDirect(orderId: number | string): Promise<{
  success: boolean;
  order_id?: number;
  status?: string;
  status_label?: string;
  latest_status?: string;
  checkpoints?: any[];
  source?: string;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shipping/sync-order`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ order_id: Number(orderId) }),
    });
    const data = await res.json();
    return data;
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

// ==========================================
// WordPress Staff & Team Management Bridge
// ==========================================

export async function fetchWordPressTeamDirect(): Promise<{
  success: boolean;
  users: AdminUser[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/team`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.users)) {
        return { success: true, users: data.users };
      }
    }

    // Fallback: If exacoat-core team endpoint is not active, check WooCommerce customers with role=all
    const wcUrl = new URL(`${base}/wp-json/wc/v3/customers`, window.location.origin);
    wcUrl.searchParams.set('role', 'all');
    wcUrl.searchParams.set('per_page', '100');

    const wcRes = await authenticatedFetch(wcUrl.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (wcRes.ok) {
      const customers = await wcRes.json();
      if (Array.isArray(customers)) {
        const staff = customers
          .filter((c: any) => c.role === 'administrator' || c.role === 'shop_manager')
          .map((c: any): AdminUser => ({
            id: String(c.id),
            email: c.email || '',
            full_name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || c.email?.split('@')[0] || 'Staff User',
            role: c.role === 'administrator' ? 'super_admin' : 'shop_manager',
            avatar_url: c.avatar_url,
            created_at: c.date_created || new Date().toISOString(),
            email_confirmed_at: c.date_created || new Date().toISOString(),
            wp_roles: [c.role],
          }));

        if (staff.length > 0) {
          return { success: true, users: staff };
        }
      }
    }

    return { success: false, users: [], error: `Failed to load team from WordPress (HTTP ${res.status})` };
  } catch (err: any) {
    return { success: false, users: [], error: err?.message || 'Network error fetching team' };
  }
}

export async function updateWordPressUserRoleDirect(
  userId: string,
  newRole: ExacoatRole
): Promise<{ success: boolean; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/team/${userId}/role`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      return { success: true, message: data.message };
    }

    // Fallback: WooCommerce customers update
    const wcUrl = `${base}/wp-json/wc/v3/customers/${userId}`;
    const wpRole = newRole === 'super_admin' ? 'administrator' : 'shop_manager';
    const wcRes = await authenticatedFetch(wcUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ role: wpRole }),
    });

    if (wcRes.ok) {
      return { success: true, message: 'WordPress role updated' };
    }

    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update user role' };
  }
}

export async function createWordPressStaffUserDirect(
  email: string,
  password: string,
  fullName: string,
  role: ExacoatRole
): Promise<{ success: boolean; user?: AdminUser; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/team`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.user) {
      return { success: true, user: data.user, message: data.message };
    }

    // Fallback: WooCommerce customer creation with role
    const wcUrl = `${base}/wp-json/wc/v3/customers`;
    const wpRole = role === 'super_admin' ? 'administrator' : 'shop_manager';
    const names = fullName.trim().split(/\s+/);
    const wcRes = await authenticatedFetch(wcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        password,
        first_name: names[0] || '',
        last_name: names.slice(1).join(' ') || '',
        role: wpRole,
      }),
    });

    if (wcRes.ok) {
      const created = await wcRes.json();
      return {
        success: true,
        user: {
          id: String(created.id),
          email: created.email,
          full_name: `${created.first_name || ''} ${created.last_name || ''}`.trim() || email.split('@')[0],
          role,
          avatar_url: created.avatar_url,
          created_at: created.date_created || new Date().toISOString(),
          email_confirmed_at: created.date_created || new Date().toISOString(),
          wp_roles: [wpRole],
        },
      };
    }

    return { success: false, error: data?.message || (await wcRes.json().catch(() => ({})))?.message || 'Failed to create user in WordPress' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to connect to WordPress' };
  }
}

export async function deleteWordPressStaffUserDirect(
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/team/${userId}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      return { success: true, message: data.message };
    }

    return { success: false, error: data?.message || `Failed to delete WordPress user (HTTP ${res.status})` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete WordPress user' };
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
      const cleanLayers = (data.profile.layers || []).filter((l: any) => {
        const lName = (l.name || '').toLowerCase();
        return lName !== 'device' && !lName.includes('device-body') && !lName.includes('model') && !lName.includes('coverage') && !lName.includes('360') && !lName.includes('series') && !lName.includes('logo') && !lName.includes('cutout');
      });

      return {
        success: true,
        profile: {
          ...data.profile,
          layers: cleanLayers,
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
          const cleanLayers = (parsedModern.layers || []).filter((l: any) => {
            const lName = (l.name || '').toLowerCase();
            return lName !== 'device' && !lName.includes('device-body') && !lName.includes('model') && !lName.includes('coverage') && !lName.includes('360') && !lName.includes('series') && !lName.includes('logo') && !lName.includes('cutout');
          });
          const finishesRes = await fetchGlobalFinishesDirect();
          return {
            success: true,
            profile: {
              ...parsedModern,
              layers: cleanLayers,
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

      // Detect Coverage and Logo Cutout options from layers
      const hasCoverageFromLayers = layers.some((l: any) => {
        const n = (l.name || '').toLowerCase();
        return n.includes('model') || n.includes('coverage') || n.includes('360');
      });
      const hasLogoFromLayers = layers.some((l: any) => {
        const n = (l.name || '').toLowerCase();
        return n.includes('logo') || n.includes('cutout');
      });

      const convertedVariants: any[] = [];
      if (hasCoverageFromLayers || family === 'phone') {
        convertedVariants.push({
          id: 'coverage',
          name: 'Coverage',
          options: [
            { id: 'model_cut', name: 'Model Cut', price_diff: 0 },
            { id: 'model_360', name: 'Model 360°', price_diff: 40000 },
          ],
        });
      }
      if (hasLogoFromLayers || family === 'laptop' || (p.name || '').toLowerCase().includes('iphone') || (p.name || '').toLowerCase().includes('ipad')) {
        convertedVariants.push({
          id: 'logo_cutout',
          name: 'Logo Cutout',
          options: [
            { id: 'with_logo', name: 'With Logo Cutout', price_diff: 0 },
            { id: 'without_logo', name: 'Without Logo Cutout', price_diff: 0 },
          ],
        });
      }

      let convertedLayers = layers
        .filter((l: any) => {
          const lName = (l.name || '').toLowerCase();
          return lName !== 'device' && !lName.includes('device-body') && !lName.includes('model') && !lName.includes('coverage') && !lName.includes('360') && !lName.includes('series') && !lName.includes('logo') && !lName.includes('cutout');
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
          layers: convertedLayers,
          variants: convertedVariants,
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

export async function setProductPriceDirect(
  productId: number,
  price: number
): Promise<{
  success: boolean;
  productId?: number;
  price?: number;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/set-price`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ product_id: productId, price }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        productId: data.product_id,
        price: data.price,
        message: data.message,
      };
    }
    // Fallback: WC v3 products endpoint
    const wcUrl = `${base}/wp-json/wc/v3/products/${productId}`;
    const wcRes = await authenticatedFetch(wcUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ regular_price: String(price) }),
    });
    if (wcRes.ok) {
      return { success: true, productId, price, message: `Price updated to IDR ${price.toLocaleString('id-ID')}` };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function duplicateProductDirect(params: {
  source_product_id: number;
  new_name: string;
  new_slug?: string;
  new_price?: number;
  copy_configurator?: boolean;
}): Promise<{
  success: boolean;
  productId?: number;
  name?: string;
  slug?: string;
  price?: number;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/duplicate-product`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        source_product_id: params.source_product_id,
        new_name: params.new_name,
        new_slug: params.new_slug,
        new_price: params.new_price,
        copy_configurator: params.copy_configurator ?? true,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        productId: data.product_id,
        name: data.name,
        slug: data.slug,
        price: data.price,
        message: data.message,
      };
    }
    return { success: false, error: data?.message || data?.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// Tracking Number Pool & Auto-Resi Engine
// ==========================================

export interface CarrierInventory {
  name: string;
  code: string;
  auto_resi: boolean;
  available: number;
  assigned_total: number;
  low_stock: boolean;
  sample_available?: string[];
}

export interface TrackingPoolInventory {
  jne: CarrierInventory;
  sicepat: CarrierInventory;
  pos: CarrierInventory;
  goorita: CarrierInventory;
  [key: string]: CarrierInventory;
}

export interface TrackingAssignmentRecord {
  number: string;
  order_id: number;
  assigned_at: string;
  carrier: string;
}

export async function fetchTrackingPoolInventory(): Promise<{
  success: boolean;
  inventory?: TrackingPoolInventory;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tracking-pool`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, inventory: data.inventory };
    }
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addTrackingNumbersToPool(
  carrier: string,
  numbers: string | string[]
): Promise<{
  success: boolean;
  added_count?: number;
  total_pool?: number;
  carrier?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tracking-pool/add`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ carrier, numbers }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        added_count: data.added_count,
        total_pool: data.total_pool,
        carrier: data.carrier,
      };
    }
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteTrackingNumbersFromPool(
  carrier: string,
  numbers: string[]
): Promise<{
  success: boolean;
  deleted_count?: number;
  total_pool?: number;
  carrier?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tracking-pool/delete`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ carrier, numbers }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        deleted_count: data.deleted_count,
        total_pool: data.total_pool,
        carrier: data.carrier,
      };
    }
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchTrackingPoolHistory(
  carrier?: string,
  limit: number = 50
): Promise<{
  success: boolean;
  history?: TrackingAssignmentRecord[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(`${base}/wp-json/exacoat-core/v1/tracking-pool/history`);
  if (carrier) url.searchParams.set('carrier', carrier);
  url.searchParams.set('limit', String(limit));

  try {
    const res = await authenticatedFetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, history: data.history };
    }
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// WhatsApp Customer Notification Service
// ==========================================

export interface WhatsAppSettings {
  enabled: boolean;
  phone_number_id: string;
  access_token: string;
  business_account_id: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_alerts_enabled: boolean;
  events: {
    processing: boolean;
    completed: boolean;
    smb_ready: boolean;
    smb_picked: boolean;
  };
}

export async function fetchWhatsAppSettings(): Promise<{
  success: boolean;
  settings?: WhatsAppSettings;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/whatsapp/settings`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, settings: data.settings };
    }
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveWhatsAppSettings(
  settings: Partial<WhatsAppSettings>
): Promise<{
  success: boolean;
  settings?: WhatsAppSettings;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/whatsapp/settings`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, settings: data.settings, message: data.message };
    }
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testWhatsAppMessage(
  phone: string,
  template: string = 'notif_order_confirmed'
): Promise<{
  success: boolean;
  message_id?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/whatsapp/test`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ phone, template }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, message_id: data.message_id };
    }
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// BCA Payment Webhook Status
// ==========================================

export interface BcaWebhookStatus {
  success: boolean;
  webhook_url: string;
  unmatched_count: number;
  unmatched_mutations: Array<{
    amount: number;
    description: string;
    timestamp: string;
    ip?: string;
  }>;
}

export async function fetchBcaWebhookStatus(): Promise<{
  success: boolean;
  status?: BcaWebhookStatus;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/bca/status`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, status: data };
    }
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// 48-Hour Installation Warranty & RMA Review
// ==========================================

export interface WarrantyClaimDetails {
  success: boolean;
  order_id: number;
  order_number: string;
  parent_order_id: number;
  parent_order_number: string;
  rma_status: string;
  claim_reason?: string;
  customer_notes?: string;
  video_proof_url?: string;
  video_deleted: boolean;
  video_deleted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  items?: Array<{ name: string; quantity: number; image?: string }>;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  shipping_address?: string;
}

export async function fetchWarrantyClaimDetails(
  orderId: number
): Promise<{ success: boolean; data?: WarrantyClaimDetails; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/warranty/claim/${orderId}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, data };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function reviewWarrantyClaimDirect(
  orderId: number,
  action: 'approve' | 'reject',
  reason?: string,
  adminName?: string
): Promise<{ success: boolean; rma_status?: string; video_deleted?: boolean; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/warranty/review`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        action,
        reason: reason || '',
        admin_name: adminName || 'Operations Manager',
      }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        rma_status: data.rma_status,
        video_deleted: data.video_deleted,
        message: data.message,
      };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface ShippingRateOption {
  id: string;
  courier: string;
  service: string;
  label: string;
  price: number;
  duration: string;
}

export async function fetchShippingRatesDirect(
  postcode: string,
  country: string = 'ID',
  orderId?: number,
  city?: string,
  address?: string,
  state?: string
): Promise<{ success: boolean; is_fallback?: boolean; rates?: ShippingRateOption[]; postcode?: string; country?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/warranty/shipping-rates`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        postcode,
        destination_country: country,
        country,
        order_id: orderId || undefined,
        city: city || undefined,
        address: address || undefined,
        state: state || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        is_fallback: data.is_fallback ?? false,
        rates: data.rates || [],
        postcode: data.postcode,
        country: data.country,
      };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface ManualWarrantyItem {
  product_id: number;
  name?: string;
  quantity?: number;
  configuration?: string;
  configurator_data?: any[];
  device_model?: string;
}

export interface ManualWarrantyClaimPayload {
  source_type: 'existing_order' | 'marketplace';
  rma_type?: 'Warranty' | 'Redeem';
  parent_order_id?: number;
  selected_item_ids?: Array<number | string>;
  selected_parts?: Record<string | number, string[]>;
  channel?: 'Tokopedia' | 'Shopee' | 'TikTok Shop' | 'Manual / WhatsApp' | string;
  marketplace_invoice?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  shipping_address?: {
    address_1: string;
    city?: string;
    state?: string;
    postcode: string;
    country?: string;
  };
  items?: ManualWarrantyItem[];
  courier_id?: string;
  courier_label?: string;
  shipping_cost?: number;
  actual_shipping_cost?: number;
  is_qc_fault?: boolean;
  qc_deduction_reason?: string;
  waive_shipping?: boolean;
  claim_reason?: string;
  initial_status?: 'processing' | 'on-hold' | 'preparing-order';
  notes?: string;
  admin_name?: string;
  allow_duplicate?: boolean;
  override_reason?: string;
}

export interface RmaClaimLogItem {
  id: number;
  name: string;
  quantity: number;
  configuration?: string;
  claimed_parts?: string[];
  device?: string;
}

export interface RmaClaimLogEntry {
  order_id: number;
  order_number: string;
  created_at: string;
  type: 'Warranty' | 'Redeem';
  status: 'pending_review' | 'approved' | 'rejected';
  order_status: string;
  channel: string;
  original_invoice: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  claim_reason?: string;
  customer_notes?: string;
  shipping_cost: number;
  waived_shipping: boolean;
  video_url?: string;
  video_deleted?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  items: RmaClaimLogItem[];
}

export interface RmaClaimsStats {
  total: number;
  warranty_count: number;
  redeem_count: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  waived_count: number;
}

export interface RmaClaimsLogResponse {
  success: boolean;
  claims: RmaClaimLogEntry[];
  stats: RmaClaimsStats;
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  error?: string;
}

export async function createManualWarrantyClaimDirect(
  payload: ManualWarrantyClaimPayload
): Promise<{
  success: boolean;
  replacement_order_id?: number;
  replacement_order_number?: string;
  shipping_cost?: number;
  message?: string;
  hr_webhook?: {
    dispatched: boolean;
    success: boolean;
    code: number;
    error?: string;
  };
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/warranty/manual-claim`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        replacement_order_id: data.replacement_order_id,
        replacement_order_number: data.replacement_order_number,
        shipping_cost: data.shipping_cost,
        message: data.message,
        hr_webhook: data.hr_webhook,
      };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchRmaClaimsLogDirect(params?: {
  type?: 'all' | 'Warranty' | 'Redeem';
  status?: 'all' | 'pending_review' | 'approved' | 'rejected';
  channel?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<RmaClaimsLogResponse> {
  const base = getWordPressBaseUrl();
  const searchParams = new URLSearchParams();
  if (params?.type && params.type !== 'all') searchParams.set('type', params.type);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.channel && params.channel !== 'all') searchParams.set('channel', params.channel);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.per_page) searchParams.set('per_page', String(params.per_page));

  const url = `${base}/wp-json/exacoat-core/v1/warranty/claims-log?${searchParams.toString()}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        claims: data.claims || [],
        stats: data.stats || {
          total: 0,
          warranty_count: 0,
          redeem_count: 0,
          pending_count: 0,
          approved_count: 0,
          rejected_count: 0,
          waived_count: 0,
        },
        pagination: data.pagination || {
          page: 1,
          per_page: 20,
          total_items: 0,
          total_pages: 1,
        },
      };
    }
    return {
      success: false,
      claims: [],
      stats: { total: 0, warranty_count: 0, redeem_count: 0, pending_count: 0, approved_count: 0, rejected_count: 0, waived_count: 0 },
      pagination: { page: 1, per_page: 20, total_items: 0, total_pages: 1 },
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      claims: [],
      stats: { total: 0, warranty_count: 0, redeem_count: 0, pending_count: 0, approved_count: 0, rejected_count: 0, waived_count: 0 },
      pagination: { page: 1, per_page: 20, total_items: 0, total_pages: 1 },
      error: err.message,
    };
  }
}

export async function checkMarketplaceInvoiceDirect(
  invoice: string,
  channel?: string
): Promise<{
  success: boolean;
  available: boolean;
  existing_order_id?: number;
  existing_order_number?: string;
  existing_order_type?: string;
  order_date?: string;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/warranty/check-invoice`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ invoice: invoice.trim(), channel }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        available: Boolean(data.available),
        existing_order_id: data.existing_order_id,
        existing_order_number: data.existing_order_number,
        existing_order_type: data.existing_order_type,
        order_date: data.order_date,
        message: data.message,
      };
    }
    return {
      success: false,
      available: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, available: false, error: err.message };
  }
}

// ==========================================
// 30-Day Money Back Guarantee System
// ==========================================

export interface GuaranteeClaimEntry {
  order_id: number;
  order_number: string;
  order_status: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  shipped_at: string;
  days_since_shipped: number;
  guarantee_status: 'pending_return' | 'package_received' | 'refunded' | 'rejected' | 'expired';
  refund_method: 'store_credit' | 'bank_transfer' | 'paypal' | string;
  refund_amount: number;
  refund_amount_fmt: string;
  refund_destination: string;
  return_courier?: string;
  return_tracking_number?: string;
  submitted_at: string;
  days_since_claim?: number;
  days_remaining_to_return?: number;
  is_expired?: boolean;
  reason?: string;
  claimed_items: any[];
}

export interface GuaranteeClaimsStats {
  total: number;
  pending_return: number;
  package_received: number;
  refunded: number;
  rejected: number;
  expired?: number;
}

export interface GuaranteeClaimsLogResponse {
  success: boolean;
  claims: GuaranteeClaimEntry[];
  stats: GuaranteeClaimsStats;
  pagination: {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
  error?: string;
}

export async function fetchGuaranteeClaimsDirect(params?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<GuaranteeClaimsLogResponse> {
  const base = getWordPressBaseUrl();
  const searchParams = new URLSearchParams();
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.per_page) searchParams.set('per_page', String(params.per_page));

  const url = `${base}/wp-json/exacoat-core/v1/guarantee/claims-log?${searchParams.toString()}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        claims: data.claims || [],
        stats: data.stats || { total: 0, pending_return: 0, package_received: 0, refunded: 0, rejected: 0, expired: 0 },
        pagination: data.pagination || { page: 1, per_page: 20, total_items: 0, total_pages: 1 },
      };
    }
    return {
      success: false,
      claims: [],
      stats: { total: 0, pending_return: 0, package_received: 0, refunded: 0, rejected: 0, expired: 0 },
      pagination: { page: 1, per_page: 20, total_items: 0, total_pages: 1 },
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      claims: [],
      stats: { total: 0, pending_return: 0, package_received: 0, refunded: 0, rejected: 0, expired: 0 },
      pagination: { page: 1, per_page: 20, total_items: 0, total_pages: 1 },
      error: err.message,
    };
  }
}

export async function processGuaranteeActionDirect(
  orderId: number,
  action: 'mark_received' | 'approve_refund' | 'reject' | 'expire' | 'auto_expire_overdue',
  notes?: string
): Promise<{
  success: boolean;
  status?: string;
  refund_amount?: string;
  email_dispatched?: boolean;
  expired_count?: number;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/guarantee/action`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        action,
        notes: notes?.trim(),
      }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        status: data.status,
        refund_amount: data.refund_amount,
        email_dispatched: data.email_dispatched,
        expired_count: data.expired_count,
        message: data.message,
      };
    }
    return {
      success: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// Shopee Open Platform API v2 Bridge
// ==========================================

export async function fetchShopeeOrdersDirect(): Promise<{
  success: boolean;
  orders?: ShopeeOrder[];
  total?: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/orders`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        orders: data.orders || [],
        total: data.total || (data.orders || []).length,
      };
    }
    return {
      success: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function syncShopeeOrdersDirect(): Promise<{
  success: boolean;
  orders?: ShopeeOrder[];
  total_synced?: number;
  synced_at?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/sync`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        orders: data.orders || [],
        total_synced: data.total_synced || (data.orders || []).length,
        synced_at: data.synced_at,
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchShopeeSettingsDirect(): Promise<{
  success: boolean;
  settings?: ShopeeSettings;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/settings`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      const settingsObj = data.settings || data;
      try {
        localStorage.setItem('_exacoat_shopee_settings_cache', JSON.stringify(settingsObj));
      } catch (e) {}
      return {
        success: true,
        settings: settingsObj,
      };
    }

    const cached = localStorage.getItem('_exacoat_shopee_settings_cache');
    if (cached) {
      try {
        return { success: true, settings: JSON.parse(cached) };
      } catch (e) {}
    }

    return {
      success: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    const cached = localStorage.getItem('_exacoat_shopee_settings_cache');
    if (cached) {
      try {
        return { success: true, settings: JSON.parse(cached) };
      } catch (e) {}
    }
    return { success: false, error: err.message };
  }
}

export async function saveShopeeSettingsDirect(
  settings: Partial<{
    environment: 'sandbox' | 'live';
    test_partner_id: number;
    test_partner_key: string;
    test_push_partner_key: string;
    live_partner_id: number;
    live_partner_key: string;
    live_push_partner_key: string;
    redirect_url: string;
    push_callback_url: string;
    shop_id: number;
    shop_name: string;
  }>
): Promise<{
  success: boolean;
  settings?: ShopeeSettings;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/settings`;

  // Always update local cache so inputs are never lost
  try {
    const prev = JSON.parse(localStorage.getItem('_exacoat_shopee_settings_cache') || '{}');
    const merged = {
      ...prev,
      ...settings,
      has_live_key: Boolean(settings.live_partner_key || prev.has_live_key || prev.live_partner_key),
      has_live_push_key: Boolean(settings.live_push_partner_key || prev.has_live_push_key || prev.live_push_partner_key),
    };
    localStorage.setItem('_exacoat_shopee_settings_cache', JSON.stringify(merged));
  } catch (e) {}

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      const settingsObj = data.settings || data;
      try {
        localStorage.setItem('_exacoat_shopee_settings_cache', JSON.stringify(settingsObj));
      } catch (e) {}
      return {
        success: true,
        settings: settingsObj,
        message: data.message || 'Shopee settings updated successfully.',
      };
    }

    const cached = JSON.parse(localStorage.getItem('_exacoat_shopee_settings_cache') || '{}');
    return {
      success: true,
      settings: cached,
      message: 'Settings saved locally. Update plugin on WordPress to sync live API.',
    };
  } catch (err: any) {
    const cached = JSON.parse(localStorage.getItem('_exacoat_shopee_settings_cache') || '{}');
    return {
      success: true,
      settings: cached,
      message: 'Settings saved locally.',
    };
  }
}

export async function getShopeeAuthUrlDirect(): Promise<{
  success: boolean;
  auth_url?: string;
  environment?: string;
  partner_id?: number;
  redirect_url?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/auth-url`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        auth_url: data.auth_url,
        environment: data.environment,
        partner_id: data.partner_id,
        redirect_url: data.redirect_url,
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleShopeeCallbackDirect(
  code: string,
  shop_id: number
): Promise<{
  success: boolean;
  access_token?: string;
  shop_id?: number;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/callback?code=${encodeURIComponent(code)}&shop_id=${encodeURIComponent(shop_id)}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        access_token: data.access_token,
        shop_id: data.shop_id,
        message: 'Shopee store connected successfully.',
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchShopeeShippingParameterDirect(order_sn: string): Promise<{
  success: boolean;
  parameters?: ShopeeShippingParameter;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/shipping-parameter?order_sn=${encodeURIComponent(order_sn)}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        parameters: data.response || data.parameters || {},
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function arrangeShopeeShipmentDirect(
  order_sn: string,
  payload: ArrangeShipmentPayload
): Promise<{
  success: boolean;
  order_sn?: string;
  order_status?: string;
  tracking_number?: string;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/ship-order`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        order_sn,
        ship_data: payload,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        order_sn: data.order_sn,
        order_status: data.order_status,
        tracking_number: data.tracking_number,
        message: data.message,
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getShopeeShippingDocumentUrl(order_sn: string, doc_type = 'THERMAL_AIR_WAYBILL'): string {
  const base = getWordPressBaseUrl();
  return `${base}/wp-json/exacoat-core/v1/shopee/shipping-document?order_sn=${encodeURIComponent(order_sn)}&document_type=${encodeURIComponent(doc_type)}`;
}

export async function downloadShopeeShippingLabelDirect(order_sn: string): Promise<{
  success: boolean;
  blob?: Blob;
  url?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/shipping-document?order_sn=${encodeURIComponent(order_sn)}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/pdf, application/json' },
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      return {
        success: true,
        blob,
        url: objectUrl,
      };
    }

    const data = await res.json();
    return {
      success: false,
      error: data?.message || data?.error || 'Could not download PDF from Shopee.',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// TikTok Shop Open Platform API Bridge
// ==========================================

export async function fetchTikTokOrdersDirect(): Promise<{
  success: boolean;
  orders?: TikTokOrder[];
  total?: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/orders`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        orders: data.orders || [],
        total: data.total || (data.orders || []).length,
      };
    }
    return {
      success: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function syncTikTokOrdersDirect(days = 15): Promise<{
  success: boolean;
  orders?: TikTokOrder[];
  total_synced?: number;
  synced_at?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/sync`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ days }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        orders: data.orders || [],
        total_synced: data.total_synced || (data.orders || []).length,
        synced_at: data.synced_at,
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchTikTokSettingsDirect(): Promise<{
  success: boolean;
  settings?: TikTokSettings;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/settings`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        settings: data,
      };
    }
    return {
      success: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveTikTokSettingsDirect(
  settings: Partial<{
    environment: 'sandbox' | 'live';
    service_id: string;
    app_key: string;
    app_secret: string;
    shop_cipher: string;
    shop_name: string;
  }>
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/settings`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        message: data.message,
      };
    }
    return {
      success: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTikTokAuthUrlDirect(): Promise<{
  success: boolean;
  auth_url?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/auth-url`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        auth_url: data.auth_url,
      };
    }
    return {
      success: false,
      error: data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function refreshTikTokShopsDirect(): Promise<{
  success: boolean;
  shop_cipher?: string;
  shop_id?: string;
  shop_name?: string;
  shops?: any[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/refresh-shops`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        shop_cipher: data.shop_cipher,
        shop_id: data.shop_id,
        shop_name: data.shop_name,
        shops: data.shops,
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function handleTikTokCallbackDirect(
  code: string,
  shop_id?: string,
  auth_code?: string
): Promise<{
  success: boolean;
  access_token?: string;
  shop_id?: string;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const query = new URLSearchParams({
    code,
    ...(shop_id ? { shop_id } : {}),
    ...(auth_code ? { auth_code } : {}),
  }).toString();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/callback?${query}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        access_token: data.access_token,
        shop_id: data.shop_id,
        message: 'TikTok Shop connected successfully.',
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function arrangeTikTokShipmentDirect(
  package_id: string,
  payload: {
    pick_up_type?: number;
    tracking_number?: string;
    shipping_provider_id?: string;
    order_id?: string;
  }
): Promise<{
  success: boolean;
  package_id?: string;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/ship-package`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        package_id,
        ...payload,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        package_id: data.package_id,
        message: data.message,
      };
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getTikTokShippingDocumentUrl(package_id: string, doc_size = 'A6'): string {
  const base = getWordPressBaseUrl();
  return `${base}/wp-json/exacoat-core/v1/tiktok/shipping-document?package_id=${encodeURIComponent(package_id)}&document_size=${encodeURIComponent(doc_size)}`;
}

export async function downloadTikTokShippingLabelDirect(
  package_id: string,
  doc_size = 'A6'
): Promise<{
  success: boolean;
  blob?: Blob;
  url?: string;
  doc_url?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/shipping-document?package_id=${encodeURIComponent(package_id)}&document_size=${encodeURIComponent(doc_size)}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/pdf, application/json' },
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      return {
        success: true,
        blob,
        url: objectUrl,
      };
    }

    const data = await res.json();
    if (data?.doc_url) {
      return {
        success: true,
        doc_url: data.doc_url,
      };
    }

    return {
      success: false,
      error: data?.message || data?.error || 'Could not download PDF from TikTok.',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface MarketplaceTrackingCheckpoint {
  time: string;
  timestamp: number;
  description: string;
  stage?: 'pickup' | 'in_transit' | 'delivered' | string;
  logistics_status?: string;
  location?: string;
}

export interface MarketplaceTrackingResponse {
  success: boolean;
  order_sn?: string;
  order_id?: string;
  tracking_number?: string;
  shipping_carrier?: string;
  logistics_status?: string;
  is_delivered: boolean;
  delivered_time?: string | null;
  delivered_ts?: number | null;
  checkpoints: MarketplaceTrackingCheckpoint[];
  error?: string;
}

export async function fetchShopeeTrackingInfoDirect(
  orderSn: string
): Promise<MarketplaceTrackingResponse> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/tracking-info?order_sn=${encodeURIComponent(orderSn)}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        order_sn: data.order_sn,
        tracking_number: data.tracking_number,
        shipping_carrier: data.shipping_carrier,
        logistics_status: data.logistics_status,
        is_delivered: Boolean(data.is_delivered),
        delivered_time: data.delivered_time,
        delivered_ts: data.delivered_ts,
        checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints : [],
      };
    }
    return {
      success: false,
      is_delivered: false,
      checkpoints: [],
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, is_delivered: false, checkpoints: [], error: err.message };
  }
}

export async function fetchTikTokTrackingInfoDirect(
  orderId: string
): Promise<MarketplaceTrackingResponse> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/tracking-info?order_id=${encodeURIComponent(orderId)}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        order_id: data.order_id,
        tracking_number: data.tracking_number,
        shipping_carrier: data.shipping_carrier,
        is_delivered: Boolean(data.is_delivered),
        delivered_time: data.delivered_time,
        delivered_ts: data.delivered_ts,
        checkpoints: Array.isArray(data.checkpoints) ? data.checkpoints : [],
      };
    }
    return {
      success: false,
      is_delivered: false,
      checkpoints: [],
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, is_delivered: false, checkpoints: [], error: err.message };
  }
}



