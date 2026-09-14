import { getWordPressBaseUrl, getWcCredentials } from './env';
import { Order, Customer, Product, OrderItem } from '../types';

function getAuthHeader(): string {
  const { key, secret } = getWcCredentials();
  return 'Basic ' + btoa(key + ':' + secret);
}

function parseConfiguratorFromItem(item: OrderItem) {
  if (!item.meta_data || !Array.isArray(item.meta_data)) return [];

  // 1. Try _configurator_data_raw or _configurator_data
  const rawMeta = item.meta_data.find(m => m.key === '_configurator_data_raw' || m.key === '_configurator_data');
  if (rawMeta && rawMeta.value) {
    if (Array.isArray(rawMeta.value)) {
      return rawMeta.value.map((v: any) => {
        if (v.layer_data) {
          return {
            layer_id: v.layer_data.layer_id || v.layer_id,
            layer_name: v.layer_data.layer_name || v.layer_data.name || 'Layer',
            choice_id: v.layer_data.choice_id || v.choice_id,
            name: v.layer_data.name || v.name || 'Custom',
            image: v.layer_data.image,
            is_choice: v.is_choice,
          };
        }
        return {
          layer_id: v.layer_id,
          layer_name: v.layer_name || v.name || 'Layer',
          choice_id: v.choice_id,
          name: v.name || 'Custom',
          image: v.image,
          is_choice: v.is_choice,
        };
      });
    }
  }

  // 2. Fallback: Parse display_value from 'Configuration' meta
  const configMeta = item.meta_data.find(m => m.key === 'Configuration');
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
  const districtMeta = metaList.find((m: any) => m.key === '_shipping_district');
  const subdistrictMeta = metaList.find((m: any) => m.key === '_shipping_subdistrict');
  const phoneMeta = metaList.find((m: any) => m.key === '_shipping_phone_formatted' || m.key === '_billing_phone');

  const lineItems = (order.line_items || []).map((item: any) => {
    const parsed = parseConfiguratorFromItem(item);
    return {
      ...item,
      parsed_configurator: parsed,
    };
  });

  return {
    ...order,
    line_items: lineItems,
    tracking_number: trackingMeta?.value && trackingMeta.value !== '⚠️' ? String(trackingMeta.value) : undefined,
    shipping_district: districtMeta?.value ? String(districtMeta.value) : undefined,
    shipping_subdistrict: subdistrictMeta?.value ? String(subdistrictMeta.value) : undefined,
    formatted_phone: phoneMeta?.value ? String(phoneMeta.value) : undefined,
  };
}

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
  const url = new URL(base + '/wp-json/wc/v3/orders', window.location.origin);
  if (params?.status && params.status !== 'all') {
    url.searchParams.set('status', params.status.replace('wc-', ''));
  }
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.page) url.searchParams.set('page', String(params.page));
  url.searchParams.set('per_page', String(params?.per_page || 25));
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: getAuthHeader(),
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        orders: [],
        total_orders: 0,
        max_pages: 1,
        current_page: 1,
        error: 'HTTP ' + res.status + ': ' + errText.substring(0, 150),
      };
    }

    const data = await res.json();
    const totalOrders = parseInt(res.headers.get('x-wp-total') || '0', 10);
    const maxPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);

    const enriched = (Array.isArray(data) ? data : []).map(enrichOrder);

    return {
      success: true,
      orders: enriched,
      total_orders: totalOrders || enriched.length,
      max_pages: maxPages,
      current_page: params?.page || 1,
    };
  } catch (err: any) {
    return {
      success: false,
      orders: [],
      total_orders: 0,
      max_pages: 1,
      current_page: 1,
      error: err.message || 'Network error connecting to WooCommerce orders',
    };
  }
}

export async function fetchOrderDetailDirect(orderId: number | string): Promise<{
  success: boolean;
  order?: Order;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(base + '/wp-json/wc/v3/orders/' + orderId, window.location.origin);
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: getAuthHeader(),
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return { success: false, error: 'Could not load order #' + orderId };
    }

    const data = await res.json();
    return {
      success: true,
      order: enrichOrder(data),
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error loading order detail',
    };
  }
}

export async function updateOrderStatusDirect(orderId: number | string, status: string): Promise<{
  success: boolean;
  order?: Order;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(base + '/wp-json/wc/v3/orders/' + orderId, window.location.origin);

  try {
    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ status: status.replace('wc-', '') }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: 'Failed to update status: ' + err.substring(0, 150) };
    }

    const data = await res.json();
    return {
      success: true,
      order: enrichOrder(data),
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error updating order status',
    };
  }
}

export async function injectShippingTrackingDirect(
  orderId: number | string,
  trackingNumber: string,
  courierName?: string
): Promise<{
  success: boolean;
  order?: Order;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(base + '/wp-json/wc/v3/orders/' + orderId, window.location.origin);

  const metaData = [
    { key: 'tracking_number', value: trackingNumber.trim() },
  ];
  if (courierName) {
    metaData.push({ key: '_shipping_carrier', value: courierName.trim() });
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        meta_data: metaData,
        status: 'ready-to-ship',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: 'Failed to inject tracking: ' + err.substring(0, 150) };
    }

    const data = await res.json();
    return {
      success: true,
      order: enrichOrder(data),
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error injecting tracking number',
    };
  }
}

export async function fetchCustomersDirect(params?: {
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<{
  success: boolean;
  customers: Customer[];
  total_customers: number;
  max_pages: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(base + '/wp-json/wc/v3/customers', window.location.origin);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.page) url.searchParams.set('page', String(params.page));
  url.searchParams.set('per_page', String(params?.per_page || 25));
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: getAuthHeader(),
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return {
        success: false,
        customers: [],
        total_customers: 0,
        max_pages: 1,
        error: 'Failed to fetch customers',
      };
    }

    const data = await res.json();
    const total = parseInt(res.headers.get('x-wp-total') || '0', 10);
    const pages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);

    return {
      success: true,
      customers: Array.isArray(data) ? data : [],
      total_customers: total,
      max_pages: pages,
    };
  } catch (err: any) {
    return {
      success: false,
      customers: [],
      total_customers: 0,
      max_pages: 1,
      error: err.message || 'Network error fetching customers',
    };
  }
}

export async function fetchProductsDirect(params?: {
  search?: string;
  page?: number;
  per_page?: number;
  category?: string;
}): Promise<{
  success: boolean;
  products: Product[];
  total_products: number;
  max_pages: number;
  error?: string;
}> {
  const base = getWordPressBaseUrl();
  const url = new URL(base + '/wp-json/wc/v3/products', window.location.origin);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.category) url.searchParams.set('category', params.category);
  url.searchParams.set('per_page', String(params?.per_page || 25));
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: getAuthHeader(),
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return {
        success: false,
        products: [],
        total_products: 0,
        max_pages: 1,
        error: 'Failed to fetch products',
      };
    }

    const data = await res.json();
    const total = parseInt(res.headers.get('x-wp-total') || '0', 10);
    const pages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);

    const enriched = (Array.isArray(data) ? data : []).map((p: any) => {
      const meta = p.meta_data || [];
      const mklConfigurable = meta.find((m: any) => m.key === '_mkl_pc__is_configurable');
      const mklLayers = meta.find((m: any) => m.key === '_mkl_product_configurator_layers');
      const mklContent = meta.find((m: any) => m.key === '_mkl_product_configurator_content');
      const wcpaMeta = meta.find((m: any) => m.key === '_wcpa_product_meta');

      let parsedLayers = [];
      if (mklLayers && mklLayers.value) {
        parsedLayers = typeof mklLayers.value === 'string' ? JSON.parse(mklLayers.value) : mklLayers.value;
      }

      let parsedWcpa: number[] = [];
      if (wcpaMeta && wcpaMeta.value) {
        parsedWcpa = Array.isArray(wcpaMeta.value) ? wcpaMeta.value : [wcpaMeta.value];
      }

      return {
        ...p,
        is_configurable: mklConfigurable?.value === 'yes' || parsedLayers.length > 0,
        has_acowebs_wcpa: parsedWcpa.length > 0,
        wcpa_form_ids: parsedWcpa,
        configurator_layers: Array.isArray(parsedLayers) ? parsedLayers : [],
        configurator_content: mklContent?.value,
      };
    });

    return {
      success: true,
      products: enriched,
      total_products: total,
      max_pages: pages,
    };
  } catch (err: any) {
    return {
      success: false,
      products: [],
      total_products: 0,
      max_pages: 1,
      error: err.message || 'Network error fetching products',
    };
  }
}

export async function fetchSiteHealthDirect(): Promise<{
  status: 'online' | 'offline';
  latencyMs: number;
  totalProducts?: number;
  totalOrders?: number;
  endpoint: string;
  error?: string;
}> {
  const start = performance.now();
  const base = getWordPressBaseUrl();
  const url = new URL(base + '/wp-json/wc/v3/orders', window.location.origin);
  url.searchParams.set('per_page', '1');
  url.searchParams.set('_t', String(Date.now()));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: getAuthHeader(),
        Accept: 'application/json',
      },
    });

    const latency = Math.round(performance.now() - start);

    if (res.ok) {
      const totalOrders = parseInt(res.headers.get('x-wp-total') || '0', 10);
      return {
        status: 'online',
        latencyMs: latency,
        totalOrders,
        endpoint: base,
      };
    }

    return {
      status: 'offline',
      latencyMs: latency,
      endpoint: base,
      error: 'HTTP ' + res.status + ' response from store',
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
