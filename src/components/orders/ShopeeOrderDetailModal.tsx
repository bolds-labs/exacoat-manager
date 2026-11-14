import React, { useState, useEffect, useCallback } from 'react';
import {
  ShopeeOrder,
  fetchShopeeTrackingInfoDirect,
  MarketplaceTrackingCheckpoint,
} from '../../lib/wordpressBridge';
import { SlideDrawer } from '../ui/SlideDrawer';
import { formatCurrency } from '../../lib/formatters';
import { formatDisplayPhone } from '../../lib/phoneUtils';
import { ShipCountdownBadge } from './ShipCountdownBadge';
import {
  Package,
  Truck,
  User,
  MapPin,
  Phone,
  Copy,
  Check,
  Printer,
  ShieldCheck,
  RotateCcw,
  Clock,
  CreditCard,
  AlertCircle,
  Tag,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ds/Button';
import { StatusChip } from '../ds/StatusChip';
import { getShopeeStatusMeta, marketplaceChip } from '../../lib/marketplaceStatus';
import { channelTagClass, copyBtnClass, fieldLabelClass, noteClass, sectionTitleClass } from './marketplaceClasses';

interface ShopeeOrderDetailModalProps {
  order: ShopeeOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onPrintLabel: (order: ShopeeOrder) => void;
  onArrangeShipment?: (order: ShopeeOrder) => void;
  onClaimWarranty?: (order: ShopeeOrder) => void;
  onClaimRedeem?: (order: ShopeeOrder) => void;
  isPrinted?: boolean;
}

export const ShopeeOrderDetailModal: React.FC<ShopeeOrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onPrintLabel,
  onArrangeShipment,
  onClaimWarranty,
  onClaimRedeem,
  isPrinted = false,
}) => {
  const { showToast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live Tracking Timeline state
  const [trackingCheckpoints, setTrackingCheckpoints] = useState<MarketplaceTrackingCheckpoint[]>([]);
  const [isLoadingTracking, setIsLoadingTracking] = useState(false);
  const [trackingLoaded, setTrackingLoaded] = useState(false);
  const [isOrderDelivered, setIsOrderDelivered] = useState(false);
  const [deliveredTime, setDeliveredTime] = useState<string | null>(null);
  const [showAllCheckpoints, setShowAllCheckpoints] = useState(false);

  const loadTracking = useCallback(async (orderSn: string) => {
    setIsLoadingTracking(true);
    try {
      const res = await fetchShopeeTrackingInfoDirect(orderSn);
      setTrackingLoaded(true);
      if (res.success) {
        setTrackingCheckpoints(res.checkpoints);
        setIsOrderDelivered(res.is_delivered);
        setDeliveredTime(res.delivered_time || null);
      }
    } catch {
      setTrackingLoaded(true);
    } finally {
      setIsLoadingTracking(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !order?.order_sn) {
      setTrackingCheckpoints([]);
      setTrackingLoaded(false);
      setIsOrderDelivered(false);
      setDeliveredTime(null);
      setShowAllCheckpoints(false);
      return;
    }

    loadTracking(order.order_sn);
  }, [isOpen, order?.order_sn, loadTracking]);

  if (!order) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('info', 'Tersalin ke Clipboard', text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isCancelled = ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes((order.order_status || '').toUpperCase());
  const statusMeta = getShopeeStatusMeta(order);
  const isArranged = ['PROCESSED', 'SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes((order.order_status || '').toUpperCase()) || Boolean(order.is_arranged);
  const isReadyToShip = (order.order_status || '').toUpperCase() === 'READY_TO_SHIP';
  const isOrderPrinted = Boolean(
    isPrinted ||
    order.is_printed ||
    order.shipping_document_status === 'PRINTED' ||
    ['SHIPPED', 'TO_CONFIRM_RECEIVE', 'COMPLETED'].includes((order.order_status || '').toUpperCase()) ||
    order.is_delivered ||
    isOrderDelivered
  );

  const st = (order.order_status || '').toUpperCase();
  const shippingMeta = isCancelled
    ? marketplaceChip('Pesanan Dibatalkan', 'stop', XCircle)
    : isOrderDelivered || ['COMPLETED', 'DELIVERED', 'TO_CONFIRM_RECEIVE'].includes(st)
    ? marketplaceChip('Telah Diterima', 'done', CheckCircle2)
    : st === 'SHIPPED'
    ? marketplaceChip('Dalam Pengiriman', 'prog', Truck)
    : isArranged
    ? marketplaceChip('Telah Diatur / Siap Diambil Kurir', 'prog', Truck)
    : marketplaceChip('Perlu Diatur Pengiriman', 'act', AlertCircle);

  const copyIcon = (key: string) =>
    copiedKey === key ? <Check className="h-3.5 w-3.5 text-st-done-fg" /> : <Copy className="h-3.5 w-3.5" />;

  return (
    <SlideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="2xl"
      title={
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={channelTagClass}>Shopee</span>
          <span className="font-mono text-[15px] font-semibold text-fg">
            #{order.order_sn}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(order.order_sn, 'order_sn')}
            className={copyBtnClass}
            title="Salin No. Pesanan"
            aria-label="Salin No. Pesanan"
          >
            {copyIcon('order_sn')}
          </button>
        </div>
      }
      subtitle={`Waktu Pesanan: ${order.create_time} | Pembeli: @${order.buyer_username}`}
      headerActions={
        <div className="flex items-center gap-2">
          {!isCancelled && (
            isOrderPrinted ? (
              <span title="Label pengiriman resmi telah dicetak">
                <StatusChip meta={marketplaceChip('Telah Dicetak', 'done', CheckCircle2)} size="sm" />
              </span>
            ) : order.order_status === 'PROCESSED' ? (
              <Button
                size="sm"
                icon={Printer}
                onClick={() => onPrintLabel(order)}
                title="Klik untuk mengunduh & mencetak label resmi Shopee"
              >
                Cetak Label
              </Button>
            ) : null
          )}
          <StatusChip meta={statusMeta} size="sm" />
        </div>
      }
    >
      <div className="space-y-6 text-fg font-sans">
        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[14px] border border-card-border bg-card p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {!isCancelled && (
              <Button variant="primary" icon={Printer} onClick={() => onPrintLabel(order)}>
                {isOrderPrinted ? 'Cetak Ulang Label' : 'Cetak Label Shopee'}
              </Button>
            )}

            {!isCancelled && isReadyToShip && onArrangeShipment && (
              <Button icon={Truck} onClick={() => onArrangeShipment(order)}>
                Atur Pengiriman
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onClaimWarranty && (
              <Button icon={ShieldCheck} disabled={order.already_claimed} onClick={() => onClaimWarranty(order)}>
                {order.already_claimed ? 'Claimed' : 'Claim Warranty'}
              </Button>
            )}

            {onClaimRedeem && (
              <Button icon={RotateCcw} disabled={order.already_claimed} onClick={() => onClaimRedeem(order)}>
                {order.already_claimed ? 'Claimed' : 'Claim Redeem (Defect)'}
              </Button>
            )}
          </div>
        </div>

        {/* Existing Claim Banner if any */}
        {order.already_claimed && (
          <div className="flex items-center gap-2 rounded-[11px] border border-st-act-border bg-st-act-bg p-3 text-[13px] text-st-act-fg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              This Shopee order has already been recorded in RMA claim system
              {order.existing_claim?.existing_order_num ? ` under replacement order #${order.existing_claim.existing_order_num}` : ''}.
            </span>
          </div>
        )}

        {/* Order Items Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={sectionTitleClass}>
              <Package className="h-[15px] w-[15px] text-faint" />
              <span>Daftar Produk ({order.items?.length || 0})</span>
            </h3>
            <span className="font-mono text-[12px] text-faint">
              Total Kuantitas: {order.items?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 0}
            </span>
          </div>

          <div className="space-y-2.5">
            {(order.items || []).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 rounded-[14px] border border-card-border bg-card p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.item_name}
                      className="h-12 w-12 shrink-0 rounded-[9px] border border-line bg-chip object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[9px] border border-line bg-chip">
                      <Tag className="h-5 w-5 text-faint" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg">
                      {item.item_name}
                    </p>
                    {item.model_name && (
                      <p className="mt-0.5 font-mono text-[12px] text-faint">
                        Varian: <span className="text-muted">{item.model_name}</span>
                      </p>
                    )}
                    {(item.item_sku || item.model_sku) && (
                      <p className="mt-0.5 font-mono text-[11.5px] text-faint">
                        SKU: {item.item_sku || item.model_sku}
                      </p>
                    )}
                    {Boolean(item.note || item.item_note || item.order_item_note || item.buyer_note) && (
                      <div className={`mt-1.5 ${noteClass}`}>
                        <span className="shrink-0 font-semibold">Catatan Item:</span>
                        <span className="break-words">{item.note || item.item_note || item.order_item_note || item.buyer_note}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="font-mono text-[13px] font-semibold text-fg">
                    {formatCurrency(item.price, 'IDR')}
                  </div>
                  <span className="font-mono text-[12px] text-faint">
                    Qty: {item.quantity}
                  </span>
                  <div className="mt-0.5 font-mono text-[12px] font-medium text-muted">
                    = {formatCurrency(item.price * (item.quantity || 1), 'IDR')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {order.buyer_note && (
            <div className="rounded-[11px] border border-st-act-border bg-st-act-bg p-3 text-[13px] text-st-act-fg">
              <span className="mb-1 block text-[12px] font-semibold">
                Catatan Pembeli
              </span>
              <p className="italic">{order.buyer_note}</p>
            </div>
          )}
        </div>

        {/* Logistics & Delivery Details */}
        <div className="space-y-3">
          <h3 className={sectionTitleClass}>
            <Truck className="h-[15px] w-[15px] text-faint" />
            <span>Informasi Pengiriman</span>
          </h3>

          <div className="grid grid-cols-1 gap-4 rounded-[14px] border border-card-border bg-card p-4 text-[13px] sm:grid-cols-2">
            <div>
              <span className={fieldLabelClass}>Jasa Kirim</span>
              <span className="mt-0.5 block font-medium text-fg">{order.shipping_carrier || 'Jasa Kirim Standar'}</span>
            </div>

            {!isCancelled && (
              <div>
                <span className={fieldLabelClass}>No. Resi</span>
                {order.tracking_number ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono font-semibold text-fg">{order.tracking_number}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.tracking_number, 'resi')}
                      className={copyBtnClass}
                      title="Salin No. Resi"
                      aria-label="Salin No. Resi"
                    >
                      {copyIcon('resi')}
                    </button>
                    {isOrderPrinted && (
                      <StatusChip meta={marketplaceChip('Tercetak', 'done', CheckCircle2)} size="sm" />
                    )}
                  </div>
                ) : (
                  <span className="mt-0.5 block font-mono text-faint">N/A</span>
                )}
              </div>
            )}

            <div>
              <span className={fieldLabelClass}>Status Pengiriman</span>
              <div className="mt-1">
                <StatusChip meta={shippingMeta} size="sm" />
              </div>
            </div>

            <div>
              <span className={fieldLabelClass}>Status Pesanan</span>
              <span className="mt-0.5 block font-medium text-muted">{statusMeta.label}</span>
            </div>

            {!isCancelled && (
              <div className="border-t border-line pt-2 sm:col-span-2">
                <span className={fieldLabelClass}>Batas Waktu Pengiriman</span>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[13px] font-medium text-fg">
                    {order.ship_by_date || 'N/A'}
                  </span>
                  <ShipCountdownBadge
                    shipByTimestamp={order.ship_by_timestamp}
                    orderStatus={order.order_status}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Delivered Status Banner for 48h Warranty */}
          {isOrderDelivered && (
            <div className="flex items-start gap-3 rounded-[11px] border border-st-done-border bg-st-done-bg p-3.5 text-st-done-fg">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5 text-[13px]">
                <span className="block font-semibold">Paket Telah Diterima</span>
                <p className="text-[12px] leading-relaxed">
                  Diterima pada <span className="font-semibold">{deliveredTime || 'pembaruan kurir'}</span>.
                  48-hour warranty claim window is calculated from this delivery timestamp.
                </p>
              </div>
            </div>
          )}

          {/* Carrier Checkpoints Timeline */}
          <div className="space-y-3 rounded-[14px] border border-card-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
                <Clock className="h-3.5 w-3.5 text-faint" />
                <span>Riwayat Pengiriman ({trackingCheckpoints.length})</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon={isLoadingTracking ? Loader2 : RefreshCw}
                onClick={() => loadTracking(order.order_sn)}
                disabled={isLoadingTracking}
                title="Segarkan Riwayat"
                className={isLoadingTracking ? '[&>svg]:animate-spin' : ''}
              >
                Segarkan
              </Button>
            </div>

            {isLoadingTracking && trackingCheckpoints.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[13px] text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" />
                <span>Memuat riwayat pengiriman...</span>
              </div>
            ) : trackingCheckpoints.length === 0 ? (
              <div className="py-2 text-[13px] italic text-faint">
                {trackingLoaded
                  ? 'Belum ada riwayat pergerakan dari kurir.'
                  : 'Riwayat pengiriman akan muncul setelah kurir memperbarui status.'}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {/* Latest Checkpoint */}
                <div className="relative border-l-2 border-accent-border pb-2 pl-5">
                  <span
                    className={clsx(
                      'absolute -left-[5px] top-1.5 h-2 w-2 rounded-full',
                      isOrderDelivered ? 'bg-st-done-fg' : 'bg-accent'
                    )}
                  />
                  <div className="text-[13px]">
                    <p className="font-medium leading-snug text-fg">
                      {trackingCheckpoints[0].description}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[11.5px] text-faint">
                      <span>{trackingCheckpoints[0].time}</span>
                      {trackingCheckpoints[0].location && (
                        <span>• {trackingCheckpoints[0].location}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Remaining Checkpoints */}
                {trackingCheckpoints.length > 1 && (
                  <>
                    {showAllCheckpoints && (
                      <div className="space-y-2 pt-1">
                        {trackingCheckpoints.slice(1).map((cp, idx) => (
                          <div
                            key={idx}
                            className="relative border-l-2 border-line pb-2 pl-5 last:border-transparent last:pb-0"
                          >
                            <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-faint" />
                            <div className="text-[13px]">
                              <p className="leading-snug text-muted">{cp.description}</p>
                              <div className="mt-0.5 flex items-center gap-2 font-mono text-[11.5px] text-faint">
                                <span>{cp.time}</span>
                                {cp.location && <span>• {cp.location}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowAllCheckpoints(!showAllCheckpoints)}
                      className="inline-flex cursor-pointer items-center gap-1 pt-1 text-[12px] font-medium text-accent-fg transition-colors hover:text-fg"
                    >
                      {showAllCheckpoints ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          <span>Sembunyikan riwayat sebelumnya</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          <span>Lihat riwayat sebelumnya ({trackingCheckpoints.length - 1} lainnya)</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recipient & Buyer Details */}
        <div className="space-y-3">
          <h3 className={sectionTitleClass}>
            <User className="h-[15px] w-[15px] text-faint" />
            <span>Pembeli & Alamat Pengiriman</span>
          </h3>

          <div className="space-y-3 rounded-[14px] border border-card-border bg-card p-4 text-[13px]">
            <div className="flex items-center justify-between">
              <div>
                <span className={fieldLabelClass}>Nama Penerima</span>
                <span className="mt-0.5 block text-[14px] font-medium text-fg">
                  {order.recipient_name || order.buyer_username}
                </span>
              </div>
              <div className="text-right">
                <span className={fieldLabelClass}>Akun Shopee</span>
                <span className="mt-0.5 block font-mono text-muted">@{order.buyer_username}</span>
              </div>
            </div>

            {order.recipient_phone && (
              <div>
                <span className={fieldLabelClass}>No. Telepon</span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono text-muted">{formatDisplayPhone(order.recipient_phone)}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.recipient_phone, 'phone')}
                    className={copyBtnClass}
                    title="Salin No. HP"
                    aria-label="Salin No. HP"
                  >
                    {copyIcon('phone')}
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-line pt-2">
              <span className={`${fieldLabelClass} flex items-center gap-1`}>
                <MapPin className="h-3.5 w-3.5" />
                <span>Alamat Pengiriman</span>
              </span>
              <p className="mt-1 leading-relaxed text-fg">
                {order.recipient_address}
              </p>
              <p className="mt-1 font-mono text-[12px] text-faint">
                {order.recipient_city} {order.recipient_district ? `, ${order.recipient_district}` : ''} {order.recipient_postcode ? `(${order.recipient_postcode})` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="space-y-3">
          <h3 className={sectionTitleClass}>
            <CreditCard className="h-[15px] w-[15px] text-faint" />
            <span>Rincian Pembayaran</span>
          </h3>

          <div className="space-y-2 rounded-[14px] border border-card-border bg-card p-4 text-[13px]">
            <div className="flex items-center justify-between text-muted">
              <span>Total Belanja ({order.items?.length || 0} produk)</span>
              <span className="font-mono text-fg">
                {formatCurrency(order.total_amount, 'IDR')}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Ongkos Kirim</span>
              <span className="font-mono text-fg">Rp 0 (Cashless)</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2 text-[14px]">
              <span className="font-semibold text-fg">Total Pembayaran</span>
              <span className="font-mono text-[15px] font-semibold text-fg">
                {formatCurrency(order.total_amount, 'IDR')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </SlideDrawer>
  );
};
