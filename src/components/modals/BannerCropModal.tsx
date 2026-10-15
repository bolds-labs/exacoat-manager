import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  Check,
  Move,
  Maximize2,
} from 'lucide-react';
import { uploadMarketingImageBase64 } from '../../lib/wordpressBridge';

export type CropAspectRatio = '16:9' | '4:3' | '1:1' | '3:4';

interface BannerCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  initialAspectRatio?: CropAspectRatio | 'auto';
  initialPosition?: string;
  onApplyCrop: (croppedUrl: string, aspectRatio: CropAspectRatio, position: string) => void;
}

const RATIO_VALUES: Record<CropAspectRatio, { width: number; height: number; label: string; desc: string }> = {
  '16:9': { width: 16, height: 9, label: '16:9', desc: 'Landscape' },
  '4:3': { width: 4, height: 3, label: '4:3', desc: 'Standard' },
  '1:1': { width: 1, height: 1, label: '1:1', desc: 'Square' },
  '3:4': { width: 3, height: 4, label: '3:4', desc: 'Portrait' },
};

export const BannerCropModal: React.FC<BannerCropModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  initialAspectRatio = '16:9',
  initialPosition = 'center',
  onApplyCrop,
}) => {
  const [aspectRatio, setAspectRatio] = useState<CropAspectRatio>(
    initialAspectRatio === 'auto' ? '16:9' : initialAspectRatio
  );

  // Position offset as percentage (0 = top/left, 50 = center, 100 = bottom/right)
  const [posX, setPosX] = useState<number>(50);
  const [posY, setPosY] = useState<number>(() => {
    if (initialPosition === 'top') return 0;
    if (initialPosition === 'bottom') return 100;
    const match = initialPosition.match(/(\d+)%/);
    if (match) return Number(match[1]);
    return 50;
  });

  const [zoom, setZoom] = useState<number>(1.0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Dragging state for direct canvas / viewport pan
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number }>({
    x: 0,
    y: 0,
    startPosX: 50,
    startPosY: 50,
  });

  // Load and inspect image
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    setImgLoaded(false);
    setLoadError(null);
    setZoom(1.0);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setImgLoaded(true);
    };
    img.onerror = () => {
      // Fallback: try loading through fetch as blob to bypass canvas tainting
      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            imgRef.current = fallbackImg;
            setNaturalDimensions({ width: fallbackImg.naturalWidth, height: fallbackImg.naturalHeight });
            setImgLoaded(true);
          };
          fallbackImg.onerror = () => {
            setLoadError('Could not load image file.');
          };
          fallbackImg.src = blobUrl;
        })
        .catch(() => {
          setLoadError('Could not load image across domains.');
        });
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  // Pointer drag event handlers for direct pan
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPosX: posX,
      startPosY: posY,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const rect = containerRef.current.getBoundingClientRect();
    const percentX = (dx / (rect.width || 1)) * 100;
    const percentY = (dy / (rect.height || 1)) * 100;

    setPosX(Math.max(0, Math.min(100, dragStartRef.current.startPosX - percentX)));
    setPosY(Math.max(0, Math.min(100, dragStartRef.current.startPosY - percentY)));
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Quick alignment setters
  const applyAlignment = (align: 'top' | 'center' | 'bottom' | 'left' | 'right') => {
    if (align === 'top') setPosY(0);
    else if (align === 'center') {
      setPosX(50);
      setPosY(50);
    } else if (align === 'bottom') setPosY(100);
    else if (align === 'left') setPosX(0);
    else if (align === 'right') setPosX(100);
  };

  // Perform canvas crop and save
  const handleApplyCrop = async () => {
    const img = imgRef.current;
    if (!img || !imgLoaded || !naturalDimensions.width || !naturalDimensions.height) return;

    setIsSaving(true);

    try {
      const nw = naturalDimensions.width;
      const nh = naturalDimensions.height;
      const ratioConfig = RATIO_VALUES[aspectRatio];
      const targetRatio = ratioConfig.width / ratioConfig.height;

      // Calculate source crop window
      let sWidth = nw;
      let sHeight = nh;

      const sourceRatio = nw / nh;
      if (sourceRatio > targetRatio) {
        // Source is wider than target ratio
        sHeight = nh / zoom;
        sWidth = sHeight * targetRatio;
      } else {
        // Source is taller than target ratio
        sWidth = nw / zoom;
        sHeight = sWidth / targetRatio;
      }

      // Constrain sWidth and sHeight to natural bounds
      sWidth = Math.min(nw, sWidth);
      sHeight = Math.min(nh, sHeight);

      const maxSx = Math.max(0, nw - sWidth);
      const maxSy = Math.max(0, nh - sHeight);

      const sx = maxSx * (posX / 100);
      const sy = maxSy * (posY / 100);

      // Target canvas dimensions (1200px width for high-density 2x retina email banners)
      const outWidth = Math.min(1400, Math.max(1000, Math.round(sWidth)));
      const outHeight = Math.round(outWidth / targetRatio);

      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context unavailable');
      }

      // Smooth bicubic resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outWidth, outHeight);

      // Export as high-quality JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // Upload to WordPress media endpoint
      const uploadRes = await uploadMarketingImageBase64(dataUrl, `hero-banner-${aspectRatio.replace(':', '-')}-${Date.now()}.jpg`);

      const positionLabel = posY === 0 ? 'top' : posY === 100 ? 'bottom' : `${Math.round(posY)}%`;

      if (uploadRes.success && uploadRes.url) {
        onApplyCrop(uploadRes.url, aspectRatio, positionLabel);
        onClose();
      } else {
        // Fallback to data URL if network upload fails
        onApplyCrop(dataUrl, aspectRatio, positionLabel);
        onClose();
      }
    } catch (err: any) {
      console.error('[BannerCropModal] Crop failed:', err);
      setLoadError(err.message || 'Failed to process cropped image.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentRatioConfig = RATIO_VALUES[aspectRatio];
  const outputWidthEstimate = 1200;
  const outputHeightEstimate = Math.round(outputWidthEstimate / (currentRatioConfig.width / currentRatioConfig.height));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Banner Crop & Framing"
    >
      <div className="space-y-4">
        {/* Aspect Ratio Selector Chips */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              Crop Aspect Ratio
            </label>
            <span className="text-[10px] font-mono text-zinc-400">
              Selected: {aspectRatio} ({currentRatioConfig.desc})
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(RATIO_VALUES) as CropAspectRatio[]).map((r) => {
              const info = RATIO_VALUES[r];
              const isActive = aspectRatio === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAspectRatio(r)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 ${
                    isActive
                      ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'bg-zinc-50 dark:bg-white/[0.03] border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  <span>{info.label}</span>
                  <span className="text-[10px] font-normal text-zinc-400">{info.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Viewport Frame */}
        <div className="relative">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 font-medium">
              <Move className="w-3.5 h-3.5 text-amber-500" />
              <span>Drag image to adjust framing position</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              X: {Math.round(posX)}% • Y: {Math.round(posY)}%
            </span>
          </div>

          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`relative w-full rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-700 bg-black flex items-center justify-center select-none cursor-grab active:cursor-grabbing shadow-inner ${
              aspectRatio === '16:9'
                ? 'aspect-[16/9]'
                : aspectRatio === '4:3'
                ? 'aspect-[4/3]'
                : aspectRatio === '1:1'
                ? 'aspect-square max-h-[360px]'
                : 'aspect-[3/4] max-h-[420px]'
            }`}
          >
            {!imgLoaded && !loadError && (
              <div className="flex flex-col items-center gap-2 text-zinc-400 text-xs py-12">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span>Loading original banner image...</span>
              </div>
            )}

            {loadError && (
              <div className="p-4 text-center text-rose-400 text-xs">
                {loadError}
              </div>
            )}

            {imgLoaded && (
              <>
                <img
                  src={imageUrl}
                  alt="Crop preview"
                  draggable={false}
                  className="w-full h-full object-cover transition-transform duration-75 pointer-events-none"
                  style={{
                    objectPosition: `${posX}% ${posY}%`,
                    transform: `scale(${zoom})`,
                  }}
                />

                {/* Framing Grid Overlay */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
                  <div className="border-r border-b border-white/15" />
                  <div className="border-r border-b border-white/15" />
                  <div className="border-b border-white/15" />
                  <div className="border-r border-b border-white/15" />
                  <div className="border-r border-b border-white/15" />
                  <div className="border-b border-white/15" />
                  <div className="border-r border-white/15" />
                  <div className="border-r border-white/15" />
                  <div />
                </div>

                {/* Aspect Badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur border border-white/10 text-[10px] font-mono font-bold text-amber-400 uppercase shadow">
                  {aspectRatio}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Position & Zoom Controls */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 space-y-3">
          {/* Quick Alignment Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Quick Framing:
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => applyAlignment('top')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  posY === 0
                    ? 'bg-amber-500 text-black border-amber-500 font-bold'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300'
                }`}
              >
                Top Focus
              </button>
              <button
                type="button"
                onClick={() => applyAlignment('center')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  posY === 50 && posX === 50
                    ? 'bg-amber-500 text-black border-amber-500 font-bold'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300'
                }`}
              >
                Center
              </button>
              <button
                type="button"
                onClick={() => applyAlignment('bottom')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  posY === 100
                    ? 'bg-amber-500 text-black border-amber-500 font-bold'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300'
                }`}
              >
                Bottom Focus
              </button>
              <button
                type="button"
                onClick={() => {
                  setPosX(50);
                  setPosY(50);
                  setZoom(1.0);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white border border-transparent hover:border-zinc-300 transition-colors"
                title="Reset Framing"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sliders: Vertical Position & Zoom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-zinc-200 dark:border-white/[0.06]">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1 font-medium text-zinc-600 dark:text-zinc-300">
                <span>Vertical Position (Y)</span>
                <span className="font-mono text-zinc-400">{Math.round(posY)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={posY}
                onChange={(e) => setPosY(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1 font-medium text-zinc-600 dark:text-zinc-300">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3 h-3 text-amber-500" />
                  <span>Zoom Level</span>
                </span>
                <span className="font-mono text-zinc-400">{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="2.5"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Resolution Info */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-mono">
          <span>
            Source: {naturalDimensions.width || 0} × {naturalDimensions.height || 0} px
          </span>
          <span className="text-amber-600 dark:text-amber-400 font-semibold">
            Target Output: ~{outputWidthEstimate} × {outputHeightEstimate} px
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-white/10 gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleApplyCrop}
            disabled={!imgLoaded || isSaving}
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold flex items-center gap-1.5 shadow-sm px-4"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Cropping &amp; Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Apply Crop to Email</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
