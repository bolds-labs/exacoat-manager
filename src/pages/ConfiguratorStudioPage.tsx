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
  ArrowLeft,
  Edit3,
  Filter,
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

  // Texture URL Edit Dialog state
  const [editingTextureModal, setEditingTextureModal] = useState<{
    layerId: string;
    layerName: string;
    finishSlug: string;
    finishName: string;
    initialUrl: string;
    thumbnail?: string;
  } | null>(null);
  const [tempTextureUrl, setTempTextureUrl] = useState('');

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

  // Finish restriction handlers
  const handleToggleLayerAllowedFinish = (layerId: string, finishSlug: string) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => {
        if (l.id !== layerId) return l;
        const currentAllowed = l.allowed_finish_slugs || [];
        const normSlug = finishSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
        const exists = currentAllowed.some((s) => s.toLowerCase().replace(/[^a-z0-9]/g, '') === normSlug);
        const nextAllowed = exists
          ? currentAllowed.filter((s) => s.toLowerCase().replace(/[^a-z0-9]/g, '') !== normSlug)
          : [...currentAllowed, finishSlug];
        return {
          ...l,
          allowed_finish_slugs: nextAllowed,
        };
      }),
    });
  };

  const handleSetLayerAllFinishes = (layerId: string, useAll: boolean) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          allowed_finish_slugs: useAll ? [] : ['swarm', 'black-camo'],
        };
      }),
    });
  };

  const handleAutoDetectLayerFinishes = (layerId: string) => {
    if (!editingProfile) return;
    const layer = editingProfile.layers.find((l) => l.id === layerId);
    if (!layer) return;

    const detected = new Set<string>();
    Object.values(layer.assets_by_view || {}).forEach((viewAsset: any) => {
      Object.keys(viewAsset.render_texture_map || {}).forEach((slug) => {
        if (viewAsset.render_texture_map[slug]) {
          detected.add(slug);
        }
      });
    });

    const detectedList = Array.from(detected);
    if (detectedList.length === 0) {
      showToast('info', 'No Textures Found', 'No textures are currently mapped on this layer to detect from.');
      return;
    }

    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => (l.id === layerId ? { ...l, allowed_finish_slugs: detectedList } : l)),
    });
    showToast('success', 'Finishes Detected', `Restricted layer to ${detectedList.length} mapped finishes.`);
  };

  // Texture URL modal handlers
  const handleOpenTextureModal = (
    layerId: string,
    layerName: string,
    finishSlug: string,
    finishName: string,
    initialUrl: string,
    thumbnail?: string
  ) => {
    setEditingTextureModal({ layerId, layerName, finishSlug, finishName, initialUrl, thumbnail });
    setTempTextureUrl(initialUrl || '');
  };

  const handleSaveTextureModal = () => {
    if (!editingTextureModal) return;
    handleSetFinishTexture(editingTextureModal.layerId, editingTextureModal.finishSlug, tempTextureUrl);
    showToast('success', 'Texture Updated', `Updated texture for ${editingTextureModal.finishName}.`);
    setEditingTextureModal(null);
  };

  const handleClearTextureModal = () => {
    if (!editingTextureModal) return;
    handleSetFinishTexture(editingTextureModal.layerId, editingTextureModal.finishSlug, '');
    showToast('info', 'Texture Cleared', `Removed texture for ${editingTextureModal.finishName}.`);
    setEditingTextureModal(null);
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

      {/* Fullscreen Configurator Studio Workspace */}
      {selectedProductId &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col h-screen w-screen overflow-hidden text-white select-none">
            {/* 1. Studio Top Navigation Bar */}
            <header className="h-16 px-6 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between shrink-0 gap-4 z-10">
              {/* Left: Exit Studio button and Device Summary */}
              <div className="flex items-center gap-4 min-w-0">
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white text-xs font-mono transition-colors cursor-pointer shrink-0"
                  title="Exit Studio (ESC)"
                >
                  <ArrowLeft className="w-4 h-4 text-zinc-400" />
                  <span className="font-semibold">Exit Studio</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-mono hidden sm:inline">ESC</span>
                </button>

                <div className="h-5 w-px bg-white/10 hidden sm:block shrink-0" />

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-sm md:text-base font-bold text-white truncate max-w-xs md:max-w-md">
                      {editingProfile?.device_name || 'Loading Device Studio...'}
                    </h2>
                    {editingProfile && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-white/5 text-zinc-300 border border-white/10 shrink-0">
                        {editingProfile.family}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-400 truncate">
                    SKU #{selectedProductId} • Category: {editingProfile?.category || 'General'} • Base: IDR {(editingProfile?.base_price || 0).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              {/* Center: v1 vs v2 Architecture Switcher */}
              {editingProfile && (
                <div className="hidden md:flex items-center bg-zinc-900 p-1 rounded-xl border border-white/10 text-xs font-mono shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingProfile({ ...editingProfile, configurator_version: 'v1' })}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                      (editingProfile.configurator_version || 'v1') === 'v1'
                        ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    )}
                  >
                    <span>v1 Legacy</span>
                    <span className="text-[10px] opacity-80">(Photoshop PNGs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProfile({ ...editingProfile, configurator_version: 'v2' })}
                    className={clsx(
                      'px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                      editingProfile.configurator_version === 'v2'
                        ? 'bg-sky-500 text-black font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    )}
                  >
                    <span>v2 Modern</span>
                    <span className="text-[10px] opacity-80">(Masks & Tinting)</span>
                  </button>
                </div>
              )}

              {/* Right: Quick Save Action */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile || !editingProfile}
                  className="px-5 py-2 text-xs font-mono font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-all flex items-center gap-2 shadow-lg shadow-[#f3aa18]/10 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Configurator</span>
                    </>
                  )}
                </button>
              </div>
            </header>

            {/* 2. Studio Body */}
            {isLoadingProfile || !editingProfile ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950">
                <RefreshCw className="w-10 h-10 animate-spin text-[#f3aa18]" />
                <p className="text-sm font-mono text-zinc-400">Loading configurator layers and angles...</p>
              </div>
            ) : (
              (() => {
                const skinLayers = (editingProfile.layers || []).filter(
                  (l) => (l.name || '').toLowerCase() !== 'device' && (l.id || '').toLowerCase() !== 'device'
                );

                const currentView =
                  editingProfile.views.find((v) => v.id === activeSimView) || editingProfile.views[0];

                const activeLayerForSim =
                  skinLayers.find((l) => l.id === expandedLayerId) || skinLayers[0];
                const activeAllowedSlugs = activeLayerForSim?.allowed_finish_slugs || [];

                const displayedSimulatorFinishes =
                  activeAllowedSlugs.length > 0
                    ? finishes.filter((f) => {
                        const s = (f.slug || f.id).toLowerCase().replace(/[^a-z0-9]/g, '');
                        return activeAllowedSlugs.some(
                          (as) => as.toLowerCase().replace(/[^a-z0-9]/g, '') === s
                        );
                      })
                    : finishes;

                return (
                  <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                    {/* LEFT PANEL: Interactive Live Simulator Sidebar */}
                    <aside className="w-full lg:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-zinc-950/70 flex flex-col h-full overflow-y-auto p-6 space-y-6">
                      <div className="flex items-center justify-between pb-3 border-b border-white/5">
                        <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#f3aa18]" />
                          Interactive Simulator
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                          {editingProfile.configurator_version === 'v2' ? 'V2 Composite' : 'V1 Dual Layer'}
                        </span>
                      </div>

                      {/* Viewing Angle Tabs */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider block">
                          Viewing Angle
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {editingProfile.views.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setActiveSimView(v.id)}
                              className={clsx(
                                'px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5',
                                activeSimView === v.id
                                  ? 'bg-[#f3aa18] text-black font-bold shadow-md shadow-[#f3aa18]/20'
                                  : 'bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white'
                              )}
                            >
                              <span>{v.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Preview Render Canvas */}
                      <div className="rounded-2xl bg-zinc-900/90 border border-white/10 p-4 relative overflow-hidden flex flex-col items-center shadow-inner">
                        <div className="relative w-full aspect-square max-w-[280px] flex items-center justify-center my-2">
                          {/* Layer 1: Base Device Hardware Render */}
                          {currentView?.background_url ? (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-0">
                              <img
                                src={currentView.background_url}
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
                            <div className="absolute inset-0 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-xs font-mono text-zinc-500 text-center p-4">
                              <Smartphone className="w-8 h-8 text-zinc-600 mb-2" />
                              <span>No Hardware Body URL set for {currentView?.name || 'view'}</span>
                            </div>
                          )}

                          {/* Layer 2: Composable Skin Textures */}
                          {skinLayers.map((l) => {
                            const isChecked = selectedSimLayers[l.id] ?? (l.default_selected || l.is_required);
                            if (!isChecked) return null;

                            const assets =
                              l.assets_by_view?.[currentView?.id || 'main_view'] ||
                              l.assets_by_view?.['main_view'] ||
                              Object.values(l.assets_by_view || {})[0] ||
                              {};

                            const simNorm = selectedSimFinish.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const matchedKey = Object.keys(assets.render_texture_map || {}).find(
                              (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === simNorm
                            );
                            const texUrl = matchedKey ? (assets.render_texture_map?.[matchedKey] || '') : '';

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

                          {/* Layer 3: Realistic Shadow Overlay (v2 only) */}
                          {editingProfile.configurator_version === 'v2' &&
                            skinLayers.map((l) => {
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

                        <div className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-2 border-t border-white/5">
                          <span>Composite View: {currentView?.name}</span>
                          <span className="text-[#f3aa18] font-semibold truncate max-w-[140px]">
                            {finishes.find((f) => (f.slug || f.id) === selectedSimFinish)?.name || selectedSimFinish}
                          </span>
                        </div>
                      </div>

                      {/* Active Layer Toggles */}
                      <div className="space-y-2">
                        <label className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider block">
                          Active Skin Layers in Simulator
                        </label>
                        <div className="space-y-1.5">
                          {skinLayers.map((l) => {
                            const isChecked = selectedSimLayers[l.id] ?? (l.default_selected || l.is_required);
                            return (
                              <label
                                key={l.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/70 border border-white/5 hover:border-white/10 text-xs font-mono cursor-pointer transition-colors"
                              >
                                <span className="text-zinc-200 font-medium">{l.name}</span>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) =>
                                    setSelectedSimLayers((prev) => ({ ...prev, [l.id]: e.target.checked }))
                                  }
                                  className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 focus:outline-none accent-[#f3aa18] cursor-pointer"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Test Finish Swatches */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-mono text-zinc-400 font-semibold uppercase tracking-wider">
                            Test Finish Swatch
                          </label>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {displayedSimulatorFinishes.length} available
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                          {displayedSimulatorFinishes.map((f) => {
                            const fSlug = f.slug || f.id;
                            const isSelected = selectedSimFinish === fSlug;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setSelectedSimFinish(fSlug)}
                                className={clsx(
                                  'p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all text-[10px] font-mono cursor-pointer',
                                  isSelected
                                    ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-white font-bold'
                                    : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:border-white/20'
                                )}
                                title={f.name}
                              >
                                <div className="w-7 h-7 rounded-lg overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                                  {f.thumbnail ? (
                                    <img src={f.thumbnail} alt={f.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Sparkles className="w-3.5 h-3.5 m-auto text-zinc-600" />
                                  )}
                                </div>
                                <span className="truncate w-full text-center">{f.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Live Price Calculator Receipt */}
                      <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Base Price:</span>
                          <span>IDR {(editingProfile.base_price || 0).toLocaleString('id-ID')}</span>
                        </div>

                        {skinLayers.map((l) => {
                          const isChecked = selectedSimLayers[l.id] ?? (l.default_selected || l.is_required);
                          if (!isChecked || (l.extra_price || 0) === 0) return null;
                          return (
                            <div key={l.id} className="flex items-center justify-between text-zinc-300">
                              <span>+ {l.name}:</span>
                              <span>+IDR {(l.extra_price || 0).toLocaleString('id-ID')}</span>
                            </div>
                          );
                        })}

                        {(() => {
                          const activeFinish = finishes.find(
                            (f) => f.slug === selectedSimFinish || f.id === selectedSimFinish
                          );
                          const surcharge =
                            (activeFinish?.extra_price || 0) * (editingProfile.size_multiplier || 1.0);
                          if (surcharge === 0) return null;
                          return (
                            <div className="flex items-center justify-between text-amber-400">
                              <span>+ Finish ({activeFinish?.name}):</span>
                              <span>+IDR {surcharge.toLocaleString('id-ID')}</span>
                            </div>
                          );
                        })()}

                        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-zinc-500 uppercase">Calculated Total</p>
                            <p className="text-lg font-bold text-emerald-400">
                              IDR {simulatedTotalPrice.toLocaleString('id-ID')}
                            </p>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Live Storefront Sync
                          </span>
                        </div>
                      </div>
                    </aside>

                    {/* RIGHT PANEL: Spacious Layers, Angles & Finishes Configuration */}
                    <main className="flex-1 h-full overflow-y-auto p-6 lg:p-10 space-y-8 bg-zinc-950">
                      {/* Architecture Mode Banner */}
                      {(editingProfile.configurator_version || 'v1') === 'v1' ? (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-amber-200 font-mono">
                          <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-300 text-sm">V1 Legacy Production Configurator</p>
                            <p className="mt-1 text-zinc-300 leading-relaxed">
                              Two-layer rendering engine. Layer 1 is the Base Device Hardware body image; Layer 2 is the transparent PNG texture overlay crafted for each finish in Photoshop. Fully backwards-compatible with existing WooCommerce cart items.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-3 text-xs text-sky-200 font-mono">
                          <Sparkles className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-sky-300 text-sm">V2 Modern Dynamic Configurator (Preview)</p>
                            <p className="mt-1 text-zinc-300 leading-relaxed">
                              Dynamic canvas compositing engine. Supports hardware chassis color tints, reusable vector cutout masks (SVG), and Photoshop realistic multiply shadow overlays.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 1. Global Settings */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-zinc-900/60 border border-white/5">
                        <div>
                          <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-semibold">Base Price (IDR)</label>
                          <input
                            type="number"
                            value={editingProfile.base_price}
                            onChange={(e) =>
                              setEditingProfile({ ...editingProfile, base_price: Number(e.target.value) || 0 })
                            }
                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-semibold">Device Family</label>
                          <select
                            value={editingProfile.family}
                            onChange={(e) =>
                              setEditingProfile({ ...editingProfile, family: e.target.value as DeviceFamily })
                            }
                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
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
                          <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-semibold">Size Scale Multiplier</label>
                          <input
                            type="number"
                            step="0.1"
                            value={editingProfile.size_multiplier}
                            onChange={(e) =>
                              setEditingProfile({ ...editingProfile, size_multiplier: Number(e.target.value) || 1.0 })
                            }
                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono text-zinc-400 mb-1.5 font-semibold">Quick Add Preset Layer</label>
                          <select
                            onChange={(e) => {
                              const preset = COMMON_PRESET_LAYERS.find((p) => p.name === e.target.value);
                              if (preset) handleAddPresetLayer(preset);
                              e.target.value = '';
                            }}
                            className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-[#f3aa18]/40 text-[#f3aa18] font-mono focus:outline-none cursor-pointer"
                            defaultValue=""
                          >
                            <option value="" disabled>+ Choose Preset Layer...</option>
                            {COMMON_PRESET_LAYERS.map((preset) => (
                              <option key={preset.name} value={preset.name}>
                                {preset.name} (+IDR {preset.extra_price.toLocaleString('id-ID')})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 2. Viewing Angles Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                              <Eye className="w-4 h-4 text-sky-400" />
                              Viewing Angles ({editingProfile.views.length})
                            </h4>
                            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                              Device camera angles or positions (e.g. Outer View, Inner View, Palm Rest).
                            </p>
                          </div>
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
                              {editingProfile.views.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveView(v.id)}
                                  className="text-zinc-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                                  title="Remove view"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Layer 1: Base Device Hardware Render Card */}
                        {currentView && (
                          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-sky-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
                            <div className="flex items-center gap-4 min-w-0">
                              {currentView.background_url ? (
                                <div className="w-14 h-14 rounded-xl bg-zinc-950 border border-sky-500/30 overflow-hidden shrink-0 flex items-center justify-center p-1">
                                  <img
                                    src={currentView.background_url}
                                    alt="Hardware body"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-zinc-950 border border-dashed border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center text-zinc-600">
                                  <Layers className="w-6 h-6" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                                    Layer 1: Base Device Hardware Render
                                  </label>
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                    Angle: {currentView.name}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                  The transparent neutral render of the device hardware body (ports, camera lenses, chassis). All customizable skin layers overlay on top of this.
                                </p>
                              </div>
                            </div>
                            <div className="w-full md:w-96 shrink-0">
                              <input
                                type="url"
                                placeholder="https://exacoat.com/wp-content/uploads/renders/device-body.png"
                                value={currentView.background_url || ''}
                                onChange={(e) => handleSetViewBackground(currentView.id, e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-sky-400 placeholder:text-zinc-600"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. Composable Skin Layers */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                              <Layers className="w-4 h-4 text-[#f3aa18]" />
                              Composable Skin Layers ({skinLayers.length})
                            </h4>
                            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                              Customizable skin parts for this device (Back, Accents, Palm Rest, etc.).
                            </p>
                          </div>
                        </div>

                        {skinLayers.length === 0 ? (
                          <div className="p-10 rounded-2xl bg-zinc-900/40 border border-dashed border-white/10 text-center">
                            <p className="text-sm text-zinc-400 font-mono">No skin layers registered for this device yet.</p>
                            <p className="text-xs text-zinc-500 font-mono mt-1">
                              Use the "Quick Add Preset Layer" dropdown above to add standard Back, Frame, or Accent layers.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {skinLayers.map((layer, idx) => {
                              const isExpanded = expandedLayerId === layer.id;
                              const viewAssets = layer.assets_by_view?.[currentView?.id || 'main_view'] || {};
                              const textureMap = viewAssets.render_texture_map || {};

                              // Finish restrictions
                              const layerAllowedSlugs = layer.allowed_finish_slugs || [];
                              const hasFinishRestrictions = layerAllowedSlugs.length > 0;

                              const isFinishAllowed = (fSlug: string) => {
                                if (!hasFinishRestrictions) return true;
                                const norm = fSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                                return layerAllowedSlugs.some(
                                  (as) => as.toLowerCase().replace(/[^a-z0-9]/g, '') === norm
                                );
                              };

                              const allowedFinishesForLayer = finishes.filter((f) =>
                                isFinishAllowed(f.slug || f.id)
                              );

                              const assignedTextureCount = Object.keys(textureMap).filter(
                                (k) => Boolean(textureMap[k]) && isFinishAllowed(k)
                              ).length;

                              return (
                                <div
                                  key={layer.id}
                                  className="rounded-2xl bg-zinc-900/80 border border-white/10 overflow-hidden text-xs"
                                >
                                  {/* Layer Header Row */}
                                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/95 border-b border-white/5">
                                    {/* Left: Reorder + Name */}
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex flex-col gap-0.5 shrink-0 text-zinc-500">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveLayer(idx, 'up')}
                                          disabled={idx === 0}
                                          className="hover:text-white disabled:opacity-20 cursor-pointer"
                                        >
                                          <ChevronUp className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveLayer(idx, 'down')}
                                          disabled={idx === skinLayers.length - 1}
                                          className="hover:text-white disabled:opacity-20 cursor-pointer"
                                        >
                                          <ChevronDown className="w-4 h-4" />
                                        </button>
                                      </div>

                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-zinc-500 text-xs">#{idx + 1}</span>
                                          <input
                                            type="text"
                                            value={layer.name}
                                            onChange={(e) => handleUpdateLayer(layer.id, { name: e.target.value })}
                                            className="font-bold text-white bg-transparent border-b border-white/10 focus:border-[#f3aa18] focus:outline-none text-sm"
                                          />
                                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                                            {layer.id}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Middle: Pricing & Toggles */}
                                    <div className="flex flex-wrap items-center gap-5">
                                      <label className="flex items-center gap-2 cursor-pointer font-mono text-xs">
                                        <input
                                          type="checkbox"
                                          checked={layer.is_required}
                                          onChange={(e) =>
                                            handleUpdateLayer(layer.id, {
                                              is_required: e.target.checked,
                                              is_optional: !e.target.checked,
                                            })
                                          }
                                          className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 focus:outline-none accent-[#f3aa18]"
                                        />
                                        <span className="text-zinc-300">Required Part</span>
                                      </label>

                                      <div className="flex items-center gap-1.5 font-mono text-xs">
                                        <span className="text-zinc-400">+IDR</span>
                                        <input
                                          type="number"
                                          step="5000"
                                          value={layer.extra_price}
                                          onChange={(e) =>
                                            handleUpdateLayer(layer.id, { extra_price: Number(e.target.value) || 0 })
                                          }
                                          className="w-24 px-2 py-1 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                                        />
                                      </div>

                                      {/* Assigned textures pill */}
                                      <span
                                        className={clsx(
                                          'px-2.5 py-1 rounded-full text-[11px] font-mono font-medium',
                                          assignedTextureCount > 0
                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        )}
                                      >
                                        Textures ({assignedTextureCount} / {allowedFinishesForLayer.length})
                                      </span>

                                      {hasFinishRestrictions && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#f3aa18]/15 text-[#f3aa18] border border-[#f3aa18]/30">
                                          Restricted
                                        </span>
                                      )}
                                    </div>

                                    {/* Right: Expand & Remove */}
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedLayerId(isExpanded ? null : layer.id)}
                                        className={clsx(
                                          'px-3.5 py-1.5 rounded-xl font-mono text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer',
                                          isExpanded
                                            ? 'bg-[#f3aa18] text-black font-bold'
                                            : 'bg-white/10 hover:bg-white/20 text-white'
                                        )}
                                      >
                                        <span>{isExpanded ? 'Collapse' : 'Manage Finishes'}</span>
                                        <ChevronDown
                                          className={clsx(
                                            'w-3.5 h-3.5 transition-transform duration-200',
                                            isExpanded && 'rotate-180'
                                          )}
                                        />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLayer(layer.id)}
                                        className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                        title="Delete Layer"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expanded Layer Drawer */}
                                  {isExpanded && (
                                    <div className="p-6 space-y-6 bg-zinc-950/70 border-t border-white/5">
                                      {/* Finish Availability Settings */}
                                      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                          <div>
                                            <label className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                                              <Filter className="w-3.5 h-3.5 text-[#f3aa18]" />
                                              Finish Availability for {layer.name}
                                            </label>
                                            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                                              Set whether this layer allows all catalog finishes or is restricted to specific materials (e.g. Magic Keyboard).
                                            </p>
                                          </div>

                                          <div className="flex flex-wrap items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handleSetLayerAllFinishes(layer.id, true)}
                                              className={clsx(
                                                'px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer',
                                                !hasFinishRestrictions
                                                  ? 'bg-white/15 text-white font-bold border border-white/20'
                                                  : 'text-zinc-400 hover:text-white bg-zinc-950 border border-white/5'
                                              )}
                                            >
                                              All Finishes ({finishes.length})
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleSetLayerAllFinishes(layer.id, false)}
                                              className={clsx(
                                                'px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer',
                                                hasFinishRestrictions
                                                  ? 'bg-[#f3aa18]/20 text-[#f3aa18] font-bold border border-[#f3aa18]/40'
                                                  : 'text-zinc-400 hover:text-white bg-zinc-950 border border-white/5'
                                              )}
                                            >
                                              Restricted Only ({allowedFinishesForLayer.length})
                                            </button>

                                            {hasFinishRestrictions && (
                                              <button
                                                type="button"
                                                onClick={() => handleAutoDetectLayerFinishes(layer.id)}
                                                className="px-2.5 py-1.5 text-[11px] font-mono text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer"
                                                title="Detect active finishes from already mapped texture URLs"
                                              >
                                                Auto-Detect Mapped
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {hasFinishRestrictions && (
                                          <div className="pt-3 border-t border-white/5 space-y-2.5">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[11px] font-mono text-zinc-400">
                                                Click chips to toggle available materials:
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingProfile({
                                                    ...editingProfile,
                                                    layers: editingProfile.layers.map((l) =>
                                                      l.id === layer.id
                                                        ? { ...l, allowed_finish_slugs: ['swarm', 'black-camo'] }
                                                        : l
                                                    ),
                                                  });
                                                  showToast('info', 'Preset Applied', 'Set to Swarm & Black Camo only.');
                                                }}
                                                className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer transition-colors"
                                              >
                                                Set: Swarm & Black Camo only
                                              </button>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                              {finishes.map((f) => {
                                                const fSlug = f.slug || f.id;
                                                const isAllowed = isFinishAllowed(fSlug);
                                                return (
                                                  <button
                                                    key={f.id}
                                                    type="button"
                                                    onClick={() => handleToggleLayerAllowedFinish(layer.id, fSlug)}
                                                    className={clsx(
                                                      'px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer',
                                                      isAllowed
                                                        ? 'bg-[#f3aa18]/20 border border-[#f3aa18]/50 text-white font-bold'
                                                        : 'bg-zinc-950 border border-white/5 text-zinc-500 hover:text-zinc-300'
                                                    )}
                                                  >
                                                    <span
                                                      className={clsx(
                                                        'w-2 h-2 rounded-full',
                                                        isAllowed ? 'bg-[#f3aa18]' : 'bg-zinc-700'
                                                      )}
                                                    />
                                                    <span>{f.name}</span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* V2 Composite Asset Inputs (Mask + Shadow Overlay) - Only for V2 */}
                                      {editingProfile.configurator_version === 'v2' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <label className="text-xs font-mono font-bold text-zinc-300">
                                                Vector Cutout Mask (SVG or Alpha PNG)
                                              </label>
                                              <span className="text-[10px] font-mono text-zinc-500">Layer 2: Mask</span>
                                            </div>
                                            <input
                                              type="url"
                                              placeholder="https://exacoat.com/wp-content/uploads/masks/iphone-16-back.svg"
                                              value={viewAssets.mask_svg_url || ''}
                                              onChange={(e) => handleSetMaskSvg(layer.id, e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                                            />
                                            <p className="text-[10px] text-zinc-500">
                                              Used for dynamic canvas clipping or SVG shape clipping.
                                            </p>
                                          </div>

                                          <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <label className="text-xs font-mono font-bold text-amber-300">
                                                Realistic Shadow & AO Overlay (PNG)
                                              </label>
                                              <span className="text-[10px] font-mono text-amber-400">Layer 3: Top Shadow</span>
                                            </div>
                                            <input
                                              type="url"
                                              placeholder="https://exacoat.com/wp-content/uploads/shadows/iphone-16-shadow.png"
                                              value={viewAssets.shadow_png_url || ''}
                                              onChange={(e) => handleSetShadowPng(layer.id, e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                                            />
                                            <p className="text-[10px] text-zinc-500">
                                              Photoshop shadow overlay with multiply blend.
                                            </p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Texture Swatches Grid Header & Autofill Helper */}
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                                        <div>
                                          <h5 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                                            Finish Textures ({allowedFinishesForLayer.length} Materials)
                                          </h5>
                                          <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                                            Angle: {currentView?.name}. Click a swatch to test on the simulator, or click Set URL to map its image.
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            placeholder="https://exacoat.com/uploads/iPhone-Back-{finish}.png"
                                            value={autofillPrefix}
                                            onChange={(e) => setAutofillPrefix(e.target.value)}
                                            className="px-3 py-1 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white font-mono w-60 placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleAutofillLayerTextures(layer.id)}
                                            className="px-3 py-1 text-xs font-mono rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer transition-colors"
                                          >
                                            Autofill All
                                          </button>
                                        </div>
                                      </div>

                                      {/* Clean Texture Swatches Grid */}
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-96 overflow-y-auto pr-1">
                                        {allowedFinishesForLayer.map((f) => {
                                          const finishSlug = f.slug || f.id;
                                          const normSlug = finishSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                                          const matchedKey = Object.keys(textureMap).find(
                                            (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normSlug
                                          );
                                          const currentUrl = matchedKey ? textureMap[matchedKey] : '';
                                          const isAssigned = Boolean(currentUrl);

                                          return (
                                            <div
                                              key={f.id}
                                              onClick={() => setSelectedSimFinish(finishSlug)}
                                              className={clsx(
                                                'p-3 rounded-2xl border transition-all flex flex-col justify-between gap-3 text-xs font-mono cursor-pointer relative group',
                                                selectedSimFinish === finishSlug
                                                  ? 'bg-white/10 border-[#f3aa18]/80 shadow-lg shadow-[#f3aa18]/10'
                                                  : isAssigned
                                                  ? 'bg-zinc-900/90 border-white/10 hover:border-white/30'
                                                  : 'bg-zinc-900/40 border-white/5 hover:border-white/20'
                                              )}
                                            >
                                              {/* Top: Thumbnail & Name */}
                                              <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
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
                                                    <Sparkles className="w-4 h-4 text-zinc-600" />
                                                  )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                  <p className="font-bold text-white truncate text-xs">{f.name}</p>
                                                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider truncate block">
                                                    {f.group}
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Bottom: Status & URL Link Button */}
                                              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                                {isAssigned ? (
                                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    Mapped
                                                  </span>
                                                ) : (
                                                  <span className="text-[10px] font-mono text-zinc-500">
                                                    Not assigned
                                                  </span>
                                                )}

                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenTextureModal(
                                                      layer.id,
                                                      layer.name,
                                                      finishSlug,
                                                      f.name,
                                                      currentUrl,
                                                      f.thumbnail
                                                    );
                                                  }}
                                                  className={clsx(
                                                    'px-2 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer',
                                                    isAssigned
                                                      ? 'text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10'
                                                      : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                                                  )}
                                                  title="Edit texture PNG URL"
                                                >
                                                  <LinkIcon className="w-3 h-3" />
                                                  <span>{isAssigned ? 'Edit' : 'Set URL'}</span>
                                                </button>
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
                    </main>
                  </div>
                );
              })()
            )}

            {/* 3. Focused Texture URL Edit Modal */}
            {editingTextureModal &&
              createPortal(
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/15 p-6 shadow-2xl space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                          {tempTextureUrl ? (
                            <img
                              src={tempTextureUrl}
                              alt={editingTextureModal.finishName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : editingTextureModal.thumbnail ? (
                            <img
                              src={editingTextureModal.thumbnail}
                              alt={editingTextureModal.finishName}
                              className="w-full h-full object-cover opacity-60"
                            />
                          ) : (
                            <Sparkles className="w-5 h-5 text-[#f3aa18]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate">
                            Texture URL: {editingTextureModal.finishName}
                          </h3>
                          <p className="text-xs font-mono text-zinc-400 mt-0.5 truncate">
                            Layer: {editingTextureModal.layerName} • Angle: {activeSimView}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingTextureModal(null)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-mono font-bold text-zinc-300">
                        Photoshop Finish PNG URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://exacoat.com/wp-content/uploads/renders/finish.png"
                        value={tempTextureUrl}
                        onChange={(e) => setTempTextureUrl(e.target.value)}
                        autoFocus
                        className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                      />
                      <p className="text-[11px] font-mono text-zinc-500 leading-relaxed">
                        Transparent PNG overlay of this specific finish texture created in Photoshop for this device angle.
                      </p>
                    </div>

                    {tempTextureUrl && (
                      <div className="flex items-center justify-between text-xs font-mono pt-1">
                        <a
                          href={tempTextureUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:text-sky-300 flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open image in new tab</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setTempTextureUrl('')}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Clear URL
                        </button>
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingTextureModal(null)}
                        className="px-4 py-2 text-xs font-mono rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTextureModal}
                        className="px-5 py-2 text-xs font-mono font-bold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors cursor-pointer"
                      >
                        Save Texture URL
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}
          </div>,
          document.body
        )}
    </div>
  );
};
