import React, { useState, useMemo } from 'react';
import { UnifiedFinancialRecord, FinancialChannel } from '../../lib/financialAnalyticsService';
import { GlassCard } from '../ui/GlassCard';
import { formatCurrency } from '../../lib/formatters';
import {
  Search,
  Download,
  Globe,
  ShoppingBag,
  Store,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { clsx } from 'clsx';

interface FinancialLedgerTableProps {
  records: UnifiedFinancialRecord[];
  allWindowRecords?: UnifiedFinancialRecord[];
  onExportCsv: () => void;
  primaryCurrency?: string;
}

export const FinancialLedgerTable: React.FC<FinancialLedgerTableProps> = ({
  records,
  allWindowRecords,
  onExportCsv,
  primaryCurrency = 'IDR',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | FinancialChannel>('all');
  const [statusScope, setStatusScope] = useState<'paid' | 'cancelled' | 'all'>('paid');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fullWindowList = allWindowRecords && allWindowRecords.length > 0 ? allWindowRecords : records;

  const cancelledList = useMemo(
    () => fullWindowList.filter(r => !r.isPaid || r.statusNormalized !== 'paid'),
    [fullWindowList]
  );

  const activeSourceList = useMemo(() => {
    if (statusScope === 'cancelled') return cancelledList;
    if (statusScope === 'all') return fullWindowList;
    return records;
  }, [statusScope, records, cancelledList, fullWindowList]);

  const filteredRecords = useMemo(() => {
    return activeSourceList.filter(rec => {
      if (channelFilter !== 'all' && rec.channel !== channelFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const matchOrder = rec.orderNumber.toLowerCase().includes(q);
      const matchCustomer = rec.customerName.toLowerCase().includes(q);
      const matchCity = (rec.customerCity || '').toLowerCase().includes(q);
      const matchStatus = rec.status.toLowerCase().includes(q);
      const matchItem = rec.items.some(it => it.name.toLowerCase().includes(q));
      return matchOrder || matchCustomer || matchCity || matchStatus || matchItem;
    });
  }, [activeSourceList, channelFilter, searchQuery]);

  const scopeTotals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, rec) => {
        const gross = rec.isPaid ? rec.grossRevenue : rec.potentialGrossRevenue;
        const paid = rec.isPaid ? rec.buyerPaidAmount : rec.potentialBuyerPaidAmount;
        acc.gross += gross;
        acc.paid += paid;
        acc.vouchers += rec.platformSubsidy + rec.sellerDiscount;
        acc.shipping += rec.shippingAndFees;
        acc.units += rec.itemsCount;
        return acc;
      },
      { gross: 0, paid: 0, vouchers: 0, shipping: 0, units: 0 }
    );
  }, [filteredRecords]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const getChannelBadge = (ch: FinancialChannel) => {
    switch (ch) {
      case 'webstore':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/25">
            <Globe className="w-2.5 h-2.5" />
            <span>Webstore</span>
          </span>
        );
      case 'shopee':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#ee4d2d]/10 text-[#ee4d2d] border border-[#ee4d2d]/25">
            <ShoppingBag className="w-2.5 h-2.5" />
            <span>Shopee</span>
          </span>
        );
      case 'tiktok':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/25">
            <Store className="w-2.5 h-2.5" />
            <span>TikTok</span>
          </span>
        );
    }
  };

  const getStatusBadge = (rec: UnifiedFinancialRecord) => {
    if (rec.isPaid && rec.statusNormalized === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span>PAID · {rec.status.toUpperCase()}</span>
        </span>
      );
    }

    if (rec.statusNormalized === 'cancelled') {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            <span>CANCELLED</span>
          </span>
          {rec.hadPayTime && (
            <span className="text-[9px] font-mono text-amber-400">
              Paid before cancel
            </span>
          )}
        </div>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        <span>{rec.status.toUpperCase()}</span>
      </span>
    );
  };

  return (
    <GlassCard className="overflow-hidden font-sans">
      <div className="p-4 sm:p-5 border-b border-white/[0.06] flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#f3aa18]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Financial Transactions Ledger
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Click any order row to inspect line items, platform voucher subsidies, seller promos, and buyer payment details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] sm:min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter order, buyer, item..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#090a0d] border border-white/[0.08] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#f3aa18]/50"
            />
          </div>

          <div className="p-1 rounded-xl bg-[#090a0d] border border-white/[0.08] flex items-center gap-1 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => {
                setStatusScope('paid');
                setCurrentPage(1);
              }}
              className={clsx(
                'px-2.5 py-1 rounded-md transition-all cursor-pointer font-semibold',
                statusScope === 'paid'
                  ? 'bg-emerald-500 text-zinc-950 shadow-xs font-bold'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              Paid ({records.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusScope('cancelled');
                setCurrentPage(1);
              }}
              className={clsx(
                'px-2.5 py-1 rounded-md transition-all cursor-pointer font-semibold',
                statusScope === 'cancelled'
                  ? 'bg-rose-500 text-white shadow-xs font-bold'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              Cancelled ({cancelledList.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusScope('all');
                setCurrentPage(1);
              }}
              className={clsx(
                'px-2.5 py-1 rounded-md transition-all cursor-pointer font-semibold',
                statusScope === 'all'
                  ? 'bg-white text-zinc-950 shadow-xs font-bold'
                  : 'text-neutral-400 hover:text-white'
              )}
            >
              All Placed ({fullWindowList.length})
            </button>
          </div>

          <div className="p-1 rounded-xl bg-[#090a0d] border border-white/[0.08] flex items-center gap-1 font-mono text-[10px]">
            {(['all', 'webstore', 'shopee', 'tiktok'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setChannelFilter(tab);
                  setCurrentPage(1);
                }}
                className={clsx(
                  'px-2 py-1 rounded-md transition-all cursor-pointer font-semibold uppercase',
                  channelFilter === tab
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                )}
              >
                {tab === 'all' ? 'All' : tab}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onExportCsv}
            className="px-3 py-1.5 rounded-xl bg-[#1a1b22] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-neutral-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            title="Export CSV spreadsheet for accounting"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filtered Summary Strip */}
      <div className="px-4 sm:px-5 py-2.5 bg-[#090a0d]/40 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-neutral-400">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            Orders: <strong className="text-white">{filteredRecords.length}</strong> ({scopeTotals.units} units)
          </span>
          <span>
            Gross Sales: <strong className="text-white">{formatCurrency(scopeTotals.gross, primaryCurrency)}</strong>
          </span>
          {scopeTotals.vouchers > 0 && (
            <span>
              Vouchers & Discounts: <strong className="text-amber-400">-{formatCurrency(scopeTotals.vouchers, primaryCurrency)}</strong>
            </span>
          )}
          {scopeTotals.shipping > 0 && (
            <span>
              Shipping & Fees: <strong className="text-sky-400">+{formatCurrency(scopeTotals.shipping, primaryCurrency)}</strong>
            </span>
          )}
          <span>
            Buyer Paid: <strong className="text-emerald-400">{formatCurrency(scopeTotals.paid, primaryCurrency)}</strong>
          </span>
        </div>
        <span className="text-[10px] text-neutral-500">
          {statusScope === 'paid'
            ? 'Showing verified paid orders'
            : statusScope === 'cancelled'
            ? 'Showing excluded cancelled/unpaid orders'
            : 'Showing all placed orders in window'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-neutral-300">
          <thead className="bg-[#090a0d]/60 text-[10px] uppercase font-mono tracking-wider text-neutral-400 border-b border-white/[0.06]">
            <tr>
              <th className="py-3 px-4">Order / ID</th>
              <th className="py-3 px-4">Channel</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Buyer / City</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-center">Units</th>
              <th className="py-3 px-4 text-right">Gross Sales</th>
              <th className="py-3 px-4 text-right">Vouchers / Fees</th>
              <th className="py-3 px-4 text-right">Buyer Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {paginatedRecords.map(rec => {
              const isExpanded = expandedOrderId === rec.id;
              const displayGross = rec.isPaid ? rec.grossRevenue : rec.potentialGrossRevenue;
              const displayPaid = rec.isPaid ? rec.buyerPaidAmount : rec.potentialBuyerPaidAmount;
              const voucherOrPromo = rec.platformSubsidy + rec.sellerDiscount;
              const hasDiff = voucherOrPromo > 0 || rec.shippingAndFees > 0;

              return (
                <React.Fragment key={rec.id}>
                  <tr
                    onClick={() => setExpandedOrderId(isExpanded ? null : rec.id)}
                    className={clsx(
                      'hover:bg-white/[0.03] transition-colors font-sans cursor-pointer',
                      isExpanded && 'bg-white/[0.03]'
                    )}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#f3aa18] shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        )}
                        <span>{rec.orderNumber}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getChannelBadge(rec.channel)}
                    </td>

                    <td className="py-3 px-4 font-mono text-neutral-400 whitespace-nowrap text-[11px]">
                      <div>{rec.dateFormatted}</div>
                      <div className="text-[10px] text-neutral-500">{rec.dateTimeFormatted.split(',').pop()?.trim()}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-white truncate max-w-[180px]">
                        {rec.customerName}
                      </div>
                      {rec.customerCity && (
                        <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[180px]">
                          {rec.customerCity}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(rec)}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-neutral-300">
                      {rec.itemsCount}
                    </td>

                    <td
                      className={clsx(
                        'py-3 px-4 text-right font-mono font-bold tabular-nums text-sm whitespace-nowrap',
                        rec.isPaid ? 'text-white' : 'text-neutral-500 line-through'
                      )}
                    >
                      {formatCurrency(displayGross, primaryCurrency)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-[11px] tabular-nums whitespace-nowrap">
                      {hasDiff ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {rec.platformSubsidy > 0 && (
                            <span className="text-amber-400" title="Platform Voucher Subsidy (Shopee / TikTok)">
                              -{formatCurrency(rec.platformSubsidy, primaryCurrency)} voucher
                            </span>
                          )}
                          {rec.sellerDiscount > 0 && (
                            <span className="text-amber-300" title="Seller Discount / Coupon">
                              -{formatCurrency(rec.sellerDiscount, primaryCurrency)} promo
                            </span>
                          )}
                          {rec.shippingAndFees > 0 && (
                            <span className="text-sky-400" title="Shipping & Buyer Service Fees">
                              +{formatCurrency(rec.shippingAndFees, primaryCurrency)} ship/fee
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-600">-</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                      {formatCurrency(displayPaid, primaryCurrency)}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-[#090a0d]/80 border-b border-white/[0.06]">
                      <td colSpan={9} className="p-4 sm:p-5">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* Left 2 Columns: Line Items */}
                          <div className="lg:col-span-2 space-y-2">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                              Order Line Items ({rec.itemsCount} {rec.itemsCount === 1 ? 'unit' : 'units'})
                            </div>
                            <div className="rounded-xl border border-white/[0.06] bg-[#121316] divide-y divide-white/[0.04]">
                              {rec.items.map((item, idx) => (
                                <div key={idx} className="p-3 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {item.imageUrl ? (
                                      <img
                                        src={item.imageUrl}
                                        alt={item.name}
                                        className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-[10px] font-mono text-neutral-500 shrink-0">
                                        SKIN
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-white truncate">
                                        {item.name}
                                      </div>
                                      <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-2 mt-0.5">
                                        <span>Qty: {item.quantity}</span>
                                        {item.sku && <span>· SKU: {item.sku}</span>}
                                        {item.originalPrice && item.originalPrice > item.price && (
                                          <span className="text-neutral-500 line-through">
                                            {formatCurrency(item.originalPrice, primaryCurrency)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right font-mono shrink-0">
                                    <div className="text-xs font-bold text-white tabular-nums">
                                      {formatCurrency(item.price * item.quantity, primaryCurrency)}
                                    </div>
                                    {item.quantity > 1 && (
                                      <div className="text-[10px] text-neutral-400 tabular-nums">
                                        {formatCurrency(item.price, primaryCurrency)} each
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right Column: Financial Breakdown Waterfall */}
                          <div className="space-y-2">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-bold">
                              Financial Reconciliation
                            </div>
                            <div className="p-3.5 rounded-xl border border-white/[0.06] bg-[#121316] space-y-2 font-mono text-xs">
                              {rec.originalProductPrice > displayGross && (
                                <div className="flex items-center justify-between text-neutral-400">
                                  <span>Original Listing Price:</span>
                                  <span className="tabular-nums line-through">
                                    {formatCurrency(rec.originalProductPrice, primaryCurrency)}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-white font-bold">
                                <span>Gross Product Sales:</span>
                                <span className="tabular-nums">
                                  {formatCurrency(displayGross, primaryCurrency)}
                                </span>
                              </div>

                              {rec.sellerDiscount > 0 && (
                                <div className="flex items-center justify-between text-amber-300">
                                  <span>
                                    Seller Discount / Coupon
                                    {rec.couponCodes && rec.couponCodes.length > 0
                                      ? ` (${rec.couponCodes.join(', ')})`
                                      : ''}
                                    :
                                  </span>
                                  <span className="tabular-nums">
                                    -{formatCurrency(rec.sellerDiscount, primaryCurrency)}
                                  </span>
                                </div>
                              )}

                              {rec.platformSubsidy > 0 && (
                                <div className="flex items-center justify-between text-amber-400">
                                  <span>Platform Voucher Subsidy:</span>
                                  <span className="tabular-nums">
                                    -{formatCurrency(rec.platformSubsidy, primaryCurrency)}
                                  </span>
                                </div>
                              )}

                              {rec.shippingAndFees > 0 && (
                                <div className="flex items-center justify-between text-sky-400">
                                  <span>Shipping & Service Fee:</span>
                                  <span className="tabular-nums">
                                    +{formatCurrency(rec.shippingAndFees, primaryCurrency)}
                                  </span>
                                </div>
                              )}

                              <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-emerald-400 font-bold">
                                <span>Buyer Paid (Checkout):</span>
                                <span className="tabular-nums">
                                  {formatCurrency(displayPaid, primaryCurrency)}
                                </span>
                              </div>

                              <div className="pt-2 border-t border-white/[0.06] space-y-1 text-[10px] text-neutral-400">
                                <div className="flex items-center justify-between">
                                  <span>Created:</span>
                                  <span className="text-neutral-300">{rec.dateTimeFormatted}</span>
                                </div>
                                {rec.payTimeFormatted && (
                                  <div className="flex items-center justify-between">
                                    <span>Paid At:</span>
                                    <span className="text-neutral-300">{rec.payTimeFormatted}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <span>Payment Method:</span>
                                  <span className="text-neutral-300">{rec.paymentMethod || '-'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {paginatedRecords.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-neutral-500 font-mono text-xs">
                  No financial transactions found matching current criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-3.5 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-neutral-400">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredRecords.length)} of {filteredRecords.length} orders
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Prev
            </button>
            <span className="px-2 font-bold text-white">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
};
