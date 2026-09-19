import { BadgeType, AccountStatus, ApplicationStatus, IdentityStatus } from '../types';

/**
 * Strips all em-dashes and en-dashes
 */
export function stripEmDashes(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/[\u2013\u2014]/g, '-');
}

export function cleanProductTag(tag: string | null | undefined): string {
  if (!tag) return '';
  return tag
    .replace(/^#+/, '')
    .replace(/[\u2013\u2014]/g, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'USD'
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    const code = (currency || 'USD').toUpperCase().trim();
    if (code === 'IDR') return 'Rp 0';
    if (code === 'JPY' || code === 'KRW') return `${code} 0`;
    return '$0.00';
  }

  const num = Number(amount);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const sign = isNegative ? '-' : '';
  const code = (currency || 'USD').toUpperCase().trim();

  try {
    switch (code) {
      case 'IDR':
        // Indonesian Rupiah: formatted as Rp 1.290.000 or -Rp 1.290.000
        return `${sign}Rp ${absNum.toLocaleString('id-ID', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`;

      case 'JPY':
      case 'KRW':
        // Japanese Yen / Korean Won (no decimals)
        return `${sign}${code} ${absNum.toLocaleString('ja-JP', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })}`;

      case 'SGD':
        return `${sign}S$${absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      case 'AUD':
        return `${sign}A$${absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      case 'CAD':
        return `${sign}CA$${absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      case 'GBP':
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);

      case 'EUR':
        return new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);

      case 'USD':
      default:
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: code || 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(num);
    }
  } catch (e) {
    return `${sign}${code} ${absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatUSD(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

export function formatIDR(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

export function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return '-';
  }
}

// ==========================================
// BADGE & STATUS METADATA HELPERS
// ==========================================

export function getBadgeInfo(badge: BadgeType | null | undefined): { label: string; rate: number; colorClass: string; bgClass: string; borderClass: string } {
  switch (badge) {
    case 'verified_artist':
      return {
        label: 'Verified Artist',
        rate: 20.0,
        colorClass: 'text-emerald-400',
        bgClass: 'bg-emerald-500/10',
        borderClass: 'border-emerald-500/30',
      };
    case 'verified_brand':
      return {
        label: 'Verified Brand',
        rate: 20.0,
        colorClass: 'text-indigo-400',
        bgClass: 'bg-indigo-500/10',
        borderClass: 'border-indigo-500/30',
      };
    case 'curated_artist':
      return {
        label: 'Curated Artist',
        rate: 17.5,
        colorClass: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/30',
      };
    case 'artist_of_the_month':
      return {
        label: 'Artist of the Month',
        rate: 20.0,
        colorClass: 'text-[#f3aa18]',
        bgClass: 'bg-lime-500/10',
        borderClass: 'border-lime-500/30',
      };
    case 'new_artist':
      return {
        label: 'New Creator',
        rate: 12.5,
        colorClass: 'text-cyan-400',
        bgClass: 'bg-cyan-500/10',
        borderClass: 'border-cyan-500/30',
      };
    case 'community_creator':
      return {
        label: 'Community Creator',
        rate: 12.5,
        colorClass: 'text-zinc-300',
        bgClass: 'bg-zinc-800/80',
        borderClass: 'border-zinc-700/80',
      };
    case 'public_domain_artist':
      return {
        label: 'Public Domain',
        rate: 0.0,
        colorClass: 'text-zinc-400',
        bgClass: 'bg-zinc-800/50',
        borderClass: 'border-zinc-700/50',
      };
    default:
      return {
        label: badge ? String(badge).replace(/_/g, ' ') : 'Standard Artist',
        rate: 12.5,
        colorClass: 'text-zinc-300',
        bgClass: 'bg-zinc-800/50',
        borderClass: 'border-zinc-700/50',
      };
  }
}

export function getAccountStatusInfo(status: AccountStatus | string | null | undefined) {
  switch (status) {
    case 'active':
      return { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    case 'suspended':
      return { label: 'Suspended', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
    case 'deactivated':
      return { label: 'Deactivated', color: 'text-zinc-400', bg: 'bg-zinc-800/50 border-zinc-700/50' };
    default:
      return { label: status ? String(status).replace(/_/g, ' ') : 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  }
}

export function getApplicationStatusInfo(status: ApplicationStatus | string | null | undefined) {
  switch (status) {
    case 'approved':
      return { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    case 'under_review':
      return { label: 'Under Review', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    case 'in_progress':
      return { label: 'In Progress', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' };
    case 'changes_requested':
      return { label: 'Changes Requested', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    case 'not_approved':
      return { label: 'Not Approved', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
    case 'not_started':
      return { label: 'Not Started', color: 'text-zinc-400', bg: 'bg-zinc-800/50 border-zinc-700/50' };
    default:
      return { label: status ? String(status).replace(/_/g, ' ') : 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  }
}

export function getIdentityStatusInfo(status: IdentityStatus | string | null | undefined) {
  switch (status) {
    case 'verified':
      return { label: 'Verified', color: 'text-[#f3aa18]', bg: 'bg-lime-500/10 border-lime-500/30' };
    case 'pending':
    case 'in_review':
      return { label: 'Pending Review', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    case 'rejected':
      return { label: 'Rejected ID', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
    case 'unverified':
    default:
      return { label: 'Unverified', color: 'text-zinc-400', bg: 'bg-zinc-800/50 border-zinc-700/50' };
  }
}

export function getOrderStatusInfo(status: string | null | undefined) {
  const clean = String(status || '').replace('wc-', '').toLowerCase();
  switch (clean) {
    case 'on-hold':
    case 'pending-payment':
      return { label: 'Waiting for Payment', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    case 'processing':
      return { label: 'Payment confirmed', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    case 'preparing-order':
    case 'preparing_order':
    case 'in-production':
    case 'in_production':
      return { label: 'Preparing order', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' };
    case 'ready-to-ship':
    case 'ready_to_ship':
    case 'awaiting-pickup':
    case 'awaiting_pickup':
      return { label: 'Waiting for Courier Pickup', color: 'text-sky-300', bg: 'bg-sky-500/10 border-sky-500/20' };
    case 'smb-ready':
      return { label: 'Ready for Pickup (SMB)', color: 'text-[#f3aa18]', bg: 'bg-[#f3aa18]/10 border-[#f3aa18]/30' };
    case 'smb-picked':
      return { label: 'Picked Up (SMB)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    case 'shipped':
      return { label: 'Shipped', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' };
    case 'completed':
    case 'delivered':
      return { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    case 'cancelled':
      return { label: 'Cancelled', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
    case 'refunded':
      return { label: 'Refunded', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
    case 'pending':
    default:
      return { label: clean ? clean.replace('-', ' ') : 'Pending', color: 'text-zinc-400', bg: 'bg-zinc-800/50 border-zinc-700/50' };
  }
}

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  USD: 0.000059, // 1 USD ~ 16,950 IDR
  EUR: 0.000051, // 1 EUR ~ 19,600 IDR
  AUD: 0.000089, // 1 AUD ~ 11,236 IDR
  SGD: 0.000076, // 1 SGD ~ 13,158 IDR
  JPY: 0.009350, // 1 JPY ~ 107 IDR
  GBP: 0.000044, // 1 GBP ~ 22,727 IDR
  CAD: 0.000082, // 1 CAD ~ 12,195 IDR
  CHF: 0.000047, // 1 CHF ~ 21,276 IDR
  HKD: 0.000462, // 1 HKD ~ 2,165 IDR
  THB: 0.001866, // 1 THB ~ 536 IDR
  KRW: 0.086400, // 1 KRW ~ 11.57 IDR
  MYR: 0.000263, // 1 MYR ~ 3,802 IDR
};

/**
 * Converts any order amount to store base currency (IDR)
 */
export function convertToIdr(amount: number | string | null | undefined, currency: string = 'IDR'): number {
  const val = Number(amount) || 0;
  if (val === 0) return 0;
  const code = (currency || 'IDR').toUpperCase().trim();
  if (code === 'IDR') return val;

  const rate = DEFAULT_EXCHANGE_RATES[code];
  if (rate && rate > 0) {
    return Math.round(val / rate);
  }
  return val;
}

/**
 * Determines whether an order should be counted towards store revenue
 */
export function isRevenueOrder(order: { status?: string }): boolean {
  const st = String(order.status || '').replace('wc-', '').toLowerCase().trim();
  return !['cancelled', 'refunded', 'failed', 'trash', 'auto-draft'].includes(st);
}

/**
 * Resolves a human-readable label for order fee lines
 * (e.g. converting generic 'Price Adjustment' to 'Installation Warranty' or 'Redeem Discount').
 */
export function formatFeeLabel(feeName: string, order?: { rma?: any; meta_data?: any[]; coupon_codes?: string[] } | null): string {
  const name = (feeName || '').trim();
  const nameLower = name.toLowerCase();

  // Price adjustment handler
  if (nameLower === 'price adjustment' || nameLower.includes('price adjustment')) {
    const meta = order?.meta_data || [];
    const findMeta = (k: string) => meta.find(m => m.key === k)?.value;

    const rmaType = (
      order?.rma?.order_type ||
      findMeta('_rma_order_type') ||
      (order as any)?._rma_order_type ||
      ''
    ).toLowerCase();

    const isWarranty =
      rmaType === 'warranty' ||
      findMeta('_is_warranty') === 'yes' ||
      findMeta('_order_badge') === 'WARRANTY';

    const isRedeem =
      rmaType === 'redeem' ||
      findMeta('_is_redeem') === 'yes' ||
      findMeta('_order_badge') === 'REDEEM';

    if (isWarranty) {
      return 'Installation Warranty';
    }
    if (isRedeem) {
      return 'Redeem Discount';
    }
    if (order?.coupon_codes && order.coupon_codes.length > 0) {
      return `Coupon Discount (${order.coupon_codes.join(', ')})`;
    }
    return 'Warranty / Claim Discount';
  }

  // Common fee labels
  if (nameLower === 'unique code' || nameLower === 'kode unik') {
    return 'Kode Unik Pembayaran';
  }
  if (nameLower === 'via wallet' || nameLower.includes('wallet')) {
    return 'Store Credit / Wallet';
  }
  if (nameLower === 'shipping discount') {
    return 'Shipping Discount';
  }
  if (nameLower === 'insurance (3 months)') {
    return 'Shipping Insurance (3 Months)';
  }

  return name;
}
