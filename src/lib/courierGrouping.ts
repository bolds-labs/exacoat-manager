/**
 * Logistics Courier Service Tier Classifier & Grouping
 * Groups marketplace logistics services into:
 * - Instant (SPX Instant, GrabExpress Instant, GoSend Instant)
 * - Same Day (GrabExpress Sameday, GoSend Sameday, Anteraja Sameday)
 * - Reguler & Express / YES (SPX Standard/Reguler, J&T Express, JNE Reguler/YES, SiCepat, Anteraja, Ninja, ID Express)
 * - Hemat & Kargo (SPX Hemat, J&T Cargo, JNE Trucking/JTR, SiCepat Gokil/HALU)
 */

export type CourierTier = 'instant' | 'sameday' | 'reguler_yes' | 'cargo' | 'cargo_hemat' | 'other';

export function classifyCourierTier(carrierRaw: string): CourierTier {
  const c = (carrierRaw || '').toLowerCase().trim();
  if (!c) return 'other';

  if (c.includes('instant') || c.includes('instan')) {
    return 'instant';
  }
  if (c.includes('sameday') || c.includes('same day') || c.includes('same-day') || c.includes('samday')) {
    return 'sameday';
  }
  // Heavy freight / cargo
  if (
    c.includes('cargo') ||
    c.includes('kargo') ||
    c.includes('trucking') ||
    c.includes('jtr') ||
    c.includes('gokil') ||
    c.includes('sentral') ||
    c.includes('dakota') ||
    c.includes('indah logistik')
  ) {
    return 'cargo';
  }
  // Reguler, Express, YES, plus Hemat & Halu
  if (
    c.includes('reguler') ||
    c.includes('regular') ||
    c.includes('standard') ||
    c.includes('standar') ||
    c.includes('yes') ||
    c.includes('best') ||
    c.includes('next day') ||
    c.includes('nextday') ||
    c.includes('hemat') ||
    c.includes('halu') ||
    c.includes('economy') ||
    c.includes('oke') ||
    c.includes('jne') ||
    c.includes('j&t') ||
    c.includes('spx') ||
    c.includes('shopee xpress') ||
    c.includes('sicepat') ||
    c.includes('anteraja') ||
    c.includes('ninja') ||
    c.includes('id express') ||
    c.includes('pos') ||
    c.includes('lion') ||
    c.includes('wahana') ||
    c.includes('tiki')
  ) {
    return 'reguler_yes';
  }
  return 'other';
}

export function buildGroupedCourierOptions<T extends { shipping_carrier?: string }>(orders: T[]) {
  const instantMap = new Map<string, { name: string; count: number }>();
  const samedayMap = new Map<string, { name: string; count: number }>();
  const regulerMap = new Map<string, { name: string; count: number }>();
  const cargoMap = new Map<string, { name: string; count: number }>();
  const otherMap = new Map<string, { name: string; count: number }>();

  let instantTotal = 0;
  let samedayTotal = 0;
  let regulerTotal = 0;
  let cargoTotal = 0;
  let otherTotal = 0;

  orders.forEach((o) => {
    const raw = (o.shipping_carrier || '').trim();
    if (!raw) return;

    const clean = raw.replace(/\s*[-:].*$/, '').trim();
    const tier = classifyCourierTier(clean);
    const key = clean.toUpperCase();

    if (tier === 'instant') {
      instantTotal++;
      const cur = instantMap.get(key) || { name: clean, count: 0 };
      cur.count++;
      instantMap.set(key, cur);
    } else if (tier === 'sameday') {
      samedayTotal++;
      const cur = samedayMap.get(key) || { name: clean, count: 0 };
      cur.count++;
      samedayMap.set(key, cur);
    } else if (tier === 'cargo' || tier === 'cargo_hemat') {
      cargoTotal++;
      const cur = cargoMap.get(key) || { name: clean, count: 0 };
      cur.count++;
      cargoMap.set(key, cur);
    } else if (tier === 'reguler_yes') {
      regulerTotal++;
      const cur = regulerMap.get(key) || { name: clean, count: 0 };
      cur.count++;
      regulerMap.set(key, cur);
    } else {
      otherTotal++;
      const cur = otherMap.get(key) || { name: clean, count: 0 };
      cur.count++;
      otherMap.set(key, cur);
    }
  });

  const options: Array<{
    value: string;
    label: string;
    count?: number;
    badge?: string;
    badgeVariant?: 'emerald' | 'amber' | 'rose' | 'zinc' | 'sky' | 'orange';
    isHeader?: boolean;
    indent?: boolean;
  }> = [
    { value: 'all', label: 'Semua Jasa Kirim', count: orders.length },
  ];

  // 1. Instant Group (only when there are orders)
  if (instantTotal > 0) {
    options.push({ isHeader: true, label: 'Layanan Instant', value: 'header:instant' });
    options.push({
      value: 'group:instant',
      label: '⚡ Semua Instant',
      count: instantTotal,
      badge: 'Grup',
      badgeVariant: 'amber',
    });
    Array.from(instantMap.entries())
      .filter(([, val]) => val.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([key, val]) => {
        options.push({
          value: key,
          label: val.name,
          count: val.count,
          indent: true,
        });
      });
  }

  // 2. Same Day Group (only when there are orders)
  if (samedayTotal > 0) {
    options.push({ isHeader: true, label: 'Layanan Same Day', value: 'header:sameday' });
    options.push({
      value: 'group:sameday',
      label: '🕒 Semua Same Day',
      count: samedayTotal,
      badge: 'Grup',
      badgeVariant: 'sky',
    });
    Array.from(samedayMap.entries())
      .filter(([, val]) => val.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([key, val]) => {
        options.push({
          value: key,
          label: val.name,
          count: val.count,
          indent: true,
        });
      });
  }

  // 3. Reguler & YES Group (including Hemat & Halu)
  if (regulerTotal > 0) {
    options.push({ isHeader: true, label: 'Reguler, Hemat & YES', value: 'header:reguler' });
    options.push({
      value: 'group:reguler_yes',
      label: '📦 Semua Reguler & YES',
      count: regulerTotal,
      badge: 'Grup',
      badgeVariant: 'zinc',
    });
    Array.from(regulerMap.entries())
      .filter(([, val]) => val.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([key, val]) => {
        options.push({
          value: key,
          label: val.name,
          count: val.count,
          indent: true,
        });
      });
  }

  // 4. Kargo Group (only when there are orders)
  if (cargoTotal > 0) {
    options.push({ isHeader: true, label: 'Layanan Kargo', value: 'header:cargo' });
    options.push({
      value: 'group:cargo',
      label: '🚛 Semua Kargo',
      count: cargoTotal,
      badge: 'Grup',
      badgeVariant: 'zinc',
    });
    Array.from(cargoMap.entries())
      .filter(([, val]) => val.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([key, val]) => {
        options.push({
          value: key,
          label: val.name,
          count: val.count,
          indent: true,
        });
      });
  }

  // 5. Other Group (only when there are orders)
  if (otherTotal > 0) {
    options.push({ isHeader: true, label: 'Lainnya', value: 'header:other' });
    Array.from(otherMap.entries())
      .filter(([, val]) => val.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([key, val]) => {
        options.push({
          value: key,
          label: val.name,
          count: val.count,
          indent: true,
        });
      });
  }

  return options;
}

export function matchesCourierFilter(carrierRaw: string | undefined, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  if (filter.startsWith('group:')) {
    const tier = filter.replace('group:', '') as CourierTier;
    const itemTier = classifyCourierTier(carrierRaw || '');
    if (tier === 'cargo' || tier === 'cargo_hemat') {
      return itemTier === 'cargo' || itemTier === 'cargo_hemat';
    }
    return itemTier === tier;
  }
  const clean = (carrierRaw || '').toUpperCase();
  return clean.includes(filter.toUpperCase());
}
