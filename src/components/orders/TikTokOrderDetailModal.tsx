import React, { useState, useEffect, useCallback } from 'react';
import {
  TikTokOrder,
  fetchTikTokTrackingInfoDirect,
  MarketplaceTrackingCheckpoint,
} from '../../lib/wordpressBridge';
import { SlideDrawer } from '../ui/SlideDrawer';
import { formatCurrency } from '../../lib/formatters';
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
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ds/Button';
import { StatusChip } from '../ds/StatusChip';
import { getTikTokStatusMeta, marketplaceChip } from '../../lib/marketplaceStatus';
import { channelTagClass, copyBtnClass, fieldLabelClass, sectionTitleClass } from './marketplaceClasses';

interface TikTokOrderDetailModalProps {
  order: TikTokOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onPrintAwb: (order: TikTokOrder) => void;
  onArrangeShipment?: (order: TikTokOrder) => void;
  onClaimWarranty?: (order: TikTokOrder) => void;
  onClaimRedeem?: (order: TikTokOrder) => void;
}

export const TikTokOrderDetailModal: React.FC<TikTokOrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
  onPrintAwb,
  onArrangeShipment,
  onClaimWarranty,
  onClaimRedeem,
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

  const loadTracking = useCallback(async (orderId: string) => {
    setIsLoadingTracking(true);
    try {
      const res = await fetchTikTokTrackingInfoDirect(orderId);
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
    if (!isOpen || !order?.order_id) {
      setTrackingCheckpoints([]);
      setTrackingLoaded(false);
      setIsOrderDelivered(false);
      setDeliveredTime(null);
      setShowAllCheckpoints(false);
      return;
    }

    loadTracking(order.order_id);
  }, [isOpen, order?.order_id, loadTracking]);

  if (!order) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('info', 'Tersalin ke Clipboard', text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isCancelled = (order.order_status || '').toUpperCase() === 'CANCELLED';
  const statusMeta = getTikTokStatusMeta(order);
  const isReadyToShip = ['AWAITING_SHIPMENT', 'AWAITING_COLLECTION', 'READY_TO_SHIP'].includes(
    (order.order_status || '').toUpperCase()
  );

  const copyIcon = (key: string) =>
    copiedKey === key ? <Check className="h-3.5 w-3.5 text-st-done-fg" /> : <Copy className="h-3.5 w-3.5" />;

  return (
    <SlideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="2xl"
      title={
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={channelTagClass}>TikTok Shop</span>
          <span className="font-mono text-[15px] font-semibold text-fg">
            #{order.order_id}
          </span>
          {!isCancelled && (
            <ShipCountdownBadge
              shipByDate={order.ship_by_date}
              shipByTimestamp={order.ship_by_timestamp}
            />
          )}
          <button
            type="button"
            onClick={() => handleCopy(order.order_id, 'order_id')}
            className={copyBtnClass}
            title="Salin No. Pesanan"
            aria-label="Salin No. Pesanan"
          >
            {copyIcon('order_id')}
          </button>
        </div>
      }
      subtitle={`Dibuat pada ${order.create_time} | Pembeli: @${order.buyer_username}`}
      headerActions={
        <div className="flex items-center gap-2">
          <StatusChip meta={statusMeta} size="sm" />
        </div>
      }
    >
      <div className="space-y-6 text-fg font-sans">
        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[14px] border border-card-border bg-card p-3">
          {!isCancelled && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" icon={Printer} onClick={() => onPrintAwb(order)}>
                Cetak Label Thermal
              </Button>

              {isReadyToShip && !order.tracking_number && onArrangeShipment && (
                <Button icon={Truck} onClick={() => onArrangeShipment(order)}>
                  Atur Pengiriman
                </Button>
              )}
            </div>
          )}

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
              This TikTok order has already been recorded in RMA claim system
              {order.existing_claim?.existing_order_num ? ` under replacement order #${order.existing_claim.existing_order_num}` : ''}.
            </span>
          </div>
        )}

        {/* Order Items Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={sectionTitleClass}>
              <Package className="h-[15px] w-[15px] text-faint" />
              <span>Rincian Produk ({order.items?.length || 0})</span>
            </h3>
            <span className="font-mono text-[12px] text-faint">
              Total Unit: {order.items?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 0}
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
                    {item.sku_name && (
                      <p className="mt-0.5 font-mono text-[12px] text-faint">
                        Varian: <span className="text-muted">{item.sku_name}</span>
                      </p>
                    )}
                    {item.sku_id && (
                      <p className="mt-0.5 font-mono text-[11.5px] text-faint">
                        SKU ID: {item.sku_id}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="font-mono text-[13px] font-semibold text-fg">
                    {formatCurrency(item.price, order.currency || 'IDR')}
                  </div>
                  <span className="font-mono text-[12px] text-faint">
                    Jml: {item.quantity}
                  </span>
                  <div className="mt-0.5 font-mono text-[12px] font-medium text-muted">
                    = {formatCurrency(item.price * (item.quantity || 1), order.currency || 'IDR')}
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
            <span>Pengiriman & Logistik</span>
          </h3>

          <div className="grid grid-cols-1 gap-4 rounded-[14px] border border-card-border bg-card p-4 text-[13px] sm:grid-cols-2">
            <div>
              <span className={fieldLabelClass}>Jasa Kirim</span>
              <span className="mt-0.5 block font-medium text-fg">{order.shipping_carrier || 'N/A'}</span>
            </div>

            <div>
              <span className={fieldLabelClass}>Status Pengiriman</span>
              <div className="mt-1">
                <StatusChip
                  meta={isCancelled ? marketplaceChip('Pesanan Dibatalkan', 'stop', XCircle) : statusMeta}
                  size="sm"
                />
              </div>
            </div>

            {!isCancelled && (
              <div>
                <span className={fieldLabelClass}>No. Resi</span>
                {order.tracking_number ? (
                  <div className="mt-0.5 flex items-center gap-1.5">
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
                  </div>
                ) : (
                  <span className="mt-0.5 block font-mono text-faint">N/A</span>
                )}
              </div>
            )}

            {!isCancelled && (
              <div>
                <span className={fieldLabelClass}>Batas Waktu Pengiriman</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono font-medium text-fg">{order.ship_by_date || 'N/A'}</span>
                  <ShipCountdownBadge
                    shipByDate={order.ship_by_date}
                    shipByTimestamp={order.ship_by_timestamp}
                  />
                </div>
              </div>
            )}

            {order.package_id && (
              <div>
                <span className={fieldLabelClass}>TikTok Package ID</span>
                <span className="mt-0.5 block font-mono text-muted">{order.package_id}</span>
              </div>
            )}

            <div>
              <span className={fieldLabelClass}>Metode Penyerahan</span>
              <span className="mt-0.5 block font-medium text-muted">Cashless Dropoff / Direct Handover</span>
            </div>
          </div>

          {/* Delivered Status Banner for 48h Warranty */}
          {isOrderDelivered && (
            <div className="flex items-start gap-3 rounded-[11px] border border-st-done-border bg-st-done-bg p-3.5 text-st-done-fg">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5 text-[13px]">
                <span className="block font-semibold">Paket Telah Terkirim</span>
                <p className="text-[12px] leading-relaxed">
                  Terkirim pada <span className="font-semibold">{deliveredTime || 'pembaruan kurir'}</span>.
                  Batas hitung garansi 48 jam dimulai dari waktu penerimaan ini.
                </p>
              </div>
            </div>
          )}

          {/* Carrier Checkpoints Timeline */}
          <div className="space-y-3 rounded-[14px] border border-card-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
                <Clock className="h-3.5 w-3.5 text-faint" />
                <span>Lacak Pengiriman ({trackingCheckpoints.length})</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon={isLoadingTracking ? Loader2 : RefreshCw}
                onClick={() => loadTracking(order.order_id)}
                disabled={isLoadingTracking}
                title="Perbarui Pelacakan"
                className={isLoadingTracking ? '[&>svg]:animate-spin' : ''}
              >
                Perbarui
              </Button>
            </div>

            {isLoadingTracking && trackingCheckpoints.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[13px] text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-faint" />
                <span>Memuat riwayat pelacakan...</span>
              </div>
            ) : trackingCheckpoints.length === 0 ? (
              <div className="py-2 text-[13px] italic text-faint">
                {trackingLoaded
                  ? 'Belum ada riwayat pelacakan kurir yang tercatat.'
                  : 'Riwayat pelacakan akan tampil setelah kurir melakukan pemindaian.'}
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
            <span>Informasi Penerima & Pembeli</span>
          </h3>

          <div className="space-y-3 rounded-[14px] border border-card-border bg-card p-4 text-[13px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={fieldLabelClass}>Nama Penerima</span>
                <span className="mt-0.5 block break-all text-[14px] font-medium text-fg">
                  {order.recipient_name || order.buyer_username || 'N/A'}
                </span>
              </div>
              <div className="min-w-0 text-right">
                <span className={fieldLabelClass}>Username Pembeli</span>
                <span className="mt-0.5 block break-all font-mono text-muted">@{order.buyer_username || 'N/A'}</span>
              </div>
            </div>

            {order.recipient_phone && (
              <div>
                <span className={fieldLabelClass}>Nomor Telepon</span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="font-mono text-muted">{order.recipient_phone}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.recipient_phone, 'phone')}
                    className={copyBtnClass}
                    title="Salin Nomor HP"
                    aria-label="Salin Nomor HP"
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
                {order.recipient_address || 'N/A'}
              </p>
              <p className="mt-1 font-mono text-[12px] text-faint">
                {order.recipient_city || ''} {order.recipient_postcode || ''}
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
              <span>Subtotal Produk ({order.items?.length || 0} jenis produk)</span>
              <span className="font-mono text-fg">
                {formatCurrency(order.total_amount, order.currency || 'IDR')}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Ongkos Kirim</span>
              <span className="font-mono text-fg">Rp 0 (Cashless)</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2 text-[14px]">
              <span className="font-semibold text-fg">Total Pesanan</span>
              <span className="font-mono text-[15px] font-semibold text-fg">
                {formatCurrency(order.total_amount, order.currency || 'IDR')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </SlideDrawer>
  );
};
