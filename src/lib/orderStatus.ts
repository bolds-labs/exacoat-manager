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

const AWAITING_PAYMENT: Entry = { label: 'Awaiting payment', family: 'wait', icon: Clock };
const TO_PREPARE: Entry = { label: 'To prepare', family: 'act', icon: Package };
const PREPARING: Entry = { label: 'Preparing', family: 'prog', icon: Wrench };
const WAITING_COURIER: Entry = { label: 'Waiting for courier', family: 'prog', icon: Hourglass };
const READY_PICKUP: Entry = { label: 'Ready for pickup', family: 'prog', icon: Store };
const PICKED_UP: Entry = { label: 'Picked up', family: 'done', icon: CircleCheck };
const SHIPPED: Entry = { label: 'Shipped', family: 'prog', icon: Truck };
const DELIVERED: Entry = { label: 'Delivered', family: 'done', icon: PackageCheck };
const COMPLETED: Entry = { label: 'Completed', family: 'done', icon: CircleCheck };

const STATUS_TABLE: Record<string, Entry> = {
  pending: AWAITING_PAYMENT,
  'on-hold': AWAITING_PAYMENT,
  'pending-payment': AWAITING_PAYMENT,
  processing: TO_PREPARE,
  'preparing-order': PREPARING,
  'in-production': PREPARING,
  'ready-to-ship': WAITING_COURIER,
  'awaiting-pickup': WAITING_COURIER,
  'smb-ready': READY_PICKUP,
  'smb-picked': PICKED_UP,
  shipped: SHIPPED,
  delivered: DELIVERED,
  completed: COMPLETED,
  cancelled: { label: 'Cancelled', family: 'stop', icon: XCircle },
  refunded: { label: 'Refunded', family: 'stop', icon: Undo2 },
  failed: { label: 'Payment failed', family: 'stop', icon: AlertCircle },
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

export function getOrderStatusMeta(order: Pick<Order, 'status'> & Partial<Order>): StatusMeta {
  const key = normalizeStatus(order.status);
  const pickup = isStorePickupOrder(order);

  let entry: Entry | undefined = STATUS_TABLE[key];
  if (pickup) {
    if (key === 'ready-to-ship' || key === 'awaiting-pickup') entry = READY_PICKUP;
    else if (key === 'completed') entry = PICKED_UP;
  }
  if (!entry) {
    entry = { label: humanize(key), family: 'neutral', icon: AlertCircle };
  }
  return { key, ...entry };
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
  { status: 'on-hold', label: 'Awaiting payment', icon: AWAITING_PAYMENT.icon },
  { status: 'processing', label: 'To prepare', icon: TO_PREPARE.icon },
  { status: 'preparing-order', label: 'Preparing', icon: PREPARING.icon },
  { status: 'ready-to-ship', label: 'Waiting for courier', icon: WAITING_COURIER.icon },
  { status: 'shipped', label: 'Shipped', icon: SHIPPED.icon },
  { status: 'completed', label: 'Completed', icon: COMPLETED.icon },
];

const PICKUP_STEPS: StatusStep[] = [
  { status: 'on-hold', label: 'Awaiting payment', icon: AWAITING_PAYMENT.icon },
  { status: 'processing', label: 'To prepare', icon: TO_PREPARE.icon },
  { status: 'preparing-order', label: 'Preparing', icon: PREPARING.icon },
  { status: 'smb-ready', label: 'Ready for pickup', icon: READY_PICKUP.icon },
  { status: 'completed', label: 'Picked up', icon: PICKED_UP.icon },
];

export function getStatusSteps(order: Partial<Order>): StatusStep[] {
  return isStorePickupOrder(order) ? PICKUP_STEPS : COURIER_STEPS;
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
