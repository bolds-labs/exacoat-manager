import React, { useState, useEffect, useRef } from 'react';
import { Drawer, type MenuItem } from '../ds';
import { PanelHeader, ClaimBanner, ClaimStatusPill } from './panel/PanelHeader';
import { StatusNavigator } from './panel/StatusNavigator';
import { CustomerDeliveryCard, type EndorsementInfo } from './panel/CustomerDeliveryCard';
import { ItemsCard, type LinkedClaim } from './panel/ItemsCard';
import { ShippingCard, type GooritaUsInfo } from './panel/ShippingCard';
import { ActivityCard } from './panel/ActivityCard';
import { SummaryCard } from './panel/SummaryCard';
import { RefundCard } from './panel/RefundCard';
import { RefundModal } from './panel/RefundModal';
import { ConfirmModal, ConfirmText, textareaClass } from './panel/ConfirmModal';
import { Modal as KitModal } from '../ds/Modal';
import { Button as KitButton } from '../ds/Button';
import { CouponsCard } from './panel/CouponsCard';
import { ReviewCard } from './panel/ReviewCard';
import { ResendEmailCard } from './panel/ResendEmailCard';
import { AdminActionsCard } from './panel/AdminActionsCard';
import { lockBodyScroll } from '../../lib/bodyScrollLock';
import { Badge } from '../ui/Badge';
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
  ShieldAlert,
  Plus,
  RotateCcw,
  HelpCircle,
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
  Megaphone,
  Edit2,
  Trash2,
  XCircle,
  Loader2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { extractItemSpecs } from '../../lib/orderItems';
import { isStorePickupOrder, toggleLocalStorePickupOrder, resolveOrderCourier, getOrderCourierDisplay, cleanCourierDisplay, formatOrderNumber, cleanOrderNumber, normalizeCourierSlug, detectCourierFromTrackingNumber } from '../../lib/orderUtils';
import { resolveCountryName } from '../../lib/countries';
import { getWpBaseUrl } from '../../lib/wordpressBridge';
import { GooritaBookingModal } from './GooritaBookingModal';
import { downloadGooritaAwbPdf } from '../../lib/gooritaService';
import { 
  updateOrderDirect,
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
  { label: 'J&T Express', value: 'jnt' },
  { label: 'Lion Parcel', value: 'lion' },
  { label: 'SPX Express', value: 'spx' },
  { label: 'Anteraja', value: 'anteraja' },
  { label: 'Ninja Xpress', value: 'ninja' },
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

const getExacoatTrackingUrl = (order: Order): string => {
  const cleanId = String(order.order_number || order.id || '').replace(/^#/, '').trim();
  const email = order.customer_email || (order as any).billing?.email || (order as any).customer?.email || '';
  const key = (order as any).order_key || (order as any).key || '';
  const params = new URLSearchParams();
  if (cleanId) params.set('order_id', cleanId);
  if (email) params.set('order_email', email);
  if (key) params.set('key', key);
  return `https://exacoat.com/track?${params.toString()}`;
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
  const [storePickupOverride, setStorePickupOverride] = useState<boolean | null>(null);
  const [isSwitchingFulfillment, setIsSwitchingFulfillment] = useState(false);

  useEffect(() => {
    setInternalOrder(propOrder);
    setStorePickupOverride(null);
  }, [propOrder]);

  const order = internalOrder || propOrder;

  // Edit Address & Item Modals state
  const [isEditAddressModalOpen, setIsEditAddressModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);

  const handleOrderMutated = (updatedOrder: Order) => {
    setInternalOrder(updatedOrder);
    setStorePickupOverride(isStorePickupOrder(updatedOrder));
    setPickupOverrideVersion((v) => v + 1);
    if (onOrderUpdated) onOrderUpdated();
  };
  
  // Tracking form state & edit guards
  const lastLoadedOrderIdRef = useRef<number | null>(null);
  const isFormDirtyRef = useRef(false);
  const [courier, setCourier] = useState('jne');
  const [jneService, setJneService] = useState('REG');
  const hasJneServiceEdit = useRef(false);
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
  const [reviewTargetOrderId, setReviewTargetOrderId] = useState<number | null>(null);
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

  // Reset tracking form edit guards when drawer closes
  useEffect(() => {
    if (!isOpen) {
      lastLoadedOrderIdRef.current = null;
      hasJneServiceEdit.current = false;
      isFormDirtyRef.current = false;
    }
  }, [isOpen]);

  const handleCourierChange = (newCourier: string) => {
    isFormDirtyRef.current = true;
    setCourier(newCourier);
    if (newCourier !== 'custom' && order && isStorePickupOrder(order)) {
      setStorePickupOverride(false);
      toggleLocalStorePickupOrder(order.id, false);
      setPickupOverrideVersion((v) => v + 1);
    }
    if (newCourier === 'custom') {
      const isPresetName = COURIER_PRESETS.some(
        p => p.label.toLowerCase() === customCourierName.trim().toLowerCase() || p.value === customCourierName.trim().toLowerCase()
      );
      if (!customCourierName.trim() || isPresetName || customCourierName.trim().toLowerCase() === 'jne express') {
        const savedCustom = (order?.tracking?.courier && order.tracking.courier !== 'JNE Express' && order.tracking.courier !== 'Express Courier' && order.tracking.courier !== 'Standard')
          ? order.tracking.courier
          : (resolveOrderCourier(order).isCustom ? resolveOrderCourier(order).courierName : '');
        setCustomCourierName(savedCustom);
      }
    } else {
      setCustomCourierName('');
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

      // Only initialize/reset tracking form state if:
      // 1. This is a new order ID being viewed (different from last loaded), OR
      // 2. The user has NOT modified the form and the order gained tracking data
      const isNewOrder = lastLoadedOrderIdRef.current !== order.id;
      const canSyncTracking = isNewOrder || !isFormDirtyRef.current;

      if (canSyncTracking) {
        lastLoadedOrderIdRef.current = order.id;
        if (isNewOrder) {
          isFormDirtyRef.current = false;
          hasJneServiceEdit.current = false;
        }

        const isConsolidation = Boolean(
          (order?.meta_data || []).some((m: any) => m.key === '_is_consolidation_order' && (m.value === 'yes' || m.value === true || m.value === '1')) ||
          (order?.meta_data || []).some((m: any) => m.key === '_goorita_consolidated_orders' && Array.isArray(m.value) && m.value.length > 0) ||
          String(order?.shipping?.company || '').toLowerCase().includes('goorita')
        );

        const resolvedCourier = resolveOrderCourier(order);
        setJneService(resolvedCourier.courierId === 'jne' ? resolvedCourier.serviceName || 'REG' : 'REG');

        if (order.tracking) {
          const rawTrack = String(order.tracking.tracking_number || '').trim();
          const validTrack = rawTrack.startsWith('field_') ? '' : rawTrack;
          let carrierId = String(order.tracking.carrier_id || (order as any).carrier_id || '').toLowerCase().trim();

          if (isConsolidation && carrierId === 'goorita') {
            carrierId = 'jne';
          }

          // Detect courier from tracking number pattern if available
          const trackingCarrierDetected = detectCourierFromTrackingNumber(validTrack || order?.tracking?.tracking_number || (order as any)?.tracking_number);

          // Determine high confidence target courier
          let targetCourier = '';

          // 1. If explicit carrierId is a known preset
          if (carrierId && carrierId !== 'custom' && carrierId !== 'unknown') {
            const normCarrierId = normalizeCourierSlug(carrierId);
            if (normCarrierId !== 'custom' && COURIER_PRESETS.some(p => p.value === normCarrierId && p.value !== 'custom')) {
              targetCourier = normCarrierId;
            }
          }

          // 2. Fall back to tracking number pattern
          if (!targetCourier && trackingCarrierDetected) {
            targetCourier = trackingCarrierDetected.courierId;
          }

          // 3. Fall back to resolvedCourier from shipping method / lines / notes
          if (!targetCourier && resolvedCourier.courierId && resolvedCourier.courierId !== 'custom' && !resolvedCourier.isCustom) {
            const normResolved = normalizeCourierSlug(resolvedCourier.courierId);
            if (normResolved !== 'custom' && COURIER_PRESETS.some(p => p.value === normResolved && p.value !== 'custom')) {
              targetCourier = normResolved;
            }
          }

          // 4. Fall back to custom if resolved as custom or explicit custom
          if (!targetCourier && (resolvedCourier.isCustom || carrierId === 'custom')) {
            targetCourier = 'custom';
          }

          // 5. Final fallback to jne
          if (!targetCourier) {
            targetCourier = 'jne';
          }

          if (targetCourier !== 'custom') {
            setCourier(targetCourier);
            setCustomCourierName('');
            setCustomTrackingUrl('');
          } else {
            setCourier('custom');
            const savedCustom = (order.tracking.courier && order.tracking.courier !== 'Express Courier' && order.tracking.courier !== 'Standard' && order.tracking.courier !== 'JNE Express' && order.tracking.courier !== 'Custom Courier')
              ? order.tracking.courier
              : (resolvedCourier.isCustom ? resolvedCourier.courierName : '');
            setCustomCourierName(savedCustom);
            setCustomTrackingUrl(order.tracking.tracking_url || '');
          }

          setTrackingNumber(validTrack);
        } else {
          if (resolvedCourier.isCustom) {
            setCourier('custom');
            setCustomCourierName(resolvedCourier.courierName);
          } else {
            const normalizedSlug = normalizeCourierSlug(resolvedCourier.courierId);
            const isPreset = COURIER_PRESETS.some(p => p.value === normalizedSlug && p.value !== 'custom');
            if (isPreset) {
              setCourier(normalizedSlug);
              setCustomCourierName('');
            } else {
              setCourier('custom');
              setCustomCourierName(resolvedCourier.courierName);
            }
          }
          setCustomTrackingUrl('');
          setTrackingNumber('');
        }
      }

      if (order.notes) {
        setNotes(order.notes);
      } else {
        loadNotes(order.id);
      }
    }
  }, [order, isOpen]);

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

  // Today's slide-over locked page scroll while open; the kit Drawer is non-modal, so keep the lock here.
  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
  }, [isOpen]);

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
        carrier_id: finalCarrier,
        jne_service: courier === 'jne' && hasJneServiceEdit.current ? jneService : undefined,
        tracking_number: trackingNumber.trim(),
        tracking_url: finalUrl,
        status: targetStatus,
        notify_customer: targetStatus === 'shipped',
        is_store_pickup: false,
      } as any);

      if (res.success) {
        setShowShippedPromptModal(false);
        hasJneServiceEdit.current = false;
        const orderNum = cleanOrderNumber(order.id);
        const currentStatusInfo = getOrderStatusInfo(order.status);
        isFormDirtyRef.current = false;
        lastLoadedOrderIdRef.current = order.id;

        setCourier(finalCarrier);
        setTrackingNumber(trackingNumber.trim());
        setStorePickupOverride(false);
        toggleLocalStorePickupOrder(order.id, false);
        setPickupOverrideVersion((v) => v + 1);

        if (targetStatus === 'shipped') {
          showToast('success', 'Order Shipped', `Order #${orderNum} marked as Shipped with tracking code.`);
          order.status = 'shipped' as OrderStatus;
        } else {
          showToast('success', 'Tracking Saved', `Tracking code saved for Order #${orderNum}. Status kept as ${currentStatusInfo.label}.`);
        }
        if (res.order) {
          if (isConsolidationOrder && res.order.tracking && res.order.tracking.carrier_id === 'goorita') {
            res.order.tracking.carrier_id = 'jne';
            res.order.tracking.courier = 'JNE Express';
          }
          setInternalOrder(res.order);
          Object.assign(order, res.order);
        } else if ((res as any).tracking_info) {
          const updatedTracking = (res as any).tracking_info;
          order.tracking = updatedTracking;
          setInternalOrder({ ...order, tracking: updatedTracking });
        }
        if (isConsolidationOrder && order.tracking && order.tracking.carrier_id === 'goorita') {
          order.tracking.carrier_id = 'jne';
          order.tracking.courier = 'JNE Express';
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
  const isStorePickup = storePickupOverride !== null ? storePickupOverride : isStorePickupOrder(order);
  const sAddr1 = (order.shipping?.address_1 || order.billing?.address_1 || '').toLowerCase();
  const sAddr2 = (order.shipping?.address_2 || order.billing?.address_2 || '').toLowerCase();
  const sPostcode = String(order.shipping?.postcode || order.billing?.postcode || '').trim();
  const sCity = (order.shipping?.city || order.billing?.city || '').toLowerCase();
  const isStoreAddress = Boolean(
    (sAddr1.includes('ruby commercial') || sAddr1.includes('summarecon bekasi') || sAddr2.includes('summarecon bekasi')) &&
    (sPostcode === '17142' || sCity.includes('bekasi') || sAddr1.includes('bekasi'))
  );

  const handleToggleStorePickup = async () => {
    if (!order || isSwitchingFulfillment) return;
    const currentIsPickup = storePickupOverride !== null ? storePickupOverride : isStorePickupOrder(order);
    const targetIsPickup = !currentIsPickup;

    // 1. Optimistic instant local update
    setStorePickupOverride(targetIsPickup);
    toggleLocalStorePickupOrder(order.id, targetIsPickup, currentIsPickup);
    setPickupOverrideVersion((v) => v + 1);

    // 2. If switching to courier and destination address points to Exacoat Store, open Edit Address modal
    if (!targetIsPickup && isStoreAddress) {
      setIsEditAddressModalOpen(true);
    }

    // 3. Persist to WordPress database
    setIsSwitchingFulfillment(true);
    try {
      const cleanShippingComp = /exacoat\s*store|store\s*bekasi/i.test(order.shipping?.company || '') ? '' : order.shipping?.company;
      const res = await updateOrderDirect(order.id, {
        is_store_pickup: targetIsPickup,
        shipping: order.shipping ? {
          ...order.shipping,
          company: cleanShippingComp,
        } : undefined,
      });

      if (res.success && res.order) {
        setInternalOrder(res.order);
        showToast(
          'success',
          targetIsPickup ? 'Switched to Store Pickup' : 'Switched to Courier Delivery',
          `Order #${cleanOrderNum} fulfillment mode updated.`
        );
        if (onOrderUpdated) onOrderUpdated();
      } else {
        showToast(
          'info',
          targetIsPickup ? 'Store Pickup Mode' : 'Courier Delivery Mode',
          'Updated fulfillment mode locally.'
        );
      }
    } catch (err: any) {
      showToast('error', 'Update Failed', err.message || 'Failed to update fulfillment mode on server');
    } finally {
      setIsSwitchingFulfillment(false);
    }
  };

    const rmaDetails = getOrderRma(order);
    const guaranteeDetails = getOrderGuarantee(order);
    const parentWarrantyClaimId = (order.meta_data || []).find(m => m.key === '_warranty_claim_order_id' || m.key === '_warranty_replacement_order_id')?.value || order.warranty_replacement_order_id || rmaDetails?.replacement_order_id;
    const parentWarrantyClaimInvoice = (order.meta_data || []).find(m => m.key === '_warranty_claim_invoice')?.value;
    const parentWarrantyStatus = order.warranty_claim_status || rmaDetails?.status || (order.meta_data || []).find(m => m.key === '_warranty_claim_status')?.value || 'pending_review';
    const parentRedeemClaimId = (order.meta_data || []).find(m => m.key === '_redeem_replacement_order_id')?.value;

    const orderMetaList = Array.isArray(order.meta_data) ? order.meta_data : [];
    const findOrderMeta = (k: string) => orderMetaList.find(m => m.key === k)?.value;

    const isEndorsement =
      orderMetaList.some((m: any) => (m.key === '_order_badge' && m.value === 'ENDORSEMENT') || (m.key === '_is_endorsement' && m.value === 'yes'));
    const influencerName = findOrderMeta('_influencer_name');
    const influencerHandle = findOrderMeta('_influencer_handle');
    const endorsementPlatform = findOrderMeta('_endorsement_platform');
    const campaignName = findOrderMeta('_campaign_name');
    const adminEndorsementNotes = findOrderMeta('_admin_notes');

    const rawShippingPriceStr = findOrderMeta('_shipping_raw_price') || findOrderMeta('_shipping_biteship_original_rate') || findOrderMeta('_shipping_biteship_courier_rate');
    const shippingDiscountStr = findOrderMeta('_shipping_discount_amount') || findOrderMeta('_shipping_biteship_discount');
    let shippingDiscount = shippingDiscountStr ? Math.abs(parseFloat(String(shippingDiscountStr))) : 0;

    if (!shippingDiscount && Array.isArray(order.shipping_lines)) {
      for (const line of order.shipping_lines) {
        const isFree = line.meta_data?.find((m: any) => m.key === 'is_free_shipping')?.value;
        const origCost = line.meta_data?.find((m: any) => m.key === 'original_cost' || m.key === '_biteship_raw_idr_cost')?.value;
        if ((isFree === '1' || isFree === true) && origCost && !isNaN(Number(origCost))) {
          shippingDiscount = Math.max(shippingDiscount, Math.abs(Number(origCost)));
        }
      }
    }

    const feeLines = order.fee_lines || order.fees || [];
    if (!shippingDiscount && Array.isArray(feeLines)) {
      for (const fee of feeLines) {
        const n = ((fee as any).name || (fee as any).title || '').toLowerCase();
        if (n.includes('shipping') || n.includes('ongkir')) {
          shippingDiscount = Math.max(shippingDiscount, Math.abs(parseFloat(String((fee as any).total || 0))));
        }
      }
    }

    const shippingPromoCode = String(findOrderMeta('_shipping_promo_code') || findOrderMeta('_shipping_biteship_applied_coupon') || '').trim();

    const originalShippingRate = rawShippingPriceStr && findOrderMeta('_exacoat_shipping_price_edited') !== 'yes'
      ? parseFloat(String(rawShippingPriceStr))
      : (shippingDiscount > 0 ? parseFloat(String(order.shipping_total || 0)) + shippingDiscount : parseFloat(String(order.shipping_total || 0)));

    const isClaimOrder = rmaDetails?.order_type === 'Warranty' || rmaDetails?.order_type === 'Redeem';
    const headerMoreItems: MenuItem[] = isClaimOrder
      ? []
      : [
          ...(!isStorePickup
            ? [{
                icon: ShieldCheck,
                title: 'Warranty',
                description: 'Claim installation warranty manually for this order',
                onSelect: () => {
                  setManualClaimType('Warranty');
                  setIsManualWarrantyModalOpen(true);
                },
              }]
            : []),
          {
            icon: RotateCcw,
            title: 'Redeem',
            description: 'Issue a free redeem replacement order',
            onSelect: () => {
              setManualClaimType('Redeem');
              setIsManualWarrantyModalOpen(true);
            },
          },
        ];

    const displayItems: OrderItem[] =
      order.items && order.items.length > 0 ? order.items : order.line_items && order.line_items.length > 0 ? order.line_items : [];

    const linkedClaims: LinkedClaim[] = [
      ...(parentWarrantyClaimId
        ? [{
            kind: 'warranty' as const,
            orderId: Number(parentWarrantyClaimId),
            reference: String(parentWarrantyClaimInvoice || parentWarrantyClaimId),
            status: String(parentWarrantyStatus || ''),
          }]
        : []),
      ...(parentRedeemClaimId
        ? [{ kind: 'redeem' as const, orderId: Number(parentRedeemClaimId), reference: String(parentRedeemClaimId) }]
        : []),
    ];

    const endorsement: EndorsementInfo | null = isEndorsement
      ? {
          creator: String(influencerName || order.customer_name || ''),
          handle: influencerHandle ? String(influencerHandle) : undefined,
          platform: endorsementPlatform ? String(endorsementPlatform) : undefined,
          campaign: campaignName ? String(campaignName) : undefined,
          notes: campaignName && adminEndorsementNotes ? String(adminEndorsementNotes) : undefined,
        }
      : null;

    const courierOptions = COURIER_PRESETS.map((p) =>
      p.value === 'custom' ? { value: p.value, label: customCourierName.trim() || p.label } : p
    );
    const resolvedCourier = resolveOrderCourier(order);
    const courierTag = resolvedCourier.serviceName
      ? resolvedCourier.serviceName
      : resolvedCourier.rawMatch && resolvedCourier.courierId !== 'jne' && !/pickup|ambil|summarecon/i.test(resolvedCourier.rawMatch)
      ? resolvedCourier.rawMatch
      : undefined;

    const consolidationInfo = isConsolidationOrder
      ? { orderIds: ((order.meta_data || []).find((m: any) => m.key === '_goorita_consolidated_orders')?.value || []) as number[] }
      : null;

    const gooritaUsInfo: GooritaUsInfo | null = isUsOrder
      ? (() => {
          const gooritaOrderId =
            order.goorita_order_id || (courier === 'goorita' ? trackingNumber : null) || (order.meta_data || []).find((m: any) => m.key === '_goorita_order_id')?.value;
          const gooritaAwbUrl =
            order.goorita_awb_url || (order.meta_data || []).find((m: any) => m.key === '_goorita_awb_url' || m.key === 'goorita_awb_url')?.value;
          return {
            orderId: gooritaOrderId ? String(gooritaOrderId) : undefined,
            awbUrl: gooritaAwbUrl ? String(gooritaAwbUrl) : undefined,
            service: order.goorita_service || 'Saver (USPS)',
            isBooked: Boolean(gooritaOrderId || (courier === 'goorita' && trackingNumber)),
          };
        })()
      : null;

    const rayspeedInfo = isRayspeedOrder
      ? {
          destination: destCountry,
          trackUrl: order.tracking?.tracking_number ? getPublicTrackingUrl('rayspeed', order.tracking.tracking_number) : undefined,
        }
      : null;
    return (
      <>
      <Drawer
        open={isOpen}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        label={`Order #${cleanOrderNum}`}
        header={
          <PanelHeader
            order={order}
            onClose={onClose}
            onPrintLabel={() => setIsLabelModalOpen(true)}
            onInvoice={() => setIsInvoiceModalOpen(true)}
            onPackingSlip={() => setIsPackingSlipModalOpen(true)}
            moreItems={headerMoreItems}
            isStorePickup={isStorePickup}
            isPrinted={isPrinted}
            onCopyId={(num) => copyToClipboard(num, 'order_number')}
            extraChips={
              <>
                {isEndorsement && (
                  <span className="inline-flex items-center gap-[5px] rounded-full bg-chip px-2.5 py-[2px] text-[12px] font-medium text-muted">
                    <Megaphone className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
                    Endorsement
                  </span>
                )}
                {guaranteeDetails && (
                  <span
                    className={clsx(
                      'inline-flex items-center gap-[5px] rounded-full px-2.5 py-[2px] text-[12px] font-medium',
                      guaranteeDetails.status === 'refunded'
                        ? 'bg-st-done-bg text-st-done-fg'
                        : guaranteeDetails.status === 'package_received'
                        ? 'bg-st-prog-bg text-st-prog-fg'
                        : guaranteeDetails.status === 'rejected'
                        ? 'bg-st-stop-bg text-st-stop-fg'
                        : 'bg-st-wait-bg text-st-wait-fg'
                    )}
                  >
                    <RotateCcw className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden />
                    30-day guarantee{' '}
                    {guaranteeDetails.status === 'refunded'
                      ? 'refunded'
                      : guaranteeDetails.status === 'package_received'
                      ? 'package received'
                      : guaranteeDetails.status === 'rejected'
                      ? 'rejected'
                      : 'claim'}
                  </span>
                )}
              </>
            }
            banner={
              (rmaDetails?.order_type === 'Warranty' || rmaDetails?.order_type === 'Redeem') ? (
                <ClaimBanner
                  icon={rmaDetails.order_type === 'Redeem' ? RotateCcw : ShieldCheck}
                  title={rmaDetails.order_type === 'Redeem' ? 'Redeem replacement order' : '48-hour installation warranty replacement'}
                  reference={rmaDetails.original_invoice || rmaDetails.original_order_id ? String(rmaDetails.original_invoice || rmaDetails.original_order_id) : undefined}
                  onOpenReference={
                    rmaDetails.original_order_id && onSelectOrderById
                      ? () => onSelectOrderById(Number(rmaDetails.original_order_id))
                      : undefined
                  }
                  channel={findOrderMeta('_rma_marketplace_channel') ? String(findOrderMeta('_rma_marketplace_channel')) : undefined}
                  reason={rmaDetails.claim_reason}
                  status={<ClaimStatusPill status={rmaDetails.status} />}
                  note={rmaDetails.video_deleted ? 'Proof video auto-deleted on review.' : undefined}
                  onReview={rmaDetails.video_proof_url ? () => setIsWarrantyReviewModalOpen(true) : undefined}
                />
              ) : undefined
            }
          >
            <StatusNavigator
              order={{ ...order, is_store_pickup: isStorePickup }}
              disabled={isUpdatingStatus}
              busy={isUpdatingStatus}
              onChangeStatus={(status) => {
                if (!isStorePickup && status === 'completed') {
                  setShowManualCompletedModal(true);
                } else {
                  handleStatusChange(status);
                }
              }}
            />
          </PanelHeader>
        }
      >
      <div>
      <div className="grid grid-cols-1 items-start gap-5 px-4 py-5 md:px-7 md:pb-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-4">
          <CustomerDeliveryCard
            order={order}
            isStorePickup={isStorePickup}
            isSwitchingFulfillment={isSwitchingFulfillment}
            isStoreAddress={isStoreAddress}
            copiedField={copiedField}
            canOpenCustomer={!isShopManager}
            endorsement={endorsement}
            onToggleStorePickup={handleToggleStorePickup}
            onEditAddress={() => setIsEditAddressModalOpen(true)}
            onCopy={copyToClipboard}
            onWhatsApp={() => setIsWhatsAppModalOpen(true)}
            onOpenCustomer={() => {
              if (onNavigateToCustomer) {
                onNavigateToCustomer(order.customer_id, order.customer_email, order.customer_name);
              } else {
                window.location.hash = `#customers?id=${order.customer_id || 0}&email=${encodeURIComponent(order.customer_email || '')}`;
              }
              onClose();
            }}
          />

          <ItemsCard
            order={order}
            items={displayItems}
            claimType={rmaDetails?.order_type}
            linkedClaims={linkedClaims}
            onAddItem={() => {
              setEditingItem(null);
              setIsEditItemModalOpen(true);
            }}
            onEditItem={(item) => {
              setEditingItem(item);
              setIsEditItemModalOpen(true);
            }}
            onPreviewCustom={(item) => setPreviewCustomItem(item)}
            onOpenOrder={onSelectOrderById}
            onReviewClaim={(id) => {
              setReviewTargetOrderId(id);
              setIsWarrantyReviewModalOpen(true);
            }}
          />

          <ShippingCard
            order={order}
            isStorePickup={isStorePickup}
            isPrinted={isPrinted}
            courier={courier}
            courierOptions={courierOptions}
            courierTag={courierTag}
            onSaveShipping={async (changes) => {
              const result = await updateOrderDirect(order.id, changes);
              const updated = result.order;
              if (!result.success || !updated) throw new Error(result.error || 'Could not save shipping.');
              if ((changes.jne_service && updated.jne_service !== changes.jne_service) ||
                changes.shipping_prices?.some(({ id, total }) =>
                  !updated.shipping_lines?.some(line => Number(line.id) === id && Number(line.total) === Number(total)))) {
                throw new Error('The server did not confirm the changes. Check that Exacoat Core is up to date.');
              }
              hasJneServiceEdit.current = false;
              const savedCourier = resolveOrderCourier(updated);
              setJneService(savedCourier.serviceName || 'REG');
              handleOrderMutated(updated);
              showToast('success', 'Shipping saved', 'The order shipping details were updated.');
            }}
            jneService={jneService}
            onJneServiceChange={(value) => {
              if (value !== 'REG' && value !== 'YES') return;
              isFormDirtyRef.current = true;
              hasJneServiceEdit.current = true;
              setJneService(value);
            }}
            customCourierName={customCourierName}
            customTrackingUrl={customTrackingUrl}
            trackingNumber={trackingNumber}
            onCourierChange={handleCourierChange}
            onCustomCourierNameChange={(v) => {
              isFormDirtyRef.current = true;
              setCustomCourierName(v);
            }}
            onCustomTrackingUrlChange={(v) => {
              isFormDirtyRef.current = true;
              setCustomTrackingUrl(v);
            }}
            onTrackingNumberChange={(v) => {
              isFormDirtyRef.current = true;
              setTrackingNumber(v);
            }}
            onSaveTracking={handleSaveTracking}
            isFulfilling={isFulfilling}
            isSyncingTracking={isSyncingTracking}
            onSyncTracking={handleSyncTracking}
            onOpenTracking={() => {
              setIsTrackOrderModalOpen(true);
              if (!order.tracking?.checkpoints || order.tracking.checkpoints.length === 0) {
                handleSyncTracking();
              }
            }}
            showAllCheckpoints={showAllCheckpoints}
            onToggleCheckpoints={() => setShowAllCheckpoints(!showAllCheckpoints)}
            onPrintLabel={() => setIsLabelModalOpen(true)}
            consolidation={consolidationInfo}
            gooritaUs={gooritaUsInfo}
            onBookGoorita={() => setIsGooritaBookingModalOpen(true)}
            onDownloadAwb={() => downloadGooritaAwbPdf(order.id)}
            rayspeed={rayspeedInfo}
            isBookingRayspeed={isBookingRayspeed}
            onBookRayspeed={handleBookRayspeed}
          />

          <ActivityCard
            notes={notes}
            isLoading={isLoadingNotes}
            newNote={newNote}
            onNewNoteChange={setNewNote}
            isCustomerNote={isCustomerNote}
            onCustomerNoteChange={setIsCustomerNote}
            isAdding={isAddingNote}
            onAddNote={handleAddNote}
            renderContent={renderNoteHtml}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SummaryCard
            order={order}
            currentStatus={currentStatusClean}
            shippingDiscount={shippingDiscount}
            originalShippingRate={originalShippingRate}
            shippingPromoCode={shippingPromoCode}
            remainingAvailableRefund={remainingAvailableRefund}
            onRefund={() => {
              setRefundAmount(String(remainingAvailableRefund));
              setMarkAsRefunded(false);
              setIsRefundModalOpen(true);
            }}
          />

          <RefundCard
            order={order}
            totalRefunded={totalRefunded}
            netSettledTotal={netSettledTotal}
            guarantee={guaranteeDetails}
            isProcessingGuarantee={isProcessingGuaranteeAction}
            onGuaranteeAction={(action) => handleGuaranteeAction(action)}
            onRejectGuarantee={() => setIsGuaranteeRejectModalOpen(true)}
          />

          <CouponsCard order={order} shippingDiscount={shippingDiscount} shippingPromoCode={shippingPromoCode} />

          <ReviewCard
            order={order}
            review={orderReview}
            isSendingInvite={isSendingReviewInvite}
            onSendInvite={handleSendReviewInvite}
            onPreviewMedia={(med) => setPreviewReviewMedia(med)}
          />

          <ResendEmailCard
            isStorePickup={isStorePickup}
            template={selectedEmailTemplate}
            onTemplateChange={setSelectedEmailTemplate}
            recipient={resendRecipientEmail}
            fallbackRecipient={order.customer_email || order.billing?.email || undefined}
            onRecipientChange={setResendRecipientEmail}
            isSending={isSendingOrderEmail}
            onSend={handleResendEmail}
            confirmationSent={Boolean(order.meta_data?.some((m) => m.key === '_artmatter_confirmation_email_sent' && m.value === 'yes'))}
            lastResult={lastEmailSentResult}
            storeOrderUrl={`${getWpBaseUrl()}/wp-admin/post.php?post=${order.id}&action=edit`}
            onOpenLogs={onClose}
          />

          {/* Shop managers (including a simulated shop manager role) never see admin actions. */}
          <AdminActionsCard
            isAdmin={isAdmin && !isShopManager}
            isCancelled={currentStatusClean === 'cancelled'}
            isCancelling={isCancellingOrder}
            isTrashing={isTrashingOrder}
            onCancel={() => setShowCancelModal(true)}
            onTrash={() => setShowTrashModal(true)}
          />
        </div>
      </div>

      {/* Refund pop-up */}
      <RefundModal
        open={isRefundModalOpen}
        onOpenChange={setIsRefundModalOpen}
        order={order}
        orderRef={`#${cleanOrderNum}`}
        totalRefunded={totalRefunded}
        remainingAvailableRefund={remainingAvailableRefund}
        shippingDiscount={shippingDiscount}
        amount={refundAmount}
        onAmountChange={setRefundAmount}
        reason={refundReason}
        onReasonChange={setRefundReason}
        method={refundMethod}
        onMethodChange={setRefundMethod}
        restock={restockRefundedItems}
        onRestockChange={setRestockRefundedItems}
        markAsRefunded={markAsRefunded}
        onMarkAsRefundedChange={setMarkAsRefunded}
        isProcessing={isProcessingRefund}
        onSubmit={handleProcessRefund}
      />

      {/* 48-Hour Installation Warranty Review Modal */}
      {order && (
        <WarrantyReviewModal
          orderId={reviewTargetOrderId || order.id}
          isOpen={isWarrantyReviewModalOpen}
          onClose={() => {
            setIsWarrantyReviewModalOpen(false);
            setReviewTargetOrderId(null);
          }}
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
      {previewCustomItem && (() => {
        const finishMode = String(previewCustomItem.finish_type || (previewCustomItem as any).feelform_mode || '');
        return (
          <KitModal
            open={!!previewCustomItem}
            onOpenChange={(o) => { if (!o) setPreviewCustomItem(null); }}
            title={previewCustomItem.name || 'Custom design'}
            width={560}
            footer={
              <>
                <KitButton variant="ghost" onClick={() => setPreviewCustomItem(null)}>Close</KitButton>
                {previewCustomItem.image_url && (
                  <a
                    href={previewCustomItem.image_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-accent px-[13px] text-[13px] font-semibold text-accent-on hover:brightness-95"
                  >
                    <Download className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
                    Download high-res
                  </a>
                )}
              </>
            }
          >
            <div className="flex aspect-[1/1.4] max-h-[60vh] w-full select-none items-center justify-center overflow-hidden rounded-[10px] border border-card-border bg-chip p-3">
              {previewCustomItem.image_url ? (
                <img src={previewCustomItem.image_url} alt={previewCustomItem.name} className="max-h-full max-w-full rounded-lg object-contain" />
              ) : (
                <span className="font-mono text-[12px] text-faint">No image preview</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
              <span>Orientation:</span>
              <span className="font-medium capitalize text-fg">{previewCustomItem.orientation || 'portrait'}</span>
              {finishMode && (
                <span className="rounded-full bg-chip px-2 py-[2px] text-[11.5px] font-medium text-muted">
                  {finishMode.toLowerCase().includes('flat') ? 'Finish: Flat' : 'Finish: Matte/Textured'}
                </span>
              )}
            </div>
          </KitModal>
        );
      })()}

      {/* Review Media Modal */}
      {previewReviewMedia && (
        <KitModal
          open={!!previewReviewMedia}
          onOpenChange={(o) => { if (!o) setPreviewReviewMedia(null); }}
          title={previewReviewMedia.type === 'video' ? 'Customer video' : 'Customer photo'}
          reference={`#${cleanOrderNum}`}
          width={640}
          footer={
            <>
              <KitButton variant="ghost" onClick={() => setPreviewReviewMedia(null)}>Close</KitButton>
              <a
                href={previewReviewMedia.url}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-accent px-[13px] text-[13px] font-semibold text-accent-on hover:brightness-95"
              >
                <Download className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden />
                Download asset
              </a>
            </>
          }
        >
          <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-[10px] border border-card-border bg-chip">
            {previewReviewMedia.type === 'video' ? (
              <video src={previewReviewMedia.url} poster={previewReviewMedia.poster_url} controls autoPlay className="max-h-[70vh] max-w-full rounded-lg" />
            ) : (
              <img src={previewReviewMedia.url} alt="Customer skin photo" className="max-h-[70vh] max-w-full rounded-lg object-contain" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span>Type:</span>
            <span className="font-medium capitalize text-fg">{previewReviewMedia.type}</span>
            {previewReviewMedia.r2_synced ? (
              <span className="rounded-full bg-st-prog-bg px-2 py-[2px] text-[11.5px] font-medium text-st-prog-fg">Cloudflare R2 mirrored</span>
            ) : null}
          </div>
        </KitModal>
      )}

      {/* 30-Day Guarantee Rejection Modal */}
      <ConfirmModal
        open={isGuaranteeRejectModalOpen}
        onOpenChange={setIsGuaranteeRejectModalOpen}
        title="Reject guarantee return"
        reference={`#${cleanOrderNum}`}
        tone="danger"
        confirmLabel="Reject return"
        busyLabel="Rejecting..."
        isLoading={isProcessingGuaranteeAction}
        onConfirm={() => handleGuaranteeAction('reject', guaranteeRejectReason)}
      >
        <ConfirmText>
          Give a reason for rejecting the 30-day guarantee claim. The note is recorded on the order timeline.
        </ConfirmText>
        <textarea
          data-ds=""
          aria-label="Rejection reason"
          value={guaranteeRejectReason}
          onChange={(e) => setGuaranteeRejectReason(e.target.value)}
          placeholder="e.g. Missing original retail packaging, or the skin was damaged during application"
          rows={3}
          className={textareaClass}
        />
      </ConfirmModal>

      {/* Manual Completed Override Confirmation Modal */}
      <ConfirmModal
        open={showManualCompletedModal}
        onOpenChange={setShowManualCompletedModal}
        title="Mark order as Completed"
        reference={`#${cleanOrderNum}`}
        confirmLabel="Override to Completed"
        onConfirm={() => {
          setShowManualCompletedModal(false);
          handleStatusChange('completed');
        }}
      >
        <ConfirmText>
          Courier delivery status normally updates automatically once the courier confirms delivery through tracking webhooks. Are you sure you want to mark this order as Completed by hand?
        </ConfirmText>
      </ConfirmModal>

      {/* Administrator Cancel Order Confirmation Modal */}
      <ConfirmModal
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        title="Cancel order"
        reference={`#${cleanOrderNum}`}
        tone="danger"
        confirmLabel="Cancel order"
        busyLabel="Cancelling..."
        cancelLabel="Keep order"
        isLoading={isCancellingOrder}
        onConfirm={handleCancelOrder}
      >
        <ConfirmText>
          Are you sure you want to cancel this order? This marks the order as cancelled in WooCommerce and records an admin audit note.
        </ConfirmText>
      </ConfirmModal>

      {/* Administrator Move to Trash Confirmation Modal */}
      <ConfirmModal
        open={showTrashModal}
        onOpenChange={setShowTrashModal}
        title="Move order to trash"
        reference={`#${cleanOrderNum}`}
        tone="danger"
        confirmLabel="Move to trash"
        busyLabel="Moving..."
        isLoading={isTrashingOrder}
        onConfirm={handleTrashOrder}
      >
        <ConfirmText>
          Are you sure you want to move this order to trash? It leaves the active order queues and goes to the WooCommerce trash.
        </ConfirmText>
      </ConfirmModal>

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
      <ConfirmModal
        open={showPreparingPromptModal}
        onOpenChange={setShowPreparingPromptModal}
        title="Mark as Preparing order?"
        reference={`#${cleanOrderNum}`}
        icon={Layers}
        confirmLabel="Mark as Preparing order"
        busyLabel="Updating..."
        cancelLabel="Keep as Confirmed"
        isLoading={isMarkingPreparingFromDrawer}
        onConfirm={async () => {
          setIsMarkingPreparingFromDrawer(true);
          await handleStatusChange('preparing-order');
          setIsMarkingPreparingFromDrawer(false);
          setShowPreparingPromptModal(false);
        }}
      >
        <ConfirmText>
          The shipping label was sent to print. Move this order from <b className="font-medium text-fg">Confirmed</b> to{' '}
          <b className="font-medium text-fg">Preparing order</b> to start fulfillment?
        </ConfirmText>
      </ConfirmModal>

      {/* Post-Tracking Manual Entry Advance to Shipped Confirmation Modal */}
      <ConfirmModal
        open={showShippedPromptModal}
        onOpenChange={setShowShippedPromptModal}
        title="Mark as Shipped?"
        reference={`#${cleanOrderNum}`}
        icon={Truck}
        confirmLabel="Mark as Shipped"
        busyLabel="Updating..."
        cancelLabel={`Keep as ${getOrderStatusInfo(order.status).label}`}
        isLoading={isFulfilling}
        onCancel={() => executeSaveTracking('none')}
        onConfirm={() => executeSaveTracking('shipped')}
      >
        <ConfirmText>
          The tracking number was entered. Move this order from{' '}
          <b className="font-medium text-fg">{getOrderStatusInfo(order.status).label}</b> to{' '}
          <b className="font-medium text-fg">Shipped</b>?
        </ConfirmText>
        <div className="flex items-center justify-between rounded-[10px] bg-chip px-3.5 py-3 text-[13px]">
          <span className="text-muted">
            {courier === 'custom' ? (customCourierName.trim() || 'Custom Courier') : (COURIER_PRESETS.find(p => p.value === courier)?.label || courier)}
          </span>
          <span className="font-mono font-medium text-fg">{trackingNumber.trim()}</span>
        </div>
      </ConfirmModal>

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
        <KitModal
          open={isTrackOrderModalOpen}
          onOpenChange={setIsTrackOrderModalOpen}
          title="Shipment tracking"
          reference={`#${cleanOrderNum}`}
          description="Live carrier checkpoints and delivery timeline"
          width={640}
          footer={
            <>
              <KitButton variant="ghost" onClick={() => setIsTrackOrderModalOpen(false)}>Close</KitButton>
              <KitButton icon={RefreshCw} disabled={isSyncingTracking} onClick={handleSyncTracking}>
                {isSyncingTracking ? 'Syncing...' : 'Refresh'}
              </KitButton>
            </>
          }
        >
          <div className="flex flex-col justify-between gap-3 rounded-[10px] bg-chip px-3.5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-faint">Courier</span>
                <span className="text-[13px] font-medium text-fg">
                  {(() => {
                    const courierDisplay = getOrderCourierDisplay(order);
                    if (courierDisplay && courierDisplay !== 'Courier') {
                      return courierDisplay;
                    }
                    return cleanCourierDisplay(COURIER_PRESETS.find((p) => p.value === courier)?.label || order.tracking?.courier || courier);
                  })()}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="font-mono text-[14px] font-medium text-fg">{order.tracking?.tracking_number}</span>
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
                  className="grid h-7 w-7 place-items-center rounded-[7px] text-faint hover:bg-pop hover:text-fg"
                  aria-label="Copy tracking number"
                  title="Copy tracking number"
                >
                  {copiedField === 'modal_resi' ? (
                    <Check className="h-3.5 w-3.5 text-st-done-fg" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {order.tracking?.latest_status && (
                <span
                  className={clsx(
                    'rounded-full px-2 py-[2px] text-[11.5px] font-medium capitalize',
                    order.tracking.latest_status === 'delivered' ? 'bg-st-done-bg text-st-done-fg' : 'bg-st-prog-bg text-st-prog-fg'
                  )}
                >
                  {order.tracking.latest_status === 'delivered' ? 'Delivered' : order.tracking.latest_status.replace('_', ' ')}
                </span>
              )}
              {order.tracking?.tracking_number && (
                <>
                  <a
                    href={getExacoatTrackingUrl(order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-[30px] items-center gap-1.5 rounded-[8px] border border-field-border bg-field px-2.5 text-[12.5px] text-fg hover:bg-chip"
                    title="Customer live tracking page on Exacoat"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted" />
                    Track on Exacoat
                  </a>
                  <a
                    href={getPublicTrackingUrl(
                      order.tracking.courier || courier,
                      order.tracking.tracking_number,
                      order.tracking.tracking_url
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-[30px] items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-muted hover:bg-chip hover:text-fg"
                    title="Carrier portal"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Carrier
                  </a>
                </>
              )}
            </div>
          </div>

          {order.tracking?.latest_status === 'delivered' && (
            <div className="flex items-start gap-2.5 rounded-[10px] border border-st-done-border bg-st-done-bg px-3.5 py-3 text-[12.5px] text-st-done-fg">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <span className="block font-medium">Package delivered</span>
                <p className="m-0 mt-0.5 leading-relaxed">
                  The carrier confirmed delivery. The 48-hour installation warranty claim window runs from this delivery date.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <span className="flex items-center gap-1.5 text-[12px] text-faint">
              <Clock className="h-3.5 w-3.5" />
              Tracking timeline ({order.tracking?.checkpoints?.length || 0} checkpoints)
            </span>

            {isSyncingTracking && (!order.tracking?.checkpoints || order.tracking.checkpoints.length === 0) ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-[12.5px] text-muted">
                <RefreshCw className="h-5 w-5 animate-spin text-accent-fg" />
                <span>Pulling live checkpoints from the courier...</span>
              </div>
            ) : !order.tracking?.checkpoints || order.tracking.checkpoints.length === 0 ? (
              <div className="flex flex-col gap-1.5 rounded-[10px] border border-card-border px-4 py-4 text-center text-[12.5px] text-muted">
                <span className="font-medium text-st-wait-fg">Waybill registered with {order.tracking?.courier || 'courier'}</span>
                <p className="m-0 mx-auto max-w-sm leading-relaxed">
                  The waybill is registered in the carrier tracking system. Checkpoints appear once the package is scanned at the carrier sorting hub.
                </p>
                {order.tracking?.tracking_number && (
                  <p className="m-0 font-mono text-[12px] text-faint">Tracking number: {order.tracking.tracking_number}</p>
                )}
              </div>
            ) : (
              <div className="custom-scrollbar flex max-h-80 flex-col gap-3 overflow-y-auto rounded-[10px] border border-card-border p-4">
                {order.tracking.checkpoints.map((cp, idx) => {
                  const isDeliveredCp = cp.stage === 'delivered' || cp.description.toLowerCase().includes('delivered') || cp.description.toLowerCase().includes('diterima');
                  const isLatest = idx === 0;

                  return (
                    <div key={idx} className="relative border-l border-line pb-3 pl-5 last:pb-0">
                      <span
                        className={clsx(
                          'absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full',
                          isDeliveredCp ? 'bg-st-done-fg' : isLatest ? 'bg-accent' : 'bg-faint'
                        )}
                      />
                      <div className="flex flex-col gap-0.5 text-[12.5px]">
                        <p className={clsx('m-0 leading-snug', isLatest ? 'font-medium text-fg' : 'text-muted')}>{cp.description}</p>
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-faint">
                          <span>{cp.time}</span>
                          {cp.location && <span>{cp.location}</span>}
                          {cp.stage && <span className="rounded bg-chip px-1.5 text-[11px] uppercase">{cp.stage}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </KitModal>
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
      </div>
    </Drawer>
    </>
  );
};
