import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import type { FinancialChannel, UnifiedFinancialRecord } from '../../lib/financialAnalyticsService';
import { formatCurrency } from '../../lib/formatters';
import { cleanItemTitle } from '../../lib/orderItems';
import { Button } from '../ds/Button';
import { Select } from '../ds/Select';
import { SearchField } from '../ds/SearchField';
import { Tabs } from '../ds/Tabs';
import { familyChipClass } from '../ds/StatusChip';
import { CHANNEL_DOT } from '../dashboard/ChannelSalesList';

interface FinancialLedgerTableProps {
  records: UnifiedFinancialRecord[];
  allWindowRecords?: UnifiedFinancialRecord[];
  onExportCsv: () => void;
  primaryCurrency?: string;
}

const CHANNEL_NAME: Record<FinancialChannel, string> = { webstore: 'Webstore', shopee: 'Shopee', tiktok: 'TikTok Shop' };
const PAGE_SIZE = 15;

const th = 'border-b border-line px-3 py-2.5 text-left text-[12px] font-[450] text-faint whitespace-nowrap';
const td = 'border-b border-line px-3 py-[11px] align-middle';

function StatusPill({ rec }: { rec: UnifiedFinancialRecord }) {
  const paid = rec.isPaid && rec.statusNormalized === 'paid';
  const family = paid ? 'done' : rec.statusNormalized === 'cancelled' || rec.statusNormalized === 'refunded' ? 'stop' : 'wait';
  const label = paid ? `Paid, ${rec.status.toLowerCase()}` : rec.statusNormalized === 'cancelled' ? 'Cancelled' : rec.status;
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className={`inline-flex max-w-full items-center truncate rounded-[7px] px-2 py-[2px] text-[12px] font-medium ${familyChipClass[family]}`}>
        {label}
      </span>
      {rec.statusNormalized === 'cancelled' && rec.hadPayTime && <span className="text-[11.5px] text-faint">Paid before cancel</span>}
    </span>
  );
}

const DetailLine = ({ label, value, tone = 'text-fg', strong = false }: { label: string; value: string; tone?: string; strong?: boolean }) => (
  <div className={`flex items-center justify-between gap-3 py-[3px] ${strong ? 'font-medium' : ''}`}>
    <span className="text-muted">{label}</span>
    <span className={`font-mono tabular-nums ${tone}`}>{value}</span>
  </div>
);

/** Every order in the period, in the Orders table style; a row opens its fee and checkout reconciliation. */
export const FinancialLedgerTable: React.FC<FinancialLedgerTableProps> = ({ records, allWindowRecords, onExportCsv, primaryCurrency = 'IDR' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | FinancialChannel>('all');
  const [statusScope, setStatusScope] = useState<'paid' | 'cancelled' | 'all'>('paid');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const money = (v: number) => formatCurrency(v, primaryCurrency);

  const fullWindowList = allWindowRecords && allWindowRecords.length > 0 ? allWindowRecords : records;
  const cancelledList = useMemo(() => fullWindowList.filter((r) => !r.isPaid || r.statusNormalized !== 'paid'), [fullWindowList]);
  const activeSourceList = statusScope === 'cancelled' ? cancelledList : statusScope === 'all' ? fullWindowList : records;

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeSourceList.filter((rec) => {
      if (channelFilter !== 'all' && rec.channel !== channelFilter) return false;
      if (!q) return true;
      return (
        rec.orderNumber.toLowerCase().includes(q) ||
        rec.customerName.toLowerCase().includes(q) ||
        (rec.customerCity || '').toLowerCase().includes(q) ||
        rec.status.toLowerCase().includes(q) ||
        rec.items.some((it) => it.name.toLowerCase().includes(q))
      );
    });
  }, [activeSourceList, channelFilter, searchQuery]);

  const totals = useMemo(
    () =>
      filteredRecords.reduce(
        (acc, rec) => {
          acc.gross += rec.isPaid ? rec.grossRevenue : rec.potentialGrossRevenue;
          acc.clean += rec.isPaid ? rec.cleanRevenue : rec.potentialCleanRevenue;
          acc.paid += rec.isPaid ? rec.buyerPaidAmount : rec.potentialBuyerPaidAmount;
          acc.fees += rec.platformFee + rec.sellerVoucher;
          acc.vouchers += rec.platformSubsidy;
          acc.units += rec.itemsCount;
          return acc;
        },
        { gross: 0, clean: 0, fees: 0, paid: 0, vouchers: 0, units: 0 },
      ),
    [filteredRecords],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageRows = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = () => setCurrentPage(1);

  return (
    <section className="overflow-hidden rounded-[14px] border border-card-border bg-card font-sans text-[13.5px]" aria-label="Orders ledger">
      {/* Title and filters */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
          <FileSpreadsheet className="h-[15px] w-[15px] text-faint" strokeWidth={1.8} aria-hidden />
          Orders ledger
        </h3>
        <Tabs
          items={[
            { key: 'paid', label: 'Paid', count: records.length },
            { key: 'cancelled', label: 'Cancelled or unpaid', count: cancelledList.length },
            { key: 'all', label: 'All placed', count: fullWindowList.length },
          ]}
          value={statusScope}
          onChange={(k) => {
            setStatusScope(k as typeof statusScope);
            resetPage();
          }}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            aria-label="Channel"
            className="w-[150px]"
            value={channelFilter}
            onChange={(v) => {
              setChannelFilter(v as typeof channelFilter);
              resetPage();
            }}
            options={[
              { value: 'all', label: 'All channels' },
              { value: 'webstore', label: 'Webstore' },
              { value: 'shopee', label: 'Shopee' },
              { value: 'tiktok', label: 'TikTok Shop' },
            ]}
          />
          <SearchField
            className="w-[230px]"
            placeholder="Search order, buyer, item"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              resetPage();
            }}
          />
          <Button icon={Download} onClick={onExportCsv} title="Export the report as a CSV file for accounting">
            Export CSV
          </Button>
        </div>
      </div>

      {/* Totals for the rows shown */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line bg-chip px-4 py-2 text-[12.5px] text-muted">
        <span>
          <span className="font-mono text-fg">{filteredRecords.length.toLocaleString('en-US')}</span> orders,{' '}
          <span className="font-mono text-fg">{totals.units.toLocaleString('en-US')}</span> units
        </span>
        <span>
          Gross <span className="font-mono text-fg">{money(totals.gross)}</span>
        </span>
        {totals.fees > 0 && (
          <span>
            Fees <span className="font-mono text-st-stop-fg">-{money(totals.fees)}</span>
          </span>
        )}
        <span>
          Payout <span className="font-mono text-st-done-fg">{money(totals.clean)}</span>
        </span>
        <span>
          Buyer paid <span className="font-mono text-fg">{money(totals.paid)}</span>
        </span>
        {totals.vouchers > 0 && (
          <span>
            Platform vouchers <span className="font-mono text-fg">-{money(totals.vouchers)}</span>
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Channel</th>
              <th className={th}>Date</th>
              <th className={th}>Buyer</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Units</th>
              <th className={`${th} text-right`}>Gross sales</th>
              <th className={`${th} text-right`}>Fees</th>
              <th className={`${th} text-right`}>Payout</th>
              <th className={`${th} text-right`}>Buyer paid</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-14 text-center text-[13px] text-muted">
                  No orders match these filters.
                </td>
              </tr>
            )}
            {pageRows.map((rec) => {
              const expanded = expandedOrderId === rec.id;
              const gross = rec.isPaid ? rec.grossRevenue : rec.potentialGrossRevenue;
              const clean = rec.isPaid ? rec.cleanRevenue : rec.potentialCleanRevenue;
              const paid = rec.isPaid ? rec.buyerPaidAmount : rec.potentialBuyerPaidAmount;
              const fees = rec.platformFee + rec.sellerVoucher;
              const toggle = () => setExpandedOrderId(expanded ? null : rec.id);
              return (
                <React.Fragment key={rec.id}>
                  <tr
                    onClick={toggle}
                    className={`cursor-pointer whitespace-nowrap transition-colors ${expanded ? 'bg-chip' : 'hover:bg-chip'}`}
                  >
                    <td className={td}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle();
                        }}
                        aria-expanded={expanded}
                        className="flex items-center gap-1.5 rounded-[6px] font-mono text-[13px] font-medium text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-faint" strokeWidth={1.8} aria-hidden />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-faint" strokeWidth={1.8} aria-hidden />
                        )}
                        {rec.orderNumber}
                      </button>
                    </td>
                    <td className={td}>
                      <span className="flex items-center gap-1.5 text-[13px] text-fg">
                        <span className={`h-2 w-2 rounded-full ${CHANNEL_DOT[rec.channel]}`} aria-hidden />
                        {CHANNEL_NAME[rec.channel]}
                      </span>
                    </td>
                    <td className={td}>
                      <div className="text-[13px] text-fg">{rec.dateFormatted}</div>
                      <div className="text-[12px] text-faint">{rec.dateTimeFormatted.split(',').pop()?.trim()}</div>
                    </td>
                    <td className={td}>
                      <div className="max-w-[180px] truncate text-[13px] font-medium text-fg">{rec.customerName}</div>
                      {rec.customerCity && <div className="max-w-[180px] truncate text-[12px] text-muted">{rec.customerCity}</div>}
                    </td>
                    <td className={td}>
                      <StatusPill rec={rec} />
                    </td>
                    <td className={`${td} text-right font-mono text-[13px] text-fg`}>{rec.itemsCount}</td>
                    <td className={`${td} text-right font-mono text-[13px] ${rec.isPaid ? 'text-fg' : 'text-faint line-through'}`}>{money(gross)}</td>
                    <td className={`${td} text-right font-mono text-[13px]`}>
                      {fees > 0 ? <span className="text-st-stop-fg">-{money(fees)}</span> : <span className="text-faint">-</span>}
                    </td>
                    <td className={`${td} text-right font-mono text-[13px] text-st-done-fg`}>{money(clean)}</td>
                    <td className={`${td} text-right`}>
                      <div className="font-mono text-[13px] text-fg">{money(paid)}</div>
                      {rec.platformSubsidy > 0 && (
                        <div className="text-[12px] text-muted" title="Buyer voucher paid for by the marketplace">
                          -{money(rec.platformSubsidy)} voucher
                        </div>
                      )}
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="bg-chip">
                      <td colSpan={10} className="border-b border-line px-4 py-4">
                        <div className="grid grid-cols-1 gap-4 text-[12.5px] lg:grid-cols-12">
                          <div className="lg:col-span-5">
                            <div className="mb-1.5 text-[12px] text-faint">
                              Items ({rec.itemsCount} {rec.itemsCount === 1 ? 'unit' : 'units'})
                            </div>
                            <div className="divide-y divide-line rounded-[10px] border border-card-border bg-card">
                              {rec.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt="" className="h-8 w-8 flex-none rounded-[7px] border border-line object-cover" />
                                    ) : (
                                      <span className="h-8 w-8 flex-none rounded-[7px] bg-chip" aria-hidden />
                                    )}
                                    <div className="min-w-0">
                                      <div className="truncate font-medium text-fg">{cleanItemTitle(item.name)}</div>
                                      <div className="flex items-center gap-2 text-[12px] text-muted">
                                        <span>Qty {item.quantity}</span>
                                        {item.sku && <span>SKU {item.sku}</span>}
                                        {item.originalPrice && item.originalPrice > item.price && (
                                          <span className="text-faint line-through">{money(item.originalPrice)}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex-none text-right font-mono">
                                    <div className="text-fg">{money(item.price * item.quantity)}</div>
                                    {item.quantity > 1 && <div className="text-[12px] text-muted">{money(item.price)} each</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 rounded-[10px] border border-card-border bg-card px-3 py-2">
                              <DetailLine label="Created" value={rec.dateTimeFormatted} />
                              {rec.payTimeFormatted && <DetailLine label="Paid at" value={rec.payTimeFormatted} />}
                              <DetailLine label="Payment method" value={rec.paymentMethod || '-'} />
                            </div>
                          </div>

                          <div className="lg:col-span-4">
                            <div className="mb-1.5 text-[12px] text-faint">Payout reconciliation</div>
                            <div className="rounded-[10px] border border-card-border bg-card px-3 py-2">
                              <DetailLine label="Gross product sales" value={money(gross)} strong />
                              {rec.sellerVoucher > 0 && <DetailLine label="Seller voucher / coupon" value={`-${money(rec.sellerVoucher)}`} tone="text-st-stop-fg" />}
                              {rec.commissionFee > 0 && <DetailLine label="Admin / commission" value={`-${money(rec.commissionFee)}`} tone="text-st-stop-fg" />}
                              {rec.serviceFee > 0 && <DetailLine label="Service fee" value={`-${money(rec.serviceFee)}`} tone="text-st-stop-fg" />}
                              {rec.transactionFee > 0 && (
                                <DetailLine label="Order processing / transaction" value={`-${money(rec.transactionFee)}`} tone="text-st-stop-fg" />
                              )}
                              {rec.affiliateCommission > 0 && (
                                <DetailLine label="Affiliate commission (AMS)" value={`-${money(rec.affiliateCommission)}`} tone="text-st-stop-fg" />
                              )}
                              {rec.otherPlatformFee > 0 && <DetailLine label="Other platform fee" value={`-${money(rec.otherPlatformFee)}`} tone="text-st-stop-fg" />}
                              {fees > 0 && (
                                <div className="mt-1 border-t border-line pt-1">
                                  <DetailLine label="Total seller fees" value={`-${money(fees)}`} tone="text-st-stop-fg" strong />
                                </div>
                              )}
                              <div className="mt-1 border-t border-line pt-1">
                                <DetailLine label="Payout after fees" value={money(clean)} tone="text-st-done-fg" strong />
                              </div>
                            </div>
                          </div>

                          <div className="lg:col-span-3">
                            <div className="mb-1.5 text-[12px] text-faint">Buyer checkout</div>
                            <div className="rounded-[10px] border border-card-border bg-card px-3 py-2">
                              <DetailLine label="Product price" value={money(gross)} />
                              {rec.platformSubsidy > 0 && <DetailLine label="Platform voucher" value={`-${money(rec.platformSubsidy)}`} tone="text-muted" />}
                              {rec.shippingAndFees > 0 && <DetailLine label="Shipping and fees" value={`+${money(rec.shippingAndFees)}`} tone="text-muted" />}
                              <div className="mt-1 border-t border-line pt-1">
                                <DetailLine label="Buyer paid" value={money(paid)} strong />
                              </div>
                              {rec.platformSubsidy > 0 && (
                                <p className="pt-1 text-[12px] leading-relaxed text-faint">
                                  Platform vouchers are paid by the marketplace and do not reduce your payout.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 text-[13px] text-muted sm:flex-row">
        <span>
          Showing <span className="font-mono font-medium text-fg">{filteredRecords.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}</span> to{' '}
          <span className="font-mono font-medium text-fg">{Math.min(page * PAGE_SIZE, filteredRecords.length)}</span> of{' '}
          <span className="font-mono font-medium text-fg">{filteredRecords.length}</span> orders
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => setCurrentPage(Math.max(1, page - 1))} disabled={page <= 1}>
            Prev
          </Button>
          <span className="px-1.5 font-mono text-[12.5px] text-fg">
            Page {page} of {totalPages}
          </span>
          <Button size="sm" onClick={() => setCurrentPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      </div>
    </section>
  );
};
