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

  const specs: ItemCustomizationSpec[] = [];
  const seen = new Set<string>();

  const addSpec = (label: string, value: string) => {
    const cleanLabel = String(label || '').trim();
    const cleanVal = String(value || '').trim();
    if (!cleanLabel || !cleanVal) return;

    // Skip internal WooCommerce or WordPress keys starting with underscore
    if (cleanLabel.startsWith('_')) return;

    // Skip legacy poster keys
    if (/^(artwork_orientation|artwork_feelform|print_finish|feelform_mode|orientation|finish_type)$/i.test(cleanLabel)) {
      return;
    }

    // Skip auto or portrait relics if label is generic
    if (/^(auto|portrait)$/i.test(cleanVal) && /^(finish|orientation)$/i.test(cleanLabel)) {
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

  // 1. Check custom_addons array (prepared by backend parser)
  if (Array.isArray(item.custom_addons) && item.custom_addons.length > 0) {
    parseAddonsList(item.custom_addons);
  }

  // 2. Check parsed_configurator
  if (!hasConfiguratorSpecs() && Array.isArray(item.parsed_configurator) && item.parsed_configurator.length > 0) {
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

  // 3. Check formatted_meta
  if (!hasConfiguratorSpecs() && Array.isArray(item.formatted_meta) && item.formatted_meta.length > 0) {
    for (const m of item.formatted_meta) {
      const key = String(m.label || m.key || '').trim();
      const val = String(m.display_value || m.value || '').trim();
      if (!key || !val || key.startsWith('_')) continue;

      if (key.toLowerCase() === 'configuration') {
        const parts = val.split(/(?=Back:|Accents:|Camera:|Additional Camera:|Model:|Frame:|Trackpad:|Logo:|Coverage:)/i);
        for (const p of parts) {
          const [subKey, ...subRest] = p.split(':');
          if (subRest.length > 0 && subRest.join(':').trim()) {
            addSpec(subKey.trim(), subRest.join(':').trim());
          }
        }
      } else {
        addSpec(key, val);
      }
    }
  }

  // 4. Check meta_data (including legacy WooCommerce Product Add-ons & Acowebs WCPA)
  if (!hasConfiguratorSpecs() && Array.isArray(item.meta_data) && item.meta_data.length > 0) {
    // Check raw configurator data
    const rawConfig = item.meta_data.find((m: any) => m.key === '_configurator_data_raw' || m.key === '_configurator_data');
    if (rawConfig && rawConfig.value && Array.isArray(rawConfig.value)) {
      for (const v of rawConfig.value) {
        const layerName = v.layer_data?.layer_name || v.layer_data?.name || v.layer_name || 'Part';
        const choiceName = v.layer_data?.name || v.choice_title || v.name || '';
        if (choiceName) {
          addSpec(layerName, choiceName);
        }
      }
    }

    // Check legacy WooCommerce Custom Product Add-ons keys (e.g. Order #542240 Everything Skins)
    if (!hasConfiguratorSpecs()) {
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
    }

    if (!hasConfiguratorSpecs()) {
      for (const m of item.meta_data) {
        const key = String(m.key || '').trim();
        const val = typeof m.value === 'string' ? m.value.trim() : (m.display_value ? String(m.display_value).trim() : '');
        if (!key || !val || key.startsWith('_')) continue;

        if (key.toLowerCase() === 'configuration') {
          const parts = val.split(/(?=Back:|Accents:|Camera:|Additional Camera:|Model:|Frame:|Trackpad:|Logo:|Coverage:)/i);
          for (const p of parts) {
            const [subKey, ...subRest] = p.split(':');
            if (subRest.length > 0 && subRest.join(':').trim()) {
              addSpec(subKey.trim(), subRest.join(':').trim());
            }
          }
        } else {
          addSpec(key, val);
        }
      }
    }
  }

  // 5. Check item.meta string (e.g. Back: Swarm • Camera: Black Camo)
  if (specs.length === 0 && item.meta) {
    const parts = String(item.meta).split(/\s*(?:&bull;|•|<br\s*\/?>|\r?\n|\|)\s*/i).filter(Boolean);
    for (const p of parts) {
      const clean = p.replace(/&bull;|•/g, '').trim();
      if (!clean) continue;
      if (clean.includes(':')) {
        const [k, ...v] = clean.split(':');
        addSpec(k.trim(), v.join(':').trim());
      } else {
        addSpec('Option', clean);
      }
    }
  }

  // 6. Fallback device model if present
  if (specs.length === 0 && item.device_model) {
    addSpec('Model', String(item.device_model).trim());
  }

  return specs;
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
}

export function formatSeparatedItemSpecs(
  item: any,
  options?: { excludeKeys?: string[] }
): SeparatedItemSpecs {
  const specs = extractItemSpecs(item);
  if (specs.length === 0) return { partSpecs: '', refSpecs: '' };

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
  };
}

