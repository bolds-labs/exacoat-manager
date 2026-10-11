import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import {
  ShopeeListingItem,
  TikTokListingItem,
  ShopeeInjectImagesResult,
  ShopeeInjectVariantPlanItem,
  fetchShopeeProductPreviewDirect,
  uploadShopeeMediaImageDirect,
  injectShopeeProductImagesDirect,
  fetchTikTokProductPreviewDirect,
  uploadTikTokMediaImageDirect,
  injectTikTokProductImagesDirect,
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
  filterGenuineSkinLayers,
  isBaseSkinLayer,
  getDefaultBaseSkinLayerIds,
  resolveInitialActiveLayerIds,
} from '../../lib/marketplaceCanvasRenderer';
import { useToast } from '../../context/ToastContext';
import {
  Upload,
  Check,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
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
  Plus,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  Trash2,
  Coins,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShopeeImageInjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShopeeListingItem | null;
  tiktokItem?: TikTokListingItem | null;
  channel?: 'shopee' | 'tiktok';
  onSuccess?: (result: ShopeeInjectImagesResult) => void;
}

interface DetectedVariantOption {
  option: string;
  matchedFinish?: GlobalFinish;
  selected: boolean;
  currentImageId?: string;
  currentImageUrl?: string;
  price: number;
  originalPrice?: number;
  isNew?: boolean;
  oldIndex?: number;
  modelId?: number | string;
}

type VariantInsertPlacement = 'after_signature' | 'top' | 'bottom';

const STORAGE_CUSTOM_BG_KEY = 'exacoat_marketplace_custom_bg';
const STORAGE_BG_TYPE_KEY = 'exacoat_marketplace_bg_type';
const DEFAULT_MARKETPLACE_BG_URL =
  'https://media.exacoat.com/wp-content/uploads/Marketplace-Product-Background-Plain.png';

function matchFinishByNameOrSlug(optName: string, finishes: GlobalFinish[]): GlobalFinish | undefined {
  const clean = optName.toLowerCase().trim();
  if (!clean) return undefined;
  const normalizedPlus = clean.replace(/\+/g, '-plus').replace(/\s+/g, '-');
  return finishes.find((f) => {
    const fName = f.name.toLowerCase().trim();
    const fSlug = (f.slug || '').toLowerCase().trim();
    const fId = (f.id || '').toLowerCase().trim();
    return (
      fName === clean ||
      fSlug === clean ||
      fId === clean ||
      fSlug === normalizedPlus ||
      fId === normalizedPlus
    );
  });
}

export const ShopeeImageInjectorModal: React.FC<ShopeeImageInjectorModalProps> = ({
  isOpen,
  onClose,
  item,
  tiktokItem = null,
  channel,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const activeChannel: 'shopee' | 'tiktok' =
    channel || (tiktokItem && !item ? 'tiktok' : 'shopee');
  const isTikTok = activeChannel === 'tiktok';
  const channelLabel = isTikTok ? 'TikTok Shop' : 'Shopee';

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

  // Variant Images, Ordering, & Pricing Settings (Default false = Cover Image Only mode)
  const [updateVariants, setUpdateVariants] = useState<boolean>(false);
  const [detectedVariants, setDetectedVariants] = useState<DetectedVariantOption[]>([]);
  const [standardBasePrice, setStandardBasePrice] = useState<number>(149000);
  const [insertPlacement, setInsertPlacement] = useState<VariantInsertPlacement>('after_signature');
  const [customVariantName, setCustomVariantName] = useState<string>('');
  const [customVariantPrice, setCustomVariantPrice] = useState<string>('');

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

        const resolvedLayerIds = resolveInitialActiveLayerIds(
          prof.layers || [],
          savedMp?.active_layer_ids
        );
        setActiveLayerIds(resolvedLayerIds);
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
    if (!isOpen || (!item && !tiktokItem)) {
      // Reset state on close
      setProductPreview(null);
      setDeviceProfile(null);
      setSelectedProfileId('');
      setDetectedVariants([]);
      setCustomVariantName('');
      setCustomVariantPrice('');
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
        const previewPromise =
          isTikTok && tiktokItem
            ? fetchTikTokProductPreviewDirect(tiktokItem.id)
            : fetchShopeeProductPreviewDirect(item!.item_id);

        const [previewRes, profilesRes, finishesRes] = await Promise.all([
          previewPromise,
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

        const fallbackListingName = isTikTok
          ? tiktokItem?.title || ''
          : item?.item_name || '';

        const effectivePreview: ShopeeProductPreview | null = previewRes.success
          ? previewRes
          : isTikTok && tiktokItem
          ? {
              success: true,
              item_id: Number(tiktokItem.id) || 0,
              item_name: tiktokItem.title,
              description: '',
              category_id: 0,
              item_status: tiktokItem.status || 'ACTIVATE',
              weight: 0.05,
              images: (tiktokItem.main_images || []).map((url, idx) => ({
                image_id: String(idx),
                image_url: url,
              })),
              tier_variation: [],
              models: [],
              seller_centre_url: `https://seller-id.tiktok.com/product/edit/${tiktokItem.id}`,
            }
          : null;

        if (effectivePreview) {
          setProductPreview(effectivePreview);

          // Detect coverage from listing title
          const title = (effectivePreview.item_name || fallbackListingName).toLowerCase();
          const detectedCoverage = title.includes('360') ? 'model_360' : 'model_cut';
          setCoverage(detectedCoverage);
          setSubBadgeText(detectedCoverage === 'model_360' ? 'Model 360' : 'Model Cut');

          // Parse device name & format default headline
          const parsedDeviceName = extractDeviceNameFromTitle(
            effectivePreview.item_name || fallbackListingName
          );
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

          // Process and match variants from tier_variation + models
          const tier0 = effectivePreview.tier_variation && effectivePreview.tier_variation[0];
          const rawOptions = (tier0 as any)?.options || (tier0 as any)?.option_list || [];
          const previewModels = Array.isArray(effectivePreview.models)
            ? effectivePreview.models
            : [];

          if (Array.isArray(rawOptions) && rawOptions.length > 0) {
            const standardPrices: number[] = [];
            const allModelPrices: number[] = [];

            const prelim = rawOptions.map((opt: any, idx: number) => {
              const optName: string = typeof opt === 'string' ? opt : (opt.option || opt.name || '');
              const matchedFinish = matchFinishByNameOrSlug(optName, loadedFinishes);
              const matchedModel = previewModels.find(
                (m) => Array.isArray(m.tier_index) && Number(m.tier_index[0]) === idx
              );
              const modelPrice = Number(
                matchedModel?.original_price || matchedModel?.current_price || 0
              );

              if (modelPrice > 0) {
                allModelPrices.push(modelPrice);
                const finishExtra = Number(matchedFinish?.extra_price || 0);
                if (finishExtra === 0) {
                  standardPrices.push(modelPrice);
                }
              }

              return {
                opt,
                idx,
                optName,
                matchedFinish,
                matchedModel,
                modelPrice,
              };
            });

            // Auto-detect Standard Base Price (most common standard finish price, or minimum model price)
            let detectedBase = detectedCoverage === 'model_360' ? 189000 : 149000;
            if (standardPrices.length > 0) {
              const freq = new Map<number, number>();
              let bestCount = 0;
              for (const p of standardPrices) {
                const c = (freq.get(p) || 0) + 1;
                freq.set(p, c);
                if (c > bestCount) {
                  bestCount = c;
                  detectedBase = p;
                }
              }
            } else if (allModelPrices.length > 0) {
              detectedBase = Math.min(...allModelPrices);
            }
            setStandardBasePrice(detectedBase);

            const mapped: DetectedVariantOption[] = prelim.map(
              ({ opt, idx, optName, matchedFinish, matchedModel, modelPrice }) => {
                const finishExtra = Number(matchedFinish?.extra_price || 0);
                const resolvedPrice =
                  modelPrice > 0 ? modelPrice : detectedBase + finishExtra;

                return {
                  option: optName,
                  matchedFinish,
                  selected: Boolean(matchedFinish),
                  currentImageId:
                    typeof opt !== 'string' ? (opt.image?.image_id || opt.image_id) : undefined,
                  currentImageUrl:
                    typeof opt !== 'string' ? (opt.image?.image_url || opt.image_url) : undefined,
                  price: resolvedPrice,
                  originalPrice: modelPrice > 0 ? modelPrice : undefined,
                  isNew: false,
                  oldIndex: idx,
                  modelId: matchedModel?.model_id,
                };
              }
            );
            setDetectedVariants(mapped);
          }
        } else {
          showToast(
            'error',
            'Preview Failed',
            previewRes.error || `Could not fetch ${channelLabel} listing details`
          );
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
  }, [isOpen, item, tiktokItem, isTikTok, channelLabel, loadFullProfile, showToast]);

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

  // Compute active Global Finishes that are NOT yet on this Shopee listing
  const missingFinishes = useMemo(() => {
    const existingSet = new Set(
      detectedVariants.map((v) => v.option.toLowerCase().trim())
    );
    const existingSlugSet = new Set(
      detectedVariants
        .map((v) => v.matchedFinish?.slug?.toLowerCase().trim())
        .filter(Boolean) as string[]
    );

    return allFinishes
      .filter((f) => {
        if (f.is_active === false) return false;
        // Skip "Everything" bundle skin unless user adds it manually
        if (f.slug === 'everything' || f.id === 'everything') return false;
        const fName = f.name.toLowerCase().trim();
        const fSlug = (f.slug || '').toLowerCase().trim();
        return !existingSet.has(fName) && !existingSlugSet.has(fSlug);
      })
      .sort((a, b) => {
        const extraA = Number(a.extra_price || 0);
        const extraB = Number(b.extra_price || 0);
        if (extraA !== extraB) return extraB - extraA;
        return a.name.localeCompare(b.name);
      });
  }, [allFinishes, detectedVariants]);

  // Helper to compute insertion index inside detectedVariants based on insertPlacement
  const resolveInsertIndex = (
    list: DetectedVariantOption[],
    placement: VariantInsertPlacement
  ): number => {
    if (placement === 'top') return 0;
    if (placement === 'bottom') return list.length;

    // 'after_signature': insert right after the last Signature/Limited/Surcharge variant
    let lastSignatureIdx = -1;
    for (let i = 0; i < list.length; i++) {
      const f = list[i].matchedFinish;
      const isSpecial =
        Number(f?.extra_price || 0) > 0 ||
        Boolean(f?.group && /signature|limited/i.test(f.group)) ||
        (list[i].price > standardBasePrice && standardBasePrice > 0);
      if (isSpecial) {
        lastSignatureIdx = i;
      }
    }
    return lastSignatureIdx >= 0 ? lastSignatureIdx + 1 : 0;
  };

  // Add a Global Finish as a new Shopee variant option
  const handleAddFinishVariant = (finish: GlobalFinish) => {
    const extra = Number(finish.extra_price || 0);
    const calculatedPrice = standardBasePrice + extra;

    setDetectedVariants((prev) => {
      if (prev.some((v) => v.option.toLowerCase().trim() === finish.name.toLowerCase().trim())) {
        return prev;
      }
      const newEntry: DetectedVariantOption = {
        option: finish.name,
        matchedFinish: finish,
        selected: true,
        price: calculatedPrice,
        isNew: true,
      };
      const targetIdx = resolveInsertIndex(prev, insertPlacement);
      const next = [...prev];
      next.splice(targetIdx, 0, newEntry);
      return next;
    });

    setActivePreviewType('variant');
    setPreviewFinishId(finish.id);
    showToast(
      'success',
      `Added ${finish.name}`,
      `Queued at Rp ${calculatedPrice.toLocaleString('id-ID')} (initial stock: 100).`
    );
  };

  // Add all missing Signature / Limited finishes (extra_price > 0) in one click
  const handleAddAllMissingSpecialFinishes = () => {
    const specials = missingFinishes.filter((f) => Number(f.extra_price || 0) > 0);
    if (specials.length === 0) return;

    setDetectedVariants((prev) => {
      let next = [...prev];
      let insertIdx = resolveInsertIndex(next, insertPlacement);

      for (const finish of specials) {
        if (next.some((v) => v.option.toLowerCase().trim() === finish.name.toLowerCase().trim())) {
          continue;
        }
        const extra = Number(finish.extra_price || 0);
        const newEntry: DetectedVariantOption = {
          option: finish.name,
          matchedFinish: finish,
          selected: true,
          price: standardBasePrice + extra,
          isNew: true,
        };
        next.splice(insertIdx, 0, newEntry);
        insertIdx++;
      }
      return next;
    });

    showToast(
      'success',
      `Added ${specials.length} Special Finishes`,
      `Added ${specials.map((s) => s.name).join(', ')} with automatic surcharge pricing.`
    );
  };

  // Add a custom variant name
  const handleAddCustomVariant = () => {
    const trimmed = customVariantName.trim();
    if (!trimmed) {
      showToast('warning', 'Variant Name Required', 'Enter a variant option name first.');
      return;
    }
    if (detectedVariants.some((v) => v.option.toLowerCase().trim() === trimmed.toLowerCase())) {
      showToast('warning', 'Duplicate Variant', `"${trimmed}" already exists in the variant list.`);
      return;
    }

    const matchedFinish = matchFinishByNameOrSlug(trimmed, allFinishes);
    const finishExtra = Number(matchedFinish?.extra_price || 0);
    const parsedCustomPrice = Number(customVariantPrice.replace(/[^0-9]/g, ''));
    const finalPrice =
      parsedCustomPrice > 0 ? parsedCustomPrice : standardBasePrice + finishExtra;

    setDetectedVariants((prev) => {
      const newEntry: DetectedVariantOption = {
        option: trimmed,
        matchedFinish,
        selected: Boolean(matchedFinish),
        price: finalPrice,
        isNew: true,
      };
      const targetIdx = resolveInsertIndex(prev, insertPlacement);
      const next = [...prev];
      next.splice(targetIdx, 0, newEntry);
      return next;
    });

    setCustomVariantName('');
    setCustomVariantPrice('');
    showToast('success', `Added "${trimmed}"`, `Price set to Rp ${finalPrice.toLocaleString('id-ID')}.`);
  };

  // Reorder variant in list
  const handleMoveVariant = (index: number, direction: 'up' | 'down' | 'top') => {
    setDetectedVariants((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const targetIdx =
        direction === 'top' ? 0 : direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= prev.length || targetIdx === index) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  };

  // Remove a newly added variant before saving
  const handleRemoveNewVariant = (optName: string) => {
    setDetectedVariants((prev) => prev.filter((v) => !(v.isNew && v.option === optName)));
  };

  // Update individual variant price
  const handleVariantPriceChange = (optName: string, rawPrice: string) => {
    const numeric = Number(rawPrice.replace(/[^0-9]/g, '')) || 0;
    setDetectedVariants((prev) =>
      prev.map((v) => (v.option === optName ? { ...v, price: numeric } : v))
    );
  };

  // Sync all variant prices from Standard Base Price + Finish Surcharge
  const handleRecalculateAllPricesFromBase = () => {
    if (standardBasePrice <= 0) {
      showToast('warning', 'Invalid Base Price', 'Please enter a valid Standard Base Price first.');
      return;
    }
    setDetectedVariants((prev) =>
      prev.map((v) => {
        const extra = Number(v.matchedFinish?.extra_price || 0);
        return {
          ...v,
          price: standardBasePrice + extra,
        };
      })
    );
    showToast(
      'success',
      'Prices Synchronized',
      `Applied Rp ${standardBasePrice.toLocaleString('id-ID')} base + finish surcharges across all ${detectedVariants.length} variants.`
    );
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
        marketplaceChannel: isTikTok ? 'tokopedia' : 'shopee',
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
      isTikTok,
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
          console.error('[Marketplace Image Injector] Preview render failed:', err);
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

  // Summary metrics for variant modifications
  const selectedVariantsCount = detectedVariants.filter((v) => v.selected).length;
  const newVariantsCount = detectedVariants.filter((v) => v.isNew).length;
  const hasReorderedVariants = detectedVariants.some(
    (v, idx) => !v.isNew && v.oldIndex !== undefined && v.oldIndex !== idx
  );
  const changedPricesCount = detectedVariants.filter(
    (v) =>
      v.price > 0 &&
      (v.isNew || (v.originalPrice !== undefined && Math.abs(v.price - v.originalPrice) >= 1))
  ).length;
  const hasVariantStructureOrPriceChanges =
    newVariantsCount > 0 || hasReorderedVariants || changedPricesCount > 0;

  // Execute Complete Image & Variant Injection Pipeline (supports coverOnlyOverride for 1-click primary cover update)
  const handleStartInjection = async (coverOnlyOverride?: boolean) => {
    if ((!item && !tiktokItem) || !deviceProfile) {
      showToast('error', 'Device Profile Missing', 'Please select a valid device profile first.');
      return;
    }

    const isCoverOnly = coverOnlyOverride === true || !updateVariants;
    const shouldUploadCover = isCoverOnly ? true : updateCover;

    const selectedVariantsList = isCoverOnly
      ? []
      : detectedVariants.filter(
          (v) => (updateVariants && v.selected && v.matchedFinish) || (v.isNew && v.matchedFinish)
        );

    if (
      !shouldUploadCover &&
      selectedVariantsList.length === 0 &&
      (isCoverOnly || !hasVariantStructureOrPriceChanges)
    ) {
      showToast(
        'warning',
        'Nothing Selected',
        'Please enable Primary Cover, select Variant Photos, or add/reorder/reprice variants.'
      );
      return;
    }

    setIsInjecting(true);
    setInjectionError(null);
    setInjectionResult(null);

    const totalSteps = (shouldUploadCover ? 1 : 0) + selectedVariantsList.length + 1;
    let completedSteps = 0;

    let uploadedCoverImageId: string | undefined = undefined;
    const uploadedVariantImages: Array<{ option: string; image_id: string }> = [];

    try {
      // Auto-save device position settings to product profile in background so Shopee & TikTok stay in sync
      saveMarketplaceDeviceSettingsDirect(deviceProfile, {
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
      })
        .then((res) => {
          if (res.success) setHasSavedDevicePosition(true);
        })
        .catch(() => {});

      // Step 1: Render and Upload Primary Cover
      if (shouldUploadCover) {
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
          `${deviceProfile.device_slug || 'device'}-${activeChannel}-cover.jpg`,
          { type: 'image/jpeg' }
        );

        setInjectionProgress({
          current: completedSteps,
          total: totalSteps,
          stage: 'Primary Cover Image',
          details: `Uploading primary cover image to ${channelLabel}...`,
        });

        const uploadCoverRes = isTikTok
          ? await uploadTikTokMediaImageDirect({
              file: coverFile,
              filename: `${deviceProfile.device_slug || 'device'}-cover.jpg`,
              use_case: 'MAIN_IMAGE',
            })
          : await uploadShopeeMediaImageDirect({
              file: coverFile,
              filename: `${deviceProfile.device_slug || 'device'}-cover.jpg`,
            });

        if (!uploadCoverRes.success || !uploadCoverRes.image_id) {
          throw new Error(
            uploadCoverRes.error ||
              `Failed to upload primary cover image to ${channelLabel}.`
          );
        }

        uploadedCoverImageId = uploadCoverRes.image_id;
      }

      // Step 2: Render and Upload Each Selected / Newly Added Variant (skipped in Cover-Only mode)
      if (!isCoverOnly) {
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
          const variantFile = new File([variantBlob], `${activeChannel}-variant-${slug}.jpg`, {
            type: 'image/jpeg',
          });

          const uploadVarRes = isTikTok
            ? await uploadTikTokMediaImageDirect({
                file: variantFile,
                filename: `tiktok-variant-${slug}.jpg`,
                use_case: 'ATTRIBUTE_IMAGE',
              })
            : await uploadShopeeMediaImageDirect({
                file: variantFile,
                filename: `shopee-variant-${slug}.jpg`,
              });

          if (uploadVarRes.success && uploadVarRes.image_id) {
            uploadedVariantImages.push({
              option: v.option,
              image_id: uploadVarRes.image_id,
            });
          } else {
            console.warn(
              `[${channelLabel} Injection] Variant upload failed for ${v.option}:`,
              uploadVarRes.error
            );
          }
        }
      }

      // Step 3: Commit Update to Marketplace Listing
      completedSteps++;
      setInjectionProgress({
        current: completedSteps,
        total: totalSteps,
        stage: `Finalizing ${channelLabel} Update`,
        details: isCoverOnly
          ? `Updating primary cover image on ${channelLabel} (preserving gallery & variants)...`
          : `Syncing cover, variant options, ordering, and prices to ${channelLabel}...`,
      });

      const uploadedMap = new Map(
        uploadedVariantImages.map((u) => [u.option.toLowerCase().trim(), u.image_id])
      );

      let injectRes: ShopeeInjectImagesResult;

      if (isTikTok && tiktokItem) {
        injectRes = await injectTikTokProductImagesDirect({
          product_id: tiktokItem.id,
          cover_image_id: uploadedCoverImageId,
          variant_images: isCoverOnly ? undefined : uploadedVariantImages,
        });
      } else {
        const variantPlan: ShopeeInjectVariantPlanItem[] | undefined = isCoverOnly
          ? undefined
          : detectedVariants.map((v) => ({
              option: v.option,
              image_id:
                uploadedMap.get(v.option.toLowerCase().trim()) || v.currentImageId || undefined,
              price: Number(v.price) > 0 ? Number(v.price) : undefined,
              is_new: Boolean(v.isNew),
              old_index: v.oldIndex,
            }));

        injectRes = await injectShopeeProductImagesDirect({
          item_id: item!.item_id,
          cover_image_id: uploadedCoverImageId,
          variant_images: isCoverOnly ? undefined : uploadedVariantImages,
          variant_plan: variantPlan,
        });
      }

      if (injectRes.success) {
        setInjectionResult(injectRes);
        if (!isCoverOnly) {
          // Mark newly added variants and updated prices as committed in UI state
          setDetectedVariants((prev) =>
            prev.map((v, idx) => ({
              ...v,
              isNew: false,
              oldIndex: idx,
              originalPrice: v.price,
              currentImageId:
                uploadedMap.get(v.option.toLowerCase().trim()) || v.currentImageId,
            }))
          );
        }
        showToast(
          'success',
          `${channelLabel} Listing Updated`,
          injectRes.message ||
            (isCoverOnly
              ? 'Primary cover image updated with zero variant changes.'
              : 'Images and variants updated.')
        );
        if (onSuccess) {
          onSuccess(injectRes);
        }
      } else {
        setInjectionError(
          injectRes.error || injectRes.message || `${channelLabel} rejected listing update.`
        );
        showToast(
          'error',
          'Injection Failed',
          injectRes.error || `Failed to update ${channelLabel} listing.`
        );
      }
    } catch (err: any) {
      console.error(`[${channelLabel} Injection] Pipeline error:`, err);
      setInjectionError(err.message || 'An unexpected error occurred during image injection.');
      showToast('error', 'Injection Error', err.message || 'Failed to complete image injection.');
    } finally {
      setIsInjecting(false);
      setInjectionProgress(null);
    }
  };

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
            <h2 className="text-base font-bold text-zinc-100">
              Auto-Inject Images into {channelLabel}
            </h2>
            <p className="text-xs text-zinc-400">
              Safe & non-destructive: update primary cover only or inject variant photos while preserving all gallery images.
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
            <p className="text-xs font-medium">
              Fetching {channelLabel} listing & configurator specs...
            </p>
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
                  {!updateVariants
                    ? 'Cover-Only Mode is active: ONLY photo #1 (Primary Cover) will be replaced. Your existing gallery photos (#2 to #9) and all product variants, SKUs, stock, and prices will remain completely untouched.'
                    : 'Only the primary cover image (photo #1) and variation option images will be injected. Your existing gallery photos (installation guides, packaging, spec cards) are preserved and will not be touched or reordered.'}
                </p>
              </div>
            </div>

            {/* Target Product Summary Bar */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#f3aa18]/20 text-[#f3aa18] border border-[#f3aa18]/30">
                      ID: {isTikTok ? tiktokItem?.id : item?.item_id}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Status:{' '}
                      {productPreview?.item_status ||
                        (isTikTok ? tiktokItem?.status : item?.item_status) ||
                        'NORMAL'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100 line-clamp-1">
                    {productPreview?.item_name ||
                      (isTikTok ? tiktokItem?.title : item?.item_name)}
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
                    <span>
                      Current {channelLabel} Photos ({productPreview.images.length})
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Photo #1 will be replaced; photos #2 to #{productPreview.images.length} preserved
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

              {/* Injection Mode Selector Bar (Cover Image Only vs Cover + Variants) */}
              <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-zinc-300">
                  Injection Scope:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateCover(true);
                      setUpdateVariants(false);
                      setActivePreviewType('cover');
                    }}
                    className={clsx(
                      'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer',
                      !updateVariants
                        ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    <Star className="w-3.5 h-3.5 shrink-0" />
                    <span>Primary Cover Image Only (No Variant Changes)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateCover(true);
                      setUpdateVariants(true);
                    }}
                    className={clsx(
                      'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer',
                      updateVariants
                        ? 'bg-[#f3aa18] text-zinc-950 shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Cover + Variants (Photos / Finishes / Prices)</span>
                  </button>
                </div>
              </div>
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

                  {/* Active Skin Layers (e.g. Back [Base], Accents, etc.) */}
                  {deviceProfile && filterGenuineSkinLayers(deviceProfile.layers || []).length > 0 && (
                    <div className="pt-3 border-t border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-zinc-300">
                          Active Skin Layers (Default: Base Skin Only)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const baseIds = getDefaultBaseSkinLayerIds(deviceProfile.layers || []);
                            setActiveLayerIds(baseIds);
                          }}
                          className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                        >
                          Base Skin Only
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {filterGenuineSkinLayers(deviceProfile.layers || []).map((layer) => {
                          const isChecked = activeLayerIds.includes(layer.id);
                          const isBase = isBaseSkinLayer(layer);
                          const extraPrice = Number(layer.extra_price) || 0;
                          return (
                            <button
                              key={layer.id}
                              type="button"
                              onClick={() => {
                                setActiveLayerIds((prev) => {
                                  if (prev.includes(layer.id)) {
                                    if (prev.length <= 1) return prev;
                                    return prev.filter((id) => id !== layer.id);
                                  }
                                  return [...prev, layer.id];
                                });
                              }}
                              className={clsx(
                                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer',
                                isChecked
                                  ? 'bg-[#f3aa18]/20 border-[#f3aa18] text-[#f3aa18]'
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              )}
                            >
                              {isChecked ? <Check className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5" />}
                              <span>{layer.name}</span>
                              <span
                                className={clsx(
                                  'px-1.5 py-0.5 rounded text-[9px] font-bold',
                                  isBase
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                )}
                              >
                                {isBase
                                  ? 'Base'
                                  : extraPrice > 0
                                  ? `+Rp ${(extraPrice / 1000).toFixed(0)}k`
                                  : 'Addon'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

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

                {/* 4. Variant Options, Missing Finishes, Placement & Pricing */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateVariants}
                        onChange={(e) => setUpdateVariants(e.target.checked)}
                        className="rounded border-zinc-700 text-[#f3aa18] focus:ring-[#f3aa18]"
                      />
                      <span>
                        {isTikTok
                          ? 'Inject Variant Option Photos'
                          : 'Inject Variant Option Photos, Add Finishes & Sync Prices'}
                      </span>
                    </label>

                    {updateVariants && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectAllVariants(true)}
                          className="text-[11px] text-[#f3aa18] hover:underline cursor-pointer"
                        >
                          Select All Photos
                        </button>
                        <span className="text-zinc-600">•</span>
                        <button
                          type="button"
                          onClick={() => handleSelectAllVariants(false)}
                          className="text-[11px] text-zinc-400 hover:underline cursor-pointer"
                        >
                          Deselect Photos
                        </button>
                      </div>
                    )}
                  </div>

                  {!updateVariants ? (
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-3">
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        <strong className="text-emerald-400 font-semibold">
                          Cover Image Only (No Variant Changes):
                        </strong>{' '}
                        Only the primary cover image (#1) will be uploaded and saved. Existing variants, models, stock, and prices on {channelLabel} will not be touched.
                      </p>
                      <button
                        type="button"
                        onClick={() => setUpdateVariants(true)}
                        className="min-h-[34px] px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold shrink-0 transition cursor-pointer"
                      >
                        Enable Variant Options
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Base Price & Bulk Price Calculator Bar (Shopee) */}
                      {!isTikTok && (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-200">
                              <Coins className="w-3.5 h-3.5 text-[#f3aa18]" />
                              <span>Variant Pricing & Standard Base Price</span>
                            </div>
                            <span className="text-[10px] text-zinc-400">
                              Signature & Limited skins auto-add their finish surcharge (e.g. +Rp 30.000)
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5">
                              <span className="text-[10px] font-semibold text-zinc-400">
                                Standard Base (Rp):
                              </span>
                              <input
                                type="number"
                                step={1000}
                                value={standardBasePrice || ''}
                                onChange={(e) =>
                                  setStandardBasePrice(Math.max(0, Number(e.target.value) || 0))
                                }
                                className="w-24 bg-transparent text-xs font-mono font-bold text-zinc-100 focus:outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleRecalculateAllPricesFromBase}
                              className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#f3aa18]/15 hover:bg-[#f3aa18]/25 border border-[#f3aa18]/40 text-[#f3aa18] text-[11px] font-bold transition cursor-pointer"
                            >
                              Sync All Prices from Base + Surcharge
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Add Missing Finishes & Placement Panel (Shopee) */}
                      {!isTikTok && (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-200">
                              <Plus className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Add Missing Finishes to Shopee Listing</span>
                              <span className="text-[10px] font-normal text-zinc-400">
                                (Initial Stock: 100)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-400">Insert at:</span>
                              <select
                                value={insertPlacement}
                                onChange={(e) =>
                                  setInsertPlacement(e.target.value as VariantInsertPlacement)
                                }
                                className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-200 focus:outline-none focus:border-[#f3aa18]"
                              >
                                <option value="after_signature">After Signature skins</option>
                                <option value="top">Top of variant list (#1)</option>
                                <option value="bottom">Bottom of variant list</option>
                              </select>
                            </div>
                          </div>

                          {missingFinishes.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-zinc-400">
                                  Click a missing finish below to insert it with auto-calculated price:
                                </span>
                                {missingFinishes.some((f) => Number(f.extra_price || 0) > 0) && (
                                  <button
                                    type="button"
                                    onClick={handleAddAllMissingSpecialFinishes}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold transition cursor-pointer shrink-0"
                                  >
                                    + Add All Missing Signature / Limited (
                                    {missingFinishes.filter((f) => Number(f.extra_price || 0) > 0).length}
                                    )
                                  </button>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                                {missingFinishes.map((f) => {
                                  const extra = Number(f.extra_price || 0);
                                  const autoPrice = standardBasePrice + extra;
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => handleAddFinishVariant(f)}
                                      className={clsx(
                                        'px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer',
                                        extra > 0
                                          ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/35 text-amber-200'
                                          : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                                      )}
                                      title={`Insert ${f.name} at Rp ${autoPrice.toLocaleString('id-ID')} (Stock: 100)`}
                                    >
                                      <div
                                        className="w-3.5 h-3.5 rounded-full border border-black/40 shrink-0"
                                        style={{
                                          backgroundColor: f.color_hex || '#333',
                                          backgroundImage: f.thumbnail ? `url(${f.thumbnail})` : undefined,
                                          backgroundSize: 'cover',
                                        }}
                                      />
                                      <span className="font-semibold">{f.name}</span>
                                      <span className="text-[9px] font-mono opacity-80">
                                        Rp {(autoPrice / 1000).toFixed(0)}k
                                      </span>
                                      <Plus className="w-3 h-3 text-emerald-400 shrink-0" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-emerald-400">
                              All active Global Finishes are already present in the variant list below.
                            </p>
                          )}

                          {/* Custom Variant Input */}
                          <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={customVariantName}
                              onChange={(e) => setCustomVariantName(e.target.value)}
                              placeholder="Custom variant name (e.g. Titanium+)"
                              className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                            />
                            <input
                              type="number"
                              step={1000}
                              value={customVariantPrice}
                              onChange={(e) => setCustomVariantPrice(e.target.value)}
                              placeholder={`Price (default ${standardBasePrice})`}
                              className="w-36 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-none focus:border-[#f3aa18]"
                            />
                            <button
                              type="button"
                              onClick={handleAddCustomVariant}
                              className="min-h-[32px] px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#f3aa18]" />
                              <span>Add Custom</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Variant List with Reordering & Editable Prices */}
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              {selectedVariantsCount} of {detectedVariants.length} photos queued
                            </span>
                            {newVariantsCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                                +{newVariantsCount} New
                              </span>
                            )}
                            {hasReorderedVariants && (
                              <span className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-bold">
                                Reordered
                              </span>
                            )}
                            {changedPricesCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                                {changedPricesCount} Price Updates
                              </span>
                            )}
                          </div>
                          {!isTikTok && (
                            <span className="text-[10px] text-zinc-500">
                              Use arrows to reorder; edit Rp price per variant
                            </span>
                          )}
                        </div>

                        <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                          {detectedVariants.map((v, idx) => {
                            const isMatched = Boolean(v.matchedFinish);
                            const finishExtra = Number(v.matchedFinish?.extra_price || 0);
                            const isPriceModified =
                              !v.isNew &&
                              v.originalPrice !== undefined &&
                              Math.abs(v.price - v.originalPrice) >= 1;
                            const isMoved =
                              !v.isNew && v.oldIndex !== undefined && v.oldIndex !== idx;

                            return (
                              <div
                                key={`${v.option}-${idx}`}
                                className={clsx(
                                  'px-2.5 py-2 rounded-lg border text-xs flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 transition select-none',
                                  v.isNew
                                    ? 'bg-emerald-950/25 border-emerald-500/40 text-zinc-100'
                                    : v.selected && updateVariants
                                    ? 'bg-zinc-950 border-[#f3aa18]/40 text-zinc-100'
                                    : 'bg-zinc-950/60 border-zinc-800 text-zinc-400'
                                )}
                              >
                                {/* Left: Index, Checkbox, Swatch, Option Name & Badges */}
                                <div
                                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                                  onClick={() => handleToggleVariant(v.option)}
                                >
                                  <span className="w-6 text-center font-mono text-[10px] text-zinc-500 shrink-0">
                                    #{idx + 1}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleVariant(v.option);
                                    }}
                                    className="text-zinc-400 hover:text-zinc-200 shrink-0"
                                    title="Toggle rendering & uploading photo for this variant"
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

                                  <span className="font-semibold truncate">{v.option}</span>

                                  {v.isNew && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold shrink-0">
                                      NEW
                                    </span>
                                  )}

                                  {isMoved && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono shrink-0">
                                      was #{v.oldIndex! + 1}
                                    </span>
                                  )}

                                  {finishExtra > 0 && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono shrink-0">
                                      +{(finishExtra / 1000).toFixed(0)}k
                                    </span>
                                  )}

                                  {!isMatched && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                                      Custom
                                    </span>
                                  )}
                                </div>

                                {/* Right: Price Input, Reorder Controls, Preview & Delete */}
                                <div
                                  className="flex items-center gap-1.5 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {!isTikTok && (
                                    <>
                                      {/* Per-Variant Price Input */}
                                      <div
                                        className={clsx(
                                          'flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-mono',
                                          isPriceModified || v.isNew
                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                                        )}
                                        title={
                                          v.originalPrice
                                            ? `Current Shopee price: Rp ${v.originalPrice.toLocaleString('id-ID')}`
                                            : 'New variant price'
                                        }
                                      >
                                        <span className="text-[9px] text-zinc-500">Rp</span>
                                        <input
                                          type="number"
                                          step={1000}
                                          value={v.price || ''}
                                          onChange={(e) =>
                                            handleVariantPriceChange(v.option, e.target.value)
                                          }
                                          className="w-20 bg-transparent text-[11px] font-mono font-semibold focus:outline-none text-right"
                                        />
                                      </div>

                                      {/* Reorder Buttons */}
                                      <div className="flex items-center bg-zinc-900 rounded border border-zinc-800 p-0.5">
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveVariant(idx, 'top')}
                                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                                          title="Move to top (#1)"
                                        >
                                          <ChevronsUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveVariant(idx, 'up')}
                                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                                          title="Move up"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === detectedVariants.length - 1}
                                          onClick={() => handleMoveVariant(idx, 'down')}
                                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                                          title="Move down"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {isMatched && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActivePreviewType('variant');
                                        setPreviewFinishId(v.matchedFinish!.id);
                                      }}
                                      className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                                      title="Preview this variant on canvas"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span className="hidden sm:inline">Preview</span>
                                    </button>
                                  )}

                                  {v.isNew && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveNewVariant(v.option)}
                                      className="p-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 cursor-pointer"
                                      title="Remove newly added variant"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
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
                        <p className="font-bold text-emerald-200">
                          {channelLabel} Listing Update Complete
                        </p>
                        <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                          Primary cover updated: {injectionResult.cover_updated ? 'Yes' : 'No'}.{' '}
                          Gallery preserved: {injectionResult.gallery_preserved_count} photos kept intact.{' '}
                          {Number(injectionResult.variants_updated) > 0 &&
                            `Variant photos injected: ${injectionResult.variants_updated}. `}
                          {Number(injectionResult.variants_added) > 0 &&
                            `New variants created (stock 100): ${injectionResult.variants_added}. `}
                          {injectionResult.variants_reordered && 'Variant order updated. '}
                          {Number(injectionResult.prices_updated) > 0 &&
                            `Variant prices updated: ${injectionResult.prices_updated}.`}
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
                        <span>View Listing in {channelLabel} Seller Centre</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Action Controls */}
                <div className="space-y-2 pt-2">
                  {/* Primary 1-Click Cover Image Only Button */}
                  <button
                    type="button"
                    onClick={() => handleStartInjection(true)}
                    disabled={isInjecting || isLoadingInitialData || !deviceProfile}
                    className={clsx(
                      'w-full min-h-[44px] px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md',
                      isInjecting || !deviceProfile
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : !updateVariants
                        ? 'bg-[#f3aa18] hover:bg-[#e09b15] text-zinc-950'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                    )}
                  >
                    {isInjecting && !updateVariants ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Uploading Primary Cover to {channelLabel}...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>
                          Save & Upload Cover Image Only (No Variant Changes)
                        </span>
                      </>
                    )}
                  </button>

                  {/* Full Cover + Variants Injection Button (shown when Variant Options enabled) */}
                  {updateVariants && (
                    <button
                      type="button"
                      onClick={() => handleStartInjection(false)}
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
                          <span>Updating {channelLabel} Listing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>
                            Inject Cover + Variants ({updateCover ? 1 : 0} Cover +{' '}
                            {selectedVariantsCount} Photos
                            {!isTikTok && newVariantsCount > 0
                              ? ` • +${newVariantsCount} New`
                              : ''}
                            {!isTikTok && changedPricesCount > 0
                              ? ` • ${changedPricesCount} Prices`
                              : ''}
                            )
                          </span>
                        </>
                      )}
                    </button>
                  )}

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
