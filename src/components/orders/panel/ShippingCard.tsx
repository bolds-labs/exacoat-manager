import type { FormEvent, ReactNode } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  HelpCircle,
  MapPin,
  Plane,
  Printer,
  RefreshCw,
  Send,
  Store,
  Truck,
} from 'lucide-react';
import type { Order } from '../../../types';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { Select, type SelectOption } from '../../ds/Select';
import { TextField } from '../../ds/TextField';
import { InsetBox, Pill } from './cardParts';

export interface GooritaUsInfo {
  orderId?: string;
  awbUrl?: string;
  service: string;
  isBooked: boolean;
}

export interface ShippingCardProps {
  order: Order;
  isStorePickup: boolean;
  isPrinted: boolean;
  courier: string;
  courierOptions: SelectOption[];
  /** Service name or raw courier match shown as the select's trailing tag. */
  courierTag?: string;
  customCourierName: string;
  customTrackingUrl: string;
  trackingNumber: string;
  onCourierChange: (v: string) => void;
  onCustomCourierNameChange: (v: string) => void;
  onCustomTrackingUrlChange: (v: string) => void;
  onTrackingNumberChange: (v: string) => void;
  onSaveTracking: (e: FormEvent) => void;
  isFulfilling: boolean;
  isSyncingTracking: boolean;
  onSyncTracking: () => void;
  onOpenTracking: () => void;
  showAllCheckpoints: boolean;
  onToggleCheckpoints: () => void;
  onPrintLabel: () => void;
  /** Domestic Goorita consolidation parcel: consolidated order IDs. */
  consolidation?: { orderIds: number[] } | null;
  gooritaUs?: GooritaUsInfo | null;
  onBookGoorita: () => void;
  onDownloadAwb: () => void;
  rayspeed?: { destination: string; trackUrl?: string } | null;
  isBookingRayspeed: boolean;
  onBookRayspeed: () => void;
}

function SubHead({ icon: Icon, title, tags }: { icon: typeof Truck; title: string; tags?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <Icon className="h-4 w-4 flex-none text-muted" strokeWidth={1.8} aria-hidden />
      <span className="text-[13.5px] font-medium text-fg">{title}</span>
      {tags}
    </div>
  );
}

export function ShippingCard(props: ShippingCardProps) {
  const { order, isStorePickup, isPrinted, onPrintLabel } = props;

  if (isStorePickup) {
    return (
      <Card icon={Store} title="Store pickup">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="m-0 min-w-0 flex-1 text-[13.5px] text-muted">
            <span className="block font-medium text-fg">Summarecon Bekasi store pickup</span>
            Direct store handover at Ruko Ruby Commercial TB12. Courier dispatch and shipping tracking do not apply.
          </p>
          <Button icon={Printer} onClick={onPrintLabel} className="self-start sm:self-auto">
            Workshop label
          </Button>
        </div>
      </Card>
    );
  }

  const {
    courier,
    courierOptions,
    courierTag,
    customCourierName,
    customTrackingUrl,
    trackingNumber,
    onCourierChange,
    onCustomCourierNameChange,
    onCustomTrackingUrlChange,
    onTrackingNumberChange,
    onSaveTracking,
    isFulfilling,
    isSyncingTracking,
    onSyncTracking,
    onOpenTracking,
    showAllCheckpoints,
    onToggleCheckpoints,
    consolidation,
    gooritaUs,
    onBookGoorita,
    onDownloadAwb,
    rayspeed,
    isBookingRayspeed,
    onBookRayspeed,
  } = props;

  const tracking = order.tracking;
  const hasRealResi = Boolean(tracking?.tracking_number && !tracking.tracking_number.startsWith('field_'));
  const checkpoints = tracking?.checkpoints || [];
  const isCustom = courier === 'custom';
  const canSave = !isFulfilling && Boolean(trackingNumber.trim()) && (!isCustom || Boolean(customCourierName.trim()));
  const latest = tracking?.latest_status;

  const resiField = (
    <TextField
      label="Tracking number (resi)"
      mono
      value={trackingNumber}
      onChange={(e) => onTrackingNumberChange(e.target.value)}
      placeholder={isCustom ? 'e.g. GB123456789' : 'Paste resi here'}
      className="min-w-0 flex-1"
    />
  );

  return (
    <Card
      icon={Truck}
      title="Shipping & tracking"
      actions={
        <>
          <span
            tabIndex={0}
            role="img"
            aria-label="Domestic orders (SiCepat, JNE, POS, J&T) are verified with Biteship live tracking. Delivered status automatically moves the order to Completed."
            title="Domestic orders (SiCepat, JNE, POS, J&T) are verified with Biteship live tracking. Delivered status automatically moves the order to Completed."
            className="grid h-6 w-6 place-items-center rounded-md text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          </span>
          {!isPrinted && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-st-act-fg">
              <Printer className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              Label not printed
            </span>
          )}
          {latest && <Pill tone={latest === 'delivered' ? 'done' : 'prog'}>{latest === 'delivered' ? 'Delivered' : latest.replace(/_/g, ' ')}</Pill>}
        </>
      }
    >
      <form onSubmit={onSaveTracking} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select
            label="Courier"
            value={courier || 'jne'}
            options={courierOptions}
            onChange={onCourierChange}
            tag={courierTag}
            className="sm:w-[340px] sm:flex-none"
          />
          {isCustom ? (
            <TextField
              label="Courier name"
              required
              value={customCourierName}
              onChange={(e) => onCustomCourierNameChange(e.target.value)}
              placeholder="e.g. Royal Mail, USPS, Aramex"
              className="min-w-0 flex-1"
            />
          ) : (
            resiField
          )}
          {!isCustom && (
            <Button type="submit" disabled={!canSave} className="self-start sm:self-auto">
              {isFulfilling ? 'Saving...' : 'Save tracking'}
            </Button>
          )}
        </div>
        {isCustom && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {resiField}
            <TextField
              label="Tracking URL (optional, %s = tracking code)"
              mono
              value={customTrackingUrl}
              onChange={(e) => onCustomTrackingUrlChange(e.target.value)}
              placeholder="https://carrier.com/track?no=%s"
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={!canSave} className="self-start sm:self-auto">
              {isFulfilling ? 'Saving...' : 'Save tracking'}
            </Button>
          </div>
        )}
      </form>

      {hasRealResi && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon={MapPin} onClick={onOpenTracking} title="Track shipment timeline">
            Track order
          </Button>
          <Button
            size="sm"
            icon={RefreshCw}
            disabled={isSyncingTracking}
            onClick={onSyncTracking}
            title="Sync live status and checkpoints with the carrier"
          >
            {isSyncingTracking ? 'Syncing...' : 'Sync status'}
          </Button>
        </div>
      )}

      {consolidation && (
        <InsetBox className="mt-4">
          <SubHead
            icon={Truck}
            title="Domestic JNE consolidation"
            tags={
              <>
                <Pill>Ciracas, Jakarta Timur</Pill>
                {consolidation.orderIds.length > 0 && (
                  <Pill tone="act">
                    {consolidation.orderIds.length} USA {consolidation.orderIds.length === 1 ? 'order' : 'orders'}
                  </Pill>
                )}
                <span className="ml-auto font-mono text-[12px] text-muted">Goorita HQ Hub</span>
              </>
            }
          />
          <p className="m-0 text-[13px] text-muted">
            Master domestic parcel dispatched to the Goorita freight forwarder hub (Jonathan Rio). Shipped via JNE Express.
          </p>
          {consolidation.orderIds.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-faint">Consolidated shipments:</span>
              {consolidation.orderIds.map((cid) => (
                <span key={cid} className="rounded-md bg-chip px-2 py-[1px] font-mono text-[12px] text-fg">
                  #{cid}
                </span>
              ))}
            </div>
          )}
          <Button size="sm" variant="primary" icon={Printer} onClick={onPrintLabel} className="mt-3">
            Print A6 JNE thermal label
          </Button>
        </InsetBox>
      )}

      {gooritaUs && (
        <InsetBox className="mt-4">
          <SubHead
            icon={Plane}
            title="Goorita US shipment"
            tags={
              <>
                <Pill>{order.shipping?.state ? `${order.shipping.state}, USA` : 'US destination'}</Pill>
                {gooritaUs.isBooked && <Pill tone="done">{gooritaUs.service}</Pill>}
                {gooritaUs.orderId && <span className="ml-auto font-mono text-[12px] text-muted">#{gooritaUs.orderId}</span>}
              </>
            }
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant={gooritaUs.isBooked ? 'secondary' : 'primary'} icon={Send} onClick={onBookGoorita}>
              {gooritaUs.isBooked ? 'Re-generate Goorita AWB' : 'Book Goorita production AWB'}
            </Button>
            <Button size="sm" icon={Printer} onClick={onPrintLabel}>
              {gooritaUs.isBooked ? 'Print 2-page A6 label' : 'Print A6 thermal label'}
            </Button>
            {gooritaUs.awbUrl && (
              <Button size="sm" icon={ExternalLink} onClick={onDownloadAwb}>
                View official AWB PDF
              </Button>
            )}
          </div>
        </InsetBox>
      )}

      {rayspeed && (
        <InsetBox className="mt-4">
          <SubHead
            icon={Plane}
            title="Rayspeed Asia"
            tags={
              <>
                <Pill>SEA dispatch ({rayspeed.destination || 'International'})</Pill>
                {tracking?.tracking_number && (
                  <span className="ml-auto break-all font-mono text-[12px] text-muted">{tracking.tracking_number}</span>
                )}
              </>
            }
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {(!tracking?.tracking_number || courier === 'rayspeed') && (
              <Button size="sm" variant="primary" icon={Send} onClick={onBookRayspeed} disabled={isBookingRayspeed}>
                {isBookingRayspeed ? 'Booking AWB...' : tracking?.tracking_number ? 'Re-generate AWB' : 'Dispatch via Rayspeed'}
              </Button>
            )}
            {tracking?.tracking_number && rayspeed.trackUrl && (
              <a
                href={rayspeed.trackUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-[30px] items-center gap-2 rounded-[8px] border border-field-border bg-field px-2.5 text-[12.5px] text-fg hover:bg-chip"
              >
                <ExternalLink className="h-[15px] w-[15px] text-muted" strokeWidth={1.8} aria-hidden />
                Track on Rayspeed
              </a>
            )}
          </div>
        </InsetBox>
      )}

      {checkpoints.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[12px] text-faint">Carrier checkpoints ({checkpoints.length})</span>
            {checkpoints.length > 1 && (
              <button
                type="button"
                onClick={onToggleCheckpoints}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-fg hover:underline"
              >
                {showAllCheckpoints ? 'Hide history' : 'View all checkpoints'}
                {showAllCheckpoints ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />}
              </button>
            )}
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {(showAllCheckpoints ? checkpoints : checkpoints.slice(0, 1)).map((cp, idx) => (
              <li key={idx} className="flex gap-2.5">
                <span
                  className={`mt-[7px] h-2 w-2 flex-none rounded-full ${
                    idx === 0 ? (latest === 'delivered' ? 'bg-st-done-fg' : 'bg-accent') : 'bg-faint'
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className={`m-0 break-words text-[13.5px] ${idx === 0 ? 'text-fg' : 'text-muted'}`}>{cp.description}</p>
                    {idx === 0 && cp.stage && <Pill>{cp.stage.replace(/_/g, ' ')}</Pill>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 font-mono text-[12px] text-faint">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden />
                      {cp.time}
                    </span>
                    {cp.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {cp.location}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
