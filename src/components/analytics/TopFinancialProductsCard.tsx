import React from 'react';
import { TopFinancialProduct, FinancialChannel } from '../../lib/financialAnalyticsService';
import { GlassCard } from '../ui/GlassCard';
import { formatCurrency } from '../../lib/formatters';
import { Layers, Globe, ShoppingBag, Store, Award } from 'lucide-react';
import { clsx } from 'clsx';

interface TopFinancialProductsCardProps {
  products: TopFinancialProduct[];
  totalNetRevenue: number;
  primaryCurrency?: string;
}

export const TopFinancialProductsCard: React.FC<TopFinancialProductsCardProps> = ({
  products,
  totalNetRevenue,
  primaryCurrency = 'IDR',
}) => {
  const topProductRevenue = products[0]?.revenue || 0;

  const renderChannelIcon = (ch: FinancialChannel) => {
    switch (ch) {
      case 'webstore':
        return (
          <span key={ch} title="Sold on Webstore">
            <Globe className="w-3 h-3 text-[#f3aa18]" />
          </span>
        );
      case 'shopee':
        return (
          <span key={ch} title="Sold on Shopee">
            <ShoppingBag className="w-3 h-3 text-[#ee4d2d]" />
          </span>
        );
      case 'tiktok':
        return (
          <span key={ch} title="Sold on TikTok Shop">
            <Store className="w-3 h-3 text-[#06b6d4]" />
          </span>
        );
    }
  };

  return (
    <GlassCard className="p-5 flex flex-col justify-between font-sans h-full">
      <div>
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#f3aa18]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Top Products by Sales Volume
            </h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            Ranked by total revenue
          </span>
        </div>

        <div className="space-y-3.5">
          {products.slice(0, 7).map((prod, idx) => {
            const revenuePct = topProductRevenue > 0 ? (prod.revenue / topProductRevenue) * 100 : 0;
            const totalSharePct = totalNetRevenue > 0 ? Math.round((prod.revenue / totalNetRevenue) * 100) : 0;

            return (
              <div key={`${prod.name}-${idx}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-neutral-500 text-[10px] w-4 shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-medium text-white truncate" title={prod.name}>
                      {prod.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {prod.channels.map(ch => renderChannelIcon(ch))}
                    </div>
                    <span className="font-mono text-xs font-bold text-white tabular-nums">
                      {formatCurrency(prod.revenue, primaryCurrency)}
                    </span>
                  </div>
                </div>

                {/* Progress Visual Bar */}
                <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#f3aa18] to-amber-500 transition-all duration-300"
                    style={{ width: `${Math.max(4, revenuePct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>
                    {prod.quantity} {prod.quantity === 1 ? 'unit sold' : 'units sold'}
                  </span>
                  {totalSharePct > 0 && (
                    <span>{totalSharePct}% of net sales</span>
                  )}
                </div>
              </div>
            );
          })}

          {products.length === 0 && (
            <div className="py-8 text-center text-xs font-mono text-neutral-500">
              No product sales recorded for this timeframe.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.06] text-[10px] font-mono text-neutral-400 flex items-center justify-between">
        <span>Channel icons denote active storefront presence</span>
        <span>Top {Math.min(7, products.length)} models</span>
      </div>
    </GlassCard>
  );
};
