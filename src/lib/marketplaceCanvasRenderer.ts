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
  activeColorId?: string;
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
  autoHeadlineWithFinish?: boolean;

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

export const DEFAULT_FEATURE_CARDS_OFFICIAL: MarketplaceFeatureCard[] = [
  {
    id: 'card_1',
    title: '100% Original',
    subtitle: 'Exacoat Official Store',
    iconType: 'shield',
  },
  {
    id: 'card_2',
    title: '3M Material',
    subtitle: 'From USA, Japan, Italy',
    iconType: 'material',
  },
  {
    id: 'card_3',
    title: 'Installation\nWarranty',
    subtitle: 'Risk free installation',
    iconType: 'guarantee',
  },
];

export const DEFAULT_FEATURE_CARDS_VINYL: MarketplaceFeatureCard[] = DEFAULT_FEATURE_CARDS_OFFICIAL;

export const DEFAULT_FEATURE_CARDS_FIT: MarketplaceFeatureCard[] = [
  {
    id: 'card_1',
    title: '3M Material',
    subtitle: 'From USA, Japan, Italy',
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
    title: 'Installation\nWarranty',
    subtitle: 'Risk free installation',
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
    title: 'Installation\nWarranty',
    subtitle: 'Risk free installation',
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
    width * 0.45,
    height * 0.45,
    120,
    width * 0.5,
    height * 0.5,
    width * 0.9
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
      // Pattern fallback ignored
    }
  }

  // 3. Soft vignette around borders
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    width * 0.45,
    width * 0.5,
    height * 0.5,
    width * 0.78
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.035)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draws the dark Exacoat logo pill on top-left (Image 2 style)
 */
async function drawLogoPill(
  ctx: CanvasRenderingContext2D,
  x: number = 50,
  y: number = 50,
  w: number = 460,
  h: number = 140
) {
  ctx.save();

  // Pill container
  pathRoundedRect(ctx, x, y, w, h, 40);
  ctx.fillStyle = '#18181b';
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Load and draw SVG logo
  let svgDrawn = false;
  try {
    const logoImg = await loadCorsSafeImageElement('/assets/brand/exacoat-logo.svg');
    if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
      const logoAspect = logoImg.width / logoImg.height;
      const targetH = 50;
      const targetW = targetH * logoAspect;
      const logoX = x + (w - targetW) / 2;
      const logoY = y + (h - targetH) / 2;
      ctx.drawImage(logoImg, logoX, logoY, targetW, targetH);
      svgDrawn = true;
    }
  } catch {
    svgDrawn = false;
  }

  // Fallback vector typography
  if (!svgDrawn) {
    ctx.fillStyle = '#f3aa18';
    ctx.font = '800 52px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('exacoat.', x + w / 2, y + h / 2 + 2);
  }

  ctx.restore();
}

/**
 * Draws the device name pill on top right ("ALL DEVICES" style)
 */
function drawDeviceNamePill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number = 540,
  y: number = 50,
  w: number = 910,
  h: number = 140
) {
  if (!text.trim()) return;

  ctx.save();

  // Soft shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.04)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;

  // Pill container
  pathRoundedRect(ctx, x, y, w, h, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Typography: bold, spaced capital letters
  ctx.fillStyle = '#09090b';
  ctx.font = '900 52px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const cleanText = text.toUpperCase();

  try {
    (ctx as any).letterSpacing = '8px';
  } catch {}
  ctx.fillText(cleanText, x + w / 2, y + h / 2 + 2);

  ctx.restore();
}

/**
 * Draws the left headline typography and sub-badge (matching Image 2)
 */
function drawLeftHeadlineBlock(
  ctx: CanvasRenderingContext2D,
  subBadgeText: string,
  headlineText: string,
  fontFamily: string,
  x: number = 50,
  startY: number = 635
) {
  ctx.save();
  let currentY = startY;

  // 1. Sub-badge pill (e.g. "Model Cut & 360")
  if (subBadgeText.trim()) {
    ctx.font = '800 34px "Chakra Petch", sans-serif';
    const textMetrics = ctx.measureText(subBadgeText);
    const badgeW = textMetrics.width + 64;
    const badgeH = 76;

    // Subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    pathRoundedRect(ctx, x, currentY, badgeW, badgeH, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#09090b';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(subBadgeText, x + badgeW / 2, currentY + badgeH / 2 + 1);

    currentY += badgeH + 28;
  }

  // 2. Bold Headline Text (e.g. "Woven\nSkins")
  const lines = headlineText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length > 0) {
    const maxLineLen = Math.max(...lines.map((l) => l.length));
    let fontSize = 145;
    let lineHeight = 152;

    if (maxLineLen > 16) {
      fontSize = 90;
      lineHeight = 98;
    } else if (maxLineLen > 11) {
      fontSize = 115;
      lineHeight = 122;
    }

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
 * Draws clean vector feature icons inside cards matching Image 2
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
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (iconType === 'material') {
    // Rosette star ribbon icon (matching Card 2 in Image 2)
    const spikes = 5;
    const outerR = 11.5;
    const innerR = 5.5;
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerR;
      y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (iconType === 'fit') {
    // Calipers / Precision Target icon
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 13, cy);
    ctx.lineTo(cx - 9, cy);
    ctx.moveTo(cx + 9, cy);
    ctx.lineTo(cx + 13, cy);
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx, cy - 9);
    ctx.moveTo(cx, cy + 9);
    ctx.lineTo(cx, cy + 13);
    ctx.stroke();
  } else if (iconType === 'scratch') {
    // Key / Shield Scratch Proof
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 8);
    ctx.lineTo(cx + 5, cy + 3);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + 6, cy + 4, 4.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 10);
    ctx.lineTo(cx - 8, cy - 6);
    ctx.stroke();
  } else {
    // Checkmark Badge / Guarantee Shield (Card 1 & Card 3 in Image 2)
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx + 10, cy - 7);
    ctx.lineTo(cx + 10, cy + 3);
    ctx.quadraticCurveTo(cx + 10, cy + 11, cx, cy + 13);
    ctx.quadraticCurveTo(cx - 10, cy + 11, cx - 10, cy + 3);
    ctx.lineTo(cx - 10, cy - 7);
    ctx.closePath();
    ctx.stroke();

    // Checkmark inside shield
    ctx.beginPath();
    ctx.moveTo(cx - 4.5, cy + 1);
    ctx.lineTo(cx - 1, cy + 4.5);
    ctx.lineTo(cx + 5, cy - 2.5);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the 3 bottom feature cards in the foreground (matching Image 2)
 */
function drawBottomFeatureCards(
  ctx: CanvasRenderingContext2D,
  cards: MarketplaceFeatureCard[],
  startY: number = 1235,
  cardH: number = 215,
  totalW: number = 1500
) {
  if (!cards || cards.length === 0) return;

  const numCards = Math.min(3, cards.length);
  const marginX = 50;
  const gap = 28;
  const availableW = totalW - marginX * 2 - gap * (numCards - 1);
  const cardW = availableW / numCards;

  ctx.save();

  cards.slice(0, 3).forEach((card, idx) => {
    const x = marginX + idx * (cardW + gap);
    const y = startY;

    // 1. Card background with soft contact shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;

    pathRoundedRect(ctx, x, y, cardW, cardH, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 2. Card subtle border
    ctx.save();
    pathRoundedRect(ctx, x, y, cardW, cardH, 28);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 3. Subtle horizontal divider line
    const dividerY = y + 132;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + 32, dividerY);
    ctx.lineTo(x + cardW - 32, dividerY);
    ctx.strokeStyle = '#f1f1f4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 4. Green circular badge on top-right of card
    const circleR = 27;
    const circleX = x + cardW - 40;
    const circleY = y + 42;

    ctx.save();
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    drawCardIcon(ctx, circleX, circleY, card.iconType);
    ctx.restore();

    // 5. Card Title (supports 1 or 2 lines)
    ctx.save();
    const titleLines = (card.title || '').split('\n').filter(Boolean);
    const maxTitleW = cardW - 88;

    ctx.fillStyle = '#09090b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    if (titleLines.length >= 2) {
      ctx.font = '800 30px "Plus Jakarta Sans", "Chakra Petch", sans-serif';
      ctx.fillText(titleLines[0], x + 34, y + 44, maxTitleW);
      ctx.fillText(titleLines[1], x + 34, y + 80, maxTitleW);
    } else {
      ctx.font = '800 34px "Plus Jakarta Sans", "Chakra Petch", sans-serif';
      ctx.fillText(card.title || '', x + 34, y + 62, maxTitleW);
    }

    // 6. Card Subtitle (italic, under divider line)
    ctx.font = 'italic 500 20px "Plus Jakarta Sans", "Inter", sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.fillText(card.subtitle || '', x + 34, y + 168, maxTitleW);
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
  x: number = 1330,
  startY: number = 520
) {
  const swatchSize = 105;
  const radius = 22;
  let currentY = startY;

  ctx.save();

  // Draw 2 swatch thumbnails
  for (const finish of swatchFinishes.slice(0, 2)) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;

    pathRoundedRect(ctx, x, currentY, swatchSize, swatchSize, radius);
    ctx.fillStyle = '#27272a';
    ctx.fill();
    ctx.restore();

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
        ctx.save();
        pathRoundedRect(ctx, x, currentY, swatchSize, swatchSize, radius);
        ctx.fillStyle = finish.color_hex || '#27272a';
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.save();
    pathRoundedRect(ctx, x, currentY, swatchSize, swatchSize, radius);
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    currentY += swatchSize + 14;
  }

  // "20+ SKINS" badge
  const badgeH = 86;
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

  ctx.textAlign = 'center';
  ctx.fillStyle = '#09090b';

  ctx.font = '900 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(countText, x + swatchSize / 2, currentY + 36);

  ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(labelText, x + swatchSize / 2, currentY + 64);
  ctx.restore();

  ctx.restore();
}

/**
 * Directional inner bevel and rim shading on skin cuts
 */
function applySyntheticDirectionalShading(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: {
    enabled?: boolean;
    softness?: number;
    distance?: number;
    shadow_opacity?: number;
    highlight_opacity?: number;
  }
) {
  if (options?.enabled === false) return;

  const softness = typeof options?.softness === 'number' ? options.softness : 6;
  const distance = typeof options?.distance === 'number' ? options.distance : 3;
  const shadowAlpha = typeof options?.shadow_opacity === 'number' ? options.shadow_opacity : 0.38;
  const highlightAlpha = typeof options?.highlight_opacity === 'number' ? options.highlight_opacity : 0.24;

  const shadowDx = distance;
  const shadowDy = distance;
  const hlDx = -shadowDx;
  const hlDy = -shadowDy;

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

  // Soft inner shadow
  if (shadowAlpha > 0) {
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

  // Soft rim highlight
  if (highlightAlpha > 0) {
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
}

/**
 * Composites the phone hardware with genuine skin layers (filtering out device chassis)
 */
async function renderDeviceComposite(
  config: MarketplaceImageConfig
): Promise<HTMLCanvasElement> {
  const { profile, activeFinish, coverage, logoCutout, pencilCutout, selectedViewId, activeColorId } = config;

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

  // 2. Hardware chassis base image (contains real phone body, lenses, frame, ports)
  const activeColor =
    (activeColorId && profile.device_colors?.find((c) => c.id === activeColorId)) ||
    profile.device_colors?.[0];

  const dedicatedColorImg =
    (activeColor as any)?.body_images_by_view?.[currentView?.id] ||
    (currentView?.is_default || currentView?.id === 'main_view'
      ? activeColor?.body_image_url
      : '');

  let chassisSrc = dedicatedColorImg || currentView?.background_url;
  if (!chassisSrc) {
    const devLayer = profile.layers.find((l) => {
      const n = (l.name || '').toLowerCase();
      const id = (l.id || '').toLowerCase();
      return n === 'device' || id === 'device' || n.includes('chassis') || n.includes('hardware');
    });
    if (devLayer) {
      const devAsset = devLayer.assets_by_view?.[currentView.id] || devLayer.assets_by_view?.['main_view'];
      chassisSrc = (devAsset as any)?.overlay_url || (devAsset as any)?.background_url || '';
    }
  }

  if (chassisSrc) {
    try {
      const chassisImg = await loadCorsSafeImageElement(chassisSrc, profile.product_id);
      if (chassisImg && chassisImg.width > 0) {
        dCtx.drawImage(chassisImg, 0, 0, 1500, 1500);
      }
    } catch (err) {
      console.warn('[Marketplace Generator] Chassis load failed:', err);
    }
  }

  // 3. Filter genuine skin layers:
  // Strictly EXCLUDE device body, chassis, and hardware layers so they never act as an alpha mask!
  const skinLayers = (profile.layers || []).filter((l) => {
    if (l.is_non_visual) return false;
    const lName = (l.name || '').toLowerCase().trim();
    const lId = (l.id || '').toLowerCase().trim();
    if (lName === 'device' || lId === 'device') return false;
    if (lName.includes('device-body') || lName.includes('device_body')) return false;
    if (lName.includes('chassis') || lName.includes('hardware')) return false;
    if ((l.group as string) === 'device' || (l.group as string) === 'hardware') return false;
    return true;
  });

  const sortedLayers = [...skinLayers].sort((a, b) => (a.z_index || 1) - (b.z_index || 1));

  for (const layer of sortedLayers) {
    // Resolve assets for current view
    const viewSpecificAsset = layer.assets_by_view?.[currentView.id || 'main_view'];
    const hasViewSpecificTex = Boolean(
      viewSpecificAsset?.mask_svg_url ||
      (viewSpecificAsset?.render_texture_map && Object.keys(viewSpecificAsset.render_texture_map).length > 0)
    );

    const hasOtherAngleAssignments = Boolean(
      profile.views &&
      profile.views.length > 1 &&
      Object.entries(layer.assets_by_view || {}).some(
        ([vId, vAsset]) =>
          vId !== currentView.id &&
          (vAsset.mask_svg_url || Object.keys(vAsset.render_texture_map || {}).length > 0)
      )
    );

    if (!hasViewSpecificTex && hasOtherAngleAssignments) {
      // Layer belongs strictly to another angle on this multi-view device (e.g. inner screen, top, bottom)
      continue;
    }

    const assets =
      viewSpecificAsset ||
      layer.assets_by_view?.['main_view'] ||
      Object.values(layer.assets_by_view || {}).find(
        (a) => Boolean(a.mask_svg_url) || Object.keys(a.render_texture_map || {}).length > 0
      ) ||
      {};

    // Check layer finish restrictions
    if (layer.allowed_finish_slugs && layer.allowed_finish_slugs.length > 0) {
      const norm = (activeFinish.slug || activeFinish.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const isAllowed = layer.allowed_finish_slugs.some(
        (as) => as.toLowerCase().replace(/[^a-z0-9]/g, '') === norm
      );
      if (!isAllowed) continue;
    }

    // A. Handle v1 Engine (pre-rendered texture overlay without mask)
    const textureMap = assets.render_texture_map || {};
    const simNorm = (activeFinish.slug || activeFinish.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchedKey = Object.keys(textureMap).find(
      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === simNorm
    );
    const mappedTex = matchedKey ? textureMap[matchedKey] || '' : '';

    if (profile.configurator_version !== 'v2' && !assets.mask_svg_url && mappedTex) {
      try {
        const texImg = await loadCorsSafeImageElement(mappedTex, profile.product_id);
        if (texImg && texImg.width > 0) {
          dCtx.drawImage(texImg, 0, 0, 1500, 1500);
        }
      } catch {}
      continue;
    }

    // B. Handle v2 Engine (dynamic canvas compositing with alpha mask & cutouts)
    if (!assets.mask_svg_url) continue;

    let maskImg: HTMLImageElement | null = null;
    try {
      maskImg = await loadCorsSafeImageElement(assets.mask_svg_url, profile.product_id);
    } catch {
      maskImg = null;
    }
    if (!maskImg) continue;

    // Resolve texture
    const isCustomPerDevice = Boolean(activeFinish.is_custom_per_device);
    const customTex = isCustomPerDevice
      ? (assets.render_texture_map?.[activeFinish.slug] ||
         assets.render_texture_map?.[activeFinish.id] ||
         mappedTex)
      : '';

    const isBigDevice =
      profile.family === 'laptop' ||
      profile.family === 'tablet' ||
      (profile.family as string) === 'tablet_laptop' ||
      profile.family === 'keyboard';
    const useBigTexture = layer.texture_size === 'big' || (layer.texture_size !== 'small' && isBigDevice);
    const activeTexUrl = (useBigTexture && activeFinish.texture_big_url)
      ? activeFinish.texture_big_url
      : activeFinish.texture_url || '';

    const textureToTile = (isCustomPerDevice && customTex)
      ? customTex
      : (activeTexUrl || customTex);

    let texImg: HTMLImageElement | null = null;
    if (textureToTile) {
      try {
        texImg = await loadCorsSafeImageElement(textureToTile);
      } catch {
        texImg = null;
      }
    }

    // Cutouts resolution
    const covMode = profile.coverage_and_cutouts?.coverage_type || (profile.coverage_and_cutouts?.has_model_cut ? 'model_cut_and_360' : 'none');
    const isModelCutOnly = covMode === 'model_cut_only';
    const hasCoverageOptions = covMode === 'model_cut_and_360';
    const shouldApplyModelCut = isModelCutOnly || (hasCoverageOptions && coverage === 'model_cut');
    const shouldApplyLogoCutout = logoCutout && (profile.coverage_and_cutouts?.has_logo_cutout ?? true);
    const shouldApplyPencilCutout = pencilCutout && Boolean(profile.coverage_and_cutouts?.has_pencil_cutout);

    const targetLogoViewId = profile.coverage_and_cutouts?.logo_cutout_view_id || 'main_view';
    const isLogoView = currentView.id === targetLogoViewId || (!profile.coverage_and_cutouts?.logo_cutout_view_id && (currentView.is_default || currentView.id === profile.views?.[0]?.id));
    const logoCutoutUrl = shouldApplyLogoCutout && isLogoView
      ? currentView.logo_cutout_mask_url || profile.coverage_and_cutouts?.logo_cutout_mask_url || assets.logo_cutout_url
      : undefined;

    const pencilCutoutUrl = shouldApplyPencilCutout
      ? currentView.pencil_cutout_mask_url || profile.coverage_and_cutouts?.pencil_cutout_mask_url || assets.pencil_cutout_url
      : undefined;

    const targetModelCutViewId = profile.coverage_and_cutouts?.model_cut_view_id || 'main_view';
    const isModelCutView = currentView.id === targetModelCutViewId || (!profile.coverage_and_cutouts?.model_cut_view_id && (currentView.is_default || currentView.id === profile.views?.[0]?.id));
    const modelCutMaskUrl = shouldApplyModelCut && isModelCutView
      ? currentView.model_cut_mask_url || profile.coverage_and_cutouts?.model_cut_mask_url || assets.model_cutout_url
      : undefined;

    let logoImg: HTMLImageElement | null = null;
    let pencilImg: HTMLImageElement | null = null;
    let modelCutImg: HTMLImageElement | null = null;

    if (logoCutoutUrl) {
      try {
        logoImg = await loadCorsSafeImageElement(logoCutoutUrl, profile.product_id);
      } catch {}
    }
    if (pencilCutoutUrl) {
      try {
        pencilImg = await loadCorsSafeImageElement(pencilCutoutUrl, profile.product_id);
      } catch {}
    }
    if (modelCutMaskUrl) {
      try {
        modelCutImg = await loadCorsSafeImageElement(modelCutMaskUrl, profile.product_id);
      } catch {}
    }

    // Layer subcanvas
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = 1500;
    layerCanvas.height = 1500;
    const lCtx = layerCanvas.getContext('2d');
    if (!lCtx) continue;

    // Tile pattern texture
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

    // Alpha mask clip
    lCtx.globalCompositeOperation = 'destination-in';
    lCtx.drawImage(maskImg, 0, 0, 1500, 1500);

    // Punch out cutouts
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

    // Synthetic directional inner shading for realistic skin edges
    const isBackOrRequired = Boolean(
      layer.is_required ||
      layer.group === 'primary' ||
      (/\b(back|top|body)\b/i.test(layer.name) && !/\b(accent|camera|frame|side|logo|additional|addon)\b/i.test(layer.name))
    );
    const hasViewShadow = Boolean(currentView.shadow_png_url || currentView.highlight_png_url);

    if (isBackOrRequired && !hasViewShadow) {
      lCtx.globalCompositeOperation = 'source-over';
      applySyntheticDirectionalShading(lCtx, 1500, 1500, currentView.generated_shadow);
    }

    // Merge layer onto device canvas
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
      // Shading failure ignored
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

  // Ensure fonts are ready
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {}
  }

  // 1. Draw Background
  if (config.bgType === 'custom' && config.customBgUrl?.trim()) {
    try {
      const bgImg = await loadCorsSafeImageElement(config.customBgUrl.trim());
      if (bgImg && bgImg.width > 0) {
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

  // Close-Up Hero Shot Scaling & Placement (matching Image 2)
  // Base scale = 1.7 ensures the phone is large, zoomed-in, and prominent in the right half of the canvas
  const baseScale = 1.7;
  const effectiveScale = (config.deviceScale || 1.0) * baseScale;
  const dw = 1500 * effectiveScale;
  const dh = 1500 * effectiveScale;

  // Center of phone in deviceCanvas is (750, 750).
  // Target placement: phone positioned on the right with camera island centered in upper-right half,
  // top of phone dipping below "ALL DEVICES" pill, bottom extending behind cards.
  const targetCenterX = 1120 + (config.deviceOffsetX || 0);
  const targetCenterY = 1205 + (config.deviceOffsetY || 0);

  const dx = targetCenterX - 750 * effectiveScale;
  const dy = targetCenterY - 750 * effectiveScale;

  // Soft studio contact shadow under phone
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.20)';
  ctx.shadowBlur = 54;
  ctx.shadowOffsetX = -18;
  ctx.shadowOffsetY = 28;
  ctx.drawImage(deviceCanvas, dx, dy, dw, dh);
  ctx.restore();

  // Draw phone crisp
  ctx.drawImage(deviceCanvas, dx, dy, dw, dh);

  // 3. Top-Left Exacoat Logo Pill (Image 2 style)
  if (config.showLogo) {
    await drawLogoPill(ctx, 50, 50, 460, 140);
  }

  // 4. Top-Right Device Name Badge ("ALL DEVICES" style)
  if (config.deviceNameText?.trim()) {
    drawDeviceNamePill(ctx, config.deviceNameText, 540, 50, 910, 140);
  }

  // 5. Left Column: Sub-badge & Big Bold Headline
  const effectiveHeadline = config.autoHeadlineWithFinish
    ? `${config.activeFinish.name}\nSkins`
    : (config.headlineText || `${config.activeFinish.name}\nSkins`);

  drawLeftHeadlineBlock(
    ctx,
    config.subBadgeText || '',
    effectiveHeadline,
    config.headlineFont || 'Chakra Petch',
    50,
    635
  );

  // 6. Right Edge: 20+ Skins Swatches Stack (toggleable option)
  if (config.showSkinsStack) {
    const swatchList = config.allFinishes.filter((f) =>
      config.swatchFinishSlugs.includes(f.slug || f.id)
    );
    const effectiveSwatches = swatchList.length > 0 ? swatchList : config.allFinishes.slice(0, 2);
    await drawSkinsStack(
      ctx,
      effectiveSwatches,
      config.skinsCountText || '20+',
      config.skinsLabelText || 'SKINS',
      width - 155,
      520
    );
  }

  // 7. Bottom Feature Cards (3 cards row in foreground - overlays bottom of phone)
  drawBottomFeatureCards(ctx, config.featureCards, 1235, 215, width);
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
      headlineText: baseConfig.autoHeadlineWithFinish
        ? `${finish.name}\nSkins`
        : baseConfig.headlineText,
    };

    const blob = await generateMarketplaceImageBlob(currentConfig);
    const indexStr = String(i + 1).padStart(2, '0');
    const slugStr = (finish.slug || finish.id || `finish_${i + 1}`).replace(/[^a-z0-9_-]/gi, '_');
    const filename = `${indexStr}_${slugStr}.jpg`;

    zip.file(filename, blob);
  }

  return await zip.generateAsync({ type: 'blob' });
}
