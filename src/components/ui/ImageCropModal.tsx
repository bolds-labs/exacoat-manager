import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Check,
  Crop,
  Focus,
  Move,
  Layers,
  SkipForward,
  Info,
} from 'lucide-react';
import clsx from 'clsx';
import { loadCorsSafeImageBlobUrl } from '../../lib/imageLoader';

export interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  aspectRatio?: number;
  targetWidth?: number;
  targetHeight?: number;
  title?: string;
  subtitle?: string;
  queueIndex?: number;
  queueTotal?: number;
  fileName?: string;
  onSkip?: () => void;
  outputFormat?: 'image/jpeg' | 'image/webp' | 'image/png';
  outputQuality?: number;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 3 / 4, // 0.75 ratio for 3:4
  targetWidth = 1500,
  targetHeight = 2000,
  title,
  subtitle,
  queueIndex = 0,
  queueTotal = 1,
  fileName,
  onSkip,
  outputFormat = 'image/jpeg',
  outputQuality = 0.92,
  maxWidth = '3xl',
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const [localDataSrc, setLocalDataSrc] = useState<string>(imageSrc);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport dimensions for display:
  // For 3:4 portrait (0.75), height 448px => width 336px.
  const isPortrait = aspectRatio <= 1;
  const viewportHeight = isPortrait ? 448 : Math.round(520 / aspectRatio);
  const viewportWidth = isPortrait ? Math.round(viewportHeight * aspectRatio) : 520;

  // Clamping pan to ensure the image does not leave empty areas inside framing bounds
  const clampPan = useCallback(
    (newPan: { x: number; y: number }, currentZoom: number) => {
      const naturalW = imageNaturalSize.width || (imageRef.current?.naturalWidth || viewportWidth);
      const naturalH = imageNaturalSize.height || (imageRef.current?.naturalHeight || viewportHeight);

      const isRotated90 = rotation % 180 !== 0;
      const effW = isRotated90 ? naturalH : naturalW;
      const effH = isRotated90 ? naturalW : naturalH;

      const baseScale = Math.max(viewportWidth / effW, viewportHeight / effH);
      const renderedW = effW * baseScale * currentZoom;
      const renderedH = effH * baseScale * currentZoom;

      const maxPanX = Math.max(0, (renderedW - viewportWidth) / 2);
      const maxPanY = Math.max(0, (renderedH - viewportHeight) / 2);

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, newPan.x)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newPan.y)),
      };
    },
    [rotation, viewportWidth, viewportHeight, imageNaturalSize]
  );

  // Reset transforms whenever image changes or modal opens
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });

    if (imageSrc.startsWith('data:') || imageSrc.startsWith('blob:')) {
      setLocalDataSrc(imageSrc);
      return;
    }

    let isMounted = true;
    setIsLoadingImage(true);

    loadCorsSafeImageBlobUrl(imageSrc)
      .then((blobUrl) => {
        if (!isMounted) return;
        setLocalDataSrc(blobUrl);
        setIsLoadingImage(false);
      })
      .catch((err) => {
        console.warn('[CROP MODAL] CORS safe load fallback:', err);
        if (!isMounted) return;
        setLocalDataSrc(imageSrc);
        setIsLoadingImage(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, imageSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageNaturalSize({
      width: img.naturalWidth || viewportWidth,
      height: img.naturalHeight || viewportHeight,
    });
    setIsLoadingImage(false);
  };

  const naturalW = imageNaturalSize.width || viewportWidth;
  const naturalH = imageNaturalSize.height || viewportHeight;

  const isRotated90 = rotation % 180 !== 0;
  const effW = isRotated90 ? naturalH : naturalW;
  const effH = isRotated90 ? naturalW : naturalH;

  const baseScale = Math.max(viewportWidth / effW, viewportHeight / effH);
  const baseW = naturalW * baseScale;
  const baseH = naturalH * baseScale;

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3.5, newZoom));
    setZoom(clampedZoom);
    setPan((prev) => clampPan(prev, clampedZoom));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const rawPan = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    };
    setPan(clampPan(rawPan, zoom));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored if pointer was already released
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoomChange(zoom + zoomStep);
  };

  const handleRecenter = () => {
    setPan({ x: 0, y: 0 });
  };

  const handleResetAll = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleApplyCrop = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const naturalWidth = img.naturalWidth || targetWidth;
    const naturalHeight = img.naturalHeight || targetHeight;

    const isRot90 = rotation % 180 !== 0;
    const currentEffW = isRot90 ? naturalHeight : naturalWidth;
    const currentEffH = isRot90 ? naturalWidth : naturalHeight;

    // Fill white background for product images to guarantee clean edges
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.save();
    const scaleFactorX = targetWidth / viewportWidth;
    const scaleFactorY = targetHeight / viewportHeight;

    ctx.translate(targetWidth / 2 + pan.x * scaleFactorX, targetHeight / 2 + pan.y * scaleFactorY);
    ctx.rotate((rotation * Math.PI) / 180);

    const canvasBaseScale = Math.max(targetWidth / currentEffW, targetHeight / currentEffH);
    const drawW = naturalWidth * canvasBaseScale * zoom;
    const drawH = naturalHeight * canvasBaseScale * zoom;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const croppedBase64 = canvas.toDataURL(outputFormat, outputQuality);
    onCropComplete(croppedBase64);
  };

  const isMultiQueue = queueTotal > 1;
  const isLastInQueue = queueIndex + 1 === queueTotal;

  const defaultTitle = isMultiQueue
    ? `Frame Gallery Image (${queueIndex + 1} of ${queueTotal})`
    : 'Frame Product Gallery Image';

  const defaultSubtitle = isMultiQueue
    ? `Adjust position and zoom for image ${queueIndex + 1} of ${queueTotal} (${fileName || 'gallery image'}). Target output: 3:4 ratio at ${targetWidth}×${targetHeight} px.`
    : `Adjust framing and zoom to fit the 3:4 product gallery ratio. Target output: ${targetWidth}×${targetHeight} px.`;

  const modalFooter = (
    <div className="flex flex-wrap items-center justify-between w-full gap-3 font-sans">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRecenter}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Move framing back to optical center"
        >
          <Focus className="w-3.5 h-3.5 text-zinc-400" />
          <span>Re-center</span>
        </button>

        {isMultiQueue && onSkip && !isLastInQueue && (
          <button
            type="button"
            onClick={onSkip}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700/40 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Skip this photo and move to next image in queue"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Skip Image</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleApplyCrop}
          className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-400/15 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <Check className="w-4 h-4 text-zinc-950" />
          <span>
            {isMultiQueue
              ? isLastInQueue
                ? 'Apply & Finish Upload'
                : 'Apply & Next Image'
              : `Apply Crop (${targetWidth}×${targetHeight})`}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={maxWidth}
      title={title || defaultTitle}
      subtitle={subtitle || defaultSubtitle}
      footer={modalFooter}
    >
      <div className="space-y-4 font-sans select-none">
        {/* Queue Progress Bar when multiple images */}
        {isMultiQueue && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-zinc-200">
                Batch Upload Queue: {queueIndex + 1} of {queueTotal}
              </span>
              {fileName && (
                <span className="font-mono text-[11px] text-zinc-400 truncate max-w-[220px]">
                  ({fileName})
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
              3:4 Locked
            </div>
          </div>
        )}

        {/* Viewport Framing Area */}
        <div className="flex flex-col items-center justify-center p-4 sm:p-5 bg-zinc-950 rounded-2xl border border-zinc-800 select-none overflow-hidden relative shadow-inner">
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleRecenter}
            onWheel={handleWheel}
            style={{ width: `${viewportWidth}px`, height: `${viewportHeight}px` }}
            className="relative overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_12px_40px_rgba(0,0,0,0.9)] cursor-grab active:cursor-grabbing bg-zinc-900 flex items-center justify-center border-2 border-amber-400/80 transition-all duration-75 touch-none"
            title="Drag to position, scroll wheel to zoom, double-click to re-center"
          >
            {isLoadingImage ? (
              <div className="text-zinc-500 font-mono text-xs animate-pulse">Loading image...</div>
            ) : (
              <img
                ref={imageRef}
                src={localDataSrc}
                alt="Crop preview"
                onLoad={handleImageLoad}
                crossOrigin={localDataSrc.startsWith('http') ? 'anonymous' : undefined}
                draggable={false}
                style={{
                  width: `${baseW}px`,
                  height: `${baseH}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                }}
                className="pointer-events-none select-none shrink-0"
              />
            )}

            {/* Rule of Thirds Framing Grid */}
            <div className="absolute inset-0 pointer-events-none border border-white/20 grid grid-cols-3 grid-rows-3">
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div className="border-r border-b border-white/15" />
              <div />
            </div>

            {/* Optical Center Crosshair */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
              <div className="relative w-4 h-4 flex items-center justify-center">
                <div className="absolute w-4 h-[1px] bg-white/80" />
                <div className="absolute h-4 w-[1px] bg-white/80" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between w-full max-w-sm mt-3 px-1 text-[11px] font-mono">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-zinc-400" />
              <span>Drag to pan, scroll to zoom</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-400/10 text-amber-300 border border-amber-400/20">
              3:4 ({targetWidth}×{targetHeight} px)
            </span>
          </div>
        </div>

        {/* Framing Controls Bar */}
        <div className="space-y-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleZoomChange(zoom - 0.1)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.02"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              aria-label="Image Zoom"
            />

            <button
              type="button"
              onClick={() => handleZoomChange(zoom + 0.1)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-amber-400 w-12 text-right font-bold">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800">
            <div className="text-xs font-mono text-zinc-300 flex items-center gap-1.5">
              <Crop className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">3:4 Aspect Ratio Locked</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleZoomChange(1.0)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Reset zoom to 100%"
              >
                100%
              </button>

              <button
                type="button"
                onClick={() => handleZoomChange(1.5)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Zoom to 150%"
              >
                150%
              </button>

              <button
                type="button"
                onClick={() => {
                  setRotation((r) => (r + 90) % 360);
                  setPan({ x: 0, y: 0 });
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                title="Rotate 90 degrees clockwise"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                <span>90°</span>
              </button>

              <button
                type="button"
                onClick={handleResetAll}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                title="Reset all adjustments"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
