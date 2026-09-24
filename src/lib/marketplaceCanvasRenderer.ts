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

  // Device Positioning & Angles
  selectedViewId?: string;
  coverage: 'model_360' | 'model_cut';
  logoCutout: boolean;
  pencilCutout: boolean;
  deviceScale: number;
  deviceOffsetX: number;
  deviceOffsetY: number;
  activeLayerIds?: string[];
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
    imageUrl: 'https://exacoat.com/wp-content/uploads/Textured-Skins-Product-Info.jpg',
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

  // Pill container with rich dark gradient and further rounding
  pathRoundedRect(ctx, x, y, w, h, r);
  const pillGrad = ctx.createLinearGradient(x, y, x, y + h);
  pillGrad.addColorStop(0, '#2e2e34');
  pillGrad.addColorStop(0.35, '#1e1e22');
  pillGrad.addColorStop(1, '#0e0e11');
  ctx.fillStyle = pillGrad;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Inner top highlight stroke
  const borderGrad = ctx.createLinearGradient(x, y, x, y + h);
  borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.10)');
  borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.03)');
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
  highlightColor: string = '#d2d2d2'
) {
  ctx.save();

  const lines = headlineText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const hasSubBadge = Boolean(subBadgeText.trim());
  const badgeH = 68;
  const badgeGap = 22;

  // Consistent headline font size (enlarged 25% to 158px & extra bold 900)
  let fontSize = 158;
  let lineHeight = 164;

  ctx.font = `900 ${fontSize}px "${fontFamily}", "Plus Jakarta Sans", sans-serif`;
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    if (w > 720) {
      const ratio = 720 / w;
      fontSize = Math.floor(fontSize * ratio);
      lineHeight = Math.floor(fontSize * 1.05);
    }
  }

  // Anchor block nicely from the bottom so it sits comfortably above bottom cards
  const totalTextH = lines.length * lineHeight;
  const totalBlockH = (hasSubBadge ? badgeH + badgeGap : 0) + totalTextH;
  const targetBottomY = 1220;
  let currentY = startY ?? Math.max(650, targetBottomY - totalBlockH);

  // 1. Sub-badge pill (e.g. "Model Cut & 360")
  // Full-rounded capsule with transparent background (no background fill)
  if (hasSubBadge) {
    ctx.font = '800 32px "Chakra Petch", sans-serif';
    const textMetrics = ctx.measureText(subBadgeText);
    const badgeW = textMetrics.width + 60;
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
 * Draws clean vector feature icons inside cards matching Image 2 & 3
 */
/**
 * Draws clean vector feature icons inside cards matching Image 2 & 3
 * Scaled up ~25-30% to fit the larger circular badge
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
  ctx.lineWidth = 3.0; // was 2.4 (+25% bolder)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (iconType === 'material') {
    // Rosette star ribbon icon (scaled up ~30%)
    const spikes = 5;
    const outerR = 14.5;
    const innerR = 7.0;
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
    ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (iconType === 'fit') {
    // Calipers / Precision Target icon (scaled up)
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 17, cy);
    ctx.lineTo(cx - 12, cy);
    ctx.moveTo(cx + 12, cy);
    ctx.lineTo(cx + 17, cy);
    ctx.moveTo(cx, cy - 17);
    ctx.lineTo(cx, cy - 12);
    ctx.moveTo(cx, cy + 12);
    ctx.lineTo(cx, cy + 17);
    ctx.stroke();
  } else if (iconType === 'scratch') {
    // Key / Shield Scratch Proof (scaled up)
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 10);
    ctx.lineTo(cx + 6, cy + 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + 7.5, cy + 5, 5.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 13);
    ctx.lineTo(cx - 10, cy - 8);
    ctx.stroke();
  } else if (iconType === 'texture') {
    // 3 vertical tactile texture bars (scaled up)
    const barW = 3.2;
    ctx.lineWidth = barW;
    ctx.lineCap = 'round';

    // Center bar
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.lineTo(cx, cy + 11);
    ctx.stroke();

    // Left bar
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 7);
    ctx.lineTo(cx - 7, cy + 7);
    ctx.stroke();

    // Right bar
    ctx.beginPath();
    ctx.moveTo(cx + 7, cy - 7);
    ctx.lineTo(cx + 7, cy + 7);
    ctx.stroke();
  } else {
    // Checkmark Badge / Guarantee Shield (scaled up)
    ctx.beginPath();
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx + 13, cy - 9);
    ctx.lineTo(cx + 13, cy + 4);
    ctx.quadraticCurveTo(cx + 13, cy + 14, cx, cy + 16.5);
    ctx.quadraticCurveTo(cx - 13, cy + 14, cx - 13, cy + 4);
    ctx.lineTo(cx - 13, cy - 9);
    ctx.closePath();
    ctx.stroke();

    // Checkmark inside shield
    ctx.beginPath();
    ctx.moveTo(cx - 5.5, cy + 1.5);
    ctx.lineTo(cx - 1.5, cy + 5.5);
    ctx.lineTo(cx + 6.5, cy - 3.5);
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

    // 4. Crisp translucent glass border with rounded corners
    ctx.save();
    pathRoundedRect(ctx, x, y, cardW, cardH, cardR);
    const borderGrad = ctx.createLinearGradient(x, y, x, y + cardH);
    borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
    borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.30)');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
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
  const skinLayers = (profile.layers || []).filter((l) => {
    if (l.is_non_visual) return false;
    const lName = (l.name || '').toLowerCase().trim();
    const lId = (l.id || '').toLowerCase().trim();
    if (lName === 'device' || lId === 'device') return false;
    if (lName.includes('device-body') || lName.includes('device_body') || lName.includes('device body')) return false;
    if (lName.includes('chassis') || lName.includes('hardware')) return false;
    if ((l.group as string) === 'device' || (l.group as string) === 'hardware') return false;
    if (config.activeLayerIds && config.activeLayerIds.length > 0) {
      if (!config.activeLayerIds.includes(l.id)) return false;
    }
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
  // Base scale = 1.0 (100% default zoom) with Y offset default 110px
  const baseScale = 1.0;
  const effectiveScale = (config.deviceScale || 1.0) * baseScale;
  const dw = 1500 * effectiveScale;
  const dh = 1500 * effectiveScale;

  // Center of phone in deviceCanvas is (750, 750).
  // Target placement: phone positioned comfortably on the right with camera lenses prominent
  const targetCenterX = 1070 + (config.deviceOffsetX || 0);
  const targetCenterY = 875 + (config.deviceOffsetY !== undefined ? config.deviceOffsetY : 110);

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

  // 3. Top-Left Exacoat Logo Pill (Image 2 style, r=54, optical upward offset)
  if (config.showLogo) {
    await drawLogoPill(ctx, 50, 50, 460, 140, 54);
    // Brand Tagline under logo pill ("#1 Brand Skin di Indonesia")
    if (config.showBrandTagline !== false) {
      drawBrandTagline(ctx, config.brandTagline || '#1 Brand Skin di Indonesia', 50, 206, 460);
    }
  }

  // 4. Top-Right Pill: Displays the Skin Name or "20+ SKINS SELECTION" in bold spaced uppercase (r=54)
  const defaultTopRight = config.isPrimaryImage
    ? '20+ SKINS SELECTION'
    : config.activeFinish.name;
  const skinPillText = (config.topRightText?.trim() || defaultTopRight).toUpperCase();
  drawTopRightPill(ctx, skinPillText, 540, 50, 910, 140, 54);

  // 5. Left Column: Sub-badge & Big Bold Headline (displays the Product / Device Name with #d2d2d2 outline)
  const defaultDeviceTitle = formatDeviceHeadline(config.profile.device_name || config.deviceNameText || '');
  const effectiveHeadline = config.headlineText?.trim() ? config.headlineText : defaultDeviceTitle;

  drawLeftHeadlineBlock(
    ctx,
    config.subBadgeText || '',
    effectiveHeadline,
    config.headlineFont || 'Chakra Petch',
    50,
    undefined,
    config.headlineHighlightColor || '#d2d2d2'
  );

  // 6. Bottom Feature Cards (frosted glass with backdrop blur, less opacity, 25% larger typography, shorter cardH=200)
  await drawBottomFeatureCards(ctx, config.featureCards, 1255, 200, width);
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
  },
  onProgress?: (current: number, total: number, finishName: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  const includeCover = options?.includePrimaryCover !== false;
  const total = targetFinishes.length + (includeCover ? 1 : 0);
  let progressCount = 0;

  // 1. Generate Primary Cover Image if requested
  if (includeCover) {
    progressCount++;
    if (onProgress) {
      onProgress(progressCount, total, 'Primary Cover (20+ Skins Selection)');
    }

    const coverFinish = options?.primaryFinish || targetFinishes[0] || baseConfig.activeFinish;
    const coverConfig: MarketplaceImageConfig = {
      ...baseConfig,
      activeFinish: coverFinish,
      isPrimaryImage: true,
      topRightText: (options?.primaryTopRightText?.trim() || '20+ SKINS SELECTION').toUpperCase(),
      headlineText: baseConfig.headlineText
        ? baseConfig.headlineText
        : formatDeviceHeadline(baseConfig.profile.device_name),
    };

    const coverBlob = await generateMarketplaceImageBlob(coverConfig);
    zip.file('00_PRIMARY_COVER_20_SKINS_SELECTION.jpg', coverBlob);
  }

  // 2. Generate each variant finish image
  for (let i = 0; i < targetFinishes.length; i++) {
    const finish = targetFinishes[i];
    progressCount++;
    if (onProgress) {
      onProgress(progressCount, total, finish.name);
    }

    const currentConfig: MarketplaceImageConfig = {
      ...baseConfig,
      activeFinish: finish,
      isPrimaryImage: false,
      topRightText: finish.name.toUpperCase(),
      headlineText: baseConfig.headlineText
        ? baseConfig.headlineText
        : formatDeviceHeadline(baseConfig.profile.device_name),
    };

    const blob = await generateMarketplaceImageBlob(currentConfig);
    const indexStr = String(i + 1).padStart(2, '0');
    const slugStr = (finish.slug || finish.id || `finish_${i + 1}`).replace(/[^a-z0-9_-]/gi, '_');
    const filename = `${indexStr}_${slugStr}.jpg`;

    zip.file(filename, blob);
  }

  return await zip.generateAsync({ type: 'blob' });
}
