import type { ChannelMetrics, FinancialChannel } from '../../lib/financialAnalyticsService';
import type { MetricComparison } from '../../lib/periodComparison';
import { formatCurrency } from '../../lib/formatters';
import { formatCompactMoney } from '../../lib/compactMoney';
import { ChangeChip } from './ChangeChip';

/** Channel identity colours: dataviz categorical slots 1-3, validated for light and dark. */
export const CHANNEL_DOT: Record<FinancialChannel, string> = {
  webstore: 'bg-viz-1',
  shopee: 'bg-viz-2',
  tiktok: 'bg-viz-3',
};

export interface ChannelSalesListProps {
  channels: FinancialChannel[];
  breakdown: Record<FinancialChannel, ChannelMetrics>;
  changes: Record<FinancialChannel, MetricComparison>;
  currency: string;
  periodLabel: string;
  failedChannels?: FinancialChannel[];
  labels: Record<FinancialChannel, string>;
}

/** Share bar (2px surface gaps) plus one row per channel: amount, orders, share and change. */
export function ChannelSalesList({ channels, breakdown, changes, currency, periodLabel, failedChannels = [], labels }: ChannelSalesListProps) {
  const total = channels.reduce((sum, ch) => sum + (breakdown[ch]?.grossRevenue ?? 0), 0);
  const share = (ch: FinancialChannel) => (total > 0 ? (breakdown[ch]?.grossRevenue ?? 0) / total : 0);

  return (
    <div>
      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-chip" aria-hidden>
        {total > 0 &&
          channels.map((ch) =>
            share(ch) > 0 ? <span key={ch} className={`h-full ${CHANNEL_DOT[ch]}`} style={{ width: `${share(ch) * 100}%` }} /> : null,
          )}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {channels.map((ch) => {
          const m = breakdown[ch];
          const failed = failedChannels.includes(ch);
          return (
            <li key={ch} className="flex items-center gap-3 py-2.5">
              <span className={`h-2.5 w-2.5 flex-none rounded-full ${CHANNEL_DOT[ch]}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-medium text-fg">{labels[ch]}</span>
                  <span className="text-[12px] tabular-nums text-faint">{Math.round(share(ch) * 100)}%</span>
                </div>
                <div className="text-[12px] text-muted">
                  {failed ? 'Could not load' : `${(m?.ordersCount ?? 0).toLocaleString('en-US')} ${(m?.ordersCount ?? 0) === 1 ? 'order' : 'orders'}`}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono text-[14px] font-medium text-fg" title={formatCurrency(m?.grossRevenue ?? 0, currency)}>
                  {formatCompactMoney(m?.grossRevenue ?? 0, currency)}
                </span>
                {!failed && (
                  <ChangeChip
                    comparison={changes[ch]}
                    periodLabel={periodLabel}
                    formatValue={(v) => formatCurrency(v, currency)}
                    size="sm"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
