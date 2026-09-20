import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  toggleProductConfiguratorDirect,
  markDeviceAuditedDirect,
  batchMarkDevicesAuditedDirect,
  resetDeviceAuditDirect,
  GlobalFinish,
  fetchGlobalFinishesDirect,
  saveGlobalFinishDirect,
  extractShadingDirect,
} from '../lib/wordpressBridge';
import {
  DeviceConfiguratorProfile,
  ConfiguratorProfileSummary,
  ConfiguratorLayer,
  ConfiguratorView,
  DeviceFamily,
  DeviceCoverageAndCutouts,
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
  Folder,
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
  ShieldAlert,
  Wand2,
  GripVertical,
  Tag,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import { MediaLibraryModal } from '../components/modals/MediaLibraryModal';
import { WpMediaItem } from '../lib/wordpressBridge';

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

export interface DeviceAuditSummary {
  productId: number;
  deviceName: string;
  category: string;
  family: string;
  totalAssets: number;
  healthyCount: number;
  brokenCount: number;
  emptyCount: number;
  ghostAngles: GhostAngleReport[];
  brokenItems: AssetAuditItem[];
}

export interface GlobalCatalogAuditReport {
  timestamp: string;
  totalDevicesScanned: number;
  totalAssetsProbed: number;
  devicesWithIssues: number;
  totalBrokenAssets: number;
  totalGhostAngles: number;
  totalEmptyMappings: number;
  deviceSummaries: DeviceAuditSummary[];
}

export interface SkinPartPreset {
  name: string;
  group: 'primary' | 'accent' | 'protection' | 'addon';
  is_required: boolean;
  is_optional: boolean;
  extra_price: number;
}

export const DEVICE_FAMILY_PRESET_PACKS: Record<string, { label: string; family: DeviceFamily; parts: SkinPartPreset[] }> = {
  phone: {
    label: 'Smartphone (iPhone / Galaxy S)',
    family: 'phone',
    parts: [
      { name: 'Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
      { name: 'Camera Skin', group: 'accent', is_required: false, is_optional: true, extra_price: 15000 },
      { name: 'Back Glass Skin', group: 'accent', is_required: false, is_optional: true, extra_price: 25000 },
      { name: 'Frame / Sides', group: 'protection', is_required: false, is_optional: true, extra_price: 30000 },
    ],
  },
  foldable: {
    label: 'Foldable (Z Flip / Fold)',
    family: 'foldable',
    parts: [
      { name: 'Top Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
      { name: 'Bottom Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
      { name: 'Camera Skin', group: 'accent', is_required: false, is_optional: true, extra_price: 15000 },
      { name: 'Hinge / Spine', group: 'accent', is_required: false, is_optional: true, extra_price: 25000 },
    ],
  },
  laptop: {
    label: 'Laptop (MacBook Pro / Air)',
    family: 'laptop',
    parts: [
      { name: 'Top Lid', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
      { name: 'Bottom Base', group: 'primary', is_required: false, is_optional: true, extra_price: 120000 },
      { name: 'Trackpad', group: 'accent', is_required: false, is_optional: true, extra_price: 40000 },
      { name: 'Palm Rest', group: 'accent', is_required: false, is_optional: true, extra_price: 80000 },
    ],
  },
  tablet: {
    label: 'Tablet (iPad / Galaxy Tab)',
    family: 'tablet',
    parts: [
      { name: 'Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
      { name: 'Camera Accent', group: 'accent', is_required: false, is_optional: true, extra_price: 15000 },
      { name: 'Pencil Skin', group: 'accent', is_required: false, is_optional: true, extra_price: 25000 },
    ],
  },
  keyboard: {
    label: 'Keyboard (Magic Keyboard)',
    family: 'keyboard',
    parts: [
      { name: 'Top Outer Cover', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
      { name: 'Bottom Outer Cover', group: 'primary', is_required: false, is_optional: true, extra_price: 60000 },
      { name: 'Inner Keyboard Surround', group: 'accent', is_required: false, is_optional: true, extra_price: 60000 },
    ],
  },
};

const COMMON_PRESET_LAYERS: SkinPartPreset[] = [
  { name: 'Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
  { name: 'Camera Skin', group: 'accent', is_required: false, is_optional: true, extra_price: 15000 },
  { name: 'Back Glass Skin', group: 'accent', is_required: false, is_optional: true, extra_price: 25000 },
  { name: 'Camera Accent', group: 'accent', is_required: false, is_optional: true, extra_price: 15000 },
  { name: 'Frame / Sides', group: 'protection', is_required: false, is_optional: true, extra_price: 30000 },
  { name: 'Top Lid', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
  { name: 'Bottom Base', group: 'primary', is_required: false, is_optional: true, extra_price: 120000 },
  { name: 'Trackpad', group: 'accent', is_required: false, is_optional: true, extra_price: 40000 },
  { name: 'Palm Rest', group: 'accent', is_required: false, is_optional: true, extra_price: 80000 },
  { name: 'Top Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
  { name: 'Bottom Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
  { name: 'Hinge / Spine', group: 'accent', is_required: false, is_optional: true, extra_price: 25000 },
  { name: 'Pencil Skin', group: 'accent', is_required: false, is_optional: true, extra_price: 25000 },
];

interface V2SkinCanvasLayerProps {
  maskUrl: string;
  textureUrl?: string;
  fallbackColor?: string;
  logoCutoutUrl?: string;
  pencilCutoutUrl?: string;
  modelCutoutUrl?: string;
  zIndex: number;
  layerName: string;
}

const V2SkinCanvasLayer: React.FC<V2SkinCanvasLayerProps> = ({
  maskUrl,
  textureUrl,
  fallbackColor = '#18181b',
  logoCutoutUrl,
  pencilCutoutUrl,
  modelCutoutUrl,
  zIndex,
  layerName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !maskUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;

    // Helper: load image safely without crossOrigin blocking
    const loadImage = (src?: string): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        if (!src || !src.trim()) return resolve(null);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src.trim();
      });
    };

    Promise.all([
      loadImage(maskUrl),
      textureUrl ? loadImage(textureUrl) : Promise.resolve(null),
      logoCutoutUrl ? loadImage(logoCutoutUrl) : Promise.resolve(null),
      pencilCutoutUrl ? loadImage(pencilCutoutUrl) : Promise.resolve(null),
      modelCutoutUrl ? loadImage(modelCutoutUrl) : Promise.resolve(null),
    ]).then(([maskImg, texImg, logoCutoutImg, pencilCutoutImg, modelCutoutImg]) => {
      if (isCancelled || !ctx) return;
      ctx.clearRect(0, 0, 1000, 1000);
      if (!maskImg) return;

      // 1. Draw master texture with native aspect-ratio cover scaling (no squeezing)
      if (texImg && texImg.width > 0 && texImg.height > 0) {
        const scale = Math.max(1000 / texImg.width, 1000 / texImg.height);
        const drawW = texImg.width * scale;
        const drawH = texImg.height * scale;
        const drawX = (1000 - drawW) / 2;
        const drawY = (1000 - drawH) / 2;
        ctx.drawImage(texImg, drawX, drawY, drawW, drawH);
      } else {
        // Fallback color fill
        ctx.fillStyle = fallbackColor || '#18181b';
        ctx.fillRect(0, 0, 1000, 1000);
      }

      // 2. Clip with vinyl skin alpha mask (keeps skin area only)
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskImg, 0, 0, 1000, 1000);

      // 3. Punch out logo hole from the skin so hardware base chassis shines through
      if (logoCutoutImg) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(logoCutoutImg, 0, 0, 1000, 1000);
      }

      // 4. Punch out pencil groove/charging area so tablet body shines through
      if (pencilCutoutImg) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(pencilCutoutImg, 0, 0, 1000, 1000);
      }

      // 5. Punch out model cut perimeter so phone metal frame shows for back-only cuts
      if (modelCutoutImg) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(modelCutoutImg, 0, 0, 1000, 1000);
      }

      // Reset composite operation to normal
      ctx.globalCompositeOperation = 'source-over';
    });

    return () => {
      isCancelled = true;
    };
  }, [maskUrl, textureUrl, fallbackColor, logoCutoutUrl, pencilCutoutUrl, modelCutoutUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={1000}
      style={{ zIndex }}
      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      title={layerName}
    />
  );
};

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
  const [filterAudit, setFilterAudit] = useState<'all' | 'audited' | 'unaudited' | 'issues'>('all');
  const [globalAuditMode, setGlobalAuditMode] = useState<'all' | 'unaudited'>('all');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [togglingConfiguratorId, setTogglingConfiguratorId] = useState<number | null>(null);

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
  const [inspectorWidth, setInspectorWidth] = useState<number>(540);
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

  // Global Catalog-Wide Asset Audit state
  const [showGlobalAuditModal, setShowGlobalAuditModal] = useState(false);
  const [isAuditingGlobal, setIsAuditingGlobal] = useState(false);
  const [isCleaningGlobalGhosts, setIsCleaningGlobalGhosts] = useState(false);
  const [globalAuditProgress, setGlobalAuditProgress] = useState<{
    scannedDevices: number;
    totalDevices: number;
    currentDeviceName: string;
  }>({ scannedDevices: 0, totalDevices: 0, currentDeviceName: '' });
  const [globalAuditReport, setGlobalAuditReport] = useState<GlobalCatalogAuditReport | null>(null);
  const [globalAuditFilter, setGlobalAuditFilter] = useState<'all' | 'issues' | 'ghost' | 'clean'>('issues');

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

  // Category combobox dropdown state
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Global Master Textures Modal state (v2 Engine)
  const [showMasterTexturesModal, setShowMasterTexturesModal] = useState(false);
  const [masterTextureSearch, setMasterTextureSearch] = useState('');
  const [masterTextureGroupFilter, setMasterTextureGroupFilter] = useState('all');
  const [savingFinishId, setSavingFinishId] = useState<string | null>(null);
  const [editingFinishUrls, setEditingFinishUrls] = useState<Record<string, string>>({});

  // WordPress Media Library Picker state
  const [mediaPickerConfig, setMediaPickerConfig] = useState<{
    isOpen: boolean;
    title: string;
    recommendedDimensions: string;
    currentUrl: string;
    onSelect: (url: string) => void;
  }>({
    isOpen: false,
    title: '',
    recommendedDimensions: '',
    currentUrl: '',
    onSelect: () => {},
  });

  // v2 Advanced texture map overrides accordion toggle
  const [showV2AdvancedOverrides, setShowV2AdvancedOverrides] = useState(false);

  // Shading Extractor Modal state
  const [showShadingExtractorModal, setShowShadingExtractorModal] = useState(false);
  const [shadingSourceUrl, setShadingSourceUrl] = useState('');
  const [shadingShadowContrast, setShadingShadowContrast] = useState(1.2);
  const [shadingHlContrast, setShadingHlContrast] = useState(1.0);
  const [isExtractingShading, setIsExtractingShading] = useState(false);

  // Close category dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live Simulator test state
  const [selectedSimLayers, setSelectedSimLayers] = useState<Record<string, boolean>>({});
  const [selectedSimFinish, setSelectedSimFinish] = useState<string>('swarm');
  const [selectedLayerFinishes, setSelectedLayerFinishes] = useState<Record<string, string>>({});
  const [activeSimTestingPartId, setActiveSimTestingPartId] = useState<string>('');
  const [selectedCoverage, setSelectedCoverage] = useState<'model_cut' | 'model_360'>('model_cut');
  const [selectedLogoCutout, setSelectedLogoCutout] = useState<boolean>(true);
  const [selectedPencilCutout, setSelectedPencilCutout] = useState<boolean>(true);
  const [activeSimView, setActiveSimView] = useState<string>('main_view');
  const [selectedSimColor, setSelectedSimColor] = useState<string>('space-gray');
  const [simFinishGroupFilter, setSimFinishGroupFilter] = useState<string>('all');
  const [customPartInputOpen, setCustomPartInputOpen] = useState<boolean>(false);
  const [customPartName, setCustomPartName] = useState<string>('');

  const loadData = async (quiet = false, allProducts = showAllProducts) => {
    try {
      if (!quiet) setIsLoading(true);
      else setIsRefreshing(true);

      const [profilesRes, finishesRes] = await Promise.all([
        fetchConfiguratorProfilesDirect({
          per_page: 500,
          only_configurable: !allProducts,
        }),
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
        if (categoryDropdownOpen) {
          setCategoryDropdownOpen(false);
        } else if (mediaPickerConfig.isOpen) {
          setMediaPickerConfig((prev) => ({ ...prev, isOpen: false }));
        } else if (showMasterTexturesModal) {
          setShowMasterTexturesModal(false);
        } else if (showGlobalAuditModal) {
          setShowGlobalAuditModal(false);
        } else if (showAssetAuditModal) {
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
  }, [categoryDropdownOpen, mediaPickerConfig.isOpen, showMasterTexturesModal, showGlobalAuditModal, showAssetAuditModal, showFindReplaceModal, editingTextureModal, duplicateModal, priceEditModal, selectedProductId]);

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
      if (newWidth >= 380 && newWidth <= 950) {
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
        const initialFinishes: Record<string, string> = {};
        cleanedLayers.forEach((l) => {
          initialSim[l.id] = l.default_selected || l.is_required;
          const lName = (l.name || '').toLowerCase();
          if (lName.includes('back')) {
            initialFinishes[l.id] = 'swarm';
          } else if (lName.includes('camera') && !lName.includes('accent')) {
            initialFinishes[l.id] = 'matte-black';
          } else if (lName.includes('accent') || lName.includes('frame')) {
            initialFinishes[l.id] = 'emerald-green';
          } else {
            initialFinishes[l.id] = l.allowed_finish_slugs?.[0] || 'swarm';
          }
        });
        setSelectedSimLayers(initialSim);
        setSelectedLayerFinishes(initialFinishes);
        setActiveSimTestingPartId(cleanedLayers[0]?.id || '');
        setSelectedCoverage('model_cut');
        setSelectedLogoCutout(true);
        setSelectedPencilCutout(true);
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
          `${editingProfile.device_name} saved successfully.`
        );
        if (res.profile) {
          setEditingProfile({
            ...editingProfile,
            ...res.profile,
          });
        }
        loadData(false);
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed saving configurator profile');
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const activeSkinLayers = useMemo(() => {
    if (!editingProfile) return [];
    return (editingProfile.layers || []).filter(
      (l) => (l.name || '').toLowerCase() !== 'device' && (l.id || '').toLowerCase() !== 'device'
    );
  }, [editingProfile]);

  const activeTargetLayer = useMemo(() => {
    return activeSkinLayers.find((l) => l.id === selectedLayerId) || activeSkinLayers[0];
  }, [activeSkinLayers, selectedLayerId]);

  const activeTargetView = useMemo(() => {
    if (!editingProfile?.views) return undefined;
    return editingProfile.views.find((v) => v.id === activeSimView) || editingProfile.views[0];
  }, [editingProfile, activeSimView]);

  const handleRunShadingExtraction = async () => {
    if (!shadingSourceUrl.trim()) {
      showToast('error', 'Source Image Required', 'Please provide a 3D render image URL (e.g. Matte White render) to extract shading.');
      return;
    }
    if (!editingProfile || !activeTargetView) {
      showToast('error', 'No Active View', 'Please select a viewing angle in the studio inspector.');
      return;
    }

    setIsExtractingShading(true);
    try {
      const res = await extractShadingDirect(shadingSourceUrl.trim(), {
        shadow_contrast: shadingShadowContrast,
        highlight_contrast: shadingHlContrast,
      });

      if (res.success && res.shadow_url && res.highlight_url) {
        const viewKey = activeTargetView?.id || 'main_view';

        const updatedViews = (editingProfile.views || []).map((v) => {
          if (v.id !== viewKey) return v;
          return {
            ...v,
            shadow_png_url: res.shadow_url,
            highlight_png_url: res.highlight_url,
            shadow_opacity: v.shadow_opacity ?? 0.85,
            highlight_opacity: v.highlight_opacity ?? 0.40,
          };
        });

        setEditingProfile({
          ...editingProfile,
          views: updatedViews,
        });

        showToast(
          'success',
          'Shading Maps Extracted',
          'Smooth multiply shadow and screen highlight PNGs applied to viewing angle.'
        );
        setShowShadingExtractorModal(false);
      } else {
        showToast(
          'error',
          'Extraction Failed',
          res.error || 'Server could not extract shading from the provided image.'
        );
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Failed running shading extractor.');
    } finally {
      setIsExtractingShading(false);
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

  // Toggle between configurators only and all store products
  const handleToggleShowAllProducts = (all: boolean) => {
    setShowAllProducts(all);
    loadData(false, all);
  };

  // Toggle whether an individual product is an active device configurator
  const handleToggleConfiguratorStatus = async (productId: number, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      setTogglingConfiguratorId(productId);
      const res = await toggleProductConfiguratorDirect(productId, nextStatus);
      if (res.success) {
        showToast(
          'success',
          nextStatus ? 'Configurator Enabled' : 'Configurator Excluded',
          nextStatus
            ? 'Product enabled as interactive device configurator.'
            : 'Product excluded from configurator studio.'
        );
        // Optimistically update the product in local profiles state
        setProfiles((prev) =>
          prev.map((p) =>
            p.product_id === productId ? { ...p, is_configurator: nextStatus } : p
          )
        );
      } else {
        showToast('error', 'Update Failed', res.message || 'Failed updating configurator status');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Network error updating configurator status');
    } finally {
      setTogglingConfiguratorId(null);
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
      let updatedView = { ...v };
      if (replaceScope === 'all' || replaceScope === 'chassis') {
        if (v.background_url && v.background_url.includes(query)) {
          replacedCount++;
          updatedView.background_url = v.background_url.split(query).join(replacement);
        }
        if (v.logo_cutout_mask_url && v.logo_cutout_mask_url.includes(query)) {
          replacedCount++;
          updatedView.logo_cutout_mask_url = v.logo_cutout_mask_url.split(query).join(replacement);
        }
        if (v.pencil_cutout_mask_url && v.pencil_cutout_mask_url.includes(query)) {
          replacedCount++;
          updatedView.pencil_cutout_mask_url = v.pencil_cutout_mask_url.split(query).join(replacement);
        }
        if (v.model_cut_mask_url && v.model_cut_mask_url.includes(query)) {
          replacedCount++;
          updatedView.model_cut_mask_url = v.model_cut_mask_url.split(query).join(replacement);
        }
        if (v.shadow_png_url && v.shadow_png_url.includes(query)) {
          replacedCount++;
          updatedView.shadow_png_url = v.shadow_png_url.split(query).join(replacement);
        }
        if (v.highlight_png_url && v.highlight_png_url.includes(query)) {
          replacedCount++;
          updatedView.highlight_png_url = v.highlight_png_url.split(query).join(replacement);
        }
      }
      return updatedView;
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
          if (viewAsset.logo_cutout_url && viewAsset.logo_cutout_url.includes(query)) {
            replacedCount++;
            patchedAsset.logo_cutout_url = viewAsset.logo_cutout_url.split(query).join(replacement);
          }
          if (viewAsset.pencil_cutout_url && viewAsset.pencil_cutout_url.includes(query)) {
            replacedCount++;
            patchedAsset.pencil_cutout_url = viewAsset.pencil_cutout_url.split(query).join(replacement);
          }
          if (viewAsset.model_cutout_url && viewAsset.model_cutout_url.includes(query)) {
            replacedCount++;
            patchedAsset.model_cutout_url = viewAsset.model_cutout_url.split(query).join(replacement);
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

    let updatedCoverage = editingProfile.coverage_and_cutouts ? { ...editingProfile.coverage_and_cutouts } : undefined;
    if (updatedCoverage && (replaceScope === 'all' || replaceScope === 'chassis')) {
      if (updatedCoverage.logo_cutout_mask_url && updatedCoverage.logo_cutout_mask_url.includes(query)) {
        replacedCount++;
        updatedCoverage.logo_cutout_mask_url = updatedCoverage.logo_cutout_mask_url.split(query).join(replacement);
      }
      if (updatedCoverage.pencil_cutout_mask_url && updatedCoverage.pencil_cutout_mask_url.includes(query)) {
        replacedCount++;
        updatedCoverage.pencil_cutout_mask_url = updatedCoverage.pencil_cutout_mask_url.split(query).join(replacement);
      }
      if (updatedCoverage.model_cut_mask_url && updatedCoverage.model_cut_mask_url.includes(query)) {
        replacedCount++;
        updatedCoverage.model_cut_mask_url = updatedCoverage.model_cut_mask_url.split(query).join(replacement);
      }
    }

    setEditingProfile({
      ...editingProfile,
      views: newViews,
      layers: newLayers,
      coverage_and_cutouts: updatedCoverage,
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

    // Persist single device audit record to WooCommerce post meta
    const totalIssues = brokenCount + ghostAngles.length;
    const auditStatus = totalIssues > 0 ? 'issues' : 'clean';
    const nowIso = new Date().toISOString();

    markDeviceAuditedDirect({
      product_id: editingProfile.product_id,
      audit_status: auditStatus,
      audit_issues: totalIssues,
      last_audited_at: nowIso,
    }).catch(console.warn);

    setProfiles((prev) =>
      prev.map((p) =>
        p.product_id === editingProfile.product_id
          ? {
              ...p,
              last_audited_at: nowIso,
              audit_status: auditStatus,
              audit_issues: totalIssues,
            }
          : p
      )
    );

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

  // Global Catalog-Wide Audit Handlers
  const handleStartGlobalCatalogAudit = async (mode: 'all' | 'unaudited' = 'all') => {
    setGlobalAuditMode(mode);
    const targetProfiles =
      mode === 'unaudited'
        ? profiles.filter((p) => !p.last_audited_at || p.audit_status === 'unaudited')
        : profiles;

    if (targetProfiles.length === 0) {
      showToast(
        'info',
        'All Devices Audited',
        'All products in the catalog have already been audited. Run "Audit All Devices" to re-scan.'
      );
      return;
    }

    setIsAuditingGlobal(true);
    setShowGlobalAuditModal(true);
    setGlobalAuditProgress({
      scannedDevices: 0,
      totalDevices: targetProfiles.length,
      currentDeviceName: 'Starting catalog scan...',
    });

    const deviceSummaries: DeviceAuditSummary[] = [];
    let totalAssetsProbed = 0;
    let totalBrokenAssets = 0;
    let totalGhostAngles = 0;
    let totalEmptyMappings = 0;
    let devicesWithIssues = 0;

    for (let i = 0; i < targetProfiles.length; i++) {
      const p = targetProfiles[i];
      setGlobalAuditProgress({
        scannedDevices: i,
        totalDevices: targetProfiles.length,
        currentDeviceName: p.name,
      });

      try {
        const res = await fetchProductConfiguratorProfileDirect(p.product_id);
        if (!res.success || !res.profile) continue;
        const profile = res.profile;

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

        (profile.views || []).forEach((v) => {
          itemsToProbe.push({
            id: `chassis-${v.id}`,
            type: 'chassis',
            viewId: v.id,
            viewName: v.name,
            url: (v.background_url || '').trim(),
          });
        });

        (profile.layers || []).forEach((layer) => {
          (profile.views || []).forEach((v) => {
            const viewAsset =
              layer.assets_by_view?.[v.id] ||
              layer.assets_by_view?.['main_view'] ||
              Object.values(layer.assets_by_view || {})[0];

            if (viewAsset) {
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

        const auditedItems: AssetAuditItem[] = [];
        const concurrency = 6;
        let itemIndex = 0;

        const worker = async () => {
          while (itemIndex < itemsToProbe.length) {
            const idx = itemIndex++;
            const target = itemsToProbe[idx];
            if (!target.url) {
              auditedItems[idx] = {
                ...target,
                status: 'empty',
                error: 'No image URL assigned',
              };
            } else {
              const probeRes = await probeImageUrl(target.url);
              auditedItems[idx] = {
                ...target,
                status: probeRes.ok ? 'healthy' : 'broken',
                error: probeRes.error,
              };
            }
          }
        };

        const workers = Array.from({ length: Math.min(concurrency, itemsToProbe.length) }, () => worker());
        await Promise.all(workers);

        const ghostAngles: GhostAngleReport[] = [];
        (profile.views || []).forEach((v) => {
          const chassisItem = auditedItems.find((it) => it.type === 'chassis' && it.viewId === v.id);
          const chassisStatus = !v.background_url?.trim()
            ? 'missing'
            : chassisItem?.status === 'broken'
            ? 'broken'
            : 'healthy';

          let mappedTexturesCount = 0;
          (profile.layers || []).forEach((layer) => {
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

        const healthyCount = auditedItems.filter((it) => it.status === 'healthy').length;
        const brokenCount = auditedItems.filter((it) => it.status === 'broken').length;
        const emptyCount = auditedItems.filter((it) => it.status === 'empty').length;
        const brokenItems = auditedItems.filter((it) => it.status === 'broken');

        totalAssetsProbed += auditedItems.length;
        totalBrokenAssets += brokenCount;
        totalGhostAngles += ghostAngles.length;
        totalEmptyMappings += emptyCount;

        if (brokenCount > 0 || ghostAngles.length > 0) {
          devicesWithIssues++;
        }

        deviceSummaries.push({
          productId: p.product_id,
          deviceName: p.name,
          category: p.categories?.[0] || profile.category || 'General',
          family: p.family,
          totalAssets: auditedItems.length,
          healthyCount,
          brokenCount,
          emptyCount,
          ghostAngles,
          brokenItems,
        });
      } catch (err) {
        console.warn(`Failed auditing product #${p.product_id}:`, err);
      }
    }

    setGlobalAuditProgress({
      scannedDevices: targetProfiles.length,
      totalDevices: targetProfiles.length,
      currentDeviceName: 'Scan complete.',
    });

    const finalReport: GlobalCatalogAuditReport = {
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      totalDevicesScanned: targetProfiles.length,
      totalAssetsProbed,
      devicesWithIssues,
      totalBrokenAssets,
      totalGhostAngles,
      totalEmptyMappings,
      deviceSummaries,
    };

    setGlobalAuditReport(finalReport);
    setIsAuditingGlobal(false);

    // Persist all audit results to WooCommerce post meta
    const nowIso = new Date().toISOString();
    const auditRowsToPersist = deviceSummaries.map((ds) => {
      const issues = ds.brokenCount + ds.ghostAngles.length;
      return {
        product_id: ds.productId,
        audit_status: (issues > 0 ? 'issues' : 'clean') as 'issues' | 'clean',
        audit_issues: issues,
        last_audited_at: nowIso,
      };
    });

    if (auditRowsToPersist.length > 0) {
      batchMarkDevicesAuditedDirect(auditRowsToPersist).catch(console.warn);

      // Optimistically update profiles in state
      setProfiles((prev) =>
        prev.map((p) => {
          const matched = auditRowsToPersist.find((r) => r.product_id === p.product_id);
          if (matched) {
            return {
              ...p,
              last_audited_at: matched.last_audited_at,
              audit_status: matched.audit_status,
              audit_issues: matched.audit_issues,
            };
          }
          return p;
        })
      );
    }

    if (devicesWithIssues > 0) {
      setGlobalAuditFilter('issues');
    } else {
      setGlobalAuditFilter('all');
    }
  };

  const handleBulkCleanGhostAngles = async () => {
    if (!globalAuditReport) return;
    const devicesToClean = globalAuditReport.deviceSummaries.filter((d) => d.ghostAngles.length > 0);
    if (devicesToClean.length === 0) {
      showToast('info', 'No Ghost Angles', 'No ghost viewing angles found in the scanned catalog.');
      return;
    }

    setIsCleaningGlobalGhosts(true);
    let cleanedCount = 0;
    let failedCount = 0;

    for (const d of devicesToClean) {
      try {
        const res = await fetchProductConfiguratorProfileDirect(d.productId);
        if (!res.success || !res.profile) {
          failedCount++;
          continue;
        }

        const profile = res.profile;
        const ghostViewIds = new Set(d.ghostAngles.map((g) => g.viewId));
        const remainingViews = (profile.views || []).filter((v) => !ghostViewIds.has(v.id));

        if (remainingViews.length === 0) {
          failedCount++;
          continue;
        }

        const cleanedLayers = (profile.layers || []).map((layer) => {
          const newAssets = { ...(layer.assets_by_view || {}) };
          ghostViewIds.forEach((gId) => {
            delete newAssets[gId];
          });
          return {
            ...layer,
            assets_by_view: newAssets,
          };
        });

        const saveRes = await saveProductConfiguratorProfileDirect({
          ...profile,
          views: remainingViews,
          layers: cleanedLayers,
        });

        if (saveRes.success) {
          cleanedCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    setIsCleaningGlobalGhosts(false);
    showToast(
      'success',
      'Bulk Cleaning Complete',
      `Removed ghost angles from ${cleanedCount} devices.${failedCount > 0 ? ` (${failedCount} failed)` : ''}`
    );

    await loadData(true);

    const updatedSummaries = globalAuditReport.deviceSummaries.map((d) => {
      if (d.ghostAngles.length > 0) {
        return {
          ...d,
          ghostAngles: [],
        };
      }
      return d;
    });

    setGlobalAuditReport({
      ...globalAuditReport,
      totalGhostAngles: 0,
      devicesWithIssues: updatedSummaries.filter((d) => d.brokenCount > 0).length,
      deviceSummaries: updatedSummaries,
    });
  };

  const filteredGlobalSummaries = useMemo(() => {
    if (!globalAuditReport) return [];
    if (globalAuditFilter === 'issues') {
      return globalAuditReport.deviceSummaries.filter(
        (d) => d.brokenCount > 0 || d.ghostAngles.length > 0
      );
    }
    if (globalAuditFilter === 'ghost') {
      return globalAuditReport.deviceSummaries.filter((d) => d.ghostAngles.length > 0);
    }
    if (globalAuditFilter === 'clean') {
      return globalAuditReport.deviceSummaries.filter(
        (d) => d.brokenCount === 0 && d.ghostAngles.length === 0
      );
    }
    return globalAuditReport.deviceSummaries;
  }, [globalAuditReport, globalAuditFilter]);

  // Layer manipulation helpers
  const handleAddPresetLayer = (preset: SkinPartPreset) => {
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

  const handleApplyFamilyPresetPack = (familyKey: string) => {
    if (!editingProfile) return;
    const pack = DEVICE_FAMILY_PRESET_PACKS[familyKey];
    if (!pack) return;

    let addedCount = 0;
    const newLayers = [...editingProfile.layers];
    const newSimLayers = { ...selectedSimLayers };

    pack.parts.forEach((part) => {
      const slug = part.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      if (!newLayers.some((l) => l.id === slug || l.name.toLowerCase() === part.name.toLowerCase())) {
        const newLayer: ConfiguratorLayer = {
          id: slug,
          name: part.name,
          group: part.group as any,
          is_required: part.is_required,
          is_optional: part.is_optional,
          default_selected: !part.is_optional,
          extra_price: part.extra_price,
          z_index: newLayers.length + 1,
          allowed_finish_groups: ['Signature skins', 'Colors', 'Natural'],
          assets_by_view: {
            [activeSimView || 'main_view']: {
              render_texture_map: {},
            },
          },
        };
        newLayers.push(newLayer);
        newSimLayers[slug] = newLayer.default_selected;
        addedCount++;
      }
    });

    // Also auto-configure default coverage mode and cutouts matching family if not explicitly set
    const currentCoverage = editingProfile.coverage_and_cutouts || {};
    let newCoverageType = currentCoverage.coverage_type;
    let hasLogo = currentCoverage.has_logo_cutout;
    let hasPencil = currentCoverage.has_pencil_cutout;

    if (!newCoverageType) {
      if (familyKey === 'phone') {
        newCoverageType = 'model_cut_and_360';
        hasLogo = true;
      } else if (familyKey === 'foldable') {
        newCoverageType = 'model_cut_only';
      } else if (familyKey === 'tablet') {
        newCoverageType = 'none';
        hasLogo = true;
        hasPencil = true;
      } else if (familyKey === 'laptop') {
        newCoverageType = 'none';
        hasLogo = true;
      } else {
        newCoverageType = 'none';
      }
    }

    setEditingProfile({
      ...editingProfile,
      layers: newLayers,
      coverage_and_cutouts: {
        ...currentCoverage,
        coverage_type: newCoverageType,
        has_logo_cutout: hasLogo ?? true,
        has_pencil_cutout: hasPencil ?? false,
      },
    });

    setSelectedSimLayers(newSimLayers);
    if (newLayers.length > 0 && !selectedLayerId) {
      setSelectedLayerId(newLayers[0].id);
    }
    showToast('success', 'Preset Applied', `Applied "${pack.label}" (${addedCount} parts added).`);
  };

  const handleCreateCustomLayer = (rawName: string) => {
    if (!editingProfile || !rawName.trim()) return;
    const name = rawName.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

    if (editingProfile.layers.some((l) => l.id === slug)) {
      showToast('error', 'Duplicate Layer', `Part with ID "${slug}" already exists.`);
      return;
    }

    const newLayer: ConfiguratorLayer = {
      id: slug,
      name,
      group: 'accent',
      is_required: false,
      is_optional: true,
      default_selected: false,
      extra_price: 15000,
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

    setSelectedSimLayers((prev) => ({ ...prev, [slug]: false }));
    setSelectedLayerId(slug);
    setCustomPartName('');
    setCustomPartInputOpen(false);
    showToast('success', 'Custom Part Created', `Created custom skin part "${name}".`);
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

  const handleSetLayerOverlayUrl = (
    layerId: string,
    key: 'mask_svg_url' | 'logo_cutout_url' | 'model_cutout_url' | 'shadow_png_url' | 'highlight_png_url' | 'shadow_opacity' | 'highlight_opacity',
    value: string | number
  ) => {
    if (!editingProfile) return;
    const viewId = activeSimView || 'main_view';
    setEditingProfile({
      ...editingProfile,
      layers: editingProfile.layers.map((l) => {
        if (l.id !== layerId) return l;
        const currentAssets = l.assets_by_view || {};
        const currentViewAssets = currentAssets[viewId] || {};
        const val = typeof value === 'string' ? value.trim() : value;
        return {
          ...l,
          assets_by_view: {
            ...currentAssets,
            [viewId]: {
              ...currentViewAssets,
              [key]: val,
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

  const handleSetViewField = (viewId: string, field: keyof ConfiguratorView, value: any) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      views: editingProfile.views.map((v) => (v.id === viewId ? { ...v, [field]: value } : v)),
    });
  };

  const handleSetCoverageAndCutouts = (field: keyof DeviceCoverageAndCutouts, value: any) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      coverage_and_cutouts: {
        ...(editingProfile.coverage_and_cutouts || {}),
        [field]: value,
      },
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
      (p.categories || []).forEach((c) => list.add(c));
    });
    return ['all', ...Array.from(list).sort()];
  }, [profiles]);

  // Category device counts for combobox display
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: profiles.length };
    profiles.forEach((p) => {
      (p.categories || []).forEach((c) => {
        counts[c] = (counts[c] || 0) + 1;
      });
    });
    return counts;
  }, [profiles]);

  // Filtered categories for combobox search
  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter((c) =>
      c === 'all' ? 'all categories'.includes(q) : c.toLowerCase().includes(q)
    );
  }, [categories, categorySearch]);

  // Save master texture for a global finish (v2 engine)
  const handleSaveMasterTexture = async (finish: GlobalFinish) => {
    const customUrl = editingFinishUrls[finish.id];
    const newUrl = customUrl !== undefined ? customUrl.trim() : (finish.texture_url || finish.thumbnail || '');
    try {
      setSavingFinishId(finish.id);
      const res = await saveGlobalFinishDirect({
        id: finish.id,
        slug: finish.slug,
        name: finish.name,
        group: finish.group,
        thumbnail: finish.thumbnail,
        texture_url: newUrl,
        extra_price: finish.extra_price,
        in_stock: finish.in_stock,
        class_name: finish.class_name,
      });
      if (res.success) {
        showToast('success', 'Master Texture Saved', `Global master texture for "${finish.name}" updated successfully.`);
        setFinishes((prev) =>
          prev.map((f) => (f.id === finish.id ? { ...f, texture_url: newUrl } : f))
        );
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed updating master texture');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error saving master texture');
    } finally {
      setSavingFinishId(null);
    }
  };

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
    const q = searchQuery.toLowerCase().trim();
    return profiles.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        String(p.product_id).includes(q);

      const matchesCat = selectedCategory === 'all' || p.categories.includes(selectedCategory);

      const matchesStatus =
        filterConfigured === 'all'
          ? true
          : filterConfigured === 'configured'
          ? p.is_configurable && p.is_configurator !== false
          : !p.is_configurable || p.is_configurator === false;

      const matchesVersion =
        filterVersion === 'all' ? true : (p.configurator_version || 'v1') === filterVersion;

      const matchesAudit =
        filterAudit === 'all'
          ? true
          : filterAudit === 'audited'
          ? Boolean(p.last_audited_at) && p.audit_status !== 'issues'
          : filterAudit === 'unaudited'
          ? !p.last_audited_at || p.audit_status === 'unaudited'
          : p.audit_status === 'issues' || Boolean(p.audit_issues && p.audit_issues > 0);

      return matchesSearch && matchesCat && matchesStatus && matchesVersion && matchesAudit;
    });
  }, [profiles, searchQuery, selectedCategory, filterConfigured, filterVersion, filterAudit]);

  // Live Price Calculation in Simulator
  const simulatedTotalPrice = useMemo(() => {
    if (!editingProfile) return 0;
    let total = editingProfile.base_price || 0;
    const multiplier = editingProfile.size_multiplier || 1.0;

    editingProfile.layers.forEach((layer) => {
      const isSelected = selectedSimLayers[layer.id] ?? (layer.default_selected || layer.is_required);
      if (isSelected) {
        total += Number(layer.extra_price) || 0;
        const partFinishSlug = selectedLayerFinishes[layer.id] || selectedSimFinish;
        const fObj = finishes.find((f) => (f.slug || f.id) === partFinishSlug || f.id === partFinishSlug);
        if (fObj && (fObj.extra_price || 0) > 0) {
          total += (fObj.extra_price || 0) * multiplier;
        }
      }
    });

    // Coverage upcharge (e.g. Model 360 wrap)
    const covType = editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
    if (covType === 'model_cut_and_360' && selectedCoverage === 'model_360') {
      const extra360 = Number(editingProfile.coverage_and_cutouts?.model_360_extra_price) || 40000;
      total += extra360;
    }

    return total;
  }, [editingProfile, selectedSimLayers, selectedLayerFinishes, selectedSimFinish, finishes, selectedCoverage]);

  // Catalog Stats
  const stats = useMemo(() => {
    const total = profiles.length;
    const configured = profiles.filter((p) => p.is_configurable).length;
    const multiAngle = profiles.filter((p) => p.views_count > 1).length;
    const audited = profiles.filter((p) => Boolean(p.last_audited_at)).length;
    const unaudited = profiles.filter((p) => !p.last_audited_at || p.audit_status === 'unaudited').length;
    const issues = profiles.filter((p) => p.audit_status === 'issues' || Boolean(p.audit_issues && p.audit_issues > 0)).length;
    return { total, configured, multiAngle, audited, unaudited, issues };
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
              onClick={() => setShowMasterTexturesModal(true)}
              className="px-4 py-2 text-xs font-sans font-medium rounded-xl border border-sky-500/30 hover:bg-sky-500/10 text-sky-300 transition-colors flex items-center gap-2 cursor-pointer"
              title="Manage global master finish textures used by all v2 Modern configurators"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Master Textures (v2)</span>
            </button>
            {stats.unaudited > 0 ? (
              <button
                type="button"
                onClick={() => handleStartGlobalCatalogAudit('unaudited')}
                disabled={isAuditingGlobal || profiles.length === 0}
                className="px-4 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                title="Scan only devices that have not been audited yet"
              >
                {isAuditingGlobal && globalAuditMode === 'unaudited' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Auditing Unaudited ({stats.unaudited})...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Audit Unaudited ({stats.unaudited})</span>
                  </>
                )}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => handleStartGlobalCatalogAudit('all')}
              disabled={isAuditingGlobal || profiles.length === 0}
              className={clsx(
                'px-4 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50',
                stats.unaudited === 0
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                  : 'border border-white/10 hover:bg-white/[0.06] text-zinc-300 font-medium'
              )}
              title="Audit all devices across the catalog for 404 images, broken textures, and ghost angles"
            >
              {isAuditingGlobal && globalAuditMode === 'all' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#f3aa18]" />
                  <span>Auditing All Devices...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Audit All ({stats.total})</span>
                </>
              )}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-sans font-medium text-zinc-400 uppercase tracking-wider">Audited Clean</p>
            <p className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">{Math.max(0, stats.audited - stats.issues)}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-sans font-medium text-zinc-400 uppercase tracking-wider">Unaudited Devices</p>
            <p className="text-2xl font-mono font-bold text-amber-400 mt-0.5">{stats.unaudited}</p>
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
            placeholder="Search device name, model, SKU, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-zinc-900/60 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/50 font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Selector: Configurators Only vs All Store Products */}
          <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleShowAllProducts(false)}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer flex items-center gap-1.5',
                !showAllProducts
                  ? 'bg-[#f3aa18]/20 text-[#f3aa18] font-bold border border-[#f3aa18]/30'
                  : 'text-zinc-400 hover:text-white'
              )}
              title="Display only products configured as interactive device skins"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Configurators</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleShowAllProducts(true)}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer flex items-center gap-1.5',
                showAllProducts
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-zinc-400 hover:text-white'
              )}
              title="Display all store products including merchandise, drops, and kits"
            >
              <span>All Products</span>
            </button>
          </div>

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

          {/* Audit Status Filter Selector */}
          <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setFilterAudit('all')}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer',
                filterAudit === 'all' ? 'bg-white/15 text-white font-bold' : 'text-zinc-400 hover:text-white'
              )}
            >
              All Audit
            </button>
            <button
              type="button"
              onClick={() => setFilterAudit('audited')}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer flex items-center gap-1.5',
                filterAudit === 'audited'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-white'
              )}
              title="Show devices that have been audited and verified clean"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Audited ({Math.max(0, stats.audited - stats.issues)})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterAudit('unaudited')}
              className={clsx(
                'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer flex items-center gap-1.5',
                filterAudit === 'unaudited'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                  : 'text-zinc-400 hover:text-white'
              )}
              title="Show devices that need auditing"
            >
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>Unaudited ({stats.unaudited})</span>
            </button>
            {stats.issues > 0 && (
              <button
                type="button"
                onClick={() => setFilterAudit('issues')}
                className={clsx(
                  'px-2.5 py-1 text-xs font-sans rounded-lg transition-colors cursor-pointer flex items-center gap-1.5',
                  filterAudit === 'issues'
                    ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                    : 'text-zinc-400 hover:text-white'
                )}
                title="Show devices with broken textures or ghost angles"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Issues ({stats.issues})</span>
              </button>
            )}
          </div>

          {/* Category Combobox Dropdown */}
          <div className="relative shrink-0 z-[60]" ref={categoryDropdownRef}>
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className={clsx(
                'px-3 py-1.5 text-xs font-sans rounded-xl transition-all cursor-pointer flex items-center gap-2 border shadow-xs',
                selectedCategory !== 'all'
                  ? 'bg-[#f3aa18]/15 text-[#f3aa18] border-[#f3aa18]/40 font-semibold'
                  : 'bg-zinc-900/80 text-zinc-300 border-white/10 hover:border-white/20 hover:text-white'
              )}
              title="Filter catalog by device category / brand"
            >
              <Folder className={clsx('w-3.5 h-3.5', selectedCategory !== 'all' ? 'text-[#f3aa18]' : 'text-zinc-400')} />
              <span className="capitalize">
                {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
              </span>
              <span
                className={clsx(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold',
                  selectedCategory !== 'all'
                    ? 'bg-[#f3aa18]/25 text-[#f3aa18]'
                    : 'bg-white/10 text-zinc-400'
                )}
              >
                {categoryCounts[selectedCategory] ?? profiles.length}
              </span>
              <ChevronDown
                className={clsx(
                  'w-3.5 h-3.5 text-zinc-400 transition-transform duration-200',
                  categoryDropdownOpen && 'rotate-180 text-white'
                )}
              />
            </button>

            {/* Floating Popover Dropdown */}
            {categoryDropdownOpen && (
              <div className="absolute left-0 lg:right-0 lg:left-auto top-full mt-1.5 z-[60] w-72 rounded-2xl bg-[#121215]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150">
                {/* Search Header */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    autoFocus
                    className="w-full pl-8 pr-7 py-1.5 text-xs font-sans rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]/50"
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Reset to All Categories Quick Action */}
                {selectedCategory !== 'all' && (
                  <div className="pb-1.5 mb-1.5 border-b border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setCategoryDropdownOpen(false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-sans text-left transition-colors flex items-center justify-between text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 text-zinc-500" />
                        <span>Reset to All Categories</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{profiles.length}</span>
                    </button>
                  </div>
                )}

                {/* Categories Options List */}
                <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
                  {filteredCategories.length === 0 ? (
                    <div className="py-4 text-center text-xs text-zinc-500">No categories match search</div>
                  ) : (
                    filteredCategories.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const count = categoryCounts[cat] || 0;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setCategoryDropdownOpen(false);
                          }}
                          className={clsx(
                            'w-full px-2.5 py-1.5 rounded-xl text-xs font-sans text-left transition-colors flex items-center justify-between group cursor-pointer',
                            isSelected
                              ? 'bg-[#f3aa18]/15 text-[#f3aa18] font-semibold'
                              : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={clsx(
                                'w-1.5 h-1.5 rounded-full shrink-0',
                                isSelected ? 'bg-[#f3aa18]' : 'bg-zinc-600 group-hover:bg-zinc-400'
                              )}
                            />
                            <span className="capitalize truncate">
                              {cat === 'all' ? 'All Categories' : cat}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-400">
                              {count}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#f3aa18]" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
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
                    <button
                      type="button"
                      disabled={togglingConfiguratorId === p.product_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleConfiguratorStatus(p.product_id, p.is_configurator !== false);
                      }}
                      className={clsx(
                        'text-[10px] font-sans px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 transition-all cursor-pointer',
                        p.is_configurator !== false
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-white'
                      )}
                      title={
                        p.is_configurator !== false
                          ? 'Active Configurator. Click to exclude from configurators.'
                          : 'Excluded from configurators. Click to enable as device configurator.'
                      }
                    >
                      {togglingConfiguratorId === p.product_id ? (
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      ) : p.is_configurator !== false ? (
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      ) : (
                        <AlertCircle className="w-2.5 h-2.5 text-zinc-500" />
                      )}
                      <span>{p.is_configurator !== false ? 'Configurator' : 'Excluded'}</span>
                    </button>

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

                    {p.status === 'draft' && (
                      <span
                        className="text-[10px] font-sans px-2 py-0.5 rounded-full border uppercase tracking-wider font-bold bg-amber-500/15 text-amber-300 border-amber-500/40"
                        title="Product is currently in Draft status (unpublished on webstore)"
                      >
                        Draft
                      </span>
                    )}
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
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-mono text-zinc-500 shrink-0">SKU #{p.product_id}</span>
                  {p.last_audited_at ? (
                    p.audit_status === 'issues' || Boolean(p.audit_issues && p.audit_issues > 0) ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0 font-medium"
                        title={`Audited with issues (${p.audit_issues || 1} issues detected)`}
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>{p.audit_issues ? `${p.audit_issues} Issues` : 'Issues'}</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 font-medium"
                        title={`Audited clean: ${new Date(p.last_audited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      >
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>Audited</span>
                      </span>
                    )
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 shrink-0 font-medium"
                      title="Device has not been audited yet"
                    >
                      <ShieldAlert className="w-2.5 h-2.5 text-zinc-500" />
                      <span>Unaudited</span>
                    </span>
                  )}
                </div>
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

      {/* Global Catalog Asset Audit Dialog */}
      {showGlobalAuditModal &&
        createPortal(
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl overflow-hidden font-sans">
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Catalog-Wide Asset Integrity Audit</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300 font-mono">
                        {profiles.length} Catalog Devices
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Batch auditing all products for 404 broken textures, missing chassis renders, and ghost viewing angles.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {stats.unaudited > 0 && (
                    <button
                      type="button"
                      onClick={() => handleStartGlobalCatalogAudit('unaudited')}
                      disabled={isAuditingGlobal}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                      title="Audit only non-audited devices"
                    >
                      <RefreshCw
                        className={clsx(
                          'w-3.5 h-3.5',
                          isAuditingGlobal && globalAuditMode === 'unaudited' && 'animate-spin text-amber-400'
                        )}
                      />
                      <span>
                        {isAuditingGlobal && globalAuditMode === 'unaudited'
                          ? 'Auditing Unaudited...'
                          : `Audit Unaudited (${stats.unaudited})`}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStartGlobalCatalogAudit('all')}
                    disabled={isAuditingGlobal}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw
                      className={clsx(
                        'w-3.5 h-3.5',
                        isAuditingGlobal && globalAuditMode === 'all' && 'animate-spin text-[#f3aa18]'
                      )}
                    />
                    <span>{isAuditingGlobal && globalAuditMode === 'all' ? 'Auditing All...' : 'Audit All Devices'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGlobalAuditModal(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar during global audit */}
              {isAuditingGlobal && (
                <div className="bg-zinc-900 px-5 py-3 border-b border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#f3aa18]" />
                      <span>
                        Auditing device {globalAuditProgress.scannedDevices} of {globalAuditProgress.totalDevices}:{' '}
                        <strong className="text-white">{globalAuditProgress.currentDeviceName}</strong>
                      </span>
                    </div>
                    <span className="font-mono text-zinc-400">
                      {globalAuditProgress.totalDevices > 0
                        ? Math.round((globalAuditProgress.scannedDevices / globalAuditProgress.totalDevices) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#f3aa18] to-emerald-400 h-full transition-all duration-300"
                      style={{
                        width: `${
                          globalAuditProgress.totalDevices > 0
                            ? (globalAuditProgress.scannedDevices / globalAuditProgress.totalDevices) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Metric Summary Cards */}
                {globalAuditReport && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                      <span className="text-[11px] text-zinc-400 block font-medium">Scanned Devices</span>
                      <span className="text-xl font-bold font-mono text-white mt-1 block">
                        {globalAuditReport.totalDevicesScanned}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                      <span className="text-[11px] text-rose-400 block font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Devices with Issues</span>
                      </span>
                      <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                        {globalAuditReport.devicesWithIssues}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                      <span className="text-[11px] text-amber-400 block font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Ghost Angles</span>
                      </span>
                      <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                        {globalAuditReport.totalGhostAngles}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                      <span className="text-[11px] text-rose-400 block font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Broken URLs</span>
                      </span>
                      <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                        {globalAuditReport.totalBrokenAssets}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <span className="text-[11px] text-emerald-400 block font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Total Assets Probed</span>
                      </span>
                      <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                        {globalAuditReport.totalAssetsProbed}
                      </span>
                    </div>
                  </div>
                )}

                {/* Bulk Ghost Angle Cleanup Banner */}
                {globalAuditReport && globalAuditReport.totalGhostAngles > 0 && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-start gap-3 max-w-xl">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-amber-300">
                          {globalAuditReport.totalGhostAngles} Ghost Viewing Angles Detected
                        </h4>
                        <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                          These angles have 0 mapped textures and broken or missing hardware chassis images (such as Xiaomi Pad devices cloned from iPad Pro templates).
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleBulkCleanGhostAngles}
                      disabled={isCleaningGlobalGhosts}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:brightness-105 text-black text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all shrink-0"
                    >
                      {isCleaningGlobalGhosts ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Cleaning All Ghost Angles...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Bulk Remove All Ghost Angles</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Filter Tabs */}
                {globalAuditReport && (
                  <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto">
                    {(
                      [
                        {
                          key: 'issues',
                          label: 'Devices with Issues',
                          count: globalAuditReport.devicesWithIssues,
                        },
                        {
                          key: 'ghost',
                          label: 'Ghost Angles Only',
                          count: globalAuditReport.deviceSummaries.filter((d) => d.ghostAngles.length > 0).length,
                        },
                        {
                          key: 'all',
                          label: 'All Devices',
                          count: globalAuditReport.totalDevicesScanned,
                        },
                        {
                          key: 'clean',
                          label: 'Healthy / Clean',
                          count: globalAuditReport.deviceSummaries.filter(
                            (d) => d.brokenCount === 0 && d.ghostAngles.length === 0
                          ).length,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setGlobalAuditFilter(tab.key)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                          globalAuditFilter === tab.key
                            ? 'bg-[#f3aa18] text-black font-bold'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        )}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={clsx(
                            'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                            globalAuditFilter === tab.key
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

                {/* Device Results List */}
                <div className="space-y-3">
                  {filteredGlobalSummaries.length === 0 ? (
                    <div className="p-8 rounded-xl bg-zinc-900/30 border border-white/5 text-center text-xs text-zinc-400">
                      {isAuditingGlobal ? 'Probing catalog devices...' : 'No devices match the selected filter.'}
                    </div>
                  ) : (
                    filteredGlobalSummaries.map((d) => (
                      <div
                        key={d.productId}
                        className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/10 transition-colors space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{d.deviceName}</h4>
                              <span className="text-[11px] font-mono text-zinc-500">#{d.productId}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 capitalize">
                                {d.category}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {d.totalAssets} total assets probed • {d.healthyCount} healthy (200 OK)
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {d.ghostAngles.length > 0 && (
                              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{d.ghostAngles.length} Ghost Angle{d.ghostAngles.length > 1 ? 's' : ''}</span>
                              </span>
                            )}

                            {d.brokenCount > 0 ? (
                              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 font-medium flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>{d.brokenCount} Broken URLs</span>
                              </span>
                            ) : (
                              d.ghostAngles.length === 0 && (
                                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>All Assets Healthy</span>
                                </span>
                              )
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setShowGlobalAuditModal(false);
                                handleOpenEditor(d.productId);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer ml-1"
                            >
                              <Sliders className="w-3.5 h-3.5 text-[#f3aa18]" />
                              <span>Open in Studio</span>
                            </button>
                          </div>
                        </div>

                        {/* Ghost angles breakdown for this device */}
                        {d.ghostAngles.length > 0 && (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                            <span className="font-bold block">Ghost Angles Identified:</span>
                            {d.ghostAngles.map((g) => (
                              <div key={g.viewId} className="flex items-center justify-between text-[11px] text-zinc-300">
                                <span>
                                  • {g.viewName} (ID: {g.viewId}) - Chassis: {g.chassisStatus}, Textures: {g.mappedTexturesCount}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Broken items sample for this device */}
                        {d.brokenItems.length > 0 && (
                          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1 font-mono text-[11px]">
                            <span className="font-sans font-bold block text-rose-400">Broken Images ({d.brokenItems.length}):</span>
                            {d.brokenItems.slice(0, 3).map((item) => (
                              <div key={item.id} className="flex items-center justify-between gap-2">
                                <span className="truncate max-w-md">
                                  {item.layerName ? `${item.layerName} • ` : ''}{item.finishName || item.viewName}: {item.url}
                                </span>
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-400 hover:underline shrink-0"
                                >
                                  Test URL
                                </a>
                              </div>
                            ))}
                            {d.brokenItems.length > 3 && (
                              <span className="text-zinc-500 font-sans italic text-[10px] block">
                                + {d.brokenItems.length - 3} more broken images. Open in Studio to view all.
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 flex items-center justify-between bg-zinc-900/50 text-xs">
                <span className="text-zinc-400 text-[11px]">
                  Click "Open in Studio" on any device to inspect its interactive canvas or edit texture URLs directly.
                </span>
                <button
                  type="button"
                  onClick={() => setShowGlobalAuditModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer transition-colors"
                >
                  Close Audit
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Global Master Textures Modal (v2 Engine) */}
      {showMasterTexturesModal &&
        createPortal(
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-4xl max-h-[90vh] rounded-3xl bg-[#121215] border border-white/15 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-zinc-900/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Global Master Finish Textures (v2 Engine)</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 font-mono">
                        {finishes.length} Finishes
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 max-w-xl">
                      In the v2 Modern Engine, you only set the master textured image once per finish. All devices automatically inherit this texture and clip it using their alpha mask.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMasterTexturesModal(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter & Search Bar */}
              <div className="p-4 border-b border-white/10 bg-zinc-900/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search finish by name or slug..."
                    value={masterTextureSearch}
                    onChange={(e) => setMasterTextureSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 text-xs font-sans rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-sky-500"
                  />
                  {masterTextureSearch && (
                    <button
                      type="button"
                      onClick={() => setMasterTextureSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {finishGroups.map((group) => (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setMasterTextureGroupFilter(group)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-sans whitespace-nowrap transition-colors cursor-pointer capitalize',
                        masterTextureGroupFilter === group
                          ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      )}
                    >
                      {group === 'all' ? 'All Groups' : group}
                    </button>
                  ))}
                </div>
              </div>

              {/* Finishes Grid / List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {finishes
                  .filter((f) => {
                    const q = masterTextureSearch.toLowerCase().trim();
                    const matchesSearch =
                      !q || f.name.toLowerCase().includes(q) || (f.slug || f.id).toLowerCase().includes(q);
                    const matchesGroup =
                      masterTextureGroupFilter === 'all' || f.group === masterTextureGroupFilter;
                    return matchesSearch && matchesGroup;
                  })
                  .map((f) => {
                    const currentInput =
                      editingFinishUrls[f.id] !== undefined
                        ? editingFinishUrls[f.id]
                        : f.texture_url || '';
                    const previewUrl = currentInput.trim() || f.texture_url || f.thumbnail;
                    const isCustomTextureSet = Boolean(f.texture_url && f.texture_url !== f.thumbnail);
                    const isSaving = savingFinishId === f.id;
                    const hasUnsavedChanges =
                      editingFinishUrls[f.id] !== undefined &&
                      editingFinishUrls[f.id].trim() !== (f.texture_url || '');

                    return (
                      <div
                        key={f.id}
                        className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        {/* Left Info: Thumbnail Swatch + Name + Group */}
                        <div className="flex items-center gap-3.5 min-w-[200px] shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={f.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Sparkles className="w-5 h-5 text-zinc-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white">{f.name}</h4>
                              <span
                                className={clsx(
                                  'text-[9px] font-mono px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold border',
                                  isCustomTextureSet
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                )}
                              >
                                {isCustomTextureSet ? 'v2 Master Set' : 'Using Thumbnail'}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                              {f.group} : <span className="text-zinc-500">{f.slug}</span>
                            </p>
                          </div>
                        </div>

                        {/* Middle: Input Field for texture_url */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                placeholder="https://exacoat.com/uploads/textures/master-texture.png"
                                value={currentInput}
                                onChange={(e) =>
                                  setEditingFinishUrls((prev) => ({ ...prev, [f.id]: e.target.value }))
                                }
                                className="w-full pl-3 pr-16 py-2 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-400"
                              />
                              {currentInput.trim() && (
                                <a
                                  href={currentInput.trim()}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-sky-400 hover:underline flex items-center gap-1"
                                >
                                  <span>View</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setMediaPickerConfig({
                                  isOpen: true,
                                  title: `Select Master Texture: ${f.name}`,
                                  recommendedDimensions: 'High-Res Tileable Texture PNG/JPG',
                                  currentUrl: currentInput,
                                  onSelect: (url) => {
                                    setEditingFinishUrls((prev) => ({ ...prev, [f.id]: url }));
                                  },
                                })
                              }
                              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                              title="Browse WordPress Media Library"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                              <span>Browse</span>
                            </button>
                          </div>
                        </div>

                        {/* Right: Save Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSaveMasterTexture(f)}
                            disabled={isSaving || !hasUnsavedChanges}
                            className={clsx(
                              'px-3.5 py-2 text-xs font-sans font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                              hasUnsavedChanges
                                ? 'bg-sky-500 hover:bg-sky-400 text-black shadow-md'
                                : 'bg-white/5 text-zinc-400 border border-white/10'
                            )}
                          >
                            {isSaving ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>{isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Texture' : 'Saved'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 flex items-center justify-between bg-zinc-900/50 text-xs">
                <span className="text-zinc-400 text-[11px]">
                  Changes saved here apply storewide across all v2 Modern device configurators in real time.
                </span>
                <button
                  type="button"
                  onClick={() => setShowMasterTexturesModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
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

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                  <span className="text-[11px] font-sans text-amber-200 leading-relaxed">
                    <strong className="text-amber-300 font-semibold">Status: Draft</strong>. Duplicated product will be created in Draft status. Featured image, gallery, descriptions, menu order, categories, and tags are preserved.
                  </span>
                </div>
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

              {/* Center: Engine Version Indicator & Configurator Status */}
              {editingProfile && (
                <div className="hidden lg:flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-zinc-900/90 px-3 py-1 rounded-full border border-white/10 text-xs">
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

                  <button
                    type="button"
                    disabled={togglingConfiguratorId === selectedProductId}
                    onClick={() => {
                      const currentIsCfg = profiles.find((p) => p.product_id === selectedProductId)?.is_configurator !== false;
                      handleToggleConfiguratorStatus(selectedProductId, currentIsCfg);
                    }}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-sans transition-all cursor-pointer',
                      (profiles.find((p) => p.product_id === selectedProductId)?.is_configurator !== false)
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-white'
                    )}
                    title="Toggle whether this product is marked as a Device Configurator"
                  >
                    {togglingConfiguratorId === selectedProductId ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (profiles.find((p) => p.product_id === selectedProductId)?.is_configurator !== false) ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-zinc-500" />
                    )}
                    <span>
                      {(profiles.find((p) => p.product_id === selectedProductId)?.is_configurator !== false)
                        ? 'Configurator: Active'
                        : 'Configurator: Excluded'}
                    </span>
                  </button>
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

                const activeTestPartId = activeSimTestingPartId || skinLayers[0]?.id || '';
                const activeTestLayer = skinLayers.find((l) => l.id === activeTestPartId) || skinLayers[0];

                const isFinishAllowedOnTestPart = (fSlug: string) => {
                  if (!activeTestLayer?.allowed_finish_slugs || activeTestLayer.allowed_finish_slugs.length === 0) return true;
                  const norm = fSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return activeTestLayer.allowed_finish_slugs.some(
                    (as) => as.toLowerCase().replace(/[^a-z0-9]/g, '') === norm
                  );
                };

                const testPartFinishes = finishes.filter((f) => isFinishAllowedOnTestPart(f.slug || f.id));
                const testPartGroups = Array.from(new Set(testPartFinishes.map((f) => f.group).filter(Boolean) as string[]));
                const displayTestFinishes = testPartFinishes.filter((f) => {
                  if (simFinishGroupFilter === 'all') return true;
                  return f.group === simFinishGroupFilter;
                });

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

                            const layerFinishSlug = selectedLayerFinishes[l.id] || selectedSimFinish;
                            const activeFinish = finishes.find(
                              (f) => (f.slug || f.id) === layerFinishSlug || f.id === layerFinishSlug
                            );

                            // v2 Engine: Dynamic Canvas Compositing with Alpha Mask & Buyer Cutouts
                            if (editingProfile.configurator_version === 'v2' && assets.mask_svg_url) {
                              const textureToTile = activeFinish?.texture_url || '';
                              const fallbackColor = activeFinish?.color_hex || '#18181b';

                              const logoMaskUrl =
                                currentView?.logo_cutout_mask_url ||
                                editingProfile.coverage_and_cutouts?.logo_cutout_mask_url ||
                                assets.logo_cutout_url;
                              const pencilMaskUrl =
                                currentView?.pencil_cutout_mask_url ||
                                editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url ||
                                assets.pencil_cutout_url;
                              const modelCutMaskUrl =
                                currentView?.model_cut_mask_url ||
                                editingProfile.coverage_and_cutouts?.model_cut_mask_url ||
                                assets.model_cutout_url;

                              const covMode = editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
                              const isModelCutOnly = covMode === 'model_cut_only';
                              const hasCoverageOptions = covMode === 'model_cut_and_360';

                              const shouldApplyModelCut = isModelCutOnly || (hasCoverageOptions && selectedCoverage === 'model_cut');
                              const shouldApplyLogoCutout = selectedLogoCutout && (editingProfile.coverage_and_cutouts?.has_logo_cutout ?? true);
                              const shouldApplyPencilCutout = selectedPencilCutout && Boolean(editingProfile.coverage_and_cutouts?.has_pencil_cutout);

                              const effectiveLogoCutout = shouldApplyLogoCutout ? logoMaskUrl : undefined;
                              const effectivePencilCutout = shouldApplyPencilCutout ? pencilMaskUrl : undefined;
                              const effectiveModelCutout = shouldApplyModelCut ? modelCutMaskUrl : undefined;

                              return (
                                <V2SkinCanvasLayer
                                  key={`v2-canvas-${l.id}-${layerFinishSlug}-${selectedLogoCutout ? 'logo' : 'nologo'}-${selectedPencilCutout ? 'pencil' : 'nopencil'}-${selectedCoverage}`}
                                  maskUrl={assets.mask_svg_url}
                                  textureUrl={textureToTile}
                                  fallbackColor={fallbackColor}
                                  logoCutoutUrl={effectiveLogoCutout}
                                  pencilCutoutUrl={effectivePencilCutout}
                                  modelCutoutUrl={effectiveModelCutout}
                                  zIndex={(l.z_index || 1) + 5}
                                  layerName={l.name}
                                />
                              );
                            }

                            const simNorm = layerFinishSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
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

                          {/* Layer 3: Realistic Multiply Shadow & Specular Highlights (v2 View Shading) */}
                          {editingProfile.configurator_version === 'v2' && currentView && (
                            <React.Fragment key={`view-shading-${currentView.id}`}>
                              {Boolean(
                                currentView.shadow_png_url ||
                                  skinLayers.find((l) => l.assets_by_view?.[currentView.id]?.shadow_png_url)?.assets_by_view?.[currentView.id]?.shadow_png_url
                              ) && (
                                <img
                                  src={
                                    currentView.shadow_png_url ||
                                    skinLayers.find((l) => l.assets_by_view?.[currentView.id]?.shadow_png_url)?.assets_by_view?.[currentView.id]?.shadow_png_url
                                  }
                                  alt={`${currentView.name} 3D Shadow`}
                                  style={{
                                    zIndex: 20,
                                    mixBlendMode: 'multiply',
                                    opacity: currentView.shadow_opacity ?? 0.85,
                                  }}
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              )}
                              {Boolean(
                                currentView.highlight_png_url ||
                                  skinLayers.find((l) => l.assets_by_view?.[currentView.id]?.highlight_png_url)?.assets_by_view?.[currentView.id]?.highlight_png_url
                              ) && (
                                <img
                                  src={
                                    currentView.highlight_png_url ||
                                    skinLayers.find((l) => l.assets_by_view?.[currentView.id]?.highlight_png_url)?.assets_by_view?.[currentView.id]?.highlight_png_url
                                  }
                                  alt={`${currentView.name} 3D Highlight`}
                                  style={{
                                    zIndex: 25,
                                    mixBlendMode: 'screen',
                                    opacity: currentView.highlight_opacity ?? 0.40,
                                  }}
                                  className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              )}
                            </React.Fragment>
                          )}
                        </div>
                      </div>

                      {/* INTERACTIVE CONFIGURATOR TESTER DOCK */}
                      <div className="border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl p-4 space-y-3 z-10 shrink-0">
                        {/* Row 1: Active Part Tabs & Real-Time Price */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pr-1">
                              <Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />
                              Part:
                            </span>
                            {skinLayers.map((l) => {
                              const partFinishSlug = selectedLayerFinishes[l.id] || selectedSimFinish;
                              const partFinish = finishes.find((f) => (f.slug || f.id) === partFinishSlug || f.id === partFinishSlug);
                              const isTesting = activeTestPartId === l.id;
                              return (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => setActiveSimTestingPartId(l.id)}
                                  className={clsx(
                                    'px-3 py-1.5 rounded-xl text-xs font-sans font-medium flex items-center gap-2 transition-all cursor-pointer border shrink-0',
                                    isTesting
                                      ? 'bg-white/15 border-white/30 text-white shadow-md ring-1 ring-[#f3aa18]/40'
                                      : 'bg-zinc-900/80 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800/80'
                                  )}
                                >
                                  {partFinish?.thumbnail ? (
                                    <img src={partFinish.thumbnail} alt={partFinish.name} className="w-3.5 h-3.5 rounded-full object-cover border border-white/20 shrink-0" />
                                  ) : (
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                                      style={{ backgroundColor: partFinish?.color_hex || '#444' }}
                                    />
                                  )}
                                  <span className="font-semibold">{l.name}</span>
                                  <span className="text-[10px] font-mono text-zinc-400 max-w-[80px] truncate">
                                    {partFinish?.name || 'Default'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-3 shrink-0 ml-auto">
                            <div className="text-right">
                              <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Live Total</p>
                              <p className="text-sm font-mono font-bold text-emerald-400">
                                IDR {simulatedTotalPrice.toLocaleString('id-ID')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Finish Swatches for the Active Part */}
                        <div className="space-y-2 pt-1 border-t border-white/5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-xs">
                              <button
                                type="button"
                                onClick={() => setSimFinishGroupFilter('all')}
                                className={clsx(
                                  'px-2.5 py-0.5 rounded-lg text-[11px] font-sans transition-all cursor-pointer border shrink-0',
                                  simFinishGroupFilter === 'all'
                                    ? 'bg-[#f3aa18] text-black font-bold border-[#f3aa18]'
                                    : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                                )}
                              >
                                All ({testPartFinishes.length})
                              </button>
                              {testPartGroups.map((grp) => (
                                <button
                                  key={grp}
                                  type="button"
                                  onClick={() => setSimFinishGroupFilter(grp)}
                                  className={clsx(
                                    'px-2.5 py-0.5 rounded-lg text-[11px] font-sans transition-all cursor-pointer border shrink-0',
                                    simFinishGroupFilter === grp
                                      ? 'bg-[#f3aa18] text-black font-bold border-[#f3aa18]'
                                      : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                                  )}
                                >
                                  {grp}
                                </button>
                              ))}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline shrink-0">
                              Choose finish for {activeTestLayer?.name}
                            </span>
                          </div>

                          {/* Horizontal Swatches Carousel */}
                          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-zinc-800">
                            {displayTestFinishes.map((finish) => {
                              const fSlug = finish.slug || finish.id;
                              const currentPartSlug = selectedLayerFinishes[activeTestPartId] || selectedSimFinish;
                              const isSelected = currentPartSlug === fSlug || currentPartSlug === finish.id;
                              const extra = (finish.extra_price || 0) * (editingProfile.size_multiplier || 1.0);

                              return (
                                <button
                                  key={finish.id}
                                  type="button"
                                  title={`${finish.name}${extra > 0 ? ` (+IDR ${extra.toLocaleString('id-ID')})` : ''}`}
                                  onClick={() => {
                                    setSelectedLayerFinishes((prev) => ({ ...prev, [activeTestPartId]: fSlug }));
                                    setSelectedSimFinish(fSlug);
                                  }}
                                  className={clsx(
                                    'group relative w-9 h-9 rounded-xl overflow-hidden shrink-0 border transition-all cursor-pointer flex items-center justify-center p-0.5',
                                    isSelected
                                      ? 'border-[#f3aa18] ring-2 ring-[#f3aa18]/40 scale-105'
                                      : 'border-white/10 hover:border-white/30 hover:scale-105'
                                  )}
                                >
                                  {finish.thumbnail ? (
                                    <img src={finish.thumbnail} alt={finish.name} className="w-full h-full object-cover rounded-lg" />
                                  ) : (
                                    <div className="w-full h-full rounded-lg" style={{ backgroundColor: finish.color_hex || '#333' }} />
                                  )}
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-[#f3aa18]/20 flex items-center justify-center">
                                      <Check className="w-3.5 h-3.5 text-white drop-shadow-md" />
                                    </div>
                                  )}
                                  {extra > 0 && (
                                    <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Row 3: Configurable Choices (Coverage, Logo Cutout, Chassis Color) */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-white/5 text-xs">
                          {/* Logo Cutout Toggle */}
                          {(editingProfile.coverage_and_cutouts?.has_logo_cutout !== false) && (
                            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-white/10">
                              <span className="text-[11px] text-zinc-400 font-medium px-2">Logo:</span>
                              <button
                                type="button"
                                onClick={() => setSelectedLogoCutout(true)}
                                className={clsx(
                                  'px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer',
                                  selectedLogoCutout
                                    ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                )}
                              >
                                With Cutout
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedLogoCutout(false)}
                                className={clsx(
                                  'px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer',
                                  !selectedLogoCutout
                                    ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                )}
                              >
                                Solid / No Logo
                              </button>
                            </div>
                          )}

                          {/* Pencil Cutout Toggle (Tablets: iPad, Galaxy Tab) */}
                          {Boolean(editingProfile.coverage_and_cutouts?.has_pencil_cutout) && (
                            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-white/10">
                              <span className="text-[11px] text-zinc-400 font-medium px-2">Pencil Groove:</span>
                              <button
                                type="button"
                                onClick={() => setSelectedPencilCutout(true)}
                                className={clsx(
                                  'px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer',
                                  selectedPencilCutout
                                    ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                )}
                              >
                                With Cutout
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPencilCutout(false)}
                                className={clsx(
                                  'px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer',
                                  !selectedPencilCutout
                                    ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                )}
                              >
                                Solid (Covered)
                              </button>
                            </div>
                          )}

                          {/* Coverage Style Toggle */}
                          {(() => {
                            const covType = editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
                            if (covType === 'none') return null;

                            if (covType === 'model_cut_only') {
                              return (
                                <div className="flex items-center gap-1.5 bg-zinc-900/80 px-2.5 py-1 rounded-xl border border-white/10 text-xs">
                                  <span className="text-[11px] text-zinc-400 font-medium">Coverage:</span>
                                  <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 text-[11px]">
                                    Model Cut (Flat Back Only)
                                  </span>
                                </div>
                              );
                            }

                            if (covType === 'model_360_only') {
                              return (
                                <div className="flex items-center gap-1.5 bg-zinc-900/80 px-2.5 py-1 rounded-xl border border-white/10 text-xs">
                                  <span className="text-[11px] text-zinc-400 font-medium">Coverage:</span>
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[11px]">
                                    Model 360 Full Wrap
                                  </span>
                                </div>
                              );
                            }

                            const extra360 = Number(editingProfile.coverage_and_cutouts?.model_360_extra_price) || 40000;
                            return (
                              <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-white/10">
                                <span className="text-[11px] text-zinc-400 font-medium px-2">Coverage:</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedCoverage('model_cut')}
                                  className={clsx(
                                    'px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer',
                                    selectedCoverage === 'model_cut'
                                      ? 'bg-sky-500 text-black font-bold shadow-sm'
                                      : 'text-zinc-400 hover:text-white'
                                  )}
                                >
                                  Model Cut
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedCoverage('model_360')}
                                  className={clsx(
                                    'px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5',
                                    selectedCoverage === 'model_360'
                                      ? 'bg-sky-500 text-black font-bold shadow-sm'
                                      : 'text-zinc-400 hover:text-white'
                                  )}
                                >
                                  <span>Model 360</span>
                                  {extra360 > 0 && (
                                    <span
                                      className={clsx(
                                        'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                                        selectedCoverage === 'model_360'
                                          ? 'bg-black/20 text-black font-bold'
                                          : 'bg-sky-500/20 text-sky-300 font-semibold'
                                      )}
                                    >
                                      +{extra360 >= 1000 ? `${Math.round(extra360 / 1000)}k` : extra360}
                                    </span>
                                  )}
                                </button>
                              </div>
                            );
                          })()}

                          {/* Chassis Base Color Swatches */}
                          {editingProfile.device_colors && editingProfile.device_colors.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-white/10 ml-auto">
                              <span className="text-[11px] text-zinc-400 font-medium px-2">Hardware:</span>
                              {editingProfile.device_colors.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setSelectedSimColor(c.id)}
                                  title={c.name}
                                  className={clsx(
                                    'w-5 h-5 rounded-full border transition-all cursor-pointer',
                                    selectedSimColor === c.id
                                      ? 'border-[#f3aa18] ring-2 ring-[#f3aa18]/50 scale-110'
                                      : 'border-white/20 hover:border-white/60'
                                  )}
                                  style={{ backgroundColor: c.hex }}
                                />
                              ))}
                            </div>
                          )}
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
                            {/* Family Preset Packs Header */}
                            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />
                                  Apply Preset Pack
                                </span>
                                <span className="text-[10px] text-zinc-500 font-sans">
                                  Device: {editingProfile.family}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {Object.entries(DEVICE_FAMILY_PRESET_PACKS).map(([fKey, pack]) => {
                                  const isActive = editingProfile.family === fKey;
                                  return (
                                    <button
                                      key={fKey}
                                      type="button"
                                      onClick={() => handleApplyFamilyPresetPack(fKey)}
                                      className={clsx(
                                        'px-2 py-1.5 rounded-xl text-xs font-sans transition-all text-left border flex items-center gap-1.5 cursor-pointer',
                                        isActive
                                          ? 'bg-[#f3aa18]/15 border-[#f3aa18]/40 text-white font-bold shadow-xs'
                                          : 'bg-zinc-950/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900'
                                      )}
                                      title={`Parts: ${pack.parts.map((p) => p.name).join(', ')}`}
                                    >
                                      <span>{pack.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Part Selector Horizontal Pills */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                                  Customizable Skin Parts ({skinLayers.length})
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
                                  const extraPrice = Number(layer.extra_price) || 0;

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
                                      {extraPrice > 0 && (
                                        <span
                                          className={clsx(
                                            'text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold',
                                            isSelected ? 'bg-black/20 text-black' : 'bg-amber-400/20 text-amber-300'
                                          )}
                                        >
                                          +{extraPrice >= 1000 ? `${Math.round(extraPrice / 1000)}k` : extraPrice}
                                        </span>
                                      )}
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

                                {/* Quick Add Chip or Custom Part */}
                                {!customPartInputOpen ? (
                                  <div className="flex items-center gap-1.5">
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
                                        <option value="" disabled>+ Add Preset Part...</option>
                                        {COMMON_PRESET_LAYERS.map((preset) => (
                                          <option key={preset.name} value={preset.name}>
                                            {preset.name} (+IDR {preset.extra_price.toLocaleString('id-ID')})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setCustomPartInputOpen(true)}
                                      className="px-3 py-2 text-xs font-sans rounded-xl bg-zinc-900 border border-white/10 hover:border-white/25 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                                    >
                                      + Custom Part
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-[#f3aa18]/40">
                                    <input
                                      type="text"
                                      placeholder="e.g. Logo Inlay or Hinge"
                                      value={customPartName}
                                      onChange={(e) => setCustomPartName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && customPartName.trim()) {
                                          handleCreateCustomLayer(customPartName);
                                          setCustomPartName('');
                                          setCustomPartInputOpen(false);
                                        } else if (e.key === 'Escape') {
                                          setCustomPartInputOpen(false);
                                        }
                                      }}
                                      autoFocus
                                      className="px-2.5 py-1 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18] w-36"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (customPartName.trim()) {
                                          handleCreateCustomLayer(customPartName);
                                          setCustomPartName('');
                                          setCustomPartInputOpen(false);
                                        }
                                      }}
                                      disabled={!customPartName.trim()}
                                      className="px-2.5 py-1 text-xs rounded-lg bg-[#f3aa18] text-black font-bold hover:bg-[#ffb72b] disabled:opacity-50 cursor-pointer transition-colors"
                                    >
                                      Add
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCustomPartInputOpen(false)}
                                      className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
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

                                {/* Part Attributes: Required, Pre-selected, Extra Price */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/5">
                                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans cursor-pointer">
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
                                    <span className="text-zinc-200 font-medium">Required</span>
                                  </label>

                                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={currentActiveLayer.default_selected}
                                      onChange={(e) =>
                                        handleUpdateLayer(currentActiveLayer.id, {
                                          default_selected: e.target.checked,
                                        })
                                      }
                                      className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 focus:outline-none accent-[#f3aa18] cursor-pointer"
                                    />
                                    <span className="text-zinc-200 font-medium">Pre-selected</span>
                                  </label>

                                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans">
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

                                {/* v2 Modern Engine Alpha Mask */}
                                {editingProfile.configurator_version === 'v2' && (
                                  <div className="p-3.5 rounded-xl bg-sky-950/25 border border-sky-500/25 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                                          Skin Part Alpha Mask ({currentView?.name})
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                        Angle: {currentView?.id}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                                      Provide the 1000x1000 alpha mask (transparent PNG or SVG) defining the physical cut of this skin part. Global master textures are automatically clipped inside this mask.
                                    </p>

                                    <div className="space-y-1.5 pt-1">
                                      <label className="text-[10px] font-mono text-zinc-300 block flex items-center justify-between">
                                        <span>Part Alpha Mask URL (1000x1000 PNG / SVG)</span>
                                        {currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url && (
                                          <span className="text-emerald-400 text-[10px] font-semibold">Configured</span>
                                        )}
                                      </label>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          placeholder="https://exacoat.com/uploads/device-part-mask.png"
                                          value={currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url || ''}
                                          onChange={(e) => handleSetLayerOverlayUrl(currentActiveLayer.id, 'mask_svg_url', e.target.value)}
                                          className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-sky-400"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setMediaPickerConfig({
                                              isOpen: true,
                                              title: `Select Alpha Mask: ${currentActiveLayer.name}`,
                                              recommendedDimensions: '1000x1000 Alpha PNG or SVG',
                                              currentUrl: currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url || '',
                                              onSelect: (url) => handleSetLayerOverlayUrl(currentActiveLayer.id, 'mask_svg_url', url),
                                            })
                                          }
                                          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                                          title="Browse WordPress Media Library"
                                        >
                                          <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                                          <span>Browse</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
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
                                {editingProfile.configurator_version === 'v2' ? (
                                  /* v2 Modern Engine: Clean Swatch Simulator & Global Master Inheritance */
                                  <div className="space-y-3">
                                    <div className="space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Palette className="w-3.5 h-3.5 text-sky-400" />
                                          <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                                            Finish Simulation ({filteredFinishesForDisplay.length})
                                          </h5>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setShowMasterTexturesModal(true)}
                                          className="text-[11px] font-sans text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <Sparkles className="w-3 h-3" />
                                          <span>Manage Master Textures</span>
                                        </button>
                                      </div>

                                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                                        Click any finish swatch to simulate the dynamic masked texture live on the phone. All v2 finishes inherit global master textures automatically.
                                      </p>

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
                                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                            )}
                                          >
                                            {group === 'all' ? 'All Finishes' : group}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* v2 Modern Swatches Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                                      {filteredFinishesForDisplay.map((f) => {
                                        const finishSlug = f.slug || f.id;
                                        const isSimSelected = selectedSimFinish === finishSlug;
                                        const hasMasterTex = Boolean(f.texture_url);
                                        const surcharge = (f.extra_price || 0) * (editingProfile.size_multiplier || 1.0);

                                        return (
                                          <div
                                            key={f.id}
                                            onClick={() => setSelectedSimFinish(finishSlug)}
                                            className={clsx(
                                              'p-2.5 rounded-2xl border transition-all flex flex-col justify-between gap-2 text-xs cursor-pointer group relative',
                                              isSimSelected
                                                ? 'bg-sky-500/15 border-sky-400 shadow-md shadow-sky-500/10 ring-1 ring-sky-400/40'
                                                : 'bg-zinc-900/60 border-white/10 hover:border-white/20 hover:bg-zinc-900'
                                            )}
                                          >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                              <div
                                                className="w-8 h-8 rounded-xl border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative shadow-xs"
                                                style={{ backgroundColor: f.color_hex || '#27272a' }}
                                              >
                                                {f.thumbnail ? (
                                                  <img
                                                    src={f.thumbnail}
                                                    alt={f.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                      (e.target as HTMLElement).style.display = 'none';
                                                    }}
                                                  />
                                                ) : (
                                                  <div
                                                    className="w-full h-full"
                                                    style={{ backgroundColor: f.color_hex || '#3f3f46' }}
                                                  />
                                                )}
                                              </div>

                                              <div className="min-w-0 flex-1">
                                                <p className={clsx('font-bold truncate text-xs', isSimSelected ? 'text-sky-300' : 'text-white')}>
                                                  {f.name}
                                                </p>
                                                <span className="text-[10px] text-zinc-500 truncate block">
                                                  {f.group || 'Material'}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono">
                                              {hasMasterTex ? (
                                                <span className="text-emerald-400 flex items-center gap-1">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                  Master Set
                                                </span>
                                              ) : (
                                                <span className="text-zinc-500">Color Fallback</span>
                                              )}

                                              {surcharge > 0 ? (
                                                <span className="text-amber-400 font-semibold">+IDR {surcharge.toLocaleString('id-ID')}</span>
                                              ) : (
                                                <span className="text-zinc-600">IDR 0</span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Collapsible Accordion: Optional Advanced Texture Map Overrides */}
                                    <div className="pt-2 border-t border-white/5">
                                      <button
                                        type="button"
                                        onClick={() => setShowV2AdvancedOverrides(!showV2AdvancedOverrides)}
                                        className="w-full py-2 px-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/5 text-xs text-zinc-400 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                                      >
                                        <span className="flex items-center gap-2">
                                          <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                                          <span>Advanced: Custom Texture Overrides (Optional)</span>
                                        </span>
                                        <ChevronDown
                                          className={clsx('w-3.5 h-3.5 text-zinc-500 transition-transform duration-200', showV2AdvancedOverrides && 'rotate-180')}
                                        />
                                      </button>

                                      {showV2AdvancedOverrides && (
                                        <div className="mt-3 p-3 rounded-2xl bg-zinc-950/80 border border-white/10 space-y-3">
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

                                          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                            {filteredFinishesForDisplay.map((f) => {
                                              const finishSlug = f.slug || f.id;
                                              const normSlug = finishSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                                              const matchedKey = Object.keys(textureMap).find(
                                                (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normSlug
                                              );
                                              const currentUrl = matchedKey ? textureMap[matchedKey] : '';
                                              const isAssigned = Boolean(currentUrl);

                                              return (
                                                <div
                                                  key={`override-${f.id}`}
                                                  className="p-2 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-between gap-2"
                                                >
                                                  <span className="text-xs text-zinc-300 truncate">{f.name}</span>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setEditingTextureModal({
                                                        layerId: currentActiveLayer.id,
                                                        layerName: currentActiveLayer.name,
                                                        finishSlug,
                                                        finishName: f.name,
                                                        initialUrl: currentUrl,
                                                        thumbnail: f.thumbnail,
                                                      })
                                                    }
                                                    className={clsx(
                                                      'text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors font-mono',
                                                      isAssigned
                                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                                    )}
                                                  >
                                                    {isAssigned ? 'Edit' : 'Set URL'}
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  /* v1 Legacy View: Full Texture Maps Grid with Autofill */
                                  <div className="space-y-3">
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
                                  <label className="block text-xs font-bold text-zinc-300 flex items-center justify-between">
                                    <span>Hardware Body Image URL</span>
                                    {currentView.background_url && <span className="text-emerald-400 text-[10px] font-mono">Configured</span>}
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="url"
                                      placeholder="https://exacoat.com/wp-content/uploads/renders/device-body.png"
                                      value={currentView.background_url || ''}
                                      onChange={(e) => handleSetViewBackground(currentView.id, e.target.value)}
                                      className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-sky-400 placeholder:text-zinc-600"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMediaPickerConfig({
                                          isOpen: true,
                                          title: `Select Hardware Chassis: ${currentView.name}`,
                                          recommendedDimensions: '1000x1000 Transparent PNG',
                                          currentUrl: currentView.background_url || '',
                                          onSelect: (url) => handleSetViewBackground(currentView.id, url),
                                        })
                                      }
                                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                                      title="Browse WordPress Media Library"
                                    >
                                      <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                                      <span>Browse</span>
                                    </button>
                                  </div>
                                </div>

                                 {/* Angle Cutout Masks (v2 Compositing) */}
                                 <div className="space-y-3 pt-3 border-t border-white/5">
                                   <div>
                                     <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                       <Sliders className="w-3.5 h-3.5 text-[#f3aa18]" />
                                       Angle Cutout Masks (v2 Destination-Out)
                                     </h5>
                                     <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                                       1000x1000 alpha masks erased from all applied skins on this angle. Erasing reveals the underlying hardware base chassis render.
                                     </p>
                                   </div>

                                   {/* Angle Logo Cutout Mask */}
                                   <div className="space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/5">
                                     <div className="flex items-center justify-between">
                                       <span className="text-xs font-bold text-zinc-300">Logo Cutout Mask (Apple / Brand Logo)</span>
                                       {(currentView.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url) && (
                                         <span className="text-emerald-400 text-[10px] font-mono">Configured</span>
                                       )}
                                     </div>
                                     <div className="flex gap-2">
                                       <input
                                         type="url"
                                         placeholder="https://exacoat.com/uploads/iPhone-18-Pro-Logo-Cutout.png"
                                         value={currentView.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url || ''}
                                         onChange={(e) => {
                                           const val = e.target.value.trim();
                                           handleSetViewField(currentView.id, 'logo_cutout_mask_url', val);
                                           if (currentView.is_default || currentView.id === 'main_view') {
                                             handleSetCoverageAndCutouts('logo_cutout_mask_url', val);
                                           }
                                         }}
                                         className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18] placeholder:text-zinc-600"
                                       />
                                       <button
                                         type="button"
                                         onClick={() =>
                                           setMediaPickerConfig({
                                             isOpen: true,
                                             title: `Select Logo Cutout Mask: ${currentView.name}`,
                                             recommendedDimensions: '1000x1000 Transparent PNG',
                                             currentUrl: currentView.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url || '',
                                             onSelect: (url) => {
                                               handleSetViewField(currentView.id, 'logo_cutout_mask_url', url);
                                               if (currentView.is_default || currentView.id === 'main_view') {
                                                 handleSetCoverageAndCutouts('logo_cutout_mask_url', url);
                                               }
                                             },
                                           })
                                         }
                                         className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                         title="Browse WordPress Media Library"
                                       >
                                         <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                                         <span>Browse</span>
                                       </button>
                                     </div>
                                   </div>

                                   {/* Angle Pencil Cutout Mask */}
                                   <div className="space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/5">
                                     <div className="flex items-center justify-between">
                                       <span className="text-xs font-bold text-zinc-300">Pencil Groove Cutout Mask (iPad / Galaxy Tab)</span>
                                       {(currentView.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url) && (
                                         <span className="text-emerald-400 text-[10px] font-mono">Configured</span>
                                       )}
                                     </div>
                                     <div className="flex gap-2">
                                       <input
                                         type="url"
                                         placeholder="https://exacoat.com/uploads/iPad-Pro-Pencil-Cutout.png"
                                         value={currentView.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url || ''}
                                         onChange={(e) => {
                                           const val = e.target.value.trim();
                                           handleSetViewField(currentView.id, 'pencil_cutout_mask_url', val);
                                           if (currentView.is_default || currentView.id === 'main_view') {
                                             handleSetCoverageAndCutouts('pencil_cutout_mask_url', val);
                                           }
                                         }}
                                         className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18] placeholder:text-zinc-600"
                                       />
                                       <button
                                         type="button"
                                         onClick={() =>
                                           setMediaPickerConfig({
                                             isOpen: true,
                                             title: `Select Pencil Cutout Mask: ${currentView.name}`,
                                             recommendedDimensions: '1000x1000 Transparent PNG',
                                             currentUrl: currentView.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url || '',
                                             onSelect: (url) => {
                                               handleSetViewField(currentView.id, 'pencil_cutout_mask_url', url);
                                               if (currentView.is_default || currentView.id === 'main_view') {
                                                 handleSetCoverageAndCutouts('pencil_cutout_mask_url', url);
                                               }
                                             },
                                           })
                                         }
                                         className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                         title="Browse WordPress Media Library"
                                       >
                                         <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                                         <span>Browse</span>
                                       </button>
                                     </div>
                                   </div>

                                   {/* Angle Model Cut Frame Mask */}
                                   <div className="space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/5">
                                     <div className="flex items-center justify-between">
                                       <span className="text-xs font-bold text-zinc-300">Model Cut Perimeter Mask (Frame Flaps)</span>
                                       {(currentView.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url) && (
                                         <span className="text-emerald-400 text-[10px] font-mono">Configured</span>
                                       )}
                                     </div>
                                     <div className="flex gap-2">
                                       <input
                                         type="url"
                                         placeholder="https://exacoat.com/uploads/iPhone-18-Pro-Frame-Cut.png"
                                         value={currentView.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url || ''}
                                         onChange={(e) => {
                                           const val = e.target.value.trim();
                                           handleSetViewField(currentView.id, 'model_cut_mask_url', val);
                                           if (currentView.is_default || currentView.id === 'main_view') {
                                             handleSetCoverageAndCutouts('model_cut_mask_url', val);
                                           }
                                         }}
                                         className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-sky-400 placeholder:text-zinc-600"
                                       />
                                       <button
                                         type="button"
                                         onClick={() =>
                                           setMediaPickerConfig({
                                             isOpen: true,
                                             title: `Select Model Cut Mask: ${currentView.name}`,
                                             recommendedDimensions: '1000x1000 Transparent PNG',
                                             currentUrl: currentView.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url || '',
                                             onSelect: (url) => {
                                               handleSetViewField(currentView.id, 'model_cut_mask_url', url);
                                               if (currentView.is_default || currentView.id === 'main_view') {
                                                 handleSetCoverageAndCutouts('model_cut_mask_url', url);
                                               }
                                             },
                                           })
                                         }
                                         className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                         title="Browse WordPress Media Library"
                                       >
                                         <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                                         <span>Browse</span>
                                       </button>
                                     </div>
                                   </div>
                                 </div>

                                {/* 3D Shading & Specular Highlights for this Angle */}
                                <div className="space-y-4 pt-3 border-t border-white/5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Angle 3D Shading & Highlights</span>
                                      </label>
                                      <p className="text-[11px] text-zinc-400 mt-0.5">
                                        Multiply shadow and screen highlight PNGs composited over all skin pieces.
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShadingSourceUrl(currentView.background_url || '');
                                        setShowShadingExtractorModal(true);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                                    >
                                      <Wand2 className="w-3 h-3 text-amber-400" />
                                      <span>Extract from Render</span>
                                    </button>
                                  </div>

                                  {/* Multiply Shadow */}
                                  <div className="space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-zinc-300">3D Multiply Shadow PNG</span>
                                      {currentView.shadow_png_url && <span className="text-emerald-400 text-[10px] font-mono">Active</span>}
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        type="url"
                                        placeholder="https://exacoat.com/wp-content/uploads/iPhone-Shadow.png"
                                        value={currentView.shadow_png_url || ''}
                                        onChange={(e) => handleSetViewField(currentView.id, 'shadow_png_url', e.target.value.trim())}
                                        className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-amber-400 placeholder:text-zinc-600"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMediaPickerConfig({
                                            isOpen: true,
                                            title: `Select 3D Shadow PNG: ${currentView.name}`,
                                            recommendedDimensions: '1000x1000 Transparent PNG',
                                            currentUrl: currentView.shadow_png_url || '',
                                            onSelect: (url) => handleSetViewField(currentView.id, 'shadow_png_url', url),
                                          })
                                        }
                                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                        title="Browse WordPress Media Library"
                                      >
                                        <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                                        <span>Browse</span>
                                      </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 pt-1">
                                      <span className="text-[11px] text-zinc-400">Shadow Opacity:</span>
                                      <div className="flex items-center gap-2 flex-1 max-w-[180px]">
                                        <input
                                          type="range"
                                          min="0"
                                          max="1"
                                          step="0.05"
                                          value={currentView.shadow_opacity ?? 0.85}
                                          onChange={(e) => handleSetViewField(currentView.id, 'shadow_opacity', parseFloat(e.target.value))}
                                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                                        />
                                        <span className="font-mono text-xs text-amber-400 font-bold w-10 text-right">
                                          {Math.round((currentView.shadow_opacity ?? 0.85) * 100)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Screen Highlight */}
                                  <div className="space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-bold text-zinc-300">3D Screen Highlight PNG</span>
                                      {currentView.highlight_png_url && <span className="text-emerald-400 text-[10px] font-mono">Active</span>}
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        type="url"
                                        placeholder="https://exacoat.com/wp-content/uploads/iPhone-Highlight.png"
                                        value={currentView.highlight_png_url || ''}
                                        onChange={(e) => handleSetViewField(currentView.id, 'highlight_png_url', e.target.value.trim())}
                                        className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-sky-400 placeholder:text-zinc-600"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMediaPickerConfig({
                                            isOpen: true,
                                            title: `Select 3D Highlight PNG: ${currentView.name}`,
                                            recommendedDimensions: '1000x1000 Transparent PNG',
                                            currentUrl: currentView.highlight_png_url || '',
                                            onSelect: (url) => handleSetViewField(currentView.id, 'highlight_png_url', url),
                                          })
                                        }
                                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                        title="Browse WordPress Media Library"
                                      >
                                        <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                                        <span>Browse</span>
                                      </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 pt-1">
                                      <span className="text-[11px] text-zinc-400">Highlight Opacity:</span>
                                      <div className="flex items-center gap-2 flex-1 max-w-[180px]">
                                        <input
                                          type="range"
                                          min="0"
                                          max="1"
                                          step="0.05"
                                          value={currentView.highlight_opacity ?? 0.40}
                                          onChange={(e) => handleSetViewField(currentView.id, 'highlight_opacity', parseFloat(e.target.value))}
                                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                                        />
                                        <span className="font-mono text-xs text-sky-400 font-bold w-10 text-right">
                                          {Math.round((currentView.highlight_opacity ?? 0.40) * 100)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
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

                            {/* Buyer Options & Coverage Architecture */}
                            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-4">
                              <div>
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                  <Sliders className="w-4 h-4 text-[#f3aa18]" />
                                  Buyer Options & Coverage Architecture
                                </h4>
                                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                                  Configure configurable buyer choices available at checkout (Model Coverage, Logo Cutout, Pencil Groove).
                                </p>
                              </div>

                              {/* Coverage Mode Selection */}
                              <div className="space-y-2 pt-2 border-t border-white/5">
                                <label className="block text-xs font-bold text-zinc-300">
                                  Model Coverage Options
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { id: 'none', label: 'None (Flat Cut)', desc: 'Laptops, Keyboards, Accessories' },
                                    { id: 'model_cut_and_360', label: 'Model Cut & 360', desc: 'Smartphones (iPhone, S24)' },
                                    { id: 'model_cut_only', label: 'Model Cut Only', desc: 'Foldables (Z Flip/Fold)' },
                                    { id: 'model_360_only', label: '360 Wrap Only', desc: 'Full Wrap only' },
                                  ].map((mode) => {
                                    const currentCov = editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
                                    const isSelected = currentCov === mode.id;
                                    return (
                                      <button
                                        key={mode.id}
                                        type="button"
                                        onClick={() => handleSetCoverageAndCutouts('coverage_type', mode.id)}
                                        className={clsx(
                                          'p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                                          isSelected
                                            ? 'bg-sky-500/15 border-sky-400 text-white font-bold shadow-xs'
                                            : 'bg-zinc-950/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900'
                                        )}
                                      >
                                        <p className="text-xs">{mode.label}</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">{mode.desc}</p>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Up-charge for Model 360 when choice is available */}
                                {(editingProfile.coverage_and_cutouts?.coverage_type === 'model_cut_and_360' ||
                                  (!editingProfile.coverage_and_cutouts?.coverage_type && editingProfile.coverage_and_cutouts?.has_model_cut)) && (
                                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans mt-2">
                                    <div>
                                      <span className="text-zinc-300 font-medium block">Model 360 Extra Price:</span>
                                      <span className="text-[10px] text-zinc-500">Upcharge added when buyer selects Full Frame 360 wrap</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-zinc-500 font-mono text-[11px]">IDR</span>
                                      <input
                                        type="number"
                                        step="5000"
                                        value={editingProfile.coverage_and_cutouts?.model_360_extra_price ?? 40000}
                                        onChange={(e) =>
                                          handleSetCoverageAndCutouts('model_360_extra_price', Number(e.target.value) || 0)
                                        }
                                        className="w-24 px-2 py-0.5 text-xs font-mono text-right rounded bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Logo Cutout Option */}
                              <div className="pt-2 border-t border-white/5 space-y-2">
                                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans cursor-pointer">
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={editingProfile.coverage_and_cutouts?.has_logo_cutout !== false}
                                      onChange={(e) => handleSetCoverageAndCutouts('has_logo_cutout', e.target.checked)}
                                      className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 accent-[#f3aa18] cursor-pointer"
                                    />
                                    <div>
                                      <span className="text-zinc-200 font-medium block">Offer Logo Cutout Choice</span>
                                      <span className="text-[10px] text-zinc-500">Allows customer to choose between With Cutout or Solid (No Logo)</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                                    All Devices
                                  </span>
                                </label>
                              </div>

                              {/* Pencil Cutout Option (Tablets) */}
                              <div className="pt-2 border-t border-white/5 space-y-2">
                                <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans cursor-pointer">
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(editingProfile.coverage_and_cutouts?.has_pencil_cutout)}
                                      onChange={(e) => handleSetCoverageAndCutouts('has_pencil_cutout', e.target.checked)}
                                      className="w-4 h-4 rounded text-[#f3aa18] focus:ring-0 accent-[#f3aa18] cursor-pointer"
                                    />
                                    <div>
                                      <span className="text-zinc-200 font-medium block">Offer Pencil Cutout Choice</span>
                                      <span className="text-[10px] text-zinc-500">Allows customer to choose With Cutout or Solid for Apple Pencil / S-Pen strip</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                    Tablets
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* Base Price & Scale */}
                            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-4">
                              {/* Product Publication Status */}
                              <div>
                                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                                  Storefront Publication Status
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingProfile({
                                        ...editingProfile,
                                        status: 'draft',
                                      })
                                    }
                                    className={clsx(
                                      'px-3 py-2 text-xs font-sans font-medium rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer',
                                      (editingProfile.status || 'publish') === 'draft'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                                        : 'bg-zinc-950/60 text-zinc-400 border-white/10 hover:text-white hover:bg-zinc-900'
                                    )}
                                  >
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span>Draft (Unpublished)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingProfile({
                                        ...editingProfile,
                                        status: 'publish',
                                      })
                                    }
                                    className={clsx(
                                      'px-3 py-2 text-xs font-sans font-medium rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer',
                                      (editingProfile.status || 'publish') === 'publish'
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                                        : 'bg-zinc-950/60 text-zinc-400 border-white/10 hover:text-white hover:bg-zinc-900'
                                    )}
                                  >
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span>Published (Live)</span>
                                  </button>
                                </div>
                                <p className="text-[11px] text-zinc-500 mt-1">
                                  {(editingProfile.status || 'publish') === 'draft'
                                    ? 'Hidden from live webstore. Editable here in Studio until published.'
                                    : 'Live and discoverable on web.exacoat.com for customer checkout.'}
                                </p>
                              </div>

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
                                  onChange={(e) => {
                                    const nextFamily = e.target.value as DeviceFamily;
                                    const familyMultipliers: Record<string, number> = {
                                      phone: 1.0,
                                      foldable: 1.3,
                                      tablet: 1.8,
                                      keyboard: 2.0,
                                      laptop: 2.5,
                                      console: 2.0,
                                      accessory: 0.8,
                                      case: 1.0,
                                    };
                                    const nextMult = familyMultipliers[nextFamily] ?? 1.0;
                                    setEditingProfile({
                                      ...editingProfile,
                                      family: nextFamily,
                                      size_multiplier: nextMult,
                                    });
                                  }}
                                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white font-sans focus:outline-none focus:border-[#f3aa18]"
                                >
                                  <option value="phone">Phone (1.0x)</option>
                                  <option value="foldable">Foldable / Flip (1.3x)</option>
                                  <option value="tablet">iPad / Tablet (1.8x)</option>
                                  <option value="keyboard">Magic Keyboard / Folio (2.0x)</option>
                                  <option value="laptop">Laptop / MacBook (2.5x)</option>
                                  <option value="console">Gaming Console (2.0x)</option>
                                  <option value="case">Hybrid Case (1.0x)</option>
                                  <option value="accessory">Accessory (0.8x)</option>
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
                                  Multiplied against premium finish group up-prices (e.g. 1.0x for phones, 2.5x for laptops).
                                </p>
                              </div>

                              {/* Universal Pricing Explanation */}
                              <div className="p-3 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/25 text-xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[#f3aa18] flex items-center gap-1.5">
                                    <DollarSign className="w-3.5 h-3.5" />
                                    Universal Signature Pricing
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowMasterTexturesModal(true)}
                                    className="text-[10px] text-[#f3aa18] underline font-medium hover:text-white cursor-pointer"
                                  >
                                    Manage Finishes
                                  </button>
                                </div>
                                <p className="text-[11px] text-zinc-300 leading-relaxed">
                                  Signature finishes (e.g. Swarm, Black Camo, Patina) add their extra surcharge storewide. On this device, a base IDR 30,000 surcharge equals{' '}
                                  <strong className="text-white font-mono">
                                    +IDR {Math.round(30000 * (editingProfile.size_multiplier || 1.0)).toLocaleString('id-ID')}
                                  </strong>{' '}
                                  ({editingProfile.size_multiplier || 1.0}x multiplier).
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

      {/* Shading Extractor Modal */}
      {showShadingExtractorModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#f3aa18] shrink-0">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Extract 3D Shading & Highlights</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                        v2 Shading Engine
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Target Angle: <span className="text-white font-bold">{activeTargetView?.name || 'Main View'}</span> (applies raytraced shading across all skin parts)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowShadingExtractorModal(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* Guidance Banner */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-zinc-300 leading-relaxed space-y-1">
                  <span className="font-semibold text-amber-300 block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Optimal Source: Neutral Matte White 3D Render
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    Provide a neutral white render (such as <code className="text-zinc-300">iPhone-17-Pro-Skins-Matte-White.png</code>). The engine automatically separates raytraced drop shadows (camera plateau, bevels) from specular rim highlights, generating transparent Multiply and Screen maps.
                  </p>
                </div>

                {/* Source Image URL */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-300 block flex items-center justify-between">
                    <span>Source 3D Render Image (PNG)</span>
                    <span className="text-zinc-500 text-[10px]">1000x1000 Transparent PNG</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://exacoat.com/wp-content/uploads/iPhone-17-Pro-Skins-Matte-White.png"
                      value={shadingSourceUrl}
                      onChange={(e) => setShadingSourceUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMediaPickerConfig({
                          isOpen: true,
                          title: 'Select 3D Render for Shading Extraction',
                          recommendedDimensions: '1000x1000 PNG (Matte White)',
                          currentUrl: shadingSourceUrl,
                          onSelect: (url) => setShadingSourceUrl(url),
                        })
                      }
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-sans font-medium flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                      title="Browse WordPress Media Library"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                      <span>Browse</span>
                    </button>
                  </div>
                </div>

                {/* Shading Tuning Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 rounded-xl bg-black/40 border border-white/5">
                  {/* Shadow Contrast */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 font-medium">Shadow Depth / Contrast:</span>
                      <span className="font-mono text-[#f3aa18] font-bold">{Math.round(shadingShadowContrast * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={shadingShadowContrast}
                      onChange={(e) => setShadingShadowContrast(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#f3aa18]"
                    />
                    <span className="text-[10px] text-zinc-500 block">Controls depth of camera plateau and edge falloff shadows.</span>
                  </div>

                  {/* Highlight Contrast */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-300 font-medium">Highlight Sensitivity:</span>
                      <span className="font-mono text-sky-400 font-bold">{Math.round(shadingHlContrast * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={shadingHlContrast}
                      onChange={(e) => setShadingHlContrast(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                    <span className="text-[10px] text-zinc-500 block">Controls intensity of curved chamfers and specular rim light.</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 flex items-center justify-between bg-zinc-900/50 text-xs">
                <button
                  type="button"
                  onClick={() => setShowShadingExtractorModal(false)}
                  disabled={isExtractingShading}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 font-medium cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleRunShadingExtraction}
                  disabled={isExtractingShading || !shadingSourceUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExtractingShading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Extracting Shading...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 text-black" />
                      <span>Extract & Apply to Angle</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* WordPress Media Library Picker Modal */}
      <MediaLibraryModal
        isOpen={mediaPickerConfig.isOpen}
        onClose={() => setMediaPickerConfig((prev) => ({ ...prev, isOpen: false }))}
        onSelectImage={(url) => {
          mediaPickerConfig.onSelect(url);
          setMediaPickerConfig((prev) => ({ ...prev, isOpen: false }));
        }}
        title={mediaPickerConfig.title}
        recommendedDimensions={mediaPickerConfig.recommendedDimensions}
        currentUrl={mediaPickerConfig.currentUrl}
      />
    </div>
  );
};
