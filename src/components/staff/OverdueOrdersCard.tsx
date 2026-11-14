import { ArrowRight, Globe2 } from 'lucide-react';
import { Card } from '../ds/Card';
import { Button } from '../ds/Button';
import { formatDate } from '../../lib/formatters';
import { formatDays, pickupSourceLabel, type OverdueOrder } from '../../lib/staffDashboard';
import { CardEmpty, CardError, CardLoading, PluginMissingNote } from './StaffCardStates';

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: T };

interface Props {
  state: LoadState<{ orders: OverdueOrder[]; truncated: boolean }>;
  onOpenOrder: (id: number) => void;
  onRetry: () => void;
}

const COURIER_NAMES: Record<string, string> = { goorita: 'Goorita', rayspeed: 'Rayspeed' };
const courierName = (c: string) => COURIER_NAMES[c.toLowerCase()] || c;

export function OverdueOrdersCard({ state, onOpenOrder, onRetry }: Props) {
  const count = state.status === 'ready' ? state.data.orders.length : undefined;
  return (
    <Card icon={Globe2} title="Overdue international orders" count={count}>
      <p className="-mt-2 mb-3 text-[12px] text-faint">Waiting for Courier Pickup outside Indonesia for more than 2 days. Mark them shipped once the courier has them.</p>
      {state.status === 'loading' && <CardLoading label="Loading orders..." />}
      {state.status === 'missing' && <PluginMissingNote what="The overdue list" />}
      {state.status === 'error' && <CardError message={`Could not load overdue orders: ${state.error}`} onRetry={onRetry} />}
      {state.status === 'ready' && state.data.orders.length === 0 && <CardEmpty>No international order is overdue.</CardEmpty>}
      {state.status === 'ready' && state.data.orders.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {state.data.orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-[13px] text-fg">#{o.number}</span>
                  <span className="truncate text-[13.5px] font-medium text-fg">{o.customer_name || 'Customer'}</span>
                  <span className="text-[12.5px] text-muted">{o.country_name || o.country}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted">
                  {pickupSourceLabel(o.pickup_source)} {formatDate(o.pickup_at)}
                  {o.courier && o.pickup_source !== 'goorita' && o.pickup_source !== 'rayspeed' && ` (${courierName(o.courier)})`}, still not shipped
                </div>
              </div>
              <span className="rounded-full border border-st-wait-border bg-st-wait-bg px-2 py-0.5 font-mono text-[12px] text-st-wait-fg">{formatDays(o.days)}</span>
              <Button size="sm" variant="secondary" trailingIcon={ArrowRight} onClick={() => onOpenOrder(o.id)}>
                Open order
              </Button>
            </li>
          ))}
        </ul>
      )}
      {state.status === 'ready' && state.data.truncated && (
        <p className="mt-3 text-[12px] text-faint">Only the oldest 300 orders waiting for pickup were checked.</p>
      )}
    </Card>
  );
}
