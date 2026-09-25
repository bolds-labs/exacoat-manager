import React, { useState, useEffect } from 'react';
import {
  Product,
  fetchProductSeoDirect,
  updateProductSeoDirect,
  generateProductSeoAndDescriptionAi,
  getCachedPluginSettings,
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
} from 'lucide-react';
import { clsx } from 'clsx';

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

  // Load SEO Metadata when product is opened
  useEffect(() => {
    if (!product || !isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    // Initial fallback from product object
    setShortDesc(product.short_description || '');

    // Extract existing metadata if present on product
    const metaList = Array.isArray(product.meta_data) ? product.meta_data : [];
    const getMeta = (keys: string[]) => {
      for (const k of keys) {
        const m = metaList.find((entry: any) => entry.key === k);
        if (m && typeof m.value === 'string' && m.value.trim()) return m.value.trim();
      }
      return '';
    };

    setSeoTitle(getMeta(['_yoast_wpseo_title', 'rank_math_title']) || `${product.name} Skin & Wrap | Exacoat`);
    setSeoDesc(getMeta(['_yoast_wpseo_metadesc', 'rank_math_description']));
    setFocusKeyword(getMeta(['_yoast_wpseo_focuskw', 'rank_math_focus_keyword']) || `${product.name} skin`);

    // Fetch latest fresh metadata from backend
    fetchProductSeoDirect(product.id)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          if (res.data.short_description !== undefined) {
            setShortDesc(res.data.short_description);
          }
          if (res.data.seo_title) {
            setSeoTitle(res.data.seo_title);
          }
          if (res.data.seo_description) {
            setSeoDesc(res.data.seo_description);
          }
          if (res.data.focus_keyword) {
            setFocusKeyword(res.data.focus_keyword);
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

  // AI Generation (All Fields)
  const handleGenerateAllWithAi = async () => {
    if (!product) return;
    setIsGeneratingAi(true);
    setActiveGeneratingField('all');

    const categoryName = product.categories?.[0]?.name || 'Skins';
    const res = await generateProductSeoAndDescriptionAi(product.name, categoryName, {
      provider: selectedProvider,
      model: selectedModel,
    });

    setIsGeneratingAi(false);
    setActiveGeneratingField(null);

    if (res.success && res.data) {
      if (res.data.seo_title) setSeoTitle(res.data.seo_title);
      if (res.data.seo_description) setSeoDesc(res.data.seo_description);
      if (res.data.focus_keyword) setFocusKeyword(res.data.focus_keyword);
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
    const res = await generateProductSeoAndDescriptionAi(product.name, categoryName, {
      provider: selectedProvider,
      model: selectedModel,
    });

    setActiveGeneratingField(null);

    if (res.success && res.data) {
      if (field === 'short_desc' && res.data.short_description) {
        setShortDesc(res.data.short_description);
      } else if (field === 'seo_title' && res.data.seo_title) {
        setSeoTitle(res.data.seo_title);
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
        showToast('success', 'SEO Saved', `Updated SEO and short description for ${product.name}.`);
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
      <div className="w-10 h-10 rounded-xl bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex items-center justify-center text-[#f3aa18] shrink-0">
        <Sparkles className="w-5 h-5" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            SEO & Short Description
          </h2>
          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            #{product.id}
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-40 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-neutral-950 bg-[#f3aa18] hover:bg-[#e09b15] transition shadow-md shadow-[#f3aa18]/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
      <div className="space-y-6">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin text-[#f3aa18]" />
            <span>Loading current SEO metadata from WordPress...</span>
          </div>
        )}

        {/* AI Generator Control Bar */}
        <div className="p-3.5 rounded-2xl bg-[#f3aa18]/10 border border-[#f3aa18]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#f3aa18]" />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                AI Differentiation Generator
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {selectedModel}
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Generates distinct, device-tailored copy using Exacoat brand voice and zero em dashes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Provider Switcher */}
            <div className="flex items-center p-1 bg-white/70 dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => handleProviderToggle('gemini')}
                className={clsx(
                  'min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1',
                  selectedProvider === 'gemini'
                    ? 'bg-[#f3aa18] text-neutral-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                )}
              >
                <span>Gemini</span>
              </button>
              <button
                type="button"
                onClick={() => handleProviderToggle('openai')}
                className={clsx(
                  'min-h-[44px] px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1',
                  selectedProvider === 'openai'
                    ? 'bg-[#f3aa18] text-neutral-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                )}
              >
                <span>OpenAI</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleGenerateAllWithAi}
              disabled={isGeneratingAi || isSaving}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isGeneratingAi && activeGeneratingField === 'all' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Copy...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate All with AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {aiLatencyMs !== null && (
          <div className="text-[11px] text-emerald-500 flex items-center gap-1.5 -mt-3 pl-1 font-mono">
            <Check className="w-3.5 h-3.5" />
            <span>
              Generated via {aiModelUsed} in {aiLatencyMs}ms. Review and adjust below before saving.
            </span>
          </div>
        )}

        {/* Google SERP Snippet Preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Google Search Results Preview (SERP)</span>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">exacoat.com</span>
              <span>›</span>
              <span>products</span>
              <span>›</span>
              <span className="font-mono">{product.slug || 'product-slug'}</span>
            </div>
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer line-clamp-1">
              {seoTitle || `${product.name} Skin & Wrap | Exacoat`}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
              {seoDesc ||
                shortDesc ||
                `Protect your ${product.name} with precision-engineered authentic 3M textured skins. Scratch defense without added bulk, laser-measured fit, and residue-free removal.`}
            </p>
          </div>
        </div>

        {/* Field 1: Short Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="prod-short-desc"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#f3aa18]" />
              <span>Short Description (On-Page Storefront Summary)</span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-500 font-mono">
                {wordCount} words | {shortDesc.length} chars
              </span>
              <button
                type="button"
                onClick={() => handleRegenerateSingleField('short_desc')}
                disabled={isGeneratingAi || isSaving}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#f3aa18] bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 border border-[#f3aa18]/30 transition cursor-pointer disabled:opacity-40"
              >
                {activeGeneratingField === 'short_desc' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCw className="w-3 h-3" />
                )}
                <span>AI Rewrite</span>
              </button>
            </div>
          </div>
          <textarea
            id="prod-short-desc"
            rows={3}
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value)}
            placeholder="Precision-cut 3M textured vinyl skin providing scratch defense with zero added bulk..."
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#f3aa18]/80 leading-relaxed"
          />
          <p className="text-[10px] text-zinc-500">
            Displayed on the storefront product page adjacent to the device skin configurator.
          </p>
        </div>

        {/* Field 2: SEO Meta Title */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="prod-seo-title"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>SEO Meta Title</span>
            </label>
            <div className="flex items-center gap-3">
              <span className={clsx('text-[11px] font-mono', getLengthIndicator(seoTitle.length, 40, 60))}>
                {seoTitle.length}/60 chars (ideal: 45 to 60)
              </span>
              <button
                type="button"
                onClick={() => handleRegenerateSingleField('seo_title')}
                disabled={isGeneratingAi || isSaving}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#f3aa18] bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 border border-[#f3aa18]/30 transition cursor-pointer disabled:opacity-40"
              >
                {activeGeneratingField === 'seo_title' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCw className="w-3 h-3" />
                )}
                <span>AI Rewrite</span>
              </button>
            </div>
          </div>
          <input
            id="prod-seo-title"
            type="text"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder="iPhone 16 Pro Max Skin & Wrap | Exacoat"
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#f3aa18]/80 font-medium"
          />
          <p className="text-[10px] text-zinc-500">
            Primary title used in Google search results and browser tabs. Keep under 60 characters to prevent truncation.
          </p>
        </div>

        {/* Field 3: SEO Meta Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="prod-seo-desc"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>SEO Meta Description</span>
            </label>
            <div className="flex items-center gap-3">
              <span className={clsx('text-[11px] font-mono', getLengthIndicator(seoDesc.length, 120, 155))}>
                {seoDesc.length}/155 chars (ideal: 120 to 155)
              </span>
              <button
                type="button"
                onClick={() => handleRegenerateSingleField('seo_desc')}
                disabled={isGeneratingAi || isSaving}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#f3aa18] bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 border border-[#f3aa18]/30 transition cursor-pointer disabled:opacity-40"
              >
                {activeGeneratingField === 'seo_desc' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCw className="w-3 h-3" />
                )}
                <span>AI Rewrite</span>
              </button>
            </div>
          </div>
          <textarea
            id="prod-seo-desc"
            rows={2}
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            placeholder="Protect your device with precision-engineered 3M textured skins. Scratch defense without bulk, laser-measured fit, and residue-free removal."
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#f3aa18]/80 leading-relaxed"
          />
          <p className="text-[10px] text-zinc-500">
            Summary snippet displayed under the blue title link on Google. Keep between 120 and 155 characters.
          </p>
        </div>

        {/* Field 4: Focus Keyword */}
        <div className="space-y-2">
          <label
            htmlFor="prod-focus-kw"
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Focus Search Keyword</span>
          </label>
          <input
            id="prod-focus-kw"
            type="text"
            value={focusKeyword}
            onChange={(e) => setFocusKeyword(e.target.value)}
            placeholder="e.g. iPhone 16 Pro Max skin"
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#f3aa18]/80"
          />
          <p className="text-[10px] text-zinc-500">
            Target search query used by Yoast SEO and Rank Math content analysis algorithms.
          </p>
        </div>
      </div>
    </Modal>
  );
};
