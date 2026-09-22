import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Coins, Plus, Trash2, Edit3, RotateCcw, Check, HelpCircle, ArrowRight, Layers, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import {
  FinishSurchargeTier,
  DEFAULT_FINISH_SURCHARGE_TIERS,
  saveFinishSurchargeTiersDirect,
} from '../../lib/wordpressBridge';
import { useToast } from '../../context/ToastContext';

interface FinishSurchargeTiersModalProps {
  isOpen: boolean;
  onClose: () => void;
  tiers: FinishSurchargeTier[];
  onTiersUpdated?: (newTiers: FinishSurchargeTier[]) => void;
}

export const FinishSurchargeTiersModal: React.FC<FinishSurchargeTiersModalProps> = ({
  isOpen,
  onClose,
  tiers,
  onTiersUpdated,
}) => {
  const { showToast } = useToast();
  const [localTiers, setLocalTiers] = useState<FinishSurchargeTier[]>([]);
  const [editingTier, setEditingTier] = useState<FinishSurchargeTier | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Live calculator test price
  const [testBasePrice, setTestBasePrice] = useState<number>(35000);

  // Synchronize with incoming tiers
  useEffect(() => {
    if (isOpen) {
      if (Array.isArray(tiers) && tiers.length > 0) {
        setLocalTiers(tiers);
      } else {
        setLocalTiers(DEFAULT_FINISH_SURCHARGE_TIERS);
      }
      setEditingTier(null);
      setIsAddingNew(false);
    }
  }, [isOpen, tiers]);

  // Evaluated test calculation
  const testCalculation = useMemo(() => {
    const price = Number(testBasePrice) || 0;
    const matched = localTiers.find((t) => price >= t.min_price && price <= t.max_price);
    return {
      price,
      matchedTier: matched || null,
      surcharge: matched ? matched.surcharge : 0,
    };
  }, [testBasePrice, localTiers]);

  // Handle saving an individual tier edit or addition
  const handleSaveTierForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;

    if (!editingTier.label.trim()) {
      showToast('warning', 'Missing Label', 'Please enter a name or label for this surcharge tier.');
      return;
    }

    if (editingTier.min_price < 0 || editingTier.max_price < editingTier.min_price) {
      showToast('warning', 'Invalid Price Range', 'Minimum price must be less than or equal to maximum price.');
      return;
    }

    const tierId =
      editingTier.id ||
      `tier_${editingTier.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_${Date.now()}`;

    const normalizedTier: FinishSurchargeTier = {
      ...editingTier,
      id: tierId,
      min_price: Number(editingTier.min_price) || 0,
      max_price: Number(editingTier.max_price) || 0,
      surcharge: Number(editingTier.surcharge) || 0,
      description: (editingTier.description || '').trim(),
    };

    let updated: FinishSurchargeTier[];
    if (isAddingNew) {
      updated = [...localTiers, normalizedTier];
    } else {
      updated = localTiers.map((t) => (t.id === normalizedTier.id ? normalizedTier : t));
    }

    // Sort by min_price ascending
    updated.sort((a, b) => a.min_price - b.min_price);

    setLocalTiers(updated);
    setEditingTier(null);
    setIsAddingNew(false);
  };

  // Handle removing a tier
  const handleDeleteTier = (id: string) => {
    if (localTiers.length <= 1) {
      showToast('warning', 'Cannot Remove', 'At least one surcharge bracket must remain.');
      return;
    }
    setLocalTiers(localTiers.filter((t) => t.id !== id));
  };

  // Handle reset to defaults
  const handleResetDefaults = () => {
    setLocalTiers(DEFAULT_FINISH_SURCHARGE_TIERS);
    setEditingTier(null);
    setIsAddingNew(false);
    showToast('info', 'Reset to Defaults', 'Surcharge tiers restored to factory defaults. Click "Save Changes" to apply.');
  };

  // Persist all tiers to WordPress database
  const handleSaveAllTiers = async () => {
    try {
      setIsSaving(true);
      const res = await saveFinishSurchargeTiersDirect(localTiers);
      if (res.success) {
        showToast('success', 'Surcharge Tiers Saved', 'Global finish surcharge brackets updated successfully.');
        if (Array.isArray(res.tiers)) {
          setLocalTiers(res.tiers);
          onTiersUpdated?.(res.tiers);
        } else {
          onTiersUpdated?.(localTiers);
        }
        onClose();
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed to save surcharge tiers.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error saving surcharge tiers.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-white">
                Global Finish Surcharge Tiers
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
                Live Pricing Matrix
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Define price brackets so signature finishes scale fairly for small accent parts vs main skin
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || !!editingTier}
              onClick={handleSaveAllTiers}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving to Database...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Explanation Card */}
        <div className="p-3.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-zinc-300 space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>How Dynamic Finish Surcharges Work</span>
          </div>
          <p className="text-[11px] text-zinc-300">
            When a customer selects a premium finish (e.g. Swarm, Patina, Black Camo), the upcharge dynamically matches the part's base price. Accents (IDR 35,000) and Camera cutouts (IDR 20,000) add only <strong>+IDR 5,000</strong>, while the full Back skin (~IDR 140,000) adds <strong>+IDR 30,000</strong>. Standard finishes (Matte Black, Colors) always remain +IDR 0.
          </p>
        </div>

        {/* Live Bracket Simulator / Quick Test */}
        <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Live Bracket Simulator</span>
            </span>
            <span className="text-[11px] text-zinc-400">Click a part or enter custom base price:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Camera', price: 20000 },
              { label: 'Accents', price: 35000 },
              { label: 'Sides / Frame', price: 30000 },
              { label: 'Back Skin', price: 140000 },
              { label: 'Laptop Top Lid', price: 280000 },
            ].map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => setTestBasePrice(sample.price)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors cursor-pointer',
                  testBasePrice === sample.price
                    ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18] font-bold'
                    : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                )}
              >
                {sample.label}: IDR {sample.price.toLocaleString('id-ID')}
              </button>
            ))}
          </div>

          {/* Result Box */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-white/5">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] text-zinc-500 font-mono uppercase block">Tested Base Price</span>
                <div className="flex items-center gap-1 font-mono text-zinc-200 font-bold">
                  <span>IDR</span>
                  <input
                    type="number"
                    step="5000"
                    value={testBasePrice}
                    onChange={(e) => setTestBasePrice(Number(e.target.value) || 0)}
                    className="w-24 px-2 py-0.5 text-xs bg-zinc-950 rounded border border-white/10 text-amber-300 font-bold text-right focus:outline-none focus:border-[#f3aa18]"
                  />
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
              <div>
                <span className="text-[10px] text-zinc-500 font-mono uppercase block">Matched Bracket</span>
                <span className="text-xs text-white font-medium">
                  {testCalculation.matchedTier ? testCalculation.matchedTier.label : 'No Bracket Matched'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-zinc-500 font-mono uppercase block">Calculated Surcharge</span>
              <span
                className={clsx(
                  'text-sm font-mono font-bold',
                  testCalculation.surcharge > 0 ? 'text-amber-400' : 'text-zinc-500'
                )}
              >
                {testCalculation.surcharge > 0
                  ? `+IDR ${testCalculation.surcharge.toLocaleString('id-ID')}`
                  : 'IDR 0 (Standard)'}
              </span>
            </div>
          </div>
        </div>

        {/* Tier Form (Edit or Add) */}
        {editingTier ? (
          <form onSubmit={handleSaveTierForm} className="p-4 rounded-xl bg-zinc-950 border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-amber-400 text-xs uppercase tracking-wider">
                {isAddingNew ? 'Add New Surcharge Bracket' : 'Edit Surcharge Bracket'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingTier(null);
                  setIsAddingNew(false);
                }}
                className="text-zinc-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Bracket Label</label>
                <input
                  type="text"
                  placeholder="e.g. Small Accents & Cutouts"
                  value={editingTier.label}
                  onChange={(e) => setEditingTier({ ...editingTier, label: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Finish Extra Surcharge (IDR)</label>
                <input
                  type="number"
                  step="1000"
                  placeholder="5000"
                  value={editingTier.surcharge}
                  onChange={(e) => setEditingTier({ ...editingTier, surcharge: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-amber-300 font-bold placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Min Base Price (IDR)</label>
                <input
                  type="number"
                  step="1000"
                  placeholder="10000"
                  value={editingTier.min_price}
                  onChange={(e) => setEditingTier({ ...editingTier, min_price: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Max Base Price (IDR)</label>
                <input
                  type="number"
                  step="1000"
                  placeholder="45000"
                  value={editingTier.max_price}
                  onChange={(e) => setEditingTier({ ...editingTier, max_price: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">Description / Typical Parts</label>
              <input
                type="text"
                placeholder="e.g. Camera rings, accents, logo inlays"
                value={editingTier.description || ''}
                onChange={(e) => setEditingTier({ ...editingTier, description: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingTier(null);
                  setIsAddingNew(false);
                }}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black cursor-pointer"
              >
                {isAddingNew ? 'Add Bracket' : 'Apply Bracket Changes'}
              </button>
            </div>
          </form>
        ) : null}

        {/* Tiers List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              Active Surcharge Brackets ({localTiers.length})
            </span>
            {!editingTier && (
              <button
                type="button"
                onClick={() => {
                  const lastTier = localTiers[localTiers.length - 1];
                  const nextMin = lastTier ? lastTier.max_price + 1 : 10000;
                  setEditingTier({
                    id: '',
                    label: '',
                    min_price: nextMin,
                    max_price: nextMin + 50000,
                    surcharge: 10000,
                    description: '',
                  });
                  setIsAddingNew(true);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Bracket</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            {localTiers.map((tier) => (
              <div
                key={tier.id}
                className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{tier.label}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-zinc-300 border border-white/10">
                      IDR {tier.min_price.toLocaleString('id-ID')} - {tier.max_price >= 999999 ? '∞' : `IDR ${tier.max_price.toLocaleString('id-ID')}`}
                    </span>
                  </div>
                  {tier.description && (
                    <p className="text-[11px] text-zinc-500 truncate">{tier.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 font-mono block">Signature Finish Surcharge</span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      +IDR {tier.surcharge.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTier({ ...tier });
                        setIsAddingNew(false);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Edit bracket"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTier(tier.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Remove bracket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
