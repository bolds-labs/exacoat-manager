import React, { useEffect, useRef } from 'react';
import type { DeviceFamily } from '../../types';

export interface GeneratedShadowConfig {
  enabled?: boolean;
  softness?: number;
  distance?: number;
  shadow_opacity?: number;
  highlight_opacity?: number;
  direction?: 'bottom_right' | 'top_left';
  surface_gradient_enabled?: boolean;
  surface_gradient_opacity?: number;
}

export interface V2SkinCanvasLayerProps {
  maskUrl?: string;
  textureUrl?: string;
  fallbackColor?: string;
  logoCutoutUrl?: string;
  pencilCutoutUrl?: string;
  modelCutoutUrl?: string;
  zIndex: number;
  layerName: string;
  layerGroup?: 'primary' | 'accent' | 'protection' | 'addon';
  isRequired?: boolean;
  textureRotation?: number;
  textureScale?: number;
  hasViewShadow?: boolean;
  generatedShadowConfig?: GeneratedShadowConfig;
  deviceFamily?: DeviceFamily;
  className?: string;
  surfaceGradientEnabled?: boolean;
  surfaceGradientOpacity?: number;
}

/**
 * Directional edge bevel and inner shading simulation.
 * Simulates directional incident lighting with smooth Gaussian blur falloff:
 * - Shadow cast towards bottom-right (or inverted towards top-left)
 * - Specular rim highlight caught on top-left (or bottom-right)
 * - Soft diagonal surface gradient across the vinyl body for photorealistic depth
 */
export function applySyntheticDirectionalShading(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: GeneratedShadowConfig
) {
  if (options?.enabled === false && options?.surface_gradient_enabled === false) return;

  const softness = typeof options?.softness === 'number' ? options.softness : 6;
  const distance = typeof options?.distance === 'number' ? options.distance : 3;
  const shadowAlpha = typeof options?.shadow_opacity === 'number' ? options.shadow_opacity : 0.40;
  const highlightAlpha = typeof options?.highlight_opacity === 'number' ? options.highlight_opacity : 0.25;
  const isBottomRight = (options?.direction ?? 'bottom_right') === 'bottom_right';

  // Shadow offset (cast towards bottom-right by default: +X, +Y)
  const shadowDx = isBottomRight ? distance : -distance;
  const shadowDy = isBottomRight ? distance : -distance;

  // Highlight offset (caught on top-left by default: -X, -Y)
  const hlDx = -shadowDx;
  const hlDy = -shadowDy;

  // 1. Offscreen buffer for inverted silhouette (surrounding area & holes)
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return;

  maskCtx.drawImage(ctx.canvas, 0, 0);
  maskCtx.globalCompositeOperation = 'source-in';
  maskCtx.fillStyle = '#000000';
  maskCtx.fillRect(0, 0, width, height);

  const invertCanvas = document.createElement('canvas');
  invertCanvas.width = width;
  invertCanvas.height = height;
  const invCtx = invertCanvas.getContext('2d');
  if (!invCtx) return;

  invCtx.fillStyle = '#000000';
  invCtx.fillRect(0, 0, width, height);
  invCtx.globalCompositeOperation = 'destination-out';
  invCtx.drawImage(maskCanvas, 0, 0);

  // 2. Render Soft Inner Shadow cast towards bottom-right
  if (options?.enabled !== false && shadowAlpha > 0) {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = width;
    shadowCanvas.height = height;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      sCtx.filter = `blur(${softness}px)`;
      sCtx.drawImage(invertCanvas, shadowDx, shadowDy);

      sCtx.filter = 'none';
      sCtx.globalCompositeOperation = 'destination-in';
      sCtx.drawImage(maskCanvas, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = shadowAlpha;
      ctx.drawImage(shadowCanvas, 0, 0);
      ctx.restore();
    }
  }

  // 3. Render Soft Rim Highlight caught on top-left
  if (options?.enabled !== false && highlightAlpha > 0) {
    const hlCanvas = document.createElement('canvas');
    hlCanvas.width = width;
    hlCanvas.height = height;
    const hCtx = hlCanvas.getContext('2d');
    if (hCtx) {
      hCtx.filter = `blur(${Math.max(1, softness * 0.6)}px)`;
      hCtx.drawImage(invertCanvas, hlDx, hlDy);

      hCtx.filter = 'none';
      hCtx.globalCompositeOperation = 'destination-in';
      hCtx.drawImage(maskCanvas, 0, 0);

      hCtx.globalCompositeOperation = 'source-in';
      hCtx.fillStyle = '#ffffff';
      hCtx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = highlightAlpha;
      ctx.drawImage(hlCanvas, 0, 0);
      ctx.restore();
    }
  }

  // 4. Soft Diagonal Surface Gradient Shadow (Simulates top-left incident light falloff across vinyl body)
  const surfaceGradEnabled = options?.surface_gradient_enabled ?? true;
  const surfaceGradOpacity = typeof options?.surface_gradient_opacity === 'number'
    ? options.surface_gradient_opacity
    : 0.22;

  if (surfaceGradEnabled && surfaceGradOpacity > 0) {
    const gradCanvas = document.createElement('canvas');
    gradCanvas.width = width;
    gradCanvas.height = height;
    const gCtx = gradCanvas.getContext('2d');
    if (gCtx) {
      const x0 = isBottomRight ? width * 0.15 : width * 0.85;
      const y0 = isBottomRight ? height * 0.08 : height * 0.95;
      const x1 = isBottomRight ? width * 0.85 : width * 0.15;
      const y1 = isBottomRight ? height * 0.95 : height * 0.08;

      const grad = gCtx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.40, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.65, `rgba(0, 0, 0, ${(surfaceGradOpacity * 0.22).toFixed(3)})`);
      grad.addColorStop(0.85, `rgba(0, 0, 0, ${(surfaceGradOpacity * 0.65).toFixed(3)})`);
      grad.addColorStop(1.0, `rgba(0, 0, 0, ${surfaceGradOpacity.toFixed(3)})`);

      gCtx.fillStyle = grad;
      gCtx.fillRect(0, 0, width, height);

      gCtx.globalCompositeOperation = 'destination-in';
      gCtx.drawImage(maskCanvas, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(gradCanvas, 0, 0);
      ctx.restore();
    }
  }
}

export const V2SkinCanvasLayer: React.FC<V2SkinCanvasLayerProps> = ({
  maskUrl,
  textureUrl,
  fallbackColor = '#18181b',
  logoCutoutUrl,
  pencilCutoutUrl,
  modelCutoutUrl,
  zIndex,
  layerName,
  layerGroup,
  isRequired,
  textureRotation = 0,
  textureScale = 1.0,
  hasViewShadow = false,
  generatedShadowConfig,
  deviceFamily,
  className,
  surfaceGradientEnabled,
  surfaceGradientOpacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!maskUrl && !textureUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;

    // Helper: load image safely without crossOrigin blocking
    const loadImage = (src?: string): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        if (!src || !src.trim()) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          const retryImg = new Image();
          retryImg.onload = () => resolve(retryImg);
          retryImg.onerror = () => resolve(null);
          retryImg.src = src.trim();
        };
        img.src = src.trim();
      });
    };

    Promise.all([
      maskUrl ? loadImage(maskUrl) : Promise.resolve(null),
      textureUrl ? loadImage(textureUrl) : Promise.resolve(null),
      logoCutoutUrl ? loadImage(logoCutoutUrl) : Promise.resolve(null),
      pencilCutoutUrl ? loadImage(pencilCutoutUrl) : Promise.resolve(null),
      modelCutoutUrl ? loadImage(modelCutoutUrl) : Promise.resolve(null),
    ]).then(([maskImg, texImg, logoCutoutImg, pencilCutoutImg, modelCutoutImg]) => {
      if (isCancelled || !ctx) return;
      ctx.clearRect(0, 0, 1000, 1000);
      if (!maskImg && !texImg) return;

      // 1. Draw master texture with seamless pattern tiling, rotation, and scale
      if (texImg && texImg.width > 0 && texImg.height > 0) {
        if (maskImg) {
          const rot = (textureRotation || 0) % 360;
          const zoom = typeof textureScale === 'number' && textureScale > 0 ? textureScale : 1.0;
          const baseScale = Math.max(1000 / texImg.width, 1000 / texImg.height);
          const scale = baseScale * zoom;

          let patternPainted = false;
          try {
            const pattern = ctx.createPattern(texImg, 'repeat');
            if (pattern) {
              const matrix = new DOMMatrix();
              matrix.translateSelf(500, 500);
              if (rot !== 0) {
                matrix.rotateSelf(rot);
              }
              matrix.scaleSelf(scale, scale);
              matrix.translateSelf(-texImg.width / 2, -texImg.height / 2);
              pattern.setTransform(matrix);
              ctx.fillStyle = pattern;
              ctx.fillRect(0, 0, 1000, 1000);
              patternPainted = true;
            }
          } catch {
            patternPainted = false;
          }

          if (!patternPainted) {
            // Fallback: scale drawImage sufficiently so rotation and zoom never leave empty borders
            const rotRad = (rot * Math.PI) / 180;
            const cos = Math.abs(Math.cos(rotRad));
            const sin = Math.abs(Math.sin(rotRad));
            const neededW = 1000 * cos + 1000 * sin;
            const neededH = 1000 * sin + 1000 * cos;
            const coverScale = Math.max(neededW / texImg.width, neededH / texImg.height, 1.0);
            const drawW = texImg.width * coverScale;
            const drawH = texImg.height * coverScale;

            ctx.save();
            ctx.translate(500, 500);
            if (rot !== 0) ctx.rotate(rotRad);
            ctx.drawImage(texImg, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
          }
        } else {
          // Pre-cut texture overlay drawn directly on 1000x1000 canvas
          ctx.drawImage(texImg, 0, 0, 1000, 1000);
        }
      } else if (maskImg) {
        // Fallback color fill
        ctx.fillStyle = fallbackColor || '#18181b';
        ctx.fillRect(0, 0, 1000, 1000);
      }

      // 2. Clip with vinyl skin alpha mask if present
      if (maskImg) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskImg, 0, 0, 1000, 1000);
      }

      // 3. Punch out logo hole from the skin so hardware base chassis shines through
      if (logoCutoutImg) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(logoCutoutImg, 0, 0, 1000, 1000);
      }

      // 4. Punch out pencil groove/charging area so tablet body shines through
      if (pencilCutoutImg) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(pencilCutoutImg, 0, 0, 1000, 1000);
      }

      // 5. Punch out model cut perimeter so phone metal frame shows for back-only cuts
      if (modelCutoutImg) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(modelCutoutImg, 0, 0, 1000, 1000);
      }

      // 6. Directional Bevel & Inner Shading (strictly on back or required skins without 3D shadow map)
      const isBackOrRequired = Boolean(
        isRequired ||
        layerGroup === 'primary' ||
        (/\b(back|top|body|device)\b/i.test(layerName) && !/\b(accent|camera|frame|side|logo|additional|addon)\b/i.test(layerName))
      );
      const isTabletOrFoldableOrLaptop =
        deviceFamily === 'tablet' ||
        deviceFamily === 'foldable' ||
        deviceFamily === 'laptop' ||
        (deviceFamily as string) === 'tablet_laptop' ||
        deviceFamily === 'keyboard';
      const defaultGenEnabled = !isTabletOrFoldableOrLaptop && !hasViewShadow && Boolean(maskImg);
      const shouldApplyGeneratedShadow =
        isBackOrRequired &&
        (generatedShadowConfig?.enabled ?? defaultGenEnabled);

      if (shouldApplyGeneratedShadow && maskImg) {
        const shadowOptions = {
          ...generatedShadowConfig,
          surface_gradient_enabled: surfaceGradientEnabled ?? false,
          surface_gradient_opacity: surfaceGradientOpacity ?? 0.22,
        };
        applySyntheticDirectionalShading(ctx, 1000, 1000, shadowOptions);
      }

      // Reset composite operation to normal
      ctx.globalCompositeOperation = 'source-over';
    });

    return () => {
      isCancelled = true;
    };
  }, [maskUrl, textureUrl, fallbackColor, logoCutoutUrl, pencilCutoutUrl, modelCutoutUrl, textureRotation, textureScale, hasViewShadow, generatedShadowConfig, layerGroup, layerName, isRequired, deviceFamily, surfaceGradientEnabled, surfaceGradientOpacity]);

  return (
    <canvas
      ref={canvasRef}
      width={1000}
      height={1000}
      style={{ zIndex }}
      className={className || "absolute inset-0 w-full h-full object-contain pointer-events-none filter drop-shadow-[0_0_1.5px_rgba(0,0,0,0.28)]"}
      title={layerName}
    />
  );
};
