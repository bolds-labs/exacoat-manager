import type { DeviceConfiguratorProfile } from '../types';
import type { GlobalFinish } from './wordpressBridge';
import { loadCorsSafeImageElement } from './imageLoader';
import JSZip from 'jszip';

export interface MarketplaceFeatureCard {
  id: string;
  title: string;
  subtitle: string;
  iconType: 'material' | 'fit' | 'guarantee' | 'scratch' | 'matte' | 'shield' | 'texture';
  imageUrl?: string;
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
  brandTagline?: string;
  showBrandTagline?: boolean;
  topRightText?: string;
  isPrimaryImage?: boolean;
  deviceNameText?: string;

  // Headline
  subBadgeText: string;
  headlineText: string;
  headlineFont: 'Chakra Petch' | 'Plus Jakarta Sans' | 'Inter';
  autoHeadlineWithFinish?: boolean;
  headlineHighlightColor?: string;

  // Feature Cards (Bottom Row)
  featureCards: MarketplaceFeatureCard[];

  // Swatches Stack (Right Edge)
  showSkinsStack: boolean;
  skinsCountText: string;
  skinsLabelText: string;
  swatchFinishSlugs: string[];

  // Layout Mode: 'cover' (hero close-up 100%, 3 bottom cards, left headline) vs 'variant' (full device 75%, left stacked cards + textured surface, clean bottom)
  layoutMode?: 'cover' | 'variant';

  // Marketplace Channel Selector (Shopee vs Tokopedia)
  marketplaceChannel?: 'shopee' | 'tokopedia';
  tokopediaBadgeUrl?: string;

  // Variant Left Stacked Cards Options
  variantLeftCards?: {
    showOriginal3M?: boolean;
    showMaterialOrigin?: boolean;
    showWarranty?: boolean;
    showTexturePhoto?: boolean;
    texturePhotoUrl?: string;
    warrantyTitle?: string;
  };

  // Device Positioning & Angles
  selectedViewId?: string;
  coverage: 'model_360' | 'model_cut';
  logoCutout: boolean;
  pencilCutout: boolean;
  deviceScale: number;
  deviceOffsetX: number;
  deviceOffsetY: number;
  activeLayerIds?: string[];

  // Skin Surface Lighting & Shading
  surfaceGradientShading?: {
    enabled?: boolean;
    opacity?: number;
    direction?: 'bottom_right' | 'top_left';
  };
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

export const DEFAULT_FEATURE_CARDS_TEXTURE: MarketplaceFeatureCard[] = [
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
    title: 'Textured Surface',
    subtitle: '',
    iconType: 'texture',
    imageUrl: '/assets/brand/textured-skins-product-info.jpg',
  },
];

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
 * Formats a finish name into a clean editorial headline without the "Skins" suffix.
 * Multi-word finishes wrap onto separate lines so they never collide with the phone.
 */
export function formatFinishHeadline(name: string): string {
  if (!name) return '';
  const cleaned = name.trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 1) return cleaned;
  if (words.length === 2) return words.join('\n');
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    if ((current + ' ' + words[i]).length <= 12) {
      current += ' ' + words[i];
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines.join('\n');
}

/**
 * Formats a device product name into a clean editorial headline.
 * Words wrap onto 2 lines max to keep consistent composition.
 */
export function formatDeviceHeadline(name: string): string {
  if (!name) return '';
  const cleaned = name.trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 2) return cleaned;
  if (words.length === 3) return `${words[0]} ${words[1]}\n${words[2]}`;
  const mid = Math.ceil(words.length / 2);
  return `${words.slice(0, mid).join(' ')}\n${words.slice(mid).join(' ')}`;
}

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
 * Renders the subtle geometric Exacoat monogram studio background with rich lighting gradient
 */
function drawStudioLightBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  // 1. Base studio background gradient: clean soft light from top-center falling off to smooth studio neutral silver-grey
  const bgGrad = ctx.createRadialGradient(
    width * 0.48,
    height * 0.42,
    80,
    width * 0.5,
    height * 0.5,
    width * 0.95
  );
  bgGrad.addColorStop(0, '#ffffff');
  bgGrad.addColorStop(0.35, '#f8f9fb');
  bgGrad.addColorStop(0.70, '#eceef2');
  bgGrad.addColorStop(1, '#dfe3e8');

  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Secondary soft diagonal studio spotlight beam behind the phone
  const spotGrad = ctx.createRadialGradient(
    width * 0.72,
    height * 0.48,
    40,
    width * 0.72,
    height * 0.48,
    width * 0.55
  );
  spotGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
  spotGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.28)');
  spotGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, width, height);

  // 3. Geometric brand monogram pattern
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 160;
  patternCanvas.height = 160;
  const pCtx = patternCanvas.getContext('2d');

  if (pCtx) {
    pCtx.save();
    pCtx.translate(80, 80);
    pCtx.fillStyle = 'rgba(15, 23, 42, 0.038)';

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

  // 4. Soft vignette around borders
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    width * 0.42,
    width * 0.5,
    height * 0.5,
    width * 0.80
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.045)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draws the dark Exacoat logo pill on top-left (Image 2 style)
 */
/**
 * Draws the dark Exacoat logo pill on top-left (Image 2 style)
 * Features increased rounding (r=54) and optically-centered logo positioning
 */
async function drawLogoPill(
  ctx: CanvasRenderingContext2D,
  x: number = 50,
  y: number = 50,
  w: number = 460,
  h: number = 140,
  r: number = 54
) {
  ctx.save();

  // Subtle drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;

  // Pill container with enhanced dimensional gradient and further rounding
  pathRoundedRect(ctx, x, y, w, h, r);
  const pillGrad = ctx.createLinearGradient(x, y, x + w * 0.12, y + h);
  pillGrad.addColorStop(0, '#464854');      // crisp gunmetal highlight at top
  pillGrad.addColorStop(0.18, '#2d2f38');   // sleek dark titanium
  pillGrad.addColorStop(0.50, '#1b1c21');   // deep graphite
  pillGrad.addColorStop(0.82, '#0f1013');   // rich obsidian
  pillGrad.addColorStop(1.0, '#07080a');    // pure dark base
  ctx.fillStyle = pillGrad;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Specular top-half glass sheen
  ctx.save();
  pathRoundedRect(ctx, x, y, w, h, r);
  ctx.clip();
  const glossGrad = ctx.createLinearGradient(x, y, x, y + h * 0.52);
  glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  glossGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)');
  glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glossGrad;
  ctx.fillRect(x, y, w, h * 0.52);
  ctx.restore();

  // Crisp inner top glass highlight stroke
  const borderGrad = ctx.createLinearGradient(x, y, x, y + h);
  borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.48)');
  borderGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.20)');
  borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Load and draw SVG logo (moved up by 6px to offset optical illusion)
  let svgDrawn = false;
  try {
    const logoImg = await loadCorsSafeImageElement('/assets/brand/exacoat-logo.svg');
    if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
      const logoAspect = logoImg.width / logoImg.height;
      const targetH = 68;
      const targetW = targetH * logoAspect;
      const logoX = x + (w - targetW) / 2;
      const logoY = y + (h - targetH) / 2 - 6;
      ctx.drawImage(logoImg, logoX, logoY, targetW, targetH);
      svgDrawn = true;
    }
  } catch {
    svgDrawn = false;
  }

  // Fallback vector typography
  if (!svgDrawn) {
    ctx.fillStyle = '#f59e0b';
    ctx.font = '800 62px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('exacoat.', x + w / 2, y + h / 2 - 4);
  }

  ctx.restore();
}

/**
 * Draws a beautiful, premium, minimalist, modern tagline capsule directly beneath the Exacoat logo
 * Matches the width of the Exacoat card on top (w=460) with larger typography and black '#1'
 */
function drawBrandTagline(
  ctx: CanvasRenderingContext2D,
  text: string = '#1 Brand Skin di Indonesia',
  x: number = 50,
  y: number = 206,
  w: number = 460
) {
  if (!text.trim()) return;

  ctx.save();

  const pillW = w; // Exactly matches width of Exacoat card above (460px)
  const pillH = 48;
  const pillR = pillH / 2;

  // Subtle modern glass drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  // Background capsule
  pathRoundedRect(ctx, x, y, pillW, pillH, pillR);
  const bgGrad = ctx.createLinearGradient(x, y, x, y + pillH);
  bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
  bgGrad.addColorStop(1, 'rgba(255, 255, 255, 0.84)');
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Subtle refined border
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Larger typography (25px Plus Jakarta Sans bold)
  ctx.font = '700 25px "Plus Jakarta Sans", sans-serif';
  const textMetrics = ctx.measureText(text);
  const iconW = 18;
  const iconGap = 12;
  const totalContentW = iconW + iconGap + textMetrics.width;
  const startContentX = x + Math.max(16, (pillW - totalContentW) / 2);

  // Gold Star / Spark Icon
  const iconCx = startContentX + iconW / 2;
  const iconCy = y + pillH / 2;
  ctx.fillStyle = '#f3aa18';
  ctx.beginPath();
  const spikes = 4;
  const outerR = 8.5;
  const innerR = 3.6;
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.moveTo(iconCx, iconCy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(iconCx + Math.cos(rot) * outerR, iconCy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(iconCx + Math.cos(rot) * innerR, iconCy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();

  // Text inside capsule: all dark black (#18181b), including '#1'
  const textX = startContentX + iconW + iconGap;
  const textY = y + pillH / 2 + 1;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#18181b';
  ctx.font = '700 25px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(text, textX, textY);

  ctx.restore();
}

/**
 * Draws the subtle centered Device Name (same 25px font size as '#1 Brand Skin di Indonesia')
 * and plain subtle coverage text (e.g. 'Model 360' or 'Model Cut') directly below it without any pill border.
 */
function drawVariantDeviceSubheader(
  ctx: CanvasRenderingContext2D,
  deviceTitleText: string,
  coverageSubText: string,
  x: number = 50,
  y: number = 274,
  w: number = 460
) {
  const cleanDeviceTitle = deviceTitleText.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanSubText = coverageSubText.trim();
  if (!cleanDeviceTitle && !cleanSubText) return;

  ctx.save();
  const centerX = x + w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let currentY = y;

  if (cleanDeviceTitle) {
    let fontSize = 25;
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    const maxW = w - 16;
    while (ctx.measureText(cleanDeviceTitle).width > maxW && fontSize > 16) {
      fontSize -= 1;
      ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    }
    ctx.fillStyle = '#18181b';
    ctx.fillText(cleanDeviceTitle, centerX, currentY);
    currentY += 32;
  }

  if (cleanSubText) {
    ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(24, 24, 27, 0.62)';
    ctx.fillText(cleanSubText, centerX, currentY);
  }

  ctx.restore();
}

/**
 * Draws the Tokopedia Official Store Badge under the #1 Brand Skin di Indonesia tagline
 * Source: /assets/brand/tokopedia-official-store-badge.png (natural aspect ratio ~2.97)
 */
async function drawTokopediaBadge(
  ctx: CanvasRenderingContext2D,
  badgeUrl: string = '/assets/brand/tokopedia-official-store-badge.png',
  x: number = 50,
  y: number = 284,
  containerW: number = 460
) {
  try {
    const img = await loadCorsSafeImageElement(badgeUrl);
    if (!img || img.width <= 0 || img.height <= 0) return;

    const naturalRatio = img.width / img.height;
    // Scaled to 75% width of the container card (75% of 460px = 345px)
    const badgeW = Math.round(containerW * 0.75);
    const badgeH = Math.round(badgeW / naturalRatio);
    // Align left flush with the logo pill & tagline container
    const badgeX = x;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(img, badgeX, y, badgeW, badgeH);
    ctx.restore();
  } catch (err) {
    console.warn('[Marketplace Canvas] Could not draw Tokopedia badge:', err);
  }
}

/**
 * Draws the skin name pill or '20+ SKINS SELECTION' on top right in bold spaced capital letters
 * Features increased rounding (r=54) and 5-10% larger typography
 */
function drawTopRightPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number = 540,
  y: number = 50,
  w: number = 910,
  h: number = 140,
  r: number = 54
) {
  if (!text.trim()) return;

  ctx.save();

  // Soft shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.04)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;

  // Pill container with further rounded corners
  pathRoundedRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Typography: bold, spaced capital letters for the skin name or '20+ SKINS SELECTION'
  ctx.fillStyle = '#09090b';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const cleanText = text.toUpperCase();
  // 5-10% larger font sizes:
  // Short text (<= 12 chars, e.g. SWARM): was 50 -> now 56px (+12%)
  // Medium text (13-22 chars, e.g. 20+ SKINS SELECTION): was 46 -> now 50px (+9%)
  // Long text (> 22 chars): was 40 -> now 44px (+10%)
  let fontSize = cleanText.length > 22 ? 44 : cleanText.length > 12 ? 50 : 56;
  ctx.font = `900 ${fontSize}px "Chakra Petch", "Plus Jakarta Sans", sans-serif`;

  const spacing = cleanText.length > 22 ? '3px' : cleanText.length > 12 ? '5px' : '7px';
  try {
    (ctx as any).letterSpacing = spacing;
  } catch {}

  // Safety check: ensure it fits nicely within w - 90
  const maxW = w - 90;
  while (ctx.measureText(cleanText).width > maxW && fontSize > 32) {
    fontSize -= 2;
    ctx.font = `900 ${fontSize}px "Chakra Petch", "Plus Jakarta Sans", sans-serif`;
  }

  ctx.fillText(cleanText, x + w / 2, y + h / 2 + 2);

  ctx.restore();
}

// Backward compatibility alias
const drawDeviceNamePill = drawTopRightPill;

/**
 * Draws the left headline typography (Product / Device Name) and sub-badge
 * Features:
 * - Sub-badge is full-rounded capsule with transparent background (no background fill)
 * - Headline enlarged 25% to 158px extra bold
 * - Soft ambient shadow blur (no hard outline) for subtle, beautiful contrast
 */
function drawLeftHeadlineBlock(
  ctx: CanvasRenderingContext2D,
  subBadgeText: string,
  headlineText: string,
  fontFamily: string,
  x: number = 50,
  startY?: number,
  highlightColor: string = '#d2d2d2',
  options?: {
    maxWidth?: number;
    maxBlockHeight?: number;
    initialFontSize?: number;
    badgeHeight?: number;
  }
) {
  ctx.save();

  const lines = headlineText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const hasSubBadge = Boolean(subBadgeText.trim());
  const badgeH = options?.badgeHeight ?? 68;
  const badgeGap = options?.badgeHeight ? 18 : 22;
  const canvasW = ctx.canvas?.width || 1500;
  // Widened from 50% (720px) to 70% of canvas width (1050px on 1500px canvas) with multi-line support
  const defaultMaxW = Math.floor(canvasW * 0.70);
  const maxW = options?.maxWidth ?? defaultMaxW;

  // Consistent headline font size (158px on cover, 124px on variant header)
  let fontSize = options?.initialFontSize ?? 158;
  let lineHeight = Math.floor(fontSize * 1.04);

  ctx.font = `900 ${fontSize}px "${fontFamily}", "Plus Jakarta Sans", sans-serif`;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > maxW) {
      const ratio = maxW / w;
      fontSize = Math.floor(fontSize * ratio);
      lineHeight = Math.floor(fontSize * 1.05);
      ctx.font = `900 ${fontSize}px "${fontFamily}", "Plus Jakarta Sans", sans-serif`;
    }
  }

  // Ensure total block height fits within maxBlockHeight if specified (e.g. above variant left stack)
  let totalTextH = lines.length * lineHeight;
  let totalBlockH = (hasSubBadge ? badgeH + badgeGap : 0) + totalTextH;

  if (options?.maxBlockHeight && totalBlockH > options.maxBlockHeight && totalTextH > 0) {
    const availForText = Math.max(80, options.maxBlockHeight - (hasSubBadge ? badgeH + badgeGap : 0));
    const heightRatio = availForText / totalTextH;
    fontSize = Math.max(44, Math.floor(fontSize * heightRatio));
    lineHeight = Math.floor(fontSize * 1.05);
    totalTextH = lines.length * lineHeight;
    totalBlockH = (hasSubBadge ? badgeH + badgeGap : 0) + totalTextH;
  }

  // Anchor block nicely from the bottom on cover, or start directly under tagline on variants
  const targetBottomY = 1220;
  let currentY = startY ?? Math.max(650, targetBottomY - totalBlockH);

  // 1. Sub-badge pill (e.g. "Model Cut & 360")
  // Full-rounded capsule with transparent background (no background fill)
  if (hasSubBadge) {
    const badgeFontSize = options?.badgeHeight ? 28 : 32;
    ctx.font = `800 ${badgeFontSize}px "Chakra Petch", sans-serif`;
    const textMetrics = ctx.measureText(subBadgeText);
    const badgeW = textMetrics.width + (options?.badgeHeight ? 48 : 60);
    const badgeR = badgeH / 2; // Full rounded capsule!

    pathRoundedRect(ctx, x, currentY, badgeW, badgeH, badgeR);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#09090b';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(subBadgeText, x + badgeW / 2, currentY + badgeH / 2 + 1);

    currentY += badgeH + badgeGap;
  }

  // 2. Bold Headline Text with subtle blurred ambient shadow / halo (not hard outline)
  if (lines.length > 0) {
    ctx.font = `900 ${fontSize}px "${fontFamily}", "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (const line of lines) {
      // Soft blurred shadow halo behind the text (no hard outline)
      ctx.save();
      ctx.shadowColor = highlightColor || 'rgba(210, 210, 210, 0.85)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Soft subtle stroke with blurred shadow
      ctx.strokeStyle = 'rgba(220, 220, 225, 0.45)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, x, currentY);
      ctx.restore();

      ctx.fillStyle = '#09090b';
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
  }

  ctx.restore();
}

/**
 * Draws clean vector feature icons inside circular badges using Nucleo design principles:
 * - 'shield': Verified certified seal with scalloped rosette and bold checkmark (100% Original)
 * - 'material': 3D multi-layer isometric film sheets (3M Material from USA/Japan/Italy)
 * - 'guarantee': Protective shield with circular replacement cycle arrow (Installation Warranty)
 * - 'texture': 3D hexagonal honeycomb cell with internal tactile carbon relief lines (Textured Surface)
 * - 'fit': Precision target crosshairs
 * - 'scratch': Deflection shield with hardness sparkle
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
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (iconType === 'material') {
    // 3M Material: 3 stacked isometric sheets representing multi-layer vinyl film
    // 1. Top rhombus sheet
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx + 13, cy - 5);
    ctx.lineTo(cx, cy + 1);
    ctx.lineTo(cx - 13, cy - 5);
    ctx.closePath();
    ctx.stroke();

    // 2. Middle chevron sheet
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 1);
    ctx.lineTo(cx, cy + 7);
    ctx.lineTo(cx + 13, cy + 1);
    ctx.stroke();

    // 3. Bottom chevron sheet
    ctx.beginPath();
    ctx.moveTo(cx - 13, cy + 7);
    ctx.lineTo(cx, cy + 13);
    ctx.lineTo(cx + 13, cy + 7);
    ctx.stroke();
  } else if (iconType === 'guarantee') {
    // Installation Warranty: Protective shield with circular replacement cycle arrow inside
    // 1. Shield outline
    ctx.beginPath();
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx + 13, cy - 9);
    ctx.lineTo(cx + 13, cy + 3);
    ctx.quadraticCurveTo(cx + 13, cy + 13, cx, cy + 16.5);
    ctx.quadraticCurveTo(cx - 13, cy + 13, cx - 13, cy + 3);
    ctx.lineTo(cx - 13, cy - 9);
    ctx.closePath();
    ctx.stroke();

    // 2. Circular replacement cycle arrow inside shield
    const arcR = 5.2;
    const arcCy = cy + 1;
    ctx.beginPath();
    ctx.arc(cx, arcCy, arcR, -Math.PI * 0.75, Math.PI * 0.85, false);
    ctx.stroke();

    // Arrowhead at start of arc
    ctx.beginPath();
    ctx.moveTo(cx - 1.5, arcCy - arcR - 3.5);
    ctx.lineTo(cx + 2.5, arcCy - arcR);
    ctx.lineTo(cx - 1.5, arcCy - arcR + 3.5);
    ctx.stroke();
  } else if (iconType === 'texture') {
    // Textured Surface: 3D hexagonal honeycomb / carbon facet with tactile relief
    const hexR = 14;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6;
      const px = cx + Math.cos(angle) * hexR;
      const py = cy + Math.sin(angle) * hexR;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // 3 internal isometric spokes meeting at center
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + hexR);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - Math.cos(Math.PI / 6) * hexR, cy - Math.sin(Math.PI / 6) * hexR);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(Math.PI / 6) * hexR, cy - Math.sin(Math.PI / 6) * hexR);
    ctx.stroke();

    // Tactile relief lines in top facet
    ctx.beginPath();
    ctx.moveTo(cx - 4.5, cy - 8);
    ctx.lineTo(cx + 4.5, cy - 8);
    ctx.moveTo(cx - 2.5, cy - 4.5);
    ctx.lineTo(cx + 2.5, cy - 4.5);
    ctx.stroke();
  } else if (iconType === 'fit') {
    // Precision Fit: Target reticle with crosshairs
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.moveTo(cx + 10, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx, cy - 10);
    ctx.moveTo(cx, cy + 10);
    ctx.lineTo(cx, cy + 16);
    ctx.stroke();
  } else if (iconType === 'scratch') {
    // Scratch Proof: Shield with 4-point hardness sparkle deflection
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx + 12, cy - 8);
    ctx.lineTo(cx + 12, cy + 3);
    ctx.quadraticCurveTo(cx + 12, cy + 12, cx, cy + 15);
    ctx.quadraticCurveTo(cx - 12, cy + 12, cx - 12, cy + 3);
    ctx.lineTo(cx - 12, cy - 8);
    ctx.closePath();
    ctx.stroke();

    // Sparkle
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 2, cy - 2);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx + 2, cy + 2);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx - 2, cy + 2);
    ctx.lineTo(cx - 6, cy);
    ctx.lineTo(cx - 2, cy - 2);
    ctx.closePath();
    ctx.fill();
  } else {
    // 'shield' or fallback: 100% Original Verified Certificate Seal with 12 scalloped lobes & checkmark
    const lobes = 12;
    const baseR = 14;
    const lobeAmp = 1.6;
    ctx.beginPath();
    for (let i = 0; i < lobes * 2; i++) {
      const angle = (i * Math.PI) / lobes;
      const r = i % 2 === 0 ? baseR + lobeAmp : baseR - lobeAmp;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Bold checkmark inside seal
    ctx.beginPath();
    ctx.moveTo(cx - 5.5, cy);
    ctx.lineTo(cx - 1.5, cy + 4);
    ctx.lineTo(cx + 6.5, cy - 4);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the 3 bottom feature cards in the foreground with genuine frosted glass styling
 * Features:
 * - Backdrop blur behind the cards so the phone body is softly blurred
 * - Shorter card height (cardH=200) for sleek proportions
 * - Typography 25% bigger for high marketplace mobile impact
 * - Larger protruding circular badge (circleR=32) shifted to top-right
 */
async function drawBottomFeatureCards(
  ctx: CanvasRenderingContext2D,
  cards: MarketplaceFeatureCard[],
  startY: number = 1255,
  cardH: number = 200,
  totalW: number = 1500
) {
  if (!cards || cards.length === 0) return;

  const numCards = Math.min(3, cards.length);
  const marginX = 36;
  const gap = 20;
  const availableW = totalW - marginX * 2 - gap * (numCards - 1);
  const cardW = availableW / numCards; // ~462.6px
  const cardR = 30; // smooth rounded corners for shorter card

  ctx.save();

  // Create blurred snapshot of the scene behind the cards for true frosted glass
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = totalW;
  blurCanvas.height = ctx.canvas.height;
  const bCtx = blurCanvas.getContext('2d');
  if (bCtx) {
    bCtx.filter = 'blur(18px)';
    bCtx.drawImage(ctx.canvas, 0, 0);
  }

  for (let idx = 0; idx < numCards; idx++) {
    const card = cards[idx];
    const x = marginX + idx * (cardW + gap);
    const y = startY;

    // 1. Soft drop shadow behind card
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    pathRoundedRect(ctx, x, y, cardW, cardH, cardR);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.restore();

    // 2. Frosted Glass backdrop: clip to card path and draw blurred scene
    ctx.save();
    pathRoundedRect(ctx, x, y, cardW, cardH, cardR);
    ctx.clip();

    if (bCtx) {
      ctx.drawImage(blurCanvas, 0, 0);
    }

    // Frosted glass gradient overlay with less opacity so blurred phone shows through
    const glassGrad = ctx.createLinearGradient(x, y, x, y + cardH);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.82)');
    glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.72)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.62)');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(x, y, cardW, cardH);
    ctx.restore();

    // 3. Check if card has a photo banner (e.g. "Textured Surface")
    if (card.imageUrl) {
      const photoH = Math.round(cardH * 0.58);
      const textH = cardH - photoH;

      // Clip top rounded area for photo
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + cardR, y);
      ctx.lineTo(x + cardW - cardR, y);
      ctx.quadraticCurveTo(x + cardW, y, x + cardW, y + cardR);
      ctx.lineTo(x + cardW, y + photoH);
      ctx.lineTo(x, y + photoH);
      ctx.lineTo(x, y + cardR);
      ctx.quadraticCurveTo(x, y, x + cardR, y);
      ctx.closePath();
      ctx.clip();

      try {
        const photoImg = await loadCorsSafeImageElement(card.imageUrl);
        if (photoImg && photoImg.width > 0 && photoImg.height > 0) {
          const scale = Math.max(cardW / photoImg.width, photoH / photoImg.height);
          const dw = photoImg.width * scale;
          const dh = photoImg.height * scale;
          const dx = x + (cardW - dw) / 2;
          const dy = y + (photoH - dh) / 2;
          ctx.drawImage(photoImg, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = '#18181b';
          ctx.fillRect(x, y, cardW, photoH);
        }
      } catch {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(x, y, cardW, photoH);
      }
      ctx.restore();

      // Divider line between photo and text
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + photoH);
      ctx.lineTo(x + cardW, y + photoH);
      ctx.stroke();
      ctx.restore();

      // Centered Card Title in lower portion
      ctx.save();
      ctx.fillStyle = '#09090b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 42px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(card.title || 'Textured Surface', x + cardW / 2, y + photoH + textH / 2);
      ctx.restore();
    } else {
      // Standard Card: Centered Title and Subtitle with 25% larger typography
      ctx.save();
      const titleLines = (card.title || '').split('\n').filter(Boolean);
      const maxTitleW = cardW - 48;

      ctx.fillStyle = '#09090b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (titleLines.length >= 2) {
        // Two-line title: 50px (was 40px, +25%!)
        ctx.font = '900 50px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(titleLines[0], x + cardW / 2, y + 62, maxTitleW);
        ctx.fillText(titleLines[1], x + cardW / 2, y + 112, maxTitleW);

        ctx.font = 'italic 600 26px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#52525b';
        ctx.fillText(card.subtitle || '', x + cardW / 2, y + 158, maxTitleW);
      } else {
        // Single line title: 55px (was 44px, +25%!)
        ctx.font = '900 55px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(card.title || '', x + cardW / 2, y + 80, maxTitleW);

        ctx.font = 'italic 600 27px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = '#52525b';
        ctx.fillText(card.subtitle || '', x + cardW / 2, y + 140, maxTitleW);
      }
      ctx.restore();
    }

    // 4. Luminous glass border with inner refraction bevel line
    ctx.save();
    pathRoundedRect(ctx, x, y, cardW, cardH, cardR);

    // Subtle ambient rim glow for frosted glass
    ctx.shadowColor = 'rgba(255, 255, 255, 0.50)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    const borderGrad = ctx.createLinearGradient(x, y, x + cardW * 0.45, y + cardH);
    borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    borderGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.82)');
    borderGrad.addColorStop(0.68, 'rgba(255, 255, 255, 0.45)');
    borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.22)');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Inner subtle refraction bevel line
    ctx.shadowColor = 'transparent';
    pathRoundedRect(ctx, x + 1.5, y + 1.5, cardW - 3, cardH - 3, Math.max(4, cardR - 1.5));
    const innerRimGrad = ctx.createLinearGradient(x, y, x, y + cardH);
    innerRimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    innerRimGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.16)');
    innerRimGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = innerRimGrad;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();

    // 5. Absolute protruding icon badge breaking through top-right border (enlarged to circleR=32)
    const circleR = 32; // was 25 (+28% bigger!)
    const circleX = x + cardW - 12;
    const circleY = y;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    drawCardIcon(ctx, circleX, circleY, card.iconType);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws the vertical stacked feature cards on the left column for Variant listing images.
 * Matches the authentic Exacoat marketplace variant composition in user reference:
 * - 100% Original (Exacoat Official Store)
 * - 3M Material (USA • Japan • Italy)
 * - Installation Warranty (Garansi Pemasangan)
 * - Textured Surface (High-res macro photo thumbnail)
 */
async function drawLeftStackedFeatureCards(
  ctx: CanvasRenderingContext2D,
  options: {
    showOriginal3M?: boolean;
    showMaterialOrigin?: boolean;
    showWarranty?: boolean;
    showTexturePhoto?: boolean;
    texturePhotoUrl?: string;
    warrantyTitle?: string;
  } = {},
  x: number = 50,
  _startY: number = 272,
  w: number = 460
) {
  const showOriginal = options.showOriginal3M !== false;
  const showMaterial = options.showMaterialOrigin !== false;
  const showWarranty = options.showWarranty !== false;
  const showTexture = options.showTexturePhoto !== false;
  let textureUrl =
    options.texturePhotoUrl?.trim() ||
    '/assets/brand/textured-skins-product-info.jpg';
  if (textureUrl.includes('Textured-Skins-Product-Info.jpg') || textureUrl.includes('textured-skins-product-info.jpg')) {
    textureUrl = '/assets/brand/textured-skins-product-info.jpg';
  }

  const textCardH = 114;
  const photoH = 230;
  const textH = 88;
  const textureCardH = photoH + textH;
  const cardGap = 16;
  const cardR = 26;

  // Calculate total height of enabled cards to align bottom at 1450px
  let totalHeight = 0;
  let activeCardsCount = 0;

  if (showOriginal) {
    totalHeight += textCardH;
    activeCardsCount++;
  }
  if (showMaterial) {
    totalHeight += textCardH;
    activeCardsCount++;
  }
  if (showWarranty) {
    totalHeight += textCardH;
    activeCardsCount++;
  }
  if (showTexture) {
    totalHeight += textureCardH;
    activeCardsCount++;
  }
  if (activeCardsCount > 1) {
    totalHeight += (activeCardsCount - 1) * cardGap;
  }

  // Anchor stack to the bottom (targetBottomY = 1450px, leaving 50px bottom canvas margin)
  const targetBottomY = 1450;
  let currentY = targetBottomY - totalHeight;

  // Helper to render standard glass card background and border glass
  const drawGlassCardBg = (cy: number, ch: number) => {
    // 1. Soft ambient shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    pathRoundedRect(ctx, x, cy, w, ch, cardR);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();
    ctx.restore();

    // 2. Glass gradient fill
    ctx.save();
    pathRoundedRect(ctx, x, cy, w, ch, cardR);
    ctx.clip();
    const glassGrad = ctx.createLinearGradient(x, cy, x, cy + ch);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
    glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.82)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.72)');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(x, cy, w, ch);
    ctx.restore();

    // 3. Crisp Glass Border with subtle contrast edge
    ctx.save();
    pathRoundedRect(ctx, x, cy, w, ch, cardR);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
    ctx.shadowBlur = 6;
    const borderGrad = ctx.createLinearGradient(x, cy, x + w * 0.4, cy + ch);
    borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    borderGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.82)');
    borderGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.45)');
    borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.22)');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Inner rim
    ctx.shadowColor = 'transparent';
    pathRoundedRect(ctx, x + 1.5, cy + 1.5, w - 3, ch - 3, Math.max(4, cardR - 1.5));
    const innerRimGrad = ctx.createLinearGradient(x, cy, x, cy + ch);
    innerRimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.60)');
    innerRimGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
    innerRimGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = innerRimGrad;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  };

  // Helper to draw top-right circular green badge on a card
  const drawCornerBadge = (cy: number, iconType: MarketplaceFeatureCard['iconType']) => {
    const circleR = 26;
    const circleX = x + w - 12;
    const circleY = cy;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    drawCardIcon(ctx, circleX, circleY, iconType);
    ctx.restore();
  };

  // 1. "100% Original" Card (Top of stack)
  if (showOriginal) {
    drawGlassCardBg(currentY, textCardH);
    drawCornerBadge(currentY, 'shield');

    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 38px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
    ctx.fillText('100% Original', x + w / 2 - 4, currentY + 42);

    ctx.font = 'italic 600 21px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.fillText('Exacoat Official Store', x + w / 2 - 4, currentY + 80);
    ctx.restore();

    currentY += textCardH + cardGap;
  }

  // 2. "3M Material" Card
  if (showMaterial) {
    drawGlassCardBg(currentY, textCardH);
    drawCornerBadge(currentY, 'material');

    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 38px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
    ctx.fillText('3M Material', x + w / 2 - 4, currentY + 42);

    ctx.font = 'italic 600 21px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.fillText('USA • Japan • Italy', x + w / 2 - 4, currentY + 80);
    ctx.restore();

    currentY += textCardH + cardGap;
  }

  // 3. "Installation Warranty" Card
  if (showWarranty) {
    drawGlassCardBg(currentY, textCardH);
    drawCornerBadge(currentY, 'guarantee');

    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 35px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(options.warrantyTitle || 'Installation Warranty', x + w / 2 - 4, currentY + 42);

    ctx.font = 'italic 600 21px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#52525b';
    ctx.fillText('Risk free installation', x + w / 2 - 4, currentY + 80);
    ctx.restore();

    currentY += textCardH + cardGap;
  }

  // 4. "Textured Surface" Macro Photo Card (Bottom of stack)
  if (showTexture) {
    drawGlassCardBg(currentY, textureCardH);

    // Photo top rounded area
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + cardR, currentY);
    ctx.lineTo(x + w - cardR, currentY);
    ctx.quadraticCurveTo(x + w, currentY, x + w, currentY + cardR);
    ctx.lineTo(x + w, currentY + photoH);
    ctx.lineTo(x, currentY + photoH);
    ctx.lineTo(x, currentY + cardR);
    ctx.quadraticCurveTo(x, currentY, x + cardR, currentY);
    ctx.closePath();
    ctx.clip();

    try {
      let photoImg = await loadCorsSafeImageElement(textureUrl);
      if (!photoImg && textureUrl !== '/assets/brand/textured-skins-product-info.jpg') {
        photoImg = await loadCorsSafeImageElement('/assets/brand/textured-skins-product-info.jpg');
      }
      if (photoImg && photoImg.width > 0 && photoImg.height > 0) {
        const scale = Math.max(w / photoImg.width, photoH / photoImg.height);
        const dw = photoImg.width * scale;
        const dh = photoImg.height * scale;
        const dx = x + (w - dw) / 2;
        const dy = currentY + (photoH - dh) / 2;
        ctx.drawImage(photoImg, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(x, currentY, w, photoH);
      }
    } catch {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(x, currentY, w, photoH);
    }
    ctx.restore();

    // Divider line between photo and text
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, currentY + photoH);
    ctx.lineTo(x + w, currentY + photoH);
    ctx.stroke();
    ctx.restore();

    // Title at bottom
    ctx.save();
    ctx.fillStyle = '#09090b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 34px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Textured Surface', x + w / 2, currentY + photoH + textH / 2);
    ctx.restore();

    // Corner badge drawn in front of the photo
    drawCornerBadge(currentY, 'texture');
  }
}

/**
 * Draws the "20+ SKINS" swatch stack on the right edge
 */
async function drawSkinsStack(
  ctx: CanvasRenderingContext2D,
  swatchFinishes: GlobalFinish[],
  countText: string = '20+',
  labelText: string = 'SKINS',
  x: number = 1350,
  startY: number = 490
) {
  const swatchSize = 105;
  const radius = 22;
  let currentY = startY;

  ctx.save();

  // Draw 2 swatch thumbnails
  for (const finish of swatchFinishes.slice(0, 2)) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
    ctx.shadowBlur = 16;
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
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    currentY += swatchSize + 16;
  }

  // "20+ SKINS" badge
  const badgeH = 88;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 18;
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

  ctx.font = '900 34px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(countText, x + swatchSize / 2, currentY + 38);

  ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(labelText, x + swatchSize / 2, currentY + 68);
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
    direction?: 'bottom_right' | 'top_left';
    surface_gradient_enabled?: boolean;
    surface_gradient_opacity?: number;
  }
) {
  if (options?.enabled === false && options?.surface_gradient_enabled === false) return;

  const softness = typeof options?.softness === 'number' ? options.softness : 6;
  const distance = typeof options?.distance === 'number' ? options.distance : 3;
  const shadowAlpha = typeof options?.shadow_opacity === 'number' ? options.shadow_opacity : 0.38;
  const highlightAlpha = typeof options?.highlight_opacity === 'number' ? options.highlight_opacity : 0.24;
  const isBottomRight = (options?.direction ?? 'bottom_right') === 'bottom_right';

  const shadowDx = isBottomRight ? distance : -distance;
  const shadowDy = isBottomRight ? distance : -distance;
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

  // Soft rim highlight
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

  // Soft diagonal surface gradient shadow (Simulates top-left incident light falloff across vinyl body)
  const surfaceGradEnabled = options?.surface_gradient_enabled ?? false;
  const surfaceGradOpacity = typeof options?.surface_gradient_opacity === 'number'
    ? options.surface_gradient_opacity
    : 0.22;

  if (surfaceGradEnabled && surfaceGradOpacity > 0) {
    const gradCanvas = document.createElement('canvas');
    gradCanvas.width = width;
    gradCanvas.height = height;
    const gCtx = gradCanvas.getContext('2d');
    if (gCtx) {
      const x0 = isBottomRight ? width * 0.10 : width * 0.90;
      const y0 = isBottomRight ? height * 0.05 : height * 0.95;
      const x1 = isBottomRight ? width * 0.90 : width * 0.10;
      const y1 = isBottomRight ? height * 0.95 : height * 0.05;

      const grad = gCtx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.30, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.55, `rgba(0, 0, 0, ${(surfaceGradOpacity * 0.35).toFixed(3)})`);
      grad.addColorStop(0.80, `rgba(0, 0, 0, ${(surfaceGradOpacity * 0.75).toFixed(3)})`);
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

/**
 * Filters genuine visual skin layers (excluding hardware chassis/body layers)
 * and orders base/primary layers (no extra price, e.g. Back) before optional accent layers.
 */
export function isBaseSkinLayer(layer: {
  id?: string;
  name?: string;
  group?: string;
  extra_price?: number;
  is_required?: boolean;
  default_selected?: boolean;
}): boolean {
  const price = Number(layer.extra_price) || 0;
  const name = (layer.name || '').toLowerCase().trim();
  const id = (layer.id || '').toLowerCase().trim();
  const group = (layer.group || '').toLowerCase().trim();

  const isAccentOrAddon =
    group === 'accent' ||
    group === 'addon' ||
    group === 'protection' ||
    name.includes('accent') ||
    id.includes('accent') ||
    name.includes('camera') ||
    name.includes('lens') ||
    name.includes('temper') ||
    name.includes('screen');

  return price <= 0 && !isAccentOrAddon;
}

export function filterGenuineSkinLayers<
  T extends {
    id: string;
    name?: string;
    group?: string;
    extra_price?: number;
    is_non_visual?: boolean;
    is_required?: boolean;
    default_selected?: boolean;
  }
>(layers: T[] = []): T[] {
  const filtered = (layers || []).filter((l) => {
    if (l.is_non_visual) return false;
    const lName = (l.name || '').toLowerCase().trim();
    const lId = (l.id || '').toLowerCase().trim();
    if (lName === 'device' || lId === 'device') return false;
    if (lName.includes('device-body') || lName.includes('device_body') || lName.includes('device body')) return false;
    if (lName.includes('chassis') || lName.includes('hardware')) return false;
    if ((l.group as string) === 'device' || (l.group as string) === 'hardware') return false;
    return true;
  });

  const scoreLayer = (l: T): number => {
    const name = (l.name || '').toLowerCase().trim();
    const id = (l.id || '').toLowerCase().trim();
    const base = isBaseSkinLayer(l);
    const hasBackKeyword = /\b(back|base|rear|body|full|main|top)\b/i.test(`${name} ${id}`);
    if (base && hasBackKeyword) return 100;
    if (base && (l.group === 'primary' || l.is_required || l.default_selected)) return 90;
    if (base) return 80;
    if ((Number(l.extra_price) || 0) <= 0) return 60;
    if (hasBackKeyword && !name.includes('accent')) return 40;
    return 10;
  };

  return [...filtered].sort((a, b) => scoreLayer(b) - scoreLayer(a));
}

/**
 * Returns the single primary base skin layer ID (the one without extra price, e.g. Back skin)
 * as the default and only active layer.
 */
export function getDefaultBaseSkinLayerIds(
  layers: Array<{
    id: string;
    name?: string;
    group?: string;
    extra_price?: number;
    is_non_visual?: boolean;
    is_required?: boolean;
    default_selected?: boolean;
  }> = []
): string[] {
  const ordered = filterGenuineSkinLayers(layers);
  if (ordered.length === 0) return [];
  return [ordered[0].id];
}

/**
 * Resolves initial active layer IDs for a device profile:
 * Defaults strictly to the single base skin layer (without price, e.g. Back skin).
 * Also auto-heals previously saved settings if they only contained an accent/priced layer.
 */
export function resolveInitialActiveLayerIds(
  layers: Array<{
    id: string;
    name?: string;
    group?: string;
    extra_price?: number;
    is_non_visual?: boolean;
    is_required?: boolean;
    default_selected?: boolean;
  }> = [],
  savedLayerIds?: string[]
): string[] {
  const genuine = filterGenuineSkinLayers(layers);
  if (genuine.length === 0) return [];

  const defaultBaseIds = [genuine[0].id];
  if (!Array.isArray(savedLayerIds) || savedLayerIds.length === 0) {
    return defaultBaseIds;
  }

  const validSaved = savedLayerIds.filter((id) => genuine.some((g) => g.id === id));
  if (validSaved.length === 0) {
    return defaultBaseIds;
  }

  // If the device has at least one base skin layer (free, non-accent) and the saved list
  // ONLY contains accent/priced layers (caused by old genuineLayers[0] indexing), reset to base skin only
  const hasAnyBaseLayerInProfile = genuine.some((g) => isBaseSkinLayer(g));
  const savedHasBaseLayer = validSaved.some((id) => {
    const found = genuine.find((g) => g.id === id);
    return found ? isBaseSkinLayer(found) : false;
  });

  if (hasAnyBaseLayerInProfile && !savedHasBaseLayer) {
    return defaultBaseIds;
  }

  return validSaved;
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
    const rawLayers = profile.layers || [];
    const deviceLayer = rawLayers.find((l) => (l.name || '').toLowerCase() === 'device');
    const devImg =
      deviceLayer?.assets_by_view?.[currentView?.id || '']?.render_texture_map?.['device'] ||
      Object.values(deviceLayer?.assets_by_view || {})[0]?.render_texture_map?.['device'] ||
      Object.values(deviceLayer?.assets_by_view || {})[0]?.base_hardware_body_url;
    chassisSrc = devImg || '';
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
  // Default strictly to the base skin layer (e.g. Back skin without price) when activeLayerIds is empty.
  const effectiveActiveLayerIds =
    config.activeLayerIds && config.activeLayerIds.length > 0
      ? config.activeLayerIds
      : getDefaultBaseSkinLayerIds(profile.layers || []);

  const skinLayers = filterGenuineSkinLayers(profile.layers || []).filter((l) =>
    effectiveActiveLayerIds.includes(l.id)
  );

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
    const hasModelCutAsset = Boolean(
      profile.coverage_and_cutouts?.model_cut_mask_url ||
      profile.coverage_and_cutouts?.has_model_cut ||
      profile.views?.some((v) => Boolean(v.model_cut_mask_url)) ||
      profile.layers?.some((l) => Object.values(l.assets_by_view || {}).some((a) => Boolean(a.model_cutout_url)))
    );
    const covMode = profile.coverage_and_cutouts?.coverage_type || (hasModelCutAsset ? 'model_cut_and_360' : 'none');
    const isModelCutOnly = covMode === 'model_cut_only';
    const hasCoverageOptions = covMode === 'model_cut_and_360' || (hasModelCutAsset && !isModelCutOnly);
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

    // Synthetic directional inner shading for realistic skin edges & surface gradient
    const isBackOrRequired = Boolean(
      layer.is_required ||
      layer.group === 'primary' ||
      /\b(back|body|top|base|full)\b/i.test(layer.name) ||
      !/\b(accent|camera lens|frame|side|logo|additional|addon)\b/i.test(layer.name)
    );
    const hasViewShadow = Boolean(currentView.shadow_png_url || currentView.highlight_png_url);

    if (isBackOrRequired) {
      lCtx.globalCompositeOperation = 'source-over';
      const finishGradEnabled = config.surfaceGradientShading?.enabled !== undefined
        ? config.surfaceGradientShading.enabled
        : Boolean(activeFinish.surface_gradient_enabled);
      const finishGradOpacity = typeof config.surfaceGradientShading?.opacity === 'number'
        ? config.surfaceGradientShading.opacity
        : (typeof activeFinish.surface_gradient_opacity === 'number' ? activeFinish.surface_gradient_opacity : 0.22);

      const shadowOptions = {
        ...currentView.generated_shadow,
        enabled: !hasViewShadow ? (currentView.generated_shadow?.enabled ?? true) : false,
        surface_gradient_enabled: finishGradEnabled,
        surface_gradient_opacity: finishGradOpacity,
        direction: config.surfaceGradientShading?.direction ?? currentView.generated_shadow?.direction ?? 'bottom_right',
      };
      applySyntheticDirectionalShading(lCtx, 1500, 1500, shadowOptions);
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

  const isVariantLayout =
    config.layoutMode === 'variant' ||
    (!config.isPrimaryImage && config.layoutMode !== 'cover');

  // Device Scaling & Placement
  let effectiveScale: number;
  let targetCenterX: number;
  let targetCenterY: number;

  if (isVariantLayout) {
    // Variant Layout: Scale 75%, vertical Y: 80px, centered on top skin card (540 + 910/2 = 995px)
    const baseVariantScale = config.deviceScale !== undefined ? config.deviceScale : 0.75;
    effectiveScale = baseVariantScale * 1.0;
    targetCenterX = 995 + (config.deviceOffsetX || 0);
    targetCenterY = 750 + (config.deviceOffsetY !== undefined ? config.deviceOffsetY : 80);
  } else {
    // Cover Layout: Close-Up Hero Shot (Scale 100%, vertical Y: 110px)
    const baseCoverScale = config.deviceScale !== undefined ? config.deviceScale : 1.0;
    effectiveScale = baseCoverScale * 1.0;
    targetCenterX = 1070 + (config.deviceOffsetX || 0);
    targetCenterY = 875 + (config.deviceOffsetY !== undefined ? config.deviceOffsetY : 110);
  }

  const dw = 1500 * effectiveScale;
  const dh = 1500 * effectiveScale;
  const dx = targetCenterX - 750 * effectiveScale;
  const dy = targetCenterY - 750 * effectiveScale;

  // Studio contact shadow under phone cast to bottom-right: visible, crisp, and defined
  ctx.save();
  // Primary directional cast shadow (bottom-right: X +26px, Y +32px, crisp blur 22px)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = 26;
  ctx.shadowOffsetY = 32;
  ctx.drawImage(deviceCanvas, dx, dy, dw, dh);

  // Secondary contact occlusion rim for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 12;
  ctx.shadowOffsetY = 16;
  ctx.drawImage(deviceCanvas, dx, dy, dw, dh);
  ctx.restore();

  // Draw phone crisp
  ctx.drawImage(deviceCanvas, dx, dy, dw, dh);

  // 3. Top-Left Exacoat Logo Pill (Image 2 style, r=54, optical upward offset)
  if (config.showLogo) {
    await drawLogoPill(ctx, 50, 50, 460, 140, 54);
    // Brand Tagline under logo pill ("#1 Brand Skin di Indonesia")
    if (config.showBrandTagline !== false) {
      drawBrandTagline(ctx, config.brandTagline || '#1 Brand Skin di Indonesia', 50, 206, 460);
    }
    // Tokopedia Official Store Badge under tagline (ONLY on Cover layout, never on Variants)
    if (!isVariantLayout && config.marketplaceChannel === 'tokopedia') {
      const badgeY = config.showBrandTagline !== false ? 284 : 206;
      await drawTokopediaBadge(
        ctx,
        config.tokopediaBadgeUrl || '/assets/brand/tokopedia-official-store-badge.png',
        50,
        badgeY,
        460
      );
    }
  }

  // 4. Top-Right Pill: Displays the Skin Name or "20+ SKINS SELECTION" in bold spaced uppercase (r=54)
  const defaultTopRight = config.isPrimaryImage
    ? '20+ SKINS SELECTION'
    : config.activeFinish.name;
  const skinPillText = (config.topRightText?.trim() || defaultTopRight).toUpperCase();
  drawTopRightPill(ctx, skinPillText, 540, 50, 910, 140, 54);

  // 5. Left Column Content & Bottom Feature Cards
  const defaultDeviceTitle = formatDeviceHeadline(config.profile.device_name || config.deviceNameText || '');
  const effectiveHeadline = config.headlineText?.trim() ? config.headlineText : defaultDeviceTitle;

  if (isVariantLayout) {
    // Variant Layout:
    // 1) Directly under '#1 Brand Skin di Indonesia' (y=276), show the centered Device Name at 25px (matching '#1 Brand')
    //    and subtle plain text below it for 'Model 360' / 'Model Cut' (no pill border, and no Official Store image).
    const subheaderY = config.showBrandTagline !== false ? 276 : 216;
    drawVariantDeviceSubheader(
      ctx,
      effectiveHeadline,
      config.subBadgeText || '',
      50,
      subheaderY,
      460
    );

    // 2) Stacked trust cards and Textured Surface macro preview photo on left column
    await drawLeftStackedFeatureCards(ctx, config.variantLeftCards || {}, 50, 340, 460);
    // Bottom feature cards omitted on variant images, leaving the phone body clean and visible!
  } else {
    // Cover Layout: Sub-badge & Big Bold Headline (displays the Product / Device Name with highlight outline)
    drawLeftHeadlineBlock(
      ctx,
      config.subBadgeText || '',
      effectiveHeadline,
      config.headlineFont || 'Chakra Petch',
      50,
      undefined,
      config.headlineHighlightColor || '#d2d2d2'
    );

    // 3 bottom feature cards with genuine frosted border glass (clean official text cards, strictly no textured surface on cover)
    const rawCards = config.featureCards && config.featureCards.length > 0
      ? config.featureCards
      : DEFAULT_FEATURE_CARDS_OFFICIAL;
    const cleanCoverCards = rawCards.map((c) => ({
      ...c,
      imageUrl: undefined,
    }));

    await drawBottomFeatureCards(ctx, cleanCoverCards, 1255, 200, width);
  }

  // 6. Right Edge Swatch Stack ("20+ SKINS")
  if (config.showSkinsStack) {
    const swatches = (config.swatchFinishSlugs || []).length > 0
      ? config.swatchFinishSlugs.map((slug) => ({ slug, name: slug } as GlobalFinish))
      : [];
    await drawSkinsStack(
      ctx,
      swatches,
      config.skinsCountText || '20+',
      config.skinsLabelText || 'SKINS',
      1350,
      490
    );
  }
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
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
              const arr = dataUrl.split(',');
              const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
              const bstr = atob(arr[1]);
              let n = bstr.length;
              const u8arr = new Uint8Array(n);
              while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
              }
              resolve(new Blob([u8arr], { type: mime }));
            } catch (fallbackErr) {
              reject(fallbackErr || new Error('Canvas toBlob failed'));
            }
          }
        },
        'image/jpeg',
        0.95
      );
    } catch (toBlobErr) {
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        resolve(new Blob([u8arr], { type: mime }));
      } catch (fallbackErr) {
        reject(toBlobErr || fallbackErr || new Error('Canvas export failed'));
      }
    }
  });
}

/**
 * Batch generates marketplace images for multiple finishes and zips them.
 * Automatically prepends the Primary Cover Image (e.g. "20+ SKINS SELECTION") as 00_PRIMARY_COVER_...
 */
export async function batchGenerateMarketplaceZip(
  baseConfig: MarketplaceImageConfig,
  targetFinishes: GlobalFinish[],
  options?: {
    includePrimaryCover?: boolean;
    primaryFinish?: GlobalFinish;
    primaryTopRightText?: string;
    variantsLayoutMode?: 'cover' | 'variant';
    variantScale?: number;
    variantOffsetX?: number;
    variantOffsetY?: number;
    coverScale?: number;
    coverOffsetX?: number;
    coverOffsetY?: number;
    coverageMode?: 'both' | '360' | 'cut' | 'current';
  },
  onProgress?: (current: number, total: number, finishName: string) => void
): Promise<Blob> {
  const zip = new JSZip();

  const isLaptop =
    baseConfig.profile.family === 'laptop' ||
    baseConfig.deviceOffsetX === 140 ||
    (baseConfig.profile.device_slug || '').toLowerCase().includes('macbook') ||
    (baseConfig.profile.device_name || '').toLowerCase().includes('laptop') ||
    (baseConfig.profile.device_name || '').toLowerCase().includes('macbook');

  // Default placement geometry
  const defaultCoverScale = isLaptop ? 1.0 : 1.0;
  const defaultCoverX = isLaptop ? 140 : 0;
  const defaultCoverY = isLaptop ? -55 : 110;

  const defaultVariantScale = 0.75;
  const defaultVariantX = isLaptop ? 140 : 0;
  const defaultVariantY = isLaptop ? -20 : 80;

  // Resolve Cover Image placement
  const coverScale = options?.coverScale !== undefined
    ? options.coverScale
    : (baseConfig.layoutMode === 'cover' && baseConfig.deviceScale !== undefined ? baseConfig.deviceScale : defaultCoverScale);

  const coverOffsetX = options?.coverOffsetX !== undefined
    ? options.coverOffsetX
    : (baseConfig.layoutMode === 'cover' && baseConfig.deviceOffsetX !== undefined ? baseConfig.deviceOffsetX : defaultCoverX);

  const coverOffsetY = options?.coverOffsetY !== undefined
    ? options.coverOffsetY
    : (baseConfig.layoutMode === 'cover' && baseConfig.deviceOffsetY !== undefined ? baseConfig.deviceOffsetY : defaultCoverY);

  // Resolve Variant Images placement
  const useVariantLayout = (options?.variantsLayoutMode || 'variant') === 'variant';

  const variantScale = useVariantLayout
    ? (options?.variantScale !== undefined
        ? options.variantScale
        : (baseConfig.layoutMode === 'variant' && baseConfig.deviceScale !== undefined ? baseConfig.deviceScale : defaultVariantScale))
    : coverScale;

  const variantOffsetX = useVariantLayout
    ? (options?.variantOffsetX !== undefined
        ? options.variantOffsetX
        : (baseConfig.layoutMode === 'variant' && baseConfig.deviceOffsetX !== undefined ? baseConfig.deviceOffsetX : defaultVariantX))
    : coverOffsetX;

  const variantOffsetY = useVariantLayout
    ? (options?.variantOffsetY !== undefined
        ? options.variantOffsetY
        : (baseConfig.layoutMode === 'variant' && baseConfig.deviceOffsetY !== undefined ? baseConfig.deviceOffsetY : defaultVariantY))
    : coverOffsetY;

  // Detect coverage options support
  const hasModelCutAsset = Boolean(
    baseConfig.profile.coverage_and_cutouts?.model_cut_mask_url ||
    baseConfig.profile.coverage_and_cutouts?.has_model_cut ||
    baseConfig.profile.views?.some((v) => Boolean(v.model_cut_mask_url)) ||
    baseConfig.profile.layers?.some((l) => Object.values(l.assets_by_view || {}).some((a) => Boolean(a.model_cutout_url)))
  );
  const covMode = baseConfig.profile.coverage_and_cutouts?.coverage_type || (hasModelCutAsset ? 'model_cut_and_360' : 'none');
  const isModelCutOnly = covMode === 'model_cut_only';
  const hasBothCoverages = (covMode === 'model_cut_and_360' || hasModelCutAsset) && !isModelCutOnly;

  let coveragesToRun: ('model_360' | 'model_cut')[];
  if (options?.coverageMode === '360') {
    coveragesToRun = ['model_360'];
  } else if (options?.coverageMode === 'cut') {
    coveragesToRun = ['model_cut'];
  } else if (options?.coverageMode === 'current') {
    coveragesToRun = [baseConfig.coverage || 'model_360'];
  } else {
    // Default: generate both 360 and cut if device supports both!
    coveragesToRun = hasBothCoverages ? ['model_360', 'model_cut'] : [isModelCutOnly ? 'model_cut' : (baseConfig.coverage || 'model_360')];
  }

  const includeCover = options?.includePrimaryCover !== false;
  const itemsPerCoverage = targetFinishes.length + (includeCover ? 1 : 0);
  const total = itemsPerCoverage * coveragesToRun.length;
  let progressCount = 0;

  const devicePrefix = (baseConfig.profile.device_slug || baseConfig.profile.device_name || 'device')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');

  for (const cov of coveragesToRun) {
    const isBoth = coveragesToRun.length > 1;
    const covLabel = cov === 'model_cut' ? 'Model Cut' : 'Model 360';
    const covFolder = cov === 'model_cut' ? 'cut' : '360';
    const covSuffix = cov === 'model_cut' ? 'CUT' : '360';

    const subBadge = baseConfig.subBadgeText === 'Model Cut & 360'
      ? covLabel
      : baseConfig.subBadgeText;

    // 1. Generate Primary Cover Image if requested
    if (includeCover) {
      progressCount++;
      if (onProgress) {
        onProgress(progressCount, total, isBoth ? `Primary Cover (${covLabel})` : 'Primary Cover (20+ Skins Selection)');
      }

      const coverFinish = options?.primaryFinish || targetFinishes[0] || baseConfig.activeFinish;

      const coverConfig: MarketplaceImageConfig = {
        ...baseConfig,
        activeFinish: coverFinish,
        coverage: cov,
        isPrimaryImage: true,
        layoutMode: 'cover',
        deviceScale: coverScale,
        deviceOffsetX: coverOffsetX,
        deviceOffsetY: coverOffsetY,
        subBadgeText: subBadge,
        featureCards: DEFAULT_FEATURE_CARDS_OFFICIAL,
        topRightText: (options?.primaryTopRightText?.trim() || '20+ SKINS SELECTION').toUpperCase(),
        headlineText: baseConfig.headlineText
          ? baseConfig.headlineText
          : formatDeviceHeadline(baseConfig.profile.device_name),
      };

      const coverBlob = await generateMarketplaceImageBlob(coverConfig);
      const coverFileName = isBoth
        ? `${covFolder}/${devicePrefix}_cover_${covSuffix.toLowerCase()}.jpg`
        : `${devicePrefix}_cover.jpg`;

      zip.file(coverFileName, coverBlob);
    }

    // 2. Generate each variant finish image
    for (let i = 0; i < targetFinishes.length; i++) {
      const finish = targetFinishes[i];
      progressCount++;
      if (onProgress) {
        onProgress(progressCount, total, isBoth ? `${finish.name} (${covLabel})` : finish.name);
      }

      const currentConfig: MarketplaceImageConfig = {
        ...baseConfig,
        activeFinish: finish,
        coverage: cov,
        isPrimaryImage: false,
        layoutMode: useVariantLayout ? 'variant' : 'cover',
        deviceScale: variantScale,
        deviceOffsetX: variantOffsetX,
        deviceOffsetY: variantOffsetY,
        subBadgeText: subBadge,
        topRightText: finish.name.toUpperCase(),
        headlineText: baseConfig.headlineText
          ? baseConfig.headlineText
          : formatDeviceHeadline(baseConfig.profile.device_name),
      };

      const blob = await generateMarketplaceImageBlob(currentConfig);
      const finishSlug = (finish.slug || finish.id || finish.name || `finish_${i + 1}`)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '');

      const fileName = isBoth
        ? `${covFolder}/${devicePrefix}_${finishSlug}_${covSuffix.toLowerCase()}.jpg`
        : `${devicePrefix}_${finishSlug}.jpg`;

      zip.file(fileName, blob);
    }
  }

  return await zip.generateAsync({ type: 'blob' });
}
