import {
  AlertCircle,
  Clock,
  CircleCheck,
  Hourglass,
  Package,
  PackageCheck,
  Store,
  Truck,
  Undo2,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { Order } from '../types';
import { isStorePickupOrder } from './orderUtils';

export type StatusFamily = 'act' | 'wait' | 'prog' | 'done' | 'stop' | 'neutral';

export interface StatusMeta {
  key: string;
  label: string;
  family: StatusFamily;
  icon: LucideIcon;
}

export interface StatusStep {
  status: string;
  label: string;
  icon: LucideIcon;
}

type Entry = Omit<StatusMeta, 'key'>;

// Labels match the order status names registered in WooCommerce (core names plus exacoat-core's
// add_custom_order_statuses_to_wc), so staff see the same wording in the manager and in wp-admin.
const PENDING_PAYMENT: Entry = { label: 'Pending payment', family: 'wait', icon: Clock };
const ON_HOLD: Entry = { label: 'Waiting for Payment', family: 'wait', icon: Clock };
const PAYMENT_CONFIRMED: Entry = { label: 'Payment confirmed', family: 'act', icon: Package };
const PREPARING: Entry = { label: 'Preparing order', family: 'prog', icon: Wrench };
const IN_PRODUCTION: Entry = { label: 'In Production', family: 'prog', icon: Wrench };
const WAITING_COURIER: Entry = { label: 'Waiting for Courier Pickup', family: 'prog', icon: Hourglass };
const AWAITING_COURIER: Entry = { label: 'Awaiting Courier Pickup', family: 'prog', icon: Hourglass };
const SMB_READY: Entry = { label: 'SMB Ready (Store Pickup)', family: 'prog', icon: Store };
const SMB_PICKED: Entry = { label: 'SMB Picked (Store Collected)', family: 'done', icon: CircleCheck };
const SHIPPED: Entry = { label: 'Shipped', family: 'prog', icon: Truck };
const DELIVERED: Entry = { label: 'Delivered', family: 'done', icon: PackageCheck };
const COMPLETED: Entry = { label: 'Completed', family: 'done', icon: CircleCheck };

const STATUS_TABLE: Record<string, Entry> = {
  pending: PENDING_PAYMENT,
  'pending-payment': PENDING_PAYMENT,
  'on-hold': ON_HOLD,
  processing: PAYMENT_CONFIRMED,
  'preparing-order': PREPARING,
  'in-production': IN_PRODUCTION,
  'quality-check': { label: 'QC & Packaging', family: 'prog', icon: Wrench },
  'ready-to-ship': WAITING_COURIER,
  'awaiting-pickup': AWAITING_COURIER,
  'smb-ready': SMB_READY,
  'smb-picked': SMB_PICKED,
  shipped: SHIPPED,
  delivered: DELIVERED,
  completed: COMPLETED,
  cancelled: { label: 'Cancelled', family: 'stop', icon: XCircle },
  refunded: { label: 'Refunded', family: 'stop', icon: Undo2 },
  failed: { label: 'Failed', family: 'stop', icon: AlertCircle },
};

function normalizeStatus(status: unknown): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/^wc-/, '')
    .replace(/_/g, '-');
}

function humanize(key: string): string {
  const text = key.replace(/-/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
}

// Live WooCommerce names from the counts endpoint; they win over the defaults above.
let liveLabels: Record<string, string> = {};

/** Replace the status names with the store's own WooCommerce names (keys without wc-). */
export function setStatusLabelOverrides(labels: Record<string, string> | null | undefined): void {
  const next: Record<string, string> = {};
  for (const [slug, label] of Object.entries(labels || {})) {
    const text = String(label || '').trim();
    if (text) next[normalizeStatus(slug)] = text;
  }
  liveLabels = next;
}

function labelFor(key: string, fallback: string): string {
  return liveLabels[key] || fallback;
}

export function getOrderStatusMeta(order: Pick<Order, 'status'> & Partial<Order>): StatusMeta {
  const key = normalizeStatus(order.status);
  let entry: Entry | undefined = STATUS_TABLE[key];
  if (!entry) {
    entry = { label: humanize(key), family: 'neutral', icon: AlertCircle };
  }
  return { key, ...entry, label: labelFor(key, entry.label) };
}

function isWarrantyOrder(order: Partial<Order>): boolean {
  const rma: any = order.rma;
  if (rma?.is_parent_order) return false;
  if (String(rma?.order_type || '').toLowerCase() === 'warranty') return true;
  const meta: any[] = Array.isArray(order.meta_data) ? order.meta_data : [];
  const find = (k: string) => String(meta.find((m) => m?.key === k)?.value ?? '');
  return find('_order_badge').toUpperCase() === 'WARRANTY' || find('_is_warranty').toLowerCase() === 'yes';
}

export function getWarrantyClaimMeta(
  order: Partial<Order>
): { label: 'Pending' | 'Approved' | 'Rejected'; family: StatusFamily } | null {
  if (!isWarrantyOrder(order)) return null;
  return claimReviewState(order);
}

function claimReviewState(order: Partial<Order>): { label: 'Pending' | 'Approved' | 'Rejected'; family: StatusFamily } {
  const raw = String(order.rma?.status || order.warranty_claim_status || 'pending').toLowerCase();
  if (raw === 'approved') return { label: 'Approved', family: 'done' };
  if (raw === 'rejected') return { label: 'Rejected', family: 'stop' };
  return { label: 'Pending', family: 'act' };
}

/** Review state of a redeem replacement order (same rma fields as warranty claims); null for other orders. */
export function getRedeemClaimMeta(
  order: Partial<Order>
): { label: 'Pending' | 'Approved' | 'Rejected'; family: StatusFamily } | null {
  const rma: any = order.rma;
  if (rma?.is_parent_order) return null;
  const meta: any[] = Array.isArray(order.meta_data) ? order.meta_data : [];
  const badge = String(meta.find((m) => m?.key === '_order_badge')?.value ?? '').toUpperCase();
  if (String(rma?.order_type || '').toLowerCase() !== 'redeem' && badge !== 'REDEEM') return null;
  return claimReviewState(order);
}

const COURIER_STEPS: StatusStep[] = [
  { status: 'on-hold', label: ON_HOLD.label, icon: ON_HOLD.icon },
  { status: 'processing', label: PAYMENT_CONFIRMED.label, icon: PAYMENT_CONFIRMED.icon },
  { status: 'preparing-order', label: PREPARING.label, icon: PREPARING.icon },
  { status: 'ready-to-ship', label: WAITING_COURIER.label, icon: WAITING_COURIER.icon },
  { status: 'shipped', label: 'Shipped', icon: SHIPPED.icon },
  { status: 'completed', label: 'Completed', icon: COMPLETED.icon },
];

const PICKUP_STEPS: StatusStep[] = [
  { status: 'on-hold', label: ON_HOLD.label, icon: ON_HOLD.icon },
  { status: 'processing', label: PAYMENT_CONFIRMED.label, icon: PAYMENT_CONFIRMED.icon },
  { status: 'preparing-order', label: PREPARING.label, icon: PREPARING.icon },
  { status: 'smb-ready', label: SMB_READY.label, icon: SMB_READY.icon },
  { status: 'completed', label: COMPLETED.label, icon: COMPLETED.icon },
];

export function getStatusSteps(order: Partial<Order>): StatusStep[] {
  const steps = isStorePickupOrder(order) ? PICKUP_STEPS : COURIER_STEPS;
  return steps.map((s) => ({ ...s, label: labelFor(s.status, s.label) }));
}

const STEP_ALIASES: Record<string, string> = {
  pending: 'on-hold',
  'pending-payment': 'on-hold',
  'in-production': 'preparing-order',
  'awaiting-pickup': 'ready-to-ship',
  delivered: 'completed',
  'smb-picked': 'completed',
};

export function getCurrentStepIndex(order: Partial<Order>, steps: StatusStep[]): number {
  let key = normalizeStatus(order.status);
  key = STEP_ALIASES[key] ?? key;
  if (key === 'ready-to-ship' && !steps.some((s) => s.status === 'ready-to-ship')) {
    key = 'smb-ready';
  }
  return steps.findIndex((s) => s.status === key);
}
