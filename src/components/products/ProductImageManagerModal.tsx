import React, { useState, useEffect, useRef } from 'react';
import {
  Product,
  updateProductDirect,
  uploadWordPressMediaDirect,
  fetchWordPressMedia,
  WpMediaItem,
  revalidateStorefrontWebDirect,
} from '../../lib/wordpressBridge';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Image as ImageIcon,
  Star,
  Trash2,
  Upload,
  Plus,
  Loader2,
  Check,
  Search,
  FolderOpen,
  ArrowUpLeft,
  X,
  Crop,
} from 'lucide-react';
import { clsx } from 'clsx';
import { ImageCropModal } from '../ui/ImageCropModal';
import { dataUrlToFile } from '../../lib/imageCropUtils';

interface ProductImageItem {
  id?: number;
  src: string;
  name?: string;
  alt?: string;
}

interface ProductImageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onUpdated: (updatedProduct: Product) => void;
}

export const ProductImageManagerModal: React.FC<ProductImageManagerModalProps> = ({
  isOpen,
  onClose,
  product,
  onUpdated,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropGalleryInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Gallery Cropping Queue State (3:4 1500x2000)
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropIndex, setCropIndex] = useState(0);
  const [currentCropObjectUrl, setCurrentCropObjectUrl] = useState('');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const accumulatedCroppedFiles = useRef<File[]>([]);

  // Existing image re-crop state
  const [singleCropTarget, setSingleCropTarget] = useState<{ img: ProductImageItem; index: number } | null>(null);

  // WordPress Media Library Drawer/Selector State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<WpMediaItem[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const optimizationMode = 'smart';

  // Sync images when product changes or modal opens
  useEffect(() => {
    if (!product || !isOpen) return;
    setImages(
      Array.isArray(product.images)
        ? product.images.map((img) => ({
            id: img.id,
            src: img.src,
            name: img.name,
            alt: img.alt,
          }))
        : []
    );
    setIsMediaPickerOpen(false);
  }, [product, isOpen]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (currentCropObjectUrl) {
        URL.revokeObjectURL(currentCropObjectUrl);
      }
    };
  }, [currentCropObjectUrl]);

  // Load WordPress Media Library
  const loadMediaLibrary = async (searchQuery = '') => {
    setIsLoadingMedia(true);
    try {
      const res = await fetchWordPressMedia({ search: searchQuery, per_page: 36 });
      if (res.success) {
        setMediaItems(res.items);
      } else {
        showToast('error', 'Media Error', res.error || 'Failed to load media library.');
      }
    } catch (err: any) {
      showToast('error', 'Media Error', err.message);
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const handleOpenMediaPicker = () => {
    setIsMediaPickerOpen(true);
    loadMediaLibrary(mediaSearch);
  };

  // Set an image as the featured image (move to index 0)
  const handleSetFeatured = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      return [item, ...copy];
    });
    showToast('info', 'Featured Image', 'Image moved to primary featured slot.');
  };

  // Remove an image from the list
  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Helper to upload a batch of files to WordPress Media and append to active images
  const uploadFilesToGallery = async (filesToUpload: File[], isCroppedGallery = false) => {
    if (!filesToUpload || filesToUpload.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedEntries: ProductImageItem[] = [];
      const uploadedWpItems: WpMediaItem[] = [];
      let totalOrigBytes = 0;
      let totalOptBytes = 0;

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const res = await uploadWordPressMediaDirect(file, {
          mode: optimizationMode,
          pngColors: 128,
          jpegQuality: 0.88,
        });
        if (res.success && res.url) {
          uploadedEntries.push({
            id: res.id,
            src: res.url,
            name: res.item?.filename || file.name,
          });
          if (res.item) {
            uploadedWpItems.push(res.item);
          }
          if (res.optimization) {
            totalOrigBytes += res.optimization.originalSize;
            totalOptBytes += res.optimization.optimizedSize;
          }
        } else {
          showToast('error', 'Upload Failed', res.error || `Failed to upload ${file.name}`);
        }
      }

      if (uploadedEntries.length > 0) {
        setImages((prev) => [...prev, ...uploadedEntries]);
        if (uploadedWpItems.length > 0) {
          setMediaItems((prev) => [...uploadedWpItems, ...prev]);
        }
        const savedPct =
          totalOrigBytes > 0 && totalOptBytes < totalOrigBytes
            ? Math.round(((totalOrigBytes - totalOptBytes) / totalOrigBytes) * 100)
            : 0;
        const savingsSuffix = savedPct > 0 ? ` (Optimized, saved ${savedPct}%)` : '';

        const titleText = isCroppedGallery ? '3:4 Gallery Uploaded' : 'Image Uploaded';
        const msgText = isCroppedGallery
          ? `Uploaded ${uploadedEntries.length} 3:4 (1500×2000) image(s) to gallery${savingsSuffix}.`
          : `Uploaded ${uploadedEntries.length} image(s) to gallery${savingsSuffix}.`;

        showToast('success', titleText, msgText);
      }
    } catch (err: any) {
      showToast('error', 'Upload Error', err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cropGalleryInputRef.current) cropGalleryInputRef.current.value = '';
    }
  };

  // Direct uncropped file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFilesToGallery(Array.from(files), false);
  };

  // 3:4 Gallery Upload: User selects files to crop & resize into 3:4 1500x2000
  const handleCropGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    accumulatedCroppedFiles.current = [];
    setCropQueue(fileList);
    setCropIndex(0);
    const objectUrl = URL.createObjectURL(fileList[0]);
    setCurrentCropObjectUrl(objectUrl);
    setIsCropModalOpen(true);
  };

  // Step to next image in crop queue, or finalize batch upload
  const handleCropModalComplete = (croppedDataUrl: string) => {
    if (cropQueue.length === 0) return;

    const currentFile = cropQueue[cropIndex];
    const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
    const cleanFileName = `${baseName}-1500x2000.jpg`;
    const croppedFile = dataUrlToFile(croppedDataUrl, cleanFileName, 'image/jpeg');

    accumulatedCroppedFiles.current.push(croppedFile);

    if (currentCropObjectUrl) {
      URL.revokeObjectURL(currentCropObjectUrl);
    }

    if (cropIndex + 1 < cropQueue.length) {
      const nextIndex = cropIndex + 1;
      setCropIndex(nextIndex);
      const nextObjectUrl = URL.createObjectURL(cropQueue[nextIndex]);
      setCurrentCropObjectUrl(nextObjectUrl);
    } else {
      setIsCropModalOpen(false);
      setCurrentCropObjectUrl('');
      const finalFiles = [...accumulatedCroppedFiles.current];
      accumulatedCroppedFiles.current = [];
      setCropQueue([]);
      setCropIndex(0);

      if (finalFiles.length > 0) {
        uploadFilesToGallery(finalFiles, true);
      }
    }
  };

  // Skip current photo in crop queue
  const handleCropModalSkip = () => {
    if (currentCropObjectUrl) {
      URL.revokeObjectURL(currentCropObjectUrl);
    }

    if (cropIndex + 1 < cropQueue.length) {
      const nextIndex = cropIndex + 1;
      setCropIndex(nextIndex);
      const nextObjectUrl = URL.createObjectURL(cropQueue[nextIndex]);
      setCurrentCropObjectUrl(nextObjectUrl);
    } else {
      setIsCropModalOpen(false);
      setCurrentCropObjectUrl('');
      const finalFiles = [...accumulatedCroppedFiles.current];
      accumulatedCroppedFiles.current = [];
      setCropQueue([]);
      setCropIndex(0);

      if (finalFiles.length > 0) {
        uploadFilesToGallery(finalFiles, true);
      }
    }
  };

  // Close/cancel crop queue modal
  const handleCropModalClose = () => {
    if (currentCropObjectUrl) {
      URL.revokeObjectURL(currentCropObjectUrl);
    }
    setIsCropModalOpen(false);
    setCurrentCropObjectUrl('');
    accumulatedCroppedFiles.current = [];
    setCropQueue([]);
    setCropIndex(0);
    if (cropGalleryInputRef.current) {
      cropGalleryInputRef.current.value = '';
    }
  };

  // Single existing image re-crop
  const handleStartSingleCrop = (img: ProductImageItem, index: number) => {
    setSingleCropTarget({ img, index });
  };

  const handleSingleCropComplete = async (croppedDataUrl: string) => {
    if (!singleCropTarget) return;

    const { img, index } = singleCropTarget;
    setSingleCropTarget(null);

    const baseName = (img.name || 'product-image').replace(/\.[^/.]+$/, '');
    const cleanFileName = `${baseName}-recrop-1500x2000.jpg`;
    const croppedFile = dataUrlToFile(croppedDataUrl, cleanFileName, 'image/jpeg');

    setIsUploading(true);
    try {
      const res = await uploadWordPressMediaDirect(croppedFile, {
        mode: optimizationMode,
        pngColors: 128,
        jpegQuality: 0.88,
      });

      if (res.success && res.url) {
        setImages((prev) => {
          const next = [...prev];
          next[index] = {
            id: res.id,
            src: res.url!,
            name: res.item?.filename || croppedFile.name,
            alt: img.alt,
          };
          return next;
        });
        if (res.item) {
          setMediaItems((prev) => [res.item!, ...prev]);
        }
        showToast('success', 'Image Cropped', `Re-framed image #${index + 1} to 3:4 1500×2000.`);
      } else {
        showToast('error', 'Crop Upload Failed', res.error || 'Could not upload cropped image.');
      }
    } catch (err: any) {
      showToast('error', 'Crop Error', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Add selected image from media library
  const handleSelectMediaItem = (item: WpMediaItem) => {
    const exists = images.some((img) => img.id === item.id || img.src === item.url);
    if (exists) {
      showToast('info', 'Already Added', 'This image is already in the product gallery.');
      return;
    }

    setImages((prev) => [
      ...prev,
      {
        id: item.id,
        src: item.url,
        name: item.filename,
      },
    ]);
    showToast('success', 'Image Added', `${item.filename} added to gallery.`);
  };

  // Save changes to WooCommerce product
  const handleSave = async () => {
    if (!product) return;

    setIsSaving(true);
    try {
      const formattedImages = images.map((img) => {
        if (img.id && img.id > 0) {
          return { id: img.id };
        }
        return { src: img.src };
      });

      const res = await updateProductDirect(product.id, {
        images: formattedImages,
      });

      if (res.success && res.product) {
        // Trigger storefront on-demand ISR revalidation and Cloudflare edge cache purge
        revalidateStorefrontWebDirect({
          slug: product.slug,
          category: product.categories?.[0]?.slug,
        }).catch((err) => console.warn('[Images] Cache revalidation notice:', err));

        showToast('success', 'Images Saved', `Updated gallery for ${product.name}. Storefront and edge cache refreshed.`);
        onUpdated(res.product);
        onClose();
      } else {
        showToast('error', 'Save Failed', res.error || 'Could not update product images.');
      }
    } catch (err: any) {
      showToast('error', 'Update Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!product) return null;

  const modalHeader = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
        <ImageIcon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-zinc-100">
          Product Images: {product.name}
        </h2>
        <p className="text-xs text-zinc-400">
          Change featured image, manage gallery order, and upload new media. First slot is the primary featured image.
        </p>
      </div>
    </div>
  );

  const modalFooter = (
    <div className="flex items-center justify-between w-full">
      <div className="text-[11px] text-zinc-500">
        Total {images.length} image(s) configured
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition disabled:opacity-40 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isUploading}
          className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 transition shadow-lg shadow-amber-400/10 disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Images...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Save Images</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      title={modalHeader}
      footer={modalFooter}
    >
      <div className="space-y-6">
        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
          <div className="text-xs text-zinc-300">
            Click <Star className="w-3 h-3 inline text-amber-400 fill-amber-400" /> to set an image as the Featured Cover.
          </div>
          <div className="flex flex-wrap items-center gap-2">

            <button
              type="button"
              onClick={handleOpenMediaPicker}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700/60 flex items-center gap-1.5 transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Media Library</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-xs font-medium text-zinc-300 border border-zinc-750 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Upload original image without cropping"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Upload Raw</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => cropGalleryInputRef.current?.click()}
              disabled={isUploading}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-xs font-bold text-zinc-950 shadow-lg shadow-amber-400/15 flex items-center gap-2 transition cursor-pointer disabled:opacity-50 active:scale-95"
              title="Upload photos, adjust crop position and resize into 3:4 (1500×2000 px) for the product gallery"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Uploading Gallery...</span>
                </>
              ) : (
                <>
                  <Crop className="w-4 h-4 text-zinc-950" />
                  <span>Upload Gallery (3:4)</span>
                </>
              )}
            </button>
            <input
              ref={cropGalleryInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleCropGallerySelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Current Gallery Grid */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-zinc-300">
            Active Images (Slot 1 = Featured Thumbnail)
          </div>

          {images.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-zinc-800 text-center space-y-2">
              <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400">No images attached to this product yet.</p>
              <p className="text-[11px] text-zinc-500">
                Upload images or choose existing files from the Media Library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {images.map((img, idx) => {
                const isFeatured = idx === 0;
                return (
                  <div
                    key={img.id ? `img_${img.id}` : `src_${idx}`}
                    className={clsx(
                      'group relative rounded-xl border overflow-hidden bg-zinc-950 flex flex-col transition',
                      isFeatured
                        ? 'border-amber-500/60 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/10'
                        : 'border-zinc-800 hover:border-zinc-700'
                    )}
                  >
                    {/* Badge */}
                    <div className="absolute top-2 left-2 z-10">
                      {isFeatured ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-bold text-[10px] flex items-center gap-1 shadow">
                          <Star className="w-3 h-3 fill-zinc-950" />
                          Featured
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-black/70 text-zinc-300 text-[10px] font-mono">
                          #{idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Image Preview */}
                    <div className="aspect-square w-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                      <img
                        src={img.src}
                        alt={img.alt || `Product image ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                    </div>

                    {/* Actions bar */}
                    <div className="p-2 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center justify-between gap-1">
                      {!isFeatured ? (
                        <button
                          type="button"
                          onClick={() => handleSetFeatured(idx)}
                          className="text-[11px] text-zinc-400 hover:text-amber-400 transition flex items-center gap-1 cursor-pointer"
                          title="Make Featured"
                        >
                          <Star className="w-3 h-3" />
                          <span>Set Cover</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-medium">Cover Image</span>
                      )}

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartSingleCrop(img, idx)}
                          className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-amber-400/10 transition cursor-pointer"
                          title="Re-frame image to 3:4 (1500×2000 px)"
                        >
                          <Crop className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Remove image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Media Library Drawer */}
        {isMediaPickerOpen && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-semibold text-zinc-200">
                  Select or Upload to WordPress Media Library
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMediaPickerOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Direct Upload Input */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      loadMediaLibrary(mediaSearch);
                    }
                  }}
                  placeholder="Search media files by name..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <button
                type="button"
                onClick={() => loadMediaLibrary(mediaSearch)}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition cursor-pointer"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Here</span>
                  </>
                )}
              </button>
            </div>

            {/* Media Items Grid */}
            {isLoadingMedia ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-zinc-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <span className="text-xs">Loading media library...</span>
              </div>
            ) : mediaItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-zinc-800/80 rounded-xl">
                No media files found matching search.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {mediaItems.map((item) => {
                  const isSelected = images.some((img) => img.id === item.id || img.src === item.url);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectMediaItem(item)}
                      className={clsx(
                        'aspect-square rounded-lg overflow-hidden border relative group text-left cursor-pointer transition',
                        isSelected
                          ? 'border-emerald-500/80 ring-2 ring-emerald-500/40 opacity-70'
                          : 'border-zinc-800 hover:border-amber-400/80'
                      )}
                    >
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected ? (
                        <div className="absolute inset-0 bg-emerald-950/60 flex items-center justify-center">
                          <Check className="w-5 h-5 text-emerald-400" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Plus className="w-5 h-5 text-amber-400" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/80 px-1 py-0.5 text-[9px] text-zinc-300 truncate text-center">
                        {item.filename}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>

    {/* Batch Crop Modal for Uploading to Gallery (3:4 1500x2000) */}
    {isCropModalOpen && cropQueue.length > 0 && (
      <ImageCropModal
        isOpen={isCropModalOpen}
        onClose={handleCropModalClose}
        imageSrc={currentCropObjectUrl}
        aspectRatio={3 / 4}
        targetWidth={1500}
        targetHeight={2000}
        queueIndex={cropIndex}
        queueTotal={cropQueue.length}
        fileName={cropQueue[cropIndex]?.name}
        onCropComplete={handleCropModalComplete}
        onSkip={cropQueue.length > 1 ? handleCropModalSkip : undefined}
      />
    )}

    {/* Single Crop Modal for Re-framing an Existing Image */}
    {singleCropTarget && (
      <ImageCropModal
        isOpen={!!singleCropTarget}
        onClose={() => setSingleCropTarget(null)}
        imageSrc={singleCropTarget.img.src}
        aspectRatio={3 / 4}
        targetWidth={1500}
        targetHeight={2000}
        title="Re-frame Product Image (3:4 1500×2000)"
        subtitle={`Adjust crop position and zoom for image #${singleCropTarget.index + 1}. Export resolution: 1500×2000 px.`}
        fileName={singleCropTarget.img.name || `image-${singleCropTarget.index + 1}`}
        onCropComplete={handleSingleCropComplete}
      />
    )}
  </>
  );
};
