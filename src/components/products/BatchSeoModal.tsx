import React, { useState } from 'react';
import {
  Product,
  updateProductSeoDirect,
  generateProductSeoAndDescriptionAi,
  getCachedPluginSettings,
  revalidateStorefrontWebDirect,
} from '../../lib/wordpressBridge';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Sparkles,
  Wand2,
  FileCheck2,
  Download,
  Upload,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  normalizeDeviceName,
  buildCanonicalSeoTitle,
  cleanRedundantSeoTitle,
  buildCanonicalFocusKeyword,
  cleanSeoCopy,
  hasBoilerplateTokens,
  downloadSeoCatalogJson,
  ProductSeoExportRecord,
} from '../../lib/seoUtils';

interface BatchSeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductsUpdated: (updatedProducts: Product[]) => void;
}

export const BatchSeoModal: React.FC<BatchSeoModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductsUpdated,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'clean' | 'ai' | 'migration'>('clean');

  // Execution states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [currentProductName, setCurrentProductName] = useState('');
  const [cancelRequested, setCancelRequested] = useState(false);

  // Provider configuration
  const pluginSettings = getCachedPluginSettings();
  const [provider, setProvider] = useState<'gemini' | 'openai'>(
    (pluginSettings.fandom_provider || pluginSettings.ai_provider || 'gemini') as 'gemini' | 'openai'
  );

  // Stats calculation
  const totalProducts = products.length;
  const boilerplateProducts = products.filter((p) => {
    const rawShort = p.short_description || '';
    const rawTitle = p.name || '';
    return hasBoilerplateTokens(rawShort) || /\bskins?\s+skin\b/i.test(rawTitle);
  });

  // Action 1: Fast Deterministic Batch Clean
  const handleRunBatchClean = async () => {
    if (products.length === 0) return;
    setIsProcessing(true);
    setProcessedCount(0);
    setTotalToProcess(products.length);
    setCancelRequested(false);

    let updatedProductsList = [...products];
    let successCount = 0;

    for (let i = 0; i < products.length; i++) {
      if (cancelRequested) break;
      const prod = products[i];
      setCurrentProductName(prod.name);

      const cleanDevice = normalizeDeviceName(prod.name);
      const cleanedShort = cleanSeoCopy(prod.short_description || '', {
        deviceName: prod.name,
        productSlug: prod.slug,
      });

      // Extract existing meta or canonical defaults
      const metaList = Array.isArray(prod.meta_data) ? prod.meta_data : [];
      const getMeta = (keys: string[]) => {
        for (const k of keys) {
          const m = metaList.find((entry: any) => entry.key === k);
          if (m && typeof m.value === 'string' && m.value.trim()) return m.value.trim();
        }
        return '';
      };

      const rawTitle = getMeta(['_yoast_wpseo_title', 'rank_math_title']);
      const finalTitle = cleanRedundantSeoTitle(rawTitle || buildCanonicalSeoTitle(prod.name), prod.name);
      const rawDesc = getMeta(['_yoast_wpseo_metadesc', 'rank_math_description']);
      const finalDesc = cleanSeoCopy(rawDesc || cleanedShort, {
        deviceName: prod.name,
        productSlug: prod.slug,
      });
      const finalKw = buildCanonicalFocusKeyword(prod.name);

      try {
        const res = await updateProductSeoDirect(prod.id, {
          short_description: cleanedShort,
          seo_title: finalTitle,
          seo_description: finalDesc,
          focus_keyword: finalKw,
        });

        if (res.success) {
          successCount++;
          updatedProductsList = updatedProductsList.map((p) =>
            p.id === prod.id
              ? {
                  ...p,
                  short_description: cleanedShort,
                }
              : p
          );
        }
      } catch {}

      setProcessedCount(i + 1);
    }

    setIsProcessing(false);
    onProductsUpdated(updatedProductsList);

    if (successCount > 0) {
      revalidateStorefrontWebDirect({ purge_everything: true }).catch((err) =>
        console.warn('[BatchClean] Cache revalidation notice:', err)
      );
    }

    showToast(
      'success',
      'Batch Clean Complete',
      `Optimized ${successCount} products. Stripped HTML tags, resolved device names, and refreshed storefront cache.`
    );
  };

  // Action 2: Batch AI Differentiation
  const handleRunBatchAi = async () => {
    if (products.length === 0) return;
    setIsProcessing(true);
    setProcessedCount(0);
    setTotalToProcess(products.length);
    setCancelRequested(false);

    let updatedProductsList = [...products];
    let successCount = 0;

    for (let i = 0; i < products.length; i++) {
      if (cancelRequested) break;
      const prod = products[i];
      setCurrentProductName(prod.name);
      const cleanDevice = normalizeDeviceName(prod.name);
      const categoryName = prod.categories?.[0]?.name || 'Skins';

      try {
        const aiRes = await generateProductSeoAndDescriptionAi(cleanDevice, categoryName, {
          provider,
        });

        if (aiRes.success && aiRes.data) {
          const updateRes = await updateProductSeoDirect(prod.id, {
            short_description: aiRes.data.short_description || '',
            seo_title: cleanRedundantSeoTitle(aiRes.data.seo_title, prod.name),
            seo_description: aiRes.data.seo_description || '',
            focus_keyword: cleanRedundantSeoTitle(aiRes.data.focus_keyword, prod.name),
          });

          if (updateRes.success) {
            successCount++;
            updatedProductsList = updatedProductsList.map((p) =>
              p.id === prod.id
                ? {
                    ...p,
                    short_description: aiRes.data?.short_description,
                  }
                : p
            );
          }
        }
      } catch {}

      setProcessedCount(i + 1);
    }

    setIsProcessing(false);
    onProductsUpdated(updatedProductsList);

    if (successCount > 0) {
      revalidateStorefrontWebDirect({ purge_everything: true }).catch((err) =>
        console.warn('[BatchAI] Cache revalidation notice:', err)
      );
    }

    showToast(
      'success',
      'AI Batch Generation Complete',
      `Generated unique device SEO copy for ${successCount} products using ${provider}, and refreshed storefront cache.`
    );
  };

  // Action 3: Export Catalog JSON
  const handleExportJson = () => {
    const records: ProductSeoExportRecord[] = products.map((p) => {
      const metaList = Array.isArray(p.meta_data) ? p.meta_data : [];
      const getMeta = (keys: string[]) => {
        for (const k of keys) {
          const m = metaList.find((entry: any) => entry.key === k);
          if (m && typeof m.value === 'string' && m.value.trim()) return m.value.trim();
        }
        return '';
      };

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        clean_device_name: normalizeDeviceName(p.name),
        seo_title: cleanRedundantSeoTitle(getMeta(['_yoast_wpseo_title', 'rank_math_title']), p.name),
        seo_description: cleanSeoCopy(getMeta(['_yoast_wpseo_metadesc', 'rank_math_description']) || p.short_description || '', {
          deviceName: p.name,
          productSlug: p.slug,
        }),
        focus_keyword: buildCanonicalFocusKeyword(p.name),
        short_description: cleanSeoCopy(p.short_description || '', {
          deviceName: p.name,
          productSlug: p.slug,
        }),
        updated_at: new Date().toISOString(),
      };
    });

    downloadSeoCatalogJson(records, `exacoat-seo-catalog-${new Date().toISOString().slice(0, 10)}.json`);
    showToast('success', 'Catalog Exported', `Downloaded SEO records for ${records.length} products.`);
  };

  // Action 4: Import Catalog JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (!Array.isArray(json)) {
          showToast('error', 'Invalid File', 'Expected a JSON array of product SEO records.');
          return;
        }

        setIsProcessing(true);
        setProcessedCount(0);
        setTotalToProcess(json.length);
        let imported = 0;

        for (let i = 0; i < json.length; i++) {
          const item = json[i];
          if (!item.id && !item.slug) continue;

          // Match by id or slug in existing products
          const target = products.find((p) => p.id === item.id || (item.slug && p.slug === item.slug));
          if (target) {
            setCurrentProductName(target.name);
            await updateProductSeoDirect(target.id, {
              short_description: item.short_description || '',
              seo_title: item.seo_title || buildCanonicalSeoTitle(target.name),
              seo_description: item.seo_description || '',
              focus_keyword: item.focus_keyword || buildCanonicalFocusKeyword(target.name),
            });
            imported++;
          }
          setProcessedCount(i + 1);
        }

        setIsProcessing(false);
        showToast('success', 'Import Complete', `Successfully imported SEO metadata for ${imported} products.`);
      } catch (err: any) {
        setIsProcessing(false);
        showToast('error', 'Import Failed', err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isProcessing) onClose();
      }}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18]">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Batch Webstore SEO & Copy Optimizer
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Normalize device titles, resolve boilerplate placeholders, and manage Staging to Production migration.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Catalog Diagnostics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] font-semibold text-zinc-500">Loaded Webstore Products</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                {totalProducts}
              </span>
              <span className="text-xs text-zinc-400">devices</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[11px] font-semibold text-amber-500">Products with Boilerplate Tags</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-400 font-mono">
                {boilerplateProducts.length}
              </span>
              <span className="text-xs text-amber-300/80">contain [product_name] or &lt;a&gt;</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[11px] font-semibold text-emerald-500">Target Standard</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-sm font-semibold text-emerald-300">
                Canonical Brand Formula
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Zero em dashes and sub-60 char titles
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('clean')}
            disabled={isProcessing}
            className={clsx(
              'min-h-[44px] flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5',
              activeTab === 'clean'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-500" />
            <span>1. Quick Clean & Resolve Boilerplate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            disabled={isProcessing}
            className={clsx(
              'min-h-[44px] flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5',
              activeTab === 'ai'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#f3aa18]" />
            <span>2. AI Batch Differentiation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('migration')}
            disabled={isProcessing}
            className={clsx(
              'min-h-[44px] flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5',
              activeTab === 'migration'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span>3. Staging to Production Migration</span>
          </button>
        </div>

        {/* Progress Bar (Visible when processing) */}
        {isProcessing && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-200 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#f3aa18] animate-spin" />
                <span>Processing: {currentProductName}</span>
              </span>
              <span className="font-mono text-zinc-400">
                {processedCount} of {totalToProcess} ({Math.round((processedCount / (totalToProcess || 1)) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#f3aa18] h-full transition-all duration-300 rounded-full"
                style={{ width: `${(processedCount / (totalToProcess || 1)) * 100}%` }}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCancelRequested(true)}
                className="min-h-[44px] px-4 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
              >
                Stop After Current
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: QUICK CLEAN & RESOLVE */}
        {activeTab === 'clean' && !isProcessing && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 text-sm">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>What this automated action does for every product:</span>
              </p>
              <ul className="space-y-2 list-disc pl-5 text-zinc-500 dark:text-zinc-400">
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Normalizes Redundant Titles:</strong> Changes{' '}
                  <code className="text-rose-400">iPhone 18 Pro Skins Skin & Wrap | Exacoat</code> to{' '}
                  <code className="text-emerald-400">iPhone 18 Pro Skin & Wrap | Exacoat</code>.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Resolves Template Placeholders:</strong> Replaces{' '}
                  <code className="text-rose-400">[product_name]</code> with the real device name (e.g.{' '}
                  <code className="text-emerald-400">iPhone 18 Pro</code>).
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Strips Raw HTML & Links:</strong> Removes{' '}
                  <code className="text-rose-400">&lt;a href="[geturl]"&gt;</code> and{' '}
                  <code className="text-rose-400">&lt;em&gt;</code> tags so Google search results show clean text.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Enforces Antislop Hygiene:</strong> Replaces all em dashes and en dashes with commas.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Dual SEO Sync:</strong> Updates both Yoast SEO (<code className="text-zinc-300">_yoast_wpseo_*</code>) and Rank Math (<code className="text-zinc-300">rank_math_*</code>) simultaneously alongside WooCommerce short descriptions.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500">
                Ready to optimize {totalProducts} products in WooCommerce.
              </span>
              <button
                type="button"
                onClick={handleRunBatchClean}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold transition shadow-md shadow-[#f3aa18]/10 cursor-pointer flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                <span>Run Batch Clean & Resolve All</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: AI BATCH DIFFERENTIATION */}
        {activeTab === 'ai' && !isProcessing && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-[#f3aa18]" />
                <span>AI Device Differentiation Batch Writer</span>
              </p>
              <p className="text-zinc-500 dark:text-zinc-400">
                Generates distinct, device-tailored copy for each product using Exacoat brand voice (lifestyle-first brand copy, precision fit, confident grip, zero em dashes).
              </p>

              <div className="pt-2 flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Select AI Provider:</span>
                <div className="flex items-center p-1 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setProvider('gemini')}
                    className={clsx(
                      'min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                      provider === 'gemini'
                        ? 'bg-[#f3aa18] text-neutral-950 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-200'
                    )}
                  >
                    Google Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('openai')}
                    className={clsx(
                      'min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                      provider === 'openai'
                        ? 'bg-[#f3aa18] text-neutral-950 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-200'
                    )}
                  >
                    OpenAI
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500">
                Processes products sequentially and saves directly to WooCommerce.
              </span>
              <button
                type="button"
                onClick={handleRunBatchAi}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold transition shadow-md shadow-[#f3aa18]/10 cursor-pointer flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Start AI Batch Generation</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: STAGING TO PRODUCTION MIGRATION */}
        {activeTab === 'migration' && !isProcessing && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-blue-400" />
                <span>How Exacoat SEO moves from Staging to Production</span>
              </p>
              <div className="space-y-3 text-zinc-500 dark:text-zinc-400">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Approach 1: Direct Database Push (Recommended)</span>
                  </div>
                  <p className="text-[11px]">
                    All SEO titles, descriptions, and excerpts are saved directly inside WordPress database tables (<code className="text-zinc-300">wp_posts</code> and <code className="text-zinc-300">wp_postmeta</code>). When you push staging to production via your standard database migration tool (e.g. WP Migrate DB, All-in-One WP Migration, or DB dump), all SEO metadata moves automatically.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Approach 2: Run Exacoat Manager on Production</span>
                  </div>
                  <p className="text-[11px]">
                    You can switch Exacoat Manager's target to your production URL (<code className="text-zinc-300">https://exacoat.com</code> in Settings or <code className="text-zinc-300">.env</code>). Then open this Batch SEO Optimizer and run "Batch Clean & Resolve All" directly on Production.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Approach 3: JSON Snapshot Export & Import</span>
                  </div>
                  <p className="text-[11px]">
                    Export your clean SEO metadata from Staging as a JSON file below. Later, upload that JSON file here when connected to Production to sync all products by SKU and slug instantly.
                  </p>
                </div>
              </div>
            </div>

            {/* Export & Import Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Export SEO Catalog (JSON)</span>
              </button>

              <label className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2">
                <Upload className="w-4 h-4 text-blue-400" />
                <span>Import SEO Catalog (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
