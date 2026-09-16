import React from 'react';
import { Order } from '../../types';
import { formatCurrency } from '../../lib/formatters';
import { GlassCard } from '../ui/GlassCard';
import { 
  DollarSign, 
  ShoppingBag, 
  Truck, 
  TrendingUp, 
  Layers, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';
import { clsx } from 'clsx';

interface SalesMetricsOverviewProps {
  orders: Order[];
  onNavigateToOrders: (filter?: string) => void;
}

export const SalesMetricsOverview: React.FC<SalesMetricsOverviewProps> = ({
  orders,
  onNavigateToOrders,
}) => {
  // Aggregate sales by currency
  const currencyTotals: Record<string, { total: number; count: number }> = {};
  let totalUnits = 0;
  let processingCount = 0;
  let readyToShipCount = 0;
  let deliveredCount = 0;

  orders.forEach(order => {
    const curr = (order.currency || 'USD').toUpperCase().trim();
    if (!currencyTotals[curr]) {
      currencyTotals[curr] = { total: 0, count: 0 };
    }
    const val = Number(order.total) || 0;
    currencyTotals[curr].total += val;
    currencyTotals[curr].count += 1;

    totalUnits += order.item_count || (order.items?.reduce((s, it) => s + (it.quantity || 1), 0)) || 1;

    const st = String(order.status || '').replace('wc-', '').toLowerCase();
    if (st === 'processing' || st === 'in-production') processingCount++;
    if (st === 'ready-to-ship' || st === 'awaiting-pickup') readyToShipCount++;
    if (st === 'completed' || st === 'delivered') deliveredCount++;
  });

  const currencies = Object.keys(currencyTotals);
  const primaryCurrency = currencies.includes('USD') ? 'USD' : (currencies[0] || 'USD');
  const primaryTotal = currencyTotals[primaryCurrency]?.total || 0;
  const secondaryCurrency = currencies.find(c => c !== primaryCurrency);

  const totalOrdersCount = orders.length;
  const aov = totalOrdersCount > 0 ? Math.round(primaryTotal / totalOrdersCount) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 font-sans">
      {/* 1. Gross Revenue */}
      <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Gross Sales</span>
          <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-[#f3aa18]/10 text-neutral-400 group-hover:text-[#f3aa18] transition-colors border border-white/[0.06]">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
            {formatCurrency(primaryTotal, primaryCurrency)}
          </p>
          {secondaryCurrency && currencyTotals[secondaryCurrency] && (
            <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
              + {formatCurrency(currencyTotals[secondaryCurrency].total, secondaryCurrency)}
            </p>
          )}
        </div>
      </GlassCard>

      {/* 2. Total Orders */}
      <GlassCard 
        onClick={() => onNavigateToOrders('all')}
        className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px] cursor-pointer hover:border-white/20"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Total Orders</span>
          <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-sky-500/10 text-neutral-400 group-hover:text-sky-400 transition-colors border border-white/[0.06]">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
            {totalOrdersCount}
          </p>
          <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
            {totalUnits} units ordered
          </p>
        </div>
      </GlassCard>

      {/* 3. Processing / Production */}
      <GlassCard 
        onClick={() => onNavigateToOrders('processing')}
        className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px] cursor-pointer hover:border-amber-500/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Processing</span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
            {processingCount}
          </p>
          <p className="text-[10px] font-mono text-amber-400/80 mt-0.5">
            In queue &bull; Needs pack
          </p>
        </div>
      </GlassCard>

      {/* 4. Ready to Ship */}
      <GlassCard 
        onClick={() => onNavigateToOrders('ready-to-ship')}
        className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px] cursor-pointer hover:border-[#f3aa18]/30"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#f3aa18]">Ready to Ship</span>
          <div className="p-2 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/20">
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
            {readyToShipCount}
          </p>
          <p className="text-[10px] font-mono text-[#f3aa18]/80 mt-0.5">
            Packed &bull; Awaiting courier
          </p>
        </div>
      </GlassCard>

      {/* 5. Average Order Value */}
      <GlassCard className="p-4 sm:p-5 flex flex-col justify-between group transition-all min-h-[125px] col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Avg Order Value</span>
          <div className="p-2 rounded-xl bg-white/[0.04] group-hover:bg-purple-500/10 text-neutral-400 group-hover:text-purple-400 transition-colors border border-white/[0.06]">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
            {formatCurrency(aov, primaryCurrency)}
          </p>
          <p className="text-[10px] font-mono text-emerald-400 mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{deliveredCount} delivered</span>
          </p>
        </div>
      </GlassCard>
    </div>
  );
};
