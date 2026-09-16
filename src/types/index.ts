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
  avatarUrl?: string;
  actualRole?: ExacoatRole;
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
  | 'wc-processing' 
  | 'processing'
  | 'wc-in-production' 
  | 'in-production' 
  | 'in_production'
  | 'wc-quality-check' 
  | 'quality-check' 
  | 'quality_check'
  | 'wc-awaiting-pickup'
  | 'awaiting-pickup'
  | 'awaiting_pickup'
  | 'wc-shipped' 
  | 'shipped'
  | 'wc-completed' 
  | 'completed'
  | 'wc-cancelled' 
  | 'cancelled'
  | 'wc-refunded' 
  | 'refunded'
  | 'wc-on-hold' 
  | 'on-hold'
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

export interface OrderTracking {
  courier: string;
  carrier_id?: string;
  tracking_number: string;
  tracking_url?: string;
  shipped_at?: string;
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
}

// ==========================================
// Composable Product Configurator Types
// ==========================================

export type DeviceFamily = 'phone' | 'laptop' | 'tablet' | 'foldable' | 'keyboard' | 'console' | 'audio' | 'case' | 'accessory';

export interface ConfiguratorView {
  id: string;
  name: string;
  is_default?: boolean;
  aspect_ratio?: '1:1' | '4:3' | '16:9';
  canvas_dimensions?: { width: number; height: number };
  background_url?: string;
  legacy_id?: number;
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
  conditional_rule?: {
    parent_layer_id: string;
    show_on_choices: string[];
  };
  assets_by_view?: Record<string, {
    mask_svg_url?: string;
    shadow_png_url?: string;
    highlight_png_url?: string;
    render_texture_map?: Record<string, string>;
  }>;
  legacy_id?: number;
}

export interface ConfiguratorVariantOption {
  id: string;
  name: string;
  price_diff?: number;
}

export interface ConfiguratorVariant {
  id: string;
  name: string;
  options: ConfiguratorVariantOption[];
}

export interface DeviceConfiguratorProfile {
  product_id: number;
  device_slug: string;
  device_name: string;
  category: string;
  family: DeviceFamily;
  base_price: number;
  currency: string;
  size_multiplier: number;
  is_configurable: boolean;
  views: ConfiguratorView[];
  layers: ConfiguratorLayer[];
  variants?: ConfiguratorVariant[];
  updated_at?: string;
}

export interface ConfiguratorProfileSummary {
  product_id: number;
  name: string;
  slug: string;
  price: number;
  categories: string[];
  is_migrated: boolean;
  is_configurable: boolean;
  layers_count: number;
  views_count: number;
  family: DeviceFamily;
  size_multiplier: number;
}

