import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ChannelMetrics } from '../../lib/financialAnalyticsService';
import type { MetricComparison } from '../../lib/periodComparison';
import { formatCurrency } from '../../lib/formatters';
import { ChangeChip } from '../dashboard/ChangeChip';

interface ChannelReconciliationCardProps {
  label: string;
  dotClass: string;
  metric: ChannelMetrics;
  currency: string;
  /** Gross sales change against the previous period. */
  change?: MetricComparison;
  periodLabel: string;
  selected: boolean;
  failed?: boolean;
  onShowOnly?: () => void;
}

const Line = ({ label, value, tone = 'text-fg' }: { label: string; value: string; tone?: string }) => (
  <div className="flex items-center justify-between gap-3 py-[3px]">
    <span className="text-muted">{label}</span>
    <span className={`font-mono tabular-nums ${tone}`}>{value}</span>
  </div>
);

/** One channel: gross, fees and payout in large numbers; fee and checkout lines on demand. */
export function ChannelReconciliationCard({
  label,
  dotClass,
  metric,
  currency,
  change,
  periodLabel,
  selected,
  failed = false,
  onShowOnly,
}: ChannelReconciliationCardProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const money = (v: number) => formatCurrency(v, currency);
  const deductions = metric.platformFees + metric.sellerVouchers;
  const feeLines = [
    { label: 'Admin / commission', value: metric.commissionFees },
    { label: 'Service fee', value: metric.serviceFees },
    { label: 'Order processing / transaction', value: metric.transactionFees },
    { label: 'Affiliate commission (AMS)', value: metric.affiliateCommissions },
    { label: 'Seller voucher / cashback', value: metric.sellerVouchers },
  ].filter((l) => l.value > 0);

  return (
    <section
      className={`flex flex-col rounded-[14px] border border-card-border bg-card px-5 py-[18px] ${selected ? '' : 'opacity-60'}`}
      aria-label={`${label} reconciliation`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-[5px] h-2.5 w-2.5 flex-none rounded-full ${dotClass}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{label}</h3>
          <p className="text-[12px] text-muted">
            {failed
              ? 'Could not load'
              : `${metric.ordersCount.toLocaleString('en-US')} ${metric.ordersCount === 1 ? 'order' : 'orders'}, ${metric.unitsSold.toLocaleString('en-US')} units, ${metric.percentageOfTotal}% of sales`}
          </p>
        </div>
        {onShowOnly && (
          <button
            type="button"
            onClick={onShowOnly}
            className="flex-none rounded-[7px] px-1.5 py-1 text-[12px] text-muted hover:bg-chip hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Show only
          </button>
        )}
      </div>

      <dl className="mt-3.5 flex flex-col gap-2.5">
        <div>
          <dt className="text-[12px] text-faint">Gross sales</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[20px] font-medium leading-tight text-fg">{money(metric.grossRevenue)}</span>
            {change && !failed && <ChangeChip comparison={change} periodLabel={periodLabel} formatValue={money} size="sm" />}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[12px] text-faint">Fees and vouchers</dt>
            <dd className={`font-mono text-[16px] font-medium ${deductions > 0 ? 'text-st-stop-fg' : 'text-muted'}`}>
              {deductions > 0 ? `-${money(deductions)}` : money(0)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-faint">Payout after fees</dt>
            <dd className="font-mono text-[16px] font-medium text-st-done-fg">{money(metric.cleanRevenue)}</dd>
          </div>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailsId}
        className="mt-3 flex items-center gap-1.5 self-start rounded-[7px] py-1 text-[12.5px] text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.8} aria-hidden />
        {open ? 'Hide fee lines' : 'Fee lines and checkout'}
      </button>

      {open && (
        <div id={detailsId} className="mt-2 border-t border-line pt-2 text-[12.5px]">
          {feeLines.length > 0 ? (
            feeLines.map((l) => <Line key={l.label} label={l.label} value={`-${money(l.value)}`} tone="text-st-stop-fg" />)
          ) : (
            <p className="py-1 text-faint">No seller fees recorded.</p>
          )}
          <div className="mt-1.5 border-t border-line pt-1.5">
            <Line label="Buyer paid (checkout)" value={money(metric.buyerPaidAmount)} />
            {metric.platformSubsidy > 0 && <Line label="Platform buyer vouchers" value={`-${money(metric.platformSubsidy)}`} tone="text-muted" />}
            {metric.shippingAndFees > 0 && <Line label="Shipping and buyer fees" value={`+${money(metric.shippingAndFees)}`} tone="text-muted" />}
            <Line label="Payout per order / gross per order" value={`${money(metric.cleanAov)} / ${money(metric.aov)}`} tone="text-muted" />
          </div>
          {metric.cancelledOrdersCount > 0 && (
            <div className="mt-1.5 border-t border-line pt-1.5">
              <Line
                label="Cancelled or unpaid (left out)"
                value={`${metric.cancelledOrdersCount} (${money(metric.cancelledGrossRevenue)})`}
                tone="text-faint"
              />
              {metric.paidThenCancelledCount > 0 && (
                <Line label="Gross incl. paid then cancelled" value={money(metric.grossRevenue + metric.paidThenCancelledGross)} tone="text-muted" />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
