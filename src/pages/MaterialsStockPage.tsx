import React, { useState, useEffect, useMemo } from 'react';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { useToast } from '../context/ToastContext';
import {
  fetchGlobalFinishesDirect,
  toggleFinishStockDirect,
  toggleFinishActiveDirect,
  saveGlobalFinishDirect,
  GlobalFinish,
  DEFAULT_GLOBAL_FINISHES,
  FinishSurchargeTier,
  DEFAULT_FINISH_SURCHARGE_TIERS,
} from '../lib/wordpressBridge';
import {
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Sparkles,
  Package,
  ExternalLink,
  Filter,
  Check,
  X,
  Edit3,
  Coins,
} from 'lucide-react';
import { clsx } from 'clsx';
import { FinishSurchargeTiersModal } from '../components/modals/FinishSurchargeTiersModal';

export const MaterialsStockPage: React.FC = () => {
  const { showToast } = useToast();
  const [finishes, setFinishes] = useState<GlobalFinish[]>(DEFAULT_GLOBAL_FINISHES);
  const [surchargeTiers, setSurchargeTiers] = useState<FinishSurchargeTier[]>(DEFAULT_FINISH_SURCHARGE_TIERS);
  const [showSurchargeTiersModal, setShowSurchargeTiersModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // New Material Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newFinish, setNewFinish] = useState({
    name: '',
    group: 'Signature skins',
    slug: '',
    thumbnail: '',
    texture_url: '',
    extra_price: 0,
    accent_extra_price: 0,
    in_stock: true,
  });

  // Edit Material Modal State
  const [editingFinish, setEditingFinish] = useState<GlobalFinish | null>(null);

  const loadFinishes = async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const res = await fetchGlobalFinishesDirect();
      if (res.finishes && Array.isArray(res.finishes) && res.finishes.length > 0) {
        setFinishes(res.finishes);
      }
      if (res.surcharge_tiers && Array.isArray(res.surcharge_tiers) && res.surcharge_tiers.length > 0) {
        setSurchargeTiers(res.surcharge_tiers);
      }
    } catch (err: any) {
      console.warn('Materials inventory load warning:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadFinishes();
  }, []);

  const handleToggleStock = async (finish: GlobalFinish) => {
    const nextStock = !finish.in_stock;
    setUpdatingId(finish.id);

    // Optimistic update
    setFinishes((prev) =>
      prev.map((f) => (f.id === finish.id ? { ...f, in_stock: nextStock } : f))
    );

    try {
      const res = await toggleFinishStockDirect(finish.id, nextStock);
      if (res.success) {
        showToast(
          'success',
          'Stock Status Updated',
          `${finish.name} marked as ${nextStock ? 'IN STOCK' : 'OUT OF STOCK'}. Propagated across all device configurators.`
        );
      } else {
        // Revert on failure
        setFinishes((prev) =>
          prev.map((f) => (f.id === finish.id ? { ...f, in_stock: finish.in_stock } : f))
        );
        showToast('error', 'Update Failed', res.error || 'Failed updating stock status');
      }
    } catch (err: any) {
      setFinishes((prev) =>
        prev.map((f) => (f.id === finish.id ? { ...f, in_stock: finish.in_stock } : f))
      );
      showToast('error', 'Store Error', err.message || 'Communication error with store');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (finish: GlobalFinish) => {
    const nextActive = finish.is_active === false ? true : false;
    setUpdatingId(finish.id);

    // Optimistic update
    setFinishes((prev) =>
      prev.map((f) => (f.id === finish.id ? { ...f, is_active: nextActive } : f))
    );

    try {
      const res = await toggleFinishActiveDirect(finish.id, nextActive);
      if (res.success) {
        showToast(
          'success',
          nextActive ? 'Finish Activated' : 'Finish Deactivated',
          `${finish.name} marked as ${nextActive ? 'Active (Visible on store)' : 'Inactive (Hidden from storefront)'}.`
        );
      } else {
        // Revert on failure
        setFinishes((prev) =>
          prev.map((f) => (f.id === finish.id ? { ...f, is_active: finish.is_active } : f))
        );
        showToast('error', 'Update Failed', res.error || 'Failed updating active status');
      }
    } catch (err: any) {
      setFinishes((prev) =>
        prev.map((f) => (f.id === finish.id ? { ...f, is_active: finish.is_active } : f))
      );
      showToast('error', 'Store Error', err.message || 'Communication error with store');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCreateFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinish.name.trim()) {
      showToast('error', 'Validation Error', 'Finish name is required');
      return;
    }

    setIsSaving(true);
    try {
      const slug =
        newFinish.slug.trim() ||
        newFinish.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const res = await saveGlobalFinishDirect({
        name: newFinish.name.trim(),
        slug,
        group: newFinish.group,
        class_name: `cfg-${slug}`,
        thumbnail: newFinish.thumbnail.trim(),
        texture_url: newFinish.texture_url.trim() || newFinish.thumbnail.trim(),
        extra_price: Number(newFinish.extra_price) || 0,
        accent_extra_price: Number(newFinish.accent_extra_price) || 0,
        in_stock: newFinish.in_stock,
      });

      if (res.success) {
        showToast('success', 'Material Registered', `Material finish "${newFinish.name}" registered successfully.`);
        setIsModalOpen(false);
        setNewFinish({
          name: '',
          group: 'Signature skins',
          slug: '',
          thumbnail: '',
          texture_url: '',
          extra_price: 0,
          accent_extra_price: 0,
          in_stock: true,
        });
        loadFinishes(true);
      } else {
        showToast('error', 'Registration Failed', res.error || 'Failed registering finish');
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message || 'Error saving finish');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFinish || !editingFinish.name.trim()) {
      showToast('error', 'Validation Error', 'Finish name is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveGlobalFinishDirect({
        id: editingFinish.id,
        name: editingFinish.name.trim(),
        slug: editingFinish.slug,
        group: editingFinish.group,
        class_name: editingFinish.class_name,
        thumbnail: editingFinish.thumbnail.trim(),
        texture_url: (editingFinish.texture_url || '').trim(),
        extra_price: Number(editingFinish.extra_price) || 0,
        accent_extra_price: Number(editingFinish.accent_extra_price) || 0,
        in_stock: editingFinish.in_stock,
        shadow_opacity: editingFinish.shadow_opacity,
        highlight_opacity: editingFinish.highlight_opacity,
      });

      if (res.success) {
        showToast('success', 'Material Updated', `Finish "${editingFinish.name}" updated successfully.`);
        setEditingFinish(null);
        loadFinishes(true);
      } else {
        showToast('error', 'Update Failed', res.error || 'Failed updating finish');
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message || 'Error saving finish');
    } finally {
      setIsSaving(false);
    }
  };

  // Unique groups
  const groups = useMemo(() => {
    const list = Array.from(new Set(finishes.map((f) => f.group))).filter(Boolean);
    return ['all', ...list];
  }, [finishes]);

  // Filtered finishes
  const filteredFinishes = useMemo(() => {
    return finishes.filter((f) => {
      const matchesSearch =
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.group.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesGroup = selectedGroup === 'all' || f.group === selectedGroup;

      return matchesSearch && matchesGroup;
    });
  }, [finishes, searchQuery, selectedGroup]);

  // Inventory stats
  const stats = useMemo(() => {
    const total = finishes.length;
    const inStock = finishes.filter((f) => f.in_stock).length;
    const outOfStock = total - inStock;
    return { total, inStock, outOfStock };
  }, [finishes]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <PageHeroHeader
        title="Materials & Finishes Inventory"
        subtitle="Workshop vinyl rolls and texture availability. Toggling a finish out of stock updates all phone, laptop, and console configurators storewide immediately."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadFinishes(true)}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-mono font-medium rounded-xl border border-white/10 hover:bg-white/[0.04] text-zinc-300 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isRefreshing && 'animate-spin text-[#f3aa18]')} />
              Refresh
            </button>
            <button
              onClick={() => setShowSurchargeTiersModal(true)}
              className="px-3.5 py-2 text-xs font-mono font-medium rounded-xl border border-amber-500/30 hover:bg-amber-500/10 text-amber-300 transition-colors flex items-center gap-2 cursor-pointer"
              title="Manage global finish surcharge brackets by part base price"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Surcharge Tiers ({surchargeTiers.length})</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Finish
            </button>
          </div>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#f3aa18] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Total Finishes</p>
            <p className="text-2xl font-mono font-bold text-white mt-0.5">{stats.total}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">In Stock</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">{stats.inStock}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Depleted Finishes</p>
            <p className="text-2xl font-mono font-bold text-rose-400 mt-0.5">{stats.outOfStock}</p>
          </div>
        </GlassCard>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search material by name or group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-zinc-900/60 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/50"
          />
        </div>

        {/* Group Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {groups.map((grp) => (
            <button
              key={grp}
              onClick={() => setSelectedGroup(grp)}
              className={clsx(
                'px-3 py-1.5 text-xs font-mono rounded-lg transition-colors capitalize whitespace-nowrap cursor-pointer',
                selectedGroup === grp
                  ? 'bg-white/10 text-white font-bold border border-white/20'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              )}
            >
              {grp === 'all' ? 'All Finishes' : grp}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Materials */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#f3aa18]" />
          <p className="text-xs font-mono text-zinc-500">Loading materials database...</p>
        </div>
      ) : filteredFinishes.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Package className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-300">No materials matched your search</p>
          <p className="text-xs text-zinc-500 mt-1">Try searching for a different name or switch filter category.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFinishes.map((finish) => {
            const isUpdating = updatingId === finish.id;

            return (
              <GlassCard
                key={finish.id}
                className={clsx(
                  'p-4 transition-all duration-200 flex flex-col justify-between border',
                  finish.in_stock
                    ? 'border-white/10 hover:border-white/20'
                    : 'border-rose-500/30 bg-rose-950/10'
                )}
              >
                <div>
                  {/* Top Row: Thumbnail + Category + Stock Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0 flex items-center justify-center">
                        {finish.thumbnail ? (
                          <img
                            src={finish.thumbnail}
                            alt={finish.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Sparkles className="w-5 h-5 text-zinc-600" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{finish.name}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 border border-white/10 inline-block mt-1">
                          {finish.group}
                        </span>
                      </div>
                    </div>

                    {/* Status Pills */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {finish.is_active === false && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border bg-zinc-800 text-zinc-400 border-zinc-700">
                          Inactive
                        </span>
                      )}
                      <span
                        className={clsx(
                          'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border',
                          finish.in_stock
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                        )}
                      >
                        {finish.in_stock ? 'In Stock' : 'Depleted'}
                      </span>
                    </div>
                  </div>

                  {/* Pricing / Meta info */}
                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">Main Skin Extra:</span>
                    <span className="text-zinc-300 font-bold">
                      {(finish.extra_price ?? 0) > 0
                        ? `+IDR ${(finish.extra_price ?? 0).toLocaleString('id-ID')}`
                        : 'Standard (IDR 0)'}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">Accent Extra:</span>
                    <span className="text-amber-400 font-bold">
                      {(finish.accent_extra_price ?? 0) > 0
                        ? `+IDR ${(finish.accent_extra_price ?? 0).toLocaleString('id-ID')}`
                        : (finish.extra_price ?? 0) > 0
                        ? 'Dynamic Tier (e.g. +5k)'
                        : 'IDR 0'}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">CSS Class:</span>
                    <span className="text-zinc-400 truncate max-w-[140px]">{finish.class_name || finish.slug}</span>
                  </div>

                  {/* v2 Master Texture Info */}
                  <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-500">v2 Texture:</span>
                    <span
                      className={clsx(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                        finish.texture_url && finish.texture_url !== finish.thumbnail
                          ? 'text-sky-300 bg-sky-500/15'
                          : 'text-zinc-400 bg-white/5'
                      )}
                    >
                      {finish.texture_url && finish.texture_url !== finish.thumbnail ? 'Master Ready' : 'Using Swatch'}
                    </span>
                  </div>
                </div>

                {/* Stock & Active Toggle Action */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingFinish({ ...finish })}
                      className="px-2.5 py-1 text-xs font-sans rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Edit material details and v2 master texture"
                    >
                      <Edit3 className="w-3 h-3 text-[#f3aa18]" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(finish)}
                      disabled={isUpdating}
                      className={clsx(
                        'px-2 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer disabled:opacity-50',
                        finish.is_active !== false
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                      )}
                      title={finish.is_active !== false ? 'Active (Visible on store) - Click to deactivate' : 'Inactive (Hidden from store) - Click to activate'}
                    >
                      {finish.is_active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 font-sans">
                      {finish.in_stock ? 'In Stock' : 'Depleted'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleStock(finish)}
                      disabled={isUpdating}
                      className={clsx(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50',
                        finish.in_stock ? 'bg-emerald-500' : 'bg-zinc-700'
                      )}
                      aria-label={`Toggle stock for ${finish.name}`}
                    >
                      <span
                        className={clsx(
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                          finish.in_stock ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Add Finish Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-zinc-950 border border-white/10 p-6 shadow-2xl relative cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#f3aa18]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Register New Material Finish
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFinish} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Finish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swarm, Patina, Titanium Black"
                  value={newFinish.name}
                  onChange={(e) => setNewFinish({ ...newFinish, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Category Group</label>
                <select
                  value={newFinish.group}
                  onChange={(e) => setNewFinish({ ...newFinish, group: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                >
                  <option value="Signature skins">Signature skins</option>
                  <option value="Colors">Colors</option>
                  <option value="Natural">Natural</option>
                  <option value="Custom Edition">Custom Edition</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Swatch Thumbnail URL</label>
                <input
                  type="url"
                  placeholder="https://exacoat.com/wp-content/uploads/..."
                  value={newFinish.thumbnail}
                  onChange={(e) => setNewFinish({ ...newFinish, thumbnail: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Master Texture Image URL (v2 Engine)
                </label>
                <input
                  type="url"
                  placeholder="https://exacoat.com/wp-content/uploads/textures/master.png"
                  value={newFinish.texture_url}
                  onChange={(e) => setNewFinish({ ...newFinish, texture_url: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Full-bleed high-res texture inherited by all v2 Modern phone models.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Main Skin Extra (IDR)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newFinish.extra_price}
                    onChange={(e) => setNewFinish({ ...newFinish, extra_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">e.g. 30,000 for Swarm, 0 for Matte Black.</p>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Accent Extra Override (IDR)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newFinish.accent_extra_price}
                    onChange={(e) => setNewFinish({ ...newFinish, accent_extra_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Leave 0 to auto-scale via dynamic surcharge tiers (e.g. +5k).</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <div>
                  <p className="text-xs font-bold text-white">Initial Stock Availability</p>
                  <p className="text-[11px] text-zinc-500">Enable material in product configurators</p>
                </div>
                <input
                  type="checkbox"
                  checked={newFinish.in_stock}
                  onChange={(e) => setNewFinish({ ...newFinish, in_stock: e.target.checked })}
                  className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 bg-zinc-800 border-white/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-mono rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Register Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {editingFinish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in cursor-pointer"
          onClick={() => setEditingFinish(null)}
        >
          <div
            className="w-full max-w-md bg-[#121215] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18]">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Material Finish</h3>
                  <p className="text-xs text-zinc-400">Configure swatch and v2 master texture</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingFinish(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateFinish} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Finish Name *</label>
                <input
                  type="text"
                  required
                  value={editingFinish.name}
                  onChange={(e) => setEditingFinish({ ...editingFinish, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Category Group</label>
                <select
                  value={editingFinish.group}
                  onChange={(e) => setEditingFinish({ ...editingFinish, group: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                >
                  <option value="Signature skins">Signature skins</option>
                  <option value="Colors">Colors</option>
                  <option value="Natural">Natural</option>
                  <option value="Custom Edition">Custom Edition</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">Swatch Thumbnail URL</label>
                <input
                  type="url"
                  value={editingFinish.thumbnail}
                  onChange={(e) => setEditingFinish({ ...editingFinish, thumbnail: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1 flex items-center justify-between">
                  <span>Master Texture Image URL (v2 Engine)</span>
                  {editingFinish.texture_url && (
                    <a
                      href={editingFinish.texture_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <span>Preview</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  placeholder="https://exacoat.com/uploads/textures/master-texture.png"
                  value={editingFinish.texture_url || ''}
                  onChange={(e) => setEditingFinish({ ...editingFinish, texture_url: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  High-res texture inherited by all v2 configurators. Clipped automatically by device masks.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Main Skin Extra (IDR)</label>
                  <input
                    type="number"
                    value={editingFinish.extra_price ?? 0}
                    onChange={(e) => setEditingFinish({ ...editingFinish, extra_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">e.g. 30,000 for Swarm, 0 for Matte Black.</p>
                </div>

                <div>
                  <label className="block text-xs font-mono text-zinc-400 mb-1">Accent Extra Override (IDR)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={editingFinish.accent_extra_price ?? 0}
                    onChange={(e) => setEditingFinish({ ...editingFinish, accent_extra_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Leave 0 to auto-scale via dynamic surcharge tiers (e.g. +5k).</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <div>
                  <p className="text-xs font-bold text-white">Stock Availability</p>
                  <p className="text-[11px] text-zinc-500">Enable in product configurators</p>
                </div>
                <input
                  type="checkbox"
                  checked={editingFinish.in_stock}
                  onChange={(e) => setEditingFinish({ ...editingFinish, in_stock: e.target.checked })}
                  className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 bg-zinc-800 border-white/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFinish(null)}
                  className="px-4 py-2 text-xs font-mono rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Finish Surcharge Tiers Modal */}
      <FinishSurchargeTiersModal
        isOpen={showSurchargeTiersModal}
        onClose={() => setShowSurchargeTiersModal(false)}
        tiers={surchargeTiers}
        onTiersUpdated={(newTiers) => setSurchargeTiers(newTiers)}
      />
    </div>
  );
};
