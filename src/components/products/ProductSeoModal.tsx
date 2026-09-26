import React, { useState, useEffect } from 'react';
import {
  Product,
  fetchProductSeoDirect,
  updateProductSeoDirect,
  generateProductSeoAndDescriptionAi,
  getCachedPluginSettings,
  revalidateStorefrontWebDirect,
} from '../../lib/wordpressBridge';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Sparkles,
  Search,
  Globe,
  Loader2,
  Check,
  RotateCw,
  HelpCircle,
  FileText,
  Key,
  AlertTriangle,
  Wand2,
  Share2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { EXACOAT_WORDMARK_DATA_URL_DARK } from '../../lib/brandAssets';
import {
  normalizeDeviceName,
  buildCanonicalSeoTitle,
  cleanRedundantSeoTitle,
  buildCanonicalFocusKeyword,
  cleanSeoCopy,
  hasBoilerplateTokens,
} from '../../lib/seoUtils';

interface ProductSeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onUpdated: (updatedProduct: Product) => void;
}

export const ProductSeoModal: React.FC<ProductSeoModalProps> = ({
  isOpen,
  onClose,
  product,
  onUpdated,
}) => {
  const { showToast } = useToast();

  // Form Fields
  const [shortDesc, setShortDesc] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [activeGeneratingField, setActiveGeneratingField] = useState<string | null>(null);
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null);
  const [aiLatencyMs, setAiLatencyMs] = useState<number | null>(null);

  // Active AI Provider info
  const pluginSettings = getCachedPluginSettings();
  const initialProvider = (pluginSettings.fandom_provider || pluginSettings.ai_provider || 'gemini') as 'gemini' | 'openai';
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'openai'>(initialProvider);
  const [selectedModel, setSelectedModel] = useState<string>(
    initialProvider === 'gemini'
      ? pluginSettings.gemini_model || 'gemini-2.5-flash'
      : pluginSettings.openai_model || 'gpt-4o-mini'
  );

  const handleProviderToggle = (newProvider: 'gemini' | 'openai') => {
    setSelectedProvider(newProvider);
    setSelectedModel(
      newProvider === 'gemini'
        ? pluginSettings.gemini_model || 'gemini-2.5-flash'
        : pluginSettings.openai_model || 'gpt-4o-mini'
    );
  };

  const cleanDevice = product ? normalizeDeviceName(product.name) : '';
  const [googleImageUrl, setGoogleImageUrl] = useState<string>('');
  const [isGalleryImage, setIsGalleryImage] = useState<boolean>(false);

  // Load SEO Metadata when product is opened
  useEffect(() => {
    if (!product || !isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    // Initial fallback from product object
    setShortDesc(product.short_description || '');

    const prodImgs = Array.isArray(product.images) ? product.images : [];
    const initialHasGallery = prodImgs.length > 1 && Boolean(prodImgs[1]?.src);
    setGoogleImageUrl(initialHasGallery ? prodImgs[1].src : prodImgs[0]?.src || '');
    setIsGalleryImage(initialHasGallery);

    // Extract existing metadata if present on product
    const metaList = Array.isArray(product.meta_data) ? product.meta_data : [];
    const getMeta = (keys: string[]) => {
      for (const k of keys) {
        const m = metaList.find((entry: any) => entry.key === k);
        if (m && typeof m.value === 'string' && m.value.trim()) return m.value.trim();
      }
      return '';
    };

    const initialTitle = getMeta(['_yoast_wpseo_title', 'rank_math_title']);
    setSeoTitle(cleanRedundantSeoTitle(initialTitle, product.name));
    setSeoDesc(getMeta(['_yoast_wpseo_metadesc', 'rank_math_description']));
    const initialKw = getMeta(['_yoast_wpseo_focuskw', 'rank_math_focus_keyword']);
    setFocusKeyword(
      initialKw
        ? cleanRedundantSeoTitle(initialKw, product.name)
        : buildCanonicalFocusKeyword(product.name)
    );

    // Fetch latest fresh metadata from backend
    fetchProductSeoDirect(product.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          if (res.data.short_description !== undefined) {
            setShortDesc(res.data.short_description);
          }
          if (res.data.seo_title) {
            setSeoTitle(cleanRedundantSeoTitle(res.data.seo_title, product.name));
          }
          if (res.data.seo_description) {
            setSeoDesc(res.data.seo_description);
          }
          if (res.data.focus_keyword) {
            setFocusKeyword(cleanRedundantSeoTitle(res.data.focus_keyword, product.name));
          }
          if (res.data.google_image_url) {
            setGoogleImageUrl(res.data.google_image_url);
          }
          if (res.data.is_gallery_image !== undefined) {
            setIsGalleryImage(Boolean(res.data.is_gallery_image));
          }
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [product, isOpen]);

  // Check if boilerplate template tokens or HTML exist in copy
  const isBoilerplateDetected = Boolean(
    product &&
      (hasBoilerplateTokens(shortDesc) ||
        hasBoilerplateTokens(seoDesc) ||
        /\bskins?\s+skin\b/i.test(seoTitle) ||
        /\[product_name\]/i.test(shortDesc) ||
        /\[geturl\]/i.test(shortDesc))
  );

  const handleResolveBoilerplate = () => {
    if (!product) return;
    const cleanDev = normalizeDeviceName(product.name);
    const cleanedShort = cleanSeoCopy(shortDesc, {
      deviceName: product.name,
      productSlug: product.slug,
    });
    const cleanedDesc = cleanSeoCopy(seoDesc || shortDesc, {
      deviceName: product.name,
      productSlug: product.slug,
    });
    const cleanedTitle = cleanRedundantSeoTitle(
      seoTitle || buildCanonicalSeoTitle(product.name),
      product.name
    );
    const cleanedKw = buildCanonicalFocusKeyword(product.name);

    setShortDesc(cleanedShort);
    setSeoDesc(cleanedDesc);
    setSeoTitle(cleanedTitle);
    setFocusKeyword(cleanedKw);

    showToast(
      'success',
      'Template Cleaned',
      `Resolved [product_name] to "${cleanDev}", stripped HTML tags, and removed em dashes.`
    );
  };

  // AI Generation (All Fields)
  const handleGenerateAllWithAi = async () => {
    if (!product) return;
    setIsGeneratingAi(true);
    setActiveGeneratingField('all');

    const categoryName = product.categories?.[0]?.name || 'Skins';
    const res = await generateProductSeoAndDescriptionAi(cleanDevice, categoryName, {
      provider: selectedProvider,
      model: selectedModel,
    });

    setIsGeneratingAi(false);
    setActiveGeneratingField(null);

    if (res.success && res.data) {
      if (res.data.seo_title) setSeoTitle(cleanRedundantSeoTitle(res.data.seo_title, product.name));
      if (res.data.seo_description) setSeoDesc(res.data.seo_description);
      if (res.data.focus_keyword) setFocusKeyword(cleanRedundantSeoTitle(res.data.focus_keyword, product.name));
      if (res.data.short_description) setShortDesc(res.data.short_description);

      setAiModelUsed(res.model_used || selectedModel);
      setAiLatencyMs(res.latency_ms || 0);

      showToast(
        'success',
        'AI Generation Complete',
        `Generated device-differentiated SEO and short description via ${res.model_used || selectedModel} in ${res.latency_ms || 0}ms.`
      );
    } else {
      showToast('error', 'AI Generation Failed', res.error || 'Could not generate copy. Check API keys in Settings.');
    }
  };

  // AI Generation (Single Field Rewrite)
  const handleRegenerateSingleField = async (field: 'short_desc' | 'seo_title' | 'seo_desc') => {
    if (!product) return;
    setActiveGeneratingField(field);

    const categoryName = product.categories?.[0]?.name || 'Skins';
    const res = await generateProductSeoAndDescriptionAi(cleanDevice, categoryName, {
      provider: selectedProvider,
      model: selectedModel,
    });

    setActiveGeneratingField(null);

    if (res.success && res.data) {
      if (field === 'short_desc' && res.data.short_description) {
        setShortDesc(res.data.short_description);
      } else if (field === 'seo_title' && res.data.seo_title) {
        setSeoTitle(cleanRedundantSeoTitle(res.data.seo_title, product.name));
      } else if (field === 'seo_desc' && res.data.seo_description) {
        setSeoDesc(res.data.seo_description);
      }
      showToast('success', 'Field Updated', 'Generated fresh copy tailored to this device.');
    } else {
      showToast('error', 'Generation Error', res.error || 'Could not regenerate field.');
    }
  };

  // Save changes back to WordPress/WooCommerce
  const handleSave = async () => {
    if (!product) return;
    setIsSaving(true);

    try {
      const res = await updateProductSeoDirect(product.id, {
        short_description: shortDesc.trim(),
        seo_title: seoTitle.trim(),
        seo_description: seoDesc.trim(),
        focus_keyword: focusKeyword.trim(),
      });

      if (res.success) {
        // Trigger storefront on-demand ISR revalidation and Cloudflare edge cache purge
        revalidateStorefrontWebDirect({
          slug: product.slug,
          category: product.categories?.[0]?.slug,
        }).catch((err) => console.warn('[SEO] Cache revalidation notice:', err));

        showToast(
          'success',
          'SEO Saved',
          `Updated SEO for ${product.name}. Storefront and edge cache refreshed.`
        );
        onUpdated({
          ...product,
          short_description: shortDesc.trim(),
        });
        onClose();
      } else {
        showToast('error', 'Save Failed', res.error || 'Unable to update product SEO in WordPress.');
      }
    } catch (err: any) {
      showToast('error', 'Save Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Character counter helper
  const getLengthIndicator = (len: number, min: number, max: number) => {
    if (len === 0) return 'text-zinc-500';
    if (len >= min && len <= max) return 'text-emerald-400 font-semibold';
    if (len > max) return 'text-rose-400 font-semibold';
    return 'text-amber-400';
  };

  // Word count helper
  const wordCount = shortDesc.trim() ? shortDesc.trim().split(/\s+/).length : 0;

  if (!product) return null;

  const modalHeader = (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#f3aa18] shrink-0">
        <Sparkles className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            SEO & Short Description
          </h2>
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 shrink-0">
            #{product.id}
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
          Manage Google search snippet and on-page storefront copy for {product.name}.
        </p>
      </div>
    </div>
  );

  const modalFooter = (
    <div className="flex items-center justify-between w-full">
      <div className="text-[11px] text-zinc-500">
        Applies to: <span className="text-zinc-400 font-medium">WooCommerce, Yoast SEO & Rank Math</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="h-9 px-4 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-40 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="h-9 inline-flex items-center gap-2 px-5 rounded-xl text-xs font-semibold text-neutral-950 bg-[#f3aa18] hover:bg-[#e09b15] active:bg-[#d89312] transition shadow-md shadow-[#f3aa18]/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Save to Webstore</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={modalHeader}
      footer={modalFooter}
    >
      <div className="space-y-5">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#f3aa18]" />
            <span>Loading current SEO metadata from WordPress...</span>
          </div>
        )}

        {/* AI Generator Control Bar - Sleek secondary utility card */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-zinc-200/70 dark:bg-zinc-800 border border-zinc-300/50 dark:border-zinc-700/60 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  AI Copy Generator
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300/60 dark:border-zinc-700/50">
                  {selectedModel}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Generates distinct, device-tailored copy using Exacoat brand voice and zero em dashes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {/* Compact Segmented Provider Switcher */}
            <div className="flex items-center p-0.5 bg-zinc-200/70 dark:bg-zinc-800/80 rounded-lg border border-zinc-300/70 dark:border-zinc-700/60 text-xs">
              <button
                type="button"
                onClick={() => handleProviderToggle('gemini')}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer',
                  selectedProvider === 'gemini'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                )}
              >
                Gemini
              </button>
              <button
                type="button"
                onClick={() => handleProviderToggle('openai')}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer',
                  selectedProvider === 'openai'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                )}
              >
                OpenAI
              </button>
            </div>

            {/* Secondary subtle generate button */}
            <button
              type="button"
              onClick={handleGenerateAllWithAi}
              disabled={isGeneratingAi || isSaving}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-100 text-xs font-medium border border-zinc-700/80 dark:border-zinc-700 transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isGeneratingAi && activeGeneratingField === 'all' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f3aa18]" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />
                  <span>Generate All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {aiLatencyMs !== null && (
          <div className="text-[11px] text-emerald-500 flex items-center gap-1.5 -mt-2 pl-1 font-mono">
            <Check className="w-3.5 h-3.5" />
            <span>
              Generated via {aiModelUsed} in {aiLatencyMs}ms. Review and adjust below before saving.
            </span>
          </div>
        )}

        {/* Live Search & Social Visual Previews (Side-by-Side) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Column 1: Google SERP Snippet Preview */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="font-medium flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <Globe className="w-3.5 h-3.5 text-blue-500" />
                Google Search Result
              </span>
              <span
                className={clsx(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                  isGalleryImage
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                )}
              >
                {isGalleryImage ? 'Gallery Image #1' : 'Primary Image'}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xs flex-1 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">exacoat.com</span>
                    <span>›</span>
                    <span>product</span>
                    <span>›</span>
                    <span className="font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-[130px]">
                      {product.slug || 'product-slug'}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer line-clamp-1">
                    {cleanRedundantSeoTitle(seoTitle || buildCanonicalSeoTitle(product.name), product.name)}
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                    {cleanSeoCopy(
                      seoDesc ||
                        shortDesc ||
                        `Protect your ${cleanDevice} with precision-engineered textured wraps. Real scratch defense without bulk, laser-measured fit, and clean residue-free removal.`,
                      {
                        deviceName: product.name,
                        productSlug: product.slug,
                      }
                    )}
                  </p>
                </div>

                {googleImageUrl && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shrink-0">
                    <img
                      src={googleImageUrl}
                      alt={`${cleanDevice} Google Search Thumbnail`}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={clsx(
                        'absolute bottom-1 right-1 px-1 py-0.5 rounded text-[8px] font-mono font-semibold backdrop-blur-md border',
                        isGalleryImage
                          ? 'bg-emerald-950/85 text-emerald-300 border-emerald-500/40'
                          : 'bg-zinc-900/85 text-zinc-300 border-zinc-700'
                      )}
                    >
                      {isGalleryImage ? 'images[1]' : 'images[0]'}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500">
                <span>Indexed via Product JSON-LD &amp; meta thumbnail</span>
                <span className="font-mono text-zinc-400">1:1 / 4:3</span>
              </div>
            </div>
          </div>

          {/* Column 2: Visual Social / OpenGraph Card Preview (1200x630) */}
          <div className="space-y-1.5 flex flex-col">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="font-medium flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <Share2 className="w-3.5 h-3.5 text-[#f3aa18]" />
                Social / OG Share Card
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60">
                1200 × 630
              </span>
            </div>

            <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs flex-1 flex flex-col">
              {/* 1200x630 OG Visual Canvas matching app/api/og/route.tsx */}
              <div
                className="relative w-full aspect-[1200/630] px-4 py-3.5 flex flex-col justify-between overflow-hidden select-none"
                style={{
                  backgroundColor: '#080808',
                  backgroundImage:
                    'radial-gradient(circle at 0% 0%, rgba(243,170,24,0.24) 0%, rgba(243,170,24,0.06) 32%, transparent 60%), linear-gradient(135deg, #141414 0%, #080808 50%, #000000 100%)',
                }}
              >
                {/* Top Wordmark */}
                <div className="flex items-center justify-between z-10">
                  <img
                    src={EXACOAT_WORDMARK_DATA_URL_DARK}
                    alt="Exacoat"
                    className="h-3.5 w-auto object-contain"
                  />
                  <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-500">
                    /api/og
                  </span>
                </div>

                {/* Bottom-Aligned Left Text + Framed Device Image on Right */}
                <div className="flex items-end justify-between gap-3 flex-1 pt-2 z-10">
                  <div
                    className="min-w-0 flex-1 pr-1 self-end pb-0.5"
                    style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                  >
                    <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#f3aa18] mb-0.5 leading-none truncate">
                      {(product.categories?.[0]?.name || 'EXACOAT').replace(/\s+Skins?$/i, '')}
                    </div>
                    <div className="text-base sm:text-lg font-bold text-white leading-[1.08] line-clamp-2 tracking-tight">
                      {product.name}
                    </div>
                  </div>

                  {googleImageUrl && (
                    <div className="w-20 sm:w-24 aspect-[360/460] rounded-lg overflow-hidden border border-white/15 shadow-2xl bg-zinc-900 shrink-0">
                      <img
                        src={googleImageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Social Platform Link Preview Footer */}
              <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-0.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  exacoat.com
                </div>
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {cleanRedundantSeoTitle(seoTitle || buildCanonicalSeoTitle(product.name), product.name)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Boilerplate Template Warning & 1-Click Resolver */}
        {isBoilerplateDetected && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Boilerplate Template Tokens Detected
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-200/70 mt-0.5">
                  Contains raw HTML tags or template placeholders like <code className="font-mono text-amber-600 dark:text-amber-300">[product_name]</code> or <code className="font-mono text-amber-600 dark:text-amber-300">[geturl]</code>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResolveBoilerplate}
              className="h-8 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-medium transition cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Resolve Template</span>
            </button>
          </div>
        )}

        {/* Field 1: Short Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="prod-short-desc"
              className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#f3aa18]" />
              <span>Short Description (On-Page Storefront Summary)</span>
            </label>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-zinc-500 font-mono">
                {wordCount} words | {shortDesc.length} chars
              </span>
              <button
                type="button"
                onClick={() => handleRegenerateSingleField('short_desc')}
                disabled={isGeneratingAi || isSaving}
                className="h-7 inline-flex items-center gap-1 px-2.5 rounded-md text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/60 transition cursor-pointer disabled:opacity-40"
              >
                {activeGeneratingField === 'short_desc' ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#f3aa18]" />
                ) : (
                  <RotateCw className="w-3 h-3 text-[#f3aa18]" />
                )}
                <span>Rewrite</span>
              </button>
            </div>
          </div>
          <textarea
            id="prod-short-desc"
            rows={3}
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value)}
            placeholder="Precision-cut wrap designed to elevate your everyday carry. Scratch defense without bulk, tactile grip, and a seamless edge-to-edge fit..."
            className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-400/20 leading-relaxed"
          />
          <p className="text-[10px] text-zinc-500">
            Displayed on the storefront product page adjacent to the device skin configurator.
          </p>
        </div>

        {/* Field 2: SEO Meta Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="prod-seo-title"
              className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-blue-500" />
              <span>SEO Meta Title</span>
            </label>
            <div className="flex items-center gap-2.5">
              <span className={clsx('text-[11px] font-mono', getLengthIndicator(seoTitle.length, 40, 60))}>
                {seoTitle.length}/60 chars (ideal: 45 to 60)
              </span>
              <button
                type="button"
                onClick={() => handleRegenerateSingleField('seo_title')}
                disabled={isGeneratingAi || isSaving}
                className="h-7 inline-flex items-center gap-1 px-2.5 rounded-md text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/60 transition cursor-pointer disabled:opacity-40"
              >
                {activeGeneratingField === 'seo_title' ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#f3aa18]" />
                ) : (
                  <RotateCw className="w-3 h-3 text-[#f3aa18]" />
                )}
                <span>Rewrite</span>
              </button>
            </div>
          </div>
          <input
            id="prod-seo-title"
            type="text"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder="iPhone 16 Pro Max Skin & Wrap | Exacoat"
            className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-400/20 font-medium"
          />
          <p className="text-[10px] text-zinc-500">
            Primary title used in Google search results and browser tabs. Keep under 60 characters to prevent truncation.
          </p>
        </div>

        {/* Field 3: SEO Meta Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="prod-seo-desc"
              className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-blue-500" />
              <span>SEO Meta Description</span>
            </label>
            <div className="flex items-center gap-2.5">
              <span className={clsx('text-[11px] font-mono', getLengthIndicator(seoDesc.length, 120, 155))}>
                {seoDesc.length}/155 chars (ideal: 120 to 155)
              </span>
              <button
                type="button"
                onClick={() => handleRegenerateSingleField('seo_desc')}
                disabled={isGeneratingAi || isSaving}
                className="h-7 inline-flex items-center gap-1 px-2.5 rounded-md text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/60 transition cursor-pointer disabled:opacity-40"
              >
                {activeGeneratingField === 'seo_desc' ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#f3aa18]" />
                ) : (
                  <RotateCw className="w-3 h-3 text-[#f3aa18]" />
                )}
                <span>Rewrite</span>
              </button>
            </div>
          </div>
          <textarea
            id="prod-seo-desc"
            rows={2}
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            placeholder="Elevate your device with precision-engineered textured skins. Everyday scratch defense without bulk, laser-measured fit, and residue-free removal."
            className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-400/20 leading-relaxed"
          />
          <p className="text-[10px] text-zinc-500">
            Summary snippet displayed under the blue title link on Google. Keep between 120 and 155 characters.
          </p>
        </div>

        {/* Field 4: Focus Keyword */}
        <div className="space-y-1.5">
          <label
            htmlFor="prod-focus-kw"
            className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
            <span>Focus Search Keyword</span>
          </label>
          <input
            id="prod-focus-kw"
            type="text"
            value={focusKeyword}
            onChange={(e) => setFocusKeyword(e.target.value)}
            placeholder="e.g. iPhone 16 Pro Max skin"
            className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-400/20"
          />
          <p className="text-[10px] text-zinc-500">
            Target search query used by Yoast SEO and Rank Math content analysis algorithms.
          </p>
        </div>
      </div>
    </Modal>
  );
};
