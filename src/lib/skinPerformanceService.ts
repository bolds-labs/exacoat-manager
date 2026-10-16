import { Order, OrderItem } from '../types';
import { isBaseSkinLayer } from '../components/configurator/V2SkinCanvasLayer';
import { DEFAULT_GLOBAL_FINISHES, GlobalFinish } from './wordpressBridge';
import { extractItemSpecs } from './orderItems';
import {
  convertToIdr,
  isRevenueOrder,
  getStoreDateKey,
  parseStoreDate,
  getStoreDayStartMs,
  getStoreDayEndMs,
  generateContinuousDays,
  formatStoreDateFull,
} from './formatters';

export interface BaseSkinExtractResult {
  skinName: string;
  skinSlug: string;
  skinGroup: string;
  colorHex?: string;
  thumbnailUrl?: string;
  layerName: string;
  deviceName: string;
  unitPriceIdr: number;
  quantity: number;
}

export interface SkinDevicePairing {
  deviceName: string;
  units: number;
  revenue: number;
  percentage: number;
}

export interface SkinMetricItem {
  slug: string;
  name: string;
  group: string;
  colorHex: string;
  thumbnailUrl?: string;
  unitsSold: number;
  orderCount: number;
  grossRevenueIdr: number;
  shareOfTotalUnits: number;
  shareOfTotalRevenue: number;
  averageItemPriceIdr: number;
  topDevices: SkinDevicePairing[];
  dailyTimeline: { date: string; label: string; units: number; revenue: number }[];
}

export interface SkinPerformanceTimelinePoint {
  date: string;
  label: string;
  fullLabel: string;
  totalUnits: number;
  totalRevenue: number;
  topSkins: Record<string, number>;
}

export interface SkinGroupSummary {
  group: string;
  units: number;
  revenue: number;
  sharePercentage: number;
  skinsCount: number;
}

export interface SkinPerformanceReport {
  totalBaseSkinsSold: number;
  totalOrdersWithBaseSkins: number;
  totalRevenueIdr: number;
  averageOrderValueIdr: number;
  uniqueSkinsCount: number;
  activeSkinsCount?: number;
  topSkinByVolume: SkinMetricItem | null;
  topSkinByRevenue: SkinMetricItem | null;
  fastestGrowingSkin?: SkinMetricItem | null;
  skins: SkinMetricItem[];
  groups: SkinGroupSummary[];
  timeline: SkinPerformanceTimelinePoint[];
}

/**
 * Standardize finish slug by removing non-alphanumeric chars
 */
export function normalizeSkinSlug(raw: string): string {
  if (!raw) return '';
  return raw.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes any legacy or external thumbnail URLs to point directly to media.exacoat.com/wp-content/uploads/
 */
export function normalizeThumbnailUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Rewrite any exacoat.com (without media/cms) or staging uploads to media.exacoat.com
  let normalized = trimmed.replace(
    /^https?:\/\/(?:(?:www\.)?exacoat\.com|staging\.exacoat\.com)\/(?:wp-content\/)?uploads\//i,
    'https://media.exacoat.com/wp-content/uploads/'
  );

  // If Burgundy or Titanium thumbnail was saved as https://media.exacoat.com/Burgundy-Texture-Thumbnail.jpg
  // Ensure it has /wp-content/uploads/
  normalized = normalized.replace(
    /^https?:\/\/media\.exacoat\.com\/([^/]+\.(?:jpe?g|png|webp|svg))$/i,
    'https://media.exacoat.com/wp-content/uploads/$1'
  );

  return normalized;
}

/**
 * Detect non-finish values such as coverage options ("Full Skin", "Back Only"),
 * device model names ("iPhone", "Samsung"), or structural/placeholder terms.
 */
export function isInvalidFinishCandidate(rawVal: string): boolean {
  if (!rawVal || typeof rawVal !== 'string') return true;
  const val = rawVal.trim().toLowerCase();
  if (val.length < 2) return true;

  // Explicitly allow Everything Skins and known special finishes
  if (/^everythings?(?:\s*skins?)?$/i.test(val)) {
    return false;
  }

  // 1. Common generic placeholder values
  if (
    /^(custom|default|none|select|false|true|yes|no|undefined|null|n\/a|std|standard|unknown|empty|auto|all|n\/d)$/i.test(val)
  ) {
    return true;
  }

  // 2. Coverage options & variations (e.g. "Full Skin", "Back Only", "Back & Sides", "Precision Fit")
  if (
    /^(full\s*skin|back\s*only|full\s*body|back\s*&\s*sides?|back\s*and\s*sides?|coverage|precision\s*fit|standard\s*fit|full\s*coverage|simple\s*fit)$/i.test(val) ||
    /^(with\s*logo|without\s*logo|logo\s*cutout|no\s*logo\s*cutout|cutout|no\s*cutout)$/i.test(val)
  ) {
    return true;
  }

  // 3. Device brands & device models passed erroneously as skin values
  // e.g. "iPhone", "iPhone 16 Pro", "Samsung S24 Ultra", "MacBook Pro", "iPad", "Xiaomi 14", "POCO F6"
  if (
    /\b(iphone|samsung|galaxy|macbook|ipad|xiaomi|poco|oppo|vivo|pixel|asus|rog|lenovo|infinix|oneplus|realme|huawei|redmi|xperia)\b/i.test(val) ||
    /^(device|phone|smartphone|laptop|tablet|keyboard|magic\s*keyboard|airpods|watch|charger|case)$/i.test(val)
  ) {
    return true;
  }

  // 4. Layer component labels mistakenly extracted as the choice/finish value
  if (
    /^(back|back\s*skin|body|body\s*skin|base|base\s*skin|accent|camera|camera\s*lens|frame|sides?|hinge|logo|trackpad|keyboard|visor)$/i.test(val)
  ) {
    return true;
  }

  return false;
}

/**
 * Detect whether an order is an RMA Installation Warranty Replacement or Redeem claim
 */
export function isWarrantyReplacementOrder(order: any): boolean {
  if (!order) return false;

  // 1. Direct RMA properties
  const rmaOrderType = String(
    order.rma?.order_type ||
    order._rma_order_type ||
    ''
  ).toLowerCase().trim();

  if (rmaOrderType === 'warranty' || rmaOrderType === 'redeem') {
    return true;
  }

  // 2. Metadata inspection
  const meta = Array.isArray(order.meta_data) ? order.meta_data : [];
  for (const m of meta) {
    if (!m || typeof m !== 'object') continue;
    const k = String(m.key || '').toLowerCase().trim();
    const v = String(m.value || '').toLowerCase().trim();

    if (k === '_rma_order_type' && (v === 'warranty' || v === 'redeem')) {
      return true;
    }
    if ((k === '_is_warranty' || k === '_is_warranty_claim') && (v === 'yes' || v === 'warranty' || v === 'true')) {
      return true;
    }
    if (k === '_order_badge' && (v === 'warranty' || v === 'redeem')) {
      return true;
    }
  }

  // 3. Customer note or order notes inspection
  const noteContent = [
    order.customer_note,
    order.note,
    order.admin_note,
    order.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    noteContent.includes('[warranty replacement]') ||
    noteContent.includes('[rma installation warranty]') ||
    noteContent.includes('[marketplace warranty claim]') ||
    noteContent.includes('installation warranty replacement') ||
    noteContent.includes('garansi pemasangan')
  ) {
    return true;
  }

  return false;
}

/**
 * Detect whether an individual order item is a warranty replacement item
 */
export function isWarrantyReplacementItem(item: any): boolean {
  if (!item) return false;

  const meta = Array.isArray(item.meta_data) ? item.meta_data : [];
  for (const m of meta) {
    if (!m || typeof m !== 'object') continue;
    const k = String(m.key || '').toLowerCase().trim();
    const v = String(m.value || '').toLowerCase().trim();
    if (k === '_is_warranty' && (v === 'yes' || v === 'warranty' || v === 'true')) {
      return true;
    }
  }

  const name = String(item.name || '').toLowerCase();
  if (
    name.includes('[warranty replacement]') ||
    name.includes('[warranty]') ||
    name.includes('warranty replacement') ||
    name.includes('garansi pemasangan')
  ) {
    return true;
  }

  return false;
}

/**
 * Returns the definitive list of all master textures (defaults, limited, and Skin Studio inventory)
 */
export function getMasterTexturesList(): GlobalFinish[] {
  const map = new Map<string, GlobalFinish>();

  // 1. Ingest DEFAULT_GLOBAL_FINISHES
  DEFAULT_GLOBAL_FINISHES.forEach((f) => {
    const slug = normalizeSkinSlug(f.slug || f.id || f.name);
    map.set(slug, {
      ...f,
      slug: f.slug || slug,
      thumbnail: normalizeThumbnailUrl(f.thumbnail),
      texture_big_url: normalizeThumbnailUrl(f.texture_big_url),
    });
  });

  // 2. Add Burgundy
  if (!map.has('burgundy')) {
    map.set('burgundy', {
      id: 'burgundy',
      name: 'Burgundy',
      slug: 'burgundy',
      group: 'Limited',
      color_hex: '#5B1E28',
      in_stock: true,
      extra_price: 35000,
      thumbnail: 'https://media.exacoat.com/wp-content/uploads/Burgundy-Texture-Thumbnail.jpg',
    });
  }

  // 3. Add Titanium+
  if (!map.has('titaniumplus') && !map.has('titanium-plus')) {
    map.set('titanium-plus', {
      id: 'titanium-plus',
      name: 'Titanium+',
      slug: 'titanium-plus',
      group: 'Limited',
      color_hex: '#8E8D8A',
      in_stock: true,
      extra_price: 35000,
      thumbnail: 'https://media.exacoat.com/wp-content/uploads/Titanium-Plus-Texture-Thumbnail.jpg',
    });
  }

  // 4. Add Everything Skins (special / custom per-device master skin)
  if (!map.has('everything') && !map.has('everythingskins') && !map.has('everythingskin')) {
    map.set('everything', {
      id: 'everything',
      name: 'Everything',
      slug: 'everything',
      group: 'Special edition',
      color_hex: '#2d2d30',
      in_stock: true,
      extra_price: 35000,
      thumbnail: 'https://media.exacoat.com/wp-content/uploads/Everything-Texture-Thumbnail.jpg',
    });
  }

  // 5. Ingest custom master textures from Skin Studio inventory cache
  if (typeof localStorage !== 'undefined') {
    const storageKeys = ['exacoat_finishes_inventory_cache', 'exacoat_finishes_inventory_v2'];
    for (const key of storageKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((f: GlobalFinish) => {
              if (!f || typeof f !== 'object') return;
              const slug = normalizeSkinSlug(f.slug || f.id || f.name);
              if (!slug) return;
              if (isInvalidFinishCandidate(f.name || f.slug)) return;

              map.set(slug, {
                ...f,
                slug: f.slug || slug,
                thumbnail: normalizeThumbnailUrl(f.thumbnail),
                texture_big_url: normalizeThumbnailUrl(f.texture_big_url),
              });
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Build index of all known finishes from defaults & cached custom finishes
 */
export function buildKnownFinishesDictionary(): Map<string, GlobalFinish> {
  const dict = new Map<string, GlobalFinish>();
  const masters = getMasterTexturesList();

  masters.forEach((f) => {
    const slugKey = normalizeSkinSlug(f.slug);
    const nameKey = normalizeSkinSlug(f.name);
    const idKey = normalizeSkinSlug(f.id);

    if (slugKey) dict.set(slugKey, f);
    if (nameKey) dict.set(nameKey, f);
    if (idKey) dict.set(idKey, f);
  });

  // Map Titanium+ aliases explicitly
  const titaniumPlus = dict.get('titaniumplus') || dict.get('titanium-plus') || dict.get('titanium');
  if (titaniumPlus) {
    dict.set('titaniumplus', titaniumPlus);
    dict.set('titanium-plus', titaniumPlus);
    dict.set('titanium', titaniumPlus);
  }

  // Map Everything Skins aliases explicitly
  const everythingFinish = dict.get('everything') || dict.get('everythingskins') || dict.get('everythingskin');
  if (everythingFinish) {
    dict.set('everything', everythingFinish);
    dict.set('everythingskins', everythingFinish);
    dict.set('everythingskin', everythingFinish);
  }

  // Map Forged Carbon aliases explicitly
  const forgedCarbon = dict.get('forgedcarbon') || dict.get('forged-carbon');
  if (forgedCarbon) {
    dict.set('forgedcarbon', forgedCarbon);
    dict.set('forged-carbon', forgedCarbon);
    dict.set('forgedcarbonblack', forgedCarbon);
  }

  // Map Woven aliases explicitly
  const wovenFinish = dict.get('woven');
  if (wovenFinish) {
    dict.set('woven', wovenFinish);
    dict.set('wovenblack', wovenFinish);
  }

  return dict;
}

/**
 * Clean device title for aggregation (e.g. "iPhone 16 Pro Max Skins" -> "iPhone 16 Pro Max")
 */
export function extractCleanDeviceName(rawTitle: string): string {
  if (!rawTitle) return 'Standard Device';
  return rawTitle
    .replace(/\s*-\s*(custom|configurator|order|signature|drop|skins?).*$/i, '')
    .replace(/\b(skins?|wraps?|skin)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || rawTitle;
}

/**
 * Filter out non-skin accessories that should not count as device skins
 */
export function isSkinProductItem(item: OrderItem): boolean {
  const name = (item.name || '').toLowerCase();
  const sku = (item.sku || '').toLowerCase();

  const nonSkinPatterns = [
    'screen protector',
    'screen-protector',
    'tempered glass',
    'cleaning cloth',
    'squeegee',
    'applicator',
    'cable',
    'charger',
    'adapter',
    'sample swatch',
    'swatch sample',
    'swatch',
    'gift card',
  ];

  for (const pat of nonSkinPatterns) {
    if (name.includes(pat) || sku.includes(pat)) {
      return false;
    }
  }

  // Phone cases are not vinyl skins unless configured with a skin
  if (name.includes('case') && !name.includes('skin')) {
    return false;
  }

  return true;
}

/**
 * Core Algorithm: Extract the BASE SKIN (the required skin) from an OrderItem
 */
export function extractBaseSkinFromOrderItem(
  item: OrderItem,
  finishesDict: Map<string, GlobalFinish>
): BaseSkinExtractResult | null {
  if (!item || !isSkinProductItem(item)) {
    return null;
  }

  let selectedFinishName = '';
  let matchedLayerName = '';
  let layerGroup = '';

  // Clean raw choice text (strip price surcharges like "(+Rp 30.000)")
  const cleanChoiceString = (raw: any): string => {
    if (!raw || typeof raw !== 'string') return '';
    return raw
      .replace(/\s*\(\+[^)]+\)\s*$/i, '')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Helper to test if a candidate matches a known finish in finishesDict
  const findKnownFinish = (candidate: string): GlobalFinish | undefined => {
    const cleaned = cleanChoiceString(candidate);
    if (!cleaned || isInvalidFinishCandidate(cleaned)) return undefined;
    const slug = normalizeSkinSlug(cleaned);
    return finishesDict.get(slug);
  };

  // Helper to extract choice string and layer details without falling back to layer name
  const getLayerChoice = (layer: any): { choice: string; layerName: string; group: string; isReq: boolean } => {
    const lData = layer?.layer_data || {};
    const lName = String(lData.layer_name || lData.name || layer?.layer_name || layer?.name || '').trim();
    // Do NOT fall back to layer name if choice_name is not set!
    const rawChoice =
      layer?.choice_name ||
      layer?.choice_title ||
      layer?.choice ||
      lData.name ||
      (typeof layer?.value === 'string' ? layer.value : '') ||
      '';
    const choice = cleanChoiceString(rawChoice);
    const group = String(lData.group || layer?.group || layer?.layer_group || '').toLowerCase();
    const isReq = Boolean(lData.is_required || layer?.is_required);
    return { choice, layerName: lName, group, isReq };
  };

  // Collect candidate layers from parsed_configurator
  const configuratorLayers: any[] = [];
  if (Array.isArray(item.parsed_configurator) && item.parsed_configurator.length > 0) {
    configuratorLayers.push(...item.parsed_configurator);
  } else if (Array.isArray((item as any).meta_data)) {
    const rawConfig = (item as any).meta_data.find(
      (m: any) =>
        m.key === '_configurator_data_raw' ||
        m.key === '_configurator_data' ||
        m.key === '_pc_configurator_data' ||
        m.key === 'layers' ||
        m.key === '_layers'
    );
    if (rawConfig && rawConfig.value) {
      let cfgList = rawConfig.value;
      if (typeof cfgList === 'string') {
        try {
          cfgList = JSON.parse(cfgList);
        } catch {
          // ignore
        }
      }
      if (Array.isArray(cfgList)) {
        configuratorLayers.push(...cfgList);
      }
    }
  }

  // Collect specs (WooCommerce attributes or parsed metadata)
  const specs = Array.isArray((item as any).specs) && (item as any).specs.length > 0
    ? (item as any).specs
    : extractItemSpecs(item);

  // -----------------------------------------------------------------
  // STRATEGY 1: Inspect Configurator Layers (Prioritized Multi-pass)
  // -----------------------------------------------------------------
  if (configuratorLayers.length > 0) {
    // 1A. Primary / Base skin layer matching a KNOWN master texture
    for (const l of configuratorLayers) {
      const { choice, layerName, group, isReq } = getLayerChoice(l);
      if (!choice || isInvalidFinishCandidate(choice)) continue;
      // Skip camera, accents, logo, frame
      if (/\b(camera|accent|logo|frame|side|hinge|lens)\b/i.test(layerName)) continue;

      if (isReq || group === 'primary' || isBaseSkinLayer(layerName, group)) {
        const known = findKnownFinish(choice);
        if (known) {
          selectedFinishName = known.name;
          matchedLayerName = layerName || 'Base Skin';
          layerGroup = group;
          break;
        }
      }
    }

    // 1B. Any non-accent layer matching a KNOWN master texture
    if (!selectedFinishName) {
      for (const l of configuratorLayers) {
        const { choice, layerName, group } = getLayerChoice(l);
        if (!choice || isInvalidFinishCandidate(choice)) continue;
        if (/\b(camera|accent|logo|frame|side|hinge|lens)\b/i.test(layerName)) continue;

        const known = findKnownFinish(choice);
        if (known) {
          selectedFinishName = known.name;
          matchedLayerName = layerName || 'Base Skin';
          layerGroup = group;
          break;
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // STRATEGY 2: Inspect Item Specs (Variations / Custom Meta)
  // -----------------------------------------------------------------
  if (!selectedFinishName && specs.length > 0) {
    // 2A. Spec matching isBaseSkinLayer AND a KNOWN master texture in dictionary
    for (const s of specs) {
      const label = String(s.label || '').trim();
      const val = cleanChoiceString(s.value);
      if (!val || isInvalidFinishCandidate(val)) continue;
      if (/\b(camera|accent|logo|frame|side|hinge|lens|coverage|device|model|tipe)\b/i.test(label)) continue;

      if (isBaseSkinLayer(label)) {
        const known = findKnownFinish(val);
        if (known) {
          selectedFinishName = known.name;
          matchedLayerName = label;
          break;
        }
      }
    }

    // 2B. Spec with texture/finish/skin/material label matching a KNOWN master texture
    if (!selectedFinishName) {
      for (const s of specs) {
        const label = String(s.label || '').trim().toLowerCase();
        const val = cleanChoiceString(s.value);
        if (!val || isInvalidFinishCandidate(val)) continue;

        if (['texture', 'finish', 'skin', 'material', 'back skin', 'back'].includes(label)) {
          const known = findKnownFinish(val);
          if (known) {
            selectedFinishName = known.name;
            matchedLayerName = s.label;
            break;
          }
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // STRATEGY 3: Check Product Title for Known Master Finish
  // -----------------------------------------------------------------
  if (!selectedFinishName) {
    const cleanTitle = (item.name || '').toLowerCase();
    for (const [normKey, finish] of finishesDict.entries()) {
      if (normKey.length < 4) continue; // Avoid tiny accidental matches
      if (['black', 'white'].includes(normKey)) continue;

      const finishNameLower = finish.name.toLowerCase();
      if (cleanTitle.includes(finishNameLower)) {
        selectedFinishName = finish.name;
        matchedLayerName = 'Product Title';
        break;
      }
    }
  }

  // If no finish was identified or it was an invalid candidate, reject
  if (!selectedFinishName || isInvalidFinishCandidate(selectedFinishName)) {
    return null;
  }

  // Resolve metadata for the detected finish STRICTLY against master textures
  const normChoice = normalizeSkinSlug(selectedFinishName);
  const matchedFinish = finishesDict.get(normChoice);

  // STRICT GUARD: Must resolve to an authenticated master texture finish
  if (!matchedFinish) {
    return null;
  }

  const finalName = matchedFinish.name;
  const finalSlug = matchedFinish.slug;
  const finalGroup = matchedFinish.group || (layerGroup === 'primary' ? 'Signature skins' : 'Other');
  const colorHex = matchedFinish.color_hex || '#3f3f46';
  const rawThumbnail = matchedFinish.thumbnail || matchedFinish.texture_big_url;
  const thumbnailUrl = normalizeThumbnailUrl(rawThumbnail);

  const deviceName = extractCleanDeviceName(item.name);
  const qty = Number(item.quantity) || 1;
  const rawSubtotal = Number((item as any).subtotal || item.total || 0);
  const unitPriceIdr = qty > 0 ? Math.round(convertToIdr(rawSubtotal, (item as any).currency || 'IDR') / qty) : 0;

  return {
    skinName: finalName,
    skinSlug: finalSlug,
    skinGroup: finalGroup,
    colorHex,
    thumbnailUrl,
    layerName: matchedLayerName || 'Base Skin',
    deviceName,
    unitPriceIdr,
    quantity: qty,
  };
}

/**
 * Filter orders strictly by date horizon in store timezone (Asia/Jakarta)
 */
export function filterOrdersByHorizon(
  orders: Order[],
  preset: 'today' | '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'all' | 'custom',
  customStart?: string,
  customEnd?: string
): { filtered: Order[]; startMs: number; endMs: number; horizonLabel: string } {
  const todayKey = getStoreDateKey(Date.now());
  const todayStartMs = getStoreDayStartMs(todayKey);
  const todayEndMs = getStoreDayEndMs(todayKey);

  const [currY, currM] = todayKey.split('-').map(Number);
  let startMs = todayStartMs - 29 * 24 * 60 * 60 * 1000;
  let endMs = todayEndMs;
  let horizonLabel = 'Last 30 Days';

  if (preset === 'today') {
    startMs = todayStartMs;
    horizonLabel = 'Today';
  } else if (preset === '7d') {
    startMs = todayStartMs - 6 * 24 * 60 * 60 * 1000;
    horizonLabel = 'Last 7 Days';
  } else if (preset === '30d') {
    startMs = todayStartMs - 29 * 24 * 60 * 60 * 1000;
    horizonLabel = 'Last 30 Days';
  } else if (preset === '90d') {
    startMs = todayStartMs - 89 * 24 * 60 * 60 * 1000;
    horizonLabel = 'Last 90 Days';
  } else if (preset === 'this_month') {
    const monthStartKey = `${currY}-${String(currM).padStart(2, '0')}-01`;
    startMs = getStoreDayStartMs(monthStartKey);
    horizonLabel = 'This Month';
  } else if (preset === 'last_month') {
    const prevY = currM === 1 ? currY - 1 : currY;
    const prevM = currM === 1 ? 12 : currM - 1;
    const daysInPrevMonth = new Date(Date.UTC(currY, currM - 1, 0)).getUTCDate();
    const lastMonthStartKey = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
    const lastMonthEndKey = `${prevY}-${String(prevM).padStart(2, '0')}-${String(daysInPrevMonth).padStart(2, '0')}`;
    startMs = getStoreDayStartMs(lastMonthStartKey);
    endMs = getStoreDayEndMs(lastMonthEndKey);
    horizonLabel = 'Last Month';
  } else if (preset === 'custom' && customStart && customEnd) {
    startMs = getStoreDayStartMs(customStart);
    endMs = getStoreDayEndMs(customEnd);
    horizonLabel = `${customStart} - ${customEnd}`;
  } else if (preset === 'all') {
    startMs = 0;
    horizonLabel = 'All Time';
  }

  const filtered = orders.filter((o) => {
    if (!o.created_at) return true;
    const d = parseStoreDate(o.created_at) || new Date(o.created_at);
    const t = d.getTime();
    return isNaN(t) || (t >= startMs && t <= endMs);
  });

  return { filtered, startMs, endMs, horizonLabel };
}

/**
 * Main Aggregator: Computes comprehensive base skin performance statistics.
 * Pre-populates ALL master textures so 0-sales items are displayed, and excludes warranty replacements.
 */
export function aggregateSkinPerformance(
  orders: Order[],
  startMs: number,
  endMs: number
): SkinPerformanceReport {
  const finishesDict = buildKnownFinishesDictionary();
  const masterTextures = getMasterTexturesList();

  // Continuous date buckets for the timeline
  const continuousDays = generateContinuousDays(startMs, endMs);
  const timelineMap = new Map<
    string,
    {
      date: string;
      label: string;
      fullLabel: string;
      totalUnits: number;
      totalRevenue: number;
      topSkins: Record<string, number>;
    }
  >();

  continuousDays.forEach((d) => {
    timelineMap.set(d.key, {
      date: d.key,
      label: d.label,
      fullLabel: formatStoreDateFull(d.timestamp),
      totalUnits: 0,
      totalRevenue: 0,
      topSkins: {},
    });
  });

  // Pre-populate skinMap with ALL master textures from catalog
  // This guarantees that 0-unit items are shown and rogue non-skin items cannot be added!
  const skinMap = new Map<
    string,
    {
      slug: string;
      name: string;
      group: string;
      colorHex: string;
      thumbnailUrl?: string;
      unitsSold: number;
      orderIds: Set<number | string>;
      grossRevenueIdr: number;
      devicesMap: Map<string, { units: number; revenue: number }>;
      dailyMap: Map<string, { units: number; revenue: number }>;
    }
  >();

  masterTextures.forEach((f) => {
    const canonicalKey = normalizeSkinSlug(f.slug || f.name);
    if (!skinMap.has(canonicalKey)) {
      skinMap.set(canonicalKey, {
        slug: f.slug || canonicalKey,
        name: f.name,
        group: f.group || 'Signature skins',
        colorHex: f.color_hex || '#52525b',
        thumbnailUrl: normalizeThumbnailUrl(f.thumbnail || f.texture_big_url),
        unitsSold: 0,
        orderIds: new Set(),
        grossRevenueIdr: 0,
        devicesMap: new Map(),
        dailyMap: new Map(),
      });
    }
  });

  let totalBaseSkinsSold = 0;
  let totalRevenueIdr = 0;
  const ordersWithBaseSkins = new Set<number | string>();

  // Process revenue-valid orders, EXCLUDING warranty replacement orders
  orders.forEach((order) => {
    if (!isRevenueOrder(order)) return;
    if (isWarrantyReplacementOrder(order)) return;

    const orderDateKey = getStoreDateKey(order.created_at) || '';
    const timelineEntry = timelineMap.get(orderDateKey);
    const rawItems = (Array.isArray(order.items) && order.items.length > 0)
      ? order.items
      : (Array.isArray(order.line_items) ? order.line_items : []);

    let orderHasBaseSkin = false;

    rawItems.forEach((item) => {
      // Exclude warranty replacement line items
      if (isWarrantyReplacementItem(item)) return;

      const extracted = extractBaseSkinFromOrderItem(item, finishesDict);
      if (!extracted) return;

      // Match strictly to initialized master textures in skinMap
      const canonicalKey = normalizeSkinSlug(extracted.skinSlug || extracted.skinName);
      let skinEntry = skinMap.get(canonicalKey);

      if (!skinEntry) {
        const fallbackMaster = finishesDict.get(canonicalKey);
        if (fallbackMaster) {
          skinEntry = skinMap.get(normalizeSkinSlug(fallbackMaster.slug || fallbackMaster.name));
        }
      }

      // If not an authentic master texture, skip! (Prevents iPhone, Samsung, etc.)
      if (!skinEntry) return;

      orderHasBaseSkin = true;
      const units = extracted.quantity;
      const itemRevIdr = extracted.unitPriceIdr * units;

      totalBaseSkinsSold += units;
      totalRevenueIdr += itemRevIdr;

      // Update timeline
      if (timelineEntry) {
        timelineEntry.totalUnits += units;
        timelineEntry.totalRevenue += itemRevIdr;
        timelineEntry.topSkins[skinEntry.name] = (timelineEntry.topSkins[skinEntry.name] || 0) + units;
      }

      // Accumulate units and revenue
      skinEntry.unitsSold += units;
      skinEntry.orderIds.add(order.id);
      skinEntry.grossRevenueIdr += itemRevIdr;

      // Device pairing
      const dev = extracted.deviceName || 'Other Device';
      const devEntry = skinEntry.devicesMap.get(dev) || { units: 0, revenue: 0 };
      devEntry.units += units;
      devEntry.revenue += itemRevIdr;
      skinEntry.devicesMap.set(dev, devEntry);

      // Skin daily breakdown
      if (orderDateKey) {
        const dEntry = skinEntry.dailyMap.get(orderDateKey) || { units: 0, revenue: 0 };
        dEntry.units += units;
        dEntry.revenue += itemRevIdr;
        skinEntry.dailyMap.set(orderDateKey, dEntry);
      }
    });

    if (orderHasBaseSkin) {
      ordersWithBaseSkins.add(order.id);
    }
  });

  // Transform skinMap into sorted array (ALL master textures, including 0 units sold!)
  const skins: SkinMetricItem[] = Array.from(skinMap.values()).map((s) => {
    const shareUnits = totalBaseSkinsSold > 0 ? (s.unitsSold / totalBaseSkinsSold) * 100 : 0;
    const shareRev = totalRevenueIdr > 0 ? (s.grossRevenueIdr / totalRevenueIdr) * 100 : 0;
    const aov = s.unitsSold > 0 ? Math.round(s.grossRevenueIdr / s.unitsSold) : 0;

    // Top devices
    const topDevices: SkinDevicePairing[] = Array.from(s.devicesMap.entries())
      .map(([deviceName, data]) => ({
        deviceName,
        units: data.units,
        revenue: data.revenue,
        percentage: s.unitsSold > 0 ? (data.units / s.unitsSold) * 100 : 0,
      }))
      .sort((a, b) => b.units - a.units);

    // Continuous daily timeline for sparkline
    const dailyTimeline = continuousDays.map((d) => {
      const point = s.dailyMap.get(d.key) || { units: 0, revenue: 0 };
      return {
        date: d.key,
        label: d.label,
        units: point.units,
        revenue: point.revenue,
      };
    });

    return {
      slug: s.slug,
      name: s.name,
      group: s.group,
      colorHex: s.colorHex,
      thumbnailUrl: s.thumbnailUrl,
      unitsSold: s.unitsSold,
      orderCount: s.orderIds.size,
      grossRevenueIdr: s.grossRevenueIdr,
      shareOfTotalUnits: Number(shareUnits.toFixed(1)),
      shareOfTotalRevenue: Number(shareRev.toFixed(1)),
      averageItemPriceIdr: aov,
      topDevices,
      dailyTimeline,
    };
  });

  // Sort primarily by units sold desc, then revenue desc, then name asc
  skins.sort((a, b) => {
    if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
    if (b.grossRevenueIdr !== a.grossRevenueIdr) return b.grossRevenueIdr - a.grossRevenueIdr;
    return a.name.localeCompare(b.name);
  });

  // Group summary breakdown
  const groupMap = new Map<string, { units: number; revenue: number; count: number }>();
  skins.forEach((s) => {
    const grp = s.group || 'Other';
    const entry = groupMap.get(grp) || { units: 0, revenue: 0, count: 0 };
    entry.units += s.unitsSold;
    entry.revenue += s.grossRevenueIdr;
    entry.count += 1;
    groupMap.set(grp, entry);
  });

  const groups: SkinGroupSummary[] = Array.from(groupMap.entries())
    .map(([group, data]) => ({
      group,
      units: data.units,
      revenue: data.revenue,
      sharePercentage: totalBaseSkinsSold > 0 ? Number(((data.units / totalBaseSkinsSold) * 100).toFixed(1)) : 0,
      skinsCount: data.count,
    }))
    .sort((a, b) => b.units - a.units);

  const topSkinByVolume = skins.length > 0 && skins[0].unitsSold > 0 ? skins[0] : null;
  const topSkinByRevenueCandidate = skins.length > 0 ? [...skins].sort((a, b) => b.grossRevenueIdr - a.grossRevenueIdr)[0] : null;
  const topSkinByRevenue = topSkinByRevenueCandidate && topSkinByRevenueCandidate.grossRevenueIdr > 0 ? topSkinByRevenueCandidate : null;

  const averageOrderValueIdr =
    ordersWithBaseSkins.size > 0 ? Math.round(totalRevenueIdr / ordersWithBaseSkins.size) : 0;

  const activeSkinsCount = skins.filter((s) => s.unitsSold > 0).length;

  return {
    totalBaseSkinsSold,
    totalOrdersWithBaseSkins: ordersWithBaseSkins.size,
    totalRevenueIdr,
    averageOrderValueIdr,
    uniqueSkinsCount: skins.length,
    activeSkinsCount,
    topSkinByVolume,
    topSkinByRevenue,
    skins,
    groups,
    timeline: Array.from(timelineMap.values()),
  };
}

/**
 * Export Skin Performance Report to CSV
 */
export function exportSkinReportToCsv(
  report: SkinPerformanceReport,
  dateRangeLabel: string
): void {
  if (!report || report.skins.length === 0) {
    alert('No skin performance data available to export.');
    return;
  }

  const headers = [
    'Skin Name',
    'Slug',
    'Collection / Group',
    'Units Sold',
    'Order Count',
    'Gross Revenue (IDR)',
    'Market Share (%)',
    'Avg Unit Price (IDR)',
    'Top Device 1',
    'Top Device 2',
    'Top Device 3',
  ];

  const rows = report.skins.map((s) => {
    const top1 = s.topDevices[0] ? `${s.topDevices[0].deviceName} (${s.topDevices[0].units} units)` : '-';
    const top2 = s.topDevices[1] ? `${s.topDevices[1].deviceName} (${s.topDevices[1].units} units)` : '-';
    const top3 = s.topDevices[2] ? `${s.topDevices[2].deviceName} (${s.topDevices[2].units} units)` : '-';

    return [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.slug}"`,
      `"${s.group}"`,
      s.unitsSold,
      s.orderCount,
      s.grossRevenueIdr,
      `${s.shareOfTotalUnits}%`,
      s.averageItemPriceIdr,
      `"${top1.replace(/"/g, '""')}"`,
      `"${top2.replace(/"/g, '""')}"`,
      `"${top3.replace(/"/g, '""')}"`,
    ];
  });

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `exacoat-skin-performance-${dateRangeLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
