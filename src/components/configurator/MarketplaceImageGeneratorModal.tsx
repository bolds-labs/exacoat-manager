import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../lib/bodyScrollLock';
import type { DeviceConfiguratorProfile } from '../../types';
import type { GlobalFinish } from '../../lib/wordpressBridge';
import {
  MarketplaceFeatureCard,
  MarketplaceImageConfig,
  DEFAULT_FEATURE_CARDS_OFFICIAL,
  DEFAULT_FEATURE_CARDS_TEXTURE,
  DEFAULT_FEATURE_CARDS_FIT,
  DEFAULT_FEATURE_CARDS_CLEAR,
  formatFinishHeadline,
  formatDeviceHeadline,
  renderMarketplaceImageToCanvas,
  generateMarketplaceImageBlob,
  batchGenerateMarketplaceZip,
} from '../../lib/marketplaceCanvasRenderer';
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
  RotateCcw,
  Star,
  Award,
  Smartphone,
  Laptop,
  ChevronDown,
  ChevronUp,
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

  // Preview Canvas State & Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activePreviewFinishId, setActivePreviewFinishId] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);

  // Template State (Layout & Copy)
  // Top right pill now shows Skin Name (e.g. CARBON FIBER BLACK)
  const [topRightText, setTopRightText] = useState<string>('');
  const [deviceNameText, setDeviceNameText] = useState<string>('');
  const [showSubBadge, setShowSubBadge] = useState<boolean>(true);
  const [subBadgeText, setSubBadgeText] = useState<string>('Model Cut & 360');
  const [autoHeadlineWithFinish, setAutoHeadlineWithFinish] = useState<boolean>(true);
  // Headline State
  const [headlineText, setHeadlineText] = useState<string>('');
  const [headlineFont, setHeadlineFont] = useState<'Chakra Petch' | 'Plus Jakarta Sans' | 'Inter'>('Chakra Petch');
  const [headlineHighlightColor, setHeadlineHighlightColor] = useState<string>('#d2d2d2');
  const [featureCards, setFeatureCards] = useState<MarketplaceFeatureCard[]>(DEFAULT_FEATURE_CARDS_OFFICIAL);

  // Brand Tagline under Logo Pill ("#1 Brand Skin di Indonesia")
  const [showBrandTagline, setShowBrandTagline] = useState<boolean>(true);
  const [brandTagline, setBrandTagline] = useState<string>('#1 Brand Skin di Indonesia');

  // Layout Mode: 'cover' (hero close-up 100%, 3 bottom cards, left headline) vs 'variant' (full device 75%, left stacked cards + textured surface, clean bottom)
  const [layoutMode, setLayoutMode] = useState<'cover' | 'variant'>('variant');

  // Primary Listing Cover Image Mode & Settings ("20+ SKINS SELECTION")
  const [isPrimaryCoverMode, setIsPrimaryCoverMode] = useState<boolean>(false);
  const [primarySkinId, setPrimarySkinId] = useState<string>('');
  const [primaryTopRightText, setPrimaryTopRightText] = useState<string>('20+ SKINS SELECTION');
  const [includePrimaryCoverInBatch, setIncludePrimaryCoverInBatch] = useState<boolean>(true);

  // Variant Layout Stacked Left Cards Options
  const [showOriginal3M, setShowOriginal3M] = useState<boolean>(true);
  const [showMaterialOrigin, setShowMaterialOrigin] = useState<boolean>(true);
  const [showWarranty, setShowWarranty] = useState<boolean>(true);
  const [showTexturePhoto, setShowTexturePhoto] = useState<boolean>(true);
  const [texturePhotoUrl, setTexturePhotoUrl] = useState<string>(
    'https://exacoat.com/wp-content/uploads/Textured-Skins-Product-Info.jpg'
  );
  const [batchVariantsLayoutMode, setBatchVariantsLayoutMode] = useState<'variant' | 'cover'>('variant');

  // Background State
  const [bgType, setBgType] = useState<'studio_light' | 'custom'>('studio_light');
  const [customBgUrl, setCustomBgUrl] = useState<string>('');

  // Device & Swatches State (Default zoom 75% for variant, 100% for cover)
  const [activeColorId, setActiveColorId] = useState<string>('');
  const [coverage, setCoverage] = useState<'model_360' | 'model_cut'>('model_360');
  const [logoCutout, setLogoCutout] = useState<boolean>(true);
  const [pencilCutout, setPencilCutout] = useState<boolean>(true);
  const [showCoverageSection, setShowCoverageSection] = useState<boolean>(false);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [deviceScale, setDeviceScale] = useState<number>(1.0);
  const [deviceOffsetX, setDeviceOffsetX] = useState<number>(0);
  const [deviceOffsetY, setDeviceOffsetY] = useState<number>(110);
  const [activeLayerIds, setActiveLayerIds] = useState<Set<string>>(new Set());

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

    // Top-right pill defaults to active finish name
    setTopRightText('');
    setDeviceNameText(profile.device_name);

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
      setHeadlineText(formatDeviceHeadline(profile.device_name));
      setFeatureCards(DEFAULT_FEATURE_CARDS_OFFICIAL);
    }

    setShowSubBadge(true);

    const defaultCoverage = profile.coverage_and_cutouts?.has_model_cut ? 'model_cut' : 'model_360';
    setCoverage(defaultCoverage);
    setLogoCutout(profile.coverage_and_cutouts?.has_logo_cutout ?? true);
    setPencilCutout(Boolean(profile.coverage_and_cutouts?.has_pencil_cutout));

    // Reset device offsets based on layout mode (variant: 75% zoom, Y = -15px; cover: 100% zoom, Y = 110px)
    if (layoutMode === 'cover') {
      setDeviceScale(1.0);
      setDeviceOffsetX(0);
      setDeviceOffsetY(110);
    } else {
      setDeviceScale(0.75);
      setDeviceOffsetX(0);
      setDeviceOffsetY(-15);
    }

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

    // Load custom background and bg style from storage if previously saved
    try {
      const savedBg = localStorage.getItem(STORAGE_CUSTOM_BG_KEY);
      const savedBgType = localStorage.getItem('exacoat_marketplace_bg_type');
      if (savedBg) {
        setCustomBgUrl(savedBg);
      }
      if (savedBgType === 'custom' || (savedBg && !savedBgType)) {
        setBgType('custom');
      }
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

  // Set default preview finish and primary cover finish once finishes load
  useEffect(() => {
    if (!activePreviewFinishId && finishes.length > 0) {
      const firstInStock = finishes.find((f) => f.in_stock !== false) || finishes[0];
      setActivePreviewFinishId(firstInStock.id || firstInStock.slug);
    }
    if (!primarySkinId && finishes.length > 0) {
      const darkFinish = finishes.find((f) => {
        const s = (f.slug || f.name || '').toLowerCase();
        return s.includes('black-camo') || s.includes('camo') || s.includes('swarm') || s.includes('carbon');
      }) || finishes[0];
      if (darkFinish) {
        setPrimarySkinId(darkFinish.id || darkFinish.slug);
      }
    }
  }, [finishes, activePreviewFinishId, primarySkinId]);

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

  // Primary Cover Finish object (used when previewing or generating primary listing cover)
  const primaryCoverFinish = useMemo(() => {
    return (
      finishes.find((f) => (f.id || f.slug) === primarySkinId) ||
      currentPreviewFinish
    );
  }, [finishes, primarySkinId, currentPreviewFinish]);

  // The actual finish rendered on the live canvas
  const activeRenderFinish = isPrimaryCoverMode ? primaryCoverFinish : currentPreviewFinish;

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

  // Effective Headline (Product / Device Name)
  const effectiveHeadline = useMemo(() => {
    const defaultTitle = formatDeviceHeadline(profile?.device_name || '');
    if (autoHeadlineWithFinish) {
      return defaultTitle;
    }
    return headlineText.trim() ? headlineText : defaultTitle;
  }, [autoHeadlineWithFinish, profile?.device_name, headlineText]);

  // Effective Top-Right Pill Text (Skin Name or '20+ SKINS SELECTION')
  const effectiveTopRightText = useMemo(() => {
    if (isPrimaryCoverMode) {
      return (primaryTopRightText || '20+ SKINS SELECTION').trim().toUpperCase();
    }
    if (topRightText.trim()) return topRightText.trim().toUpperCase();
    return (currentPreviewFinish?.name || '').toUpperCase();
  }, [isPrimaryCoverMode, primaryTopRightText, topRightText, currentPreviewFinish?.name]);

  // Build config object for export
  const buildRenderConfig = (): MarketplaceImageConfig | null => {
    if (!profile || !activeRenderFinish) return null;
    return {
      profile,
      activeFinish: activeRenderFinish,
      allFinishes: finishes,
      activeColorId,
      bgType,
      customBgUrl,
      showLogo: true,
      brandTagline,
      showBrandTagline,
      isPrimaryImage: isPrimaryCoverMode,
      topRightText: effectiveTopRightText,
      deviceNameText: profile.device_name,
      subBadgeText: showSubBadge ? subBadgeText : '',
      headlineText: effectiveHeadline,
      headlineFont,
      autoHeadlineWithFinish,
      headlineHighlightColor,
      featureCards,
      layoutMode,
      variantLeftCards: {
        showOriginal3M,
        showMaterialOrigin,
        showWarranty,
        showTexturePhoto,
        texturePhotoUrl,
        warrantyTitle: 'Installation Warranty',
      },
      showSkinsStack: false,
      skinsCountText: '20+',
      skinsLabelText: 'SKINS',
      swatchFinishSlugs: [],
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

  // Synchronize master preview on live HTML5 Canvas
  useEffect(() => {
    if (!isOpen || !profile || !activeRenderFinish) return;
    let isCancelled = false;

    const renderConfig = buildRenderConfig();
    if (!renderConfig) return;

    setIsRenderingPreview(true);
    const timer = setTimeout(async () => {
      if (isCancelled || !canvasRef.current) return;
      try {
        await renderMarketplaceImageToCanvas(canvasRef.current, renderConfig);
      } catch (err) {
        console.error('[Marketplace Generator] Canvas preview render error:', err);
      } finally {
        if (!isCancelled) setIsRenderingPreview(false);
      }
    }, 60);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    profile,
    activeRenderFinish,
    activeColorId,
    selectedViewId,
    coverage,
    logoCutout,
    pencilCutout,
    deviceScale,
    deviceOffsetX,
    deviceOffsetY,
    activeLayerIds,
    deviceNameText,
    showSubBadge,
    subBadgeText,
    effectiveHeadline,
    headlineFont,
    headlineHighlightColor,
    featureCards,
    layoutMode,
    showOriginal3M,
    showMaterialOrigin,
    showWarranty,
    showTexturePhoto,
    texturePhotoUrl,
    isPrimaryCoverMode,
    primaryTopRightText,
    effectiveTopRightText,
    showBrandTagline,
    brandTagline,
    bgType,
    customBgUrl,
  ]);

  // Single Image Download (1500x1500px JPEG)
  const handleDownloadSingleImage = async () => {
    const config = buildRenderConfig();
    if (!config || !profile || !activeRenderFinish) return;

    try {
      setIsDownloadingSingle(true);
      let blob: Blob | null = null;

      if (canvasRef.current) {
        blob = await new Promise<Blob | null>((resolve) => {
          try {
            canvasRef.current?.toBlob(
              (b) => resolve(b),
              'image/jpeg',
              0.95
            );
          } catch {
            resolve(null);
          }
        });
      }

      if (!blob) {
        blob = await generateMarketplaceImageBlob(config);
      }

      if (!blob) throw new Error('Blob export failed');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = isPrimaryCoverMode
        ? `${profile.device_slug || 'device'}_00_PRIMARY_COVER_20_SKINS_1500x1500.jpg`
        : `${profile.device_slug || 'device'}_${activeRenderFinish.slug || activeRenderFinish.id}_1500x1500.jpg`;
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
      const totalCount = targetFinishes.length + (includePrimaryCoverInBatch ? 1 : 0);
      setBatchProgress({ current: 0, total: totalCount, finishName: 'Initializing...' });

      const chosenPrimary = finishes.find((f) => (f.id || f.slug) === primarySkinId) || targetFinishes[0];
      const zipBlob = await batchGenerateMarketplaceZip(
        baseConfig,
        targetFinishes,
        {
          includePrimaryCover: includePrimaryCoverInBatch,
          primaryFinish: chosenPrimary,
          primaryTopRightText: primaryTopRightText || '20+ SKINS SELECTION',
          variantsLayoutMode: batchVariantsLayoutMode,
        },
        (current, total, finishName) => {
          setBatchProgress({ current, total, finishName });
        }
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      const zipName = `exacoat-marketplace-${profile.device_slug || 'device'}-${totalCount}-images.zip`;
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('success', 'Batch Completed', `Exported ${totalCount} high-res marketplace images to ${zipName}`);
    } catch (err) {
      console.error('[Marketplace Generator] Batch export error:', err);
      showToast('error', 'Batch Export Failed', 'Failed to generate batch zip archive');
    } finally {
      setIsGeneratingBatch(false);
      setBatchProgress(null);
    }
  };

  // Save current selection and background as default in localStorage
  const handleSaveDefaults = () => {
    try {
      const list = Array.from(selectedFinishIds);
      localStorage.setItem(STORAGE_DEFAULT_SKINS_KEY, JSON.stringify(list));
      localStorage.setItem(STORAGE_CUSTOM_BG_KEY, customBgUrl || '');
      localStorage.setItem('exacoat_marketplace_bg_type', bgType);
      showToast('success', 'Defaults Saved', `Saved ${list.length} finishes and background settings as default.`);
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
            {isDownloadingSingle
              ? 'Rendering...'
              : isPrimaryCoverMode
              ? 'Download Cover (20+ Skins)'
              : 'Download Current Skin (JPG)'}
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

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPrimaryCoverMode(false)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition',
                    !isPrimaryCoverMode
                      ? 'bg-[#f3aa18]/20 border border-[#f3aa18] text-[#f3aa18]'
                      : 'bg-zinc-900 border border-white/10 text-zinc-400 hover:text-zinc-200'
                  )}
                  title="Preview active skin variant"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Variant ({currentPreviewFinish.name})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrimaryCoverMode(true)}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition',
                    isPrimaryCoverMode
                      ? 'bg-[#f3aa18] text-black font-extrabold shadow'
                      : 'bg-zinc-900 border border-white/10 text-zinc-400 hover:text-zinc-200'
                  )}
                  title="Preview primary listing cover with '20+ SKINS SELECTION'"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>Cover (20+ Skins)</span>
                </button>
              </div>
            </div>

            {/* 1:1 ASPECT RATIO MASTER CANVAS PREVIEW STAGE */}
            <div className="w-full max-w-[min(620px,calc(100vh-230px))] aspect-square relative rounded-3xl overflow-hidden shadow-2xl border border-white/15 select-none bg-zinc-900 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={1500}
                height={1500}
                className="w-full h-full object-contain"
              />

              {isRenderingPreview && (
                <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px] flex items-center justify-center z-30 transition-opacity">
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-xs font-semibold text-zinc-200 shadow-xl">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#f3aa18]" />
                    <span>Rendering canvas preview...</span>
                  </div>
                </div>
              )}
            </div>

            {/* DOCK BAR: FAST 1-CLICK FINISH SWITCHER */}
            <div className="w-full max-w-[min(620px,calc(100vh-230px))] bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-white/10 p-2.5 flex flex-col gap-2 mt-2 shrink-0 z-20 shadow-xl">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>{isPrimaryCoverMode ? 'Select Hero Skin for Cover:' : 'Instant Skin Preview:'}</span>
                </span>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutMode('cover');
                      setIsPrimaryCoverMode(true);
                      setDeviceScale(1.0);
                      setDeviceOffsetX(0);
                      setDeviceOffsetY(110);
                    }}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition',
                      layoutMode === 'cover'
                        ? 'bg-[#f3aa18]/25 border-[#f3aa18] text-[#f3aa18]'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    )}
                  >
                    <Smartphone className="w-3 h-3 text-[#f3aa18]" />
                    Cover Shot (100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutMode('variant');
                      setIsPrimaryCoverMode(false);
                      setDeviceScale(0.75);
                      setDeviceOffsetX(0);
                      setDeviceOffsetY(-15);
                    }}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition',
                      layoutMode === 'variant'
                        ? 'bg-[#f3aa18]/25 border-[#f3aa18] text-[#f3aa18]'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    )}
                  >
                    <Smartphone className="w-3 h-3 text-[#f3aa18]" />
                    Variant Shot (75%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeviceScale(1.0);
                      setDeviceOffsetX(140);
                      setDeviceOffsetY(-55);
                    }}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition',
                      deviceScale === 1.0 && deviceOffsetX === 140 && deviceOffsetY === -55
                        ? 'bg-[#f3aa18]/25 border-[#f3aa18] text-[#f3aa18]'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    )}
                  >
                    <Laptop className="w-3 h-3 text-[#f3aa18]" />
                    Laptop
                  </button>
                </div>
              </div>

              {/* Scrollable Finishes Carousel */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {finishes.map((f) => {
                  const finishId = f.id || f.slug;
                  const isSelected = isPrimaryCoverMode
                    ? finishId === primarySkinId
                    : finishId === activePreviewFinishId;
                  const isPrimary = finishId === primarySkinId;

                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        if (isPrimaryCoverMode) {
                          setPrimarySkinId(finishId);
                        } else {
                          setActivePreviewFinishId(finishId);
                          if (layoutMode === 'cover') {
                            setLayoutMode('variant');
                            setDeviceScale(0.75);
                            setDeviceOffsetX(0);
                            setDeviceOffsetY(-15);
                          }
                        }
                      }}
                      className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0',
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
                      {isPrimary && (
                        <Star className="w-3 h-3 text-[#f3aa18] fill-[#f3aa18]" />
                      )}
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
                {/* Template Layout Selector (Cover vs Variant) */}
                <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">Listing Template Layout</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {layoutMode === 'cover' ? 'Hero Close-Up (100%)' : 'Full Device (75%)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLayoutMode('cover');
                        setIsPrimaryCoverMode(true);
                        setDeviceScale(1.0);
                        setDeviceOffsetX(0);
                        setDeviceOffsetY(110);
                      }}
                      className={clsx(
                        'p-2.5 rounded-xl border text-left transition space-y-1',
                        layoutMode === 'cover'
                          ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                          : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Star className="w-3.5 h-3.5" />
                        <span>Cover Layout</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        100% Zoom, 3 bottom glass cards, large headline & 20+ Skins title
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLayoutMode('variant');
                        setIsPrimaryCoverMode(false);
                        setDeviceScale(0.75);
                        setDeviceOffsetX(0);
                        setDeviceOffsetY(-15);
                      }}
                      className={clsx(
                        'p-2.5 rounded-xl border text-left transition space-y-1',
                        layoutMode === 'variant'
                          ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                          : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Variant Layout</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-tight">
                        75% Zoom, stacked left trust cards + Textured Surface photo
                      </p>
                    </button>
                  </div>
                </div>

                {/* Variant Mode: Left Column Trust Stack & Texture Photo Controls */}
                {layoutMode === 'variant' && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-zinc-800/80 to-zinc-800/80 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#f3aa18]" />
                        <span className="text-xs font-bold text-zinc-100">Left Column: Trust Stack & Texture</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowOriginal3M(true);
                            setShowMaterialOrigin(true);
                            setShowWarranty(true);
                            setShowTexturePhoto(true);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f3aa18]/20 text-[#f3aa18] hover:bg-[#f3aa18]/30"
                        >
                          Full Stack (4)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowOriginal3M(false);
                            setShowMaterialOrigin(false);
                            setShowWarranty(false);
                            setShowTexturePhoto(true);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        >
                          Texture Only
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowOriginal3M(true);
                            setShowMaterialOrigin(true);
                            setShowWarranty(true);
                            setShowTexturePhoto(false);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        >
                          3 Trust Only
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-400">
                      Replaces bottom cards with vertical stacked frosted glass cards on the left, keeping the full 75% device view unobstructed.
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                      <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showOriginal3M}
                          onChange={(e) => setShowOriginal3M(e.target.checked)}
                          className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                        />
                        <span>100% Original</span>
                      </label>
                      <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showMaterialOrigin}
                          onChange={(e) => setShowMaterialOrigin(e.target.checked)}
                          className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                        />
                        <span>3M Material</span>
                      </label>
                      <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showWarranty}
                          onChange={(e) => setShowWarranty(e.target.checked)}
                          className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                        />
                        <span>Warranty</span>
                      </label>
                      <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showTexturePhoto}
                          onChange={(e) => setShowTexturePhoto(e.target.checked)}
                          className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                        />
                        <span>Textured Surface</span>
                      </label>
                    </div>

                    {showTexturePhoto && (
                      <div className="space-y-1.5 pt-1 border-t border-zinc-700/60">
                        <div className="flex items-center justify-between text-[11px] text-zinc-300 font-semibold">
                          <span>Textured Surface Macro Image URL:</span>
                          <button
                            type="button"
                            onClick={() =>
                              setTexturePhotoUrl('https://exacoat.com/wp-content/uploads/Textured-Skins-Product-Info.jpg')
                            }
                            className="text-[10px] text-[#f3aa18] hover:underline"
                          >
                            Reset Official URL
                          </button>
                        </div>
                        <input
                          type="text"
                          value={texturePhotoUrl}
                          onChange={(e) => setTexturePhotoUrl(e.target.value)}
                          placeholder="https://exacoat.com/wp-content/uploads/Textured-Skins-Product-Info.jpg"
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                        />
                        <p className="text-[10px] text-zinc-500">
                          Preloaded with Exacoat official textured surface photo.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Device Name Badge (Top Right) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-300">Skin Name Badge (Top Right Rectangle)</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTopRightText('20+ SKINS SELECTION')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f3aa18]/20 text-[#f3aa18] hover:bg-[#f3aa18]/30"
                      >
                        20+ SKINS SELECTION
                      </button>
                      <button
                        type="button"
                        onClick={() => setTopRightText('')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 truncate max-w-[130px]"
                        title={currentPreviewFinish.name.toUpperCase()}
                      >
                        Auto ({currentPreviewFinish.name.toUpperCase()})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTopRightText('ALL DEVICES')}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      >
                        ALL DEVICES
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={topRightText}
                    onChange={(e) => setTopRightText(e.target.value)}
                    placeholder={`e.g. ${currentPreviewFinish.name.toUpperCase()}`}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-zinc-800/80 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Displays in the top-right rounded rectangle. In Cover Mode, it renders <b>20+ SKINS SELECTION</b>.
                  </p>
                </div>

                {/* Primary Listing Cover Settings Box */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-zinc-800/80 to-zinc-800/80 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-[#f3aa18]" />
                      <span className="text-xs font-bold text-zinc-100">Primary Product Cover Image</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPrimaryCoverMode(!isPrimaryCoverMode)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1',
                        isPrimaryCoverMode
                          ? 'bg-[#f3aa18] text-black font-extrabold shadow'
                          : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white'
                      )}
                    >
                      {isPrimaryCoverMode ? 'Viewing Cover Mode' : 'Preview Cover Mode'}
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-400">
                    Generates the marketplace main cover image featuring <b>20+ SKINS SELECTION</b> in the top-right box and your chosen hero skin.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-300">Default Hero Skin</label>
                      <select
                        value={primarySkinId}
                        onChange={(e) => setPrimarySkinId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-[#f3aa18]"
                      >
                        {finishes.map((f) => (
                          <option key={f.id || f.slug} value={f.id || f.slug}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-zinc-300">Cover Top-Right Text</label>
                      <input
                        type="text"
                        value={primaryTopRightText}
                        onChange={(e) => setPrimaryTopRightText(e.target.value)}
                        placeholder="20+ SKINS SELECTION"
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 text-xs font-medium text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includePrimaryCoverInBatch}
                      onChange={(e) => setIncludePrimaryCoverInBatch(e.target.checked)}
                      className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                    />
                    <span>Include Primary Cover Image in Batch ZIP export (<code>00_PRIMARY_COVER_...jpg</code>)</span>
                  </label>
                </div>

                {/* Brand Tagline under Logo */}
                <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-[#f3aa18]" />
                      <label className="text-xs font-bold text-zinc-300">Brand Tagline (Under Logo)</label>
                    </div>
                    <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBrandTagline}
                        onChange={(e) => setShowBrandTagline(e.target.checked)}
                        className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                      />
                      Show
                    </label>
                  </div>
                  <input
                    type="text"
                    value={brandTagline}
                    onChange={(e) => setBrandTagline(e.target.value)}
                    disabled={!showBrandTagline}
                    placeholder="#1 Brand Skin di Indonesia"
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-[#f3aa18] disabled:opacity-40"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Minimalist luxury capsule rendered directly beneath the Exacoat logo.
                  </p>
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
                  <p className="text-[11px] text-zinc-400">
                    Rendered as a full-rounded capsule with transparent background (no fill).
                  </p>
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

                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
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
                        Auto ({profile.device_name})
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

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-400 font-bold">Highlight:</span>
                      {[
                        { label: 'Silver', color: '#d2d2d2' },
                        { label: 'White', color: '#ffffff' },
                        { label: 'Gold', color: '#f3aa18' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() => setHeadlineHighlightColor(preset.color)}
                          className={clsx(
                            'px-1.5 py-0.5 rounded text-[10px] font-bold border transition',
                            headlineHighlightColor.toLowerCase() === preset.color.toLowerCase()
                              ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {autoHeadlineWithFinish ? (
                    <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 text-xs space-y-1">
                      <div className="font-bold text-zinc-100 font-mono whitespace-pre-line text-sm">
                        {formatDeviceHeadline(profile.device_name)}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Product name rendered bold with <b>{headlineHighlightColor}</b> highlight outline for crisp legibility over the phone body.
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
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <label className="text-xs font-bold text-zinc-300">Bottom Feature Cards (3 Cards Row)</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => setFeatureCards(DEFAULT_FEATURE_CARDS_OFFICIAL)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f3aa18]/20 text-[#f3aa18] hover:bg-[#f3aa18]/30"
                      >
                        Official Store
                      </button>
                      <button
                        onClick={() => setFeatureCards(DEFAULT_FEATURE_CARDS_TEXTURE)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#10b981]/20 text-[#10b981] hover:bg-[#10b981]/30"
                        title="Features Textured Surface macro photo banner card"
                      >
                        Textured (Image 3)
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
                      className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-2.5"
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
                          <option value="texture">Tactile Texture (Image 3)</option>
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
                            value={card.subtitle || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFeatureCards((prev) =>
                                prev.map((c, i) => (i === idx ? { ...c, subtitle: val } : c))
                              );
                            }}
                            placeholder="Subtitle (Optional for Photo Card)"
                            className="w-full px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-700 text-zinc-300"
                          />
                        </div>
                      </div>

                      {/* Photo Banner Input (Image 3 style) */}
                      <div className="pt-1.5 border-t border-zinc-700/60">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-semibold text-zinc-300">Macro Photo Banner (Image 3)</label>
                          {card.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => {
                                setFeatureCards((prev) =>
                                  prev.map((c, i) => (i === idx ? { ...c, imageUrl: undefined } : c))
                                );
                              }}
                              className="text-[10px] font-bold text-red-400 hover:underline"
                            >
                              Remove Photo
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setFeatureCards((prev) =>
                                  prev.map((c, i) =>
                                    i === idx
                                      ? {
                                          ...c,
                                          title: c.title || 'Textured Surface',
                                          iconType: 'texture',
                                          imageUrl: 'https://exacoat.com/wp-content/uploads/Textured-Skins-Product-Info.jpg',
                                        }
                                      : c
                                  )
                                );
                              }}
                              className="text-[10px] font-bold text-[#10b981] hover:underline"
                            >
                              + Use Textured Skins Photo
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={card.imageUrl || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFeatureCards((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, imageUrl: val.trim() || undefined } : c))
                            );
                          }}
                          placeholder="e.g. https://exacoat.com/wp-content/uploads/Textured-Skins-Product-Info.jpg"
                          className="w-full px-2 py-1 rounded-lg text-xs bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[11px]"
                        />
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

                {/* Coverage & Cutout Options (Collapsible) */}
                <div className="rounded-xl bg-zinc-800/80 border border-zinc-700/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowCoverageSection(!showCoverageSection)}
                    className="w-full flex items-center justify-between p-3 hover:bg-zinc-750 transition text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-300">Coverage & Cutouts</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 font-mono">
                        {coverage === 'model_360' ? '360° Wrap' : 'Back Cut'}{logoCutout ? ' • Logo' : ''}
                      </span>
                    </div>
                    {showCoverageSection ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>

                  {showCoverageSection && (
                    <div className="p-3 pt-0 space-y-3 border-t border-zinc-700/60">
                      <div className="flex items-center gap-4 pt-2">
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
                  )}
                </div>

                {/* Device Position & Scale Fine-Tuning */}
                <div className="p-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">Device Placement & Zoom</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDeviceScale(1.0);
                          setDeviceOffsetX(0);
                          setDeviceOffsetY(110);
                        }}
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition',
                          deviceScale === 1.0 && deviceOffsetX === 0 && deviceOffsetY === 110
                            ? 'bg-[#f3aa18]/25 border-[#f3aa18] text-[#f3aa18]'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                        )}
                      >
                        <Smartphone className="w-3 h-3 text-[#f3aa18]" />
                        Phone
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeviceScale(1.0);
                          setDeviceOffsetX(140);
                          setDeviceOffsetY(-55);
                        }}
                        className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition',
                          deviceScale === 1.0 && deviceOffsetX === 140 && deviceOffsetY === -55
                            ? 'bg-[#f3aa18]/25 border-[#f3aa18] text-[#f3aa18]'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                        )}
                      >
                        <Laptop className="w-3 h-3 text-[#f3aa18]" />
                        Laptop
                      </button>
                    </div>
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

                <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
                  <span className="text-[11px] text-zinc-400">Remember background style for all sessions</span>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.setItem(STORAGE_CUSTOM_BG_KEY, customBgUrl || '');
                        localStorage.setItem('exacoat_marketplace_bg_type', bgType);
                        showToast('success', 'Background Saved', 'Default background saved to browser storage.');
                      } catch {
                        showToast('error', 'Error', 'Failed to save background to browser storage.');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-[#f3aa18]" />
                    Save as Default Background
                  </button>
                </div>
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

                {/* Batch Export Layout Options */}
                <div className="p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/80 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">Variant Images Layout in ZIP</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {batchVariantsLayoutMode === 'variant' ? '75% Zoom + Left Trust' : '100% Zoom + Bottom Cards'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setBatchVariantsLayoutMode('variant')}
                      className={clsx(
                        'p-2 rounded-lg border text-left transition font-semibold text-[11px]',
                        batchVariantsLayoutMode === 'variant'
                          ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                      )}
                    >
                      <div>Variant Shot (75%)</div>
                      <div className="text-[10px] text-zinc-400 font-normal">Full device + Left Trust Stack</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBatchVariantsLayoutMode('cover')}
                      className={clsx(
                        'p-2 rounded-lg border text-left transition font-semibold text-[11px]',
                        batchVariantsLayoutMode === 'cover'
                          ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                      )}
                    >
                      <div>Cover Shot (100%)</div>
                      <div className="text-[10px] text-zinc-400 font-normal">Hero close-up + Bottom Cards</div>
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
