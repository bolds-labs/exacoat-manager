export interface OrderItemMeta {
  id?: number;
  key: string;
  value: any;
  display_key?: string;
  display_value?: any;
}

export interface ConfiguratorLayerChoice {
  layer_id?: number | string;
  layer_name?: string;
  choice_id?: number | string;
  name?: string;
  image?: number | string;
  is_choice?: boolean | string;
  angle_id?: number | string;
}

export interface OrderItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  subtotal: string;
  total: string;
  price?: number;
  sku?: string;
  meta_data: OrderItemMeta[];
  parsed_configurator?: ConfiguratorLayerChoice[];
}

export interface OrderShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  instance_id: string;
  total: string;
  meta_data?: OrderItemMeta[];
}

export interface OrderAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface Order {
  id: number;
  number: string;
  order_key?: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified?: string;
  discount_total?: string;
  shipping_total?: string;
  total: string;
  customer_id?: number;
  customer_note?: string;
  billing: OrderAddress;
  shipping: OrderAddress;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  line_items: OrderItem[];
  shipping_lines: OrderShippingLine[];
  meta_data: OrderItemMeta[];
  tracking_number?: string;
  shipping_district?: string;
  shipping_subdistrict?: string;
  formatted_phone?: string;
}

export interface Customer {
  id: number;
  date_created: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
  billing: OrderAddress;
  shipping: OrderAddress;
  is_paying_customer: boolean;
  avatar_url?: string;
  orders_count?: number;
  total_spent?: string;
}

export interface ProductConfiguratorLayer {
  _id: string | number;
  name: string;
  order?: number;
  image_order?: number;
  required?: boolean;
  can_deselect?: boolean;
  not_a_choice?: boolean;
}

export interface ProductConfiguratorChoice {
  _id: string | number;
  name: string;
  extra_price?: number;
  class_name?: string;
  is_group?: boolean;
  images?: Array<{
    angleId: number;
    image: { url: string; id?: number };
    thumbnail?: { url: string };
  }>;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  permalink?: string;
  type: string;
  status: string;
  featured?: boolean;
  catalog_visibility?: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price: string;
  regular_price?: string;
  sale_price?: string;
  on_sale?: boolean;
  purchasable?: boolean;
  total_sales?: number;
  stock_status?: string;
  stock_quantity?: number | null;
  images?: Array<{ id: number; src: string; name?: string; alt?: string }>;
  categories?: Array<{ id: number; name: string; slug: string }>;
  meta_data: Array<{ id: number; key: string; value: any }>;
  is_configurable?: boolean;
  has_acowebs_wcpa?: boolean;
  wcpa_form_ids?: number[];
  configurator_layers?: ProductConfiguratorLayer[];
  configurator_content?: any;
}
