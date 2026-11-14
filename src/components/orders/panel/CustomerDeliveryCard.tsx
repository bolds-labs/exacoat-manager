import { Check, Copy, ExternalLink, Loader2, Megaphone, Pencil, Truck, User } from 'lucide-react';
import type { Order } from '../../../types';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { IconButton } from '../../ds/IconButton';
import { Switch } from '../../ds/Switch';
import { WhatsAppIcon } from '../WhatsAppContactModal';
import { resolveCountryName } from '../../../lib/countries';
import { decodeHtmlEntities, formatCleanText } from '../../../lib/utils';
import { EmptyText, FieldLabel, InsetBox, linkClass } from './cardParts';

export interface EndorsementInfo {
  creator: string;
  handle?: string;
  platform?: string;
  campaign?: string;
  notes?: string;
}

export interface CustomerDeliveryCardProps {
  order: Order;
  isStorePickup: boolean;
  isSwitchingFulfillment: boolean;
  isStoreAddress: boolean;
  copiedField: string | null;
  /** Shop managers do not get the customer profile link. */
  canOpenCustomer: boolean;
  endorsement?: EndorsementInfo | null;
  onToggleStorePickup: () => void;
  onEditAddress: () => void;
  onCopy: (text: string, field: string) => void;
  onWhatsApp: () => void;
  onOpenCustomer: () => void;
}

/** Customer note without the courier hint lines checkout appends. */
export function cleanCustomerNote(raw?: string): string {
  return decodeHtmlEntities(String(raw || ''))
    .replace(/(?:shipping courier|jasa kirim|courier)\s*:\s*[^\r\n]+/gi, '')
    .trim();
}

export function addressLines(order: Order): string[] {
  const s = order.shipping || {};
  const b = order.billing || {};
  const line1 = [s.address_1 || b.address_1, s.address_2 || b.address_2].filter(Boolean).map((v) => formatCleanText(String(v))).join(', ');
  const city = formatCleanText(String(s.city || b.city || ''));
  const state = formatCleanText(String(s.state || b.state || ''));
  const postcode = String(s.postcode || b.postcode || '');
  const line2 = [[city, state].filter(Boolean).join(', '), postcode].filter(Boolean).join(' ');
  const countryCode = s.country || b.country;
  const country = countryCode ? resolveCountryName(countryCode) : '';
  return [line1, line2, country].filter((l) => l && l.trim());
}

function CopyButton({ copied, label, onClick }: { copied: boolean; label: string; onClick: () => void }) {
  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? 'Copied' : label}
      size="sm"
      variant="ghost"
      onClick={onClick}
      className="!h-6 !w-6 flex-none"
    />
  );
}

export function CustomerDeliveryCard({
  order,
  isStorePickup,
  isSwitchingFulfillment,
  isStoreAddress,
  copiedField,
  canOpenCustomer,
  endorsement,
  onToggleStorePickup,
  onEditAddress,
  onCopy,
  onWhatsApp,
  onOpenCustomer,
}: CustomerDeliveryCardProps) {
  const name = formatCleanText(order.customer_name) || (order.customer_id ? `Customer #${order.customer_id}` : 'Guest customer');
  const note = cleanCustomerNote(order.customer_note);
  const lines = addressLines(order);

  const fulfillmentControl = isStorePickup ? (
    <Button
      size="sm"
      icon={isSwitchingFulfillment ? Loader2 : Truck}
      disabled={isSwitchingFulfillment}
      onClick={onToggleStorePickup}
      title="Switch this order to courier delivery"
    >
      {isSwitchingFulfillment ? 'Updating...' : 'Switch to courier'}
    </Button>
  ) : (
    <Switch
      checked={false}
      label={isSwitchingFulfillment ? 'Updating...' : 'Store pickup'}
      disabled={isSwitchingFulfillment}
      onCheckedChange={onToggleStorePickup}
      title="Switch this order to store pickup"
      className="disabled:opacity-50"
    />
  );

  return (
    <Card
      icon={User}
      title="Customer & delivery"
      actions={
        <>
          {canOpenCustomer && (
            <Button size="sm" variant="ghost" trailingIcon={ExternalLink} onClick={onOpenCustomer} title="View customer profile and past orders">
              Customer profile
            </Button>
          )}
          {fulfillmentControl}
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0">
            <FieldLabel>Recipient</FieldLabel>
            <div className="break-words text-[13.5px] text-fg">{name}</div>
          </div>
          <div className="min-w-0">
            <FieldLabel>Email</FieldLabel>
            {order.customer_email ? (
              <div className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
                <a href={`mailto:${order.customer_email}`} className="min-w-0 truncate text-fg hover:text-accent-fg">
                  {order.customer_email}
                </a>
                <CopyButton copied={copiedField === 'email'} label="Copy email" onClick={() => onCopy(order.customer_email, 'email')} />
              </div>
            ) : (
              <EmptyText>No email</EmptyText>
            )}
          </div>
          <div className="min-w-0">
            <FieldLabel>Phone</FieldLabel>
            {order.customer_phone ? (
              <div className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
                <a href={`tel:${order.customer_phone}`} className="min-w-0 truncate font-mono text-fg hover:text-accent-fg">
                  {order.customer_phone}
                </a>
                <CopyButton copied={copiedField === 'phone'} label="Copy phone" onClick={() => onCopy(order.customer_phone!, 'phone')} />
                <button
                  type="button"
                  onClick={onWhatsApp}
                  aria-label="Contact customer via WhatsApp"
                  title="Contact customer via WhatsApp"
                  className="grid h-6 w-6 flex-none place-items-center rounded-md text-st-done-fg hover:bg-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <EmptyText>No phone</EmptyText>
            )}
          </div>
        </div>

        <div className="min-w-0 border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[12px] text-faint">{isStorePickup ? 'Store pickup location' : 'Destination address'}</span>
            <button type="button" onClick={onEditAddress} className={linkClass} title="Edit customer shipping address">
              <Pencil className="h-3 w-3" strokeWidth={1.8} aria-hidden />
              Edit
            </button>
          </div>
          {isStorePickup ? (
            <p className="m-0 text-[13.5px] leading-[1.6] text-fg">
              Exacoat Store Summarecon Bekasi
              <br />
              <span className="text-muted">
                Ruko Ruby Commercial TB12, Jl. Bulevar Selatan
                <br />
                Summarecon Bekasi, Kota Bekasi 17142
              </span>
              <br />
              <span className="text-[12.5px] text-faint">Store collection, direct handover</span>
            </p>
          ) : lines.length > 0 ? (
            <p className="m-0 break-words text-[13.5px] leading-[1.6] text-fg">
              {lines.map((l, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {l}
                </span>
              ))}
            </p>
          ) : (
            <EmptyText>No shipping address on this order</EmptyText>
          )}
          {!isStorePickup && isStoreAddress && (
            <InsetBox tone="act" className="mt-3 text-[12.5px] text-st-act-fg">
              <span>Address is set to the Exacoat store. </span>
              <button type="button" onClick={onEditAddress} className="font-medium underline underline-offset-2">
                Edit address
              </button>
            </InsetBox>
          )}
        </div>
      </div>

      {note && (
        <div className="mt-4 border-t border-line pt-4">
          <FieldLabel>Customer note</FieldLabel>
          <p className="m-0 whitespace-pre-wrap break-words text-[13.5px] leading-[1.5] text-fg">{note}</p>
        </div>
      )}

      {endorsement && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-2 flex items-center gap-2 text-[12px] text-faint">
            <Megaphone className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            Influencer endorsement
          </div>
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-[12px] text-faint">Creator</dt>
              <dd className="m-0 break-words text-fg">
                {endorsement.creator}
                {endorsement.handle && <span className="text-muted"> ({endorsement.handle})</span>}
              </dd>
            </div>
            {endorsement.platform && (
              <div className="min-w-0">
                <dt className="text-[12px] text-faint">Platform</dt>
                <dd className="m-0 break-words text-fg">{endorsement.platform}</dd>
              </div>
            )}
            {endorsement.campaign && (
              <div className="min-w-0">
                <dt className="text-[12px] text-faint">Campaign</dt>
                <dd className="m-0 break-words text-fg">{endorsement.campaign}</dd>
              </div>
            )}
            {endorsement.notes && (
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[12px] text-faint">Notes</dt>
                <dd className="m-0 whitespace-pre-wrap break-words text-fg">{endorsement.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </Card>
  );
}
