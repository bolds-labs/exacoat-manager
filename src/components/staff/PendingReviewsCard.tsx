import { useState } from 'react';
import { ArrowRight, Check, Play, Star, X } from 'lucide-react';
import type { OrderReview } from '../../types';
import { Card } from '../ds/Card';
import { Button } from '../ds/Button';
import { Modal } from '../ds/Modal';
import { toast } from '../ds/toast';
import { formatDate } from '../../lib/formatters';
import { updateReviewStatusDirect } from '../../lib/wordpressBridge';
import { CardEmpty, CardError, CardLoading } from './StaffCardStates';
import type { LoadState } from './OverdueOrdersCard';

interface Props {
  state: LoadState<{ reviews: OrderReview[]; pending: number }>;
  onRetry: () => void;
  onChanged: (reviewId: number) => void;
  onViewAll: () => void;
}

type Decision = { review: OrderReview; status: 'approved' | 'rejected' };

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= full ? 'fill-current text-accent-fg' : 'text-faint'}`} strokeWidth={1.6} aria-hidden />
      ))}
    </span>
  );
}

export function PendingReviewsCard({ state, onRetry, onChanged, onViewAll }: Props) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);

  // Same status update the Reviews screen sends (POST /reviews/{id}/status).
  const confirm = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      const res = await updateReviewStatusDirect(decision.review.id, decision.status);
      if (res.success) {
        toast.success('Status Updated', `Review marked as ${decision.status}`);
        onChanged(decision.review.id);
        setDecision(null);
      } else {
        toast.error('Status Update Failed', res.error || res.message);
      }
    } catch (err) {
      toast.error('Status Update Error', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const pending = state.status === 'ready' ? state.data.pending : undefined;

  return (
    <Card
      icon={Star}
      title="Reviews waiting for approval"
      count={pending}
      actions={
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1 rounded-[7px] px-1.5 py-1 text-[12.5px] text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          View all reviews
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        </button>
      }
    >
      {state.status === 'loading' && <CardLoading label="Loading reviews..." />}
      {state.status === 'error' && <CardError message={`Could not load reviews: ${state.error}`} onRetry={onRetry} />}
      {state.status === 'missing' && <CardError message="The reviews endpoint is not available on the store." onRetry={onRetry} />}
      {state.status === 'ready' && state.data.reviews.length === 0 && <CardEmpty>No reviews are waiting for approval.</CardEmpty>}
      {state.status === 'ready' && state.data.reviews.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {state.data.reviews.map((r) => {
            const media = Array.isArray(r.media) ? r.media.slice(0, 4) : [];
            return (
              <li key={r.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <Stars rating={Number(r.rating) || 0} />
                    <span className="text-[13.5px] font-medium text-fg">{r.customer_name || 'Customer'}</span>
                    {r.artwork_title && <span className="truncate text-[12.5px] text-muted">{r.artwork_title}</span>}
                    <span className="text-[12px] text-faint">{formatDate(r.created_at)}</span>
                  </div>
                  {r.title && <p className="mt-1 text-[13px] font-medium text-fg">{r.title}</p>}
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[13px] text-muted">{r.content}</p>
                  {media.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {media.map((m, i) => (
                        <a
                          key={i}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block h-12 w-12 overflow-hidden rounded-[8px] border border-line bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          aria-label={m.type === 'video' ? 'Open review video' : 'Open review photo'}
                        >
                          <img src={m.poster_url || m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          {m.type === 'video' && (
                            <span className="absolute inset-0 grid place-items-center text-fg">
                              <span className="grid h-5 w-5 place-items-center rounded-full bg-pop">
                                <Play className="h-3 w-3" strokeWidth={2} aria-hidden />
                              </span>
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-none items-center gap-2">
                  <Button size="sm" variant="primary" icon={Check} onClick={() => setDecision({ review: r, status: 'approved' })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" icon={X} onClick={() => setDecision({ review: r, status: 'rejected' })}>
                    Reject
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {state.status === 'ready' && state.data.pending > state.data.reviews.length && (
        <p className="mt-3 text-[12px] text-faint">
          Showing {state.data.reviews.length} of {state.data.pending}. Open Reviews to see the rest.
        </p>
      )}

      <Modal
        open={decision !== null}
        onOpenChange={(o) => {
          if (!o && !busy) setDecision(null);
        }}
        title={decision?.status === 'approved' ? 'Approve this review?' : 'Reject this review?'}
        description={
          decision?.status === 'approved'
            ? 'It will show on the product page on exacoat.com.'
            : 'It stays hidden from the product page. You can approve it later in Reviews.'
        }
        width={460}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={decision?.status === 'approved' ? 'primary' : 'danger'} onClick={() => void confirm()} disabled={busy}>
              {busy ? 'Saving...' : decision?.status === 'approved' ? 'Approve review' : 'Reject review'}
            </Button>
          </>
        }
      >
        {decision && (
          <div className="rounded-[10px] border border-line bg-chip px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Stars rating={Number(decision.review.rating) || 0} />
              <span className="text-[13px] font-medium text-fg">{decision.review.customer_name || 'Customer'}</span>
            </div>
            <p className="mt-1 line-clamp-4 text-[13px] text-muted">{decision.review.content}</p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
