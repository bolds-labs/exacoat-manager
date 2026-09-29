/**
 * Utility functions for extracting precision skin attributes and configurator layers
 * from WooCommerce order items (e.g. Back: Swarm, Camera: Black Camo).
 */

export interface ItemCustomizationSpec {
  label: string;
  value: string;
}

export function extractItemSpecs(item: any): ItemCustomizationSpec[] {
  if (!item) return [];

  // Early return if structured specs are already present on the item
  if (Array.isArray(item.specs) && item.specs.length > 0) {
    const list: ItemCustomizationSpec[] = [];
    const localSeen = new Set<string>();
    for (const s of item.specs) {
      const lbl = String(s?.label || '').trim();
      const val = String(s?.value || '').trim();
      if (!lbl || !val || lbl.startsWith('_')) continue;
      if (lbl.toLowerCase() === 'configuration' && /^(custom|default|none)$/i.test(val)) continue;
      const sig = `${lbl.toLowerCase()}:${val.toLowerCase()}`;
      if (!localSeen.has(sig)) {
        localSeen.add(sig);
        list.push({ label: lbl, value: val });
      }
    }
    if (list.length > 0) {
      return sortItemSpecs(list);
    }
  }

  const specs: ItemCustomizationSpec[] = [];
  const seen = new Set<string>();

  const addSpec = (label: string, value: string) => {
    const cleanLabel = String(label || '').trim();
    const cleanVal = String(value || '').trim();
    if (!cleanLabel || !cleanVal) return;

    // Skip internal WooCommerce or WordPress keys starting with underscore
    if (cleanLabel.startsWith('_')) return;

    // Skip image urls, composite previews, and thumbnails
    if (/^(image_url|image|composite_url|composite_image|thumbnail_url|rendered_preview|configurator_image)$/i.test(cleanLabel)) {
      return;
    }

    // Skip any value that is an absolute web or image URL
    if (/^https?:\/\//i.test(cleanVal)) {
      return;
    }

    // Skip legacy poster keys
    if (/^(artwork_orientation|artwork_feelform|print_finish|feelform_mode|orientation|finish_type)$/i.test(cleanLabel)) {
      return;
    }

    // Skip auto or portrait relics if label is generic
    if (/^(auto|portrait)$/i.test(cleanVal) && /^(finish|orientation)$/i.test(cleanLabel)) {
      return;
    }

    // Skip placeholder configuration: custom relics
    if (cleanLabel.toLowerCase() === 'configuration' && /^(custom|default|none)$/i.test(cleanVal)) {
      return;
    }

    // Strip legacy price adjustments like (+Rp 0) or (+Rp 25.000)
    const normalizedVal = cleanVal.replace(/\s*\(\+[^)]+\)\s*$/i, '').trim();
    if (!normalizedVal) return;

    const signature = `${cleanLabel.toLowerCase()}:${normalizedVal.toLowerCase()}`;
    if (!seen.has(signature)) {
      seen.add(signature);
      specs.push({ label: cleanLabel, value: normalizedVal });
    }
  };

  // Helper to parse legacy addons objects or arrays (e.g. WooCommerce Custom Product Add-ons / Acowebs)
  const parseAddonsList = (list: any) => {
    if (!list) return;
    let target = list;
    if (typeof target === 'string') {
      try {
        target = JSON.parse(target);
      } catch {
        return;
      }
    }
    if (Array.isArray(target)) {
      for (const entry of target) {
        if (!entry) continue;
        const lbl = entry.label || entry.name || entry.title || entry.fieldName || '';
        let val = entry.value || entry.display_value || entry.displayValue || '';
        if (typeof val === 'object' && val !== null) {
          val = val.label || val.value || val.name || JSON.stringify(val);
        }
        if (lbl && val) {
          addSpec(String(lbl), String(val));
        }
      }
    } else if (typeof target === 'object') {
      for (const [k, v] of Object.entries(target)) {
        if (!k.startsWith('_') && typeof v === 'string' && v.trim()) {
          addSpec(k, v);
        }
      }
    }
  };

  // Helper to parse joined configuration strings (e.g. Back: Shadow Camo • Sides: Matte White)
  const parseConfigurationString = (val: string) => {
    if (!val || typeof val !== 'string') return;
    const cleanVal = val.trim();
    if (!cleanVal || /^(custom|default|none)$/i.test(cleanVal)) return;

    // Split on bullet (• or &bull;), newline, HTML break, or pipe
    let parts = cleanVal.split(/\s*(?:&bull;|•|<br\s*\/?>|\r?\n|\|)\s*/i).filter(Boolean);

    // Fallback if no bullet/newline delimiter was used but contains multiple "Key: Val" tokens
    if (parts.length === 1 && (cleanVal.match(/:/g) || []).length > 1) {
      const splitByLookahead = cleanVal.split(/(?=[A-Za-z0-9\s_-]+:\s*)/i).filter(Boolean);
      if (splitByLookahead.length > 1) {
        parts = splitByLookahead;
      }
    }

    // Marketplace bundle / title format e.g.
    // "1x [EXACOAT] iPad Pro 11" (2022, M2) Premium 3M Skin / Garskin : Matte White | Side skin only | Wifi + Cellular"
    const hasMarketplacePattern = /\[EXACOAT\]|garskin|premium.*skin|\d+x\s+\[/i.test(cleanVal);
    if (hasMarketplacePattern && cleanVal.includes('|')) {
      let detectedFinish = '';
      let detectedCoverage = '';
      const otherTokens: string[] = [];

      for (const p of parts) {
        const trimmed = p.replace(/^[•\s&bull;]+|[•\s&bull;]+$/g, '').trim();
        if (!trimmed) continue;

        if (/side.*skin.*only|side.*only/i.test(trimmed)) {
          detectedCoverage = 'side';
        } else if (/back.*skin.*only|back.*only/i.test(trimmed)) {
          detectedCoverage = 'back';
        } else if (/full.*body|back.*\+.*side/i.test(trimmed)) {
          detectedCoverage = 'both';
        } else if (trimmed.includes(':')) {
          const colonIdx = trimmed.indexOf(':');
          const valPart = trimmed.substring(colonIdx + 1).trim();
          if (valPart && !/^(custom|default|none)$/i.test(valPart)) {
            detectedFinish = valPart;
          }
          const keyPart = trimmed.substring(0, colonIdx).trim();
          // Extract hardware model name from keyPart, e.g. iPad Pro 11, iPad Pro 12.9
          const modelMatch = keyPart.match(/(?:iPad|Surface|MacBook|Galaxy Tab|Steam Deck|PlayStation|Xbox|ROG Ally)[A-Za-z0-9\s"'\.,\(\)]+/i);
          if (modelMatch) {
            const cleanModel = modelMatch[0].replace(/['"\(\)]+/g, '').replace(/,\s*M\d+/i, '').replace(/\b20\d\d\b/g, '').trim();
            if (cleanModel) {
              otherTokens.push(cleanModel);
            }
          }
        } else {
          otherTokens.push(trimmed);
        }
      }

      if (detectedFinish) {
        if (detectedCoverage === 'side') {
          addSpec('Sides', detectedFinish);
        } else if (detectedCoverage === 'both') {
          addSpec('Back', detectedFinish);
          addSpec('Sides', detectedFinish);
        } else {
          addSpec('Back', detectedFinish);
        }
      }

      for (const token of otherTokens) {
        if (/wifi|cellular|celullar|5g|lte/i.test(token)) {
          addSpec('Connectivity', token);
        } else if (/iPad|Surface|MacBook|Tab|Deck|PlayStation|Series/i.test(token)) {
          addSpec('Series', token);
        } else {
          addSpec('Option', token);
        }
      }
      return;
    }

    for (const p of parts) {
      const trimmed = p.replace(/^[•\s&bull;]+|[•\s&bull;]+$/g, '').trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const subKey = trimmed.substring(0, colonIdx).trim();
        const subVal = trimmed.substring(colonIdx + 1).trim();
        if (subKey && subVal) {
          addSpec(subKey, subVal);
        }
      } else if (!/^(custom|default|none)$/i.test(trimmed)) {
        addSpec('Part', trimmed);
      }
    }
  };

  // 0. Prioritize Warranty Replacement & RMA keys so production immediately sees what part to cut
  if (Array.isArray(item.meta_data) && item.meta_data.length > 0) {
    const priorityWarrantyKeys = [
      'claimed part',
      'part to produce',
      'original invoice',
      'original order',
      'original channel',
      'variation',
      'shopee note',
      'buyer note',
    ];
    for (const pKey of priorityWarrantyKeys) {
      const match = item.meta_data.find(
        (m: any) => String(m.label || m.key || '').trim().toLowerCase() === pKey
      );
      if (match) {
        const val = match.display_value || match.value;
        if (val && typeof val === 'string' && val.trim()) {
          addSpec(match.key || match.label, val.trim());
        }
      }
    }
    const partNoteMeta = item.meta_data.find((m: any) => m.key === '_claimed_part_note')?.value;
    if (partNoteMeta && typeof partNoteMeta === 'string' && partNoteMeta.trim()) {
      addSpec('Claimed Part', partNoteMeta.trim());
    }
  }

  // Count specs found so far before checking regular configurator/product attributes
  const hasConfiguratorSpecs = () => specs.some(s => !['claimed part', 'part to produce', 'original invoice', 'original order', 'original channel', 'variation', 'shopee note', 'buyer note'].includes(s.label.toLowerCase()));

  // 1. Check parsed_configurator first (exact configurator layer choices)
  if (Array.isArray(item.parsed_configurator) && item.parsed_configurator.length > 0) {
    for (const c of item.parsed_configurator) {
      const layer = String(c.layer_name || c.name || '').trim();
      const choice = String(c.choice_name || c.choice_title || c.name || '').trim();
      if (layer && choice && layer.toLowerCase() !== choice.toLowerCase()) {
        addSpec(layer, choice);
      } else if (choice) {
        addSpec('Part', choice);
      }
    }
  }

  // 2. Check raw configurator data in meta_data if parsed_configurator wasn't present
  if (!hasConfiguratorSpecs() && Array.isArray(item.meta_data) && item.meta_data.length > 0) {
    const rawConfig = item.meta_data.find((m: any) => m.key === '_configurator_data_raw' || m.key === '_configurator_data');
    if (rawConfig && rawConfig.value && Array.isArray(rawConfig.value)) {
      for (const v of rawConfig.value) {
        const layerName = v.layer_data?.layer_name || v.layer_data?.name || v.layer_name || 'Part';
        const choiceName = v.layer_data?.name || v.choice_title || v.choice_name || v.name || '';
        if (choiceName) {
          addSpec(layerName, choiceName);
        }
      }
    }
  }

  // 3. Check formatted_meta
  if (!hasConfiguratorSpecs() && Array.isArray(item.formatted_meta) && item.formatted_meta.length > 0) {
    for (const m of item.formatted_meta) {
      const key = String(m.label || m.key || '').trim();
      const val = String(m.display_value || m.value || '').trim();
      if (!key || !val || key.startsWith('_')) continue;

      if (key.toLowerCase() === 'configuration') {
        parseConfigurationString(val);
      } else {
        addSpec(key, val);
      }
    }
  }

  // 4. Check custom_addons array (prepared by backend parser)
  if (Array.isArray(item.custom_addons) && item.custom_addons.length > 0) {
    parseAddonsList(item.custom_addons);
  }

  // 5. Check meta_data (including legacy WooCommerce Product Add-ons & Acowebs WCPA)
  if (!hasConfiguratorSpecs() && Array.isArray(item.meta_data) && item.meta_data.length > 0) {
    // Check legacy WooCommerce Custom Product Add-ons keys (e.g. Order #542240 Everything Skins)
    for (const m of item.meta_data) {
      const key = String(m.key || '').trim().toLowerCase();
      if (
        key === '_wcpa_order_meta_data' ||
        key === 'wcpa_data' ||
        key === '_pao_addon_values' ||
        key === 'addons' ||
        key === '_addons' ||
        key === '_custom_product_addons'
      ) {
        parseAddonsList(m.value);
      }
    }

    if (!hasConfiguratorSpecs()) {
      for (const m of item.meta_data) {
        const key = String(m.key || '').trim();
        const val = typeof m.value === 'string' ? m.value.trim() : (m.display_value ? String(m.display_value).trim() : '');
        if (!key || !val || key.startsWith('_')) continue;

        if (key.toLowerCase() === 'configuration') {
          parseConfigurationString(val);
        } else {
          addSpec(key, val);
        }
      }
    }
  }

  // 6. Check item.meta string (e.g. Back: Swarm • Camera: Black Camo)
  if (specs.length === 0 && item.meta) {
    parseConfigurationString(String(item.meta));
  }

  // 7. Fallback device model if present
  if (specs.length === 0 && item.device_model) {
    addSpec('Model', String(item.device_model).trim());
  }

  return sortItemSpecs(specs);
}

export function sortItemSpecs(specs: ItemCustomizationSpec[]): ItemCustomizationSpec[] {
  if (!Array.isArray(specs) || specs.length <= 1) return specs || [];

  return [...specs].sort((a, b) => {
    const nameA = a.label.toLowerCase().trim();
    const nameB = b.label.toLowerCase().trim();

    // Priority warranty and reference keys always stay at the top if present
    const isWarrantyA = /^(claimed part|part to produce|original invoice|original order|original channel|variation|shopee note|buyer note)$/i.test(nameA);
    const isWarrantyB = /^(claimed part|part to produce|original invoice|original order|original channel|variation|shopee note|buyer note)$/i.test(nameB);
    if (isWarrantyA && !isWarrantyB) return -1;
    if (!isWarrantyA && isWarrantyB) return 1;

    // Priority Production Variants (Series, Connectivity, Model, Hardware Edition) right after warranty
    const isHardwareA = /^(series|connectivity|model|edition|hardware|device model)$/i.test(nameA);
    const isHardwareB = /^(series|connectivity|model|edition|hardware|device model)$/i.test(nameB);
    if (isHardwareA && !isHardwareB) return -1;
    if (!isHardwareA && isHardwareB) return 1;

    // 1. Back skin / primary base layer ALWAYS on top
    const isBackA = nameA.includes('back') && !nameA.includes('camera') && !nameA.includes('glass');
    const isBackB = nameB.includes('back') && !nameB.includes('camera') && !nameB.includes('glass');
    if (isBackA && !isBackB) return -1;
    if (!isBackA && isBackB) return 1;

    const isPrimaryA =
      nameA.includes('top lid') ||
      nameA.includes('main body') ||
      nameA === 'skin' ||
      nameA === 'body' ||
      nameA === 'base' ||
      nameA === 'device';
    const isPrimaryB =
      nameB.includes('top lid') ||
      nameB.includes('main body') ||
      nameB === 'skin' ||
      nameB === 'body' ||
      nameB === 'base' ||
      nameB === 'device';
    if (isPrimaryA && !isPrimaryB) return -1;
    if (!isPrimaryA && isPrimaryB) return 1;

    // 2. Trailing option layers: Coverage, Logo Cutout, Stylus Cutout
    const isCoverageA = nameA.includes('coverage');
    const isCoverageB = nameB.includes('coverage');
    const isLogoA = nameA.includes('logo');
    const isLogoB = nameB.includes('logo');
    const isStylusA = nameA.includes('pencil') || nameA.includes('stylus') || nameA.includes('s-pen');
    const isStylusB = nameB.includes('pencil') || nameB.includes('stylus') || nameB.includes('s-pen');

    const rankA = isCoverageA ? 100 : isLogoA ? 101 : isStylusA ? 102 : 10;
    const rankB = isCoverageB ? 100 : isLogoB ? 101 : isStylusB ? 102 : 10;

    if (rankA !== rankB) return rankA - rankB;

    return 0;
  });
}

export function formatItemSpecsSummary(item: any, options?: { excludeKeys?: string[] }): string {
  const specs = extractItemSpecs(item);
  if (specs.length === 0) return '';
  const excludeList = (options?.excludeKeys || ['part', 'device', 'device type']).map(k => k.toLowerCase());
  const filtered = specs.filter(s => !excludeList.includes(s.label.trim().toLowerCase()));
  return filtered.map(s => `${s.label}: ${s.value}`).join(' • ');
}

export interface SeparatedItemSpecs {
  partSpecs: string;
  refSpecs: string;
  partList: ItemCustomizationSpec[];
  refList: ItemCustomizationSpec[];
}

export function formatSeparatedItemSpecs(
  item: any,
  options?: { excludeKeys?: string[] }
): SeparatedItemSpecs {
  const specs = extractItemSpecs(item);
  if (specs.length === 0) return { partSpecs: '', refSpecs: '', partList: [], refList: [] };

  const refKeys = ['original invoice', 'original order', 'original channel'];
  const excludeList = (options?.excludeKeys || ['part', 'device', 'device type']).map(k => k.toLowerCase());

  const filtered = specs.filter(s => !excludeList.includes(s.label.trim().toLowerCase()));

  const refList = filtered.filter(s => refKeys.includes(s.label.trim().toLowerCase()));
  const partList = filtered.filter(s => !refKeys.includes(s.label.trim().toLowerCase()));

  // Order ref list so Channel appears before Invoice / Order ID
  refList.sort((a, b) => {
    const aIsChannel = a.label.toLowerCase().includes('channel');
    const bIsChannel = b.label.toLowerCase().includes('channel');
    if (aIsChannel && !bIsChannel) return -1;
    if (!aIsChannel && bIsChannel) return 1;
    return 0;
  });

  return {
    partSpecs: partList.map(s => `${s.label}: ${s.value}`).join(' • '),
    refSpecs: refList.map(s => `${s.label}: ${s.value}`).join(' • '),
    partList,
    refList,
  };
}

export function cleanItemTitle(name?: string): string {
  if (!name) return '';
  return name.replace(/\[\s*EXACOAT\s*\]\s*/gi, '').trim();
}

