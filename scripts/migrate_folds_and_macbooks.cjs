const https = require('https');

const auth = Buffer.from('ck_d3c2e9b67aa61b8c189dc89d7b99974002420cec:cs_c0ff3f48991c0c0a66cb5c7b14749cbc0f6a5b52').toString('base64');
const baseUrl = 'https://staging.exacoat.com';

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

const FOLDABLE_IDS = [
  541968, 541967, 533484, 533193, 520760, 520758,
  481777, 481776, 425069, 425055, 340020, 338149
];

const MACBOOK_PRO_GROUP_A = [
  539617, 539616, 522632, 522631, 487221, 487220,
  478363, 478362, 404017, 363437
];

const MACBOOK_AIR_GROUP_B = [
  540353, 526097, 514521, 446406, 446405, 446404, 446403,
  428962, 428961, 428960, 428959, 311842, 311583, 311534, 311533
];

const MACBOOK_NEO = [542139];

const MASKS_GROUP_A = {
  top: 'https://staging.exacoat.com/wp-content/uploads/Macbook-Pro-M1-2021-Skins-Matte-Black.png',
  bottom: 'https://staging.exacoat.com/wp-content/uploads/Macbook-Pro-M1-2021-Bottom-Skins-Matte-Black.png',
  trackpad: 'https://staging.exacoat.com/wp-content/uploads/Macbook-Pro-M1-2021-Trackpad-Skins-Matte-Black.png'
};

const MASKS_GROUP_B = {
  top: 'https://staging.exacoat.com/wp-content/uploads/Macbook-Pro-Skins-Matte-Black-New.png',
  bottom: 'https://staging.exacoat.com/wp-content/uploads/Macbook-Pro-Bottom-Skins-Matte-Black-New.png',
  trackpad: 'https://staging.exacoat.com/wp-content/uploads/Macbook-Pro-Trackpad-Skins-Matte-Black-New.png'
};

async function processFoldable(productId) {
  console.log(`[FOLDABLE] Processing #${productId}...`);
  const fetchRes = await request(`${baseUrl}/wp-json/exacoat-core/v1/configurator/${productId}`);
  if (!fetchRes.body || !fetchRes.body.profile) {
    console.error(`[FOLDABLE] #${productId} failed to fetch:`, fetchRes.status);
    return false;
  }

  const profile = fetchRes.body.profile;

  // 1. Remove Model 360 entirely
  if (!profile.coverage_and_cutouts) {
    profile.coverage_and_cutouts = {};
  }
  profile.coverage_and_cutouts.coverage_type = 'model_cut_only';
  profile.coverage_and_cutouts.has_model_cut = true;
  profile.coverage_and_cutouts.model_360_extra_price = 0;

  // 2. Adjust presets
  if (Array.isArray(profile.presets)) {
    profile.presets = profile.presets.map((preset) => {
      if (preset.coverage === 'model_360') {
        return { ...preset, coverage: 'model_cut' };
      }
      return preset;
    });
  }

  // 3. Remove generated 3D directional shading
  if (Array.isArray(profile.views)) {
    profile.views = profile.views.map((v) => ({
      ...v,
      generated_shadow: { enabled: false }
    }));
  }

  const saveRes = await request(`${baseUrl}/wp-json/exacoat-core/v1/configurator/save`, {
    method: 'POST'
  }, {
    product_id: productId,
    ...profile
  });

  const success = Boolean(saveRes.body && saveRes.body.success);
  console.log(`[FOLDABLE] #${productId} (${profile.device_name || profile.name}) save:`, success ? 'SUCCESS' : saveRes.body || saveRes.status);
  return success;
}

async function processMacBook(productId, maskGroup) {
  console.log(`[MACBOOK] Processing #${productId}...`);
  const fetchRes = await request(`${baseUrl}/wp-json/exacoat-core/v1/configurator/${productId}`);
  if (!fetchRes.body || !fetchRes.body.profile) {
    console.error(`[MACBOOK] #${productId} failed to fetch:`, fetchRes.status);
    return false;
  }

  const profile = fetchRes.body.profile;

  // 1. Disable generated 3D directional shading on all views
  if (Array.isArray(profile.views)) {
    profile.views = profile.views.map((v) => ({
      ...v,
      generated_shadow: { enabled: false }
    }));
  }

  // 2. Apply alpha masks to layers
  if (Array.isArray(profile.layers) && maskGroup) {
    profile.layers = profile.layers.map((layer) => {
      const layerId = (layer.id || '').toLowerCase();
      const layerName = (layer.name || '').toLowerCase();

      let targetMask = '';
      let targetViewId = '';

      if (layerId === 'top' || layerName.includes('top')) {
        targetMask = maskGroup.top;
        targetViewId = 'top_view';
      } else if (layerId === 'bottom' || layerName.includes('bottom')) {
        targetMask = maskGroup.bottom;
        targetViewId = 'bottom_view';
      } else if (layerId === 'trackpad' || layerName.includes('trackpad')) {
        targetMask = maskGroup.trackpad;
        targetViewId = 'trackpad_view';
      }

      if (targetMask) {
        const assetsByView = { ...(layer.assets_by_view || {}) };
        if (!assetsByView[targetViewId]) {
          assetsByView[targetViewId] = {};
        }
        assetsByView[targetViewId] = {
          ...assetsByView[targetViewId],
          mask_svg_url: targetMask
        };

        // Also ensure layer has mask_svg_url
        return {
          ...layer,
          mask_svg_url: targetMask,
          assets_by_view: assetsByView
        };
      }

      return layer;
    });
  }

  const saveRes = await request(`${baseUrl}/wp-json/exacoat-core/v1/configurator/save`, {
    method: 'POST'
  }, {
    product_id: productId,
    ...profile
  });

  const success = Boolean(saveRes.body && saveRes.body.success);
  console.log(`[MACBOOK] #${productId} (${profile.device_name || profile.name}) save:`, success ? 'SUCCESS' : saveRes.body || saveRes.status);
  return success;
}

async function main() {
  console.log('=== Starting Foldable & MacBook Migrations ===\n');

  console.log('--- 1. Migrating 12 Foldable & Flip Devices ---');
  for (const id of FOLDABLE_IDS) {
    await processFoldable(id);
    await sleep(250);
  }

  console.log('\n--- 2. Migrating 10 Group A MacBook Pros (M1-2021 & M3 Body) ---');
  for (const id of MACBOOK_PRO_GROUP_A) {
    await processMacBook(id, MASKS_GROUP_A);
    await sleep(250);
  }

  console.log('\n--- 3. Migrating 15 Group B MacBook Airs & Pros (Top-New) ---');
  for (const id of MACBOOK_AIR_GROUP_B) {
    await processMacBook(id, MASKS_GROUP_B);
    await sleep(250);
  }

  console.log('\n--- 4. Migrating MacBook Neo (Disable Directional Shading) ---');
  for (const id of MACBOOK_NEO) {
    await processMacBook(id, null);
    await sleep(250);
  }

  console.log('\n=== All migrations completed! ===');
}

main().catch(console.error);
