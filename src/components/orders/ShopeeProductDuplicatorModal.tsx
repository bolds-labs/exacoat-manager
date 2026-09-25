import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  fetchShopeeProductPreviewDirect,
  uploadShopeeMediaImageDirect,
  duplicateShopeeProductDirect,
  ShopeeProductPreview,
  ShopeeDuplicateResult,
  ShopeeListingItem,
} from '../../lib/wordpressBridge';
import { ShopeeImageInjectorModal } from './ShopeeImageInjectorModal';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../lib/formatters';
import { Modal } from '../ui/Modal';
import {
  Copy,
  Check,
  ExternalLink,
  Loader2,
  X,
  Upload,
  Layers,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ShopeeProductDuplicatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrlOrId?: string;
  initialTargetDevice?: string;
  preloadedImages?: Array<{ file?: File; base64?: string; name: string; previewUrl: string }>;
}

const DEFAULT_SAMPLE_URL =
  'https://shopee.co.id/-EXACOAT-iPhone-17-Pro-Max-Premium-3M-Skin-Garskin-Model-360-i.102088236.25597461368';

const EMPTY_PRELOADED_IMAGES: Array<{ file?: File; base64?: string; name: string; previewUrl: string }> = [];

export const ShopeeProductDuplicatorModal: React.FC<ShopeeProductDuplicatorModalProps> = ({
  isOpen,
  onClose,
  initialUrlOrId = DEFAULT_SAMPLE_URL,
  initialTargetDevice = 'iPhone 18 Pro Max',
  preloadedImages = EMPTY_PRELOADED_IMAGES,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [sourceInput, setSourceInput] = useState<string>(initialUrlOrId);
  const [sourceDevice, setSourceDevice] = useState<string>('iPhone 17 Pro Max');
  const [targetDevice, setTargetDevice] = useState<string>(initialTargetDevice);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [customDesc, setCustomDesc] = useState<string>('');
  const [isEditingDesc, setIsEditingDesc] = useState<boolean>(false);

  // Data & Execution State
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [preview, setPreview] = useState<ShopeeProductPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<'source' | 'custom'>('source');
  const [customImages, setCustomImages] = useState<
    Array<{
      id: string;
      image_id?: string;
      url: string;
      name: string;
      file?: File;
      base64?: string;
      isUploading?: boolean;
    }>
  >([]);

  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);
  const [duplicationStep, setDuplicationStep] = useState<
    'idle' | 'uploading_images' | 'creating_draft' | 'init_variations' | 'done' | 'error'
  >('idle');
  const [duplicateResult, setDuplicateResult] = useState<ShopeeDuplicateResult | null>(null);
  const [isInjectorOpen, setIsInjectorOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sourceInputRef = useRef<string>(sourceInput);
  sourceInputRef.current = sourceInput;
  const prevOpenRef = useRef<boolean>(false);
  const loadedInputRef = useRef<string | null>(null);

  // Fetch product preview from Shopee
  const handleFetchPreview = useCallback(
    async (inputOverride?: string) => {
      const targetInput = (inputOverride !== undefined ? inputOverride : sourceInputRef.current).trim();
      if (!targetInput) {
        showToast('error', 'Input Required', 'Please enter a Shopee Item ID or product page URL.');
        return;
      }

      setIsLoadingPreview(true);
      setPreviewError(null);
      setErrorMessage(null);
      setDuplicateResult(null);

      try {
        const res = await fetchShopeeProductPreviewDirect(targetInput);
        if (res.success && res.item_id) {
          setPreview(res);
          if (res.inferred_device) {
            setSourceDevice(res.inferred_device);
          }
          showToast('success', 'Product Loaded', `Loaded ${res.item_name} with ${res.models?.length || 0} variations.`);
        } else {
          const errMsg = res.error || res.message || 'Could not fetch product information from Shopee API.';
          setPreviewError(errMsg);
          setPreview(null);
          showToast('error', 'Failed to Load Product', errMsg);
        }
      } catch (err: any) {
        const errMsg = err.message || 'Network error fetching Shopee product preview.';
        setPreviewError(errMsg);
        setPreview(null);
        showToast('error', 'Shopee API Error', errMsg);
      } finally {
        setIsLoadingPreview(false);
      }
    },
    [showToast]
  );

  const handleFetchPreviewRef = useRef(handleFetchPreview);
  handleFetchPreviewRef.current = handleFetchPreview;

  // Sync initial inputs on open (strictly once per modal session)
  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      loadedInputRef.current = null;
      return;
    }

    const initial = (initialUrlOrId || DEFAULT_SAMPLE_URL).trim();
    const isFirstOpen = !prevOpenRef.current;
    prevOpenRef.current = true;

    if (isFirstOpen || loadedInputRef.current !== initial) {
      loadedInputRef.current = initial;
      setSourceInput(initial);
      setTargetDevice(initialTargetDevice);
      setDuplicateResult(null);
      setDuplicationStep('idle');
      setErrorMessage(null);
      setPreviewError(null);

      // Ingest preloaded images from marketplace generator if supplied
      if (preloadedImages && preloadedImages.length > 0) {
        setCustomImages(
          preloadedImages.map((img, idx) => ({
            id: `preload_${Date.now()}_${idx}`,
            url: img.previewUrl,
            name: img.name,
            file: img.file,
            base64: img.base64,
          }))
        );
        setImageMode('custom');
      }

      if (initial) {
        handleFetchPreviewRef.current(initial);
      }
    }
  }, [isOpen, initialUrlOrId, initialTargetDevice, preloadedImages]);

  // Auto-calculated computed title
  const computedTitle = useMemo(() => {
    if (isEditingTitle && customTitle.trim()) {
      return customTitle.trim();
    }
    if (!preview?.item_name) return '';
    if (!sourceDevice.trim() || !targetDevice.trim()) return preview.item_name;
    const regex = new RegExp(sourceDevice.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return preview.item_name.replace(regex, targetDevice.trim());
  }, [preview, sourceDevice, targetDevice, isEditingTitle, customTitle]);

  // Auto-calculated computed description
  const computedDesc = useMemo(() => {
    if (isEditingDesc && customDesc.trim()) {
      return customDesc.trim();
    }
    if (!preview?.description) return '';
    if (!sourceDevice.trim() || !targetDevice.trim()) return preview.description;
    const regex = new RegExp(sourceDevice.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return preview.description.replace(regex, targetDevice.trim());
  }, [preview, sourceDevice, targetDevice, isEditingDesc, customDesc]);

  // Handle local image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newEntries: Array<{
      id: string;
      url: string;
      name: string;
      file: File;
    }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = URL.createObjectURL(file);
      newEntries.push({
        id: `local_${Date.now()}_${i}`,
        url: previewUrl,
        name: file.name,
        file,
      });
    }

    setCustomImages((prev) => [...prev, ...newEntries]);
    setImageMode('custom');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveCustomImage = (id: string) => {
    setCustomImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Execute Duplication Pipeline
  const handleDuplicateProduct = async () => {
    if (!preview || !preview.item_id) {
      showToast('error', 'No Source Item', 'Please load a source Shopee listing first.');
      return;
    }
    if (!targetDevice.trim()) {
      showToast('error', 'Device Name Required', 'Please specify the target device name.');
      return;
    }

    setIsDuplicating(true);
    setErrorMessage(null);
    setDuplicationStep('uploading_images');

    let stepTimer: NodeJS.Timeout | null = null;

    try {
      const uploadedShopeeImageIds: string[] = [];

      // Step 1: Upload custom images if selected
      if (imageMode === 'custom' && customImages.length > 0) {
        for (const img of customImages) {
          if (img.image_id) {
            uploadedShopeeImageIds.push(img.image_id);
            continue;
          }

          let uploadRes;
          if (img.file) {
            uploadRes = await uploadShopeeMediaImageDirect({ file: img.file, filename: img.name });
          } else if (img.base64) {
            uploadRes = await uploadShopeeMediaImageDirect({ base64: img.base64, filename: img.name });
          }

          if (uploadRes?.success && uploadRes.image_id) {
            uploadedShopeeImageIds.push(uploadRes.image_id);
          }
        }
      }

      // Step 2: Create base product in UNLIST (draft) status and init variations
      setDuplicationStep('creating_draft');
      stepTimer = setTimeout(() => {
        setDuplicationStep('init_variations');
      }, 3500);

      const payload = {
        source_item_id: preview.item_id,
        source_device: sourceDevice.trim(),
        target_device: targetDevice.trim(),
        custom_item_name: computedTitle,
        custom_description: computedDesc,
        custom_image_ids: uploadedShopeeImageIds.length > 0 ? uploadedShopeeImageIds : undefined,
      };

      let result: ShopeeDuplicateResult;
      try {
        result = await duplicateShopeeProductDirect(payload);
      } finally {
        if (stepTimer) clearTimeout(stepTimer);
      }

      if (result.success && result.new_item_id) {
        setDuplicationStep('done');
        setDuplicateResult(result);
        const count = result.models_initialized || preview.models?.length || 0;
        showToast(
          'success',
          'Shopee Draft Created',
          `New listing #${result.new_item_id} created in unlisted status with ${count} variations.`
        );
        if (result.warning) {
          showToast('warning', 'Variation Notice', result.warning);
        }
      } else {
        setDuplicationStep('error');
        const err = result.error || 'Failed to create duplicate listing on Shopee.';
        setErrorMessage(err);
        showToast('error', 'Duplication Failed', err);
      }
    } catch (err: any) {
      if (stepTimer) clearTimeout(stepTimer);
      setDuplicationStep('error');
      const errText = err.message || 'Failed to complete Shopee listing duplication.';
      setErrorMessage(errText);
      showToast('error', 'Duplication Error', errText);
    } finally {
      setIsDuplicating(false);
    }
  };

  const modalHeader = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
        <Layers className="w-5 h-5" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-100">
            Shopee Listing Duplicator
          </h2>
          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Draft Mode (UNLIST)
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Clone active product details, variants, and pricing to a new device in unlisted draft status.
        </p>
      </div>
    </div>
  );

  const modalFooter = (
    <div className="flex items-center justify-between w-full">
      <div className="text-[11px] text-zinc-500">
        Target Shop ID: <span className="font-mono text-zinc-400">102088236</span> (Exacoat Official)
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isDuplicating}
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition disabled:opacity-40 cursor-pointer"
        >
          {duplicationStep === 'done' ? 'Close' : 'Cancel'}
        </button>
        {duplicationStep === 'done' ? (
          duplicateResult?.seller_centre_url ? (
            <a
              href={duplicateResult.seller_centre_url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-lg shadow-emerald-400/10 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in Seller Centre</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-lg shadow-emerald-400/10 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Done</span>
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={handleDuplicateProduct}
            disabled={isDuplicating || !preview || !targetDevice.trim()}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 transition shadow-lg shadow-amber-400/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isDuplicating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {duplicationStep === 'uploading_images'
                    ? 'Uploading Images...'
                    : duplicationStep === 'init_variations'
                    ? 'Initializing Variations...'
                    : 'Creating Draft...'}
                </span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Duplicate to Shopee (Draft)</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={modalHeader}
      footer={modalFooter}
    >
      <div className="space-y-6">
        {/* Step 1: Source Item Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="shopee-source-input" className="text-xs font-semibold text-zinc-300">
              1. Source Shopee Product (URL or Item ID)
            </label>
            <button
              type="button"
              onClick={() => {
                setSourceInput(DEFAULT_SAMPLE_URL);
                handleFetchPreview(DEFAULT_SAMPLE_URL);
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 transition underline cursor-pointer"
            >
              Use iPhone 17 Pro Max Sample
            </button>
          </div>
          <div className="flex gap-2">
            <input
              id="shopee-source-input"
              type="text"
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleFetchPreview();
                }
              }}
              placeholder="https://shopee.co.id/...-i.102088236.25597461368 or 25597461368"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
            />
            <button
              type="button"
              onClick={() => handleFetchPreview()}
              disabled={isLoadingPreview || isDuplicating}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 transition flex items-center gap-2 border border-zinc-700/60 disabled:opacity-50 cursor-pointer"
            >
              {isLoadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-zinc-400" />
                  <span>Fetch Details</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoadingPreview && (
          <div className="p-8 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
            <p className="text-xs font-medium text-zinc-300">
              Fetching Shopee item base info and variations...
            </p>
            <p className="text-[11px] text-zinc-500 font-mono">
              GET /api/v2/product/get_item_base_info
            </p>
          </div>
        )}

        {/* Error State */}
        {previewError && !isLoadingPreview && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-200">Unable to load source listing</p>
              <p className="text-[11px] text-rose-300/90">{previewError}</p>
              <button
                type="button"
                onClick={() => handleFetchPreview()}
                className="mt-2 text-[11px] font-semibold text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                Try fetching again
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Loaded Source Card */}
        {preview && !isLoadingPreview && (
          <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                {preview.images && preview.images[0] ? (
                  <img
                    src={preview.images[0].image_url}
                    alt={preview.item_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-zinc-600" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    ID: {preview.item_id}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-400">
                    Status: {preview.item_status}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-zinc-800 text-zinc-300">
                    {preview.models?.length || 0} Variations
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-zinc-200 line-clamp-1">
                  {preview.item_name}
                </h3>
                <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                  <span>Price: {formatCurrency(preview.models?.[0]?.original_price || 149000)}</span>
                  <span>Weight: {preview.weight || 0.05}kg</span>
                  <span>Category ID: {preview.category_id}</span>
                </div>
              </div>
            </div>

            {/* Step 3: Device Name Transformation Configuration */}
            <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="shopee-source-device" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                  Source Device Name (to replace)
                </label>
                <input
                  id="shopee-source-device"
                  type="text"
                  value={sourceDevice}
                  onChange={(e) => setSourceDevice(e.target.value)}
                  placeholder="e.g. iPhone 17 Pro Max"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60"
                />
                <p className="text-[10px] text-zinc-500">
                  Case-insensitive match in title, description, and model SKUs.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="shopee-target-device" className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  Target Device Name (new listing)
                </label>
                <input
                  id="shopee-target-device"
                  type="text"
                  value={targetDevice}
                  onChange={(e) => setTargetDevice(e.target.value)}
                  placeholder="e.g. iPhone 18 Pro Max"
                  className="w-full bg-zinc-900 border border-amber-500/40 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-amber-400/80">
                  Will replace occurrences of source device across the entire draft.
                </p>
              </div>
            </div>

            {/* Computed Title Preview */}
            <div className="pt-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-300">Generated Title Preview</span>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(!isEditingTitle)}
                  className="text-[10px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                >
                  {isEditingTitle ? 'Reset to Auto-computed' : 'Customize Title'}
                </button>
              </div>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={customTitle || computedTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              ) : (
                <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs font-medium text-emerald-300">
                  {computedTitle || 'No title computed'}
                </div>
              )}
            </div>

            {/* Image Mode Selection */}
            <div className="pt-3 border-t border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Product Images</span>
                <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setImageMode('source')}
                    className={clsx(
                      'px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer',
                      imageMode === 'source'
                        ? 'bg-amber-400 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    Keep Source ({preview.images?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('custom')}
                    className={clsx(
                      'px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer',
                      imageMode === 'custom'
                        ? 'bg-amber-400 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    Custom Images ({customImages.length})
                  </button>
                </div>
              </div>

              {imageMode === 'source' ? (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {preview.images?.map((img, idx) => (
                    <div
                      key={img.image_id || idx}
                      className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 relative group"
                    >
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] text-zinc-300 text-center py-0.5">
                        #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {customImages.map((img, idx) => (
                      <div
                        key={img.id}
                        className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shrink-0 relative group"
                      >
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomImage(img.id)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-zinc-300 hover:text-rose-400 transition"
                          title="Remove image"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] text-zinc-300 text-center py-0.5">
                          #{idx + 1}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl bg-zinc-900/60 border border-dashed border-zinc-700 hover:border-amber-400/60 text-zinc-400 hover:text-amber-400 flex flex-col items-center justify-center gap-1 transition shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[9px]">Add</span>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Duplication In-Progress Overlay/State */}
        {isDuplicating && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-amber-200">
                {duplicationStep === 'uploading_images' && 'Step 1/3: Uploading media images to Shopee...'}
                {duplicationStep === 'creating_draft' && 'Step 2/3: Creating unlisted product draft on Shopee...'}
                {duplicationStep === 'init_variations' && 'Step 3/3: Initializing tier variations and model SKUs...'}
              </p>
              <p className="text-[11px] text-amber-400/80">
                This listing will be saved as UNLIST (Belum Ditampilkan) so you can review before publishing.
              </p>
            </div>
          </div>
        )}

        {/* Duplication Error Result */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-200">Duplication Failed</p>
              <p className="text-[11px] text-rose-300/90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Duplication Success Result */}
        {duplicateResult && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-semibold text-emerald-200">Shopee Draft Created Successfully</p>
                <p className="text-[11px] text-emerald-300/90">
                  New listing #{duplicateResult.new_item_id} prepared in unlisted draft status with {duplicateResult.models_initialized || preview?.models?.length || 0} variations.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsInjectorOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f3aa18] hover:bg-[#e09b15] text-zinc-950 font-bold text-xs transition cursor-pointer shadow-xs"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Auto-Inject Product Images</span>
              </button>
              {duplicateResult.seller_centre_url && (
                <a
                  href={duplicateResult.seller_centre_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Shopee Seller Centre (Belum Ditampilkan)</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setDuplicateResult(null);
                  setDuplicationStep('idle');
                  setTargetDevice('');
                  setCustomTitle('');
                  setIsEditingTitle(false);
                }}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Duplicate Another Device Model</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {duplicateResult && duplicateResult.new_item_id && (
        <ShopeeImageInjectorModal
          isOpen={isInjectorOpen}
          onClose={() => setIsInjectorOpen(false)}
          item={{
            item_id: duplicateResult.new_item_id,
            item_name: customTitle || computedTitle || `${targetDevice} Premium 3M Skin`,
            item_status: 'UNLIST',
            seller_centre_url: duplicateResult.seller_centre_url,
          }}
        />
      )}
    </Modal>
  );
};
