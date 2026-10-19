import { Order } from '../types';
import { ShopeeOrder, TikTokOrder } from './wordpressBridge';
import {
  convertToIdr,
  getStoreDateKey,
  formatStoreDateLabel,
  formatStoreDateFull,
  formatDateTime,
  generateContinuousDays,
  parseStoreDate,
} from './formatters';

export type FinancialChannel = 'webstore' | 'shopee' | 'tiktok';
export type FinancialGranularity = 'daily' | 'weekly' | 'monthly';

export interface UnifiedOrderItem {
  name: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  salePrice?: number;
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
  dateTimeFormatted: string;
  payTimeFormatted?: string;
  grossRevenue: number;
  potentialGrossRevenue: number;
  originalProductPrice: number;
  sellerDiscount: number;
  sellerVoucher: number;
  platformSubsidy: number;
  platformFee: number;
  commissionFee: number;
  serviceFee: number;
  transactionFee: number;
  affiliateCommission: number;
  otherPlatformFee: number;
  cleanRevenue: number;
  potentialCleanRevenue: number;
  escrowSynced: boolean;
  shippingAndFees: number;
  buyerPaidAmount: number;
  potentialBuyerPaidAmount: number;
  netRevenue: number;
  refundedAmount: number;
  currency: string;
  status: string;
  statusNormalized: 'paid' | 'pending' | 'cancelled' | 'refunded';
  isPaid: boolean;
  hadPayTime: boolean;
  itemsCount: number;
  items: UnifiedOrderItem[];
  customerName: string;
  customerEmail?: string;
  customerCity?: string;
  paymentMethod?: string;
  couponCodes?: string[];
  isEndorsement?: boolean;
}

export interface ChannelMetrics {
  channel: FinancialChannel;
  label: string;
  grossRevenue: number;
  cleanRevenue: number;
  netRevenue: number;
  buyerPaidAmount: number;
  platformSubsidy: number;
  sellerDiscount: number;
  sellerVouchers: number;
  platformFees: number;
  commissionFees: number;
  serviceFees: number;
  transactionFees: number;
  affiliateCommissions: number;
  otherPlatformFees: number;
  shippingAndFees: number;
  ordersCount: number;
  escrowSyncedCount: number;
  unitsSold: number;
  aov: number;
  cleanAov: number;
  buyerPaidAov: number;
  percentageOfTotal: number;
  cancelledOrdersCount: number;
  cancelledGrossRevenue: number;
  paidThenCancelledCount: number;
  paidThenCancelledGross: number;
}

export interface DailyFinancialPoint {
  date: string;
  label: string;
  fullLabel?: string;
  webstore: number;
  shopee: number;
  tiktok: number;
  total: number;
  webstoreClean: number;
  shopeeClean: number;
  tiktokClean: number;
  totalClean: number;
  webstoreBuyerPaid: number;
  shopeeBuyerPaid: number;
  tiktokBuyerPaid: number;
  totalBuyerPaid: number;
  totalPlatformFees: number;
  totalVoucherSubsidy: number;
  totalSellerDiscount: number;
  totalShippingAndFees: number;
  orders: number;
  cancelledOrders: number;
  cancelledGross: number;
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
  totalCleanRevenue: number;
  totalNetRevenue: number;
  totalBuyerPaid: number;
  totalPlatformSubsidy: number;
  totalSellerDiscount: number;
  totalSellerVouchers: number;
  totalPlatformFees: number;
  totalCommissionFees: number;
  totalServiceFees: number;
  totalTransactionFees: number;
  totalAffiliateCommissions: number;
  totalOtherPlatformFees: number;
  totalShippingAndFees: number;
  totalRefunded: number;
  totalOrders: number;
  escrowSyncedOrders: number;
  marketplaceOrdersCount: number;
  totalUnitsSold: number;
  averageOrderValue: number;
  averageCleanOrderValue: number;
  averageBuyerPaidValue: number;
  totalCancelledOrders: number;
  totalCancelledGross: number;
  totalPaidThenCancelledOrders: number;
  totalPaidThenCancelledGross: number;
  channelBreakdown: Record<FinancialChannel, ChannelMetrics>;
  timeline: DailyFinancialPoint[];
  topProducts: TopFinancialProduct[];
  filteredRecords: UnifiedFinancialRecord[];
  allWindowRecords: UnifiedFinancialRecord[];
  primaryCurrency: string;
}

export function normalizeWebstoreOrder(order: Order): UnifiedFinancialRecord {
  const st = String(order.status || '').replace('wc-', '').toLowerCase().trim();

  const isCancelledOrFailed = ['cancelled', 'failed', 'trash', 'draft', 'checkout-draft', 'auto-draft'].includes(st);
  const isRefunded = ['refunded'].includes(st);
  const isPendingPayment = ['pending', 'on-hold'].includes(st);

  const isConfirmedPaidStatus = [
    'processing',
    'completed',
    'in-production',
    'in_production',
    'preparing-order',
    'preparing_order',
    'quality-check',
    'ready-to-ship',
    'ready_to_ship',
    'awaiting-pickup',
    'awaiting_pickup',
    'smb-ready',
    'smb-picked',
    'shipped',
    'delivered',
  ].includes(st);

  const hadPayTime = Boolean(order.date_paid);
  const isPaid = !isCancelledOrFailed && !isRefunded && !isPendingPayment && (isConfirmedPaidStatus || hadPayTime);

  let statusNormalized: 'paid' | 'pending' | 'cancelled' | 'refunded' = 'paid';
  if (isCancelledOrFailed) {
    statusNormalized = 'cancelled';
  } else if (isRefunded) {
    statusNormalized = 'refunded';
  } else if (isPendingPayment || !isPaid) {
    statusNormalized = 'pending';
  }

  const rawTotal = Number(order.total) || 0;
  const buyerPaidIdr = Number((order as any).total_idr) || convertToIdr(rawTotal, order.currency || 'IDR');
  const fxMultiplier = rawTotal > 0 && buyerPaidIdr > 0 ? buyerPaidIdr / rawTotal : 0;
  const toOrderIdr = (val: number) =>
    fxMultiplier > 0 ? Math.round(val * fxMultiplier) : convertToIdr(val, order.currency || 'IDR');

  const rawSubtotal = Number(order.subtotal) || 0;
  const rawDiscount = Number(order.discount_total) || 0;
  const rawShipping = Number(order.shipping_total) || 0;
  const rawFee = Number(order.fee_total) || 0;

  const items: UnifiedOrderItem[] = (order.items || order.line_items || []).map(item => {
    const qty = Number(item.quantity) || 1;
    const rawItemUnit = Number(item.price) || (Number(item.subtotal) ? Number(item.subtotal) / qty : Number(item.total) / qty) || 0;
    const unitPriceIdr = toOrderIdr(rawItemUnit);
    return {
      name: item.name || 'Custom Skin',
      quantity: qty,
      price: unitPriceIdr,
      originalPrice: unitPriceIdr,
      salePrice: item.total ? toOrderIdr(Number(item.total) / qty) : unitPriceIdr,
      sku: item.sku || '',
      imageUrl: item.image_url || '',
    };
  });

  const itemsSubtotalIdr = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const productSubtotalIdr = rawSubtotal > 0 ? toOrderIdr(rawSubtotal) : (itemsSubtotalIdr > 0 ? itemsSubtotalIdr : buyerPaidIdr);
  const sellerDiscountIdr = toOrderIdr(rawDiscount + (rawFee < 0 ? Math.abs(rawFee) : 0));
  const shippingAndFeesIdr = toOrderIdr(rawShipping + (rawFee > 0 ? rawFee : 0));
  const refundedIdr = toOrderIdr(Number(order.total_refunded) || 0);

  const potentialGross = productSubtotalIdr > 0 ? productSubtotalIdr : buyerPaidIdr;
  const potentialClean = Math.max(0, potentialGross - sellerDiscountIdr - refundedIdr);
  const grossIdr = isPaid ? potentialGross : 0;
  const cleanIdr = isPaid ? potentialClean : 0;

  const createdDate = order.created_at ? (parseStoreDate(order.created_at) || new Date(order.created_at)) : new Date();
  const timestamp = !isNaN(createdDate.getTime()) ? createdDate.getTime() : Date.now();

  const totalItemsCount = order.item_count || items.reduce((acc, it) => acc + it.quantity, 0) || 1;

  const customerName =
    order.customer_name ||
    [order.billing?.first_name, order.billing?.last_name].filter(Boolean).join(' ') ||
    'Webstore Customer';

  return {
    id: `web-${order.id}`,
    orderNumber: order.order_number || String(order.id),
    channel: 'webstore',
    timestamp,
    dateIso: getStoreDateKey(timestamp),
    dateFormatted: formatStoreDateFull(timestamp),
    dateTimeFormatted: order.created_at ? formatDateTime(order.created_at) : formatStoreDateFull(timestamp),
    payTimeFormatted: order.date_paid ? formatDateTime(order.date_paid) : undefined,
    grossRevenue: grossIdr,
    potentialGrossRevenue: potentialGross,
    originalProductPrice: potentialGross,
    sellerDiscount: isPaid ? sellerDiscountIdr : 0,
    sellerVoucher: isPaid ? sellerDiscountIdr : 0,
    platformSubsidy: 0,
    platformFee: 0,
    commissionFee: 0,
    serviceFee: 0,
    transactionFee: 0,
    affiliateCommission: 0,
    otherPlatformFee: 0,
    cleanRevenue: cleanIdr,
    potentialCleanRevenue: potentialClean,
    escrowSynced: true,
    shippingAndFees: isPaid ? shippingAndFeesIdr : 0,
    buyerPaidAmount: isPaid ? buyerPaidIdr : 0,
    potentialBuyerPaidAmount: buyerPaidIdr,
    netRevenue: cleanIdr,
    refundedAmount: refundedIdr,
    currency: 'IDR',
    status: st,
    statusNormalized,
    isPaid,
    hadPayTime,
    itemsCount: totalItemsCount,
    items,
    customerName,
    customerEmail: order.customer_email || order.billing?.email,
    customerCity: order.shipping?.city || order.billing?.city,
    paymentMethod: order.payment_method_title || order.payment_method || 'Online Payment',
    couponCodes: order.coupon_codes || [],
    isEndorsement: (order.meta_data || []).some(
      (m: any) => (m.key === '_order_badge' && m.value === 'ENDORSEMENT') || (m.key === '_is_endorsement' && m.value === 'yes')
    ),
  };
}

export function normalizeShopeeOrder(order: ShopeeOrder): UnifiedFinancialRecord {
  const st = String(order.order_status || '').toUpperCase().trim();

  const isCancelled = ['CANCELLED', 'IN_CANCEL'].includes(st);
  const isRefunded = ['TO_RETURN', 'REFUNDED'].includes(st);
  const isUnpaid = ['UNPAID'].includes(st);
  const isPaidStatus = ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED', 'TO_CONFIRM_RECEIVE'].includes(st);

  const hadPayTime = Boolean(order.pay_time);
  const isPaid = !isCancelled && !isUnpaid && !isRefunded && (isPaidStatus || hadPayTime);

  let statusNormalized: 'paid' | 'pending' | 'cancelled' | 'refunded' = 'paid';
  if (isCancelled) {
    statusNormalized = 'cancelled';
  } else if (isRefunded) {
    statusNormalized = 'refunded';
  } else if (isUnpaid || !isPaid) {
    statusNormalized = 'pending';
  }

  const items: UnifiedOrderItem[] = (order.items || []).map(item => {
    const discPrice = Number(item.price) || 0;
    const origPrice = Number(item.original_price) || discPrice;
    return {
      name: [item.item_name, item.model_name].filter(Boolean).join(' - ') || 'Shopee Item',
      quantity: Number(item.quantity) || 1,
      price: discPrice,
      originalPrice: origPrice,
      salePrice: discPrice,
      sku: item.model_sku || item.item_sku || '',
      imageUrl: item.image_url || '',
    };
  });

  // In Shopee Open API v2, item.price (model_discounted_price) is the seller product selling price
  // before Shopee-subsidized platform vouchers and coins are deducted into order.total_amount.
  const itemsSubtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const originalSubtotal = items.reduce((acc, it) => acc + (it.originalPrice || it.price) * it.quantity, 0);
  const rawBuyerPaid = Number(order.buyer_paid_amount ?? order.total_amount) || 0;

  const potentialGross = Number(order.gross_amount) || (itemsSubtotal > 0 ? itemsSubtotal : rawBuyerPaid);
  const potentialBuyerPaid = rawBuyerPaid > 0 ? rawBuyerPaid : (isPaid ? potentialGross : 0);
  const sellerDiscountVal = Number(order.seller_discount) || Math.max(0, originalSubtotal - potentialGross);
  const sellerVoucherVal = Number(order.voucher_from_seller) || 0;
  const platformSubsidyVal =
    Number(order.platform_voucher_subsidy ?? order.voucher_from_shopee) ||
    (potentialBuyerPaid > 0 ? Math.max(0, potentialGross - potentialBuyerPaid) : 0);
  const shippingAndFeesVal = potentialBuyerPaid > potentialGross ? potentialBuyerPaid - potentialGross : 0;

  const commissionFeeVal = Number(order.commission_fee) || 0;
  const serviceFeeVal = Number(order.service_fee) || 0;
  const transactionFeeVal = Number(order.seller_transaction_fee) || 0;
  const affiliateFeeVal = Number(order.ams_commission_fee) || 0;
  const otherFeeVal = Number(order.other_platform_fee) || 0;
  const sumFeeComponents = commissionFeeVal + serviceFeeVal + transactionFeeVal + affiliateFeeVal + otherFeeVal;
  const rawEscrow = Number(order.escrow_amount ?? order.net_escrow_amount) || 0;
  const rawPlatformFee = Number(order.total_platform_fee) || sumFeeComponents;
  const escrowSynced = Boolean(order.escrow_synced) || rawEscrow > 0 || rawPlatformFee > 0;

  const potentialClean =
    rawEscrow > 0 ? rawEscrow : Math.max(0, potentialGross - sellerVoucherVal - rawPlatformFee);
  const effectivePlatformFee =
    rawPlatformFee > 0
      ? rawPlatformFee
      : rawEscrow > 0 && potentialGross > rawEscrow + sellerVoucherVal
      ? potentialGross - sellerVoucherVal - rawEscrow
      : 0;

  const gross = isPaid ? potentialGross : 0;
  const clean = isPaid ? potentialClean : 0;

  const timestamp = order.create_timestamp
    ? order.create_timestamp * 1000
    : order.create_time
    ? parseStoreDate(order.create_time)?.getTime() || new Date(order.create_time).getTime()
    : Date.now();

  const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0) || 1;

  return {
    id: `shp-${order.order_sn}`,
    orderNumber: order.order_sn,
    channel: 'shopee',
    timestamp,
    dateIso: getStoreDateKey(timestamp),
    dateFormatted: formatStoreDateFull(timestamp),
    dateTimeFormatted: order.create_time ? formatDateTime(order.create_time) : formatStoreDateFull(timestamp),
    payTimeFormatted: order.pay_time ? formatDateTime(order.pay_time) : undefined,
    grossRevenue: gross,
    potentialGrossRevenue: potentialGross,
    originalProductPrice: originalSubtotal > 0 ? originalSubtotal : potentialGross,
    sellerDiscount: isPaid ? sellerDiscountVal : 0,
    sellerVoucher: isPaid ? sellerVoucherVal : 0,
    platformSubsidy: isPaid ? platformSubsidyVal : 0,
    platformFee: isPaid ? effectivePlatformFee : 0,
    commissionFee: isPaid ? commissionFeeVal : 0,
    serviceFee: isPaid ? serviceFeeVal : 0,
    transactionFee: isPaid ? transactionFeeVal : 0,
    affiliateCommission: isPaid ? affiliateFeeVal : 0,
    otherPlatformFee: isPaid ? otherFeeVal : 0,
    cleanRevenue: clean,
    potentialCleanRevenue: potentialClean,
    escrowSynced,
    shippingAndFees: isPaid ? shippingAndFeesVal : 0,
    buyerPaidAmount: isPaid ? potentialBuyerPaid : 0,
    potentialBuyerPaidAmount: potentialBuyerPaid,
    netRevenue: clean,
    refundedAmount: isRefunded ? potentialGross : 0,
    currency: order.currency || 'IDR',
    status: st,
    statusNormalized,
    isPaid,
    hadPayTime,
    itemsCount: totalItemsCount,
    items,
    customerName: order.recipient_name || order.buyer_username || 'Shopee Customer',
    customerCity: order.recipient_city,
    paymentMethod: order.pay_time ? 'ShopeePay / Online' : 'COD / Shopee',
  };
}

export function normalizeTikTokOrder(order: TikTokOrder): UnifiedFinancialRecord {
  const st = String(order.order_status || '').toUpperCase().trim();

  const isCancelled = ['CANCELLED'].includes(st);
  const isRefunded = ['REFUNDED', 'RETURNED'].includes(st);
  const isUnpaid = ['UNPAID'].includes(st);
  const isPaidStatus = ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(st);

  const hadPayTime = Boolean(order.pay_time);
  const isPaid = !isCancelled && !isUnpaid && !isRefunded && (isPaidStatus || hadPayTime);

  let statusNormalized: 'paid' | 'pending' | 'cancelled' | 'refunded' = 'paid';
  if (isCancelled) {
    statusNormalized = 'cancelled';
  } else if (isRefunded) {
    statusNormalized = 'refunded';
  } else if (isUnpaid || !isPaid) {
    statusNormalized = 'pending';
  }

  const items: UnifiedOrderItem[] = (order.items || []).map(item => {
    const qty = Number(item.quantity) || 1;
    const itemPrice = Number(item.price) || 0;
    const origPrice = Number(item.original_price) || itemPrice;
    const salePrice = Number(item.sale_price) || itemPrice;
    return {
      name: [item.item_name, item.sku_name].filter(Boolean).join(' - ') || 'TikTok Item',
      quantity: qty,
      price: itemPrice,
      originalPrice: origPrice,
      salePrice,
      sku: item.sku_id || '',
      imageUrl: item.image_url || '',
    };
  });

  const itemsSubtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const originalSubtotal = items.reduce((acc, it) => acc + (it.originalPrice || it.price) * it.quantity, 0);
  const rawBuyerPaid = Number(order.buyer_paid_amount ?? order.total_amount) || 0;

  const potentialGross = Number(order.gross_amount) || (itemsSubtotal > 0 ? itemsSubtotal : rawBuyerPaid);
  const potentialBuyerPaid = rawBuyerPaid > 0 ? rawBuyerPaid : (isPaid ? potentialGross : 0);

  const explicitSellerDisc = Number(order.seller_discount) || Math.max(0, originalSubtotal - potentialGross);
  const explicitPlatDisc =
    Number(order.platform_voucher_subsidy ?? order.platform_discount) ||
    (potentialGross > potentialBuyerPaid ? potentialGross - potentialBuyerPaid : 0);
  const explicitShipAndFees =
    (Number(order.shipping_fee) || 0) + (Number(order.buyer_service_fee) || 0) ||
    (potentialBuyerPaid > potentialGross ? potentialBuyerPaid - potentialGross : 0);

  const commissionFeeVal = Number(order.commission_fee) || 0;
  const serviceFeeVal = Number(order.service_fee) || 0;
  const transactionFeeVal = Number(order.seller_transaction_fee) || 0;
  const affiliateFeeVal = Number(order.ams_commission_fee) || 0;
  const otherFeeVal = Number(order.other_platform_fee) || 0;
  const sumFeeComponents = commissionFeeVal + serviceFeeVal + transactionFeeVal + affiliateFeeVal + otherFeeVal;
  const rawEscrow = Number(order.escrow_amount ?? order.net_escrow_amount) || 0;
  const rawPlatformFee = Number(order.total_platform_fee) || sumFeeComponents;
  const escrowSynced = Boolean(order.escrow_synced) || rawEscrow > 0 || rawPlatformFee > 0;

  const potentialClean =
    rawEscrow > 0 ? rawEscrow : Math.max(0, potentialGross - rawPlatformFee);
  const effectivePlatformFee =
    rawPlatformFee > 0
      ? rawPlatformFee
      : rawEscrow > 0 && potentialGross > rawEscrow
      ? potentialGross - rawEscrow
      : 0;

  const gross = isPaid ? potentialGross : 0;
  const clean = isPaid ? potentialClean : 0;

  const timestamp = order.create_timestamp
    ? order.create_timestamp * 1000
    : order.create_time
    ? parseStoreDate(order.create_time)?.getTime() || new Date(order.create_time).getTime()
    : Date.now();

  const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0) || 1;

  // Guard against legacy cached 1970 pay_time strings from dividing seconds by 1000
  const validPayTime =
    order.pay_time && !String(order.pay_time).startsWith('1970-')
      ? formatDateTime(order.pay_time)
      : undefined;

  return {
    id: `tt-${order.order_id || order.order_sn}`,
    orderNumber: order.order_sn || order.order_id,
    channel: 'tiktok',
    timestamp,
    dateIso: getStoreDateKey(timestamp),
    dateFormatted: formatStoreDateFull(timestamp),
    dateTimeFormatted: order.create_time ? formatDateTime(order.create_time) : formatStoreDateFull(timestamp),
    payTimeFormatted: validPayTime,
    grossRevenue: gross,
    potentialGrossRevenue: potentialGross,
    originalProductPrice: originalSubtotal > 0 ? originalSubtotal : potentialGross,
    sellerDiscount: isPaid ? explicitSellerDisc : 0,
    sellerVoucher: 0,
    platformSubsidy: isPaid ? explicitPlatDisc : 0,
    platformFee: isPaid ? effectivePlatformFee : 0,
    commissionFee: isPaid ? commissionFeeVal : 0,
    serviceFee: isPaid ? serviceFeeVal : 0,
    transactionFee: isPaid ? transactionFeeVal : 0,
    affiliateCommission: isPaid ? affiliateFeeVal : 0,
    otherPlatformFee: isPaid ? otherFeeVal : 0,
    cleanRevenue: clean,
    potentialCleanRevenue: potentialClean,
    escrowSynced,
    shippingAndFees: isPaid ? explicitShipAndFees : 0,
    buyerPaidAmount: isPaid ? potentialBuyerPaid : 0,
    potentialBuyerPaidAmount: potentialBuyerPaid,
    netRevenue: clean,
    refundedAmount: isRefunded ? potentialGross : 0,
    currency: order.currency || 'IDR',
    status: st,
    statusNormalized,
    isPaid,
    hadPayTime,
    itemsCount: totalItemsCount,
    items,
    customerName: order.recipient_name || order.buyer_username || 'TikTok Buyer',
    customerCity: order.recipient_city,
    paymentMethod: 'TikTok Pay',
  };
}

export function aggregateFinancialMetrics(
  records: UnifiedFinancialRecord[],
  selectedChannels: FinancialChannel[] | 'all',
  startMs: number,
  endMs: number
): FinancialAnalyticsSummary {
  const isAllChannels = selectedChannels === 'all' || selectedChannels.length === 3;
  const channelSet = new Set(isAllChannels ? ['webstore', 'shopee', 'tiktok'] : selectedChannels);

  const inWindowRecords = records.filter(rec => {
    if (!channelSet.has(rec.channel)) return false;
    if (rec.timestamp < startMs || rec.timestamp > endMs) return false;
    return true;
  });

  inWindowRecords.sort((a, b) => a.timestamp - b.timestamp);

  const filtered = inWindowRecords.filter(rec => rec.isPaid && rec.statusNormalized === 'paid' && !rec.isEndorsement);

  let totalGross = 0;
  let totalClean = 0;
  let totalBuyerPaid = 0;
  let totalPlatformSubsidy = 0;
  let totalSellerDiscount = 0;
  let totalSellerVouchers = 0;
  let totalPlatformFees = 0;
  let totalCommissionFees = 0;
  let totalServiceFees = 0;
  let totalTransactionFees = 0;
  let totalAffiliateCommissions = 0;
  let totalOtherPlatformFees = 0;
  let totalShippingAndFees = 0;
  let totalRefunded = 0;
  let totalOrders = 0;
  let escrowSyncedOrders = 0;
  let marketplaceOrdersCount = 0;
  let totalUnits = 0;
  let totalCancelledOrders = 0;
  let totalCancelledGross = 0;
  let totalPaidThenCancelledOrders = 0;
  let totalPaidThenCancelledGross = 0;

  const createEmptyChannelMetrics = (channel: FinancialChannel, label: string): ChannelMetrics => ({
    channel,
    label,
    grossRevenue: 0,
    cleanRevenue: 0,
    netRevenue: 0,
    buyerPaidAmount: 0,
    platformSubsidy: 0,
    sellerDiscount: 0,
    sellerVouchers: 0,
    platformFees: 0,
    commissionFees: 0,
    serviceFees: 0,
    transactionFees: 0,
    affiliateCommissions: 0,
    otherPlatformFees: 0,
    shippingAndFees: 0,
    ordersCount: 0,
    escrowSyncedCount: 0,
    unitsSold: 0,
    aov: 0,
    cleanAov: 0,
    buyerPaidAov: 0,
    percentageOfTotal: 0,
    cancelledOrdersCount: 0,
    cancelledGrossRevenue: 0,
    paidThenCancelledCount: 0,
    paidThenCancelledGross: 0,
  });

  const breakdown: Record<FinancialChannel, ChannelMetrics> = {
    webstore: createEmptyChannelMetrics('webstore', 'Webstore (Direct)'),
    shopee: createEmptyChannelMetrics('shopee', 'Shopee Official'),
    tiktok: createEmptyChannelMetrics('tiktok', 'TikTok Shop'),
  };

  const dailyMap: Record<string, DailyFinancialPoint> = {};
  const productMap: Record<string, TopFinancialProduct> = {};

  let effectiveStartMs = startMs;
  if (inWindowRecords.length > 0) {
    const earliestOrderTime = inWindowRecords[0].timestamp;
    if (earliestOrderTime > startMs && earliestOrderTime - startMs > 180 * 24 * 60 * 60 * 1000) {
      effectiveStartMs = Math.max(startMs, earliestOrderTime - 7 * 24 * 60 * 60 * 1000);
    }
  } else if (endMs - startMs > 180 * 24 * 60 * 60 * 1000) {
    effectiveStartMs = endMs - 30 * 24 * 60 * 60 * 1000;
  }

  const continuousDays = generateContinuousDays(effectiveStartMs, endMs);
  continuousDays.forEach(d => {
    dailyMap[d.key] = {
      date: d.key,
      label: d.label,
      fullLabel: formatStoreDateFull(d.timestamp),
      webstore: 0,
      shopee: 0,
      tiktok: 0,
      total: 0,
      webstoreClean: 0,
      shopeeClean: 0,
      tiktokClean: 0,
      totalClean: 0,
      webstoreBuyerPaid: 0,
      shopeeBuyerPaid: 0,
      tiktokBuyerPaid: 0,
      totalBuyerPaid: 0,
      totalPlatformFees: 0,
      totalVoucherSubsidy: 0,
      totalSellerDiscount: 0,
      totalShippingAndFees: 0,
      orders: 0,
      cancelledOrders: 0,
      cancelledGross: 0,
    };
  });

  inWindowRecords.forEach(rec => {
    const ch = rec.channel;
    const dKey = rec.dateIso;

    if (!dailyMap[dKey]) {
      dailyMap[dKey] = {
        date: dKey,
        label: formatStoreDateLabel(rec.timestamp),
        fullLabel: formatStoreDateFull(rec.timestamp),
        webstore: 0,
        shopee: 0,
        tiktok: 0,
        total: 0,
        webstoreClean: 0,
        shopeeClean: 0,
        tiktokClean: 0,
        totalClean: 0,
        webstoreBuyerPaid: 0,
        shopeeBuyerPaid: 0,
        tiktokBuyerPaid: 0,
        totalBuyerPaid: 0,
        totalPlatformFees: 0,
        totalVoucherSubsidy: 0,
        totalSellerDiscount: 0,
        totalShippingAndFees: 0,
        orders: 0,
        cancelledOrders: 0,
        cancelledGross: 0,
      };
    }

    if (!rec.isPaid || rec.statusNormalized !== 'paid') {
      totalCancelledOrders += 1;
      totalCancelledGross += rec.potentialGrossRevenue;
      breakdown[ch].cancelledOrdersCount += 1;
      breakdown[ch].cancelledGrossRevenue += rec.potentialGrossRevenue;
      dailyMap[dKey].cancelledOrders += 1;
      dailyMap[dKey].cancelledGross += rec.potentialGrossRevenue;

      if (rec.hadPayTime) {
        totalPaidThenCancelledOrders += 1;
        totalPaidThenCancelledGross += rec.potentialGrossRevenue;
        breakdown[ch].paidThenCancelledCount += 1;
        breakdown[ch].paidThenCancelledGross += rec.potentialGrossRevenue;
      }
      return;
    }

    totalGross += rec.grossRevenue;
    totalClean += rec.cleanRevenue;
    totalBuyerPaid += rec.buyerPaidAmount;
    totalPlatformSubsidy += rec.platformSubsidy;
    totalSellerDiscount += rec.sellerDiscount;
    totalSellerVouchers += rec.sellerVoucher;
    totalPlatformFees += rec.platformFee;
    totalCommissionFees += rec.commissionFee;
    totalServiceFees += rec.serviceFee;
    totalTransactionFees += rec.transactionFee;
    totalAffiliateCommissions += rec.affiliateCommission;
    totalOtherPlatformFees += rec.otherPlatformFee;
    totalShippingAndFees += rec.shippingAndFees;
    totalRefunded += rec.refundedAmount;
    totalOrders += 1;
    if (ch === 'shopee' || ch === 'tiktok') {
      marketplaceOrdersCount += 1;
      if (rec.escrowSynced) {
        escrowSyncedOrders += 1;
      }
    }
    totalUnits += rec.itemsCount;

    breakdown[ch].grossRevenue += rec.grossRevenue;
    breakdown[ch].cleanRevenue += rec.cleanRevenue;
    breakdown[ch].netRevenue += rec.cleanRevenue;
    breakdown[ch].buyerPaidAmount += rec.buyerPaidAmount;
    breakdown[ch].platformSubsidy += rec.platformSubsidy;
    breakdown[ch].sellerDiscount += rec.sellerDiscount;
    breakdown[ch].sellerVouchers += rec.sellerVoucher;
    breakdown[ch].platformFees += rec.platformFee;
    breakdown[ch].commissionFees += rec.commissionFee;
    breakdown[ch].serviceFees += rec.serviceFee;
    breakdown[ch].transactionFees += rec.transactionFee;
    breakdown[ch].affiliateCommissions += rec.affiliateCommission;
    breakdown[ch].otherPlatformFees += rec.otherPlatformFee;
    breakdown[ch].shippingAndFees += rec.shippingAndFees;
    breakdown[ch].ordersCount += 1;
    if (rec.escrowSynced) {
      breakdown[ch].escrowSyncedCount += 1;
    }
    breakdown[ch].unitsSold += rec.itemsCount;

    dailyMap[dKey][ch] += rec.grossRevenue;
    dailyMap[dKey].total += rec.grossRevenue;
    if (ch === 'webstore') {
      dailyMap[dKey].webstoreClean += rec.cleanRevenue;
      dailyMap[dKey].webstoreBuyerPaid += rec.buyerPaidAmount;
    }
    if (ch === 'shopee') {
      dailyMap[dKey].shopeeClean += rec.cleanRevenue;
      dailyMap[dKey].shopeeBuyerPaid += rec.buyerPaidAmount;
    }
    if (ch === 'tiktok') {
      dailyMap[dKey].tiktokClean += rec.cleanRevenue;
      dailyMap[dKey].tiktokBuyerPaid += rec.buyerPaidAmount;
    }
    dailyMap[dKey].totalClean += rec.cleanRevenue;
    dailyMap[dKey].totalBuyerPaid += rec.buyerPaidAmount;
    dailyMap[dKey].totalPlatformFees += rec.platformFee;
    dailyMap[dKey].totalVoucherSubsidy += rec.platformSubsidy;
    dailyMap[dKey].totalSellerDiscount += rec.sellerDiscount;
    dailyMap[dKey].totalShippingAndFees += rec.shippingAndFees;
    dailyMap[dKey].orders += 1;

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
      productMap[pKey].revenue += it.price * it.quantity;
      if (!productMap[pKey].channels.includes(ch)) {
        productMap[pKey].channels.push(ch);
      }
    });
  });

  const safeTotalGross = totalGross > 0 ? totalGross : 1;
  (['webstore', 'shopee', 'tiktok'] as FinancialChannel[]).forEach(ch => {
    const item = breakdown[ch];
    item.aov = item.ordersCount > 0 ? Math.round(item.grossRevenue / item.ordersCount) : 0;
    item.cleanAov = item.ordersCount > 0 ? Math.round(item.cleanRevenue / item.ordersCount) : 0;
    item.buyerPaidAov = item.ordersCount > 0 ? Math.round(item.buyerPaidAmount / item.ordersCount) : 0;
    item.percentageOfTotal = totalGross > 0 ? Math.round((item.grossRevenue / safeTotalGross) * 100) : 0;
  });

  const aov = totalOrders > 0 ? Math.round(totalGross / totalOrders) : 0;
  const cleanAov = totalOrders > 0 ? Math.round(totalClean / totalOrders) : 0;
  const buyerPaidAov = totalOrders > 0 ? Math.round(totalBuyerPaid / totalOrders) : 0;

  const timeline = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
    .slice(0, 10);

  return {
    totalGrossRevenue: totalGross,
    totalCleanRevenue: totalClean,
    totalNetRevenue: totalClean,
    totalBuyerPaid,
    totalPlatformSubsidy,
    totalSellerDiscount,
    totalSellerVouchers,
    totalPlatformFees,
    totalCommissionFees,
    totalServiceFees,
    totalTransactionFees,
    totalAffiliateCommissions,
    totalOtherPlatformFees,
    totalShippingAndFees,
    totalRefunded,
    totalOrders,
    escrowSyncedOrders,
    marketplaceOrdersCount,
    totalUnitsSold: totalUnits,
    averageOrderValue: aov,
    averageCleanOrderValue: cleanAov,
    averageBuyerPaidValue: buyerPaidAov,
    totalCancelledOrders,
    totalCancelledGross,
    totalPaidThenCancelledOrders,
    totalPaidThenCancelledGross,
    channelBreakdown: breakdown,
    timeline,
    topProducts,
    filteredRecords: filtered.slice().reverse(),
    allWindowRecords: inWindowRecords.slice().reverse(),
    primaryCurrency: 'IDR',
  };
}

export function aggregateTimelineByGranularity(
  dailyTimeline: DailyFinancialPoint[],
  granularity: FinancialGranularity
): DailyFinancialPoint[] {
  if (granularity === 'daily' || dailyTimeline.length === 0) {
    return dailyTimeline;
  }

  if (granularity === 'weekly') {
    const weeklyMap: Record<string, DailyFinancialPoint> = {};

    dailyTimeline.forEach(point => {
      const [yearStr, monthStr, dayStr] = point.date.split('-');
      const d = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 12, 0, 0));

      const dayOfWeek = d.getUTCDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() + diffToMonday);

      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      const monYear = monday.getUTCFullYear();
      const monMonth = String(monday.getUTCMonth() + 1).padStart(2, '0');
      const monDay = String(monday.getUTCDate()).padStart(2, '0');
      const weekKey = `${monYear}-${monMonth}-${monDay}`;

      const monLabel = monday.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      const sunLabel = sunday.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: monday.getUTCMonth() === sunday.getUTCMonth() ? undefined : 'short',
        day: 'numeric',
      });
      const weekRangeLabel = `${monLabel} - ${sunLabel}`;

      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = {
          date: weekKey,
          label: monLabel,
          fullLabel: weekRangeLabel,
          webstore: 0,
          shopee: 0,
          tiktok: 0,
          total: 0,
          webstoreClean: 0,
          shopeeClean: 0,
          tiktokClean: 0,
          totalClean: 0,
          webstoreBuyerPaid: 0,
          shopeeBuyerPaid: 0,
          tiktokBuyerPaid: 0,
          totalBuyerPaid: 0,
          totalPlatformFees: 0,
          totalVoucherSubsidy: 0,
          totalSellerDiscount: 0,
          totalShippingAndFees: 0,
          orders: 0,
          cancelledOrders: 0,
          cancelledGross: 0,
        };
      }

      weeklyMap[weekKey].webstore += point.webstore;
      weeklyMap[weekKey].shopee += point.shopee;
      weeklyMap[weekKey].tiktok += point.tiktok;
      weeklyMap[weekKey].total += point.total;
      weeklyMap[weekKey].webstoreClean += point.webstoreClean;
      weeklyMap[weekKey].shopeeClean += point.shopeeClean;
      weeklyMap[weekKey].tiktokClean += point.tiktokClean;
      weeklyMap[weekKey].totalClean += point.totalClean;
      weeklyMap[weekKey].webstoreBuyerPaid += point.webstoreBuyerPaid;
      weeklyMap[weekKey].shopeeBuyerPaid += point.shopeeBuyerPaid;
      weeklyMap[weekKey].tiktokBuyerPaid += point.tiktokBuyerPaid;
      weeklyMap[weekKey].totalBuyerPaid += point.totalBuyerPaid;
      weeklyMap[weekKey].totalPlatformFees += point.totalPlatformFees;
      weeklyMap[weekKey].totalVoucherSubsidy += point.totalVoucherSubsidy;
      weeklyMap[weekKey].totalSellerDiscount += point.totalSellerDiscount;
      weeklyMap[weekKey].totalShippingAndFees += point.totalShippingAndFees;
      weeklyMap[weekKey].orders += point.orders;
      weeklyMap[weekKey].cancelledOrders += point.cancelledOrders;
      weeklyMap[weekKey].cancelledGross += point.cancelledGross;
    });

    return Object.values(weeklyMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  if (granularity === 'monthly') {
    const monthlyMap: Record<string, DailyFinancialPoint> = {};

    dailyTimeline.forEach(point => {
      const [yearStr, monthStr] = point.date.split('-');
      const monthKey = `${yearStr}-${monthStr}`;

      const d = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, 1, 12, 0, 0));
      const monthLabel = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' });
      const fullMonthLabel = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          date: monthKey,
          label: monthLabel,
          fullLabel: fullMonthLabel,
          webstore: 0,
          shopee: 0,
          tiktok: 0,
          total: 0,
          webstoreClean: 0,
          shopeeClean: 0,
          tiktokClean: 0,
          totalClean: 0,
          webstoreBuyerPaid: 0,
          shopeeBuyerPaid: 0,
          tiktokBuyerPaid: 0,
          totalBuyerPaid: 0,
          totalPlatformFees: 0,
          totalVoucherSubsidy: 0,
          totalSellerDiscount: 0,
          totalShippingAndFees: 0,
          orders: 0,
          cancelledOrders: 0,
          cancelledGross: 0,
        };
      }

      monthlyMap[monthKey].webstore += point.webstore;
      monthlyMap[monthKey].shopee += point.shopee;
      monthlyMap[monthKey].tiktok += point.tiktok;
      monthlyMap[monthKey].total += point.total;
      monthlyMap[monthKey].webstoreClean += point.webstoreClean;
      monthlyMap[monthKey].shopeeClean += point.shopeeClean;
      monthlyMap[monthKey].tiktokClean += point.tiktokClean;
      monthlyMap[monthKey].totalClean += point.totalClean;
      monthlyMap[monthKey].webstoreBuyerPaid += point.webstoreBuyerPaid;
      monthlyMap[monthKey].shopeeBuyerPaid += point.shopeeBuyerPaid;
      monthlyMap[monthKey].tiktokBuyerPaid += point.tiktokBuyerPaid;
      monthlyMap[monthKey].totalBuyerPaid += point.totalBuyerPaid;
      monthlyMap[monthKey].totalPlatformFees += point.totalPlatformFees;
      monthlyMap[monthKey].totalVoucherSubsidy += point.totalVoucherSubsidy;
      monthlyMap[monthKey].totalSellerDiscount += point.totalSellerDiscount;
      monthlyMap[monthKey].totalShippingAndFees += point.totalShippingAndFees;
      monthlyMap[monthKey].orders += point.orders;
      monthlyMap[monthKey].cancelledOrders += point.cancelledOrders;
      monthlyMap[monthKey].cancelledGross += point.cancelledGross;
    });

    return Object.values(monthlyMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  return dailyTimeline;
}

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
    'Gross Product Sales (IDR)',
    'Seller Voucher / Coupon (IDR)',
    'Platform Admin Fee (IDR)',
    'Platform Service Fee (IDR)',
    'Transaction / Processing Fee (IDR)',
    'Affiliate Commission (IDR)',
    'Total Platform Fees (IDR)',
    'Clean Withdrawable Revenue (IDR)',
    'Buyer Voucher Subsidy from Platform (IDR)',
    'Shipping & Buyer Fees (IDR)',
    'Buyer Paid Total (IDR)',
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
    rec.sellerVoucher,
    rec.commissionFee,
    rec.serviceFee,
    rec.transactionFee,
    rec.affiliateCommission,
    rec.platformFee,
    rec.cleanRevenue,
    rec.platformSubsidy,
    rec.shippingAndFees,
    rec.buyerPaidAmount,
    rec.refundedAmount,
  ]);

  const summaryBlock = [
    ['EXACOAT FINANCIAL REVENUE REPORT'],
    [`Period: ${dateLabel}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [`Gross Product Sales (IDR): ${summary.totalGrossRevenue}`],
    [`Seller Vouchers / Coupons (IDR): ${summary.totalSellerVouchers}`],
    [`Total Platform Fees Deducted (IDR): ${summary.totalPlatformFees}`],
    [`  Admin / Commission Fees (IDR): ${summary.totalCommissionFees}`],
    [`  Service Fees (IDR): ${summary.totalServiceFees}`],
    [`  Transaction / Processing Fees (IDR): ${summary.totalTransactionFees}`],
    [`  Affiliate Commissions (IDR): ${summary.totalAffiliateCommissions}`],
    [`Clean Withdrawable Revenue / Escrow (IDR): ${summary.totalCleanRevenue}`],
    [`Buyer Voucher Subsidies by Platform (IDR): ${summary.totalPlatformSubsidy}`],
    [`Shipping & Buyer Fees (IDR): ${summary.totalShippingAndFees}`],
    [`Buyer Paid Cash Total (IDR): ${summary.totalBuyerPaid}`],
    [`Paid Orders: ${summary.totalOrders}`],
    [`Units Sold: ${summary.totalUnitsSold}`],
    [`Excluded Cancelled / Unpaid Orders: ${summary.totalCancelledOrders} (Rp ${summary.totalCancelledGross})`],
    [`Gross Average Order Value (IDR): ${summary.averageOrderValue}`],
    [`Clean Average Order Value (IDR): ${summary.averageCleanOrderValue}`],
    ['------------------------------------------'],
    headers,
  ];

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    summaryBlock.map(e => (Array.isArray(e) ? e.join(',') : e)).join('\n') +
    '\n' +
    rows.map(e => e.join(',')).join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Exacoat_Financial_Report_${dateLabel.replace(/\s+/g, '_')}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
