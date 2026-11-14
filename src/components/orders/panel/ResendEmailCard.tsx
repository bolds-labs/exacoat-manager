import { Check, CheckCircle2, ExternalLink, Mail } from 'lucide-react';
import { Button } from '../../ds/Button';
import { Card } from '../../ds/Card';
import { Select, type SelectOption } from '../../ds/Select';
import { TextField } from '../../ds/TextField';
import { Pill, linkClass } from './cardParts';

export const EMAIL_TEMPLATES: SelectOption[] = [
  { value: 'customer_order_processing', label: 'Order confirmation (processing)' },
  { value: 'customer_order_invoice', label: 'Order invoice / summary' },
  { value: 'customer_order_in_production', label: 'In production update' },
  { value: 'customer_order_awaiting_pickup', label: 'Ready for courier pickup' },
  { value: 'customer_order_shipped', label: 'Shipped & tracking code' },
  { value: 'customer_order_on_hold', label: 'Order on hold (awaiting payment)' },
  { value: 'customer_order_delivered', label: 'Order delivered' },
];

export const STORE_PICKUP_TEMPLATE: SelectOption = {
  value: 'customer_order_store_pickup_ready',
  label: 'Store pickup ready (Bekasi)',
};

export function emailTemplateOptions(isStorePickup: boolean): SelectOption[] {
  return isStorePickup ? [...EMAIL_TEMPLATES, STORE_PICKUP_TEMPLATE] : EMAIL_TEMPLATES;
}

export interface ResendEmailCardProps {
  isStorePickup: boolean;
  template: string;
  onTemplateChange: (v: string) => void;
  recipient: string;
  /** Fallback address shown as the placeholder when the field is cleared. */
  fallbackRecipient?: string;
  onRecipientChange: (v: string) => void;
  isSending: boolean;
  onSend: () => void;
  confirmationSent: boolean;
  lastResult: { message: string; latency_ms: number } | null;
  storeOrderUrl: string;
  onOpenLogs: () => void;
}

export function ResendEmailCard({
  isStorePickup,
  template,
  onTemplateChange,
  recipient,
  fallbackRecipient,
  onRecipientChange,
  isSending,
  onSend,
  confirmationSent,
  lastResult,
  storeOrderUrl,
  onOpenLogs,
}: ResendEmailCardProps) {
  const hasRecipient = Boolean(recipient || fallbackRecipient);
  return (
    <Card
      icon={Mail}
      title="Resend transactional email"
      actions={confirmationSent ? <Pill tone="done" icon={Check}>Confirmation sent</Pill> : undefined}
    >
      <Select label="Template" value={template} options={emailTemplateOptions(isStorePickup)} onChange={onTemplateChange} />
      <div className="mt-3 flex items-end gap-2.5">
        <TextField
          label="Recipient"
          type="email"
          mono
          value={recipient}
          onChange={(e) => onRecipientChange(e.target.value)}
          placeholder={fallbackRecipient || 'customer@domain.com'}
          className="min-w-0 flex-1"
        />
        <Button onClick={onSend} disabled={isSending || !hasRecipient} className="flex-none">
          {isSending ? 'Sending...' : 'Send'}
        </Button>
      </div>
      {lastResult && (
        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-st-done-fg">
          <CheckCircle2 className="h-3.5 w-3.5 flex-none" strokeWidth={1.8} aria-hidden />
          <span className="min-w-0 flex-1 break-words">{lastResult.message}</span>
          <span className="flex-none font-mono">{lastResult.latency_ms}ms</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <a href="#emails?tab=logs" onClick={onOpenLogs} className={linkClass}>
          Delivery logs
          <ExternalLink className="h-3 w-3" strokeWidth={1.8} aria-hidden />
        </a>
        <a href={storeOrderUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Open store order
          <ExternalLink className="h-3 w-3" strokeWidth={1.8} aria-hidden />
        </a>
      </div>
    </Card>
  );
}
