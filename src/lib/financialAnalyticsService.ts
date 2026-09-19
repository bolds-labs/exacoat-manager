import { Order } from '../types';
import { ShopeeOrder, TikTokOrder } from './wordpressBridge';
import { convertToIdr, isRevenueOrder } from './formatters';

export type FinancialChannel = 'webstore' | 'shopee' | 'tiktok';

export interface UnifiedOrderItem {
  name: string;
  quantity: number;
  price: number;
  sku?: string;
  imageUrl?: string;
}

export interface UnifiedFinancialRecord {
  id: string;
  orderNumber: string;
  channel: FinancialChannel;
  timestamp: number;
  dateIso: string;
  dateFormatted: string;
  grossRevenue: number;
  netRevenue: number;
  refundedAmount: number;
  currency: string;
  status: string;
  statusNormalized: 'paid' | 'pending' | 'cancelled' | 'refunded';
  itemsCount: number;
  items: UnifiedOrderItem[];
  customerName: string;
  customerEmail?: string;
  customerCity?: string;
  paymentMethod?: string;
}

export interface ChannelMetrics {
  channel: FinancialChannel;
  label: string;
  grossRevenue: number;
  netRevenue: number;
  ordersCount: number;
  unitsSold: number;
  aov: number;
  percentageOfTotal: number;
}

export interface DailyFinancialPoint {
  date: string;
  label: string;
  webstore: number;
  shopee: number;
  tiktok: number;
  total: number;
  orders: number;
}

export interface TopFinancialProduct {
  name: string;
  sku?: string;
  imageUrl?: string;
  quantity: number;
  revenue: number;
  channels: FinancialChannel[];
}

export interface FinancialAnalyticsSummary {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalRefunded: number;
  totalOrders: number;
  totalUnitsSold: number;
  averageOrderValue: number;
  channelBreakdown: Record<FinancialChannel, ChannelMetrics>;
  timeline: DailyFinancialPoint[];
  topProducts: TopFinancialProduct[];
  filteredRecords: UnifiedFinancialRecord[];
  primaryCurrency: string;
}

/**
 * Normalizes a WooCommerce webstore order into a unified financial record
 */
export function normalizeWebstoreOrder(order: Order): UnifiedFinancialRecord {
  const isRev = isRevenueOrder(order);
  const st = String(order.status || '').replace('wc-', '').toLowerCase();
  
  let statusNormalized: 'paid' | 'pending' | 'cancelled' | 'refunded' = 'paid';
  if (['cancelled', 'failed', 'trash'].includes(st)) {
    statusNormalized = 'cancelled';
  } else if (['refunded'].includes(st)) {
    statusNormalized = 'refunded';
  } else if (['pending', 'on-hold'].includes(st)) {
    statusNormalized = 'pending';
  }

  const gross = Number(order.total) || 0;
  const grossIdr = (order as any).total_idr || convertToIdr(gross, order.currency || 'IDR');
  const refunded = Number(order.total_refunded) || 0;
  const refundedIdr = convertToIdr(refunded, order.currency || 'IDR');
  const netIdr = isRev ? Math.max(0, grossIdr - refundedIdr) : 0;

  const createdDate = order.created_at ? new Date(order.created_at) : new Date();
  const timestamp = !isNaN(createdDate.getTime()) ? createdDate.getTime() : Date.now();

  const items: UnifiedOrderItem[] = (order.items || order.line_items || []).map(item => ({
    name: item.name || 'Custom Skin',
    quantity: item.quantity || 1,
    price: Number(item.price || item.total) || 0,
    sku: item.sku || '',
    imageUrl: item.image_url || '',
  }));

  const totalItemsCount = order.item_count || items.reduce((acc, it) => acc + it.quantity, 0) || 1;

  const customerName = order.customer_name || 
    [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ') || 
    'Webstore Customer';

  return {
    id: `web-${order.id}`,
    orderNumber: order.order_number || String(order.id),
    channel: 'webstore',
    timestamp,
    dateIso: createdDate.toISOString().split('T')[0],
    dateFormatted: createdDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }),
    grossRevenue: grossIdr,
    netRevenue: netIdr,
    refundedAmount: refundedIdr,
    currency: 'IDR',
    status: st,
    statusNormalized,
    itemsCount: totalItemsCount,
    items,
    customerName,
    customerEmail: order.customer_email || order.billing?.email,
    customerCity: order.shipping?.city || order.billing?.city,
    paymentMethod: order.payment_method_title || order.payment_method || 'Online Payment',
  };
}

/**
 * Normalizes a Shopee order into a unified financial record
 */
export function normalizeShopeeOrder(order: ShopeeOrder): UnifiedFinancialRecord {
  const st = String(order.order_status || '').toUpperCase();
  
  let statusNormalized: 'paid' | 'pending' | 'cancelled' | 'refunded' = 'paid';
  if (['CANCELLED', 'IN_CANCEL'].includes(st)) {
    statusNormalized = 'cancelled';
  } else if (['TO_RETURN', 'REFUNDED'].includes(st)) {
    statusNormalized = 'refunded';
  } else if (['UNPAID'].includes(st)) {
    statusNormalized = 'pending';
  }

  const gross = Number(order.total_amount) || 0;
  const isPaid = !['UNPAID', 'CANCELLED', 'IN_CANCEL'].includes(st);
  const net = isPaid ? gross : 0;

  const timestamp = order.create_timestamp ? order.create_timestamp * 1000 : (
    order.create_time ? new Date(order.create_time).getTime() : Date.now()
  );
  const dateObj = new Date(timestamp);

  const items: UnifiedOrderItem[] = (order.items || []).map(item => ({
    name: [item.item_name, item.model_name].filter(Boolean).join(' - ') || 'Shopee Item',
    quantity: item.quantity || 1,
    price: Number(item.price) || 0,
    sku: item.model_sku || item.item_sku || '',
    imageUrl: item.image_url || '',
  }));

  const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0) || 1;

  return {
    id: `shp-${order.order_sn}`,
    orderNumber: order.order_sn,
    channel: 'shopee',
    timestamp,
    dateIso: dateObj.toISOString().split('T')[0],
    dateFormatted: dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }),
    grossRevenue: gross,
    netRevenue: net,
    refundedAmount: statusNormalized === 'refunded' ? gross : 0,
    currency: order.currency || 'IDR',
    status: st,
    statusNormalized,
    itemsCount: totalItemsCount,
    items,
    customerName: order.recipient_name || order.buyer_username || 'Shopee Customer',
    customerCity: order.recipient_city,
    paymentMethod: 'ShopeePay / COD',
  };
}

/**
 * Normalizes a TikTok Shop order into a unified financial record
 */
export function normalizeTikTokOrder(order: TikTokOrder): UnifiedFinancialRecord {
  const st = String(order.order_status || '').toUpperCase();
  
  let statusNormalized: 'paid' | 'pending' | 'cancelled' | 'refunded' = 'paid';
  if (['CANCELLED'].includes(st)) {
    statusNormalized = 'cancelled';
  } else if (['REFUNDED', 'RETURNED'].includes(st)) {
    statusNormalized = 'refunded';
  } else if (['UNPAID'].includes(st)) {
    statusNormalized = 'pending';
  }

  const gross = Number(order.total_amount) || 0;
  const isPaid = !['UNPAID', 'CANCELLED'].includes(st);
  const net = isPaid ? gross : 0;

  const timestamp = order.create_timestamp ? order.create_timestamp * 1000 : (
    order.create_time ? new Date(order.create_time).getTime() : Date.now()
  );
  const dateObj = new Date(timestamp);

  const items: UnifiedOrderItem[] = (order.items || []).map(item => ({
    name: [item.item_name, item.sku_name].filter(Boolean).join(' - ') || 'TikTok Item',
    quantity: item.quantity || 1,
    price: Number(item.price) || 0,
    sku: item.sku_id || '',
    imageUrl: item.image_url || '',
  }));

  const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0) || 1;

  return {
    id: `tt-${order.order_id || order.order_sn}`,
    orderNumber: order.order_sn || order.order_id,
    channel: 'tiktok',
    timestamp,
    dateIso: dateObj.toISOString().split('T')[0],
    dateFormatted: dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }),
    grossRevenue: gross,
    netRevenue: net,
    refundedAmount: statusNormalized === 'refunded' ? gross : 0,
    currency: order.currency || 'IDR',
    status: st,
    statusNormalized,
    itemsCount: totalItemsCount,
    items,
    customerName: order.recipient_name || order.buyer_username || 'TikTok Buyer',
    customerCity: order.recipient_city,
    paymentMethod: 'TikTok Pay',
  };
}

/**
 * Aggregates all financial records according to selected channels and timespan horizon
 */
export function aggregateFinancialMetrics(
  records: UnifiedFinancialRecord[],
  selectedChannels: FinancialChannel[] | 'all',
  startMs: number,
  endMs: number
): FinancialAnalyticsSummary {
  // 1. Filter by timespan and channel
  const isAllChannels = selectedChannels === 'all' || selectedChannels.length === 3;
  const channelSet = new Set(isAllChannels ? ['webstore', 'shopee', 'tiktok'] : selectedChannels);

  const filtered = records.filter(rec => {
    if (!channelSet.has(rec.channel)) return false;
    if (rec.timestamp < startMs || rec.timestamp > endMs) return false;
    return true;
  });

  // Sort chronological for calculations
  filtered.sort((a, b) => a.timestamp - b.timestamp);

  let totalGross = 0;
  let totalNet = 0;
  let totalRefunded = 0;
  let totalOrders = 0;
  let totalUnits = 0;

  const breakdown: Record<FinancialChannel, ChannelMetrics> = {
    webstore: {
      channel: 'webstore',
      label: 'Webstore (Direct)',
      grossRevenue: 0,
      netRevenue: 0,
      ordersCount: 0,
      unitsSold: 0,
      aov: 0,
      percentageOfTotal: 0,
    },
    shopee: {
      channel: 'shopee',
      label: 'Shopee Official',
      grossRevenue: 0,
      netRevenue: 0,
      ordersCount: 0,
      unitsSold: 0,
      aov: 0,
      percentageOfTotal: 0,
    },
    tiktok: {
      channel: 'tiktok',
      label: 'TikTok Shop',
      grossRevenue: 0,
      netRevenue: 0,
      ordersCount: 0,
      unitsSold: 0,
      aov: 0,
      percentageOfTotal: 0,
    },
  };

  const dailyMap: Record<string, DailyFinancialPoint> = {};
  const productMap: Record<string, TopFinancialProduct> = {};

  filtered.forEach(rec => {
    totalGross += rec.grossRevenue;
    totalNet += rec.netRevenue;
    totalRefunded += rec.refundedAmount;
    totalOrders += 1;
    totalUnits += rec.itemsCount;

    // Channel-specific
    const ch = rec.channel;
    breakdown[ch].grossRevenue += rec.grossRevenue;
    breakdown[ch].netRevenue += rec.netRevenue;
    breakdown[ch].ordersCount += 1;
    breakdown[ch].unitsSold += rec.itemsCount;

    // Timeline aggregation by date
    const dKey = rec.dateIso;
    if (!dailyMap[dKey]) {
      dailyMap[dKey] = {
        date: dKey,
        label: new Date(rec.timestamp).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
        webstore: 0,
        shopee: 0,
        tiktok: 0,
        total: 0,
        orders: 0,
      };
    }
    dailyMap[dKey][ch] += rec.netRevenue;
    dailyMap[dKey].total += rec.netRevenue;
    dailyMap[dKey].orders += 1;

    // Top products aggregation
    rec.items.forEach(it => {
      const pKey = it.name.trim().toLowerCase();
      if (!productMap[pKey]) {
        productMap[pKey] = {
          name: it.name,
          sku: it.sku,
          imageUrl: it.imageUrl,
          quantity: 0,
          revenue: 0,
          channels: [],
        };
      }
      productMap[pKey].quantity += it.quantity;
      productMap[pKey].revenue += (it.price * it.quantity);
      if (!productMap[pKey].channels.includes(ch)) {
        productMap[pKey].channels.push(ch);
      }
    });
  });

  // Calculate AOVs & percentages
  const safeTotalNet = totalNet > 0 ? totalNet : 1;
  (['webstore', 'shopee', 'tiktok'] as FinancialChannel[]).forEach(ch => {
    const item = breakdown[ch];
    item.aov = item.ordersCount > 0 ? Math.round(item.netRevenue / item.ordersCount) : 0;
    item.percentageOfTotal = totalNet > 0 ? Math.round((item.netRevenue / safeTotalNet) * 100) : 0;
  });

  const aov = totalOrders > 0 ? Math.round(totalNet / totalOrders) : 0;

  // Timeline points sorted chronologically
  const timeline = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // Top products sorted by revenue desc
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 10);

  return {
    totalGrossRevenue: totalGross,
    totalNetRevenue: totalNet,
    totalRefunded,
    totalOrders,
    totalUnitsSold: totalUnits,
    averageOrderValue: aov,
    channelBreakdown: breakdown,
    timeline,
    topProducts,
    filteredRecords: filtered.slice().reverse(), // Newest first for ledger display
    primaryCurrency: 'IDR',
  };
}

/**
 * Generates and triggers browser download of an official CSV financial report
 */
export function exportFinancialReportToCsv(
  summary: FinancialAnalyticsSummary,
  dateLabel: string
): void {
  const headers = [
    'Transaction ID',
    'Order Number',
    'Channel',
    'Date',
    'Customer Name',
    'City',
    'Status',
    'Payment Method',
    'Items Count',
    'Gross (IDR)',
    'Net (IDR)',
    'Refunded (IDR)',
  ];

  const rows = summary.filteredRecords.map(rec => [
    `"${rec.id}"`,
    `"${rec.orderNumber}"`,
    `"${rec.channel.toUpperCase()}"`,
    `"${rec.dateIso}"`,
    `"${rec.customerName.replace(/"/g, '""')}"`,
    `"${(rec.customerCity || '-').replace(/"/g, '""')}"`,
    `"${rec.status.toUpperCase()}"`,
    `"${(rec.paymentMethod || '-').replace(/"/g, '""')}"`,
    rec.itemsCount,
    rec.grossRevenue,
    rec.netRevenue,
    rec.refundedAmount,
  ]);

  // Prepend summary rows
  const summaryBlock = [
    ['EXACOAT FINANCIAL REVENUE REPORT'],
    [`Period: ${dateLabel}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Total Gross Revenue (IDR): ${summary.totalGrossRevenue}`],
    [`Total Net Revenue (IDR): ${summary.totalNetRevenue}`],
    [`Total Orders: ${summary.totalOrders}`],
    [`Total Units Sold: ${summary.totalUnitsSold}`],
    [`Average Order Value (IDR): ${summary.averageOrderValue}`],
    ['------------------------------------------'],
    headers,
  ];

  const csvContent = 'data:text/csv;charset=utf-8,' + 
    summaryBlock.map(e => (Array.isArray(e) ? e.join(',') : e)).join('\n') + '\n' +
    rows.map(e => e.join(',')).join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Exacoat_Financial_Report_${dateLabel.replace(/\s+/g, '_')}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
