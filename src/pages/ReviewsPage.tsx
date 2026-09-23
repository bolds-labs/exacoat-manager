import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { CardEyebrow } from '../components/ui/CardEyebrow';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import {
  Star,
  CheckCircle2,
  Clock,
  Award,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldCheck,
  Video,
  Image as ImageIcon,
  Play,
  Mail,
  X,
  Check,
  MessageSquare,
  AlertCircle,
  Cloud,
  ChevronRight,
  User,
  Plus,
  Gift,
  UploadCloud,
  Loader2
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { COUNTRY_OPTIONS, ALL_COUNTRIES } from '../lib/countries';
import {
  fetchReviewsDirect,
  updateReviewStatusDirect,
  editReviewDirect,
  deleteReviewDirect,
  sendReviewInviteDirect,
  createReviewDirect,
  uploadReviewMediaDirect,
  fetchReviewRewardSettingsDirect,
  updateReviewRewardSettingsDirect,
  fetchOrdersDirect,
  ReviewRewardSettings
} from '../lib/wordpressBridge';
import { formatDateTime, formatDate } from '../lib/formatters';
import { SearchableCombobox, ComboboxOption } from '../components/ui/SearchableCombobox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '../components/ui/Select';
import { OrderReview, OrderReviewMedia, Order } from '../types';
import { clsx } from 'clsx';

interface ReviewsPageProps {
  onSelectOrder?: (orderId: number) => void;
}

export function maskCollectorName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Customer';
  if (trimmed.includes('***')) return trimmed;
  const clean = trimmed.replace(/[^\p{L}\p{N}]/gu, '');
  if (clean.length <= 2) return clean.charAt(0).toUpperCase() + '***';
  const first = clean.charAt(0).toUpperCase();
  const last = clean.charAt(clean.length - 1).toLowerCase();
  return `${first}***${last}`;
}

export const maskCustomerName = maskCollectorName;

export function resolveCountryName(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const direct = ALL_COUNTRIES.find(c => c.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct;

  if (trimmed.length === 2) {
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      const resolved = regionNames.of(trimmed.toUpperCase());
      if (resolved) {
        const match = ALL_COUNTRIES.find(c => c.toLowerCase() === resolved.toLowerCase());
        if (match) return match;
        return resolved;
      }
    } catch {}
  }

  for (const c of ALL_COUNTRIES) {
    if (trimmed.toLowerCase().includes(c.toLowerCase())) {
      return c;
    }
  }

  return trimmed;
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({
  onSelectOrder,
}) => {
  const { showToast } = useToast();

  const [reviews, setReviews] = useState<OrderReview[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    approved: number;
    featured: number;
    with_media: number;
    average_rating: number;
  }>({
    total: 0,
    pending: 0,
    approved: 0,
    featured: 0,
    with_media: 0,
    average_rating: 5.0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'featured' | 'with_media' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [maxPages, setMaxPages] = useState(1);

  // Modals state
  const [editingReview, setEditingReview] = useState<OrderReview | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editRating, setEditRating] = useState(5);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [editMedia, setEditMedia] = useState<OrderReviewMedia[]>([]);
  const [isUploadingEditMedia, setIsUploadingEditMedia] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Create Manual Review Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createArtworkTitle, setCreateArtworkTitle] = useState('');
  const [createArtistName, setCreateArtistName] = useState('Exacoat');
  const [createArtworkImage, setCreateArtworkImage] = useState('');
  const [createProductId, setCreateProductId] = useState<number>(0);
  const [createCustomerName, setCreateCustomerName] = useState('');
  const [createCustomerLocation, setCreateCustomerLocation] = useState('');
  const [createCustomerEmail, setCreateCustomerEmail] = useState('');
  const [createIsAnonymous, setCreateIsAnonymous] = useState(false);
  const [createRating, setCreateRating] = useState(5);
  const [createContent, setCreateContent] = useState('');
  const [createStatus, setCreateStatus] = useState<'approved' | 'featured' | 'pending'>('approved');
  const [createVerified, setCreateVerified] = useState(true);
  const [createMediaUrl, setCreateMediaUrl] = useState('');
  const [createMediaFile, setCreateMediaFile] = useState<OrderReviewMedia | null>(null);
  const [isUploadingCreateMedia, setIsUploadingCreateMedia] = useState(false);
  const [isCreatingReview, setIsCreatingReview] = useState(false);

  // Link to Order state for Create Review Autofill
  const [storeOrders, setStoreOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [createOrderId, setCreateOrderId] = useState<number>(0);
  const [createOrderNumber, setCreateOrderNumber] = useState<string>('');

  // Fetch recent orders when Create Review Modal opens
  useEffect(() => {
    if (isCreateModalOpen && storeOrders.length === 0 && !isLoadingOrders) {
      setIsLoadingOrders(true);
      fetchOrdersDirect({ per_page: 50 })
        .then(res => {
          if (res.success && Array.isArray(res.orders)) {
            setStoreOrders(res.orders);
          }
        })
        .catch(err => console.warn('Failed loading orders for review creator:', err))
        .finally(() => setIsLoadingOrders(false));
    }
  }, [isCreateModalOpen, storeOrders.length, isLoadingOrders]);

  // Build searchable order options for Create Review Modal
  const orderComboboxOptions: ComboboxOption[] = useMemo(() => {
    return storeOrders.map(o => {
      const customer = o.customer_name || `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || 'Customer';
      const country = resolveCountryName(o.shipping?.country || o.billing?.country || '');
      const itemCount = o.items?.length || 0;
      const artTitle = o.items?.[0]?.name || 'Product';
      return {
        value: String(o.id),
        label: `Order #${o.order_number || o.id} • ${customer}`,
        sublabel: `${country ? `${country} • ` : ''}${itemCount} item(s): ${artTitle} • Status: ${o.status}`,
        badge: `#${o.order_number || o.id}`,
      };
    });
  }, [storeOrders]);

  const handleSelectOrder = (orderIdStr: string) => {
    setSelectedOrderId(orderIdStr);
    const numId = parseInt(orderIdStr, 10);
    const order = storeOrders.find(o => o.id === numId);
    if (!order) return;

    setCreateOrderId(order.id);
    setCreateOrderNumber(order.order_number || String(order.id));
    setCreateVerified(true);

    const custName = order.customer_name || `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || '';
    if (custName) setCreateCustomerName(custName);
    const custEmail = order.customer_email || order.billing?.email || '';
    if (custEmail) setCreateCustomerEmail(custEmail);

    const rawCountry = order.shipping?.country || order.billing?.country || '';
    if (rawCountry) {
      setCreateCustomerLocation(resolveCountryName(rawCountry));
    }

    if (order.items && order.items.length > 0) {
      const item = order.items[0];
      if (!createArtworkTitle) setCreateArtworkTitle(item.name || '');
      if (!createProductId && item.product_id) setCreateProductId(item.product_id);
      if (item.artist_name && createArtistName === 'Exacoat') setCreateArtistName(item.artist_name);
      const img = item.image_url || (item as any).image?.src || '';
      if (!createArtworkImage && img) setCreateArtworkImage(img);
    }
  };

  const handleClearSelectedOrder = () => {
    setSelectedOrderId(null);
    setCreateOrderId(0);
    setCreateOrderNumber('');
  };

  // Media Lightbox Modal state
  const [activeMedia, setActiveMedia] = useState<{
    url: string;
    type: 'photo' | 'video';
    title?: string;
    customer?: string;
  } | null>(null);

  // Manual Invite Modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteOrderId, setInviteOrderId] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Review Reward Incentive Settings Modal state
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [rewardSettings, setRewardSettings] = useState<ReviewRewardSettings>({
    enabled: true,
    discount_percent: 20,
    coupon_prefix: 'EXACOAT',
    expiry_days: 30,
  });
  const [isLoadingReward, setIsLoadingReward] = useState(false);
  const [isSavingReward, setIsSavingReward] = useState(false);

  const loadRewardSettings = useCallback(async () => {
    setIsLoadingReward(true);
    try {
      const res = await fetchReviewRewardSettingsDirect();
      if (res.success && res.settings) {
        setRewardSettings(res.settings);
      }
    } catch (err) {
      console.warn('Failed loading review reward settings:', err);
    } finally {
      setIsLoadingReward(false);
    }
  }, []);

  useEffect(() => {
    loadRewardSettings();
  }, [loadRewardSettings]);

  const handleSaveRewardSettings = async () => {
    setIsSavingReward(true);
    try {
      const res = await updateReviewRewardSettingsDirect(rewardSettings);
      if (res.success) {
        showToast('success', 'Reward Settings Saved', `Review reward coupon set to ${rewardSettings.discount_percent}%`);
        setIsRewardModalOpen(false);
      } else {
        showToast('error', 'Failed saving settings', res.error);
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message);
    } finally {
      setIsSavingReward(false);
    }
  };

  // Fetch reviews from WordPress REST API
  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchReviewsDirect({
        status: activeTab,
        rating: ratingFilter > 0 ? ratingFilter : undefined,
        search: searchQuery.trim() || undefined,
        with_media: activeTab === 'with_media',
        page: currentPage,
        per_page: 20,
      });

      if (res.success) {
        setReviews(res.reviews || []);
        if ((res as any).stats) {
          setStats((res as any).stats);
        }
        setMaxPages(res.max_pages || 1);
      } else {
        showToast('error', 'Failed loading reviews', res.error);
      }
    } catch (err: any) {
      showToast('error', 'Connection Error', err.message || 'Error communicating with WordPress');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, ratingFilter, searchQuery, currentPage, showToast]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Status Action Handlers
  const handleStatusChange = async (reviewId: number, newStatus: 'pending' | 'approved' | 'featured' | 'rejected') => {
    try {
      const res = await updateReviewStatusDirect(reviewId, newStatus);
      if (res.success) {
        showToast('success', 'Status Updated', `Review marked as ${newStatus}`);
        setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status: newStatus } : r));
        // Refresh overview counts
        loadReviews();
      } else {
        showToast('error', 'Status Update Failed', res.error);
      }
    } catch (err: any) {
      showToast('error', 'Status Update Error', err.message);
    }
  };

  // Handle media file upload
  const handleUploadReviewFile = async (file: File, isEdit: boolean) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      showToast('error', 'File Too Large', 'Maximum supported media file size is 100MB.');
      return;
    }

    if (isEdit) {
      setIsUploadingEditMedia(true);
    } else {
      setIsUploadingCreateMedia(true);
    }

    try {
      const res: any = await uploadReviewMediaDirect(file);
      if (res.success && (res.url || res.media_url)) {
        const mediaUrl = res.url || res.media_url;
        showToast('success', 'Media Uploaded', `${res.type === 'video' ? 'Video' : 'Photo'} uploaded and processed`);
        const item: OrderReviewMedia = {
          type: res.type || (file.type.startsWith('video/') ? 'video' : 'photo'),
          url: mediaUrl,
          poster_url: res.poster_url || mediaUrl,
        };
        if (isEdit) {
          setEditMedia([item]);
        } else {
          setCreateMediaFile(item);
          setCreateMediaUrl(mediaUrl);
        }
      } else {
        showToast('error', 'Upload Failed', res.error || res.message || 'Could not upload media');
      }
    } catch (err: any) {
      showToast('error', 'Upload Error', err.message);
    } finally {
      if (isEdit) {
        setIsUploadingEditMedia(false);
      } else {
        setIsUploadingCreateMedia(false);
      }
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (review: OrderReview) => {
    setEditingReview(review);
    setEditContent(review.content || '');
    setEditRating(review.rating || 5);
    setEditName(review.customer_name || '');
    setEditLocation(review.customer_location || '');
    setEditIsAnonymous(!!review.is_anonymous);
    setEditMedia(Array.isArray(review.media) ? [...review.media] : []);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingReview) return;
    setIsSavingEdit(true);
    try {
      const res = await editReviewDirect(editingReview.id, {
        content: editContent,
        rating: editRating,
        customer_name: editName,
        customer_location: editLocation,
        is_anonymous: editIsAnonymous,
        media: editMedia,
      });

      if (res.success) {
        showToast('success', 'Review Updated', 'Customer review has been updated');
        setReviews(prev => prev.map(r => r.id === editingReview.id ? {
          ...r,
          content: editContent,
          rating: editRating,
          customer_name: editName,
          customer_location: editLocation,
          is_anonymous: editIsAnonymous,
          media: editMedia,
          masked_name: maskCollectorName(editName),
        } : r));
        setEditingReview(null);
      } else {
        showToast('error', 'Update Failed', res.error);
      }
    } catch (err: any) {
      showToast('error', 'Update Error', err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Create Manual Review
  const handleCreateReview = async () => {
    if (!createArtworkTitle.trim()) {
      showToast('error', 'Product Title Required', 'Please provide a product title');
      return;
    }
    if (!createCustomerName.trim()) {
      showToast('error', 'Customer Name Required', 'Please enter a customer or reviewer name');
      return;
    }
    if (!createContent.trim()) {
      showToast('error', 'Review Content Required', 'Please provide the review commentary');
      return;
    }

    setIsCreatingReview(true);
    try {
      const mediaList = createMediaFile ? [createMediaFile] : (createMediaUrl.trim() ? [{
        type: 'photo' as const,
        url: createMediaUrl.trim(),
        poster_url: createMediaUrl.trim(),
      }] : undefined);

      const res = await createReviewDirect({
        order_id: createOrderId > 0 ? createOrderId : undefined,
        order_number: createOrderNumber || undefined,
        artwork_title: createArtworkTitle.trim(),
        artist_name: createArtistName.trim() || 'Exacoat',
        product_id: createProductId > 0 ? createProductId : undefined,
        artwork_image: createArtworkImage.trim() || undefined,
        customer_name: createCustomerName.trim(),
        customer_email: createCustomerEmail.trim() || undefined,
        customer_location: createCustomerLocation.trim() || undefined,
        rating: createRating,
        content: createContent.trim(),
        status: createStatus,
        verified_purchase: createVerified,
        is_anonymous: createIsAnonymous,
        media: mediaList,
      });

      if (res.success) {
        showToast('success', 'Review Created', 'New customer review has been published');
        setIsCreateModalOpen(false);
        setSelectedOrderId(null);
        setCreateOrderId(0);
        setCreateOrderNumber('');
        setCreateArtworkTitle('');
        setCreateArtistName('Exacoat');
        setCreateArtworkImage('');
        setCreateProductId(0);
        setCreateCustomerName('');
        setCreateCustomerLocation('');
        setCreateCustomerEmail('');
        setCreateContent('');
        setCreateMediaUrl('');
        setCreateMediaFile(null);
        setCreateIsAnonymous(false);
        setCreateRating(5);
        setCreateStatus('approved');
        loadReviews();
      } else {
        showToast('error', 'Creation Failed', res.error || (res as any).message);
      }
    } catch (err: any) {
      showToast('error', 'Creation Error', err.message);
    } finally {
      setIsCreatingReview(false);
    }
  };

  // Delete Review
  const handleDeleteReview = async (reviewId: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this customer review?')) return;

    try {
      const res = await deleteReviewDirect(reviewId);
      if (res.success) {
        showToast('success', 'Review Deleted', 'Review has been permanently removed');
        setReviews(prev => prev.filter(r => r.id !== reviewId));
        loadReviews();
      } else {
        showToast('error', 'Delete Failed', res.error);
      }
    } catch (err: any) {
      showToast('error', 'Delete Error', err.message);
    }
  };

  // Manual Dispatch Review Invite
  const handleSendInvite = async () => {
    const cleanId = parseInt(inviteOrderId.replace(/\D/g, ''), 10);
    if (!cleanId) {
      showToast('error', 'Invalid Order ID', 'Please enter a valid numeric Order ID or #number');
      return;
    }

    setIsSendingInvite(true);
    try {
      const res = await sendReviewInviteDirect(cleanId);
      if (res.success) {
        showToast('success', 'Invitation Dispatched', (res as any).message || 'Review invitation dispatched to customer email');
        setIsInviteModalOpen(false);
        setInviteOrderId('');
      } else {
        showToast('error', 'Invitation Failed', res.error);
      }
    } catch (err: any) {
      showToast('error', 'Invitation Error', err.message);
    } finally {
      setIsSendingInvite(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 lg:pb-0 font-sans">
      {/* Top Banner & Header */}
      <PageHeroHeader
        title="Reviews"
        subtitle="Customer reviews, ratings, and shared customer photos."
        badge={{ label: 'Storefront', variant: 'default' }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadReviews}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin text-[#f3aa18]')} />
              Refresh
            </button>

            <button
              onClick={() => {
                loadRewardSettings();
                setIsRewardModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto"
            >
              <Gift className="w-3.5 h-3.5 text-amber-400" />
              Review Incentive
              {rewardSettings.enabled && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  {rewardSettings.discount_percent}%
                </span>
              )}
            </button>

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#141414] hover:bg-white/[0.06] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto"
            >
              <Mail className="w-3.5 h-3.5" />
              Invite by Order
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-bold font-sans flex items-center gap-2 transition-all shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Review
            </button>
          </div>
        }
      />

      {/* Executive Key Performance Indicators (Matching Dashboard Architecture) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
        {/* 1. Total Reviews */}
        <GlassCard className="p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]">
          <div className="flex items-center justify-between gap-2">
            <CardEyebrow>Total Reviews</CardEyebrow>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/[0.04] text-zinc-400 border border-white/[0.06] shrink-0">
              Catalog
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
              {stats.total}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              Customer submissions
            </p>
          </div>
        </GlassCard>

        {/* 2. Average Rating */}
        <GlassCard className="p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]">
          <div className="flex items-center justify-between gap-2">
            <CardEyebrow>Average Rating</CardEyebrow>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
              Verified
            </span>
          </div>
          <div className="my-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-amber-300 font-mono tabular-nums">
                {stats.average_rating}
              </h3>
              <div className="flex items-center text-amber-300">
                <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
              </div>
            </div>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
               Average across all reviews
            </p>
          </div>
        </GlassCard>

        {/* 3. Pending Moderation */}
        <GlassCard className={clsx(
          "p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]",
          stats.pending > 0 && "border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
        )}>
          <div className="flex items-center justify-between gap-2">
            <CardEyebrow>Pending Approval</CardEyebrow>
            <span className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 border",
              stats.pending > 0
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-white/[0.04] text-zinc-400 border-white/[0.06]"
            )}>
              {stats.pending > 0 ? 'Needs review' : 'Up to date'}
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className={clsx(
              "text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums",
              stats.pending > 0 ? "text-amber-400 font-medium" : "text-white"
            )}>
              {stats.pending}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              {stats.pending > 0 ? 'Awaiting review' : 'No items pending'}
            </p>
          </div>
        </GlassCard>

        {/* 4. Published & Featured */}
        <GlassCard className="p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px]">
          <div className="flex items-center justify-between gap-2">
            <CardEyebrow>Published</CardEyebrow>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20 shrink-0">
              Storefront
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f3aa18] font-mono tabular-nums">
              {stats.approved + stats.featured}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              {stats.featured} featured
            </p>
          </div>
        </GlassCard>

        {/* 5. With Photos / Videos */}
        <GlassCard className="p-4 sm:p-5 flex flex-col justify-between font-sans group transition-all min-h-[120px] col-span-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <CardEyebrow>With Media</CardEyebrow>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/[0.04] text-zinc-400 border border-white/[0.06] shrink-0">
              Photos & Videos
            </span>
          </div>
          <div className="my-1 space-y-1">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
              {stats.with_media}
            </h3>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed line-clamp-1">
              Photos and videos
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Filter Tabs & Search Toolbar */}
      <GlassCard className="p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="overflow-x-auto no-scrollbar pb-1 md:pb-0 w-full md:w-auto">
            <Tabs
              tabs={[
                { id: 'all', label: 'All Reviews', count: stats.total },
                { id: 'pending', label: 'Pending', count: stats.pending },
                { id: 'approved', label: 'Approved', count: stats.approved },
                { id: 'featured', label: 'Featured', count: stats.featured },
                { id: 'with_media', label: 'With Media', count: stats.with_media },
                { id: 'rejected', label: 'Rejected' },
              ]}
              activeTab={activeTab}
              onChange={(tabId) => {
                setActiveTab(tabId as any);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Search & Rating Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search customer, order, product..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-zinc-950/80 border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#f3aa18]/60 font-sans"
              />
            </div>

            <Select
              value={ratingFilter.toString()}
              onValueChange={val => {
                setRatingFilter(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[125px] h-8 text-xs font-mono bg-zinc-950/80 border-white/[0.08] text-zinc-200">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All Stars</SelectItem>
                <SelectItem value="5">5 Stars only</SelectItem>
                <SelectItem value="4">4+ Stars</SelectItem>
                <SelectItem value="3">3+ Stars</SelectItem>
                <SelectItem value="2">2+ Stars</SelectItem>
                <SelectItem value="1">1+ Stars</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* Reviews Cards List */}
      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 text-sm font-light">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-600" />
          Loading reviews...
        </div>
      ) : reviews.length === 0 ? (
        <GlassCard className="p-12 text-center border-zinc-800/80 bg-zinc-900/30">
          <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-base font-normal text-white">No reviews found</p>
          <p className="text-xs font-light text-zinc-500 mt-1 max-w-md mx-auto">
            {searchQuery || activeTab !== 'all' || ratingFilter > 0
              ? 'Try adjusting your filters or search query to find reviews.'
              : 'As orders are delivered, customers will automatically receive invitations to share their feedback.'}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => {
            const mediaItems = review.media || [];
            const hasMedia = mediaItems.length > 0;

            return (
              <GlassCard
                key={review.id}
                className={clsx(
                  "p-4 md:p-5 border-zinc-800/80 bg-zinc-900/40 transition-all hover:border-zinc-700/80",
                  review.status === 'pending' && "border-amber-500/20 bg-amber-500/[0.02]",
                  review.status === 'featured' && "border-lime-500/20 bg-lime-500/[0.02]"
                )}
              >
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  {/* Left Column: Review Content */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    {/* Header Row: Stars, Status, Order #, Date */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Star Rating */}
                      <div className="flex items-center gap-1 text-amber-300">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => {
                            const isFull = s <= Math.floor(review.rating);
                            const isHalf = !isFull && (s - 0.5 <= review.rating);
                            return (
                              <div key={s} className="relative w-3.5 h-3.5">
                                <Star className={clsx('w-3.5 h-3.5', isFull ? 'fill-amber-300 text-amber-300' : 'text-zinc-600')} />
                                {isHalf && (
                                  <div className="absolute inset-0 overflow-hidden w-[50%]">
                                    <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-[11px] font-mono text-zinc-300 ml-0.5">
                          {Number(review.rating).toFixed(1)}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-[11px] font-normal leading-tight inline-flex items-center gap-1',
                        review.status === 'approved' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                        review.status === 'featured' && 'bg-lime-500/15 text-lime-400 border border-lime-500/30',
                        review.status === 'pending' && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                        review.status === 'rejected' && 'bg-red-500/10 text-red-400 border border-red-500/20'
                      )}>
                        {review.status === 'featured' && <Award className="w-2.5 h-2.5" />}
                        {review.status === 'approved' && <Check className="w-2.5 h-2.5" />}
                        {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                      </span>

                      {/* Order Number Link */}
                      {review.order_number && (
                        <button
                          type="button"
                          onClick={() => onSelectOrder && onSelectOrder(review.order_id)}
                          className="text-xs font-mono text-zinc-400 hover:text-white underline underline-offset-2 transition-colors inline-flex items-center gap-1"
                          title="Open Order Details"
                        >
                          Order {review.order_number.startsWith('#') ? review.order_number : `#${review.order_number}`}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      )}

                      <span className="text-zinc-600 text-xs">•</span>
                      <span className="text-xs text-zinc-500 font-light">
                        {formatDate(review.created_at)}
                      </span>
                    </div>

                    {/* Review Title & Content */}
                    <div>
                      {review.title && (
                        <h4 className="text-sm font-medium text-white mb-1">
                          "{review.title}"
                        </h4>
                      )}
                      <p className="text-xs font-light text-zinc-300 leading-relaxed max-w-3xl">
                        {review.content}
                      </p>
                    </div>

                    {/* Media Attachments Gallery (Photos & Videos) */}
                    {hasMedia && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {mediaItems.map((media, mIdx) => (
                          <div
                            key={mIdx}
                            onClick={() => setActiveMedia({
                              url: media.url,
                              type: media.type,
                              title: review.artwork_title,
                              customer: review.customer_name,
                            })}
                            className="relative group w-20 h-20 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-500 transition-colors"
                          >
                            <img
                              src={media.poster_url || media.url}
                              alt="Customer review thumbnail"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {media.type === 'video' ? (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Play className="w-5 h-5 text-white fill-white" />
                              </div>
                            ) : (
                              <div className="absolute top-1 right-1 bg-black/60 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-3 h-3 text-white" />
                              </div>
                            )}
                            {media.r2_synced ? (
                              <div className="absolute bottom-1 right-1 bg-black/70 rounded px-1 py-0.5 text-[8px] text-zinc-300 font-mono flex items-center gap-0.5">
                                <Cloud className="w-2 h-2 text-lime-400" />
                                R2
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Customer & Product Context */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs border-t border-zinc-800/60 text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-200 font-normal">{review.customer_name}</span>
                        {review.is_anonymous && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono"
                            title={`Masked on storefront as: ${review.masked_name || maskCollectorName(review.customer_name)}`}
                          >
                            Public: {review.masked_name || maskCollectorName(review.customer_name)}
                          </span>
                        )}
                        {review.customer_email && (
                          <span className="text-zinc-500 font-mono text-[11px]">({review.customer_email})</span>
                        )}
                        {review.verified_purchase && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Verified Buyer
                          </span>
                        )}
                      </div>

                      {review.customer_location && (
                        <span className="text-zinc-500">From {review.customer_location}</span>
                      )}

                      {review.artwork_title && (
                        <div className="flex items-center gap-1 text-zinc-500">
                          <span>Product:</span>
                          <span className="text-zinc-300">{review.artwork_title}</span>
                          {review.artist_name && review.artist_name !== 'Exacoat' && (
                            <span className="text-zinc-500">({review.artist_name})</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Moderation Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-1.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                    {review.status !== 'approved' && review.status !== 'featured' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(review.id, 'approved')}
                        className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs h-7 px-2.5"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Approve
                      </Button>
                    )}

                    {review.status === 'approved' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(review.id, 'featured')}
                        className="bg-lime-500/15 hover:bg-lime-500/25 text-lime-300 border border-lime-500/30 text-xs h-7 px-2.5"
                      >
                        <Award className="w-3.5 h-3.5 mr-1" />
                        Feature
                      </Button>
                    )}

                    {review.status === 'featured' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(review.id, 'approved')}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs h-7 px-2.5"
                      >
                        Unfeature
                      </Button>
                    )}

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(review)}
                        className="text-zinc-400 hover:text-white h-7 px-2"
                        title="Edit Review"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>

                      {review.status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStatusChange(review.id, 'rejected')}
                          className="text-zinc-400 hover:text-amber-400 h-7 px-2"
                          title="Reject / Hide"
                        >
                          Reject
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteReview(review.id)}
                        className="text-zinc-500 hover:text-red-400 h-7 px-2"
                        title="Permanently Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}

          {/* Pagination */}
          {maxPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-xs text-zinc-400">
              <div>Page {currentPage} of {maxPages}</div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="border-zinc-800 text-xs h-7 px-2.5"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= maxPages}
                  onClick={() => setCurrentPage(p => Math.min(maxPages, p + 1))}
                  className="border-zinc-800 text-xs h-7 px-2.5"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Review Modal */}
      {editingReview && (
        <Modal
          isOpen={!!editingReview}
          onClose={() => setEditingReview(null)}
          title="Edit Customer Review"
        >
          <div className="space-y-4 text-sm font-sans pt-2">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Rating</label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-amber-300">
                  {[1, 2, 3, 4, 5].map(s => {
                    const isFull = s <= Math.floor(editRating);
                    const isHalf = !isFull && (s - 0.5 <= editRating);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isLeft = (e.clientX - rect.left) < rect.width / 2;
                          setEditRating(isLeft ? Math.max(1, s - 0.5) : s);
                        }}
                        className="relative p-1 hover:scale-110 transition-transform"
                        title={`Click left for ${s - 0.5}, right for ${s}`}
                      >
                        <Star className={clsx('w-5 h-5', isFull ? 'fill-amber-300 text-amber-300' : 'text-zinc-600')} />
                        {isHalf && (
                          <div className="absolute top-1 left-1 overflow-hidden w-[50%] pointer-events-none">
                            <Star className="w-5 h-5 fill-amber-300 text-amber-300" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-mono text-zinc-300 font-medium">
                  {editRating.toFixed(1)} / 5.0
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Review Thoughts</label>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={4}
                placeholder="Customer experience and product fit..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Customer Media (Photo or Video) */}
            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">Customer Photo or Video</label>
              {editMedia && editMedia.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-white/[0.08]">
                    {editMedia[0].type === 'video' ? (
                      <div className="w-14 h-14 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-center shrink-0 text-cyan-400">
                        <Video className="w-6 h-6" />
                      </div>
                    ) : (
                      <img
                        src={editMedia[0].url}
                        alt="Customer review media"
                        className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white truncate">
                          {editMedia[0].type === 'video' ? 'Customer Video' : 'Customer Photo'}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 uppercase">
                          {editMedia[0].type}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono truncate">{editMedia[0].url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditMedia([])}
                      className="text-xs text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-white/[0.04] transition-colors"
                      title="Remove Media"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center p-4 border border-dashed border-white/[0.12] hover:border-white/[0.25] rounded-xl cursor-pointer bg-zinc-900/50 hover:bg-zinc-900 transition-all group">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadReviewFile(file, true);
                      }}
                      disabled={isUploadingEditMedia}
                    />
                    {isUploadingEditMedia ? (
                      <div className="flex items-center gap-2 text-xs text-zinc-300">
                        <Loader2 className="w-4 h-4 animate-spin text-[#f3aa18]" />
                        <span>Uploading & optimizing media...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <UploadCloud className="w-6 h-6 text-zinc-400 group-hover:text-[#f3aa18] transition-colors" />
                        <span className="text-xs font-medium text-zinc-300">Upload Image or Video</span>
                        <span className="text-[10px] text-zinc-500 font-mono">JPG, PNG, WebP, HEIC, MP4, WebM up to 100MB</span>
                      </div>
                    )}
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Customer Display Name</label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Customer name"
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Country / Location</label>
                <SearchableCombobox
                  options={COUNTRY_OPTIONS}
                  value={resolveCountryName(editLocation)}
                  onChange={setEditLocation}
                  placeholder="Select country..."
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editIsAnonymous}
                  onChange={e => setEditIsAnonymous(e.target.checked)}
                  className="accent-lime-400 w-4 h-4 rounded"
                />
                <span>
                  Redact name publicly (displays as{' '}
                  <strong className="text-white font-mono">{maskCollectorName(editName)}</strong>)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingReview(null)}
                className="border-zinc-800"
              >
                Cancel
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Manual Review Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Customer Review"
        >
          <div className="space-y-4 text-sm font-sans pt-2 max-h-[75vh] overflow-y-auto pr-1">
            {/* Link to Store Order (Optional Autofill) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-400">
                  Link to Store Order (Optional - Auto-fills Customer & Country)
                </label>
                {isLoadingOrders && (
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                    <Loader2 className="w-3 h-3 animate-spin text-[#f3aa18]" /> Loading orders...
                  </span>
                )}
              </div>
              <SearchableCombobox
                options={orderComboboxOptions}
                value={selectedOrderId}
                onChange={handleSelectOrder}
                placeholder="Search order by #, customer name, email..."
              />
            </div>

            {/* Selected Order Context Preview Card */}
            {selectedOrderId && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="px-1.5 py-0.5 rounded bg-lime-500/10 text-lime-400 border border-lime-500/20 font-mono font-medium text-[11px] shrink-0">
                    Order #{createOrderNumber || selectedOrderId}
                  </span>
                  <span className="text-white font-medium truncate">{createCustomerName}</span>
                  {createCustomerLocation && (
                    <span className="text-zinc-400 font-mono text-[11px] shrink-0">({createCustomerLocation})</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearSelectedOrder}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition-colors shrink-0"
                >
                  Clear Order
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Product Title *</label>
                <Input
                  value={createArtworkTitle}
                  onChange={e => setCreateArtworkTitle(e.target.value)}
                  placeholder="e.g. iPhone 16 Pro Full Body Skin - Matte Black"
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Brand / Series</label>
                <Input
                  value={createArtistName}
                  onChange={e => setCreateArtistName(e.target.value)}
                  placeholder="e.g. Exacoat"
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
            </div>

            {/* Product ID and Thumbnail URL */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">WooCommerce Product ID</label>
                <Input
                  type="number"
                  value={createProductId || ''}
                  onChange={e => setCreateProductId(parseInt(e.target.value, 10) || 0)}
                  placeholder="Auto-filled or e.g. 18402"
                  className="bg-zinc-900 border-zinc-800 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Product Thumbnail URL</label>
                <Input
                  value={createArtworkImage}
                  onChange={e => setCreateArtworkImage(e.target.value)}
                  placeholder="Auto-filled or https://..."
                  className="bg-zinc-900 border-zinc-800 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Customer Name *</label>
                <Input
                  value={createCustomerName}
                  onChange={e => setCreateCustomerName(e.target.value)}
                  placeholder="e.g. Alexander Miller"
                  className="bg-zinc-900 border-zinc-800"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Country / Location</label>
                <SearchableCombobox
                  options={COUNTRY_OPTIONS}
                  value={resolveCountryName(createCustomerLocation)}
                  onChange={setCreateCustomerLocation}
                  placeholder="Select customer country..."
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createIsAnonymous}
                  onChange={e => setCreateIsAnonymous(e.target.checked)}
                  className="accent-lime-400 w-4 h-4 rounded"
                />
                <span>
                  Redact name publicly (displays as{' '}
                  <strong className="text-white font-mono">{maskCollectorName(createCustomerName)}</strong>)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Rating</label>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-1 text-amber-300">
                    {[1, 2, 3, 4, 5].map(s => {
                      const isFull = s <= Math.floor(createRating);
                      const isHalf = !isFull && (s - 0.5 <= createRating);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const isLeft = (e.clientX - rect.left) < rect.width / 2;
                            setCreateRating(isLeft ? Math.max(1, s - 0.5) : s);
                          }}
                          className="relative p-1 hover:scale-110 transition-transform"
                          title={`Click left for ${s - 0.5}, right for ${s}`}
                        >
                          <Star className={clsx('w-5 h-5', isFull ? 'fill-amber-300 text-amber-300' : 'text-zinc-600')} />
                          {isHalf && (
                            <div className="absolute top-1 left-1 overflow-hidden w-[50%] pointer-events-none">
                              <Star className="w-5 h-5 fill-amber-300 text-amber-300" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono text-zinc-300 font-medium">
                    {createRating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Initial Status</label>
                <Select
                  value={createStatus}
                  onValueChange={(val: any) => setCreateStatus(val)}
                >
                  <SelectTrigger className="w-full h-9 bg-zinc-900 border-zinc-800 text-xs text-white">
                    <SelectValue placeholder="Select initial status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved (Live immediately)</SelectItem>
                    <SelectItem value="featured">Featured (Prioritized on Home)</SelectItem>
                    <SelectItem value="pending">Pending Moderation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Review Commentary *</label>
              <textarea
                value={createContent}
                onChange={e => setCreateContent(e.target.value)}
                rows={4}
                placeholder="The skin fit with absolute precision and looks incredible on my device..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Customer Media Upload (Drag & Drop or File Picker + URL fallback) */}
            <div className="space-y-2">
              <label className="block text-xs text-zinc-400">Customer Photo or Video (Optional)</label>
              {createMediaFile ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-white/[0.08]">
                  {createMediaFile.type === 'video' ? (
                    <div className="w-14 h-14 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-center shrink-0 text-cyan-400">
                      <Video className="w-6 h-6" />
                    </div>
                  ) : (
                    <img
                      src={createMediaFile.url}
                      alt="Customer upload preview"
                      className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">
                        {createMediaFile.type === 'video' ? 'Customer Video' : 'Customer Photo'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 uppercase">
                        {createMediaFile.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono truncate">{createMediaFile.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMediaFile(null);
                      setCreateMediaUrl('');
                    }}
                    className="text-xs text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-white/[0.04] transition-colors"
                    title="Remove Media"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center p-4 border border-dashed border-white/[0.12] hover:border-white/[0.25] rounded-xl cursor-pointer bg-zinc-900/50 hover:bg-zinc-900 transition-all group">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadReviewFile(file, false);
                      }}
                      disabled={isUploadingCreateMedia}
                    />
                    {isUploadingCreateMedia ? (
                      <div className="flex items-center gap-2 text-xs text-zinc-300">
                        <Loader2 className="w-4 h-4 animate-spin text-[#f3aa18]" />
                        <span>Uploading & optimizing media...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <UploadCloud className="w-6 h-6 text-zinc-400 group-hover:text-[#f3aa18] transition-colors" />
                        <span className="text-xs font-medium text-zinc-300">Upload Image or Video</span>
                        <span className="text-[10px] text-zinc-500 font-mono">JPG, PNG, WebP, HEIC, MP4, WebM up to 100MB</span>
                      </div>
                    )}
                  </label>
                  <div className="relative">
                    <Input
                      value={createMediaUrl}
                      onChange={e => setCreateMediaUrl(e.target.value)}
                      placeholder="Or paste media URL: https://.../wall-photo.jpg"
                      className="bg-zinc-900 border-zinc-800 font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pt-1 text-xs text-zinc-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createVerified}
                  onChange={e => setCreateVerified(e.target.checked)}
                  className="accent-lime-400 w-4 h-4 rounded"
                />
                <span>Verified Buyer badge</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                className="border-zinc-800"
              >
                Cancel
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={handleCreateReview}
                disabled={isCreatingReview}
              >
                {isCreatingReview ? 'Creating...' : 'Create Review'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Media Lightbox & Video Player Modal */}
      {activeMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveMedia(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveMedia(null)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-black"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/40 min-h-[300px]">
              {activeMedia.type === 'video' ? (
                <video
                  src={activeMedia.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[75vh] max-w-full"
                />
              ) : (
                <img
                  src={activeMedia.url}
                  alt={activeMedia.title || 'Customer device photo'}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              )}
            </div>

            <div className="p-3 bg-zinc-900/90 border-t border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
              <div>
                <span className="text-white font-medium">{activeMedia.customer}</span>
                {activeMedia.title && <span className="ml-2 text-zinc-500">• {activeMedia.title}</span>}
              </div>
              <a
                href={activeMedia.url}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white inline-flex items-center gap-1"
              >
                Direct Link <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Manual Invite Dispatch Modal */}
      {isInviteModalOpen && (
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Send Customer Review Invitation"
        >
          <div className="space-y-4 text-sm font-sans pt-2">
            <p className="text-xs font-light text-zinc-400">
              Enter the numeric Order ID (e.g. 18516) to immediately dispatch a review invitation email to the customer.
            </p>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Order ID / #Number</label>
              <Input
                value={inviteOrderId}
                onChange={e => setInviteOrderId(e.target.value)}
                placeholder="e.g. 18516"
                className="bg-zinc-900 border-zinc-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInviteModalOpen(false)}
                className="border-zinc-800"
              >
                Cancel
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={handleSendInvite}
                disabled={isSendingInvite || !inviteOrderId.trim()}
              >
                {isSendingInvite ? 'Sending...' : 'Dispatch Email'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Review Incentive Settings Modal */}
      {isRewardModalOpen && (
        <Modal
          isOpen={isRewardModalOpen}
          onClose={() => setIsRewardModalOpen(false)}
          title="Review Incentive & Customer Promo Code Settings"
        >
          <div className="space-y-4 text-sm font-sans pt-2">
            <p className="text-xs font-light text-zinc-400">
              Reward customers with an exclusive single-use WooCommerce promo code upon completing their review.
              This automatically customizes review invitation emails and displays the private code on screen.
            </p>

            {/* Enable Toggle */}
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-white">Enable Customer Review Promo Code</div>
                <div className="text-[11px] text-zinc-400 font-light">Issue promo codes when customers submit a review</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rewardSettings.enabled}
                  onChange={e => setRewardSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-500"></div>
              </label>
            </div>

            {/* Discount Percentage Selection */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Discount Percentage</label>
              <div className="flex items-center gap-2 mb-2">
                {[15, 20, 25, 30].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRewardSettings(prev => ({ ...prev, discount_percent: pct }))}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                      rewardSettings.discount_percent === pct
                        ? 'bg-lime-500/10 text-lime-400 border-lime-500/40'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={5}
                  max={50}
                  value={rewardSettings.discount_percent}
                  onChange={e => setRewardSettings(prev => ({ ...prev, discount_percent: parseInt(e.target.value, 10) || 0 }))}
                  className="bg-zinc-900 border-zinc-800 pr-8"
                  placeholder="Custom %"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
              </div>
            </div>

            {/* Coupon Prefix & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Coupon Prefix</label>
                <Input
                  value={rewardSettings.coupon_prefix}
                  onChange={e => setRewardSettings(prev => ({ ...prev, coupon_prefix: e.target.value.toUpperCase() }))}
                  placeholder="EXACOAT"
                  className="bg-zinc-900 border-zinc-800 font-mono uppercase text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Validity (Days)</label>
                <Input
                  type="number"
                  min={1}
                  max={180}
                  value={rewardSettings.expiry_days}
                  onChange={e => setRewardSettings(prev => ({ ...prev, expiry_days: parseInt(e.target.value, 10) || 30 }))}
                  placeholder="30"
                  className="bg-zinc-900 border-zinc-800 text-xs"
                />
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="p-3 bg-zinc-950 border border-zinc-800/80 rounded-xl space-y-2">
              <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Live Discount Impact</div>
              <div className="text-xs text-zinc-300">
                <span className="text-zinc-500">Email Subject: </span>
                {rewardSettings.enabled ? (
                  <span className="text-white">How does &#123;product_title&#125; look on your device? (Enjoy {rewardSettings.discount_percent}% off your next skin)</span>
                ) : (
                  <span className="text-zinc-400">How does &#123;product_title&#125; look on your device? (Standard)</span>
                )}
              </div>
              <div className="text-xs text-zinc-300">
                <span className="text-zinc-500">Email Badge: </span>
                {rewardSettings.enabled ? (
                  <span className="text-[#f3aa18]">Customer Discount • {rewardSettings.discount_percent}% Off</span>
                ) : (
                  <span className="text-zinc-400">Customer Feedback</span>
                )}
              </div>
              <div className="text-xs text-zinc-300">
                <span className="text-zinc-500">Sample Generated Code: </span>
                <code className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[11px] text-amber-300">
                  {rewardSettings.coupon_prefix || 'EXACOAT'}{rewardSettings.discount_percent}-XXXXX
                </code>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRewardModalOpen(false)}
                className="border-zinc-800"
              >
                Cancel
              </Button>
              <Button
                variant="light"
                size="sm"
                onClick={handleSaveRewardSettings}
                disabled={isSavingReward || isLoadingReward}
              >
                {isSavingReward ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
