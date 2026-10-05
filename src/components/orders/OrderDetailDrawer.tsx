import React, { useState, useEffect } from 'react';
import { SlideDrawer } from '../ui/SlideDrawer';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { Modal } from '../ui/Modal';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../ui/Select';
import { Order, OrderItem, OrderStatus, OrderNote, OrderReview, OrderReviewMedia, getOrderRma, getOrderGuarantee } from '../../types';
import { formatCurrency, formatDateTime, formatDate, formatFeeLabel, getOrderStatusInfo } from '../../lib/formatters';
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
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plane,
  Store,
  ClipboardCheck,
  Edit2,
  Trash2,
  XCircle
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { extractItemSpecs } from '../../lib/orderItems';
import { isStorePickupOrder, toggleLocalStorePickupOrder, resolveOrderCourier, getOrderCourierDisplay, formatOrderNumber, cleanOrderNumber } from '../../lib/orderUtils';
import { resolveCountryName } from '../../lib/countries';
import { getWpBaseUrl } from '../../lib/wordpressBridge';
import { GooritaBookingModal } from './GooritaBookingModal';
import { downloadGooritaAwbPdf } from '../../lib/gooritaService';
import { 
  updateOrderStatusDirect, 
  cancelOrderDirect,
  trashOrderDirect,
  fulfillOrderDirect, 
  addOrderNoteDirect, 
  fetchOrderNotesDirect,
  refundOrderDirect,
  sendReviewInviteDirect,
  fetchOrderReviewDirect,
  syncOrderTrackingDirect,
  processGuaranteeActionDirect,
  assignTrackingNumberFromPool,
  resendOrderEmail,
  createRayspeedAwbDirect,
  createGooritaAwbDirect
} from '../../lib/wordpressBridge';
import { ShippingLabelA6Modal } from './ShippingLabelA6Modal';
import { CustomerInvoiceModal } from './CustomerInvoiceModal';
import { PackingSlipModal } from './PackingSlipModal';
import { WarrantyReviewModal } from './WarrantyReviewModal';
import { ManualWarrantyModal } from './ManualWarrantyModal';
import { EditOrderAddressModal } from './EditOrderAddressModal';
import { EditOrderItemModal } from './EditOrderItemModal';
import { WhatsAppContactModal, WhatsAppIcon } from './WhatsAppContactModal';
import { clsx } from 'clsx';
import { formatCleanText, decodeHtmlEntities } from '../../lib/utils';

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated?: () => void;
  onSelectOrderById?: (orderId: number) => void;
  onNavigateToCustomer?: (customerId: number, customerEmail?: string, customerName?: string) => void;
}

const COURIER_PRESETS = [
  { label: 'JNE Express', value: 'jne' },
  { label: 'SiCepat', value: 'sicepat' },
  { label: 'POS Indonesia', value: 'pos' },
  { label: 'Goorita', value: 'goorita' },
  { label: 'DHL Express', value: 'dhl' },
  { label: 'FedEx', value: 'fedex' },
  { label: 'Rayspeed Asia', value: 'rayspeed' },
  { label: 'Biteship (Auto)', value: 'biteship' },
  { label: 'Custom / Other', value: 'custom' },
];

const getPublicTrackingUrl = (carrier?: string, trackingNum?: string, customUrl?: string): string => {
  if (!trackingNum) return '#';
  if (customUrl && customUrl.trim()) {
    return customUrl.includes('%s')
      ? customUrl.replace('%s', encodeURIComponent(trackingNum.trim()))
      : customUrl.trim();
  }
  const c = (carrier || '').toLowerCase();
  if (c.includes('dhl')) return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackingNum.trim())}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNum.trim())}`;
  if (c.includes('rayspeed')) return `https://rayspeed.com/speedship/tracking.php?awb=${encodeURIComponent(trackingNum.trim())}`;
  return `https://biteship.com/track/${encodeURIComponent(trackingNum.trim())}`;
};

const renderNoteHtml = (content: string) => {
  if (!content) return null;
  if (!content.includes('<')) return content;
  const sanitized = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '');
  return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
};

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order: propOrder,
  isOpen,
  onClose,
  onOrderUpdated,
  onSelectOrderById,
  onNavigateToCustomer,
}) => {
  const { showToast } = useToast();
  const { user, simulatedRole } = useAuth();
  const effectiveRole = simulatedRole || user?.role;
  const isShopManager = effectiveRole === 'shop_manager';
  const isAdmin = effectiveRole === 'super_admin' || user?.actualRole === 'super_admin' || Boolean((user as any)?.roles?.includes('administrator')) || Boolean(user?.email?.toLowerCase().includes('admin'));

  // Administrator Controls State (Cancel / Trash)
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [isTrashingOrder, setIsTrashingOrder] = useState(false);

  const [internalOrder, setInternalOrder] = useState<Order | null>(propOrder);
  useEffect(() => {
    setInternalOrder(propOrder);
  }, [propOrder]);

  const order = internalOrder || propOrder;

  // Edit Address & Item Modals state
  const [isEditAddressModalOpen, setIsEditAddressModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);

  const handleOrderMutated = (updatedOrder: Order) => {
    setInternalOrder(updatedOrder);
    if (onOrderUpdated) onOrderUpdated();
  };
  
  // Tracking form state
  const [courier, setCourier] = useState('jne');
  const [customCourierName, setCustomCourierName] = useState('');
  const [customTrackingUrl, setCustomTrackingUrl] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isSyncingTracking, setIsSyncingTracking] = useState(false);
  const [showAllCheckpoints, setShowAllCheckpoints] = useState(false);
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
  const [markAsRefunded, setMarkAsRefunded] = useState(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  // A6 Shipping Label, Customer Invoice & Packing Slip modal state
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [showPreparingPromptModal, setShowPreparingPromptModal] = useState(false);
  const [showShippedPromptModal, setShowShippedPromptModal] = useState(false);
  const [isMarkingPreparingFromDrawer, setIsMarkingPreparingFromDrawer] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPackingSlipModalOpen, setIsPackingSlipModalOpen] = useState(false);
  const [isWarrantyReviewModalOpen, setIsWarrantyReviewModalOpen] = useState(false);
  const [isManualWarrantyModalOpen, setIsManualWarrantyModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [manualClaimType, setManualClaimType] = useState<'Warranty' | 'Redeem'>('Warranty');
  const [previewCustomItem, setPreviewCustomItem] = useState<any | null>(null);
  const [showManualCompletedModal, setShowManualCompletedModal] = useState(false);
  const [pickupOverrideVersion, setPickupOverrideVersion] = useState(0);

  // 30-Day Money Back Guarantee state
  const [isProcessingGuaranteeAction, setIsProcessingGuaranteeAction] = useState(false);
  const [isGuaranteeRejectModalOpen, setIsGuaranteeRejectModalOpen] = useState(false);
  const [guaranteeRejectReason, setGuaranteeRejectReason] = useState('');

  // Collector Review & Media state
  const [orderReview, setOrderReview] = useState<OrderReview | null>(order?.review || null);
  const [isSendingReviewInvite, setIsSendingReviewInvite] = useState(false);
  const [previewReviewMedia, setPreviewReviewMedia] = useState<OrderReviewMedia | null>(null);

  // Goorita US Shipment Quick Actions State
  const [isGooritaBookingModalOpen, setIsGooritaBookingModalOpen] = useState(false);

  // Track Order timeline modal state
  const [isTrackOrderModalOpen, setIsTrackOrderModalOpen] = useState(false);

  // Resend Transactional Email state
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState('customer_order_processing');
  const [resendRecipientEmail, setResendRecipientEmail] = useState('');
  const [isEditingRecipientEmail, setIsEditingRecipientEmail] = useState(false);
  const [isSendingOrderEmail, setIsSendingOrderEmail] = useState(false);
  const [lastEmailSentResult, setLastEmailSentResult] = useState<{ template: string; latency_ms: number; message: string } | null>(null);

  useEffect(() => {
    if (order) {
      setResendRecipientEmail(order.customer_email || order.billing?.email || '');
      setLastEmailSentResult(null);
    }
  }, [order?.id, order?.customer_email, order?.billing?.email]);

  // Printed tracking state
  const [isPrinted, setIsPrinted] = useState<boolean>(() => {
    if (!order) return false;
    try {
      const cached = localStorage.getItem('_exacoat_direct_printed_orders');
      const list = cached ? JSON.parse(cached) : [];
      return list.includes(order.id);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (order) {
      try {
        const cached = localStorage.getItem('_exacoat_direct_printed_orders');
        const list = cached ? JSON.parse(cached) : [];
        setIsPrinted(list.includes(order.id));
      } catch {
        setIsPrinted(false);
      }
    }
  }, [order]);

  useEffect(() => {
    const handlePrintedEvt = (e: any) => {
      const ids = e?.detail?.orderIds;
      if (order && Array.isArray(ids) && ids.includes(order.id)) {
        setIsPrinted(true);
      }
    };
    window.addEventListener('exacoat_order_printed', handlePrintedEvt);
    return () => window.removeEventListener('exacoat_order_printed', handlePrintedEvt);
  }, [order]);

  const isConsolidationOrder = Boolean(
    (order?.meta_data || []).some((m: any) => m.key === '_is_consolidation_order' && (m.value === 'yes' || m.value === true || m.value === '1')) ||
    (order?.meta_data || []).some((m: any) => m.key === '_goorita_consolidated_orders' && Array.isArray(m.value) && m.value.length > 0) ||
    String(order?.shipping?.company || '').toLowerCase().includes('goorita')
  );

  const destCountry = (order?.shipping?.country || order?.billing?.country || '').toUpperCase();
  const isUsOrder = !isConsolidationOrder && Boolean(
    ['US', 'USA', 'UNITED STATES'].includes(destCountry) ||
    (courier === 'goorita' && destCountry !== 'ID' && destCountry !== 'INDONESIA') ||
    ((order?.shipping_lines?.[0]?.method_id || '').toLowerCase().includes('goorita') && destCountry !== 'ID' && destCountry !== 'INDONESIA')
  );
  const isSeaDestination = ['SG', 'MY', 'TH', 'PH', 'VN', 'TW', 'JP', 'HK'].includes(destCountry);
  const isRayspeedOrder = Boolean(
    courier === 'rayspeed' ||
    isSeaDestination ||
    (order?.shipping_lines?.[0]?.method_id || '').toLowerCase().includes('rayspeed') ||
    (order?.tracking?.carrier_id || '').toLowerCase() === 'rayspeed'
  );

  const [isBookingRayspeed, setIsBookingRayspeed] = useState(false);

  const handleBookRayspeed = async () => {
    if (!order) return;
    setIsBookingRayspeed(true);
    try {
      const res = await createRayspeedAwbDirect(order.id);
      if (res.success && res.airwaybill) {
        showToast('success', 'Rayspeed AWB Created', `Airwaybill ${res.airwaybill} generated for Order #${cleanOrderNumber(order.id)}.`);
        setTrackingNumber(res.airwaybill);
        setCourier('rayspeed');
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast('error', 'Rayspeed Booking Failed', res.error || 'Failed to generate AWB');
      }
    } catch (err: any) {
      showToast('error', 'Rayspeed Error', err.message || 'Error communicating with Rayspeed API');
    } finally {
      setIsBookingRayspeed(false);
    }
  };

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

      const resolvedCourier = resolveOrderCourier(order);

      if (order.tracking) {
        const rawTrack = String(order.tracking.tracking_number || '').trim();
        const validTrack = rawTrack.startsWith('field_') ? '' : rawTrack;
        const carrierId = String(order.tracking.carrier_id || (order as any).carrier_id || '').toLowerCase().trim();

        // Prioritize explicit carrierId from tracking/order, falling back to resolvedCourier
        const effectiveCarrierId = carrierId || resolvedCourier.courierId || 'jne';

        const isPreset = COURIER_PRESETS.some(p => p.value === effectiveCarrierId && p.value !== 'custom');
        
        if (isPreset) {
          setCourier(effectiveCarrierId);
          setCustomCourierName('');
          setCustomTrackingUrl('');
        } else {
          setCourier('custom');
          setCustomCourierName(resolvedCourier.courierName || order.tracking.courier || '');
          setCustomTrackingUrl(order.tracking.tracking_url || '');
        }

        setTrackingNumber(validTrack);
      } else {
        if (resolvedCourier.isCustom) {
          setCourier('custom');
          setCustomCourierName(resolvedCourier.courierName);
        } else {
          setCourier(resolvedCourier.courierId);
          setCustomCourierName('');
        }
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

  const handleResendEmail = async () => {
    if (!order) return;
    const targetEmail = resendRecipientEmail.trim() || order.customer_email || order.billing?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast('error', 'Invalid Email', 'Please provide a valid recipient email address.');
      return;
    }

    try {
      setIsSendingOrderEmail(true);
      const recipientName = order.customer_name || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Customer';
      const res = await resendOrderEmail(order.id, selectedEmailTemplate, targetEmail, recipientName);

      if (res.success) {
        setLastEmailSentResult({
          template: selectedEmailTemplate,
          latency_ms: res.latency_ms || 0,
          message: res.message || 'Delivered successfully via ZeptoMail',
        });
        showToast('success', 'Email Sent', `Transactional email delivered in ${res.latency_ms || 0}ms.`);
        await loadNotes(order.id);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast('error', 'Send Failed', res.message || res.error || 'Failed sending email.');
      }
    } catch (err: any) {
      showToast('error', 'Send Failed', err.message || 'Unexpected email error.');
    } finally {
      setIsSendingOrderEmail(false);
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
        if (res.order) {
          Object.assign(order, res.order);
        }

        // If confirmed/processing and carrier is JNE or SiCepat but tracking is still missing, ensure pool assignment
        const cleanStatus = newStatus.replace('wc-', '');
        if (cleanStatus === 'processing' || cleanStatus === 'confirmed') {
          const currentTracking = order.tracking?.tracking_number || (order as any).tracking_number;
          const carrier = (order.tracking?.carrier_id || (order as any).carrier_id || courier || '').toLowerCase();
          if ((!currentTracking || currentTracking === '⚠️') && (carrier.includes('jne') || carrier.includes('sicepat'))) {
            try {
              const assignRes = await assignTrackingNumberFromPool(
                Number(order.id),
                carrier.includes('sicepat') ? 'sicepat' : 'jne'
              );
              if (assignRes.success && assignRes.tracking_number) {
                if (!order.tracking) {
                  order.tracking = {
                    courier: carrier.includes('sicepat') ? 'SiCepat' : 'JNE Express',
                    carrier_id: assignRes.carrier || (carrier.includes('sicepat') ? 'sicepat' : 'jne'),
                    tracking_number: assignRes.tracking_number,
                    tracking_url: '',
                  };
                } else {
                  order.tracking.tracking_number = assignRes.tracking_number;
                  order.tracking.courier = carrier.includes('sicepat') ? 'SiCepat' : 'JNE Express';
                }
                setTrackingNumber(assignRes.tracking_number);
                showToast(
                  'info',
                  'Tracking Number Allocated',
                  `Assigned ${assignRes.tracking_number} from ${(assignRes.carrier || 'courier').toUpperCase()} pool.`
                );
              }
            } catch {
              // Ignore fallback failure
            }
          }
        }

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

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      setIsCancellingOrder(true);
      const res = await cancelOrderDirect(order.id, false);
      if (res.success) {
        showToast('success', 'Order Cancelled', `Order #${order.id} has been marked as cancelled.`);
        order.status = 'cancelled' as OrderStatus;
        if (res.order) {
          Object.assign(order, res.order);
        }
        setShowCancelModal(false);
        await loadNotes(order.id);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast('error', 'Cancellation Failed', res.error || res.message || 'Could not cancel order.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Failed to cancel order.');
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const handleTrashOrder = async () => {
    if (!order) return;
    try {
      setIsTrashingOrder(true);
      const res = await trashOrderDirect(order.id);
      if (res.success) {
        showToast('success', 'Order Trashed', `Order #${order.id} has been moved to trash.`);
        setShowTrashModal(false);
        if (onOrderUpdated) onOrderUpdated();
        onClose();
      } else {
        showToast('error', 'Trash Failed', res.error || res.message || 'Could not move order to trash.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Failed to move order to trash.');
    } finally {
      setIsTrashingOrder(false);
    }
  };

  const executeSaveTracking = async (targetStatus: 'none' | 'shipped') => {
    if (!order) return;
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
        status: targetStatus,
        notify_customer: targetStatus === 'shipped',
      } as any);

      if (res.success) {
        setShowShippedPromptModal(false);
        const orderNum = cleanOrderNumber(order.id);
        const currentStatusInfo = getOrderStatusInfo(order.status);
        if (targetStatus === 'shipped') {
          showToast('success', 'Order Shipped', `Order #${orderNum} marked as Shipped with tracking code.`);
          order.status = 'shipped' as OrderStatus;
        } else {
          showToast('success', 'Tracking Saved', `Tracking code saved for Order #${orderNum}. Status kept as ${currentStatusInfo.label}.`);
        }
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

  const handleSaveTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      showToast('error', 'Missing tracking number', 'Please enter a tracking number.');
      return;
    }
    if (courier === 'custom' && !customCourierName.trim()) {
      showToast('error', 'Missing courier name', 'Please enter a custom courier name.');
      return;
    }

    const cleanStatus = String(order?.status || '').replace('wc-', '').toLowerCase();
    if (['shipped', 'completed', 'delivered'].includes(cleanStatus)) {
      executeSaveTracking('none');
    } else {
      setShowShippedPromptModal(true);
    }
  };

  const handleSyncTracking = async () => {
    if (!order) return;
    try {
      setIsSyncingTracking(true);
      const res = await syncOrderTrackingDirect(order.id);
      if (res.success) {
        const checkpointCount = res.checkpoints?.length || 0;
        showToast(
          'success',
          'Tracking Refreshed',
          res.status_updated
            ? `Order marked as Completed (Delivered by ${res.source || 'courier'})`
            : `Carrier Status: ${(res.latest_status || 'Pending').toUpperCase()} (${checkpointCount} checkpoint${checkpointCount === 1 ? '' : 's'})`
        );
        if (res.status && order.status !== res.status) {
          order.status = res.status as OrderStatus;
        }
        if (order.tracking) {
          order.tracking.latest_status = res.latest_status;
          order.tracking.checkpoints = res.checkpoints;
        } else if (res.checkpoints) {
          order.tracking = {
            courier: courier,
            tracking_number: trackingNumber,
            latest_status: res.latest_status,
            checkpoints: res.checkpoints,
          };
        }
        await loadNotes(order.id);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast('error', 'Tracking sync failed', res.message || res.error || 'Could not fetch tracking updates');
      }
    } catch (err: any) {
      showToast('error', 'Tracking sync error', err.message);
    } finally {
      setIsSyncingTracking(false);
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
      const isFullRefund = amt >= remainingAvailableRefund && remainingAvailableRefund > 0;
      const res = await refundOrderDirect(order.id, {
        amount: amt,
        reason: refundReason.trim() || undefined,
        restock_items: restockRefundedItems,
        refund_to_store_credit: refundMethod === 'store_credit',
        mark_as_refunded: isFullRefund || markAsRefunded,
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

  const handleGuaranteeAction = async (action: 'mark_received' | 'approve_refund' | 'reject', rejectNotes?: string) => {
    if (!order) return;
    try {
      setIsProcessingGuaranteeAction(true);
      const res = await processGuaranteeActionDirect(order.id, action, rejectNotes);
      if (res.success) {
        if (action === 'approve_refund') {
          showToast('success', 'Refund Approved & Issued', res.message || 'Refund issued and confirmation email dispatched.');
        } else if (action === 'mark_received') {
          showToast('success', 'Package Received', 'Return package inspected and marked as received at Ruby Commercial TB12.');
        } else {
          showToast('info', 'Claim Rejected', 'Guarantee claim marked as rejected.');
          setIsGuaranteeRejectModalOpen(false);
          setGuaranteeRejectReason('');
        }
        await loadNotes(order.id);
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast('error', 'Action Failed', res.error || 'Failed processing guarantee action');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Failed processing guarantee action');
    } finally {
      setIsProcessingGuaranteeAction(false);
    }
  };

    const currentStatusClean = String(order.status || '').replace('wc-', '');
    const cleanOrderNum = String(order.order_number || order.id || '').replace(/^#+/, '');
    const isStorePickup = isStorePickupOrder(order);

    const rmaDetails = getOrderRma(order);
    const guaranteeDetails = getOrderGuarantee(order);
    const parentWarrantyClaimId = (order.meta_data || []).find(m => m.key === '_warranty_claim_order_id' || m.key === '_warranty_replacement_order_id')?.value;
    const parentWarrantyClaimInvoice = (order.meta_data || []).find(m => m.key === '_warranty_claim_invoice')?.value;
    const parentRedeemClaimId = (order.meta_data || []).find(m => m.key === '_redeem_replacement_order_id')?.value;

    const orderMetaList = Array.isArray(order.meta_data) ? order.meta_data : [];
    const findOrderMeta = (k: string) => orderMetaList.find(m => m.key === k)?.value;

    const rawShippingPriceStr = findOrderMeta('_shipping_raw_price') || findOrderMeta('_shipping_biteship_original_rate') || findOrderMeta('_shipping_biteship_courier_rate');
    const shippingDiscountStr = findOrderMeta('_shipping_discount_amount') || findOrderMeta('_shipping_biteship_discount');
    const shippingDiscount = shippingDiscountStr ? Math.abs(parseFloat(String(shippingDiscountStr))) : 0;
    const shippingPromoCode = String(findOrderMeta('_shipping_promo_code') || findOrderMeta('_shipping_biteship_applied_coupon') || '').trim();

    const originalShippingRate = rawShippingPriceStr
      ? parseFloat(String(rawShippingPriceStr))
      : (shippingDiscount > 0 ? parseFloat(String(order.shipping_total || 0)) + shippingDiscount : parseFloat(String(order.shipping_total || 0)));

    return (
      <SlideDrawer
        isOpen={isOpen}
        onClose={onClose}
        width="2xl"
        title={
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-lg font-semibold text-zinc-950 dark:text-white font-sans tracking-tight">Order #{cleanOrderNum}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(cleanOrderNum, 'order_number')}
              className="p-1 rounded-md hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title={`Copy Order #${cleanOrderNum}`}
            >
              {copiedField === 'order_number' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            {rmaDetails?.order_type === 'Redeem' && (
              <span className="inline-flex h-6 items-center whitespace-nowrap text-[11px] leading-none font-mono font-bold text-amber-400 bg-amber-500/20 px-2.5 rounded-full border border-amber-500/40 shadow-xs">
                <RotateCcw className="w-3.5 h-3.5 mr-1 text-amber-400" />
                REDEEM
              </span>
            )}
            {rmaDetails?.order_type === 'Warranty' && (
              <span className="inline-flex h-6 items-center whitespace-nowrap text-[11px] leading-none font-mono font-bold text-sky-400 bg-sky-500/20 px-2.5 rounded-full border border-sky-500/40 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-sky-400" />
                WARRANTY REPLACEMENT
              </span>
            )}
            {guaranteeDetails && (
              <span className={clsx(
                "inline-flex h-6 items-center whitespace-nowrap text-[11px] leading-none font-mono font-bold px-2.5 rounded-full border shadow-xs",
                guaranteeDetails.status === 'refunded'
                  ? "text-emerald-400 bg-emerald-500/20 border-emerald-500/40"
                  : guaranteeDetails.status === 'package_received'
                  ? "text-sky-400 bg-sky-500/20 border-sky-500/40"
                  : guaranteeDetails.status === 'rejected'
                  ? "text-rose-400 bg-rose-500/20 border-rose-500/40"
                  : "text-purple-400 bg-purple-500/20 border-purple-500/40"
              )}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                30D GUARANTEE {guaranteeDetails.status === 'refunded' ? 'REFUNDED' : guaranteeDetails.status === 'package_received' ? 'PACKAGE RECEIVED' : guaranteeDetails.status === 'rejected' ? 'REJECTED' : 'CLAIM'}
              </span>
            )}
            {isStorePickup && (
              <span className="inline-flex h-6 items-center whitespace-nowrap text-[11px] leading-none font-mono font-semibold text-[#f3aa18] bg-[#f3aa18]/15 px-2.5 rounded-full border border-[#f3aa18]/30">
                Store Pickup (Bekasi)
              </span>
            )}
          </div>
        }
      subtitle={`Created on ${formatDateTime(order.created_at)} • via ${order.payment_method_title || order.payment_method || 'Direct Payment'}${order.customer_ip ? ` • IP: ${order.customer_ip}` : ''}`}
    >
      <div className="space-y-6">

        {/* RMA Installation Warranty or Redeem Replacement Card */}
        {(rmaDetails?.order_type === 'Warranty' || rmaDetails?.order_type === 'Redeem') && (
          <div className={clsx(
            "p-4 rounded-2xl border shadow-lg",
            rmaDetails.order_type === 'Redeem'
              ? "border-amber-500/30 bg-amber-950/20 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
              : "border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
          )}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className={clsx(
                  "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
                  rmaDetails.order_type === 'Redeem'
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                )}>
                  {rmaDetails.order_type === 'Redeem' ? <RotateCcw className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white font-sans">
                      {rmaDetails.order_type === 'Redeem'
                        ? 'Redeem Replacement Order'
                        : '48-Hour Installation Warranty Replacement'}
                    </span>
                    <span className={clsx(
                      "px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border",
                      rmaDetails.status === 'approved'
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : rmaDetails.status === 'rejected'
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    )}>
                      {rmaDetails.status === 'approved' ? 'Approved' : rmaDetails.status === 'rejected' ? 'Rejected' : 'Pending Review'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 font-sans mt-1">
                    Original Reference:{' '}
                    {rmaDetails.original_order_id && onSelectOrderById ? (
                      <button
                        type="button"
                        onClick={() => onSelectOrderById(Number(rmaDetails.original_order_id))}
                        className={clsx(
                          "font-mono font-bold underline underline-offset-2 cursor-pointer",
                          rmaDetails.order_type === 'Redeem' ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"
                        )}
                      >
                        #{rmaDetails.original_invoice || rmaDetails.original_order_id}
                      </button>
                    ) : (
                      <span className="font-mono font-bold text-white">
                        #{rmaDetails.original_invoice || rmaDetails.original_order_id || 'N/A'}
                      </span>
                    )}
                    {rmaDetails.claim_reason && (
                      <span className="text-neutral-400"> • Reason: <span className="italic text-neutral-200">{rmaDetails.claim_reason}</span></span>
                    )}
                  </p>
                  {rmaDetails.video_deleted && (
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      Proof video auto-deleted on review.
                    </p>
                  )}
                </div>
              </div>

              {rmaDetails.video_proof_url && (
                <button
                  type="button"
                  onClick={() => setIsWarrantyReviewModalOpen(true)}
                  className={clsx(
                    "px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center gap-2 transition-all shadow-sm active:scale-95 text-white cursor-pointer shrink-0",
                    rmaDetails.order_type === 'Redeem' ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
                  )}
                >
                  <Video className="w-4 h-4" />
                  <span>Review Claim Proof</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Parent Order Warranty Claim Notice */}
        {parentWarrantyClaimId && (
          <div className="p-3.5 rounded-2xl border border-sky-500/30 bg-sky-950/20 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="text-xs font-sans text-neutral-300">
                <span>48h Warranty Replacement claim order filed: </span>
                {onSelectOrderById ? (
                  <button
                    type="button"
                    onClick={() => onSelectOrderById(Number(parentWarrantyClaimId))}
                    className="font-mono font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 cursor-pointer"
                  >
                    #{parentWarrantyClaimInvoice || parentWarrantyClaimId}
                  </button>
                ) : (
                  <span className="font-mono font-bold text-white">
                    #{parentWarrantyClaimInvoice || parentWarrantyClaimId}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Parent Order Redeem Claim Notice */}
        {parentRedeemClaimId && (
          <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-950/20 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-xs font-sans text-neutral-300">
                <span>Redeem Replacement order filed: </span>
                {onSelectOrderById ? (
                  <button
                    type="button"
                    onClick={() => onSelectOrderById(Number(parentRedeemClaimId))}
                    className="font-mono font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
                  >
                    #{parentRedeemClaimId}
                  </button>
                ) : (
                  <span className="font-mono font-bold text-white">
                    #{parentRedeemClaimId}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 30-Day Money Back Guarantee Return Card */}
        {guaranteeDetails && (
          <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-950/20 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCcw className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300 font-sans">
                      30-Day Money Back Guarantee Return
                    </span>
                    <span className={clsx(
                      "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border",
                      guaranteeDetails.status === 'refunded'
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : guaranteeDetails.status === 'package_received'
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                        : guaranteeDetails.status === 'rejected'
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    )}>
                      {guaranteeDetails.status === 'refunded' 
                        ? 'Refund Paid' 
                        : guaranteeDetails.status === 'package_received'
                        ? 'Package Received at Ruby Commercial TB12'
                        : guaranteeDetails.status === 'rejected'
                        ? 'Rejected'
                        : 'Awaiting Return Package'}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-300 font-sans mt-1.5 space-y-1">
                    <p>
                      <span className="text-neutral-400">Method:</span>{' '}
                      <span className="font-semibold text-white">
                        {guaranteeDetails.refund_method === 'store_credit' 
                          ? 'Store Credit (100%)' 
                          : guaranteeDetails.refund_method === 'bank_transfer'
                          ? 'Bank Transfer (70%)'
                          : 'PayPal (70%)'}
                      </span>
                      {' • '}
                      <span className="text-neutral-400">Amount:</span>{' '}
                      <span className="font-bold text-amber-400 font-mono">
                        {formatCurrency(guaranteeDetails.refund_amount, order.currency)}
                      </span>
                    </p>
                    {guaranteeDetails.destination && (
                      <p>
                        <span className="text-neutral-400">Destination:</span>{' '}
                        <span className="font-mono text-zinc-200">{guaranteeDetails.destination}</span>
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-400">
                      <span className="text-neutral-400">Return Hub:</span>{' '}
                      Exacoat Returns Hub, Ruby Commercial TB12, Jl. Bulevar Selatan, Bekasi 17142
                    </p>
                    {guaranteeDetails.return_tracking ? (
                      <p className="text-[11px]">
                        <span className="text-neutral-400">Customer Return Courier:</span>{' '}
                        <span className="font-mono font-bold text-emerald-400">
                          {guaranteeDetails.return_courier || 'Courier'} #{guaranteeDetails.return_tracking}
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-400/80 italic">
                        Return shipment resi not yet uploaded by customer.
                      </p>
                    )}
                    {guaranteeDetails.claim_data?.reason && (
                      <p className="text-[11px] text-neutral-400">
                        <span>Reason: </span>
                        <span className="italic text-neutral-200">{guaranteeDetails.claim_data.reason}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                {guaranteeDetails.status === 'pending_return' && (
                  <button
                    type="button"
                    disabled={isProcessingGuaranteeAction}
                    onClick={() => handleGuaranteeAction('mark_received')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 cursor-pointer disabled:opacity-50"
                    title="Confirm package has been received and inspected at Ruby Commercial TB12"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Mark Package Received</span>
                  </button>
                )}

                {(guaranteeDetails.status === 'pending_return' || guaranteeDetails.status === 'package_received') && (
                  <>
                    <button
                      type="button"
                      disabled={isProcessingGuaranteeAction}
                      onClick={() => handleGuaranteeAction('approve_refund')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50"
                      title="Approve refund, record in WooCommerce, and send light-theme confirmation email"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Issue Refund</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingGuaranteeAction}
                      onClick={() => setIsGuaranteeRejectModalOpen(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 cursor-pointer disabled:opacity-50"
                      title="Reject guarantee return claim"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Quick Lifecycle Stage Transition Pipeline */}
        <div className="p-4 rounded-2xl border border-white/[0.06] bg-[#111111]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Order Progress Timeline</span>
              {isUpdatingStatus && (
                <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsLabelModalOpen(true)}
                className={clsx(
                  "p-2 rounded-xl text-xs font-bold font-sans flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer relative",
                  !isPrinted
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                    : "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-400 border border-white/[0.08]"
                )}
                title={!isPrinted ? (isStorePickup ? "Print Workshop Label (Not printed yet)" : "Print 4x6 Label (Not printed yet)") : (isStorePickup ? "Print Workshop Label (Already printed)" : "Print 4x6 Label (Already printed)")}
              >
                <Printer className="w-3.5 h-3.5" />
                {!isPrinted && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-neutral-900" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(true)}
                className="px-2.5 py-1 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95 bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08] cursor-pointer"
                title="View, download, and print official customer tax invoice"
              >
                <FileText className="w-3.5 h-3.5 text-[#f3aa18]" />
                <span>Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPackingSlipModalOpen(true)}
                className="px-2.5 py-1 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95 bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08] cursor-pointer"
                title="View and print official warehouse packing slip & picking manifest"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Packing Slip</span>
              </button>
              {rmaDetails?.order_type !== 'Warranty' && rmaDetails?.order_type !== 'Redeem' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setManualClaimType('Warranty');
                      setIsManualWarrantyModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 cursor-pointer"
                    title="Claim installation warranty manually for this order"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Warranty</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualClaimType('Redeem');
                      setIsManualWarrantyModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all shadow-sm active:scale-95 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 cursor-pointer"
                    title="Issue free redeem replacement order (Exacoat factory defect / error)"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Redeem</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={clsx("grid gap-2", isStorePickup ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-6")}>
            {(isStorePickup
              ? [
                  { key: 'on-hold', label: 'Waiting for Payment', icon: Clock },
                  { key: 'processing', label: 'Payment confirmed', icon: Clock },
                  { key: 'preparing-order', label: 'Preparing order', icon: Layers },
                  { key: 'smb-ready', label: 'Ready for Pickup', icon: Package },
                  { key: 'completed', label: 'Picked Up', icon: CheckCircle2 },
                ]
              : [
                  { key: 'on-hold', label: 'Waiting for Payment', icon: Clock },
                  { key: 'processing', label: 'Payment confirmed', icon: Clock },
                  { key: 'preparing-order', label: 'Preparing order', icon: Layers },
                  { key: 'ready-to-ship', label: 'Waiting for Courier Pickup', icon: Package },
                  { key: 'shipped', label: 'Shipped', icon: Truck },
                  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
                ]
            ).map(stage => {
              const isActive = (currentStatusClean === stage.key) || 
                (stage.key === 'completed' && (currentStatusClean === 'delivered' || currentStatusClean === 'completed' || (isStorePickup && currentStatusClean === 'smb-picked'))) || 
                (stage.key === 'ready-to-ship' && (currentStatusClean === 'awaiting-pickup' || currentStatusClean === 'awaiting_pickup' || currentStatusClean === 'ready-to-ship' || currentStatusClean === 'ready_to_ship')) ||
                (stage.key === 'smb-ready' && (currentStatusClean === 'smb-ready' || currentStatusClean === 'ready-to-ship' || currentStatusClean === 'awaiting-pickup')) ||
                (stage.key === 'preparing-order' && (currentStatusClean === 'in-production' || currentStatusClean === 'in_production' || currentStatusClean === 'preparing-order' || currentStatusClean === 'preparing_order'));
              const Icon = stage.icon;
              return (
                <button
                  key={stage.key}
                  disabled={isUpdatingStatus}
                  onClick={() => {
                    if (!isStorePickup && stage.key === 'completed') {
                      setShowManualCompletedModal(true);
                    } else {
                      handleStatusChange(stage.key);
                    }
                  }}
                  className={clsx(
                    'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200',
                    isActive 
                      ? 'bg-[#f3aa18]/10 border-[#f3aa18]/30 text-[#f3aa18] shadow-[0_0_15px_rgba(243,170,24,0.15)] font-bold' 
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
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
              <User className="w-4 h-4 text-[#f3aa18]" />
              Customer & Delivery
            </h4>
            <div className="flex items-center gap-2">
              {!isShopManager ? (
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToCustomer) {
                      onNavigateToCustomer(order.customer_id, order.customer_email, order.customer_name);
                    } else {
                      window.location.hash = `#customers?id=${order.customer_id || 0}&email=${encodeURIComponent(order.customer_email || '')}`;
                    }
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 hover:text-[#f3aa18] border border-white/10 hover:border-[#f3aa18]/40 text-xs font-sans font-medium flex items-center gap-1.5 transition-all cursor-pointer group"
                  title="View customer profile and past orders"
                >
                  <span className="w-4 h-4 rounded-full bg-[#f3aa18]/20 text-[#f3aa18] text-[9px] font-bold flex items-center justify-center font-mono">
                    {order.customer_name ? formatCleanText(order.customer_name).charAt(0).toUpperCase() : 'C'}
                  </span>
                  <span className="font-semibold text-white group-hover:text-[#f3aa18] transition-colors truncate max-w-[140px] sm:max-w-[200px]">
                    {formatCleanText(order.customer_name) || (order.customer_id ? `Customer #${order.customer_id}` : 'Guest Customer')}
                  </span>
                  <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-[#f3aa18] transition-colors shrink-0" />
                </button>
              ) : (
                <div className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-neutral-200 border border-white/10 text-xs font-sans font-medium flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#f3aa18]/20 text-[#f3aa18] text-[9px] font-bold flex items-center justify-center font-mono">
                    {order.customer_name ? formatCleanText(order.customer_name).charAt(0).toUpperCase() : 'C'}
                  </span>
                  <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">
                    {formatCleanText(order.customer_name) || (order.customer_id ? `Customer #${order.customer_id}` : 'Guest Customer')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Contact Info */}
            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-0.5">Recipient Name</span>
                <p className="text-sm font-semibold text-white font-sans">{formatCleanText(order.customer_name)}</p>
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
                    <button 
                      type="button"
                      onClick={() => setIsWhatsAppModalOpen(true)}
                      className="p-1 text-emerald-500 hover:text-emerald-400 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
                      title="Contact Customer via WhatsApp"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Destination Address or Store Pickup Location */}
            <div className={clsx(
              "space-y-1.5 p-3.5 rounded-xl border flex flex-col justify-between",
              isStorePickup ? "border-[#f3aa18]/25 bg-[#f3aa18]/5" : "border-white/[0.04] bg-[#141414]"
            )}>
              <div className="flex items-center justify-between gap-2 pb-2 mb-1 border-b border-white/[0.04] flex-wrap">
                <span className={clsx(
                  "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                  isStorePickup ? "text-[#f3aa18]" : "text-neutral-400"
                )}>
                  {isStorePickup ? <Store className="w-3.5 h-3.5 text-[#f3aa18]" /> : <MapPin className="w-3.5 h-3.5 text-[#f3aa18]" />}
                  {isStorePickup ? 'Store Pickup Location' : 'Destination Address'}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isStorePickup && (
                    <button
                      type="button"
                      onClick={() => setIsEditAddressModalOpen(true)}
                      className="px-2 py-1 rounded-md text-[11px] font-sans font-medium text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      title="Edit customer shipping address"
                    >
                      <Edit2 className="w-3 h-3 text-[#f3aa18]" />
                      <span>Edit</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      toggleLocalStorePickupOrder(order.id);
                      setPickupOverrideVersion((v) => v + 1);
                      if (onOrderUpdated) onOrderUpdated();
                    }}
                    className={clsx(
                      "px-2 py-1 rounded-md text-[11px] font-sans font-medium transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap",
                      isStorePickup 
                        ? "text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10" 
                        : "text-neutral-400 hover:text-[#f3aa18] bg-white/[0.03] hover:bg-[#f3aa18]/10 border border-white/5 hover:border-[#f3aa18]/30"
                    )}
                    title="Toggle between store pickup and courier delivery view for this order"
                  >
                    {isStorePickup ? (
                      <>
                        <Truck className="w-3 h-3 text-[#f3aa18]" />
                        <span>Switch to Courier</span>
                      </>
                    ) : (
                      <>
                        <Store className="w-3 h-3 text-[#f3aa18]" />
                        <span>Store Pickup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              {isStorePickup ? (
                <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                  <strong className="text-white">Exacoat Store Summarecon Bekasi</strong><br />
                  Ruko Ruby Commercial TB12, Jl. Bulevar Selatan<br />
                  Summarecon Bekasi, Kota Bekasi 17142<br />
                  <span className="text-[11px] text-[#f3aa18]/90 font-medium block mt-0.5">Store Collection • Direct Handover</span>
                </p>
              ) : (
                <p className="text-xs text-neutral-300 font-sans leading-relaxed">
                  {formatCleanText(order.shipping?.address_1 || order.billing?.address_1 || 'No address provided')}
                  {order.shipping?.address_2 ? `, ${formatCleanText(order.shipping.address_2)}` : (order.billing?.address_2 ? `, ${formatCleanText(order.billing.address_2)}` : '')}<br />
                  {formatCleanText(order.shipping?.city || order.billing?.city || '')}, {formatCleanText(order.shipping?.state || order.billing?.state || '')} {order.shipping?.postcode || order.billing?.postcode || ''}<br />
                  <strong className="text-white">{resolveCountryName(order.shipping?.country || order.billing?.country)}</strong>
                </p>
              )}
            </div>
          </div>

          {(() => {
            const rawNote = String(order.customer_note || '');
            const cleanNote = decodeHtmlEntities(rawNote)
              .replace(/(?:shipping courier|jasa kirim|courier)\s*:\s*[^\r\n]+/gi, '')
              .trim();
            if (!cleanNote) return null;

            return (
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs">
                <span className="font-bold block mb-0.5">Customer Note:</span>
                "{cleanNote}"
              </div>
            );
          })()}
        </div>

        {/* Section 2: Ordered Precision Skins & Items */}
        {(() => {
          const displayItems = (order.items && order.items.length > 0)
            ? order.items
            : (order.line_items && order.line_items.length > 0 ? order.line_items : []);

          return (
            <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#f3aa18]" />
                    Items ({displayItems.length})
                  </h4>
                  <span className="text-[11px] font-mono text-neutral-400">
                    Total Units: {displayItems.reduce((acc, it) => acc + (it.quantity || 1), 0)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsEditItemModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30 text-xs font-sans font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  title="Add new precision skin or product to this order"
                >
                  <Plus className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-3">
                {displayItems.map((item, idx) => {
                  const itemDiscount = Number(item.discount || 0);
                  const itemTax = Number(item.tax || 0);
                  const itemSpecs = extractItemSpecs(item);

                  return (
                    <div 
                      key={item.id || idx}
                      className="p-4 rounded-xl border border-white/[0.04] bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Left: Thumbnail & Item Meta */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-16 rounded-lg overflow-hidden bg-black border border-white/[0.08] shrink-0 relative flex items-center justify-center">
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
                            {rmaDetails?.order_type === 'Redeem' && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-1 shadow-xs">
                                <RotateCcw className="w-3 h-3 text-amber-400" />
                                <span>Redeem Replacement (Free)</span>
                              </span>
                            )}
                            {rmaDetails?.order_type === 'Warranty' && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 shrink-0 flex items-center gap-1 shadow-xs">
                                <ShieldCheck className="w-3 h-3 text-sky-400" />
                                <span>Warranty Replacement</span>
                              </span>
                            )}
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
                            {item.sku && (
                              <span className="text-[10px] font-mono text-neutral-400">SKU: {item.sku}</span>
                            )}
                          </div>

                          {/* Item Customization Specs / Attributes */}
                          {itemSpecs.filter((sp) => !/^(image_url|image|composite_url|thumbnail_url)$/i.test(sp.label) && !/^https?:\/\//i.test(sp.value)).length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {itemSpecs
                                .filter((sp) => !/^(image_url|image|composite_url|thumbnail_url)$/i.test(sp.label) && !/^https?:\/\//i.test(sp.value))
                                .map((sp, sIdx) => (
                                  <span 
                                    key={sIdx}
                                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-neutral-300 border border-white/[0.08]"
                                  >
                                    <span className="text-neutral-400">{sp.label}: </span>
                                    <span className="text-white font-semibold">{sp.value}</span>
                                  </span>
                                ))}
                            </div>
                          )}

                      {/* Action Buttons: Edit Configuration & Quick Inspect */}
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsEditItemModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 text-[11px] font-sans font-semibold transition-all cursor-pointer shadow-xs"
                          title="Edit product, quantity, configuration layers, or form add-on specifications"
                        >
                          <Edit2 className="w-3 h-3 text-[#f3aa18]" />
                          <span>Edit Configuration</span>
                        </button>

                        {(item.name.toLowerCase().startsWith('custom order') || (item as any).is_custom) && item.image_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewCustomItem(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30 text-[11px] font-mono font-bold transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Custom Skin</span>
                          </button>
                        )}
                      </div>
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
      );
    })()}


        {/* Section 3: Courier Tracking & Fulfillment Dispatch Card (Omitted for Store Pickup) */}
        {!isStorePickup ? (
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#f3aa18]" />
                Shipping & Tracking
              </h4>
              <Tooltip 
                position="top"
                content="Domestic orders (SiCepat, JNE, POS, J&T) are verified with Biteship live tracking. Delivered status automatically moves the order to Completed."
              />
            </div>
            <div className="flex items-center gap-2">
              {order.tracking?.latest_status && (
                <span className={clsx(
                  "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                  order.tracking.latest_status === 'delivered'
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-[#f3aa18]/10 text-[#f3aa18] border-[#f3aa18]/30"
                )}>
                  {order.tracking.latest_status === 'delivered' ? '✓ Delivered' : order.tracking.latest_status.replace('_', ' ')}
                </span>
              )}
              {order.tracking?.tracking_number && !order.tracking.tracking_number.startsWith('field_') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsTrackOrderModalOpen(true);
                    if (!order.tracking?.checkpoints || order.tracking.checkpoints.length === 0) {
                      handleSyncTracking();
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 text-xs text-[#f3aa18] font-sans font-semibold flex items-center gap-1.5 border border-[#f3aa18]/30 transition-all cursor-pointer shadow-xs"
                  title="Track shipment timeline"
                >
                  <MapPin className="w-3 h-3 text-[#f3aa18]" />
                  <span>Track Order</span>
                </button>
              )}
              {order.tracking?.tracking_number && !order.tracking.tracking_number.startsWith('field_') && (
                <button
                  type="button"
                  disabled={isSyncingTracking}
                  onClick={handleSyncTracking}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-neutral-200 font-sans font-medium flex items-center gap-1.5 border border-white/[0.08] transition-all disabled:opacity-50"
                  title="Sync live status and checkpoints with carrier"
                >
                  <RefreshCw className={clsx("w-3 h-3", isSyncingTracking && "animate-spin text-[#f3aa18]")} />
                  <span>{isSyncingTracking ? 'Syncing...' : 'Sync Status'}</span>
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveTracking} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-sans">
                    Courier
                  </label>
                  {(() => {
                    const resolved = resolveOrderCourier(order);
                    if (resolved.serviceName || (resolved.rawMatch && resolved.courierId !== 'jne')) {
                      return (
                        <span className="text-[10px] font-mono text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {resolved.serviceName ? `Service: ${resolved.serviceName}` : resolved.rawMatch}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <Select value={courier} onValueChange={setCourier}>
                  <SelectTrigger className="w-full h-10 px-3.5 rounded-xl bg-zinc-50 dark:bg-[#141414] border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white">
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

          {/* Domestic Goorita Consolidation Shipment Banner */}
          {isConsolidationOrder && (() => {
            const consolidatedIds: number[] = (order.meta_data || []).find((m: any) => m.key === '_goorita_consolidated_orders')?.value || [];
            return (
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                      Domestic JNE Consolidation
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Ciracas, Jakarta Timur
                    </span>
                    {consolidatedIds.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        {consolidatedIds.length} USA {consolidatedIds.length === 1 ? 'Order' : 'Orders'}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-cyan-400">
                    Goorita HQ Hub
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-snug">
                  Master domestic parcel dispatched to Goorita freight forwarder hub (Jonathan Rio). Shipped via JNE Express.
                </p>
                {consolidatedIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-zinc-400 font-medium">Consolidated shipments:</span>
                    {consolidatedIds.map((cid: number) => (
                      <span key={cid} className="px-2 py-0.5 rounded bg-white/[0.06] text-white font-mono text-[10px] font-semibold border border-white/[0.08]">
                        #{cid}
                      </span>
                    ))}
                  </div>
                )}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsLabelModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#d9940c] text-zinc-950 text-xs font-bold font-sans flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print A6 JNE Thermal Label</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Goorita US Shipment Quick Actions (US Orders & Goorita Courier) */}
          {isUsOrder && (() => {
            const gooritaOrderId = order.goorita_order_id || (courier === 'goorita' ? trackingNumber : null) || (order.meta_data || []).find((m: any) => m.key === '_goorita_order_id')?.value;
            const gooritaAwbUrl = order.goorita_awb_url || (order.meta_data || []).find((m: any) => m.key === '_goorita_awb_url' || m.key === 'goorita_awb_url')?.value;
            const gooritaService = order.goorita_service || 'Saver (USPS)';
            const isBooked = Boolean(gooritaOrderId || (courier === 'goorita' && trackingNumber));

            return (
              <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                      Goorita US Shipment
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {order.shipping?.state ? `${order.shipping.state}, USA` : 'US Destination'}
                    </span>
                    {isBooked && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        {gooritaService}
                      </span>
                    )}
                  </div>
                  {gooritaOrderId && (
                    <span className="text-[11px] font-mono font-bold text-sky-400">
                      #{gooritaOrderId}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsGooritaBookingModalOpen(true)}
                    className={clsx(
                      "px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 shadow-sm transition-all cursor-pointer",
                      isBooked
                        ? "bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.1]"
                        : "bg-sky-500 hover:bg-sky-400 text-zinc-950"
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isBooked
                        ? 'Re-generate Goorita AWB'
                        : 'Book Goorita Production AWB'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLabelModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#d9940c] text-zinc-950 text-xs font-bold font-sans flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isBooked ? 'Print 2-Page A6 Label' : 'Print A6 Thermal Label'}</span>
                  </button>

                  {gooritaAwbUrl && (
                    <button
                      type="button"
                      onClick={() => downloadGooritaAwbPdf(gooritaAwbUrl)}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-bold font-sans flex items-center gap-1.5 border border-white/[0.1] transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                      <span>View Official AWB PDF</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {isRayspeedOrder && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                    Rayspeed Asia
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                    SEA Dispatch ({destCountry || 'International'})
                  </span>
                </div>
                {order.tracking?.tracking_number && (
                  <span className="text-[11px] font-mono font-bold text-amber-400">
                    {order.tracking.tracking_number}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(!order.tracking?.tracking_number || courier === 'rayspeed') && (
                  <button
                    type="button"
                    onClick={handleBookRayspeed}
                    disabled={isBookingRayspeed}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-bold font-sans flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Send className={clsx("w-3.5 h-3.5", isBookingRayspeed && "animate-spin")} />
                    <span>{isBookingRayspeed ? 'Booking AWB...' : order.tracking?.tracking_number ? 'Re-generate AWB' : 'Dispatch via Rayspeed'}</span>
                  </button>
                )}
                {order.tracking?.tracking_number && (
                  <a
                    href={getPublicTrackingUrl('rayspeed', order.tracking.tracking_number)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-bold font-sans flex items-center gap-1.5 border border-white/[0.1] transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>Track on Rayspeed</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Live Tracking Timeline & Checkpoints */}
          {order.tracking?.checkpoints && order.tracking.checkpoints.length > 0 && (
            <div className="pt-3 border-t border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-sans">
                  Carrier Checkpoints ({order.tracking.checkpoints.length})
                </span>
                {order.tracking.checkpoints.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCheckpoints(!showAllCheckpoints)}
                    className="text-[11px] text-[#f3aa18] hover:underline font-sans flex items-center gap-1"
                  >
                    {showAllCheckpoints ? (
                      <>Hide history <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>View all checkpoints <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>

              {/* Latest Checkpoint Highlight Card */}
              {order.tracking.checkpoints[0] && (
                <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.06] space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white font-sans flex items-center gap-1.5">
                      <span className={clsx(
                        "size-2 rounded-full shrink-0",
                        order.tracking.latest_status === 'delivered' ? "bg-emerald-400" : "bg-[#f3aa18]"
                      )} />
                      <span className="line-clamp-1">{order.tracking.checkpoints[0].description}</span>
                    </span>
                    {order.tracking.checkpoints[0].stage && (
                      <span className="text-[9px] font-mono text-neutral-400 uppercase bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0 ml-2">
                        {order.tracking.checkpoints[0].stage.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-neutral-400 font-mono pt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      {order.tracking.checkpoints[0].time}
                    </span>
                    {order.tracking.checkpoints[0].location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-neutral-500" />
                        {order.tracking.checkpoints[0].location}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded Checkpoint History */}
              {showAllCheckpoints && order.tracking.checkpoints.length > 1 && (
                <div className="space-y-1.5 pt-1 max-h-60 overflow-y-auto pr-1">
                  {order.tracking.checkpoints.slice(1).map((cp, idx) => (
                    <div 
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#0e0e0e] border border-white/[0.04] text-xs font-sans space-y-1"
                    >
                      <p className="text-neutral-300 font-medium">{cp.description}</p>
                      <div className="flex items-center gap-3 text-[10px] text-neutral-500 font-mono">
                        <span>{cp.time}</span>
                        {cp.location && <span>• {cp.location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        ) : (
          <div className="p-4 rounded-2xl border border-[#f3aa18]/25 bg-[#f3aa18]/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-[#f3aa18]" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Summarecon Bekasi Store Pickup</span>
                <span className="text-[11px] text-neutral-400">Direct store handover at Ruko Ruby Commercial TB12. Courier dispatch and shipping tracking are not applicable.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLabelModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#f3aa18] hover:bg-[#d9940c] text-[#0a0a0a] text-xs font-bold font-sans flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Workshop Label</span>
            </button>
          </div>
        )}

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
                    setMarkAsRefunded(false);
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

            {/* Fees & Adjustments */}
            {order.fees && order.fees.length > 0 ? (
              order.fees.map((f) => {
                const label = formatFeeLabel(f.name, order);
                const isNegative = f.total < 0;
                return (
                  <div key={f.id} className="flex items-center justify-between text-neutral-400">
                    <span className={isNegative ? 'text-amber-400' : ''}>{label}</span>
                    <span className={clsx('font-mono', isNegative ? 'text-amber-400' : 'text-white')}>
                      {isNegative ? '-' : '+'}{formatCurrency(Math.abs(f.total), order.currency)}
                    </span>
                  </div>
                );
              })
            ) : order.fee_total !== undefined && order.fee_total !== 0 ? (
              <div className="flex items-center justify-between text-neutral-400">
                <span className={order.fee_total < 0 ? 'text-amber-400' : ''}>
                  {order.fee_total < 0 ? 'Discount' : 'Adjustment'}
                </span>
                <span className={clsx('font-mono', order.fee_total < 0 ? 'text-amber-400' : 'text-white')}>
                  {order.fee_total < 0 ? '-' : '+'}{formatCurrency(Math.abs(order.fee_total), order.currency)}
                </span>
              </div>
            ) : null}

            {/* Shipping & Shipping Discount Breakdown */}
            {shippingDiscount > 0 ? (
              <>
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span>Shipping ({order.shipping_method_name || 'Standard Delivery'})</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[9px] uppercase font-bold">
                      PROMO
                    </span>
                  </span>
                  <span className="font-mono text-white">{formatCurrency(originalShippingRate, order.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400">
                  <span>
                    Shipping Discount {shippingPromoCode ? `(${shippingPromoCode.toUpperCase()})` : ''}
                  </span>
                  <span className="font-mono font-medium">
                    -{formatCurrency(shippingDiscount, order.currency)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between text-neutral-400">
                <span>Shipping ({order.shipping_method_name || 'Standard Delivery'})</span>
                <span className="font-mono text-white">{formatCurrency(order.shipping_total || 0, order.currency)}</span>
              </div>
            )}

            {/* Tax */}
            {Number(order.total_tax) > 0 && (
              <div className="flex items-center justify-between text-neutral-400">
                <span>Tax</span>
                <span className="font-mono text-white">{formatCurrency(order.total_tax, order.currency)}</span>
              </div>
            )}

            {/* Kode Unik BCA */}
            {(() => {
              const bcaCode = order.meta_data?.find(m => m.key === '_bca_unique_code')?.value;
              if (!bcaCode) return null;
              return (
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="text-amber-400 text-xs flex items-center gap-1">
                    Unique Payment Code
                  </span>
                  <span className="font-mono text-amber-400 font-semibold">
                    +{formatCurrency(Number(bcaCode), order.currency)}
                  </span>
                </div>
              );
            })()}

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
                {order.date_paid
                  ? `${formatCurrency(order.total, order.currency)} paid on ${formatDate(order.date_paid)}`
                  : ['processing', 'completed', 'in-production', 'ready-to-ship', 'shipped'].includes(currentStatusClean)
                  ? `Confirmed (${order.payment_method_title || order.payment_method || 'Online Payment'})`
                  : 'Pending'}
              </span>
            </div>

            {/* Midtrans Transaction Detail */}
            {(() => {
              const midtransId = orderMetaList.find(m => m.key === '_midtrans_transaction_id')?.value;
              if (!midtransId) return null;
              return (
                <div className="text-[10px] text-neutral-400 font-mono bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04] mt-1.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-sans font-semibold">Midtrans Transaction:</span>
                    <span className="text-white uppercase font-bold text-[9px] px-1.5 py-0.5 rounded bg-white/10 font-mono">
                      {String(order.payment_method_title || order.payment_method || 'Online Payment')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-300">
                    <span className="text-neutral-500 font-sans">Transaction ID:</span>
                    <span className="text-neutral-300 truncate max-w-[220px]">{String(midtransId)}</span>
                  </div>
                </div>
              );
            })()}

            {/* BCA Mutation Detail */}
            {(() => {
              const bcaMutation = order.meta_data?.find(m => m.key === '_bca_mutation_desc')?.value;
              if (!bcaMutation) return null;
              return (
                <div className="text-[10px] text-neutral-400 font-mono bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04] mt-1.5 break-all">
                  <span className="text-emerald-400 font-sans font-semibold block mb-0.5">BCA Webhook Mutation:</span>
                  {String(bcaMutation)}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Section 4.5: Applied Coupons & Adjustments (Placed below Order Summary) */}
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
              <div className="space-y-2">
                <span className="text-[11px] text-neutral-400 font-sans block">Coupons applied:</span>
                <div className="space-y-1.5">
                  {order.coupon_codes.map(code => {
                    const isShippingCoupon =
                      (shippingPromoCode && String(shippingPromoCode).toLowerCase() === code.toLowerCase()) ||
                      code.toLowerCase().includes('ongkir') ||
                      Boolean(shippingDiscount > 0 && order.coupon_codes?.length === 1);
                    return (
                      <div key={code} className="flex items-center justify-between text-xs font-sans">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono font-bold">
                          <Tag className="w-3 h-3" />
                          {code}
                          {isShippingCoupon && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 uppercase font-sans font-normal ml-0.5">
                              Shipping Promo
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {isShippingCoupon && shippingDiscount > 0
                            ? `-${formatCurrency(shippingDiscount, order.currency)}`
                            : Number(order.discount_total || 0) > 0
                            ? `-${formatCurrency(order.discount_total, order.currency)}`
                            : 'Applied'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fees Breakdown */}
            {order.fees && order.fees.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {order.fees.map(f => {
                  const label = formatFeeLabel(f.name, order);
                  const isNegative = f.total < 0;
                  return (
                    <div key={f.id} className="flex items-center justify-between text-xs font-sans text-neutral-300">
                      <span className={isNegative ? 'text-amber-400 font-medium' : ''}>{label}</span>
                      <div className="text-right font-mono">
                        <span className={clsx(isNegative ? 'text-amber-400 font-semibold' : 'text-white')}>
                          {isNegative ? '-' : '+'}{formatCurrency(Math.abs(f.total), order.currency)}
                        </span>
                        {f.tax !== 0 && (
                          <span className="text-[10px] text-neutral-500 block">
                            DDP: {formatCurrency(f.tax, order.currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
                  <p className="leading-relaxed whitespace-pre-wrap">{renderNoteHtml(note.content)}</p>
                  
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

        {/* Section 5.5: Resend Transactional Email */}
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#111111] space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#f3aa18]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-sans">
                Resend Transactional Email
              </h4>
            </div>
            {order.meta_data?.some(m => m.key === '_artmatter_confirmation_email_sent' && m.value === 'yes') && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Confirmation Sent</span>
              </span>
            )}
          </div>

          <div className="space-y-3 font-sans text-xs">
            {/* Recipient Address Row */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#141414] border border-white/[0.04]">
              <div className="space-y-0.5 flex-1 min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">Recipient Address</span>
                {isEditingRecipientEmail ? (
                  <input
                    type="email"
                    value={resendRecipientEmail}
                    onChange={e => setResendRecipientEmail(e.target.value)}
                    placeholder="customer@domain.com"
                    className="w-full px-2.5 py-1 text-xs font-mono bg-neutral-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#f3aa18]"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-white font-medium truncate">
                      {resendRecipientEmail || order.customer_email || order.billing?.email || 'No email provided'}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEditingRecipientEmail(!isEditingRecipientEmail)}
                className="text-[11px] text-[#f3aa18] hover:text-[#e09a10] font-medium transition-colors shrink-0 cursor-pointer"
              >
                {isEditingRecipientEmail ? 'Done' : 'Change'}
              </button>
            </div>

            {/* Template Selector & Dispatch Action */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <select
                  value={selectedEmailTemplate}
                  onChange={e => setSelectedEmailTemplate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#141414] border border-white/[0.08] text-xs font-sans text-neutral-200 focus:outline-none focus:border-[#f3aa18] transition-colors"
                >
                  <option value="customer_order_processing">Order Confirmation (Processing)</option>
                  <option value="customer_order_invoice">Order Invoice / Summary</option>
                  <option value="customer_order_in_production">In Production Update</option>
                  <option value="customer_order_awaiting_pickup">Ready for Courier Pickup</option>
                  <option value="customer_order_shipped">Shipped &amp; Tracking Code</option>
                  <option value="customer_order_on_hold">Order On Hold (Awaiting Payment)</option>
                  <option value="customer_order_delivered">Order Delivered</option>
                  {isStorePickup && (
                    <option value="customer_order_store_pickup_ready">Store Pickup Ready (Bekasi)</option>
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={handleResendEmail}
                disabled={isSendingOrderEmail || !(resendRecipientEmail || order.customer_email || order.billing?.email)}
                className="h-10 px-4 rounded-xl bg-[#f3aa18] hover:bg-[#e09a10] disabled:opacity-50 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
              >
                {isSendingOrderEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Resend Email</span>
                  </>
                )}
              </button>
            </div>

            {lastEmailSentResult && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{lastEmailSentResult.message}</span>
                </div>
                <span className="text-emerald-400 font-bold">{lastEmailSentResult.latency_ms}ms</span>
              </div>
            )}

            <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Inspect ZeptoMail delivery telemetry:</span>
              <a
                href="#emails?tab=logs"
                onClick={onClose}
                className="text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Delivery Logs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
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

        {/* Section 7: Administrator Actions (Cancel / Move to Trash) */}
        {isAdmin && (
          <div className="pt-2 border-t border-white/[0.08]">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono">Administrator Actions</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Administrative controls to cancel this order or move it to trash. Moving to trash removes it from active fulfillment.
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Cancel Order */}
                <button
                  type="button"
                  disabled={isCancellingOrder || isTrashingOrder || currentStatusClean === 'cancelled'}
                  onClick={() => setShowCancelModal(true)}
                  className={clsx(
                    "px-3.5 py-2.5 rounded-xl border text-xs font-semibold font-sans flex items-center justify-center gap-2 transition-all cursor-pointer",
                    currentStatusClean === 'cancelled'
                      ? "bg-neutral-900/60 border-white/[0.06] text-neutral-500 cursor-not-allowed"
                      : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/25 active:scale-95"
                  )}
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>{currentStatusClean === 'cancelled' ? 'Order Cancelled' : isCancellingOrder ? 'Cancelling...' : 'Cancel Order'}</span>
                </button>

                {/* Move to Trash */}
                <button
                  type="button"
                  disabled={isCancellingOrder || isTrashingOrder}
                  onClick={() => setShowTrashModal(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-neutral-900/80 hover:bg-rose-950/40 text-neutral-300 hover:text-rose-200 border border-white/[0.08] hover:border-rose-500/30 text-xs font-semibold font-sans flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4 text-neutral-400 hover:text-rose-400" />
                  <span>{isTrashingOrder ? 'Trashing...' : 'Move to Trash'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Refund Modal Overlay */}
      {isRefundModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn cursor-pointer"
          onClick={() => setIsRefundModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#111111] border border-white/[0.1] rounded-2xl p-6 shadow-2xl space-y-5 cursor-default"
            onClick={e => e.stopPropagation()}
          >
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

              {/* Order Status Update Control */}
              <div className="pt-0.5">
                {Number(refundAmount) >= remainingAvailableRefund && remainingAvailableRefund > 0 ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-medium text-rose-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Order status will update to Refunded</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-sans">Full refund will automatically mark this order as refunded</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 uppercase tracking-wider font-mono">
                      Automatic
                    </span>
                  </div>
                ) : (
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#141414] border border-white/[0.06] hover:border-white/10 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={markAsRefunded}
                      onChange={e => setMarkAsRefunded(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-black/40 text-rose-500 focus:ring-0"
                    />
                    <div className="space-y-0.5 flex-1">
                      <div className="text-xs font-medium text-white flex items-center justify-between font-sans">
                        <span>Update status to Refunded</span>
                        <span className="text-[10px] font-normal text-neutral-400">
                          Current: <span className="capitalize text-neutral-200">{order.status.replace(/[-_]/g, ' ')}</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-sans">
                        Mark order settled as refunded, or keep current status for ongoing fulfillment
                      </p>
                    </div>
                  </label>
                )}
              </div>

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


      {/* 48-Hour Installation Warranty Review Modal */}
      {order && (
        <WarrantyReviewModal
          orderId={order.id}
          isOpen={isWarrantyReviewModalOpen}
          onClose={() => setIsWarrantyReviewModalOpen(false)}
          onClaimReviewed={() => {
            onOrderUpdated?.();
          }}
          onSelectParentOrder={onSelectOrderById}
        />
      )}

      {/* Manual Warranty Claim Modal */}
      {order && (
        <ManualWarrantyModal
          isOpen={isManualWarrantyModalOpen}
          onClose={() => setIsManualWarrantyModalOpen(false)}
          existingOrder={order}
          initialClaimType={manualClaimType}
          onSuccess={(newOrderId) => {
            onOrderUpdated?.();
            if (newOrderId && onSelectOrderById) {
              onSelectOrderById(newOrderId);
            }
          }}
        />
      )}

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

      {/* 30-Day Guarantee Rejection Modal */}
      {isGuaranteeRejectModalOpen && (
        <Modal
          isOpen={isGuaranteeRejectModalOpen}
          onClose={() => setIsGuaranteeRejectModalOpen(false)}
          title="Reject 30-Day Guarantee Return"
        >
          <div className="space-y-4 font-sans">
            <p className="text-xs text-neutral-300">
              Provide a reason for rejecting the guarantee claim for Order #{cleanOrderNum}. This note will be recorded on the order timeline.
            </p>
            <textarea
              value={guaranteeRejectReason}
              onChange={(e) => setGuaranteeRejectReason(e.target.value)}
              placeholder="e.g. Missing original retail packaging or merchandise was damaged during customer application..."
              rows={3}
              className="w-full rounded-xl bg-neutral-900 border border-white/10 p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500/50"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsGuaranteeRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingGuaranteeAction}
                onClick={() => handleGuaranteeAction('reject', guaranteeRejectReason)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
              >
                {isProcessingGuaranteeAction ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manual Completed Override Confirmation Modal */}
      <ConfirmationModal
        isOpen={showManualCompletedModal}
        onClose={() => setShowManualCompletedModal(false)}
        onConfirm={() => {
          setShowManualCompletedModal(false);
          handleStatusChange('completed');
        }}
        title="Manual Override: Mark Order as Completed"
        description="Courier delivery status is normally updated automatically once the courier confirms delivery via tracking webhooks. Are you sure you want to manually mark this order as Completed?"
        confirmText="Override to Completed"
        cancelText="Cancel"
        variant="warning"
      />

      {/* Administrator Cancel Order Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelOrder}
        title={`Cancel Order #${cleanOrderNum}`}
        description="Are you sure you want to cancel this order? This will mark the order status as cancelled in WooCommerce and record an administrative audit note."
        confirmText="Cancel Order"
        cancelText="Keep Order"
        variant="warning"
        isLoading={isCancellingOrder}
      />

      {/* Administrator Move to Trash Confirmation Modal */}
      <ConfirmationModal
        isOpen={showTrashModal}
        onClose={() => setShowTrashModal(false)}
        onConfirm={handleTrashOrder}
        title={`Move Order #${cleanOrderNum} to Trash`}
        description="Are you sure you want to move this order to trash? It will be removed from active order queues and moved to the WooCommerce trash."
        confirmText="Move to Trash"
        cancelText="Cancel"
        variant="danger"
        isLoading={isTrashingOrder}
      />

      {/* Internal A6 Thermal Label Modal */}
      <ShippingLabelA6Modal
        order={order}
        orders={order ? [order] : []}
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        onPrinted={(orderIds) => {
          setIsPrinted(true);
          if (onOrderUpdated) onOrderUpdated();
          const cleanStatus = String(order?.status || '').replace(/^wc-/, '').toLowerCase().trim();
          if (cleanStatus === 'processing' || cleanStatus === 'confirmed') {
            setIsLabelModalOpen(false);
            setShowPreparingPromptModal(true);
          }
        }}
      />

      {/* Post-Print Advance to Preparing Order Confirmation Modal */}
      {order && (
        <Modal
          isOpen={showPreparingPromptModal}
          onClose={() => setShowPreparingPromptModal(false)}
          maxWidth="md"
          title={
            <div className="flex items-center gap-2 text-white font-sans">
              <Layers className="w-5 h-5 text-[#f3aa18]" />
              <span className="text-base font-bold">Mark order as "Preparing order"?</span>
            </div>
          }
          subtitle="Shipping label has been sent to print. Advance order status to begin fulfillment."
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full font-sans">
              <button
                type="button"
                disabled={isMarkingPreparingFromDrawer}
                onClick={() => setShowPreparingPromptModal(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                Keep as Confirmed
              </button>
              <button
                type="button"
                disabled={isMarkingPreparingFromDrawer}
                onClick={async () => {
                  setIsMarkingPreparingFromDrawer(true);
                  await handleStatusChange('preparing-order');
                  setIsMarkingPreparingFromDrawer(false);
                  setShowPreparingPromptModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs active:scale-95"
              >
                {isMarkingPreparingFromDrawer && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isMarkingPreparingFromDrawer ? 'Updating...' : 'Mark as Preparing order'}</span>
              </button>
            </div>
          }
        >
          <div className="space-y-3 font-sans text-xs">
            <p className="text-zinc-400">
              Do you want to update order{' '}
              <strong className="text-white font-mono">
                #{String(order.order_number || order.id).replace(/^#+/, '')}
              </strong>{' '}
              from <span className="text-emerald-400 font-semibold">Confirmed</span> to{' '}
              <span className="text-cyan-400 font-semibold">Preparing order</span>?
            </p>
          </div>
        </Modal>
      )}

      {/* Post-Tracking Manual Entry Advance to Shipped Confirmation Modal */}
      {order && (
        <Modal
          isOpen={showShippedPromptModal}
          onClose={() => {
            if (!isFulfilling) setShowShippedPromptModal(false);
          }}
          maxWidth="md"
          title={
            <div className="flex items-center gap-2 text-white font-sans">
              <Truck className="w-5 h-5 text-[#f3aa18]" />
              <span className="text-base font-bold">Mark order as "Shipped"?</span>
            </div>
          }
          subtitle="Tracking number has been entered. Advance order status to begin delivery?"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full font-sans">
              <button
                type="button"
                disabled={isFulfilling}
                onClick={() => executeSaveTracking('none')}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                Keep as {getOrderStatusInfo(order.status).label}
              </button>
              <button
                type="button"
                disabled={isFulfilling}
                onClick={() => executeSaveTracking('shipped')}
                className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-xs active:scale-95"
              >
                {isFulfilling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isFulfilling ? 'Updating...' : 'Mark as Shipped'}</span>
              </button>
            </div>
          }
        >
          <div className="space-y-3 font-sans text-xs">
            <p className="text-zinc-400">
              Do you want to update order{' '}
              <strong className="text-white font-mono">
                #{String(order.order_number || order.id).replace(/^#+/, '')}
              </strong>{' '}
              from{' '}
              <span className={clsx("font-semibold", getOrderStatusInfo(order.status).color)}>
                {getOrderStatusInfo(order.status).label}
              </span>{' '}
              to <span className="text-indigo-400 font-semibold">Shipped</span>?
            </p>
            <div className="p-3 rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400 font-sans">
                {courier === 'custom' ? (customCourierName.trim() || 'Custom Courier') : (COURIER_PRESETS.find(p => p.value === courier)?.label || courier)}
              </span>
              <span className="font-bold text-white tracking-wider">{trackingNumber.trim()}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Official Customer Tax Invoice Modal */}
      <CustomerInvoiceModal
        order={order}
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onPrinted={() => {
          if (onOrderUpdated) onOrderUpdated();
        }}
      />

      {/* Official Warehouse Packing Slip & Dispatch Manifest Modal */}
      <PackingSlipModal
        order={order}
        isOpen={isPackingSlipModalOpen}
        onClose={() => setIsPackingSlipModalOpen(false)}
        onPrinted={() => {
          if (onOrderUpdated) onOrderUpdated();
        }}
      />

      {/* Shipment Tracking Timeline Popup Modal */}
      {order && (
        <Modal
          isOpen={isTrackOrderModalOpen}
          onClose={() => setIsTrackOrderModalOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#f3aa18]" />
              <span>Shipment Tracking • Order #{String(order.order_number || order.id).replace(/^#+/, '')}</span>
            </div>
          }
          subtitle="Real-time carrier checkpoints and delivery timeline"
          maxWidth="lg"
          headerActions={
            <button
              type="button"
              disabled={isSyncingTracking}
              onClick={handleSyncTracking}
              className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs text-neutral-300 hover:text-white flex items-center gap-1.5 border border-white/[0.08] transition-colors disabled:opacity-50 cursor-pointer"
              title="Sync latest live tracking"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", isSyncingTracking && "animate-spin text-[#f3aa18]")} />
              <span>{isSyncingTracking ? 'Syncing...' : 'Refresh'}</span>
            </button>
          }
        >
          <div className="space-y-4">
            {/* Courier & Tracking Resi Summary Card */}
            <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">Courier</span>
                  <span className="text-xs font-semibold text-white uppercase">
                    {(() => {
                      const courierDisplay = getOrderCourierDisplay(order);
                      if (courierDisplay && courierDisplay !== 'Courier') {
                        return courierDisplay;
                      }
                      return COURIER_PRESETS.find((p) => p.value === courier)?.label || order.tracking?.courier || courier;
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-mono font-bold text-[#f3aa18]">
                    {order.tracking?.tracking_number}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (order.tracking?.tracking_number) {
                        navigator.clipboard.writeText(order.tracking.tracking_number);
                        setCopiedField('modal_resi');
                        showToast('success', 'Copied', 'Tracking number copied to clipboard');
                        setTimeout(() => setCopiedField(null), 2000);
                      }
                    }}
                    className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy tracking number"
                  >
                    {copiedField === 'modal_resi' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {order.tracking?.latest_status && (
                  <span className={clsx(
                    "text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider",
                    order.tracking.latest_status === 'delivered'
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-[#f3aa18]/10 text-[#f3aa18] border-[#f3aa18]/30"
                  )}>
                    {order.tracking.latest_status === 'delivered' ? '✓ Delivered' : order.tracking.latest_status.replace('_', ' ')}
                  </span>
                )}
                {order.tracking?.tracking_number && (
                  <a
                    href={getPublicTrackingUrl(
                      order.tracking.courier || courier,
                      order.tracking.tracking_number,
                      order.tracking.tracking_url
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-neutral-200 font-sans flex items-center gap-1.5 border border-white/[0.1] transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Carrier Portal</span>
                  </a>
                )}
              </div>
            </div>

            {/* Delivered Banner if Delivered */}
            {order.tracking?.latest_status === 'delivered' && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Package Delivered</span>
                  <p className="text-[11px] text-emerald-400/90 mt-0.5 leading-relaxed">
                    The package was confirmed delivered by the carrier. The 48-hour Installation Warranty claim window is active from this delivery date.
                  </p>
                </div>
              </div>
            )}

            {/* Checkpoints Timeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 font-sans">
                  <Clock className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Tracking Timeline ({order.tracking?.checkpoints?.length || 0} checkpoints)</span>
                </h5>
              </div>

              {isSyncingTracking && (!order.tracking?.checkpoints || order.tracking.checkpoints.length === 0) ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-neutral-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#f3aa18]" />
                  <span>Pulling live checkpoints from courier...</span>
                </div>
              ) : !order.tracking?.checkpoints || order.tracking.checkpoints.length === 0 ? (
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-white/5 text-center text-xs text-neutral-400">
                  <p>No tracking checkpoints recorded yet.</p>
                  <p className="text-[11px] text-neutral-500 mt-1">Click the Refresh button to pull live tracking from courier.</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/10 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {order.tracking.checkpoints.map((cp, idx) => {
                    const isDeliveredCp = cp.stage === 'delivered' || cp.description.toLowerCase().includes('delivered') || cp.description.toLowerCase().includes('diterima');
                    const isLatest = idx === 0;

                    return (
                      <div key={idx} className="relative pl-5 border-l border-white/10 pb-3 last:pb-0">
                        <span
                          className={clsx(
                            'absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-neutral-950',
                            isDeliveredCp
                              ? 'bg-emerald-400'
                              : isLatest
                              ? 'bg-[#f3aa18]'
                              : 'bg-neutral-600'
                          )}
                        />
                        <div className="text-xs space-y-0.5">
                          <p className={clsx('leading-snug', isLatest ? 'text-white font-semibold' : 'text-neutral-300')}>
                            {cp.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400 font-mono">
                            <span>{cp.time}</span>
                            {cp.location && (
                              <span>• {cp.location}</span>
                            )}
                            {cp.stage && (
                              <span className="px-1.5 py-0.2 rounded bg-white/5 text-neutral-400 border border-white/5 uppercase text-[9px]">
                                {cp.stage}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsTrackOrderModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Address & Recipient Details Modal */}
      {order && isEditAddressModalOpen && (
        <EditOrderAddressModal
          order={order}
          isOpen={isEditAddressModalOpen}
          onClose={() => setIsEditAddressModalOpen(false)}
          onSaved={handleOrderMutated}
        />
      )}

      {/* Edit Item & Custom Configuration Modal */}
      {order && isEditItemModalOpen && (
        <EditOrderItemModal
          order={order}
          item={editingItem}
          isOpen={isEditItemModalOpen}
          onClose={() => {
            setIsEditItemModalOpen(false);
            setEditingItem(null);
          }}
          onSaved={handleOrderMutated}
          onDeleted={(delId) => {
            const currentItems = (order.items || order.line_items || []);
            const filtered = currentItems.filter((i) => i.id !== delId);
            handleOrderMutated({
              ...order,
              items: filtered,
              line_items: filtered,
              item_count: filtered.reduce((acc, it) => acc + (it.quantity || 1), 0),
            });
          }}
        />
      )}

      {/* WhatsApp Contact Customer Modal */}
      {order && isWhatsAppModalOpen && (
        <WhatsAppContactModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          phone={order.customer_phone}
          customerName={order.customer_name || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim()}
          orderNumber={order.order_number || order.id}
          trackingNumber={order.tracking?.tracking_number}
        />
      )}

      {/* Goorita Production Booking Preview & Confirmation Modal */}
      {order && isGooritaBookingModalOpen && (
        <GooritaBookingModal
          order={order}
          isOpen={isGooritaBookingModalOpen}
          onClose={() => setIsGooritaBookingModalOpen(false)}
          onSuccess={(res) => {
            const trackingCode = res.order_id || res.tracking_number || '';
            setTrackingNumber(trackingCode);
            setCourier('goorita');
            if (order) {
              order.goorita_order_id = res.order_id;
              order.goorita_awb_url = res.awb_url;
              order.goorita_service = res.service;
              if (!order.tracking) {
                order.tracking = {
                  carrier_id: 'goorita',
                  courier: 'Goorita Send USA',
                  tracking_number: trackingCode,
                  tracking_url: '',
                  latest_status: 'processing',
                };
              } else {
                order.tracking.tracking_number = trackingCode;
                order.tracking.carrier_id = 'goorita';
              }
            }
            if (onOrderUpdated) onOrderUpdated();
            loadNotes(order.id);
          }}
        />
      )}
    </SlideDrawer>
  );
};
