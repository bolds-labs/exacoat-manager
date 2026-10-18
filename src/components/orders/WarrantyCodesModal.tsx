import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  Ban,
  Clock,
  ShieldCheck,
  Search,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  fetchWarrantyCodesDirect,
  generateWarrantyCodeDirect,
  revokeWarrantyCodeDirect,
  deleteWarrantyCodeDirect,
  type WarrantyCodeItem,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';
import { formatOrderNumber } from '../../lib/orderUtils';

interface WarrantyCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (orderId: number) => void;
}

const PRESET_DURATIONS = [
  { label: '24 Hours (1 Day)', value: 24 },
  { label: '48 Hours (2 Days)', value: 48 },
  { label: '72 Hours (3 Days)', value: 72 },
  { label: '7 Days (1 Week)', value: 168 },
  { label: 'Custom Hours', value: -1 },
];

export const WarrantyCodesModal: React.FC<WarrantyCodesModalProps> = ({
  isOpen,
  onClose,
  onSelectOrder,
}) => {
  const { showToast } = useToast();

  const [codes, setCodes] = useState<WarrantyCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'expired' | 'revoked'>('all');

  // Generation form state
  const [selectedPreset, setSelectedPreset] = useState<number>(24);
  const [customHours, setCustomHours] = useState<string>('12');
  const [boundOrder, setBoundOrder] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [newlyGeneratedCode, setNewlyGeneratedCode] = useState<string | null>(null);

  // Copy status tracker
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Action states
  const [actioningCode, setActioningCode] = useState<string | null>(null);

  const loadCodes = async () => {
    setIsLoading(true);
    try {
      const res = await fetchWarrantyCodesDirect();
      if (res.success) {
        setCodes(res.codes);
      } else {
        showToast('error', 'Failed Loading Codes', res.error || 'Could not fetch warranty codes');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Network request failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCodes();
      setNewlyGeneratedCode(null);
    }
  }, [isOpen]);

  const handleCopy = (code: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast('info', 'Code Copied', code);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveHours = selectedPreset === -1 ? parseInt(customHours, 10) || 24 : selectedPreset;

    setIsGenerating(true);
    try {
      const res = await generateWarrantyCodeDirect({
        duration_hours: effectiveHours,
        bound_order_id: boundOrder.trim() || undefined,
        note: note.trim() || undefined,
      });

      if (res.success && res.code) {
        showToast('success', 'Code Generated', `Created ${res.code.code} valid for ${effectiveHours}h`);
        setNewlyGeneratedCode(res.code.code);
        setBoundOrder('');
        setNote('');
        await loadCodes();
      } else {
        showToast('error', 'Generation Failed', res.error || 'Failed generating warranty code');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Generation request failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (code: string) => {
    if (!window.confirm(`Revoke warranty code ${code}? Customers will no longer be able to use this code.`)) {
      return;
    }

    setActioningCode(code);
    try {
      const res = await revokeWarrantyCodeDirect(code);
      if (res.success) {
        showToast('info', 'Code Revoked', `Warranty code ${code} was revoked.`);
        await loadCodes();
      } else {
        showToast('error', 'Revocation Failed', res.error || 'Failed revoking code');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Request failed');
    } finally {
      setActioningCode(null);
    }
  };

  const handleDelete = async (code: string) => {
    if (!window.confirm(`Permanently delete code ${code} from the system?`)) {
      return;
    }

    setActioningCode(code);
    try {
      const res = await deleteWarrantyCodeDirect(code);
      if (res.success) {
        showToast('info', 'Code Deleted', `Warranty code ${code} removed.`);
        await loadCodes();
      } else {
        showToast('error', 'Delete Failed', res.error || 'Failed deleting code');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Request failed');
    } finally {
      setActioningCode(null);
    }
  };

  const filteredCodes = useMemo(() => {
    return codes.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchCode = item.code.toLowerCase().includes(q);
      const matchBound = (item.bound_order_id || '').toLowerCase().includes(q);
      const matchNote = (item.note || '').toLowerCase().includes(q);
      const matchCreator = (item.created_by || '').toLowerCase().includes(q);
      const matchUsed = item.used_in_order ? String(item.used_in_order).includes(q) : false;

      return matchCode || matchBound || matchNote || matchCreator || matchUsed;
    });
  }, [codes, statusFilter, searchQuery]);

  const renderStatusBadge = (status: WarrantyCodeItem['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'used':
        return <Badge variant="indigo">Used</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      case 'revoked':
        return <Badge variant="rose">Revoked</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="5xl"
      title={
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <span className="text-base font-bold text-white">Warranty Extension Codes</span>
            <span className="ml-2.5 text-xs font-mono font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              {codes.filter((c) => c.status === 'active').length} Active
            </span>
          </div>
        </div>
      }
      subtitle="Generate single-use special codes with default 24h expiry to extend claim eligibility beyond the 48-hour delivery window."
    >
      <div className="space-y-6 text-xs text-neutral-300">
        {/* Generator Form Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <h3 className="font-semibold text-white text-sm">Generate New Code</h3>
            </div>
            <span className="text-[11px] text-neutral-400">Default expiry: 1 day (24 hours)</span>
          </div>

          <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            {/* Expiry Presets */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="block text-[11px] font-medium text-neutral-400">
                Validity Duration
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(parseInt(e.target.value, 10))}
                className="w-full h-9 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                {PRESET_DURATIONS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Hours Input */}
            {selectedPreset === -1 && (
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-[11px] font-medium text-neutral-400">
                  Custom Hours
                </label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  className="w-full h-9 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-xs text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Hours"
                  required
                />
              </div>
            )}

            {/* Optional Bound Order */}
            <div className={clsx('space-y-1.5', selectedPreset === -1 ? 'md:col-span-3' : 'md:col-span-4')}>
              <label className="block text-[11px] font-medium text-neutral-400">
                Bound Order # <span className="text-neutral-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={boundOrder}
                onChange={(e) => setBoundOrder(e.target.value)}
                placeholder="Leave blank for any single order"
                className="w-full h-9 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-xs text-white placeholder:text-neutral-600 focus:border-purple-500 focus:outline-none font-mono"
              />
            </div>

            {/* Optional Staff Note */}
            <div className={clsx('space-y-1.5', selectedPreset === -1 ? 'md:col-span-3' : 'md:col-span-4')}>
              <label className="block text-[11px] font-medium text-neutral-400">
                Internal Note <span className="text-neutral-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason or customer handle"
                className="w-full h-9 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-xs text-white placeholder:text-neutral-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Submit Button */}
            <div className="md:col-span-12 flex justify-end pt-1">
              <button
                type="submit"
                disabled={isGenerating}
                className="h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center gap-2 text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Generate Code</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Newly generated code highlight banner */}
          {newlyGeneratedCode && (
            <div className="flex items-center justify-between rounded-xl border border-purple-500/40 bg-purple-500/15 p-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/30 text-purple-300">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">New Code Ready to Send</p>
                  <p className="font-mono text-sm font-bold text-purple-200 tracking-wider">
                    {newlyGeneratedCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(newlyGeneratedCode)}
                className="flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                {copiedCode === newlyGeneratedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 rounded-xl bg-neutral-900 border border-white/[0.06]">
            {(['all', 'active', 'used', 'expired', 'revoked'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer whitespace-nowrap',
                  statusFilter === st
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search codes, orders, notes..."
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-neutral-700 bg-neutral-900 text-xs text-white placeholder:text-neutral-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={loadCodes}
              disabled={isLoading}
              title="Refresh Codes"
              className="h-8 w-8 rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <RefreshCw className={clsx('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Codes Table */}
        <div className="rounded-2xl border border-white/[0.08] bg-neutral-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Bound Order</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Used In</th>
                  <th className="py-3 px-4">Expiry</th>
                  <th className="py-3 px-4">Created By / Note</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-500">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                        <span>Loading warranty codes...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-500">
                      <div className="flex flex-col items-center gap-2">
                        <KeyRound className="h-6 w-6 text-neutral-600" />
                        <span>No warranty codes found.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCodes.map((item) => (
                    <tr
                      key={item.code}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-xs tracking-wide">
                            {item.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(item.code, e)}
                            className="text-neutral-500 hover:text-purple-300 transition-colors p-1"
                            title="Copy code"
                          >
                            {copiedCode === item.code ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Bound Order */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {item.bound_order_id ? (
                          <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-purple-300">
                            #{item.bound_order_id}
                          </span>
                        ) : (
                          <span className="text-neutral-500 italic">Any Single Order</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">{renderStatusBadge(item.status)}</td>

                      {/* Used In Replacement Order */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {item.used_in_order ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectOrder && typeof item.used_in_order === 'number') {
                                onClose();
                                onSelectOrder(item.used_in_order);
                              }
                            }}
                            className="flex items-center gap-1 text-[#f3aa18] hover:underline"
                            title={`Used on ${item.used_at || ''}`}
                          >
                            <span>#{item.used_in_order}</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="py-3 px-4 text-[11px]">
                        <div className="space-y-0.5">
                          <p className="text-neutral-300 font-mono">{item.expires_at}</p>
                          <p className="text-[10px] text-neutral-500">{item.duration_hours}h limit</p>
                        </div>
                      </td>

                      {/* Created By / Note */}
                      <td className="py-3 px-4 text-[11px] max-w-[200px]">
                        <div className="space-y-0.5">
                          <p className="text-neutral-300 font-medium truncate">{item.created_by}</p>
                          {item.note && (
                            <p className="text-neutral-500 italic truncate" title={item.note}>
                              &ldquo;{item.note}&rdquo;
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(item.code)}
                              disabled={actioningCode === item.code}
                              className="px-2 py-1 rounded-md text-[11px] font-medium border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Revoke code"
                            >
                              <Ban className="h-3 w-3" />
                              <span>Revoke</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(item.code)}
                            disabled={actioningCode === item.code}
                            className="p-1 rounded-md text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete code"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
