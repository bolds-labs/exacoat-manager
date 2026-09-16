import React, { useState, useEffect } from 'react';
import { SlideDrawer } from '../ui/SlideDrawer';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { Modal } from '../ui/Modal';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../ui/Select';
import { Order, OrderStatus, OrderNote, OrderReview, OrderReviewMedia } from '../../types';
import { formatCurrency, formatDateTime, formatDate } from '../../lib/formatters';
import { 
  Package, 
  Truck, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Layers, 
  Download, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Send, 
  Eye, 
  Copy, 
  Check, 
  Ticket, 
  FileText, 
  MessageSquare, 
  Tag,
  ShieldCheck,
  Plus,
  RotateCcw,
  HelpCircle,
  Wallet,
  CreditCard,
  X,
  Printer,
  Sparkles,
  Star,
  Video,
  Play
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { getWpBaseUrl } from '../../lib/wordpressBridge';
import { 
  updateOrderStatusDirect, 
  fulfillOrderDirect, 
  addOrderNoteDirect, 
  fetchOrderNotesDirect,
  refundOrderDirect,
  sendReviewInviteDirect,
  fetchOrderReviewDirect
} from '../../lib/wordpressBridge';
import { ShippingLabelA6Modal } from './ShippingLabelA6Modal';
import { CustomerInvoiceModal } from './CustomerInvoiceModal';
import { clsx } from 'clsx';

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

const COURIER_PRESETS = [
  { label: 'JNE Express', value: 'jne' },
  { label: 'SiCepat', value: 'sicepat' },
  { label: 'POS Indonesia', value: 'pos' },
  { label: 'Goorita Send USA', value: 'goorita' },
  { label: 'DHL Express', value: 'dhl' },
  { label: 'FedEx International', value: 'fedex' },
  { label: 'Biteship (Auto)', value: 'biteship' },
  { label: 'Lion Parcel', value: 'lion' },
  { label: 'J&T Express', value: 'jnt' },
  { label: 'Custom / Other', value: 'custom' },
];

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const { showToast } = useToast();
  
  // Tracking form state
  const [courier, setCourier] = useState('jne');
  const [customCourierName, setCustomCourierName] = useState('');
  const [customTrackingUrl, setCustomTrackingUrl] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Order Notes & Timeline state
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isCustomerNote, setIsCustomerNote] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Refund modal & execution state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'original' | 'store_credit'>('original');
  const [restockRefundedItems, setRestockRefundedItems] = useState(true);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  // A6 Shipping Label & Customer Invoice modal state
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [previewCustomItem, setPreviewCustomItem] = useState<any | null>(null);

  // Collector Review & Media state
  const [orderReview, setOrderReview] = useState<OrderReview | null>(order?.review || null);
  const [isSendingReviewInvite, setIsSendingReviewInvite] = useState(false);
  const [previewReviewMedia, setPreviewReviewMedia] = useState<OrderReviewMedia | null>(null);

  // Sync tracking form, reviews and notes when order changes
  useEffect(() => {
    if (order) {
      if (order.review) {
        setOrderReview(order.review);
      } else {
        setOrderReview(null);
        if (order.status === 'delivered' || order.status === 'completed') {
          fetchOrderReviewDirect(order.id).then(res => {
            if (res.success && res.review) {
              setOrderReview(res.review);
            }
          });
        }
      }

      if (order.tracking) {
        const rawTrack = String(order.tracking.tracking_number || '').trim();
        const validTrack = rawTrack.startsWith('field_') ? '' : rawTrack;
        const carrierId = order.tracking.carrier_id || '';
        const isPreset = COURIER_PRESETS.some(p => p.value === carrierId && p.value !== 'custom');
        
        if (isPreset) {
          setCourier(carrierId);
          setCustomCourierName('');
          setCustomTrackingUrl('');
        } else {
          setCourier('custom');
          setCustomCourierName(order.tracking.courier || '');
          setCustomTrackingUrl(order.tracking.tracking_url || '');
        }

        setTrackingNumber(validTrack);
      } else {
        setCourier('jne');
        setCustomCourierName('');
        setCustomTrackingUrl('');
        setTrackingNumber('');
      }

      if (order.notes) {
        setNotes(order.notes);
      } else {
        loadNotes(order.id);
      }
    }
  }, [order]);

  const handleSendReviewInvite = async () => {
    if (!order) return;
    try {
      setIsSendingReviewInvite(true);
      const res = await sendReviewInviteDirect(order.id);
      if (res.success) {
        showToast('success', 'Invitation sent', (res as any).message || `Collector review invitation dispatched to ${order.billing?.email || order.customer_email}`);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast('error', 'Invitation failed', res.error || 'Failed sending review invitation');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Failed dispatching invitation');
    } finally {
      setIsSendingReviewInvite(false);
    }
  };

  const loadNotes = async (orderId: number) => {
    setIsLoadingNotes(true);
    const res = await fetchOrderNotesDirect(orderId);
    if (res.success && res.notes) {
      setNotes(res.notes);
    }
    setIsLoadingNotes(false);
  };

  if (!order) return null;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setIsUpdatingStatus(true);
      const res = await updateOrderStatusDirect(order.id, newStatus);
      if (res.success) {
        showToast('success', 'Status updated', `Order #${order.id} status changed to ${newStatus}`);
        order.status = newStatus as OrderStatus;
        await loadNotes(order.id);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        throw new Error(res.error || 'Failed updating status');
      }
    } catch (err: any) {
      showToast('error', 'Status update failed', err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      showToast('error', 'Missing tracking number', 'Please enter a tracking number.');
      return;
    }

    const finalCarrier = courier === 'custom' ? (customCourierName.trim() || 'Custom Courier') : courier;
    const finalUrl = courier === 'custom' && customTrackingUrl.trim()
      ? (customTrackingUrl.includes('%s') 
          ? customTrackingUrl.replace('%s', encodeURIComponent(trackingNumber.trim())) 
          : customTrackingUrl.trim())
      : undefined;

    try {
      setIsFulfilling(true);
      const res = await fulfillOrderDirect(order.id, {
        courier: finalCarrier,
        tracking_number: trackingNumber.trim(),
        tracking_url: finalUrl,
        status: 'none', // Save tracking without changing status
        notify_customer: false,
      } as any);

      if (res.success) {
        showToast('success', 'Tracking saved', `Tracking code saved for Order #${order.id}`);
        if (res.order) {
          Object.assign(order, res.order);
        } else if ((res as any).tracking_info) {
          order.tracking = (res as any).tracking_info;
        }
        await loadNotes(order.id);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        throw new Error(res.error || 'Failed saving tracking details');
      }
    } catch (err: any) {
      showToast('error', 'Failed to save tracking', err.message);
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setIsAddingNote(true);
      const res = await addOrderNoteDirect(order.id, newNote.trim(), isCustomerNote);
      if (res.success) {
        showToast('success', 'Note added', isCustomerNote ? 'Customer note added' : 'Internal note saved');
        setNewNote('');
        if ((res as any).notes) {
          setNotes((res as any).notes);
        } else {
          await loadNotes(order.id);
        }
      } else {
        throw new Error(res.error || 'Failed adding note');
      }
    } catch (err: any) {
      showToast('error', 'Failed to add note', err.message);
    } finally {
      setIsAddingNote(false);
    }
  };

  const totalRefunded = Number(order.total_refunded || 0);
  const remainingAvailableRefund = order.remaining_refund_available !== undefined 
    ? Number(order.remaining_refund_available) 
    : Math.max(0, Number(order.total) - totalRefunded);
  const netSettledTotal = Math.max(0, Number(order.total) - totalRefunded);

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(refundAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Invalid amount', 'Please enter a valid refund amount.');
      return;
    }
    if (amt > remainingAvailableRefund) {
      showToast('error', 'Amount exceeded', `Cannot refund more than the remaining balance (${formatCurrency(remainingAvailableRefund, order.currency)}).`);
      return;
    }

    try {
      setIsProcessingRefund(true);
      const res = await refundOrderDirect(order.id, {
        amount: amt,
        reason: refundReason.trim() || undefined,
        restock_items: restockRefundedItems,
        refund_to_store_credit: refundMethod === 'store_credit',
      } as any);

      if (res.success) {
        showToast('success', 'Refund processed', (res as any).message || `Refund of ${formatCurrency(amt, order.currency)} processed`);
        setIsRefundModalOpen(false);
        setRefundReason('');
        if (res.order) {
          Object.assign(order, res.order);
        }
        await loadNotes(order.id);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        throw new Error(res.error || 'Failed processing refund');
      }
    } catch (err: any) {
      showToast('error', 'Refund failed', err.message);
    } finally {
      setIsProcessingRefund(false);
    }
  };

    const currentStatusClean = String(order.status || '').replace('wc-', '');
    const cleanOrderNum = String(order.order_number || order.id || '').replace(/^#+/, '');

    return (
      <SlideDrawer
        isOpen={isOpen}
        onClose={onClose}
        width="2xl"
        title={
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-lg font-semibold text-zinc-950 dark:text-white font-sans tracking-tight">Order #{cleanOrderNum}</span>
            <Badge type="orderStatus" value={order.status} size="sm" />
            <span className="inline-flex h-6 items-center whitespace-nowrap text-xs leading-none font-mono font-medium text-lime-700 dark:text-[#f3aa18] bg-[#f3aa18]/10 px-2.5 rounded-full border border-[#f3aa18]/20">
              {formatCurrency(order.total, order.currency)}
            </span>
          </div>
        }
      subtitle={`Created on ${formatDateTime(order.created_at)} • via ${order.payment_method_title || order.payment_method || 'Direct Payment'}${order.customer_ip ? ` • IP: ${order.customer_ip}` : ''}`}
    >
      <div className="space-y-6">
        
        {/* Quick Lifecycle Stage Transition Pipeline */}
        <div className="p-4 rounded-2xl border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-sans">
              Order Status
            </span>
            <div className="flex items-center gap-2">
              {isUpdatingStatus && (
                <span className="text-[11px] text-[#f3aa18] font-mono animate-pulse flex items-center gap-1.5 mr-2">
                  <Clock className="w-3.5 h-3.5" /> Updating...
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(true)}
                className="px-3 py-1 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95 bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08]"
                title="View, download, and print official customer tax invoice"
              >
                <FileText className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span>Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setIsLabelModalOpen(true)}
                className={clsx(
                  "px-3 py-1 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95",
                  currentStatusClean === 'processing'
                    ? "bg-[#f3aa18] hover:bg-[#d9940c] text-[#0a0a0a] ring-2 ring-[#f3aa18]/30"
                    : "bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08]"
                )}
                title="Create and print A6 courier shipping label"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>A6 Shipping Label</span>
                {currentStatusClean === 'processing' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#0a0a0a]/20 text-[#0a0a0a] uppercase ml-0.5">
                    Confirmed
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {[
              { key: 'processing', label: 'Order Confirmed', icon: Clock },
              { key: 'in-production', label: 'In Production', icon: Layers },
              { key: 'quality-check', label: 'Quality Check', icon: Eye },
              { key: 'awaiting-pickup', label: 'Ready to Ship', icon: Package },
              { key: 'shipped', label: 'Shipped', icon: Truck },
              { key: 'completed', label: 'Delivered', icon: CheckCircle2 },
            ].map(stage => {
              const isActive = (currentStatusClean === stage.key) || 
                (stage.key === 'completed' && currentStatusClean === 'delivered') || 
                (stage.key === 'awaiting-pickup' && currentStatusClean === 'awaiting_pickup');
              const Icon = stage.icon;
              return (
                <button
                  key={stage.key}
                  disabled={isUpdatingStatus}
                  onClick={() => handleStatusChange(stage.key)}
                  className={clsx(
                    'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200',
                    isActive 
                      ? 'bg-[#f3aa18]/10 border-[#f3aa18]/30 text-[#f3aa18] shadow-[0_0_15px_rgba(169,255,93,0.15)] font-bold' 
                      : 'bg-[#141414] border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04] hover:border-white/[0.1]'
                  )}
                >
                  <Icon className={clsx('w-4 h-4 mb-1.5', isActive ? 'text-[#f3aa18]' : 'text-neutral-500')} />
                  <span className="text-[11px] font-sans tracking-tight line-clamp-1">{stage.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 1: Customer & Delivery Address Card */}
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
              <User className="w-4 h-4 text-[#f3aa18]" />
              Customer & Delivery
            </h4>
            <span className="text-[11px] font-mono text-neutral-400">
              Customer #{order.customer_id || 'Guest'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Contact Info */}
            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-0.5">Recipient Name</span>
                <p className="text-sm font-semibold text-white font-sans">{order.customer_name}</p>
              </div>

              {order.customer_email && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-0.5">Email Address</span>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`mailto:${order.customer_email}`}
                      className="text-xs font-mono text-neutral-300 hover:text-[#f3aa18] truncate"
                    >
                      {order.customer_email}
                    </a>
                    <button 
                      onClick={() => copyToClipboard(order.customer_email, 'email')}
                      className="p-1 text-neutral-500 hover:text-white"
                      title="Copy Email"
                    >
                      {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-[#f3aa18]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {order.customer_phone && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-0.5">Phone Number</span>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`tel:${order.customer_phone}`}
                      className="text-xs font-mono text-neutral-300 hover:text-[#f3aa18]"
                    >
                      {order.customer_phone}
                    </a>
                    <button 
                      onClick={() => copyToClipboard(order.customer_phone!, 'phone')}
                      className="p-1 text-neutral-500 hover:text-white"
                      title="Copy Phone"
                    >
                      {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-[#f3aa18]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Full Destination Address */}
            <div className="space-y-1.5 p-3.5 rounded-xl border border-white/[0.04] bg-[#141414]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5 text-[#f3aa18]" />
                Destination Address
              </span>
              <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                {order.shipping.address_1}
                {order.shipping.address_2 ? `, ${order.shipping.address_2}` : ''}<br />
                {order.shipping.city}, {order.shipping.state} {order.shipping.postcode}<br />
                <strong className="text-white">{order.shipping.country}</strong>
              </p>
            </div>
          </div>

          {order.customer_note && (
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs">
              <span className="font-bold block mb-0.5">Customer Note:</span>
              "{order.customer_note}"
            </div>
          )}
        </div>

        {/* Section 2: Ordered Metal Posters & Item Discounts */}
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
              <Package className="w-4 h-4 text-[#f3aa18]" />
              Production Items ({order.items.length})
            </h4>
            <span className="text-[11px] font-mono text-neutral-400">
              Total Units: {order.items.reduce((acc, it) => acc + (it.quantity || 1), 0)}
            </span>
          </div>

          <div className="space-y-3">
            {order.items.map((item, idx) => {
              const itemDiscount = Number(item.discount || 0);
              const itemTax = Number(item.tax || 0);

              return (
                <div 
                  key={item.id || idx}
                  className="p-4 rounded-xl border border-white/[0.04] bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & Item Meta */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-18 rounded-lg overflow-hidden bg-black border border-white/[0.08] shrink-0 relative flex items-center justify-center">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <Package className="w-6 h-6 text-neutral-600" />
                      )}
                      <span className="absolute bottom-1 right-1 px-1 py-0.2 text-[9px] font-mono font-bold bg-black/80 text-white rounded border border-white/10">
                        {item.quantity}x
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className={clsx("text-xs font-bold font-sans", item.is_refunded ? "text-neutral-500 line-through" : "text-white")}>
                          {item.name}
                        </h5>
                        {(item.name.toLowerCase().startsWith('custom order') || (item as any).is_custom) && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 flex items-center gap-1">
                            <span className="text-[#f3aa18] font-bold">✦</span>
                            <span>Custom Order</span>
                          </span>
                        )}
                        {item.qty_refunded && item.qty_refunded > 0 ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                            Refunded ({item.qty_refunded}x)
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-mono text-neutral-500">ID #{item.product_id}</span>
                        {item.orientation && (
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-neutral-400 border border-white/[0.06] tracking-wider">
                            {item.orientation}
                          </span>
                        )}
                        {(item.finish_type || (item as any).feelform_mode) && (
                          <span className={clsx(
                            "text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border tracking-wider",
                            (item.finish_type || (item as any).feelform_mode || '').toLowerCase().includes('flat')
                              ? "bg-zinc-800 text-neutral-300 border-white/10"
                              : "bg-[#f3aa18]/10 text-[#f3aa18] border-[#f3aa18]/20"
                          )}>
                            Finish: {item.finish_type || (item as any).feelform_mode}
                          </span>
                        )}
                      </div>

                      {/* Quick Inspect Button for Custom Skins */}
                      {(item.name.toLowerCase().startsWith('custom order') || (item as any).is_custom) && item.image_url && (
                        <button
                          type="button"
                          onClick={() => setPreviewCustomItem(item)}
                          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30 text-[11px] font-mono font-bold transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Custom Skin</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: Pricing, Discount, Tax & Refunds */}
                  <div className="flex items-center gap-3.5 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        {itemDiscount > 0 && (
                          <span className="text-[11px] font-mono text-neutral-500 line-through">
                            {formatCurrency(item.subtotal, order.currency)}
                          </span>
                        )}
                        <span className={clsx("text-xs font-mono font-bold", item.is_refunded ? "text-neutral-500 line-through" : "text-white")}>
                          {formatCurrency(item.total, order.currency)}
                        </span>
                      </div>

                      {item.amount_refunded && item.amount_refunded > 0 ? (
                        <span className="text-[10px] font-mono text-rose-400 block mt-0.5">
                          -{formatCurrency(item.amount_refunded, order.currency)} refunded
                        </span>
                      ) : null}

                      {itemDiscount > 0 && (
                        <span className="text-[10px] font-mono text-amber-400 block mt-0.5">
                          -{formatCurrency(itemDiscount, order.currency)} discount
                        </span>
                      )}

                      {itemTax > 0 && (
                        <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                          +{formatCurrency(itemTax, order.currency)} DDP
                        </span>
                      )}

                      {item.commission_amount ? (
                        <span className="text-[10px] font-mono text-[#f3aa18] block mt-0.5">
                          Cut: {formatCurrency(item.commission_amount, order.currency)} ({item.commission_rate || 12.5}%)
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2B: Applied Coupons & Fee Lines (if any) */}
        {((order.coupon_codes && order.coupon_codes.length > 0) || (order.fees && order.fees.length > 0)) && (
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
                <Ticket className="w-4 h-4 text-amber-400" />
                Coupons & Adjustments
              </span>
            </div>

            {/* Coupons Used */}
            {order.coupon_codes && order.coupon_codes.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-neutral-400 font-sans">Coupons applied:</span>
                {order.coupon_codes.map(code => (
                  <span 
                    key={code} 
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono font-bold"
                  >
                    <Tag className="w-3 h-3" />
                    {code}
                  </span>
                ))}
              </div>
            )}

            {/* Fees Breakdown */}
            {order.fees && order.fees.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {order.fees.map(f => (
                  <div key={f.id} className="flex items-center justify-between text-xs font-sans text-neutral-300">
                    <span>{f.name}</span>
                    <div className="text-right font-mono">
                      <span className={clsx(f.total < 0 ? 'text-amber-400' : 'text-white')}>
                        {formatCurrency(f.total, order.currency)}
                      </span>
                      {f.tax !== 0 && (
                        <span className="text-[10px] text-neutral-500 block">
                          DDP: {formatCurrency(f.tax, order.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 3: Courier Tracking & Fulfillment Dispatch Card */}
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#f3aa18]" />
                Shipping & Tracking
              </h4>
              <Tooltip 
                position="top"
                content="Save tracking code at any stage (e.g. Ready to Ship). When the status is set to Shipped, tracking is automatically emailed to the customer."
              />
            </div>
            {order.tracking?.tracking_number && !order.tracking.tracking_number.startsWith('field_') && (
              <span className="text-[11px] font-mono text-neutral-300 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
                Tracking Saved
              </span>
            )}
          </div>

          <form onSubmit={handleSaveTracking} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-sans">
                  Courier
                </label>
                <Select value={courier} onValueChange={setCourier}>
                  <SelectTrigger className="w-full h-10 px-3.5 rounded-xl bg-[#141414] border-white/[0.08] text-xs text-white">
                    <SelectValue placeholder="Select Courier" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURIER_PRESETS.map(preset => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {courier === 'custom' ? (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5 font-sans">
                    Courier Name
                  </label>
                  <input
                    type="text"
                    required
                    value={customCourierName}
                    onChange={e => setCustomCourierName(e.target.value)}
                    placeholder="e.g. Royal Mail, USPS, Aramex"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-white/[0.08] text-xs font-sans text-white placeholder-neutral-600 focus:outline-none focus:border-[#f3aa18] transition-colors"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5 font-sans">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    placeholder="e.g. 5252sf252, JNT1948293810"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-white/[0.08] text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-[#f3aa18] transition-colors"
                  />
                </div>
              )}
            </div>

            {courier === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5 font-sans">
                    Tracking Number
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    placeholder="e.g. GB123456789"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-white/[0.08] text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-[#f3aa18] transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-sans">
                      Tracking URL (Optional)
                    </label>
                    <span className="text-[9px] text-neutral-500 font-mono">%s = tracking code</span>
                  </div>
                  <input
                    type="text"
                    value={customTrackingUrl}
                    onChange={e => setCustomTrackingUrl(e.target.value)}
                    placeholder="https://carrier.com/track?no=%s"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-white/[0.08] text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-[#f3aa18] transition-colors"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={isFulfilling || !trackingNumber.trim() || (courier === 'custom' && !customCourierName.trim())}
                className="px-3.5 py-1.5 rounded-lg bg-[#f3aa18] hover:bg-[#f5b838] disabled:opacity-50 text-[#0a0a0a] text-xs font-bold font-sans flex items-center gap-1.5 shadow-sm transition-all shrink-0"
              >
                <Truck className="w-3.5 h-3.5" />
                {isFulfilling ? 'Saving...' : 'Save Tracking'}
              </button>
            </div>
          </form>
        </div>

        {/* Section 4: Financial Summary */}
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#f3aa18]" />
              Order Summary
            </h4>
            <div className="flex items-center gap-2">
              {remainingAvailableRefund > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRefundAmount(String(remainingAvailableRefund));
                    setIsRefundModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-sans font-medium flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Refund
                </button>
              )}
              <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.06] px-2 py-0.5 rounded border border-white/[0.08]">
                Currency: {order.currency || 'USD'}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs font-sans">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-neutral-400">
              <span>Items Subtotal</span>
              <span className="font-mono text-white">
                {formatCurrency(order.subtotal || order.total, order.currency)}
              </span>
            </div>

            {/* Discount */}
            {Number(order.discount_total || 0) > 0 && (
              <div className="flex items-center justify-between text-amber-400">
                <span>
                  Discount Applied {order.coupon_codes && order.coupon_codes.length > 0 && `(${order.coupon_codes.join(', ')})`}
                </span>
                <span className="font-mono">
                  -{formatCurrency(order.discount_total, order.currency)}
                </span>
              </div>
            )}

            {/* Fees */}
            {order.fee_total !== undefined && order.fee_total !== 0 && (
              <div className="flex items-center justify-between text-neutral-400">
                <span>Adjustments</span>
                <span className={clsx('font-mono', order.fee_total < 0 ? 'text-amber-400' : 'text-white')}>
                  {formatCurrency(order.fee_total, order.currency)}
                </span>
              </div>
            )}

            {/* Shipping */}
            <div className="flex items-center justify-between text-neutral-400">
              <span>Shipping ({order.shipping_method_name || 'Standard Delivery'})</span>
              <span className="font-mono text-white">{formatCurrency(order.shipping_total || 0, order.currency)}</span>
            </div>

            {/* Tax */}
            {Number(order.total_tax) > 0 && (
              <div className="flex items-center justify-between text-neutral-400">
                <span>Tax</span>
                <span className="font-mono text-white">{formatCurrency(order.total_tax, order.currency)}</span>
              </div>
            )}

            {/* Grand Total */}
            <div className="border-t border-white/[0.08] pt-2.5 flex items-center justify-between font-bold text-sm text-white">
              <span>Order Total</span>
              <span className="font-mono text-base text-[#f3aa18]">{formatCurrency(order.total, order.currency)}</span>
            </div>

            {/* Refund Ledger Lines */}
            {totalRefunded > 0 && (
              <>
                <div className="flex items-center justify-between text-xs font-sans text-rose-400 pt-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <RotateCcw className="w-3.5 h-3.5" /> Amount Refunded:
                  </span>
                  <span className="font-mono font-bold">
                    -{formatCurrency(totalRefunded, order.currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-sans text-neutral-300 pt-0.5">
                  <span className="font-medium">Net Amount:</span>
                  <span className="font-mono font-bold text-white">
                    {formatCurrency(netSettledTotal, order.currency)}
                  </span>
                </div>

                {order.refunds && order.refunds.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">
                      Refund History ({order.refunds.length})
                    </span>
                    {order.refunds.map(ref => (
                      <div key={ref.id} className="flex items-center justify-between text-[11px] text-neutral-400 bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                        <div>
                          <span className="text-white font-mono font-medium">Refund #{ref.id}</span>
                          {ref.reason && <span className="text-neutral-400 ml-1.5 font-sans">({ref.reason})</span>}
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-rose-400 font-bold">-{formatCurrency(ref.amount, order.currency)}</span>
                          {ref.date_created && <span className="text-[9px] text-neutral-500 block">{formatDate(ref.date_created)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Paid status */}
            <div className="text-[11px] text-neutral-400 font-sans pt-1 flex items-center justify-between border-t border-white/[0.04]">
              <span>Payment:</span>
              <span className="text-white font-mono">
                {order.date_paid ? `${formatCurrency(order.total, order.currency)} paid on ${formatDate(order.date_paid)}` : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 4B: Collector Review & Feedback */}
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              Collector Review & Feedback
            </h4>
            {orderReview ? (
              <span className={clsx(
                "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                orderReview.status === 'featured' && "bg-purple-500/10 text-purple-300 border-purple-500/30",
                orderReview.status === 'approved' && "bg-[#f3aa18]/10 text-[#f3aa18] border-[#f3aa18]/30",
                orderReview.status === 'pending' && "bg-amber-500/10 text-amber-300 border-amber-500/30",
                orderReview.status === 'rejected' && "bg-rose-500/10 text-rose-400 border-rose-500/30",
              )}>
                {orderReview.status}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-neutral-500 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                {order.status === 'delivered' || order.status === 'completed' ? 'Awaiting Collector' : 'Pre-delivery'}
              </span>
            )}
          </div>

          {orderReview ? (
            <div className="space-y-3 bg-[#141414] p-4 rounded-xl border border-white/[0.04]">
              {/* Rating stars & Author */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={clsx(
                          "w-3.5 h-3.5",
                          star <= orderReview.rating
                            ? "text-amber-400 fill-amber-400"
                            : "text-neutral-700"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-mono font-bold text-white ml-1">
                    {orderReview.rating}.0
                  </span>
                  {orderReview.verified_purchase && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ml-1">
                      Verified
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono text-neutral-500">
                  {formatDate(orderReview.created_at)}
                </span>
              </div>

              {/* Review Content */}
              {orderReview.title && (
                <h5 className="text-xs font-bold text-white font-sans">
                  {orderReview.title}
                </h5>
              )}
              <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                "{orderReview.content}"
              </p>

              {/* Collector Details */}
              <div className="text-[11px] text-neutral-400 font-sans flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                <span className="text-white font-medium">{orderReview.customer_name}</span>
                {orderReview.customer_location && (
                  <span className="text-neutral-500 font-mono text-[10px]">
                    ({orderReview.customer_location})
                  </span>
                )}
              </div>

              {/* Uploaded Media (Photos / Videos) */}
              {orderReview.media && orderReview.media.length > 0 && (
                <div className="pt-2 border-t border-white/[0.04]">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-2">
                    Collector Wall Media ({orderReview.media.length})
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {orderReview.media.map((med, mIdx) => (
                      <button
                        key={mIdx}
                        type="button"
                        onClick={() => setPreviewReviewMedia(med)}
                        className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.08] hover:border-[#f3aa18]/50 bg-black group transition-all"
                      >
                        {med.type === 'video' ? (
                          <>
                            {med.poster_url ? (
                              <img
                                src={med.poster_url}
                                alt="Video thumbnail"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                <Video className="w-5 h-5 text-neutral-400" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                              <span className="w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white">
                                <Play className="w-3 h-3 fill-white ml-0.5" />
                              </span>
                            </div>
                            <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-black/80 text-white border border-white/10">
                              VIDEO
                            </span>
                          </>
                        ) : (
                          <>
                            <img
                              src={med.url}
                              alt="Review media"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-black/80 text-white border border-white/10">
                              PHOTO
                            </span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 bg-[#141414] p-4 rounded-xl border border-white/[0.04]">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                <p className="text-neutral-400 font-sans">
                  No review received for this order yet.
                </p>
                {order.review_invited_at ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Invite sent {formatDate(order.review_invited_at)}
                  </span>
                ) : order.review_invite_scheduled_at ? (
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Auto-scheduled {formatDate(order.review_invite_scheduled_at)}
                  </span>
                ) : null}
              </div>

              {(order.status === 'delivered' || order.status === 'completed') ? (
                <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[11px] text-neutral-500 font-sans">
                    The order is complete. You can send a review invitation to the collector.
                  </p>
                  <button
                    type="button"
                    onClick={handleSendReviewInvite}
                    disabled={isSendingReviewInvite}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-50 text-white text-xs font-semibold font-sans flex items-center gap-1.5 border border-white/[0.08] transition-all shrink-0"
                  >
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isSendingReviewInvite ? 'Sending...' : order.review_invited_at ? 'Resend Invitation' : 'Send Review Invitation'}</span>
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 font-sans">
                  Invitations are automatically dispatched 36 hours after this order is marked delivered or completed.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Section 5: Order Notes & Activity Logs */}
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#f3aa18]" />
              Activity Logs & Notes ({notes.length})
            </h4>
          </div>

          {/* Add Note Form */}
          <form onSubmit={handleAddNote} className="space-y-2.5">
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add internal staff note or note to customer..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-white/[0.08] text-xs font-sans text-white placeholder-neutral-500 focus:outline-none focus:border-[#f3aa18] transition-colors resize-none"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-400 text-xs">
                <input
                  type="checkbox"
                  checked={isCustomerNote}
                  onChange={e => setIsCustomerNote(e.target.checked)}
                  className="rounded border-white/20 bg-[#141414] text-[#f3aa18] focus:ring-0"
                />
                <span>Customer note</span>
              </label>

              <button
                type="submit"
                disabled={isAddingNote || !newNote.trim()}
                className="px-4 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 text-white text-xs font-semibold font-sans flex items-center gap-1.5 border border-white/[0.08] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingNote ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </form>

          {/* Notes List */}
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {isLoadingNotes ? (
              <div className="text-center py-4 text-neutral-500 text-xs font-mono">Loading history...</div>
            ) : notes.length === 0 ? (
              <div className="text-center py-4 text-neutral-600 text-xs font-sans">No order notes yet.</div>
            ) : (
              notes.map(note => (
                <div 
                  key={note.id}
                  className={clsx(
                    'p-3 rounded-xl border text-xs font-sans space-y-2',
                    note.customer_note 
                      ? 'bg-amber-500/5 border-amber-500/20 text-amber-200' 
                      : 'bg-[#141414] border-white/[0.04] text-neutral-300'
                  )}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{note.content}</p>
                  
                  {/* Note Creator / Author Attribution */}
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono pt-2 border-t border-white/[0.04] flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {note.author_avatar ? (
                        <img src={note.author_avatar} alt="" className="w-4 h-4 rounded-full border border-white/10" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-neutral-500" />
                      )}
                      <span className="text-neutral-200 font-sans font-medium">
                        {note.author_name || note.added_by || 'System'}
                      </span>
                      {note.author_role && (
                        <span className={clsx(
                          "px-1.5 py-0.2 rounded text-[9px] font-sans font-bold uppercase",
                          note.author_role === 'Operations Manager' || note.author_role === 'Manager' 
                            ? "bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20"
                            : note.author_role === 'Administrator' || note.author_role === 'Shop Manager'
                            ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                            : "bg-white/[0.04] text-neutral-400 border border-white/[0.06]"
                        )}>
                          {note.author_role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-neutral-500">
                      <span>{note.date_created ? formatDateTime(note.date_created) : '-'}</span>
                      {note.customer_note && (
                        <span className="text-amber-400 font-sans font-bold text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                          Customer
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 6: WordPress Quick Access Button */}
        <div className="pt-2">
          <a
            href={`${getWpBaseUrl()}/wp-admin/post.php?post=${order.id}&action=edit`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-neutral-300 hover:text-white text-xs font-semibold font-sans flex items-center justify-center gap-2 transition-all group shadow-sm"
          >
            <span>Open Store Order</span>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors" />
          </a>
        </div>

      </div>

      {/* Refund Modal Overlay */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#111111] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 font-sans">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                Issue Refund for Order #{cleanOrderNum}
              </h3>
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 bg-[#141414] p-3.5 rounded-xl border border-white/[0.04] text-xs">
              <div className="flex items-center justify-between text-neutral-400">
                <span>Amount already refunded:</span>
                <span className="font-mono text-rose-400 font-bold">
                  -{formatCurrency(totalRefunded, order.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span>Total available to refund:</span>
                <span className="font-mono text-[#f3aa18] font-bold">
                  {formatCurrency(remainingAvailableRefund, order.currency)}
                </span>
              </div>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-4">
              {/* Refund Destination Selector */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5 font-sans">
                  Refund Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethod('original')}
                    className={clsx(
                      'p-3 rounded-xl border text-left transition-all',
                      refundMethod === 'original'
                        ? 'bg-white/[0.08] border-white/20 text-white font-medium shadow-sm'
                        : 'bg-[#141414] border-white/[0.06] text-neutral-400 hover:text-neutral-200'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-4 h-4 text-rose-400" />
                      <span className="text-xs font-sans font-semibold">Payment Method</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-sans">Refund to original payment</p>
                  </button>

                  <button
                    type="button"
                    disabled={!order.customer_id}
                    onClick={() => setRefundMethod('store_credit')}
                    className={clsx(
                      'p-3 rounded-xl border text-left transition-all',
                      refundMethod === 'store_credit'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 font-medium shadow-sm'
                        : 'bg-[#141414] border-white/[0.06] text-neutral-400 hover:text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-sans font-semibold">Store Credit</span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-sans">
                      {order.customer_id ? 'Advanced Coupons balance' : 'Guest order (no account)'}
                    </p>
                  </button>
                </div>

                {refundMethod === 'store_credit' && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-sans flex items-center justify-between">
                    <span>Customer account store credit</span>
                    {order.customer_store_credit_balance !== undefined && (
                      <span className="font-mono font-bold">
                        Balance: {formatCurrency(order.customer_store_credit_balance, order.currency)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5 font-sans">
                  Refund Amount ({order.currency})
                </label>
                <input
                  type="number"
                  step="any"
                  max={remainingAvailableRefund}
                  min="1"
                  required
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-white/[0.08] text-sm font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-rose-400 transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5 font-sans">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  placeholder="e.g. Customer request / Exchange"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-white/[0.08] text-xs font-sans text-white placeholder-neutral-600 focus:outline-none focus:border-rose-400 transition-colors"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={restockRefundedItems}
                  onChange={e => setRestockRefundedItems(e.target.checked)}
                  className="rounded border-white/20 bg-[#141414] text-rose-500 focus:ring-0"
                />
                <span>Restock items</span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  disabled={isProcessingRefund}
                  className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white text-xs font-medium border border-white/[0.08] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingRefund || !refundAmount || Number(refundAmount) <= 0 || Number(refundAmount) > remainingAvailableRefund}
                  className={clsx(
                    "px-4 py-2 rounded-xl disabled:opacity-50 text-white text-xs font-bold font-sans flex items-center gap-2 shadow-sm transition-all",
                    refundMethod === 'store_credit'
                      ? "bg-amber-600 hover:bg-amber-500 text-white"
                      : "bg-rose-500 hover:bg-rose-600 text-white"
                  )}
                >
                  {refundMethod === 'store_credit' ? <Wallet className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  {isProcessingRefund 
                    ? (refundMethod === 'store_credit' ? 'Crediting...' : 'Refunding...') 
                    : (refundMethod === 'store_credit' ? 'Refund to Store Credit' : 'Issue Refund')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* A6 Shipping Label Modal */}
      <ShippingLabelA6Modal
        order={order}
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
      />

      {/* Customer Invoice Modal */}
      <CustomerInvoiceModal
        order={order}
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
      />

      {/* Custom Skin Preview Lightbox Modal */}
      {previewCustomItem && (
        <Modal
          isOpen={!!previewCustomItem}
          onClose={() => setPreviewCustomItem(null)}
          title={
            <div className="flex items-center gap-2 font-sans">
              <span className="text-[#f3aa18] font-bold">✦</span>
              <span>{previewCustomItem.name}</span>
            </div>
          }
          maxWidth="lg"
        >
          <div className="space-y-4 font-sans">
            <div className="relative aspect-[1/1.4] max-h-[60vh] w-full rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center p-3 shadow-2xl select-none">
              {previewCustomItem.image_url ? (
                <img
                  src={previewCustomItem.image_url}
                  alt={previewCustomItem.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              ) : (
                <span className="text-neutral-500 font-mono text-xs">No image preview</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Orientation:</span>
                <span className="text-white font-bold uppercase">{previewCustomItem.orientation || 'portrait'}</span>
                {(previewCustomItem.finish_type || (previewCustomItem as any).feelform_mode) && (
                  <span className={clsx(
                    "ml-2 px-2 py-0.5 rounded font-bold uppercase text-[10px]",
                    (previewCustomItem.finish_type || (previewCustomItem as any).feelform_mode || '').toLowerCase().includes('flat')
                      ? "bg-zinc-800 text-neutral-300 border border-white/10"
                      : "bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/30"
                  )}>
                    {(previewCustomItem.finish_type || (previewCustomItem as any).feelform_mode || '').toLowerCase().includes('flat') ? 'Finish: Flat' : `Finish: Matte/Textured`}
                  </span>
                )}
              </div>

              {previewCustomItem.image_url && (
                <a
                  href={previewCustomItem.image_url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-3.5 py-1.5 rounded-lg bg-[#f3aa18] hover:bg-[#d9940c] text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download High-Res</span>
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Review Media Modal */}
      {previewReviewMedia && (
        <Modal
          isOpen={!!previewReviewMedia}
          onClose={() => setPreviewReviewMedia(null)}
          title={previewReviewMedia.type === 'video' ? 'Customer Video' : 'Customer Photo'}
          maxWidth="lg"
        >
          <div className="p-4 space-y-4 font-sans">
            <div className="flex items-center justify-center max-h-[70vh] bg-black rounded-xl overflow-hidden border border-white/[0.08]">
              {previewReviewMedia.type === 'video' ? (
                <video
                  src={previewReviewMedia.url}
                  poster={previewReviewMedia.poster_url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
                />
              ) : (
                <img
                  src={previewReviewMedia.url}
                  alt="Customer skin photo"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                />
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Type:</span>
                <span className="text-white font-bold uppercase">{previewReviewMedia.type}</span>
                {previewReviewMedia.r2_synced ? (
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/30">
                    Cloudflare R2 Mirrored
                  </span>
                ) : null}
              </div>

              <a
                href={previewReviewMedia.url}
                target="_blank"
                rel="noreferrer"
                download
                className="px-3.5 py-1.5 rounded-lg bg-[#f3aa18] hover:bg-[#d9940c] text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Asset</span>
              </a>
            </div>
          </div>
        </Modal>
      )}
    </SlideDrawer>
  );
};
