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
} from 'lucide-react';
import {
  fetchWarrantyClaimDetails,
  reviewWarrantyClaimDirect,
  WarrantyClaimDetails,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';

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

  const loadDetails = async () => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);

    const res = await fetchWarrantyClaimDetails(orderId);
    if (res.success && res.data) {
      setClaim(res.data);
    } else {
      setError(res.error || 'Failed to load warranty claim details.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen && orderId) {
      setShowRejectInput(false);
      setRejectionReason('');
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            Close
          </button>

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
                        onSelectParentOrder(claim.parent_order_id);
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
                    className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2.5"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-10 w-10 rounded-md object-cover border border-neutral-700"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-800 text-neutral-500">
                        <Scissors className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{item.name}</p>
                      <p className="text-[11px] text-neutral-500">Qty: {item.quantity} (Warranty Replacement)</p>
                    </div>
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
                  href={claim.video_proof_url}
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
                  src={claim.video_proof_url}
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
