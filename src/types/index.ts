export type AccountStatus = 
  | 'active' 
  | 'suspended' 
  | 'deactivated';

export type ApplicationStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'under_review' 
  | 'changes_requested' 
  | 'approved' 
  | 'not_approved';

export type CreatorApplicationStatus = ApplicationStatus;

export type ArtistStatus = 
  | 'active' 
  | 'pending' 
  | 'in_review' 
  | 'suspended' 
  | 'rejected' 
  | 'reverted' 
  | 'removed'
  | 'changes_requested'
  | 'not_approved';

export type IdentityStatus = 'unverified' | 'pending' | 'in_review' | 'verified' | 'rejected';

export type BadgeType = 
  | 'curated_artist' 
  | 'verified_artist' 
  | 'verified_brand' 
  | 'public_domain_artist' 
  | 'community_creator' 
  | 'new_artist'
  | 'artist_of_the_month' 
  | 'steel' 
  | string;

export type PayoutMethod = 'bank_transfer' | 'paypal' | string;

export type ArtworkStatus = 'publish' | 'pending' | 'rejected' | 'draft' | 'trash' | 'sched_removal' | 'delisted' | 'archived';

export type CommissionStatus = 
  | 'commission_pending' 
  | 'pending' 
  | 'commission_approved' 
  | 'approved'
  | 'commission_processing_payout' 
  | 'commission_paid' 
  | 'paid'
  | 'commission_cancelled' 
  | 'cancelled';

export type PayoutStatus = 'payout_pending' | 'payout_processing' | 'payout_sent' | 'payout_rejected' | 'payout_cancelled';

export type ExacoatRole = 'super_admin' | 'manager' | 'shop_manager';
export type ArtmatterRole = ExacoatRole;

export interface UserSession {
  id: string;
  email: string;
  role: ExacoatRole;
  fullName?: string;
  name?: string;
  actualRole?: ExacoatRole;
  token?: string;
  expiresAt?: number;
  loginAt?: string;
  [key: string]: any;
}

// Backward compatibility stubs for deprecated multi-vendor art platform types
export interface Artist { [key: string]: any; }
export interface Artwork { [key: string]: any; }
export interface Commission { [key: string]: any; }
export interface Payout { [key: string]: any; }
export interface ArtistCollection { [key: string]: any; }
export interface ArtistKYCDocument { [key: string]: any; }

export interface AuditLog {
  id: string;
  created_at: string;
  entity_type: 'order' | 'product' | 'skin' | 'customer' | 'system' | 'inventory' | string;
  entity_id: string | null;
  event: string | null;
  performed_by: string | null;
  payload?: Record<string, any> | null;
}

export interface SystemHealthCheck {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  latencyMs: number;
  message: string;
  lastChecked: string;
  details?: Record<string, any>;
}

export interface SystemAnomaly {
  id: string;
  type: 'orphan_commission' | 'negative_or_zero_commission' | 'missing_destination' | 'missing_payout_destination' | 'stalled_pending' | 'stale_pending_commission' | 'unusual_tax' | 'api_connectivity' | string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  affectedId?: string;
  entityId?: string;
  entityType?: string;
  suggestedAction?: string;
  autoFixable?: boolean;
  detectedAt?: string;
}

export type OrderStatus = 
  | 'wc-pending' 
  | 'pending'
  | 'wc-on-hold' 
  | 'on-hold'
  | 'wc-processing' 
  | 'processing'
  | 'wc-preparing-order'
  | 'preparing-order'
  | 'preparing_order'
  | 'wc-in-production' 
  | 'in-production' 
  | 'in_production'
  | 'wc-ready-to-ship'
  | 'ready-to-ship'
  | 'ready_to_ship'
  | 'wc-awaiting-pickup'
  | 'awaiting-pickup'
  | 'awaiting_pickup'
  | 'wc-smb-ready'
  | 'smb-ready'
  | 'wc-smb-picked'
  | 'smb-picked'
  | 'wc-shipped' 
  | 'shipped'
  | 'wc-completed' 
  | 'completed'
  | 'wc-cancelled' 
  | 'cancelled'
  | 'wc-refunded' 
  | 'refunded'
  | string;

export interface OrderItem {
  id: number;
  product_id: number;
  name: string;
  quantity: number;
  price?: number | string;
  subtotal: string | number;
  total: string | number;
  discount?: number;
  tax?: number;
  qty_refunded?: number;
  amount_refunded?: number;
  tax_refunded?: number;
  is_refunded?: boolean;
  sku?: string;
  image_url?: string;
  orientation?: 'portrait' | 'landscape';
  finish_type?: string;
  vault_print_file_url?: string;
  artist_id?: number | string | null;
  artist_name?: string | null;
  artist_username?: string | null;
  commission_rate?: number;
  commission_amount?: number | null;
  parsed_configurator?: Array<{
    layer_id?: any;
    layer_name?: string;
    choice_id?: any;
    name?: string;
    image?: any;
    is_choice?: any;
  }>;
}

export interface OrderRefund {
  id: number;
  amount: number;
  reason: string;
  date_created: string;
  refunded_by?: number;
}

export interface OrderFee {
  id: number | string;
  name: string;
  total: number;
  tax: number;
}

export interface OrderCoupon {
  id: number | string;
  code: string;
  discount_amount: number;
  discount_tax: number;
}

export interface OrderNote {
  id: number | string;
  content: string;
  date_created: string;
  customer_note?: boolean;
  added_by?: string;
  author_name?: string;
  author_role?: string;
  author_avatar?: string;
  creators?: { id: number | string; name: string; username?: string }[];
}

export interface OrderShipping {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  address_2_extra?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface OrderTrackingCheckpoint {
  time: string;
  description: string;
  location?: string;
  stage?: string;
}

export interface OrderTracking {
  courier: string;
  carrier_id?: string;
  tracking_number: string;
  tracking_url?: string;
  shipped_at?: string;
  latest_status?: string;
  checkpoints?: OrderTrackingCheckpoint[];
}

export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  currency: string;
  subtotal?: number | string;
  discount_total?: number | string;
  discount_tax?: number | string;
  fee_total?: number;
  fees?: OrderFee[];
  coupons?: OrderCoupon[];
  coupon_codes?: string[];
  total: number | string;
  total_tax: number | string;
  total_refunded?: number;
  remaining_refund_available?: number;
  refunds?: OrderRefund[];
  shipping_total: number | string;
  shipping_tax?: number | string;
  shipping_method_name?: string;
  created_at: string;
  date_paid?: string | null;
  date_completed?: string | null;
  customer_ip?: string;
  customer_id: number;
  customer_store_credit_balance?: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  customer_note?: string;
  payment_method: string;
  payment_method_title: string;
  shipping: OrderShipping;
  billing: OrderShipping;
  items: OrderItem[];
  item_count: number;
  tracking?: OrderTracking | null;
  notes?: OrderNote[];
  total_commission?: number;
  total_commission_usd?: number;
  review?: OrderReview | null;
  review_invite_scheduled_at?: string | null;
  review_invited_at?: string | null;
  number?: string;
  line_items?: OrderItem[];
  shipping_lines?: Array<{ id?: any; method_id?: string; method_title?: string; total?: string }>;
  meta_data?: Array<{ id?: number; key: string; value: any }>;
  rma?: OrderRmaDetails | null;
}

export interface OrderRmaDetails {
  order_type?: string;
  original_order_id?: number | string;
  original_invoice?: number | string;
  original_order_number?: string;
  claim_reason?: string;
  video_proof_url?: string;
  video_file_path?: string;
  status?: string;
  video_deleted?: boolean;
  video_deleted_at?: string | null;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export function getOrderRma(order: Order | null): OrderRmaDetails | null {
  if (!order) return null;
  if (order.rma) return order.rma;

  const meta = order.meta_data || [];
  const findMeta = (k: string) => meta.find((m) => m.key === k)?.value;

  const orderType = findMeta('_rma_order_type') || (order as any)._rma_order_type;
  const originalInvoice = findMeta('_rma_original_invoice') || (order as any)._rma_original_invoice;
  const originalOrderId = findMeta('_rma_original_order_id') || (order as any)._rma_original_order_id;

  if (!orderType && !originalInvoice && !originalOrderId) return null;

  return {
    order_type: orderType,
    original_order_id: originalOrderId ? Number(originalOrderId) : undefined,
    original_invoice: originalInvoice,
    original_order_number: findMeta('_rma_original_order_number'),
    claim_reason: findMeta('_rma_claim_reason'),
    video_proof_url: findMeta('_rma_video_proof_url'),
    video_file_path: findMeta('_rma_video_file_path'),
    status: findMeta('_rma_status') || 'pending_review',
    video_deleted_at: findMeta('_rma_video_deleted_at'),
    video_deleted: Boolean(findMeta('_rma_video_deleted_at')),
    reviewed_by: findMeta('_rma_reviewed_by'),
    reviewed_at: findMeta('_rma_reviewed_at'),
    rejection_reason: findMeta('_rma_rejection_reason'),
  };
}

export interface OrderGuaranteeDetails {
  has_claim: boolean;
  status: 'pending_return' | 'package_received' | 'refunded' | 'rejected';
  refund_method: 'store_credit' | 'bank_transfer' | 'paypal';
  refund_amount: number;
  destination: string;
  return_courier?: string;
  return_tracking?: string;
  received_at?: string;
  refunded_at?: string;
  admin_notes?: string;
  claim_data?: any;
}

export function getOrderGuarantee(order: Order | null): OrderGuaranteeDetails | null {
  if (!order) return null;
  const meta = order.meta_data || [];
  const findMeta = (k: string) => meta.find((m) => m.key === k)?.value;

  const hasClaim = findMeta('_has_guarantee_claim') === 'yes' || (order as any)._has_guarantee_claim === 'yes';
  if (!hasClaim) return null;

  return {
    has_claim: true,
    status: (findMeta('_guarantee_status') || 'pending_return') as any,
    refund_method: (findMeta('_guarantee_refund_method') || 'store_credit') as any,
    refund_amount: Number(findMeta('_guarantee_refund_amount') || 0),
    destination: String(findMeta('_guarantee_destination') || ''),
    return_courier: findMeta('_guarantee_return_courier'),
    return_tracking: findMeta('_guarantee_return_tracking'),
    received_at: findMeta('_guarantee_received_at'),
    refunded_at: findMeta('_guarantee_refunded_at'),
    admin_notes: findMeta('_guarantee_admin_notes'),
    claim_data: findMeta('_guarantee_claim_data'),
  };
}

export interface OrderReviewMedia {
  type: 'photo' | 'video';
  url: string;
  r2_key?: string;
  r2_synced?: number | boolean;
  poster_url?: string;
  width?: number;
  height?: number;
}

export interface OrderReview {
  id: number;
  order_id: number;
  order_number?: string;
  product_id?: number;
  artwork_id?: string;
  artwork_title?: string;
  artwork_image?: string;
  artist_name?: string;
  customer_name: string;
  customer_email: string;
  customer_location?: string;
  is_anonymous?: boolean;
  masked_name?: string;
  rating: number;
  title?: string;
  content: string;
  media: OrderReviewMedia[];
  status: 'pending' | 'approved' | 'featured' | 'rejected';
  verified_purchase: boolean;
  wc_comment_id?: number | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateReviewPayload {
  order_id?: number;
  order_number?: string;
  product_id?: number;
  artwork_id?: string;
  artwork_title: string;
  artist_name?: string;
  artwork_image?: string;
  customer_name: string;
  customer_email?: string;
  customer_location?: string;
  is_anonymous?: boolean;
  rating: number;
  title?: string;
  content: string;
  status?: 'pending' | 'approved' | 'featured' | 'rejected';
  verified_purchase?: boolean;
  media?: OrderReviewMedia[] | string;
  created_at?: string;
}

export interface Fandom {
  id: string;
  name: string;
  slug: string;
  banner_url?: string | null;
  description?: string | null;
  alias?: string | null;
  artwork_count?: number;
  is_featured?: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: ExacoatRole;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  wp_roles?: string[];
}

// ==========================================
// Composable Product Configurator Types
// ==========================================

export type DeviceFamily = 'phone' | 'laptop' | 'tablet' | 'foldable' | 'keyboard' | 'console' | 'audio' | 'case' | 'accessory' | 'tablet_laptop';

export type CoverageType = 'none' | 'model_cut_only' | 'model_cut_and_360' | 'model_360_only';

export interface ConfiguratorView {
  id: string;
  name: string;
  is_default?: boolean;
  aspect_ratio?: '1:1' | '4:3' | '16:9';
  canvas_dimensions?: { width: number; height: number };
  background_url?: string;
  logo_url?: string;
  logo_image_url?: string;
  logo_cutout_mask_url?: string;
  pencil_cutout_mask_url?: string;
  model_cut_mask_url?: string;
  shading_image_url?: string;
  shadow_png_url?: string;
  highlight_png_url?: string;
  shadow_opacity?: number;
  highlight_opacity?: number;
  legacy_id?: number;
  texture_scale?: number;
}

export interface ConfiguratorLayer {
  id: string;
  name: string;
  group: 'primary' | 'accent' | 'protection' | 'addon';
  is_required: boolean;
  is_optional: boolean;
  default_selected: boolean;
  extra_price: number;
  z_index: number;
  angle_id?: string;
  allowed_finish_groups?: string[];
  allowed_finish_slugs?: string[];
  conditional_rule?: {
    parent_layer_id: string;
    show_on_choices: string[];
  };
  assets_by_view?: Record<string, {
    base_hardware_body_url?: string;
    mask_svg_url?: string;
    logo_cutout_url?: string;
    pencil_cutout_url?: string;
    model_cutout_url?: string;
    shading_image_url?: string;
    shadow_png_url?: string;
    highlight_png_url?: string;
    shadow_opacity?: number;
    highlight_opacity?: number;
    render_texture_map?: Record<string, string>;
  }>;
  legacy_id?: number;
  texture_rotation?: number;
  texture_scale?: number;
  texture_size?: 'auto' | 'small' | 'big';
}

export interface ConfiguratorVariantOption {
  id: string;
  name: string;
  price_diff?: number;
  image_url?: string;
}

export interface ConfiguratorVariant {
  id: string;
  name: string;
  options: ConfiguratorVariantOption[];
}

export interface DeviceCoverageAndCutouts {
  coverage_type?: CoverageType;
  model_360_extra_price?: number;
  has_logo_cutout?: boolean;
  logo_cutout_mask_url?: string;
  has_pencil_cutout?: boolean;
  pencil_cutout_mask_url?: string;
  pencil_cutout_label?: string;
  pencil_cutout_description?: string;
  pencil_cutout_pill?: string;
  has_model_cut?: boolean;
  model_cut_mask_url?: string;
  logo_target_layer_id?: string;
  coverage_target_layer_id?: string;
  available_coverages?: Array<{
    id: string;
    label: string;
    extra_price?: number;
    model_cut_mask_url?: string;
  }>;
}

import type { ConfiguratorPreset } from '../lib/wordpressBridge';

export interface DeviceConfiguratorProfile {
  product_id: number;
  device_slug: string;
  device_name: string;
  category: string;
  family: DeviceFamily;
  base_price: number;
  currency: string;
  size_multiplier: number;
  texture_scale?: number;
  is_configurable: boolean;
  configurator_version?: 'v1' | 'v2';
  device_colors?: { id: string; name: string; hex: string; body_image_url?: string; body_images_by_view?: Record<string, string> }[];
  views: ConfiguratorView[];
  layers: ConfiguratorLayer[];
  variants?: ConfiguratorVariant[];
  coverage_and_cutouts?: DeviceCoverageAndCutouts;
  presets?: ConfiguratorPreset[];
  status?: 'publish' | 'draft' | string;
  updated_at?: string;
}

export type { ConfiguratorPreset };

export interface ConfiguratorProfileSummary {
  product_id: number;
  name: string;
  slug: string;
  status?: 'publish' | 'draft' | string;
  price: number;
  categories: string[];
  is_migrated: boolean;
  configurator_version?: 'v1' | 'v2';
  is_configurable: boolean;
  is_configurator?: boolean;
  layers_count: number;
  views_count: number;
  presets_count?: number;
  family: DeviceFamily;
  size_multiplier: number;
  texture_scale?: number;
  last_audited_at?: string | null;
  audit_status?: 'clean' | 'issues' | 'unaudited';
  audit_issues?: number;
}
