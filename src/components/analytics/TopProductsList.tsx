import type { FinancialChannel, TopFinancialProduct } from '../../lib/financialAnalyticsService';
import { formatCurrency } from '../../lib/formatters';
import { cleanItemTitle } from '../../lib/orderItems';
import { CHANNEL_DOT } from '../dashboard/ChannelSalesList';

export interface TopProductsListProps {
  products: TopFinancialProduct[];
  currency: string;
  limit?: number;
  /** Total sales, to show each product's share. */
  totalSales?: number;
  showChannels?: boolean;
  channelLabels?: Record<FinancialChannel, string>;
}

/** Ranked products by sales: name, units and sales, with an optional share bar. */
export function TopProductsList({ products, currency, limit = 5, totalSales, showChannels = false, channelLabels }: TopProductsListProps) {
  const rows = products.slice(0, limit);
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-muted">No paid orders in this period.</p>;
  }
  const max = Math.max(...rows.map((p) => p.revenue), 1);
  return (
    <ol className="divide-y divide-line">
      {rows.map((p, i) => {
        const share = totalSales && totalSales > 0 ? p.revenue / totalSales : null;
        return (
          <li key={`${p.name}-${i}`} className="flex items-center gap-3 py-2">
            <span className="w-4 flex-none text-right font-mono text-[12px] text-faint">{i + 1}</span>
            {p.imageUrl ? (
              <img src={p.imageUrl} alt="" loading="lazy" className="h-7 w-7 flex-none rounded-[7px] border border-line bg-chip object-cover" />
            ) : (
              <span className="h-7 w-7 flex-none rounded-[7px] bg-chip" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-fg" title={cleanItemTitle(p.name)}>
                {cleanItemTitle(p.name)}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-chip" aria-hidden>
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(p.revenue / max) * 100}%` }} />
                </span>
                {showChannels && (
                  <span className="flex flex-none items-center gap-1">
                    {p.channels.map((ch) => (
                      <span
                        key={ch}
                        className={`h-1.5 w-1.5 rounded-full ${CHANNEL_DOT[ch]}`}
                        title={channelLabels?.[ch] ?? ch}
                        aria-label={channelLabels?.[ch] ?? ch}
                      />
                    ))}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-none text-right">
              <div className="font-mono text-[13px] font-medium text-fg">{formatCurrency(p.revenue, currency)}</div>
              <div className="text-[12px] text-muted">
                {p.quantity.toLocaleString('en-US')} sold{share !== null ? ` · ${(share * 100).toFixed(1)}%` : ''}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
