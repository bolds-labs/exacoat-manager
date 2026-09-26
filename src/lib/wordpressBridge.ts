/**
 * Exacoat Manager - WordPress & WooCommerce Bridge
 * Direct communication bridge with exacoat-core REST endpoints and WooCommerce API.
 * Strict Antislop compliant: No em dashes in copy or notifications.
 */

import { getEnv, getWordPressBaseUrl, getWcCredentials } from './env';
import { CreateReviewPayload, Order, OrderItem, OrderShipping, OrderTracking, DeviceConfiguratorProfile, MarketplaceDeviceImageSettings, ConfiguratorProfileSummary, DeviceFamily, AdminUser, ExacoatRole } from '../types';
export type { MarketplaceDeviceImageSettings };
import { renderEmailHtmlLocally } from './emailRenderer';
import { extractItemSpecs } from './orderItems';
import { normalizeDeviceName } from './seoUtils';


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
  jne_email_cc?: string;
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
  note?: string;
  item_note?: string;
  order_item_note?: string;
  buyer_note?: string;
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
  package_number?: string;
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
  ship_by_date?: string | null;
  ship_by_timestamp?: number | null;
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
  time_slot_list?: ShopeePickupTimeSlot[];
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
  ship_by_date?: string | null;
  ship_by_timestamp?: number | null;
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
  texture_url?: string;
  texture_big_url?: string;
  color_hex?: string;
  in_stock: boolean;
  is_active?: boolean;
  extra_price: number;
  accent_extra_price?: number;
  class_name?: string;
  is_custom_per_device?: boolean;
  badge_text?: string;
  badge_color?: string;
  order?: number;
  shadow_opacity?: number;
  highlight_opacity?: number;
  surface_gradient_enabled?: boolean;
  surface_gradient_opacity?: number;
}

export interface FinishSurchargeTier {
  id: string;
  label: string;
  min_price: number;
  max_price: number;
  surcharge: number;
  description?: string;
}

export const DEFAULT_FINISH_SURCHARGE_TIERS: FinishSurchargeTier[] = [
  {
    id: 'tier_small',
    label: 'Small Accents & Cutouts',
    min_price: 10000,
    max_price: 45000,
    surcharge: 5000,
  },
  {
    id: 'tier_medium',
    label: 'Medium Parts & Accents',
    min_price: 45001,
    max_price: 95000,
    surcharge: 15000,
  },
  {
    id: 'tier_primary',
    label: 'Full Skin & Main Body',
    min_price: 95001,
    max_price: 999999,
    surcharge: 30000,
  },
];

export const DEFAULT_GLOBAL_FINISHES: GlobalFinish[] = [
  { id: 'swarm', name: 'Swarm', group: 'Signature skins', slug: 'swarm', thumbnail: 'https://exacoat.com/wp-content/uploads/Swarm-Texture-Thumbnail.jpg', color_hex: '#1f2024', in_stock: true, extra_price: 30000 },
  { id: 'black-camo', name: 'Black Camo', group: 'Signature skins', slug: 'black-camo', thumbnail: 'https://exacoat.com/wp-content/uploads/Black-Camo-Texture-Thumbnail.jpg', texture_big_url: 'https://staging.exacoat.com/wp-content/uploads/Exacoat-Texture-Big-Black-Camo.jpg', color_hex: '#2a2b2e', in_stock: true, extra_price: 30000 },
  { id: 'patina', name: 'Patina', group: 'Signature skins', slug: 'patina', thumbnail: 'https://exacoat.com/wp-content/uploads/Patina-Texture-Thumbnail.jpg', color_hex: '#325c56', in_stock: false, extra_price: 30000 },
  { id: 'slate', name: 'Slate', group: 'Signature skins', slug: 'slate', thumbnail: 'https://exacoat.com/wp-content/uploads/Slate-Texture-Thumbnail.jpg', color_hex: '#4a4d52', in_stock: true, extra_price: 30000 },
  { id: 'dragon-black', name: 'Dragon Black', group: 'Signature skins', slug: 'dragon-black', thumbnail: 'https://exacoat.com/wp-content/uploads/Dragon-Black-Texture-Thumbnail.jpg', color_hex: '#1c1c1e', in_stock: true, extra_price: 0 },
  { id: 'carbon-fiber-black', name: 'Carbon Fiber Black', group: 'Signature skins', slug: 'carbon-fiber-black', thumbnail: 'https://exacoat.com/wp-content/uploads/Carbon-Fiber-Black-Texture-Thumbnail.jpg', color_hex: '#202022', in_stock: true, extra_price: 0 },
  { id: 'forged-carbon', name: 'Forged Carbon', group: 'Signature skins', slug: 'forged-carbon', thumbnail: 'https://exacoat.com/wp-content/uploads/Forged-Carbon-Texture-Thumbnail.jpg', color_hex: '#2e2e33', in_stock: true, extra_price: 30000 },
  { id: 'woven', name: 'Woven', group: 'Signature skins', slug: 'woven', thumbnail: 'https://exacoat.com/wp-content/uploads/Woven-Texture-Thumbnail.jpg', color_hex: '#2b2d30', in_stock: true, extra_price: 30000 },
  { id: 'matte-black', name: 'Matte Black', group: 'Colors', slug: 'matte-black', thumbnail: 'https://exacoat.com/wp-content/uploads/Matte-Black-Texture-Thumbnail.jpg', color_hex: '#18181b', in_stock: true, extra_price: 0 },
  { id: 'matte-white', name: 'Matte White', group: 'Colors', slug: 'matte-white', thumbnail: 'https://exacoat.com/wp-content/uploads/Matte-White-Texture-Thumbnail.jpg', color_hex: '#f4f4f6', in_stock: true, extra_price: 0, surface_gradient_enabled: true, surface_gradient_opacity: 0.22 },
  { id: 'arctic-blue', name: 'Arctic Blue', group: 'Colors', slug: 'arctic-blue', thumbnail: 'https://exacoat.com/wp-content/uploads/Arctic-Blue-Texture-Thumbnail.jpg', color_hex: '#7ba7c2', in_stock: true, extra_price: 0 },
  { id: 'glacial-green', name: 'Glacial Green', group: 'Colors', slug: 'glacial-green', thumbnail: 'https://exacoat.com/wp-content/uploads/Glacial-Green-Texture-Thumbnail.jpg', color_hex: '#8db4a2', in_stock: true, extra_price: 0 },
  { id: 'mellow-yellow', name: 'Mellow Yellow', group: 'Colors', slug: 'mellow-yellow', thumbnail: 'https://exacoat.com/wp-content/uploads/Mellow-Yellow-Texture-Thumbnail.jpg', color_hex: '#e8ca65', in_stock: true, extra_price: 0 },
  { id: 'petal-pink', name: 'Petal Pink', group: 'Colors', slug: 'petal-pink', thumbnail: 'https://exacoat.com/wp-content/uploads/Petal-Pink-Texture-Thumbnail.jpg', color_hex: '#e5a5b5', in_stock: true, extra_price: 0 },
  { id: 'blush-pink', name: 'Blush Pink', group: 'Colors', slug: 'blush-pink', thumbnail: 'https://exacoat.com/wp-content/uploads/Blush-Pink-Texture-Thumbnail.jpg', color_hex: '#d98299', in_stock: true, extra_price: 0 },
  { id: 'emerald-green', name: 'Emerald Green', group: 'Colors', slug: 'emerald-green', thumbnail: 'https://exacoat.com/wp-content/uploads/Emerald-Green-Texture-Thumbnail.jpg', color_hex: '#1e5631', in_stock: true, extra_price: 0 },
  { id: 'lust-red', name: 'Lust Red', group: 'Colors', slug: 'lust-red', thumbnail: 'https://exacoat.com/wp-content/uploads/Lust-Red-Texture-Thumbnail.jpg', color_hex: '#b22222', in_stock: true, extra_price: 0 },
  { id: 'lemon-yellow', name: 'Lemon Yellow', group: 'Colors', slug: 'lemon-yellow', thumbnail: 'https://exacoat.com/wp-content/uploads/Lemon-Yellow-Texture-Thumbnail.jpg', color_hex: '#f5d033', in_stock: true, extra_price: 0 },
  { id: 'marble-white', name: 'Marble White', group: 'Natural', slug: 'marble-white', thumbnail: 'https://exacoat.com/wp-content/uploads/Marble-White-Texture-Thumbnail.jpg', color_hex: '#e2e4e8', in_stock: true, extra_price: 0 },
  { id: 'leather-black', name: 'Leather Black', group: 'Natural', slug: 'leather-black', thumbnail: 'https://exacoat.com/wp-content/uploads/Leather-Black-Texture-Thumbnail.jpg', color_hex: '#1a1a1c', in_stock: true, extra_price: 0 },
  { id: 'titanium-black', name: 'Titanium Black', group: 'Natural', slug: 'titanium-black', thumbnail: 'https://exacoat.com/wp-content/uploads/Titanium-Black-Texture-Thumbnail.jpg', color_hex: '#262629', in_stock: true, extra_price: 0 }
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

    // Attach WooCommerce credentials to /wp-json/wc/ and /wp-json/exacoat-core/ requests if not using JWT Bearer
    const isWcOrPluginRoute = targetUrlObj.pathname.includes('/wp-json/wc/') ||
      targetUrlObj.pathname.includes('/wp-json/exacoat-core/');

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
  const trackingMeta = metaList.find((m: any) => m.key === 'tracking_number' || m.key === '_tracking_number' || m.key === '_exacoat_tracking_number' || m.key === '_artmatter_tracking_number');
  const carrierMeta = metaList.find((m: any) => m.key === '_shipping_carrier' || m.key === 'carrier_id' || m.key === '_carrier_id');
  const checkpointsMeta = metaList.find((m: any) => m.key === '_exacoat_tracking_checkpoints' || m.key === '_artmatter_tracking_checkpoints');
  const latestStatusMeta = metaList.find((m: any) => m.key === '_biteship_latest_status' || m.key === '_exacoat_trackingmore_latest_status' || m.key === '_exacoat_17track_latest_status' || m.key === '_artmatter_trackingmore_latest_status' || m.key === '_artmatter_17track_latest_status');
  const districtMeta = metaList.find((m: any) => m.key === '_shipping_district');
  const subdistrictMeta = metaList.find((m: any) => m.key === '_shipping_subdistrict');
  const phoneMeta = metaList.find((m: any) => m.key === '_shipping_phone_formatted' || m.key === '_billing_phone');

  const rawItems = (Array.isArray(order.items) && order.items.length > 0)
    ? order.items
    : (Array.isArray(order.line_items) ? order.line_items : (Array.isArray(order.items) ? order.items : []));

  const lineItems = rawItems.map((item: any) => {
    let resolvedImg = item.image_url || (item.image?.src ? item.image.src : '');
    if (!resolvedImg && Array.isArray(item.meta_data)) {
      const cfgImgMeta = item.meta_data.find(
        (m: any) =>
          m.key === '_configured_image_url' ||
          m.key === '_configurator_image' ||
          m.key === 'mkl_pc_thumbnail_url' ||
          m.key === '_thumbnail_url' ||
          m.key === 'image_url'
      );
      if (cfgImgMeta?.value) {
        resolvedImg = String(cfgImgMeta.value);
      }
    }

    return {
      ...item,
      image_url: resolvedImg || item.image_url,
      parsed_configurator: item.parsed_configurator || parseConfiguratorFromItem(item),
    };
  });

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

export async function purgeCloudflareCacheDirect(
  targetOrOptions: 'manager' | 'storefront' | 'all' | { target?: 'manager' | 'storefront' | 'all'; zone_id?: string } = 'all',
  zoneId?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  let target: 'manager' | 'storefront' | 'all' = 'all';
  let zId = zoneId;

  if (typeof targetOrOptions === 'object' && targetOrOptions !== null) {
    target = targetOrOptions.target || 'all';
    zId = targetOrOptions.zone_id || zId;
  } else if (typeof targetOrOptions === 'string') {
    if (targetOrOptions === 'manager' || targetOrOptions === 'storefront' || targetOrOptions === 'all') {
      target = targetOrOptions;
    } else {
      zId = targetOrOptions;
    }
  }

  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/cache/cloudflare/purge`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ target, zone_id: zId }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testCloudflareCacheDirect(
  tokenOrOptions?: string | { zone_id?: string; token?: string; cloudflare_zone_id?: string; cloudflare_api_token?: string }
): Promise<{ success: boolean; zone_name?: string; latencyMs?: number; latency_ms?: number; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/diagnostics/test-cloudflare`;

  let zoneId = '';
  let token = '';

  if (typeof tokenOrOptions === 'string') {
    token = tokenOrOptions;
  } else if (typeof tokenOrOptions === 'object' && tokenOrOptions !== null) {
    zoneId = tokenOrOptions.zone_id || tokenOrOptions.cloudflare_zone_id || '';
    token = tokenOrOptions.token || tokenOrOptions.cloudflare_api_token || '';
  }

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        token,
        api_token: token,
        cloudflare_api_token: token,
        zone_id: zoneId,
        cloudflare_zone_id: zoneId,
      }),
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

function filterAndSortOpenAiModels(rawModels: string[]): string[] {
  const excluded = ['embedding', 'whisper', 'tts', 'dall-e', 'babbage', 'davinci', 'moderation', 'realtime', 'transcribe', 'audio', 'search', 'canary'];
  const filtered = rawModels.filter(m => {
    if (!m) return false;
    const lower = m.toLowerCase();
    if (excluded.some(term => lower.includes(term))) return false;
    return true;
  });

  const getScore = (m: string) => {
    if (m.startsWith('gpt-5')) return 110;
    if (m === 'gpt-4o') return 100;
    if (m === 'gpt-4o-mini') return 95;
    if (m.startsWith('o3-mini')) return 90;
    if (m === 'o1') return 85;
    if (m.startsWith('o1-mini')) return 80;
    if (m.includes('gpt-4.5')) return 75;
    if (m === 'chatgpt-4o-latest') return 70;
    if (m.startsWith('gpt-4o')) return 65;
    if (m.startsWith('gpt-4-turbo')) return 60;
    if (m.startsWith('gpt-4')) return 50;
    if (m.startsWith('gpt-3.5')) return 30;
    return 10;
  };

  return Array.from(new Set(filtered)).sort((a, b) => {
    const diff = getScore(b) - getScore(a);
    if (diff !== 0) return diff;
    return b.localeCompare(a);
  });
}

function filterAndSortGeminiModels(rawModels: string[]): string[] {
  const excluded = ['embedding', 'aqa', 'imagen', 'learnlm', 'veo'];
  const clean = rawModels
    .map(m => (m || '').replace(/^models\//, ''))
    .filter(m => {
      if (!m) return false;
      const lower = m.toLowerCase();
      if (excluded.some(term => lower.includes(term))) return false;
      return lower.includes('gemini') || lower.includes('flash');
    });

  const getScore = (m: string) => {
    if (m.includes('2.5-pro')) return 100;
    if (m.includes('2.5-flash')) return 95;
    if (m.includes('2.0-flash') && !m.includes('lite')) return 90;
    if (m.includes('2.0-flash-lite')) return 85;
    if (m.includes('2.0-pro')) return 80;
    if (m.includes('1.5-pro')) return 70;
    if (m.includes('1.5-flash')) return 65;
    if (m.includes('gemini')) return 50;
    return 10;
  };

  return Array.from(new Set(clean)).sort((a, b) => {
    const diff = getScore(b) - getScore(a);
    if (diff !== 0) return diff;
    return b.localeCompare(a);
  });
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
  const base = getWordPressBaseUrl();
  const key = (apiKey || getCachedPluginSettings().gemini_api_key || '').trim();

  // 1. If key is provided in client, fetch Google Gemini directly first for live models
  if (key) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, {
        headers: { Accept: 'application/json' },
      });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        const rawModels = Array.isArray(data.models) ? data.models.map((m: any) => m.name || '') : [];
        const models = filterAndSortGeminiModels(rawModels.length > 0 ? rawModels : ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash']);
        return {
          success: true,
          latencyMs: latency,
          latency_ms: latency,
          available_models: models,
          message: `Google Gemini API connected in ${latency}ms (${models.length} models found)`,
        };
      }
    } catch {
      // Fallback to backend diagnostics if direct client fetch encounters issues
    }
  }

  // 2. Query WordPress Diagnostics backend endpoint (for keys in wp-config.php or server CMS)
  try {
    const wpUrl = `${base}/wp-json/exacoat-core/v1/diagnostics/test-gemini`;
    const res = await authenticatedFetch(wpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ api_key: key }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.available_models) && data.available_models.length > 0) {
        return {
          success: true,
          latencyMs: data.latency_ms || Math.round(performance.now() - start),
          latency_ms: data.latency_ms || Math.round(performance.now() - start),
          available_models: filterAndSortGeminiModels(data.available_models),
          message: data.message || 'Google Gemini connected',
        };
      } else if (data.success) {
        return {
          success: true,
          latencyMs: data.latency_ms || Math.round(performance.now() - start),
          latency_ms: data.latency_ms || Math.round(performance.now() - start),
          available_models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
          message: data.message || 'Google Gemini connected',
        };
      } else if (!key) {
        return {
          success: false,
          latencyMs: Math.round(performance.now() - start),
          latency_ms: Math.round(performance.now() - start),
          message: data.message || data.error || 'Gemini API key not configured',
          error: data.message || data.error || 'Gemini API key not configured',
        };
      }
    }
  } catch {
    // If backend bridge call fails, continue to key check
  }

  if (!key) {
    return { success: false, error: 'Gemini API key is required' };
  }

  return { success: false, error: 'Unable to connect to Google Gemini API' };
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
  const base = getWordPressBaseUrl();
  const key = (apiKey || getCachedPluginSettings().openai_api_key || '').trim();

  // 1. If key is provided in client, fetch OpenAI directly first for live models
  if (key) {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        const rawModels = Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];
        const models = filterAndSortOpenAiModels(rawModels);
        return {
          success: true,
          latencyMs: latency,
          latency_ms: latency,
          available_models: models,
          message: `OpenAI API connected in ${latency}ms (${models.length} models found)`,
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          latencyMs: latency,
          latency_ms: latency,
          error: errData?.error?.message || `HTTP ${res.status}`,
          message: errData?.error?.message || `HTTP ${res.status}`,
        };
      }
    } catch {
      // Fallback to backend diagnostics if direct client fetch encounters issues
    }
  }

  // 2. Query WordPress Diagnostics backend endpoint (for keys in wp-config.php or server CMS)
  try {
    const wpUrl = `${base}/wp-json/exacoat-core/v1/diagnostics/test-openai`;
    const res = await authenticatedFetch(wpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ api_key: key }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.available_models) && data.available_models.length > 0) {
        return {
          success: true,
          latencyMs: data.latency_ms || Math.round(performance.now() - start),
          latency_ms: data.latency_ms || Math.round(performance.now() - start),
          available_models: filterAndSortOpenAiModels(data.available_models),
          message: data.message || 'OpenAI connected',
        };
      } else if (data.success) {
        return {
          success: true,
          latencyMs: data.latency_ms || Math.round(performance.now() - start),
          latency_ms: data.latency_ms || Math.round(performance.now() - start),
          available_models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'gpt-4-turbo'],
          message: data.message || 'OpenAI connected',
        };
      } else if (!key) {
        return {
          success: false,
          latencyMs: Math.round(performance.now() - start),
          latency_ms: Math.round(performance.now() - start),
          message: data.message || data.error || 'OpenAI API key not configured',
          error: data.message || data.error || 'OpenAI API key not configured',
        };
      }
    }
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    return { success: false, latencyMs: latency, latency_ms: latency, error: err.message };
  }

  if (!key) {
    return { success: false, error: 'OpenAI API key is required' };
  }

  return { success: false, error: 'Unable to connect to OpenAI API' };
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
  const start = performance.now();
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/fandom/generate`;

  let provider = 'openai';
  let prompt = '';
  let model = '';
  let clientOpenAiKey = '';
  let clientGeminiKey = '';

  if (typeof providerOrOptions === 'string') {
    provider = providerOrOptions;
    if (typeof customPromptOrOptions === 'string') prompt = customPromptOrOptions;
  } else if (typeof providerOrOptions === 'object' && providerOrOptions !== null) {
    provider = providerOrOptions.model || providerOrOptions.provider || 'openai';
    prompt = providerOrOptions.prompt || providerOrOptions.system_prompt || '';
    model = providerOrOptions.model || '';
    clientOpenAiKey = providerOrOptions.openai_api_key || '';
    clientGeminiKey = providerOrOptions.gemini_api_key || '';
  }

  // 1. Try WordPress Backend endpoint
  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: fandomName, provider, prompt, model }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && (data.text || data.description)) {
        return {
          ...data,
          text: data.text || data.description,
          description: data.description || data.text,
          model_used: data.model_used || model || provider,
          latency_ms: data.latency_ms || Math.round(performance.now() - start),
          message: data.message,
        };
      }
    }
  } catch {
    // If backend route fails or is not yet deployed, fallback to direct provider API
  }

  // 2. Direct client-side AI generation fallback
  const isGemini = provider.toLowerCase().includes('gemini');
  if (isGemini) {
    const geminiKey = clientGeminiKey || getCachedPluginSettings().gemini_api_key || '';
    const geminiModel = model || getCachedPluginSettings().gemini_model || 'gemini-2.5-flash';
    if (geminiKey) {
      try {
        const fullPrompt = `${prompt}\n\nCollection or theme name: "${fandomName}"`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          }),
        });
        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          return {
            success: true,
            text,
            description: text,
            model_used: geminiModel,
            latency_ms: latency,
          };
        }
      } catch (err: any) {
        return { success: false, error: err.message, message: err.message };
      }
    }
  } else {
    const openAiKey = clientOpenAiKey || getCachedPluginSettings().openai_api_key || '';
    const openAiModel = model || getCachedPluginSettings().openai_model || 'gpt-4o-mini';
    if (openAiKey) {
      try {
        const isReasoningOrGpt5 = /^(o[0-9]|gpt-5)/i.test(openAiModel.replace(/^openai\//, '').trim());
        const getRequestBody = (withTemperature: boolean) => {
          const body: Record<string, any> = {
            model: openAiModel,
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: `Collection or theme name: "${fandomName}"` },
            ],
          };
          if (withTemperature && !isReasoningOrGpt5) {
            body.temperature = 0.7;
          }
          return JSON.stringify(body);
        };

        let res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: getRequestBody(true),
        });

        // If rejected due to temperature parameter with reasoning or new models, retry without temperature
        if (!res.ok) {
          const errClone = await res.clone().json().catch(() => ({}));
          const errMsg = errClone?.error?.message || '';
          if (/temperature/i.test(errMsg)) {
            res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${openAiKey}`,
              },
              body: getRequestBody(false),
            });
          }
        }

        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content || '';
          return {
            success: true,
            text,
            description: text,
            model_used: openAiModel,
            latency_ms: latency,
          };
        }
      } catch (err: any) {
        return { success: false, error: err.message, message: err.message };
      }
    }
  }

  return { success: false, error: 'AI description generator unavailable. Check API key.' };
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

export interface UpdateOrderPayload {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_note?: string;
  shipping?: Partial<OrderShipping>;
  billing?: Partial<OrderShipping>;
  items?: Array<{
    id?: number;
    product_id?: number;
    name?: string;
    quantity?: number;
    price?: number;
    subtotal?: number;
    total?: number;
    specs?: Array<{ label: string; value: string }>;
  }>;
  deleted_item_ids?: number[];
}

export async function updateOrderDirect(
  orderId: number | string,
  payload: UpdateOrderPayload
): Promise<{ success: boolean; order?: Order; message?: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/orders/${orderId}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data?.success && data?.order) {
      return {
        success: true,
        order: enrichOrder(data.order),
        message: data.message || 'Order updated successfully',
      };
    }
    if (data?.message) {
      return { success: false, error: data.message };
    }
    return { success: false, error: `HTTP ${res.status} response` };
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

export async function fetchSalesAnalytics(
  startIso: string, 
  endIso: string, 
  channel?: string
): Promise<{
  success: boolean;
  currencies: SalesAnalyticsCurrency[];
  top_products: SalesAnalyticsProduct[];
  channel_totals?: {
    webstore?: { gross: number; net: number; orders: number };
    shopee?: { gross: number; net: number; orders: number };
    tiktok?: { gross: number; net: number; orders: number };
  };
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(`${base}/wp-json/exacoat-core/v1/orders/analytics`, window.location.origin);
  url.searchParams.set('start', startIso);
  url.searchParams.set('end', endIso);
  if (channel && channel !== 'all') {
    url.searchParams.set('channel', channel);
  }
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
      channel_totals: data.channel_totals,
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

export interface FinishGroupSetting {
  display_style?: 'cards' | 'compact_dots';
  collapsed_by_default?: boolean;
  show_more_limit?: number;
}

export interface ConfiguratorPreset {
  id: string;
  title: string;
  tagline?: string;
  badge?: 'POPULAR' | 'STAFF PICK' | string;
  coverage?: 'model_360' | 'model_cut';
  logo_cutout?: boolean;
  layers: Record<string, string>;
  triggers?: string[];
  image_url?: string;
}

export async function fetchGlobalFinishesDirect(): Promise<{
  success: boolean;
  finishes: GlobalFinish[];
  groups?: string[];
  group_settings?: Record<string, FinishGroupSetting>;
  presets?: ConfiguratorPreset[];
  surcharge_tiers?: FinishSurchargeTier[];
  error?: string;
}> {
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
        groups: Array.isArray(data?.groups) ? data.groups : undefined,
        group_settings: data?.group_settings,
        presets: Array.isArray(data?.presets) ? data.presets : undefined,
        surcharge_tiers: Array.isArray(data?.surcharge_tiers) ? data.surcharge_tiers : undefined,
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
          groups: Array.isArray(nextData?.groups) ? nextData.groups : undefined,
          group_settings: nextData?.group_settings,
          presets: Array.isArray(nextData?.presets) ? nextData.presets : undefined,
          surcharge_tiers: Array.isArray(nextData?.surcharge_tiers) ? nextData.surcharge_tiers : undefined,
        };
      }
    }
  } catch {}

  return {
    success: true,
    finishes: localFinishes,
    surcharge_tiers: DEFAULT_FINISH_SURCHARGE_TIERS,
  };
}

export async function fetchFinishSurchargeTiersDirect(): Promise<{
  success: boolean;
  tiers: FinishSurchargeTier[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/surcharge-tiers?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (res.ok && !!data?.success && Array.isArray(data?.tiers)) {
      return {
        success: true,
        tiers: data.tiers,
      };
    }
  } catch (err: any) {
    console.error('Failed to fetch surcharge tiers:', err);
  }

  return {
    success: true,
    tiers: DEFAULT_FINISH_SURCHARGE_TIERS,
  };
}

export async function saveFinishSurchargeTiersDirect(tiers: FinishSurchargeTier[]): Promise<{
  success: boolean;
  tiers?: FinishSurchargeTier[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/surcharge-tiers`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ tiers }),
    });
    const data = await res.json();
    if (res.ok && !!data?.success && Array.isArray(data?.tiers)) {
      return {
        success: true,
        tiers: data.tiers,
      };
    }
    return {
      success: false,
      error: data?.message || 'Failed to save finish surcharge tiers',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error saving finish surcharge tiers',
    };
  }
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

export async function toggleFinishActiveDirect(id: string, isActive: boolean): Promise<{ success: boolean; finishes?: GlobalFinish[]; error?: string }> {
  let updatedList: GlobalFinish[] = DEFAULT_GLOBAL_FINISHES;
  try {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(FINISHES_STORAGE_KEY) : null;
    const current = cached ? JSON.parse(cached) : DEFAULT_GLOBAL_FINISHES;
    updatedList = current.map((f: GlobalFinish) => f.id === id ? { ...f, is_active: isActive } : f);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(updatedList));
    }
  } catch {}

  try {
    await fetch('http://localhost:3020/api/configurator/finishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: isActive }),
    });
  } catch {}

  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/toggle-active`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id, is_active: isActive }),
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

export async function saveGlobalFinishDirect(finish: Partial<GlobalFinish>): Promise<{ success: boolean; finishes?: GlobalFinish[]; groups?: string[]; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/save`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(finish),
    });
    const data = await res.json();
    if (res.ok && !!data?.success && Array.isArray(data?.finishes)) {
      try { localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(data.finishes)); } catch {}
    }
    return {
      success: res.ok && !!data?.success,
      finishes: data?.finishes,
      groups: data?.groups,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteGlobalFinishDirect(id: string): Promise<{ success: boolean; finishes?: GlobalFinish[]; groups?: string[]; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/delete`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (res.ok && !!data?.success && Array.isArray(data?.finishes)) {
      try { localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(data.finishes)); } catch {}
    }
    return {
      success: res.ok && !!data?.success,
      finishes: data?.finishes,
      groups: data?.groups,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function reorderFinishGroupsDirect(groups: string[]): Promise<{ success: boolean; groups?: string[]; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/reorder-groups`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ groups }),
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      groups: data?.groups,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function renameFinishGroupDirect(oldName: string, newName: string): Promise<{ success: boolean; groups?: string[]; finishes?: GlobalFinish[]; updated_count?: number; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/rename-group`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ old_name: oldName, new_name: newName }),
    });
    const data = await res.json();
    if (res.ok && !!data?.success && Array.isArray(data?.finishes)) {
      try { localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(data.finishes)); } catch {}
    }
    return {
      success: res.ok && !!data?.success,
      groups: data?.groups,
      finishes: data?.finishes,
      updated_count: data?.updated_count,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveAllGlobalFinishesDirect(
  finishes: GlobalFinish[],
  groups?: string[],
  group_settings?: Record<string, FinishGroupSetting>
): Promise<{ success: boolean; finishes?: GlobalFinish[]; groups?: string[]; group_settings?: Record<string, FinishGroupSetting>; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/save-all`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ finishes, groups, group_settings }),
    });
    const data = await res.json();
    if (res.ok && !!data?.success && Array.isArray(data?.finishes)) {
      try { localStorage.setItem(FINISHES_STORAGE_KEY, JSON.stringify(data.finishes)); } catch {}
    }
    return {
      success: res.ok && !!data?.success,
      finishes: data?.finishes,
      groups: data?.groups,
      group_settings: data?.group_settings,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveFinishGroupSettingsDirect(settings: Record<string, FinishGroupSetting>): Promise<{
  success: boolean;
  group_settings?: Record<string, FinishGroupSetting>;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/finishes/group-settings`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ settings }),
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      group_settings: data?.group_settings,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchConfiguratorPresetsDirect(): Promise<{
  success: boolean;
  presets?: ConfiguratorPreset[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/presets?_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      presets: Array.isArray(data?.presets) ? data.presets : [],
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveConfiguratorPresetsDirect(presets: ConfiguratorPreset[]): Promise<{
  success: boolean;
  presets?: ConfiguratorPreset[];
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/presets`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ presets }),
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      presets: Array.isArray(data?.presets) ? data.presets : [],
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

export async function fetchProductsDirect(params?: { search?: string; page?: number; per_page?: number; category?: string; status?: string }): Promise<{
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
  if (params?.status) url.searchParams.set('status', params.status);
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
  only_configurable?: boolean;
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
  if (params?.only_configurable !== undefined) {
    url.searchParams.set('only_configurable', params.only_configurable ? 'true' : 'false');
  } else {
    url.searchParams.set('only_configurable', 'true');
  }
  url.searchParams.set('per_page', String(params?.per_page || 500));
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
        if (catLower.includes('macbook') || catLower.includes('laptop')) { family = 'laptop'; size_multiplier = 2.0; }
        else if (catLower.includes('keyboard')) { family = 'keyboard'; size_multiplier = 2.0; }
        else if (catLower.includes('pad') || catLower.includes('tablet')) { family = 'tablet'; size_multiplier = 2.0; }
        else if (catLower.includes('fold') || catLower.includes('flip')) { family = 'foldable'; size_multiplier = 1.3; }

        return {
          product_id: p.id,
          name: p.name,
          slug: p.slug,
          status: p.status || 'publish',
          price: Number(p.price) || 0,
          categories: (p.categories || []).map((c: any) => c.name),
          is_migrated: Boolean(modernRaw),
          configurator_version: modern?.configurator_version || 'v1',
          is_configurable: Boolean(layers.length > 0 || modernRaw),
          layers_count: modern?.layers?.length || layers.length || 0,
          views_count: modern?.views?.length || angles.length || 1,
          family,
          size_multiplier,
          texture_scale: modern?.views?.[0]?.texture_scale ?? modern?.texture_scale ?? 0.75,
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

export async function toggleProductConfiguratorDirect(
  productId: number,
  isConfigurator: boolean
): Promise<{
  success: boolean;
  product_id?: number;
  is_configurator?: boolean;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/toggle-configurator`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        is_configurator: isConfigurator,
      }),
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        product_id: data.product_id,
        is_configurator: data.is_configurator,
        message: data.message,
      };
    }
    return {
      success: false,
      error: data?.message || 'Failed updating configurator status',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error updating configurator status',
    };
  }
}

export async function extractShadingDirect(
  sourceImageUrl: string,
  options?: {
    shadow_contrast?: number;
    highlight_contrast?: number;
  }
): Promise<{
  success: boolean;
  shadow_url?: string;
  highlight_url?: string;
  base_lum?: number;
  message?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/extract-shading`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        source_image_url: sourceImageUrl,
        shadow_contrast: options?.shadow_contrast ?? 1.2,
        highlight_contrast: options?.highlight_contrast ?? 1.0,
      }),
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        shadow_url: data.shadow_url,
        highlight_url: data.highlight_url,
        base_lum: data.base_lum,
        message: data.message,
      };
    }
    return {
      success: false,
      error: data?.message || 'Failed extracting shading overlays',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error extracting shading',
    };
  }
}

export async function markDeviceAuditedDirect(data: {
  product_id: number;
  audit_status: 'clean' | 'issues';
  audit_issues?: number;
  last_audited_at?: string;
  audit_details?: string[];
}): Promise<{ success: boolean; message?: string }> {
  try {
    const base = getWordPressBaseUrl();
    const url = `${base}/wp-json/exacoat-core/v1/configurator/mark-audited`;

    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    return {
      success: Boolean(res.ok && resData?.success),
      message: resData?.message,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function batchMarkDevicesAuditedDirect(results: Array<{
  product_id: number;
  audit_status: 'clean' | 'issues';
  audit_issues?: number;
  last_audited_at?: string;
  audit_details?: string[];
}>): Promise<{ success: boolean; updated?: number; message?: string }> {
  try {
    const base = getWordPressBaseUrl();
    const url = `${base}/wp-json/exacoat-core/v1/configurator/batch-mark-audited`;

    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ results }),
    });

    const resData = await res.json();
    return {
      success: Boolean(res.ok && resData?.success),
      updated: resData?.updated,
      message: resData?.message,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function resetDeviceAuditDirect(productId?: number, all = false): Promise<{ success: boolean; message?: string }> {
  try {
    const base = getWordPressBaseUrl();
    const url = `${base}/wp-json/exacoat-core/v1/configurator/reset-audit`;

    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ product_id: productId, all }),
    });

    const resData = await res.json();
    return {
      success: Boolean(res.ok && resData?.success),
      message: resData?.message,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export interface WpMediaItem {
  id: number;
  title: string;
  filename: string;
  url: string;
  thumbnail_url: string;
  width?: number;
  height?: number;
  mime?: string;
  mime_type?: string;
  date?: string;
  file_size?: number;
}

export async function fetchWordPressMedia(params?: {
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<{ success: boolean; items: WpMediaItem[]; total: number; total_pages: number; error?: string }> {
  const base = getWordPressBaseUrl();
  const searchParam = params?.search ? `&search=${encodeURIComponent(params.search)}` : '';
  const pageParam = params?.page ? `&page=${params.page}` : '&page=1';
  const perPageParam = params?.per_page ? `&per_page=${params.per_page}` : '&per_page=24';
  const url = `${base}/wp-json/exacoat-core/v1/media/list?_t=${Date.now()}${searchParam}${pageParam}${perPageParam}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        items: Array.isArray(data.items) ? data.items : [],
        total: Number(data.total) || 0,
        total_pages: Number(data.total_pages) || 1,
      };
    }
    return { success: false, items: [], total: 0, total_pages: 1, error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, items: [], total: 0, total_pages: 1, error: err.message || 'Network error' };
  }
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
        return lName !== 'device' && !lName.includes('device-body');
      });
      const cleanVariants = (data.profile.variants || []).filter((v: any) => {
        const vId = (v.id || '').toLowerCase();
        const vName = (v.name || '').toLowerCase();
        const hasCoverageOptions = Array.isArray(v.options) && v.options.some((opt: any) => {
          const optId = (opt.id || '').toLowerCase();
          const optName = (opt.name || '').toLowerCase();
          return optId.includes('360') || optName.includes('360') || optId.includes('model-cut') || optName.includes('model cut');
        });
        return !hasCoverageOptions && vId !== 'model' && vName !== 'model' && !vId.includes('logo') && !vName.includes('logo') && !vId.includes('cutout') && !vId.includes('coverage') && !vName.includes('coverage') && !vId.includes('360') && !vName.includes('360');
      });

      // Sanitize corrupted unicode degree representations in presets or strings
      const sanitizedPresets = Array.isArray(data.profile.presets)
        ? data.profile.presets.map((p: any) => ({
            ...p,
            title: typeof p.title === 'string' ? p.title.replace(/360u00b0/gi, '360°').replace(/360\\u00b0/gi, '360°') : p.title,
            tagline: typeof p.tagline === 'string' ? p.tagline.replace(/360u00b0/gi, '360°').replace(/360\\u00b0/gi, '360°') : p.tagline,
          }))
        : [];

      const numId = typeof idOrSlug === 'number' ? idOrSlug : parseInt(String(idOrSlug), 10);
      const safeProductId = Number(data.profile.product_id) || (Number.isFinite(numId) ? numId : 0);

      const resolvedProfile: DeviceConfiguratorProfile = {
        ...data.profile,
        product_id: safeProductId || Number((data.profile as any).id) || 0,
        base_price: Number(data.profile.base_price) || 0,
        device_name: data.profile.device_name || '',
        device_slug: data.profile.device_slug || '',
        category: data.profile.category || 'General',
        currency: data.profile.currency || 'IDR',
        layers: cleanLayers,
        variants: cleanVariants,
        presets: sanitizedPresets,
        configurator_version: data.profile.configurator_version || 'v1',
      };
      const mergedMpSettings = getSavedMarketplaceDeviceSettings(resolvedProfile);
      if (mergedMpSettings) {
        resolvedProfile.marketplace_image_settings = mergedMpSettings;
      }

      return {
        success: true,
        profile: resolvedProfile,
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
            return lName !== 'device' && !lName.includes('device-body');
          });
          const cleanVariants = (parsedModern.variants || []).filter((v: any) => {
            const vId = (v.id || '').toLowerCase();
            const vName = (v.name || '').toLowerCase();
            return !vId.includes('logo') && !vName.includes('logo') && !vId.includes('cutout') && !vId.includes('coverage') && !vName.includes('coverage');
          });
          const finishesRes = await fetchGlobalFinishesDirect();
          const resolvedFallback: DeviceConfiguratorProfile = {
            ...parsedModern,
            product_id: p.id,
            device_name: p.name,
            device_slug: p.slug,
            category: (p.categories || [])[0]?.name || 'General',
            base_price: Number(parsedModern.base_price) || Number(p.price) || 0,
            currency: 'IDR',
            layers: cleanLayers,
            variants: cleanVariants,
            configurator_version: parsedModern.configurator_version || 'v1',
          };
          const mergedMpSettings = getSavedMarketplaceDeviceSettings(resolvedFallback);
          if (mergedMpSettings) {
            resolvedFallback.marketplace_image_settings = mergedMpSettings;
          }
          return {
            success: true,
            profile: resolvedFallback,
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
      if (catLower.includes('macbook') || catLower.includes('laptop')) { family = 'laptop'; size_multiplier = 2.0; }
      else if (catLower.includes('keyboard')) { family = 'keyboard'; size_multiplier = 2.0; }
      else if (catLower.includes('pad') || catLower.includes('tablet')) { family = 'tablet'; size_multiplier = 2.0; }
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
          logo_cutout_mask_url: '',
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

      // Extract Logo Cutout overlay image from MKL layers if present
      const logoLayer = layers.find((l: any) => {
        const n = (l.name || '').toLowerCase();
        return n.includes('logo') || n.includes('cutout');
      });
      let logoOverlayUrl = '';
      if (logoLayer) {
        const logoChoices = contentByLayer[logoLayer._id] || [];
        logoChoices.forEach((ch: any) => {
          const chName = (ch.name || '').toLowerCase();
          if (chName.includes('with') || chName.includes('logo') || (ch.images && ch.images.length > 0)) {
            (ch.images || []).forEach((im: any) => {
              const url = im.image?.url;
              if (url) {
                logoOverlayUrl = url;
                const matchingView = convertedViews.find((v: any) => v.legacy_id === im.angleId || v.name === im.angle_name);
                if (matchingView) {
                  matchingView.logo_cutout_mask_url = url;
                }
              }
            });
          }
        });
      }

      // Fallback logo URL to all views if matched
      if (logoOverlayUrl) {
        convertedViews.forEach((v: any) => {
          if (!v.logo_cutout_mask_url) v.logo_cutout_mask_url = logoOverlayUrl;
        });
      }

      // Production variants are strictly reserved for physical hardware models (e.g. Wi-Fi vs Cellular).
      // Coverage and Logo Cutout are strictly handled by coverage_and_cutouts.
      const convertedVariants: any[] = [];

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

        let layerExtraPrice = 0;

        rawChoices.forEach((ch: any) => {
          const chPrice = Number(ch.price || ch.extra_price) || 0;
          if (chPrice > 0 && layerExtraPrice === 0) {
            layerExtraPrice = chPrice;
          }

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
          extra_price: layerExtraPrice,
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
          texture_scale: 0.75,
          is_configurable: true,
          configurator_version: 'v1',
          device_colors: [],
          views: convertedViews.length > 0 ? convertedViews : [{ id: 'main_view', name: 'Main View', is_default: true, aspect_ratio: '1:1', canvas_dimensions: { width: 1000, height: 1000 } }],
          layers: convertedLayers,
          variants: convertedVariants,
          coverage_and_cutouts: {
            has_logo_cutout: Boolean(logoOverlayUrl || logoLayer || family === 'laptop'),
            logo_cutout_mask_url: logoOverlayUrl,
            has_pencil_cutout: false,
            has_model_cut: false,
            coverage_type: 'none',
          },
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
    const cleanVariants = profile.variants ? profile.variants.filter((v: any) => {
      const vId = (v.id || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();
      const hasCoverageOptions = Array.isArray(v.options) && v.options.some((opt: any) => {
        const optId = (opt.id || '').toLowerCase();
        const optName = (opt.name || '').toLowerCase();
        return optId.includes('360') || optName.includes('360') || optId.includes('model-cut') || optName.includes('model cut');
      });
      return !hasCoverageOptions && vId !== 'model' && vName !== 'model' && !vId.includes('logo') && !vName.includes('logo') && !vId.includes('cutout') && !vId.includes('coverage') && !vName.includes('coverage') && !vId.includes('360') && !vName.includes('360');
    }) : undefined;

    const cleanPresets = Array.isArray(profile.presets) ? profile.presets.map((p: any) => ({
      ...p,
      title: typeof p.title === 'string' ? p.title.replace(/360u00b0/gi, '360°').replace(/360\\u00b0/gi, '360°') : p.title,
      tagline: typeof p.tagline === 'string' ? p.tagline.replace(/360u00b0/gi, '360°').replace(/360\\u00b0/gi, '360°') : p.tagline,
    })) : profile.presets;

    const targetProductId = Number(profile.product_id) || Number((profile as any).id) || 0;
    if (!targetProductId) {
      return { success: false, error: 'Valid product_id is required' };
    }

    const payload = {
      ...profile,
      product_id: targetProductId,
      ...(cleanVariants !== undefined ? { variants: cleanVariants } : {}),
      ...(cleanPresets !== undefined ? { presets: cleanPresets } : {}),
    };

    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
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

const MARKETPLACE_DEVICE_SETTINGS_STORAGE_KEY = 'exacoat_device_marketplace_settings_v1';

export function getSavedMarketplaceDeviceSettings(
  profile?: Partial<DeviceConfiguratorProfile> | null
): MarketplaceDeviceImageSettings | null {
  if (!profile) return null;

  let localEntry: MarketplaceDeviceImageSettings | null = null;
  try {
    const raw = localStorage.getItem(MARKETPLACE_DEVICE_SETTINGS_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw) as Record<string, MarketplaceDeviceImageSettings>;
      const pidKey = profile.product_id ? `id:${profile.product_id}` : '';
      const slugKey = profile.device_slug ? `slug:${profile.device_slug.toLowerCase().trim()}` : '';
      const nameKey = profile.device_name ? `name:${profile.device_name.toLowerCase().trim()}` : '';
      localEntry =
        (pidKey && map[pidKey]) ||
        (slugKey && map[slugKey]) ||
        (nameKey && map[nameKey]) ||
        null;
    }
  } catch {}

  const serverEntry = profile.marketplace_image_settings || null;
  if (localEntry && serverEntry) {
    // Prefer whichever has a newer timestamp, or merge with localEntry taking precedence for recent edits
    return {
      ...serverEntry,
      ...localEntry,
    };
  }
  return localEntry || serverEntry || null;
}

export async function saveMarketplaceDeviceSettingsDirect(
  profile: Partial<DeviceConfiguratorProfile>,
  settings: MarketplaceDeviceImageSettings
): Promise<{
  success: boolean;
  settings: MarketplaceDeviceImageSettings;
  error?: string;
}> {
  const stamped: MarketplaceDeviceImageSettings = {
    ...settings,
    updated_at: new Date().toISOString(),
  };

  // 1. Always persist immediately in localStorage under product_id, device_slug, and device_name
  try {
    const raw = localStorage.getItem(MARKETPLACE_DEVICE_SETTINGS_STORAGE_KEY);
    const map: Record<string, MarketplaceDeviceImageSettings> = raw ? JSON.parse(raw) : {};
    if (profile.product_id) {
      map[`id:${profile.product_id}`] = stamped;
    }
    if (profile.device_slug) {
      map[`slug:${profile.device_slug.toLowerCase().trim()}`] = stamped;
    }
    if (profile.device_name) {
      map[`name:${profile.device_name.toLowerCase().trim()}`] = stamped;
    }
    localStorage.setItem(MARKETPLACE_DEVICE_SETTINGS_STORAGE_KEY, JSON.stringify(map));
  } catch {}

  // 2. Persist to WordPress product meta via dedicated endpoint (with fallback to profile save)
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/save-marketplace-settings`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        product_id: profile.product_id,
        device_slug: profile.device_slug,
        settings: stamped,
      }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        settings: data.marketplace_image_settings || stamped,
      };
    }
  } catch {}

  // 3. Fallback: if remote plugin hasn't been updated with /save-marketplace-settings yet, save via /configurator/save if full profile is present
  if (profile.product_id && Array.isArray(profile.views) && Array.isArray(profile.layers)) {
    try {
      await saveProductConfiguratorProfileDirect({
        ...profile,
        marketplace_image_settings: stamped,
      });
    } catch {}
  }

  return {
    success: true,
    settings: stamped,
  };
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
  auto_generate_seo?: boolean;
  category_name?: string;
}): Promise<{
  success: boolean;
  productId?: number;
  name?: string;
  slug?: string;
  price?: number;
  seoGenerated?: boolean;
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
    if (res.ok && data?.success && data.product_id) {
      const newProductId = Number(data.product_id);
      const targetName = (data.name || params.new_name || '').replace(/\s*\(Copy\)$/i, '').trim() || params.new_name;
      const cleanDevice = normalizeDeviceName(targetName) || targetName;
      let seoGenerated = false;

      if (params.auto_generate_seo !== false) {
        try {
          const aiRes = await generateProductSeoAndDescriptionAi(
            cleanDevice,
            params.category_name || 'Skins'
          );
          if (aiRes.success && aiRes.data) {
            const seoSave = await updateProductSeoDirect(newProductId, {
              short_description: aiRes.data.short_description || '',
              seo_title: aiRes.data.seo_title || `${cleanDevice} Skin & Wrap | Exacoat`,
              seo_description: aiRes.data.seo_description || '',
              focus_keyword: aiRes.data.focus_keyword || `${cleanDevice.toLowerCase()} skin`,
            });
            seoGenerated = seoSave.success;
          }
        } catch {}
      }

      if (!seoGenerated) {
        try {
          await updateProductSeoDirect(newProductId, {
            short_description: '',
            seo_title: `${cleanDevice} Skin & Wrap | Exacoat`,
            seo_description: `Protect your ${cleanDevice} with precision-cut textured wraps. Zero-bulk scratch defense, confident grip, and residue-free removal.`,
            focus_keyword: `${cleanDevice.toLowerCase()} skin`,
          });
        } catch {}
      }

      return {
        success: true,
        productId: newProductId,
        name: data.name,
        slug: data.slug,
        price: data.price,
        seoGenerated,
        message: data.message,
      };
    }
    return { success: false, error: data?.message || data?.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface StorefrontRevalidationResponse {
  success: boolean;
  message?: string;
  results?: {
    nextjs?: {
      success: boolean;
      status_code?: number;
      details?: any;
      error?: string;
    };
    cloudflare?: {
      success?: boolean;
      configured?: boolean;
      status_code?: number;
      details?: any;
      error?: string;
      message?: string;
    };
  };
  error?: string;
}

export async function revalidateStorefrontWebDirect(params?: {
  slug?: string;
  category?: string;
  tag?: string;
  path?: string;
  purge_everything?: boolean;
}): Promise<StorefrontRevalidationResponse> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/revalidate-web`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params || {}),
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      message: data?.message,
      results: data?.results,
      error: data?.error || data?.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface DeviceFamilySyncResponse {
  success: boolean;
  total_scanned?: number;
  updated_count?: number;
  updated_devices?: Array<{
    product_id: number;
    name: string;
    old_family: string;
    new_family: string;
    old_mult: number;
    new_mult: number;
  }>;
  message?: string;
  error?: string;
}

export async function syncDeviceFamiliesDirect(): Promise<DeviceFamilySyncResponse> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/configurator/sync-device-families`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
    const data = await res.json();
    return {
      success: res.ok && !!data?.success,
      total_scanned: data?.total_scanned,
      updated_count: data?.updated_count,
      updated_devices: data?.updated_devices,
      message: data?.message,
      error: data?.error || data?.message,
    };
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
  parent_order_id: number | string;
  parent_order_number: string;
  channel?: string;
  buyer_note?: string;
  shopee_notes?: string;
  rma_status: string;
  claim_reason?: string;
  customer_notes?: string;
  video_proof_url?: string;
  video_deleted: boolean;
  video_deleted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  items?: Array<{
    name: string;
    quantity: number;
    image?: string;
    configuration?: string;
    device_model?: string;
    claimed_parts?: string[];
    item_note?: string;
    note?: string;
  }>;
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
  item_note?: string;
  note?: string;
}

export interface ManualWarrantyClaimPayload {
  source_type: 'existing_order' | 'marketplace';
  rma_type?: 'Warranty' | 'Redeem';
  parent_order_id?: number;
  selected_item_ids?: Array<number | string>;
  selected_parts?: Record<string | number, string[]>;
  channel?: 'Tokopedia' | 'Shopee' | 'TikTok Shop' | 'Manual / WhatsApp' | string;
  marketplace_invoice?: string;
  buyer_note?: string;
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
  item_note?: string;
  note?: string;
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
  buyer_note?: string;
  shopee_notes?: string;
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

export interface RmaChannelCounts {
  web: number;
  shopee: number;
  tiktok: number;
  other: number;
}

export interface RmaTypeAnalytics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  channels: RmaChannelCounts;
}

export interface RmaPeriodMetrics {
  warranty: RmaTypeAnalytics;
  redeem: RmaTypeAnalytics;
  channel_totals: RmaChannelCounts & { total: number };
}

export interface RmaAnalyticsData {
  today: RmaPeriodMetrics;
  this_week: RmaPeriodMetrics;
  this_month: RmaPeriodMetrics;
  last_30_days: RmaPeriodMetrics;
  all_time: RmaPeriodMetrics;
}

export interface RmaClaimsLogResponse {
  success: boolean;
  claims: RmaClaimLogEntry[];
  stats: RmaClaimsStats;
  analytics?: RmaAnalyticsData;
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
        analytics: data.analytics,
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

export async function fetchShopeeOrdersDirect(params?: {
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  orders?: ShopeeOrder[];
  total?: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/orders${qs ? '?' + qs : ''}`;

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

export async function syncShopeeOrdersDirect(days = 30, limit = 500): Promise<{
  success: boolean;
  orders?: ShopeeOrder[];
  total_synced?: number;
  total_cached?: number;
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
      body: JSON.stringify({ days, limit }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        orders: data.orders || [],
        total_synced: data.total_synced ?? (data.orders || []).length,
        total_cached: data.total_cached ?? (data.orders || []).length,
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

export async function downloadShopeeBatchShippingLabelsDirect(order_sns: string[]): Promise<{
  success: boolean;
  blob?: Blob;
  url?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/shipping-document?order_sns=${encodeURIComponent(order_sns.join(','))}`;

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
      error: data?.message || data?.error || 'Tidak dapat mengunduh batch label PDF dari Shopee.',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleShopeeOrderPrintDirect(
  order_sn: string,
  is_printed: boolean
): Promise<{
  success: boolean;
  order_sn?: string;
  is_printed?: boolean;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/orders/toggle-print`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ order_sn, is_printed }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==========================================
// TikTok Shop Open Platform API Bridge
// ==========================================

export async function fetchTikTokOrdersDirect(params?: {
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  orders?: TikTokOrder[];
  total?: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/orders${qs ? '?' + qs : ''}`;

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

export async function syncTikTokOrdersDirect(days = 30, limit = 500): Promise<{
  success: boolean;
  orders?: TikTokOrder[];
  total_synced?: number;
  total_cached?: number;
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
      body: JSON.stringify({ days, limit }),
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        orders: data.orders || [],
        total_synced: data.total_synced ?? (data.orders || []).length,
        total_cached: data.total_cached ?? (data.orders || []).length,
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

export interface ShopeeProductImage {
  image_id: string;
  image_url: string;
}

export interface ShopeeTierOption {
  option: string;
  image_id?: string;
  image_url?: string;
}

export interface ShopeeTierVariation {
  name: string;
  options: ShopeeTierOption[];
  option_list?: any[];
}

export interface ShopeeProductModel {
  model_id: number;
  tier_index: number[];
  model_sku?: string;
  original_price: number;
  current_price: number;
  normal_stock: number;
}

export interface ShopeeProductPreview {
  success: boolean;
  item_id: number;
  item_name: string;
  description: string;
  category_id: number;
  brand?: {
    brand_id: number;
    original_brand_name: string;
  };
  item_status: string;
  weight: number;
  dimension?: {
    package_height: number;
    package_length: number;
    package_width: number;
  };
  logistic_info?: any[];
  attribute_list?: any[];
  images: ShopeeProductImage[];
  tier_variation: ShopeeTierVariation[];
  models: ShopeeProductModel[];
  inferred_device?: string;
  seller_centre_url?: string;
  error?: string;
  message?: string;
}

export interface ShopeeDuplicatePayload {
  source_item_id: number;
  source_device: string;
  target_device: string;
  custom_item_name?: string;
  custom_description?: string;
  custom_image_ids?: string[];
}

export interface ShopeeDuplicateResult {
  success: boolean;
  new_item_id?: number;
  item_name?: string;
  item_status?: string;
  status_label?: string;
  seller_centre_url?: string;
  models_initialized?: number;
  source_item_id?: number;
  target_device?: string;
  warning?: string;
  error?: string;
  message?: string;
}

export async function fetchShopeeProductPreviewDirect(
  itemIdOrUrl: number | string
): Promise<ShopeeProductPreview> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/product-preview?url=${encodeURIComponent(String(itemIdOrUrl))}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return data as ShopeeProductPreview;
    }
    return {
      success: false,
      item_id: 0,
      item_name: '',
      description: '',
      category_id: 0,
      item_status: 'ERROR',
      weight: 0,
      images: [],
      tier_variation: [],
      models: [],
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      item_id: 0,
      item_name: '',
      description: '',
      category_id: 0,
      item_status: 'ERROR',
      weight: 0,
      images: [],
      tier_variation: [],
      models: [],
      error: err.message,
    };
  }
}

export async function uploadShopeeMediaImageDirect(params: {
  file?: File;
  base64?: string;
  filename?: string;
}): Promise<{
  success: boolean;
  image_id?: string;
  image_url?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/upload-image`;

  try {
    let body: any;
    let headers: Record<string, string> = { Accept: 'application/json' };

    if (params.base64) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        image_data: params.base64,
        filename: params.filename || 'product.jpg',
      });
    } else if (params.file) {
      const formData = new FormData();
      formData.append('image', params.file);
      body = formData;
    } else {
      return { success: false, error: 'No image file or base64 data provided.' };
    }

    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers,
      body,
    });
    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        image_id: data.image_id,
        image_url: data.image_url,
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

export async function duplicateShopeeProductDirect(
  payload: ShopeeDuplicatePayload
): Promise<ShopeeDuplicateResult> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/duplicate-product`;

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
      return data as ShopeeDuplicateResult;
    }
    return {
      success: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface ShopeeInjectVariantImageItem {
  option: string;
  image_id: string;
}

export interface ShopeeInjectImagesPayload {
  item_id: number;
  cover_image_id?: string;
  variant_images?: ShopeeInjectVariantImageItem[];
}

export interface ShopeeInjectImagesResult {
  success: boolean;
  item_id: number;
  cover_updated: boolean;
  gallery_preserved_count: number;
  variants_updated: number;
  seller_centre_url?: string;
  errors?: string[];
  message?: string;
  error?: string;
}

export async function injectShopeeProductImagesDirect(
  payload: ShopeeInjectImagesPayload
): Promise<ShopeeInjectImagesResult> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/product/inject-images`;

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
      return data as ShopeeInjectImagesResult;
    }
    return {
      success: false,
      item_id: payload.item_id,
      cover_updated: Boolean(data?.cover_updated),
      gallery_preserved_count: Number(data?.gallery_preserved_count) || 0,
      variants_updated: Number(data?.variants_updated) || 0,
      errors: Array.isArray(data?.errors) ? data.errors : [],
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      item_id: payload.item_id,
      cover_updated: false,
      gallery_preserved_count: 0,
      variants_updated: 0,
      error: err.message,
    };
  }
}

// ==========================================
// Multi-Channel Product Hub Bridge APIs
// ==========================================

export interface ShopeeListingItem {
  item_id: number;
  item_name: string;
  item_status: string; // 'NORMAL' | 'UNLIST' | 'BANNED' | 'DELETED'
  description?: string;
  price_info?: Array<{
    currency?: string;
    original_price?: number;
    current_price?: number;
  }>;
  stock_info_v2?: {
    summary_info?: {
      total_available_stock?: number;
    };
  };
  image?: {
    image_url_list?: string[];
    image_id_list?: string[];
  };
  brand?: {
    brand_id: number;
    original_brand_name: string;
  };
  category_id?: number;
  create_time?: number;
  update_time?: number;
  seller_centre_url?: string;
}

export interface TikTokListingItem {
  id: string;
  title: string;
  status: string; // 'ACTIVATE' | 'DEACTIVATE' | 'DRAFT' | 'PENDING' | 'FAILED' | 'FREEZE'
  main_images?: string[];
  skus?: Array<{
    id: string;
    seller_sku: string;
    price: string;
    currency: string;
    available_stock: number;
  }>;
  category_chains?: any[];
  create_time?: number;
  update_time?: number;
}

export async function updateProductDirect(
  id: number,
  data: {
    status?: string;
    name?: string;
    regular_price?: string;
    sale_price?: string;
    description?: string;
    short_description?: string;
    images?: Array<{ id?: number; src?: string; alt?: string; name?: string }>;
    meta_data?: Array<{ key: string; value: any }>;
  }
): Promise<{ success: boolean; product?: Product; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/wc/v3/products/${id}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    });

    const respData = await res.json();
    if (res.ok && respData?.id) {
      return { success: true, product: respData as Product };
    }
    return { success: false, error: respData?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface ProductSeoData {
  product_id: number;
  name?: string;
  slug?: string;
  short_description: string;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  google_image_url?: string;
  featured_image_url?: string;
  is_gallery_image?: boolean;
}

export interface ProductSeoGeneratedData {
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  short_description: string;
}

export async function fetchProductSeoDirect(
  productId: number
): Promise<{ success: boolean; data?: ProductSeoData; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/product/seo?product_id=${productId}`;

  try {
    const res = await authenticatedFetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, data };
    }
  } catch {}

  // Fallback to reading product details via standard WC REST API
  try {
    const wcUrl = `${base}/wp-json/wc/v3/products/${productId}`;
    const res = await authenticatedFetch(wcUrl, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const prod = await res.json();
      const metaList = Array.isArray(prod?.meta_data) ? prod.meta_data : [];
      const getMeta = (keys: string[]) => {
        for (const k of keys) {
          const m = metaList.find((entry: any) => entry.key === k);
          if (m && typeof m.value === 'string' && m.value.trim()) return m.value.trim();
        }
        return '';
      };
      const imgs = Array.isArray(prod?.images) ? prod.images : [];
      const hasGallery = imgs.length > 1 && Boolean(imgs[1]?.src);
      return {
        success: true,
        data: {
          product_id: productId,
          name: prod?.name || '',
          slug: prod?.slug || '',
          short_description: prod?.short_description || '',
          seo_title: getMeta(['_yoast_wpseo_title', 'rank_math_title']),
          seo_description: getMeta(['_yoast_wpseo_metadesc', 'rank_math_description']),
          focus_keyword: getMeta(['_yoast_wpseo_focuskw', 'rank_math_focus_keyword']),
          google_image_url: hasGallery ? imgs[1].src : imgs[0]?.src || '',
          featured_image_url: imgs[0]?.src || '',
          is_gallery_image: hasGallery,
        },
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }

  return { success: false, error: 'Failed to fetch product SEO metadata.' };
}

export async function updateProductSeoDirect(
  productId: number,
  data: {
    short_description: string;
    seo_title: string;
    seo_description: string;
    focus_keyword: string;
  }
): Promise<{ success: boolean; data?: ProductSeoData; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/product/seo`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        short_description: data.short_description,
        seo_title: data.seo_title,
        seo_description: data.seo_description,
        focus_keyword: data.focus_keyword,
      }),
    });
    const respData = await res.json();
    if (res.ok && respData?.success) {
      return { success: true, data: respData };
    }
  } catch {}

  // Fallback to updateProductDirect via WooCommerce REST API
  try {
    const wcRes = await updateProductDirect(productId, {
      short_description: data.short_description,
      meta_data: [
        { key: '_yoast_wpseo_title', value: data.seo_title },
        { key: '_yoast_wpseo_metadesc', value: data.seo_description },
        { key: '_yoast_wpseo_focuskw', value: data.focus_keyword },
        { key: 'rank_math_title', value: data.seo_title },
        { key: 'rank_math_description', value: data.seo_description },
        { key: 'rank_math_focus_keyword', value: data.focus_keyword },
      ],
    });
    if (wcRes.success && wcRes.product) {
      return {
        success: true,
        data: {
          product_id: productId,
          name: wcRes.product.name,
          slug: wcRes.product.slug,
          short_description: data.short_description,
          seo_title: data.seo_title,
          seo_description: data.seo_description,
          focus_keyword: data.focus_keyword,
        },
      };
    }
    return { success: false, error: wcRes.error || 'Failed updating product SEO.' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function generateProductSeoAndDescriptionAi(
  productName: string,
  categoryName = 'Skins',
  options?: {
    provider?: 'gemini' | 'openai';
    model?: string;
  }
): Promise<{
  success: boolean;
  data?: ProductSeoGeneratedData;
  model_used?: string;
  latency_ms?: number;
  message?: string;
  error?: string;
}> {
  const start = performance.now();
  const base = getWordPressBaseUrl();
  const cached = getCachedPluginSettings();
  const provider = options?.provider || cached.fandom_provider || cached.ai_provider || 'gemini';
  const model =
    options?.model ||
    (provider === 'gemini'
      ? cached.gemini_model || 'gemini-2.5-flash'
      : cached.openai_model || 'gpt-4o-mini');

  const cleanDevice = normalizeDeviceName(productName) || productName;

  const systemPrompt = `You are the lead creative copywriter for Exacoat (exacoat.com), an industrial-design studio that crafts precision-cut device wraps and skins.

Target Product:
- Device Name: "${cleanDevice}"
- Category: "${categoryName}"

Creative Philosophy & Voice:
- Write with dry, effortless, design-studio wit. The tone is refined, observant, and self-aware: clever enough to make a hardware enthusiast smirk, yet composed and thoroughly premium.
- Capture the everyday irony of owning "${cleanDevice}": hardware engineers spend years shaving fractions of a millimeter off a chassis, balancing weight distribution, and perfecting finishes, only for owners to face a flawed choice. Either bury all that engineering inside a thick plastic case that ruins the silhouette and pocket feel, or carry it bare and let smudges, desk grit, pocket keys, or a slick surface win within a week.
- Think fresh about "${cleanDevice}" specifically (its actual physical proportions, chassis weight, camera plateau geometry, how its surface finish behaves in real hands, or how bulky cases spoil its design). Weave a sharp, original observation into the opening, then pivot naturally to how an Exacoat wrap keeps the exact factory silhouette while adding confident grip and everyday scratch defense.
- Every product must get completely original phrasing. Do not recycle stock jokes or repetitive formulas across devices.

Strict Guardrails:
- Never mention vinyl manufacturer brand names.
- Never sound like a technical spec sheet or installation manual (avoid millimeter thickness measurements, adhesive terminology, or mechanical jargon).
- Strictly NO exclamation marks.
- Strictly NO em dashes of any kind (do not use long dashes "—" or double hyphens "--"). Use commas or periods instead.
- Strictly NO generic AI hype words ("elevate", "revolutionary", "unleash", "game-changer", "ultimate armor", "unparalleled", "seamless").

Output format:
Return ONLY a valid JSON object with the following four keys (no markdown formatting, no conversational text):
{
  "seo_title": "${cleanDevice} Skin & Wrap | Exacoat",
  "seo_description": "Witty, refined Google search snippet (120 to 155 chars) contrasting bulky cases or bare-device flaws with Exacoat's zero-bulk grip and scratch defense. Zero em dashes.",
  "focus_keyword": "${cleanDevice.toLowerCase()} skin",
  "short_description": "2 to 3 sharp, witty, lifestyle-first sentences (35 to 55 words) tailored specifically to the real-world experience of carrying and protecting the ${cleanDevice} without case bulk."
}`;

  const cleanField = (str?: string) => {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/!+/g, '.')
      .replace(/[—–]/g, ', ')
      .replace(/--/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const parseAiJson = (rawText: string): ProductSeoGeneratedData | null => {
    if (!rawText || !rawText.trim()) return null;
    let clean = rawText.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
    clean = clean.replace(/[—–]/g, ', ').replace(/--/g, ', ');

    let parsed: any = null;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {}
      }
    }

    if (parsed && (parsed.seo_title || parsed.seo_description || parsed.short_description)) {
      return {
        seo_title: cleanField(parsed.seo_title) || `${cleanDevice} Skin & Wrap | Exacoat`,
        seo_description: cleanField(parsed.seo_description),
        focus_keyword: cleanField(parsed.focus_keyword) || `${cleanDevice.toLowerCase()} skin`,
        short_description: cleanField(parsed.short_description),
      };
    }

    if (clean.length > 25) {
      const sanitized = cleanField(clean);
      return {
        seo_title: `${cleanDevice} Skin & Wrap | Exacoat`,
        seo_description: sanitized.slice(0, 155).replace(/[\r\n]+/g, ' ').trim(),
        focus_keyword: `${cleanDevice.toLowerCase()} skin`,
        short_description: sanitized,
      };
    }

    return null;
  };

  let lastServerError = '';

  // 1. Try dedicated WordPress Backend Route (/product/generate-seo)
  try {
    const res = await authenticatedFetch(`${base}/wp-json/exacoat-core/v1/product/generate-seo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: cleanDevice,
        category: categoryName,
        provider,
        model,
      }),
    });
    if (res.ok) {
      const respData = await res.json();
      if (respData.success && respData.data?.seo_title) {
        return {
          success: true,
          data: {
            seo_title: cleanField(respData.data.seo_title),
            seo_description: cleanField(respData.data.seo_description),
            focus_keyword: cleanField(respData.data.focus_keyword),
            short_description: cleanField(respData.data.short_description),
          },
          model_used: respData.model_used || model,
          latency_ms: respData.latency_ms || Math.round(performance.now() - start),
          message: respData.message,
        };
      } else if (!respData.success && respData.message) {
        lastServerError = respData.message;
      }
    }
  } catch {}

  // 2. Fallback to existing live WordPress AI endpoint (/fandom/generate)
  // This endpoint is already deployed and running on the live WordPress server with server-side API keys
  try {
    const res = await authenticatedFetch(`${base}/wp-json/exacoat-core/v1/fandom/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: `${cleanDevice} (${categoryName})`,
        provider,
        prompt: systemPrompt,
        model,
      }),
    });
    if (res.ok) {
      const fandomData = await res.json();
      if (fandomData.success && (fandomData.text || fandomData.description)) {
        const parsed = parseAiJson(fandomData.text || fandomData.description || '');
        if (parsed) {
          return {
            success: true,
            data: parsed,
            model_used: fandomData.model_used || model,
            latency_ms: fandomData.latency_ms || Math.round(performance.now() - start),
            message: fandomData.message,
          };
        }
      } else if (!fandomData.success && fandomData.message) {
        lastServerError = fandomData.message;
      }
    }
  } catch (err: any) {
    if (err?.message) lastServerError = err.message;
  }

  // 3. Fallback to direct client-side AI API if keys exist in client cache
  const isGemini = provider.toLowerCase().includes('gemini');

  if (isGemini) {
    const geminiKey = cached.gemini_api_key || '';
    const geminiModel = model || 'gemini-2.5-flash';
    if (geminiKey) {
      try {
        const geminiUrl =
          'https://generativelanguage.googleapis.com/v1beta/models/' +
          encodeURIComponent(geminiModel) +
          ':generateContent?key=' +
          encodeURIComponent(geminiKey);

        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
            generationConfig: { response_mime_type: 'application/json', temperature: 0.7 },
          }),
        });
        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          const jsonResp = await res.json();
          const rawText = jsonResp.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const parsed = parseAiJson(rawText);
          if (parsed) {
            return { success: true, data: parsed, model_used: geminiModel, latency_ms: latency };
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          lastServerError = errData?.error?.message || `Gemini API HTTP ${res.status}`;
        }
      } catch (err: any) {
        lastServerError = err.message;
      }
    }
  } else {
    const openAiKey = cached.openai_api_key || '';
    const openAiModel = model || 'gpt-4o-mini';
    if (openAiKey) {
      try {
        const isReasoningOrGpt5 = /^(o[0-9]|gpt-5)/i.test(openAiModel.replace(/^openai\//, '').trim());
        const getRequestBody = (withTemperature: boolean) => {
          const body: Record<string, any> = {
            model: openAiModel,
            messages: [{ role: 'user', content: systemPrompt }],
            response_format: { type: 'json_object' },
          };
          if (withTemperature && !isReasoningOrGpt5) {
            body.temperature = 0.7;
          }
          return JSON.stringify(body);
        };

        let res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + openAiKey,
          },
          body: getRequestBody(true),
        });

        // If rejected due to temperature parameter with reasoning or new models, retry without temperature
        if (!res.ok) {
          const errClone = await res.clone().json().catch(() => ({}));
          const errMsg = errClone?.error?.message || '';
          if (/temperature/i.test(errMsg)) {
            res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + openAiKey,
              },
              body: getRequestBody(false),
            });
          }
        }

        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          const jsonResp = await res.json();
          const rawText = jsonResp.choices?.[0]?.message?.content || '';
          const parsed = parseAiJson(rawText);
          if (parsed) {
            return { success: true, data: parsed, model_used: openAiModel, latency_ms: latency };
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          lastServerError = errData?.error?.message || `OpenAI API HTTP ${res.status}`;
        }
      } catch (err: any) {
        lastServerError = err.message;
      }
    }
  }

  return {
    success: false,
    error: lastServerError || 'AI SEO generator unavailable. Check API keys in Settings or AI Tools.',
  };
}

export async function deleteProductDirect(
  id: number,
  force = false
): Promise<{ success: boolean; id?: number; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/wc/v3/products/${id}?force=${force}`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json();
    if (res.ok) {
      return { success: true, id: data?.id || id };
    }
    return { success: false, error: data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function uploadWordPressMediaDirect(
  file: File,
  options?: {
    mode?: 'smart' | 'webp' | 'original';
    pngColors?: number;
    jpegQuality?: number;
  }
): Promise<{
  success: boolean;
  id?: number;
  url?: string;
  webp_url?: string;
  item?: WpMediaItem;
  optimization?: {
    originalSize: number;
    optimizedSize: number;
    savedBytes: number;
    savedPercent: number;
    formatLabel: string;
    width: number;
    height: number;
  };
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/media/upload`;

  try {
    const { optimizeImageForUpload } = await import('./imageOptimizer');
    const optimized = await optimizeImageForUpload(file, {
      mode: options?.mode ?? 'smart',
      pngColors: options?.pngColors ?? 128,
      jpegQuality: options?.jpegQuality ?? 0.85,
      webpQuality: 0.85,
    });

    const formData = new FormData();
    formData.append('file', optimized.file);
    formData.append('png_colors', String(options?.pngColors ?? 128));
    formData.append('jpeg_quality', String(Math.round((options?.jpegQuality ?? 0.85) * 100)));
    formData.append('generate_webp', '1');

    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    });

    const data = await res.json();
    if (res.ok && data?.success && data?.url) {
      const uploadedUrl = String(data.url);
      const fileSize = Number(data.file_size || optimized.optimizedSize);
      const item: WpMediaItem = {
        id: Number(data.id || Date.now()),
        title: String(data.title || optimized.file.name.replace(/\.[^/.]+$/, '')),
        filename: String(data.filename || optimized.file.name),
        url: uploadedUrl,
        thumbnail_url: String(data.thumbnail_url || uploadedUrl),
        width: Number(data.width || optimized.width || 0),
        height: Number(data.height || optimized.height || 0),
        mime: String(data.mime_type || optimized.file.type || 'image/png'),
        date: String(data.date || new Date().toISOString()),
      };

      return {
        success: true,
        id: item.id,
        url: uploadedUrl,
        webp_url: data.webp_url ? String(data.webp_url) : undefined,
        item,
        optimization: {
          originalSize: optimized.originalSize,
          optimizedSize: fileSize,
          savedBytes: optimized.savedBytes,
          savedPercent: optimized.savedPercent,
          formatLabel: optimized.formatLabel,
          width: item.width || 0,
          height: item.height || 0,
        },
      };
    }
    return {
      success: false,
      error: data?.error || data?.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchShopeeProductsDirect(params?: {
  offset?: number;
  page_size?: number;
  item_status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  items: ShopeeListingItem[];
  total: number;
  has_next_page: boolean;
  next_offset?: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const offset = params?.offset ?? 0;
  const pageSize = params?.page_size ?? 50;
  const status = params?.item_status ?? 'NORMAL';
  const searchParam = params?.search ? `&search=${encodeURIComponent(params.search.trim())}` : '';
  const url = `${base}/wp-json/exacoat-core/v1/shopee/products?offset=${offset}&page_size=${pageSize}&item_status=${encodeURIComponent(status)}${searchParam}&_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        items: Array.isArray(data.items) ? data.items : [],
        total: Number(data.total) || 0,
        has_next_page: Boolean(data.has_next_page),
        next_offset: data.next_offset,
      };
    }
    return {
      success: false,
      items: [],
      total: 0,
      has_next_page: false,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      total: 0,
      has_next_page: false,
      error: err.message,
    };
  }
}

export async function setShopeeProductStatusDirect(
  itemId: number,
  unlist: boolean
): Promise<{ success: boolean; item_id: number; unlist: boolean; item_status: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/product/set-status`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ item_id: itemId, unlist }),
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        item_id: data.item_id,
        unlist: data.unlist,
        item_status: data.item_status,
      };
    }
    return {
      success: false,
      item_id: itemId,
      unlist,
      item_status: unlist ? 'UNLIST' : 'NORMAL',
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      item_id: itemId,
      unlist,
      item_status: unlist ? 'UNLIST' : 'NORMAL',
      error: err.message,
    };
  }
}

export async function deleteShopeeProductDirect(
  itemId: number
): Promise<{ success: boolean; item_id: number; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/shopee/product/delete`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ item_id: itemId }),
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, item_id: data.item_id };
    }
    return { success: false, item_id: itemId, error: data?.message || data?.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, item_id: itemId, error: err.message };
  }
}

export async function fetchTikTokProductsDirect(params?: {
  page_size?: number;
  page_token?: string;
  status?: string;
  search?: string;
}): Promise<{
  success: boolean;
  products: TikTokListingItem[];
  total_count: number;
  next_page_token?: string;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const pageSize = params?.page_size ?? 20;
  const tokenParam = params?.page_token ? `&page_token=${encodeURIComponent(params.page_token)}` : '';
  const statusParam = params?.status ? `&status=${encodeURIComponent(params.status)}` : '&status=ALL';
  const searchParam = params?.search ? `&search=${encodeURIComponent(params.search.trim())}` : '';
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/products?page_size=${pageSize}${tokenParam}${statusParam}${searchParam}&_t=${Date.now()}`;

  try {
    const res = await authenticatedFetch(url, {
      headers: { Accept: 'application/json' },
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        products: Array.isArray(data.products) ? data.products : [],
        total_count: Number(data.total_count) || 0,
        next_page_token: data.next_page_token,
      };
    }
    return {
      success: false,
      products: [],
      total_count: 0,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      products: [],
      total_count: 0,
      error: err.message,
    };
  }
}

export async function setTikTokProductStatusDirect(
  productId: string,
  status: 'ACTIVATE' | 'DEACTIVATE'
): Promise<{ success: boolean; product_id: string; status: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/product/set-status`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ product_id: productId, status }),
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return {
        success: true,
        product_id: data.product_id,
        status: data.status,
      };
    }
    return {
      success: false,
      product_id: productId,
      status,
      error: data?.message || data?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      product_id: productId,
      status,
      error: err.message,
    };
  }
}

export async function deleteTikTokProductDirect(
  productId: string
): Promise<{ success: boolean; product_id: string; error?: string }> {
  const base = getWordPressBaseUrl();
  const url = `${base}/wp-json/exacoat-core/v1/tiktok/product/delete`;

  try {
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ product_id: productId }),
    });

    const data = await res.json();
    if (res.ok && data?.success) {
      return { success: true, product_id: data.product_id };
    }
    return { success: false, product_id: productId, error: data?.message || data?.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, product_id: productId, error: err.message };
  }
}

