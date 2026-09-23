const https = require('https');

const auth = Buffer.from('ck_d3c2e9b67aa61b8c189dc89d7b99974002420cec:cs_c0ff3f48991c0c0a66cb5c7b14749cbc0f6a5b52').toString('base64');

function request(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Authorization': 'Basic ' + auth } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(e.message + ' ' + data.slice(0, 100)));
        }
      });
    }).on('error', reject);
  });
}

function testUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
      res.resume();
    }).on('error', () => resolve(500));
  });
}

async function main() {
  console.log('=== VERIFYING GALAXY TABS AND IPADS ON STAGING REST API ===\n');

  const catalogRes = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/profiles?per_page=300');
  const profiles = catalogRes.profiles || [];

  const galaxyTabs = profiles.filter(p =>
    p.name.toLowerCase().includes('galaxy tab') || p.name.toLowerCase().includes('book cover')
  );

  const ipads = profiles.filter(p =>
    p.name.toLowerCase().includes('ipad')
  );

  console.log(`Checking ${galaxyTabs.length} Galaxy Tabs & Book Covers:`);
  let tabErrors = 0;
  for (const item of galaxyTabs) {
    const isUltra = item.name.toLowerCase().includes('ultra');
    const expectedScale = isUltra ? 1.10 : 1.20;

    const full = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/' + item.product_id);
    const p = full.profile || full;

    const profileScaleMatch = Math.abs((p.texture_scale || 0) - expectedScale) < 0.001;
    const viewsScaleMatch = (p.views || []).every(v => Math.abs((v.texture_scale || 0) - expectedScale) < 0.001);

    if (profileScaleMatch && viewsScaleMatch) {
      console.log(`  [OK] ${item.product_id} ${item.name} -> scale: ${Math.round(expectedScale * 100)}% (views: ${p.views?.map(v => v.texture_scale).join(', ')})`);
    } else {
      console.error(`  [FAIL] ${item.product_id} ${item.name} -> expected: ${expectedScale}, got profile: ${p.texture_scale}, views: ${p.views?.map(v => v.texture_scale).join(', ')}`);
      tabErrors++;
    }
  }

  console.log(`\nChecking ${ipads.length} iPads & Keyboards:`);
  let ipadErrors = 0;
  for (const item of ipads) {
    const expectedScale = 1.20;

    const full = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/' + item.product_id);
    const p = full.profile || full;

    const profileScaleMatch = Math.abs((p.texture_scale || 0) - expectedScale) < 0.001;
    const viewsScaleMatch = (p.views || []).every(v => Math.abs((v.texture_scale || 0) - expectedScale) < 0.001);

    const maskChecks = [];
    for (const l of p.layers || []) {
      if (l.id === 'accents' && item.product_id === 311643) continue; // 2018 iPad has no physical accent cut
      const viewKeys = Object.keys(l.assets_by_view || {});
      for (const vk of viewKeys) {
        // Only inspect the relevant view for this layer
        const isApplicable =
          (l.id === 'back' && (vk === 'main_view' || vk === 'view')) ||
          ((l.id === 'sides' || l.id === 'side') && (vk === 'side_view' || vk === 'view')) ||
          (l.id === 'accents' && (vk === 'main_view' || vk === 'view')) ||
          (l.id === 'top-bottom' && (vk === 'outer_view' || vk === 'view')) ||
          (l.id === 'palm-rest' && (vk === 'inner_view')) ||
          (l.id === 'middle' && (vk === 'view'));

        if (!isApplicable) continue;

        const mask = l.assets_by_view[vk]?.mask_svg_url;
        if (mask) {
          const status = await testUrl(mask);
          maskChecks.push({ layer: l.id, view: vk, status, mask: mask.split('/').pop() });
        } else {
          maskChecks.push({ layer: l.id, view: vk, status: 0, mask: 'MISSING' });
        }
      }
    }

    const hasFailedMasks = maskChecks.some(m => m.status !== 200);

    if (profileScaleMatch && viewsScaleMatch && !hasFailedMasks) {
      console.log(`  [OK] ${item.product_id} ${item.name} -> scale: 120%, masks: [${maskChecks.map(m => m.layer + '@' + m.view + ': 200').join(', ')}]`);
    } else {
      console.error(`  [FAIL] ${item.product_id} ${item.name} -> scaleMatch: ${profileScaleMatch && viewsScaleMatch}, masks: ${JSON.stringify(maskChecks)}`);
      ipadErrors++;
    }
  }

  console.log(`\n=== VERIFICATION SUMMARY ===`);
  console.log(`Galaxy Tabs: ${galaxyTabs.length - tabErrors} / ${galaxyTabs.length} passed`);
  console.log(`iPads: ${ipads.length - ipadErrors} / ${ipads.length} passed`);

  if (tabErrors === 0 && ipadErrors === 0) {
    console.log('ALL DEVICES AND ACCESSORIES PASSED 100%!');
  } else {
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
