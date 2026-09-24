import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import type { DeviceConfiguratorProfile } from '../../types';
import type { GlobalFinish } from '../../lib/wordpressBridge';
import {
  MarketplaceFeatureCard,
  MarketplaceImageConfig,
  DEFAULT_FEATURE_CARDS_VINYL,
  DEFAULT_FEATURE_CARDS_CLEAR,
  renderMarketplaceImageToCanvas,
  generateMarketplaceImageBlob,
  batchGenerateMarketplaceZip,
} from '../../lib/marketplaceCanvasRenderer';
import { useToast } from '../../context/ToastContext';
import {
  Download,
  Image as ImageIcon,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  RefreshCw,
  Upload,
  Palette,
  Type,
  Layers,
  Sliders,
  Eye,
  SlidersHorizontal,
  Bookmark,
  ShieldCheck,
  Maximize2,
  FolderArchive,
  ArrowRight,
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'template' | 'device' | 'background' | 'batch'>('template');

  // Preview State
  const [activePreviewFinishId, setActivePreviewFinishId] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);

  // Template State
  const [deviceNameText, setDeviceNameText] = useState<string>('');
  const [subBadgeText, setSubBadgeText] = useState<string>('x2 pcs');
  const [headlineText, setHeadlineText] = useState<string>('Ark\nInvisible\nSkin');
  const [headlineFont, setHeadlineFont] = useState<'Chakra Petch' | 'Plus Jakarta Sans' | 'Inter'>('Chakra Petch');
  const [featureCards, setFeatureCards] = useState<MarketplaceFeatureCard[]>(DEFAULT_FEATURE_CARDS_VINYL);

  // Background State
  const [bgType, setBgType] = useState<'studio_light' | 'custom'>('studio_light');
  const [customBgUrl, setCustomBgUrl] = useState<string>('');

  // Device & Swatches State
  const [coverage, setCoverage] = useState<'model_360' | 'model_cut'>('model_360');
  const [logoCutout, setLogoCutout] = useState<boolean>(true);
  const [pencilCutout, setPencilCutout] = useState<boolean>(true);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [deviceScale, setDeviceScale] = useState<number>(1.0);
  const [deviceOffsetX, setDeviceOffsetX] = useState<number>(0);
  const [deviceOffsetY, setDeviceOffsetY] = useState<number>(0);

  // 20+ Skins Swatches
  const [showSkinsStack, setShowSkinsStack] = useState<boolean>(true);
  const [skinsCountText, setSkinsCountText] = useState<string>('20+');
  const [skinsLabelText, setSkinsLabelText] = useState<string>('SKINS');
  const [swatchFinishSlugs, setSwatchFinishSlugs] = useState<string[]>(['black-camo', 'forged-carbon']);

  // Batch Generation State
  const [selectedFinishIds, setSelectedFinishIds] = useState<Set<string>>(new Set());
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; finishName: string } | null>(null);

  // Initialize fields when profile changes
  useEffect(() => {
    if (!profile) return;

    setDeviceNameText(profile.device_name.toUpperCase());
    const defaultView = profile.views.find((v) => v.is_default) || profile.views[0];
    if (defaultView) {
      setSelectedViewId(defaultView.id);
    }

    const hasClearSkin = profile.category?.toLowerCase().includes('ark') || profile.device_slug?.toLowerCase().includes('ark');
    if (hasClearSkin) {
      setHeadlineText('Ark\nInvisible\nSkin');
      setSubBadgeText('x2 pcs');
      setFeatureCards(DEFAULT_FEATURE_CARDS_CLEAR);
    } else {
      setHeadlineText('Ultra\nPrecision\nSkin');
      setSubBadgeText('#1 Skin di Indonesia');
      setFeatureCards(DEFAULT_FEATURE_CARDS_VINYL);
    }

    const defaultCoverage = profile.coverage_and_cutouts?.has_model_cut ? 'model_cut' : 'model_360';
    setCoverage(defaultCoverage);
    setLogoCutout(profile.coverage_and_cutouts?.has_logo_cutout ?? true);
    setPencilCutout(Boolean(profile.coverage_and_cutouts?.has_pencil_cutout));

    // Load custom background from storage if previously saved
    try {
      const savedBg = localStorage.getItem(STORAGE_CUSTOM_BG_KEY);
      if (savedBg) {
        setCustomBgUrl(savedBg);
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

  // Render composite to preview canvas
  useEffect(() => {
    if (!isOpen || !profile || !canvasRef.current || !currentPreviewFinish) return;

    let isCancelled = false;
    setIsRenderingPreview(true);

    const renderConfig: MarketplaceImageConfig = {
      profile,
      activeFinish: currentPreviewFinish,
      allFinishes: finishes,
      bgType,
      customBgUrl,
      showLogo: true,
      deviceNameText,
      subBadgeText,
      headlineText,
      headlineFont,
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
    };

    const timer = setTimeout(async () => {
      if (isCancelled || !canvasRef.current) return;
      try {
        await renderMarketplaceImageToCanvas(canvasRef.current, renderConfig);
      } catch (err) {
        console.error('[Marketplace Generator] Preview render error:', err);
      } finally {
        if (!isCancelled) setIsRenderingPreview(false);
      }
    }, 120);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    profile,
    currentPreviewFinish,
    finishes,
    bgType,
    customBgUrl,
    deviceNameText,
    subBadgeText,
    headlineText,
    headlineFont,
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
  ]);

  // Single Image Download
  const handleDownloadSingleImage = async () => {
    if (!profile || !currentPreviewFinish || !canvasRef.current) return;
    try {
      setIsDownloadingSingle(true);
      const renderConfig: MarketplaceImageConfig = {
        profile,
        activeFinish: currentPreviewFinish,
        allFinishes: finishes,
        bgType,
        customBgUrl,
        showLogo: true,
        deviceNameText,
        subBadgeText,
        headlineText,
        headlineFont,
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
      };

      const blob = await generateMarketplaceImageBlob(renderConfig);
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
    if (!profile || selectedFinishIds.size === 0) {
      showToast('warning', 'No Skins Selected', 'Please check at least 1 skin to generate batch images');
      return;
    }

    const targetFinishes = finishes.filter((f) => selectedFinishIds.has(f.id || f.slug));
    if (targetFinishes.length === 0) return;

    try {
      setIsGeneratingBatch(true);
      setBatchProgress({ current: 0, total: targetFinishes.length, finishName: 'Initializing...' });

      const baseConfig: MarketplaceImageConfig = {
        profile,
        activeFinish: targetFinishes[0],
        allFinishes: finishes,
        bgType,
        customBgUrl,
        showLogo: true,
        deviceNameText,
        subBadgeText,
        headlineText,
        headlineFont,
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
      };

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
    } catch (e) {
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

  // Select all finishes
  const handleSelectAllFinishes = () => {
    const all = new Set(finishes.map((f) => f.id || f.slug));
    setSelectedFinishIds(all);
  };

  // Select top popular finishes
  const handleSelectPopularFinishes = () => {
    const popularSlugs = [
      'swarm',
      'black-camo',
      'forged-carbon',
      'carbon-fiber-black',
      'slate',
      'woven',
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

  if (!profile) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="7xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18]">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Marketplace Image Generator</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30">
                1500 × 1500 px
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Batch create square marketplace listing product images for {profile.device_name}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
              title="Save current skin list and settings as your default"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#f3aa18]" />
              Save Defaults
            </button>
            <span className="text-xs text-zinc-400">
              {selectedFinishIds.size} of {finishes.length} skins selected for batch export
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadSingleImage}
              disabled={isDownloadingSingle || isRenderingPreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Download This Skin (JPG)
            </button>

            <button
              onClick={handleBatchGenerateZip}
              disabled={isGeneratingBatch || selectedFinishIds.size === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-zinc-950 bg-[#f3aa18] hover:bg-[#e09b15] shadow-lg shadow-[#f3aa18]/20 transition disabled:opacity-50"
            >
              {isGeneratingBatch ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating ({batchProgress?.current}/{batchProgress?.total})...
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4" />
                  Generate All ({selectedFinishIds.size} Images) as ZIP
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[660px]">
        {/* LEFT COLUMN: LIVE CANVAS PREVIEW (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Main 1:1 Canvas Stage */}
          <div className="relative aspect-square w-full max-h-[580px] bg-zinc-100 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 shadow-inner flex items-center justify-center overflow-hidden p-2 group">
            {/* Resolution watermark */}
            <div className="absolute top-4 left-4 z-20 px-2.5 py-1 rounded-md bg-zinc-900/80 backdrop-blur-md text-[11px] font-mono font-medium text-zinc-200 border border-white/10 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              1500 × 1500 px • 1:1
            </div>

            {/* Active Skin Badge */}
            <div className="absolute top-4 right-4 z-20 px-3 py-1 rounded-md bg-zinc-900/80 backdrop-blur-md text-[11px] font-bold text-[#f3aa18] border border-[#f3aa18]/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {currentPreviewFinish.name}
            </div>

            {/* Rendering Indicator */}
            {isRenderingPreview && (
              <div className="absolute inset-0 z-30 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center transition-opacity">
                <div className="px-4 py-2 rounded-xl bg-zinc-900/90 text-white text-xs font-semibold flex items-center gap-2 border border-white/10 shadow-2xl">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#f3aa18]" />
                  Compositing 1500px Canvas...
                </div>
              </div>
            )}

            {/* Offscreen / Render Canvas */}
            <canvas
              ref={canvasRef}
              width={1500}
              height={1500}
              className="w-full h-full object-contain rounded-xl shadow-xl transition-transform"
            />
          </div>

          {/* Quick Preview Finish Selector Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-[#f3aa18]" />
                Preview Skin:
              </span>
              <span className="text-[11px]">Click any skin to update the live preview above</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
              {finishes.map((f) => {
                const isSelected = (f.id || f.slug) === activePreviewFinishId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setActivePreviewFinishId(f.id || f.slug)}
                    className={clsx(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition shrink-0',
                      isSelected
                        ? 'bg-[#f3aa18]/15 border-[#f3aa18] text-[#f3aa18] dark:text-[#f3aa18]'
                        : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    )}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                      style={{
                        backgroundColor: f.color_hex || '#333',
                        backgroundImage: f.thumbnail ? `url(${f.thumbnail})` : undefined,
                        backgroundSize: 'cover',
                      }}
                    />
                    <span className="truncate max-w-[100px]">{f.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CONTROLS & TABS (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-hidden">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
            <button
              onClick={() => setActiveTab('template')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
                activeTab === 'template'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              )}
            >
              <Type className="w-3.5 h-3.5" />
              Layout & Copy
            </button>

            <button
              onClick={() => setActiveTab('device')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
                activeTab === 'device'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Device & Swatches
            </button>

            <button
              onClick={() => setActiveTab('background')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition',
                activeTab === 'background'
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              )}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Background
            </button>

            <button
              onClick={() => setActiveTab('batch')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ml-auto',
                activeTab === 'batch'
                  ? 'bg-[#f3aa18] text-zinc-950 font-extrabold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              )}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              Batch ({selectedFinishIds.size})
            </button>
          </div>

          {/* TAB 1: TEMPLATE & COPYWRITING */}
          {activeTab === 'template' && (
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
              {/* Device Model Top-Right Pill */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Device Name Badge (Top Right)
                </label>
                <input
                  type="text"
                  value={deviceNameText}
                  onChange={(e) => setDeviceNameText(e.target.value)}
                  placeholder="e.g. IPHONE 17 PRO / MAX"
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                />
              </div>

              {/* Sub-badge Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Sub-Badge Tag (Above Headline)
                </label>
                <input
                  type="text"
                  value={subBadgeText}
                  onChange={(e) => setSubBadgeText(e.target.value)}
                  placeholder="e.g. x2 pcs or #1 Skin di Indonesia (leave blank to hide)"
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                />
              </div>

              {/* Big Bold Headline */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Product Title (Left Headline)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-400">Font:</span>
                    <select
                      value={headlineFont}
                      onChange={(e) => setHeadlineFont(e.target.value as any)}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                    >
                      <option value="Chakra Petch">Chakra Petch (Technical)</option>
                      <option value="Plus Jakarta Sans">Plus Jakarta (Modern)</option>
                      <option value="Inter">Inter (Clean)</option>
                    </select>
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={headlineText}
                  onChange={(e) => setHeadlineText(e.target.value)}
                  placeholder="Enter multi-line headline (one per line)"
                  className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                />
              </div>

              {/* Bottom Feature Cards (3 Horizontal Cards) */}
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Bottom Feature Cards (3-Column Row)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setFeatureCards(DEFAULT_FEATURE_CARDS_VINYL)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300"
                    >
                      3M Vinyl Preset
                    </button>
                    <button
                      onClick={() => setFeatureCards(DEFAULT_FEATURE_CARDS_CLEAR)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300"
                    >
                      Ark Clear Preset
                    </button>
                  </div>
                </div>

                {featureCards.map((card, idx) => (
                  <div
                    key={card.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-1.5"
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
                        className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-none"
                      >
                        <option value="material">3M Layers Icon</option>
                        <option value="fit">Accurate Fit Target</option>
                        <option value="guarantee">Guarantee Shield</option>
                        <option value="scratch">Scratch Proof Key</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
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
                        className="px-2 py-1 rounded text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700"
                      />
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
                        className="px-2 py-1 rounded text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: DEVICE & 20+ SKINS SWATCHES */}
          {activeTab === 'device' && (
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
              {/* Angle View Selector */}
              {profile.views.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Camera Viewing Angle
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {profile.views.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedViewId(v.id)}
                        className={clsx(
                          'px-3 py-2 rounded-xl text-xs font-bold border transition text-left',
                          selectedViewId === v.id
                            ? 'bg-[#f3aa18]/15 border-[#f3aa18] text-[#f3aa18]'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                        )}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Coverage & Cutout Options */}
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Coverage & Cutouts
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      name="coverage"
                      checked={coverage === 'model_360'}
                      onChange={() => setCoverage('model_360')}
                      className="text-[#f3aa18] focus:ring-[#f3aa18]"
                    />
                    Model 360 (Full Wrap)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
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
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={logoCutout}
                      onChange={(e) => setLogoCutout(e.target.checked)}
                      className="rounded text-[#f3aa18] focus:ring-[#f3aa18]"
                    />
                    Punch Logo Cutout
                  </label>
                  {profile.coverage_and_cutouts?.has_pencil_cutout && (
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
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
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Device Placement & Zoom
                  </span>
                  <button
                    onClick={() => {
                      setDeviceScale(1.0);
                      setDeviceOffsetX(0);
                      setDeviceOffsetY(0);
                    }}
                    className="text-[11px] text-[#f3aa18] hover:underline"
                  >
                    Reset
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>Scale / Zoom</span>
                    <span>{Math.round(deviceScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.45"
                    step="0.02"
                    value={deviceScale}
                    onChange={(e) => setDeviceScale(parseFloat(e.target.value))}
                    className="w-full accent-[#f3aa18]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-500">
                      <span>Horizontal X</span>
                      <span>{deviceOffsetX}px</span>
                    </div>
                    <input
                      type="range"
                      min="-250"
                      max="250"
                      step="5"
                      value={deviceOffsetX}
                      onChange={(e) => setDeviceOffsetX(parseInt(e.target.value, 10))}
                      className="w-full accent-[#f3aa18]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-500">
                      <span>Vertical Y</span>
                      <span>{deviceOffsetY}px</span>
                    </div>
                    <input
                      type="range"
                      min="-200"
                      max="200"
                      step="5"
                      value={deviceOffsetY}
                      onChange={(e) => setDeviceOffsetY(parseInt(e.target.value, 10))}
                      className="w-full accent-[#f3aa18]"
                    />
                  </div>
                </div>
              </div>

              {/* 20+ Skins Swatches Stack Controls */}
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    20+ Skins Selection Stack
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
                        <label className="text-[11px] text-zinc-500">Count Text</label>
                        <input
                          type="text"
                          value={skinsCountText}
                          onChange={(e) => setSkinsCountText(e.target.value)}
                          className="w-full px-2 py-1 rounded text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-500">Label Text</label>
                        <input
                          type="text"
                          value={skinsLabelText}
                          onChange={(e) => setSkinsLabelText(e.target.value)}
                          className="w-full px-2 py-1 rounded text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500">Preview Swatches (Top 2)</label>
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
                            className="w-full px-2 py-1 rounded text-xs font-medium bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700"
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
            <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Select Background Style
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setBgType('studio_light')}
                    className={clsx(
                      'p-3 rounded-xl border text-left transition space-y-1.5',
                      bgType === 'studio_light'
                        ? 'bg-[#f3aa18]/15 border-[#f3aa18]'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                    )}
                  >
                    <div className="w-full h-16 rounded-lg bg-gradient-to-br from-white via-zinc-100 to-zinc-200 border border-zinc-200 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-zinc-300/40" />
                    </div>
                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      Exacoat Monogram Light
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Clean studio lighting with subtle brand pattern
                    </div>
                  </button>

                  <button
                    onClick={() => setBgType('custom')}
                    className={clsx(
                      'p-3 rounded-xl border text-left transition space-y-1.5',
                      bgType === 'custom'
                        ? 'bg-[#f3aa18]/15 border-[#f3aa18]'
                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                    )}
                  >
                    <div className="w-full h-16 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[#f3aa18]">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      Custom Background Image
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Upload from Photoshop or enter direct image URL
                    </div>
                  </button>
                </div>
              </div>

              {bgType === 'custom' && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-3">
                  <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Upload Custom Background (1500x1500px Recommended)
                  </div>

                  {/* File Upload Drop Area */}
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-[#f3aa18] transition bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex flex-col items-center justify-center pt-2 pb-2">
                      <Upload className="w-5 h-5 mb-1 text-zinc-400" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Click to upload background JPG/PNG
                      </p>
                      <p className="text-[10px] text-zinc-500">Saved locally in browser</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>

                  {/* Image URL Input */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-500">Or paste background image URL:</label>
                    <input
                      type="text"
                      value={customBgUrl}
                      onChange={(e) => setCustomBgUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BATCH SELECTION & GENERATION */}
          {activeTab === 'batch' && (
            <div className="flex flex-col flex-1 overflow-hidden space-y-3">
              {/* Batch Action Pills */}
              <div className="flex items-center justify-between gap-1 shrink-0">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Select Skins to Generate ({selectedFinishIds.size}/{finishes.length})
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
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 transition"
                  >
                    All
                  </button>
                  <button
                    onClick={handleClearSelection}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Finishes Checkbox Grid */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 bg-white dark:bg-zinc-900/40">
                {finishes.map((f) => {
                  const fid = f.id || f.slug;
                  const isChecked = selectedFinishIds.has(fid);
                  return (
                    <div
                      key={f.id}
                      onClick={() => toggleFinishSelection(fid)}
                      className={clsx(
                        'flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition select-none',
                        isChecked
                          ? 'bg-[#f3aa18]/10 text-zinc-900 dark:text-zinc-100 font-semibold'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-5 h-5 rounded-full border border-black/20 shrink-0"
                          style={{
                            backgroundColor: f.color_hex || '#333',
                            backgroundImage: f.thumbnail ? `url(${f.thumbnail})` : undefined,
                            backgroundSize: 'cover',
                          }}
                        />
                        <span className="text-xs">{f.name}</span>
                        {f.group && (
                          <span className="text-[10px] text-zinc-400">({f.group})</span>
                        )}
                      </div>

                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-[#f3aa18]" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Batch Generation Progress Indicator */}
              {isGeneratingBatch && batchProgress && (
                <div className="p-3 rounded-xl bg-zinc-900 text-white space-y-2 border border-[#f3aa18]/30 shrink-0">
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
    </Modal>
  );
};
