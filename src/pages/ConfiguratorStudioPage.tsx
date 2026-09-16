import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PageHeroHeader } from '../components/ui/PageHeroHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { useToast } from '../context/ToastContext';
import { lockBodyScroll } from '../lib/bodyScrollLock';
import {
  fetchConfiguratorProfilesDirect,
  fetchProductConfiguratorProfileDirect,
  saveProductConfiguratorProfileDirect,
  runBatchConfiguratorMigrationDirect,
  GlobalFinish,
  fetchGlobalFinishesDirect,
} from '../lib/wordpressBridge';
import {
  DeviceConfiguratorProfile,
  ConfiguratorProfileSummary,
  ConfiguratorLayer,
  ConfiguratorView,
  DeviceFamily,
} from '../types';
import {
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Sparkles,
  Smartphone,
  Laptop,
  Tablet,
  Keyboard as KeyboardIcon,
  Sliders,
  Trash2,
  Eye,
  Check,
  X,
  ArrowRight,
  HelpCircle,
  FolderSync,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Palette,
} from 'lucide-react';
import { clsx } from 'clsx';

const COMMON_PRESET_LAYERS = [
  { name: 'Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
  { name: 'Camera Accent', group: 'accent', is_required: false, is_optional: true, extra_price: 15000 },
  { name: 'Additional Camera Ring', group: 'accent', is_required: false, is_optional: true, extra_price: 10000 },
  { name: 'Frame / Sides', group: 'protection', is_required: false, is_optional: true, extra_price: 30000 },
  { name: 'Logo Cutout', group: 'accent', is_required: false, is_optional: true, extra_price: 0 },
  { name: 'Top Lid', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
  { name: 'Bottom Base', group: 'primary', is_required: false, is_optional: true, extra_price: 120000 },
  { name: 'Trackpad', group: 'accent', is_required: false, is_optional: true, extra_price: 40000 },
  { name: 'Palm Rest', group: 'accent', is_required: false, is_optional: true, extra_price: 80000 },
  { name: 'Middle / Hinge Spine', group: 'accent', is_required: false, is_optional: true, extra_price: 30000 },
  { name: 'Inner Keyboard Surround', group: 'accent', is_required: false, is_optional: true, extra_price: 60000 },
  { name: 'Pencil Cutout', group: 'accent', is_required: false, is_optional: true, extra_price: 0 },
];

export const ConfiguratorStudioPage: React.FC = () => {
  const { showToast } = useToast();

  // Catalog state
  const [profiles, setProfiles] = useState<ConfiguratorProfileSummary[]>([]);
  const [finishes, setFinishes] = useState<GlobalFinish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterConfigured, setFilterConfigured] = useState<'all' | 'configured' | 'pending'>('all');
  const [filterVersion, setFilterVersion] = useState<'all' | 'v1' | 'v2'>('all');

  // Batch migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    migrated_count?: number;
    skipped_count?: number;
    total_scanned?: number;
  } | null>(null);

  // Editor Modal / Drawer state
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [editingProfile, setEditingProfile] = useState<DeviceConfiguratorProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);
  const [autofillPrefix, setAutofillPrefix] = useState<string>('');

  // Live Simulator test state
  const [selectedSimLayers, setSelectedSimLayers] = useState<Record<string, boolean>>({});
  const [selectedSimFinish, setSelectedSimFinish] = useState<string>('swarm');
  const [activeSimView, setActiveSimView] = useState<string>('main_view');
  const [selectedSimColor, setSelectedSimColor] = useState<string>('space-gray');

  const loadData = async (quiet = false) => {
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const [profilesRes, finishesRes] = await Promise.all([
        fetchConfiguratorProfilesDirect({ per_page: 100 }),
        fetchGlobalFinishesDirect(),
      ]);

      if (profilesRes.success && Array.isArray(profilesRes.profiles)) {
        setProfiles(profilesRes.profiles);
      }
      if (finishesRes.success && Array.isArray(finishesRes.finishes)) {
        setFinishes(finishesRes.finishes);
      }
    } catch (err: any) {
      console.warn('Configurator studio load warning:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProductId !== null) {
      const unlock = lockBodyScroll();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleCloseEditor();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        unlock();
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [selectedProductId]);

  const handleOpenEditor = async (productId: number) => {
    setSelectedProductId(productId);
    setIsLoadingProfile(true);
    setExpandedLayerId(null);
    try {
      const res = await fetchProductConfiguratorProfileDirect(productId);
      if (res.success && res.profile) {
        const rawLayers = res.profile.layers || [];
        const deviceLayer = rawLayers.find((l) => (l.name || '').toLowerCase() === 'device');
        const cleanedLayers = rawLayers.filter((l) => (l.name || '').toLowerCase() !== 'device');

        const viewsWithBody = (res.profile.views || []).map((v) => {
          if (v.background_url) return v;
          const devImg =
            deviceLayer?.assets_by_view?.[v.id]?.render_texture_map?.['device'] ||
            Object.values(deviceLayer?.assets_by_view || {})[0]?.render_texture_map?.['device'] ||
            Object.values(deviceLayer?.assets_by_view || {})[0]?.base_hardware_body_url;
          return devImg ? { ...v, background_url: devImg } : v;
        });

        const profile: DeviceConfiguratorProfile = {
          ...res.profile,
          views: viewsWithBody,
          layers: cleanedLayers,
        };

        setEditingProfile(profile);
        
        // Initialize simulator state
        const initialSim: Record<string, boolean> = {};
        cleanedLayers.forEach((l) => {
          initialSim[l.id] = l.default_selected || l.is_required;
        });
        setSelectedSimLayers(initialSim);
        if (profile.views && profile.views.length > 0) {
          setActiveSimView(profile.views[0].id);
        }
        if (profile.device_colors && profile.device_colors.length > 0) {
          setSelectedSimColor(profile.device_colors[0].id);
        }
      } else {
        // Build fallback profile from catalog item so the user can immediately edit
        const fallbackSummary = profiles.find((p) => p.product_id === productId);
        if (fallbackSummary) {
          const defaultLayerName =
            fallbackSummary.family === 'laptop'
              ? 'Top Lid'
              : fallbackSummary.family === 'keyboard'
              ? 'Main Body'
              : 'Back Skin';
          const defaultLayerId = defaultLayerName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

          const fallbackProfile: DeviceConfiguratorProfile = {
            product_id: fallbackSummary.product_id,
            device_slug: fallbackSummary.slug,
            device_name: fallbackSummary.name,
            category: fallbackSummary.categories[0] || 'General',
            family: fallbackSummary.family || 'phone',
            base_price: fallbackSummary.price || 0,
            currency: 'IDR',
            size_multiplier: fallbackSummary.size_multiplier || 1.0,
            is_configurable: true,
            configurator_version: fallbackSummary.configurator_version || 'v1',
            device_colors: [
              { id: 'space-gray', name: 'Space Gray', hex: '#535559' },
              { id: 'silver', name: 'Silver', hex: '#e3e4e5' },
              { id: 'midnight', name: 'Midnight', hex: '#1e242b' },
              { id: 'starlight', name: 'Starlight', hex: '#f0e4d3' },
            ],
            views: [
              {
                id: 'main_view',
                name: 'Main View',
                is_default: true,
                aspect_ratio: '1:1',
                canvas_dimensions: { width: 1000, height: 1000 },
              },
            ],
            layers: [
              {
                id: defaultLayerId,
                name: defaultLayerName,
                group: 'primary',
                is_required: true,
                is_optional: false,
                default_selected: true,
                extra_price: 0,
                z_index: 1,
                allowed_finish_groups: ['Signature skins', 'Colors', 'Natural'],
                assets_by_view: {
                  main_view: {
                    render_texture_map: {},
                  },
                },
              },
            ],
          };

          setEditingProfile(fallbackProfile);
          setSelectedSimLayers({ [defaultLayerId]: true });
          setActiveSimView('main_view');
          showToast('info', 'Loaded Base Profile', 'Created studio workspace for this device.');
        } else {
          showToast('error', 'Load Failed', res.error || 'Unable to load configurator profile');
        }
      }
    } catch (err: any) {
      showToast('error', 'Communication Error', err.message);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleCloseEditor = () => {
    setSelectedProductId(null);
    setEditingProfile(null);
    setExpandedLayerId(null);
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    setIsSavingProfile(true);
    try {
      const res = await saveProductConfiguratorProfileDirect(editingProfile);
      if (res.success) {
        showToast(
          'success',
          'Configurator Profile Saved',
          `${editingProfile.device_name} updated with ${editingProfile.layers.length} composable layers.`
        );
        handleCloseEditor();
        loadData(true);
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed saving configurator profile');
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleBatchMigrate = async () => {
    setIsMigrating(true);
    try {
      const res = await runBatchConfiguratorMigrationDirect();
      if (res.success) {
        setMigrationResult({
          migrated_count: res.migrated_count,
          skipped_count: res.skipped_count,
          total_scanned: res.total_scanned,
        });
        showToast(
          'success',
          'Batch Migration Complete',
          `${res.migrated_count} products converted to the composable configurator schema.`
        );
        loadData(true);
      } else {
        showToast('error', 'Migration Failed', res.error || 'Failed running batch migration');
      }
    } catch (err: any) {
      showToast('error', 'Migration Error', err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  // Layer manipulation helpers
  const handleAddPresetLayer = (preset: typeof COMMON_PRESET_LAYERS[0]) => {
    if (!editingProfile) return;
    const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    
    // Check if layer id already exists
    if (editingProfile.layers.some((l) => l.id === slug)) {
      showToast('error', 'Duplicate Layer', `Layer "${preset.name}" already exists on this product.`);
      return;
    }

    const newLayer: ConfiguratorLayer = {
      id: slug,
      name: preset.name,
      group: preset.group as any,
      is_required: preset.is_required,
      is_optional: preset.is_optional,
      default_selected: !preset.is_optional,
      extra_price: preset.extra_price,
      z_index: editingProfile.layers.length + 1,
      allowed_finish_groups: ['Signature skins', 'Colors', 'Natural'],
      assets_by_view: {
        [activeSimView || 'main_view']: {
          render_texture_map: {},
        },
      },
    };

    setEditingProfile({
      ...editingProfile,
      layers: [...editingProfile.layers, newLayer],
    });

    setSelectedSimLayers((prev) => ({ ...prev, [slug]: newLayer.default_selected }));
    setExpandedLayerId(slug);
    showToast('info', 'Layer Added', `Added "${preset.name}". Click "Assign Images & Textures" to map finishes.`);
  };

  const handleRemoveLayer = (layerId: string) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.filter((l) => l.id !== layerId),
    });
    if (expandedLayerId === layerId) setExpandedLayerId(null);
    setSelectedSimLayers((prev) => {
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
  };

  const handleUpdateLayer = (layerId: string, patch: Partial<ConfiguratorLayer>) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
    });
  };

  const handleSetFinishTexture = (layerId: string, finishSlug: string, url: string) => {
    if (!editingProfile) return;
    const viewId = activeSimView || 'main_view';
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => {
        if (l.id !== layerId) return l;
        const currentAssets = l.assets_by_view || {};
        const currentViewAssets = currentAssets[viewId] || {};
        const currentMap = currentViewAssets.render_texture_map || {};
        return {
          ...l,
          assets_by_view: {
            ...currentAssets,
            [viewId]: {
              ...currentViewAssets,
              render_texture_map: {
                ...currentMap,
                [finishSlug]: url.trim(),
              },
            },
          },
        };
      }),
    });
  };

  const handleSetMaskSvg = (layerId: string, maskUrl: string) => {
    if (!editingProfile) return;
    const viewId = activeSimView || 'main_view';
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => {
        if (l.id !== layerId) return l;
        const currentAssets = l.assets_by_view || {};
        const currentViewAssets = currentAssets[viewId] || {};
        return {
          ...l,
          assets_by_view: {
            ...currentAssets,
            [viewId]: {
              ...currentViewAssets,
              mask_svg_url: maskUrl.trim(),
            },
          },
        };
      }),
    });
  };

  const handleSetShadowPng = (layerId: string, shadowUrl: string) => {
    if (!editingProfile) return;
    const viewId = activeSimView || 'main_view';
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => {
        if (l.id !== layerId) return l;
        const currentAssets = l.assets_by_view || {};
        const currentViewAssets = currentAssets[viewId] || {};
        return {
          ...l,
          assets_by_view: {
            ...currentAssets,
            [viewId]: {
              ...currentViewAssets,
              shadow_png_url: shadowUrl.trim(),
            },
          },
        };
      }),
    });
  };

  const handleSetHighlightPng = (layerId: string, highlightUrl: string) => {
    if (!editingProfile) return;
    const viewId = activeSimView || 'main_view';
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => {
        if (l.id !== layerId) return l;
        const currentAssets = l.assets_by_view || {};
        const currentViewAssets = currentAssets[viewId] || {};
        return {
          ...l,
          assets_by_view: {
            ...currentAssets,
            [viewId]: {
              ...currentViewAssets,
              highlight_png_url: highlightUrl.trim(),
            },
          },
        };
      }),
    });
  };

  const handleSetViewBackground = (viewId: string, bgUrl: string) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      views: editingProfile.views.map((v) => (v.id === viewId ? { ...v, background_url: bgUrl.trim() } : v)),
    });
  };

  const handleAutofillLayerTextures = (layerId: string) => {
    if (!editingProfile || !autofillPrefix.trim()) {
      showToast('error', 'Prefix Required', 'Enter a URL prefix pattern like https://exacoat.com/wp-content/uploads/iPhone-16-Pro-Back-');
      return;
    }
    const viewId = activeSimView || 'main_view';
    const newMap: Record<string, string> = {};
    finishes.forEach((f) => {
      // replace {finish} or append slug
      const slug = f.slug || f.id;
      const url = autofillPrefix.includes('{finish}')
        ? autofillPrefix.replace('{finish}', slug)
        : `${autofillPrefix.replace(/\/?$/, '')}/${slug}.png`;
      newMap[slug] = url;
    });

    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => {
        if (l.id !== layerId) return l;
        const currentAssets = l.assets_by_view || {};
        const currentViewAssets = currentAssets[viewId] || {};
        return {
          ...l,
          assets_by_view: {
            ...currentAssets,
            [viewId]: {
              ...currentViewAssets,
              render_texture_map: {
                ...(currentViewAssets.render_texture_map || {}),
                ...newMap,
              },
            },
          },
        };
      }),
    });

    showToast('success', 'Textures Autofilled', `Generated ${finishes.length} finish image URLs for layer.`);
  };

  const handleMoveLayer = (index: number, direction: 'up' | 'down') => {
    if (!editingProfile) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editingProfile.layers.length) return;

    const copy = [...editingProfile.layers];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    copy.forEach((l, idx) => {
      l.z_index = idx + 1;
    });

    setEditingProfile({
      ...editingProfile,
      layers: copy,
    });
  };

  // View manipulation helpers
  const handleAddView = (viewName: string) => {
    if (!editingProfile || !viewName.trim()) return;
    const slug = viewName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    if (editingProfile.views.some((v) => v.id === slug)) return;

    const newView: ConfiguratorView = {
      id: slug,
      name: viewName.trim(),
      is_default: editingProfile.views.length === 0,
      aspect_ratio: '1:1',
      canvas_dimensions: { width: 1000, height: 1000 },
    };

    setEditingProfile({
      ...editingProfile,
      views: [...editingProfile.views, newView],
    });
  };

  const handleRemoveView = (viewId: string) => {
    if (!editingProfile) return;
    if (editingProfile.views.length <= 1) {
      showToast('error', 'View Required', 'Each product configurator must have at least one active view.');
      return;
    }
    setEditingProfile({
      ...editingProfile,
      views: editingProfile.views.filter((v) => v.id !== viewId),
    });
    if (activeSimView === viewId) {
      const remaining = editingProfile.views.filter((v) => v.id !== viewId);
      if (remaining.length > 0) setActiveSimView(remaining[0].id);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const list = new Set<string>();
    profiles.forEach((p) => {
      p.categories.forEach((c) => list.add(c));
    });
    return ['all', ...Array.from(list).sort()];
  }, [profiles]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === 'all' || p.categories.includes(selectedCategory);

      const matchesStatus =
        filterConfigured === 'all'
          ? true
          : filterConfigured === 'configured'
          ? p.is_configurable
          : !p.is_configurable;

      const matchesVersion =
        filterVersion === 'all'
          ? true
          : (p.configurator_version || 'v1') === filterVersion;

      return matchesSearch && matchesCat && matchesStatus && matchesVersion;
    });
  }, [profiles, searchQuery, selectedCategory, filterConfigured, filterVersion]);

  // Live Price Calculation in Simulator
  const simulatedTotalPrice = useMemo(() => {
    if (!editingProfile) return 0;
    let total = editingProfile.base_price || 0;

    const activeFinish = finishes.find((f) => f.slug === selectedSimFinish || f.id === selectedSimFinish);
    const finishTierSurcharge = (activeFinish?.extra_price || 0) * (editingProfile.size_multiplier || 1.0);

    let activeLayerCount = 0;
    editingProfile.layers.forEach((layer) => {
      const isSelected = selectedSimLayers[layer.id] ?? (layer.default_selected || layer.is_required);
      if (isSelected) {
        total += Number(layer.extra_price) || 0;
        activeLayerCount++;
      }
    });

    if (activeLayerCount > 0) {
      total += finishTierSurcharge;
    }

    return total;
  }, [editingProfile, selectedSimLayers, selectedSimFinish, finishes]);

  // Catalog Stats
  const stats = useMemo(() => {
    const total = profiles.length;
    const configured = profiles.filter((p) => p.is_configurable).length;
    const multiAngle = profiles.filter((p) => p.views_count > 1).length;
    return { total, configured, multiAngle };
  }, [profiles]);

  const getFamilyIcon = (family: DeviceFamily) => {
    switch (family) {
      case 'laptop':
        return <Laptop className="w-4 h-4 text-sky-400" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-emerald-400" />;
      case 'keyboard':
        return <KeyboardIcon className="w-4 h-4 text-amber-400" />;
      default:
        return <Smartphone className="w-4 h-4 text-[#f3aa18]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <PageHeroHeader
        title="Composable Product Configurator Studio"
        subtitle="Manage per-device views, composable layers, and up-price calculations across all device categories."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-mono font-medium rounded-xl border border-white/10 hover:bg-white/[0.04] text-zinc-300 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isRefreshing && 'animate-spin text-[#f3aa18]')} />
              Refresh
            </button>
            <button
              onClick={handleBatchMigrate}
              disabled={isMigrating}
              className="px-4 py-2 text-xs font-mono font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FolderSync className={clsx('w-3.5 h-3.5', isMigrating && 'animate-spin')} />
              {isMigrating ? 'Migrating Catalog...' : 'Auto-Migrate All Products'}
            </button>
          </div>
        }
      />

      {/* Migration Result Banner if triggered */}
      {migrationResult && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-mono text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Catalog migration verified: <strong>{migrationResult.migrated_count}</strong> products converted to the composable schema.
            </span>
          </div>
          <button
            onClick={() => setMigrationResult(null)}
            className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#f3aa18] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Catalog Devices</p>
            <p className="text-2xl font-mono font-bold text-white mt-0.5">{stats.total}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Composable Ready</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">{stats.configured}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Multi-Angle Setups</p>
            <p className="text-2xl font-mono font-bold text-sky-400 mt-0.5">{stats.multiAngle}</p>
          </div>
        </GlassCard>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search device name, model, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-zinc-900/60 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/50"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setFilterConfigured('all')}
              className={clsx(
                'px-2.5 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer',
                filterConfigured === 'all' ? 'bg-white/15 text-white font-bold' : 'text-zinc-400 hover:text-white'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterConfigured('configured')}
              className={clsx(
                'px-2.5 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer',
                filterConfigured === 'configured' ? 'bg-white/15 text-white font-bold' : 'text-zinc-400 hover:text-white'
              )}
            >
              Active
            </button>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setFilterVersion('all')}
              className={clsx(
                'px-2.5 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer',
                filterVersion === 'all' ? 'bg-white/15 text-white font-bold' : 'text-zinc-400 hover:text-white'
              )}
            >
              All Versions
            </button>
            <button
              onClick={() => setFilterVersion('v1')}
              className={clsx(
                'px-2.5 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer',
                filterVersion === 'v1' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-zinc-400 hover:text-white'
              )}
            >
              v1 Legacy
            </button>
            <button
              onClick={() => setFilterVersion('v2')}
              className={clsx(
                'px-2.5 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer',
                filterVersion === 'v2' ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40' : 'text-zinc-400 hover:text-white'
              )}
            >
              v2 Modern
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-mono rounded-lg transition-colors capitalize whitespace-nowrap cursor-pointer',
                  selectedCategory === cat
                    ? 'bg-white/10 text-white font-bold border border-white/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                )}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#f3aa18]" />
          <p className="text-xs font-mono text-zinc-500">Scanning catalog configurators...</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-300">No products match your filter criteria</p>
          <p className="text-xs text-zinc-500 mt-1">Try broadening your search query or selecting a different category.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((p) => (
            <GlassCard
              key={p.product_id}
              className="p-4 flex flex-col justify-between hover:border-white/20 transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                      {getFamilyIcon(p.family)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                      <p className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                        {p.categories.join(', ') || 'Uncategorized'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={clsx(
                        'text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider',
                        (p.configurator_version || 'v1') === 'v2'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      )}
                    >
                      {(p.configurator_version || 'v1') === 'v2' ? 'v2 Modern' : 'v1 Legacy'}
                    </span>

                    <span
                      className={clsx(
                        'text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider',
                        p.is_configurable
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-white/10'
                      )}
                    >
                      {p.is_configurable ? `${p.layers_count} Layers` : 'No Layers'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] font-mono text-zinc-500">Base Price</p>
                    <p className="text-xs font-mono font-bold text-white mt-0.5">
                      IDR {p.price.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] font-mono text-zinc-500">Views</p>
                    <p className="text-xs font-mono font-bold text-sky-400 mt-0.5">
                      {p.views_count} {p.views_count === 1 ? 'Angle' : 'Angles'}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] font-mono text-zinc-500">Size Scale</p>
                    <p className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                      {p.size_multiplier}x
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] font-mono text-zinc-500">ID #{p.product_id}</span>
                <button
                  onClick={() => handleOpenEditor(p.product_id)}
                  className="px-3.5 py-1.5 text-xs font-mono font-medium rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3 h-3 text-[#f3aa18]" />
                  Configure
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Detail / Configurator Studio Drawer Modal */}
      {selectedProductId &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-5xl rounded-2xl bg-zinc-950 border border-white/10 p-6 shadow-2xl relative my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 shrink-0 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18] shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    {editingProfile?.device_name || 'Loading Configurator Studio...'}
                  </h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">
                    Product SKU #{selectedProductId} | Category: {editingProfile?.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {editingProfile && (
                  <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-white/10 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setEditingProfile({ ...editingProfile, configurator_version: 'v1' })}
                      className={clsx(
                        'px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                        (editingProfile.configurator_version || 'v1') === 'v1'
                          ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      )}
                    >
                      <span>v1 Legacy</span>
                      <span className="text-[10px] opacity-75">(2-Layer PNG)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProfile({ ...editingProfile, configurator_version: 'v2' })}
                      className={clsx(
                        'px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                        editingProfile.configurator_version === 'v2'
                          ? 'bg-sky-500 text-black font-bold shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      )}
                    >
                      <span>v2 Modern</span>
                      <span className="text-[10px] opacity-75">(Mask & Colors)</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={handleCloseEditor}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isLoadingProfile || !editingProfile ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-[#f3aa18]" />
                <p className="text-xs font-mono text-zinc-400">Loading composable layers and views...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
                {/* Active Architecture Mode Explainer */}
                {(editingProfile.configurator_version || 'v1') === 'v1' ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-200 font-mono">
                    <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300">v1 Configurator Model (Active):</span> 2-layer production model. Layer 1 is the Device Hardware Body PNG; Layer 2 is the individual texture PNG overlay crafted per finish in Photoshop. 100% backward compatible with current customer store orders.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-2.5 text-xs text-sky-200 font-mono">
                    <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sky-300">v2 Modern Configurator Model (Preview):</span> Dynamic composite engine. Allows hardware chassis color tinting and swatches, reusable vector cutout masks, and realistic Photoshop multiply shadow overlays.
                    </div>
                  </div>
                )}

                {/* v2 Device Hardware Colors & Swatches Panel */}
                {editingProfile.configurator_version === 'v2' && (
                  <div className="p-4 rounded-xl bg-zinc-900/80 border border-sky-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <Palette className="w-4 h-4 text-sky-400" />
                          Hardware Chassis Colors ({editingProfile.device_colors?.length || 0})
                        </h4>
                        <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                          Configure hardware color variants that customers can select for the device body in v2.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const newColor = {
                            id: `color-${Date.now()}`,
                            name: 'New Color',
                            hex: '#888888',
                          };
                          setEditingProfile({
                            ...editingProfile,
                            device_colors: [...(editingProfile.device_colors || []), newColor],
                          });
                        }}
                        className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Color
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                      {(editingProfile.device_colors && editingProfile.device_colors.length > 0
                        ? editingProfile.device_colors
                        : [
                            { id: 'space-gray', name: 'Space Gray', hex: '#535559' },
                            { id: 'silver', name: 'Silver', hex: '#e3e4e5' },
                            { id: 'midnight', name: 'Midnight', hex: '#1e242b' },
                            { id: 'starlight', name: 'Starlight', hex: '#f0e4d3' },
                          ]
                      ).map((c, cIdx) => (
                        <div
                          key={c.id || cIdx}
                          className="p-2.5 rounded-lg bg-zinc-950 border border-white/10 flex items-center gap-2.5 text-xs font-mono"
                        >
                          <input
                            type="color"
                            value={c.hex}
                            onChange={(e) => {
                              const currentColors = editingProfile.device_colors && editingProfile.device_colors.length > 0
                                ? [...editingProfile.device_colors]
                                : [
                                    { id: 'space-gray', name: 'Space Gray', hex: '#535559' },
                                    { id: 'silver', name: 'Silver', hex: '#e3e4e5' },
                                    { id: 'midnight', name: 'Midnight', hex: '#1e242b' },
                                    { id: 'starlight', name: 'Starlight', hex: '#f0e4d3' },
                                  ];
                              currentColors[cIdx] = { ...c, hex: e.target.value };
                              setEditingProfile({ ...editingProfile, device_colors: currentColors });
                            }}
                            className="w-7 h-7 rounded-lg border border-white/20 bg-transparent cursor-pointer shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={c.name}
                              onChange={(e) => {
                                const currentColors = editingProfile.device_colors && editingProfile.device_colors.length > 0
                                  ? [...editingProfile.device_colors]
                                  : [
                                      { id: 'space-gray', name: 'Space Gray', hex: '#535559' },
                                      { id: 'silver', name: 'Silver', hex: '#e3e4e5' },
                                      { id: 'midnight', name: 'Midnight', hex: '#1e242b' },
                                      { id: 'starlight', name: 'Starlight', hex: '#f0e4d3' },
                                    ];
                                currentColors[cIdx] = { ...c, name: e.target.value };
                                setEditingProfile({ ...editingProfile, device_colors: currentColors });
                              }}
                              className="w-full text-xs font-bold text-white bg-transparent border-b border-white/10 focus:outline-none focus:border-sky-400"
                            />
                            <span className="text-[10px] text-zinc-500 uppercase">{c.hex}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const currentColors = editingProfile.device_colors && editingProfile.device_colors.length > 0
                                ? editingProfile.device_colors
                                : [
                                    { id: 'space-gray', name: 'Space Gray', hex: '#535559' },
                                    { id: 'silver', name: 'Silver', hex: '#e3e4e5' },
                                    { id: 'midnight', name: 'Midnight', hex: '#1e242b' },
                                    { id: 'starlight', name: 'Starlight', hex: '#f0e4d3' },
                                  ];
                              const updated = currentColors.filter((_, i) => i !== cIdx);
                              setEditingProfile({ ...editingProfile, device_colors: updated });
                            }}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 1. Device Global Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-900/60 border border-white/5">
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Base Price (IDR)</label>
                    <input
                      type="number"
                      value={editingProfile.base_price}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, base_price: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Device Family</label>
                    <select
                      value={editingProfile.family}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, family: e.target.value as DeviceFamily })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
                    >
                      <option value="phone">Phone</option>
                      <option value="laptop">Laptop / MacBook</option>
                      <option value="tablet">iPad / Tablet</option>
                      <option value="foldable">Foldable / Flip</option>
                      <option value="keyboard">Magic Keyboard / Folio</option>
                      <option value="case">Hybrid Case</option>
                      <option value="console">Gaming Console</option>
                      <option value="accessory">Accessory</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                      Size Multiplier (Vinyl Roll Area)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingProfile.size_multiplier}
                      onChange={(e) =>
                        setEditingProfile({ ...editingProfile, size_multiplier: Number(e.target.value) || 1.0 })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Quick Add Preset Layer</label>
                    <select
                      onChange={(e) => {
                        const preset = COMMON_PRESET_LAYERS.find((p) => p.name === e.target.value);
                        if (preset) handleAddPresetLayer(preset);
                        e.target.value = '';
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-950 border border-[#f3aa18]/40 text-[#f3aa18] font-mono focus:outline-none cursor-pointer"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        + Choose Preset Layer...
                      </option>
                      {COMMON_PRESET_LAYERS.map((preset) => (
                        <option key={preset.name} value={preset.name}>
                          {preset.name} (+IDR {preset.extra_price.toLocaleString('id-ID')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Views / Angles Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Eye className="w-4 h-4 text-sky-400" />
                      Viewing Angles ({editingProfile.views.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddView('Side View')}
                        className="px-2.5 py-1 text-[11px] font-mono rounded-lg border border-white/10 hover:bg-white/5 text-zinc-300 transition-colors cursor-pointer"
                      >
                        + Add Side View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddView('Inner View')}
                        className="px-2.5 py-1 text-[11px] font-mono rounded-lg border border-white/10 hover:bg-white/5 text-zinc-300 transition-colors cursor-pointer"
                      >
                        + Add Inner View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddView('Trackpad View')}
                        className="px-2.5 py-1 text-[11px] font-mono rounded-lg border border-white/10 hover:bg-white/5 text-zinc-300 transition-colors cursor-pointer"
                      >
                        + Add Trackpad View
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {editingProfile.views.map((v) => (
                      <div
                        key={v.id}
                        className={clsx(
                          'px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-mono transition-colors',
                          activeSimView === v.id
                            ? 'bg-[#f3aa18]/15 border-[#f3aa18]/50 text-white font-bold'
                            : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveSimView(v.id)}
                          className="cursor-pointer"
                        >
                          {v.name}
                        </button>
                        <span className="text-[10px] text-zinc-500">({v.id})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveView(v.id)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                          title="Remove view"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Active View Hardware Base Background (Layer 1) */}
                  {(() => {
                    const currentView = editingProfile.views.find((v) => v.id === activeSimView) || editingProfile.views[0];
                    if (!currentView) return null;
                    return (
                      <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-sky-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
                        <div className="flex items-center gap-3 min-w-0">
                          {currentView.background_url ? (
                            <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-sky-500/30 overflow-hidden shrink-0 flex items-center justify-center p-1">
                              <img
                                src={currentView.background_url}
                                alt="Hardware body"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-dashed border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center text-zinc-600">
                              <Layers className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] font-bold text-sky-300 uppercase tracking-wider">
                                Layer 1: Base Device Hardware Render
                              </label>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                Angle: {currentView.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              The neutral base image of the device body (camera lenses, ports, edges). Finish skins overlay on top of this.
                            </p>
                          </div>
                        </div>
                        <div className="w-full md:w-96 shrink-0">
                          <input
                            type="url"
                            placeholder="https://exacoat.com/wp-content/uploads/renders/device-body.png"
                            value={currentView.background_url || ''}
                            onChange={(e) => handleSetViewBackground(currentView.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-sky-400 placeholder:text-zinc-600"
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 3. Composable Skin Layers Editor */}
                {(() => {
                  const skinLayers = (editingProfile.layers || []).filter(
                    (l) => (l.name || '').toLowerCase() !== 'device' && (l.id || '').toLowerCase() !== 'device'
                  );
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#f3aa18]" />
                          Composable Skin Layers ({skinLayers.length})
                        </h4>
                        <p className="text-[11px] font-mono text-zinc-500">
                          Configure finish texture overlays (Photoshop PNGs) per customizable skin part.
                        </p>
                      </div>

                      {skinLayers.length === 0 ? (
                        <div className="p-8 rounded-xl bg-zinc-900/40 border border-dashed border-white/10 text-center">
                          <p className="text-xs text-zinc-400">No skin layers registered for this device yet.</p>
                          <p className="text-[11px] text-zinc-500 mt-1">
                            Use the "Quick Add Preset Layer" dropdown above to add standard Back, Frame, or Accent layers.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {skinLayers.map((layer, idx) => {
                        const isExpanded = expandedLayerId === layer.id;
                        const viewAssets = layer.assets_by_view?.[activeSimView || 'main_view'] || {};
                        const textureMap = viewAssets.render_texture_map || {};
                        const assignedTextureCount = Object.keys(textureMap).filter((k) => !!textureMap[k]).length;

                        return (
                          <div
                            key={layer.id}
                            className="rounded-xl bg-zinc-900/80 border border-white/10 overflow-hidden text-xs"
                          >
                            {/* Layer Header Row */}
                            <div className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-zinc-900/90 border-b border-white/5">
                              {/* Left: Reorder + Name + Slug */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex flex-col gap-0.5 shrink-0 text-zinc-500">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLayer(idx, 'up')}
                                    disabled={idx === 0}
                                    className="hover:text-white disabled:opacity-20 cursor-pointer"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLayer(idx, 'down')}
                                    disabled={idx === editingProfile.layers.length - 1}
                                    className="hover:text-white disabled:opacity-20 cursor-pointer"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-zinc-500 text-[11px]">#{idx + 1}</span>
                                    <input
                                      type="text"
                                      value={layer.name}
                                      onChange={(e) => handleUpdateLayer(layer.id, { name: e.target.value })}
                                      className="font-bold text-white bg-transparent border-b border-white/10 focus:border-[#f3aa18] focus:outline-none text-xs"
                                    />
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">
                                      {layer.id}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Middle: Toggles & Up-Price */}
                              <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={layer.is_required}
                                    onChange={(e) =>
                                      handleUpdateLayer(layer.id, {
                                        is_required: e.target.checked,
                                        is_optional: !e.target.checked && layer.is_optional,
                                      })
                                    }
                                    className="w-3.5 h-3.5 rounded text-[#f3aa18] bg-zinc-800 border-white/20"
                                  />
                                  <span className="text-[11px] font-mono text-zinc-300">Required</span>
                                </label>

                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={layer.is_optional}
                                    disabled={layer.is_required}
                                    onChange={(e) =>
                                      handleUpdateLayer(layer.id, { is_optional: e.target.checked })
                                    }
                                    className="w-3.5 h-3.5 rounded text-[#f3aa18] bg-zinc-800 border-white/20 disabled:opacity-30"
                                  />
                                  <span className="text-[11px] font-mono text-zinc-300">Can Deselect</span>
                                </label>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-mono text-zinc-400">Up-Price:</span>
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500">
                                      +IDR
                                    </span>
                                    <input
                                      type="number"
                                      value={layer.extra_price}
                                      onChange={(e) =>
                                        handleUpdateLayer(layer.id, { extra_price: Number(e.target.value) || 0 })
                                      }
                                      className="w-28 pl-10 pr-2 py-1 text-xs font-mono font-bold text-[#f3aa18] bg-zinc-950 rounded-lg border border-white/10 focus:outline-none focus:border-[#f3aa18]"
                                    />
                                  </div>
                                </div>

                                {/* Expand Texture Manager Button */}
                                <button
                                  type="button"
                                  onClick={() => setExpandedLayerId(isExpanded ? null : layer.id)}
                                  className={clsx(
                                    'px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer',
                                    isExpanded
                                      ? 'bg-[#f3aa18]/20 border-[#f3aa18]/50 text-[#f3aa18] font-bold'
                                      : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                                  )}
                                >
                                  <ImageIcon className="w-3 h-3 text-[#f3aa18]" />
                                  <span>Textures ({assignedTextureCount})</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveLayer(layer.id)}
                                  className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Delete layer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Expandable Image & Texture Matrix */}
                            {isExpanded && (
                              <div className="p-4 bg-zinc-950/90 border-t border-white/5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                                  <div>
                                    <h5 className="font-mono font-bold text-white text-xs flex items-center gap-2">
                                      <ImageIcon className="w-3.5 h-3.5 text-[#f3aa18]" />
                                      Finish Textures for Layer: "{layer.name}" (Viewing: {activeSimView})
                                    </h5>
                                    <p className="text-[11px] text-zinc-500 mt-0.5">
                                      Assign transparent render PNG URLs for each material finish or specify an SVG mask outline.
                                    </p>
                                  </div>

                                  {/* Quick Autofill Helper */}
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="https://.../iPhone-16-Pro-Back-{finish}.png"
                                      value={autofillPrefix}
                                      onChange={(e) => setAutofillPrefix(e.target.value)}
                                      className="px-2.5 py-1 text-[11px] rounded-lg bg-zinc-900 border border-white/10 text-white font-mono w-64 placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAutofillLayerTextures(layer.id)}
                                      className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                                    >
                                      Autofill All
                                    </button>
                                  </div>
                                </div>

                                {/* V2 Composite Asset Inputs (Mask + Realistic Shadow Overlay) - Only displayed for V2 */}
                                {editingProfile.configurator_version === 'v2' && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-mono font-bold text-zinc-300">
                                          Vector Cutout Mask (SVG or Alpha PNG)
                                        </label>
                                        <span className="text-[10px] font-mono text-zinc-500">Layer 2: Mask</span>
                                      </div>
                                      <input
                                        type="url"
                                        placeholder="https://exacoat.com/wp-content/uploads/masks/iphone-16-back.svg"
                                        value={viewAssets.mask_svg_url || ''}
                                        onChange={(e) => handleSetMaskSvg(layer.id, e.target.value)}
                                        className="w-full px-2.5 py-1 text-[11px] font-mono rounded-lg bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                                      />
                                      <p className="text-[10px] text-zinc-500">
                                        Used for dynamic canvas clipping or SVG shape clipping.
                                      </p>
                                    </div>

                                    <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-mono font-bold text-amber-300">
                                          Realistic Shadow & AO Overlay (PNG)
                                        </label>
                                        <span className="text-[10px] font-mono text-amber-400">Layer 3: Top Shadow</span>
                                      </div>
                                      <input
                                        type="url"
                                        placeholder="https://exacoat.com/wp-content/uploads/shadows/iphone-16-shadow.png"
                                        value={viewAssets.shadow_png_url || ''}
                                        onChange={(e) => handleSetShadowPng(layer.id, e.target.value)}
                                        className="w-full px-2.5 py-1 text-[11px] font-mono rounded-lg bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                                      />
                                      <p className="text-[10px] text-zinc-500">
                                        Photoshop shadow overlay (camera bump, edge chamfers, logo depth) with multiply blend.
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Materials Texture URL Matrix */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                                  {finishes.map((f) => {
                                    const finishSlug = f.slug || f.id;
                                    const currentUrl = textureMap[finishSlug] || '';

                                    return (
                                      <div
                                        key={f.id}
                                        className="p-2.5 rounded-lg bg-zinc-900/70 border border-white/5 flex items-center gap-2.5 text-[11px] font-mono"
                                      >
                                        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                          {currentUrl ? (
                                            <img
                                              src={currentUrl}
                                              alt={f.name}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                (e.target as HTMLElement).style.display = 'none';
                                              }}
                                            />
                                          ) : f.thumbnail ? (
                                            <img
                                              src={f.thumbnail}
                                              alt={f.name}
                                              className="w-full h-full object-cover opacity-60"
                                            />
                                          ) : (
                                            <Sparkles className="w-3.5 h-3.5 text-zinc-600" />
                                          )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-white truncate">{f.name}</span>
                                            <span className="text-[9px] text-zinc-500 uppercase">{f.group}</span>
                                          </div>
                                          <input
                                            type="url"
                                            placeholder="PNG texture URL..."
                                            value={currentUrl}
                                            onChange={(e) =>
                                              handleSetFinishTexture(layer.id, finishSlug, e.target.value)
                                            }
                                            className="w-full px-2 py-0.5 text-[10px] rounded bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

                {/* 4. Real-time Simulator & Price Calculator */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#f3aa18]" />
                      Live Configurator Simulator & Price Calculator
                    </h4>
                    <div className="flex flex-wrap items-center gap-3">
                      {editingProfile.configurator_version === 'v2' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-zinc-400">Device Color:</span>
                          <div className="flex items-center gap-1">
                            {(editingProfile.device_colors && editingProfile.device_colors.length > 0
                              ? editingProfile.device_colors
                              : [
                                  { id: 'space-gray', name: 'Space Gray', hex: '#535559' },
                                  { id: 'silver', name: 'Silver', hex: '#e3e4e5' },
                                  { id: 'midnight', name: 'Midnight', hex: '#1e242b' },
                                  { id: 'starlight', name: 'Starlight', hex: '#f0e4d3' },
                                ]
                            ).map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedSimColor(c.id)}
                                title={c.name}
                                style={{ backgroundColor: c.hex }}
                                className={clsx(
                                  'w-4 h-4 rounded-full border cursor-pointer transition-transform',
                                  selectedSimColor === c.id
                                    ? 'scale-125 border-white ring-2 ring-sky-400/50'
                                    : 'border-white/30 hover:scale-110'
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-zinc-400">Simulate Finish:</span>
                        <select
                          value={selectedSimFinish}
                          onChange={(e) => setSelectedSimFinish(e.target.value)}
                          className="px-2.5 py-1 text-xs font-mono rounded-lg bg-zinc-950 border border-white/10 text-white focus:outline-none"
                        >
                          {finishes.map((f) => (
                            <option key={f.id} value={f.slug}>
                              {f.name} (
                              {(f.extra_price ?? 0) > 0 ? `+IDR ${(f.extra_price ?? 0).toLocaleString('id-ID')}` : 'Standard'}
                              )
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
                    {/* 1. Simulator layer checklist */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                        Active Customer Selections:
                      </p>
                      {editingProfile.layers.map((l) => {
                        const isChecked = selectedSimLayers[l.id] ?? (l.default_selected || l.is_required);
                        return (
                          <label
                            key={l.id}
                            className={clsx(
                              'p-2.5 rounded-lg border flex items-center justify-between transition-colors cursor-pointer text-xs font-mono',
                              isChecked
                                ? 'bg-white/10 border-white/20 text-white font-bold'
                                : 'bg-white/[0.02] border-white/5 text-zinc-400'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={l.is_required}
                                onChange={(e) =>
                                  setSelectedSimLayers({ ...selectedSimLayers, [l.id]: e.target.checked })
                                }
                                className="w-3.5 h-3.5 rounded text-[#f3aa18] bg-zinc-800 border-white/20 disabled:opacity-50"
                              />
                              <span>{l.name}</span>
                              {l.is_required && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-400">
                                  Required
                                </span>
                              )}
                            </div>
                            <span className="text-[#f3aa18]">
                              {(l.extra_price ?? 0) > 0 ? `+IDR ${(l.extra_price ?? 0).toLocaleString('id-ID')}` : 'Included'}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* 2. Visual Composite Canvas Preview (Base + Textures + Shadow Overlay) */}
                    {(() => {
                      const currentView = editingProfile.views.find((v) => v.id === activeSimView) || editingProfile.views[0];
                      const devLayer = editingProfile.layers.find((l) => (l.name || '').toLowerCase() === 'device');
                      const baseBodyUrl =
                        currentView?.background_url ||
                        devLayer?.assets_by_view?.[currentView?.id || 'main_view']?.render_texture_map?.['device'] ||
                        Object.values(devLayer?.assets_by_view || {})[0]?.render_texture_map?.['device'] ||
                        Object.values(devLayer?.assets_by_view || {})[0]?.base_hardware_body_url ||
                        Object.values(editingProfile.layers[0]?.assets_by_view || {})[0]?.base_hardware_body_url;

                      return (
                        <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col justify-between relative overflow-hidden min-h-[260px]">
                          <div className="w-full flex items-center justify-between text-[11px] font-mono pb-2 border-b border-white/5">
                            <span className="flex items-center gap-1.5 text-zinc-300 font-bold">
                              <Eye className="w-3.5 h-3.5 text-sky-400" />
                              <span>{currentView?.name || 'Main View'}</span>
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                              {(editingProfile.configurator_version || 'v1') === 'v2' ? 'v2 Composite' : 'v1 2-Layer'}
                            </span>
                          </div>

                          <div className="relative w-48 h-48 mx-auto my-3 flex items-center justify-center">
                            {/* Layer 1: Base Device Hardware Render */}
                            {baseBodyUrl ? (
                              <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-0">
                                <img
                                  src={baseBodyUrl}
                                  alt="Base Hardware Body"
                                  className="w-full h-full object-contain pointer-events-none"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                {editingProfile.configurator_version === 'v2' && selectedSimColor && (
                                  <div
                                    style={{
                                      backgroundColor:
                                        editingProfile.device_colors?.find((c) => c.id === selectedSimColor)?.hex ||
                                        '#535559',
                                      mixBlendMode: 'color',
                                    }}
                                    className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="absolute inset-0 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-[10px] font-mono text-zinc-500 text-center p-3">
                                <Smartphone className="w-6 h-6 text-zinc-600 mb-1" />
                                <span>No Base Hardware Image URL</span>
                              </div>
                            )}

                            {/* Layer 2: Composable Layer Textures */}
                            {editingProfile.layers.map((l) => {
                              if ((l.name || '').toLowerCase() === 'device') return null;
                              const isChecked = selectedSimLayers[l.id] ?? (l.default_selected || l.is_required);
                              if (!isChecked) return null;

                              const assets =
                                l.assets_by_view?.[currentView?.id || 'main_view'] ||
                                l.assets_by_view?.['main_view'] ||
                                Object.values(l.assets_by_view || {})[0] ||
                                {};

                              const texUrl =
                                assets.render_texture_map?.[selectedSimFinish] ||
                                assets.render_texture_map?.[selectedSimFinish.toLowerCase().replace(/[^a-z0-9]+/g, '-')];

                              if (!texUrl) return null;

                              return (
                                <img
                                  key={l.id}
                                  src={texUrl}
                                  alt={l.name}
                                  style={{ zIndex: (l.z_index || 1) + 2 }}
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              );
                            })}

                            {/* Layer 3: Realistic Shadow & Ambient Occlusion Overlay (Multiply) */}
                            {editingProfile.layers.map((l) => {
                              const isChecked = selectedSimLayers[l.id] ?? (l.default_selected || l.is_required);
                              if (!isChecked) return null;

                              const assets =
                                l.assets_by_view?.[currentView?.id || 'main_view'] ||
                                l.assets_by_view?.['main_view'] ||
                                Object.values(l.assets_by_view || {})[0] ||
                                {};

                              if (!assets.shadow_png_url) return null;

                              return (
                                <img
                                  key={`shadow-${l.id}`}
                                  src={assets.shadow_png_url}
                                  alt={`${l.name} Shadow Overlay`}
                                  style={{ zIndex: (l.z_index || 1) + 20, mixBlendMode: 'multiply' }}
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-2 border-t border-white/5">
                            <span>Composite Render</span>
                            <span className="text-[#f3aa18]">Finish: {selectedSimFinish}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 3. Price calculation receipt */}
                    <div className="p-4 rounded-xl bg-zinc-950 border border-white/5 flex flex-col justify-between">
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Base Product Price:</span>
                          <span>IDR {(editingProfile.base_price || 0).toLocaleString('id-ID')}</span>
                        </div>

                        {editingProfile.layers.map((l) => {
                          const isChecked = selectedSimLayers[l.id] ?? (l.default_selected || l.is_required);
                          if (!isChecked || (l.extra_price || 0) === 0) return null;
                          return (
                            <div key={l.id} className="flex items-center justify-between text-zinc-300">
                              <span>+ Layer ({l.name}):</span>
                              <span>+IDR {(l.extra_price || 0).toLocaleString('id-ID')}</span>
                            </div>
                          );
                        })}

                        {(() => {
                          const activeFinish = finishes.find(
                            (f) => f.slug === selectedSimFinish || f.id === selectedSimFinish
                          );
                          const surcharge = (activeFinish?.extra_price || 0) * (editingProfile.size_multiplier || 1.0);
                          if (surcharge === 0) return null;
                          return (
                            <div className="flex items-center justify-between text-amber-400">
                              <span>+ Finish Surcharge ({activeFinish?.name} × {editingProfile.size_multiplier}x):</span>
                              <span>+IDR {surcharge.toLocaleString('id-ID')}</span>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                            Calculated Final Price
                          </p>
                          <p className="text-xl font-mono font-bold text-emerald-400">
                            IDR {simulatedTotalPrice.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Ready for Storefront
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="px-4 py-2 text-xs font-mono rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile || !editingProfile}
                className="px-5 py-2 text-xs font-mono font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Configurator Profile
                  </>
                )}
              </button>
            </div>
          </div>
          </div>,
          document.body
        )}
    </div>
  );
};
