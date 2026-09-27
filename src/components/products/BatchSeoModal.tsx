import React, { useState, useEffect, useMemo } from 'react';
import {
  Product,
  updateProductSeoDirect,
  generateProductSeoAndDescriptionAi,
  getCachedPluginSettings,
  revalidateStorefrontWebDirect,
  fetchProductsDirect,
} from '../../lib/wordpressBridge';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Sparkles,
  Wand2,
  FileCheck2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Smartphone,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  normalizeDeviceName,
  buildCanonicalSeoTitle,
  cleanRedundantSeoTitle,
  buildCanonicalFocusKeyword,
  cleanSeoCopy,
  hasBoilerplateTokens,
} from '../../lib/seoUtils';

interface BatchSeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  totalCatalogProducts?: number;
  onProductsUpdated: (updatedProducts: Product[]) => void;
}

export interface DeviceOptimizationInfo {
  isOptimized: boolean;
  reasons: string[];
}

export function checkProductOptimizationStatus(prod: Product): DeviceOptimizationInfo {
  const reasons: string[] = [];
  const rawShort = prod.short_description || '';
  const rawName = prod.name || '';

  if (hasBoilerplateTokens(rawShort)) {
    if (/\[product_name\]/i.test(rawShort)) reasons.push('[product_name] tag');
    if (/<a\b/i.test(rawShort)) reasons.push('Raw <a> HTML');
    if (/<em>/i.test(rawShort)) reasons.push('Raw <em> tags');
    if (/[\u2014\u2013]|--/.test(rawShort)) reasons.push('Em or en dashes');
    if (/\bskins?\s+skin\b/i.test(rawShort)) reasons.push('Redundant "skins skin"');
  }

  if (/\bskins?\s+skin\b/i.test(rawName)) {
    reasons.push('Title has "Skins Skin"');
  }

  const metaList = Array.isArray(prod.meta_data) ? prod.meta_data : [];
  const getMeta = (keys: string[]) => {
    for (const k of keys) {
      const m = metaList.find((entry: any) => entry.key === k);
      if (m && typeof m.value === 'string' && m.value.trim()) return m.value.trim();
    }
    return '';
  };

  const seoTitle = getMeta(['_yoast_wpseo_title', 'rank_math_title']);
  const seoDesc = getMeta(['_yoast_wpseo_metadesc', 'rank_math_description']);

  if (!seoTitle) {
    reasons.push('Missing SEO Title');
  } else if (hasBoilerplateTokens(seoTitle)) {
    reasons.push('SEO Title boilerplate');
  }

  if (!seoDesc && !rawShort) {
    reasons.push('Missing SEO Description');
  } else if (seoDesc && hasBoilerplateTokens(seoDesc)) {
    reasons.push('SEO Desc boilerplate');
  }

  return {
    isOptimized: reasons.length === 0,
    reasons,
  };
}

export const BatchSeoModal: React.FC<BatchSeoModalProps> = ({
  isOpen,
  onClose,
  products,
  totalCatalogProducts = 0,
  onProductsUpdated,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'clean' | 'ai'>('clean');

  // Device list management
  const [deviceList, setDeviceList] = useState<Product[]>(products);
  const [isLoadingAllDevices, setIsLoadingAllDevices] = useState(false);
  const [knownTotalCatalog, setKnownTotalCatalog] = useState<number>(totalCatalogProducts || products.length);

  // Sync initial products when opened or prop updates
  useEffect(() => {
    if (products.length > 0 && deviceList.length <= products.length) {
      setDeviceList(products);
    }
  }, [products]);

  useEffect(() => {
    if (totalCatalogProducts > 0) {
      setKnownTotalCatalog(totalCatalogProducts);
    }
  }, [totalCatalogProducts]);

  // Filtering states for device list view
  const [listFilter, setListFilter] = useState<'all' | 'needs_optimization' | 'optimized'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetScope, setTargetScope] = useState<'unoptimized_only' | 'all'>('unoptimized_only');

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

  // Fetch all products across all WooCommerce pages
  const handleLoadAllCatalogDevices = async () => {
    setIsLoadingAllDevices(true);
    try {
      let page = 1;
      let all: Product[] = [];
      let maxPages = 1;
      let totalCount = 0;

      while (page <= maxPages) {
        const res = await fetchProductsDirect({
          page,
          per_page: 100,
          status: 'publish',
        });

        if (res.success && Array.isArray(res.products) && res.products.length > 0) {
          all = [...all, ...res.products];
          maxPages = res.max_pages || 1;
          totalCount = res.total_products || all.length;
          page++;
        } else {
          break;
        }
      }

      if (all.length > 0) {
        setDeviceList(all);
        setKnownTotalCatalog(totalCount || all.length);
        showToast('success', 'Catalog Loaded', `Fetched all ${all.length} devices from WooCommerce store.`);
      } else {
        showToast('error', 'Fetch Notice', 'No additional devices returned.');
      }
    } catch (err: any) {
      showToast('error', 'Catalog Fetch Failed', err.message || 'Could not fetch catalog devices.');
    } finally {
      setIsLoadingAllDevices(false);
    }
  };

  // Pre-calculate optimization statuses for all loaded devices
  const deviceStatusMap = useMemo(() => {
    const map = new Map<number, DeviceOptimizationInfo>();
    deviceList.forEach((prod) => {
      map.set(prod.id, checkProductOptimizationStatus(prod));
    });
    return map;
  }, [deviceList]);

  // Aggregate counts
  const totalLoaded = deviceList.length;
  const unoptimizedProducts = useMemo(
    () => deviceList.filter((p) => !deviceStatusMap.get(p.id)?.isOptimized),
    [deviceList, deviceStatusMap]
  );
  const optimizedProducts = useMemo(
    () => deviceList.filter((p) => deviceStatusMap.get(p.id)?.isOptimized),
    [deviceList, deviceStatusMap]
  );

  // Filtered devices for preview table
  const displayedDevices = useMemo(() => {
    return deviceList.filter((prod) => {
      const status = deviceStatusMap.get(prod.id);
      if (listFilter === 'needs_optimization' && status?.isOptimized) return false;
      if (listFilter === 'optimized' && !status?.isOptimized) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = prod.name.toLowerCase().includes(query);
        const slugMatch = prod.slug.toLowerCase().includes(query);
        return nameMatch || slugMatch;
      }
      return true;
    });
  }, [deviceList, deviceStatusMap, listFilter, searchQuery]);

  // Determine which queue to run
  const activeQueue = useMemo(() => {
    if (targetScope === 'unoptimized_only') {
      return unoptimizedProducts;
    }
    return deviceList;
  }, [targetScope, unoptimizedProducts, deviceList]);

  // Action 1: Fast Deterministic Batch Clean
  const handleRunBatchClean = async () => {
    if (activeQueue.length === 0) {
      showToast('info', 'No Devices to Process', 'All selected devices are already optimized.');
      return;
    }
    setIsProcessing(true);
    setProcessedCount(0);
    setTotalToProcess(activeQueue.length);
    setCancelRequested(false);

    let updatedProductsList = [...deviceList];
    let successCount = 0;

    for (let i = 0; i < activeQueue.length; i++) {
      if (cancelRequested) break;
      const prod = activeQueue[i];
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
                  meta_data: [
                    ...metaList.filter(
                      (m: any) =>
                        m.key !== '_yoast_wpseo_title' &&
                        m.key !== 'rank_math_title' &&
                        m.key !== '_yoast_wpseo_metadesc' &&
                        m.key !== 'rank_math_description' &&
                        m.key !== '_yoast_wpseo_focuskw' &&
                        m.key !== 'rank_math_focus_keyword'
                    ),
                    { key: '_yoast_wpseo_title', value: finalTitle },
                    { key: 'rank_math_title', value: finalTitle },
                    { key: '_yoast_wpseo_metadesc', value: finalDesc },
                    { key: 'rank_math_description', value: finalDesc },
                    { key: '_yoast_wpseo_focuskw', value: finalKw },
                    { key: 'rank_math_focus_keyword', value: finalKw },
                  ],
                }
              : p
          );
        }
      } catch {}

      setProcessedCount(i + 1);
    }

    setDeviceList(updatedProductsList);
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
    if (activeQueue.length === 0) {
      showToast('info', 'No Devices to Process', 'All selected devices are already optimized.');
      return;
    }
    setIsProcessing(true);
    setProcessedCount(0);
    setTotalToProcess(activeQueue.length);
    setCancelRequested(false);

    let updatedProductsList = [...deviceList];
    let successCount = 0;

    for (let i = 0; i < activeQueue.length; i++) {
      if (cancelRequested) break;
      const prod = activeQueue[i];
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
            const metaList = Array.isArray(prod.meta_data) ? prod.meta_data : [];
            updatedProductsList = updatedProductsList.map((p) =>
              p.id === prod.id
                ? {
                    ...p,
                    short_description: aiRes.data?.short_description,
                    meta_data: [
                      ...metaList.filter(
                        (m: any) =>
                          m.key !== '_yoast_wpseo_title' &&
                          m.key !== 'rank_math_title' &&
                          m.key !== '_yoast_wpseo_metadesc' &&
                          m.key !== 'rank_math_description' &&
                          m.key !== '_yoast_wpseo_focuskw' &&
                          m.key !== 'rank_math_focus_keyword'
                      ),
                      { key: '_yoast_wpseo_title', value: aiRes.data?.seo_title },
                      { key: 'rank_math_title', value: aiRes.data?.seo_title },
                      { key: '_yoast_wpseo_metadesc', value: aiRes.data?.seo_description },
                      { key: 'rank_math_description', value: aiRes.data?.seo_description },
                      { key: '_yoast_wpseo_focuskw', value: aiRes.data?.focus_keyword },
                      { key: 'rank_math_focus_keyword', value: aiRes.data?.focus_keyword },
                    ],
                  }
                : p
            );
          }
        }
      } catch {}

      setProcessedCount(i + 1);
    }

    setDeviceList(updatedProductsList);
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

  const hasUnloadedCatalogDevices = knownTotalCatalog > deviceList.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isProcessing) onClose();
      }}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#f3aa18]/10 text-[#f3aa18]">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Batch Webstore SEO & Copy Optimizer
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Normalize device titles, resolve boilerplate placeholders, and optimize SEO copy.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Catalog Diagnostics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Loaded Card */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-500">Loaded Webstore Devices</span>
                {hasUnloadedCatalogDevices && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Page 1 only
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  {totalLoaded}
                </span>
                <span className="text-xs text-zinc-400">
                  {knownTotalCatalog > totalLoaded ? `of ${knownTotalCatalog} catalog devices` : 'devices'}
                </span>
              </div>
            </div>

            {hasUnloadedCatalogDevices && (
              <button
                type="button"
                onClick={handleLoadAllCatalogDevices}
                disabled={isLoadingAllDevices || isProcessing}
                className="mt-3 w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-[#f3aa18]/10 hover:bg-[#f3aa18]/20 text-[#f3aa18] text-xs font-semibold border border-[#f3aa18]/30 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isLoadingAllDevices ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading All Devices...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Fetch All {knownTotalCatalog || 300} Devices</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Needs Optimization Card */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[11px] font-semibold text-amber-500 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Needs Optimization</span>
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-400 font-mono">
                {unoptimizedProducts.length}
              </span>
              <span className="text-xs text-amber-300/80">devices flagged</span>
            </div>
            <p className="text-[11px] text-amber-400/80 mt-1">
              Unresolved placeholders, HTML tags, or missing meta titles
            </p>
          </div>

          {/* Optimized Card */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Optimized Devices</span>
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400 font-mono">
                {optimizedProducts.length}
              </span>
              <span className="text-xs text-emerald-300/80">devices clean</span>
            </div>
            <p className="text-[11px] text-emerald-400/80 mt-1">
              Zero boilerplate, canonical title, and clean focus keyword
            </p>
          </div>
        </div>

        {/* Tab Navigation: Quick Clean vs AI Differentiation (Tab 3 removed) */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('clean')}
            disabled={isProcessing}
            className={clsx(
              'min-h-[44px] flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2',
              activeTab === 'clean'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            <Wand2 className="w-4 h-4 text-amber-500" />
            <span>1. Quick Clean & Resolve Boilerplate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            disabled={isProcessing}
            className={clsx(
              'min-h-[44px] flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2',
              activeTab === 'ai'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            <Sparkles className="w-4 h-4 text-[#f3aa18]" />
            <span>2. AI Batch Differentiation</span>
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

        {/* Interactive Device Roster with Optimized / Unoptimized Marks */}
        <div className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                Device Optimization Status Ledger
              </span>
              <p className="text-[11px] text-zinc-500">
                Showing {displayedDevices.length} of {totalLoaded} loaded devices.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setListFilter('all')}
                className={clsx(
                  'min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer',
                  listFilter === 'all'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/40'
                )}
              >
                All ({totalLoaded})
              </button>
              <button
                type="button"
                onClick={() => setListFilter('needs_optimization')}
                className={clsx(
                  'min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5',
                  listFilter === 'needs_optimization'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                    : 'text-amber-400/80 hover:text-amber-300 bg-amber-500/10'
                )}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Needs Work ({unoptimizedProducts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setListFilter('optimized')}
                className={clsx(
                  'min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5',
                  listFilter === 'optimized'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                    : 'text-emerald-400/80 hover:text-emerald-300 bg-emerald-500/10'
                )}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Optimized ({optimizedProducts.length})</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search devices by name or slug..."
              className="w-full min-h-[38px] pl-9 pr-9 py-1.5 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden focus:border-[#f3aa18]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Scrollable Device Items Table */}
          <div className="max-h-60 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {displayedDevices.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                No devices match the current filter or search query.
              </div>
            ) : (
              displayedDevices.map((prod) => {
                const status = deviceStatusMap.get(prod.id);
                const isOpt = status?.isOptimized;
                return (
                  <div
                    key={prod.id}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-400 shrink-0 mt-0.5">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                          {prod.name}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate block">
                          /products/{prod.slug}
                        </span>
                        {!isOpt && status?.reasons && status.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {status.reasons.map((r, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center self-end sm:self-center">
                      {isOpt ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Optimized</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Needs Work</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* TAB 1: QUICK CLEAN & RESOLVE */}
        {activeTab === 'clean' && !isProcessing && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 text-sm">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>Automated Deterministic Resolution:</span>
              </p>
              <ul className="space-y-2 list-disc pl-5 text-zinc-500 dark:text-zinc-400">
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Normalizes Redundant Titles:</strong> Removes repeated &quot;Skins Skin & Wrap&quot; phrasing to canonical brand formula.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Resolves Template Placeholders:</strong> Replaces <code className="text-amber-400">[product_name]</code> with the exact device name.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Strips Raw HTML & Links:</strong> Strips <code className="text-amber-400">&lt;a&gt;</code> and <code className="text-amber-400">&lt;em&gt;</code> markup for clean Google snippet indexing.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Antislop Typography:</strong> Enforces zero em dashes and zero double hyphens across all titles and descriptions.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-200">Dual SEO Sync:</strong> Updates Yoast SEO and Rank Math simultaneously alongside WooCommerce descriptions.
                </li>
              </ul>
            </div>

            {/* Scope Selection & Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium">Batch Scope:</span>
                <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setTargetScope('unoptimized_only')}
                    className={clsx(
                      'min-h-[32px] px-3 py-1 rounded text-xs font-semibold transition cursor-pointer',
                      targetScope === 'unoptimized_only'
                        ? 'bg-amber-500 text-neutral-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    Unoptimized Only ({unoptimizedProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetScope('all')}
                    className={clsx(
                      'min-h-[32px] px-3 py-1 rounded text-xs font-semibold transition cursor-pointer',
                      targetScope === 'all'
                        ? 'bg-[#f3aa18] text-neutral-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    All Loaded ({deviceList.length})
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunBatchClean}
                disabled={activeQueue.length === 0}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold transition shadow-md shadow-[#f3aa18]/10 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Wand2 className="w-4 h-4" />
                <span>
                  Run Batch Clean ({activeQueue.length} devices)
                </span>
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
                Generates distinct, device-tailored copy for each product using Exacoat brand voice (lifestyle-first, precision fit, confident grip, zero em dashes).
              </p>

              <div className="pt-2 flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Select AI Provider:</span>
                <div className="flex items-center p-1 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setProvider('gemini')}
                    className={clsx(
                      'min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
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
                      'min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
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

            {/* Scope Selection & Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium">Batch Scope:</span>
                <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setTargetScope('unoptimized_only')}
                    className={clsx(
                      'min-h-[32px] px-3 py-1 rounded text-xs font-semibold transition cursor-pointer',
                      targetScope === 'unoptimized_only'
                        ? 'bg-amber-500 text-neutral-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    Unoptimized Only ({unoptimizedProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetScope('all')}
                    className={clsx(
                      'min-h-[32px] px-3 py-1 rounded text-xs font-semibold transition cursor-pointer',
                      targetScope === 'all'
                        ? 'bg-[#f3aa18] text-neutral-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    All Loaded ({deviceList.length})
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunBatchAi}
                disabled={activeQueue.length === 0}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#f3aa18] hover:bg-[#e09b15] text-neutral-950 text-xs font-bold transition shadow-md shadow-[#f3aa18]/10 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  Start AI Generation ({activeQueue.length} devices)
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
