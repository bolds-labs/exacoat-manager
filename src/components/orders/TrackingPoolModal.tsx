import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  fetchTrackingPoolInventory,
  addTrackingNumbersToPool,
  fetchTrackingPoolHistory,
  TrackingPoolInventory,
  TrackingAssignmentRecord,
} from '../../lib/wordpressBridge';
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
  Hash,
  Layers,
  History,
} from 'lucide-react';
import { clsx } from 'clsx';

interface TrackingPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInventoryChanged?: () => void;
}

export const TrackingPoolModal: React.FC<TrackingPoolModalProps> = ({
  isOpen,
  onClose,
  onInventoryChanged,
}) => {
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
      const res = await fetchTrackingPoolHistory(undefined, 30);
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
    if (isOpen) {
      loadInventory();
      loadHistory();
    }
  }, [isOpen, loadInventory, loadHistory]);

  const parsedNumbers = rawNumbers
    .split(/[\r\n,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const handleAddNumbers = async () => {
    if (parsedNumbers.length === 0) {
      showToast('warning', 'Missing Input', 'Please paste at least one tracking number');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addTrackingNumbersToPool(targetCarrier, parsedNumbers);
      if (res.success) {
        showToast(
          'success',
          'Numbers Added',
          `Added ${res.added_count} ${targetCarrier.toUpperCase()} tracking numbers (Total: ${res.total_pool})`
        );
        setRawNumbers('');
        await loadInventory();
        if (onInventoryChanged) onInventoryChanged();
      } else {
        showToast('error', 'Failed to Add', res.error || 'Failed to add tracking numbers');
      }
    } catch (err: any) {
      showToast('error', 'Pool Error', err.message || 'Error communicating with pool');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const jneCount = inventory?.jne?.available ?? 0;
  const sicepatCount = inventory?.sicepat?.available ?? 0;
  const isJneLow = jneCount < 15;
  const isSicepatLow = sicepatCount < 15;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Tracking Number Inventory Pool</h2>
            <p className="text-xs text-zinc-400 font-normal">
              Self-hosted pre-allocated air waybills for JNE and SiCepat auto-resi allocation
            </p>
          </div>
        </div>
      }
      headerActions={
        <button
          onClick={() => {
            loadInventory();
            loadHistory();
          }}
          disabled={isLoadingInventory}
          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          title="Refresh Inventory"
        >
          <RefreshCw className={clsx('h-4 w-4', isLoadingInventory && 'animate-spin')} />
        </button>
      }
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('inventory')}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'inventory'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Inventory &amp; Restock</span>
            <span className="ml-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
              {jneCount + sicepatCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'history'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span>Recent Assignments</span>
            <span className="ml-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
              {history.length}
            </span>
          </button>
        </div>

        {/* Low Stock Warning Banner */}
        {(isJneLow || isSicepatLow) && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold">Low tracking number balance detected</p>
              <p className="text-amber-300/80 mt-0.5">
                {isJneLow && isSicepatLow
                  ? `JNE (${jneCount}) and SiCepat (${sicepatCount}) are running low. Please paste new pre-allocated air waybills below.`
                  : isJneLow
                  ? `JNE has only ${jneCount} tracking numbers remaining in the active pool.`
                  : `SiCepat has only ${sicepatCount} tracking numbers remaining in the active pool.`}
              </p>
            </div>
          </div>
        )}

        {/* TAB 1: INVENTORY & RESTOCK */}
        {activeTab === 'inventory' && (
          <div className="space-y-5">
            {/* Carrier Status Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* JNE */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">JNE Express</span>
                    <span
                      className={clsx(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                        isJneLow ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                      )}
                    >
                      {isJneLow ? 'Low Stock' : 'Active'}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-white tracking-tight">
                    {jneCount}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                  Assigned: {inventory?.jne?.assigned_total ?? 0}
                </div>
              </div>

              {/* SiCepat */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">SiCepat</span>
                    <span
                      className={clsx(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                        isSicepatLow ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                      )}
                    >
                      {isSicepatLow ? 'Low Stock' : 'Active'}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-white tracking-tight">
                    {sicepatCount}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                  Assigned: {inventory?.sicepat?.assigned_total ?? 0}
                </div>
              </div>

              {/* POS Indonesia */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">POS Indonesia</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                      Manual
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-zinc-400 tracking-tight">
                    Manual
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                  Tagged with warning indicator
                </div>
              </div>

              {/* Goorita */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Goorita</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                      Manual
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-zinc-400 tracking-tight">
                    Manual
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                  Tagged with warning indicator
                </div>
              </div>
            </div>

            {/* Bulk Restock Box */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Bulk Restock Tracking Numbers
                  </h3>
                </div>
                {parsedNumbers.length > 0 && (
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {parsedNumbers.length} numbers ready
                  </span>
                )}
              </div>

              {/* Carrier Selector Radio */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-300">
                  <input
                    type="radio"
                    name="carrier"
                    value="jne"
                    checked={targetCarrier === 'jne'}
                    onChange={() => setTargetCarrier('jne')}
                    className="accent-amber-500"
                  />
                  <span>JNE Express</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-300">
                  <input
                    type="radio"
                    name="carrier"
                    value="sicepat"
                    checked={targetCarrier === 'sicepat'}
                    onChange={() => setTargetCarrier('sicepat')}
                    className="accent-amber-500"
                  />
                  <span>SiCepat</span>
                </label>
              </div>

              {/* Textarea */}
              <div>
                <textarea
                  rows={4}
                  value={rawNumbers}
                  onChange={(e) => setRawNumbers(e.target.value)}
                  placeholder="Paste tracking numbers here (one per line, comma, or space separated)..."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-zinc-500">
                  Numbers already assigned or in the pool are automatically deduplicated.
                </p>
                <button
                  type="button"
                  onClick={handleAddNumbers}
                  disabled={isSubmitting || parsedNumbers.length === 0}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                    parsedNumbers.length > 0
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 shadow-md shadow-amber-500/20 hover:brightness-110 active:scale-98'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Adding...' : 'Add Numbers to Pool'}</span>
                </button>
              </div>
            </div>

            {/* Automation Rules Note */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 text-xs text-zinc-400 space-y-1 leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-zinc-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Zero Google Sheets Dependency</span>
              </div>
              <p>
                When a customer order payment is confirmed (status changes to <code className="text-amber-400 bg-zinc-800/60 px-1 py-0.5 rounded text-[11px]">processing</code>),
                Exacoat Core immediately checks this internal pool. If JNE or SiCepat shipping was selected, the next air waybill number is popped atomically and stored into order metadata.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: RECENT ASSIGNMENT HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {isLoadingHistory ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                Loading assignment records...
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                No tracking numbers have been assigned from this pool yet.
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">Carrier</th>
                      <th className="py-2.5 px-3">Tracking Number</th>
                      <th className="py-2.5 px-3">Order</th>
                      <th className="py-2.5 px-3 text-right">Assigned At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                    {history.map((record, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-white uppercase text-[11px]">
                            {record.carrier}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-200">
                          <div className="flex items-center gap-1.5">
                            <span>{record.number}</span>
                            <button
                              onClick={() => handleCopy(record.number)}
                              className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
                              title="Copy Tracking Number"
                            >
                              {copiedNumber === record.number ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-zinc-800 px-2 py-0.5 font-semibold text-zinc-200">
                            #{record.order_id}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-500 text-[11px]">
                          {record.assigned_at}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
