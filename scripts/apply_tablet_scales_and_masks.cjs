const https = require('https');

const auth = Buffer.from('ck_d3c2e9b67aa61b8c189dc89d7b99974002420cec:cs_c0ff3f48991c0c0a66cb5c7b14749cbc0f6a5b52').toString('base64');

function request(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Complete iPad cut mask definitions by product ID
const IPAD_MASK_CONFIG = {
  // iPad Pro 2020 (334335), M1 (334392), M2 (446933)
  334335: {
    back: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Skins-Matte-Black.png' },
    sides: { view: 'side_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Side-Matte-Black.png' },
    accents: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Accents-Matte-Black.png' }
  },
  334392: {
    back: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Skins-Matte-Black.png' },
    sides: { view: 'side_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Side-Matte-Black.png' },
    accents: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Accents-Matte-Black.png' }
  },
  446933: {
    back: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Skins-Matte-Black.png' },
    sides: { view: 'side_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Side-Matte-Black.png' },
    accents: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Accents-Matte-Black.png' }
  },
  // iPad Pro M4 (516605), M5 (539802)
  516605: {
    back: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2024-M4-Skins-Matte-Black.png' },
    sides: { view: 'side_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2024-M4-Sides-Skins-Matte-Black.png' },
    accents: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2024-M4-Accents-Matte-Black.png' }
  },
  539802: {
    back: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2024-M4-Skins-Matte-Black.png' },
    sides: { view: 'side_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2024-M4-Sides-Skins-Matte-Black.png' },
    accents: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2024-M4-Accents-Matte-Black.png' }
  },
  // iPad Air 4 / 5 (339317), M2 (521095), M3 (529234), M4 (540536)
  339317: {
    back: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Skins-Matte-Black.png' },
    side: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Side-Skins-Matte-Black.png' },
    accents: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Accents-Matte-Black.png' }
  },
  521095: {
    back: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Skins-Matte-Black.png' },
    side: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Side-Skins-Matte-Black.png' },
    accents: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Accents-Matte-Black.png' }
  },
  529234: {
    back: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Skins-Matte-Black.png' },
    side: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Side-Skins-Matte-Black.png' },
    accents: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Accents-Matte-Black.png' }
  },
  540536: {
    back: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Skins-Matte-Black.png' },
    side: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Side-Skins-Matte-Black.png' },
    accents: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Air-4-Accents-Matte-Black.png' }
  },
  // iPad Mini 6 / 7 (361082)
  361082: {
    back: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Mini-6-Skins-Matte-Black.png' },
    side: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Mini-6-Side-Matte-Black.png' },
    accents: { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Mini-6-Accents-Matte-Black.png' }
  },
  // iPad Pro 2018-2019 (311643)
  311643: {
    back: { view: 'main_view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2018-Skins-Matte-Black.png' }
  },
  // Magic Keyboard iPad Pro M4 & M5 (516583)
  516583: {
    'top-bottom': { view: 'outer_view', mask: 'https://staging.exacoat.com/wp-content/uploads/Magic-Keyboard-iPad-M4-Skins-Black-Camo.png' },
    'palm-rest': { view: 'inner_view', mask: 'https://staging.exacoat.com/wp-content/uploads/Magic-Keyboard-iPad-M4-Palm-Rest-Skins-Black-Camo.png' }
  },
  // Magic Keyboard iPad Air M2, M3, M4 (541664)
  541664: {
    'top-bottom': { view: 'outer_view', mask: 'https://staging.exacoat.com/wp-content/uploads/Magic-Keyboard-iPad-Air-Skins-Black-Camo.png' },
    'palm-rest': { view: 'inner_view', mask: 'https://staging.exacoat.com/wp-content/uploads/Magic-Keyboard-iPad-M4-Palm-Rest-Skins-Black-Camo.png' }
  },
  // Smart Keyboard Folio (446787)
  446787: {
    'top-bottom': { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/iPad-Pro-2020-Smart-Keyboard-Folio-Skins-Black-Camo.png' }
  },
  // Magic Keyboard iPad Pro M2 (362642)
  362642: {
    'top-bottom': { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/Magic-Keyboard-Skins-Black-Camo-2.png' },
    'middle': { view: 'view', mask: 'https://staging.exacoat.com/wp-content/uploads/Magic-Keyboard-Middle-Skins-Black-Camo.png' }
  }
};

async function main() {
  console.log('=== STEP 1: FETCHING ALL PROFILES FROM STAGING ===');
  const catalogRes = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/profiles?per_page=300');
  const profiles = catalogRes.body.profiles || [];
  console.log('Total profiles fetched:', profiles.length);

  // Filter Galaxy Tabs and Book Covers
  const galaxyTabs = profiles.filter(p =>
    p.name.toLowerCase().includes('galaxy tab') || p.name.toLowerCase().includes('book cover')
  );

  // Filter iPads and iPad Keyboards
  const ipads = profiles.filter(p =>
    p.name.toLowerCase().includes('ipad')
  );

  console.log('Found ' + galaxyTabs.length + ' Galaxy Tab & Book Cover products.');
  console.log('Found ' + ipads.length + ' iPad & iPad Keyboard products.');

  // Process Galaxy Tabs
  console.log('\n=== STEP 2: UPDATING GALAXY TAB & BOOK COVER SCALES ===');
  for (const item of galaxyTabs) {
    const isUltra = item.name.toLowerCase().includes('ultra');
    const targetScale = isUltra ? 1.10 : 1.20;

    console.log(`[${item.product_id}] ${item.name} -> Target scale: ${Math.round(targetScale * 100)}%`);

    const fullRes = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/' + item.product_id);
    const profile = fullRes.body.profile || fullRes.body;

    profile.product_id = item.product_id;
    profile.device_name = item.name;
    profile.device_slug = item.slug;
    profile.category = item.categories?.[0] || 'Galaxy Tab';
    profile.base_price = item.price || profile.base_price || 0;
    profile.texture_scale = targetScale;

    for (const v of profile.views || []) {
      v.texture_scale = targetScale;
    }

    const saveRes = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/save', {
      method: 'POST'
    }, profile);

    if (saveRes.body?.success) {
      console.log(`  -> Successfully saved scale ${targetScale} for [${item.product_id}]`);
    } else {
      console.error(`  -> Failed to save [${item.product_id}]:`, saveRes.body || saveRes.raw);
    }

    await sleep(200);
  }

  // Process iPads
  console.log('\n=== STEP 3: UPDATING IPAD SCALES AND POPULATING ALPHA MASKS ===');
  for (const item of ipads) {
    const targetScale = 1.20;
    console.log(`[${item.product_id}] ${item.name} -> Target scale: 120% & configuring masks...`);

    const fullRes = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/' + item.product_id);
    const profile = fullRes.body.profile || fullRes.body;

    profile.product_id = item.product_id;
    profile.device_name = item.name;
    profile.device_slug = item.slug;
    profile.category = item.categories?.[0] || 'iPad';
    profile.base_price = item.price || profile.base_price || 0;
    profile.texture_scale = targetScale;

    for (const v of profile.views || []) {
      v.texture_scale = targetScale;
    }

    // Apply masks from IPAD_MASK_CONFIG
    const maskDefs = IPAD_MASK_CONFIG[item.product_id] || {};
    for (const layer of profile.layers || []) {
      const def = maskDefs[layer.id];
      if (def) {
        if (!layer.assets_by_view) layer.assets_by_view = {};
        const targetViewId = def.view;

        if (!layer.assets_by_view[targetViewId]) {
          layer.assets_by_view[targetViewId] = {};
        }
        layer.assets_by_view[targetViewId].mask_svg_url = def.mask;
        layer.mask_svg_url = def.mask;

        // Also ensure fallback view keys have mask if only 1 view exists
        if ((profile.views || []).length === 1 && profile.views[0]?.id) {
          const singleViewId = profile.views[0].id;
          if (!layer.assets_by_view[singleViewId]) layer.assets_by_view[singleViewId] = {};
          layer.assets_by_view[singleViewId].mask_svg_url = def.mask;
        }

        console.log(`    Layer '${layer.id}' -> view '${targetViewId}' mask: ${def.mask.split('/').pop()}`);
      }
    }

    const saveRes = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/save', {
      method: 'POST'
    }, profile);

    if (saveRes.body?.success) {
      console.log(`  -> Successfully saved iPad profile for [${item.product_id}]`);
    } else {
      console.error(`  -> Failed to save iPad profile [${item.product_id}]:`, saveRes.body || saveRes.raw);
    }

    await sleep(200);
  }

  console.log('\n=== MIGRATION COMPLETE ===');
}

main().catch(console.error);
