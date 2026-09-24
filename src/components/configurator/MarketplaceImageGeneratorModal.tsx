import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../lib/bodyScrollLock';
import type { DeviceConfiguratorProfile } from '../../types';
import type { GlobalFinish } from '../../lib/wordpressBridge';
import {
  MarketplaceFeatureCard,
  MarketplaceImageConfig,
  DEFAULT_FEATURE_CARDS_OFFICIAL,
  DEFAULT_FEATURE_CARDS_FIT,
  DEFAULT_FEATURE_CARDS_CLEAR,
  generateMarketplaceImageBlob,
  batchGenerateMarketplaceZip,
} from '../../lib/marketplaceCanvasRenderer';
import { V2SkinCanvasLayer } from './V2SkinCanvasLayer';
import { useToast } from '../../context/ToastContext';
import {
  X,
  Download,
  FolderArchive,
  Bookmark,
  Sparkles,
  RefreshCw,
  Upload,
  Palette,
  Type,
  Layers,
  SlidersHorizontal,
  Image as ImageIcon,
  Check,
  CheckSquare,
  Square,
  ShieldCheck,
  Award,
  Crosshair,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { clsx } from 'clsx';

interface MarketplaceImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: DeviceConfiguratorProfile | null;
  finishes: GlobalFinish[];
}

const STORAGE_DEFAULT_SKINS_KEY = 'exacoat_marketplace_default_finishes';
const STORAGE_CUSTOM_BG_KEY = 'exacoat_marketplace_custom_bg';

export const MarketplaceImageGeneratorModal: React.FC<MarketplaceImageGeneratorModalProps> = ({
  isOpen,
  onClose,
  profile,
  finishes,
}) => {
  const { showToast } = useToast();

  // Active Tab in Sidebar
  const [activeTab, setActiveTab] = useState<'template' | 'device' | 'background' | 'batch'>('template');

  // Preview State
  const [activePreviewFinishId, setActivePreviewFinishId] = useState<string>('');
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);

  // Template State (Layout & Copy)
  const [deviceNameText, setDeviceNameText] = useState<string>('ALL DEVICES');
  const [showSubBadge, setShowSubBadge] = useState<boolean>(true);
  const [subBadgeText, setSubBadgeText] = useState<string>('Model Cut & 360');
  const [autoHeadlineWithFinish, setAutoHeadlineWithFinish] = useState<boolean>(true);
  const [headlineText, setHeadlineText] = useState<string>('Ark\nInvisible\nSkin');
  const [headlineFont, setHeadlineFont] = useState<'Chakra Petch' | 'Plus Jakarta Sans' | 'Inter'>('Chakra Petch');
  const [featureCards, setFeatureCards] = useState<MarketplaceFeatureCard[]>(DEFAULT_FEATURE_CARDS_OFFICIAL);

  // Background State
  const [bgType, setBgType] = useState<'studio_light' | 'custom'>('studio_light');
  const [customBgUrl, setCustomBgUrl] = useState<string>('');

  // Device & Swatches State
  const [activeColorId, setActiveColorId] = useState<string>('');
  const [coverage, setCoverage] = useState<'model_360' | 'model_cut'>('model_360');
  const [logoCutout, setLogoCutout] = useState<boolean>(true);
  const [pencilCutout, setPencilCutout] = useState<boolean>(true);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [deviceScale, setDeviceScale] = useState<number>(1.0);
  const [deviceOffsetX, setDeviceOffsetX] = useState<number>(0);
  const [deviceOffsetY, setDeviceOffsetY] = useState<number>(0);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(new Set());

  // 20+ Skins Swatches Stack (Optional)
  const [showSkinsStack, setShowSkinsStack] = useState<boolean>(false);
  const [skinsCountText, setSkinsCountText] = useState<string>('20+');
  const [skinsLabelText, setSkinsLabelText] = useState<string>('SKINS');
  const [swatchFinishSlugs, setSwatchFinishSlugs] = useState<string[]>(['black-camo', 'forged-carbon']);

  // Batch Generation State
  const [selectedFinishIds, setSelectedFinishIds] = useState<Set<string>>(new Set());
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; finishName: string } | null>(null);

  // Close on Escape key and lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const unlock = lockBodyScroll();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unlock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Filter genuine skin layers (strictly exclude device chassis / hardware body)
  const availableSkinLayers = useMemo(() => {
    if (!profile?.layers) return [];
    return profile.layers.filter((l) => {
      if (l.is_non_visual) return false;
      const n = (l.name || '').toLowerCase().trim();
      const id = (l.id || '').toLowerCase().trim();
      if (n === 'device' || id === 'device') return false;
      if (n.includes('device-body') || n.includes('device_body') || n.includes('device body')) return false;
      if (n.includes('chassis') || n.includes('hardware')) return false;
      if ((l.group as string) === 'device' || (l.group as string) === 'hardware') return false;
      return true;
    });
  }, [profile]);

  // Initialize fields when profile changes
  useEffect(() => {
    if (!profile) return;

    // Top-right pill defaults to 'ALL DEVICES' matching Image 2
    setDeviceNameText('ALL DEVICES');

    // Default view
    const defaultView = profile.views.find((v) => v.is_default) || profile.views[0];
    if (defaultView) {
      setSelectedViewId(defaultView.id);
    }

    // Default color
    if (profile.device_colors && profile.device_colors.length > 0) {
      setActiveColorId(profile.device_colors[0].id);
    }

    // Sub-badge detection
    const cov = profile.coverage_and_cutouts?.coverage_type;
    const hasModelCut = profile.coverage_and_cutouts?.has_model_cut;
    const isArk = profile.category?.toLowerCase().includes('ark') || profile.device_slug?.toLowerCase().includes('ark');

    if (isArk) {
      setSubBadgeText('x2 pcs');
      setHeadlineText('Ark\nInvisible\nSkin');
      setAutoHeadlineWithFinish(false);
      setFeatureCards(DEFAULT_FEATURE_CARDS_CLEAR);
    } else {
      if (cov === 'model_cut_and_360' || hasModelCut) {
        setSubBadgeText('Model Cut & 360');
      } else if (cov === 'model_cut_only') {
        setSubBadgeText('Model Cut');
      } else {
        setSubBadgeText('Model Cut & 360');
      }
      setAutoHeadlineWithFinish(true);
      setFeatureCards(DEFAULT_FEATURE_CARDS_OFFICIAL);
    }

    setShowSubBadge(true);

    const defaultCoverage = profile.coverage_and_cutouts?.has_model_cut ? 'model_cut' : 'model_360';
    setCoverage(defaultCoverage);
    setLogoCutout(profile.coverage_and_cutouts?.has_logo_cutout ?? true);
    setPencilCutout(Boolean(profile.coverage_and_cutouts?.has_pencil_cutout));

    // Reset device hero shot offsets
    setDeviceScale(1.0);
    setDeviceOffsetX(0);
    setDeviceOffsetY(0);

    // Initialize active skin layer IDs
    const initialLayers = new Set<string>();
    const genuineSkinLayers = (profile.layers || []).filter((l) => {
      if (l.is_non_visual) return false;
      const n = (l.name || '').toLowerCase().trim();
      const id = (l.id || '').toLowerCase().trim();
      if (n === 'device' || id === 'device') return false;
      if (n.includes('device-body') || n.includes('device_body') || n.includes('device body')) return false;
      if (n.includes('chassis') || n.includes('hardware')) return false;
      if ((l.group as string) === 'device' || (l.group as string) === 'hardware') return false;
      return true;
    });

    genuineSkinLayers.forEach((l) => {
      if (
        l.is_required ||
        l.group === 'primary' ||
        l.group === 'accent' ||
        l.name.toLowerCase().includes('back') ||
        l.name.toLowerCase().includes('camera')
      ) {
        initialLayers.add(l.id);
      }
    });
    if (initialLayers.size === 0 && genuineSkinLayers.length > 0) {
      initialLayers.add(genuineSkinLayers[0].id);
    }
    setActiveLayerIds(initialLayers);

    // Load custom background from storage if previously saved
    try {
      const savedBg = localStorage.getItem(STORAGE_CUSTOM_BG_KEY);
      if (savedBg) setCustomBgUrl(savedBg);
    } catch {}

    // Load default batch selection from storage
    try {
      const savedDefaults = localStorage.getItem(STORAGE_DEFAULT_SKINS_KEY);
      if (savedDefaults) {
        const parsed = JSON.parse(savedDefaults);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedFinishIds(new Set(parsed));
          return;
        }
      }
    } catch {}

    // Fallback: select first 18 in-stock finishes
    const inStockFinishes = finishes.filter((f) => f.in_stock !== false);
    const initialSelection = inStockFinishes.slice(0, 18).map((f) => f.id || f.slug);
    setSelectedFinishIds(new Set(initialSelection));
  }, [profile, finishes]);

  // Set default preview finish once finishes load
  useEffect(() => {
    if (!activePreviewFinishId && finishes.length > 0) {
      const firstInStock = finishes.find((f) => f.in_stock !== false) || finishes[0];
      setActivePreviewFinishId(firstInStock.id || firstInStock.slug);
    }
  }, [finishes, activePreviewFinishId]);

  // Active preview finish object
  const currentPreviewFinish = useMemo(() => {
    return (
      finishes.find((f) => (f.id || f.slug) === activePreviewFinishId) ||
      finishes[0] || {
        id: 'matte-black',
        name: 'Matte Black',
        slug: 'matte-black',
        group: 'Colors',
        thumbnail: '',
        color_hex: '#18181b',
        in_stock: true,
        extra_price: 0,
      }
    );
  }, [finishes, activePreviewFinishId]);

  // Active View Object
  const currentView = useMemo(() => {
    if (!profile) return null;
    return (
      profile.views.find((v) => v.id === selectedViewId) ||
      profile.views.find((v) => v.is_default) ||
      profile.views[0]
    );
  }, [profile, selectedViewId]);

  // Active Hardware Color Object
  const activeColor = useMemo(() => {
    if (!profile) return null;
    return (
      (activeColorId && profile.device_colors?.find((c) => c.id === activeColorId)) ||
      profile.device_colors?.[0]
    );
  }, [profile, activeColorId]);

  // Resolve Hardware Chassis Image (Real Phone Body, Lenses, Camera Bump)
  const chassisSrc = useMemo(() => {
    if (!profile || !currentView) return '';
    const dedicatedColorImg =
      (activeColor as any)?.body_images_by_view?.[currentView?.id] ||
      (currentView?.is_default || currentView?.id === 'main_view'
        ? activeColor?.body_image_url
        : '');

    const rawLayers = profile.layers || [];
    const deviceLayer = rawLayers.find((l) => (l.name || '').toLowerCase() === 'device');
    const devImg =
      deviceLayer?.assets_by_view?.[currentView?.id || '']?.render_texture_map?.['device'] ||
      Object.values(deviceLayer?.assets_by_view || {})[0]?.render_texture_map?.['device'] ||
      Object.values(deviceLayer?.assets_by_view || {})[0]?.base_hardware_body_url;

    return dedicatedColorImg || currentView?.background_url || devImg || '';
  }, [profile, currentView, activeColor]);

  // Specular and Highlight Overlays
  const shadingSrc = useMemo(() => {
    if (!currentView) return '';
    return currentView.shadow_png_url || currentView.shading_image_url || currentView.highlight_png_url || '';
  }, [currentView]);

  // Effective Headline
  const effectiveHeadline = useMemo(() => {
    if (autoHeadlineWithFinish) {
      return `${currentPreviewFinish.name}\nSkins`;
    }
    return headlineText || `${currentPreviewFinish.name}\nSkins`;
  }, [autoHeadlineWithFinish, currentPreviewFinish.name, headlineText]);

  // Build config object for export
  const buildRenderConfig = (): MarketplaceImageConfig | null => {
    if (!profile || !currentPreviewFinish) return null;
    return {
      profile,
      activeFinish: currentPreviewFinish,
      allFinishes: finishes,
      activeColorId,
      bgType,
      customBgUrl,
      showLogo: true,
      deviceNameText,
      subBadgeText: showSubBadge ? subBadgeText : '',
      headlineText: effectiveHeadline,
      headlineFont,
      autoHeadlineWithFinish,
      featureCards,
      showSkinsStack,
      skinsCountText,
      skinsLabelText,
      swatchFinishSlugs,
      selectedViewId,
      coverage,
      logoCutout,
      pencilCutout,
      deviceScale,
      deviceOffsetX,
      deviceOffsetY,
      activeLayerIds: Array.from(activeLayerIds),
    };
  };

  // Single Image Download (1500x1500px JPEG)
  const handleDownloadSingleImage = async () => {
    const config = buildRenderConfig();
    if (!config || !profile || !currentPreviewFinish) return;

    try {
      setIsDownloadingSingle(true);
      const blob = await generateMarketplaceImageBlob(config);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `${profile.device_slug || 'device'}_${currentPreviewFinish.slug || currentPreviewFinish.id}_1500x1500.jpg`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('success', 'Image Downloaded', `Saved 1500x1500px image: ${filename}`);
    } catch (err) {
      console.error('[Marketplace Generator] Single download failed:', err);
      showToast('error', 'Download Failed', 'Could not export high-res image');
    } finally {
      setIsDownloadingSingle(false);
    }
  };

  // Batch Export as ZIP
  const handleBatchGenerateZip = async () => {
    const baseConfig = buildRenderConfig();
    if (!baseConfig || !profile || selectedFinishIds.size === 0) {
      showToast('warning', 'No Skins Selected', 'Please check at least 1 skin to generate batch images');
      return;
    }

    const targetFinishes = finishes.filter((f) => selectedFinishIds.has(f.id || f.slug));
    if (targetFinishes.length === 0) return;

    try {
      setIsGeneratingBatch(true);
      setBatchProgress({ current: 0, total: targetFinishes.length, finishName: 'Initializing...' });

      const zipBlob = await batchGenerateMarketplaceZip(
        baseConfig,
        targetFinishes,
        (current, total, finishName) => {
          setBatchProgress({ current, total, finishName });
        }
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      const zipName = `exacoat-marketplace-${profile.device_slug || 'device'}-${targetFinishes.length}-skins.zip`;
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('success', 'Batch Completed', `Exported ${targetFinishes.length} high-res marketplace images to ${zipName}`);
    } catch (err) {
      console.error('[Marketplace Generator] Batch export error:', err);
      showToast('error', 'Batch Export Failed', 'Failed to generate batch zip archive');
    } finally {
      setIsGeneratingBatch(false);
      setBatchProgress(null);
    }
  };

  // Save current selection as default in localStorage
  const handleSaveDefaults = () => {
    try {
      const list = Array.from(selectedFinishIds);
      localStorage.setItem(STORAGE_DEFAULT_SKINS_KEY, JSON.stringify(list));
      if (customBgUrl) {
        localStorage.setItem(STORAGE_CUSTOM_BG_KEY, customBgUrl);
      }
      showToast('success', 'Defaults Saved', `Saved ${list.length} finishes as your default batch set.`);
    } catch {
      showToast('error', 'Save Failed', 'Could not save defaults to browser storage');
    }
  };

  // Toggle single finish in batch set
  const toggleFinishSelection = (id: string) => {
    setSelectedFinishIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle skin layer in render set
  const toggleLayerId = (id: string) => {
    setActiveLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all finishes
  const handleSelectAllFinishes = () => {
    const all = new Set(finishes.map((f) => f.id || f.slug));
    setSelectedFinishIds(all);
  };

  // Select top popular finishes
  const handleSelectPopularFinishes = () => {
    const popularSlugs = [
      'woven',
      'swarm',
      'black-camo',
      'forged-carbon',
      'carbon-fiber-black',
      'slate',
      'matte-black',
      'leather-black',
      'titanium-black',
      'marble-white',
      'matte-white',
      'dragon-black',
      'patina',
    ];
    const matched = finishes.filter((f) => popularSlugs.includes(f.slug || f.id)).map((f) => f.id || f.slug);
    setSelectedFinishIds(new Set(matched.length > 0 ? matched : finishes.slice(0, 15).map((f) => f.id || f.slug)));
    showToast('info', 'Popular Skins Selected', 'Selected standard marketplace flagship skins.');
  };

  // Deselect all
  const handleClearSelection = () => {
    setSelectedFinishIds(new Set());
  };

  // Custom Background file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('warning', 'Invalid File', 'Please select a valid PNG or JPG image file.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCustomBgUrl(objectUrl);
    setBgType('custom');
    showToast('success', 'Background Loaded', 'Applied custom background image from disk.');
  };

  // Helper for rendering feature card vector icons in DOM preview
  const renderCardIcon = (iconType: MarketplaceFeatureCard['iconType']) => {
    switch (iconType) {
      case 'material':
        return <Award className="w-4 h-4 text-emerald-600" />;
      case 'fit':
        return <Crosshair className="w-4 h-4 text-emerald-600" />;
      case 'scratch':
        return <KeyRound className="w-4 h-4 text-emerald-600" />;
      case 'shield':
      case 'guarantee':
      default:
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-zinc-950 text-zinc-100 flex flex-col w-screen h-screen overflow-hidden select-none animate-fadeIn">
      {/* 1. TOP HEADER BAR */}
      <header className="h-16 px-6 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
            title="Close generator (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-white tracking-tight">Marketplace Image Generator</h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/40">
                1500 × 1500 px
              </span>
              {profile && (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {profile.device_name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Photoshop-grade marketplace listing images with real hardware lenses and fast instant preview
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 transition"
            title="Save current skin list and placement settings as defaults"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#f3aa18]" />
            <span className="hidden md:inline">Save Defaults</span>
          </button>

          <span className="text-xs text-zinc-400 hidden lg:inline font-mono">
            {selectedFinishIds.size}/{finishes.length} selected
          </span>

          <button
            onClick={handleDownloadSingleImage}
            disabled={isDownloadingSingle || !profile}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 transition disabled:opacity-50"
            title="Render high-res 1500x1500px JPEG for active preview skin"
          >
            <Download className="w-4 h-4 text-[#f3aa18]" />
            {isDownloadingSingle ? 'Rendering...' : 'Download Current Skin (JPG)'}
          </button>

          <button
            onClick={handleBatchGenerateZip}
            disabled={isGeneratingBatch || selectedFinishIds.size === 0 || !profile}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black text-zinc-950 bg-[#f3aa18] hover:bg-[#e09b15] shadow-lg shadow-[#f3aa18]/25 transition disabled:opacity-50"
          >
            {isGeneratingBatch ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Exporting ({batchProgress?.current}/{batchProgress?.total})...
              </>
            ) : (
              <>
                <FolderArchive className="w-4 h-4" />
                Generate All ({selectedFinishIds.size}) as ZIP
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE (LEFT PREVIEW STAGE + RIGHT SIDEBAR) */}
      {!profile ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
          <RefreshCw className="w-8 h-8 animate-spin text-[#f3aa18] mb-3" />
          <p className="text-sm font-semibold">Loading device profile...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT SECTION: HIGH-PERFORMANCE LIVE DOM PREVIEW STAGE */}
          <div className="flex-1 flex flex-col items-center justify-between p-4 md:p-6 bg-zinc-950 relative overflow-hidden">
            {/* Viewport Status Pills */}
            <div className="w-full max-w-[min(620px,calc(100vh-230px))] flex items-center justify-between text-xs text-zinc-400 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-white/10 text-[11px] font-mono text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  1500 × 1500 px • 1:1 Live
                </span>
                <span className="text-[11px] text-zinc-500 hidden sm:inline">GPU-accelerated preview</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-900 border border-[#f3aa18]/30 text-[11px] font-bold text-[#f3aa18]">
                  <Sparkles className="w-3.5 h-3.5" />
                  {currentPreviewFinish.name}
                </span>
              </div>
            </div>

            {/* 1:1 ASPECT RATIO MASTER PREVIEW STAGE */}
            <div className="w-full max-w-[min(620px,calc(100vh-230px))] aspect-square relative rounded-3xl overflow-hidden shadow-2xl border border-white/15 select-none bg-white">
              {/* STAGE LAYER 1: BACKGROUND */}
              {bgType === 'custom' && customBgUrl ? (
                <img
                  src={customBgUrl}
                  alt="Custom Background"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
                />
              ) : (
                <div className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-br from-[#ffffff] via-[#f7f8fa] to-[#eceef2]">
                  {/* Subtle Exacoat Monogram Pattern Watermark */}
                  <svg className="w-full h-full opacity-[0.045]" viewBox="0 0 1500 1500" fill="none">
                    <defs>
                      <pattern id="exacoat-geo-pattern" width="160" height="160" patternUnits="userSpaceOnUse">
                        <circle cx="80" cy="80" r="42" fill="#000000" />
                        <path d="M 80 20 L 140 140 L 20 140 Z" fill="#000000" />
                        <rect x="68" y="68" width="24" height="24" rx="6" fill="#ffffff" />
                      </pattern>
                    </defs>
                    <rect width="1500" height="1500" fill="url(#exacoat-geo-pattern)" />
                  </svg>
                  <div className="absolute inset-0 bg-radial-gradient from-white/70 via-transparent to-black/5" />
                </div>
              )}

              {/* STAGE LAYER 2: PHONE DEVICE CONTAINER (60fps GPU-accelerated transform) */}
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  transformOrigin: '50% 50%',
                  transform: `translate(${(1040 - 750 + deviceOffsetX) / 15}%, ${(910 - 750 + deviceOffsetY) / 15}%) scale(${deviceScale * 1.18})`,
                  transition: 'transform 0.05s ease-out',
                }}
              >
                {/* Contact Shadow Under Phone */}
                <div
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    filter: 'drop-shadow(14px 24px 38px rgba(15, 23, 42, 0.22))',
                  }}
                >
                  {/* Hardware Chassis Base Image (contains real camera lenses, metal frame, ports) */}
                  {chassisSrc && (
                    <img
                      src={chassisSrc}
                      alt="Hardware Chassis"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0"
                    />
                  )}

                  {/* Active Skin Canvas Layers */}
                  {availableSkinLayers
                    .filter((l) => activeLayerIds.has(l.id))
                    .sort((a, b) => (a.z_index || 1) - (b.z_index || 1))
                    .map((layer) => {
                      if (!currentView) return null;
                      const viewSpecificAsset = layer.assets_by_view?.[currentView.id || 'main_view'];
                      const assets =
                        viewSpecificAsset ||
                        layer.assets_by_view?.['main_view'] ||
                        Object.values(layer.assets_by_view || {})[0] ||
                        {};

                      if (!assets.mask_svg_url) return null;

                      // Texture resolution
                      const isCustomPerDevice = Boolean(currentPreviewFinish.is_custom_per_device);
                      const customTex = isCustomPerDevice
                        ? (assets.render_texture_map?.[currentPreviewFinish.slug] ||
                           assets.render_texture_map?.[currentPreviewFinish.id])
                        : '';

                      const isBigDevice =
                        profile.family === 'laptop' ||
                        profile.family === 'tablet' ||
                        (profile.family as string) === 'tablet_laptop' ||
                        profile.family === 'keyboard';
                      const useBigTexture = layer.texture_size === 'big' || (layer.texture_size !== 'small' && isBigDevice);
                      const activeTexUrl = (useBigTexture && currentPreviewFinish.texture_big_url)
                        ? currentPreviewFinish.texture_big_url
                        : currentPreviewFinish.texture_url || '';

                      const textureToTile = (isCustomPerDevice && customTex)
                        ? customTex
                        : (activeTexUrl || customTex);

                      // Cutouts resolution
                      const covMode = profile.coverage_and_cutouts?.coverage_type || (profile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
                      const shouldApplyModelCut = covMode === 'model_cut_only' || (covMode === 'model_cut_and_360' && coverage === 'model_cut');
                      const shouldApplyLogoCutout = logoCutout && (profile.coverage_and_cutouts?.has_logo_cutout ?? true);
                      const shouldApplyPencilCutout = pencilCutout && Boolean(profile.coverage_and_cutouts?.has_pencil_cutout);

                      const targetLogoViewId = profile.coverage_and_cutouts?.logo_cutout_view_id || 'main_view';
                      const isLogoView = currentView.id === targetLogoViewId || (!profile.coverage_and_cutouts?.logo_cutout_view_id && (currentView.is_default || currentView.id === profile.views?.[0]?.id));
                      const logoCutoutUrl = shouldApplyLogoCutout && isLogoView
                        ? currentView.logo_cutout_mask_url || profile.coverage_and_cutouts?.logo_cutout_mask_url || assets.logo_cutout_url
                        : undefined;

                      const pencilCutoutUrl = shouldApplyPencilCutout
                        ? currentView.pencil_cutout_mask_url || profile.coverage_and_cutouts?.pencil_cutout_mask_url || assets.pencil_cutout_url
                        : undefined;

                      const targetModelCutViewId = profile.coverage_and_cutouts?.model_cut_view_id || 'main_view';
                      const isModelCutView = currentView.id === targetModelCutViewId || (!profile.coverage_and_cutouts?.model_cut_view_id && (currentView.is_default || currentView.id === profile.views?.[0]?.id));
                      const modelCutoutUrl = shouldApplyModelCut && isModelCutView
                        ? currentView.model_cut_mask_url || profile.coverage_and_cutouts?.model_cut_mask_url || assets.model_cutout_url
                        : undefined;

                      const hasViewShadow = Boolean(currentView.shadow_png_url || currentView.shading_image_url || currentView.highlight_png_url);
                      const effectiveTextureScale = currentView.texture_scale ?? profile.texture_scale ?? layer.texture_scale ?? 1.0;

                      return (
                        <V2SkinCanvasLayer
                          key={`live-skin-${layer.id}-${currentPreviewFinish.slug}-${currentView.id}`}
                          maskUrl={assets.mask_svg_url}
                          textureUrl={textureToTile}
                          fallbackColor={currentPreviewFinish.color_hex || '#18181b'}
                          logoCutoutUrl={logoCutoutUrl}
                          pencilCutoutUrl={pencilCutoutUrl}
                          modelCutoutUrl={modelCutoutUrl}
                          zIndex={(layer.z_index || 1) + 5}
                          layerName={layer.name}
                          layerGroup={layer.group}
                          isRequired={layer.is_required}
                          textureRotation={layer.texture_rotation ?? 0}
                          textureScale={effectiveTextureScale}
                          hasViewShadow={hasViewShadow}
                          generatedShadowConfig={currentView?.generated_shadow}
                          deviceFamily={profile.family}
                        />
                      );
                    })}

                  {/* 3D Specular and Realistic Shadows */}
                  {shadingSrc && (
                    <>
                      <img
                        src={shadingSrc}
                        alt="Shadow Layer"
                        style={{
                          mixBlendMode: 'multiply',
                          opacity: currentPreviewFinish.shadow_opacity ?? currentView?.shadow_opacity ?? 0.85,
                          zIndex: 20,
                        }}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      />
                      <img
                        src={shadingSrc}
                        alt="Highlight Layer"
                        style={{
                          mixBlendMode: 'screen',
                          opacity: currentPreviewFinish.highlight_opacity ?? currentView?.highlight_opacity ?? 0.35,
                          zIndex: 25,
                        }}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      />
                    </>
                  )}
                </div>
              </div>

              {/* STAGE LAYER 3: TOP BAR OVERLAYS (EXACOAT LOGO & ALL DEVICES PILL) */}
              <div className="absolute top-0 inset-x-0 p-[3.3%] flex items-center justify-between pointer-events-none z-20">
                {/* Exacoat Logo Pill (Top-Left) */}
                <div className="w-[30.7%] h-[9.3%] aspect-[460/140] rounded-[14px] md:rounded-[18px] bg-zinc-950 flex items-center justify-center border border-white/10 shadow-lg">
                  <span className="font-black text-[#f3aa18] text-base md:text-xl tracking-tight flex items-baseline">
                    exacoat
                    <span className="text-[10px] ml-0.5 border border-[#f3aa18] rounded-full w-3 h-3 flex items-center justify-center font-normal scale-90">
                      R
                    </span>
                  </span>
                </div>

                {/* Device Name Pill (Top-Right, e.g. "ALL DEVICES") */}
                <div className="w-[60.7%] h-[9.3%] aspect-[910/140] rounded-[14px] md:rounded-[18px] bg-white border border-zinc-200/90 shadow-md flex items-center justify-center px-4">
                  <span className="font-black text-zinc-950 uppercase tracking-wider text-xs md:text-sm lg:text-base truncate text-center">
                    {deviceNameText || 'ALL DEVICES'}
                  </span>
                </div>
              </div>

              {/* STAGE LAYER 4: LEFT COLUMN (SUB-BADGE & BIG BOLD HEADLINE) */}
              <div
                className="absolute left-[3.3%] top-[42.3%] z-20 flex flex-col items-start pointer-events-none max-w-[42%]"
                style={{ fontFamily: headlineFont === 'Chakra Petch' ? 'Chakra Petch, sans-serif' : headlineFont }}
              >
                {/* Sub-badge Tag */}
                {showSubBadge && subBadgeText && (
                  <div className="mb-2.5 px-3 py-1 rounded-full bg-white border-2 border-zinc-950 shadow-sm">
                    <span className="text-[10px] md:text-xs font-black text-zinc-950 tracking-wide">
                      {subBadgeText}
                    </span>
                  </div>
                )}

                {/* Big Bold Headline */}
                <div className="font-black text-zinc-950 leading-[0.92] tracking-tight uppercase whitespace-pre-line text-2xl md:text-3xl lg:text-4xl drop-shadow-sm">
                  {effectiveHeadline}
                </div>
              </div>

              {/* STAGE LAYER 5: 20+ SKINS SELECTION STACK (RIGHT EDGE) */}
              {showSkinsStack && (
                <div className="absolute right-[3%] top-[34.6%] z-20 flex flex-col items-center gap-2 pointer-events-none w-[7.5%]">
                  {swatchFinishSlugs.slice(0, 2).map((slug, idx) => {
                    const swatchFinish = finishes.find((f) => (f.slug || f.id) === slug);
                    return (
                      <div
                        key={idx}
                        className="w-full aspect-square rounded-[10px] md:rounded-[14px] border-2 border-white shadow-md overflow-hidden bg-zinc-800"
                      >
                        {swatchFinish?.thumbnail ? (
                          <img src={swatchFinish.thumbnail} alt="Swatch" className="w-full h-full object-cover" />
                        ) : (
                          <div
                            className="w-full h-full"
                            style={{ backgroundColor: swatchFinish?.color_hex || '#333' }}
                          />
                        )}
                      </div>
                    );
                  })}
                  <div className="w-full py-1.5 rounded-[10px] md:rounded-[14px] bg-white border-2 border-zinc-200 shadow-md flex flex-col items-center justify-center">
                    <span className="text-[11px] font-black text-zinc-950 leading-none">{skinsCountText}</span>
                    <span className="text-[8px] font-extrabold text-zinc-700 leading-none mt-0.5">{skinsLabelText}</span>
                  </div>
                </div>
              )}

              {/* STAGE LAYER 6: 3 CENTERED FROSTED GLASS FEATURE CARDS (FOREGROUND OVERLAY) */}
              <div className="absolute bottom-[2.5%] inset-x-0 px-[3.3%] z-20 grid grid-cols-3 gap-[1.8%] pointer-events-none">
                {featureCards.slice(0, 3).map((card) => (
                  <div
                    key={card.id}
                    className="aspect-[430/215] rounded-[16px] md:rounded-[22px] backdrop-blur-xl bg-white/90 border border-white/80 shadow-xl p-2 md:p-3 flex flex-col items-center justify-center text-center"
                  >
                    {/* Centered emerald circular icon badge */}
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 mb-1 shrink-0">
                      {renderCardIcon(card.iconType)}
                    </div>

                    {/* Centered Title (all 3 cards share the same heading font size) */}
                    <div className="text-[11px] md:text-[13px] font-black text-zinc-950 uppercase tracking-tight text-center leading-tight line-clamp-2">
                      {card.title}
                    </div>

                    {/* Centered Subtitle */}
                    <div className="text-[8px] md:text-[10px] italic font-medium text-zinc-500 text-center mt-0.5 truncate max-w-full">
                      {card.subtitle}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DOCK BAR: FAST 1-CLICK FINISH SWITCHER */}
            <div className="w-full max-w-[min(620px,calc(100vh-230px))] bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-2.5 flex flex-col gap-2 mt-2 shrink-0 z-20 shadow-xl">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Instant Skin Preview:</span>
                </span>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceScale(1.0);
                      setDeviceOffsetX(0);
                      setDeviceOffsetY(0);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold border border-zinc-700 transition"
                  >
                    <RotateCcw className="w-3 h-3 text-[#f3aa18]" />
                    Hero Shot
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceScale(0.75);
                      setDeviceOffsetX(-40);
                      setDeviceOffsetY(20);
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold border border-zinc-700 transition"
                  >
                    Centered
                  </button>
                </div>
              </div>

              {/* Scrollable Finishes Carousel */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {finishes.map((f) => {
                  const isSelected = (f.id || f.slug) === activePreviewFinishId;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActivePreviewFinishId(f.id || f.slug)}
                      className={clsx(
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0',
                        isSelected
                          ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                          : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      )}
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-black/30 shrink-0"
                        style={{
                          backgroundColor: f.color_hex || '#333',
                          backgroundImage: f.thumbnail ? `url(${f.thumbnail})` : undefined,
                          backgroundSize: 'cover',
                        }}
                      />
                      <span className="truncate max-w-[110px]">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT SECTION: CONTROLS & FINE-TUNING SIDEBAR */}
          <div className="w-full lg:w-[420px] bg-zinc-900 border-t lg:border-t-0 lg:border-l border-zinc-800/80 flex flex-col shrink-0 overflow-hidden">
            {/* Tabs Header */}
            <div className="flex items-center gap-1 border-b border-zinc-800 p-3 bg-zinc-900/90 shrink-0">
              <button
                onClick={() => setActiveTab('template')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition',
                  activeTab === 'template'
                    ? 'bg-zinc-100 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                <Type className="w-3.5 h-3.5" />
                Layout & Copy
              </button>

              <button
                onClick={() => setActiveTab('device')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition',
                  activeTab === 'device'
                    ? 'bg-zinc-100 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Device & View
              </button>

              <button
                onClick={() => setActiveTab('background')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition',
                  activeTab === 'background'
                    ? 'bg-zinc-100 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Background
              </button>

              <button
                onClick={() => setActiveTab('batch')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ml-auto',
                  activeTab === 'batch'
                    ? 'bg-[#f3aa18] text-zinc-950 font-black shadow'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                )}
              >
                <FolderArchive className="w-3.5 h-3.5" />
                Batch ({selectedFinishIds.size})
              </button>
            </div>

            {/* TAB 1: TEMPLATE & COPYWRITING */}
            {activeTab === 'template' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {/* Device Name Badge (Top Right) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-300">Device Name Badge (Top Right)</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDeviceNameText('ALL DEVICES')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      >
                        ALL DEVICES
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeviceNameText(profile.device_name.toUpperCase())}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 truncate max-w-[130px]"
                        title={profile.device_name.toUpperCase()}
                      >
                        {profile.device_name.toUpperCase()}
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={deviceNameText}
                    onChange={(e) => setDeviceNameText(e.target.value)}
                    placeholder="e.g. ALL DEVICES or IPHONE 17 PRO"
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-zinc-800/80 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                  />
                </div>

                {/* Sub-Badge Tag (Above Headline) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-zinc-300">Sub-Badge Tag (Above Headline)</label>
                      <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSubBadge}
                          onChange={(e) => setShowSubBadge(e.target.checked)}
                          className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                        />
                        Show
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSubBadge(true);
                          setSubBadgeText('Model Cut & 360');
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      >
                        Model Cut & 360
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSubBadge(true);
                          setSubBadgeText('Model Cut');
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      >
                        Model Cut
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSubBadge(true);
                          setSubBadgeText('x2 pcs');
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      >
                        x2 pcs
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={subBadgeText}
                    onChange={(e) => setSubBadgeText(e.target.value)}
                    disabled={!showSubBadge}
                    placeholder="e.g. Model Cut & 360, Model Cut, or x2 pcs"
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800/80 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#f3aa18] disabled:opacity-40"
                  />
                </div>

                {/* Product Title Headline */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-300">Product Title (Left Headline)</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-400">Font:</span>
                      <select
                        value={headlineFont}
                        onChange={(e) => setHeadlineFont(e.target.value as any)}
                        className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 border border-zinc-700 text-zinc-200"
                      >
                        <option value="Chakra Petch">Chakra Petch (Image 2)</option>
                        <option value="Plus Jakarta Sans">Plus Jakarta (Modern)</option>
                        <option value="Inter">Inter (Clean)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pb-1">
                    <button
                      type="button"
                      onClick={() => setAutoHeadlineWithFinish(true)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1',
                        autoHeadlineWithFinish
                          ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Auto ({currentPreviewFinish.name} Skins)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoHeadlineWithFinish(false)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-bold border transition',
                        !autoHeadlineWithFinish
                          ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      )}
                    >
                      Custom Text
                    </button>
                  </div>

                  {autoHeadlineWithFinish ? (
                    <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 text-xs space-y-1">
                      <div className="font-bold text-zinc-100 font-mono">
                        {currentPreviewFinish.name}
                        <br />
                        Skins
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Matches Image 2 format. During batch generation, each skin exports with its own finish name automatically.
                      </p>
                    </div>
                  ) : (
                    <textarea
                      rows={3}
                      value={headlineText}
                      onChange={(e) => setHeadlineText(e.target.value)}
                      placeholder="Enter multi-line headline (one per line)"
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-zinc-800/80 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                    />
                  )}
                </div>

                {/* 3 Bottom Feature Cards Controls */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-300">Bottom Feature Cards (3 Cards Row)</label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setFeatureCards(DEFAULT_FEATURE_CARDS_OFFICIAL)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f3aa18]/20 text-[#f3aa18] hover:bg-[#f3aa18]/30"
                      >
                        Official Store
                      </button>
                      <button
                        onClick={() => setFeatureCards(DEFAULT_FEATURE_CARDS_FIT)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      >
                        Accurate Fit
                      </button>
                      <button
                        onClick={() => setFeatureCards(DEFAULT_FEATURE_CARDS_CLEAR)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      >
                        Ark Clear
                      </button>
                    </div>
                  </div>

                  {featureCards.map((card, idx) => (
                    <div
                      key={card.id}
                      className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        <span>Card {idx + 1}</span>
                        <select
                          value={card.iconType}
                          onChange={(e) => {
                            const val = e.target.value as MarketplaceFeatureCard['iconType'];
                            setFeatureCards((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, iconType: val } : c))
                            );
                          }}
                          className="px-2 py-0.5 rounded text-[10px] bg-zinc-700 text-zinc-200 border-none font-medium"
                        >
                          <option value="shield">Shield Check</option>
                          <option value="material">Star / Rosette (3M)</option>
                          <option value="guarantee">Guarantee Shield</option>
                          <option value="fit">Accurate Fit Target</option>
                          <option value="scratch">Scratch Proof Key</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Title (Centered)</label>
                          <input
                            type="text"
                            value={card.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFeatureCards((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, title: val } : c))
                              );
                            }}
                            placeholder="Card Title"
                            className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-700 text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Subtitle (Centered)</label>
                          <input
                            type="text"
                            value={card.subtitle}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFeatureCards((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, subtitle: val } : c))
                              );
                            }}
                            placeholder="Subtitle"
                            className="w-full px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-700 text-zinc-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: DEVICE & VIEW SETTINGS */}
            {activeTab === 'device' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {/* Angle Selector (if multi-angle) */}
                {profile.views.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">Camera Viewing Angle</label>
                    <div className="grid grid-cols-2 gap-2">
                      {profile.views.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedViewId(v.id)}
                          className={clsx(
                            'px-3 py-2 rounded-xl text-xs font-bold border transition text-left',
                            selectedViewId === v.id
                              ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                          )}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hardware Color Selector (if available) */}
                {profile.device_colors && profile.device_colors.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">Hardware Base Color</label>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {profile.device_colors.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setActiveColorId(c.id)}
                          className={clsx(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition shrink-0',
                            activeColorId === c.id
                              ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                          )}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/30"
                            style={{ backgroundColor: c.hex || '#555' }}
                          />
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Skin Layers Toggles */}
                {availableSkinLayers.length > 0 && (
                  <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300">Active Skin Layers in Hero Shot</span>
                      <span className="text-[10px] text-zinc-400">Toggle parts</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSkinLayers.map((layer) => {
                        const isChecked = activeLayerIds.has(layer.id);
                        return (
                          <button
                            key={layer.id}
                            type="button"
                            onClick={() => toggleLayerId(layer.id)}
                            className={clsx(
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition',
                              isChecked
                                ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                            )}
                          >
                            {isChecked ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5" />}
                            <span>{layer.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coverage & Cutout Options */}
                <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-3">
                  <div className="text-xs font-bold text-zinc-300">Coverage & Cutouts</div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                      <input
                        type="radio"
                        name="coverage"
                        checked={coverage === 'model_360'}
                        onChange={() => setCoverage('model_360')}
                        className="text-[#f3aa18] focus:ring-[#f3aa18]"
                      />
                      Model 360 (Full Wrap)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                      <input
                        type="radio"
                        name="coverage"
                        checked={coverage === 'model_cut'}
                        onChange={() => setCoverage('model_cut')}
                        className="text-[#f3aa18] focus:ring-[#f3aa18]"
                      />
                      Model Cut (Back Only)
                    </label>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logoCutout}
                        onChange={(e) => setLogoCutout(e.target.checked)}
                        className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                      />
                      Punch Logo Cutout
                    </label>
                    {profile.coverage_and_cutouts?.has_pencil_cutout && (
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pencilCutout}
                          onChange={(e) => setPencilCutout(e.target.checked)}
                          className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                        />
                        Pencil Cutout
                      </label>
                    )}
                  </div>
                </div>

                {/* Device Position & Scale Fine-Tuning */}
                <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">Device Placement & Zoom</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDeviceScale(1.0);
                        setDeviceOffsetX(0);
                        setDeviceOffsetY(0);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f3aa18]/20 text-[#f3aa18] hover:bg-[#f3aa18]/30 transition"
                    >
                      Reset Hero Shot
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Scale / Zoom</span>
                      <span className="font-mono text-zinc-200">{Math.round(deviceScale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.8"
                      step="0.02"
                      value={deviceScale}
                      onChange={(e) => setDeviceScale(parseFloat(e.target.value))}
                      className="w-full accent-[#f3aa18]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Horizontal X</span>
                        <span className="font-mono text-zinc-200">{deviceOffsetX}px</span>
                      </div>
                      <input
                        type="range"
                        min="-400"
                        max="400"
                        step="5"
                        value={deviceOffsetX}
                        onChange={(e) => setDeviceOffsetX(parseInt(e.target.value, 10))}
                        className="w-full accent-[#f3aa18]"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Vertical Y</span>
                        <span className="font-mono text-zinc-200">{deviceOffsetY}px</span>
                      </div>
                      <input
                        type="range"
                        min="-400"
                        max="400"
                        step="5"
                        value={deviceOffsetY}
                        onChange={(e) => setDeviceOffsetY(parseInt(e.target.value, 10))}
                        className="w-full accent-[#f3aa18]"
                      />
                    </div>
                  </div>
                </div>

                {/* 20+ Skins Swatches Stack Controls */}
                <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-zinc-300">20+ Skins Selection Stack</div>
                      <div className="text-[11px] text-zinc-400">Optional right-edge swatch column</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={showSkinsStack}
                      onChange={(e) => setShowSkinsStack(e.target.checked)}
                      className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                    />
                  </div>

                  {showSkinsStack && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-zinc-400">Count Text</label>
                          <input
                            type="text"
                            value={skinsCountText}
                            onChange={(e) => setSkinsCountText(e.target.value)}
                            className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-700 text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400">Label Text</label>
                          <input
                            type="text"
                            value={skinsLabelText}
                            onChange={(e) => setSkinsLabelText(e.target.value)}
                            className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-700 text-zinc-100"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-zinc-400">Preview Swatches (Top 2)</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[0, 1].map((idx) => (
                            <select
                              key={idx}
                              value={swatchFinishSlugs[idx] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSwatchFinishSlugs((prev) => {
                                  const next = [...prev];
                                  next[idx] = val;
                                  return next;
                                });
                              }}
                              className="w-full px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-700 text-zinc-200"
                            >
                              {finishes.map((f) => (
                                <option key={f.id} value={f.slug || f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: BACKGROUND */}
            {activeTab === 'background' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-300">Select Background Style</label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setBgType('studio_light')}
                      className={clsx(
                        'p-3 rounded-2xl border text-left transition space-y-1.5',
                        bgType === 'studio_light'
                          ? 'bg-[#f3aa18]/15 border-[#f3aa18]'
                          : 'bg-zinc-800/80 border-zinc-700 hover:bg-zinc-750'
                      )}
                    >
                      <div className="w-full h-16 rounded-xl bg-gradient-to-br from-white via-zinc-100 to-zinc-200 border border-zinc-300 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-zinc-400/40" />
                      </div>
                      <div className="font-bold text-xs text-zinc-100">Exacoat Monogram Light</div>
                      <div className="text-[11px] text-zinc-400">Clean studio lighting with brand pattern</div>
                    </button>

                    <button
                      onClick={() => setBgType('custom')}
                      className={clsx(
                        'p-3 rounded-2xl border text-left transition space-y-1.5',
                        bgType === 'custom'
                          ? 'bg-[#f3aa18]/15 border-[#f3aa18]'
                          : 'bg-zinc-800/80 border-zinc-700 hover:bg-zinc-750'
                      )}
                    >
                      <div className="w-full h-16 rounded-xl bg-zinc-950 border border-zinc-700 flex items-center justify-center text-[#f3aa18]">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-xs text-zinc-100">Custom Background</div>
                      <div className="text-[11px] text-zinc-400">Upload JPG/PNG from disk or URL</div>
                    </button>
                  </div>
                </div>

                {bgType === 'custom' && (
                  <div className="p-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700 space-y-3">
                    <div className="text-xs font-bold text-zinc-300">
                      Upload Custom Background (1500x1500px Recommended)
                    </div>

                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer hover:border-[#f3aa18] transition bg-zinc-900/60">
                      <div className="flex flex-col items-center justify-center pt-2 pb-2">
                        <Upload className="w-5 h-5 mb-1 text-zinc-400" />
                        <p className="text-xs font-semibold text-zinc-200">Click to upload background image</p>
                        <p className="text-[10px] text-zinc-500">Saved locally in browser storage</p>
                      </div>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-400">Or paste direct image URL:</label>
                      <input
                        type="text"
                        value={customBgUrl}
                        onChange={(e) => setCustomBgUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-700 text-zinc-100"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: BATCH SELECTION & GENERATION */}
            {activeTab === 'batch' && (
              <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
                <div className="flex items-center justify-between gap-1 shrink-0">
                  <span className="text-xs font-bold text-zinc-300">
                    Select Skins ({selectedFinishIds.size}/{finishes.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSelectPopularFinishes}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#f3aa18]/20 text-[#f3aa18] hover:bg-[#f3aa18]/30 transition"
                    >
                      Popular (13)
                    </button>
                    <button
                      onClick={handleSelectAllFinishes}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                    >
                      All
                    </button>
                    <button
                      onClick={handleClearSelection}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin border border-zinc-800 rounded-xl p-2 bg-zinc-950/60">
                  {finishes.map((f) => {
                    const fid = f.id || f.slug;
                    const isChecked = selectedFinishIds.has(fid);
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleFinishSelection(fid)}
                        className={clsx(
                          'flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition select-none',
                          isChecked
                            ? 'bg-[#f3aa18]/15 text-white font-semibold'
                            : 'hover:bg-zinc-800/60 text-zinc-400'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-5 h-5 rounded-full border border-black/30 shrink-0"
                            style={{
                              backgroundColor: f.color_hex || '#333',
                              backgroundImage: f.thumbnail ? `url(${f.thumbnail})` : undefined,
                              backgroundSize: 'cover',
                            }}
                          />
                          <span className="text-xs">{f.name}</span>
                          {f.group && <span className="text-[10px] text-zinc-500">({f.group})</span>}
                        </div>

                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#f3aa18]" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {isGeneratingBatch && batchProgress && (
                  <div className="p-3 rounded-xl bg-zinc-950 text-white space-y-2 border border-[#f3aa18]/40 shrink-0 shadow-xl">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-[#f3aa18]">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Rendering {batchProgress.current} of {batchProgress.total}
                      </span>
                      <span className="font-mono">
                        {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-[#f3aa18] transition-all duration-200"
                        style={{
                          width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      Current: {batchProgress.finishName}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
