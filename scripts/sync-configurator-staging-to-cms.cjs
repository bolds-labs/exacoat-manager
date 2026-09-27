/**
 * Sync Configurator Profiles & Finishes from Staging to Production CMS
 *
 * Safely copies:
 * 1. Global Finishes, Groups, and Surcharge Tiers
 * 2. All 249 Product Configurator Profiles (layers, masks, scales, size multipliers)
 * Rewrites https://staging.exacoat.com URLs to the production CMS/Media URL.
 * 
 * Usage:
 *   node scripts/sync-configurator-staging-to-cms.cjs
 *
 * Environment variables (or defaults):
 *   STAGING_URL="https://staging.exacoat.com"
 *   PROD_URL="https://cms.exacoat.com"
 *   PROD_WC_KEY="ck_..."
 *   PROD_WC_SECRET="cs_..."
 */

const fs = require('fs');
const path = require('path');

// Load .env if present
const envPath = path.join(__dirname, '../.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envVars[key] = val;
      }
    }
  }
}

const STAGING_URL = (process.env.STAGING_URL || 'https://staging.exacoat.com').replace(/\/$/, '');
const PROD_URL = (process.env.PROD_URL || envVars.VITE_WORDPRESS_URL || 'https://cms.exacoat.com').replace(/\/$/, '');
const PROD_KEY = process.env.PROD_WC_KEY || envVars.VITE_WC_CONSUMER_KEY || '';
const PROD_SECRET = process.env.PROD_WC_SECRET || envVars.VITE_WC_CONSUMER_SECRET || '';

console.log('===============================================================');
console.log('   EXACOAT CONFIGURATOR SYNC PIPELINE (STAGING -> CMS)       ');
console.log('===============================================================');
console.log(`Source Staging   : ${STAGING_URL}`);
console.log(`Target CMS       : ${PROD_URL}`);
console.log(`Consumer Key     : ${PROD_KEY ? PROD_KEY.slice(0, 10) + '...' : '(none provided)'}`);
console.log('---------------------------------------------------------------\n');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function authenticatedFetch(url, options = {}) {
  const headers = options.headers || {};
  if (PROD_KEY && PROD_SECRET) {
    const auth = Buffer.from(`${PROD_KEY}:${PROD_SECRET}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  return fetch(url, { ...options, headers });
}

async function syncFinishes() {
  console.log('[STEP 1/2] Syncing Global Finishes & Surcharge Tiers...');
  try {
    const res = await fetch(`${STAGING_URL}/wp-json/exacoat-core/v1/finishes`);
    if (!res.ok) {
      console.error(`Failed to fetch finishes from staging: HTTP ${res.status}`);
      return false;
    }
    const data = await res.json();
    console.log(`Fetched ${data.finishes ? data.finishes.length : 0} finishes and ${(data.surcharge_tiers || []).length} surcharge tiers.`);

    // Rewrite staging URLs to target CMS URL
    const transformedStr = JSON.stringify(data).replaceAll(STAGING_URL, PROD_URL);
    const transformed = JSON.parse(transformedStr);

    if (!PROD_KEY || !PROD_SECRET) {
      console.log('Skipped push: PROD_WC_KEY / PROD_WC_SECRET not configured.');
      return false;
    }

    const pushRes = await authenticatedFetch(`${PROD_URL}/wp-json/exacoat-core/v1/finishes/save-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transformed),
    });

    const pushJson = await pushRes.json();
    if (pushJson.success) {
      console.log('✓ Successfully saved all finishes & surcharge tiers to target CMS.');
      return true;
    } else {
      console.error('Failed saving finishes:', pushJson.message || pushJson);
      return false;
    }
  } catch (err) {
    console.error('Error syncing finishes:', err.message);
    return false;
  }
}

async function syncProductProfiles() {
  console.log('\n[STEP 2/2] Syncing All Product Configurator Profiles...');
  try {
    // 1. Fetch catalog summary from staging
    const catalogRes = await fetch(`${STAGING_URL}/wp-json/exacoat-core/v1/configurator/profiles?per_page=500`);
    if (!catalogRes.ok) {
      console.error(`Failed fetching catalog from staging: HTTP ${catalogRes.status}`);
      return false;
    }
    const catalogData = await catalogRes.json();
    const profiles = catalogData.profiles || [];
    console.log(`Found ${profiles.length} total products on staging catalog.`);

    if (!PROD_KEY || !PROD_SECRET) {
      console.log('Skipped push: PROD_WC_KEY / PROD_WC_SECRET not configured.');
      return false;
    }

    let successCount = 0;
    let skippedCount = 0;
    let failCount = 0;

    for (let i = 0; i < profiles.length; i++) {
      const item = profiles[i];
      const pid = item.product_id;

      // Fetch full profile from staging
      try {
        const fullRes = await fetch(`${STAGING_URL}/wp-json/exacoat-core/v1/configurator/${pid}`);
        if (!fullRes.ok) {
          skippedCount++;
          continue;
        }

        const fullData = await fullRes.json();
        const profile = fullData.profile;
        if (!profile || !profile.layers || profile.layers.length === 0) {
          skippedCount++;
          continue;
        }

        // Rewrite URLs inside profile to point to target CMS
        const profileStr = JSON.stringify(profile).replaceAll(STAGING_URL, PROD_URL);
        const transformedProfile = JSON.parse(profileStr);

        // Save to target CMS
        const saveRes = await authenticatedFetch(`${PROD_URL}/wp-json/exacoat-core/v1/configurator/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: pid,
            profile: transformedProfile,
          }),
        });

        const saveJson = await saveRes.json();
        if (saveJson.success) {
          successCount++;
          process.stdout.write(`\r[${i + 1}/${profiles.length}] Synced #${pid} (${item.name.slice(0, 30)}): ${profile.layers.length} layers ✓`);
        } else {
          failCount++;
          console.log(`\nFailed saving #${pid} (${item.name}):`, saveJson.message || 'Error');
        }
      } catch (err) {
        failCount++;
        console.log(`\nError on #${pid}:`, err.message);
      }

      await sleep(50); // slight pause to respect rate limits
    }

    console.log('\n\n---------------------------------------------------------------');
    console.log(`Profiles Sync Completed: ${successCount} synced, ${skippedCount} skipped (no custom layers), ${failCount} errors.`);
    console.log('---------------------------------------------------------------');
    return true;
  } catch (err) {
    console.error('Error syncing profiles:', err.message);
    return false;
  }
}

async function main() {
  await syncFinishes();
  await syncProductProfiles();
}

main().catch(console.error);
