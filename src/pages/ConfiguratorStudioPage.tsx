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
  deleteGlobalFinishDirect,
  reorderFinishGroupsDirect,
  renameFinishGroupDirect,
  saveAllGlobalFinishesDirect,
  toggleFinishActiveDirect,
  extractShadingDirect,
  revalidateStorefrontWebDirect,
  FinishGroupSetting,
  ConfiguratorPreset,
  saveFinishGroupSettingsDirect,
  fetchConfiguratorPresetsDirect,
  saveConfiguratorPresetsDirect,
  syncDeviceFamiliesDirect,
  FinishSurchargeTier,
  DEFAULT_FINISH_SURCHARGE_TIERS,
  fetchFinishSurchargeTiersDirect,
  saveFinishSurchargeTiersDirect,
} from '../lib/wordpressBridge';
import {
  DeviceConfiguratorProfile,
  ConfiguratorProfileSummary,
  ConfiguratorLayer,
  ConfiguratorView,
  DeviceFamily,
  DeviceCoverageAndCutouts,
  ConfiguratorVariant,
  GeneratedShadowConfig,
} from '../types';
import {
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Compass,
  Coins,
  SlidersHorizontal,
  Smartphone,
  Laptop,
  Tablet,
  Keyboard as KeyboardIcon,
  Sliders,
  Trash2,
  Eye,
  EyeOff,
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
  Cpu,
  Globe,
  RotateCw,
  Maximize2,
  Sun,
  Sparkles,
  Lock,
  Package,
  ArrowLeftRight,
  Download,
  Upload,
  FileJson,
  FileText,
} from 'lucide-react';
import { clsx } from 'clsx';
import { MediaLibraryModal } from '../components/modals/MediaLibraryModal';
import { FinishSurchargeTiersModal } from '../components/modals/FinishSurchargeTiersModal';
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
      { name: 'Accents', group: 'accent', is_required: false, is_optional: true, extra_price: 35000 },
      { name: 'Frame / Sides', group: 'protection', is_required: false, is_optional: true, extra_price: 30000 },
    ],
  },
  foldable: {
    label: 'Foldable (Z Flip / Fold)',
    family: 'foldable',
    parts: [
      { name: 'Back Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
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
      { name: 'Sides', group: 'protection', is_required: false, is_optional: true, extra_price: 50000 },
      { name: 'Accents', group: 'accent', is_required: false, is_optional: true, extra_price: 50000 },
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
  { name: 'Top Skin', group: 'primary', is_required: true, is_optional: false, extra_price: 0 },
  { name: 'Additional Accents', group: 'accent', is_required: false, is_optional: true, extra_price: 30000 },
  { name: 'Additional Camera', group: 'accent', is_required: false, is_optional: true, extra_price: 25000 },
  { name: 'Additional Camera & Back Glass', group: 'accent', is_required: false, is_optional: true, extra_price: 85000 },
  { name: 'Frame / Sides', group: 'protection', is_required: false, is_optional: true, extra_price: 30000 },
  { name: 'Bottom Base', group: 'primary', is_required: false, is_optional: true, extra_price: 120000 },
  { name: 'Trackpad', group: 'accent', is_required: false, is_optional: true, extra_price: 40000 },
  { name: 'Palm Rest', group: 'accent', is_required: false, is_optional: true, extra_price: 80000 },
  { name: 'Hinge / Spine', group: 'accent', is_required: false, is_optional: true, extra_price: 25000 },
];

const InfoTooltip: React.FC<{ content?: string; text?: string }> = ({ content, text }) => {
  const tooltipText = content || text || '';
  return (
    <span className="relative group inline-flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-help" title={tooltipText}>
      <HelpCircle className="w-3.5 h-3.5" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-52 sm:w-60 p-2.5 rounded-xl bg-zinc-900/95 border border-white/10 text-[11px] leading-relaxed text-zinc-300 font-normal shadow-xl backdrop-blur-md z-50 normal-case tracking-normal text-left">
        {tooltipText}
      </span>
    </span>
  );
};

interface V2SkinCanvasLayerProps {
  maskUrl?: string;
  textureUrl?: string;
  fallbackColor?: string;
  logoCutoutUrl?: string;
  pencilCutoutUrl?: string;
  modelCutoutUrl?: string;
  zIndex: number;
  layerName: string;
  layerGroup?: 'primary' | 'accent' | 'protection' | 'addon';
  isRequired?: boolean;
  textureRotation?: number;
  textureScale?: number;
  hasViewShadow?: boolean;
  generatedShadowConfig?: GeneratedShadowConfig;
}

/**
 * Directional edge bevel and inner shading simulation.
 * Simulates directional incident lighting with smooth Gaussian blur falloff:
 * - Shadow cast towards bottom-right (or inverted towards top-left)
 * - Specular rim highlight caught on top-left (or bottom-right)
 */
function applySyntheticDirectionalShading(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: GeneratedShadowConfig
) {
  if (options?.enabled === false) return;

  const softness = typeof options?.softness === 'number' ? options.softness : 6;
  const distance = typeof options?.distance === 'number' ? options.distance : 3;
  const shadowAlpha = typeof options?.shadow_opacity === 'number' ? options.shadow_opacity : 0.40;
  const highlightAlpha = typeof options?.highlight_opacity === 'number' ? options.highlight_opacity : 0.25;
  const isBottomRight = (options?.direction ?? 'bottom_right') === 'bottom_right';

  // Shadow offset (cast towards bottom-right by default: +X, +Y)
  const shadowDx = isBottomRight ? distance : -distance;
  const shadowDy = isBottomRight ? distance : -distance;

  // Highlight offset (caught on top-left by default: -X, -Y)
  const hlDx = -shadowDx;
  const hlDy = -shadowDy;

  // 1. Offscreen buffer for inverted silhouette (surrounding area & holes)
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return;

  maskCtx.drawImage(ctx.canvas, 0, 0);
  maskCtx.globalCompositeOperation = 'source-in';
  maskCtx.fillStyle = '#000000';
  maskCtx.fillRect(0, 0, width, height);

  const invertCanvas = document.createElement('canvas');
  invertCanvas.width = width;
  invertCanvas.height = height;
  const invCtx = invertCanvas.getContext('2d');
  if (!invCtx) return;

  invCtx.fillStyle = '#000000';
  invCtx.fillRect(0, 0, width, height);
  invCtx.globalCompositeOperation = 'destination-out';
  invCtx.drawImage(maskCanvas, 0, 0);

  // 2. Render Soft Inner Shadow cast towards bottom-right
  if (shadowAlpha > 0) {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = width;
    shadowCanvas.height = height;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      sCtx.filter = `blur(${softness}px)`;
      sCtx.drawImage(invertCanvas, shadowDx, shadowDy);

      sCtx.filter = 'none';
      sCtx.globalCompositeOperation = 'destination-in';
      sCtx.drawImage(maskCanvas, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = shadowAlpha;
      ctx.drawImage(shadowCanvas, 0, 0);
      ctx.restore();
    }
  }

  // 3. Render Soft Rim Highlight caught on top-left
  if (highlightAlpha > 0) {
    const hlCanvas = document.createElement('canvas');
    hlCanvas.width = width;
    hlCanvas.height = height;
    const hCtx = hlCanvas.getContext('2d');
    if (hCtx) {
      hCtx.filter = `blur(${Math.max(1, softness * 0.6)}px)`;
      hCtx.drawImage(invertCanvas, hlDx, hlDy);

      hCtx.filter = 'none';
      hCtx.globalCompositeOperation = 'destination-in';
      hCtx.drawImage(maskCanvas, 0, 0);

      hCtx.globalCompositeOperation = 'source-in';
      hCtx.fillStyle = '#ffffff';
      hCtx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = highlightAlpha;
      ctx.drawImage(hlCanvas, 0, 0);
      ctx.restore();
    }
  }
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
  layerGroup,
  isRequired,
  textureRotation = 0,
  textureScale = 1.0,
  hasViewShadow = false,
  generatedShadowConfig,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!maskUrl && !textureUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;

    // Helper: load image safely without crossOrigin blocking
    const loadImage = (src?: string): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        if (!src || !src.trim()) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          const retryImg = new Image();
          retryImg.onload = () => resolve(retryImg);
          retryImg.onerror = () => resolve(null);
          retryImg.src = src.trim();
        };
        img.src = src.trim();
      });
    };

    Promise.all([
      maskUrl ? loadImage(maskUrl) : Promise.resolve(null),
      textureUrl ? loadImage(textureUrl) : Promise.resolve(null),
      logoCutoutUrl ? loadImage(logoCutoutUrl) : Promise.resolve(null),
      pencilCutoutUrl ? loadImage(pencilCutoutUrl) : Promise.resolve(null),
      modelCutoutUrl ? loadImage(modelCutoutUrl) : Promise.resolve(null),
    ]).then(([maskImg, texImg, logoCutoutImg, pencilCutoutImg, modelCutoutImg]) => {
      if (isCancelled || !ctx) return;
      ctx.clearRect(0, 0, 1000, 1000);
      if (!maskImg && !texImg) return;

      // 1. Draw master texture with seamless pattern tiling, rotation, and scale
      if (texImg && texImg.width > 0 && texImg.height > 0) {
        if (maskImg) {
          const rot = (textureRotation || 0) % 360;
          const zoom = typeof textureScale === 'number' && textureScale > 0 ? textureScale : 1.0;
          const baseScale = Math.max(1000 / texImg.width, 1000 / texImg.height);
          const scale = baseScale * zoom;

          let patternPainted = false;
          try {
            const pattern = ctx.createPattern(texImg, 'repeat');
            if (pattern) {
              const matrix = new DOMMatrix();
              matrix.translateSelf(500, 500);
              if (rot !== 0) {
                matrix.rotateSelf(rot);
              }
              matrix.scaleSelf(scale, scale);
              matrix.translateSelf(-texImg.width / 2, -texImg.height / 2);
              pattern.setTransform(matrix);
              ctx.fillStyle = pattern;
              ctx.fillRect(0, 0, 1000, 1000);
              patternPainted = true;
            }
          } catch {
            patternPainted = false;
          }

          if (!patternPainted) {
            // Fallback: scale drawImage sufficiently so rotation and zoom never leave empty borders
            const rotRad = (rot * Math.PI) / 180;
            const cos = Math.abs(Math.cos(rotRad));
            const sin = Math.abs(Math.sin(rotRad));
            const neededW = 1000 * cos + 1000 * sin;
            const neededH = 1000 * sin + 1000 * cos;
            const coverScale = Math.max(neededW / texImg.width, neededH / texImg.height, 1.0);
            const drawW = texImg.width * coverScale;
            const drawH = texImg.height * coverScale;

            ctx.save();
            ctx.translate(500, 500);
            if (rot !== 0) ctx.rotate(rotRad);
            ctx.drawImage(texImg, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          }
        } else {
          // Pre-cut texture overlay drawn directly on 1000x1000 canvas
          ctx.drawImage(texImg, 0, 0, 1000, 1000);
        }
      } else if (maskImg) {
        // Fallback color fill
        ctx.fillStyle = fallbackColor || '#18181b';
        ctx.fillRect(0, 0, 1000, 1000);
      }

      // 2. Clip with vinyl skin alpha mask if present
      if (maskImg) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskImg, 0, 0, 1000, 1000);
      }

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

      // 6. Directional Bevel & Inner Shading (strictly on back or required skins without 3D shadow map, never on additionals/accents)
      const isBackOrRequired = Boolean(
        isRequired ||
        layerGroup === 'primary' ||
        (/\b(back|top|body|device)\b/i.test(layerName) && !/\b(accent|camera|frame|side|logo|additional|addon)\b/i.test(layerName))
      );
      const shouldApplyGeneratedShadow =
        isBackOrRequired &&
        (generatedShadowConfig?.enabled ?? (!hasViewShadow && Boolean(maskImg)));

      if (shouldApplyGeneratedShadow && maskImg) {
        applySyntheticDirectionalShading(ctx, 1000, 1000, generatedShadowConfig);
      }

      // Reset composite operation to normal
      ctx.globalCompositeOperation = 'source-over';
    });

    return () => {
      isCancelled = true;
    };
  }, [maskUrl, textureUrl, fallbackColor, logoCutoutUrl, pencilCutoutUrl, modelCutoutUrl, textureRotation, textureScale, hasViewShadow, generatedShadowConfig, layerGroup, layerName, isRequired]);

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={1000}
      style={{ zIndex }}
      className="absolute inset-0 w-full h-full object-contain pointer-events-none filter drop-shadow-[0_0_1.5px_rgba(0,0,0,0.28)]"
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
  const [isSyncingFamilies, setIsSyncingFamilies] = useState(false);

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
  const [isRevalidatingWeb, setIsRevalidatingWeb] = useState(false);
  const [autofillPrefix, setAutofillPrefix] = useState<string>('');

  // Draggable inspector panel width (pixels)
  const [inspectorWidth, setInspectorWidth] = useState<number>(540);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Inspector layout tab state: 'device' | 'skins' | 'cutouts' | 'presets' | 'pricing'
  const [inspectorTab, setInspectorTab] = useState<'device' | 'skins' | 'cutouts' | 'presets' | 'pricing'>('skins');
  const [selectedLayerId, setSelectedLayerId] = useState<string>('');
  const [finishCategoryFilter, setFinishCategoryFilter] = useState<string>('all');

  // Per-Device Presets Editor Modal state
  const [editingDevicePreset, setEditingDevicePreset] = useState<{
    id: string;
    title: string;
    tagline?: string;
    badge: 'POPULAR' | 'STAFF PICK' | '';
    coverage: 'model_360' | 'model_cut';
    logo_cutout: boolean;
    layers: Record<string, string>;
    image_url?: string;
    isNew?: boolean;
  } | null>(null);

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
  const [masterTextureActiveFilter, setMasterTextureActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [savingFinishId, setSavingFinishId] = useState<string | null>(null);
  const [editingFinishUrls, setEditingFinishUrls] = useState<Record<string, string>>({});
  const [editingFinishBigUrls, setEditingFinishBigUrls] = useState<Record<string, string>>({});
  const [editingFinishThumbnails, setEditingFinishThumbnails] = useState<Record<string, string>>({});
  const [editingFinishNames, setEditingFinishNames] = useState<Record<string, string>>({});
  const [editingFinishGroups, setEditingFinishGroups] = useState<Record<string, string>>({});
  const [editingFinishPrices, setEditingFinishPrices] = useState<Record<string, number>>({});
  const [editingFinishStock, setEditingFinishStock] = useState<Record<string, boolean>>({});
  const [editingFinishActive, setEditingFinishActive] = useState<Record<string, boolean>>({});
  const [editingFinishCustomFlags, setEditingFinishCustomFlags] = useState<Record<string, boolean>>({});
  const [editingFinishBadgeTexts, setEditingFinishBadgeTexts] = useState<Record<string, string>>({});
  const [editingFinishBadgeColors, setEditingFinishBadgeColors] = useState<Record<string, string>>({});
  const [editingFinishShadowOpacities, setEditingFinishShadowOpacities] = useState<Record<string, number>>({});
  const [editingFinishHighlightOpacities, setEditingFinishHighlightOpacities] = useState<Record<string, number>>({});
  const [imagePickerModal, setImagePickerModal] = useState<{
    isOpen: boolean;
    finishId: string;
    finishName: string;
    type: 'thumbnail' | 'texture' | 'texture_big';
    currentUrl: string;
  }>({
    isOpen: false,
    finishId: '',
    finishName: '',
    type: 'thumbnail',
    currentUrl: '',
  });
  const [storedFinishGroups, setStoredFinishGroups] = useState<string[]>([]);
  const [finishGroupSettings, setFinishGroupSettings] = useState<Record<string, FinishGroupSetting>>({});
  const [configuratorPresets, setConfiguratorPresets] = useState<ConfiguratorPreset[]>([]);
  const [editingGroupSetting, setEditingGroupSetting] = useState<{ groupName: string; setting: FinishGroupSetting } | null>(null);
  const [isSavingGroupSettings, setIsSavingGroupSettings] = useState(false);
  const [showPresetsManagerModal, setShowPresetsManagerModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ConfiguratorPreset | null>(null);
  const [isSavingPresets, setIsSavingPresets] = useState(false);
  const [surchargeTiers, setSurchargeTiers] = useState<FinishSurchargeTier[]>(DEFAULT_FINISH_SURCHARGE_TIERS);
  const [showSurchargeTiersModal, setShowSurchargeTiersModal] = useState(false);
  const [isSavingSurchargeTiers, setIsSavingSurchargeTiers] = useState(false);
  const [editingTier, setEditingTier] = useState<FinishSurchargeTier | null>(null);
  const [isManagingGroups, setIsManagingGroups] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState<{ oldName: string; newName: string } | null>(null);
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [showAddNewFinishModal, setShowAddNewFinishModal] = useState(false);
  const [isCreatingFinish, setIsCreatingFinish] = useState(false);
  const [deletingFinishId, setDeletingFinishId] = useState<string | null>(null);
  const [newFinishForm, setNewFinishForm] = useState<{
    name: string;
    slug: string;
    group: string;
    thumbnail: string;
    texture_url: string;
    extra_price: number;
    is_custom_per_device: boolean;
    badge_text: string;
    badge_color: string;
  }>({
    name: '',
    slug: '',
    group: 'Signature skins',
    thumbnail: '',
    texture_url: '',
    extra_price: 0,
    is_custom_per_device: false,
    badge_text: '',
    badge_color: '#f3aa18',
  });

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

  // Transfer Setup & Portable JSON Modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTab, setTransferTab] = useState<'copy_to' | 'copy_from' | 'export_json' | 'import_json'>('copy_to');
  const [targetCopyProductId, setTargetCopyProductId] = useState<number | null>(null);
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [sourceCopyProductId, setSourceCopyProductId] = useState<number | null>(null);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [isTransferringSetup, setIsTransferringSetup] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importPreserveTargetMeta, setImportPreserveTargetMeta] = useState(true);
  const [transferCopiedStatus, setTransferCopiedStatus] = useState(false);
  const [copyOptions, setCopyOptions] = useState({
    copyViews: true,
    copyLayers: true,
    copyPresets: true,
    copyFamilySettings: true,
    copyVariants: true,
  });

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
  const [showCustomCutoutSection, setShowCustomCutoutSection] = useState<boolean>(false);
  const [activeSimView, setActiveSimView] = useState<string>('main_view');
  const [selectedSimColor, setSelectedSimColor] = useState<string>('space-gray');
  const [simFinishGroupFilter, setSimFinishGroupFilter] = useState<string>('all');
  const [customPartInputOpen, setCustomPartInputOpen] = useState<boolean>(false);
  const [customPartName, setCustomPartName] = useState<string>('');
  const [customAngleName, setCustomAngleName] = useState<string>('');
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState<boolean>(false);
  const [selectedSimVariants, setSelectedSimVariants] = useState<Record<string, string>>({});

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
        if (Array.isArray(finishesRes.groups) && finishesRes.groups.length > 0) {
          setStoredFinishGroups(finishesRes.groups);
        } else {
          const derived = Array.from(new Set(finishesRes.finishes.map((f) => f.group).filter(Boolean) as string[]));
          setStoredFinishGroups(derived);
        }
        if (finishesRes.group_settings) {
          setFinishGroupSettings(finishesRes.group_settings);
        }
        if (Array.isArray(finishesRes.presets)) {
          setConfiguratorPresets(finishesRes.presets);
        }
        if (Array.isArray(finishesRes.surcharge_tiers) && finishesRes.surcharge_tiers.length > 0) {
          setSurchargeTiers(finishesRes.surcharge_tiers);
        }
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
        } else if (showTransferModal) {
          setShowTransferModal(false);
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
  }, [categoryDropdownOpen, mediaPickerConfig.isOpen, showMasterTexturesModal, showGlobalAuditModal, showTransferModal, showAssetAuditModal, showFindReplaceModal, editingTextureModal, duplicateModal, priceEditModal, selectedProductId]);

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

  const sanitizeDeviceVariants = (
    variants: ConfiguratorVariant[] | undefined,
    family?: string,
    deviceName?: string,
    deviceSlug?: string
  ): ConfiguratorVariant[] => {
    if (!variants || !Array.isArray(variants)) return [];
    const isPhone =
      family === 'phone' ||
      !family ||
      /\b(iphone|galaxy|pixel|xiaomi|redmi|poco|oppo|vivo|realme|infinix|oneplus|phone)\b/i.test(
        `${deviceName || ''} ${deviceSlug || ''}`
      );

    return variants.filter((v) => {
      const vId = (v.id || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();
      const hasPhoneOpts = (v.options || []).some((opt) =>
        /\b(iphone|17 pro|pro max|promax|16 pro|15 pro|14 pro|ultra|plus|mini)\b/i.test(
          `${opt.name || ''} ${opt.id || ''}`
        )
      );
      if (
        hasPhoneOpts ||
        vId.includes('iphone') ||
        vName.includes('iphone') ||
        (isPhone &&
          (vId.includes('model') ||
            vName.includes('model') ||
            vId.includes('series') ||
            vName.includes('series') ||
            vId.includes('device') ||
            vName.includes('device')))
      ) {
        return false;
      }
      return (
        !vId.includes('logo') &&
        !vName.includes('logo') &&
        !vId.includes('cutout') &&
        !vId.includes('coverage') &&
        !vName.includes('coverage')
      );
    });
  };

  const handleOpenEditor = async (productId: number) => {
    setSelectedProductId(productId);
    setIsLoadingProfile(true);
    setInspectorTab('skins');
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

        const devFamily = res.profile.family || 'phone';
        const isBigFamily = devFamily === 'laptop' || devFamily === 'tablet' || (devFamily as string) === 'tablet_laptop' || devFamily === 'keyboard';
        const normalizedMultiplier = isBigFamily
          ? 2.0
          : (devFamily === 'foldable' ? 1.3 : (res.profile.size_multiplier || 1.0));

        const cleanVariants = sanitizeDeviceVariants(
          res.profile.variants,
          devFamily,
          res.profile.device_name,
          res.profile.device_slug
        );

        const rawCoverage = res.profile.coverage_and_cutouts;
        const normalizedCoverage = rawCoverage ? {
          ...rawCoverage,
          model_360_extra_price: typeof rawCoverage.model_360_extra_price === 'number'
            ? rawCoverage.model_360_extra_price
            : 40000,
        } : undefined;

        const profile: DeviceConfiguratorProfile = {
          ...res.profile,
          size_multiplier: normalizedMultiplier,
          views: viewsWithBody,
          layers: cleanedLayers,
          variants: cleanVariants,
          ...(normalizedCoverage ? { coverage_and_cutouts: normalizedCoverage } : {}),
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
          initialSim[l.id] = true;
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
        setSelectedLogoCutout(profile.coverage_and_cutouts?.has_logo_cutout !== false);
        setSelectedPencilCutout(Boolean(profile.coverage_and_cutouts?.has_pencil_cutout));
        setShowCustomCutoutSection(false);
        const initialVariants: Record<string, string> = {};
        if (profile.variants && profile.variants.length > 0) {
          profile.variants.forEach((v) => {
            if (v.options && v.options.length > 0) {
              initialVariants[v.id] = v.options[0].id;
            }
          });
        }
        setSelectedSimVariants(initialVariants);
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
            size_multiplier: (fallbackSummary.family === 'laptop' || fallbackSummary.family === 'tablet') ? 2.0 : (fallbackSummary.size_multiplier || 1.0),
            texture_scale: fallbackSummary.texture_scale ?? 1.0,
            is_configurable: true,
            configurator_version: fallbackSummary.configurator_version || 'v1',
            device_colors: [],
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

  const handleConvertToV2 = () => {
    if (!editingProfile) return;
    const isBig = editingProfile.family === 'laptop' || editingProfile.family === 'tablet' || (editingProfile.family as string) === 'tablet_laptop' || editingProfile.family === 'keyboard';
    const normalizedMultiplier = isBig ? 2.0 : (editingProfile.family === 'foldable' ? 1.3 : (editingProfile.size_multiplier || 1.0));

    const upgradedViews = (editingProfile.views || []).map((v) => ({
      ...v,
      texture_scale: v.texture_scale ?? editingProfile.texture_scale ?? 1.0,
      shadow_png_url: v.shadow_png_url || '',
      shading_image_url: v.shading_image_url || '',
    }));

    const upgradedLayers = (editingProfile.layers || []).map((l) => ({
      ...l,
      texture_size: l.texture_size || (isBig ? 'big' : 'small'),
    }));

    const existingCoverage = editingProfile.coverage_and_cutouts;
    const upgradedCoverage: DeviceCoverageAndCutouts = {
      has_logo_cutout: existingCoverage?.has_logo_cutout ?? true,
      logo_cutout_mask_url: existingCoverage?.logo_cutout_mask_url || '',
      has_pencil_cutout: existingCoverage?.has_pencil_cutout ?? false,
      pencil_cutout_mask_url: existingCoverage?.pencil_cutout_mask_url || '',
      has_model_cut: existingCoverage?.has_model_cut ?? false,
      model_cut_mask_url: existingCoverage?.model_cut_mask_url || '',
      coverage_type: existingCoverage?.coverage_type || 'none',
      model_360_extra_price: existingCoverage?.model_360_extra_price ?? 40000,
    };

    const cleanVariants = sanitizeDeviceVariants(
      editingProfile.variants,
      editingProfile.family,
      editingProfile.device_name,
      editingProfile.device_slug
    );

    setEditingProfile({
      ...editingProfile,
      configurator_version: 'v2',
      size_multiplier: normalizedMultiplier,
      views: upgradedViews,
      layers: upgradedLayers,
      variants: cleanVariants,
      coverage_and_cutouts: upgradedCoverage,
    });

    showToast(
      'success',
      'Converted to v2 Modern Engine',
      'Device upgraded to v2. Alpha masks, 3D shading, and save controls are now unlocked.'
    );
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    if (editingProfile.configurator_version !== 'v2') {
      showToast('warning', 'Device is Read-Only', 'Legacy v1 devices cannot be saved directly to protect webstore MKL data. Convert to v2 Modern Engine first.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const cleanVariants = sanitizeDeviceVariants(
        editingProfile.variants,
        editingProfile.family,
        editingProfile.device_name,
        editingProfile.device_slug
      );
      const existingCoverage = editingProfile.coverage_and_cutouts;
      const coverageToSave = existingCoverage ? {
        ...existingCoverage,
        model_360_extra_price: typeof existingCoverage.model_360_extra_price === 'number'
          ? existingCoverage.model_360_extra_price
          : 40000,
      } : undefined;

      const profileToSave = {
        ...editingProfile,
        variants: cleanVariants,
        ...(coverageToSave ? { coverage_and_cutouts: coverageToSave } : {}),
      };
      const res = await saveProductConfiguratorProfileDirect(profileToSave);
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
            variants: cleanVariants,
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

  // Trigger Next.js storefront ISR revalidation and Cloudflare edge cache purge
  const handleRevalidateStorefront = async (options?: {
    slug?: string;
    category?: string;
    purgeAll?: boolean;
  }) => {
    setIsRevalidatingWeb(true);
    try {
      const res = await revalidateStorefrontWebDirect({
        slug: options?.slug,
        category: options?.category,
        purge_everything: options?.purgeAll ?? false,
      });

      if (res.success) {
        const cfMsg = res.results?.cloudflare?.configured === false
          ? ' (Cloudflare credentials not set)'
          : res.results?.cloudflare?.success
          ? ' + Cloudflare Edge Cleared'
          : '';
        showToast(
          'success',
          'Storefront Cache Revalidated',
          `${res.message || 'Next.js ISR cache purged'}${cfMsg}.`
        );
      } else {
        showToast(
          'error',
          'Revalidation Failed',
          res.error || 'Failed revalidating web storefront cache.'
        );
      }
    } catch (err: any) {
      showToast('error', 'Revalidation Error', err.message);
    } finally {
      setIsRevalidatingWeb(false);
    }
  };

  const activeSkinLayers = useMemo(() => {
    if (!editingProfile) return [];
    return (editingProfile.layers || []).filter(
      (l) => (l.name || '').toLowerCase() !== 'device' && (l.id || '').toLowerCase() !== 'device'
    );
  }, [editingProfile]);

  // Per-Device Presets Handlers
  const handleOpenAddDevicePreset = () => {
    if (!editingProfile) return;
    const initialLayers: Record<string, string> = {};
    activeSkinLayers.forEach((l) => {
      initialLayers[l.id] = selectedLayerFinishes[l.id] || selectedSimFinish || 'swarm';
    });

    setEditingDevicePreset({
      id: `look-${Date.now()}`,
      title: '',
      tagline: '',
      badge: '',
      coverage: selectedCoverage || 'model_360',
      logo_cutout: selectedLogoCutout ?? true,
      layers: initialLayers,
      image_url: '',
      isNew: true,
    });
  };

  const handleOpenEditDevicePreset = (preset: ConfiguratorPreset) => {
    setEditingDevicePreset({
      id: preset.id,
      title: preset.title,
      tagline: preset.tagline || '',
      badge: (preset.badge === 'POPULAR' || preset.badge === 'STAFF PICK') ? preset.badge : '',
      coverage: preset.coverage || 'model_360',
      logo_cutout: preset.logo_cutout !== false,
      layers: { ...(preset.layers || {}) },
      image_url: preset.image_url || '',
      isNew: false,
    });
  };

  const handleSaveDevicePreset = () => {
    if (!editingProfile || !editingDevicePreset) return;
    if (!editingDevicePreset.title.trim()) {
      showToast('error', 'Title Required', 'Please enter a title for this preset.');
      return;
    }

    const currentPresets = editingProfile.presets || [];
    let updatedPresets: ConfiguratorPreset[];

    const presetData: ConfiguratorPreset = {
      id: editingDevicePreset.id || `look-${Date.now()}`,
      title: editingDevicePreset.title.trim(),
      tagline: editingDevicePreset.tagline?.trim() || undefined,
      badge: editingDevicePreset.badge || undefined,
      coverage: editingDevicePreset.coverage,
      logo_cutout: editingDevicePreset.logo_cutout,
      layers: editingDevicePreset.layers,
      image_url: editingDevicePreset.image_url?.trim() || undefined,
    };

    if (editingDevicePreset.isNew) {
      updatedPresets = [...currentPresets, presetData];
    } else {
      updatedPresets = currentPresets.map((p) =>
        p.id === editingDevicePreset.id ? presetData : p
      );
    }

    setEditingProfile({
      ...editingProfile,
      presets: updatedPresets,
    });

    setEditingDevicePreset(null);
    showToast('success', 'Look Saved', `Preset "${presetData.title}" saved. Remember to click "Save Configuration".`);
  };

  const handleDeleteDevicePreset = (presetId: string) => {
    if (!editingProfile) return;
    const updated = (editingProfile.presets || []).filter((p) => p.id !== presetId);
    setEditingProfile({
      ...editingProfile,
      presets: updated,
    });
    showToast('info', 'Preset Removed', 'Preset removed from this device.');
  };

  const handleCaptureFromSimulator = () => {
    if (!editingProfile || !editingDevicePreset) return;
    const captured: Record<string, string> = {};
    activeSkinLayers.forEach((l) => {
      captured[l.id] = selectedLayerFinishes[l.id] || selectedSimFinish || 'swarm';
    });
    setEditingDevicePreset({
      ...editingDevicePreset,
      coverage: selectedCoverage || 'model_360',
      logo_cutout: selectedLogoCutout ?? true,
      layers: captured,
    });
    showToast('success', 'Selections Captured', 'Current simulator finishes and cutouts copied.');
  };

  const handleTestPresetInSimulator = (preset: ConfiguratorPreset) => {
    if (!editingProfile) return;
    if (preset.coverage) {
      setSelectedCoverage(preset.coverage);
    }
    if (preset.logo_cutout !== undefined) {
      setSelectedLogoCutout(preset.logo_cutout);
    }
    if (preset.layers && typeof preset.layers === 'object') {
      const nextFinishes: Record<string, string> = { ...selectedLayerFinishes };
      for (const [key, slug] of Object.entries(preset.layers)) {
        const matching = editingProfile.layers.find(
          (l) =>
            l.id === key ||
            l.id.toLowerCase() === key.toLowerCase() ||
            l.name.toLowerCase() === key.toLowerCase() ||
            l.name.toLowerCase().replace(/\s+/g, '-') === key.toLowerCase()
        );
        if (matching) {
          nextFinishes[matching.id] = slug;
        }
      }
      setSelectedLayerFinishes(nextFinishes);
    }
    showToast('success', 'Look Applied', `Look "${preset.title}" applied to live canvas preview.`);
  };

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
            shading_image_url: res.shadow_url || res.highlight_url,
            shadow_png_url: res.shadow_url,
            highlight_png_url: res.highlight_url,
            shadow_opacity: v.shadow_opacity ?? 0.85,
            highlight_opacity: v.highlight_opacity ?? 0.35,
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

  const handleSyncFamilies = async () => {
    setIsSyncingFamilies(true);
    try {
      const res = await syncDeviceFamiliesDirect();
      if (res.success) {
        showToast(
          'success',
          'Device Families Synced',
          `${res.updated_count} devices updated to correct family and size multiplier.`
        );
        loadData(true);
      } else {
        showToast('error', 'Sync Failed', res.error || 'Failed syncing device families');
      }
    } catch (err: any) {
      showToast('error', 'Sync Error', err.message);
    } finally {
      setIsSyncingFamilies(false);
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

  // Transfer Setup & Portable JSON Handlers
  const handleExecuteCopyTo = async () => {
    if (!editingProfile || !targetCopyProductId) return;
    const targetSummary = profiles.find((p) => p.product_id === targetCopyProductId);
    if (!targetSummary) return;

    setIsTransferringSetup(true);
    try {
      const res = await fetchProductConfiguratorProfileDirect(targetCopyProductId);
      const targetProfile: Partial<DeviceConfiguratorProfile> = res.profile || {};

      const clonedViews = copyOptions.copyViews
        ? JSON.parse(JSON.stringify(editingProfile.views || []))
        : targetProfile.views || [];
      const clonedLayers = copyOptions.copyLayers
        ? JSON.parse(JSON.stringify(editingProfile.layers || []))
        : targetProfile.layers || [];
      const clonedPresets = copyOptions.copyPresets
        ? JSON.parse(JSON.stringify(editingProfile.presets || []))
        : targetProfile.presets || [];
      const clonedVariants = copyOptions.copyVariants
        ? JSON.parse(JSON.stringify(editingProfile.variants || []))
        : targetProfile.variants || [];
      const clonedCoverage = copyOptions.copyViews
        ? JSON.parse(JSON.stringify(editingProfile.coverage_and_cutouts || null))
        : targetProfile.coverage_and_cutouts;

      const payload: DeviceConfiguratorProfile = {
        ...targetProfile,
        product_id: targetCopyProductId,
        device_slug: targetProfile.device_slug || targetSummary.slug,
        device_name: targetProfile.device_name || targetSummary.name,
        category: targetProfile.category || (targetSummary.categories?.[0] || 'General'),
        family: copyOptions.copyFamilySettings ? editingProfile.family : (targetProfile.family || 'phone'),
        base_price: targetProfile.base_price ?? targetSummary.price,
        currency: targetProfile.currency || 'IDR',
        size_multiplier: copyOptions.copyFamilySettings ? editingProfile.size_multiplier : (targetProfile.size_multiplier || 1.0),
        texture_scale: editingProfile.texture_scale ?? 1.0,
        is_configurable: clonedLayers.length > 0,
        configurator_version: editingProfile.configurator_version || 'v2',
        device_colors: editingProfile.device_colors ? JSON.parse(JSON.stringify(editingProfile.device_colors)) : [],
        views: clonedViews,
        layers: clonedLayers,
        variants: clonedVariants,
        coverage_and_cutouts: clonedCoverage,
        presets: clonedPresets,
      };

      const saveRes = await saveProductConfiguratorProfileDirect(payload);
      if (saveRes.success) {
        showToast(
          'success',
          'Setup Transferred',
          `Successfully copied configurator setup to "${targetSummary.name}".`
        );
        setProfiles((prev) =>
          prev.map((p) =>
            p.product_id === targetCopyProductId
              ? {
                  ...p,
                  is_migrated: true,
                  is_configurable: (payload.layers || []).length > 0,
                  is_configurator: true,
                  layers_count: (payload.layers || []).length,
                  views_count: (payload.views || []).length,
                  presets_count: (payload.presets || []).length,
                  configurator_version: payload.configurator_version,
                  family: payload.family,
                  size_multiplier: payload.size_multiplier,
                }
              : p
          )
        );
        setShowTransferModal(false);
      } else {
        showToast('error', 'Transfer Failed', saveRes.message || 'Failed saving setup to target device');
      }
    } catch (err: any) {
      showToast('error', 'Transfer Error', err.message || 'Failed transferring setup');
    } finally {
      setIsTransferringSetup(false);
    }
  };

  const handleExecuteCopyFrom = async () => {
    if (!editingProfile || !sourceCopyProductId) return;
    const sourceSummary = profiles.find((p) => p.product_id === sourceCopyProductId);
    if (!sourceSummary) return;

    setIsTransferringSetup(true);
    try {
      const res = await fetchProductConfiguratorProfileDirect(sourceCopyProductId);
      const sourceProfile = res.profile;
      if (!sourceProfile) {
        showToast('error', 'Load Failed', 'Source profile could not be retrieved.');
        return;
      }

      const updated: DeviceConfiguratorProfile = {
        ...editingProfile,
        configurator_version: sourceProfile.configurator_version || 'v2',
        family: copyOptions.copyFamilySettings ? sourceProfile.family : editingProfile.family,
        size_multiplier: copyOptions.copyFamilySettings ? sourceProfile.size_multiplier : editingProfile.size_multiplier,
        texture_scale: sourceProfile.texture_scale ?? editingProfile.texture_scale,
        views: copyOptions.copyViews ? JSON.parse(JSON.stringify(sourceProfile.views || [])) : editingProfile.views,
        layers: copyOptions.copyLayers ? JSON.parse(JSON.stringify(sourceProfile.layers || [])) : editingProfile.layers,
        presets: copyOptions.copyPresets ? JSON.parse(JSON.stringify(sourceProfile.presets || [])) : editingProfile.presets,
        variants: copyOptions.copyVariants ? JSON.parse(JSON.stringify(sourceProfile.variants || [])) : editingProfile.variants,
        coverage_and_cutouts: copyOptions.copyViews
          ? JSON.parse(JSON.stringify(sourceProfile.coverage_and_cutouts || null))
          : editingProfile.coverage_and_cutouts,
        device_colors: sourceProfile.device_colors
          ? JSON.parse(JSON.stringify(sourceProfile.device_colors))
          : editingProfile.device_colors,
      };

      setEditingProfile(updated);
      setSelectedLayerId(updated.layers?.[0]?.id || '');
      showToast(
        'success',
        'Template Setup Loaded',
        `Adopted setup from "${sourceSummary.name}". Click Save Configurator when ready to persist.`
      );
      setShowTransferModal(false);
    } catch (err: any) {
      showToast('error', 'Template Error', err.message || 'Failed loading source template');
    } finally {
      setIsTransferringSetup(false);
    }
  };

  const handleExportJsonDownload = () => {
    if (!editingProfile) return;
    const cleanProfile = {
      ...editingProfile,
      exported_at: new Date().toISOString(),
      generator: 'Exacoat Manager Configurator Studio',
    };
    const jsonStr = JSON.stringify(cleanProfile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editingProfile.device_slug || 'device'}-profile.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Profile Exported', 'Downloaded configurator profile JSON.');
  };

  const handleExportJsonClipboard = () => {
    if (!editingProfile) return;
    const jsonStr = JSON.stringify(editingProfile, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setTransferCopiedStatus(true);
    setTimeout(() => setTransferCopiedStatus(false), 2000);
    showToast('success', 'Copied to Clipboard', 'Profile JSON copied to clipboard.');
  };

  const handleExecuteImportJson = (rawJson: string) => {
    if (!editingProfile || !rawJson.trim()) return;
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object') {
        showToast('error', 'Invalid JSON', 'Supplied text is not a valid JSON object.');
        return;
      }
      if (!Array.isArray(parsed.layers) && !Array.isArray(parsed.views)) {
        showToast('error', 'Invalid Profile Format', 'JSON profile must contain a views or layers array.');
        return;
      }

      const merged: DeviceConfiguratorProfile = {
        ...(importPreserveTargetMeta ? editingProfile : parsed),
        product_id: editingProfile.product_id,
        device_slug: editingProfile.device_slug,
        device_name: editingProfile.device_name,
        base_price: editingProfile.base_price,
        currency: editingProfile.currency,
        category: editingProfile.category,
        views: parsed.views || editingProfile.views || [],
        layers: parsed.layers || editingProfile.layers || [],
        presets: parsed.presets || editingProfile.presets || [],
        variants: parsed.variants || editingProfile.variants || [],
        coverage_and_cutouts: parsed.coverage_and_cutouts || editingProfile.coverage_and_cutouts,
        family: parsed.family || editingProfile.family,
        size_multiplier: parsed.size_multiplier || editingProfile.size_multiplier,
        texture_scale: parsed.texture_scale ?? editingProfile.texture_scale ?? 1.0,
        is_configurable: (parsed.layers || editingProfile.layers || []).length > 0,
        configurator_version: parsed.configurator_version || editingProfile.configurator_version || 'v2',
      };

      setEditingProfile(merged);
      setSelectedLayerId(merged.layers?.[0]?.id || '');
      showToast(
        'success',
        'Profile Imported',
        'Profile loaded into editor! Click Save Configurator when ready to persist.'
      );
      setShowTransferModal(false);
      setImportJsonText('');
    } catch (err: any) {
      showToast('error', 'Import Failed', `JSON parsing failed: ${err.message}`);
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
      if (layer.is_non_visual) return;
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

  const handlePruneLegacyFinishSlices = () => {
    if (!editingProfile) return;
    let prunedCount = 0;

    const customSlugs = new Set(
      finishes.filter((f) => f.is_custom_per_device).map((f) => (f.slug || f.id).toLowerCase())
    );

    const cleanedLayers = (editingProfile.layers || []).map((layer) => {
      const newAssetsByView: Record<string, any> = {};
      Object.entries(layer.assets_by_view || {}).forEach(([vId, vAsset]: [string, any]) => {
        const cleanTextureMap: Record<string, string> = {};
        Object.entries(vAsset.render_texture_map || {}).forEach(([slug, urlVal]) => {
          if (customSlugs.has(slug.toLowerCase())) {
            cleanTextureMap[slug] = typeof urlVal === 'string' ? urlVal : String(urlVal || '');
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

    showToast(
      'success',
      'Legacy Slices Pruned',
      `Pruned ${prunedCount} legacy slice mappings. Layers will now use pure global master textures. Click Save Configurator to persist.`
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
          if (layer.is_non_visual) return;
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
    let slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    let partName = preset.name;

    if (editingProfile.layers.some((l) => l.id === slug)) {
      const count = editingProfile.layers.filter((l) => l.name.toLowerCase().startsWith(preset.name.toLowerCase())).length + 1;
      slug = `${slug}_${count}`;
      partName = `${preset.name} ${count}`;
    }

    const newLayer: ConfiguratorLayer = {
      id: slug,
      name: partName,
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
    showToast('info', 'Part Added', `Added "${partName}". Select finishes below to map textures.`);
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

    setEditingProfile({
      ...editingProfile,
      layers: newLayers,
    });

    setSelectedSimLayers(newSimLayers);
    if (newLayers.length > 0 && !selectedLayerId) {
      setSelectedLayerId(newLayers[0].id);
    }
    if (addedCount > 0) {
      showToast('success', 'Preset Parts Added', `Added ${addedCount} skin part(s) from "${pack.label}" without modifying existing layers.`);
    } else {
      showToast('info', 'Already Added', `All skin parts from "${pack.label}" are already added.`);
    }
  };

  const handleCreateCustomLayer = (rawName: string) => {
    if (!editingProfile || !rawName.trim()) return;
    const name = rawName.trim();
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

    if (editingProfile.layers.some((l) => l.id === slug)) {
      slug = `${slug}_${Date.now()}`;
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
    const layerToRemove = editingProfile.layers.find((l) => l.id === layerId);
    const remaining = editingProfile.layers.filter((l) => l.id !== layerId);

    // Re-index remaining layers from 1 to N
    const reindexed = remaining.map((l, i) => ({ ...l, z_index: i + 1 }));

    setEditingProfile({
      ...editingProfile,
      layers: reindexed,
    });
    if (selectedLayerId === layerId) {
      setSelectedLayerId(reindexed[0]?.id || '');
    }
    setSelectedSimLayers((prev) => {
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
    setSelectedLayerFinishes((prev) => {
      const next = { ...prev };
      delete next[layerId];
      return next;
    });
    showToast('success', 'Part Removed', `Deleted skin part "${layerToRemove?.name || layerId}".`);
  };

  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    if (!editingProfile) return;
    // Layers displayed from Front to Back (descending z_index)
    const sorted = [...editingProfile.layers].sort((a, b) => (b.z_index || 1) - (a.z_index || 1));
    const idx = sorted.findIndex((l) => l.id === layerId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    // Swap elements in sorted array
    const temp = sorted[idx];
    sorted[idx] = sorted[targetIdx];
    sorted[targetIdx] = temp;

    // Reassign z_index: index 0 (top of list) gets highest z-index, last element gets 1
    const total = sorted.length;
    const reindexed = sorted.map((l, i) => ({
      ...l,
      z_index: total - i,
    }));

    setEditingProfile({
      ...editingProfile,
      layers: reindexed,
    });
    showToast('info', 'Priority Updated', `Moved "${temp.name}" ${direction === 'up' ? 'forward (higher)' : 'backward (lower)'}.`);
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
    const currentCoverage = editingProfile.coverage_and_cutouts || {};
    const nextCoverage = {
      model_360_extra_price: 40000,
      ...currentCoverage,
      [field]: value,
    };
    if (field === 'pencil_cutout_mask_url' && value) {
      nextCoverage.has_pencil_cutout = true;
    }
    setEditingProfile({
      ...editingProfile,
      coverage_and_cutouts: nextCoverage,
    });
  };

  const handleSetVariants = (variants: ConfiguratorVariant[]) => {
    if (!editingProfile) return;
    setEditingProfile({
      ...editingProfile,
      variants,
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
    let slug = viewName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    if (!slug) slug = `angle_${Date.now()}`;
    if (editingProfile.views.some((v) => v.id === slug)) {
      slug = `${slug}_${Date.now().toString().slice(-4)}`;
    }

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
    showToast('info', 'Angle Added', `Added viewing angle: ${viewName.trim()}`);
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

  // Check if an individual master finish has uncommitted edits
  const isFinishDirty = (f: GlobalFinish): boolean => {
    const isThumbDirty =
      editingFinishThumbnails[f.id] !== undefined &&
      editingFinishThumbnails[f.id].trim() !== (f.thumbnail || '');
    const isUrlDirty =
      editingFinishUrls[f.id] !== undefined &&
      editingFinishUrls[f.id].trim() !== (f.texture_url || '');
    const isBigUrlDirty =
      editingFinishBigUrls[f.id] !== undefined &&
      editingFinishBigUrls[f.id].trim() !== (f.texture_big_url || '');
    const isNameDirty =
      editingFinishNames[f.id] !== undefined &&
      editingFinishNames[f.id].trim() !== f.name;
    const isGroupDirty =
      editingFinishGroups[f.id] !== undefined &&
      editingFinishGroups[f.id] !== f.group;
    const isPriceDirty =
      editingFinishPrices[f.id] !== undefined &&
      editingFinishPrices[f.id] !== (f.extra_price || 0);
    const isStockDirty =
      editingFinishStock[f.id] !== undefined &&
      editingFinishStock[f.id] !== (f.in_stock !== false);
    const isActiveDirty =
      editingFinishActive[f.id] !== undefined &&
      editingFinishActive[f.id] !== (f.is_active !== false);
    const isCustomDirty =
      editingFinishCustomFlags[f.id] !== undefined &&
      editingFinishCustomFlags[f.id] !== Boolean(f.is_custom_per_device);
    const isBadgeTextDirty =
      editingFinishBadgeTexts[f.id] !== undefined &&
      editingFinishBadgeTexts[f.id].trim() !== (f.badge_text || '');
    const isBadgeColorDirty =
      editingFinishBadgeColors[f.id] !== undefined &&
      editingFinishBadgeColors[f.id].trim() !== (f.badge_color || '#f3aa18');
    const isShadowDirty =
      editingFinishShadowOpacities[f.id] !== undefined &&
      editingFinishShadowOpacities[f.id] !== (typeof f.shadow_opacity === 'number' ? f.shadow_opacity : 0.85);
    const isHighlightDirty =
      editingFinishHighlightOpacities[f.id] !== undefined &&
      editingFinishHighlightOpacities[f.id] !== (typeof f.highlight_opacity === 'number' ? f.highlight_opacity : 0.35);

    return (
      isThumbDirty ||
      isUrlDirty ||
      isBigUrlDirty ||
      isNameDirty ||
      isGroupDirty ||
      isPriceDirty ||
      isStockDirty ||
      isActiveDirty ||
      isCustomDirty ||
      isBadgeTextDirty ||
      isBadgeColorDirty ||
      isShadowDirty ||
      isHighlightDirty
    );
  };

  // Array of all master finishes currently with unsaved changes
  const dirtyFinishes = useMemo(() => {
    return finishes.filter(isFinishDirty);
  }, [
    finishes,
    editingFinishThumbnails,
    editingFinishUrls,
    editingFinishBigUrls,
    editingFinishNames,
    editingFinishGroups,
    editingFinishPrices,
    editingFinishStock,
    editingFinishActive,
    editingFinishCustomFlags,
    editingFinishBadgeTexts,
    editingFinishBadgeColors,
    editingFinishShadowOpacities,
    editingFinishHighlightOpacities,
  ]);

  // Discard all uncommitted master finish edits and close
  const handleDiscardMasterFinishChanges = () => {
    setEditingFinishUrls({});
    setEditingFinishBigUrls({});
    setEditingFinishThumbnails({});
    setEditingFinishNames({});
    setEditingFinishGroups({});
    setEditingFinishPrices({});
    setEditingFinishStock({});
    setEditingFinishActive({});
    setEditingFinishCustomFlags({});
    setEditingFinishBadgeTexts({});
    setEditingFinishBadgeColors({});
    setEditingFinishShadowOpacities({});
    setEditingFinishHighlightOpacities({});
    setShowMasterTexturesModal(false);
  };

  // Batch save all modified master finishes
  const [isSavingAllFinishes, setIsSavingAllFinishes] = useState(false);
  const handleSaveAllMasterFinishes = async () => {
    if (dirtyFinishes.length === 0) return;

    try {
      setIsSavingAllFinishes(true);

      const updatedFinishes: GlobalFinish[] = finishes.map((f) => {
        const customUrl = editingFinishUrls[f.id];
        const newTexture = customUrl !== undefined ? customUrl.trim() : (f.texture_url || f.thumbnail || '');
        const customBigUrl = editingFinishBigUrls[f.id];
        const newBigTexture = customBigUrl !== undefined ? customBigUrl.trim() : (f.texture_big_url || '');
        const customThumb = editingFinishThumbnails[f.id];
        const newThumb = customThumb !== undefined ? customThumb.trim() : (f.thumbnail || '');
        const customName = editingFinishNames[f.id];
        const newName = customName !== undefined ? customName.trim() : f.name;
        const customGroup = editingFinishGroups[f.id];
        const newGroup = customGroup !== undefined ? customGroup.trim() : f.group;
        const customPrice = editingFinishPrices[f.id];
        const newPrice = customPrice !== undefined ? customPrice : (f.extra_price || 0);
        const customStock = editingFinishStock[f.id];
        const newStock = customStock !== undefined ? customStock : (f.in_stock !== false);
        const customActive = editingFinishActive[f.id];
        const newActive = customActive !== undefined ? customActive : (f.is_active !== false);
        const customFlag = editingFinishCustomFlags[f.id];
        const newCustomFlag = customFlag !== undefined ? customFlag : Boolean(f.is_custom_per_device);
        const customBadgeText = editingFinishBadgeTexts[f.id];
        const newBadgeText = customBadgeText !== undefined ? customBadgeText.trim() : (f.badge_text || '');
        const customBadgeColor = editingFinishBadgeColors[f.id];
        const newBadgeColor = customBadgeColor !== undefined ? customBadgeColor.trim() : (f.badge_color || '#f3aa18');
        const customShadow = editingFinishShadowOpacities[f.id];
        const newShadow = customShadow !== undefined ? customShadow : (typeof f.shadow_opacity === 'number' ? f.shadow_opacity : 0.85);
        const customHighlight = editingFinishHighlightOpacities[f.id];
        const newHighlight = customHighlight !== undefined ? customHighlight : (typeof f.highlight_opacity === 'number' ? f.highlight_opacity : 0.35);

        return {
          ...f,
          name: newName,
          group: newGroup,
          thumbnail: newThumb,
          texture_url: newTexture,
          texture_big_url: newBigTexture,
          extra_price: newPrice,
          in_stock: newStock,
          is_active: newActive,
          is_custom_per_device: newCustomFlag,
          badge_text: newBadgeText,
          badge_color: newBadgeColor,
          shadow_opacity: newShadow,
          highlight_opacity: newHighlight,
        };
      });

      const res = await saveAllGlobalFinishesDirect(updatedFinishes, storedFinishGroups);
      if (res.success) {
        showToast(
          'success',
          'All Finishes Saved',
          `Successfully saved all ${dirtyFinishes.length} modified finish(es).`
        );
        if (Array.isArray(res.finishes)) {
          setFinishes(res.finishes);
        } else {
          setFinishes(updatedFinishes);
        }
        if (Array.isArray(res.groups)) {
          setStoredFinishGroups(res.groups);
        }

        // Clear all editing maps
        setEditingFinishUrls({});
        setEditingFinishBigUrls({});
        setEditingFinishThumbnails({});
        setEditingFinishNames({});
        setEditingFinishGroups({});
        setEditingFinishPrices({});
        setEditingFinishStock({});
        setEditingFinishActive({});
        setEditingFinishCustomFlags({});
        setEditingFinishBadgeTexts({});
        setEditingFinishBadgeColors({});
        setEditingFinishShadowOpacities({});
        setEditingFinishHighlightOpacities({});
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed saving finishes.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error saving finishes.');
    } finally {
      setIsSavingAllFinishes(false);
    }
  };

  // Save master finish properties (thumbnail, texture, big texture, name, group, price, in_stock, custom per device, badge)
  const handleSaveMasterFinish = async (finish: GlobalFinish) => {
    const customUrl = editingFinishUrls[finish.id];
    const newTexture = customUrl !== undefined ? customUrl.trim() : (finish.texture_url || finish.thumbnail || '');
    const customBigUrl = editingFinishBigUrls[finish.id];
    const newBigTexture = customBigUrl !== undefined ? customBigUrl.trim() : (finish.texture_big_url || '');
    const customThumb = editingFinishThumbnails[finish.id];
    const newThumb = customThumb !== undefined ? customThumb.trim() : (finish.thumbnail || '');
    const customName = editingFinishNames[finish.id];
    const newName = customName !== undefined ? customName.trim() : finish.name;
    const customGroup = editingFinishGroups[finish.id];
    const newGroup = customGroup !== undefined ? customGroup.trim() : finish.group;
    const customPrice = editingFinishPrices[finish.id];
    const newPrice = customPrice !== undefined ? customPrice : finish.extra_price;
    const customStock = editingFinishStock[finish.id];
    const newStock = customStock !== undefined ? customStock : (finish.in_stock !== false);
    const customActive = editingFinishActive[finish.id];
    const newActive = customActive !== undefined ? customActive : (finish.is_active !== false);
    const customFlag = editingFinishCustomFlags[finish.id];
    const newCustomFlag = customFlag !== undefined ? customFlag : Boolean(finish.is_custom_per_device);
    const customBadgeText = editingFinishBadgeTexts[finish.id];
    const newBadgeText = customBadgeText !== undefined ? customBadgeText.trim() : (finish.badge_text || '');
    const customBadgeColor = editingFinishBadgeColors[finish.id];
    const newBadgeColor = customBadgeColor !== undefined ? customBadgeColor.trim() : (finish.badge_color || '#f3aa18');
    const customShadow = editingFinishShadowOpacities[finish.id];
    const newShadow = customShadow !== undefined ? customShadow : (typeof finish.shadow_opacity === 'number' ? finish.shadow_opacity : 0.85);
    const customHighlight = editingFinishHighlightOpacities[finish.id];
    const newHighlight = customHighlight !== undefined ? customHighlight : (typeof finish.highlight_opacity === 'number' ? finish.highlight_opacity : 0.35);

    try {
      setSavingFinishId(finish.id);
      const res = await saveGlobalFinishDirect({
        id: finish.id,
        slug: finish.slug,
        name: newName,
        group: newGroup,
        thumbnail: newThumb,
        texture_url: newTexture,
        texture_big_url: newBigTexture,
        extra_price: newPrice,
        in_stock: newStock,
        is_active: newActive,
        class_name: finish.class_name,
        is_custom_per_device: newCustomFlag,
        badge_text: newBadgeText,
        badge_color: newBadgeColor,
        shadow_opacity: newShadow,
        highlight_opacity: newHighlight,
      });
      if (res.success) {
        showToast('success', 'Finish Saved', `Finish "${newName}" updated successfully.`);
        if (Array.isArray(res.finishes)) {
          setFinishes(res.finishes);
        } else {
          setFinishes((prev) =>
            prev.map((f) =>
              f.id === finish.id
                ? {
                    ...f,
                    name: newName,
                    group: newGroup,
                    thumbnail: newThumb,
                    texture_url: newTexture,
                    texture_big_url: newBigTexture,
                    extra_price: newPrice,
                    in_stock: newStock,
                    is_active: newActive,
                    is_custom_per_device: newCustomFlag,
                    badge_text: newBadgeText,
                    badge_color: newBadgeColor,
                    shadow_opacity: newShadow,
                    highlight_opacity: newHighlight,
                  }
                : f
            )
          );
        }
        if (Array.isArray(res.groups)) {
          setStoredFinishGroups(res.groups);
        }

        // Clean up editing state for this finish so it marks as clean
        setEditingFinishUrls((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishBigUrls((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishThumbnails((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishNames((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishGroups((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishPrices((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishStock((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishActive((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishCustomFlags((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishBadgeTexts((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishBadgeColors((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishShadowOpacities((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
        setEditingFinishHighlightOpacities((prev) => { const n = { ...prev }; delete n[finish.id]; return n; });
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed updating finish');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error saving finish');
    } finally {
      setSavingFinishId(null);
    }
  };

  // Delete a finish
  const handleDeleteFinish = async (id: string) => {
    try {
      setSavingFinishId(id);
      const res = await deleteGlobalFinishDirect(id);
      if (res.success) {
        showToast('success', 'Finish Deleted', 'Finish removed from global inventory.');
        if (Array.isArray(res.finishes)) {
          setFinishes(res.finishes);
        } else {
          setFinishes((prev) => prev.filter((f) => f.id !== id && f.slug !== id));
        }
        if (Array.isArray(res.groups)) {
          setStoredFinishGroups(res.groups);
        }
        setDeletingFinishId(null);
      } else {
        showToast('error', 'Delete Failed', res.error || 'Failed deleting finish');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error deleting finish');
    } finally {
      setSavingFinishId(null);
    }
  };

  // Create a brand new finish
  const handleCreateNewFinish = async () => {
    if (!newFinishForm.name.trim()) {
      showToast('error', 'Missing Name', 'Please enter a name for the finish.');
      return;
    }
    const slug =
      newFinishForm.slug.trim() ||
      newFinishForm.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    if (!slug) {
      showToast('error', 'Invalid Slug', 'Please provide a valid slug.');
      return;
    }
    try {
      setIsCreatingFinish(true);
      const res = await saveGlobalFinishDirect({
        id: slug,
        slug,
        name: newFinishForm.name.trim(),
        group: newFinishForm.group.trim() || 'Signature skins',
        thumbnail: newFinishForm.thumbnail.trim(),
        texture_url: newFinishForm.texture_url.trim() || newFinishForm.thumbnail.trim(),
        extra_price: Number(newFinishForm.extra_price) || 0,
        in_stock: true,
        is_active: true,
        order: finishes.length,
        class_name: `cfg-${slug}`,
        is_custom_per_device: Boolean(newFinishForm.is_custom_per_device),
        badge_text: newFinishForm.badge_text?.trim() || '',
        badge_color: newFinishForm.badge_color?.trim() || '#f3aa18',
      });
      if (res.success) {
        showToast('success', 'Finish Created', `Added finish "${newFinishForm.name.trim()}".`);
        if (Array.isArray(res.finishes)) {
          setFinishes(res.finishes);
        }
        if (Array.isArray(res.groups)) {
          setStoredFinishGroups(res.groups);
        }
        setShowAddNewFinishModal(false);
        setNewFinishForm({
          name: '',
          slug: '',
          group: storedFinishGroups[0] || 'Signature skins',
          thumbnail: '',
          texture_url: '',
          extra_price: 0,
          is_custom_per_device: false,
          badge_text: '',
          badge_color: '#f3aa18',
        });
      } else {
        showToast('error', 'Creation Failed', res.error || 'Could not create finish.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error creating finish.');
    } finally {
      setIsCreatingFinish(false);
    }
  };

  // Move a group up or down in sequence
  const handleMoveGroup = async (groupName: string, direction: 'up' | 'down') => {
    const currentGroups = [...storedFinishGroups];
    const idx = currentGroups.indexOf(groupName);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentGroups.length) return;

    const temp = currentGroups[idx];
    currentGroups[idx] = currentGroups[targetIdx];
    currentGroups[targetIdx] = temp;

    setStoredFinishGroups(currentGroups);

    try {
      const res = await reorderFinishGroupsDirect(currentGroups);
      if (res.success) {
        showToast('success', 'Groups Reordered', `Group "${groupName}" moved ${direction}.`);
        if (Array.isArray(res.groups)) {
          setStoredFinishGroups(res.groups);
        }
      } else {
        showToast('error', 'Reorder Failed', res.error || 'Failed saving group order');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error reordering groups');
    }
  };

  // Add a new finish group
  const handleAddNewGroup = async () => {
    const trimmed = newGroupNameInput.trim();
    if (!trimmed) return;
    if (storedFinishGroups.includes(trimmed)) {
      showToast('info', 'Group Exists', `Group "${trimmed}" already exists.`);
      setNewGroupNameInput('');
      return;
    }
    const updated = [...storedFinishGroups, trimmed];
    setStoredFinishGroups(updated);
    setNewGroupNameInput('');
    try {
      const res = await reorderFinishGroupsDirect(updated);
      if (res.success) {
        showToast('success', 'Group Added', `Added new group "${trimmed}".`);
        if (Array.isArray(res.groups)) {
          setStoredFinishGroups(res.groups);
        }
      } else {
        showToast('error', 'Add Failed', res.error || 'Failed adding group');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error adding group');
    }
  };

  // Remove an empty group
  const handleDeleteGroup = async (groupName: string) => {
    const finishesInGroup = finishes.filter(
      (f) => (editingFinishGroups[f.id] || f.group) === groupName
    );
    if (finishesInGroup.length > 0) {
      showToast(
        'warning',
        'Group Not Empty',
        `Cannot remove "${groupName}" because ${finishesInGroup.length} finish(es) belong to it. Reassign them first.`
      );
      return;
    }
    const updated = storedFinishGroups.filter((g) => g !== groupName);
    setStoredFinishGroups(updated);
    try {
      const res = await reorderFinishGroupsDirect(updated);
      if (res.success) {
        showToast('success', 'Group Removed', `Group "${groupName}" removed.`);
        if (Array.isArray(res.groups)) {
          setStoredFinishGroups(res.groups);
        }
      } else {
        showToast('error', 'Remove Failed', res.error || 'Failed removing group');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error removing group');
    }
  };

  // Rename a finish group and migrate all assigned finishes
  const handleRenameGroup = async (oldName: string, rawNewName: string) => {
    const trimmed = rawNewName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingGroupName(null);
      return;
    }
    if (storedFinishGroups.some((g) => g.toLowerCase() === trimmed.toLowerCase() && g !== oldName)) {
      showToast('error', 'Group Exists', `A group named "${trimmed}" already exists.`);
      return;
    }

    try {
      setIsRenamingGroup(true);
      const res = await renameFinishGroupDirect(oldName, trimmed);
      if (res.success) {
        showToast(
          'success',
          'Group Renamed',
          `Renamed "${oldName}" to "${trimmed}" and updated ${res.updated_count ?? 0} finish(es).`
        );
        if (Array.isArray(res.groups)) {
          setStoredFinishGroups(res.groups);
        } else {
          setStoredFinishGroups((prev) => prev.map((g) => (g === oldName ? trimmed : g)));
        }
        if (Array.isArray(res.finishes)) {
          setFinishes(res.finishes);
        } else {
          setFinishes((prev) =>
            prev.map((f) => (f.group === oldName ? { ...f, group: trimmed } : f))
          );
        }
        // Update local editingFinishGroups mapping
        setEditingFinishGroups((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (next[k] === oldName) next[k] = trimmed;
          });
          return next;
        });
        if (masterTextureGroupFilter === oldName) {
          setMasterTextureGroupFilter(trimmed);
        }
        setEditingGroupName(null);
      } else {
        showToast('error', 'Rename Failed', res.error || 'Could not rename group.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error renaming group.');
    } finally {
      setIsRenamingGroup(false);
    }
  };

  // Save group presentation settings (Tactile Cards vs Compact Dots, expansion, limit)
  const handleSaveGroupSetting = async (groupName: string, setting: FinishGroupSetting) => {
    const updated = {
      ...finishGroupSettings,
      [groupName]: setting,
    };
    setFinishGroupSettings(updated);
    try {
      setIsSavingGroupSettings(true);
      const res = await saveFinishGroupSettingsDirect(updated);
      if (res.success) {
        showToast('success', 'Group Settings Saved', `Display settings for "${groupName}" updated.`);
        if (res.group_settings) {
          setFinishGroupSettings(res.group_settings);
        }
        setEditingGroupSetting(null);
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed to save group settings.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error saving group settings.');
    } finally {
      setIsSavingGroupSettings(false);
    }
  };

  // Save or create a bespoke configurator preset
  const handleSavePreset = async (preset: ConfiguratorPreset) => {
    const cleanId = preset.id || preset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const presetWithId = { ...preset, id: cleanId };
    const existingIndex = configuratorPresets.findIndex((p) => p.id === cleanId);
    let updated: ConfiguratorPreset[];
    if (existingIndex >= 0) {
      updated = configuratorPresets.map((p, idx) => (idx === existingIndex ? presetWithId : p));
    } else {
      updated = [...configuratorPresets, presetWithId];
    }
    setConfiguratorPresets(updated);
    try {
      setIsSavingPresets(true);
      const res = await saveConfiguratorPresetsDirect(updated);
      if (res.success) {
        showToast('success', 'Preset Saved', `Preset "${preset.title}" saved successfully.`);
        if (Array.isArray(res.presets)) {
          setConfiguratorPresets(res.presets);
        }
        setEditingPreset(null);
      } else {
        showToast('error', 'Save Failed', res.error || 'Failed to save preset.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error saving preset.');
    } finally {
      setIsSavingPresets(false);
    }
  };

  // Delete a bespoke preset
  const handleDeletePreset = async (presetId: string) => {
    const updated = configuratorPresets.filter((p) => p.id !== presetId);
    setConfiguratorPresets(updated);
    try {
      setIsSavingPresets(true);
      const res = await saveConfiguratorPresetsDirect(updated);
      if (res.success) {
        showToast('success', 'Preset Removed', 'Bespoke preset removed.');
        if (Array.isArray(res.presets)) {
          setConfiguratorPresets(res.presets);
        }
      } else {
        showToast('error', 'Delete Failed', res.error || 'Failed to delete preset.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error deleting preset.');
    } finally {
      setIsSavingPresets(false);
    }
  };

  // Instantly toggle a finish between Active and Inactive
  const handleToggleFinishActive = async (finish: GlobalFinish) => {
    const currentActive =
      editingFinishActive[finish.id] !== undefined
        ? editingFinishActive[finish.id]
        : finish.is_active !== false;
    const nextActive = !currentActive;

    // Optimistically update local map
    setEditingFinishActive((prev) => ({ ...prev, [finish.id]: nextActive }));
    setFinishes((prev) =>
      prev.map((f) => (f.id === finish.id ? { ...f, is_active: nextActive } : f))
    );

    try {
      const res = await toggleFinishActiveDirect(finish.id, nextActive);
      if (res.success) {
        showToast(
          'success',
          nextActive ? 'Finish Activated' : 'Finish Deactivated',
          `"${finish.name}" is now ${nextActive ? 'Active (Visible on store)' : 'Inactive (Hidden from storefront)'}.`
        );
        if (Array.isArray(res.finishes)) {
          setFinishes(res.finishes);
        }
      } else {
        // Revert on failure
        setEditingFinishActive((prev) => ({ ...prev, [finish.id]: currentActive }));
        setFinishes((prev) =>
          prev.map((f) => (f.id === finish.id ? { ...f, is_active: currentActive } : f))
        );
        showToast('error', 'Update Failed', res.error || 'Failed to toggle finish status.');
      }
    } catch (err: any) {
      setEditingFinishActive((prev) => ({ ...prev, [finish.id]: currentActive }));
      setFinishes((prev) =>
        prev.map((f) => (f.id === finish.id ? { ...f, is_active: currentActive } : f))
      );
      showToast('error', 'Error', err.message || 'Error toggling finish status.');
    }
  };

  // Move a finish up or down within its group
  const handleMoveFinishInGroup = async (finishId: string, direction: 'up' | 'down') => {
    const target = finishes.find((f) => f.id === finishId);
    if (!target) return;
    const targetGroup = editingFinishGroups[target.id] || target.group || '';

    // Get all finishes in this group sorted by their current sequence
    const groupFinishes = finishes
      .filter((f) => (editingFinishGroups[f.id] || f.group || '') === targetGroup)
      .sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });

    const idx = groupFinishes.findIndex((f) => f.id === finishId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groupFinishes.length) return;

    // Swap in array
    const temp = groupFinishes[idx];
    groupFinishes[idx] = groupFinishes[swapIdx];
    groupFinishes[swapIdx] = temp;

    // Assign sequential order (0, 1, 2, ...) to the items in this group
    const updatedOrderMap = new Map<string, number>();
    groupFinishes.forEach((item, index) => {
      updatedOrderMap.set(item.id, index);
    });

    const updatedFinishes = finishes.map((f) => {
      if (updatedOrderMap.has(f.id)) {
        return { ...f, order: updatedOrderMap.get(f.id)! };
      }
      return f;
    });

    setFinishes(updatedFinishes);

    try {
      const res = await saveAllGlobalFinishesDirect(updatedFinishes, storedFinishGroups);
      if (res.success) {
        showToast(
          'success',
          'Finish Reordered',
          `Moved "${target.name}" ${direction === 'up' ? 'higher' : 'lower'} in "${targetGroup}".`
        );
        if (Array.isArray(res.finishes)) {
          setFinishes(res.finishes);
        }
      } else {
        showToast('error', 'Reorder Failed', res.error || 'Failed to save reordered finishes.');
      }
    } catch (err: any) {
      showToast('error', 'Error', err.message || 'Error saving finish order.');
    }
  };

  // Active / Inactive counts for Master Textures modal
  const { activeCount, inactiveCount } = useMemo(() => {
    let active = 0;
    let inactive = 0;
    finishes.forEach((f) => {
      const isActive =
        editingFinishActive[f.id] !== undefined
          ? editingFinishActive[f.id]
          : f.is_active !== false;
      if (isActive) active++;
      else inactive++;
    });
    return { activeCount: active, inactiveCount: inactive };
  }, [finishes, editingFinishActive]);

  // Finish groups for filter tabs (all stored groups + any groups in finishes)
  const finishGroups = useMemo(() => {
    const rawGroups = new Set<string>();
    storedFinishGroups.forEach((g) => {
      if (g) rawGroups.add(g);
    });
    finishes.forEach((f) => {
      const grp = editingFinishGroups[f.id] || f.group;
      if (grp) rawGroups.add(grp);
    });
    const sorted = Array.from(rawGroups).sort((a, b) => {
      const idxA = storedFinishGroups.indexOf(a);
      const idxB = storedFinishGroups.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return ['all', ...sorted];
  }, [finishes, storedFinishGroups, editingFinishGroups]);

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

    editingProfile.layers.forEach((layer, idx) => {
      const isSelected = selectedSimLayers[layer.id] ?? (layer.default_selected || layer.is_required);
      if (isSelected) {
        const isPrimary =
          layer.group === 'primary' ||
          layer.id === 'back' ||
          layer.id === 'back-skin' ||
          /\b(back|top lid|body|base|full)\b/i.test(layer.name || '') ||
          (idx === 0 && !/\b(series|version|connectivity|model)\b/i.test(layer.name || '') && layer.id !== 'series' && layer.id !== 'version');

        const effectiveLayerExtra = isPrimary ? 0 : (Number(layer.extra_price) || 0);
        total += effectiveLayerExtra;

        const partFinishSlug = selectedLayerFinishes[layer.id] || selectedSimFinish;
        const fObj = finishes.find((f) => (f.slug || f.id) === partFinishSlug || f.id === partFinishSlug);
        const baseFinishExtra = Number(fObj?.extra_price) || 0;

        if (fObj && baseFinishExtra > 0) {
          const isCustomDeviceFinish = Boolean(
            fObj.is_custom_per_device ||
            (layer.assets_by_view &&
              Object.values(layer.assets_by_view).some(
                (a) => a.render_texture_map && a.render_texture_map[fObj.slug || fObj.id]
              ))
          );

          let finishExtra = 0;
          if (isCustomDeviceFinish) {
            // Custom device finishes (e.g. Everything set as +120,000): always honor exact price set on finish
            finishExtra = Math.round(baseFinishExtra * (isPrimary ? multiplier : 1.0));
          } else if (isPrimary) {
            // Standard signature finishes on primary skin: honor extra_price * multiplier
            finishExtra = Math.round(baseFinishExtra * multiplier);
          } else if (fObj.accent_extra_price && fObj.accent_extra_price > 0) {
            // Explicit accent override
            finishExtra = fObj.accent_extra_price;
          } else {
            // Surcharge tiers for secondary/accent cutouts
            const matchedTier = surchargeTiers.find(
              (t) => effectiveLayerExtra >= t.min_price && effectiveLayerExtra <= t.max_price
            );
            if (matchedTier) {
              finishExtra = matchedTier.surcharge;
            } else {
              finishExtra = Math.min(baseFinishExtra, 15000);
            }
          }
          total += finishExtra;
        }
      }
    });

    // Coverage upcharge (e.g. Model 360 wrap)
    const covType = editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
    if (covType === 'model_cut_and_360' && selectedCoverage === 'model_360') {
      const extra360 = Number(editingProfile.coverage_and_cutouts?.model_360_extra_price) || 40000;
      total += extra360;
    }

    // Production variant option price differences (e.g. Wi-Fi + Cellular upcharge)
    if (editingProfile.variants && editingProfile.variants.length > 0) {
      editingProfile.variants.forEach((v) => {
        const vId = (v.id || '').toLowerCase();
        const vName = (v.name || '').toLowerCase();
        if (vId.includes('logo') || vName.includes('logo') || vId.includes('cutout') || vId.includes('coverage') || vName.includes('coverage')) {
          return;
        }
        const selectedOptId = selectedSimVariants[v.id] || v.options[0]?.id;
        const opt = v.options.find((o) => o.id === selectedOptId);
        if (opt && opt.price_diff) {
          total += Number(opt.price_diff) || 0;
        }
      });
    }

    return total;
  }, [editingProfile, selectedSimLayers, selectedLayerFinishes, selectedSimFinish, finishes, selectedCoverage, selectedSimVariants, surchargeTiers]);

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
        titleClassName="font-heading font-normal tracking-wide text-2xl sm:text-3xl"
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
              type="button"
              onClick={() => setShowMasterTexturesModal(true)}
              className="px-4 py-2 text-xs font-sans font-medium rounded-xl border border-sky-500/30 hover:bg-sky-500/10 text-sky-300 transition-colors flex items-center gap-2 cursor-pointer"
              title="Manage global master finish textures used by all v2 Modern configurators"
            >
              <Palette className="w-3.5 h-3.5 text-sky-400" />
              <span>Master Textures (v2)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSurchargeTiersModal(true)}
              className="px-4 py-2 text-xs font-sans font-medium rounded-xl border border-amber-500/30 hover:bg-amber-500/10 text-amber-300 transition-colors flex items-center gap-2 cursor-pointer"
              title="Manage global finish surcharge brackets by part base price"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Surcharge Tiers ({surchargeTiers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleRevalidateStorefront({ purgeAll: true })}
              disabled={isRevalidatingWeb}
              className="px-4 py-2 text-xs font-sans font-medium rounded-xl border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Purge Next.js ISR catalog cache and Cloudflare edge cache for web.exacoat.com"
            >
              <Globe className={clsx('w-3.5 h-3.5 text-indigo-400', isRevalidatingWeb && 'animate-spin')} />
              <span>{isRevalidatingWeb ? 'Revalidating Web...' : 'Revalidate Web'}</span>
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
              type="button"
              onClick={handleSyncFamilies}
              disabled={isSyncingFamilies}
              className="px-4 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl border border-white/10 hover:bg-white/[0.06] text-zinc-300 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              title="Auto-detect tablets, laptops, foldables, and keyboards to set correct device family and size pricing multiplier"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5 text-[#f3aa18]', isSyncingFamilies && 'animate-spin')} />
              <span>{isSyncingFamilies ? 'Syncing Families...' : 'Sync Families'}</span>
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
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-zinc-950/60 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-zinc-900/60 text-[11px] uppercase tracking-wider font-semibold text-zinc-400">
                  <th className="py-3 px-4 w-10 text-center">Status</th>
                  <th className="py-3 px-4 min-w-[220px]">Device / Model</th>
                  <th className="py-3 px-4 min-w-[150px]">Category</th>
                  <th className="py-3 px-3 text-center">Engine</th>
                  <th className="py-3 px-3 text-center">Configurator</th>
                  <th className="py-3 px-4 text-center">Setup</th>
                  <th className="py-3 px-3 text-center">Scale</th>
                  <th className="py-3 px-3 text-center">Presets</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredProfiles.map((p) => {
                  const isAuditedClean =
                    p.last_audited_at &&
                    p.audit_status !== 'issues' &&
                    !(p.audit_issues && p.audit_issues > 0);
                  const isAuditedIssues =
                    p.last_audited_at &&
                    (p.audit_status === 'issues' || Boolean(p.audit_issues && p.audit_issues > 0));

                  return (
                    <tr
                      key={p.product_id}
                      onClick={() => handleOpenEditor(p.product_id)}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      {/* Status Dot */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={clsx(
                            'inline-block w-2.5 h-2.5 rounded-full',
                            isAuditedClean
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                              : isAuditedIssues
                              ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]'
                              : 'bg-zinc-600'
                          )}
                          title={
                            isAuditedClean
                              ? 'Audited clean'
                              : isAuditedIssues
                              ? `Issues detected (${p.audit_issues || 1})`
                              : 'Unaudited'
                          }
                        />
                      </td>

                      {/* Device Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-normal tracking-wide text-white group-hover:text-[#f3aa18] transition-colors">
                            {p.name}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">
                            #{p.product_id}
                          </span>
                          {p.status === 'draft' && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Draft
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-zinc-400 truncate max-w-[180px]">
                        {p.categories.join(', ') || 'Uncategorized'}
                      </td>

                      {/* Engine */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={clsx(
                            'text-[10px] font-mono px-2 py-0.5 rounded-md border font-medium',
                            (p.configurator_version || 'v1') === 'v2'
                              ? 'bg-white/10 text-white border-white/20'
                              : 'bg-zinc-900 text-zinc-400 border-white/5'
                          )}
                        >
                          {(p.configurator_version || 'v1') === 'v2' ? 'v2' : 'v1'}
                        </span>
                      </td>

                      {/* Configurator Toggle */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={togglingConfiguratorId === p.product_id}
                          onClick={() => handleToggleConfiguratorStatus(p.product_id, p.is_configurator !== false)}
                          className={clsx(
                            'text-[10px] font-sans px-2.5 py-1 rounded-full border font-semibold inline-flex items-center gap-1 transition-all cursor-pointer',
                            p.is_configurator !== false
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-white'
                          )}
                          title={
                            p.is_configurator !== false
                              ? 'Active Configurator. Click to exclude.'
                              : 'Excluded. Click to enable.'
                          }
                        >
                          {togglingConfiguratorId === p.product_id ? (
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          ) : p.is_configurator !== false ? (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          ) : (
                            <AlertCircle className="w-2.5 h-2.5 text-zinc-500" />
                          )}
                          <span>{p.is_configurator !== false ? 'Active' : 'Excluded'}</span>
                        </button>
                      </td>

                      {/* Setup Specs */}
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-zinc-400">
                        <span>{p.views_count}v</span>
                        <span className="mx-1 text-zinc-600">•</span>
                        <span>{p.layers_count}L</span>
                      </td>

                      {/* Scale */}
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-zinc-300">
                        {Math.round((((p as any).views?.[0]?.texture_scale ?? p.texture_scale ?? 0.75)) * 100)}%
                      </td>

                      {/* Presets Count */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={clsx(
                            'text-[10px] font-mono px-2 py-0.5 rounded-md border font-medium',
                            (p.presets_count || 0) > 0
                              ? 'bg-[#f3aa18]/15 text-[#f3aa18] border-[#f3aa18]/30 font-semibold'
                              : 'bg-zinc-900/80 text-zinc-500 border-white/5'
                          )}
                        >
                          {(p.presets_count || 0) > 0 ? `${p.presets_count} Looks` : '0'}
                        </span>
                      </td>

                      {/* Price */}
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPriceModal(p);
                        }}
                      >
                        <span className="font-mono font-medium text-white hover:text-[#f3aa18] transition-colors inline-flex items-center gap-1 cursor-pointer">
                          IDR {p.price.toLocaleString('id-ID')}
                          <Edit3 className="w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDuplicateModal(p)}
                            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            title="Duplicate product & profile"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditor(p.product_id)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white/10 hover:bg-[#f3aa18] hover:text-black text-white transition-colors cursor-pointer"
                          >
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                      <h3 className="text-sm font-heading font-normal tracking-wider uppercase text-white">Catalog-Wide Asset Integrity Audit</h3>
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
                              <h4 className="text-sm font-heading font-normal tracking-wide text-white">{d.deviceName}</h4>
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
            <div className="w-full max-w-5xl max-h-[92vh] rounded-3xl bg-[#121215] border border-white/15 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4 bg-zinc-900/50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18] shrink-0">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-heading font-normal tracking-wider uppercase text-white">Global Master Finish Textures (v2 Engine)</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-zinc-300 border border-white/10 font-mono">
                        {finishes.length} Finishes
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 max-w-xl">
                      Configure universal swatch thumbnails, master textures, notice badges, and group sequence for all v2 devices.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowPresetsManagerModal(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-sans font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Manage curated multi-layer bespoke presets"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bespoke Presets ({configuratorPresets.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsManagingGroups(!isManagingGroups)}
                    className={clsx(
                      'px-3 py-1.5 rounded-xl text-xs font-sans font-medium flex items-center gap-1.5 transition-colors cursor-pointer border',
                      isManagingGroups
                        ? 'bg-[#f3aa18]/20 border-[#f3aa18]/40 text-[#f3aa18]'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
                    )}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Manage Groups</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewFinishForm({
                        name: '',
                        slug: '',
                        group: storedFinishGroups[0] || 'Signature skins',
                        thumbnail: '',
                        texture_url: '',
                        extra_price: 0,
                        is_custom_per_device: false,
                        badge_text: '',
                        badge_color: '#f3aa18',
                      });
                      setShowAddNewFinishModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-sans font-semibold bg-[#f3aa18] hover:bg-[#ffb72b] text-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Finish</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (dirtyFinishes.length > 0) {
                        handleDiscardMasterFinishChanges();
                      } else {
                        setShowMasterTexturesModal(false);
                      }
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Group Management & Reordering Tray */}
              {isManagingGroups && (
                <div className="p-4 bg-zinc-950 border-b border-white/10 space-y-2.5 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-[#f3aa18]" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Finish Groups Order
                      </span>
                      <InfoTooltip content="Reorder groups to change tab priority across all v2 configurators (e.g. move Limited first)." />
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      {storedFinishGroups.length} Groups
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {storedFinishGroups.map((grp, idx) => {
                      const count = finishes.filter(
                        (f) => (editingFinishGroups[f.id] || f.group) === grp
                      ).length;

                      if (editingGroupName && editingGroupName.oldName === grp) {
                        return (
                          <div
                            key={grp}
                            className="flex items-center gap-1 p-1 rounded-xl bg-amber-500/10 border border-amber-500/40 animate-in fade-in zoom-in-95"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editingGroupName.newName}
                              onChange={(e) =>
                                setEditingGroupName({ ...editingGroupName, newName: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameGroup(grp, editingGroupName.newName);
                                if (e.key === 'Escape') setEditingGroupName(null);
                              }}
                              className="px-2 py-0.5 text-xs font-semibold rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-amber-400 w-32"
                              placeholder="Group name..."
                            />
                            <button
                              type="button"
                              disabled={isRenamingGroup || !editingGroupName.newName.trim()}
                              onClick={() => handleRenameGroup(grp, editingGroupName.newName)}
                              className="p-1 rounded-lg bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
                              title="Save group name"
                            >
                              {isRenamingGroup ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingGroupName(null)}
                              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={grp}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/10 text-xs font-sans text-zinc-200 shadow-xs group/grp"
                        >
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveGroup(grp, 'up')}
                            className={clsx(
                              'p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer',
                              idx === 0 ? 'opacity-20 cursor-not-allowed' : 'text-zinc-400 hover:text-white'
                            )}
                            title="Move Left / Up"
                          >
                            <ChevronUp className="w-3 h-3 -rotate-90" />
                          </button>
                          <span className="font-semibold text-white px-0.5">{grp}</span>
                          <span className="text-[10px] text-zinc-500 font-mono pr-0.5">({count})</span>

                          {/* Group display style indicator pill */}
                          {(() => {
                            const setting = finishGroupSettings[grp];
                            const isDots = setting?.display_style === 'compact_dots';
                            const isCollapsible = setting?.collapsed_by_default;
                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingGroupSetting({
                                    groupName: grp,
                                    setting: setting || {
                                      display_style: 'cards',
                                      collapsed_by_default: false,
                                      show_more_limit: 0,
                                    },
                                  })
                                }
                                className={clsx(
                                  'px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-colors',
                                  isDots
                                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25'
                                    : 'bg-zinc-800 text-zinc-400 border border-white/5 hover:bg-zinc-700'
                                )}
                                title="Configure group display style (Cards vs Compact Dots, expansion, limit)"
                              >
                                <span>{isDots ? '● Dots' : '▣ Cards'}</span>
                                {isCollapsible && <span className="text-amber-400">▾</span>}
                                {(setting?.show_more_limit || 0) > 0 && (
                                  <span className="text-amber-400 font-bold">[{setting?.show_more_limit}]</span>
                                )}
                              </button>
                            );
                          })()}

                          {/* Configure Group Settings Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setEditingGroupSetting({
                                groupName: grp,
                                setting: finishGroupSettings[grp] || {
                                  display_style: 'cards',
                                  collapsed_by_default: false,
                                  show_more_limit: 0,
                                },
                              })
                            }
                            className="p-0.5 text-zinc-400 hover:text-cyan-400 rounded hover:bg-white/10 transition-colors cursor-pointer"
                            title={`Configure display settings for "${grp}"`}
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                          </button>

                          {/* Rename Group Button */}
                          <button
                            type="button"
                            onClick={() => setEditingGroupName({ oldName: grp, newName: grp })}
                            className="p-0.5 text-zinc-500 hover:text-amber-400 rounded hover:bg-white/10 transition-colors cursor-pointer"
                            title={`Rename group "${grp}"`}
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            disabled={idx === storedFinishGroups.length - 1}
                            onClick={() => handleMoveGroup(grp, 'down')}
                            className={clsx(
                              'p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer',
                              idx === storedFinishGroups.length - 1 ? 'opacity-20 cursor-not-allowed' : 'text-zinc-400 hover:text-white'
                            )}
                            title="Move Right / Down"
                          >
                            <ChevronDown className="w-3 h-3 -rotate-90" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(grp)}
                            className={clsx(
                              'p-0.5 rounded transition-colors cursor-pointer ml-0.5',
                              count === 0
                                ? 'text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10'
                                : 'text-zinc-700 hover:text-zinc-500'
                            )}
                            title={
                              count === 0
                                ? `Remove empty group "${grp}"`
                                : `Group "${grp}" has ${count} finish(es)`
                            }
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Quick Add Group */}
                    <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-xl border border-white/10">
                      <input
                        type="text"
                        placeholder="New group..."
                        value={newGroupNameInput}
                        onChange={(e) => setNewGroupNameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddNewGroup();
                        }}
                        className="px-2 py-1 text-xs rounded-lg bg-zinc-950 border border-white/5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18] w-28"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewGroup}
                        disabled={!newGroupNameInput.trim()}
                        className="px-2 py-1 text-xs font-semibold rounded-lg bg-[#f3aa18] text-black hover:bg-[#ffb72b] disabled:opacity-40 cursor-pointer transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Filter & Search Bar */}
              <div className="p-4 border-b border-white/10 bg-zinc-900/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search finish by name or slug..."
                    value={masterTextureSearch}
                    onChange={(e) => setMasterTextureSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 text-xs font-sans rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#f3aa18]"
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

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  {/* Active / Inactive Status Filter */}
                  <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-xl border border-white/10 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMasterTextureActiveFilter('all')}
                      className={clsx(
                        'px-2 py-1 rounded-lg text-xs font-sans transition-colors cursor-pointer',
                        masterTextureActiveFilter === 'all'
                          ? 'bg-white/15 text-white font-semibold shadow-xs'
                          : 'text-zinc-400 hover:text-white'
                      )}
                    >
                      All ({finishes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMasterTextureActiveFilter('active')}
                      className={clsx(
                        'px-2 py-1 rounded-lg text-xs font-sans transition-colors cursor-pointer flex items-center gap-1.5',
                        masterTextureActiveFilter === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-xs'
                          : 'text-zinc-400 hover:text-emerald-400'
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Active ({activeCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMasterTextureActiveFilter('inactive')}
                      className={clsx(
                        'px-2 py-1 rounded-lg text-xs font-sans transition-colors cursor-pointer flex items-center gap-1.5',
                        masterTextureActiveFilter === 'inactive'
                          ? 'bg-zinc-800 text-zinc-200 font-semibold border border-white/20 shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-200'
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      <span>Inactive ({inactiveCount})</span>
                    </button>
                  </div>

                  <div className="h-4 w-px bg-white/10 hidden sm:block" />

                  {/* Group Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {finishGroups.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setMasterTextureGroupFilter(group)}
                        className={clsx(
                          'px-2.5 py-1 rounded-lg text-xs font-sans whitespace-nowrap transition-colors cursor-pointer capitalize',
                          masterTextureGroupFilter === group
                            ? 'bg-[#f3aa18]/20 text-[#f3aa18] font-bold border border-[#f3aa18]/40'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        )}
                      >
                        {group === 'all' ? 'All Groups' : group}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Finishes List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
                {(() => {
                  const filteredMasterFinishes = finishes
                    .filter((f) => {
                      const q = masterTextureSearch.toLowerCase().trim();
                      const matchesSearch =
                        !q || f.name.toLowerCase().includes(q) || (f.slug || f.id).toLowerCase().includes(q);
                      const matchesGroup =
                        masterTextureGroupFilter === 'all' ||
                        (editingFinishGroups[f.id] || f.group) === masterTextureGroupFilter;
                      const isActive =
                        editingFinishActive[f.id] !== undefined
                          ? editingFinishActive[f.id]
                          : f.is_active !== false;
                      const matchesActive =
                        masterTextureActiveFilter === 'all' ||
                        (masterTextureActiveFilter === 'active' && isActive) ||
                        (masterTextureActiveFilter === 'inactive' && !isActive);
                      return matchesSearch && matchesGroup && matchesActive;
                    })
                    .sort((a, b) => {
                      const groupA = editingFinishGroups[a.id] || a.group || '';
                      const groupB = editingFinishGroups[b.id] || b.group || '';
                      const idxA = storedFinishGroups.indexOf(groupA);
                      const idxB = storedFinishGroups.indexOf(groupB);
                      if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
                      if (idxA !== -1 && idxB === -1) return -1;
                      if (idxA === -1 && idxB !== -1) return 1;
                      const orderA = a.order ?? 0;
                      const orderB = b.order ?? 0;
                      if (orderA !== orderB) return orderA - orderB;
                      return (a.name || '').localeCompare(b.name || '');
                    });

                  if (filteredMasterFinishes.length === 0) {
                    return (
                      <div className="p-12 text-center rounded-2xl bg-zinc-950/40 border border-dashed border-white/10 space-y-2.5 my-4">
                        <Layers className="w-9 h-9 text-zinc-600 mx-auto" />
                        <p className="text-sm font-semibold text-zinc-300">
                          {masterTextureGroupFilter !== 'all'
                            ? `No finishes in "${masterTextureGroupFilter}" yet`
                            : 'No finishes match your search or filter'}
                        </p>
                        <p className="text-xs text-zinc-500 max-w-md mx-auto">
                          {masterTextureGroupFilter !== 'all'
                            ? 'You can assign existing finishes to this group using the group dropdown on any finish card, or click "+ Add Finish" above.'
                            : 'Try adjusting your search terms or filter selection.'}
                        </p>
                      </div>
                    );
                  }

                  return filteredMasterFinishes.map((f) => {
                    const currentThumbInput =
                      editingFinishThumbnails[f.id] !== undefined
                        ? editingFinishThumbnails[f.id]
                        : f.thumbnail || '';
                    const currentTextureInput =
                      editingFinishUrls[f.id] !== undefined
                        ? editingFinishUrls[f.id]
                        : f.texture_url || '';
                    const currentTextureBigInput =
                      editingFinishBigUrls[f.id] !== undefined
                        ? editingFinishBigUrls[f.id]
                        : f.texture_big_url || '';
                    const currentNameInput =
                      editingFinishNames[f.id] !== undefined
                        ? editingFinishNames[f.id]
                        : f.name;
                    const currentGroupInput =
                      editingFinishGroups[f.id] !== undefined
                        ? editingFinishGroups[f.id]
                        : f.group;
                    const currentPriceInput =
                      editingFinishPrices[f.id] !== undefined
                        ? editingFinishPrices[f.id]
                        : f.extra_price || 0;
                    const currentStockInput =
                      editingFinishStock[f.id] !== undefined
                        ? editingFinishStock[f.id]
                        : (f.in_stock !== false);
                    const currentActiveInput =
                      editingFinishActive[f.id] !== undefined
                        ? editingFinishActive[f.id]
                        : (f.is_active !== false);
                    const currentCustomFlag =
                      editingFinishCustomFlags[f.id] !== undefined
                        ? editingFinishCustomFlags[f.id]
                        : Boolean(f.is_custom_per_device);
                    const currentBadgeTextInput =
                      editingFinishBadgeTexts[f.id] !== undefined
                        ? editingFinishBadgeTexts[f.id]
                        : (f.badge_text || '');
                    const currentBadgeColorInput =
                      editingFinishBadgeColors[f.id] !== undefined
                        ? editingFinishBadgeColors[f.id]
                        : (f.badge_color || '#f3aa18');
                    const currentShadowInput =
                      editingFinishShadowOpacities[f.id] !== undefined
                        ? editingFinishShadowOpacities[f.id]
                        : typeof f.shadow_opacity === 'number'
                        ? f.shadow_opacity
                        : 0.85;
                    const currentHighlightInput =
                      editingFinishHighlightOpacities[f.id] !== undefined
                        ? editingFinishHighlightOpacities[f.id]
                        : typeof f.highlight_opacity === 'number'
                        ? f.highlight_opacity
                        : 0.35;

                    const isSaving = savingFinishId === f.id;
                    const hasUnsavedChanges = isFinishDirty(f);

                    const groupFinishes = finishes
                      .filter((item) => (editingFinishGroups[item.id] || item.group || '') === currentGroupInput)
                      .sort((a, b) => {
                        const orderA = a.order ?? 0;
                        const orderB = b.order ?? 0;
                        if (orderA !== orderB) return orderA - orderB;
                        return (a.name || '').localeCompare(b.name || '');
                      });
                    const posInGroup = groupFinishes.findIndex((item) => item.id === f.id);
                    const isFirstInGroup = posInGroup <= 0;
                    const isLastInGroup = posInGroup === -1 || posInGroup >= groupFinishes.length - 1;

                    return (
                      <div
                        key={f.id}
                        className={clsx(
                          'p-4 rounded-2xl border transition-all space-y-3.5 shadow-sm',
                          !currentActiveInput
                            ? 'bg-zinc-950/70 border-dashed border-zinc-800 opacity-75'
                            : 'bg-zinc-900/90 border-white/10 hover:border-white/20'
                        )}
                      >
                        {/* Header: Identification, Surcharge, Stock, Active & Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                          {/* Left: Reorder, Swatch Mini, Name, Group, Slug, Inactive Badge */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            {/* Move Up / Down Buttons within Group */}
                            <div className="flex items-center gap-0.5 bg-zinc-950/90 p-0.5 rounded-xl border border-white/10 shrink-0 shadow-inner">
                              <button
                                type="button"
                                disabled={isFirstInGroup}
                                onClick={() => handleMoveFinishInGroup(f.id, 'up')}
                                className={clsx(
                                  'p-1 rounded-lg transition-colors cursor-pointer',
                                  isFirstInGroup
                                    ? 'opacity-20 cursor-not-allowed text-zinc-600'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                                )}
                                title={isFirstInGroup ? 'First in group' : `Move up in ${currentGroupInput}`}
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[10px] font-mono px-1 text-zinc-400 select-none font-bold min-w-5 text-center">
                                #{posInGroup >= 0 ? posInGroup + 1 : 1}
                              </span>
                              <button
                                type="button"
                                disabled={isLastInGroup}
                                onClick={() => handleMoveFinishInGroup(f.id, 'down')}
                                className={clsx(
                                  'p-1 rounded-lg transition-colors cursor-pointer',
                                  isLastInGroup
                                    ? 'opacity-20 cursor-not-allowed text-zinc-600'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                                )}
                                title={isLastInGroup ? 'Last in group' : `Move down in ${currentGroupInput}`}
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/15 bg-zinc-950 shrink-0 flex items-center justify-center shadow-xs">
                              {currentThumbInput ? (
                                <img src={currentThumbInput} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full" style={{ backgroundColor: f.color_hex || '#27272a' }} />
                              )}
                            </div>

                            {/* Finish Name Input */}
                            <input
                              type="text"
                              value={currentNameInput}
                              onChange={(e) =>
                                setEditingFinishNames((prev) => ({ ...prev, [f.id]: e.target.value }))
                              }
                              className="text-xs font-bold text-white bg-zinc-950/80 border border-white/10 hover:border-white/20 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 rounded-xl px-3 py-1.5 w-36 sm:w-44 transition-all shadow-inner focus:outline-none placeholder:text-zinc-600"
                              placeholder="Finish Name"
                            />

                            {/* Finish Group Dropdown */}
                            <div className="relative inline-flex items-center">
                              <select
                                value={currentGroupInput}
                                onChange={(e) =>
                                  setEditingFinishGroups((prev) => ({ ...prev, [f.id]: e.target.value }))
                                }
                                className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-xl bg-zinc-950/80 border border-white/10 hover:border-white/20 text-zinc-200 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 cursor-pointer shadow-xs transition-all"
                              >
                                {storedFinishGroups.map((g) => (
                                  <option key={g} value={g} className="bg-zinc-900 text-zinc-200">
                                    {g}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 pointer-events-none" />
                            </div>

                            <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5 hidden sm:inline-block">
                              {f.slug}
                            </span>
                            {!currentActiveInput && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                Inactive: Hidden from Storefront
                              </span>
                            )}
                          </div>

                          {/* Right: Active/Inactive, In Stock, Price, Delete, Save */}
                          <div className="flex items-center gap-2.5">
                            {/* Active / Inactive Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleFinishActive(f)}
                              className={clsx(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer select-none shadow-xs',
                                currentActiveInput
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:bg-zinc-700/80 hover:text-zinc-200'
                              )}
                              title={currentActiveInput ? 'Click to Deactivate (Hide from buyer storefront)' : 'Click to Activate (Show on buyer storefront)'}
                            >
                              <span className={clsx('w-1.5 h-1.5 rounded-full', currentActiveInput ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500')} />
                              <span className="text-[11px] font-semibold">
                                {currentActiveInput ? 'Active' : 'Inactive'}
                              </span>
                            </button>

                            {/* In Stock / Out of Stock Toggle */}
                            <button
                              type="button"
                              onClick={() =>
                                setEditingFinishStock((prev) => ({
                                  ...prev,
                                  [f.id]: !currentStockInput,
                                }))
                              }
                              className={clsx(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer select-none shadow-xs',
                                currentStockInput
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                              )}
                              title={currentStockInput ? 'Click to mark Out of Stock' : 'Click to mark In Stock'}
                            >
                              <span className={clsx('w-1.5 h-1.5 rounded-full', currentStockInput ? 'bg-emerald-400' : 'bg-rose-400')} />
                              <span className="text-[11px] font-semibold">{currentStockInput ? 'In Stock' : 'Out of Stock'}</span>
                            </button>

                            {/* Extra Price Input */}
                            <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-white/10 hover:border-white/20 focus-within:border-amber-400/80 focus-within:ring-1 focus-within:ring-amber-400/30 px-2.5 py-1 rounded-xl shadow-inner transition-all">
                              <span className="text-zinc-500 font-mono text-[10.5px] font-semibold select-none">+IDR</span>
                              <input
                                type="number"
                                step="5000"
                                value={currentPriceInput}
                                onChange={(e) =>
                                  setEditingFinishPrices((prev) => ({
                                    ...prev,
                                    [f.id]: Number(e.target.value) || 0,
                                  }))
                                }
                                className="w-16 text-xs font-mono font-bold text-right text-white bg-transparent focus:outline-none"
                                placeholder="0"
                              />
                            </div>

                            {/* Delete Finish Button */}
                            <button
                              type="button"
                              onClick={() => setDeletingFinishId(f.id)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                              title={`Delete ${f.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Save Changes Button */}
                            <button
                              type="button"
                              onClick={() => handleSaveMasterFinish(f)}
                              disabled={isSaving || !hasUnsavedChanges}
                              className={clsx(
                                'px-3.5 py-1.5 text-xs font-sans font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs',
                                hasUnsavedChanges
                                  ? 'bg-[#f3aa18] hover:bg-[#ffb72b] text-black shadow-md'
                                  : 'bg-white/5 text-zinc-400 border border-white/10'
                              )}
                            >
                              {isSaving ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'Saved'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Body Grid: Texture Media Slots & 3D Shading Tone */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                          {/* Col 1: 3 Media Texture Slots */}
                          <div className="lg:col-span-7 p-3.5 rounded-2xl bg-zinc-950/80 border border-white/10 shadow-inner flex flex-wrap items-center justify-between gap-4">
                            {/* Swatch Thumbnail */}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setImagePickerModal({
                                    isOpen: true,
                                    finishId: f.id,
                                    finishName: currentNameInput,
                                    type: 'thumbnail',
                                    currentUrl: currentThumbInput,
                                  })
                                }
                                className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 hover:border-amber-400/80 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105 shadow-sm"
                                title="Click to assign Swatch Thumbnail"
                              >
                                {currentThumbInput ? (
                                  <img
                                    src={currentThumbInput}
                                    alt="Thumbnail"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="text-zinc-600 group-hover:text-amber-400 transition-colors flex flex-col items-center justify-center gap-0.5">
                                    <ImageIcon className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                              </button>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-zinc-200">
                                  Swatch
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className={clsx('w-1.5 h-1.5 rounded-full', currentThumbInput ? 'bg-emerald-400' : 'bg-zinc-600')} />
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {currentThumbInput ? 'Assigned' : 'Not set'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="h-8 w-px bg-white/10 hidden sm:block" />

                            {/* Master Texture (Standard) */}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setImagePickerModal({
                                    isOpen: true,
                                    finishId: f.id,
                                    finishName: currentNameInput,
                                    type: 'texture',
                                    currentUrl: currentTextureInput,
                                  })
                                }
                                className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 hover:border-amber-400/80 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105 shadow-sm"
                                title="Click to assign Master Texture (Standard)"
                              >
                                {currentTextureInput ? (
                                  <img
                                    src={currentTextureInput}
                                    alt="Texture"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="text-zinc-600 group-hover:text-amber-400 transition-colors flex flex-col items-center justify-center gap-0.5">
                                    <Layers className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                              </button>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-zinc-200">
                                  Master (v2)
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className={clsx('w-1.5 h-1.5 rounded-full', currentTextureInput ? 'bg-emerald-400' : 'bg-zinc-600')} />
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {currentTextureInput ? 'Assigned' : 'Not set'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="h-8 w-px bg-white/10 hidden sm:block" />

                            {/* Master Texture (Big / Laptop) */}
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setImagePickerModal({
                                    isOpen: true,
                                    finishId: f.id,
                                    finishName: currentNameInput,
                                    type: 'texture_big',
                                    currentUrl: currentTextureBigInput,
                                  })
                                }
                                className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 hover:border-amber-400/80 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105 shadow-sm"
                                title="Click to assign Master Texture (Big / Laptop & Tablet)"
                              >
                                {currentTextureBigInput ? (
                                  <img
                                    src={currentTextureBigInput}
                                    alt="Big Texture"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="text-zinc-600 group-hover:text-amber-400 transition-colors flex flex-col items-center justify-center gap-0.5">
                                    <Laptop className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                </div>
                              </button>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-zinc-200">
                                  Big Texture
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className={clsx('w-1.5 h-1.5 rounded-full', currentTextureBigInput ? 'bg-emerald-400' : 'bg-zinc-600')} />
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {currentTextureBigInput ? 'Assigned' : 'Optional (Auto)'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Col 2: 3D Shading & Specular Lighting Tone */}
                          <div className="lg:col-span-5 p-3.5 rounded-2xl bg-zinc-950/80 border border-white/10 shadow-inner flex flex-col justify-between space-y-2.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
                                <Sun className="w-3.5 h-3.5 text-amber-400" />
                                <span>3D Shading Tone</span>
                              </div>
                              <span className="text-[10px] text-zinc-500 font-mono">Custom per color</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-0.5">
                              {/* Shadow (Multiply) */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10.5px]">
                                  <span className="text-zinc-400 font-medium">Shadow:</span>
                                  <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md text-[10px]">
                                    {Math.round(currentShadowInput * 100)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={currentShadowInput}
                                  onChange={(e) =>
                                    setEditingFinishShadowOpacities((prev) => ({
                                      ...prev,
                                      [f.id]: parseFloat(e.target.value),
                                    }))
                                  }
                                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#f3aa18]"
                                  title="Multiply shadow intensity for this finish"
                                />
                              </div>

                              {/* Highlight (Screen) */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10.5px]">
                                  <span className="text-zinc-400 font-medium">Highlight:</span>
                                  <span className="font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-md text-[10px]">
                                    {Math.round(currentHighlightInput * 100)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={currentHighlightInput}
                                  onChange={(e) =>
                                    setEditingFinishHighlightOpacities((prev) => ({
                                      ...prev,
                                      [f.id]: parseFloat(e.target.value),
                                    }))
                                  }
                                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                                  title="Screen specular highlight intensity for this finish"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Badge Pill & Custom per device */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5 text-xs text-zinc-400">
                          {/* Notice / Badge Pill Configuration */}
                          <div className="flex items-center gap-2 bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-amber-400/50 shadow-inner transition-all">
                            <span className="text-[10.5px] text-zinc-400 font-mono font-medium">Storefront Badge:</span>
                            <input
                              type="text"
                              placeholder="NEW, HOT, etc."
                              value={currentBadgeTextInput}
                              maxLength={15}
                              onChange={(e) =>
                                setEditingFinishBadgeTexts((prev) => ({
                                  ...prev,
                                  [f.id]: e.target.value,
                                }))
                              }
                              className="w-20 sm:w-24 text-[11px] font-semibold text-white bg-transparent focus:outline-none placeholder:text-zinc-600"
                            />
                            <div className="relative w-4 h-4 rounded-full overflow-hidden border border-white/20 cursor-pointer shadow-xs shrink-0 flex items-center justify-center">
                              <input
                                type="color"
                                value={currentBadgeColorInput || '#f3aa18'}
                                onChange={(e) =>
                                  setEditingFinishBadgeColors((prev) => ({
                                    ...prev,
                                    [f.id]: e.target.value,
                                  }))
                                }
                                className="absolute -inset-2 w-8 h-8 opacity-0 cursor-pointer"
                                title="Pick badge color"
                              />
                              <div className="w-full h-full rounded-full" style={{ backgroundColor: currentBadgeColorInput || '#f3aa18' }} />
                            </div>
                            {currentBadgeTextInput.trim() && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-black font-mono shadow-xs shrink-0 transition-transform"
                                style={{ backgroundColor: currentBadgeColorInput || '#f3aa18' }}
                              >
                                {currentBadgeTextInput.trim()}
                              </span>
                            )}
                          </div>

                          {/* Custom per device toggle switch */}
                          <label
                            onClick={(e) => {
                              e.preventDefault();
                              setEditingFinishCustomFlags((prev) => ({
                                ...prev,
                                [f.id]: !currentCustomFlag,
                              }));
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-white/10 hover:border-white/20 cursor-pointer select-none transition-all shadow-inner group"
                          >
                            <div
                              className={clsx(
                                'w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 shrink-0',
                                currentCustomFlag ? 'bg-amber-400 shadow-xs shadow-amber-400/40' : 'bg-zinc-800'
                              )}
                            >
                              <div
                                className={clsx(
                                  'w-3 h-3 rounded-full bg-zinc-950 transition-transform transform shadow-xs',
                                  currentCustomFlag ? 'translate-x-3' : 'translate-x-0'
                                )}
                              />
                            </div>
                            <span className={clsx('text-[11px] font-semibold transition-colors', currentCustomFlag ? 'text-amber-300' : 'text-zinc-400 group-hover:text-zinc-200')}>
                              Custom per device
                            </span>
                            <InfoTooltip content="When enabled, this finish only appears on devices where custom artwork is uploaded in the Skins tab." />
                          </label>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/50 text-xs">
                {dirtyFinishes.length > 0 ? (
                  <div className="flex items-center gap-2 text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-semibold text-xs">
                      {dirtyFinishes.length} finish{dirtyFinishes.length > 1 ? 'es' : ''} with unsaved changes
                    </span>
                  </div>
                ) : (
                  <span className="text-zinc-400 text-[11px]">
                    Changes saved here apply storewide across all v2 Modern device configurators in real time.
                  </span>
                )}
                <div className="flex items-center gap-2.5">
                  {dirtyFinishes.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={handleDiscardMasterFinishChanges}
                        disabled={isSavingAllFinishes}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-200 border border-white/10 font-medium cursor-pointer transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAllMasterFinishes}
                        disabled={isSavingAllFinishes}
                        className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black font-semibold cursor-pointer transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingAllFinishes ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isSavingAllFinishes
                            ? 'Saving All...'
                            : `Save All Changes (${dirtyFinishes.length})`}
                        </span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowMasterTexturesModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer transition-colors"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Image Picker / Assignment Modal */}
      {imagePickerModal.isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-2xl bg-[#121215] border border-white/15 shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18]">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {imagePickerModal.type === 'thumbnail'
                        ? 'Assign Swatch Thumbnail'
                        : imagePickerModal.type === 'texture_big'
                        ? 'Assign Master Texture (Big / Laptop & Tablet)'
                        : 'Assign Master Texture (Standard)'}
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Finish: <span className="text-white font-semibold">{imagePickerModal.finishName}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImagePickerModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview & Dimension Hint */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-950 border border-white/5">
                <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                  {imagePickerModal.currentUrl ? (
                    <img
                      src={imagePickerModal.currentUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-zinc-600" />
                  )}
                </div>
                <div className="text-xs text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-200">
                    {imagePickerModal.type === 'thumbnail'
                      ? 'Swatch Thumbnail (150x150 or 500x500)'
                      : imagePickerModal.type === 'texture_big'
                      ? 'Large Master Texture (3000x2000 for Laptops & Tablets)'
                      : 'Master Texture (2000x3000 Tileable Texture)'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {imagePickerModal.type === 'thumbnail'
                      ? 'Used in category carousels, swatch pills, and tooltip previews.'
                      : imagePickerModal.type === 'texture_big'
                      ? 'High-res large master texture used for laptops, tablets, and wide devices.'
                      : 'Universal master texture dynamically masked by device alpha cutouts.'}
                  </p>
                </div>
              </div>

              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://exacoat.com/wp-content/uploads/..."
                    value={imagePickerModal.currentUrl}
                    onChange={(e) =>
                      setImagePickerModal((prev) => ({ ...prev, currentUrl: e.target.value }))
                    }
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                  />
                  {imagePickerModal.currentUrl && (
                    <button
                      type="button"
                      onClick={() => setImagePickerModal((prev) => ({ ...prev, currentUrl: '' }))}
                      className="px-2.5 py-2 text-xs rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 cursor-pointer"
                      title="Clear URL"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* WordPress Media Library Option */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMediaPickerConfig({
                      isOpen: true,
                      title: `Select ${
                        imagePickerModal.type === 'thumbnail'
                          ? 'Swatch Thumbnail'
                          : imagePickerModal.type === 'texture_big'
                          ? 'Big Master Texture'
                          : 'Master Texture'
                      }: ${imagePickerModal.finishName}`,
                      recommendedDimensions:
                        imagePickerModal.type === 'thumbnail'
                          ? 'Square Swatch Thumbnail (150x150 or 500x500)'
                          : imagePickerModal.type === 'texture_big'
                          ? 'High-Res Large Texture (3000x2000)'
                          : 'High-Res Standard Texture (2000x3000)',
                      currentUrl: imagePickerModal.currentUrl,
                      onSelect: (url) => {
                        setImagePickerModal((prev) => ({ ...prev, currentUrl: url }));
                      },
                    });
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-white/10 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-[#f3aa18]" />
                  <span>Browse WordPress Media Library</span>
                </button>
              </div>

              {/* Dialog Actions */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setImagePickerModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (imagePickerModal.type === 'thumbnail') {
                      setEditingFinishThumbnails((prev) => ({
                        ...prev,
                        [imagePickerModal.finishId]: imagePickerModal.currentUrl.trim(),
                      }));
                    } else if (imagePickerModal.type === 'texture_big') {
                      setEditingFinishBigUrls((prev) => ({
                        ...prev,
                        [imagePickerModal.finishId]: imagePickerModal.currentUrl.trim(),
                      }));
                    } else {
                      setEditingFinishUrls((prev) => ({
                        ...prev,
                        [imagePickerModal.finishId]: imagePickerModal.currentUrl.trim(),
                      }));
                    }
                    setImagePickerModal((prev) => ({ ...prev, isOpen: false }));
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Add New Finish Modal */}
      {showAddNewFinishModal &&
        createPortal(
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-3xl bg-zinc-950 border border-white/15 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#f3aa18]/15 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18]">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Add New Finish (v2)</h3>
                    <p className="text-[11px] text-zinc-400">Create a new global finish available on v2 configurators.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddNewFinishModal(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Finish Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Everything"
                      value={newFinishForm.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                        setNewFinishForm((prev) => ({
                          ...prev,
                          name,
                          slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ? autoSlug : prev.slug,
                        }));
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Slug</label>
                    <input
                      type="text"
                      placeholder="e.g. everything"
                      value={newFinishForm.slug}
                      onChange={(e) => setNewFinishForm((prev) => ({ ...prev, slug: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Group</label>
                    <select
                      value={newFinishForm.group}
                      onChange={(e) => setNewFinishForm((prev) => ({ ...prev, group: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18] cursor-pointer"
                    >
                      {storedFinishGroups.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Extra Price (IDR)</label>
                    <input
                      type="number"
                      step="5000"
                      value={newFinishForm.extra_price}
                      onChange={(e) => setNewFinishForm((prev) => ({ ...prev, extra_price: Number(e.target.value) || 0 }))}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>
                </div>

                {/* Badge Notice & Color */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Badge Notice (e.g. NEW, HOT)</label>
                    <input
                      type="text"
                      placeholder="NEW, LEAVING SOON, etc."
                      value={newFinishForm.badge_text}
                      maxLength={15}
                      onChange={(e) => setNewFinishForm((prev) => ({ ...prev, badge_text: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Badge Pill Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newFinishForm.badge_color || '#f3aa18'}
                        onChange={(e) => setNewFinishForm((prev) => ({ ...prev, badge_color: e.target.value }))}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 bg-zinc-900 p-0.5"
                      />
                      <input
                        type="text"
                        value={newFinishForm.badge_color}
                        onChange={(e) => setNewFinishForm((prev) => ({ ...prev, badge_color: e.target.value }))}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                      />
                    </div>
                  </div>
                </div>

                {/* Swatch Thumbnail URL */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    1. Swatch Thumbnail URL (Selector & Circle preview)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://media.exacoat.com/...-Thumbnail.jpg"
                      value={newFinishForm.thumbnail}
                      onChange={(e) => setNewFinishForm((prev) => ({ ...prev, thumbnail: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMediaPickerConfig({
                          isOpen: true,
                          title: 'Select Swatch Thumbnail',
                          recommendedDimensions: 'Square Swatch Thumbnail (150x150 or 500x500)',
                          currentUrl: newFinishForm.thumbnail,
                          onSelect: (url) => setNewFinishForm((prev) => ({ ...prev, thumbnail: url })),
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                    </button>
                  </div>
                </div>

                {/* Master Texture URL */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    2. Master Texture URL (Tileable pattern masked by v2 canvas)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://exacoat.com/uploads/textures/master.png"
                      value={newFinishForm.texture_url}
                      onChange={(e) => setNewFinishForm((prev) => ({ ...prev, texture_url: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setMediaPickerConfig({
                          isOpen: true,
                          title: 'Select Master Texture',
                          recommendedDimensions: 'High-Res Tileable Texture (1000x1000)',
                          currentUrl: newFinishForm.texture_url,
                          onSelect: (url) => setNewFinishForm((prev) => ({ ...prev, texture_url: url })),
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                    </button>
                  </div>
                </div>

                {/* Custom Design per device checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFinishForm.is_custom_per_device}
                    onChange={(e) => setNewFinishForm((prev) => ({ ...prev, is_custom_per_device: e.target.checked }))}
                    className="w-4 h-4 rounded text-amber-400 accent-amber-500 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Custom Design per Device (e.g. Everything Skins)</span>
                    <span className="text-[11px] text-zinc-400 leading-relaxed block mt-0.5">
                      Only displays on devices where custom artwork for this finish is uploaded in the device's Skins tab.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddNewFinishModal(false)}
                  className="px-4 py-2 text-xs font-sans rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewFinish}
                  disabled={isCreatingFinish || !newFinishForm.name.trim()}
                  className="px-4 py-2 text-xs font-sans font-semibold rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isCreatingFinish ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isCreatingFinish ? 'Creating...' : 'Create Finish'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Finish Confirmation Modal */}
      {deletingFinishId &&
        createPortal(
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-rose-500/20 p-5 shadow-2xl space-y-3.5 text-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Finish?</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Are you sure you want to remove this finish from global inventory? It will no longer be available in configurators.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingFinishId(null)}
                  className="px-3.5 py-1.5 text-xs font-sans rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFinish(deletingFinishId)}
                  className="px-4 py-1.5 text-xs font-sans font-semibold rounded-xl bg-rose-500 hover:bg-rose-400 text-white cursor-pointer transition-colors shadow-sm"
                >
                  Delete
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
                    <h3 className="text-sm font-heading font-normal tracking-wider uppercase text-white">Duplicate Product & Configurator</h3>
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
                    <h2 className="text-sm md:text-base font-heading font-normal tracking-wide text-white truncate max-w-xs md:max-w-md">
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
                  onClick={() => {
                    setTargetCopyProductId(null);
                    setSourceCopyProductId(null);
                    setTransferTab('copy_to');
                    setTransferCopiedStatus(false);
                    setShowTransferModal(true);
                  }}
                  disabled={!editingProfile}
                  className="px-3.5 py-2 text-xs font-sans font-semibold rounded-xl border border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Copy setup to/from another existing device or import/export JSON"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Transfer Setup / JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleRevalidateStorefront({
                      slug: editingProfile?.device_slug,
                      category: editingProfile?.category,
                    })
                  }
                  disabled={isRevalidatingWeb || !editingProfile}
                  className="px-3.5 py-2 text-xs font-sans font-semibold rounded-xl border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300 hover:text-indigo-200 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Purge Next.js cache and Cloudflare edge cache for this product on web.exacoat.com"
                >
                  <Globe className={clsx('w-3.5 h-3.5 text-indigo-400', isRevalidatingWeb && 'animate-spin')} />
                  <span>{isRevalidatingWeb ? 'Revalidating...' : 'Revalidate Web'}</span>
                </button>

                {editingProfile?.configurator_version !== 'v2' ? (
                  <button
                    type="button"
                    onClick={handleConvertToV2}
                    className="px-5 py-2 text-xs font-sans font-bold uppercase tracking-wider rounded-xl bg-gradient-to-b from-amber-400 to-[#f3aa18] hover:brightness-105 active:scale-[0.985] text-black transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                    title="Upgrade this legacy device to the v2 modern engine to customize layers, masks, and shading"
                  >
                    <Wand2 className="w-4 h-4 text-black" />
                    <span>Convert to v2 Modern Engine</span>
                  </button>
                ) : (
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
                )}
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

                const handleSelectSkinPart = (partId: string) => {
                  setSelectedLayerId(partId);
                  setActiveSimTestingPartId(partId);
                  setSelectedSimLayers((prev) => ({ ...prev, [partId]: true }));

                  // Multi-angle device UX: if this layer has textures/mask on another view, auto-switch to that view
                  const targetLayer = skinLayers.find((l) => l.id === partId);
                  if (targetLayer && editingProfile.views && editingProfile.views.length > 1) {
                    const curAssets = targetLayer.assets_by_view?.[currentView?.id || ''];
                    const curCount = Object.keys(curAssets?.render_texture_map || {}).length;
                    const curHasMask = Boolean(curAssets?.mask_svg_url);
                    if (curCount === 0 && !curHasMask) {
                      const matchingView = editingProfile.views.find((v) => {
                        const a = targetLayer.assets_by_view?.[v.id];
                        return Boolean(a?.mask_svg_url) || Object.keys(a?.render_texture_map || {}).length > 0;
                      });
                      if (matchingView) {
                        setActiveSimView(matchingView.id);
                      }
                    }
                  }
                };

                // Smart asset resolution for Tab 1 texture map inspector
                const currentLayerAssets = (() => {
                  if (!currentActiveLayer) return {};
                  const byView = currentActiveLayer.assets_by_view || {};
                  const activeViewAsset = byView[currentView?.id || 'main_view'];
                  if (activeViewAsset && (activeViewAsset.mask_svg_url || Object.keys(activeViewAsset.render_texture_map || {}).length > 0)) {
                    return activeViewAsset;
                  }
                  const mainAsset = byView['main_view'];
                  if (mainAsset && (mainAsset.mask_svg_url || Object.keys(mainAsset.render_texture_map || {}).length > 0)) {
                    return mainAsset;
                  }
                  const anyWithTex = Object.values(byView).find(
                    (a) => Boolean(a.mask_svg_url) || Object.keys(a.render_texture_map || {}).length > 0
                  );
                  return anyWithTex || activeViewAsset || {};
                })();

                const textureMap = currentLayerAssets.render_texture_map || {};

                const activeTestPartId = activeSimTestingPartId || skinLayers[0]?.id || '';
                const activeTestLayer = skinLayers.find((l) => l.id === activeTestPartId) || skinLayers[0];

                const isFinishAllowedOnTestPart = (f: GlobalFinish) => {
                  const fSlug = f.slug || f.id;
                  if (activeTestLayer?.allowed_finish_slugs && activeTestLayer.allowed_finish_slugs.length > 0) {
                    const norm = fSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const allowed = activeTestLayer.allowed_finish_slugs.some(
                      (as) => as.toLowerCase().replace(/[^a-z0-9]/g, '') === norm
                    );
                    if (!allowed) return false;
                  }
                  // If custom design per device (e.g. Everything Skins), only show if this layer has uploaded texture
                  if (f.is_custom_per_device) {
                    const viewAssets =
                      activeTestLayer?.assets_by_view?.[activeSimView] ||
                      activeTestLayer?.assets_by_view?.['main_view'] ||
                      Object.values(activeTestLayer?.assets_by_view || {})[0];
                    const hasCustom = Boolean(
                      viewAssets?.render_texture_map?.[fSlug] ||
                        (activeTestLayer as any)?.render_texture_map?.[fSlug]
                    );
                    if (!hasCustom) return false;
                  }
                  return true;
                };

                const testPartFinishes = finishes.filter((f) => isFinishAllowedOnTestPart(f));
                const testPartGroups = Array.from(
                  new Set(testPartFinishes.map((f) => f.group).filter(Boolean) as string[])
                ).sort((a, b) => {
                  const idxA = storedFinishGroups.indexOf(a);
                  const idxB = storedFinishGroups.indexOf(b);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.localeCompare(b);
                });
                const displayTestFinishes = testPartFinishes.filter((f) => {
                  if (simFinishGroupFilter === 'all') return true;
                  return f.group === simFinishGroupFilter;
                });

                return (
                  <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-zinc-950">
                    {/* LEFT / CENTER PANE: Spacious Interactive Device Canvas */}
                    <div className="flex-1 flex flex-col min-h-0 relative border-b lg:border-b-0 border-white/10 bg-radial from-zinc-900/40 via-zinc-950 to-zinc-950 overflow-hidden">
                      {/* Legacy v1 Read-Only Notice Banner */}
                      {editingProfile.configurator_version !== 'v2' && (
                        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-20 shrink-0">
                          <div className="flex items-center gap-2.5 text-amber-300">
                            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                            <div>
                              <span className="font-bold">Legacy v1 Configurator (Read-Only Mode)</span>
                              <span className="text-zinc-400 ml-2">
                                Locked to protect live WooCommerce MKL settings. Convert to v2 to customize alpha masks, layer textures, and optional 3D shadows.
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleConvertToV2}
                            className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs cursor-pointer transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Convert to v2 Modern Engine</span>
                          </button>
                        </div>
                      )}

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
                      </div>

                      {/* Device Stage Viewport */}
                      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
                        {/* Floating Viewport Hardware Color Selector (Shown only when 2+ colors exist) */}
                        {editingProfile.device_colors && editingProfile.device_colors.length > 1 && (
                          <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-zinc-950/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 shadow-xl select-none">
                            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Device:</span>
                              <span className="font-semibold text-zinc-200">
                                {editingProfile.device_colors.find((c) => c.id === selectedSimColor)?.name ||
                                  editingProfile.device_colors[0]?.name}
                              </span>
                            </span>
                            <div className="h-3.5 w-px bg-white/10 mx-0.5" />
                            <div className="flex items-center gap-1.5">
                              {editingProfile.device_colors.map((c) => {
                                const isSelected = (selectedSimColor || editingProfile.device_colors?.[0]?.id) === c.id;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedSimColor(c.id)}
                                    title={c.name}
                                    className={clsx(
                                      'w-5 h-5 rounded-full border transition-all cursor-pointer relative group flex items-center justify-center',
                                      isSelected
                                        ? 'border-white ring-2 ring-[#f3aa18] scale-110 shadow-md'
                                        : 'border-white/20 hover:border-white/60 hover:scale-105'
                                    )}
                                    style={{ backgroundColor: c.hex }}
                                  >
                                    {isSelected && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                                    )}
                                    <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 border border-white/10 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap z-40">
                                      {c.name}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Device Canvas Box */}
                        <div className="relative w-full max-w-[560px] lg:max-w-[620px] xl:max-w-[680px] aspect-square flex items-center justify-center drop-shadow-2xl transition-all">
                          {/* Layer 1: Hardware Chassis Base Image */}
                          {currentView?.background_url ? (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none z-0">
                              {(() => {
                                const activeColor = editingProfile.device_colors?.find((c) => c.id === selectedSimColor);
                                const chassisSrc =
                                  (activeColor as any)?.body_images_by_view?.[currentView.id] ||
                                  activeColor?.body_image_url ||
                                  currentView.background_url;
                                const hasDedicatedImage = Boolean(
                                  (activeColor as any)?.body_images_by_view?.[currentView.id] || activeColor?.body_image_url
                                );

                                return (
                                  <>
                                    <img
                                      src={chassisSrc}
                                      alt="Hardware Chassis"
                                      className="w-full h-full object-contain pointer-events-none"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                    {editingProfile.configurator_version === 'v2' && activeColor && !hasDedicatedImage && (
                                      <div
                                        style={{
                                          backgroundColor: activeColor.hex || '#535559',
                                          mixBlendMode: 'color',
                                        }}
                                        className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
                                      />
                                    )}
                                  </>
                                );
                              })()}
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

                          {/* Layer 2: Customizable Skin Texture Overlays (Sorted by z_index ascending: base layers first, accents on top) */}
                          {[...skinLayers]
                            .sort((a, b) => (a.z_index || 1) - (b.z_index || 1))
                            .map((l) => {
                              const isChecked = selectedSimLayers[l.id] ?? true;
                              if (!isChecked) return null;

                            // Resolve effective assets for this layer and current view
                            const viewSpecificAsset = l.assets_by_view?.[currentView?.id || 'main_view'];
                            const hasViewSpecificTex = Boolean(
                              viewSpecificAsset?.mask_svg_url ||
                              (viewSpecificAsset?.render_texture_map && Object.keys(viewSpecificAsset.render_texture_map).length > 0)
                            );

                            // For multi-angle devices where this layer is strictly assigned to other views, do not render on wrong angle
                            const hasOtherAngleAssignments = Boolean(
                              editingProfile.views &&
                              editingProfile.views.length > 1 &&
                              Object.entries(l.assets_by_view || {}).some(
                                ([vId, vAsset]) =>
                                  vId !== currentView?.id &&
                                  (vAsset.mask_svg_url || Object.keys(vAsset.render_texture_map || {}).length > 0)
                              )
                            );

                            let assets = viewSpecificAsset || {};
                            if (!hasViewSpecificTex) {
                              if (hasOtherAngleAssignments) {
                                // Layer belongs to another angle on this multi-view device (e.g. Bottom on top_view)
                                return null;
                              }
                              // Single angle device or general fallback: check main_view or any angle with textures
                              assets =
                                l.assets_by_view?.['main_view'] ||
                                Object.values(l.assets_by_view || {}).find(
                                  (a) => Boolean(a.mask_svg_url) || Object.keys(a.render_texture_map || {}).length > 0
                                ) ||
                                viewSpecificAsset ||
                                {};
                            }

                            const layerFinishSlug = selectedLayerFinishes[l.id] || selectedSimFinish;
                            const activeFinish = finishes.find(
                              (f) => (f.slug || f.id) === layerFinishSlug || f.id === layerFinishSlug
                            );

                            // v2 Engine: Dynamic Canvas Compositing with Alpha Mask & Buyer Cutouts
                            if (editingProfile.configurator_version === 'v2') {
                              const isCustomPerDevice = Boolean(activeFinish?.is_custom_per_device);
                              const textureMap = assets.render_texture_map || {};
                              const simNorm = layerFinishSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                              const matchedKey = Object.keys(textureMap).find(
                                (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === simNorm
                              );
                              const mappedTex = matchedKey ? textureMap[matchedKey] || '' : '';
                              const customTex =
                                assets.render_texture_map?.[layerFinishSlug] ||
                                assets.render_texture_map?.[activeFinish?.slug || ''] ||
                                assets.render_texture_map?.[activeFinish?.id || ''] ||
                                mappedTex;

                              const isCustomDeviceFinish = isCustomPerDevice || Boolean(customTex);

                              const isBigDevice = editingProfile.family === 'laptop' || editingProfile.family === 'tablet' || (editingProfile.family as string) === 'tablet_laptop' || editingProfile.family === 'keyboard';
                              const useBigTexture = l.texture_size === 'big' || (l.texture_size !== 'small' && isBigDevice);
                              const activeTextureUrl = (useBigTexture && activeFinish?.texture_big_url)
                                ? activeFinish.texture_big_url
                                : activeFinish?.texture_url || '';

                              const textureToTile = customTex || activeTextureUrl;
                              const fallbackColor = activeFinish?.color_hex || '#18181b';

                              // Do not render non-visual kit layers or layers without an alpha mask for this view
                              if (l.is_non_visual || !assets.mask_svg_url) {
                                return null;
                              }

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

                              const hasViewShadow = Boolean(
                                currentView?.shadow_png_url ||
                                currentView?.shading_image_url ||
                                currentView?.highlight_png_url
                              );

                              // Custom device finishes (uploaded per device template) are locked to 100% scale (1.0).
                              // Repeating pattern materials follow the angle texture zoom/scale (e.g. 75%).
                              const effectiveTextureScale = isCustomDeviceFinish
                                ? 1.0
                                : (currentView?.texture_scale ?? editingProfile.texture_scale ?? l.texture_scale ?? 1.0);

                              return (
                                <V2SkinCanvasLayer
                                  key={`v2-layer-${l.id}-${currentView?.id || 'main'}`}
                                  maskUrl={assets.mask_svg_url}
                                  textureUrl={textureToTile}
                                  fallbackColor={fallbackColor}
                                  logoCutoutUrl={effectiveLogoCutout}
                                  pencilCutoutUrl={effectivePencilCutout}
                                  modelCutoutUrl={effectiveModelCutout}
                                  zIndex={(l.z_index || 1) + 5}
                                  layerName={l.name}
                                  layerGroup={l.group}
                                  isRequired={l.is_required}
                                  textureRotation={l.texture_rotation ?? 0}
                                  textureScale={effectiveTextureScale}
                                  hasViewShadow={hasViewShadow}
                                  generatedShadowConfig={currentView?.generated_shadow}
                                />
                              );
                            }

                            const textureMap = assets.render_texture_map || {};
                            const simNorm = layerFinishSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                            const matchedKey = Object.keys(textureMap).find(
                              (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === simNorm
                            );
                            let texUrl = matchedKey ? textureMap[matchedKey] || '' : '';

                            // v1 Fallback: if selected finish is not mapped on this layer, fall back to global simulation finish or first available texture
                            if (!texUrl && Object.keys(textureMap).length > 0) {
                              const globalNorm = selectedSimFinish.toLowerCase().replace(/[^a-z0-9]/g, '');
                              const globalMatchedKey = Object.keys(textureMap).find(
                                (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === globalNorm
                              );
                              if (globalMatchedKey) {
                                texUrl = textureMap[globalMatchedKey] || '';
                              } else {
                                const firstKey = Object.keys(textureMap)[0];
                                texUrl = textureMap[firstKey] || '';
                              }
                            }

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

                          {/* v1 Logo Cutout Overlay (Rendered above vinyl skin at zIndex 35 when logo is active) */}
                          {editingProfile.configurator_version !== 'v2' && selectedLogoCutout && (() => {
                            const logoUrl =
                              currentView?.logo_image_url ||
                              currentView?.logo_cutout_mask_url ||
                              editingProfile.coverage_and_cutouts?.logo_cutout_mask_url ||
                              (() => {
                                const logoVar = editingProfile.variants?.find((v) =>
                                  v.id.toLowerCase().includes('logo') || v.name.toLowerCase().includes('logo')
                                );
                                const withOpt =
                                  logoVar?.options?.find(
                                    (o) => o.image_url && (!o.id.toLowerCase().includes('without') && !o.name.toLowerCase().includes('without'))
                                  ) || logoVar?.options?.find((o) => o.image_url);
                                return withOpt?.image_url;
                              })();

                            if (!logoUrl) return null;

                            return (
                              <img
                                src={logoUrl}
                                alt="Logo Cutout"
                                style={{ zIndex: 35 }}
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            );
                          })()}

                          {/* Layer 3: Realistic 3D Shading & Specular Highlights (Single Source) */}
                          {editingProfile.configurator_version === 'v2' && currentView && (() => {
                            const shadingSrc =
                              currentView.shadow_png_url ||
                              currentView.shading_image_url ||
                              currentView.highlight_png_url;

                            if (!shadingSrc) return null;

                            const simFinish = finishes.find(
                              (f) => (f.slug || f.id) === selectedSimFinish || f.id === selectedSimFinish
                            );
                            const finishShadowOpacity = typeof simFinish?.shadow_opacity === 'number' ? simFinish.shadow_opacity : undefined;
                            const finishHighlightOpacity = typeof simFinish?.highlight_opacity === 'number' ? simFinish.highlight_opacity : undefined;

                            const shadowOpacity = finishShadowOpacity !== undefined ? finishShadowOpacity : (currentView.shadow_opacity ?? 0.85);
                            const highlightOpacity = finishHighlightOpacity !== undefined ? finishHighlightOpacity : (currentView.highlight_opacity ?? 0.35);

                            return (
                              <React.Fragment key={`view-shading-${currentView.id}`}>
                                {shadowOpacity > 0 && (
                                  <img
                                    src={shadingSrc}
                                    alt={`${currentView.name} 3D Shadow`}
                                    style={{
                                      zIndex: 20,
                                      mixBlendMode: 'multiply',
                                      opacity: shadowOpacity,
                                    }}
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                {highlightOpacity > 0 && (
                                  <img
                                    src={shadingSrc}
                                    alt={`${currentView.name} 3D Highlight`}
                                    style={{
                                      zIndex: 25,
                                      mixBlendMode: 'screen',
                                      opacity: highlightOpacity,
                                    }}
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                )}
                              </React.Fragment>
                            );
                          })()}
                        </div>
                      </div>

                      {/* INTERACTIVE CONFIGURATOR TESTER DOCK */}
                      <div className="border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl p-4 space-y-3 z-10 shrink-0">
                        {/* Row 1: Active Part Tabs & Real-Time Price */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pr-1">
                              <Layers className="w-3.5 h-3.5 text-[#f3aa18]" />
                              Part:
                            </span>
                            {skinLayers.map((l) => {
                              const partFinishSlug = selectedLayerFinishes[l.id] || selectedSimFinish;
                              const partFinish = finishes.find((f) => (f.slug || f.id) === partFinishSlug || f.id === partFinishSlug);
                              const isTesting = activeTestPartId === l.id;
                              const isChecked = selectedSimLayers[l.id] ?? true;
                              return (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelectSkinPart(l.id);
                                  }}
                                  className={clsx(
                                    'px-3 py-1.5 rounded-xl text-xs font-sans font-medium flex items-center gap-2 transition-all cursor-pointer border shrink-0',
                                    isTesting
                                      ? 'bg-white/15 border-white/30 text-white shadow-md ring-1 ring-[#f3aa18]/40'
                                      : isChecked
                                      ? 'bg-zinc-900/80 border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                                      : 'bg-zinc-950/60 border-white/5 text-zinc-500 hover:text-zinc-300'
                                  )}
                                >
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSimLayers((prev) => ({ ...prev, [l.id]: !isChecked }));
                                    }}
                                    className={clsx(
                                      'p-0.5 rounded transition-colors',
                                      isChecked ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-600 hover:text-zinc-400'
                                    )}
                                    title={isChecked ? 'Layer is active on canvas' : 'Layer is hidden'}
                                  >
                                    {isChecked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                  </span>
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

                          {/* Real-Time Test Simulation Price Badge */}
                          <div className="flex items-center gap-2 shrink-0 bg-zinc-900/90 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-mono">
                            <span className="text-zinc-400">Total Price:</span>
                            <span className="font-bold text-[#f3aa18] text-sm">
                              IDR {simulatedTotalPrice.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Selected Part Finish Swatches Carousel */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 overflow-x-auto">
                            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
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
                              const isPrimary =
                                activeTestLayer?.group === 'primary' ||
                                activeTestLayer?.id === 'back' ||
                                activeTestLayer?.id === 'back-skin' ||
                                /\b(back|top lid|body|base|full)\b/i.test(activeTestLayer?.name || '');

                              const effectiveLayerExtra = isPrimary ? 0 : (Number(activeTestLayer?.extra_price) || 0);

                              const isCustomDeviceFinish = Boolean(
                                finish.is_custom_per_device ||
                                (activeTestLayer?.assets_by_view &&
                                  Object.values(activeTestLayer.assets_by_view).some(
                                    (a) => a.render_texture_map && a.render_texture_map[finish.slug || finish.id]
                                  ))
                              );

                              let extra = 0;
                              const baseFinishExtra = Number(finish.extra_price) || 0;

                              if (baseFinishExtra > 0) {
                                if (isCustomDeviceFinish) {
                                  extra = Math.round(baseFinishExtra * (isPrimary ? (editingProfile.size_multiplier || 1.0) : 1.0));
                                } else if (isPrimary) {
                                  extra = Math.round(baseFinishExtra * (editingProfile.size_multiplier || 1.0));
                                } else if (finish.accent_extra_price && finish.accent_extra_price > 0) {
                                  extra = finish.accent_extra_price;
                                } else {
                                  const matchedTier = surchargeTiers.find((t) => effectiveLayerExtra >= t.min_price && effectiveLayerExtra <= t.max_price);
                                  if (matchedTier) {
                                    extra = matchedTier.surcharge;
                                  } else {
                                    extra = Math.min(baseFinishExtra, 15000);
                                  }
                                }
                              }

                              return (
                                <button
                                  key={finish.id}
                                  type="button"
                                  title={`${finish.name}${extra > 0 ? ` (+IDR ${extra.toLocaleString('id-ID')})` : ''}`}
                                  onClick={() => {
                                    setSelectedLayerFinishes((prev) => ({ ...prev, [activeTestPartId]: fSlug }));
                                    setSelectedSimFinish(fSlug);
                                    setSelectedSimLayers((prev) => ({ ...prev, [activeTestPartId]: true }));
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
                          {(editingProfile.coverage_and_cutouts?.has_logo_cutout !== false || Boolean(currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url)) && (
                            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-white/10">
                              <span className="text-[11px] text-zinc-400 font-medium px-2">Logo:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLogoCutout(true);
                                  const logoVar = editingProfile.variants?.find((v) => v.id.toLowerCase().includes('logo') || v.name.toLowerCase().includes('logo'));
                                  if (logoVar) {
                                    const withOpt = logoVar.options.find((o) => !o.id.toLowerCase().includes('without') && !o.name.toLowerCase().includes('without'));
                                    if (withOpt) {
                                      setSelectedSimVariants((prev) => ({ ...prev, [logoVar.id]: withOpt.id }));
                                    }
                                  }
                                }}
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
                                onClick={() => {
                                  setSelectedLogoCutout(false);
                                  const logoVar = editingProfile.variants?.find((v) => v.id.toLowerCase().includes('logo') || v.name.toLowerCase().includes('logo'));
                                  if (logoVar) {
                                    const withoutOpt = logoVar.options.find((o) => o.id.toLowerCase().includes('without') || o.name.toLowerCase().includes('without'));
                                    if (withoutOpt) {
                                      setSelectedSimVariants((prev) => ({ ...prev, [logoVar.id]: withoutOpt.id }));
                                    }
                                  }
                                }}
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

                          {/* Pencil Cutout Toggle (Tablets: iPad, Galaxy Tab, etc.) */}
                          {Boolean(editingProfile.coverage_and_cutouts?.has_pencil_cutout || currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url) && (
                            <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-white/10">
                              <span className="text-[11px] text-zinc-400 font-medium px-2">{editingProfile.coverage_and_cutouts?.pencil_cutout_label || 'Stylus Cutout'}:</span>
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
                            const hasModelCutMask = Boolean(currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url);
                            const covType = editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : (hasModelCutMask ? 'model_cut_and_360' : 'none'));
                            if (covType === 'none') return null;

                            if (covType === 'model_cut_only') {
                              return (
                                <div className="flex items-center gap-1.5 bg-zinc-900/80 px-2.5 py-1 rounded-xl border border-white/10 text-xs">
                                  <span className="text-[11px] text-zinc-400 font-medium">Coverage:</span>
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[11px]">
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
                                    Model 360° Full Wrap
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
                                      ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
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
                                      ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                                      : 'text-zinc-400 hover:text-white'
                                  )}
                                >
                                  <span>Model 360°</span>
                                  {extra360 > 0 && (
                                    <span
                                      className={clsx(
                                        'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                                        selectedCoverage === 'model_360'
                                          ? 'bg-black/20 text-black font-bold'
                                          : 'bg-amber-500/20 text-amber-300 font-semibold'
                                      )}
                                    >
                                      +{extra360 >= 1000 ? `${Math.round(extra360 / 1000)}k` : extra360}
                                    </span>
                                  )}
                                </button>
                              </div>
                            );
                          })()}

                          {/* Production Device Variants (e.g. Wi-Fi vs Cellular) */}
                          {editingProfile.variants && editingProfile.variants.length > 0 &&
                            editingProfile.variants
                              .filter((v) => {
                                const vId = (v.id || '').toLowerCase();
                                const vName = (v.name || '').toLowerCase();
                                return !vId.includes('logo') && !vName.includes('logo') && !vId.includes('cutout') && !vId.includes('coverage') && !vName.includes('coverage');
                              })
                              .map((v) => {
                                const activeOptId = selectedSimVariants[v.id] || v.options[0]?.id;
                                return (
                                  <div key={v.id} className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-white/10">
                                    <span className="text-[11px] text-zinc-400 font-medium px-2">{v.name}:</span>
                                    {v.options.map((opt) => {
                                      const isSelected = activeOptId === opt.id;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedSimVariants((prev) => ({ ...prev, [v.id]: opt.id }));
                                            const isLogoVar = v.id.toLowerCase().includes('logo') || v.name.toLowerCase().includes('logo');
                                            if (isLogoVar) {
                                              const isWith = !opt.id.toLowerCase().includes('without') && !opt.name.toLowerCase().includes('without');
                                              setSelectedLogoCutout(isWith);
                                            }
                                          }}
                                          className={clsx(
                                            'px-2.5 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5',
                                            isSelected
                                              ? 'bg-[#f3aa18] text-black font-bold shadow-sm'
                                              : 'text-zinc-400 hover:text-white'
                                          )}
                                        >
                                          <span>{opt.name}</span>
                                          {opt.price_diff && opt.price_diff > 0 ? (
                                            <span
                                              className={clsx(
                                                'text-[10px] font-mono px-1 rounded',
                                                isSelected ? 'bg-black/20 text-black font-bold' : 'bg-white/10 text-zinc-300'
                                              )}
                                            >
                                              +{opt.price_diff >= 1000 ? `${Math.round(opt.price_diff / 1000)}k` : opt.price_diff}
                                            </span>
                                          ) : null}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })}
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
                      <div className="h-14 px-4 sm:px-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-zinc-950">
                        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1">
                          <button
                            type="button"
                            onClick={() => setInspectorTab('device')}
                            className={clsx(
                              'px-3 py-1.5 rounded-xl text-xs font-heading font-normal uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0',
                              inspectorTab === 'device'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                            <span>Device</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectorTab('skins')}
                            className={clsx(
                              'px-3 py-1.5 rounded-xl text-xs font-heading font-normal uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0',
                              inspectorTab === 'skins'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Layers className="w-3.5 h-3.5 text-[#f3aa18]" />
                            <span>Skins</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300">
                              {skinLayers.length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectorTab('cutouts')}
                            className={clsx(
                              'px-3 py-1.5 rounded-xl text-xs font-heading font-normal uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0',
                              inspectorTab === 'cutouts'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Sliders className="w-3.5 h-3.5 text-amber-400" />
                            <span>Cutouts</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectorTab('presets')}
                            className={clsx(
                              'px-3 py-1.5 rounded-xl text-xs font-heading font-normal uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0',
                              inspectorTab === 'presets'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Compass className="w-3.5 h-3.5 text-purple-400" />
                            <span>Presets</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300">
                              {(editingProfile.presets || []).length}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectorTab('pricing')}
                            className={clsx(
                              'px-3 py-1.5 rounded-xl text-xs font-heading font-normal uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shrink-0',
                              inspectorTab === 'pricing'
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Pricing</span>
                          </button>
                        </div>
                      </div>

                      {/* Inspector Body Content */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* TAB 2: SKIN PARTS & TEXTURES */}
                        {inspectorTab === 'skins' && (
                          <div className="space-y-6">
                            {/* Skin Parts Header & Hierarchy Controls */}
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-[#f3aa18]" />
                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                                      Customizable Skin Parts ({skinLayers.length})
                                    </h3>
                                    <InfoTooltip content="Ordered Front to Back. Parts on top render above lower parts in viewport and canvas." />
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Add Preset Part Dropdown */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                                      className="px-2.5 py-1.5 text-xs font-sans rounded-xl bg-zinc-900 border border-dashed border-[#f3aa18]/40 hover:border-[#f3aa18] text-[#f3aa18] font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-xs hover:bg-[#f3aa18]/10"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add Part</span>
                                      <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', isPresetDropdownOpen && 'rotate-180')} />
                                    </button>
                                    {isPresetDropdownOpen && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-40"
                                          onClick={() => setIsPresetDropdownOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-1.5 w-64 max-h-80 overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl z-50 p-1.5 space-y-1">
                                          <div className="px-2.5 py-1.5 text-[10px] uppercase font-bold text-zinc-400 tracking-wider border-b border-white/5 flex items-center justify-between">
                                            <span>Standard Skin Parts</span>
                                            <Layers className="w-3 h-3 text-[#f3aa18]" />
                                          </div>
                                          {COMMON_PRESET_LAYERS.map((preset) => {
                                            const isPrimaryAndAdded = preset.group === 'primary' && skinLayers.some((l) => l.name.toLowerCase() === preset.name.toLowerCase());
                                            return (
                                              <button
                                                key={preset.name}
                                                type="button"
                                                disabled={isPrimaryAndAdded}
                                                onClick={() => {
                                                  handleAddPresetLayer(preset);
                                                  setIsPresetDropdownOpen(false);
                                                }}
                                                className={clsx(
                                                  'w-full text-left px-2.5 py-2 rounded-xl text-xs font-sans flex items-center justify-between transition-colors',
                                                  isPrimaryAndAdded
                                                    ? 'opacity-40 cursor-not-allowed bg-zinc-900/20 text-zinc-500'
                                                    : 'hover:bg-white/10 text-zinc-200 hover:text-white cursor-pointer group'
                                                )}
                                              >
                                                <div className="flex items-center gap-2">
                                                  <div className={clsx(
                                                    'w-2 h-2 rounded-full',
                                                    preset.group === 'primary' ? 'bg-[#f3aa18]' : 'bg-sky-400'
                                                  )} />
                                                  <span className="font-medium group-hover:text-[#f3aa18] transition-colors">{preset.name}</span>
                                                </div>
                                                {preset.extra_price > 0 ? (
                                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/20">
                                                    +IDR {preset.extra_price.toLocaleString('id-ID')}
                                                  </span>
                                                ) : (
                                                  <span className="text-[10px] font-mono text-zinc-400">Included</span>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  {/* Add Custom Part Input / Button */}
                                  {!customPartInputOpen ? (
                                    <button
                                      type="button"
                                      onClick={() => setCustomPartInputOpen(true)}
                                      className="px-2.5 py-1.5 text-xs font-sans rounded-xl bg-zinc-900 border border-white/10 hover:border-white/25 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                                    >
                                      + Custom
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-[#f3aa18]/40">
                                      <input
                                        type="text"
                                        placeholder="Part name..."
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
                                        className="px-2 py-1 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18] w-28"
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
                                        className="px-2 py-1 text-xs rounded-lg bg-[#f3aa18] text-black font-bold hover:bg-[#ffb72b] disabled:opacity-50 cursor-pointer transition-colors"
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

                              {/* Vertical Layer Stack (Front to Back) */}
                              <div className="space-y-1.5">
                                {(() => {
                                  const displayLayers = [...skinLayers].sort((a, b) => (b.z_index || 1) - (a.z_index || 1));
                                  if (displayLayers.length === 0) {
                                    return (
                                      <div className="p-6 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-white/10 space-y-2">
                                        <Layers className="w-8 h-8 text-zinc-600 mx-auto" />
                                        <p className="text-xs text-zinc-400">No skin parts defined for this device yet.</p>
                                        <p className="text-[11px] text-zinc-500">Click Add Part above to start.</p>
                                      </div>
                                    );
                                  }

                                  return displayLayers.map((layer, idx) => {
                                    const isFirst = idx === 0;
                                    const isLast = idx === displayLayers.length - 1;
                                    const isSelected = (currentActiveLayer?.id || '') === layer.id;
                                    const isVisible = selectedSimLayers[layer.id] !== false;
                                    const extraPrice = Number(layer.extra_price) || 0;

                                    return (
                                      <div
                                        key={layer.id}
                                        onClick={() => handleSelectSkinPart(layer.id)}
                                        className={clsx(
                                          'p-2.5 rounded-xl transition-all border flex items-center justify-between gap-2.5 cursor-pointer select-none group',
                                          isSelected
                                            ? 'bg-[#f3aa18]/10 border-[#f3aa18]/60 shadow-xs shadow-[#f3aa18]/10'
                                            : 'bg-zinc-900/80 border-white/5 hover:border-white/15 hover:bg-zinc-900'
                                        )}
                                      >
                                        {/* Left: Reorder priority controls, visibility & name */}
                                        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                                          {/* Reorder Buttons */}
                                          <div className="flex flex-col -space-y-1" onClick={(e) => e.stopPropagation()}>
                                            <button
                                              type="button"
                                              disabled={isFirst}
                                              onClick={() => handleMoveLayer(layer.id, 'up')}
                                              className={clsx(
                                                'p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer',
                                                isFirst ? 'opacity-20 cursor-not-allowed' : 'text-zinc-400 hover:text-white'
                                              )}
                                              title="Bring Forward (Higher Render Priority)"
                                            >
                                              <ChevronUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isLast}
                                              onClick={() => handleMoveLayer(layer.id, 'down')}
                                              className={clsx(
                                                'p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer',
                                                isLast ? 'opacity-20 cursor-not-allowed' : 'text-zinc-400 hover:text-white'
                                              )}
                                              title="Send Backward (Lower Render Priority)"
                                            >
                                              <ChevronDown className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          {/* Canvas Eye Visibility Toggle */}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedSimLayers((prev) => ({
                                                ...prev,
                                                [layer.id]: !isVisible,
                                              }));
                                            }}
                                            className={clsx(
                                              'p-1.5 rounded-lg transition-colors cursor-pointer',
                                              isVisible
                                                ? 'text-[#f3aa18] hover:bg-[#f3aa18]/10'
                                                : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
                                            )}
                                            title={isVisible ? 'Visible on canvas (Click to hide)' : 'Hidden on canvas (Click to show)'}
                                          >
                                            {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                          </button>

                                          {/* Layer Name */}
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span
                                              className={clsx(
                                                'text-xs font-semibold truncate',
                                                isSelected ? 'text-white font-bold' : 'text-zinc-200 group-hover:text-white'
                                              )}
                                            >
                                              {layer.name}
                                            </span>
                                            {layer.is_non_visual && (
                                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-semibold border border-blue-500/30 shrink-0">
                                                Kit Part
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Right: Price indicator & Delete button */}
                                        <div className="flex items-center gap-2 shrink-0">
                                          {extraPrice > 0 ? (
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/20">
                                              +IDR {extraPrice >= 1000 ? `${Math.round(extraPrice / 1000)}k` : extraPrice}
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-mono text-zinc-500">
                                              Base
                                            </span>
                                          )}

                                          {/* Direct Delete Button */}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRemoveLayer(layer.id);
                                            }}
                                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                            title={`Delete "${layer.name}"`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            {/* Active Part Details Card */}
                            {currentActiveLayer ? (
                              <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <input
                                      type="text"
                                      value={currentActiveLayer.name}
                                      onChange={(e) =>
                                        handleUpdateLayer(currentActiveLayer.id, { name: e.target.value })
                                      }
                                      className="font-bold text-white text-sm bg-transparent border-b border-white/10 focus:border-[#f3aa18] focus:outline-none px-1 py-0.5 flex-1 min-w-0"
                                    />
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400 shrink-0">
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
                                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans cursor-pointer">
                                    <span className="text-zinc-200 font-medium">Required</span>
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
                                  </label>

                                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans cursor-pointer">
                                    <span className="text-zinc-200 font-medium">Pre-selected</span>
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
                                  </label>

                                  {(() => {
                                    const isPrimaryLayer =
                                      currentActiveLayer.group === 'primary' ||
                                      currentActiveLayer.id === 'back' ||
                                      currentActiveLayer.id === 'back-skin' ||
                                      /\b(back|top lid|body|base|full)\b/i.test(currentActiveLayer.name || '');

                                    return (
                                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs font-sans">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-zinc-400 font-medium">Extra Price:</span>
                                          {isPrimaryLayer && (
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                              Included in Base
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-zinc-500 font-mono text-[11px]">IDR</span>
                                          <input
                                            type="number"
                                            step="5000"
                                            disabled={isPrimaryLayer}
                                            value={isPrimaryLayer ? 0 : (currentActiveLayer.extra_price ?? 0)}
                                            onChange={(e) =>
                                              handleUpdateLayer(currentActiveLayer.id, {
                                                extra_price: isPrimaryLayer ? 0 : (Number(e.target.value) || 0),
                                              })
                                            }
                                            className="w-20 px-2 py-0.5 text-xs font-mono text-right rounded bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18] disabled:opacity-50"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Layer Display Mode: 3D Viewport vs Non-Visual Kit Part */}
                                <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Eye className="w-3.5 h-3.5 text-[#f3aa18]" />
                                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                                        Layer Display Mode
                                      </span>
                                      <InfoTooltip content="Choose whether this part renders on the 3D canvas viewport or operates as an unvisualized kit part (e.g. Bottom Base, Trackpad when no 3D angle exists)." />
                                    </div>
                                    <span
                                      className={clsx(
                                        'text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border',
                                        currentActiveLayer.is_non_visual
                                          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                      )}
                                    >
                                      {currentActiveLayer.is_non_visual ? 'Kit Part (No 3D View)' : '3D Viewport Render'}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLayer(currentActiveLayer.id, { is_non_visual: false })}
                                      className={clsx(
                                        'py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 border',
                                        !currentActiveLayer.is_non_visual
                                          ? 'bg-white/15 text-white font-bold border-white/20 shadow-sm'
                                          : 'bg-white/5 text-zinc-400 hover:text-white border-transparent'
                                      )}
                                    >
                                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>3D Canvas</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLayer(currentActiveLayer.id, { is_non_visual: true })}
                                      className={clsx(
                                        'py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 border',
                                        currentActiveLayer.is_non_visual
                                          ? 'bg-blue-500/20 text-blue-300 font-bold border-blue-500/40 shadow-sm'
                                          : 'bg-white/5 text-zinc-400 hover:text-white border-transparent'
                                      )}
                                    >
                                      <Package className="w-3.5 h-3.5 text-blue-400" />
                                      <span>Kit Part (No 3D)</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Non-Visual Layer Notice */}
                                {currentActiveLayer.is_non_visual && (
                                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 space-y-1.5">
                                    <div className="font-semibold text-xs flex items-center gap-1.5 text-blue-300">
                                      <Package className="w-4 h-4" />
                                      <span>Unvisualized Kit Part</span>
                                    </div>
                                    <p className="text-[11px] text-blue-200/80 leading-relaxed">
                                      This part is physically produced and packed for the customer, but does not render on the 3D viewport canvas. Customers select their finish in the storefront accordion, prices are added, and the selection is passed to checkout.
                                    </p>
                                  </div>
                                )}

                                {/* v2 Modern Engine Alpha Mask */}
                                {editingProfile.configurator_version === 'v2' && !currentActiveLayer.is_non_visual && (
                                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-zinc-400" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                                          Skin Part Alpha Mask ({currentView?.name || 'Main View'})
                                        </span>
                                        <InfoTooltip content="1000x1000 transparent PNG or SVG defining physical cut bounds. Global textures are automatically clipped inside." />
                                      </div>
                                      {currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url ? (
                                        <span className="text-emerald-400 text-[10px] font-mono font-semibold">Configured</span>
                                      ) : (
                                        <span className="text-zinc-500 text-[10px] font-mono">Not set</span>
                                      )}
                                    </div>

                                    {/* Media Slot Row: Square Thumbnail Preview & Details */}
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMediaPickerConfig({
                                            isOpen: true,
                                            title: `Select Alpha Mask: ${currentActiveLayer.name} (${currentView?.name || 'Main View'})`,
                                            recommendedDimensions: '1000x1000 Alpha PNG or SVG',
                                            currentUrl: currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url || '',
                                            onSelect: (url) => handleSetLayerOverlayUrl(currentActiveLayer.id, 'mask_svg_url', url),
                                          })
                                        }
                                        className="w-14 h-14 rounded-xl bg-white border border-white/20 hover:border-white/40 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105 shadow-sm"
                                        title="Click to select Alpha Mask from WordPress Media Library"
                                      >
                                        {currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url ? (
                                          <img
                                            src={currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url}
                                            alt="Alpha Mask"
                                            className="w-full h-full object-contain p-1"
                                            onError={(e) => {
                                              (e.target as HTMLElement).style.display = 'none';
                                            }}
                                          />
                                        ) : (
                                          <div className="text-zinc-400 group-hover:text-zinc-600 transition-colors flex flex-col items-center justify-center gap-0.5">
                                            <Plus className="w-4 h-4" />
                                            <span className="text-[9px] font-semibold">Mask</span>
                                          </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                          <Edit3 className="w-3.5 h-3.5 text-white" />
                                        </div>
                                      </button>

                                      <div className="flex-1 min-w-0">
                                        <p
                                          className="text-[11px] font-mono text-zinc-300 truncate"
                                          title={currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url || ''}
                                        >
                                          {currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url
                                            ? currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url?.split('/').pop()
                                            : 'Click square thumbnail to browse media library'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setMediaPickerConfig({
                                                isOpen: true,
                                                title: `Select Alpha Mask: ${currentActiveLayer.name} (${currentView?.name || 'Main View'})`,
                                                recommendedDimensions: '1000x1000 Alpha PNG or SVG',
                                                currentUrl: currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url || '',
                                                onSelect: (url) => handleSetLayerOverlayUrl(currentActiveLayer.id, 'mask_svg_url', url),
                                              })
                                            }
                                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                            title="Browse WordPress Media Library"
                                          >
                                            <FolderOpen className="w-3 h-3 text-[#f3aa18]" />
                                            <span>Browse Media</span>
                                          </button>
                                          {currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view']?.mask_svg_url && (
                                            <button
                                              type="button"
                                              onClick={() => handleSetLayerOverlayUrl(currentActiveLayer.id, 'mask_svg_url', '')}
                                              className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                              title="Clear Alpha Mask"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Per-Part Texture Controls: Rotation & Resolution */}
                                    <div className="pt-3 border-t border-white/5">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {/* Texture Rotation */}
                                        <div className="p-2 rounded-lg bg-zinc-950/60 border border-white/5 space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1">
                                              <RotateCw className="w-3 h-3 text-[#f3aa18]" />
                                              <span>Rotation</span>
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-400">
                                              {currentActiveLayer.texture_rotation ?? 0}°
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {([0, 90, 180, 270] as const).map((deg) => {
                                              const isActive = (currentActiveLayer.texture_rotation ?? 0) === deg;
                                              return (
                                                <button
                                                  key={deg}
                                                  type="button"
                                                  onClick={() => handleUpdateLayer(currentActiveLayer.id, { texture_rotation: deg })}
                                                  className={clsx(
                                                    'flex-1 py-1 rounded text-[11px] font-mono font-medium transition-all cursor-pointer',
                                                    isActive
                                                      ? 'bg-[#f3aa18]/20 text-[#f3aa18] font-bold border border-[#f3aa18]/40'
                                                      : 'bg-white/5 text-zinc-400 hover:text-white'
                                                  )}
                                                >
                                                  {deg}°
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        {/* Master Texture Resolution */}
                                        <div className="p-2 rounded-lg bg-zinc-950/60 border border-white/5 space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1">
                                              <Laptop className="w-3 h-3 text-[#f3aa18]" />
                                              <span>Texture Size</span>
                                            </span>
                                            <span className="text-[10px] font-mono text-zinc-400">
                                              {currentActiveLayer.texture_size === 'big' ? 'Big (Laptop)' : currentActiveLayer.texture_size === 'small' ? 'Standard' : 'Auto'}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {(['auto', 'small', 'big'] as const).map((sz) => {
                                              const currentSz = currentActiveLayer.texture_size || 'auto';
                                              const isActive = currentSz === sz;
                                              return (
                                                <button
                                                  key={sz}
                                                  type="button"
                                                  onClick={() => handleUpdateLayer(currentActiveLayer.id, { texture_size: sz })}
                                                  className={clsx(
                                                    'flex-1 py-1 rounded text-[10px] font-medium transition-all cursor-pointer capitalize',
                                                    isActive
                                                      ? 'bg-[#f3aa18]/20 text-[#f3aa18] font-bold border border-[#f3aa18]/40'
                                                      : 'bg-white/5 text-zinc-400 hover:text-white'
                                                  )}
                                                >
                                                  {sz === 'small' ? 'Standard' : sz}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Finish Availability Restrictions */}
                                <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Filter className="w-3.5 h-3.5 text-[#f3aa18]" />
                                      <span className="text-xs font-bold text-zinc-300">Material Availability</span>
                                      <InfoTooltip content="Restrict which materials are available for this specific part, or allow All materials." />
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

                                {/* Dedicated Section: Custom Device Artworks (e.g. Everything Skins) */}
                                {finishes.filter((f) => f.is_custom_per_device).length > 0 && (
                                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/25 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Palette className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                                          Custom Device Finishes ({finishes.filter((f) => f.is_custom_per_device).length})
                                        </span>
                                        <InfoTooltip content="Finishes with unique artwork per device (like Everything Skins). Upload artwork here to activate on this device." />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      {finishes
                                        .filter((f) => f.is_custom_per_device)
                                        .map((f) => {
                                          const finishSlug = f.slug || f.id;
                                          const normSlug = finishSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
                                          const currentAssets =
                                            currentActiveLayer.assets_by_view?.[currentView?.id || 'main_view'] || {};
                                          const currentMap = currentAssets.render_texture_map || {};
                                          const matchedKey = Object.keys(currentMap).find(
                                            (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normSlug
                                          );
                                          const currentUrl = matchedKey ? currentMap[matchedKey] : '';
                                          const isConfigured = Boolean(currentUrl);
                                          const isCurrentlySimulated =
                                            (selectedLayerFinishes[currentActiveLayer.id] || selectedSimFinish) === finishSlug;

                                          return (
                                            <div
                                              key={`custom-finish-${f.id}`}
                                              className={clsx(
                                                'p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors',
                                                isCurrentlySimulated
                                                  ? 'bg-purple-950/40 border-purple-500/40 ring-1 ring-purple-500/30'
                                                  : 'bg-zinc-900/90 border-white/5'
                                              )}
                                            >
                                              <div
                                                onClick={() => {
                                                  if (isConfigured) {
                                                    setSelectedLayerFinishes((prev) => ({ ...prev, [currentActiveLayer.id]: finishSlug }));
                                                    setSelectedSimFinish(finishSlug);
                                                  }
                                                }}
                                                className={clsx(
                                                  'flex items-center gap-2.5 min-w-0',
                                                  isConfigured && 'cursor-pointer group'
                                                )}
                                                title={isConfigured ? `Click to preview ${f.name} on ${currentActiveLayer.name}` : undefined}
                                              >
                                                <div className={clsx(
                                                  'w-10 h-10 rounded-xl bg-zinc-950 border overflow-hidden shrink-0 flex items-center justify-center transition-colors',
                                                  isCurrentlySimulated ? 'border-purple-400' : 'border-white/10 group-hover:border-white/30'
                                                )}>
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
                                                      className="w-full h-full object-cover opacity-50"
                                                      onError={(e) => {
                                                        (e.target as HTMLElement).style.display = 'none';
                                                      }}
                                                    />
                                                  ) : (
                                                    <ImageIcon className="w-4 h-4 text-purple-400/50" />
                                                  )}
                                                </div>
                                                <div className="min-w-0">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={clsx('text-xs font-bold truncate', isCurrentlySimulated ? 'text-purple-200' : 'text-white group-hover:text-purple-300')}>
                                                      {f.name}
                                                    </span>
                                                    <span
                                                      className={clsx(
                                                        'text-[9px] font-mono px-1.5 py-0.2 rounded-full font-semibold border',
                                                        isConfigured
                                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                          : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                                      )}
                                                    >
                                                      {isConfigured ? 'Active on device' : 'Hidden on device'}
                                                    </span>
                                                    {isConfigured && (
                                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full font-semibold border bg-sky-500/10 text-sky-400 border-sky-500/30">
                                                        100% Scale
                                                      </span>
                                                    )}
                                                  </div>
                                                  <span className="text-[10px] text-zinc-400 font-mono block truncate">
                                                    {f.group} : {finishSlug}
                                                  </span>
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setMediaPickerConfig({
                                                      isOpen: true,
                                                      title: `Select Artwork: ${f.name} (${currentActiveLayer.name})`,
                                                      recommendedDimensions: '1000x1000 High-Res Device Artwork PNG',
                                                      currentUrl: currentUrl,
                                                      onSelect: (url) =>
                                                        handleSetFinishTexture(currentActiveLayer.id, finishSlug, url),
                                                    })
                                                  }
                                                  className={clsx(
                                                    'px-2.5 py-1.5 rounded-xl text-xs font-sans transition-colors cursor-pointer flex items-center gap-1.5 font-medium',
                                                    isConfigured
                                                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10'
                                                      : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-semibold'
                                                  )}
                                                >
                                                  <FolderOpen className="w-3.5 h-3.5 text-[#f3aa18]" />
                                                  <span>{isConfigured ? 'Change' : 'Upload / Set'}</span>
                                                </button>
                                                {isConfigured && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleSetFinishTexture(currentActiveLayer.id, finishSlug, '')
                                                    }
                                                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                                                    title="Remove artwork (hides finish from this device)"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                )}

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
                              <div className="p-8 rounded-2xl bg-zinc-900/40 border border-dashed border-white/10 text-center">
                                <p className="text-xs text-zinc-400">No customizable skin parts added yet.</p>
                                <p className="text-[11px] text-zinc-500 mt-1">
                                  Select a preset above to create your first customizable layer.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* TAB 1: DEVICE HARDWARE CHASSIS (LAYER 1) */}
                        {inspectorTab === 'device' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4 text-sky-400" />
                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                  Device Hardware Chassis (Layer 1)
                                </h4>
                                <InfoTooltip content="The neutral hardware body render of the device (ports, camera bump, chassis). All customizable skin layers are composited on top of this." />
                              </div>
                            </div>

                            {/* Angle Switcher for Hardware Image */}
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Configure Angle
                              </label>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {editingProfile.views.map((v) => (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setActiveSimView(v.id)}
                                    className={clsx(
                                      'px-3 py-1.5 rounded-xl text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5 font-medium',
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
                                <div className="flex items-center gap-3.5">
                                  {currentView.background_url ? (
                                    <div className="w-14 h-14 rounded-xl bg-zinc-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-1">
                                      <img
                                        src={currentView.background_url}
                                        alt={currentView.name}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-14 h-14 rounded-xl bg-zinc-950 border-2 border-dashed border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center text-zinc-600">
                                      <Smartphone className="w-6 h-6" />
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <input
                                      type="text"
                                      value={currentView.name}
                                      onChange={(e) => handleSetViewField(currentView.id, 'name', e.target.value)}
                                      className="font-bold text-white text-sm bg-transparent border-b border-transparent hover:border-white/20 focus:border-[#f3aa18] focus:bg-zinc-950/60 px-1 py-0.5 rounded transition-colors focus:outline-none w-full"
                                      title="Click to rename angle"
                                    />
                                    <p className="text-[11px] font-mono text-zinc-400 mt-0.5 px-1">Angle ID: {currentView.id}</p>
                                  </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-zinc-300">Hardware Chassis Render ({currentView.name})</span>
                                      <InfoTooltip content="1000x1000 transparent PNG render of the base device body for this angle." />
                                    </div>
                                    {currentView.background_url ? (
                                      <span className="text-emerald-400 text-[10px] font-mono font-semibold">Configured</span>
                                    ) : (
                                      <span className="text-zinc-500 text-[10px] font-mono">Not set</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
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
                                      className="w-14 h-14 rounded-xl bg-zinc-950 border border-white/10 hover:border-sky-400/60 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105"
                                      title="Click to select Hardware Chassis Render from Media Library"
                                    >
                                      {currentView.background_url ? (
                                        <img
                                          src={currentView.background_url}
                                          alt="Hardware Chassis"
                                          className="w-full h-full object-contain p-1"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="text-zinc-600 group-hover:text-sky-400 transition-colors flex flex-col items-center justify-center gap-0.5">
                                          <Smartphone className="w-4 h-4" />
                                          <span className="text-[9px] font-semibold">Chassis</span>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                                      </div>
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-mono text-zinc-300 truncate" title={currentView.background_url || ''}>
                                        {currentView.background_url
                                          ? currentView.background_url.split('/').pop()
                                          : 'Click square thumbnail to browse media library'}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1.5">
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
                                          className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <FolderOpen className="w-3 h-3 text-[#f3aa18]" />
                                          <span>Browse Media</span>
                                        </button>
                                        {currentView.background_url && (
                                          <>
                                            <span className="text-zinc-700">|</span>
                                            <button
                                              type="button"
                                              onClick={() => handleSetViewBackground(currentView.id, '')}
                                              className="text-[11px] text-zinc-500 hover:text-rose-400 font-medium cursor-pointer transition-colors"
                                            >
                                              Clear
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Hardware Body Colors for this Angle */}
                                <div className="space-y-3 pt-3 border-t border-white/5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Palette className="w-3.5 h-3.5 text-sky-400" />
                                      <span className="text-xs font-bold text-white">Hardware Body Colors</span>
                                      <InfoTooltip content="Physical chassis colors (e.g. Desert Titanium, Natural Titanium, Black, White). Visual preview only in configurator viewport; strictly excluded from cart and order metadata." />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newColor = {
                                          id: `color_${Date.now()}`,
                                          name: 'New Color',
                                          hex: '#535559',
                                          body_image_url: currentView.background_url || '',
                                          body_images_by_view: {
                                            [currentView.id]: currentView.background_url || '',
                                          },
                                        };
                                        const nextColors = [...(editingProfile.device_colors || []), newColor];
                                        setEditingProfile({
                                          ...editingProfile,
                                          device_colors: nextColors,
                                        });
                                        setSelectedSimColor(newColor.id);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Add Color</span>
                                    </button>
                                  </div>

                                  {/* Colors List for current view */}
                                  {(!editingProfile.device_colors || editingProfile.device_colors.length === 0) ? (
                                    <p className="text-[11px] text-zinc-500 italic py-1">
                                      No color variants. Uses default body image above.
                                    </p>
                                  ) : (
                                    <div className="space-y-2.5">
                                      {editingProfile.device_colors.map((color, idx) => {
                                        const currentAngleImg =
                                          (color as any)?.body_images_by_view?.[currentView.id] ||
                                          (currentView.is_default || currentView.id === 'main_view' ? color.body_image_url : '') ||
                                          '';

                                        return (
                                          <div
                                            key={color.id || idx}
                                            className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 space-y-2.5"
                                          >
                                            <div className="flex items-center gap-2">
                                              {/* Swatch color picker */}
                                              <div
                                                className="relative w-6 h-6 rounded-full border border-white/20 overflow-hidden shrink-0 cursor-pointer shadow-xs"
                                                title="Pick swatch color"
                                              >
                                                <input
                                                  type="color"
                                                  value={color.hex || '#535559'}
                                                  onChange={(e) => {
                                                    const nextColors = [...(editingProfile.device_colors || [])];
                                                    nextColors[idx] = { ...nextColors[idx], hex: e.target.value };
                                                    setEditingProfile({ ...editingProfile, device_colors: nextColors });
                                                  }}
                                                  className="absolute -top-2 -left-2 w-10 h-10 cursor-pointer border-0 p-0"
                                                />
                                              </div>

                                              {/* Color Name */}
                                              <input
                                                type="text"
                                                placeholder="Color name (e.g. Natural Titanium)"
                                                value={color.name}
                                                onChange={(e) => {
                                                  const nextColors = [...(editingProfile.device_colors || [])];
                                                  nextColors[idx] = { ...nextColors[idx], name: e.target.value };
                                                  setEditingProfile({ ...editingProfile, device_colors: nextColors });
                                                }}
                                                className="flex-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-sky-400 placeholder:text-zinc-600"
                                              />

                                              {/* Hex input */}
                                              <input
                                                type="text"
                                                placeholder="#535559"
                                                value={color.hex}
                                                onChange={(e) => {
                                                  const nextColors = [...(editingProfile.device_colors || [])];
                                                  nextColors[idx] = { ...nextColors[idx], hex: e.target.value };
                                                  setEditingProfile({ ...editingProfile, device_colors: nextColors });
                                                }}
                                                className="w-20 px-2 py-1 text-xs font-mono rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 focus:outline-none focus:border-sky-400 text-center"
                                              />

                                              {/* Delete Color */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const nextColors = editingProfile.device_colors?.filter((_, i) => i !== idx) || [];
                                                  setEditingProfile({ ...editingProfile, device_colors: nextColors });
                                                  if (selectedSimColor === color.id) {
                                                    setSelectedSimColor(nextColors[0]?.id || '');
                                                  }
                                                }}
                                                className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                                                title="Delete Color Variant"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>

                                            {/* Chassis image URL for current angle */}
                                            <div className="flex gap-2">
                                              <input
                                                type="url"
                                                placeholder={`Chassis image for ${color.name || 'color'}...`}
                                                value={currentAngleImg}
                                                onChange={(e) => {
                                                  const url = e.target.value.trim();
                                                  const nextColors = [...(editingProfile.device_colors || [])];
                                                  const viewId = currentView.id || 'main_view';
                                                  const updatedByView = { ...((nextColors[idx] as any).body_images_by_view || {}), [viewId]: url };
                                                  nextColors[idx] = {
                                                    ...nextColors[idx],
                                                    body_images_by_view: updatedByView,
                                                    body_image_url: currentView.is_default || viewId === 'main_view' ? url : (nextColors[idx].body_image_url || url),
                                                  };
                                                  setEditingProfile({ ...editingProfile, device_colors: nextColors });
                                                }}
                                                className="w-full px-2.5 py-1 text-[11px] font-mono rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-sky-400 placeholder:text-zinc-600"
                                              />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setMediaPickerConfig({
                                                    isOpen: true,
                                                    title: `Select Chassis Render for ${color.name} (${currentView.name})`,
                                                    recommendedDimensions: '1000x1000 Transparent PNG',
                                                    currentUrl: currentAngleImg,
                                                    onSelect: (url) => {
                                                      const nextColors = [...(editingProfile.device_colors || [])];
                                                      const viewId = currentView.id || 'main_view';
                                                      const updatedByView = { ...((nextColors[idx] as any).body_images_by_view || {}), [viewId]: url };
                                                      nextColors[idx] = {
                                                        ...nextColors[idx],
                                                        body_images_by_view: updatedByView,
                                                        body_image_url: currentView.is_default || viewId === 'main_view' ? url : (nextColors[idx].body_image_url || url),
                                                      };
                                                      setEditingProfile({ ...editingProfile, device_colors: nextColors });
                                                    },
                                                  })
                                                }
                                                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-[11px] font-medium flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                                                title="Browse Media Library"
                                              >
                                                <FolderOpen className="w-3 h-3 text-[#f3aa18]" />
                                                <span>Browse</span>
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* 3D Shading & Specular Highlights for this Angle (v2 Modern Engine Only) */}
                                {editingProfile.configurator_version === 'v2' && (
                                  <div className="space-y-3 pt-3 border-t border-white/5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="text-xs font-bold text-white">Angle 3D Shading & Highlights</span>
                                        <InfoTooltip content="Universal 1000x1000 transparent PNG shading map for this angle (optional). If not set, renders cleanly without shading." />
                                      </div>
                                      {(currentView.shadow_png_url || currentView.shading_image_url) ? (
                                        <span className="text-emerald-400 text-[10px] font-mono font-semibold">Configured</span>
                                      ) : (
                                        <span className="text-zinc-500 text-[10px] font-mono">Not set (clean)</span>
                                      )}
                                    </div>

                                    {/* Single Shading Image Map Card with White Preview Thumbnail */}
                                    <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setMediaPickerConfig({
                                              isOpen: true,
                                              title: `Select 3D Shading Map: ${currentView.name}`,
                                              recommendedDimensions: '1000x1000 Transparent PNG',
                                              currentUrl: currentView.shadow_png_url || currentView.shading_image_url || '',
                                              onSelect: (url) => {
                                                handleSetViewField(currentView.id, 'shadow_png_url', url);
                                                handleSetViewField(currentView.id, 'shading_image_url', url);
                                                if (editingProfile?.layers) {
                                                  const cleanedLayers = editingProfile.layers.map((layer) => {
                                                    if (!layer.assets_by_view?.[currentView.id]) return layer;
                                                    const nextAssets = { ...layer.assets_by_view };
                                                    const vAsset = { ...nextAssets[currentView.id] };
                                                    delete vAsset.shadow_png_url;
                                                    delete vAsset.highlight_png_url;
                                                    delete vAsset.shading_image_url;
                                                    nextAssets[currentView.id] = vAsset;
                                                    return { ...layer, assets_by_view: nextAssets };
                                                  });
                                                  setEditingProfile((prev) => prev ? { ...prev, layers: cleanedLayers } : prev);
                                                }
                                              },
                                            })
                                          }
                                          className="w-14 h-14 rounded-xl bg-white border border-white/20 hover:border-amber-400/60 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105 shadow-sm"
                                          title="Click to select 3D Shading PNG from Media Library"
                                        >
                                          {(currentView.shadow_png_url || currentView.shading_image_url) ? (
                                            <img
                                              src={currentView.shadow_png_url || currentView.shading_image_url}
                                              alt="3D Shading Map"
                                              className="w-full h-full object-contain p-1"
                                              onError={(e) => {
                                                (e.target as HTMLElement).style.display = 'none';
                                              }}
                                            />
                                          ) : (
                                            <div className="text-zinc-400 group-hover:text-amber-500 transition-colors flex flex-col items-center justify-center gap-0.5">
                                              <Layers className="w-4 h-4" />
                                              <span className="text-[9px] font-semibold">Shading</span>
                                            </div>
                                          )}
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                          </div>
                                        </button>

                                        <div className="flex-1 min-w-0">
                                          <p
                                            className="text-[11px] font-mono text-zinc-300 truncate"
                                            title={currentView.shadow_png_url || currentView.shading_image_url || ''}
                                          >
                                            {(currentView.shadow_png_url || currentView.shading_image_url)
                                              ? (currentView.shadow_png_url || currentView.shading_image_url)?.split('/').pop()
                                              : 'Click white square to browse media library'}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setMediaPickerConfig({
                                                  isOpen: true,
                                                  title: `Select 3D Shading Map: ${currentView.name}`,
                                                  recommendedDimensions: '1000x1000 Transparent PNG',
                                                  currentUrl: currentView.shadow_png_url || currentView.shading_image_url || '',
                                                  onSelect: (url) => {
                                                    handleSetViewField(currentView.id, 'shadow_png_url', url);
                                                    handleSetViewField(currentView.id, 'shading_image_url', url);
                                                    if (editingProfile?.layers) {
                                                      const cleanedLayers = editingProfile.layers.map((layer) => {
                                                        if (!layer.assets_by_view?.[currentView.id]) return layer;
                                                        const nextAssets = { ...layer.assets_by_view };
                                                        const vAsset = { ...nextAssets[currentView.id] };
                                                        delete vAsset.shadow_png_url;
                                                        delete vAsset.highlight_png_url;
                                                        delete vAsset.shading_image_url;
                                                        nextAssets[currentView.id] = vAsset;
                                                        return { ...layer, assets_by_view: nextAssets };
                                                      });
                                                      setEditingProfile((prev) => prev ? { ...prev, layers: cleanedLayers } : prev);
                                                    }
                                                  },
                                                })
                                              }
                                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                                              title="Browse WordPress Media Library"
                                            >
                                              <FolderOpen className="w-3 h-3 text-[#f3aa18]" />
                                              <span>Browse</span>
                                            </button>
                                            {(currentView.shadow_png_url || currentView.shading_image_url) && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  handleSetViewField(currentView.id, 'shadow_png_url', '');
                                                  handleSetViewField(currentView.id, 'shading_image_url', '');
                                                  if (editingProfile?.layers) {
                                                    const cleanedLayers = editingProfile.layers.map((layer) => {
                                                      if (!layer.assets_by_view?.[currentView.id]) return layer;
                                                      const nextAssets = { ...layer.assets_by_view };
                                                      const vAsset = { ...nextAssets[currentView.id] };
                                                      delete vAsset.shadow_png_url;
                                                      delete vAsset.highlight_png_url;
                                                      delete vAsset.shading_image_url;
                                                      nextAssets[currentView.id] = vAsset;
                                                      return { ...layer, assets_by_view: nextAssets };
                                                    });
                                                    setEditingProfile((prev) => prev ? { ...prev, layers: cleanedLayers } : prev);
                                                  }
                                                }}
                                                className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                title="Clear Shading Map"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Shading Tone Note */}
                                      <div className="pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
                                        <span className="text-[11px] text-zinc-400">
                                          Shadow & highlight tones are tuned per finish in Master Textures (v2).
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setShowMasterTexturesModal(true)}
                                          className="text-[11px] text-[#f3aa18] hover:text-[#ffb72b] font-semibold cursor-pointer transition-colors flex items-center gap-1"
                                        >
                                          <span>Tone Settings</span>
                                          <span>&rarr;</span>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Generated 3D Shading & Specular Bevel Card */}
                                    {(() => {
                                      const genShadow = currentView.generated_shadow || {};
                                      const hasViewShadow = Boolean(currentView.shadow_png_url || currentView.shading_image_url || currentView.highlight_png_url);
                                      const isGenEnabled = genShadow.enabled ?? (!hasViewShadow);
                                      const softness = genShadow.softness ?? 6;
                                      const distance = genShadow.distance ?? 3;
                                      const shadowOpacity = Math.round((genShadow.shadow_opacity ?? 0.40) * 100);
                                      const highlightOpacity = Math.round((genShadow.highlight_opacity ?? 0.25) * 100);
                                      const direction = genShadow.direction ?? 'bottom_right';

                                      const updateGenShadow = (patch: Partial<GeneratedShadowConfig>) => {
                                        const current = currentView.generated_shadow || {};
                                        handleSetViewField(currentView.id, 'generated_shadow', {
                                          ...current,
                                          ...patch,
                                        });
                                      };

                                      return (
                                        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                              <span className="text-xs font-bold text-white">Generated 3D Directional Shading</span>
                                              <InfoTooltip content="Generates soft incident directional lighting, inner bevel, and edge highlights directly from the vinyl alpha mask. Ideal when 3D raytraced shadow PNG maps are unavailable." />
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => updateGenShadow({ enabled: !isGenEnabled })}
                                              className={clsx(
                                                'px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer border',
                                                isGenEnabled
                                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                                  : 'bg-zinc-800 text-zinc-400 border-white/10 hover:text-zinc-200'
                                              )}
                                            >
                                              {isGenEnabled ? 'Enabled' : 'Disabled'}
                                            </button>
                                          </div>

                                          <p className="text-[11px] text-zinc-400">
                                            Simulates directional light falloff with Gaussian blur, casting shadow towards the {direction === 'bottom_right' ? 'bottom-right' : 'top-left'} of cutouts and edges.
                                          </p>

                                          {isGenEnabled && (
                                            <div className="space-y-3 pt-2 border-t border-white/5">
                                              {/* Direction Toggle */}
                                              <div className="flex items-center justify-between">
                                                <span className="text-[11px] text-zinc-300">Light Direction:</span>
                                                <div className="inline-flex rounded-lg bg-zinc-800 p-0.5 border border-white/10 text-[10px]">
                                                  <button
                                                    type="button"
                                                    onClick={() => updateGenShadow({ direction: 'bottom_right' })}
                                                    className={clsx(
                                                      'px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer',
                                                      direction === 'bottom_right'
                                                        ? 'bg-amber-400/20 text-amber-300 font-semibold shadow-sm'
                                                        : 'text-zinc-400 hover:text-zinc-200'
                                                    )}
                                                  >
                                                    Bottom-Right (Standard)
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => updateGenShadow({ direction: 'top_left' })}
                                                    className={clsx(
                                                      'px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer',
                                                      direction === 'top_left'
                                                        ? 'bg-amber-400/20 text-amber-300 font-semibold shadow-sm'
                                                        : 'text-zinc-400 hover:text-zinc-200'
                                                    )}
                                                  >
                                                    Top-Left (Inverted)
                                                  </button>
                                                </div>
                                              </div>

                                              {/* Softness (Blur) */}
                                              <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[11px]">
                                                  <span className="text-zinc-300">Shadow Softness (Blur):</span>
                                                  <span className="font-mono text-amber-300 text-[10px]">{softness}px</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[9px] font-mono text-zinc-500">1px</span>
                                                  <input
                                                    type="range"
                                                    min="1"
                                                    max="16"
                                                    step="1"
                                                    value={softness}
                                                    onChange={(e) => updateGenShadow({ softness: Number(e.target.value) })}
                                                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                                  />
                                                  <span className="text-[9px] font-mono text-zinc-500">16px</span>
                                                </div>
                                              </div>

                                              {/* Distance (Offset) */}
                                              <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[11px]">
                                                  <span className="text-zinc-300">Shadow Distance:</span>
                                                  <span className="font-mono text-amber-300 text-[10px]">{distance}px</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[9px] font-mono text-zinc-500">1px</span>
                                                  <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    step="1"
                                                    value={distance}
                                                    onChange={(e) => updateGenShadow({ distance: Number(e.target.value) })}
                                                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                                  />
                                                  <span className="text-[9px] font-mono text-zinc-500">10px</span>
                                                </div>
                                              </div>

                                              {/* Shadow Opacity */}
                                              <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[11px]">
                                                  <span className="text-zinc-300">Shadow Opacity:</span>
                                                  <span className="font-mono text-amber-300 text-[10px]">{shadowOpacity}%</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[9px] font-mono text-zinc-500">0%</span>
                                                  <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="5"
                                                    value={shadowOpacity}
                                                    onChange={(e) => updateGenShadow({ shadow_opacity: Number(e.target.value) / 100 })}
                                                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                                  />
                                                  <span className="text-[9px] font-mono text-zinc-500">100%</span>
                                                </div>
                                              </div>

                                              {/* Highlight Opacity */}
                                              <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[11px]">
                                                  <span className="text-zinc-300">Specular Highlight Opacity:</span>
                                                  <span className="font-mono text-amber-300 text-[10px]">{highlightOpacity}%</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[9px] font-mono text-zinc-500">0%</span>
                                                  <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="5"
                                                    value={highlightOpacity}
                                                    onChange={(e) => updateGenShadow({ highlight_opacity: Number(e.target.value) / 100 })}
                                                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                                                  />
                                                  <span className="text-[9px] font-mono text-zinc-500">100%</span>
                                                </div>
                                              </div>

                                              {/* Reset Button */}
                                              <div className="pt-1 flex justify-end">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateGenShadow({
                                                      enabled: true,
                                                      softness: 6,
                                                      distance: 3,
                                                      shadow_opacity: 0.40,
                                                      highlight_opacity: 0.25,
                                                      direction: 'bottom_right',
                                                    })
                                                  }
                                                  className="text-[10px] font-mono text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
                                                  title="Reset to default shading values"
                                                >
                                                  Reset Shading Defaults
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* Angle Texture Zoom / Scale Card */}
                                    <div className="space-y-3 bg-black/30 p-3.5 rounded-xl border border-white/5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-zinc-200">Angle Texture Zoom / Scale</span>
                                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30">
                                            {Math.round(((currentView.texture_scale ?? 1.0)) * 100)}%
                                            {(currentView.texture_scale ?? 1.0) === 1.0 ? ' (Default)' : ''}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleSetViewField(currentView.id, 'texture_scale', 1.0)}
                                          className="text-[10px] font-mono text-zinc-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
                                          title="Reset to 100% default"
                                        >
                                          Reset 100%
                                        </button>
                                      </div>
                                      <p className="text-[11px] text-zinc-400">
                                        Custom pattern scale for this viewing angle (accounts for different zoom/POV). Applies to repeating patterns: custom device finishes always render at 100% scale.
                                      </p>
                                      <div className="flex items-center gap-3 pt-1">
                                        <span className="text-[10px] font-mono text-zinc-500">50%</span>
                                        <input
                                          type="range"
                                          min="50"
                                          max="150"
                                          step="5"
                                          value={Math.round(((currentView.texture_scale ?? 1.0)) * 100)}
                                          onChange={(e) => {
                                            const val = Number(e.target.value) / 100;
                                            handleSetViewField(currentView.id, 'texture_scale', val);
                                          }}
                                          className="w-full accent-sky-400 cursor-pointer h-2 bg-zinc-800 rounded-lg appearance-none"
                                        />
                                        <span className="text-[10px] font-mono text-zinc-500">150%</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

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
                            <div className="pt-3 border-t border-white/5 space-y-2.5">
                              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                                Add Device Angle
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Angle name (e.g. Front View, Closed View, Keyboard View)"
                                  value={customAngleName}
                                  onChange={(e) => setCustomAngleName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (customAngleName.trim()) {
                                        handleAddView(customAngleName.trim());
                                        setCustomAngleName('');
                                      }
                                    }
                                  }}
                                  className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (customAngleName.trim()) {
                                      handleAddView(customAngleName.trim());
                                      setCustomAngleName('');
                                    }
                                  }}
                                  disabled={!customAngleName.trim()}
                                  className="px-3 py-1.5 rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] disabled:opacity-40 disabled:hover:bg-[#f3aa18] text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Angle</span>
                                </button>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] text-zinc-500 font-medium mr-1">Suggestions:</span>
                                <button
                                  type="button"
                                  onClick={() => handleAddView('Back View')}
                                  className="px-2.5 py-1 text-xs font-sans rounded-lg bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  + Back View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddView('Front View')}
                                  className="px-2.5 py-1 text-xs font-sans rounded-lg bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  + Front View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddView('Inner View')}
                                  className="px-2.5 py-1 text-xs font-sans rounded-lg bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  + Inner View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddView('Trackpad View')}
                                  className="px-2.5 py-1 text-xs font-sans rounded-lg bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
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

                        {/* TAB 3: CUTOUTS & COVERAGE (v2 DESTINATION-OUT) */}
                        {inspectorTab === 'cutouts' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <Sliders className="w-4 h-4 text-[#f3aa18]" />
                                <h4 className="text-xs font-semibold text-white">Cutouts & Coverage</h4>
                                <InfoTooltip text="1000x1000 alpha masks erased from vinyl layers via canvas destination-out to expose the metallic hardware chassis underneath." />
                              </div>

                              {/* Angle Switcher for Cutout Masks */}
                              {editingProfile.views.length > 1 && (
                                <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-white/5 text-[11px]">
                                  {editingProfile.views.map((v) => (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() => setActiveSimView(v.id)}
                                      className={clsx(
                                        'px-2 py-0.5 rounded font-medium transition-all cursor-pointer',
                                        activeSimView === v.id
                                          ? 'bg-[#f3aa18] text-black font-semibold shadow-xs'
                                          : 'text-zinc-400 hover:text-white'
                                      )}
                                    >
                                      {v.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* SECTION 1: LOGO CUTOUT */}
                            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-white">Logo Cutout</span>
                                  <InfoTooltip text="Erases a silhouette hole in the skin to reveal the metallic brand logo from the hardware chassis underneath." />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-zinc-400">Buyer Choice on Webstore</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextVal = !(editingProfile.coverage_and_cutouts?.has_logo_cutout !== false);
                                      handleSetCoverageAndCutouts('has_logo_cutout', nextVal);
                                      setSelectedLogoCutout(nextVal);
                                    }}
                                    className={clsx(
                                      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                                      editingProfile.coverage_and_cutouts?.has_logo_cutout !== false ? 'bg-emerald-500' : 'bg-zinc-700'
                                    )}
                                    title={editingProfile.coverage_and_cutouts?.has_logo_cutout !== false ? 'Enabled on webstore' : 'Disabled'}
                                  >
                                    <span
                                      className={clsx(
                                        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
                                        editingProfile.coverage_and_cutouts?.has_logo_cutout !== false ? 'translate-x-4' : 'translate-x-0'
                                      )}
                                    />
                                  </button>
                                </div>
                              </div>

                              {/* Logo Cutout Mask Slot */}
                              <div className="space-y-2 pt-1 border-t border-white/5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-zinc-400 font-medium">Logo Cutout Mask (1000x1000 PNG)</span>
                                  {(currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url) ? (
                                    <span className="text-emerald-400 font-mono text-[10px] font-semibold">Configured</span>
                                  ) : (
                                    <span className="text-zinc-500 font-mono text-[10px]">Not set</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMediaPickerConfig({
                                        isOpen: true,
                                        title: `Select Logo Cutout Mask: ${currentView?.name || 'Active Angle'}`,
                                        recommendedDimensions: '1000x1000 Transparent PNG',
                                        currentUrl: currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url || '',
                                        onSelect: (url) => {
                                          if (currentView) {
                                            handleSetViewField(currentView.id, 'logo_cutout_mask_url', url);
                                          }
                                          if (currentView?.is_default || currentView?.id === 'main_view' || !editingProfile.coverage_and_cutouts?.logo_cutout_mask_url) {
                                            handleSetCoverageAndCutouts('logo_cutout_mask_url', url);
                                          }
                                        },
                                      })
                                    }
                                    className="w-14 h-14 rounded-xl bg-white border border-white/20 hover:border-white/40 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105 shadow-sm"
                                    title="Click to select Logo Cutout Mask from Media Library"
                                  >
                                    {(currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url) ? (
                                      <img
                                        src={currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url}
                                        alt="Logo Cutout Mask"
                                        className="w-full h-full object-contain p-1"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="text-zinc-400 group-hover:text-zinc-600 transition-colors flex flex-col items-center justify-center gap-0.5">
                                        <Plus className="w-4 h-4" />
                                        <span className="text-[9px] font-semibold">Mask</span>
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <Edit3 className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <p
                                      className="text-[11px] font-mono text-zinc-300 truncate"
                                      title={currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url || ''}
                                    >
                                      {(currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url)
                                        ? (currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url)?.split('/').pop()
                                        : 'Click square thumbnail to browse media library'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMediaPickerConfig({
                                            isOpen: true,
                                            title: `Select Logo Cutout Mask: ${currentView?.name || 'Active Angle'}`,
                                            recommendedDimensions: '1000x1000 Transparent PNG',
                                            currentUrl: currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url || '',
                                            onSelect: (url) => {
                                              if (currentView) {
                                                handleSetViewField(currentView.id, 'logo_cutout_mask_url', url);
                                              }
                                              if (currentView?.is_default || currentView?.id === 'main_view' || !editingProfile.coverage_and_cutouts?.logo_cutout_mask_url) {
                                                handleSetCoverageAndCutouts('logo_cutout_mask_url', url);
                                              }
                                            },
                                          })
                                        }
                                        className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                      >
                                        <FolderOpen className="w-3 h-3 text-[#f3aa18]" />
                                        <span>Browse Media</span>
                                      </button>
                                      {(currentView?.logo_cutout_mask_url || editingProfile.coverage_and_cutouts?.logo_cutout_mask_url) && (
                                        <>
                                          <span className="text-zinc-700">|</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (currentView) {
                                                handleSetViewField(currentView.id, 'logo_cutout_mask_url', '');
                                              }
                                              handleSetCoverageAndCutouts('logo_cutout_mask_url', '');
                                            }}
                                            className="text-[11px] text-zinc-500 hover:text-rose-400 font-medium cursor-pointer transition-colors"
                                          >
                                            Clear
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* SECTION 2: CUSTOM / PENCIL GROOVE CUTOUT */}
                            {Boolean(
                              showCustomCutoutSection ||
                              editingProfile.coverage_and_cutouts?.has_pencil_cutout ||
                              editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url ||
                              currentView?.pencil_cutout_mask_url
                            ) ? (
                              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3 relative">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <input
                                      type="text"
                                      placeholder="Cutout Name (e.g. Stylus Cutout, S-Pen Cutout, Antenna Strip)"
                                      value={editingProfile.coverage_and_cutouts?.pencil_cutout_label ?? 'Stylus Cutout'}
                                      onChange={(e) => handleSetCoverageAndCutouts('pencil_cutout_label', e.target.value)}
                                      className="text-xs font-semibold text-white bg-transparent border-b border-white/10 hover:border-white/30 focus:border-[#f3aa18] focus:bg-zinc-950/60 px-1 py-0.5 rounded transition-colors focus:outline-none w-full max-w-[220px]"
                                      title="Click to rename cutout option"
                                    />
                                    <InfoTooltip text="Custom renamable cutout option for buyers on webstore (e.g. Apple Pencil strip, S-Pen slot, or custom hardware cutout)." />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-zinc-400">Buyer Choice on Webstore</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextVal = !Boolean(editingProfile.coverage_and_cutouts?.has_pencil_cutout);
                                        handleSetCoverageAndCutouts('has_pencil_cutout', nextVal);
                                        setSelectedPencilCutout(nextVal);
                                      }}
                                      className={clsx(
                                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                                        Boolean(editingProfile.coverage_and_cutouts?.has_pencil_cutout) ? 'bg-emerald-500' : 'bg-zinc-700'
                                      )}
                                      title={Boolean(editingProfile.coverage_and_cutouts?.has_pencil_cutout) ? 'Enabled on webstore' : 'Disabled'}
                                    >
                                      <span
                                        className={clsx(
                                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
                                          Boolean(editingProfile.coverage_and_cutouts?.has_pencil_cutout) ? 'translate-x-4' : 'translate-x-0'
                                        )}
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (currentView) {
                                          handleSetViewField(currentView.id, 'pencil_cutout_mask_url', '');
                                        }
                                        handleSetCoverageAndCutouts('pencil_cutout_mask_url', '');
                                        handleSetCoverageAndCutouts('has_pencil_cutout', false);
                                        setShowCustomCutoutSection(false);
                                        setSelectedPencilCutout(false);
                                      }}
                                      className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer ml-1"
                                      title="Remove Custom Cutout"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Custom Cutout Pill Badge & Tooltip Description */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-zinc-400 font-medium">Pill Badge (Storefront)</span>
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="e.g. RECOMMENDED, NEW"
                                      value={editingProfile.coverage_and_cutouts?.pencil_cutout_pill || ''}
                                      onChange={(e) => handleSetCoverageAndCutouts('pencil_cutout_pill', e.target.value)}
                                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18] placeholder:text-zinc-600"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-zinc-400 font-medium">Tooltip Description</span>
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="Storefront tooltip description..."
                                      value={editingProfile.coverage_and_cutouts?.pencil_cutout_description || ''}
                                      onChange={(e) => handleSetCoverageAndCutouts('pencil_cutout_description', e.target.value)}
                                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18] placeholder:text-zinc-600"
                                    />
                                  </div>
                                </div>

                                {/* Stylus Cutout Mask Slot */}
                                <div className="space-y-2 pt-1 border-t border-white/5">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-400 font-medium">Cutout Mask (1000x1000 PNG)</span>
                                    {(currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url) ? (
                                      <span className="text-emerald-400 font-mono text-[10px] font-semibold">Configured</span>
                                    ) : (
                                      <span className="text-zinc-500 font-mono text-[10px]">Not set</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMediaPickerConfig({
                                          isOpen: true,
                                          title: `Select Cutout Mask: ${editingProfile.coverage_and_cutouts?.pencil_cutout_label || 'Stylus Cutout'}`,
                                          recommendedDimensions: '1000x1000 Transparent PNG',
                                          currentUrl: currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url || '',
                                          onSelect: (url) => {
                                            if (currentView) {
                                              handleSetViewField(currentView.id, 'pencil_cutout_mask_url', url);
                                            }
                                            if (currentView?.is_default || currentView?.id === 'main_view' || !editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url) {
                                              handleSetCoverageAndCutouts('pencil_cutout_mask_url', url);
                                            }
                                            if (url) {
                                              handleSetCoverageAndCutouts('has_pencil_cutout', true);
                                            }
                                          },
                                        })
                                      }
                                      className="w-14 h-14 rounded-xl bg-white border border-white/20 hover:border-white/40 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105 shadow-sm"
                                      title="Click to select Cutout Mask from Media Library"
                                    >
                                      {(currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url) ? (
                                        <img
                                          src={currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url}
                                          alt="Cutout Mask"
                                          className="w-full h-full object-contain p-1"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="text-zinc-400 group-hover:text-zinc-600 transition-colors flex flex-col items-center justify-center gap-0.5">
                                          <Plus className="w-4 h-4" />
                                          <span className="text-[9px] font-semibold">Mask</span>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <Edit3 className="w-3.5 h-3.5 text-white" />
                                      </div>
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <p
                                        className="text-[11px] font-mono text-zinc-300 truncate"
                                        title={currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url || ''}
                                      >
                                        {(currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url)
                                          ? (currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url)?.split('/').pop()
                                          : 'Click square thumbnail to browse media library'}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setMediaPickerConfig({
                                              isOpen: true,
                                              title: `Select Cutout Mask: ${editingProfile.coverage_and_cutouts?.pencil_cutout_label || 'Stylus Cutout'}`,
                                              recommendedDimensions: '1000x1000 Transparent PNG',
                                              currentUrl: currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url || '',
                                              onSelect: (url) => {
                                                if (currentView) {
                                                  handleSetViewField(currentView.id, 'pencil_cutout_mask_url', url);
                                                }
                                                if (currentView?.is_default || currentView?.id === 'main_view' || !editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url) {
                                                  handleSetCoverageAndCutouts('pencil_cutout_mask_url', url);
                                                }
                                                if (url) {
                                                  handleSetCoverageAndCutouts('has_pencil_cutout', true);
                                                }
                                              },
                                            })
                                          }
                                          className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <FolderOpen className="w-3 h-3 text-[#f3aa18]" />
                                          <span>Browse Media</span>
                                        </button>
                                        {(currentView?.pencil_cutout_mask_url || editingProfile.coverage_and_cutouts?.pencil_cutout_mask_url) && (
                                          <>
                                            <span className="text-zinc-700">|</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (currentView) {
                                                  handleSetViewField(currentView.id, 'pencil_cutout_mask_url', '');
                                                }
                                                handleSetCoverageAndCutouts('pencil_cutout_mask_url', '');
                                              }}
                                              className="text-[11px] text-zinc-500 hover:text-rose-400 font-medium cursor-pointer transition-colors"
                                            >
                                              Clear
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCustomCutoutSection(true);
                                  handleSetCoverageAndCutouts('has_pencil_cutout', true);
                                  setSelectedPencilCutout(true);
                                }}
                                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-white/15 hover:border-[#f3aa18]/50 bg-white/[0.02] hover:bg-[#f3aa18]/[0.04] text-zinc-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 text-[#f3aa18]" />
                                <span>Add Custom Cutout (e.g. Stylus / S-Pen / Apple Pencil)</span>
                              </button>
                            )}

                            {/* SECTION 3: MODEL CUT & 360 COVERAGE */}
                            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-white">Model Coverage</span>
                                  <InfoTooltip text="Configures whether buyers can choose between Model Cut (Back Only) and Full Frame 360 wrap." />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-zinc-400">Buyer Choice on Webstore</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentCov = editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
                                      const isEnabled = currentCov !== 'none';
                                      if (isEnabled) {
                                        handleSetCoverageAndCutouts('coverage_type', 'none');
                                        handleSetCoverageAndCutouts('has_model_cut', false);
                                      } else {
                                        handleSetCoverageAndCutouts('coverage_type', 'model_cut_and_360');
                                        handleSetCoverageAndCutouts('has_model_cut', true);
                                      }
                                    }}
                                    className={clsx(
                                      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                                      (editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none')) !== 'none'
                                        ? 'bg-emerald-500'
                                        : 'bg-zinc-700'
                                    )}
                                    title={(editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none')) !== 'none' ? 'Enabled on webstore' : 'Disabled'}
                                  >
                                    <span
                                      className={clsx(
                                        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
                                        (editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none')) !== 'none'
                                          ? 'translate-x-4'
                                          : 'translate-x-0'
                                      )}
                                    />
                                  </button>
                                </div>
                              </div>

                              {/* Coverage Mode Selection */}
                              {((editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none')) !== 'none') ? (
                                <div className="space-y-1.5">
                                  <span className="text-[11px] text-zinc-400 font-medium">Coverage Mode</span>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {[
                                      { id: 'model_cut_and_360', label: 'Model Cut & 360°' },
                                      { id: 'model_cut_only', label: 'Model Cut Only' },
                                      { id: 'model_360_only', label: 'Model 360° Only' },
                                    ].map((mode) => {
                                      const currentCov = editingProfile.coverage_and_cutouts?.coverage_type || (editingProfile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
                                      const isSelected = currentCov === mode.id;
                                      return (
                                        <button
                                          key={mode.id}
                                          type="button"
                                          onClick={() => handleSetCoverageAndCutouts('coverage_type', mode.id)}
                                          className={clsx(
                                            'px-2 py-1.5 rounded-lg border text-center transition-all cursor-pointer text-xs',
                                            isSelected
                                              ? 'bg-[#f3aa18]/15 border-[#f3aa18] text-white font-semibold'
                                              : 'bg-zinc-950/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900'
                                          )}
                                        >
                                          {mode.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[11px] text-zinc-500 italic p-2 rounded-lg bg-zinc-950/40 border border-white/5">
                                  Coverage choice disabled on webstore (Single cut only).
                                </p>
                              )}

                                {/* Upcharge for Model 360 */}
                                {(editingProfile.coverage_and_cutouts?.coverage_type === 'model_cut_and_360' ||
                                  (!editingProfile.coverage_and_cutouts?.coverage_type && editingProfile.coverage_and_cutouts?.has_model_cut)) && (
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-white/5 text-xs mt-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-zinc-300 font-medium">360 Extra Price</span>
                                      <InfoTooltip text="Upcharge added when buyer selects Full Frame 360 wrap over standard Model Cut." />
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-zinc-500 font-mono text-[10px]">IDR</span>
                                      <input
                                        type="number"
                                        step="5000"
                                        value={editingProfile.coverage_and_cutouts?.model_360_extra_price ?? 40000}
                                        onChange={(e) =>
                                          handleSetCoverageAndCutouts('model_360_extra_price', Number(e.target.value) || 0)
                                        }
                                        className="w-20 px-2 py-0.5 text-xs font-mono text-right rounded bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                                      />
                                    </div>
                                  </div>
                                )}

                              {/* Model Cut Perimeter Mask Slot */}
                              <div className="space-y-2 pt-1 border-t border-white/5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-zinc-400 font-medium">Perimeter Mask (Frame Flaps)</span>
                                    <InfoTooltip text="Erases outer side frame flaps when Model Cut (Back Only) is selected on webstore." />
                                  </div>
                                  {(currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url) ? (
                                    <span className="text-emerald-400 font-mono text-[10px] font-semibold">Configured</span>
                                  ) : (
                                    <span className="text-zinc-500 font-mono text-[10px]">Not set</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMediaPickerConfig({
                                        isOpen: true,
                                        title: `Select Model Cut Mask: ${currentView?.name || 'Active Angle'}`,
                                        recommendedDimensions: '1000x1000 Transparent PNG',
                                        currentUrl: currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url || '',
                                        onSelect: (url) => {
                                          if (currentView) {
                                            handleSetViewField(currentView.id, 'model_cut_mask_url', url);
                                          }
                                          if (currentView?.is_default || currentView?.id === 'main_view' || !editingProfile.coverage_and_cutouts?.model_cut_mask_url) {
                                            handleSetCoverageAndCutouts('model_cut_mask_url', url);
                                          }
                                        },
                                      })
                                    }
                                    className="w-14 h-14 rounded-xl bg-white border border-white/20 hover:border-white/40 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer transition-all hover:scale-105 shadow-sm"
                                    title="Click to select Model Cut Mask from Media Library"
                                  >
                                    {(currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url) ? (
                                      <img
                                        src={currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url}
                                        alt="Model Cut Mask"
                                        className="w-full h-full object-contain p-1"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="text-zinc-400 group-hover:text-zinc-600 transition-colors flex flex-col items-center justify-center gap-0.5">
                                        <Plus className="w-4 h-4" />
                                        <span className="text-[9px] font-semibold">Mask</span>
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <Edit3 className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <p
                                      className="text-[11px] font-mono text-zinc-300 truncate"
                                      title={currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url || ''}
                                    >
                                      {(currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url)
                                        ? (currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url)?.split('/').pop()
                                        : 'Click square thumbnail to browse media library'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMediaPickerConfig({
                                            isOpen: true,
                                            title: `Select Model Cut Mask: ${currentView?.name || 'Active Angle'}`,
                                            recommendedDimensions: '1000x1000 Transparent PNG',
                                            currentUrl: currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url || '',
                                            onSelect: (url) => {
                                              if (currentView) {
                                                handleSetViewField(currentView.id, 'model_cut_mask_url', url);
                                              }
                                              if (currentView?.is_default || currentView?.id === 'main_view' || !editingProfile.coverage_and_cutouts?.model_cut_mask_url) {
                                                handleSetCoverageAndCutouts('model_cut_mask_url', url);
                                              }
                                            },
                                          })
                                        }
                                        className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                      >
                                        <FolderOpen className="w-3 h-3 text-[#f3aa18]" />
                                        <span>Browse Media</span>
                                      </button>
                                      {(currentView?.model_cut_mask_url || editingProfile.coverage_and_cutouts?.model_cut_mask_url) && (
                                        <>
                                          <span className="text-zinc-700">|</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (currentView) {
                                                handleSetViewField(currentView.id, 'model_cut_mask_url', '');
                                              }
                                              handleSetCoverageAndCutouts('model_cut_mask_url', '');
                                            }}
                                            className="text-[11px] text-zinc-500 hover:text-rose-400 font-medium cursor-pointer transition-colors"
                                          >
                                            Clear
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* TAB: PRESETS & CURATED LOOKS */}
                        {inspectorTab === 'presets' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <Compass className="w-4 h-4 text-purple-400" />
                                <h4 className="text-xs font-heading font-normal tracking-wide text-white">Curated Looks & Presets</h4>
                                <InfoTooltip text="Presets shown in 'Shop the Look' modal for this device. Customers can apply combinations in 1 click." />
                              </div>
                              <button
                                type="button"
                                onClick={handleOpenAddDevicePreset}
                                className="px-2.5 py-1 rounded-lg bg-[#f3aa18] hover:bg-[#e09b15] text-black font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Look</span>
                              </button>
                            </div>

                            {/* Presets List */}
                            {(!editingProfile.presets || editingProfile.presets.length === 0) ? (
                              <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-dashed border-white/10 space-y-3">
                                <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center">
                                  <Compass className="w-5 h-5" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-white">No Presets for this Device</p>
                                  <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                                    Curate styling recipes (e.g. Swarm + Matte Black camera) to showcase in "Shop the Look".
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleOpenAddDevicePreset}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-all cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#f3aa18]" />
                                  <span>Create First Look</span>
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {editingProfile.presets.map((preset, idx) => {
                                  const layerCount = Object.keys(preset.layers || {}).length;
                                  return (
                                    <div
                                      key={preset.id || idx}
                                      className="p-3.5 rounded-xl bg-zinc-900/70 border border-white/10 hover:border-white/20 transition-all space-y-2.5 group"
                                    >
                                      {/* Header row */}
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {preset.badge === 'POPULAR' && (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/40">
                                              POPULAR
                                            </span>
                                          )}
                                          {preset.badge === 'STAFF PICK' && (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                              STAFF PICK
                                            </span>
                                          )}
                                          <span className="text-xs font-heading font-normal tracking-wide text-white">
                                            {preset.title}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleTestPresetInSimulator(preset)}
                                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer"
                                            title="Apply preset to simulator canvas"
                                          >
                                            <Eye className="w-3 h-3 text-[#f3aa18]" />
                                            <span>Test</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditDevicePreset(preset)}
                                            className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                            title="Edit look preset"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteDevicePreset(preset.id)}
                                            className="p-1 rounded-lg hover:bg-rose-500/20 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                                            title="Delete preset"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Tags row */}
                                      <div className="flex items-center gap-2 flex-wrap text-[10.5px]">
                                        {preset.coverage && (
                                          <span className="px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 border border-white/5 font-mono">
                                            {preset.coverage === 'model_360' ? 'Model 360°' : 'Model Cut'}
                                          </span>
                                        )}
                                        {preset.logo_cutout !== undefined && (
                                          <span className="px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 border border-white/5 font-mono">
                                            {preset.logo_cutout ? 'With Logo' : 'No Logo'}
                                          </span>
                                        )}
                                        <span className="px-2 py-0.5 rounded-md bg-white/5 text-zinc-400 border border-white/5 font-mono">
                                          {layerCount} {layerCount === 1 ? 'part' : 'parts'}
                                        </span>
                                      </div>

                                      {/* Layer finish pills */}
                                      {preset.layers && typeof preset.layers === 'object' && (
                                        <div className="pt-1 flex flex-wrap gap-1.5">
                                          {Object.entries(preset.layers).map(([layerKey, finishSlug]) => {
                                            const matchingLayer = editingProfile.layers.find(
                                              (l) =>
                                                l.id === layerKey ||
                                                l.id.toLowerCase() === layerKey.toLowerCase() ||
                                                l.name.toLowerCase() === layerKey.toLowerCase()
                                            );
                                            const finishObj = finishes.find(
                                              (f) => f.slug === finishSlug || f.id === finishSlug
                                            );
                                            return (
                                              <span
                                                key={layerKey}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/90 text-zinc-300 text-[10.5px] border border-white/5"
                                              >
                                                <span className="text-zinc-500 font-medium">
                                                  {matchingLayer?.name || layerKey}:
                                                </span>
                                                <span className="text-[#f3aa18] font-semibold">
                                                  {String(finishObj?.name || finishSlug)}
                                                </span>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {/* Custom preview image indicator if set */}
                                      {preset.image_url && (
                                        <div className="pt-1 flex items-center gap-2 text-[10px] text-zinc-400">
                                          <img
                                            src={preset.image_url}
                                            alt={preset.title}
                                            className="w-7 h-7 rounded object-cover border border-white/10 shrink-0"
                                          />
                                          <span className="truncate max-w-[200px] font-mono text-[9.5px]">
                                            {preset.image_url}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* TAB 4: PRICING, SIZING & PRODUCTION SETTINGS */}
                        {inspectorTab === 'pricing' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-emerald-400" />
                                <h4 className="text-xs font-semibold text-white">Pricing & Settings</h4>
                                <InfoTooltip text="Storefront pricing, family sizing multipliers for finishes, production variants, and rendering engine." />
                              </div>
                              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                                {editingProfile.status || 'publish'}
                              </span>
                            </div>

                            {/* Base Price & Family Multipliers */}
                            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3">
                              {/* Publication Status */}
                              <div className="space-y-1">
                                <span className="text-[11px] text-zinc-400 font-medium">Storefront Status</span>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingProfile({
                                        ...editingProfile,
                                        status: 'draft',
                                      })
                                    }
                                    className={clsx(
                                      'px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer',
                                      (editingProfile.status || 'publish') === 'draft'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                                        : 'bg-zinc-950/60 text-zinc-400 border-white/10 hover:text-white hover:bg-zinc-900'
                                    )}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    <span>Draft</span>
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
                                      'px-3 py-1.5 text-xs font-medium rounded-lg border flex items-center justify-center gap-2 transition-all cursor-pointer',
                                      (editingProfile.status || 'publish') === 'publish'
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                                        : 'bg-zinc-950/60 text-zinc-400 border-white/10 hover:text-white hover:bg-zinc-900'
                                    )}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span>Published</span>
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div>
                                  <div className="flex items-center gap-1 mb-1 text-[11px]">
                                    <span className="text-zinc-400 font-medium">Base Price (IDR)</span>
                                    <InfoTooltip text="Base device price synchronized directly with WooCommerce regular price." />
                                  </div>
                                  <input
                                    type="number"
                                    value={editingProfile.base_price}
                                    onChange={(e) =>
                                      setEditingProfile({ ...editingProfile, base_price: Number(e.target.value) || 0 })
                                    }
                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white font-mono focus:outline-none focus:border-[#f3aa18]"
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center gap-1 mb-1 text-[11px]">
                                    <span className="text-zinc-400 font-medium">Device Family</span>
                                    <InfoTooltip text="Category scale used to automatically calculate premium material surcharges." />
                                  </div>
                                  <select
                                    value={
                                      editingProfile.family === 'tablet_laptop'
                                        ? 'tablet'
                                        : (editingProfile.family || 'phone')
                                    }
                                    onChange={(e) => {
                                      const selected = e.target.value as DeviceFamily;
                                      let nextMult = 1.0;
                                      if (selected === 'tablet' || selected === 'laptop' || selected === 'keyboard' || selected === 'console' || (selected as string) === 'tablet_laptop') {
                                        nextMult = 2.0;
                                      } else if (selected === 'foldable') {
                                        nextMult = 1.3;
                                      } else if (selected === 'accessory') {
                                        nextMult = 0.8;
                                      }
                                      setEditingProfile({
                                        ...editingProfile,
                                        family: selected,
                                        size_multiplier: nextMult,
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                                  >
                                    <option value="phone">Phone (1.0x - +IDR 30.000)</option>
                                    <option value="tablet">Tablet (2.0x - +IDR 60.000)</option>
                                    <option value="laptop">Laptop (2.0x - +IDR 60.000)</option>
                                    <option value="foldable">Foldable (1.3x - +IDR 39.000)</option>
                                    <option value="keyboard">Keyboard / Folio (2.0x - +IDR 60.000)</option>
                                    <option value="console">Gaming Console (2.0x - +IDR 60.000)</option>
                                    <option value="accessory">Accessory (0.8x - +IDR 24.000)</option>
                                  </select>
                                </div>
                              </div>

                              {/* Size Multiplier and Surcharge Summary */}
                              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/60 border border-white/5 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-300 font-medium">Size Multiplier</span>
                                  <InfoTooltip text="Multiplied against premium finish group up-prices (e.g. IDR 30,000 * 2.5x = IDR 75,000)." />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
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
                                    className="w-16 px-2 py-0.5 text-xs font-mono text-right rounded bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-[#f3aa18]"
                                  />
                                  <span className="text-[11px] text-amber-400 font-mono">
                                    +IDR {Math.round(30000 * (editingProfile.size_multiplier || 1.0)).toLocaleString('id-ID')}
                                  </span>
                                </div>
                              </div>

                              {/* Dynamic Finish Surcharges (Brackets) */}
                              <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/5 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-xs font-bold text-white">Dynamic Finish Surcharges</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowSurchargeTiersModal(true)}
                                    className="px-2 py-0.5 text-[10px] font-mono text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition-colors cursor-pointer"
                                  >
                                    Manage Brackets ({surchargeTiers.length})
                                  </button>
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                  Finishes with signature upcharges scale by part base price. Accents (IDR 35,000) only add +5,000 instead of +30,000.
                                </p>
                                <div className="grid grid-cols-1 gap-1 pt-1">
                                  {surchargeTiers.slice(0, 3).map((tier) => (
                                    <div
                                      key={tier.id}
                                      className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded bg-zinc-900/60 border border-white/5"
                                    >
                                      <span className="text-zinc-300 truncate max-w-[140px]">{tier.label}</span>
                                      <span className="text-amber-400 font-bold">
                                        +IDR {tier.surcharge.toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Device Production Variants */}
                            {(() => {
                              const isPhone =
                                editingProfile.family === 'phone' ||
                                !editingProfile.family ||
                                /\b(iphone|galaxy|pixel|xiaomi|redmi|poco|oppo|vivo|realme|infinix|oneplus|phone)\b/i.test(
                                  `${editingProfile.device_name || ''} ${editingProfile.device_slug || ''}`
                                );
                              const cleanProductionVariants = sanitizeDeviceVariants(
                                editingProfile.variants,
                                editingProfile.family,
                                editingProfile.device_name,
                                editingProfile.device_slug
                              );

                              return (
                                <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 space-y-3.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-lg bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex items-center justify-center shrink-0">
                                        <Cpu className="w-3.5 h-3.5 text-[#f3aa18]" />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-white">Production Variants</span>
                                          {cleanProductionVariants.length > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] font-mono font-semibold text-zinc-300">
                                              {cleanProductionVariants.length}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-zinc-400 mt-0.5">
                                          Hardware models (e.g. Wi-Fi vs Cellular on iPads) requiring distinct physical cut templates. Note: iPhone and phone models are always separate products.
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextIdx = cleanProductionVariants.length + 1;
                                        const newVariant: ConfiguratorVariant = {
                                          id: `variant_${Date.now()}`,
                                          name: `Variant ${nextIdx}`,
                                          options: [
                                            { id: `opt_${Date.now()}_1`, name: 'Standard', price_diff: 0 },
                                          ],
                                        };
                                        handleSetVariants([...cleanProductionVariants, newVariant]);
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 border border-[#f3aa18]/30 text-[#f3aa18] hover:text-amber-300 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add Group</span>
                                    </button>
                                  </div>

                                  {cleanProductionVariants.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-zinc-950/60 border border-dashed border-white/10 text-center space-y-1">
                                      <p className="text-xs font-medium text-zinc-400">
                                        {isPhone
                                          ? 'Standard single cut (Phone models are individual products)'
                                          : 'No physical cut variants configured'}
                                      </p>
                                      <p className="text-[11px] text-zinc-500">
                                        {isPhone
                                          ? 'iPhone and smartphone models are cataloged as separate standalone products. Physical variants (e.g. Wi-Fi vs Cellular) are reserved for iPads and tablets.'
                                          : 'Standard single template cut will be used for production across all orders.'}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {cleanProductionVariants.map((v, vIdx) => (
                                        <div
                                          key={v.id || vIdx}
                                          className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 hover:border-white/15 transition-all space-y-3 shadow-xs"
                                        >
                                          {/* Variant Card Header */}
                                          <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-[#f3aa18]/10 text-[#f3aa18] border border-[#f3aa18]/25 text-[10px] font-mono font-bold shrink-0">
                                              #{vIdx + 1}
                                            </span>
                                            <input
                                              type="text"
                                              value={v.name}
                                              onChange={(e) => {
                                                const next = [...cleanProductionVariants];
                                                next[vIdx] = { ...next[vIdx], name: e.target.value };
                                                handleSetVariants(next);
                                              }}
                                              placeholder="Variant Group Name (e.g. Connectivity or Model Edition)"
                                              className="flex-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18] transition-colors"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = cleanProductionVariants.filter((_, idx) => idx !== vIdx);
                                                handleSetVariants(next);
                                              }}
                                              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                                              title="Remove Variant Group"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          {/* Options List */}
                                          <div className="space-y-1.5 pt-1 border-t border-white/5">
                                            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-wider px-1">
                                              <span>Option Name</span>
                                              <span>Price Extra (+IDR)</span>
                                            </div>
                                            {v.options.map((opt, oIdx) => (
                                              <div
                                                key={opt.id || oIdx}
                                                className="flex items-center gap-2 p-1.5 rounded-lg bg-zinc-900/60 border border-white/5 hover:border-white/10 transition-colors"
                                              >
                                                <span className="w-5 h-5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-mono flex items-center justify-center shrink-0">
                                                  {oIdx + 1}
                                                </span>
                                                <input
                                                  type="text"
                                                  value={opt.name}
                                                  onChange={(e) => {
                                                    const next = [...cleanProductionVariants];
                                                    const opts = [...next[vIdx].options];
                                                    opts[oIdx] = { ...opts[oIdx], name: e.target.value };
                                                    next[vIdx] = { ...next[vIdx], options: opts };
                                                    handleSetVariants(next);
                                                  }}
                                                  placeholder="Option name (e.g. Wi-Fi Only)"
                                                  className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18] transition-colors"
                                                />
                                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-950 border border-white/10 shrink-0">
                                                  <span className="text-[10px] text-zinc-500 font-mono font-semibold">+IDR</span>
                                                  <input
                                                    type="number"
                                                    step="5000"
                                                    value={opt.price_diff || 0}
                                                    onChange={(e) => {
                                                      const next = [...cleanProductionVariants];
                                                      const opts = [...next[vIdx].options];
                                                      opts[oIdx] = { ...opts[oIdx], price_diff: Number(e.target.value) || 0 };
                                                      next[vIdx] = { ...next[vIdx], options: opts };
                                                      handleSetVariants(next);
                                                    }}
                                                    className="w-20 text-xs font-mono text-right bg-transparent text-white focus:outline-none"
                                                  />
                                                </div>
                                                {v.options.length > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const next = [...cleanProductionVariants];
                                                      const opts = next[vIdx].options.filter((_, idx) => idx !== oIdx);
                                                      next[vIdx] = { ...next[vIdx], options: opts };
                                                      handleSetVariants(next);
                                                    }}
                                                    className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors shrink-0"
                                                    title="Remove Option"
                                                  >
                                                    <X className="w-3.5 h-3.5" />
                                                  </button>
                                                )}
                                              </div>
                                            ))}

                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = [...cleanProductionVariants];
                                                const optIdx = next[vIdx].options.length + 1;
                                                next[vIdx] = {
                                                  ...next[vIdx],
                                                  options: [
                                                    ...next[vIdx].options,
                                                    { id: `opt_${Date.now()}`, name: `Option ${optIdx}`, price_diff: 0 },
                                                  ],
                                                };
                                                handleSetVariants(next);
                                              }}
                                              className="w-full py-1.5 px-3 rounded-lg border border-dashed border-white/15 hover:border-[#f3aa18]/40 hover:bg-[#f3aa18]/5 text-[11px] font-medium text-zinc-400 hover:text-[#f3aa18] transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                                            >
                                              <Plus className="w-3 h-3" />
                                              <span>Add Cut Option</span>
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Engine Architecture & Find-Replace Action */}
                            <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-white">Engine Architecture</span>
                                  <InfoTooltip text="v2 Modern uses HTML5 canvas destination-in masking, universal master textures, and destination-out cutout punching." />
                                </div>
                                <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10 text-[11px]">
                                  <button
                                    type="button"
                                    onClick={() => setEditingProfile({ ...editingProfile, configurator_version: 'v1' })}
                                    className={clsx(
                                      'px-2 py-0.5 rounded font-medium transition-all cursor-pointer',
                                      (editingProfile.configurator_version || 'v1') === 'v1'
                                        ? 'bg-amber-500 text-black font-semibold'
                                        : 'text-zinc-400 hover:text-white'
                                    )}
                                  >
                                    v1 Legacy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingProfile({ ...editingProfile, configurator_version: 'v2' })}
                                    className={clsx(
                                      'px-2 py-0.5 rounded font-medium transition-all cursor-pointer',
                                      editingProfile.configurator_version === 'v2'
                                        ? 'bg-sky-500 text-black font-semibold'
                                        : 'text-zinc-400 hover:text-white'
                                    )}
                                  >
                                    v2 Modern
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setFindText('');
                                  setReplaceText('');
                                  setShowFindReplaceModal(true);
                                }}
                                className="w-full py-2 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white flex items-center justify-center gap-2 cursor-pointer transition-colors mt-2"
                              >
                                <Wand2 className="w-3.5 h-3.5 text-[#f3aa18]" />
                                <span>Find & Replace in URLs</span>
                              </button>
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
                            <ImageIcon className="w-5 h-5 text-[#f3aa18]" />
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
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://exacoat.com/wp-content/uploads/renders/finish.png"
                          value={tempTextureUrl}
                          onChange={(e) => setTempTextureUrl(e.target.value)}
                          autoFocus
                          className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#f3aa18]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMediaPickerConfig({
                              isOpen: true,
                              title: `Select Texture: ${editingTextureModal.finishName}`,
                              recommendedDimensions: '1000x1000 Transparent PNG',
                              currentUrl: tempTextureUrl,
                              onSelect: (url) => setTempTextureUrl(url),
                            })
                          }
                          className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
                          title="Browse WordPress Media Library"
                        >
                          <FolderOpen className="w-4 h-4 text-[#f3aa18]" />
                          <span>Browse</span>
                        </button>
                      </div>
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
                            <h3 className="text-sm font-heading font-normal tracking-wider uppercase text-white">Asset Integrity & Health Audit</h3>
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

                      {/* Legacy Slices Prune Callout for v2 Products */}
                      {editingProfile?.configurator_version === 'v2' && (() => {
                        const customSlugs = new Set(
                          finishes.filter((f) => f.is_custom_per_device).map((f) => (f.slug || f.id).toLowerCase())
                        );
                        let legacySliceCount = 0;
                        (editingProfile?.layers || []).forEach((l) => {
                          Object.values(l.assets_by_view || {}).forEach((vAsset: any) => {
                            Object.keys(vAsset.render_texture_map || {}).forEach((slug) => {
                              if (!customSlugs.has(slug.toLowerCase())) {
                                legacySliceCount++;
                              }
                            });
                          });
                        });
                        if (legacySliceCount === 0) return null;
                        return (
                          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5">
                              <Wand2 className="w-4 h-4 text-purple-400 shrink-0" />
                              <div>
                                <span className="text-purple-200 font-semibold block">
                                  {legacySliceCount} legacy slice mappings found
                                </span>
                                <span className="text-purple-300/80 text-[11px] block mt-0.5">
                                  In v2, standard finishes inherit global master textures. Pruning restores pure master texture inheritance.
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handlePruneLegacyFinishSlices}
                              className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Prune Legacy Slices
                            </button>
                          </div>
                        );
                      })()}

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
                    <Wand2 className="w-3.5 h-3.5" />
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

      {/* Group Display Settings Modal */}
      {editingGroupSetting &&
        createPortal(
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-3xl bg-[#121215] border border-white/15 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Group Display: {editingGroupSetting.groupName}</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Configure how this finish category displays in the storefront configurator.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingGroupSetting(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs">
                {/* Display Style */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
                    Swatch Display Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingGroupSetting({
                          ...editingGroupSetting,
                          setting: { ...editingGroupSetting.setting, display_style: 'cards' },
                        })
                      }
                      className={clsx(
                        'p-3 rounded-xl border text-left flex flex-col gap-1 cursor-pointer transition-all',
                        editingGroupSetting.setting.display_style !== 'compact_dots'
                          ? 'border-amber-400 bg-amber-400/10 text-white shadow-xs'
                          : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-white/20'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">Tactile Cards</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10">1.85:1</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 leading-snug">
                        Wide capsules with texture preview. Best for textured finishes like Carbon, Swarm, Leather.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingGroupSetting({
                          ...editingGroupSetting,
                          setting: { ...editingGroupSetting.setting, display_style: 'compact_dots' },
                        })
                      }
                      className={clsx(
                        'p-3 rounded-xl border text-left flex flex-col gap-1 cursor-pointer transition-all',
                        editingGroupSetting.setting.display_style === 'compact_dots'
                          ? 'border-cyan-400 bg-cyan-400/10 text-white shadow-xs'
                          : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:border-white/20'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">Compact Dots</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10">36px</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 leading-snug">
                        High-density color circles with dynamic header label. Best for Colors and Pastels.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Collapsible / Drawer Accordion */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-medium text-white block">Collapsible Drawer</span>
                    <span className="text-[11px] text-zinc-400 block">
                      Start collapsed with selected finish summary pill; customer taps to expand.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingGroupSetting({
                        ...editingGroupSetting,
                        setting: {
                          ...editingGroupSetting.setting,
                          collapsed_by_default: !editingGroupSetting.setting.collapsed_by_default,
                        },
                      })
                    }
                    className={clsx(
                      'w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0',
                      editingGroupSetting.setting.collapsed_by_default ? 'bg-amber-400' : 'bg-zinc-800'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-4 h-4 rounded-full bg-black absolute top-1 transition-transform',
                        editingGroupSetting.setting.collapsed_by_default ? 'left-6' : 'left-1'
                      )}
                    />
                  </button>
                </div>

                {/* Inline Show More Limit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
                      Visible Items Limit
                    </label>
                    <span className="text-[10px] font-mono text-[#f3aa18]">
                      {(editingGroupSetting.setting.show_more_limit || 0) === 0
                        ? 'Showing All'
                        : `Showing First ${editingGroupSetting.setting.show_more_limit}`}
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { value: 0, label: 'All' },
                      { value: 3, label: '3' },
                      { value: 4, label: '4' },
                      { value: 6, label: '6' },
                      { value: 8, label: '8' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setEditingGroupSetting({
                            ...editingGroupSetting,
                            setting: { ...editingGroupSetting.setting, show_more_limit: opt.value },
                          })
                        }
                        className={clsx(
                          'py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all text-center',
                          (editingGroupSetting.setting.show_more_limit || 0) === opt.value
                            ? 'border-[#f3aa18] bg-[#f3aa18]/15 text-[#f3aa18]'
                            : 'border-white/10 bg-zinc-900 text-zinc-400 hover:text-white hover:border-white/20'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Number Input */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[11px] text-zinc-400 shrink-0 font-medium">Custom Limit:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 3, 5, 10..."
                      value={editingGroupSetting.setting.show_more_limit || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setEditingGroupSetting({
                          ...editingGroupSetting,
                          setting: {
                            ...editingGroupSetting.setting,
                            show_more_limit: isNaN(val) || val <= 0 ? 0 : val,
                          },
                        });
                      }}
                      className="flex-1 bg-zinc-900 border border-white/10 focus:border-[#f3aa18] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors font-mono"
                    />
                    {(editingGroupSetting.setting.show_more_limit || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingGroupSetting({
                            ...editingGroupSetting,
                            setting: { ...editingGroupSetting.setting, show_more_limit: 0 },
                          })
                        }
                        className="text-[11px] text-zinc-500 hover:text-zinc-300 underline cursor-pointer shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] text-zinc-500 block leading-relaxed">
                    Excess swatches are hidden behind an inline "+X more" expander button on the storefront. Enter any custom number or click a preset.
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 flex items-center justify-between bg-zinc-900/50">
                <button
                  type="button"
                  onClick={() => setEditingGroupSetting(null)}
                  disabled={isSavingGroupSettings}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingGroupSettings}
                  onClick={() =>
                    handleSaveGroupSetting(editingGroupSetting.groupName, editingGroupSetting.setting)
                  }
                  className="px-5 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all disabled:opacity-50"
                >
                  {isSavingGroupSettings ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Group Settings</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Bespoke Presets Manager Modal */}
      {showPresetsManagerModal &&
        createPortal(
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-[#121215] border border-white/15 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-heading font-normal tracking-wide text-white flex items-center gap-2">
                      <span>Bespoke Presets (Shop the Look)</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-zinc-300 border border-white/10">
                        {configuratorPresets.length} Active
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Curate multi-layer signature looks and contextual pairing assists for customers.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!editingPreset && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPreset({
                          id: '',
                          title: '',
                          tagline: '',
                          badge: 'POPULAR',
                          coverage: 'model_360',
                          logo_cutout: false,
                          layers: {
                            back: finishes[0]?.slug || 'titanium-plus',
                            camera: finishes[1]?.slug || 'matte-black',
                          },
                          triggers: [finishes[0]?.slug || 'titanium-plus'],
                        })
                      }
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#f3aa18] hover:bg-[#ffb72b] text-black flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Preset</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPreset(null);
                      setShowPresetsManagerModal(false);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4 text-xs">
                {editingPreset ? (
                  /* Edit / Add Preset Form */
                  <div className="space-y-4 p-4 rounded-2xl bg-zinc-950 border border-white/10">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="font-bold text-white text-xs uppercase tracking-wider">
                        {editingPreset.id ? 'Edit Preset' : 'Create New Preset'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingPreset(null)}
                        className="text-zinc-400 hover:text-white text-xs cursor-pointer"
                      >
                        Back to Presets List
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-300 block mb-1">Preset Title</label>
                        <input
                          type="text"
                          placeholder="e.g. The Stealth Bespoke"
                          value={editingPreset.title}
                          onChange={(e) => setEditingPreset({ ...editingPreset, title: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-300 block mb-1">Badge Tag</label>
                        <input
                          type="text"
                          placeholder="e.g. POPULAR, BESPOKE, STAFF PICK"
                          value={editingPreset.badge || ''}
                          onChange={(e) => setEditingPreset({ ...editingPreset, badge: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-zinc-300 block mb-1">Tagline / Subtitle</label>
                      <input
                        type="text"
                        placeholder="e.g. Titanium+ with Matte Black Camera Plateau"
                        value={editingPreset.tagline || ''}
                        onChange={(e) => setEditingPreset({ ...editingPreset, tagline: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Coverage & Cutout Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-300 block mb-1">Coverage</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPreset({ ...editingPreset, coverage: 'model_360' })}
                            className={clsx(
                              'py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors',
                              editingPreset.coverage === 'model_360'
                                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                            )}
                          >
                            Model 360°
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPreset({ ...editingPreset, coverage: 'model_cut' })}
                            className={clsx(
                              'py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors',
                              editingPreset.coverage === 'model_cut'
                                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                            )}
                          >
                            Model Cut
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-zinc-300 block mb-1">Logo Cutout</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPreset({ ...editingPreset, logo_cutout: true })}
                            className={clsx(
                              'py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors',
                              editingPreset.logo_cutout
                                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                            )}
                          >
                            Exposed Logo
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPreset({ ...editingPreset, logo_cutout: false })}
                            className={clsx(
                              'py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors',
                              !editingPreset.logo_cutout
                                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                            )}
                          >
                            Full Coverage
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Layer Finishes Configuration */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
                        Assigned Layer Finishes
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {['back', 'camera', 'frame'].map((layerKey) => (
                          <div key={layerKey} className="space-y-1">
                            <label className="text-[10px] font-mono text-zinc-400 uppercase block">
                              {layerKey} Skin
                            </label>
                            <select
                              value={editingPreset.layers[layerKey] || ''}
                              onChange={(e) =>
                                setEditingPreset({
                                  ...editingPreset,
                                  layers: { ...editingPreset.layers, [layerKey]: e.target.value },
                                })
                              }
                              className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-zinc-900 border border-white/10 text-white focus:outline-none focus:border-amber-400"
                            >
                              <option value="">None (Skip)</option>
                              {finishes.map((f) => (
                                <option key={f.id} value={f.slug || f.id}>
                                  {f.name} ({f.group})
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contextual Pairing Triggers */}
                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider block">
                        Contextual Pairing Triggers
                      </label>
                      <span className="text-[10px] text-zinc-500 block">
                        When customer picks one of these finishes on their Back Skin, this preset will appear as an in-flow match suggestion.
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                        {finishes.map((f) => {
                          const slug = f.slug || f.id;
                          const isTrigger = (editingPreset.triggers || []).includes(slug);
                          return (
                            <button
                              key={slug}
                              type="button"
                              onClick={() => {
                                const current = editingPreset.triggers || [];
                                const next = isTrigger ? current.filter((s) => s !== slug) : [...current, slug];
                                setEditingPreset({ ...editingPreset, triggers: next });
                              }}
                              className={clsx(
                                'px-2 py-1 rounded-lg text-[10px] font-medium border cursor-pointer transition-colors',
                                isTrigger
                                  ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                  : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                              )}
                            >
                              {f.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Save Preset Button */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setEditingPreset(null)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingPresets || !editingPreset.title.trim()}
                        onClick={() => handleSavePreset(editingPreset)}
                        className="px-4 py-1.5 rounded-xl bg-[#f3aa18] hover:bg-[#ffb72b] text-black text-xs font-bold cursor-pointer disabled:opacity-40"
                      >
                        {isSavingPresets ? 'Saving...' : 'Save Preset'}
                      </button>
                    </div>
                  </div>
                ) : configuratorPresets.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-zinc-950/60 border border-white/5 space-y-2">
                    <Compass className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-zinc-400 text-xs">No bespoke presets created yet.</p>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPreset({
                          id: 'stealth-bespoke',
                          title: 'The Stealth Bespoke',
                          tagline: 'Titanium+ with Matte Black Camera Plateau',
                          badge: 'POPULAR',
                          coverage: 'model_360',
                          logo_cutout: false,
                          layers: {
                            back: finishes[0]?.slug || 'titanium-plus',
                            camera: finishes[1]?.slug || 'matte-black',
                          },
                          triggers: [finishes[0]?.slug || 'titanium-plus'],
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-[#f3aa18] text-black font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First Preset</span>
                    </button>
                  </div>
                ) : (
                  /* Presets List */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {configuratorPresets.map((preset) => (
                      <div
                        key={preset.id}
                        className="p-4 rounded-2xl bg-zinc-950 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-3 shadow-md"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              {preset.badge && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-400 text-black uppercase tracking-wider mb-1">
                                  {preset.badge}
                                </span>
                              )}
                              <h4 className="text-xs font-bold text-white">{preset.title}</h4>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5">
                              {preset.coverage === 'model_360' ? '360°' : 'Cut'}
                            </span>
                          </div>
                          {preset.tagline && (
                            <p className="text-[11px] text-zinc-400 leading-snug">{preset.tagline}</p>
                          )}
                        </div>

                        {/* Layer Recipe Chips */}
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
                          {Object.entries(preset.layers || {}).map(([layer, finishSlug]) => (
                            <span
                              key={layer}
                              className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 text-[10px] border border-white/5"
                            >
                              <strong className="capitalize text-zinc-400">{layer}:</strong> {finishSlug}
                            </span>
                          ))}
                        </div>

                        {/* Contextual Triggers */}
                        {preset.triggers && preset.triggers.length > 0 && (
                          <div className="text-[10px] text-zinc-500 font-mono">
                            Triggers on: {preset.triggers.join(', ')}
                          </div>
                        )}

                        {/* Card Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => setEditingPreset(preset)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Edit preset"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePreset(preset.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Per-Device Preset Add/Edit Modal */}
      {editingDevicePreset && editingProfile &&
        createPortal(
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-zinc-900/60">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-heading font-normal tracking-wider uppercase text-white">
                    {editingDevicePreset.isNew ? 'Add Curated Look' : 'Edit Curated Look'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDevicePreset(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* Quick capture button */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[11px] text-purple-300">
                    Quick fill from current visual simulator:
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureFromSimulator}
                    className="px-2.5 py-1 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Use Canvas Look</span>
                  </button>
                </div>

                {/* Title & Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-300">Look Title *</label>
                    <input
                      type="text"
                      value={editingDevicePreset.title}
                      onChange={(e) =>
                        setEditingDevicePreset({ ...editingDevicePreset, title: e.target.value })
                      }
                      placeholder="e.g. Shadow Hex"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:border-[#f3aa18] outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-300">Badge</label>
                    <select
                      value={editingDevicePreset.badge}
                      onChange={(e) =>
                        setEditingDevicePreset({
                          ...editingDevicePreset,
                          badge: e.target.value as 'POPULAR' | 'STAFF PICK' | '',
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:border-[#f3aa18] outline-none"
                    >
                      <option value="">None</option>
                      <option value="POPULAR">POPULAR</option>
                      <option value="STAFF PICK">STAFF PICK</option>
                    </select>
                  </div>
                </div>

                {/* Coverage & Logo Cutout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-300">Coverage</label>
                    <select
                      value={editingDevicePreset.coverage}
                      onChange={(e) =>
                        setEditingDevicePreset({
                          ...editingDevicePreset,
                          coverage: e.target.value as 'model_360' | 'model_cut',
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:border-[#f3aa18] outline-none"
                    >
                      <option value="model_360">Model 360°</option>
                      <option value="model_cut">Model Cut</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-zinc-300">Logo Cutout</label>
                    <select
                      value={editingDevicePreset.logo_cutout ? 'yes' : 'no'}
                      onChange={(e) =>
                        setEditingDevicePreset({
                          ...editingDevicePreset,
                          logo_cutout: e.target.value === 'yes',
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:border-[#f3aa18] outline-none"
                    >
                      <option value="yes">With Logo Cutout</option>
                      <option value="no">No Logo Cutout</option>
                    </select>
                  </div>
                </div>

                {/* Per-Layer Finishes */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-zinc-300">
                    Layer Finishes for this Look
                  </label>
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2.5 max-h-52 overflow-y-auto">
                    {activeSkinLayers.map((layer) => {
                      const currentSlug = editingDevicePreset.layers[layer.id] || '';
                      return (
                        <div
                          key={layer.id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="font-medium text-zinc-300 truncate max-w-[140px]">
                            {layer.name}
                          </span>
                          <select
                            value={currentSlug}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingDevicePreset({
                                ...editingDevicePreset,
                                layers: {
                                  ...editingDevicePreset.layers,
                                  [layer.id]: val,
                                },
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-white/10 text-white text-[11px] focus:border-[#f3aa18] outline-none max-w-[200px]"
                          >
                            <option value="">(None / unassigned)</option>
                            {finishes.map((f) => (
                              <option key={f.id} value={f.slug || f.id}>
                                {f.name} ({f.group})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Preview Image URL */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-zinc-300">
                    Custom Preview Image URL (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingDevicePreset.image_url || ''}
                      onChange={(e) =>
                        setEditingDevicePreset({
                          ...editingDevicePreset,
                          image_url: e.target.value,
                        })
                      }
                      placeholder="https://exacoat.com/.../look-preview.png"
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:border-[#f3aa18] outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMediaPickerConfig({
                          isOpen: true,
                          title: 'Select Look Preview Image',
                          recommendedDimensions: '1000x1000 PNG / WebP',
                          currentUrl: editingDevicePreset.image_url || '',
                          onSelect: (url) => {
                            setEditingDevicePreset((prev) =>
                              prev ? { ...prev, image_url: url } : null
                            );
                          },
                        });
                      }}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer shrink-0"
                    >
                      Browse
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    If omitted, storefront renders live canvas visual preview card automatically.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2 bg-zinc-900/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingDevicePreset(null)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDevicePreset}
                  className="px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-black font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  Save Look
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Transfer Setup & Portable JSON Modal */}
      {showTransferModal && editingProfile &&
        createPortal(
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-3xl rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-zinc-900/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-['Chakra_Petch'] font-semibold tracking-wide text-white flex items-center gap-2">
                      Transfer Setup & JSON
                      <span className="text-[11px] font-sans font-normal text-zinc-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                        {editingProfile.device_name}
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Share visual setups between device models or import and export portable JSON profiles.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Switcher */}
              <div className="flex border-b border-white/10 bg-zinc-900/40 px-6 pt-2 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTransferTab('copy_to')}
                  className={clsx(
                    "px-3.5 py-2 text-xs font-['Chakra_Petch'] font-medium rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 cursor-pointer",
                    transferTab === 'copy_to'
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Copy To Device</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferTab('copy_from')}
                  className={clsx(
                    "px-3.5 py-2 text-xs font-['Chakra_Petch'] font-medium rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 cursor-pointer",
                    transferTab === 'copy_from'
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Copy From Device</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferTab('export_json')}
                  className={clsx(
                    "px-3.5 py-2 text-xs font-['Chakra_Petch'] font-medium rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 cursor-pointer",
                    transferTab === 'export_json'
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferTab('import_json')}
                  className={clsx(
                    "px-3.5 py-2 text-xs font-['Chakra_Petch'] font-medium rounded-t-lg transition-colors flex items-center gap-1.5 border-b-2 cursor-pointer",
                    transferTab === 'import_json'
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import JSON</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                {/* TAB 1: COPY TO ANOTHER DEVICE */}
                {transferTab === 'copy_to' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>Source: {editingProfile.device_name} (#{editingProfile.product_id})</span>
                      </div>
                      <p className="text-[11px] text-zinc-300">
                        Select a target device to receive this configurator setup ({editingProfile.views?.length || 0} views, {editingProfile.layers?.length || 0} layers, {editingProfile.presets?.length || 0} looks). The target device's unique Product ID, Name, Slug, Base Price, Currency, and Categories are strictly preserved.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                        <span>Select Target Device:</span>
                        <span className="text-zinc-500">
                          {profiles.filter((p) => p.product_id !== editingProfile.product_id && (!targetSearchQuery.trim() || p.name.toLowerCase().includes(targetSearchQuery.toLowerCase()) || p.slug.toLowerCase().includes(targetSearchQuery.toLowerCase()) || String(p.product_id).includes(targetSearchQuery))).length} devices available
                        </span>
                      </label>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={targetSearchQuery}
                          onChange={(e) => setTargetSearchQuery(e.target.value)}
                          placeholder="Search target device by name, slug, or ID (e.g. Galaxy S26+)..."
                          className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:border-cyan-400 outline-none"
                        />
                        {targetSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setTargetSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Selectable Target Products List */}
                      <div className="p-1 rounded-xl bg-zinc-900/80 border border-white/10 max-h-56 overflow-y-auto space-y-1">
                        {profiles
                          .filter((p) => {
                            if (p.product_id === editingProfile.product_id) return false;
                            if (!targetSearchQuery.trim()) return true;
                            const q = targetSearchQuery.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(q) ||
                              p.slug.toLowerCase().includes(q) ||
                              String(p.product_id).includes(q) ||
                              p.categories?.some((c) => c.toLowerCase().includes(q))
                            );
                          })
                          .slice(0, 100)
                          .map((p) => {
                            const isSelected = targetCopyProductId === p.product_id;
                            return (
                              <button
                                key={p.product_id}
                                type="button"
                                onClick={() => setTargetCopyProductId(p.product_id)}
                                className={clsx(
                                  'w-full px-3 py-2 rounded-lg text-left transition-all flex items-center justify-between gap-3 cursor-pointer',
                                  isSelected
                                    ? 'bg-cyan-500/20 border border-cyan-400/60 text-white shadow-xs'
                                    : 'hover:bg-white/5 border border-transparent text-zinc-300'
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={clsx('font-medium text-xs truncate', isSelected ? 'text-cyan-200' : 'text-zinc-200')}>
                                      {p.name}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-400 shrink-0 font-mono">
                                      #{p.product_id}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-0.5">
                                    <span>{p.categories?.[0] || 'Uncategorized'}</span>
                                    <span>•</span>
                                    <span>{p.layers_count || 0} layers</span>
                                    <span>•</span>
                                    <span>{p.views_count || 0} views</span>
                                    {p.is_configurator && (
                                      <>
                                        <span>•</span>
                                        <span className="text-emerald-400">Configurator</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  <div className={clsx(
                                    'w-4 h-4 rounded-full border flex items-center justify-center transition-colors',
                                    isSelected ? 'border-cyan-400 bg-cyan-500 text-black' : 'border-zinc-600'
                                  )}>
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Scope Options */}
                    <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/10 space-y-2.5">
                      <span className="text-[11px] font-semibold text-zinc-300">Elements to Copy:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyOptions.copyViews}
                            onChange={(e) => setCopyOptions({ ...copyOptions, copyViews: e.target.checked })}
                            className="rounded border-zinc-700 text-cyan-500 focus:ring-0"
                          />
                          <span>Views, 3D Shadows & Lighting</span>
                        </label>
                        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyOptions.copyLayers}
                            onChange={(e) => setCopyOptions({ ...copyOptions, copyLayers: e.target.checked })}
                            className="rounded border-zinc-700 text-cyan-500 focus:ring-0"
                          />
                          <span>Skin Layers & Cutout Options</span>
                        </label>
                        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyOptions.copyPresets}
                            onChange={(e) => setCopyOptions({ ...copyOptions, copyPresets: e.target.checked })}
                            className="rounded border-zinc-700 text-cyan-500 focus:ring-0"
                          />
                          <span>Curated Looks ("Shop the Look")</span>
                        </label>
                        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyOptions.copyFamilySettings}
                            onChange={(e) => setCopyOptions({ ...copyOptions, copyFamilySettings: e.target.checked })}
                            className="rounded border-zinc-700 text-cyan-500 focus:ring-0"
                          />
                          <span>Family & Multiplier ({editingProfile.family}, {editingProfile.size_multiplier}x)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: COPY FROM TEMPLATE DEVICE */}
                {transferTab === 'copy_from' && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Active Editor: {editingProfile.device_name} (#{editingProfile.product_id})</span>
                      </div>
                      <p className="text-[11px] text-zinc-300">
                        Adopt an existing device's configurator views, layers, and presets into this editor session. The current device identity (ID, Name, Slug, Price) will not change. You can preview immediately and click "Save Configurator" when ready.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                        <span>Select Source Template Device:</span>
                        <span className="text-zinc-500">
                          {profiles.filter((p) => p.product_id !== editingProfile.product_id && (p.layers_count > 0 || p.views_count > 0) && (!sourceSearchQuery.trim() || p.name.toLowerCase().includes(sourceSearchQuery.toLowerCase()) || p.slug.toLowerCase().includes(sourceSearchQuery.toLowerCase()) || String(p.product_id).includes(sourceSearchQuery))).length} configured devices
                        </span>
                      </label>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={sourceSearchQuery}
                          onChange={(e) => setSourceSearchQuery(e.target.value)}
                          placeholder="Search source template device (e.g. Galaxy S26)..."
                          className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:border-amber-400 outline-none"
                        />
                        {sourceSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSourceSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Selectable Source Products List */}
                      <div className="p-1 rounded-xl bg-zinc-900/80 border border-white/10 max-h-56 overflow-y-auto space-y-1">
                        {profiles
                          .filter((p) => {
                            if (p.product_id === editingProfile.product_id) return false;
                            if (!sourceSearchQuery.trim()) return true;
                            const q = sourceSearchQuery.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(q) ||
                              p.slug.toLowerCase().includes(q) ||
                              String(p.product_id).includes(q) ||
                              p.categories?.some((c) => c.toLowerCase().includes(q))
                            );
                          })
                          .sort((a, b) => (b.layers_count || 0) - (a.layers_count || 0))
                          .slice(0, 100)
                          .map((p) => {
                            const isSelected = sourceCopyProductId === p.product_id;
                            return (
                              <button
                                key={p.product_id}
                                type="button"
                                onClick={() => setSourceCopyProductId(p.product_id)}
                                className={clsx(
                                  'w-full px-3 py-2 rounded-lg text-left transition-all flex items-center justify-between gap-3 cursor-pointer',
                                  isSelected
                                    ? 'bg-amber-500/20 border border-amber-400/60 text-white shadow-xs'
                                    : 'hover:bg-white/5 border border-transparent text-zinc-300'
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={clsx('font-medium text-xs truncate', isSelected ? 'text-amber-200' : 'text-zinc-200')}>
                                      {p.name}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-400 shrink-0 font-mono">
                                      #{p.product_id}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-0.5">
                                    <span>{p.categories?.[0] || 'Uncategorized'}</span>
                                    <span>•</span>
                                    <span className="text-amber-300 font-medium">{p.layers_count || 0} layers</span>
                                    <span>•</span>
                                    <span className="text-amber-300 font-medium">{p.views_count || 0} views</span>
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  <div className={clsx(
                                    'w-4 h-4 rounded-full border flex items-center justify-center transition-colors',
                                    isSelected ? 'border-amber-400 bg-amber-500 text-black' : 'border-zinc-600'
                                  )}>
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Scope Options */}
                    <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/10 space-y-2.5">
                      <span className="text-[11px] font-semibold text-zinc-300">Elements to Adopt:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyOptions.copyViews}
                            onChange={(e) => setCopyOptions({ ...copyOptions, copyViews: e.target.checked })}
                            className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                          />
                          <span>Views, 3D Shadows & Lighting</span>
                        </label>
                        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyOptions.copyLayers}
                            onChange={(e) => setCopyOptions({ ...copyOptions, copyLayers: e.target.checked })}
                            className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                          />
                          <span>Skin Layers & Cutout Options</span>
                        </label>
                        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyOptions.copyPresets}
                            onChange={(e) => setCopyOptions({ ...copyOptions, copyPresets: e.target.checked })}
                            className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                          />
                          <span>Curated Looks ("Shop the Look")</span>
                        </label>
                        <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={copyOptions.copyFamilySettings}
                            onChange={(e) => setCopyOptions({ ...copyOptions, copyFamilySettings: e.target.checked })}
                            className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                          />
                          <span>Family & Multiplier</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: EXPORT JSON */}
                {transferTab === 'export_json' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-zinc-400">
                        Export the complete profile JSON for <strong className="text-white">{editingProfile.device_name}</strong>. Portable across staging, production, or local backups.
                      </p>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md shrink-0">
                        {editingProfile.views?.length || 0} views • {editingProfile.layers?.length || 0} layers
                      </span>
                    </div>

                    <textarea
                      readOnly
                      value={JSON.stringify(editingProfile, null, 2)}
                      rows={12}
                      className="w-full font-mono text-[11px] p-3 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 outline-none select-all focus:border-cyan-400/50"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleExportJsonClipboard}
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {transferCopiedStatus ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">Copied to Clipboard</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy to Clipboard</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportJsonDownload}
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Download JSON File</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 4: IMPORT JSON */}
                {transferTab === 'import_json' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 text-zinc-300 space-y-1">
                      <p className="text-[11px]">
                        Upload a <code className="text-cyan-300">.json</code> profile file or paste JSON below to load it directly into this studio session.
                      </p>
                    </div>

                    {/* File Upload Input */}
                    <div className="flex items-center gap-3">
                      <label className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Choose JSON File</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const content = ev.target?.result as string;
                                if (content) {
                                  setImportJsonText(content);
                                  showToast('info', 'File Loaded', `Loaded ${file.name} (${Math.round(content.length / 1024)} KB)`);
                                }
                              };
                              reader.readAsText(file);
                            }
                          }}
                        />
                      </label>
                      <span className="text-[11px] text-zinc-500">or paste JSON directly below:</span>
                    </div>

                    <textarea
                      value={importJsonText}
                      onChange={(e) => setImportJsonText(e.target.value)}
                      placeholder="Paste device configurator profile JSON here..."
                      rows={10}
                      className="w-full font-mono text-[11px] p-3 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 outline-none focus:border-cyan-400/50"
                    />

                    {/* Metadata Preservation Toggle */}
                    <label className="flex items-center gap-2 text-zinc-300 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={importPreserveTargetMeta}
                        onChange={(e) => setImportPreserveTargetMeta(e.target.checked)}
                        className="rounded border-zinc-700 text-cyan-500 focus:ring-0"
                      />
                      <span className="text-[11px]">
                        Preserve current device identity (Keep Product ID #{editingProfile.product_id}, Name "{editingProfile.device_name}", Slug, Base Price, and Categories)
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between gap-3 bg-zinc-900/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div>
                  {transferTab === 'copy_to' && (
                    <button
                      type="button"
                      onClick={handleExecuteCopyTo}
                      disabled={!targetCopyProductId || isTransferringSetup}
                      className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isTransferringSetup ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving to Target Device...</span>
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Apply & Save to Target Device</span>
                        </>
                      )}
                    </button>
                  )}

                  {transferTab === 'copy_from' && (
                    <button
                      type="button"
                      onClick={handleExecuteCopyFrom}
                      disabled={!sourceCopyProductId || isTransferringSetup}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isTransferringSetup ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Loading Template...</span>
                        </>
                      ) : (
                        <>
                          <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Load Template into Editor</span>
                        </>
                      )}
                    </button>
                  )}

                  {transferTab === 'import_json' && (
                    <button
                      type="button"
                      onClick={() => handleExecuteImportJson(importJsonText)}
                      disabled={!importJsonText.trim()}
                      className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Apply JSON to Editor</span>
                    </button>
                  )}

                  {transferTab === 'export_json' && (
                    <button
                      type="button"
                      onClick={() => setShowTransferModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  )}
                </div>
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
