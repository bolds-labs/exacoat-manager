import {
  AlertCircle,
  CircleCheck,
  Clock,
  Package,
  PackageCheck,
  Hourglass,
  Truck,
  Undo2,
  XCircle,
} from 'lucide-react';
import type { StatusMeta } from './orderStatus';

type Entry = Omit<StatusMeta, 'key'>;

// Native marketplace labels (Indonesian, as shown in Seller Centre).
const NEEDS_SHIPPING: Entry = { label: 'Perlu Diproses', family: 'act', icon: Package };
const UNPAID: Entry = { label: 'Belum Bayar', family: 'wait', icon: Clock };
const ARRIVED: Entry = { label: 'Telah Sampai', family: 'done', icon: PackageCheck };
const COMPLETED: Entry = { label: 'Selesai', family: 'done', icon: CircleCheck };
const CANCELLED: Entry = { label: 'Dibatalkan', family: 'stop', icon: XCircle };
const RETURNING: Entry = { label: 'Pengembalian', family: 'stop', icon: Undo2 };

const SHOPEE_TABLE: Record<string, Entry> = {
  READY_TO_SHIP: NEEDS_SHIPPING,
  UNPAID,
  PROCESSED: { label: 'Telah Diproses', family: 'prog', icon: Hourglass },
  SHIPPED: { label: 'Dikirim', family: 'prog', icon: Truck },
  TO_CONFIRM_RECEIVE: ARRIVED,
  COMPLETED,
  CANCELLED,
  IN_CANCEL: CANCELLED,
  TO_RETURN: RETURNING,
};

const IN_TRANSIT: Entry = { label: 'Dalam Pengiriman', family: 'prog', icon: Truck };

const TIKTOK_TABLE: Record<string, Entry> = {
  AWAITING_SHIPMENT: NEEDS_SHIPPING,
  READY_TO_SHIP: NEEDS_SHIPPING,
  UNPAID,
  AWAITING_COLLECTION: { label: 'Menunggu Penjemputan', family: 'prog', icon: Hourglass },
  IN_TRANSIT,
  SHIPPED: IN_TRANSIT,
  DELIVERED: ARRIVED,
  COMPLETED,
  CANCELLED,
  IN_CANCEL: CANCELLED,
  TO_RETURN: RETURNING,
};

function resolve(table: Record<string, Entry>, status: unknown): StatusMeta {
  const raw = String(status || '').trim();
  const key = raw.toUpperCase();
  const entry = table[key] ?? { label: raw || 'N/A', family: 'neutral', icon: AlertCircle };
  return { key, ...entry };
}

export function getShopeeStatusMeta(order: { order_status?: string | null }): StatusMeta {
  return resolve(SHOPEE_TABLE, order.order_status);
}

export function getTikTokStatusMeta(order: { order_status?: string | null }): StatusMeta {
  return resolve(TIKTOK_TABLE, order.order_status);
}

/** Ad hoc chip meta for secondary marketplace badges (shipping progress, label print state). */
export function marketplaceChip(label: string, family: StatusMeta['family'], icon: StatusMeta['icon']): StatusMeta {
  return { key: label, label, family, icon };
}
