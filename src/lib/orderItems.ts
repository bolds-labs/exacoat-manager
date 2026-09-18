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

    const signature = `${cleanLabel.toLowerCase()}:${cleanVal.toLowerCase()}`;
    if (!seen.has(signature)) {
      seen.add(signature);
      specs.push({ label: cleanLabel, value: cleanVal });
    }
  };

  // 1. Check parsed_configurator
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

  // 2. Check formatted_meta
  if (specs.length === 0 && Array.isArray(item.formatted_meta) && item.formatted_meta.length > 0) {
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

  // 3. Check meta_data
  if (specs.length === 0 && Array.isArray(item.meta_data) && item.meta_data.length > 0) {
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

    if (specs.length === 0) {
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

  // 4. Check item.meta string (e.g. Back: Swarm • Camera: Black Camo)
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

  // 5. Fallback device model if present
  if (specs.length === 0 && item.device_model) {
    addSpec('Model', String(item.device_model).trim());
  }

  return specs;
}

export function formatItemSpecsSummary(item: any): string {
  const specs = extractItemSpecs(item);
  if (specs.length === 0) return '';
  return specs.map(s => `${s.label}: ${s.value}`).join(' • ');
}
