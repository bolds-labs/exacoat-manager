import React, { useState, useEffect } from 'react';
import { Order } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ShippingLabelA6Modal } from './ShippingLabelA6Modal';
import { CustomerInvoiceModal } from './CustomerInvoiceModal';
import { updateOrderStatusDirect, injectShippingTrackingDirect } from '../../lib/wordpressBridge';
import { formatCurrency, formatDate, getStatusBadgeStyle, stripEmDashes } from '../../lib/formatters';
import { useToast } from '../../context/ToastContext';
import {
  X,
  Printer,
  FileText,
  Truck,
  MapPin,
  Mail,
  Phone,
  Layers,
  ExternalLink,
  Send,
  Calendar,
  CreditCard
} from 'lucide-react';

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: (order: Order) => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const { showToast } = useToast();
  const [currentStatus, setCurrentStatus] = useState(order?.status || 'processing');
  const [trackingInput, setTrackingInput] = useState(order?.tracking_number || '');
  const [courierInput, setCourierInput] = useState(order?.shipping_lines?.[0]?.method_title || '');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isInjectingTracking, setIsInjectingTracking] = useState(false);
  const [isA6ModalOpen, setIsA6ModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  useEffect(() => {
    if (order) {
      setCurrentStatus(order.status);
      setTrackingInput(order.tracking_number || '');
      setCourierInput(order.shipping_lines?.[0]?.method_title || '');
    }
  }, [order]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await updateOrderStatusDirect(order.id, newStatus);
      if (res.success && res.order) {
        setCurrentStatus(res.order.status);
        onOrderUpdated && onOrderUpdated(res.order);
        showToast('success', 'Status Updated', 'Order #' + order.number + ' marked as ' + newStatus);
      } else {
        showToast('error', 'Status Update Failed', res.error);
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveTracking = async () => {
    if (!trackingInput.trim()) {
      showToast('warning', 'Tracking Required', 'Please enter a valid tracking or AWB number');
      return;
    }
    setIsInjectingTracking(true);
    try {
      const res = await injectShippingTrackingDirect(order.id, trackingInput, courierInput);
      if (res.success && res.order) {
        onOrderUpdated && onOrderUpdated(res.order);
        showToast('success', 'Tracking Injected', 'Tracking number attached and order set to Ready to Ship');
      } else {
        showToast('error', 'Tracking Update Failed', res.error);
      }
    } finally {
      setIsInjectingTracking(false);
    }
  };

  const statusStyle = getStatusBadgeStyle(currentStatus);
  const shipping = order.shipping || order.billing;
  const customerName = stripEmDashes((shipping.first_name + ' ' + shipping.last_name).trim() || 'Guest Customer');
  const formattedAddress = [
    shipping.address_1,
    shipping.address_2,
    order.shipping_subdistrict ? 'Kel. ' + order.shipping_subdistrict : '',
    order.shipping_district ? 'Kec. ' + order.shipping_district : '',
    shipping.city,
    shipping.state,
    shipping.postcode,
    shipping.country,
  ].filter(Boolean).join(', ');

  const googleMapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(formattedAddress);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-[#0d0d11] border-l border-white/[0.08] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/[0.08] flex items-center justify-between bg-[#08080a]">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white font-chakra">
                Order #{order.number}
              </h2>
              <span className={'px-2.5 py-0.5 rounded-full text-xs font-semibold border ' + statusStyle.bg + ' ' + statusStyle.text + ' ' + statusStyle.border}>
                {statusStyle.label}
              </span>
            </div>
            <p className="text-xs text-zinc-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>Placed {formatDate(order.date_created)}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsA6ModalOpen(true)}
              className="gap-1.5 text-xs text-zinc-300"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A6 Label</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="gap-1.5 text-xs text-zinc-300"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Slip</span>
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Quick Action Bar */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
              Fulfillment Status Pipeline
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {['processing', 'ready-to-ship', 'completed', 'cancelled'].map((st) => {
                const isSelected = currentStatus.replace('wc-', '') === st;
                return (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={isUpdatingStatus}
                    className={'px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer min-h-[44px] ' + (
                      isSelected
                        ? 'bg-[#f3aa18] text-black border-[#f3aa18] font-bold shadow-sm'
                        : 'border-white/[0.1] text-zinc-300 hover:bg-white/[0.05]'
                    )}
                  >
                    {st === 'ready-to-ship' ? 'Ready to Ship' : st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shipping & Tracking Injection */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#f3aa18]" />
                <span className="text-sm font-semibold text-white">Shipping & Tracking</span>
              </div>
              <span className="text-xs text-zinc-400">{order.shipping_lines?.[0]?.method_title || 'Courier'}</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Resi / AWB tracking number..."
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                className="flex-1 bg-[#111116] border border-white/[0.1] rounded-xl px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-[#f3aa18] min-h-[44px]"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveTracking}
                isLoading={isInjectingTracking}
                className="gap-1.5 text-xs font-bold"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Inject Resi</span>
              </Button>
            </div>
          </div>

          {/* Configured Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-chakra flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#f3aa18]" />
                <span>Configured Items ({order.line_items.length})</span>
              </h3>
            </div>

            <div className="space-y-3">
              {order.line_items.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.name}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">Quantity: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#f3aa18]">
                      {formatCurrency(item.total, order.currency)}
                    </span>
                  </div>

                  {/* Configurator Layers Breakdown */}
                  {item.parsed_configurator && item.parsed_configurator.length > 0 ? (
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-1.5">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                        Custom Skin Configuration:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {item.parsed_configurator.map((cfg, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/[0.04] text-xs"
                          >
                            <span className="text-zinc-400 font-medium">{cfg.layer_name}:</span>
                            <span className="text-[#f3aa18] font-semibold">{cfg.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">
                      Standard SKU item with no custom skin layer metadata.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Customer & Shipping Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-chakra flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#f3aa18]" />
              <span>Customer & Destination</span>
            </h3>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">{customerName}</span>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#f3aa18] hover:underline"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-1 text-zinc-300">
                <p className="text-zinc-400">{formattedAddress}</p>
                {order.formatted_phone && (
                  <div className="flex items-center gap-2 pt-1 text-zinc-300">
                    <Phone className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{order.formatted_phone}</span>
                  </div>
                )}
                {shipping.email && (
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Mail className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{shipping.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Items Subtotal:</span>
              <span className="text-zinc-200">
                {formatCurrency(
                  order.line_items.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0),
                  order.currency
                )}
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Shipping Fee:</span>
              <span className="text-zinc-200">{formatCurrency(order.shipping_total || 0, order.currency)}</span>
            </div>
            {parseFloat(order.discount_total || '0') > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount Applied:</span>
                <span>-{formatCurrency(order.discount_total || 0, order.currency)}</span>
              </div>
            )}
            <div className="border-t border-white/[0.08] pt-2 flex justify-between text-sm font-bold text-white">
              <span>Total Paid:</span>
              <span className="text-[#f3aa18]">{formatCurrency(order.total, order.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      <ShippingLabelA6Modal
        order={order}
        isOpen={isA6ModalOpen}
        onClose={() => setIsA6ModalOpen(false)}
      />

      <CustomerInvoiceModal
        order={order}
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
      />
    </>
  );
};
