import { Mail, Play, Star, Video } from 'lucide-react';
import type { Order, OrderReview, OrderReviewMedia } from '../../../types';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { formatDate } from '../../../lib/formatters';
import { EmptyText, Pill, type Tone } from './cardParts';

export interface ReviewCardProps {
  order: Order;
  review: OrderReview | null;
  isSendingInvite: boolean;
  onSendInvite: () => void;
  onPreviewMedia: (media: OrderReviewMedia) => void;
}

const reviewTone: Record<string, Tone> = { featured: 'wait', approved: 'done', pending: 'act', rejected: 'stop' };

export function isDeliveredOrCompleted(status: string) {
  return status === 'delivered' || status === 'completed';
}

export function ReviewCard({ order, review, isSendingInvite, onSendInvite, onPreviewMedia }: ReviewCardProps) {
  const delivered = isDeliveredOrCompleted(order.status);
  const pill = review ? (
    <Pill tone={reviewTone[review.status as string] || 'neutral'} className="capitalize">
      {review.status}
    </Pill>
  ) : (
    <Pill>{delivered ? 'Awaiting collector' : 'Pre-delivery'}</Pill>
  );

  return (
    <Card icon={Star} title="Review & feedback" actions={pill}>
      {review ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3.5 w-3.5 ${s <= review.rating ? 'fill-accent text-accent' : 'text-line'}`}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="font-mono text-[12.5px] text-fg">{review.rating}.0</span>
              {review.verified_purchase && <Pill tone="done">Verified</Pill>}
            </div>
            <span className="font-mono text-[12px] text-faint">{formatDate(review.created_at)}</span>
          </div>
          {review.title && <b className="break-words text-[13.5px] font-medium text-fg">{review.title}</b>}
          <p className="m-0 whitespace-pre-wrap break-words text-[13.5px] leading-[1.5] text-fg">"{review.content}"</p>
          <div className="text-[12.5px] text-muted">
            {review.customer_name}
            {review.customer_location && <span className="text-faint"> ({review.customer_location})</span>}
          </div>
          {review.media && review.media.length > 0 && (
            <div className="border-t border-line pt-2.5">
              <span className="mb-2 block text-[12px] text-faint">Collector wall media ({review.media.length})</span>
              <div className="grid grid-cols-4 gap-2">
                {review.media.map((med, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onPreviewMedia(med)}
                    aria-label={med.type === 'video' ? 'Preview review video' : 'Preview review photo'}
                    className="relative aspect-square overflow-hidden rounded-lg border border-card-border bg-chip hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {med.type === 'video' ? (
                      med.poster_url ? (
                        <img src={med.poster_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-muted">
                          <Video className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                        </span>
                      )
                    ) : (
                      <img src={med.url} alt="" className="h-full w-full object-cover" />
                    )}
                    {med.type === 'video' && (
                      <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-pop text-fg">
                        <Play className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <EmptyText>No review yet.</EmptyText>
            {order.review_invited_at ? (
              <Pill tone="done">Invite sent {formatDate(order.review_invited_at)}</Pill>
            ) : order.review_invite_scheduled_at ? (
              <Pill tone="act">Auto-scheduled {formatDate(order.review_invite_scheduled_at)}</Pill>
            ) : null}
          </div>
          {delivered ? (
            <div className="flex flex-col gap-2">
              <EmptyText>The order is complete. You can send a review invitation to the collector.</EmptyText>
              <Button size="sm" icon={Mail} onClick={onSendInvite} disabled={isSendingInvite} className="self-start">
                {isSendingInvite ? 'Sending...' : order.review_invited_at ? 'Resend invitation' : 'Send review invitation'}
              </Button>
            </div>
          ) : (
            <EmptyText>The invite is sent automatically 36 hours after the order is marked delivered or completed.</EmptyText>
          )}
        </div>
      )}
    </Card>
  );
}
