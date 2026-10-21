const https = require('https');

const CMS_BASE = 'https://cms.exacoat.com';
const CMS_KEY = 'ck_ad7c742000ec2eb56acb45c99e4b3c9fb6676cb6';
const CMS_SECRET = 'cs_277bf1ad64d2f3c6cd3b4e3837a62fe5a49d0712';

const STAGING_BASE = 'https://staging.exacoat.com';
const STAGING_KEY = 'ck_d3c2e9b67aa61b8c189dc89d7b99974002420cec';
const STAGING_SECRET = 'cs_c0ff3f48991c0c0a66cb5c7b14749cbc0f6a5b52';

const PIXEL_PRODUCT_IDS = [
  521051, // Google Pixel 8a Skins
  520802, // Google Pixel 8 Skins
  520798, // Google Pixel 8 Pro Skins
  479459, // Google Pixel 7 Skins
  479461, // Google Pixel 7 Pro Skins
  390013, // Google Pixel 6 Skins
  389683  // Google Pixel 6 Pro Skins
];

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      req.write(payload);
    }
    req.end();
  });
}

async function updatePixelCoverage() {
  console.log('===============================================================');
  console.log('   UPDATING ALL GOOGLE PIXEL VARIANTS TO MODEL CUT ONLY        ');
  console.log('===============================================================\n');

  for (const pid of PIXEL_PRODUCT_IDS) {
    console.log(`\n--> Processing Product #${pid}...`);

    // 1. Fetch current profile from cms.exacoat.com
    const getUrl = `${CMS_BASE}/wp-json/exacoat-core/v1/configurator/${pid}?consumer_key=${CMS_KEY}&consumer_secret=${CMS_SECRET}`;
    const getRes = await request(getUrl);
    if (getRes.status !== 200 || !getRes.data?.profile) {
      console.error(`[FAIL] Could not fetch profile for #${pid}: HTTP ${getRes.status}`);
      continue;
    }

    const profile = getRes.data.profile;
    console.log(`    Found: "${profile.device_name}" (${profile.device_slug})`);
    console.log(`    Previous Coverage: ${profile.coverage_and_cutouts?.coverage_type || 'none'} | 360 Extra: IDR ${profile.coverage_and_cutouts?.model_360_extra_price ?? 0}`);

    // 2. Set strictly model_cut_only, has_model_cut: true, model_360_extra_price: 0
    if (!profile.coverage_and_cutouts) {
      profile.coverage_and_cutouts = {};
    }
    profile.coverage_and_cutouts.coverage_type = 'model_cut_only';
    profile.coverage_and_cutouts.has_model_cut = true;
    profile.coverage_and_cutouts.model_360_extra_price = 0;

    // Clean any presets with model_360 coverage
    if (Array.isArray(profile.presets)) {
      profile.presets.forEach(pr => {
        if (pr.coverage === 'model_360') {
          pr.coverage = 'model_cut';
        }
      });
    }

    // 3. Save profile to cms.exacoat.com
    const saveUrl = `${CMS_BASE}/wp-json/exacoat-core/v1/configurator/save?consumer_key=${CMS_KEY}&consumer_secret=${CMS_SECRET}`;
    const saveRes = await request(saveUrl, { method: 'POST' }, profile);

    if (saveRes.status === 200 && saveRes.data?.success) {
      console.log(`    [SUCCESS] Saved on CMS: coverage_type = "model_cut_only", model_360_extra_price = 0`);
      if (saveRes.data?.revalidation?.nextjs) {
        console.log(`    [REVALIDATE] Next.js ISR purge triggered for ${profile.device_slug}`);
      }
    } else {
      console.error(`    [FAIL] Failed to save on CMS #${pid}:`, saveRes.data || saveRes.raw);
    }

    // 4. Also update staging WooCommerce product meta _exacoat_configurator_profile
    try {
      const stagingWcUrl = `${STAGING_BASE}/wp-json/wc/v3/products/${pid}?consumer_key=${STAGING_KEY}&consumer_secret=${STAGING_SECRET}`;
      const stagingPatchRes = await request(stagingWcUrl, { method: 'PUT' }, {
        meta_data: [
          {
            key: '_exacoat_configurator_profile',
            value: JSON.stringify(profile)
          }
        ]
      });
      if (stagingPatchRes.status === 200) {
        console.log(`    [STAGING] Synced _exacoat_configurator_profile to staging.exacoat.com`);
      } else {
        console.warn(`    [STAGING] Notice: staging update returned HTTP ${stagingPatchRes.status}`);
      }
    } catch (err) {
      console.warn(`    [STAGING] Could not update staging meta: ${err.message}`);
    }
  }

  console.log('\n===============================================================');
  console.log('   VERIFYING ALL GOOGLE PIXEL VARIANTS ON CMS                  ');
  console.log('===============================================================\n');

  for (const pid of PIXEL_PRODUCT_IDS) {
    const verifyUrl = `${CMS_BASE}/wp-json/exacoat-core/v1/configurator/${pid}?consumer_key=${CMS_KEY}&consumer_secret=${CMS_SECRET}`;
    const verifyRes = await request(verifyUrl);
    const p = verifyRes.data?.profile;
    console.log(`Device #${pid} (${p?.device_name}):`);
    console.log(`  coverage_type: ${p?.coverage_and_cutouts?.coverage_type}`);
    console.log(`  has_model_cut: ${p?.coverage_and_cutouts?.has_model_cut}`);
    console.log(`  model_360_extra_price: ${p?.coverage_and_cutouts?.model_360_extra_price}`);
  }

  console.log('\nDone!');
}

updatePixelCoverage().catch(console.error);
