import type { DeviceConfiguratorProfile } from '../types';
import type { GlobalFinish } from './wordpressBridge';
import { loadCorsSafeImageElement } from './imageLoader';
import JSZip from 'jszip';

export interface MarketplaceFeatureCard {
  id: string;
  title: string;
  subtitle: string;
  iconType: 'material' | 'fit' | 'guarantee' | 'scratch' | 'matte' | 'shield';
}

export interface MarketplaceImageConfig {
  profile: DeviceConfiguratorProfile;
  activeFinish: GlobalFinish;
  allFinishes: GlobalFinish[];
  canvasWidth?: number;
  canvasHeight?: number;

  // Background
  bgType: 'studio_light' | 'custom';
  customBgUrl?: string;

  // Header
  showLogo: boolean;
  deviceNameText: string;

  // Headline
  subBadgeText: string;
  headlineText: string;
  headlineFont: 'Chakra Petch' | 'Plus Jakarta Sans' | 'Inter';

  // Feature Cards (Bottom Row)
  featureCards: MarketplaceFeatureCard[];

  // Swatches Stack (Right Edge)
  showSkinsStack: boolean;
  skinsCountText: string;
  skinsLabelText: string;
  swatchFinishSlugs: string[];

  // Device Positioning & Angles
  selectedViewId?: string;
  coverage: 'model_360' | 'model_cut';
  logoCutout: boolean;
  pencilCutout: boolean;
  deviceScale: number;
  deviceOffsetX: number;
  deviceOffsetY: number;
}

export const DEFAULT_FEATURE_CARDS_VINYL: MarketplaceFeatureCard[] = [
  {
    id: 'card_1',
    title: '3M Material',
    subtitle: 'USA · Japan · Italy',
    iconType: 'material',
  },
  {
    id: 'card_2',
    title: 'Accurate fit',
    subtitle: 'Zero gap precision cut',
    iconType: 'fit',
  },
  {
    id: 'card_3',
    title: 'Garansi Pemasangan',
    subtitle: 'Bebas gelembung & presisi',
    iconType: 'guarantee',
  },
];

export const DEFAULT_FEATURE_CARDS_CLEAR: MarketplaceFeatureCard[] = [
  {
    id: 'card_1',
    title: 'Scratch Proof',
    subtitle: 'Self healing protection',
    iconType: 'scratch',
  },
  {
    id: 'card_2',
    title: 'Accurate fit',
    subtitle: 'Zero gap precision cut',
    iconType: 'fit',
  },
  {
    id: 'card_3',
    title: 'Garansi Pemasangan',
    subtitle: 'Bebas gelembung & presisi',
    iconType: 'guarantee',
  },
];

/**
 * Draws rounded rectangle path on canvas
 */
function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Renders the subtle geometric Exacoat monogram studio background
 */
function drawStudioLightBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  // 1. Base subtle studio gradient
  const bgGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    100,
    width * 0.5,
    height * 0.5,
    width * 0.85
  );
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.55, '#f8f9fa');
  bgGrad.addColorStop(1, '#e9ecef');

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Geometric brand monogram pattern
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 160;
  patternCanvas.height = 160;
  const pCtx = patternCanvas.getContext('2d');

  if (pCtx) {
    pCtx.save();
    pCtx.translate(80, 80);
    pCtx.fillStyle = 'rgba(15, 23, 42, 0.024)';

    // Draw 3-wing clover monogram
    for (let i = 0; i < 3; i++) {
      pCtx.save();
      pCtx.rotate((i * 120 * Math.PI) / 180);
      pCtx.beginPath();
      pCtx.moveTo(0, -6);
      pCtx.bezierCurveTo(14, -22, 22, -42, 0, -52);
      pCtx.bezierCurveTo(-22, -42, -14, -22, 0, -6);
      pCtx.fill();
      pCtx.restore();
    }

    pCtx.beginPath();
    pCtx.arc(0, 0, 7, 0, Math.PI * 2);
    pCtx.fill();
    pCtx.restore();

    try {
      const pattern = ctx.createPattern(patternCanvas, 'repeat');
      if (pattern) {
        ctx.save();
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    } catch {
      // Ignore pattern fallback
    }
  }

  // 3. Soft vignette
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    width * 0.45,
    width * 0.5,
    height * 0.5,
    width * 0.75
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.04)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draws the dark Exacoat logo pill
 */
async function drawLogoPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number = 240,
  h: number = 72
) {
  ctx.save();

  // Pill container
  pathRoundedRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = '#18181b';
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Load and draw SVG logo
  try {
    const logoImg = await loadCorsSafeImageElement('/assets/brand/exacoat-logo.svg');
    if (logoImg && logoImg.width > 0) {
      const logoAspect = logoImg.width / logoImg.height;
      const targetH = 26;
      const targetW = targetH * logoAspect;
      const logoX = x + (w - targetW) / 2;
      const logoY = y + (h - targetH) / 2;
      ctx.drawImage(logoImg, logoX, logoY, targetW, targetH);
      ctx.restore();
      return;
    }
  } catch {
    // Fallback to crisp canvas vector text if SVG load fails
  }

  // Fallback vector typography
  ctx.fillStyle = '#f3aa18';
  ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('exacoat.', x + w / 2, y + h / 2);

  ctx.restore();
}

/**
 * Draws the device name pill on top right
 */
function drawDeviceNamePill(
  ctx: CanvasRenderingContext2D,
  text: string,
  rightX: number,
  y: number,
  h: number = 72
) {
  if (!text.trim()) return;

  ctx.save();
  ctx.font = '800 24px "Plus Jakarta Sans", "Inter", sans-serif';
  const textMetrics = ctx.measureText(text.toUpperCase());
  const paddingX = 36;
  const w = Math.max(220, textMetrics.width + paddingX * 2);
  const x = rightX - w;

  // Soft shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  // Pill box
  pathRoundedRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Text
  ctx.fillStyle = '#09090b';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text.toUpperCase(), x + w / 2, y + h / 2 + 1);

  ctx.restore();
}

/**
 * Draws the left headline typography and sub-badge
 */
function drawLeftHeadlineBlock(
  ctx: CanvasRenderingContext2D,
  subBadgeText: string,
  headlineText: string,
  fontFamily: string,
  x: number,
  startY: number
) {
  ctx.save();
  let currentY = startY;

  // 1. Sub-badge pill (if present)
  if (subBadgeText.trim()) {
    ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
    const textMetrics = ctx.measureText(subBadgeText);
    const badgeW = textMetrics.width + 36;
    const badgeH = 46;

    pathRoundedRect(ctx, x, currentY, badgeW, badgeH, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#18181b';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(subBadgeText, x + badgeW / 2, currentY + badgeH / 2);

    currentY += badgeH + 32;
  }

  // 2. Bold Headline Text
  const lines = headlineText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length > 0) {
    const fontSize = lines.length >= 3 ? 98 : 110;
    const lineHeight = fontSize * 1.04;
    ctx.font = `900 ${fontSize}px "${fontFamily}", "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#09090b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (const line of lines) {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
  }

  ctx.restore();
}

/**
 * Draws clean vector feature icons inside cards
 */
function drawCardIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  iconType: MarketplaceFeatureCard['iconType']
) {
  ctx.save();
  ctx.strokeStyle = '#10b981';
  ctx.fillStyle = '#10b981';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (iconType === 'material') {
    // 3M Layers icon
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx + 12, cy - 4);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx - 12, cy - 4);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx + 12, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 5);
    ctx.lineTo(cx, cy + 11);
    ctx.lineTo(cx + 12, cy + 5);
    ctx.stroke();
  } else if (iconType === 'fit') {
    // Precision Target / Calipers icon
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 14, cy);
    ctx.lineTo(cx - 9, cy);
    ctx.moveTo(cx + 9, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy - 9);
    ctx.moveTo(cx, cy + 9);
    ctx.lineTo(cx, cy + 14);
    ctx.stroke();
  } else if (iconType === 'scratch') {
    // Key / Shield scratch proof icon
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 9);
    ctx.lineTo(cx + 6, cy + 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + 7, cy + 5, 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 11);
    ctx.lineTo(cx - 9, cy - 7);
    ctx.stroke();
  } else {
    // Guarantee / Shield Check icon
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx + 11, cy - 7);
    ctx.lineTo(cx + 11, cy + 4);
    ctx.quadraticCurveTo(cx + 11, cy + 12, cx, cy + 14);
    ctx.quadraticCurveTo(cx - 11, cy + 12, cx - 11, cy + 4);
    ctx.lineTo(cx - 11, cy - 7);
    ctx.closePath();
    ctx.stroke();

    // Checkmark inside shield
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy + 1);
    ctx.lineTo(cx - 1, cy + 5);
    ctx.lineTo(cx + 5, cy - 3);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the 3 bottom feature cards horizontally
 */
function drawBottomFeatureCards(
  ctx: CanvasRenderingContext2D,
  cards: MarketplaceFeatureCard[],
  startY: number = 1240,
  cardH: number = 185,
  totalW: number = 1500
) {
  if (!cards || cards.length === 0) return;

  const numCards = Math.min(3, cards.length);
  const marginX = 60;
  const gap = 30;
  const availableW = totalW - marginX * 2 - gap * (numCards - 1);
  const cardW = availableW / numCards;

  ctx.save();

  cards.slice(0, 3).forEach((card, idx) => {
    const x = marginX + idx * (cardW + gap);
    const y = startY;

    // Card background with soft shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.04)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;

    pathRoundedRect(ctx, x, y, cardW, cardH, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Card border
    ctx.save();
    pathRoundedRect(ctx, x, y, cardW, cardH, 22);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Circular Icon Badge on Top-Right of the card
    const circleRadius = 22;
    const circleX = x + cardW - 32;
    const circleY = y + 36;

    ctx.save();
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawCardIcon(ctx, circleX, circleY, card.iconType);
    ctx.restore();

    // Card Title
    ctx.save();
    ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#09090b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const maxTitleW = cardW - 80;
    ctx.fillText(card.title, x + 28, y + 34, maxTitleW);

    // Card Subtitle
    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#71717a';
    ctx.fillText(card.subtitle, x + 28, y + 84, maxTitleW);
    ctx.restore();
  });

  ctx.restore();
}

/**
 * Draws the "20+ SKINS" swatch stack on the right edge
 */
async function drawSkinsStack(
  ctx: CanvasRenderingContext2D,
  swatchFinishes: GlobalFinish[],
  countText: string = '20+',
  labelText: string = 'SKINS',
  x: number = 1320,
  startY: number = 540
) {
  const swatchSize = 110;
  const radius = 22;
  let currentY = startY;

  ctx.save();

  // Draw 2-3 swatch thumbnails
  for (const finish of swatchFinishes.slice(0, 2)) {
    ctx.save();

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;

    pathRoundedRect(ctx, x, currentY, swatchSize, swatchSize, radius);
    ctx.fillStyle = '#27272a';
    ctx.fill();
    ctx.restore();

    // Thumbnail
    if (finish.thumbnail) {
      try {
        const thumbImg = await loadCorsSafeImageElement(finish.thumbnail);
        if (thumbImg && thumbImg.width > 0) {
          ctx.save();
          pathRoundedRect(ctx, x, currentY, swatchSize, swatchSize, radius);
          ctx.clip();
          ctx.drawImage(thumbImg, x, currentY, swatchSize, swatchSize);
          ctx.restore();
        }
      } catch {
        // Fallback color fill
        ctx.save();
        pathRoundedRect(ctx, x, currentY, swatchSize, swatchSize, radius);
        ctx.fillStyle = finish.color_hex || '#27272a';
        ctx.fill();
        ctx.restore();
      }
    }

    // Border
    ctx.save();
    pathRoundedRect(ctx, x, currentY, swatchSize, swatchSize, radius);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    currentY += swatchSize + 16;
  }

  // "20+ SKINS" badge
  const badgeH = 88;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  pathRoundedRect(ctx, x, currentY, swatchSize, badgeH, radius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  pathRoundedRect(ctx, x, currentY, swatchSize, badgeH, radius);
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Text inside badge
  ctx.textAlign = 'center';
  ctx.fillStyle = '#09090b';

  ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(countText, x + swatchSize / 2, currentY + 38);

  ctx.font = '800 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(labelText, x + swatchSize / 2, currentY + 66);
  ctx.restore();

  ctx.restore();
}

/**
 * Composites the phone hardware with the selected skin layers and cutouts
 */
async function renderDeviceComposite(
  config: MarketplaceImageConfig
): Promise<HTMLCanvasElement> {
  const { profile, activeFinish, coverage, logoCutout, pencilCutout, selectedViewId } = config;

  const devCanvas = document.createElement('canvas');
  devCanvas.width = 1500;
  devCanvas.height = 1500;
  const dCtx = devCanvas.getContext('2d');
  if (!dCtx) return devCanvas;

  // 1. Resolve active view
  const currentView =
    profile.views.find((v) => v.id === selectedViewId) ||
    profile.views.find((v) => v.is_default) ||
    profile.views[0];

  if (!currentView) return devCanvas;

  // 2. Hardware chassis base image
  const chassisUrl = currentView.background_url;
  if (chassisUrl) {
    try {
      const chassisImg = await loadCorsSafeImageElement(chassisUrl, profile.product_id);
      if (chassisImg && chassisImg.width > 0) {
        dCtx.drawImage(chassisImg, 0, 0, 1500, 1500);
      }
    } catch (err) {
      console.warn('[Marketplace Generator] Chassis load failed:', err);
    }
  }

  // 3. Render Skin Layers (sorted by z_index ascending)
  const sortedLayers = [...profile.layers].sort((a, b) => (a.z_index || 1) - (b.z_index || 1));

  for (const layer of sortedLayers) {
    if (layer.is_non_visual) continue;

    const assets =
      layer.assets_by_view?.[currentView.id] ||
      layer.assets_by_view?.['main_view'] ||
      Object.values(layer.assets_by_view || {})[0];

    if (!assets || !assets.mask_svg_url) continue;

    // Load mask
    let maskImg: HTMLImageElement | null = null;
    try {
      maskImg = await loadCorsSafeImageElement(assets.mask_svg_url, profile.product_id);
    } catch {
      maskImg = null;
    }
    if (!maskImg) continue;

    // Resolve texture
    const isCustomPerDevice = Boolean(activeFinish.is_custom_per_device);
    const customTex = isCustomPerDevice ? assets.render_texture_map?.[activeFinish.slug] || '' : '';
    const activeTexUrl = (layer.texture_size === 'big' && activeFinish.texture_big_url)
      ? activeFinish.texture_big_url
      : activeFinish.texture_url || customTex;

    let texImg: HTMLImageElement | null = null;
    if (activeTexUrl) {
      try {
        texImg = await loadCorsSafeImageElement(activeTexUrl);
      } catch {
        texImg = null;
      }
    }

    // Cutouts
    const isModelCutOnly = coverage === 'model_cut';
    const targetLogoViewId = profile.coverage_and_cutouts?.logo_cutout_view_id || 'main_view';
    const isLogoView = currentView.id === targetLogoViewId;
    const logoCutoutUrl = logoCutout && isLogoView
      ? profile.coverage_and_cutouts?.logo_cutout_mask_url || assets.logo_cutout_url
      : undefined;

    const pencilCutoutUrl = pencilCutout
      ? profile.coverage_and_cutouts?.pencil_cutout_mask_url || assets.pencil_cutout_url
      : undefined;

    const targetModelCutViewId = profile.coverage_and_cutouts?.model_cut_view_id || 'main_view';
    const isModelCutView = currentView.id === targetModelCutViewId;
    const modelCutMaskUrl = isModelCutOnly && isModelCutView
      ? currentView.model_cut_mask_url || profile.coverage_and_cutouts?.model_cut_mask_url || assets.model_cutout_url
      : undefined;

    let logoImg: HTMLImageElement | null = null;
    let pencilImg: HTMLImageElement | null = null;
    let modelCutImg: HTMLImageElement | null = null;

    if (logoCutoutUrl) {
      try {
        logoImg = await loadCorsSafeImageElement(logoCutoutUrl, profile.product_id);
      } catch {
        logoImg = null;
      }
    }
    if (pencilCutoutUrl) {
      try {
        pencilImg = await loadCorsSafeImageElement(pencilCutoutUrl, profile.product_id);
      } catch {
        pencilImg = null;
      }
    }
    if (modelCutMaskUrl) {
      try {
        modelCutImg = await loadCorsSafeImageElement(modelCutMaskUrl, profile.product_id);
      } catch {
        modelCutImg = null;
      }
    }

    // Layer subcanvas
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = 1500;
    layerCanvas.height = 1500;
    const lCtx = layerCanvas.getContext('2d');
    if (!lCtx) continue;

    // A. Draw pattern texture
    if (texImg && texImg.width > 0 && texImg.height > 0) {
      const rot = (layer.texture_rotation || 0) % 360;
      const zoom = currentView.texture_scale ?? profile.texture_scale ?? layer.texture_scale ?? 1.0;
      const baseScale = Math.max(1500 / texImg.width, 1500 / texImg.height);
      const scale = baseScale * zoom;

      let patternPainted = false;
      try {
        const pattern = lCtx.createPattern(texImg, 'repeat');
        if (pattern) {
          const matrix = new DOMMatrix();
          matrix.translateSelf(750, 750);
          if (rot !== 0) matrix.rotateSelf(rot);
          matrix.scaleSelf(scale, scale);
          matrix.translateSelf(-texImg.width / 2, -texImg.height / 2);
          pattern.setTransform(matrix);
          lCtx.fillStyle = pattern;
          lCtx.fillRect(0, 0, 1500, 1500);
          patternPainted = true;
        }
      } catch {
        patternPainted = false;
      }

      if (!patternPainted) {
        const rotRad = (rot * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rotRad));
        const sin = Math.abs(Math.sin(rotRad));
        const neededW = 1500 * cos + 1500 * sin;
        const neededH = 1500 * sin + 1500 * cos;
        const coverScale = Math.max(neededW / texImg.width, neededH / texImg.height, 1.0);
        const drawW = texImg.width * coverScale;
        const drawH = texImg.height * coverScale;

        lCtx.save();
        lCtx.translate(750, 750);
        if (rot !== 0) lCtx.rotate(rotRad);
        lCtx.drawImage(texImg, -drawW / 2, -drawH / 2, drawW, drawH);
        lCtx.restore();
      }
    } else {
      lCtx.fillStyle = activeFinish.color_hex || '#18181b';
      lCtx.fillRect(0, 0, 1500, 1500);
    }

    // B. Alpha mask clip
    lCtx.globalCompositeOperation = 'destination-in';
    lCtx.drawImage(maskImg, 0, 0, 1500, 1500);

    // C. Cutouts
    if (logoImg) {
      lCtx.globalCompositeOperation = 'destination-out';
      lCtx.drawImage(logoImg, 0, 0, 1500, 1500);
    }
    if (pencilImg) {
      lCtx.globalCompositeOperation = 'destination-out';
      lCtx.drawImage(pencilImg, 0, 0, 1500, 1500);
    }
    if (modelCutImg) {
      lCtx.globalCompositeOperation = 'destination-out';
      lCtx.drawImage(modelCutImg, 0, 0, 1500, 1500);
    }

    // D. Directional bevel & synthetic shading on primary/back layers
    const isBackOrRequired = Boolean(
      layer.is_required ||
      layer.group === 'primary' ||
      (/\b(back|top|body|device)\b/i.test(layer.name) && !/\b(accent|camera|frame|side|logo|additional|addon)\b/i.test(layer.name))
    );
    const hasViewShadow = Boolean(currentView.shadow_png_url || currentView.highlight_png_url);

    if (isBackOrRequired && !hasViewShadow) {
      // Inner bevel shading
      const bevelCanvas = document.createElement('canvas');
      bevelCanvas.width = 1500;
      bevelCanvas.height = 1500;
      const bCtx = bevelCanvas.getContext('2d');
      if (bCtx) {
        bCtx.drawImage(layerCanvas, 0, 0);
        bCtx.globalCompositeOperation = 'source-in';
        bCtx.fillStyle = '#000000';
        bCtx.fillRect(0, 0, 1500, 1500);

        const invCanvas = document.createElement('canvas');
        invCanvas.width = 1500;
        invCanvas.height = 1500;
        const iCtx = invCanvas.getContext('2d');
        if (iCtx) {
          iCtx.fillStyle = '#000000';
          iCtx.fillRect(0, 0, 1500, 1500);
          iCtx.globalCompositeOperation = 'destination-out';
          iCtx.drawImage(bevelCanvas, 0, 0);

          const sCanvas = document.createElement('canvas');
          sCanvas.width = 1500;
          sCanvas.height = 1500;
          const sCtx = sCanvas.getContext('2d');
          if (sCtx) {
            sCtx.filter = 'blur(7px)';
            sCtx.drawImage(invCanvas, 5, 5);
            sCtx.filter = 'none';
            sCtx.globalCompositeOperation = 'destination-in';
            sCtx.drawImage(bevelCanvas, 0, 0);

            lCtx.save();
            lCtx.globalCompositeOperation = 'multiply';
            lCtx.globalAlpha = 0.35;
            lCtx.drawImage(sCanvas, 0, 0);
            lCtx.restore();
          }
        }
      }
    }

    // Merge layer to device canvas
    dCtx.drawImage(layerCanvas, 0, 0);
  }

  // 4. View Specular Highlights and 3D Shadows
  const shadingSrc = currentView.shadow_png_url || currentView.shading_image_url || currentView.highlight_png_url;
  if (shadingSrc) {
    try {
      const shadingImg = await loadCorsSafeImageElement(shadingSrc, profile.product_id);
      if (shadingImg && shadingImg.width > 0) {
        const shadowOpacity = activeFinish.shadow_opacity ?? currentView.shadow_opacity ?? 0.85;
        const highlightOpacity = activeFinish.highlight_opacity ?? currentView.highlight_opacity ?? 0.35;

        if (shadowOpacity > 0) {
          dCtx.save();
          dCtx.globalCompositeOperation = 'multiply';
          dCtx.globalAlpha = shadowOpacity;
          dCtx.drawImage(shadingImg, 0, 0, 1500, 1500);
          dCtx.restore();
        }
        if (highlightOpacity > 0) {
          dCtx.save();
          dCtx.globalCompositeOperation = 'screen';
          dCtx.globalAlpha = highlightOpacity;
          dCtx.drawImage(shadingImg, 0, 0, 1500, 1500);
          dCtx.restore();
        }
      }
    } catch {
      // Ignore shading failure
    }
  }

  return devCanvas;
}

/**
 * Master Render Function: renders the complete 1500x1500px Marketplace Image onto a canvas
 */
export async function renderMarketplaceImageToCanvas(
  targetCanvas: HTMLCanvasElement,
  config: MarketplaceImageConfig
): Promise<void> {
  const width = config.canvasWidth || 1500;
  const height = config.canvasHeight || 1500;
  targetCanvas.width = width;
  targetCanvas.height = height;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  // Ensure fonts are loaded
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Font load fallback
    }
  }

  // 1. Draw Background
  if (config.bgType === 'custom' && config.customBgUrl?.trim()) {
    try {
      const bgImg = await loadCorsSafeImageElement(config.customBgUrl.trim());
      if (bgImg && bgImg.width > 0) {
        // Draw cover aspect ratio
        const scale = Math.max(width / bgImg.width, height / bgImg.height);
        const dw = bgImg.width * scale;
        const dh = bgImg.height * scale;
        const dx = (width - dw) / 2;
        const dy = (height - dh) / 2;
        ctx.drawImage(bgImg, dx, dy, dw, dh);
      } else {
        drawStudioLightBackground(ctx, width, height);
      }
    } catch {
      drawStudioLightBackground(ctx, width, height);
    }
  } else {
    drawStudioLightBackground(ctx, width, height);
  }

  // 2. Render Phone Device
  const deviceCanvas = await renderDeviceComposite(config);

  // Position and scale device in canvas (center-right orientation matching Image 2)
  // Base placement: width ~980px, height ~1100px
  const baseDeviceW = 1000;
  const baseDeviceH = 1000;
  const scale = (config.deviceScale || 1.0) * 1.15;
  const dw = baseDeviceW * scale;
  const dh = baseDeviceH * scale;

  // Center-right default position
  const defaultDx = 450 + (config.deviceOffsetX || 0);
  const defaultDy = 100 + (config.deviceOffsetY || 0);

  // Soft studio contact shadow under phone
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetX = 14;
  ctx.shadowOffsetY = 24;
  ctx.drawImage(deviceCanvas, defaultDx, defaultDy, dw, dh);
  ctx.restore();

  // Draw device crisp on top of shadow
  ctx.drawImage(deviceCanvas, defaultDx, defaultDy, dw, dh);

  // 3. Top-Left Exacoat Logo Pill
  if (config.showLogo) {
    await drawLogoPill(ctx, 60, 55, 240, 72);
  }

  // 4. Top-Right Device Name Pill
  if (config.deviceNameText?.trim()) {
    drawDeviceNamePill(ctx, config.deviceNameText, width - 60, 55, 72);
  }

  // 5. Left Column: Sub-badge & Big Bold Headline
  drawLeftHeadlineBlock(
    ctx,
    config.subBadgeText || '',
    config.headlineText || 'Ark\nInvisible\nSkin',
    config.headlineFont || 'Chakra Petch',
    60,
    190
  );

  // 6. Right Edge: 20+ Skins Swatches Stack (from Image 1)
  if (config.showSkinsStack) {
    const swatchList = config.allFinishes.filter((f) =>
      config.swatchFinishSlugs.includes(f.slug || f.id)
    );
    // Fallback if none matched
    const effectiveSwatches = swatchList.length > 0 ? swatchList : config.allFinishes.slice(0, 2);
    await drawSkinsStack(
      ctx,
      effectiveSwatches,
      config.skinsCountText || '20+',
      config.skinsLabelText || 'SKINS',
      width - 170,
      500
    );
  }

  // 7. Bottom Feature Cards (3 cards row)
  drawBottomFeatureCards(ctx, config.featureCards, 1240, 185, width);
}

/**
 * Generates a high quality JPEG Blob of a marketplace image
 */
export async function generateMarketplaceImageBlob(
  config: MarketplaceImageConfig
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  await renderMarketplaceImageToCanvas(canvas, config);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      0.95
    );
  });
}

/**
 * Batch generates marketplace images for multiple finishes and zips them
 */
export async function batchGenerateMarketplaceZip(
  baseConfig: MarketplaceImageConfig,
  targetFinishes: GlobalFinish[],
  onProgress?: (current: number, total: number, finishName: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  const total = targetFinishes.length;

  for (let i = 0; i < total; i++) {
    const finish = targetFinishes[i];
    if (onProgress) {
      onProgress(i + 1, total, finish.name);
    }

    const currentConfig: MarketplaceImageConfig = {
      ...baseConfig,
      activeFinish: finish,
    };

    const blob = await generateMarketplaceImageBlob(currentConfig);
    const indexStr = String(i + 1).padStart(2, '0');
    const slugStr = (finish.slug || finish.id || `finish_${i + 1}`).replace(/[^a-z0-9_-]/gi, '_');
    const filename = `${indexStr}_${slugStr}.jpg`;

    zip.file(filename, blob);
  }

  return await zip.generateAsync({ type: 'blob' });
}
