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
  Mail,
  Send,
  Phone,
  KeyRound,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatOrderNumber } from '../../lib/orderUtils';
import {
  fetchWarrantyClaimDetails,
  reviewWarrantyClaimDirect,
  sendWarrantyClarificationEmailDirect,
  WarrantyClaimDetails,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { cleanItemTitle } from '../../lib/orderItems';
import { getWordPressBaseUrl } from '../../lib/env';

const COMM_TEMPLATES = {
  cut_incorrect: {
    labelId: 'Video Potongan Skin Tidak Sesuai',
    labelEn: 'Skin Cut Proof Incorrect',
    subjectId: (ref: string) => `[Exacoat] Permintaan Video Ulang Klaim Garansi #${ref}`,
    subjectEn: (ref: string) => `[Exacoat] Video Clarification for Installation Warranty Claim #${ref}`,
    textId: (name: string, ref: string) =>
      `Halo kak ${name},\n\nTerima kasih telah mengajukan klaim garansi pemasangan Exacoat untuk pesanan #${ref}.\n\nSetelah tim kami meninjau video bukti yang diunggah, pemotongan skin belum sesuai ketentuan garansi (produk skin asli harus dipotong, bukan hanya lapisan pelindung atau kertas alasnya, dan terlihat jelas pada video).\n\nMohon bantu kirimkan video pemotongan produk skin yang sesuai melalui WhatsApp/email ini agar klaim penggantian dapat segera kami proses. Terima kasih!\n\nBest Regards,\nAurelia\nExacoat Customer Support`,
    textEn: (name: string, ref: string) =>
      `Hi ${name},\n\nThank you for submitting your Exacoat installation warranty claim for order #${ref}.\n\nUpon review, the uploaded video proof does not show the actual skin cut as required (the actual skin material must be cut, not just the backing sheet or protective layers, and shown clearly on video).\n\nPlease send an updated video showing the cut skin product so we can approve your replacement. Thank you!\n\nBest Regards,\nAurelia\nExacoat Customer Support`,
  },
  missing_skins: {
    labelId: 'Bagian Skin Belum Dipotong Lengkap di Video',
    labelEn: 'Missing Claimed Skin Parts in Video',
    subjectId: (ref: string) => `[Exacoat] Video Bukti Belum Lengkap untuk Klaim Garansi #${ref}`,
    subjectEn: (ref: string) => `[Exacoat] Incomplete Proof Video for Warranty Claim #${ref}`,
    textId: (name: string, ref: string) =>
      `Halo kak ${name},\n\nMengenai pengajuan garansi pemasangan Exacoat untuk pesanan #${ref}.\n\nKami melihat masih ada bagian skin yang belum dipotong di dalam video bukti yang dilampirkan. Sesuai ketentuan garansi, seluruh bagian skin yang diajukan penggantian harus dipotong hingga terpisah.\n\nMohon kirimkan video pemotongan untuk seluruh bagian skin yang diklaim agar dapat kami setujui segera. Terima kasih!\n\nBest Regards,\nAurelia\nExacoat Customer Support`,
    textEn: (name: string, ref: string) =>
      `Hi ${name},\n\nRegarding your Exacoat warranty replacement claim for order #${ref}.\n\nWe noticed that some of the claimed skin parts are missing from the cutting proof video. According to our warranty terms, all skins requested for replacement must be cut.\n\nPlease send a video showing all claimed skin parts cut so we can proceed with your replacement. Thank you!\n\nBest Regards,\nAurelia\nExacoat Customer Support`,
  },
  unclear_video: {
    labelId: 'Video Buram / Tidak Dapat Diputar',
    labelEn: 'Video Unplayable or Unclear',
    subjectId: (ref: string) => `[Exacoat] Video Bukti Buram / Tidak Dapat Diputar #${ref}`,
    subjectEn: (ref: string) => `[Exacoat] Video Proof Unclear or Unplayable #${ref}`,
    textId: (name: string, ref: string) =>
      `Halo kak ${name},\n\nTerkait pengajuan garansi pemasangan Exacoat untuk pesanan #${ref}.\n\nVideo bukti yang diunggah tidak dapat kami putar atau resolusinya kurang jelas sehingga tim QC belum dapat melakukan verifikasi.\n\nBisa tolong kirimkan video bukti pemotongan skin secara langsung ke WhatsApp/email ini? Kami akan segera memproses penggantian setelah video diverifikasi. Terima kasih!\n\nBest Regards,\nAurelia\nExacoat Customer Support`,
    textEn: (name: string, ref: string) =>
      `Hi ${name},\n\nRegarding your Exacoat warranty claim for order #${ref}.\n\nWe were unable to play or clearly view the uploaded proof video, preventing our team from verifying the claim.\n\nCould you please send the video showing the cut skin directly in response to this message? We will process your replacement right away once verified. Thank you!\n\nBest Regards,\nAurelia\nExacoat Customer Support`,
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
  const [allowResubmit, setAllowResubmit] = useState(false);

  // Manual Customer Follow-up State (WhatsApp or Email)
  const [commChannel, setCommChannel] = useState<'whatsapp' | 'email' | null>(null);
  const [commLanguage, setCommLanguage] = useState<'id' | 'en'>('id');
  const [templateKey, setTemplateKey] = useState<'cut_incorrect' | 'missing_skins' | 'unclear_video'>('cut_incorrect');
  const [commMessage, setCommMessage] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [fromEmail, setFromEmail] = useState('support@exacoat.com');
  const [emailSubject, setEmailSubject] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const getOrderRef = (details: WarrantyClaimDetails | null) => {
    return String(details?.parent_order_number || details?.parent_order_id || details?.order_number || '');
  };

  const generateCommMessage = (
    tplKey: 'cut_incorrect' | 'missing_skins' | 'unclear_video',
    lang: 'id' | 'en',
    details: WarrantyClaimDetails | null
  ) => {
    const rawName = (details?.customer_name || '').trim();
    const firstName = rawName.split(' ')[0] || (lang === 'id' ? 'Kak' : 'Customer');
    const orderRef = getOrderRef(details);

    const tpl = COMM_TEMPLATES[tplKey];
    if (!tpl) return '';
    return lang === 'id' ? tpl.textId(firstName, orderRef) : tpl.textEn(firstName, orderRef);
  };

  const generateEmailSubject = (
    tplKey: 'cut_incorrect' | 'missing_skins' | 'unclear_video',
    lang: 'id' | 'en',
    details: WarrantyClaimDetails | null
  ) => {
    const orderRef = getOrderRef(details);
    const tpl = COMM_TEMPLATES[tplKey];
    if (!tpl) return '';
    return lang === 'id' ? tpl.subjectId(orderRef) : tpl.subjectEn(orderRef);
  };

  const handleSelectTemplate = (tplKey: 'cut_incorrect' | 'missing_skins' | 'unclear_video') => {
    setTemplateKey(tplKey);
    setCommMessage(generateCommMessage(tplKey, commLanguage, claim));
    setEmailSubject(generateEmailSubject(tplKey, commLanguage, claim));
  };

  const handleSelectLanguage = (lang: 'id' | 'en') => {
    setCommLanguage(lang);
    setCommMessage(generateCommMessage(templateKey, lang, claim));
    setEmailSubject(generateEmailSubject(templateKey, lang, claim));
  };

  const handleToggleWhatsApp = () => {
    setCommChannel((prev) => {
      const next = prev === 'whatsapp' ? null : 'whatsapp';
      if (next && claim) {
        setCommMessage(generateCommMessage(templateKey, commLanguage, claim));
        setEmailSubject(generateEmailSubject(templateKey, commLanguage, claim));
        if (claim.customer_phone) setCustomerPhone(claim.customer_phone);
        if (claim.customer_email) setCustomerEmail(claim.customer_email);
      }
      return next;
    });
  };

  const handleToggleEmail = () => {
    setCommChannel((prev) => {
      const next = prev === 'email' ? null : 'email';
      if (next && claim) {
        setCommMessage(generateCommMessage(templateKey, commLanguage, claim));
        setEmailSubject(generateEmailSubject(templateKey, commLanguage, claim));
        if (claim.customer_email) setCustomerEmail(claim.customer_email);
        if (claim.customer_phone) setCustomerPhone(claim.customer_phone);
      }
      return next;
    });
  };

  const handleSendWhatsApp = () => {
    const rawPhone = customerPhone || claim?.customer_phone || '';
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
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(commMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendEmail = async () => {
    const targetEmail = (customerEmail || claim?.customer_email || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast('warning', 'Valid Email Required', 'Customer email address is missing or invalid.');
      return;
    }
    if (!commMessage.trim()) {
      showToast('warning', 'Message Required', 'Please enter a message body.');
      return;
    }

    setIsSendingEmail(true);
    const res = await sendWarrantyClarificationEmailDirect({
      orderId,
      recipientEmail: targetEmail,
      recipientName: claim?.customer_name || 'Customer',
      subject: emailSubject.trim() || `[Exacoat] Warranty Claim Clarification #${getOrderRef(claim)}`,
      messageText: commMessage.trim(),
      fromEmail: fromEmail.trim() || 'support@exacoat.com',
      adminName: 'Aurelia',
    });
    setIsSendingEmail(false);

    if (res.success) {
      showToast('success', 'Email Sent', res.message || 'Clarification email sent to customer.');
      setCommChannel(null);
    } else {
      showToast('error', 'Email Delivery Failed', res.error || 'Failed to deliver email.');
    }
  };

  const handleOpenMailto = () => {
    const to = encodeURIComponent((customerEmail || claim?.customer_email || '').trim());
    const subj = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(commMessage);
    window.open(`mailto:${to}?subject=${subj}&body=${body}`, '_blank');
  };

  const loadDetails = async () => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);

    const res = await fetchWarrantyClaimDetails(orderId);
    if (res.success && res.data) {
      setClaim(res.data);
      if (res.data.customer_phone) {
        setCustomerPhone(res.data.customer_phone);
      }
      if (res.data.customer_email) {
        setCustomerEmail(res.data.customer_email);
      }
      setCommMessage(generateCommMessage(templateKey, commLanguage, res.data));
      setEmailSubject(generateEmailSubject(templateKey, commLanguage, res.data));
    } else {
      setError(res.error || 'Failed to load warranty claim details.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen && orderId) {
      setShowRejectInput(false);
      setRejectionReason('');
      setAllowResubmit(false);
      setCommChannel(null);
      setCommMessage('');
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
    const res = await reviewWarrantyClaimDirect(orderId, 'reject', rejectionReason, undefined, allowResubmit);
    setIsProcessing(false);

    if (res.success) {
      showToast(
        'info',
        'Claim Rejected',
        allowResubmit
          ? 'Warranty claim rejected, proof video purged, and customer unlocked to re-apply on website.'
          : 'Warranty claim rejected and video proof deleted from disk.'
      );
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
          <span>Warranty Claim Review {formatOrderNumber(claim?.order_number || orderId)}</span>
        </div>
      }
      subtitle="Verify customer skin cutting proof video and approve replacement"
      footer={
        <div className="flex w-full items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
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
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                commChannel === 'whatsapp'
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                  : "border-neutral-700 bg-neutral-800 text-emerald-400 hover:bg-neutral-700 hover:border-emerald-500/30"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              WhatsApp Customer
            </button>
            <button
              type="button"
              onClick={handleToggleEmail}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                commChannel === 'email'
                  ? "border-sky-500/50 bg-sky-500/20 text-sky-300"
                  : "border-neutral-700 bg-neutral-800 text-sky-400 hover:bg-neutral-700 hover:border-sky-500/30"
              )}
            >
              <Mail className="h-4 w-4" />
              Email Customer
            </button>
          </div>

          {claim?.rma_status === 'pending_review' && (
            <div className="flex items-center gap-2 flex-wrap">
              {!showRejectInput ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject Claim
                  </button>

                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve Claim
                  </button>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reason for rejection (e.g. skin not cut / wrong material)..."
                    className="h-9 w-60 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-xs text-white placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-neutral-300 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowResubmit}
                      onChange={(e) => setAllowResubmit(e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-900 text-red-500 focus:ring-0"
                    />
                    <span title="Unlock invoice so customer can re-apply on website">Unlock web re-submit</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isProcessing || !rejectionReason.trim()}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-500 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(false)}
                    className="text-xs text-neutral-400 hover:text-white px-1 cursor-pointer"
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
          {/* Warranty Extension Code Callout */}
          {claim.used_warranty_code && (
            <div className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-purple-200">
                    Warranty Code Override Applied
                  </p>
                  <p className="text-[11px] text-purple-300/80">
                    Customer used special code to override the 48-hour delivery deadline.
                  </p>
                </div>
              </div>
              <span className="rounded-lg border border-purple-500/40 bg-purple-950/60 px-2.5 py-1 font-mono text-xs font-bold text-purple-300">
                {claim.used_warranty_code}
              </span>
            </div>
          )}

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
                    <span>{formatOrderNumber(claim.parent_order_number || claim.parent_order_id)}</span>
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
          {commChannel === 'whatsapp' && (
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
                      "px-2.5 py-1 rounded font-medium transition-colors cursor-pointer",
                      commLanguage === 'id' ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-white"
                    )}
                  >
                    ID (Indonesia)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('en')}
                    className={clsx(
                      "px-2.5 py-1 rounded font-medium transition-colors cursor-pointer",
                      commLanguage === 'en' ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-white"
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
                  {(Object.keys(COMM_TEMPLATES) as Array<keyof typeof COMM_TEMPLATES>).map((key) => {
                    const tpl = COMM_TEMPLATES[key];
                    const isSelected = templateKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectTemplate(key)}
                        className={clsx(
                          "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors border cursor-pointer",
                          isSelected
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                        )}
                      >
                        {commLanguage === 'id' ? tpl.labelId : tpl.labelEn}
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
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0812... or 62812..."
                    className="h-7 w-48 rounded border border-neutral-700 bg-neutral-900 px-2 text-xs text-white placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <textarea
                  rows={4}
                  value={commMessage}
                  onChange={(e) => setCommMessage(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-white placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-neutral-500">
                    Clicking will open WhatsApp Web or Desktop with the prefilled message above.
                  </span>
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Open WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Interactive Assistant Panel */}
          {commChannel === 'email' && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                  <Mail className="h-4 w-4" />
                  <span>Send Clarification Email to Customer</span>
                </div>
                <div className="flex items-center gap-1 bg-neutral-900 rounded-lg p-0.5 border border-neutral-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('id')}
                    className={clsx(
                      "px-2.5 py-1 rounded font-medium transition-colors cursor-pointer",
                      commLanguage === 'id' ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
                    )}
                  >
                    ID (Indonesia)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('en')}
                    className={clsx(
                      "px-2.5 py-1 rounded font-medium transition-colors cursor-pointer",
                      commLanguage === 'en' ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
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
                  {(Object.keys(COMM_TEMPLATES) as Array<keyof typeof COMM_TEMPLATES>).map((key) => {
                    const tpl = COMM_TEMPLATES[key];
                    const isSelected = templateKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSelectTemplate(key)}
                        className={clsx(
                          "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors border cursor-pointer",
                          isSelected
                            ? "bg-sky-500/20 border-sky-500 text-sky-300"
                            : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                        )}
                      >
                        {commLanguage === 'id' ? tpl.labelId : tpl.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email Form */}
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 flex items-center justify-between font-medium">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-sky-400" />
                        <span>From (Sender Email):</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        Verified
                      </span>
                    </label>
                    <input
                      type="email"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="support@exacoat.com"
                      className="h-8 w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 text-xs text-white placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium">
                      <Mail className="h-3 w-3 text-neutral-500" />
                      <span>Recipient Email (To):</span>
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="customer@email.com"
                      className="h-8 w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 text-xs text-white placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium">
                      <FileText className="h-3 w-3 text-neutral-500" />
                      <span>Subject:</span>
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Email Subject..."
                      className="h-8 w-full rounded border border-neutral-700 bg-neutral-900 px-2.5 text-xs text-white placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-neutral-400 font-medium">Message Body:</label>
                    <span className="text-[10px] text-neutral-500">
                      Dispatched from {fromEmail || 'support@exacoat.com'}
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={commMessage}
                    onChange={(e) => setCommMessage(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-2.5 text-xs text-white placeholder:text-neutral-600 focus:border-sky-500 focus:outline-none leading-relaxed font-sans"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenMailto}
                    className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Open in Local Mail Client (mailto:)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || !customerEmail.trim() || !commMessage.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                  >
                    {isSendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Send Official Email</span>
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
                <span>Skin Cut Proof Video</span>
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
