import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Video,
  FileText,
  AlertTriangle,
  Loader2,
  Trash2,
  Scissors,
  User,
  MapPin,
  MessageSquare,
  Send,
  Phone,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  fetchWarrantyClaimDetails,
  reviewWarrantyClaimDirect,
  WarrantyClaimDetails,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { cleanItemTitle } from '../../lib/orderItems';
import { getWordPressBaseUrl } from '../../lib/env';

const WA_TEMPLATES = {
  cut_incorrect: {
    labelId: 'Video Potongan Tidak Sesuai (Kurang 5 Bagian)',
    labelEn: 'Skin Cut Proof Incorrect (Not 5 Distinct Pieces)',
    textId: (name: string, ref: string) =>
      `Halo kak ${name}, terima kasih telah mengajukan klaim garansi pemasangan Exacoat untuk pesanan #${ref}.\n\nSetelah tim kami meninjau video bukti yang diunggah, pemotongan skin belum sesuai ketentuan garansi (skin harus dipotong menjadi minimal 5 bagian terpisah dan terlihat jelas pada video).\n\nMohon bantu kirimkan video pemotongan skin yang sesuai langsung melalui WhatsApp ini agar klaim penggantian dapat segera kami proses. Terima kasih!`,
    textEn: (name: string, ref: string) =>
      `Hi ${name}, thank you for submitting your Exacoat installation warranty claim for order #${ref}.\n\nUpon review, the uploaded video proof does not show the skin cut into at least 5 distinct pieces as required by our warranty policy.\n\nPlease reply with an updated video showing all claimed skins cut into at least 5 pieces so we can approve your replacement. Thank you!`,
  },
  missing_skins: {
    labelId: 'Bagian Skin Belum Dipotong Lengkap di Video',
    labelEn: 'Missing Claimed Skin Parts in Video',
    textId: (name: string, ref: string) =>
      `Halo kak ${name}, mengenai pengajuan garansi pemasangan Exacoat untuk pesanan #${ref}.\n\nKami melihat masih ada bagian skin yang belum dipotong di dalam video bukti yang dilampirkan. Sesuai ketentuan garansi, seluruh bagian skin yang diajukan penggantian harus dipotong menjadi 5 bagian.\n\nMohon kirimkan video pemotongan untuk seluruh bagian skin yang diklaim agar dapat kami setujui segera. Terima kasih!`,
    textEn: (name: string, ref: string) =>
      `Hi ${name}, regarding your Exacoat warranty replacement claim for order #${ref}.\n\nWe noticed that some of the claimed skin parts are missing from the cutting proof video. According to our warranty terms, all skins requested for replacement must be cut.\n\nPlease send a video showing all claimed skin parts cut so we can proceed with your replacement. Thank you!`,
  },
  unclear_video: {
    labelId: 'Video Buram / Tidak Dapat Diputar',
    labelEn: 'Video Unplayable or Unclear',
    textId: (name: string, ref: string) =>
      `Halo kak ${name}, terkait pengajuan garansi pemasangan Exacoat untuk pesanan #${ref}.\n\nVideo bukti yang diunggah tidak dapat kami putar atau resolusinya kurang jelas sehingga tim QC belum dapat melakukan verifikasi.\n\nBisa tolong kirimkan video bukti pemotongan skin secara langsung ke WhatsApp ini? Kami akan segera memproses penggantian setelah video diverifikasi. Terima kasih!`,
    textEn: (name: string, ref: string) =>
      `Hi ${name}, regarding your Exacoat warranty claim for order #${ref}.\n\nWe were unable to play or clearly view the uploaded proof video, preventing our team from verifying the claim.\n\nCould you please send the video showing the cut skin directly here on WhatsApp? We will process your replacement right away once verified. Thank you!`,
  },
};

const normalizeVideoUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const baseUrl = getWordPressBaseUrl();
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface WarrantyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  onClaimReviewed?: () => void;
  onSelectParentOrder?: (parentOrderId: number) => void;
}

export const WarrantyReviewModal: React.FC<WarrantyReviewModalProps> = ({
  isOpen,
  onClose,
  orderId,
  onClaimReviewed,
  onSelectParentOrder,
}) => {
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [claim, setClaim] = useState<WarrantyClaimDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review action state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // WhatsApp Customer Dispatch State
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [waLanguage, setWaLanguage] = useState<'id' | 'en'>('id');
  const [waTemplateKey, setWaTemplateKey] = useState<'cut_incorrect' | 'missing_skins' | 'unclear_video'>('cut_incorrect');
  const [waMessage, setWaMessage] = useState('');
  const [waPhone, setWaPhone] = useState('');

  const generateWaMessage = (
    tplKey: 'cut_incorrect' | 'missing_skins' | 'unclear_video',
    lang: 'id' | 'en',
    details: WarrantyClaimDetails | null
  ) => {
    const rawName = (details?.customer_name || '').trim();
    const firstName = rawName.split(' ')[0] || (lang === 'id' ? 'Kak' : 'Customer');
    const orderRef = String(details?.parent_order_number || details?.parent_order_id || details?.order_number || '');

    const tpl = WA_TEMPLATES[tplKey];
    if (!tpl) return '';
    return lang === 'id' ? tpl.textId(firstName, orderRef) : tpl.textEn(firstName, orderRef);
  };

  const handleSelectTemplate = (tplKey: 'cut_incorrect' | 'missing_skins' | 'unclear_video') => {
    setWaTemplateKey(tplKey);
    setWaMessage(generateWaMessage(tplKey, waLanguage, claim));
  };

  const handleSelectLanguage = (lang: 'id' | 'en') => {
    setWaLanguage(lang);
    setWaMessage(generateWaMessage(waTemplateKey, lang, claim));
  };

  const handleToggleWhatsApp = () => {
    setShowWhatsApp((prev) => {
      const next = !prev;
      if (next && claim) {
        setWaMessage(generateWaMessage(waTemplateKey, waLanguage, claim));
        if (claim.customer_phone) {
          setWaPhone(claim.customer_phone);
        }
      }
      return next;
    });
  };

  const handleSendWhatsApp = () => {
    const rawPhone = waPhone || claim?.customer_phone || '';
    let cleaned = rawPhone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.slice(1);
    } else if (cleaned.startsWith('8')) {
      cleaned = '62' + cleaned;
    }
    if (!cleaned) {
      showToast('warning', 'WhatsApp Phone Required', 'Customer phone number is missing or invalid.');
      return;
    }
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const loadDetails = async () => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);

    const res = await fetchWarrantyClaimDetails(orderId);
    if (res.success && res.data) {
      setClaim(res.data);
      if (res.data.customer_phone) {
        setWaPhone(res.data.customer_phone);
      }
    } else {
      setError(res.error || 'Failed to load warranty claim details.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen && orderId) {
      setShowRejectInput(false);
      setRejectionReason('');
      setShowWhatsApp(false);
      setWaMessage('');
      loadDetails();
    }
  }, [isOpen, orderId]);

  const handleApprove = async () => {
    if (!orderId) return;
    setIsProcessing(true);

    const res = await reviewWarrantyClaimDirect(orderId, 'approve');
    setIsProcessing(false);

    if (res.success) {
      showToast('success', 'Claim Approved', 'Warranty claim approved and video proof deleted from disk.');
      if (onClaimReviewed) onClaimReviewed();
      loadDetails();
    } else {
      showToast('error', 'Approval Failed', res.error || 'Failed to approve claim');
    }
  };

  const handleReject = async () => {
    if (!orderId) return;
    if (!rejectionReason.trim()) {
      showToast('warning', 'Rejection Reason Required', 'Please enter a rejection reason.');
      return;
    }

    setIsProcessing(true);
    const res = await reviewWarrantyClaimDirect(orderId, 'reject', rejectionReason);
    setIsProcessing(false);

    if (res.success) {
      showToast('info', 'Claim Rejected', 'Warranty claim rejected and video proof deleted from disk.');
      if (onClaimReviewed) onClaimReviewed();
      loadDetails();
    } else {
      showToast('error', 'Rejection Failed', res.error || 'Failed to reject claim');
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="rose">Rejected</Badge>;
      default:
        return <Badge variant="warning">Pending Review</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#f3aa18]" />
          <span>Warranty Claim Review #{claim?.order_number || orderId}</span>
        </div>
      }
      subtitle="Verify customer 5-piece cut video proof and approve replacement"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleToggleWhatsApp}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors",
                showWhatsApp
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                  : "border-neutral-700 bg-neutral-800 text-emerald-400 hover:bg-neutral-700 hover:border-emerald-500/30"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              WhatsApp Customer
            </button>
          </div>

          {claim?.rma_status === 'pending_review' && (
            <div className="flex items-center gap-2">
              {!showRejectInput ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject Claim
                  </button>

                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve Claim
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reason for rejection (e.g. skin not cut into 5 pieces)..."
                    className="h-9 w-64 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-xs text-white placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isProcessing || !rejectionReason.trim()}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500 transition-colors"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(false)}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#f3aa18]" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-400">
          {error}
        </div>
      ) : claim ? (
        <div className="space-y-6 text-xs text-neutral-300">
          {/* Top Status & Original Order Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 font-medium">Claim Status</span>
                {renderStatusBadge(claim.rma_status)}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-neutral-400">Original Invoice</span>
                {claim.parent_order_id ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectParentOrder) {
                        onClose();
                        onSelectParentOrder(Number(claim.parent_order_id));
                      }
                    }}
                    className="flex items-center gap-1 font-mono text-[#f3aa18] hover:underline"
                  >
                    <span>#{claim.parent_order_number || claim.parent_order_id}</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="font-mono text-neutral-400">N/A</span>
                )}
              </div>
              {claim.reviewed_by && (
                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80">
                  <span>Reviewed By</span>
                  <span className="text-neutral-200">
                    {claim.reviewed_by} on {claim.reviewed_at}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">{claim.customer_name || 'Customer'}</p>
                  <p className="text-[11px] text-neutral-400">
                    {claim.customer_phone || ''} {claim.customer_email ? `• ${claim.customer_email}` : ''}
                  </p>
                </div>
              </div>
              {claim.shipping_address && (
                <div className="flex items-start gap-2 pt-1 border-t border-neutral-800/80 text-[11px] text-neutral-400">
                  <MapPin className="h-3.5 w-3.5 text-neutral-500 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{claim.shipping_address}</span>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp Interactive Assistant Panel */}
          {showWhatsApp && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <MessageSquare className="h-4 w-4" />
                  <span>Contact Customer via WhatsApp</span>
                </div>
                <div className="flex items-center gap-1 bg-neutral-900 rounded-lg p-0.5 border border-neutral-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('id')}
                    className={clsx(
                      "px-2.5 py-1 rounded font-medium transition-colors",
                      waLanguage === 'id' ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-white"
                    )}
                  >
                    ID (Indonesia)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('en')}
                    className={clsx(
                      "px-2.5 py-1 rounded font-medium transition-colors",
                      waLanguage === 'en' ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-white"
                    )}
                  >
                    EN (English)
                  </button>
                </div>
              </div>

              {/* Template Selector Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-neutral-400 font-medium">Select Pre-filled Template:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(WA_TEMPLATES) as Array<keyof typeof WA_TEMPLATES>).map((key) => {
                    const tpl = WA_TEMPLATES[key];
                    const isSelected = waTemplateKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectTemplate(key)}
                        className={clsx(
                          "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors border",
                          isSelected
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                        )}
                      >
                        {waLanguage === 'id' ? tpl.labelId : tpl.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phone and Editable Message */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium">
                    <Phone className="h-3 w-3 text-neutral-500" />
                    <span>Customer WhatsApp Number:</span>
                  </label>
                  <input
                    type="text"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    placeholder="0812... or 62812..."
                    className="h-7 w-48 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-white placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <textarea
                  rows={4}
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-white placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-neutral-500">
                    Clicking will open WhatsApp Web or Desktop with the prefilled message above.
                  </span>
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Open WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Issue Reason & Notes */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-2">
            <div className="flex items-center gap-2 text-neutral-400 font-medium">
              <FileText className="h-4 w-4 text-[#f3aa18]" />
              <span>Customer Stated Reason</span>
            </div>
            <p className="font-medium text-white capitalize">
              {claim.claim_reason ? claim.claim_reason.replace(/_/g, ' ') : 'Installation difficulty'}
            </p>
            {claim.customer_notes && (
              <p className="text-neutral-400 italic bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800/60">
                &ldquo;{claim.customer_notes}&rdquo;
              </p>
            )}
            {claim.rejection_reason && (
              <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-red-400">
                <strong>Rejection Reason:</strong> {claim.rejection_reason}
              </div>
            )}
          </div>

          {/* Shopee / Marketplace Order Note Banner */}
          {(claim.buyer_note || claim.shopee_notes) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <MessageSquare className="h-4 w-4" />
                <span>{claim.channel === 'shopee' ? 'Shopee Buyer Order Note' : 'Customer Order Note'}</span>
              </div>
              <p className="text-amber-200/90 whitespace-pre-wrap pl-6 font-mono text-[11px] leading-relaxed">
                {claim.buyer_note || claim.shopee_notes}
              </p>
            </div>
          )}

          {/* Replaced Items */}
          {claim.items && claim.items.length > 0 && (
            <div className="space-y-2">
              <span className="font-medium text-neutral-400 uppercase tracking-wider text-[11px]">
                Replacement Items ({claim.items.length})
              </span>
              <div className="space-y-2">
                {claim.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"
                  >
                    <div className="flex items-center gap-3">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-10 w-10 rounded-md object-cover border border-neutral-700 shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-800 text-neutral-500">
                          <Scissors className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{cleanItemTitle(item.name)}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                          <span>Qty: {item.quantity} (Warranty Replacement)</span>
                          {item.device_model && (
                            <span className="text-neutral-500">• {item.device_model}</span>
                          )}
                          {item.claimed_parts && item.claimed_parts.length > 0 && (
                            <span className="inline-flex items-center rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                              Parts: {item.claimed_parts.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.item_note && (
                      <div className="mt-1 flex items-start gap-1.5 rounded bg-neutral-950/70 px-2.5 py-1.5 text-[11px] border border-neutral-800 text-amber-300">
                        <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-neutral-400">Customization / Item Note: </span>
                          <span className="font-mono text-amber-200">{item.item_note}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Video Proof Player Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-neutral-400 font-medium">
                <Video className="h-4 w-4 text-[#f3aa18]" />
                <span>5-Piece Cut Proof Video</span>
              </div>
              {claim.video_proof_url && !claim.video_deleted && (
                <a
                  href={normalizeVideoUrl(claim.video_proof_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-[#f3aa18] hover:underline"
                >
                  <span>Open Video in New Tab</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {claim.video_deleted ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 p-8 text-center">
                <Trash2 className="h-8 w-8 text-neutral-600 mb-2" />
                <p className="text-neutral-300 font-medium">Video proof deleted from server disk</p>
                <p className="mt-1 text-[11px] text-neutral-500 max-w-sm">
                  The uploaded video proof was purged immediately upon {claim.rma_status} status decision to comply with privacy and disk storage policies.
                </p>
                {claim.video_deleted_at && (
                  <span className="mt-2 text-[10px] font-mono text-neutral-600">
                    Purged at: {claim.video_deleted_at}
                  </span>
                )}
              </div>
            ) : claim.video_proof_url ? (
              <div className="overflow-hidden rounded-xl border border-neutral-800 bg-black">
                <video
                  src={normalizeVideoUrl(claim.video_proof_url)}
                  controls
                  playsInline
                  className="max-h-[380px] w-full bg-black object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/30 p-8 text-center text-neutral-500">
                <AlertTriangle className="h-6 w-6 mb-2 text-neutral-600" />
                <p>No video proof link on record.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
