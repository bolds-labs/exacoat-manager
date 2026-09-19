import React, { useState, useMemo } from 'react';
import { UnifiedFinancialRecord, FinancialChannel } from '../../lib/financialAnalyticsService';
import { GlassCard } from '../ui/GlassCard';
import { formatCurrency } from '../../lib/formatters';
import { Search, Download, Globe, ShoppingBag, Store, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { clsx } from 'clsx';

interface FinancialLedgerTableProps {
  records: UnifiedFinancialRecord[];
  onExportCsv: () => void;
  primaryCurrency?: string;
}

export const FinancialLedgerTable: React.FC<FinancialLedgerTableProps> = ({
  records,
  onExportCsv,
  primaryCurrency = 'IDR',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | FinancialChannel>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      if (channelFilter !== 'all' && rec.channel !== channelFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const matchOrder = rec.orderNumber.toLowerCase().includes(q);
      const matchCustomer = rec.customerName.toLowerCase().includes(q);
      const matchCity = (rec.customerCity || '').toLowerCase().includes(q);
      const matchStatus = rec.status.toLowerCase().includes(q);
      return matchOrder || matchCustomer || matchCity || matchStatus;
    });
  }, [records, channelFilter, searchQuery]);

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

  const getStatusBadge = (_statusNorm: string, rawStatus: string) => {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
        <span>PAID · {rawStatus.toUpperCase()}</span>
      </span>
    );
  };

  return (
    <GlassCard className="overflow-hidden font-sans">
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-white/[0.06] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#f3aa18]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Financial Transactions Ledger
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Verified paid customer checkouts (cancelled and unpaid orders excluded)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter order, customer, city..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#090a0d] border border-white/[0.08] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#f3aa18]/50"
            />
          </div>

          {/* Quick Sub-Channel Filter */}
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

          {/* Export CSV Button */}
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

      {/* Responsive Table Container */}
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
              <th className="py-3 px-4 text-right">Gross Total</th>
              <th className="py-3 px-4 text-right">Net Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {paginatedRecords.map(rec => (
              <tr
                key={rec.id}
                className="hover:bg-white/[0.02] transition-colors font-sans"
              >
                {/* Order Number */}
                <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                  {rec.orderNumber}
                </td>

                {/* Channel */}
                <td className="py-3 px-4 whitespace-nowrap">
                  {getChannelBadge(rec.channel)}
                </td>

                {/* Date */}
                <td className="py-3 px-4 font-mono text-neutral-400 whitespace-nowrap text-[11px]">
                  {rec.dateFormatted}
                </td>

                {/* Buyer / City */}
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

                {/* Status */}
                <td className="py-3 px-4 whitespace-nowrap">
                  {getStatusBadge(rec.statusNormalized, rec.status)}
                </td>

                {/* Items Count */}
                <td className="py-3 px-4 text-center font-mono font-bold text-neutral-300">
                  {rec.itemsCount}
                </td>

                {/* Gross Amount */}
                <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                  {formatCurrency(rec.grossRevenue, primaryCurrency)}
                </td>

                {/* Net Revenue */}
                <td className="py-3 px-4 text-right font-mono font-bold text-white tabular-nums text-sm">
                  {formatCurrency(rec.netRevenue, primaryCurrency)}
                </td>
              </tr>
            ))}

            {paginatedRecords.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-neutral-500 font-mono text-xs">
                  No financial transactions found matching current criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
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
