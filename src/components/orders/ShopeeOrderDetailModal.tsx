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

  const getStatusBadge = (status: string, _ord?: ShopeeOrder) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'READY_TO_SHIP':
        return { label: 'Perlu Diproses', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' };
      case 'PROCESSED':
        return { label: 'Telah Diproses', bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' };
      case 'SHIPPED':
        return { label: 'Dikirim', bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20' };
      case 'TO_CONFIRM_RECEIVE':
        return { label: 'Telah Sampai', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'COMPLETED':
        return { label: 'Selesai', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' };
      case 'CANCELLED':
      case 'IN_CANCEL':
        return { label: 'Dibatalkan', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/20' };
      case 'TO_RETURN':
        return { label: 'Pengembalian', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' };
      case 'UNPAID':
        return { label: 'Belum Bayar', bg: 'bg-neutral-800', text: 'text-neutral-400', border: 'border-white/10' };
      default:
        return { label: status || 'N/A', bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-white/10' };
    }
  };

  const isCancelled = ['CANCELLED', 'IN_CANCEL', 'TO_RETURN'].includes((order.order_status || '').toUpperCase());
  const badge = getStatusBadge(order.order_status, order);
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

  return (
    <SlideDrawer
      isOpen={isOpen}
      onClose={onClose}
      width="2xl"
      title={
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono">
            Shopee
          </span>
          <span className="font-mono font-bold text-white text-base">
            #{order.order_sn}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(order.order_sn, 'order_sn')}
            className="p-1 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Salin No. Pesanan"
          >
            {copiedKey === 'order_sn' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      }
      subtitle={`Waktu Pesanan: ${order.create_time} | Pembeli: @${order.buyer_username}`}
      headerActions={
        <div className="flex items-center gap-2">
          {!isCancelled && (
            isOrderPrinted ? (
              <span
                className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                title="Label pengiriman resmi telah dicetak"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Telah Dicetak</span>
              </span>
            ) : order.order_status === 'PROCESSED' ? (
              <button
                type="button"
                onClick={() => onPrintLabel(order)}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                title="Klik untuk mengunduh & mencetak label resmi Shopee"
              >
                <Printer className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-[11px]">Cetak Label</span>
              </button>
            ) : null
          )}
          <span
            className={clsx(
              'text-[11px] px-2.5 py-0.5 rounded-full font-semibold border',
              badge.bg,
              badge.text,
              badge.border
            )}
          >
            {badge.label}
          </span>
        </div>
      }
    >
      <div className="p-5 sm:p-6 space-y-6 text-neutral-200 font-sans">
        {/* Quick Actions Bar */}
        <div className="p-3 rounded-xl bg-neutral-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {!isCancelled && (
              <button
                type="button"
                onClick={() => onPrintLabel(order)}
                className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-orange-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>{isOrderPrinted ? 'Cetak Ulang Label' : 'Cetak Label Shopee'}</span>
              </button>
            )}

            {!isCancelled && isReadyToShip && onArrangeShipment && (
              <button
                type="button"
                onClick={() => onArrangeShipment(order)}
                className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Truck className="w-4 h-4" />
                <span>Atur Pengiriman</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onClaimWarranty && (
              <button
                type="button"
                disabled={order.already_claimed}
                onClick={() => onClaimWarranty(order)}
                className={clsx(
                  'px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer',
                  order.already_claimed
                    ? 'bg-neutral-800 text-neutral-500 border-white/5 cursor-not-allowed'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                )}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{order.already_claimed ? 'Claimed' : 'Claim Warranty'}</span>
              </button>
            )}

            {onClaimRedeem && (
              <button
                type="button"
                disabled={order.already_claimed}
                onClick={() => onClaimRedeem(order)}
                className={clsx(
                  'px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer',
                  order.already_claimed
                    ? 'bg-neutral-800 text-neutral-500 border-white/5 cursor-not-allowed'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                )}
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>{order.already_claimed ? 'Claimed' : 'Claim Redeem (Defect)'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Existing Claim Banner if any */}
        {order.already_claimed && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              This Shopee order has already been recorded in RMA claim system
              {order.existing_claim?.existing_order_num ? ` under replacement order #${order.existing_claim.existing_order_num}` : ''}.
            </span>
          </div>
        )}

        {/* Order Items Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-orange-400" />
              <span>Daftar Produk ({order.items?.length || 0})</span>
            </h3>
            <span className="text-xs text-neutral-400 font-mono">
              Total Kuantitas: {order.items?.reduce((acc, i) => acc + (i.quantity || 1), 0) || 0}
            </span>
          </div>

          <div className="space-y-2.5">
            {(order.items || []).map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-neutral-900/60 border border-white/10 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.item_name}
                      className="w-12 h-12 rounded-lg object-cover bg-neutral-800 border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 border border-white/10">
                      <Tag className="w-5 h-5 text-neutral-500" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {item.item_name}
                    </p>
                    {item.model_name && (
                      <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                        Varian: <span className="text-neutral-200">{item.model_name}</span>
                      </p>
                    )}
                    {(item.item_sku || item.model_sku) && (
                      <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
                        SKU: {item.item_sku || item.model_sku}
                      </p>
                    )}
                    {Boolean(item.note || item.item_note || item.order_item_note || item.buyer_note) && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg font-sans">
                        <span className="font-bold text-amber-400 shrink-0">Catatan Item:</span>
                        <span className="break-words">{item.note || item.item_note || item.order_item_note || item.buyer_note}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-white">
                    {formatCurrency(item.price, 'IDR')}
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">
                    Qty: {item.quantity}
                  </span>
                  <div className="text-[11px] font-mono text-orange-400 font-semibold mt-0.5">
                    = {formatCurrency(item.price * (item.quantity || 1), 'IDR')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {order.buyer_note && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px] text-amber-400 block mb-1">
                Catatan Pembeli
              </span>
              <p className="italic">{order.buyer_note}</p>
            </div>
          )}
        </div>

        {/* Logistics & Delivery Details */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-sky-400" />
            <span>Informasi Pengiriman</span>
          </h3>

          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Jasa Kirim</span>
              <span className="font-semibold text-white mt-0.5 block">{order.shipping_carrier || 'Jasa Kirim Standar'}</span>
            </div>

            {!isCancelled && (
              <div>
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">No. Resi</span>
                {order.tracking_number ? (
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="font-mono font-bold text-orange-400">{order.tracking_number}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.tracking_number, 'resi')}
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title="Salin No. Resi"
                    >
                      {copiedKey === 'resi' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {isOrderPrinted && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Tercetak</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-neutral-500 font-mono mt-0.5 block">N/A</span>
                )}
              </div>
            )}

            <div>
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Status Pengiriman</span>
              {isCancelled ? (
                <span className="text-rose-400 font-semibold mt-0.5 flex items-center gap-1 text-xs">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Pesanan Dibatalkan</span>
                </span>
              ) : isOrderDelivered || ['COMPLETED', 'DELIVERED', 'TO_CONFIRM_RECEIVE'].includes((order.order_status || '').toUpperCase()) ? (
                <span className="text-emerald-400 font-semibold mt-0.5 flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Telah Diterima</span>
                </span>
              ) : (order.order_status || '').toUpperCase() === 'SHIPPED' ? (
                <span className="text-blue-400 font-semibold mt-0.5 flex items-center gap-1 text-xs">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Dalam Pengiriman</span>
                </span>
              ) : isArranged ? (
                <span className="text-sky-400 font-semibold mt-0.5 flex items-center gap-1 text-xs">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Telah Diatur / Siap Diambil Kurir</span>
                </span>
              ) : (
                <span className="text-amber-400 font-semibold mt-0.5 flex items-center gap-1 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Perlu Diatur Pengiriman</span>
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Status Pesanan</span>
              <span className="text-neutral-300 mt-0.5 block font-medium">{badge.label}</span>
            </div>

            {!isCancelled && (
              <div className="sm:col-span-2 pt-2 border-t border-white/5">
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">Batas Waktu Pengiriman</span>
                <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                  <span className="text-xs font-mono font-semibold text-neutral-200">
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
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <span className="font-bold text-emerald-300 block">Paket Telah Diterima</span>
                <p className="text-emerald-400/90 text-[11px] leading-relaxed">
                  Diterima pada <span className="font-semibold text-emerald-200">{deliveredTime || 'pembaruan kurir'}</span>.
                  48-hour warranty claim window is calculated from this delivery timestamp.
                </p>
              </div>
            </div>
          )}

          {/* Carrier Checkpoints Timeline */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span>Riwayat Pengiriman ({trackingCheckpoints.length})</span>
              </span>
              <button
                type="button"
                onClick={() => loadTracking(order.order_sn)}
                disabled={isLoadingTracking}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-neutral-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
                title="Segarkan Riwayat"
              >
                <RefreshCw className={clsx('w-3 h-3', isLoadingTracking && 'animate-spin')} />
                <span>Segarkan</span>
              </button>
            </div>

            {isLoadingTracking && trackingCheckpoints.length === 0 ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-neutral-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                <span>Memuat riwayat pengiriman...</span>
              </div>
            ) : trackingCheckpoints.length === 0 ? (
              <div className="py-2 text-neutral-500 text-xs italic">
                {trackingLoaded
                  ? 'Belum ada riwayat pergerakan dari kurir.'
                  : 'Riwayat pengiriman akan muncul setelah kurir memperbarui status.'}
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {/* Latest Checkpoint */}
                <div className="relative pl-5 border-l-2 border-orange-500/40 pb-2">
                  <span
                    className={clsx(
                      'absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-neutral-900',
                      isOrderDelivered ? 'bg-emerald-400' : 'bg-orange-400'
                    )}
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-white leading-snug">
                      {trackingCheckpoints[0].description}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-400 font-mono">
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
                            className="relative pl-5 border-l-2 border-white/10 pb-2 last:border-transparent last:pb-0"
                          >
                            <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-neutral-600 ring-4 ring-neutral-900" />
                            <div className="text-xs">
                              <p className="text-neutral-300 leading-snug">{cp.description}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-500 font-mono">
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
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-orange-400 hover:text-orange-300 transition-colors pt-1 cursor-pointer"
                    >
                      {showAllCheckpoints ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Sembunyikan riwayat sebelumnya</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
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
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <User className="w-4 h-4 text-indigo-400" />
            <span>Pembeli & Alamat Pengiriman</span>
          </h3>

          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">Nama Penerima</span>
                <span className="font-semibold text-white text-sm mt-0.5 block">
                  {order.recipient_name || order.buyer_username}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">Akun Shopee</span>
                <span className="text-neutral-300 font-mono mt-0.5 block">@{order.buyer_username}</span>
              </div>
            </div>

            {order.recipient_phone && (
              <div>
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">No. Telepon</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-neutral-300">{formatDisplayPhone(order.recipient_phone)}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(order.recipient_phone, 'phone')}
                    className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title="Salin No. HP"
                  >
                    {copiedKey === 'phone' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-white/5">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                <span>Alamat Pengiriman</span>
              </span>
              <p className="text-neutral-200 mt-1 leading-relaxed">
                {order.recipient_address}
              </p>
              <p className="text-neutral-400 font-mono text-[11px] mt-1">
                {order.recipient_city} {order.recipient_district ? `, ${order.recipient_district}` : ''} {order.recipient_postcode ? `(${order.recipient_postcode})` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Rincian Pembayaran</span>
          </h3>

          <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-400">
              <span>Total Belanja ({order.items?.length || 0} produk)</span>
              <span className="font-mono text-neutral-200">
                {formatCurrency(order.total_amount, 'IDR')}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Ongkos Kirim</span>
              <span className="font-mono text-neutral-200">Rp 0 (Cashless)</span>
            </div>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm">
              <span className="font-bold text-white">Total Pembayaran</span>
              <span className="font-mono font-bold text-orange-400 text-base">
                {formatCurrency(order.total_amount, 'IDR')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </SlideDrawer>
  );
};
