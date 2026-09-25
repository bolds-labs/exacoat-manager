import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import {
  ShopeeListingItem,
  ShopeeInjectImagesResult,
  fetchShopeeProductPreviewDirect,
  uploadShopeeMediaImageDirect,
  injectShopeeProductImagesDirect,
  fetchConfiguratorProfilesDirect,
  fetchProductConfiguratorProfileDirect,
  fetchGlobalFinishesDirect,
  getSavedMarketplaceDeviceSettings,
  saveMarketplaceDeviceSettingsDirect,
  DEFAULT_GLOBAL_FINISHES,
  GlobalFinish,
  ShopeeProductPreview,
} from '../../lib/wordpressBridge';
import type { DeviceConfiguratorProfile, ConfiguratorProfileSummary } from '../../types';
import {
  MarketplaceImageConfig,
  DEFAULT_FEATURE_CARDS_OFFICIAL,
  generateMarketplaceImageBlob,
  renderMarketplaceImageToCanvas,
  formatDeviceHeadline,
} from '../../lib/marketplaceCanvasRenderer';
import { useToast } from '../../context/ToastContext';
import {
  Upload,
  Check,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
  ShieldCheck,
  ExternalLink,
  Image as ImageIcon,
  SlidersHorizontal,
  Eye,
  CheckSquare,
  Square,
  Smartphone,
  ChevronDown,
  Save,
  Star,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShopeeImageInjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShopeeListingItem | null;
  onSuccess?: (result: ShopeeInjectImagesResult) => void;
}

interface DetectedVariantOption {
  option: string;
  matchedFinish?: GlobalFinish;
  selected: boolean;
  currentImageId?: string;
  currentImageUrl?: string;
}

const STORAGE_CUSTOM_BG_KEY = 'exacoat_marketplace_custom_bg';
const STORAGE_BG_TYPE_KEY = 'exacoat_marketplace_bg_type';
const DEFAULT_MARKETPLACE_BG_URL =
  'https://staging.exacoat.com/wp-content/uploads/Marketplace-Product-Background-Plain.png';

export const ShopeeImageInjectorModal: React.FC<ShopeeImageInjectorModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess,
}) => {
  const { showToast } = useToast();

  // Data Loading State
  const [isLoadingInitialData, setIsLoadingInitialData] = useState<boolean>(false);
  const [productPreview, setProductPreview] = useState<ShopeeProductPreview | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<ConfiguratorProfileSummary[]>([]);
  const [allFinishes, setAllFinishes] = useState<GlobalFinish[]>(DEFAULT_GLOBAL_FINISHES);

  // Selected Configurator Profile & Full Specs
  const [selectedProfileId, setSelectedProfileId] = useState<number | string>('');
  const [deviceProfile, setDeviceProfile] = useState<DeviceConfiguratorProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [profileSearchQuery, setProfileSearchQuery] = useState<string>('');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState<boolean>(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Configuration Settings
  const [coverage, setCoverage] = useState<'model_cut' | 'model_360'>('model_cut');
  const [logoCutout, setLogoCutout] = useState<boolean>(true);
  const [pencilCutout, setPencilCutout] = useState<boolean>(true);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [activeColorId, setActiveColorId] = useState<string>('');
  const [activeLayerIds, setActiveLayerIds] = useState<string[]>([]);

  // Per-Device Cover & Variant Position State (Synced with Marketplace Image Generator)
  const [coverScale, setCoverScale] = useState<number>(1.0);
  const [coverOffsetX, setCoverOffsetX] = useState<number>(0);
  const [coverOffsetY, setCoverOffsetY] = useState<number>(110);

  const [variantScale, setVariantScale] = useState<number>(0.75);
  const [variantOffsetX, setVariantOffsetX] = useState<number>(0);
  const [variantOffsetY, setVariantOffsetY] = useState<number>(80);

  const [hasSavedDevicePosition, setHasSavedDevicePosition] = useState<boolean>(false);
  const [isSavingDevicePosition, setIsSavingDevicePosition] = useState<boolean>(false);

  const [bgType, setBgType] = useState<'studio_light' | 'custom'>(() => {
    try {
      const savedType = localStorage.getItem(STORAGE_BG_TYPE_KEY);
      if (savedType === 'studio_light' || savedType === 'custom') return savedType;
    } catch {}
    return 'custom';
  });
  const [customBgUrl, setCustomBgUrl] = useState<string>(() => {
    try {
      const savedBg = localStorage.getItem(STORAGE_CUSTOM_BG_KEY);
      if (savedBg && savedBg.trim()) return savedBg.trim();
    } catch {}
    return DEFAULT_MARKETPLACE_BG_URL;
  });

  // Cover Image Settings
  const [updateCover, setUpdateCover] = useState<boolean>(true);
  const [coverFinishId, setCoverFinishId] = useState<string>('swarm');
  const [topRightBadgeText, setTopRightBadgeText] = useState<string>('20+ SKINS SELECTION');
  const [headlineText, setHeadlineText] = useState<string>('');
  const [subBadgeText, setSubBadgeText] = useState<string>('Model Cut');

  // Variant Images Settings
  const [updateVariants, setUpdateVariants] = useState<boolean>(true);
  const [detectedVariants, setDetectedVariants] = useState<DetectedVariantOption[]>([]);

  // Preview State
  const [activePreviewType, setActivePreviewType] = useState<'cover' | 'variant'>('cover');
  const [previewFinishId, setPreviewFinishId] = useState<string>('swarm');
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState<boolean>(false);

  // Injection Execution State
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [injectionProgress, setInjectionProgress] = useState<{
    current: number;
    total: number;
    stage: string;
    details: string;
  } | null>(null);
  const [injectionResult, setInjectionResult] = useState<ShopeeInjectImagesResult | null>(null);
  const [injectionError, setInjectionError] = useState<string | null>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Helper to extract device name from title
  const extractDeviceNameFromTitle = (title: string): string => {
    if (!title) return '';
    return title
      .replace(/^\[EXACOAT\]\s*/i, '')
      .replace(/^EXACOAT\s*-\s*/i, '')
      .replace(/\s*Premium\s*3M\s*Skin.*$/i, '')
      .replace(/\s*Garskin.*$/i, '')
      .replace(/\s*-\s*Model.*$/i, '')
      .trim();
  };

  // Helper to find closest matching configurator profile
  const findMatchingProfile = (
    parsedName: string,
    profilesList: ConfiguratorProfileSummary[]
  ): ConfiguratorProfileSummary | undefined => {
    if (!parsedName || profilesList.length === 0) return undefined;
    const cleanQuery = parsedName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Exact match on clean name
    const exact = profilesList.find((p) => {
      const pClean = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return pClean === cleanQuery || pClean === `${cleanQuery}skins`;
    });
    if (exact) return exact;

    // 2. Contains match
    const contains = profilesList.find((p) => {
      const pClean = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return pClean.includes(cleanQuery) || cleanQuery.includes(pClean.replace('skins', ''));
    });
    if (contains) return contains;

    // 3. Fallback: match tokens (e.g. "iphone", "18", "pro", "max")
    const queryTokens = parsedName.toLowerCase().split(/\s+/).filter(Boolean);
    let bestMatch: ConfiguratorProfileSummary | undefined;
    let maxMatchCount = 0;

    for (const p of profilesList) {
      const pLower = p.name.toLowerCase();
      const matchCount = queryTokens.filter((token) => pLower.includes(token)).length;
      if (matchCount > maxMatchCount && matchCount >= 2) {
        maxMatchCount = matchCount;
        bestMatch = p;
      }
    }
    return bestMatch;
  };

  // Fetch full profile details whenever selectedProfileId changes and restore saved per-device positions
  const loadFullProfile = useCallback(async (profileId: number | string) => {
    if (!profileId) return;
    setIsLoadingProfile(true);
    try {
      const res = await fetchProductConfiguratorProfileDirect(profileId);
      if (res.success && res.profile) {
        const prof = res.profile;
        setDeviceProfile(prof);

        const savedMp = getSavedMarketplaceDeviceSettings(prof);
        setHasSavedDevicePosition(Boolean(savedMp));

        const isLaptop = prof.family === 'laptop';
        setCoverScale(savedMp?.cover_scale ?? 1.0);
        setCoverOffsetX(savedMp?.cover_offset_x ?? (isLaptop ? 140 : 0));
        setCoverOffsetY(savedMp?.cover_offset_y ?? (isLaptop ? -55 : 110));

        setVariantScale(savedMp?.variant_scale ?? 0.75);
        setVariantOffsetX(savedMp?.variant_offset_x ?? (isLaptop ? 140 : 0));
        setVariantOffsetY(savedMp?.variant_offset_y ?? (isLaptop ? -20 : 80));

        if (savedMp?.headline_text && savedMp.headline_text.trim()) {
          setHeadlineText(savedMp.headline_text);
        } else if (prof.device_name) {
          setHeadlineText(formatDeviceHeadline(prof.device_name));
        }

        if (savedMp?.primary_skin_id) {
          setCoverFinishId(savedMp.primary_skin_id);
        }
        if (savedMp?.primary_top_right_text) {
          setTopRightBadgeText(savedMp.primary_top_right_text);
        }

        const defView =
          (savedMp?.selected_view_id && prof.views?.find((v) => v.id === savedMp.selected_view_id)) ||
          prof.views?.find((v) => v.is_default) ||
          prof.views?.[0];
        setSelectedViewId(defView ? defView.id : '');

        if (prof.device_colors && prof.device_colors.length > 0) {
          const matchedCol =
            savedMp?.active_color_id && prof.device_colors.find((c) => c.id === savedMp.active_color_id);
          setActiveColorId(matchedCol ? matchedCol.id : prof.device_colors[0].id);
        } else {
          setActiveColorId('');
        }

        if (savedMp?.logo_cutout !== undefined) {
          setLogoCutout(savedMp.logo_cutout);
        }
        if (savedMp?.pencil_cutout !== undefined) {
          setPencilCutout(savedMp.pencil_cutout);
        }

        const genuineLayers = (prof.layers || []).filter((l) => {
          if (l.is_non_visual) return false;
          const n = (l.name || '').toLowerCase().trim();
          const id = (l.id || '').toLowerCase().trim();
          if (n === 'device' || id === 'device') return false;
          if (n.includes('device-body') || n.includes('device_body') || n.includes('device body')) return false;
          if (n.includes('chassis') || n.includes('hardware')) return false;
          return true;
        });

        if (
          Array.isArray(savedMp?.active_layer_ids) &&
          savedMp.active_layer_ids.length > 0 &&
          genuineLayers.some((gl) => savedMp.active_layer_ids!.includes(gl.id))
        ) {
          setActiveLayerIds(
            savedMp.active_layer_ids.filter((lid) => genuineLayers.some((gl) => gl.id === lid))
          );
        } else if (genuineLayers.length > 0) {
          setActiveLayerIds([genuineLayers[0].id]);
        } else {
          setActiveLayerIds([]);
        }
      } else {
        showToast('error', 'Profile Load Error', res.error || 'Failed to load device profile details');
      }
    } catch (err: any) {
      showToast('error', 'Profile Load Error', err.message || 'Network error loading profile');
    } finally {
      setIsLoadingProfile(false);
    }
  }, [showToast]);

  // Load initial product preview and profiles upon opening modal
  useEffect(() => {
    if (!isOpen || !item) {
      // Reset state on close
      setProductPreview(null);
      setDeviceProfile(null);
      setSelectedProfileId('');
      setDetectedVariants([]);
      setInjectionResult(null);
      setInjectionError(null);
      setInjectionProgress(null);
      return;
    }

    let isMounted = true;
    setIsLoadingInitialData(true);
    setInjectionResult(null);
    setInjectionError(null);

    try {
      const savedBg = localStorage.getItem(STORAGE_CUSTOM_BG_KEY);
      const savedType = localStorage.getItem(STORAGE_BG_TYPE_KEY);
      if (savedBg && savedBg.trim()) {
        setCustomBgUrl(savedBg.trim());
      } else {
        setCustomBgUrl(DEFAULT_MARKETPLACE_BG_URL);
      }
      if (savedType === 'studio_light' || savedType === 'custom') {
        setBgType(savedType);
      } else {
        setBgType('custom');
      }
    } catch {}

    const initData = async () => {
      try {
        const [previewRes, profilesRes, finishesRes] = await Promise.all([
          fetchShopeeProductPreviewDirect(item.item_id),
          fetchConfiguratorProfilesDirect({ per_page: 500, only_configurable: false }),
          fetchGlobalFinishesDirect(),
        ]);

        if (!isMounted) return;

        const loadedFinishes =
          finishesRes.success && finishesRes.finishes.length > 0
            ? finishesRes.finishes
            : DEFAULT_GLOBAL_FINISHES;
        setAllFinishes(loadedFinishes);

        const loadedProfiles = profilesRes.success ? profilesRes.profiles : [];
        setAvailableProfiles(loadedProfiles);

        if (previewRes.success) {
          setProductPreview(previewRes);

          // Detect coverage from listing title
          const title = (previewRes.item_name || item.item_name || '').toLowerCase();
          const detectedCoverage = title.includes('360') ? 'model_360' : 'model_cut';
          setCoverage(detectedCoverage);
          setSubBadgeText(detectedCoverage === 'model_360' ? 'Model 360' : 'Model Cut');

          // Parse device name & format default headline
          const parsedDeviceName = extractDeviceNameFromTitle(previewRes.item_name || item.item_name);
          setHeadlineText(formatDeviceHeadline(parsedDeviceName || 'iPhone 18 Pro Max'));

          // Find closest configurator profile
          const matchedProfile = findMatchingProfile(parsedDeviceName, loadedProfiles);
          if (matchedProfile) {
            const profileKey = matchedProfile.product_id || matchedProfile.slug;
            setSelectedProfileId(profileKey);
            loadFullProfile(profileKey);
          } else if (loadedProfiles.length > 0) {
            const fallbackKey = loadedProfiles[0].product_id || loadedProfiles[0].slug;
            setSelectedProfileId(fallbackKey);
            loadFullProfile(fallbackKey);
          }

          // Process and match variants from tier_variation
          const tier0 = previewRes.tier_variation && previewRes.tier_variation[0];
          const rawOptions = (tier0 as any)?.options || (tier0 as any)?.option_list || [];
          if (Array.isArray(rawOptions) && rawOptions.length > 0) {
            const mapped: DetectedVariantOption[] = rawOptions.map((opt: any) => {
              const optName: string = typeof opt === 'string' ? opt : (opt.option || opt.name || '');
              const cleanOptName = optName.toLowerCase().trim();

              // Match against global finishes
              const matchedFinish = loadedFinishes.find((f) => {
                const fName = f.name.toLowerCase().trim();
                const fSlug = (f.slug || '').toLowerCase().trim();
                return fName === cleanOptName || fSlug === cleanOptName;
              });

              return {
                option: optName,
                matchedFinish,
                selected: Boolean(matchedFinish),
                currentImageId: typeof opt !== 'string' ? (opt.image?.image_id || opt.image_id) : undefined,
                currentImageUrl: typeof opt !== 'string' ? (opt.image?.image_url || opt.image_url) : undefined,
              };
            });
            setDetectedVariants(mapped);
          }
        } else {
          showToast('error', 'Preview Failed', previewRes.error || 'Could not fetch Shopee listing details');
        }
      } catch (err: any) {
        if (isMounted) {
          showToast('error', 'Failed to load product', err.message || 'Network error');
        }
      } finally {
        if (isMounted) {
          setIsLoadingInitialData(false);
        }
      }
    };

    initData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, item, loadFullProfile, showToast]);

  // Adjust subBadgeText when coverage changes
  const handleCoverageChange = (newCoverage: 'model_cut' | 'model_360') => {
    setCoverage(newCoverage);
    setSubBadgeText(newCoverage === 'model_360' ? 'Model 360' : 'Model Cut');
  };

  // Toggle selection of variant options
  const handleToggleVariant = (optName: string) => {
    setDetectedVariants((prev) =>
      prev.map((v) => (v.option === optName ? { ...v, selected: !v.selected } : v))
    );
  };

  const handleSelectAllVariants = (select: boolean) => {
    setDetectedVariants((prev) => prev.map((v) => ({ ...v, selected: select })));
  };

  // Save current Cover & Variant positions to the matched device profile
  const handleSaveDevicePosition = async () => {
    if (!deviceProfile) return;
    setIsSavingDevicePosition(true);
    try {
      const res = await saveMarketplaceDeviceSettingsDirect(deviceProfile, {
        cover_scale: coverScale,
        cover_offset_x: coverOffsetX,
        cover_offset_y: coverOffsetY,
        variant_scale: variantScale,
        variant_offset_x: variantOffsetX,
        variant_offset_y: variantOffsetY,
        headline_text: headlineText.trim(),
        primary_skin_id: coverFinishId || 'swarm',
        primary_top_right_text: topRightBadgeText || '20+ SKINS SELECTION',
        selected_view_id: selectedViewId,
        active_color_id: activeColorId,
        active_layer_ids: activeLayerIds,
        logo_cutout: logoCutout,
        pencil_cutout: pencilCutout,
      });
      if (res.success) {
        setHasSavedDevicePosition(true);
        showToast(
          'success',
          'Position Saved to Product',
          `Saved Cover & Variant positions for ${deviceProfile.device_name}.`
        );
      } else {
        showToast('error', 'Save Failed', res.error || 'Could not save position settings');
      }
    } catch (err: any) {
      showToast('error', 'Save Failed', err.message || 'Could not save position settings');
    } finally {
      setIsSavingDevicePosition(false);
    }
  };

  // Build active render configuration for canvas
  const buildRenderConfig = useCallback(
    (targetMode: 'cover' | 'variant', finishId: string): MarketplaceImageConfig | null => {
      if (!deviceProfile) return null;

      const activeFinish =
        allFinishes.find((f) => f.id === finishId || f.slug === finishId) || allFinishes[0];

      return {
        profile: deviceProfile,
        activeFinish,
        allFinishes,
        activeColorId: activeColorId || undefined,
        selectedViewId: selectedViewId || undefined,
        activeLayerIds: activeLayerIds.length > 0 ? activeLayerIds : undefined,
        bgType,
        customBgUrl: customBgUrl.trim() || DEFAULT_MARKETPLACE_BG_URL,
        showLogo: true,
        showBrandTagline: true,
        brandTagline: '#1 Brand Skin di Indonesia',
        isPrimaryImage: targetMode === 'cover',
        topRightText:
          targetMode === 'cover'
            ? topRightBadgeText.trim().toUpperCase()
            : activeFinish.name.toUpperCase(),
        subBadgeText,
        headlineText: headlineText.trim(),
        headlineFont: 'Chakra Petch',
        headlineHighlightColor: '#d2d2d2',
        featureCards: DEFAULT_FEATURE_CARDS_OFFICIAL,
        marketplaceChannel: 'shopee',
        variantLeftCards: {
          showOriginal3M: true,
          showMaterialOrigin: true,
          showWarranty: true,
          showTexturePhoto: true,
          texturePhotoUrl: '/assets/brand/textured-skins-product-info.jpg',
          warrantyTitle: 'Installation Warranty',
        },
        showSkinsStack: false,
        skinsCountText: '20+',
        skinsLabelText: 'SKINS',
        swatchFinishSlugs: [],
        layoutMode: targetMode,
        coverage,
        logoCutout,
        pencilCutout,
        deviceScale: targetMode === 'cover' ? coverScale : variantScale,
        deviceOffsetX: targetMode === 'cover' ? coverOffsetX : variantOffsetX,
        deviceOffsetY: targetMode === 'cover' ? coverOffsetY : variantOffsetY,
      };
    },
    [
      deviceProfile,
      allFinishes,
      activeColorId,
      selectedViewId,
      activeLayerIds,
      bgType,
      customBgUrl,
      topRightBadgeText,
      subBadgeText,
      headlineText,
      coverage,
      logoCutout,
      pencilCutout,
      coverScale,
      coverOffsetX,
      coverOffsetY,
      variantScale,
      variantOffsetX,
      variantOffsetY,
    ]
  );

  // Render Preview on Canvas whenever settings change
  useEffect(() => {
    if (!isOpen || !deviceProfile || !previewCanvasRef.current) return;

    let isCancelled = false;
    setIsRenderingPreview(true);

    const finishId = activePreviewType === 'cover' ? coverFinishId : previewFinishId;
    const config = buildRenderConfig(activePreviewType, finishId);

    if (!config) {
      setIsRenderingPreview(false);
      return;
    }

    renderMarketplaceImageToCanvas(previewCanvasRef.current, config)
      .catch((err) => {
        if (!isCancelled) {
          console.error('[Shopee Image Injector] Preview render failed:', err);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsRenderingPreview(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    isOpen,
    deviceProfile,
    activePreviewType,
    coverFinishId,
    previewFinishId,
    buildRenderConfig,
  ]);

  // Execute Complete Image Injection Pipeline
  const handleStartInjection = async () => {
    if (!item || !deviceProfile) {
      showToast('error', 'Device Profile Missing', 'Please select a valid device profile first.');
      return;
    }

    if (!updateCover && !updateVariants) {
      showToast('warning', 'Nothing Selected', 'Please enable either Primary Cover or Variant Options.');
      return;
    }

    const selectedVariantsList = detectedVariants.filter((v) => v.selected && v.matchedFinish);
    if (updateVariants && selectedVariantsList.length === 0) {
      showToast('warning', 'No Variants Selected', 'Please select at least 1 variant to inject.');
      return;
    }

    setIsInjecting(true);
    setInjectionError(null);
    setInjectionResult(null);

    const totalSteps =
      (updateCover ? 1 : 0) + (updateVariants ? selectedVariantsList.length : 0) + 1;
    let completedSteps = 0;

    let uploadedCoverImageId: string | undefined = undefined;
    const uploadedVariantImages: Array<{ option: string; image_id: string }> = [];

    try {
      // Step 1: Render and Upload Primary Cover
      if (updateCover) {
        completedSteps++;
        setInjectionProgress({
          current: completedSteps,
          total: totalSteps,
          stage: 'Primary Cover Image',
          details: `Rendering 1500x1500px cover with ${coverFinishId}...`,
        });

        const coverConfig = buildRenderConfig('cover', coverFinishId);
        if (!coverConfig) throw new Error('Failed to generate cover image configuration.');

        const coverBlob = await generateMarketplaceImageBlob(coverConfig);
        const coverFile = new File(
          [coverBlob],
          `${deviceProfile.device_slug || 'device'}-shopee-cover.jpg`,
          { type: 'image/jpeg' }
        );

        setInjectionProgress({
          current: completedSteps,
          total: totalSteps,
          stage: 'Primary Cover Image',
          details: 'Uploading cover image to Shopee Media Space...',
        });

        const uploadCoverRes = await uploadShopeeMediaImageDirect({
          file: coverFile,
          filename: `${deviceProfile.device_slug || 'device'}-cover.jpg`,
        });

        if (!uploadCoverRes.success || !uploadCoverRes.image_id) {
          throw new Error(
            uploadCoverRes.error || 'Failed to upload primary cover image to Shopee Media Space.'
          );
        }

        uploadedCoverImageId = uploadCoverRes.image_id;
      }

      // Step 2: Render and Upload Each Selected Variant
      if (updateVariants) {
        for (let idx = 0; idx < selectedVariantsList.length; idx++) {
          const v = selectedVariantsList[idx];
          completedSteps++;

          setInjectionProgress({
            current: completedSteps,
            total: totalSteps,
            stage: `Variant ${idx + 1} of ${selectedVariantsList.length}`,
            details: `Rendering & uploading ${v.option}...`,
          });

          const variantFinish = v.matchedFinish || allFinishes[0];
          const variantConfig = buildRenderConfig('variant', variantFinish.id);
          if (!variantConfig) continue;

          const variantBlob = await generateMarketplaceImageBlob(variantConfig);
          const slug = variantFinish.slug || variantFinish.id || `variant-${idx + 1}`;
          const variantFile = new File([variantBlob], `shopee-variant-${slug}.jpg`, {
            type: 'image/jpeg',
          });

          const uploadVarRes = await uploadShopeeMediaImageDirect({
            file: variantFile,
            filename: `shopee-variant-${slug}.jpg`,
          });

          if (uploadVarRes.success && uploadVarRes.image_id) {
            uploadedVariantImages.push({
              option: v.option,
              image_id: uploadVarRes.image_id,
            });
          } else {
            console.warn(`[Shopee Injection] Variant upload failed for ${v.option}:`, uploadVarRes.error);
          }
        }
      }

      // Step 3: Inject Images into Shopee Listing (Non-Destructive)
      completedSteps++;
      setInjectionProgress({
        current: completedSteps,
        total: totalSteps,
        stage: 'Finalizing Injection',
        details: 'Updating Shopee product listing with preserved gallery images...',
      });

      const injectRes = await injectShopeeProductImagesDirect({
        item_id: item.item_id,
        cover_image_id: uploadedCoverImageId,
        variant_images: uploadedVariantImages,
      });

      if (injectRes.success) {
        setInjectionResult(injectRes);
        showToast('success', 'Injection Complete', injectRes.message || 'Images injected successfully.');
        if (onSuccess) {
          onSuccess(injectRes);
        }
      } else {
        setInjectionError(injectRes.error || injectRes.message || 'Shopee rejected image injection.');
        showToast('error', 'Injection Failed', injectRes.error || 'Failed to update Shopee listing.');
      }
    } catch (err: any) {
      console.error('[Shopee Injection] Pipeline error:', err);
      setInjectionError(err.message || 'An unexpected error occurred during image injection.');
      showToast('error', 'Injection Error', err.message || 'Failed to complete image injection.');
    } finally {
      setIsInjecting(false);
      setInjectionProgress(null);
    }
  };

  const selectedVariantsCount = detectedVariants.filter((v) => v.selected).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="6xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#f3aa18]/20 border border-[#f3aa18]/30 flex items-center justify-center text-[#f3aa18]">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">Auto-Inject Images into Shopee</h2>
            <p className="text-xs text-zinc-400">
              Safe & non-destructive: updates primary cover and variant photos while preserving all gallery images.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Loading Initial Data State */}
        {isLoadingInitialData && (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin text-[#f3aa18]" />
            <p className="text-xs font-medium">Fetching Shopee listing & configurator specs...</p>
          </div>
        )}

        {!isLoadingInitialData && (
          <>
            {/* Non-Destructive Guarantee Banner */}
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-200 text-xs flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <p className="font-semibold text-blue-300">Strict Non-Destructive Guarantee</p>
                <p className="text-[11px] text-blue-200/90 leading-relaxed">
                  Only the primary cover image (photo #1) and variation option images will be injected.
                  Your 8 existing gallery photos (installation guides, packaging, spec cards) are preserved and will not be touched or reordered.
                </p>
              </div>
            </div>

            {/* Target Product Summary Bar */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30">
                      ID: {item?.item_id}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Status: {productPreview?.item_status || item?.item_status || 'NORMAL'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100 line-clamp-1">
                    {productPreview?.item_name || item?.item_name}
                  </h3>
                </div>

                {(productPreview?.seller_centre_url || item?.seller_centre_url) && (
                  <a
                    href={productPreview?.seller_centre_url || item?.seller_centre_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Seller Centre</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Existing Photos Strip */}
              {productPreview?.images && productPreview.images.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <div className="text-[11px] font-medium text-zinc-400 mb-2 flex items-center justify-between">
                    <span>Current Shopee Photos ({productPreview.images.length})</span>
                    <span className="text-[10px] text-zinc-500">
                      Photo #1 will be replaced; photos #2–#{productPreview.images.length} preserved
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {productPreview.images.map((img, idx) => (
                      <div
                        key={img.image_id || idx}
                        className={clsx(
                          'w-14 h-14 rounded-lg overflow-hidden shrink-0 relative border',
                          idx === 0
                            ? 'border-amber-500/80 ring-2 ring-amber-500/30'
                            : 'border-zinc-700/60'
                        )}
                      >
                        <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                        <div
                          className={clsx(
                            'absolute inset-x-0 bottom-0 text-[8px] text-center py-0.5 font-bold',
                            idx === 0 ? 'bg-amber-500 text-zinc-950' : 'bg-black/70 text-zinc-300'
                          )}
                        >
                          {idx === 0 ? 'Primary' : `#${idx + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Configuration Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                {/* 1. Device Profile Selector */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#f3aa18]" />
                      <span>Configurator Profile</span>
                    </label>
                    {deviceProfile && (
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {deviceProfile.layers?.length || 0} Layers Active
                      </span>
                    )}
                  </div>

                  <div className="relative" ref={profileDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 hover:border-zinc-600 text-left text-xs text-zinc-100 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="truncate">
                        {deviceProfile ? (
                          <span className="font-semibold text-zinc-100">
                            {deviceProfile.device_name || 'Selected Profile'}
                          </span>
                        ) : (
                          <span className="text-zinc-500">Select a device profile...</span>
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0 ml-2" />
                    </button>

                    {isProfileDropdownOpen && (
                      <div className="absolute z-30 inset-x-0 top-full mt-1.5 rounded-xl bg-zinc-950 border border-zinc-700 shadow-2xl p-2 space-y-2">
                        <input
                          type="text"
                          value={profileSearchQuery}
                          onChange={(e) => setProfileSearchQuery(e.target.value)}
                          placeholder="Search device profile..."
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                          autoFocus
                        />
                        <div className="max-h-52 overflow-y-auto space-y-1">
                          {availableProfiles
                            .filter((p) =>
                              p.name.toLowerCase().includes(profileSearchQuery.toLowerCase())
                            )
                            .map((p) => (
                              <button
                                key={p.product_id || p.slug}
                                type="button"
                                onClick={() => {
                                  const id = p.product_id || p.slug;
                                  setSelectedProfileId(id);
                                  loadFullProfile(id);
                                  setIsProfileDropdownOpen(false);
                                }}
                                className={clsx(
                                  'w-full text-left px-3 py-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-between',
                                  String(selectedProfileId) === String(p.product_id || p.slug)
                                    ? 'bg-[#f3aa18] text-zinc-950 font-bold'
                                    : 'text-zinc-300 hover:bg-zinc-800'
                                )}
                              >
                                <span className="truncate">{p.name}</span>
                                {p.family && (
                                  <span className="text-[10px] opacity-75 font-mono ml-2">
                                    {p.family}
                                  </span>
                                )}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Coverage & Cutout Options */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                  <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#f3aa18]" />
                    <span>Coverage & Cutout Options</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                        Coverage Mode
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => handleCoverageChange('model_cut')}
                          className={clsx(
                            'min-h-[44px] py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer text-center',
                            coverage === 'model_cut'
                              ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                              : 'text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          Model Cut
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCoverageChange('model_360')}
                          className={clsx(
                            'min-h-[44px] py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer text-center',
                            coverage === 'model_360'
                              ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                              : 'text-zinc-400 hover:text-zinc-200'
                          )}
                        >
                          Model 360
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                        Apple Logo Cutout
                      </label>
                      <button
                        type="button"
                        onClick={() => setLogoCutout(!logoCutout)}
                        className={clsx(
                          'w-full min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-between transition cursor-pointer',
                          logoCutout
                            ? 'bg-[#f3aa18]/15 border-[#f3aa18]/40 text-[#f3aa18]'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <span>Logo Cutout</span>
                        {logoCutout ? (
                          <CheckSquare className="w-4 h-4 text-[#f3aa18]" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Per-Device Cover & Variant Position Controls (Synced with Marketplace Image Generator) */}
                  <div className="pt-3 border-t border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-200">
                          Device & Variant Position
                        </span>
                        {hasSavedDevicePosition && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400">
                            <Check className="w-3 h-3" />
                            Synced from Product
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveDevicePosition}
                        disabled={!deviceProfile || isSavingDevicePosition}
                        className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 rounded-lg bg-[#f3aa18]/15 hover:bg-[#f3aa18]/25 border border-[#f3aa18]/40 text-[#f3aa18] text-[11px] font-bold transition disabled:opacity-50"
                      >
                        {isSavingDevicePosition ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        <span>{isSavingDevicePosition ? 'Saving...' : 'Save Position to Product'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setActivePreviewType('cover')}
                        className={clsx(
                          'flex flex-col items-start px-3 py-2 rounded-lg text-left transition',
                          activePreviewType === 'cover'
                            ? 'bg-[#f3aa18]/20 border border-[#f3aa18] text-[#f3aa18]'
                            : 'border border-transparent text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-bold">
                          <Star className="w-3 h-3 shrink-0" />
                          <span>Featured Cover</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-80 mt-0.5">
                          {Math.round(coverScale * 100)}% • X:{coverOffsetX} Y:{coverOffsetY}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActivePreviewType('variant')}
                        className={clsx(
                          'flex flex-col items-start px-3 py-2 rounded-lg text-left transition',
                          activePreviewType === 'variant'
                            ? 'bg-[#f3aa18]/20 border border-[#f3aa18] text-[#f3aa18]'
                            : 'border border-transparent text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-bold">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>Variants Position</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-80 mt-0.5">
                          {Math.round(variantScale * 100)}% • X:{variantOffsetX} Y:{variantOffsetY}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-400">
                          <span>{activePreviewType === 'cover' ? 'Cover Zoom' : 'Variant Zoom'}</span>
                          <span className="font-mono text-zinc-200">
                            {Math.round((activePreviewType === 'cover' ? coverScale : variantScale) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="1.8"
                          step="0.02"
                          value={activePreviewType === 'cover' ? coverScale : variantScale}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (activePreviewType === 'cover') setCoverScale(val);
                            else setVariantScale(val);
                          }}
                          className="w-full accent-[#f3aa18]"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-400">
                          <span>Horizontal X</span>
                          <span className="font-mono text-zinc-200">
                            {activePreviewType === 'cover' ? coverOffsetX : variantOffsetX}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-400"
                          max="400"
                          step="5"
                          value={activePreviewType === 'cover' ? coverOffsetX : variantOffsetX}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (activePreviewType === 'cover') setCoverOffsetX(val);
                            else setVariantOffsetX(val);
                          }}
                          className="w-full accent-[#f3aa18]"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-zinc-400">
                          <span>Vertical Y</span>
                          <span className="font-mono text-zinc-200">
                            {activePreviewType === 'cover' ? coverOffsetY : variantOffsetY}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-400"
                          max="400"
                          step="5"
                          value={activePreviewType === 'cover' ? coverOffsetY : variantOffsetY}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (activePreviewType === 'cover') setCoverOffsetY(val);
                            else setVariantOffsetY(val);
                          }}
                          className="w-full accent-[#f3aa18]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Primary Cover Photo Settings */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateCover}
                        onChange={(e) => setUpdateCover(e.target.checked)}
                        className="rounded border-zinc-700 text-[#f3aa18] focus:ring-[#f3aa18]"
                      />
                      <span>Inject Primary Cover Photo</span>
                    </label>
                    <span className="text-[10px] text-zinc-400 font-mono">1500x1500px Square</span>
                  </div>

                  {updateCover && (
                    <div className="space-y-3 pt-2 border-t border-zinc-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                            Cover Skin Texture
                          </label>
                          <select
                            value={coverFinishId}
                            onChange={(e) => setCoverFinishId(e.target.value)}
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-[#f3aa18]"
                          >
                            {allFinishes.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} {f.group ? `(${f.group})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                            Top-Right Badge
                          </label>
                          <input
                            type="text"
                            value={topRightBadgeText}
                            onChange={(e) => setTopRightBadgeText(e.target.value)}
                            placeholder="20+ SKINS SELECTION"
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-[#f3aa18]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                            Headline Title (Supports Multi-line)
                          </label>
                          <textarea
                            rows={2}
                            value={headlineText}
                            onChange={(e) => setHeadlineText(e.target.value)}
                            placeholder="iPhone 18&#10;Pro Max"
                            className="w-full min-h-[56px] px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-[#f3aa18] resize-none leading-snug"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                            Sub-Badge Text
                          </label>
                          <input
                            type="text"
                            value={subBadgeText}
                            onChange={(e) => setSubBadgeText(e.target.value)}
                            placeholder="Model Cut"
                            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-[#f3aa18]"
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] font-medium text-zinc-400">
                            Background Style
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBgType('custom');
                                try {
                                  localStorage.setItem(STORAGE_BG_TYPE_KEY, 'custom');
                                } catch {}
                              }}
                              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                bgType === 'custom'
                                  ? 'bg-[#f3aa18]/15 border border-[#f3aa18] text-[#f3aa18]'
                                  : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              Plain / Custom URL
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBgType('studio_light');
                                try {
                                  localStorage.setItem(STORAGE_BG_TYPE_KEY, 'studio_light');
                                } catch {}
                              }}
                              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                bgType === 'studio_light'
                                  ? 'bg-[#f3aa18]/15 border border-[#f3aa18] text-[#f3aa18]'
                                  : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              Studio Pattern
                            </button>
                          </div>
                        </div>

                        {bgType === 'custom' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={customBgUrl}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCustomBgUrl(val);
                                try {
                                  localStorage.setItem(STORAGE_CUSTOM_BG_KEY, val);
                                } catch {}
                              }}
                              placeholder={DEFAULT_MARKETPLACE_BG_URL}
                              className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-[11px] text-zinc-300 font-mono focus:outline-none focus:border-[#f3aa18]"
                            />
                            {customBgUrl !== DEFAULT_MARKETPLACE_BG_URL && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomBgUrl(DEFAULT_MARKETPLACE_BG_URL);
                                  try {
                                    localStorage.setItem(
                                      STORAGE_CUSTOM_BG_KEY,
                                      DEFAULT_MARKETPLACE_BG_URL
                                    );
                                  } catch {}
                                }}
                                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-200 transition-colors shrink-0"
                              >
                                Reset Plain BG
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Variant Options List & Selection */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateVariants}
                        onChange={(e) => setUpdateVariants(e.target.checked)}
                        className="rounded border-zinc-700 text-[#f3aa18] focus:ring-[#f3aa18]"
                      />
                      <span>Inject Variant Option Photos</span>
                    </label>

                    {updateVariants && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectAllVariants(true)}
                          className="text-[11px] text-[#f3aa18] hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-zinc-600">•</span>
                        <button
                          type="button"
                          onClick={() => handleSelectAllVariants(false)}
                          className="text-[11px] text-zinc-400 hover:underline cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    )}
                  </div>

                  {updateVariants && (
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>
                          {selectedVariantsCount} of {detectedVariants.length} variants selected
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Click row to select/deselect; preview in canvas on right
                        </span>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {detectedVariants.map((v) => {
                          const isMatched = Boolean(v.matchedFinish);
                          return (
                            <div
                              key={v.option}
                              className={clsx(
                                'px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition cursor-pointer select-none',
                                v.selected
                                  ? 'bg-zinc-950 border-[#f3aa18]/40 text-zinc-100'
                                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-500'
                              )}
                              onClick={() => handleToggleVariant(v.option)}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleVariant(v.option);
                                  }}
                                  className="text-zinc-400 hover:text-zinc-200"
                                >
                                  {v.selected ? (
                                    <CheckSquare className="w-4 h-4 text-[#f3aa18]" />
                                  ) : (
                                    <Square className="w-4 h-4 text-zinc-600" />
                                  )}
                                </button>

                                {v.matchedFinish && (
                                  <div
                                    className="w-4 h-4 rounded-full border border-black/40 shrink-0"
                                    style={{
                                      backgroundColor: v.matchedFinish.color_hex || '#333',
                                      backgroundImage: v.matchedFinish.thumbnail
                                        ? `url(${v.matchedFinish.thumbnail})`
                                        : undefined,
                                      backgroundSize: 'cover',
                                    }}
                                  />
                                )}

                                <span className="font-medium truncate">{v.option}</span>

                                {!isMatched && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                    No direct finish match
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isMatched && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActivePreviewType('variant');
                                      setPreviewFinishId(v.matchedFinish!.id);
                                    }}
                                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                                    title="Preview this variant on canvas"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Preview</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live 1500x1500px Canvas Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#f3aa18]" />
                      <span>Live Render Preview</span>
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setActivePreviewType('cover')}
                        className={clsx(
                          'px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer',
                          activePreviewType === 'cover'
                            ? 'bg-[#f3aa18] text-zinc-950 font-bold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        Cover
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePreviewType('variant')}
                        className={clsx(
                          'px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer',
                          activePreviewType === 'variant'
                            ? 'bg-[#f3aa18] text-zinc-950 font-bold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        Variant
                      </button>
                    </div>
                  </div>

                  {/* Canvas Container */}
                  <div className="aspect-square w-full rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden relative shadow-inner flex items-center justify-center">
                    <canvas
                      ref={previewCanvasRef}
                      width={1500}
                      height={1500}
                      className="w-full h-full object-contain"
                    />

                    {isRenderingPreview && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-zinc-300 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#f3aa18]" />
                        <span>Rendering preview...</span>
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-[11px] text-zinc-400">
                      Previewing:{' '}
                      <span className="font-semibold text-zinc-200">
                        {activePreviewType === 'cover' ? 'Primary Listing Cover' : `Variant: ${previewFinishId}`}
                      </span>{' '}
                      ({coverage === 'model_360' ? 'Model 360' : 'Model Cut'})
                    </p>
                  </div>
                </div>

                {/* Progress Card during Injection */}
                {isInjecting && injectionProgress && (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-[#f3aa18]/40 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-[#f3aa18] flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {injectionProgress.stage}
                      </span>
                      <span className="font-mono text-zinc-300">
                        {Math.round((injectionProgress.current / injectionProgress.total) * 100)}%
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-[#f3aa18] transition-all duration-200"
                        style={{
                          width: `${(injectionProgress.current / injectionProgress.total) * 100}%`,
                        }}
                      />
                    </div>

                    <p className="text-[11px] text-zinc-400 truncate">
                      {injectionProgress.details}
                    </p>
                  </div>
                )}

                {/* Error Banner */}
                {injectionError && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-200">
                      <AlertCircle className="w-4 h-4" />
                      <span>Injection Failed</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-300/90">{injectionError}</p>
                  </div>
                )}

                {/* Success Banner */}
                {injectionResult && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-emerald-200">Image Injection Complete</p>
                        <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                          Primary cover updated: {injectionResult.cover_updated ? 'Yes' : 'No'}.
                          Gallery preserved: {injectionResult.gallery_preserved_count} photos kept intact.
                          Variant photos updated: {injectionResult.variants_updated}.
                        </p>
                      </div>
                    </div>

                    {injectionResult.seller_centre_url && (
                      <a
                        href={injectionResult.seller_centre_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] w-full px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View Listing in Shopee Seller Centre</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Action Controls */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleStartInjection}
                    disabled={isInjecting || isLoadingInitialData || !deviceProfile}
                    className={clsx(
                      'w-full min-h-[44px] px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md',
                      isInjecting || !deviceProfile
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-[#f3aa18] hover:bg-[#e09b15] text-zinc-950'
                    )}
                  >
                    {isInjecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Injecting Images into Shopee...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>
                          Start Auto-Injection ({updateCover ? 1 : 0} Cover + {updateVariants ? selectedVariantsCount : 0} Variants)
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isInjecting}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition cursor-pointer"
                  >
                    {injectionResult ? 'Done & Close' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
