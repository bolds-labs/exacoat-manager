import React from 'react';
import { FinancialChannel, ChannelMetrics } from '../../lib/financialAnalyticsService';
import { GlassCard } from '../ui/GlassCard';
import { formatCurrency } from '../../lib/formatters';
import { Globe, ShoppingBag, Store, Layers } from 'lucide-react';
import { clsx } from 'clsx';

interface ChannelRevenueBreakdownCardProps {
  breakdown: Record<FinancialChannel, ChannelMetrics>;
  totalNetRevenue: number;
  selectedChannels: FinancialChannel[];
  onSelectChannelOnly?: (channel: FinancialChannel) => void;
}

export const ChannelRevenueBreakdownCard: React.FC<ChannelRevenueBreakdownCardProps> = ({
  breakdown,
  totalNetRevenue,
  selectedChannels,
  onSelectChannelOnly,
}) => {
  const channels: Array<{
    id: FinancialChannel;
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    barColor: string;
    borderColor: string;
    bgTint: string;
  }> = [
    {
      id: 'webstore',
      name: 'Webstore (Direct)',
      icon: Globe,
      accentColor: 'text-[#f3aa18]',
      barColor: 'bg-[#f3aa18]',
      borderColor: 'border-[#f3aa18]/30',
      bgTint: 'bg-[#f3aa18]/[0.03]',
    },
    {
      id: 'shopee',
      name: 'Shopee Official',
      icon: ShoppingBag,
      accentColor: 'text-[#ee4d2d]',
      barColor: 'bg-[#ee4d2d]',
      borderColor: 'border-[#ee4d2d]/30',
      bgTint: 'bg-[#ee4d2d]/[0.03]',
    },
    {
      id: 'tiktok',
      name: 'TikTok Shop',
      icon: Store,
      accentColor: 'text-[#06b6d4]',
      barColor: 'bg-[#06b6d4]',
      borderColor: 'border-[#06b6d4]/30',
      bgTint: 'bg-[#06b6d4]/[0.03]',
    },
  ];

  const totalGross = channels.reduce((sum, ch) => sum + (breakdown[ch.id]?.grossRevenue || 0), 0) || totalNetRevenue;
  const safeTotal = totalGross > 0 ? totalGross : 1;

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div>
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#f3aa18]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Channel Reconciliation & Fees
            </h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            {selectedChannels.length} active {selectedChannels.length === 1 ? 'channel' : 'channels'}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="h-2.5 w-full bg-white/[0.06] rounded-full overflow-hidden flex">
            {channels.map(ch => {
              const metric = breakdown[ch.id];
              const pct = totalGross > 0 ? (metric.grossRevenue / safeTotal) * 100 : 0;
              if (pct <= 0) return null;

              return (
                <div
                  key={ch.id}
                  className={clsx('h-full transition-all duration-500', ch.barColor)}
                  style={{ width: `${pct}%` }}
                  title={`${ch.name}: ${pct.toFixed(1)}%`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-400">
            {channels.map(ch => {
              const metric = breakdown[ch.id];
              const pct = totalGross > 0 ? Math.round((metric.grossRevenue / safeTotal) * 100) : 0;
              return (
                <div key={ch.id} className="flex items-center gap-1.5">
                  <span className={clsx('w-2 h-2 rounded-full', ch.barColor)} />
                  <span className="text-neutral-300 font-sans">{ch.name}:</span>
                  <span className="font-bold tabular-nums text-white">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {channels.map(ch => {
            const metric = breakdown[ch.id];
            const Icon = ch.icon;
            const isSelected = selectedChannels.includes(ch.id);
            const totalDeductions = metric.platformFees + metric.sellerVouchers;
            const hasFeeBreakdown =
              metric.commissionFees > 0 ||
              metric.serviceFees > 0 ||
              metric.transactionFees > 0 ||
              metric.affiliateCommissions > 0 ||
              metric.sellerVouchers > 0;

            return (
              <div
                key={ch.id}
                onClick={() => onSelectChannelOnly && onSelectChannelOnly(ch.id)}
                className={clsx(
                  'p-3.5 rounded-xl border transition-all flex flex-col justify-between group cursor-pointer',
                  isSelected
                    ? `${ch.bgTint} ${ch.borderColor} hover:border-white/30`
                    : 'bg-white/[0.02] border-white/[0.06] opacity-60 hover:opacity-100 hover:border-white/20'
                )}
                title={`Click to focus solely on ${ch.name}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={clsx('w-4 h-4', ch.accentColor)} />
                    <span className="text-xs font-bold text-white tracking-tight">
                      {ch.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-neutral-400">
                      {metric.ordersCount} {metric.ordersCount === 1 ? 'order' : 'orders'} ({metric.unitsSold} units)
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300 border border-white/[0.06]">
                      {metric.percentageOfTotal}%
                    </span>
                  </div>
                </div>

                {/* 3-Column Mini Ledger Strip: Gross -> Platform Fees -> Clean Revenue */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#090a0d]/70 border border-white/[0.05] my-1">
                  <div>
                    <span className="text-[9px] font-mono uppercase text-neutral-400 block tracking-wider">
                      Gross Sales
                    </span>
                    <div className="text-xs font-bold font-mono text-white tabular-nums mt-0.5">
                      {formatCurrency(metric.grossRevenue, 'IDR')}
                    </div>
                  </div>

                  <div className="text-center">
                    <span className="text-[9px] font-mono uppercase text-neutral-400 block tracking-wider">
                      Platform Fees
                    </span>
                    <div className={clsx(
                      'text-xs font-bold font-mono tabular-nums mt-0.5',
                      totalDeductions > 0 ? 'text-rose-400' : 'text-neutral-500'
                    )}>
                      {totalDeductions > 0
                        ? `-${formatCurrency(totalDeductions, 'IDR')}`
                        : formatCurrency(0, 'IDR')}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] font-mono uppercase text-neutral-400 block tracking-wider">
                      Clean Payout
                    </span>
                    <div className="text-xs font-black font-mono text-emerald-400 tabular-nums mt-0.5">
                      {formatCurrency(metric.cleanRevenue, 'IDR')}
                    </div>
                  </div>
                </div>

                {/* Detailed Marketplace Deductions & Buyer Checkout Waterfall */}
                <div className="pt-2 mt-1 border-t border-white/[0.06] space-y-1 text-[10px] font-mono text-neutral-400">
                  {hasFeeBreakdown && (
                    <div className="p-2 rounded-md bg-white/[0.02] border border-white/[0.04] space-y-1 my-1">
                      <div className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
                        Seller Fee Deductions Breakdown:
                      </div>
                      {metric.commissionFees > 0 && (
                        <div className="flex items-center justify-between text-neutral-300">
                          <span>Admin / Commission:</span>
                          <span className="text-rose-400 tabular-nums">
                            -{formatCurrency(metric.commissionFees, 'IDR')}
                          </span>
                        </div>
                      )}
                      {metric.serviceFees > 0 && (
                        <div className="flex items-center justify-between text-neutral-300">
                          <span>Service Fee (Layanan):</span>
                          <span className="text-rose-400 tabular-nums">
                            -{formatCurrency(metric.serviceFees, 'IDR')}
                          </span>
                        </div>
                      )}
                      {metric.transactionFees > 0 && (
                        <div className="flex items-center justify-between text-neutral-300">
                          <span>Order Processing / Trans:</span>
                          <span className="text-rose-400 tabular-nums">
                            -{formatCurrency(metric.transactionFees, 'IDR')}
                          </span>
                        </div>
                      )}
                      {metric.affiliateCommissions > 0 && (
                        <div className="flex items-center justify-between text-neutral-300">
                          <span>Affiliate / AMS Commission:</span>
                          <span className="text-rose-400 tabular-nums">
                            -{formatCurrency(metric.affiliateCommissions, 'IDR')}
                          </span>
                        </div>
                      )}
                      {metric.sellerVouchers > 0 && (
                        <div className="flex items-center justify-between text-neutral-300">
                          <span>Seller Store Voucher / Cashback:</span>
                          <span className="text-amber-300 tabular-nums">
                            -{formatCurrency(metric.sellerVouchers, 'IDR')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-0.5">
                    <span>Buyer Paid (Checkout):</span>
                    <span className="text-neutral-200 font-semibold tabular-nums">
                      {formatCurrency(metric.buyerPaidAmount, 'IDR')}
                    </span>
                  </div>

                  {metric.platformSubsidy > 0 && (
                    <div className="flex items-center justify-between text-amber-400/90">
                      <span>Buyer Vouchers (Platform):</span>
                      <span className="tabular-nums">
                        -{formatCurrency(metric.platformSubsidy, 'IDR')}
                      </span>
                    </div>
                  )}

                  {metric.shippingAndFees > 0 && (
                    <div className="flex items-center justify-between text-sky-400/90">
                      <span>Shipping & Buyer Fees:</span>
                      <span className="tabular-nums">
                        +{formatCurrency(metric.shippingAndFees, 'IDR')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                    <span>Clean AOV / Gross AOV:</span>
                    <span className="font-semibold text-neutral-200 tabular-nums">
                      {formatCurrency(metric.cleanAov, 'IDR')} / {formatCurrency(metric.aov, 'IDR')}
                    </span>
                  </div>

                  {metric.cancelledOrdersCount > 0 && (
                    <div className="pt-1 border-t border-white/[0.04] space-y-0.5 text-neutral-500">
                      <div className="flex items-center justify-between">
                        <span>Cancelled / Unpaid (Excl.):</span>
                        <span className="text-rose-400/90 tabular-nums">
                          {metric.cancelledOrdersCount} ({formatCurrency(metric.cancelledGrossRevenue, 'IDR')})
                        </span>
                      </div>
                      {metric.paidThenCancelledCount > 0 && (
                        <div className="flex items-center justify-between text-neutral-400">
                          <span>Gross + Paid-then-Cancelled:</span>
                          <span className="text-neutral-200 font-semibold tabular-nums">
                            {formatCurrency(metric.grossRevenue + metric.paidThenCancelledGross, 'IDR')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
};
