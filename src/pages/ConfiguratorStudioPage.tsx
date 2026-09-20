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
  setProductPriceDirect,
  duplicateProductDirect,
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
  Monitor,
  Settings,
  ShieldCheck,
  Wand2,
  GripVertical,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface AssetAuditItem {
  id: string;
  type: 'chassis' | 'texture' | 'overlay';
  viewId: string;
  viewName: string;
  layerId?: string;
  layerName?: string;
  finishSlug?: string;
  finishName?: string;
  url: string;
  status: 'healthy' | 'broken' | 'empty';
  error?: string;
}

export interface GhostAngleReport {
  viewId: string;
  viewName: string;
  chassisStatus: 'healthy' | 'broken' | 'missing';
  chassisUrl: string;
  mappedTexturesCount: number;
}

export interface AssetAuditReport {
  timestamp: string;
  totalProbed: number;
  healthyCount: number;
  brokenCount: number;
  emptyCount: number;
  ghostAngles: GhostAngleReport[];
  items: AssetAuditItem[];
}

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

  // Quick Price Edit Dialog state (Catalog)
  const [priceEditModal, setPriceEditModal] = useState<{
    productId: number;
    name: string;
    currentPrice: number;
  } | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Duplicate Product Dialog state (Catalog)
  const [duplicateModal, setDuplicateModal] = useState<{
    productId: number;
    name: string;
    slug: string;
    price: number;
    family: string;
  } | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateSlug, setDuplicateSlug] = useState('');
  const [duplicatePrice, setDuplicatePrice] = useState(0);
  const [duplicateCopyConfig, setDuplicateCopyConfig] = useState(true);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Editor Modal / Fullscreen Workspace state
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [editingProfile, setEditingProfile] = useState<DeviceConfiguratorProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [autofillPrefix, setAutofillPrefix] = useState<string>('');

  // Draggable inspector panel width (pixels)
  const [inspectorWidth, setInspectorWidth] = useState<number>(480);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Inspector layout tab state: 'layers' | 'hardware' | 'settings'
  const [inspectorTab, setInspectorTab] = useState<'layers' | 'hardware' | 'settings'>('layers');
  const [selectedLayerId, setSelectedLayerId] = useState<string>('');
  const [finishCategoryFilter, setFinishCategoryFilter] = useState<string>('all');

  // Find & Replace in URLs Modal state
  const [showFindReplaceModal, setShowFindReplaceModal] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replaceScope, setReplaceScope] = useState<'all' | 'textures' | 'chassis'>('all');

  // Asset Integrity Audit Modal state
  const [showAssetAuditModal, setShowAssetAuditModal] = useState(false);
  const [isAuditingAssets, setIsAuditingAssets] = useState(false);
  const [auditProgress, setAuditProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });
  const [auditReport, setAuditReport] = useState<AssetAuditReport | null>(null);
  const [auditFilter, setAuditFilter] = useState<'all' | 'broken' | 'ghost' | 'empty' | 'healthy'>('all');

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

  // Lock body scroll and handle keyboard shortcuts (ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAssetAuditModal) {
          setShowAssetAuditModal(false);
        } else if (showFindReplaceModal) {
          setShowFindReplaceModal(false);
        } else if (editingTextureModal) {
          setEditingTextureModal(null);
        } else if (duplicateModal) {
          setDuplicateModal(null);
        } else if (priceEditModal) {
          setPriceEditModal(null);
        } else if (selectedProductId !== null) {
          handleCloseEditor();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAssetAuditModal, showFindReplaceModal, editingTextureModal, duplicateModal, priceEditModal, selectedProductId]);

  useEffect(() => {
    if (selectedProductId !== null) {
      const unlock = lockBodyScroll();
      return () => {
        unlock();
      };
    }
  }, [selectedProductId]);

  // Draggable Splitter mousemove/mouseup listener
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 340 && newWidth <= 850) {
        setInspectorWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleOpenEditor = async (productId: number) => {
    setSelectedProductId(productId);
    setIsLoadingProfile(true);
    setInspectorTab('layers');
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

        // Select first layer by default
        if (cleanedLayers.length > 0) {
          setSelectedLayerId(cleanedLayers[0].id);
        } else {
          setSelectedLayerId('');
        }

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
        // Fallback profile from catalog item
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
          setSelectedLayerId(defaultLayerId);
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
    setSelectedLayerId('');
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

  // Quick Price Edit in Catalog
  const handleOpenPriceModal = (product: ConfiguratorProfileSummary) => {
    setPriceEditModal({
      productId: product.product_id,
      name: product.name,
      currentPrice: product.price,
    });
    setTempPrice(product.price);
  };

  const handleSaveQuickPrice = async () => {
    if (!priceEditModal) return;
    setIsSavingPrice(true);
    try {
      const res = await setProductPriceDirect(priceEditModal.productId, tempPrice);
      if (res.success) {
        showToast('success', 'Price Updated', `${priceEditModal.name} price set to IDR ${tempPrice.toLocaleString('id-ID')}.`);
        setProfiles((prev) =>
          prev.map((p) => (p.product_id === priceEditModal.productId ? { ...p, price: tempPrice } : p))
        );
        setPriceEditModal(null);
      } else {
        showToast('error', 'Update Failed', res.error || 'Failed setting product price');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message);
    } finally {
      setIsSavingPrice(false);
    }
  };

  // Duplicate Product in Catalog
  const handleOpenDuplicateModal = (product: ConfiguratorProfileSummary) => {
    setDuplicateModal({
      productId: product.product_id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      family: product.family,
    });
    setDuplicateName(`${product.name} (Copy)`);
    setDuplicateSlug(`${product.slug}-copy`);
    setDuplicatePrice(product.price);
    setDuplicateCopyConfig(true);
  };

  const handleExecuteDuplicate = async () => {
    if (!duplicateModal || !duplicateName.trim()) return;
    setIsDuplicating(true);
    try {
      const res = await duplicateProductDirect({
        source_product_id: duplicateModal.productId,
        new_name: duplicateName.trim(),
        new_slug: duplicateSlug.trim(),
        new_price: duplicatePrice,
        copy_configurator: duplicateCopyConfig,
      });

      if (res.success && res.productId) {
        showToast(
          'success',
          'Product Duplicated',
          `Created "${res.name}" with ID #${res.productId}. Opening in Studio...`
        );
        const newPid = res.productId;
        setDuplicateModal(null);
        await loadData(true);
        // Automatically open the duplicated product in the studio for immediate editing!
        handleOpenEditor(newPid);
      } else {
        showToast('error', 'Duplication Failed', res.error || 'Failed duplicating product');
      }
    } catch (err: any) {
      showToast('error', 'Duplication Error', err.message);
    } finally {
      setIsDuplicating(false);
    }
  };

  // Find & Replace in URLs calculation and execution
  const findMatches = useMemo(() => {
    if (!editingProfile || !findText.trim()) return { count: 0, sampleBefore: '', sampleAfter: '' };
    const query = findText.trim();
    let count = 0;
    let sampleBefore = '';
    let sampleAfter = '';

    // Check layer textures
    (editingProfile.layers || []).forEach((layer) => {
      Object.values(layer.assets_by_view || {}).forEach((viewAsset: any) => {
        if (replaceScope === 'all' || replaceScope === 'textures') {
          Object.values(viewAsset.render_texture_map || {}).forEach((url: any) => {
            if (typeof url === 'string' && url.includes(query)) {
              count++;
              if (!sampleBefore) {
                sampleBefore = url;
                sampleAfter = url.split(query).join(replaceText);
              }
            }
          });
        }
        if (replaceScope === 'all') {
          ['mask_svg_url', 'shadow_png_url', 'highlight_png_url'].forEach((key) => {
            const u = viewAsset[key];
            if (typeof u === 'string' && u.includes(query)) {
              count++;
              if (!sampleBefore) {
                sampleBefore = u;
                sampleAfter = u.split(query).join(replaceText);
              }
            }
          });
        }
      });
    });

    // Check views background_url (chassis)
    if (replaceScope === 'all' || replaceScope === 'chassis') {
      (editingProfile.views || []).forEach((view) => {
        if (view.background_url && view.background_url.includes(query)) {
          count++;
          if (!sampleBefore) {
            sampleBefore = view.background_url;
            sampleAfter = view.background_url.split(query).join(replaceText);
          }
        }
      });
    }

    return { count, sampleBefore, sampleAfter };
  }, [editingProfile, findText, replaceText, replaceScope]);

  const handleExecuteFindReplace = () => {
    if (!editingProfile || !findText.trim()) return;
    const query = findText.trim();
    const replacement = replaceText;

    let replacedCount = 0;

    const newViews = (editingProfile.views || []).map((v) => {
      if ((replaceScope === 'all' || replaceScope === 'chassis') && v.background_url && v.background_url.includes(query)) {
        replacedCount++;
        return { ...v, background_url: v.background_url.split(query).join(replacement) };
      }
      return v;
    });

    const newLayers = (editingProfile.layers || []).map((layer) => {
      const newAssetsByView: Record<string, any> = {};
      Object.entries(layer.assets_by_view || {}).forEach(([viewId, viewAsset]: [string, any]) => {
        const newTextureMap: Record<string, string> = {};
        if (replaceScope === 'all' || replaceScope === 'textures') {
          Object.entries(viewAsset.render_texture_map || {}).forEach(([slug, url]: [string, any]) => {
            if (typeof url === 'string' && url.includes(query)) {
              replacedCount++;
              newTextureMap[slug] = url.split(query).join(replacement);
            } else {
              newTextureMap[slug] = url;
            }
          });
        } else {
          Object.assign(newTextureMap, viewAsset.render_texture_map || {});
        }

        const patchedAsset = { ...viewAsset, render_texture_map: newTextureMap };
        if (replaceScope === 'all') {
          if (viewAsset.mask_svg_url && viewAsset.mask_svg_url.includes(query)) {
            replacedCount++;
            patchedAsset.mask_svg_url = viewAsset.mask_svg_url.split(query).join(replacement);
          }
          if (viewAsset.shadow_png_url && viewAsset.shadow_png_url.includes(query)) {
            replacedCount++;
            patchedAsset.shadow_png_url = viewAsset.shadow_png_url.split(query).join(replacement);
          }
        }

        newAssetsByView[viewId] = patchedAsset;
      });

      return {
        ...layer,
        assets_by_view: newAssetsByView,
      };
    });

    setEditingProfile({
      ...editingProfile,
      views: newViews,
      layers: newLayers,
    });

    showToast(
      'success',
      'URLs Replaced',
      `Updated ${replacedCount} image URLs replacing "${query}" with "${replacement}". Click Save Configurator to commit.`
    );
    setShowFindReplaceModal(false);
  };

  // Asset Integrity Audit Helpers & Handlers
  const normalizeAssetUrl = (url: string): string => {
    let clean = url.trim();
    if (clean.startsWith('//')) {
      clean = 'https:' + clean;
    } else if (clean.startsWith('/')) {
      clean = 'https://exacoat.com' + clean;
    }
    return clean;
  };

  const probeImageUrl = (rawUrl: string, timeoutMs = 7000): Promise<{ ok: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
        resolve({ ok: false, error: 'Empty URL' });
        return;
      }
      const cleanUrl = normalizeAssetUrl(rawUrl);
      const img = new Image();
      let timer: any = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
      };

      timer = setTimeout(() => {
        cleanup();
        resolve({ ok: false, error: 'Request timed out (server unreachable)' });
      }, timeoutMs);

      img.onload = () => {
        cleanup();
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: 'Zero dimensions (corrupted or empty image)' });
        }
      };

      img.onerror = () => {
        cleanup();
        resolve({ ok: false, error: 'Image failed to load (HTTP 404, redirect, or CORS error)' });
      };

      img.src = cleanUrl;
    });
  };

  const handleStartAssetAudit = async () => {
    if (!editingProfile) return;
    setIsAuditingAssets(true);
    setShowAssetAuditModal(true);

    const itemsToProbe: Array<{
      id: string;
      type: 'chassis' | 'texture' | 'overlay';
      viewId: string;
      viewName: string;
      layerId?: string;
      layerName?: string;
      finishSlug?: string;
      finishName?: string;
      url: string;
    }> = [];

    // 1. Hardware chassis background URLs
    (editingProfile.views || []).forEach((v) => {
      itemsToProbe.push({
        id: `chassis-${v.id}`,
        type: 'chassis',
        viewId: v.id,
        viewName: v.name,
        url: (v.background_url || '').trim(),
      });
    });

    // 2. Composable Layer textures and overlays
    (editingProfile.layers || []).forEach((layer) => {
      (editingProfile.views || []).forEach((v) => {
        const viewAsset =
          layer.assets_by_view?.[v.id] ||
          layer.assets_by_view?.['main_view'] ||
          Object.values(layer.assets_by_view || {})[0];

        if (viewAsset) {
          // Texture maps
          Object.entries(viewAsset.render_texture_map || {}).forEach(([slug, urlVal]) => {
            const finishObj = finishes.find((f) => (f.slug || f.id) === slug);
            itemsToProbe.push({
              id: `texture-${layer.id}-${v.id}-${slug}`,
              type: 'texture',
              viewId: v.id,
              viewName: v.name,
              layerId: layer.id,
              layerName: layer.name,
              finishSlug: slug,
              finishName: finishObj?.name || slug,
              url: typeof urlVal === 'string' ? urlVal.trim() : '',
            });
          });

          // Modern v2 Overlays
          if (viewAsset.mask_svg_url) {
            itemsToProbe.push({
              id: `overlay-mask-${layer.id}-${v.id}`,
              type: 'overlay',
              viewId: v.id,
              viewName: v.name,
              layerId: layer.id,
              layerName: `${layer.name} (Mask SVG)`,
              url: viewAsset.mask_svg_url.trim(),
            });
          }
          if (viewAsset.shadow_png_url) {
            itemsToProbe.push({
              id: `overlay-shadow-${layer.id}-${v.id}`,
              type: 'overlay',
              viewId: v.id,
              viewName: v.name,
              layerId: layer.id,
              layerName: `${layer.name} (Shadow PNG)`,
              url: viewAsset.shadow_png_url.trim(),
            });
          }
          if (viewAsset.highlight_png_url) {
            itemsToProbe.push({
              id: `overlay-highlight-${layer.id}-${v.id}`,
              type: 'overlay',
              viewId: v.id,
              viewName: v.name,
              layerId: layer.id,
              layerName: `${layer.name} (Highlight PNG)`,
              url: viewAsset.highlight_png_url.trim(),
            });
          }
        }
      });
    });

    setAuditProgress({ completed: 0, total: itemsToProbe.length });

    // Concurrent probe worker pool (concurrency: 6)
    const auditedItems: AssetAuditItem[] = [];
    const concurrency = 6;
    let index = 0;
    let completedCount = 0;

    const worker = async () => {
      while (index < itemsToProbe.length) {
        const itemIdx = index++;
        const target = itemsToProbe[itemIdx];

        if (!target.url) {
          auditedItems[itemIdx] = {
            ...target,
            status: 'empty',
            error: 'No image URL assigned',
          };
        } else {
          const probeResult = await probeImageUrl(target.url);
          auditedItems[itemIdx] = {
            ...target,
            status: probeResult.ok ? 'healthy' : 'broken',
            error: probeResult.error,
          };
        }

        completedCount++;
        setAuditProgress({ completed: completedCount, total: itemsToProbe.length });
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, itemsToProbe.length) }, () => worker());
    await Promise.all(workers);

    // Ghost Angle Detection: 0 active mapped finish textures AND broken/missing chassis render
    const ghostAngles: GhostAngleReport[] = [];
    (editingProfile.views || []).forEach((v) => {
      const chassisItem = auditedItems.find((it) => it.type === 'chassis' && it.viewId === v.id);
      const chassisStatus = !v.background_url?.trim()
        ? 'missing'
        : chassisItem?.status === 'broken'
        ? 'broken'
        : 'healthy';

      // Count non-empty mapped textures for this specific angle
      let mappedTexturesCount = 0;
      (editingProfile.layers || []).forEach((layer) => {
        const viewAsset = layer.assets_by_view?.[v.id];
        if (viewAsset && viewAsset.render_texture_map) {
          Object.values(viewAsset.render_texture_map).forEach((u) => {
            if (typeof u === 'string' && u.trim().length > 0) {
              mappedTexturesCount++;
            }
          });
        }
      });

      if (mappedTexturesCount === 0 && chassisStatus !== 'healthy') {
        ghostAngles.push({
          viewId: v.id,
          viewName: v.name,
          chassisStatus,
          chassisUrl: v.background_url || '',
          mappedTexturesCount,
        });
      }
    });

    const healthyCount = auditedItems.filter((i) => i.status === 'healthy').length;
    const brokenCount = auditedItems.filter((i) => i.status === 'broken').length;
    const emptyCount = auditedItems.filter((i) => i.status === 'empty').length;

    const report: AssetAuditReport = {
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      totalProbed: auditedItems.length,
      healthyCount,
      brokenCount,
      emptyCount,
      ghostAngles,
      items: auditedItems,
    };

    setAuditReport(report);
    setIsAuditingAssets(false);

    if (brokenCount > 0 || ghostAngles.length > 0) {
      setAuditFilter('broken');
    } else {
      setAuditFilter('all');
    }
  };

  const handleRemoveGhostAngle = (ghostViewId: string, ghostViewName: string) => {
    if (!editingProfile) return;
    if (editingProfile.views.length <= 1) {
      showToast('error', 'Cannot Remove', 'A device configurator must have at least one viewing angle.');
      return;
    }

    const remainingViews = editingProfile.views.filter((v) => v.id !== ghostViewId);
    const cleanedLayers = (editingProfile.layers || []).map((layer) => {
      const newAssetsByView = { ...(layer.assets_by_view || {}) };
      delete newAssetsByView[ghostViewId];
      return {
        ...layer,
        assets_by_view: newAssetsByView,
      };
    });

    setEditingProfile({
      ...editingProfile,
      views: remainingViews,
      layers: cleanedLayers,
    });

    if (activeSimView === ghostViewId) {
      setActiveSimView(remainingViews[0]?.id || 'main_view');
    }

    if (auditReport) {
      const updatedGhostAngles = auditReport.ghostAngles.filter((g) => g.viewId !== ghostViewId);
      const updatedItems = auditReport.items.filter((it) => it.viewId !== ghostViewId);
      setAuditReport({
        ...auditReport,
        ghostAngles: updatedGhostAngles,
        items: updatedItems,
        totalProbed: updatedItems.length,
        brokenCount: updatedItems.filter((i) => i.status === 'broken').length,
        emptyCount: updatedItems.filter((i) => i.status === 'empty').length,
        healthyCount: updatedItems.filter((i) => i.status === 'healthy').length,
      });
    }

    showToast(
      'success',
      'Ghost Angle Removed',
      `Angle "${ghostViewName}" and its unused mappings have been removed. Click Save Configurator to persist.`
    );
  };

  const handlePruneEmptyMappings = () => {
    if (!editingProfile) return;
    let prunedCount = 0;

    const cleanedLayers = (editingProfile.layers || []).map((layer) => {
      const newAssetsByView: Record<string, any> = {};
      Object.entries(layer.assets_by_view || {}).forEach(([vId, vAsset]: [string, any]) => {
        const cleanTextureMap: Record<string, string> = {};
        Object.entries(vAsset.render_texture_map || {}).forEach(([slug, urlVal]) => {
          if (typeof urlVal === 'string' && urlVal.trim().length > 0) {
            cleanTextureMap[slug] = urlVal;
          } else {
            prunedCount++;
          }
        });
        newAssetsByView[vId] = {
          ...vAsset,
          render_texture_map: cleanTextureMap,
        };
      });

      return {
        ...layer,
        assets_by_view: newAssetsByView,
      };
    });

    setEditingProfile({
      ...editingProfile,
      layers: cleanedLayers,
    });

    if (auditReport) {
      const updatedItems = auditReport.items.filter((it) => !(it.type === 'texture' && it.status === 'empty'));
      setAuditReport({
        ...auditReport,
        items: updatedItems,
        emptyCount: 0,
        totalProbed: updatedItems.length,
      });
    }

    showToast(
      'success',
      'Empty Mappings Pruned',
      `Pruned ${prunedCount} empty texture mappings across all layers. Click Save Configurator to persist.`
    );
  };

  const handleClearBrokenTexture = (item: AssetAuditItem) => {
    if (!editingProfile || !item.layerId || !item.finishSlug) return;

    const targetLayerId = item.layerId;
    const targetFinishSlug = item.finishSlug;
    const targetViewId = item.viewId;

    const updatedLayers = (editingProfile.layers || []).map((layer) => {
      if (layer.id !== targetLayerId) return layer;
      const vAsset = layer.assets_by_view?.[targetViewId] || {};
      const newTextureMap = { ...(vAsset.render_texture_map || {}) };
      delete newTextureMap[targetFinishSlug];

      return {
        ...layer,
        assets_by_view: {
          ...(layer.assets_by_view || {}),
          [targetViewId]: {
            ...vAsset,
            render_texture_map: newTextureMap,
          },
        },
      };
    });

    setEditingProfile({
      ...editingProfile,
      layers: updatedLayers,
    });

    if (auditReport) {
      const updatedItems = auditReport.items.filter((it) => it.id !== item.id);
      setAuditReport({
        ...auditReport,
        items: updatedItems,
        brokenCount: updatedItems.filter((i) => i.status === 'broken').length,
        totalProbed: updatedItems.length,
      });
    }

    showToast(
      'info',
      'Texture Unassigned',
      `Cleared broken URL for ${item.layerName} (${item.finishName}).`
    );
  };

  const filteredAuditItems = useMemo(() => {
    if (!auditReport) return [];
    if (auditFilter === 'broken') return auditReport.items.filter((i) => i.status === 'broken');
    if (auditFilter === 'empty') return auditReport.items.filter((i) => i.status === 'empty');
    if (auditFilter === 'healthy') return auditReport.items.filter((i) => i.status === 'healthy');
    if (auditFilter === 'ghost') {
      const ghostViewIds = new Set(auditReport.ghostAngles.map((g) => g.viewId));
      return auditReport.items.filter((i) => ghostViewIds.has(i.viewId));
    }
    return auditReport.items;
  }, [auditReport, auditFilter]);

  // Layer manipulation helpers
  const handleAddPresetLayer = (preset: (typeof COMMON_PRESET_LAYERS)[0]) => {
    if (!editingProfile) return;
    const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

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
    setSelectedLayerId(slug);
    showToast('info', 'Part Added', `Added "${preset.name}". Select finishes below to map textures.`);
  };

  const handleRemoveLayer = (layerId: string) => {
    if (!editingProfile) return;
    const remaining = editingProfile.layers.filter((l) => l.id !== layerId);
    setEditingProfile({
      ...editingProfile,
      layers: remaining,
    });
    if (selectedLayerId === layerId) {
      setSelectedLayerId(remaining[0]?.id || '');
    }
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

  const handleSetViewBackground = (viewId: string, bgUrl: string) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      views: editingProfile.views.map((v) => (v.id === viewId ? { ...v, background_url: bgUrl.trim() } : v)),
    });
  };

  const handleAutofillLayerTextures = (layerId: string) => {
    if (!editingProfile || !autofillPrefix.trim()) {
      showToast('error', 'Prefix Required', 'Enter a URL prefix pattern like https://exacoat.com/uploads/iPhone-Back-');
      return;
    }
    const viewId = activeSimView || 'main_view';
    const newMap: Record<string, string> = {};
    finishes.forEach((f) => {
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
    setActiveSimView(slug);
    showToast('info', 'Angle Added', `Added viewing angle: ${viewName}`);
  };

  const handleRemoveView = (viewId: string) => {
    if (!editingProfile) return;
    if (editingProfile.views.length <= 1) {
      showToast('error', 'View Required', 'Each product configurator must have at least one active view.');
      return;
    }
    const remaining = editingProfile.views.filter((v) => v.id !== viewId);
    setEditingProfile({
      ...editingProfile,
      views: remaining,
    });
    if (activeSimView === viewId) {
      setActiveSimView(remaining[0]?.id || 'main_view');
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

  // Categories list
  const categories = useMemo(() => {
    const list = new Set<string>();
    profiles.forEach((p) => {
      p.categories.forEach((c) => list.add(c));
    });
    return ['all', ...Array.from(list).sort()];
  }, [profiles]);

  // Finish groups for filter tabs
  const finishGroups = useMemo(() => {
    const groups = new Set<string>();
    finishes.forEach((f) => {
      if (f.group) groups.add(f.group);
    });
    return ['all', ...Array.from(groups).sort()];
  }, [finishes]);

  // Filtered profiles for catalog grid
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
        filterVersion === 'all' ? true : (p.configurator_version || 'v1') === filterVersion;

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
        title="Product Configurator Studio"
        subtitle="Manage device viewing angles, customizable skin parts, and transparent Photoshop texture maps."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="px-4 py-2 text-xs font-sans font-medium rounded-xl border border-white/10 hover:bg-white/[0.06] text-zinc-300 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isRefreshing && 'animate-spin text-[#f3aa18]')} />
              Refresh Catalog
            </button>
            <button
              onClick={handleBatchMigrate}
              disabled={isMigrating}
              className="px-4 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FolderSync className={clsx('w-3.5 h-3.5', isMigrating && 'animate-spin')} />
              {isMigrating ? 'Migrating Catalog...' : 'Auto-Migrate All Products'}
            </button>
          </div>
        }
      />

      {/* Migration Result Banner */}
      {migrationResult && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-sans text-emerald-300">
          <div className="flex items-center gap-2.5">
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
            <p className="text-[11px] font-sans font-medium text-zinc-400 uppercase tracking-wider">Catalog Devices</p>
            <p className="text-2xl font-mono font-bold text-white mt-0.5">{stats.total}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-sans font-medium text-zinc-400 uppercase tracking-wider">Composable Ready</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">{stats.configured}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-sans font-medium text-zinc-400 uppercase tracking-wider">Multi-Angle Setups</p>
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
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-zinc-900/60 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/50 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setFilterConfigured('all')}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer',
                filterConfigured === 'all' ? 'bg-white/15 text-white font-bold' : 'text-zinc-400 hover:text-white'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterConfigured('configured')}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer',
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
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer',
                filterVersion === 'all' ? 'bg-white/15 text-white font-bold' : 'text-zinc-400 hover:text-white'
              )}
            >
              All Engines
            </button>
            <button
              onClick={() => setFilterVersion('v1')}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer',
                filterVersion === 'v1'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              v1 Legacy
            </button>
            <button
              onClick={() => setFilterVersion('v2')}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer',
                filterVersion === 'v2'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                  : 'text-zinc-400 hover:text-white'
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
                  'px-3 py-1.5 text-xs font-sans rounded-lg transition-colors capitalize whitespace-nowrap cursor-pointer',
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
          <p className="text-xs font-sans text-zinc-500">Scanning catalog configurators...</p>
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
              className="p-5 flex flex-col justify-between hover:border-white/20 transition-all group"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                      {getFamilyIcon(p.family)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{p.name}</h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {p.categories.join(', ') || 'Uncategorized'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={clsx(
                        'text-[10px] font-sans px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold',
                        (p.configurator_version || 'v1') === 'v2'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      )}
                    >
                      {(p.configurator_version || 'v1') === 'v2' ? 'v2 Modern' : 'v1 Legacy'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2 text-center">
                  <div
                    onClick={() => handleOpenPriceModal(p)}
                    className="p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#f3aa18]/40 cursor-pointer transition-colors group/price"
                    title="Click to set product price"
                  >
                    <p className="text-[10px] text-zinc-500 font-sans flex items-center justify-center gap-1">
                      <span>Price</span>
                      <Edit3 className="w-2.5 h-2.5 text-zinc-500 group-hover/price:text-[#f3aa18]" />
                    </p>
                    <p className="text-xs font-mono font-bold text-white group-hover/price:text-[#f3aa18] mt-0.5">
                      IDR {p.price.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] text-zinc-500 font-sans">Views</p>
                    <p className="text-xs font-sans font-bold text-sky-400 mt-0.5">
                      {p.views_count} {p.views_count === 1 ? 'Angle' : 'Angles'}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                    <p className="text-[10px] text-zinc-500 font-sans">Parts</p>
                    <p className="text-xs font-sans font-bold text-emerald-400 mt-0.5">
                      {p.layers_count} {p.layers_count === 1 ? 'Layer' : 'Layers'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-zinc-500 shrink-0">SKU #{p.product_id}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDuplicateModal(p)}
                    className="px-3 py-1.5 text-xs font-sans font-medium rounded-xl border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Duplicate product & configurator profile"
                  >
                    <Copy className="w-3 h-3 text-sky-400" />
                    <span>Duplicate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditor(p.product_id)}
                    className="px-3.5 py-1.5 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <span>Open Studio</span>
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Quick Price Edit Dialog */}
      {priceEditModal &&
        createPortal(
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-white/15 p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Set Product Price</h3>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{priceEditModal.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPriceEditModal(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-300">
                  Storefront Regular Price (IDR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-zinc-500">IDR</span>
                  <input
                    type="number"
                    step="5000"
                    value={tempPrice}
                    onChange={(e) => setTempPrice(Number(e.target.value) || 0)}
                    autoFocus
                    className="w-full pl-12 pr-4 py-2.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Updates both WooCommerce regular price and configurator base price simultaneously.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPriceEditModal(null)}
                  className="px-4 py-2 text-xs font-sans rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickPrice}
                  disabled={isSavingPrice}
                  className="px-5 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingPrice ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Save Price</span>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Duplicate Product Dialog */}
      {duplicateModal &&
        createPortal(
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/15 p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Copy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Duplicate Product & Configurator</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">Source: {duplicateModal.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDuplicateModal(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">New Product Name</label>
                  <input
                    type="text"
                    value={duplicateName}
                    onChange={(e) => {
                      setDuplicateName(e.target.value);
                      setDuplicateSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }}
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-xs font-sans rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">New Product Slug</label>
                    <input
                      type="text"
                      value={duplicateSlug}
                      onChange={(e) => setDuplicateSlug(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1.5">Base Price (IDR)</label>
                    <input
                      type="number"
                      step="5000"
                      value={duplicatePrice}
                      onChange={(e) => setDuplicatePrice(Number(e.target.value) || 0)}
                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={duplicateCopyConfig}
                    onChange={(e) => setDuplicateCopyConfig(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 focus:outline-none accent-[#f3aa18] mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">Copy Full Configurator Setup</span>
                    <span className="text-[11px] text-zinc-400 leading-snug block mt-0.5">
                      Copies all viewing angles, composable skin layers, finish restrictions, and texture image mappings.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDuplicateModal(null)}
                  className="px-4 py-2 text-xs font-sans rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDuplicate}
                  disabled={isDuplicating || !duplicateName.trim()}
                  className="px-5 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isDuplicating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Duplicating...</span>
                    </>
                  ) : (
                    <span>Duplicate & Open Studio</span>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Fullscreen Apple/Figma-Grade Device Configurator Studio */}
      {selectedProductId &&
        createPortal(
          <div
            className={clsx(
              'fixed inset-0 z-[100] bg-zinc-950 flex flex-col h-screen w-screen overflow-hidden text-white select-none font-sans',
              isDragging && 'cursor-col-resize'
            )}
          >
            {/* 1. Studio Top Navigation Bar */}
            <header className="h-16 px-6 border-b border-white/10 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between shrink-0 gap-4 z-20">
              {/* Left: Exit Studio & Device Identity */}
              <div className="flex items-center gap-4 min-w-0">
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white text-xs font-sans font-medium transition-colors cursor-pointer shrink-0"
                  title="Exit Studio (ESC)"
                >
                  <ArrowLeft className="w-4 h-4 text-zinc-400" />
                  <span>Exit Studio</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 font-mono hidden sm:inline">ESC</span>
                </button>

                <div className="h-5 w-px bg-white/10 hidden sm:block shrink-0" />

                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-sm md:text-base font-bold text-white truncate max-w-xs md:max-w-md">
                      {editingProfile?.device_name || 'Loading Studio Workspace...'}
                    </h2>
                    {editingProfile && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-white/5 text-zinc-300 border border-white/10 shrink-0">
                        {editingProfile.family}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    SKU #{selectedProductId} • {editingProfile?.category || 'General'} • Base: IDR {(editingProfile?.base_price || 0).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              {/* Center: Engine Version Indicator */}
              {editingProfile && (
                <div className="hidden lg:flex items-center gap-1.5 bg-zinc-900/90 px-3 py-1 rounded-full border border-white/10 text-xs">
                  <span className="text-zinc-400 font-medium">Engine:</span>
                  <span
                    className={clsx(
                      'font-bold px-2 py-0.5 rounded text-[11px]',
                      editingProfile.configurator_version === 'v2'
                        ? 'bg-sky-500/15 text-sky-400'
                        : 'bg-amber-500/15 text-amber-400'
                    )}
                  >
                    {editingProfile.configurator_version === 'v2' ? 'v2 Modern Canvas' : 'v1 Dual-Layer Production'}
                  </span>
                </div>
              )}

              {/* Right: Find & Replace and Primary Save Action */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleStartAssetAudit}
                  disabled={!editingProfile || isAuditingAssets}
                  className="px-3.5 py-2 text-xs font-sans font-semibold rounded-xl border border-white/10 hover:bg-white/5 text-zinc-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Audit all views, chassis images, and finish textures for 404/broken URLs and ghost angles"
                >
                  {isAuditingAssets ? (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Audit Assets</span>
                  {auditReport && auditReport.brokenCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                      {auditReport.brokenCount}
                    </span>
                  )}
                  {auditReport && auditReport.ghostAngles.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                      {auditReport.ghostAngles.length} ghost
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowFindReplaceModal(true)}
                  disabled={!editingProfile}
                  className="px-3.5 py-2 text-xs font-sans font-semibold rounded-xl border border-white/10 hover:bg-white/5 text-zinc-200 hover:text-white transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Find and replace text across all image URLs (e.g. 17 to 18)"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Find & Replace in URLs</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile || !editingProfile}
                  className="px-5 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-gradient-to-b from-[#f6b328] to-[#ea9c0f] hover:brightness-105 active:scale-[0.985] text-[#08090b] transition-all flex items-center gap-2 shadow-lg shadow-[#f3aa18]/15 cursor-pointer disabled:opacity-50"
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

            {/* 2. Studio Workspace Body */}
            {isLoadingProfile || !editingProfile ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950">
                <RefreshCw className="w-10 h-10 animate-spin text-[#f3aa18]" />
                <p className="text-sm font-sans text-zinc-400">Loading configurator layers and assets...</p>
              </div>
            ) : (
              (() => {
                const skinLayers = (editingProfile.layers || []).filter(
                  (l) => (l.name || '').toLowerCase() !== 'device' && (l.id || '').toLowerCase() !== 'device'
                );

                const currentView =
                  editingProfile.views.find((v) => v.id === activeSimView) || editingProfile.views[0];

                const currentActiveLayer =
                  skinLayers.find((l) => l.id === selectedLayerId) || skinLayers[0];

                const activeAllowedSlugs = currentActiveLayer?.allowed_finish_slugs || [];
                const hasFinishRestrictions = activeAllowedSlugs.length > 0;

                const isFinishAllowedOnLayer = (fSlug: string) => {
                  if (!hasFinishRestrictions) return true;
                  const norm = fSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return activeAllowedSlugs.some(
                    (as) => as.toLowerCase().replace(/[^a-z0-9]/g, '') === norm
                  );
                };

                const layerFinishes = finishes.filter((f) =>
                  isFinishAllowedOnLayer(f.slug || f.id)
                );

                const filteredFinishesForDisplay = layerFinishes.filter((f) => {
                  if (finishCategoryFilter === 'all') return true;
                  return f.group === finishCategoryFilter;
                });

                const currentLayerAssets =
                  currentActiveLayer?.assets_by_view?.[currentView?.id || 'main_view'] ||
                  currentActiveLayer?.assets_by_view?.['main_view'] ||
                  Object.values(currentActiveLayer?.assets_by_view || {})[0] ||
                  {};

                const textureMap = currentLayerAssets.render_texture_map || {};

                return (
                  <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-zinc-950">
                    {/* LEFT / CENTER PANE: Spacious Interactive Device Canvas */}
                    <div className="flex-1 flex flex-col min-h-0 relative border-b lg:border-b-0 border-white/10 bg-radial from-zinc-900/40 via-zinc-950 to-zinc-950 overflow-hidden">
                      {/* Top Bar on Stage: Viewing Angles & Layer Toggles */}
                      <div className="p-5 flex flex-wrap items-center justify-between gap-3 z-10">
                        {/* Viewing Angle Pills */}
                        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-2xl border border-white/10 backdrop-blur-sm">
                          <span className="text-[11px] text-zinc-400 font-medium px-2.5 hidden sm:inline">Angle:</span>
                          {editingProfile.views.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setActiveSimView(v.id)}
                              className={clsx(
                                'px-3.5 py-1.5 rounded-xl text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5 font-medium',
                                activeSimView === v.id
                                  ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                              )}
                            >
                              <span>{v.name}</span>
                            </button>
                          ))}
                        </div>

                        {/* Quick Layer Visibility Pills on Stage */}
                        <div className="flex items-center gap-1.5 overflow-x-auto max-w-md">
                          {skinLayers.map((l) => {
                            const isChecked = selectedSimLayers[l.id] ?? (l.default_selected || l.is_required);
                            return (
                              <button
                                key={l.id}
                                type="button"
                                onClick={() =>
                                  setSelectedSimLayers((prev) => ({ ...prev, [l.id]: !isChecked }))
                                }
                                className={clsx(
                                  'px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5 border',
                                  isChecked
                                    ? 'bg-white/10 border-white/20 text-white font-medium'
                                    : 'bg-zinc-900/40 border-white/5 text-zinc-500 hover:text-zinc-300'
                                )}
                              >
                                <span
                                  className={clsx(
                                    'w-1.5 h-1.5 rounded-full',
                                    isChecked ? 'bg-[#f3aa18]' : 'bg-zinc-600'
                                  )}
                                />
                                <span className="truncate max-w-[100px]">{l.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Device Stage Viewport */}
                      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                        {/* Device Canvas Box */}
                        <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center drop-shadow-2xl">
                          {/* Layer 1: Hardware Chassis Base Image */}
                          {currentView?.background_url ? (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-0">
                              <img
                                src={currentView.background_url}
                                alt="Hardware Chassis"
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
                            <div className="absolute inset-0 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-xs text-zinc-500 text-center p-6">
                              <Smartphone className="w-12 h-12 text-zinc-700 mb-3" />
                              <span className="font-medium text-zinc-400">No Hardware Chassis Image</span>
                              <span className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                                Set the base hardware render in the "Hardware Base" tab on the right.
                              </span>
                            </div>
                          )}

                          {/* Layer 2: Customizable Skin Texture Overlays */}
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
                            const texUrl = matchedKey ? assets.render_texture_map?.[matchedKey] || '' : '';

                            if (!texUrl) return null;

                            return (
                              <img
                                key={l.id}
                                src={texUrl}
                                alt={l.name}
                                style={{ zIndex: (l.z_index || 1) + 5 }}
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            );
                          })}

                          {/* Layer 3: Realistic Multiply Shadow Overlay (v2 Engine) */}
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
                                  alt={`${l.name} Shadow`}
                                  style={{ zIndex: (l.z_index || 1) + 20, mixBlendMode: 'multiply' }}
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              );
                            })}
                        </div>
                      </div>

                      {/* Bottom Floating Bar on Stage: Price & Active Material Info */}
                      <div className="p-5 flex items-center justify-between z-10">
                        <div className="flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 shadow-lg">
                          <div className="w-7 h-7 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0 flex items-center justify-center">
                            {(() => {
                              const activeF = finishes.find(
                                (f) => (f.slug || f.id) === selectedSimFinish
                              );
                              return activeF?.thumbnail ? (
                                <img src={activeF.thumbnail} alt={activeF.name} className="w-full h-full object-cover" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />
                              );
                            })()}
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Active Texture Test</p>
                            <p className="text-xs font-bold text-white truncate max-w-[160px]">
                              {finishes.find((f) => (f.slug || f.id) === selectedSimFinish)?.name || selectedSimFinish}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/10 shadow-lg">
                          <div>
                            <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold text-right">Calculated Total</p>
                            <p className="text-base font-mono font-bold text-emerald-400">
                              IDR {simulatedTotalPrice.toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DRAGGABLE VERTICAL SPLITTER HANDLE */}
                    <div
                      onMouseDown={() => setIsDragging(true)}
                      className={clsx(
                        'hidden lg:flex w-2.5 relative z-20 cursor-col-resize select-none shrink-0 items-center justify-center transition-colors group',
                        isDragging ? 'bg-[#f3aa18]/40' : 'bg-white/[0.04] hover:bg-[#f3aa18]/25'
                      )}
                      title="Drag left or right to resize Inspector panel"
                    >
                      <div className="w-1 h-8 rounded-full bg-zinc-600 group-hover:bg-[#f3aa18] flex items-center justify-center transition-colors">
                        <GripVertical className="w-3 h-3 text-zinc-400 group-hover:text-black transition-colors" />
                      </div>
                    </div>

                    {/* RIGHT PANE: Focused Inspector Panel (resizable width) */}
                    <aside
                      style={{ width: `${inspectorWidth}px` }}
                      className="w-full lg:w-auto shrink-0 flex flex-col h-full bg-zinc-950/90 border-l lg:border-l-0 border-white/10 overflow-hidden"
                    >
                      {/* Inspector Top Tabs Navigation */}
                      <div className="h-14 px-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-zinc-950">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectorTab('layers')}
                            className={clsx(
                              'px-3.5 py-1.5 rounded-xl text-xs font-sans font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer',
                              inspectorTab === 'layers'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Layers className="w-3.5 h-3.5 text-[#f3aa18]" />
                            <span>Skin Parts</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300">
                              {skinLayers.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectorTab('hardware')}
                            className={clsx(
                              'px-3.5 py-1.5 rounded-xl text-xs font-sans font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer',
                              inspectorTab === 'hardware'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Monitor className="w-3.5 h-3.5 text-sky-400" />
                            <span>Hardware Base</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectorTab('settings')}
                            className={clsx(
                              'px-3.5 py-1.5 rounded-xl text-xs font-sans font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer',
                              inspectorTab === 'settings'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Settings className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Settings</span>
                          </button>
                        </div>
                      </div>

                      {/* Inspector Body Content */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* TAB 1: SKIN PARTS & TEXTURES */}
                        {inspectorTab === 'layers' && (
                          <div className="space-y-6">
                            {/* Part Selector Horizontal Pills */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                                  Customizable Skin Parts
                                </label>
                                <span className="text-[11px] text-zinc-500 font-mono">
                                  Angle: {currentView?.name}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {skinLayers.map((layer) => {
                                  const isSelected = (currentActiveLayer?.id || '') === layer.id;
                                  const assignedCount = Object.keys(
                                    layer.assets_by_view?.[currentView?.id || 'main_view']?.render_texture_map || {}
                                  ).filter((k) => Boolean(layer.assets_by_view?.[currentView?.id || 'main_view']?.render_texture_map?.[k])).length;

                                  return (
                                    <button
                                      key={layer.id}
                                      type="button"
                                      onClick={() => setSelectedLayerId(layer.id)}
                                      className={clsx(
                                        'px-3.5 py-2 rounded-xl text-xs font-sans transition-all flex items-center gap-2 cursor-pointer border',
                                        isSelected
                                          ? 'bg-[#f3aa18] text-black font-bold border-[#f3aa18] shadow-md shadow-[#f3aa18]/20'
                                          : 'bg-zinc-900 border-white/10 text-zinc-300 hover:text-white hover:border-white/20'
                                      )}
                                    >
                                      <span>{layer.name}</span>
                                      <span
                                        className={clsx(
                                          'text-[10px] font-mono px-1.5 py-0.5 rounded-full',
                                          isSelected ? 'bg-black/20 text-black' : 'bg-white/10 text-zinc-400'
                                        )}
                                      >
                                        {assignedCount}
                                      </span>
                                    </button>
                                  );
                                })}

                                {/* Quick Add Preset Part Dropdown */}
                                <div className="relative inline-block">
                                  <select
                                    onChange={(e) => {
                                      const preset = COMMON_PRESET_LAYERS.find((p) => p.name === e.target.value);
                                      if (preset) handleAddPresetLayer(preset);
                                      e.target.value = '';
                                    }}
                                    className="px-3 py-2 text-xs font-sans rounded-xl bg-zinc-900 border border-dashed border-white/20 hover:border-[#f3aa18] text-[#f3aa18] font-bold cursor-pointer focus:outline-none transition-colors"
                                    defaultValue=""
                                  >
                                    <option value="" disabled>+ Add Skin Part...</option>
                                    {COMMON_PRESET_LAYERS.map((preset) => (
                                      <option key={preset.name} value={preset.name}>
                                        {preset.name} (+IDR {preset.extra_price.toLocaleString('id-ID')})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Active Part Details Card */}
                            {currentActiveLayer ? (
                              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="text"
                                      value={currentActiveLayer.name}
                                      onChange={(e) =>
                                        handleUpdateLayer(currentActiveLayer.id, { name: e.target.value })
                                      }
                                      className="font-bold text-white text-sm bg-transparent border-b border-white/10 focus:border-[#f3aa18] focus:outline-none px-1 py-0.5"
                                    />
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                                      {currentActiveLayer.id}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLayer(currentActiveLayer.id)}
                                      className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                      title="Delete Skin Part"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Part Attributes: Required & Up-charge */}
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                                  <label className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={currentActiveLayer.is_required}
                                      onChange={(e) =>
                                        handleUpdateLayer(currentActiveLayer.id, {
                                          is_required: e.target.checked,
                                          is_optional: !e.target.checked,
                                        })
                                      }
                                      className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 focus:outline-none accent-[#f3aa18] cursor-pointer"
                                    />
                                    <span className="text-zinc-200 font-medium">Required Part</span>
                                  </label>

                                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans">
                                    <span className="text-zinc-400 font-medium">Extra Price:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-zinc-500 font-mono text-[11px]">IDR</span>
                                      <input
                                        type="number"
                                        step="5000"
                                        value={currentActiveLayer.extra_price}
                                        onChange={(e) =>
                                          handleUpdateLayer(currentActiveLayer.id, {
                                            extra_price: Number(e.target.value) || 0,
                                          })
                                        }
                                        className="w-20 px-2 py-0.5 text-xs font-mono text-right rounded bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Finish Availability Restrictions */}
                                <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Filter className="w-3.5 h-3.5 text-[#f3aa18]" />
                                      <span className="text-xs font-bold text-zinc-300">Material Availability</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleSetLayerAllFinishes(currentActiveLayer.id, true)}
                                        className={clsx(
                                          'px-2.5 py-1 rounded-lg text-[11px] font-sans font-medium transition-colors cursor-pointer',
                                          !hasFinishRestrictions
                                            ? 'bg-white/15 text-white font-bold'
                                            : 'text-zinc-400 hover:text-white'
                                        )}
                                      >
                                        All ({finishes.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSetLayerAllFinishes(currentActiveLayer.id, false)}
                                        className={clsx(
                                          'px-2.5 py-1 rounded-lg text-[11px] font-sans font-medium transition-colors cursor-pointer',
                                          hasFinishRestrictions
                                            ? 'bg-[#f3aa18]/20 text-[#f3aa18] font-bold border border-[#f3aa18]/40'
                                            : 'text-zinc-400 hover:text-white'
                                        )}
                                      >
                                        Restricted ({layerFinishes.length})
                                      </button>
                                    </div>
                                  </div>

                                  {hasFinishRestrictions && (
                                    <div className="pt-2 border-t border-white/5 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-zinc-400">Available Finishes:</span>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingProfile({
                                                ...editingProfile,
                                                layers: editingProfile.layers.map((l) =>
                                                  l.id === currentActiveLayer.id
                                                    ? { ...l, allowed_finish_slugs: ['swarm', 'black-camo'] }
                                                    : l
                                                ),
                                              });
                                              showToast('info', 'Preset Applied', 'Set to Swarm & Black Camo only.');
                                            }}
                                            className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer transition-colors"
                                          >
                                            Swarm & Black Camo
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleAutoDetectLayerFinishes(currentActiveLayer.id)}
                                            className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                                          >
                                            Auto-Detect
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                                        {finishes.map((f) => {
                                          const fSlug = f.slug || f.id;
                                          const isAllowed = isFinishAllowedOnLayer(fSlug);
                                          return (
                                            <button
                                              key={f.id}
                                              type="button"
                                              onClick={() =>
                                                handleToggleLayerAllowedFinish(currentActiveLayer.id, fSlug)
                                              }
                                              className={clsx(
                                                'px-2 py-0.5 rounded-lg text-[11px] font-sans transition-all flex items-center gap-1.5 cursor-pointer',
                                                isAllowed
                                                  ? 'bg-[#f3aa18]/20 border border-[#f3aa18]/40 text-white font-semibold'
                                                  : 'bg-zinc-900 border border-white/5 text-zinc-500 hover:text-zinc-300'
                                              )}
                                            >
                                              <span
                                                className={clsx(
                                                  'w-1.5 h-1.5 rounded-full',
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
                              </div>
                            ) : (
                              <div className="p-8 rounded-2xl bg-zinc-900/40 border border-dashed border-white/10 text-center">
                                <p className="text-xs text-zinc-400">No customizable skin parts added yet.</p>
                                <p className="text-[11px] text-zinc-500 mt-1">
                                  Select a preset above to create your first customizable layer.
                                </p>
                              </div>
                            )}

                            {/* Finish Swatches Grid */}
                            {currentActiveLayer && (
                              <div className="space-y-3">
                                {/* Header with Group Filter Tabs and Autofill */}
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Palette className="w-3.5 h-3.5 text-[#f3aa18]" />
                                      <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                                        Texture Maps ({filteredFinishesForDisplay.length})
                                      </h5>
                                    </div>
                                    <span className="text-[11px] text-zinc-400">
                                      Click swatch to test, or click URL button to edit image
                                    </span>
                                  </div>

                                  {/* Category Filter Pills */}
                                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                    {finishGroups.map((group) => (
                                      <button
                                        key={group}
                                        type="button"
                                        onClick={() => setFinishCategoryFilter(group)}
                                        className={clsx(
                                          'px-2.5 py-1 rounded-lg text-[11px] font-sans whitespace-nowrap transition-colors cursor-pointer',
                                          finishCategoryFilter === group
                                            ? 'bg-white/15 text-white font-bold'
                                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                        )}
                                      >
                                        {group === 'all' ? 'All Finishes' : group}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Quick Autofill Helper */}
                                  <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/60 border border-white/5">
                                    <input
                                      type="text"
                                      placeholder="https://exacoat.com/uploads/iPhone-Back-{finish}.png"
                                      value={autofillPrefix}
                                      onChange={(e) => setAutofillPrefix(e.target.value)}
                                      className="px-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white font-mono flex-1 placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAutofillLayerTextures(currentActiveLayer.id)}
                                      className="px-3 py-1.5 text-xs font-sans font-bold uppercase tracking-wider rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors shrink-0"
                                    >
                                      Autofill All
                                    </button>
                                  </div>
                                </div>

                                {/* Swatches Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto pr-1">
                                  {filteredFinishesForDisplay.map((f) => {
                                    const finishSlug = f.slug || f.id;
                                    const normSlug = finishSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    const matchedKey = Object.keys(textureMap).find(
                                      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normSlug
                                    );
                                    const currentUrl = matchedKey ? textureMap[matchedKey] : '';
                                    const isAssigned = Boolean(currentUrl);
                                    const isSimSelected = selectedSimFinish === finishSlug;

                                    return (
                                      <div
                                        key={f.id}
                                        onClick={() => setSelectedSimFinish(finishSlug)}
                                        className={clsx(
                                          'p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 text-xs cursor-pointer group relative',
                                          isSimSelected
                                            ? 'bg-white/10 border-[#f3aa18] shadow-md shadow-[#f3aa18]/15'
                                            : isAssigned
                                            ? 'bg-zinc-900/90 border-white/10 hover:border-white/25'
                                            : 'bg-zinc-900/40 border-white/5 hover:border-white/20'
                                        )}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
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
                                            <p className="font-bold text-white truncate text-xs">{f.name}</p>
                                            <span className="text-[10px] text-zinc-400 truncate block">
                                              {f.group || 'Material'}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                                          {isAssigned ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-emerald-400">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                              Mapped
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-zinc-500 font-sans">
                                              Unassigned
                                            </span>
                                          )}

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenTextureModal(
                                                currentActiveLayer.id,
                                                currentActiveLayer.name,
                                                finishSlug,
                                                f.name,
                                                currentUrl,
                                                f.thumbnail
                                              );
                                            }}
                                            className={clsx(
                                              'p-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1',
                                              isAssigned
                                                ? 'text-zinc-400 hover:text-white hover:bg-white/10'
                                                : 'text-[#f3aa18] hover:text-[#ffb72b] bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20'
                                            )}
                                            title="Edit Transparent Texture PNG URL"
                                          >
                                            <LinkIcon className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* TAB 2: HARDWARE BASE CHASSIS (LAYER 1) */}
                        {inspectorTab === 'hardware' && (
                          <div className="space-y-6">
                            <div>
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Monitor className="w-4 h-4 text-sky-400" />
                                Hardware Chassis Render (Layer 1)
                              </h4>
                              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                The neutral hardware body render of the device (ports, camera bump, chassis). All customizable skin layers are composited on top of this.
                              </p>
                            </div>

                            {/* Angle Switcher for Hardware Image */}
                            <div className="space-y-3">
                              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Configure Angle
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                {editingProfile.views.map((v) => (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setActiveSimView(v.id)}
                                    className={clsx(
                                      'px-3.5 py-1.5 rounded-xl text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5 font-medium',
                                      activeSimView === v.id
                                        ? 'bg-sky-500 text-black font-bold shadow-sm'
                                        : 'bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white'
                                    )}
                                  >
                                    <span>{v.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Active Angle Hardware Base Details */}
                            {currentView && (
                              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-4">
                                <div className="flex items-center gap-4">
                                  {currentView.background_url ? (
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                                      <img
                                        src={currentView.background_url}
                                        alt={currentView.name}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-950 border-2 border-dashed border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center text-zinc-600">
                                      <Smartphone className="w-7 h-7" />
                                    </div>
                                  )}

                                  <div className="min-w-0">
                                    <p className="font-bold text-white text-sm">{currentView.name}</p>
                                    <p className="text-[11px] text-zinc-400 mt-0.5">Angle ID: {currentView.id}</p>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="block text-xs font-bold text-zinc-300">
                                    Hardware Body Image URL
                                  </label>
                                  <input
                                    type="url"
                                    placeholder="https://exacoat.com/wp-content/uploads/renders/device-body.png"
                                    value={currentView.background_url || ''}
                                    onChange={(e) => handleSetViewBackground(currentView.id, e.target.value)}
                                    className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-sky-400 placeholder:text-zinc-600"
                                  />
                                </div>

                                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                  {editingProfile.views.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveView(currentView.id)}
                                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Remove Angle</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                              {/* Add Viewing Angle Helper */}
                              <div className="pt-3 border-t border-white/5 space-y-2">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                  Quick Add Device Angle
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAddView('Back View')}
                                    className="px-3 py-1.5 text-xs font-sans rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    + Back View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddView('Inner View')}
                                    className="px-3 py-1.5 text-xs font-sans rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    + Inner View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddView('Trackpad View')}
                                    className="px-3 py-1.5 text-xs font-sans rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    + Trackpad View
                                  </button>
                                </div>
                              </div>

                              {/* Asset Integrity & Ghost Angle Audit Helper */}
                              <div className="pt-3 border-t border-white/5 space-y-3">
                                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                                      <div>
                                        <h5 className="text-xs font-bold text-white">Asset Integrity & Ghost Angle Audit</h5>
                                        <p className="text-[11px] text-zinc-400">
                                          Verify all chassis renders and finish textures return 200 OK.
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleStartAssetAudit}
                                      disabled={isAuditingAssets}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                                    >
                                      {isAuditingAssets ? (
                                        <>
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          <span>Auditing...</span>
                                        </>
                                      ) : (
                                        <>
                                          <ShieldCheck className="w-3.5 h-3.5" />
                                          <span>Run Audit</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  {auditReport && auditReport.ghostAngles.length > 0 && (
                                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-300">
                                      <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                                        <span>
                                          {auditReport.ghostAngles.length} ghost angle detected ({auditReport.ghostAngles.map((g) => g.viewName).join(', ')}).
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setShowAssetAuditModal(true)}
                                        className="text-[11px] underline font-bold hover:text-amber-200 cursor-pointer shrink-0"
                                      >
                                        View & Clean Up
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                        {/* TAB 3: DEVICE SETTINGS & ARCHITECTURE */}
                        {inspectorTab === 'settings' && (
                          <div className="space-y-6">
                            <div>
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <Settings className="w-4 h-4 text-zinc-400" />
                                Device Pricing & Configuration Settings
                              </h4>
                              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                Base storefront values, sizing multipliers, and configurator rendering engine mode.
                              </p>
                            </div>

                            {/* Base Price & Scale */}
                            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-4">
                              <div>
                                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Base Price (IDR)</label>
                                <input
                                  type="number"
                                  value={editingProfile.base_price}
                                  onChange={(e) =>
                                    setEditingProfile({ ...editingProfile, base_price: Number(e.target.value) || 0 })
                                  }
                                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
                                />
                                <p className="text-[11px] text-zinc-500 mt-1">
                                  Synchronized directly with WooCommerce product regular price.
                                </p>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Device Family</label>
                                <select
                                  value={editingProfile.family}
                                  onChange={(e) =>
                                    setEditingProfile({ ...editingProfile, family: e.target.value as DeviceFamily })
                                  }
                                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-sans focus:outline-none focus:border-[#f3aa18]"
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
                                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                                  Size Surcharge Multiplier
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editingProfile.size_multiplier}
                                  onChange={(e) =>
                                    setEditingProfile({
                                      ...editingProfile,
                                      size_multiplier: Number(e.target.value) || 1.0,
                                    })
                                  }
                                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
                                />
                                <p className="text-[11px] text-zinc-500 mt-1">
                                  Multiplied against premium finish group up-prices (e.g. 1.0x for phones, 1.4x for laptops).
                                </p>
                              </div>
                            </div>

                            {/* Configurator Engine Architecture */}
                            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-3">
                              <label className="block text-xs font-bold text-zinc-300">
                                Rendering Engine Architecture
                              </label>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingProfile({ ...editingProfile, configurator_version: 'v1' })}
                                  className={clsx(
                                    'p-3 rounded-xl border text-left transition-all cursor-pointer',
                                    (editingProfile.configurator_version || 'v1') === 'v1'
                                      ? 'bg-amber-500/15 border-amber-500/50 text-white'
                                      : 'bg-zinc-950 border-white/5 text-zinc-400 hover:text-white'
                                  )}
                                >
                                  <p className="font-bold text-xs">v1 Legacy</p>
                                  <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                                    Dual-layer Photoshop PNG overlays. Backwards compatible with live store.
                                  </p>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setEditingProfile({ ...editingProfile, configurator_version: 'v2' })}
                                  className={clsx(
                                    'p-3 rounded-xl border text-left transition-all cursor-pointer',
                                    editingProfile.configurator_version === 'v2'
                                      ? 'bg-sky-500/15 border-sky-500/50 text-white'
                                      : 'bg-zinc-950 border-white/5 text-zinc-400 hover:text-white'
                                  )}
                                >
                                  <p className="font-bold text-xs">v2 Modern</p>
                                  <p className="text-[10px] text-zinc-400 mt-1 leading-snug">
                                    Vector clipping masks, dynamic color tints, and realistic multiply shadows.
                                  </p>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </aside>
                  </div>
                );
              })()
            )}

            {/* 3. Find & Replace in URLs Modal */}
            {showFindReplaceModal &&
              createPortal(
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/15 p-6 shadow-2xl space-y-5 font-sans">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18] shrink-0">
                          <Wand2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Find & Replace in Image URLs</h3>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Quickly rename device versions (e.g. replace "17" with "18") across all layers.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowFindReplaceModal(false)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1.5">Find String</label>
                        <input
                          type="text"
                          placeholder="e.g. 17 or iphone-17-pro"
                          value={findText}
                          onChange={(e) => setFindText(e.target.value)}
                          autoFocus
                          className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1.5">Replace With</label>
                        <input
                          type="text"
                          placeholder="e.g. 18 or iphone-18-pro"
                          value={replaceText}
                          onChange={(e) => setReplaceText(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1.5">Scope</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReplaceScope('all')}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-xs font-sans transition-colors cursor-pointer',
                              replaceScope === 'all'
                                ? 'bg-white/15 text-white font-bold'
                                : 'text-zinc-400 hover:text-white bg-zinc-900 border border-white/5'
                            )}
                          >
                            All URLs (Textures & Chassis)
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplaceScope('textures')}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-xs font-sans transition-colors cursor-pointer',
                              replaceScope === 'textures'
                                ? 'bg-white/15 text-white font-bold'
                                : 'text-zinc-400 hover:text-white bg-zinc-900 border border-white/5'
                            )}
                          >
                            Finish Textures Only
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplaceScope('chassis')}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-xs font-sans transition-colors cursor-pointer',
                              replaceScope === 'chassis'
                                ? 'bg-white/15 text-white font-bold'
                                : 'text-zinc-400 hover:text-white bg-zinc-900 border border-white/5'
                            )}
                          >
                            Hardware Chassis Only
                          </button>
                        </div>
                      </div>

                      {/* Live Match Preview */}
                      {findText.trim() && (
                        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-medium">Matches found:</span>
                            <span
                              className={clsx(
                                'font-mono font-bold px-2 py-0.5 rounded text-[11px]',
                                findMatches.count > 0
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-zinc-800 text-zinc-500'
                              )}
                            >
                              {findMatches.count} {findMatches.count === 1 ? 'URL' : 'URLs'}
                            </span>
                          </div>

                          {findMatches.sampleBefore && (
                            <div className="pt-2 border-t border-white/5 space-y-1 font-mono text-[11px] break-all">
                              <p className="text-rose-400 truncate">
                                - {findMatches.sampleBefore}
                              </p>
                              <p className="text-emerald-400 truncate">
                                + {findMatches.sampleAfter}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowFindReplaceModal(false)}
                        className="px-4 py-2 text-xs font-sans rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteFindReplace}
                        disabled={findMatches.count === 0}
                        className="px-5 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                      >
                        <span>Replace {findMatches.count > 0 ? `All (${findMatches.count})` : ''}</span>
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}

            {/* 4. Focused Texture URL Edit Modal */}
            {editingTextureModal &&
              createPortal(
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/15 p-6 shadow-2xl space-y-5 font-sans">
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
                            {editingTextureModal.finishName} Texture Map
                          </h3>
                          <p className="text-xs text-zinc-400 mt-0.5 truncate">
                            Part: {editingTextureModal.layerName} • Angle: {activeSimView}
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
                      <label className="block text-xs font-bold text-zinc-300">
                        Photoshop Transparent PNG URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://exacoat.com/wp-content/uploads/renders/finish.png"
                        value={tempTextureUrl}
                        onChange={(e) => setTempTextureUrl(e.target.value)}
                        autoFocus
                        className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                      />
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        Transparent PNG overlay of this specific finish texture created in Photoshop for this device angle.
                      </p>
                    </div>

                    {tempTextureUrl && (
                      <div className="flex items-center justify-between text-xs pt-1">
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
                          className="text-rose-400 hover:text-rose-300 cursor-pointer font-medium"
                        >
                          Clear URL
                        </button>
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingTextureModal(null)}
                        className="px-4 py-2 text-xs font-sans rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTextureModal}
                        className="px-5 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors cursor-pointer"
                      >
                        Save Texture URL
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )}

            {/* 5. Asset Integrity Audit Modal */}
            {showAssetAuditModal &&
              createPortal(
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl overflow-hidden font-sans">
                    {/* Header */}
                    <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4 bg-zinc-900/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">Asset Integrity & Health Audit</h3>
                            {editingProfile && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 font-mono">
                                {editingProfile.device_name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Probing viewing angles, hardware chassis renders, and finish textures for 200 OK responses.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleStartAssetAudit}
                          disabled={isAuditingAssets}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw className={clsx('w-3.5 h-3.5', isAuditingAssets && 'animate-spin text-[#f3aa18]')} />
                          <span>{isAuditingAssets ? 'Auditing...' : 'Re-run Audit'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAssetAuditModal(false)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar during audit */}
                    {isAuditingAssets && (
                      <div className="bg-zinc-900 px-5 py-3 border-b border-white/10 flex items-center justify-between text-xs text-zinc-300">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#f3aa18]" />
                          <span>
                            Auditing assets: {auditProgress.completed} of {auditProgress.total} completed...
                          </span>
                        </div>
                        <span className="font-mono text-zinc-400">
                          {auditProgress.total > 0
                            ? Math.round((auditProgress.completed / auditProgress.total) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                    )}

                    {/* Content Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                      {/* Stat Cards */}
                      {auditReport && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                            <span className="text-[11px] text-zinc-400 block font-medium">Total Assets</span>
                            <span className="text-xl font-bold font-mono text-white mt-1 block">
                              {auditReport.totalProbed}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                            <span className="text-[11px] text-emerald-400 block font-medium flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Healthy (200 OK)</span>
                            </span>
                            <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                              {auditReport.healthyCount}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                            <span className="text-[11px] text-rose-400 block font-medium flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Broken / 404</span>
                            </span>
                            <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                              {auditReport.brokenCount}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <span className="text-[11px] text-amber-400 block font-medium flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Ghost Angles</span>
                            </span>
                            <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                              {auditReport.ghostAngles.length}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                            <span className="text-[11px] text-zinc-400 block font-medium">Empty Mappings</span>
                            <span className="text-xl font-bold font-mono text-zinc-400 mt-1 block">
                              {auditReport.emptyCount}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Ghost Angle Action Callout */}
                      {auditReport && auditReport.ghostAngles.length > 0 && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-xs font-bold text-amber-300">
                                Ghost Viewing Angle Detected ({auditReport.ghostAngles.length})
                              </h4>
                              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                                This product contains viewing angles that have 0 finish texture maps and missing or broken chassis images.
                                This usually happens when copying from another device template (e.g. tablet cloned from an iPad with side view).
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-amber-500/20">
                            {auditReport.ghostAngles.map((ghost) => (
                              <div
                                key={ghost.viewId}
                                className="p-3 rounded-lg bg-black/40 border border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{ghost.viewName}</span>
                                    <span className="font-mono text-[11px] text-zinc-400">(Angle ID: {ghost.viewId})</span>
                                  </div>
                                  <p className="text-[11px] text-zinc-400 mt-0.5">
                                    Chassis: <span className="text-rose-400">{ghost.chassisStatus}</span> • Textures:{' '}
                                    <span className="text-amber-400">{ghost.mappedTexturesCount} assigned</span>
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveGhostAngle(ghost.viewId, ghost.viewName)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Remove Ghost Angle</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty Mappings Prune Callout */}
                      {auditReport && auditReport.emptyCount > 0 && (
                        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            <Tag className="w-4 h-4 text-zinc-400 shrink-0" />
                            <div>
                              <span className="text-zinc-200 font-semibold block">
                                {auditReport.emptyCount} empty texture mappings found
                              </span>
                              <span className="text-zinc-400 text-[11px] block mt-0.5">
                                Empty strings ("") cluttering database records from template cloning.
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handlePruneEmptyMappings}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 hover:text-white border border-white/10 text-xs font-medium cursor-pointer transition-colors"
                          >
                            Prune Empty Mappings
                          </button>
                        </div>
                      )}

                      {/* Filter Tabs */}
                      {auditReport && (
                        <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto">
                          {(
                            [
                              { key: 'all', label: 'All Items', count: auditReport.totalProbed },
                              { key: 'broken', label: 'Broken / 404', count: auditReport.brokenCount },
                              { key: 'ghost', label: 'Ghost Angles', count: auditReport.ghostAngles.length },
                              { key: 'empty', label: 'Empty', count: auditReport.emptyCount },
                              { key: 'healthy', label: 'Healthy', count: auditReport.healthyCount },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setAuditFilter(tab.key)}
                              className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                                auditFilter === tab.key
                                  ? 'bg-[#f3aa18] text-black font-bold'
                                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
                              )}
                            >
                              <span>{tab.label}</span>
                              <span
                                className={clsx(
                                  'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                                  auditFilter === tab.key
                                    ? 'bg-black/20 text-black'
                                    : 'bg-white/5 text-zinc-400'
                                )}
                              >
                                {tab.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Audit Results List */}
                      <div className="space-y-2">
                        {filteredAuditItems.length === 0 ? (
                          <div className="p-8 rounded-xl bg-zinc-900/30 border border-white/5 text-center text-xs text-zinc-400">
                            {isAuditingAssets ? 'Probing image URLs...' : 'No items match the selected filter.'}
                          </div>
                        ) : (
                          filteredAuditItems.map((item) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={clsx(
                                      'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                                      item.status === 'healthy' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                                      item.status === 'broken' && 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
                                      item.status === 'empty' && 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                    )}
                                  >
                                    {item.status === 'healthy' ? '200 OK' : item.status === 'broken' ? 'Broken' : 'Empty'}
                                  </span>

                                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-300 border border-white/10 capitalize">
                                    {item.type}
                                  </span>

                                  <span className="text-white font-medium">
                                    {item.layerName ? `${item.layerName} • ` : ''}
                                    {item.finishName || item.viewName}
                                  </span>

                                  <span className="text-[11px] text-zinc-500">
                                    (Angle: {item.viewName})
                                  </span>
                                </div>

                                {item.url ? (
                                  <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
                                    <span className="truncate max-w-lg" title={item.url}>
                                      {item.url}
                                    </span>
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-zinc-500 hover:text-sky-400 shrink-0"
                                      title="Open URL in new tab"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-zinc-500 italic text-[11px]">No URL assigned</span>
                                )}

                                {item.error && (
                                  <p className="text-[11px] text-rose-400 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    <span>{item.error}</span>
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                {item.type === 'texture' && item.layerId && item.finishSlug && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleOpenTextureModal(
                                        item.layerId!,
                                        item.layerName || '',
                                        item.finishSlug!,
                                        item.finishName || item.finishSlug!,
                                        item.url,
                                        undefined
                                      );
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-[11px] font-medium cursor-pointer transition-colors"
                                  >
                                    Edit URL
                                  </button>
                                )}

                                {item.type === 'texture' && item.status === 'broken' && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearBrokenTexture(item)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-medium cursor-pointer transition-colors"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-white/10 flex items-center justify-between bg-zinc-900/50 text-xs">
                      <span className="text-zinc-400 text-[11px]">
                        Changes made here take effect immediately in the studio workspace. Click "Save Configurator" when finished.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAssetAuditModal(false)}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer transition-colors"
                      >
                        Close Audit
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
