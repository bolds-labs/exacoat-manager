import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  fetchTrackingPoolInventory,
  fetchTrackingPoolNumbers,
  updateTrackingPoolNumbers,
  takeTrackingNumberFromPool,
  fetchTrackingPoolHistory,
  TrackingPoolInventory,
  TrackingAssignmentRecord,
} from '../../lib/wordpressBridge';
import {
  Package,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Truck,
  Layers,
  History,
  ArrowRight,
  Save,
  RotateCcw,
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

  // Active carrier selection
  const [targetCarrier, setTargetCarrier] = useState<'jne' | 'sicepat'>('jne');

  // Tracking numbers editor state for the active carrier
  const [editableNumbersText, setEditableNumbersText] = useState('');
  const [originalNumbersText, setOriginalNumbersText] = useState('');
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTakingResi, setIsTakingResi] = useState(false);

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

  const loadCarrierNumbers = useCallback(async (carrier: 'jne' | 'sicepat') => {
    setIsLoadingNumbers(true);
    try {
      const res = await fetchTrackingPoolNumbers(carrier);
      if (res.success && res.numbers) {
        const text = res.numbers.join('\n');
        setEditableNumbersText(text);
        setOriginalNumbersText(text);
      } else if (inventory && inventory[carrier]?.numbers) {
        const text = inventory[carrier].numbers.join('\n');
        setEditableNumbersText(text);
        setOriginalNumbersText(text);
      }
    } catch {
      if (inventory && inventory[carrier]?.numbers) {
        const text = inventory[carrier].numbers.join('\n');
        setEditableNumbersText(text);
        setOriginalNumbersText(text);
      }
    } finally {
      setIsLoadingNumbers(false);
    }
  }, [inventory]);

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

  useEffect(() => {
    if (isOpen) {
      loadCarrierNumbers(targetCarrier);
    }
  }, [isOpen, targetCarrier, loadCarrierNumbers]);

  const isDirty = editableNumbersText.trim() !== originalNumbersText.trim();

  const parsedNumbers = useMemo(() => {
    return editableNumbersText
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [editableNumbersText]);

  const uniqueNumbers = useMemo(() => {
    return Array.from(new Set(parsedNumbers));
  }, [parsedNumbers]);

  const duplicateCount = parsedNumbers.length - uniqueNumbers.length;

  const handleCarrierChange = (carrier: 'jne' | 'sicepat') => {
    if (carrier === targetCarrier) return;
    if (isDirty) {
      const proceed = window.confirm('You have unsaved changes in the current tracking list. Do you want to discard them?');
      if (!proceed) return;
    }
    setTargetCarrier(carrier);
  };

  const handleSavePool = async () => {
    setIsSaving(true);
    try {
      const res = await updateTrackingPoolNumbers(targetCarrier, uniqueNumbers);
      if (res.success) {
        showToast(
          'success',
          'Tracking Pool Saved',
          `Saved ${res.total_pool ?? uniqueNumbers.length} tracking numbers to ${targetCarrier.toUpperCase()} pool.`
        );
        const updatedText = (res.numbers || uniqueNumbers).join('\n');
        setEditableNumbersText(updatedText);
        setOriginalNumbersText(updatedText);
        await loadInventory();
        if (onInventoryChanged) onInventoryChanged();
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed to save tracking numbers');
      }
    } catch (err: any) {
      showToast('error', 'Pool Error', err.message || 'Error communicating with pool');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTakeNextResi = async () => {
    if (uniqueNumbers.length === 0) {
      showToast('warning', 'Pool Empty', `No tracking numbers available in ${targetCarrier.toUpperCase()} pool.`);
      return;
    }

    setIsTakingResi(true);
    try {
      const res = await takeTrackingNumberFromPool(targetCarrier);
      if (res.success && res.number) {
        navigator.clipboard.writeText(res.number);
        setCopiedNumber(res.number);
        showToast(
          'success',
          'Resi Taken and Copied',
          `Copied ${res.number} to clipboard. Removed from ${targetCarrier.toUpperCase()} pool (${res.remaining ?? 0} remaining).`
        );
        await loadInventory();
        await loadHistory();
        await loadCarrierNumbers(targetCarrier);
        if (onInventoryChanged) onInventoryChanged();
      } else {
        showToast('error', 'Withdrawal Failed', res.error || 'Could not withdraw tracking number');
      }
    } catch (err: any) {
      showToast('error', 'Error', err?.message || 'Network error while withdrawing number');
    } finally {
      setIsTakingResi(false);
    }
  };

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    showToast('info', 'Copied to Clipboard', num);
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
          type="button"
          onClick={() => {
            loadInventory();
            loadHistory();
            loadCarrierNumbers(targetCarrier);
          }}
          disabled={isLoadingInventory || isLoadingNumbers}
          className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Refresh Inventory"
        >
          <RefreshCw className={clsx('h-4 w-4', (isLoadingInventory || isLoadingNumbers) && 'animate-spin text-amber-400')} />
        </button>
      }
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'inventory'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Editable Pool ({targetCarrier.toUpperCase()}: {uniqueNumbers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
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
                  ? `JNE (${jneCount}) and SiCepat (${sicepatCount}) are running low. Please update or paste new pre-allocated air waybills below.`
                  : isJneLow
                  ? `JNE has only ${jneCount} tracking numbers remaining in the active pool.`
                  : `SiCepat has only ${sicepatCount} tracking numbers remaining in the active pool.`}
              </p>
            </div>
          </div>
        )}

        {/* TAB 1: EDITABLE INVENTORY POOL */}
        {activeTab === 'inventory' && (
          <div className="space-y-5">
            {/* Carrier Status Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* JNE */}
              <button
                type="button"
                onClick={() => handleCarrierChange('jne')}
                className={clsx(
                  'rounded-xl border p-3.5 flex flex-col justify-between text-left transition-all cursor-pointer',
                  targetCarrier === 'jne'
                    ? 'border-amber-500/60 bg-amber-500/[0.08] ring-1 ring-amber-500/40'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">JNE Express</span>
                    <span
                      className={clsx(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                        isJneLow ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                      )}
                    >
                      {isJneLow ? 'Low' : 'Active'}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-white tracking-tight">
                    {jneCount}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                  Assigned: {inventory?.jne?.assigned_total ?? 0}
                </div>
              </button>

              {/* SiCepat */}
              <button
                type="button"
                onClick={() => handleCarrierChange('sicepat')}
                className={clsx(
                  'rounded-xl border p-3.5 flex flex-col justify-between text-left transition-all cursor-pointer',
                  targetCarrier === 'sicepat'
                    ? 'border-rose-500/60 bg-rose-500/[0.08] ring-1 ring-rose-500/40'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">SiCepat</span>
                    <span
                      className={clsx(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                        isSicepatLow ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                      )}
                    >
                      {isSicepatLow ? 'Low' : 'Active'}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-white tracking-tight">
                    {sicepatCount}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                  Assigned: {inventory?.sicepat?.assigned_total ?? 0}
                </div>
              </button>

              {/* POS Indonesia */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">POS Indonesia</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                      Manual
                    </span>
                  </div>
                  <div className="mt-2 text-xl font-bold text-zinc-400 tracking-tight">
                    Manual
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                  Tagged with indicator
                </div>
              </div>

              {/* Goorita */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Goorita</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400">
                      Manual
                    </span>
                  </div>
                  <div className="mt-2 text-xl font-bold text-zinc-400 tracking-tight">
                    Manual
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                  Tagged with indicator
                </div>
              </div>
            </div>

            {/* Editable Tracking Pool Box */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    {targetCarrier === 'jne' ? 'JNE Express' : 'SiCepat'} Editable Pool
                  </h3>
                  <span className="text-xs font-mono text-zinc-400">
                    ({uniqueNumbers.length} active numbers)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Take Next Resi button */}
                  <button
                    type="button"
                    onClick={handleTakeNextResi}
                    disabled={isTakingResi || uniqueNumbers.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Take next resi from pool and copy to clipboard"
                  >
                    <ArrowRight className={clsx('w-3.5 h-3.5', isTakingResi && 'animate-spin')} />
                    <span>{isTakingResi ? 'Taking...' : 'Take Next Resi'}</span>
                  </button>
                </div>
              </div>

              {/* Carrier Selector Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCarrierChange('jne')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                    targetCarrier === 'jne'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  )}
                >
                  JNE Express Pool
                </button>
                <button
                  type="button"
                  onClick={() => handleCarrierChange('sicepat')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer',
                    targetCarrier === 'sicepat'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  )}
                >
                  SiCepat Pool
                </button>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  rows={8}
                  value={editableNumbersText}
                  onChange={(e) => setEditableNumbersText(e.target.value)}
                  placeholder="Paste or edit tracking numbers here (one per line)..."
                  disabled={isLoadingNumbers}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-hidden focus:ring-1 focus:ring-amber-500/50 leading-relaxed"
                />
                {isLoadingNumbers && (
                  <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center rounded-lg">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-2">
                  <span>{uniqueNumbers.length} valid numbers</span>
                  {duplicateCount > 0 && (
                    <span className="text-amber-400">({duplicateCount} duplicates found)</span>
                  )}
                  {isDirty && (
                    <span className="text-amber-400 font-semibold">• Unsaved edits</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => setEditableNumbersText(originalNumbersText)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Revert</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSavePool}
                    disabled={isSaving || !isDirty}
                    className={clsx(
                      'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer',
                      isDirty
                        ? 'bg-[#f3aa18] hover:bg-[#e09b10] text-zinc-950 shadow-md shadow-amber-500/20'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    )}
                  >
                    <Save className={clsx('h-3.5 w-3.5', isSaving && 'animate-spin')} />
                    <span>{isSaving ? 'Saving...' : isDirty ? 'Save Pool Changes' : 'Pool In Sync'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Automation Rules Note */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 text-xs text-zinc-400 space-y-1 leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-zinc-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Automated Fulfillment Guarantee</span>
              </div>
              <p>
                When a customer order payment is confirmed (status changes to <code className="text-amber-400 bg-zinc-800/60 px-1 py-0.5 rounded text-[11px]">processing</code>),
                the next air waybill number is popped sequentially from this internal pool and stored into the order metadata automatically.
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
                      <th className="py-2.5 px-3">Order / Note</th>
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
                              type="button"
                              onClick={() => handleCopy(record.number)}
                              className="text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
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
                          {record.order_id && record.order_id > 0 ? (
                            <span className="rounded bg-zinc-800 px-2 py-0.5 font-semibold text-zinc-200">
                              #{record.order_id}
                            </span>
                          ) : (
                            <span className="text-zinc-500 italic text-[11px]">
                              {record.note || 'Manual withdrawal'}
                            </span>
                          )}
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
