import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { useToast } from '../context/ToastContext';
import {
  fetchTrackingPoolInventory,
  fetchTrackingPoolNumbers,
  updateTrackingPoolNumbers,
  takeTrackingNumberFromPool,
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
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  Truck,
  History,
  ExternalLink,
  Trash2,
  Save,
  RotateCcw,
  FileText,
  Search,
  ArrowRight,
  ListFilter,
  Sparkles,
  ClipboardList,
} from 'lucide-react';
import { clsx } from 'clsx';

export const TrackingPoolPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [inventory, setInventory] = useState<TrackingPoolInventory | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Active carrier selection
  const [targetCarrier, setTargetCarrier] = useState<'jne' | 'sicepat'>('jne');

  // Tracking numbers editor state for the selected carrier
  const [editableNumbersText, setEditableNumbersText] = useState('');
  const [originalNumbersText, setOriginalNumbersText] = useState('');
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTakingResi, setIsTakingResi] = useState(false);

  // View mode inside pool editor: 'editor' (multiline textarea) | 'list' (interactive rows)
  const [viewMode, setViewMode] = useState<'editor' | 'list'>('editor');
  const [searchQuery, setSearchQuery] = useState('');

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

  const loadCarrierNumbers = useCallback(async (carrier: 'jne' | 'sicepat') => {
    setIsLoadingNumbers(true);
    try {
      const res = await fetchTrackingPoolNumbers(carrier);
      if (res.success && res.numbers) {
        const text = res.numbers.join('\n');
        setEditableNumbersText(text);
        setOriginalNumbersText(text);
      } else {
        // Fallback to numbers in inventory if available
        if (inventory && inventory[carrier]?.numbers) {
          const text = inventory[carrier].numbers.join('\n');
          setEditableNumbersText(text);
          setOriginalNumbersText(text);
        }
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

  useEffect(() => {
    loadCarrierNumbers(targetCarrier);
  }, [targetCarrier, loadCarrierNumbers]);

  // Derived metrics
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

  const filteredNumbers = useMemo(() => {
    if (!searchQuery.trim()) return uniqueNumbers;
    const q = searchQuery.trim().toLowerCase();
    return uniqueNumbers.filter((n) => n.toLowerCase().includes(q));
  }, [uniqueNumbers, searchQuery]);

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
      } else {
        showToast('error', 'Save Failed', res.error || 'Could not update tracking numbers');
      }
    } catch (err: any) {
      showToast('error', 'Error', err?.message || 'Failed connecting to store');
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
      } else {
        showToast('error', 'Withdrawal Failed', res.error || 'Could not withdraw tracking number');
      }
    } catch (err: any) {
      showToast('error', 'Error', err?.message || 'Network error while withdrawing number');
    } finally {
      setIsTakingResi(false);
    }
  };

  const handleTakeSpecificResi = async (number: string) => {
    try {
      const res = await takeTrackingNumberFromPool(targetCarrier, number);
      if (res.success) {
        navigator.clipboard.writeText(number);
        setCopiedNumber(number);
        showToast(
          'success',
          'Resi Taken and Copied',
          `Copied ${number} to clipboard. Removed from ${targetCarrier.toUpperCase()} pool.`
        );
        await loadInventory();
        await loadHistory();
        await loadCarrierNumbers(targetCarrier);
      } else {
        showToast('error', 'Withdrawal Failed', res.error || 'Could not withdraw tracking number');
      }
    } catch (err: any) {
      showToast('error', 'Error', err?.message || 'Network error');
    }
  };

  const handleDeleteNumber = (numToDelete: string) => {
    const updated = uniqueNumbers.filter((n) => n !== numToDelete);
    setEditableNumbersText(updated.join('\n'));
    showToast('info', 'Number Removed from List', `Removed ${numToDelete}. Click "Save Tracking Pool" to persist.`);
  };

  const handleDeduplicate = () => {
    setEditableNumbersText(uniqueNumbers.join('\n'));
    showToast('info', 'Duplicates Removed', `Cleaned ${duplicateCount} duplicate entries.`);
  };

  const handleReset = () => {
    setEditableNumbersText(originalNumbersText);
    showToast('info', 'Changes Reverted', 'Restored tracking numbers to current database state.');
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
              loadCarrierNumbers(targetCarrier);
            }}
            disabled={isLoadingInventory || isLoadingNumbers}
            className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-[#141414] hover:bg-zinc-200 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', (isLoadingInventory || isLoadingNumbers) && 'animate-spin text-[#f3aa18]')} />
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
              Warning: Low tracking resi inventory detected ({isJneLow ? 'JNE' : ''}{isJneLow && isSicepatLow ? ' and ' : ''}{isSicepatLow ? 'SiCepat' : ''} has fewer than 10 numbers available). Please add or edit numbers below.
            </span>
          </div>
        </div>
      )}

      {/* Carrier Stock Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* JNE Express Card */}
        <button
          type="button"
          onClick={() => handleCarrierChange('jne')}
          className={clsx(
            'p-5 rounded-2xl text-left transition-all cursor-pointer border flex flex-col justify-between min-h-[120px]',
            targetCarrier === 'jne'
              ? 'bg-amber-500/[0.06] border-amber-500/50 shadow-xs ring-1 ring-amber-500/30'
              : 'bg-white dark:bg-[#121316] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.15]'
          )}
        >
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
              <span>Assigned: {inventory?.jne.assigned_total ?? 0}</span>
              <span>Total: {(inventory?.jne.available ?? 0) + (inventory?.jne.assigned_total ?? 0)}</span>
            </div>
          </div>
        </button>

        {/* SiCepat Card */}
        <button
          type="button"
          onClick={() => handleCarrierChange('sicepat')}
          className={clsx(
            'p-5 rounded-2xl text-left transition-all cursor-pointer border flex flex-col justify-between min-h-[120px]',
            targetCarrier === 'sicepat'
              ? 'bg-rose-500/[0.06] border-rose-500/50 shadow-xs ring-1 ring-rose-500/30'
              : 'bg-white dark:bg-[#121316] border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.15]'
          )}
        >
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
              <span>Assigned: {inventory?.sicepat.assigned_total ?? 0}</span>
              <span>Total: {(inventory?.sicepat.available ?? 0) + (inventory?.sicepat.assigned_total ?? 0)}</span>
            </div>
          </div>
        </button>

        {/* System Dispatch Status */}
        <GlassCard className="p-5 flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-xs text-zinc-900 dark:text-white">Auto Allocation Guarantee</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
              Active
            </span>
          </div>
          <div className="my-2 text-xs text-zinc-500 dark:text-neutral-400 leading-relaxed">
            When customer payment is confirmed, tracking resi is automatically assigned sequentially from the respective JNE or SiCepat pool.
          </div>
        </GlassCard>
      </div>

      {/* Tabs Switcher: Manage Tracking Pool vs Assignment History */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-zinc-200/70 dark:bg-neutral-900/80 border border-zinc-300 dark:border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer focus:ring-2 focus:ring-amber-400 focus:outline-hidden',
            activeTab === 'inventory'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
              : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Editable Tracking Pool</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={clsx(
            'px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer focus:ring-2 focus:ring-amber-400 focus:outline-hidden',
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

      {/* Tab 1: Editable Tracking Pool */}
      {activeTab === 'inventory' && (
        <GlassCard className="p-6 rounded-2xl border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#111111] space-y-6 max-w-4xl">
          {/* Header Controls: Carrier Selector + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  {targetCarrier === 'jne' ? 'JNE Express' : 'SiCepat'} Tracking Pool
                </h3>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase',
                    targetCarrier === 'jne'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  )}
                >
                  {uniqueNumbers.length} in pool
                </span>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 animate-pulse">
                    Unsaved Changes
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-neutral-400 mt-1">
                Edit the active airway bill numbers directly. Remove numbers manually, paste new batches, or take a resi instantly.
              </p>
            </div>

            {/* Quick Carrier Switcher & Manual Take Resi Action */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-neutral-900 border border-zinc-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => handleCarrierChange('jne')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus:ring-2 focus:ring-amber-400 focus:outline-hidden',
                    targetCarrier === 'jne'
                      ? 'bg-white dark:bg-neutral-800 text-amber-700 dark:text-amber-400 shadow-xs font-bold'
                      : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  <Truck className="w-3 h-3 text-amber-500" />
                  <span>JNE ({inventory?.jne.available ?? 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCarrierChange('sicepat')}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus:ring-2 focus:ring-amber-400 focus:outline-hidden',
                    targetCarrier === 'sicepat'
                      ? 'bg-white dark:bg-neutral-800 text-rose-700 dark:text-rose-400 shadow-xs font-bold'
                      : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  <Truck className="w-3 h-3 text-rose-500" />
                  <span>SiCepat ({inventory?.sicepat.available ?? 0})</span>
                </button>
              </div>

              {/* Take Next Resi Button: directly fulfills manual taking of resi */}
              <button
                type="button"
                onClick={handleTakeNextResi}
                disabled={isTakingResi || uniqueNumbers.length === 0}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs focus:ring-2 focus:ring-emerald-400 focus:outline-hidden"
                title="Copies next tracking number to clipboard and removes it from the pool"
              >
                <ArrowRight className={clsx('w-3.5 h-3.5', isTakingResi && 'animate-spin')} />
                <span>{isTakingResi ? 'Taking...' : 'Take Next Resi (Copy & Pop)'}</span>
              </button>
            </div>
          </div>

          {/* Sub-toolbar: View Switcher & Helper utilities */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-neutral-400 font-medium">View Mode:</span>
              <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-neutral-900 border border-zinc-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setViewMode('editor')}
                  className={clsx(
                    'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                    viewMode === 'editor'
                      ? 'bg-white dark:bg-neutral-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  <FileText className="w-3 h-3" />
                  <span>Text Editor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={clsx(
                    'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5',
                    viewMode === 'list'
                      ? 'bg-white dark:bg-neutral-800 text-zinc-900 dark:text-white shadow-xs font-bold'
                      : 'text-zinc-500 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
                  )}
                >
                  <ListFilter className="w-3 h-3" />
                  <span>Item Cards ({uniqueNumbers.length})</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {duplicateCount > 0 && (
                <button
                  type="button"
                  onClick={handleDeduplicate}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30 text-[11px] transition-colors cursor-pointer"
                >
                  Remove {duplicateCount} Duplicates
                </button>
              )}

              {isDirty && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-zinc-600 dark:text-neutral-300 text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Revert</span>
                </button>
              )}
            </div>
          </div>

          {/* Mode 1: Multiline Text Area Editor */}
          {viewMode === 'editor' && (
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  rows={14}
                  value={editableNumbersText}
                  onChange={(e) => setEditableNumbersText(e.target.value)}
                  placeholder={`Paste or edit tracking numbers here, one per line:\nJT1234567890\nJT1234567891\nJT1234567892...`}
                  disabled={isLoadingNumbers}
                  className="w-full p-4 rounded-xl bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 leading-relaxed shadow-inner"
                />

                {isLoadingNumbers && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center rounded-xl">
                    <RefreshCw className="w-5 h-5 animate-spin text-[#f3aa18]" />
                  </div>
                )}
              </div>

              {/* Status footer with counts and Save button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-neutral-400 font-mono">
                  <span>{uniqueNumbers.length} valid numbers</span>
                  {duplicateCount > 0 && (
                    <span className="text-amber-500 font-semibold">({duplicateCount} duplicates found)</span>
                  )}
                  <span className="text-[11px] text-zinc-400">Order: First line will be assigned first (FIFO)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving || !isDirty}
                    onClick={handleSavePool}
                    className={clsx(
                      'py-2.5 px-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs focus:ring-2 focus:ring-amber-400 focus:outline-hidden',
                      isDirty
                        ? 'bg-[#f3aa18] hover:bg-[#e09b10] text-zinc-950 shadow-[0_2px_8px_rgba(243,170,24,0.3)]'
                        : 'bg-zinc-200 dark:bg-neutral-800 text-zinc-400 dark:text-neutral-500 cursor-not-allowed'
                    )}
                  >
                    <Save className={clsx('w-4 h-4', isSaving && 'animate-spin')} />
                    <span>{isSaving ? 'Saving Changes...' : isDirty ? `Save ${uniqueNumbers.length} Numbers` : 'Pool Saved'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Interactive List / Cards View */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              {/* Search Filter */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search tracking numbers in pool..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-neutral-950 border border-zinc-200 dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>

              {/* Items List */}
              {filteredNumbers.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-400" />
                  <div className="font-semibold text-zinc-700 dark:text-neutral-300">
                    {uniqueNumbers.length === 0 ? 'Tracking Pool is Empty' : 'No Matching Tracking Numbers'}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {uniqueNumbers.length === 0
                      ? 'Switch to Text Editor mode to paste numbers provided by the carrier.'
                      : 'Try clearing your search query.'}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredNumbers.map((number, idx) => {
                    const originalIndex = uniqueNumbers.indexOf(number) + 1;
                    return (
                      <div
                        key={number}
                        className="p-3 rounded-xl bg-zinc-50 dark:bg-neutral-900/70 border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-2 hover:border-zinc-300 dark:hover:border-white/20 transition-all group"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                            #{originalIndex}
                          </span>
                          <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {number}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Copy without removing */}
                          <button
                            type="button"
                            onClick={(e) => handleCopy(number, e)}
                            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                            title="Copy number"
                          >
                            {copiedNumber === number ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Take Resi (Copy + Remove from pool) */}
                          <button
                            type="button"
                            onClick={() => handleTakeSpecificResi(number)}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-500 transition-colors cursor-pointer"
                            title="Take this resi manually (copies to clipboard and pops from pool)"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete from pool list */}
                          <button
                            type="button"
                            onClick={() => handleDeleteNumber(number)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Remove number from pool"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* List View Save Bar if changes pending */}
              {isDirty && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                  <span className="text-amber-700 dark:text-amber-300 font-semibold">
                    You have pending modifications to the tracking list.
                  </span>
                  <button
                    type="button"
                    onClick={handleSavePool}
                    disabled={isSaving}
                    className="py-1.5 px-4 rounded-lg bg-[#f3aa18] hover:bg-[#e09b10] text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Save className={clsx('w-3.5 h-3.5', isSaving && 'animate-spin')} />
                    <span>{isSaving ? 'Saving...' : 'Save Pool Now'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {/* Tab 2: Assignment History Ledger */}
      {activeTab === 'history' && (
        <GlassCard className="rounded-2xl border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#111111] overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-white">Recent Tracking Assignments</span>
            <span className="text-xs font-mono text-zinc-500">Last 50 automated and manual allocations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-neutral-900/60 text-zinc-500 dark:text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Order / Note</th>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Assigned Tracking Number</th>
                  <th className="py-3 px-4">Timestamp</th>
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
                        Tracking assignments will appear here when orders are confirmed or resi numbers are manually withdrawn.
                      </div>
                    </td>
                  </tr>
                ) : (
                  history.map((record, idx) => (
                    <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold">
                        {record.order_id && record.order_id > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenOrder(record.order_id)}
                            className="text-zinc-900 dark:text-white hover:text-amber-500 transition-colors cursor-pointer"
                          >
                            #{record.order_id}
                          </button>
                        ) : (
                          <span className="text-zinc-500 font-normal italic text-xs">
                            {record.note || 'Manual withdrawal'}
                          </span>
                        )}
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
                        {record.order_id && record.order_id > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenOrder(record.order_id)}
                            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Open order drawer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-zinc-400 text-[10px]">-</span>
                        )}
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
