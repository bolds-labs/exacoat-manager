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
 * Build index of all known finishes from defaults & cached custom finishes
 */
export function buildKnownFinishesDictionary(): Map<string, GlobalFinish> {
  const dict = new Map<string, GlobalFinish>();

  // Ingest defaults first
  DEFAULT_GLOBAL_FINISHES.forEach((f) => {
    dict.set(normalizeSkinSlug(f.slug), f);
    dict.set(normalizeSkinSlug(f.name), f);
    dict.set(normalizeSkinSlug(f.id), f);
  });

  // Add Burgundy and Titanium+ if not present
  if (!dict.has('burgundy')) {
    const burg: GlobalFinish = {
      id: 'burgundy',
      name: 'Burgundy',
      slug: 'burgundy',
      group: 'Limited',
      color_hex: '#5B1E28',
      in_stock: true,
      extra_price: 35000,
      thumbnail: 'https://media.exacoat.com/Burgundy-Texture-Thumbnail.jpg',
    };
    dict.set('burgundy', burg);
  }

  if (!dict.has('titanium') && !dict.has('titaniumplus')) {
    const tit: GlobalFinish = {
      id: 'titanium-plus',
      name: 'Titanium+',
      slug: 'titanium-plus',
      group: 'Limited',
      color_hex: '#8E8D8A',
      in_stock: true,
      extra_price: 35000,
      thumbnail: 'https://media.exacoat.com/Titanium-Plus-Texture-Thumbnail.jpg',
    };
    dict.set('titaniumplus', tit);
    dict.set('titanium', tit);
  }

  // Check localStorage for runtime custom finishes
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem('exacoat_finishes_inventory_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed.forEach((f: GlobalFinish) => {
            if (f?.slug) dict.set(normalizeSkinSlug(f.slug), f);
            if (f?.name) dict.set(normalizeSkinSlug(f.name), f);
            if (f?.id) dict.set(normalizeSkinSlug(f.id), f);
          });
        }
      }
    } catch {
      // ignore
    }
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

  // 1. Inspect item.parsed_configurator
  if (Array.isArray(item.parsed_configurator) && item.parsed_configurator.length > 0) {
    // Priority A: Explicitly isBaseSkinLayer or primary group or is_required
    for (const l of item.parsed_configurator) {
      const lName = String(l.layer_name || l.name || '').trim();
      const cName = String((l as any).choice_name || (l as any).choice_title || l.name || '').trim();
      const lGroup = String((l as any).group || (l as any).layer_group || '').toLowerCase();
      const isReq = Boolean((l as any).is_required);

      if (isReq || lGroup === 'primary' || isBaseSkinLayer(lName, lGroup)) {
        if (cName && !/^(custom|default|none|select|false)$/i.test(cName)) {
          selectedFinishName = cName;
          matchedLayerName = lName || 'Base Skin';
          layerGroup = lGroup;
          break;
        }
      }
    }

    // Priority B: If no explicit base layer matched, take layer 0 (primary base skin in studio)
    if (!selectedFinishName && item.parsed_configurator.length > 0) {
      const first = item.parsed_configurator[0];
      const lName = String(first.layer_name || first.name || '').trim();
      const cName = String((first as any).choice_name || (first as any).choice_title || first.name || '').trim();
      // Ensure layer 0 is not an obvious accent
      if (!/\b(camera|accent|logo|frame|side|hinge|lens)\b/i.test(lName)) {
        if (cName && !/^(custom|default|none|select|false)$/i.test(cName)) {
          selectedFinishName = cName;
          matchedLayerName = lName || 'Base Skin';
        }
      }
    }
  }

  // 2. Inspect item.meta_data configurator raw structures if parsed_configurator was empty
  if (!selectedFinishName && Array.isArray((item as any).meta_data)) {
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
        for (const v of cfgList) {
          if (!v || typeof v !== 'object') continue;
          const lData = v.layer_data || {};
          const lName = String(lData.layer_name || lData.name || v.layer_name || v.name || '').trim();
          const lGroup = String(lData.group || v.group || '').toLowerCase();
          const isReq = Boolean(lData.is_required || v.is_required);
          const cName = String(
            lData.name || v.choice_name || v.choice_title || v.choice || v.name || v.value || ''
          ).trim();

          if (isReq || lGroup === 'primary' || isBaseSkinLayer(lName, lGroup)) {
            if (cName && !/^(custom|default|none|select|false)$/i.test(cName)) {
              selectedFinishName = cName;
              matchedLayerName = lName || 'Base Skin';
              layerGroup = lGroup;
              break;
            }
          }
        }
      }
    }
  }

  // 3. Inspect item.specs or extractItemSpecs
  if (!selectedFinishName) {
    const specs = Array.isArray((item as any).specs) && (item as any).specs.length > 0
      ? (item as any).specs
      : extractItemSpecs(item);

    for (const s of specs) {
      const label = String(s.label || '').trim();
      const val = String(s.value || '').trim();
      if (isBaseSkinLayer(label)) {
        if (val && !/^(custom|default|none|select|false)$/i.test(val)) {
          selectedFinishName = val;
          matchedLayerName = label;
          break;
        }
      }
    }

    // Fallback in specs: check Texture / Finish / Skin / Material
    if (!selectedFinishName) {
      for (const s of specs) {
        const label = String(s.label || '').trim().toLowerCase();
        const val = String(s.value || '').trim();
        if (['texture', 'finish', 'skin', 'material'].includes(label)) {
          if (val && !/^(custom|default|none|select|false)$/i.test(val)) {
            selectedFinishName = val;
            matchedLayerName = s.label;
            break;
          }
        }
      }
    }
  }

  // 4. Fallback: Check if item title explicitly contains a known finish name
  if (!selectedFinishName) {
    const cleanTitle = (item.name || '').toLowerCase();
    for (const [normKey, finish] of finishesDict.entries()) {
      if (normKey.length < 4) continue; // Avoid tiny accidental matches
      const finishNameLower = finish.name.toLowerCase();
      if (cleanTitle.includes(finishNameLower)) {
        selectedFinishName = finish.name;
        matchedLayerName = 'Product Title';
        break;
      }
    }
  }

  if (!selectedFinishName) {
    return null;
  }

  // Resolve metadata for the detected finish
  const normChoice = normalizeSkinSlug(selectedFinishName);
  const matchedFinish = finishesDict.get(normChoice);

  const finalName = matchedFinish?.name || selectedFinishName;
  const finalSlug = matchedFinish?.slug || normChoice;
  const finalGroup = matchedFinish?.group || (layerGroup === 'primary' ? 'Signature skins' : 'Other');
  const colorHex = matchedFinish?.color_hex || '#3f3f46';
  const thumbnailUrl = matchedFinish?.thumbnail || matchedFinish?.texture_big_url;

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
 * Main Aggregator: Computes comprehensive base skin performance statistics
 */
export function aggregateSkinPerformance(
  orders: Order[],
  startMs: number,
  endMs: number
): SkinPerformanceReport {
  const finishesDict = buildKnownFinishesDictionary();

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

  // Accumulators per skin
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

  let totalBaseSkinsSold = 0;
  let totalRevenueIdr = 0;
  const ordersWithBaseSkins = new Set<number | string>();

  // Process revenue-valid orders
  orders.forEach((order) => {
    if (!isRevenueOrder(order)) return;

    const orderDateKey = getStoreDateKey(order.created_at) || '';
    const timelineEntry = timelineMap.get(orderDateKey);
    const rawItems = (Array.isArray(order.items) && order.items.length > 0)
      ? order.items
      : (Array.isArray(order.line_items) ? order.line_items : []);

    let orderHasBaseSkin = false;

    rawItems.forEach((item) => {
      const extracted = extractBaseSkinFromOrderItem(item, finishesDict);
      if (!extracted) return;

      orderHasBaseSkin = true;
      const key = extracted.skinSlug;
      const units = extracted.quantity;
      const itemRevIdr = extracted.unitPriceIdr * units;

      totalBaseSkinsSold += units;
      totalRevenueIdr += itemRevIdr;

      // Update timeline
      if (timelineEntry) {
        timelineEntry.totalUnits += units;
        timelineEntry.totalRevenue += itemRevIdr;
        timelineEntry.topSkins[extracted.skinName] = (timelineEntry.topSkins[extracted.skinName] || 0) + units;
      }

      // Update skin accumulator
      let skinEntry = skinMap.get(key);
      if (!skinEntry) {
        skinEntry = {
          slug: extracted.skinSlug,
          name: extracted.skinName,
          group: extracted.skinGroup,
          colorHex: extracted.colorHex || '#52525b',
          thumbnailUrl: extracted.thumbnailUrl,
          unitsSold: 0,
          orderIds: new Set(),
          grossRevenueIdr: 0,
          devicesMap: new Map(),
          dailyMap: new Map(),
        };
        skinMap.set(key, skinEntry);
      }

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

  // Transform skinMap into sorted array
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

  // Sort primarily by units sold desc
  skins.sort((a, b) => b.unitsSold - a.unitsSold);

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

  const topSkinByVolume = skins.length > 0 ? skins[0] : null;
  const topSkinByRevenue = skins.length > 0 ? [...skins].sort((a, b) => b.grossRevenueIdr - a.grossRevenueIdr)[0] : null;

  const averageOrderValueIdr =
    ordersWithBaseSkins.size > 0 ? Math.round(totalRevenueIdr / ordersWithBaseSkins.size) : 0;

  return {
    totalBaseSkinsSold,
    totalOrdersWithBaseSkins: ordersWithBaseSkins.size,
    totalRevenueIdr,
    averageOrderValueIdr,
    uniqueSkinsCount: skins.length,
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
