import React, { useState, useEffect, useCallback } from 'react';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { useToast } from '../context/ToastContext';
import {
  fetchTrackingPoolInventory,
  addTrackingNumbersToPool,
  fetchTrackingPoolHistory,
  fetchOrderDetailDirect,
  TrackingPoolInventory,
  TrackingAssignmentRecord,
} from '../lib/wordpressBridge';
import { Order } from '../types';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';
import { formatDateTime } from '../lib/formatters';
import {
  Package,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Truck,
  Layers,
  History,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';

export const TrackingPoolPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [inventory, setInventory] = useState<TrackingPoolInventory | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Restock form state
  const [targetCarrier, setTargetCarrier] = useState<'jne' | 'sicepat'>('jne');
  const [rawNumbers, setRawNumbers] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History state
  const [history, setHistory] = useState<TrackingAssignmentRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Drawer state for inspecting orders
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadInventory = useCallback(async () => {
    setIsLoadingInventory(true);
    try {
      const res = await fetchTrackingPoolInventory();
      if (res.success && res.inventory) {
        setInventory(res.inventory);
      } else {
        showToast('error', 'Inventory Error', res.error || 'Failed to fetch tracking pool inventory');
      }
    } catch {
      showToast('error', 'Connection Error', 'Network error while fetching tracking pool');
    } finally {
      setIsLoadingInventory(false);
    }
  }, [showToast]);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetchTrackingPoolHistory(undefined, 50);
      if (res.success && res.history) {
        setHistory(res.history);
      }
    } catch {
      // Non-critical
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
    loadHistory();
  }, [loadInventory, loadHistory]);

  const parsedNumbers = rawNumbers
    .split(/[\r\n,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const uniqueNumbers = Array.from(new Set(parsedNumbers));
  const duplicateCount = parsedNumbers.length - uniqueNumbers.length;

  const handleAddNumbers = async () => {
    if (uniqueNumbers.length === 0) {
      showToast('warning', 'Missing Input', 'Please paste at least one tracking number');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addTrackingNumbersToPool(targetCarrier, uniqueNumbers);
      if (res.success) {
        showToast(
          'success',
          'Restock Successful',
          `Added ${res.added_count} tracking numbers to ${targetCarrier.toUpperCase()} pool.`
        );
        setRawNumbers('');
        await loadInventory();
      } else {
        showToast('error', 'Restock Failed', res.error || 'Could not add tracking numbers');
      }
    } catch (err: any) {
      showToast('error', 'Error', err?.message || 'Failed connecting to store');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedNumber(text);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const handleOpenOrder = async (orderId: number) => {
    try {
      const res = await fetchOrderDetailDirect(orderId);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
        setIsDrawerOpen(true);
      } else {
        showToast('error', 'Order Not Found', `Could not load order #${orderId}`);
      }
    } catch {
      showToast('error', 'Error', `Failed loading order #${orderId}`);
    }
  };

  const isJneLow = inventory ? inventory.jne.available < 10 : false;
  const isSicepatLow = inventory ? inventory.sicepat.available < 10 : false;

  return (
    <div className="space-y-6 font-sans">
      {/* Hero Header */}
      <PageHeroHeader
        title="Tracking Pool"
        subtitle="Manage pre-allocated airway bill numbers for automated instant fulfillment without courier pickup wait times."
        actions={
          <button
            type="button"
            onClick={() => {
              loadInventory();
              loadHistory();
            }}
            disabled={isLoadingInventory}
            className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-[#141414] hover:bg-zinc-200 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isLoadingInventory && 'animate-spin text-[#f3aa18]')} />
            <span>Refresh Pool</span>
          </button>
        }
      />

      {/* Low Stock Alert Banner */}
      {(isJneLow || isSicepatLow) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-amber-700 dark:text-amber-300 font-semibold">
              Warning: Low tracking resi inventory detected ({isJneLow ? 'JNE' : ''}{isJneLow && isSicepatLow ? ' and ' : ''}{isSicepatLow ? 'SiCepat' : ''} has fewer than 10 numbers available). Please restock below.
            </span>
          </div>
        </div>
      )}

      {/* Carrier Stock Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* JNE Express Card */}
        <GlassCard className="p-5 flex flex-col justify-between min-h-[120px] border-amber-500/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-xs text-zinc-900 dark:text-white">JNE Express Pool</span>
            </div>
            <span
              className={clsx(
                'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                isJneLow
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
              )}
            >
              {isJneLow ? 'Low Stock' : 'Healthy'}
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-bold font-mono text-zinc-900 dark:text-white">
              {inventory?.jne.available ?? 0}
            </div>
            <div className="text-xs text-zinc-500 dark:text-neutral-400 mt-1 flex items-center justify-between">
              <span>Used: {inventory?.jne.assigned_total ?? 0}</span>
              <span>Total: {(inventory?.jne.available ?? 0) + (inventory?.jne.assigned_total ?? 0)}</span>
            </div>
          </div>
        </GlassCard>

        {/* SiCepat Card */}
        <GlassCard className="p-5 flex flex-col justify-between min-h-[120px] border-rose-500/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-rose-500" />
              <span className="font-bold text-xs text-zinc-900 dark:text-white">SiCepat Pool</span>
            </div>
            <span
              className={clsx(
                'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                isSicepatLow
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
              )}
            >
              {isSicepatLow ? 'Low Stock' : 'Healthy'}
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-bold font-mono text-zinc-900 dark:text-white">
              {inventory?.sicepat.available ?? 0}
            </div>
            <div className="text-xs text-zinc-500 dark:text-neutral-400 mt-1 flex items-center justify-between">
              <span>Used: {inventory?.sicepat.assigned_total ?? 0}</span>
              <span>Total: {(inventory?.sicepat.available ?? 0) + (inventory?.sicepat.assigned_total ?? 0)}</span>
            </div>
          </div>
        </GlassCard>

        {/* System Dispatch Status */}
        <GlassCard className="p-5 flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-xs text-zinc-900 dark:text-white">Auto Allocation</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              Active
            </span>
          </div>
          <div className="my-2 text-xs text-zinc-500 dark:text-neutral-400 leading-relaxed">
            When shipping labels are generated, tracking resi is automatically assigned sequentially from the respective carrier pool.
          </div>
        </GlassCard>
      </div>

      {/* Tabs Switcher: Restock Form vs Assignment Ledger */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-zinc-200/70 dark:bg-neutral-900/80 border border-zinc-300 dark:border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'inventory'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
              : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Restock Tracking Pool</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer',
            activeTab === 'history'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
              : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <History className="w-3.5 h-3.5" />
          <span>Assignment History</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-zinc-300 dark:bg-white/10 text-zinc-700 dark:text-neutral-300">
            {history.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Restock Form */}
      {activeTab === 'inventory' && (
        <GlassCard className="p-6 rounded-2xl border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#111111] space-y-5 max-w-3xl">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Batch Add Tracking Numbers</h3>
            <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
              Paste tracking resi list provided by the logistics carrier. Multiple lines or comma-separated values supported.
            </p>
          </div>

          <div className="space-y-4">
            {/* Carrier selector */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-neutral-300 block mb-1.5">
                Target Courier Carrier
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetCarrier('jne')}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2',
                    targetCarrier === 'jne'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-zinc-100 dark:bg-neutral-900 text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  <Truck className="w-3.5 h-3.5 text-amber-500" />
                  <span>JNE Express</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetCarrier('sicepat')}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-2',
                    targetCarrier === 'sicepat'
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 font-bold'
                      : 'bg-zinc-100 dark:bg-neutral-900 text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-white/[0.08] hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  <Truck className="w-3.5 h-3.5 text-rose-500" />
                  <span>SiCepat</span>
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-neutral-300">
                  Tracking Numbers (one per line)
                </label>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-zinc-500">{uniqueNumbers.length} valid numbers</span>
                  {duplicateCount > 0 && (
                    <span className="text-amber-500">({duplicateCount} duplicates ignored)</span>
                  )}
                </div>
              </div>
              <textarea
                rows={8}
                value={rawNumbers}
                onChange={(e) => setRawNumbers(e.target.value)}
                placeholder="JT1234567890&#10;JT1234567891&#10;JT1234567892..."
                className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-amber-400 leading-relaxed"
              />
            </div>

            <button
              type="button"
              disabled={isSubmitting || uniqueNumbers.length === 0}
              onClick={handleAddNumbers}
              className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <Plus className={clsx('w-4 h-4', isSubmitting && 'animate-spin')} />
              <span>{isSubmitting ? 'Adding to Pool...' : `Add ${uniqueNumbers.length} Tracking Numbers to ${targetCarrier.toUpperCase()}`}</span>
            </button>
          </div>
        </GlassCard>
      )}

      {/* Tab 2: Assignment History Ledger */}
      {activeTab === 'history' && (
        <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-white">Recent Tracking Assignments</span>
            <span className="text-xs font-mono text-zinc-500">Last 50 auto-assigned orders</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-neutral-900/60 text-zinc-500 dark:text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Assigned Tracking Number</th>
                  <th className="py-3 px-4">Assigned Timestamp</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {isLoadingHistory ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#f3aa18]" />
                      <span>Loading assignment ledger...</span>
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-400" />
                      <div className="font-semibold text-zinc-700 dark:text-neutral-300">No Assignments Yet</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Tracking assignments will be recorded here when orders are marked ready for pickup.
                      </div>
                    </td>
                  </tr>
                ) : (
                  history.map((record, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold">
                        <button
                          type="button"
                          onClick={() => handleOpenOrder(record.order_id)}
                          className="text-zinc-900 dark:text-white hover:text-amber-500 transition-colors cursor-pointer"
                        >
                          #{record.order_id}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-semibold uppercase text-[11px] text-zinc-600 dark:text-neutral-300">
                        {record.carrier}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        <div className="flex items-center gap-1.5">
                          <span>{record.number}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(record.number, e)}
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                            title="Copy tracking number"
                          >
                            {copiedNumber === record.number ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                        {formatDateTime(record.assigned_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenOrder(record.order_id)}
                          className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOrderUpdated={() => loadHistory()}
        onSelectOrderById={async (orderId: number) => {
          const res = await fetchOrderDetailDirect(orderId);
          if (res.success && res.order) {
            setSelectedOrder(res.order);
          }
        }}
      />
    </div>
  );
};
