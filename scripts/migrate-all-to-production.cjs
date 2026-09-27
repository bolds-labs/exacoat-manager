/**
 * Exacoat Master Staging to Production Migration Pipeline
 *
 * Migrates:
 * 1. All Exacoat Core Settings (Shipping carriers, store & currency, Pushover, Cloudflare, prompts)
 * 2. Global Finishes, Groups, and Surcharge Tiers
 * 3. All 249 Product Configurator Profiles (layers, masks, scales, size multipliers)
 * Rewrites https://staging.exacoat.com to https://media.exacoat.com for all media assets.
 *
 * Usage:
 *   node scripts/migrate-all-to-production.cjs
 */

const fs = require('fs');
const path = require('path');

const STAGING_URL = 'https://staging.exacoat.com';
const STAGING_KEY = 'ck_d3c2e9b67aa61b8c189dc89d7b99974002420cec';
const STAGING_SECRET = 'cs_c0ff3f48991c0c0a66cb5c7b14749cbc0f6a5b52';

const PROD_URL = process.env.PROD_URL || 'https://cms.exacoat.com';
const PROD_KEY = process.env.PROD_WC_KEY || 'ck_ad7c742000ec2eb56acb45c99e4b3c9fb6676cb6';
const PROD_SECRET = process.env.PROD_WC_SECRET || 'cs_277bf1ad64d2f3c6cd3b4e3837a62fe5a49d0712';
const MEDIA_URL = process.env.MEDIA_URL || 'https://media.exacoat.com';

console.log('===============================================================');
console.log('       EXACOAT MASTER STAGING -> CMS MIGRATION PIPELINE        ');
console.log('===============================================================');
console.log(`Source Staging   : ${STAGING_URL}`);
console.log(`Target CMS       : ${PROD_URL}`);
console.log(`Media CDN Host   : ${MEDIA_URL}`);
console.log(`Consumer Key     : ${PROD_KEY.slice(0, 12)}...`);
console.log('---------------------------------------------------------------\n');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stagingAuthHeaders() {
  const auth = Buffer.from(`${STAGING_KEY}:${STAGING_SECRET}`).toString('base64');
  return { 'Authorization': `Basic ${auth}` };
}

function prodAuthHeaders() {
  const auth = Buffer.from(`${PROD_KEY}:${PROD_SECRET}`).toString('base64');
  return { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
}

// Transform URLs from staging to media domain
function transformMediaUrls(obj) {
  const str = JSON.stringify(obj);
  // Replace staging.exacoat.com with media.exacoat.com
  const replaced = str.replaceAll(STAGING_URL, MEDIA_URL);
  return JSON.parse(replaced);
}

// 1. Migrate Plugin Settings (Shipping, Currency, Pushover, Cloudflare, AI Prompts)
async function migrateSettings() {
  console.log('[STAGE 1/3] Migrating Exacoat Core Settings...');
  try {
    const res = await fetch(`${STAGING_URL}/wp-json/exacoat-core/v1/settings`, {
      headers: stagingAuthHeaders(),
    });
    if (!res.ok) {
      console.error(`Failed to fetch settings from staging: HTTP ${res.status}`);
      return false;
    }
    const data = await res.json();
    const settings = data.settings || {};
    console.log(`Fetched settings from staging (${Object.keys(settings).length} config keys).`);

    // Clean up or adjust any URLs in settings
    const transformed = transformMediaUrls(settings);

    // Push to Production CMS
    const pushRes = await fetch(`${PROD_URL}/wp-json/exacoat-core/v1/settings`, {
      method: 'POST',
      headers: prodAuthHeaders(),
      body: JSON.stringify(transformed),
    });

    const pushJson = await pushRes.json();
    if (pushJson.success) {
      console.log('✓ Successfully migrated all Exacoat Core settings to Production CMS.');
      return true;
    } else {
      console.error('Failed saving settings:', pushJson.message || pushJson);
      return false;
    }
  } catch (err) {
    console.error('Error in migrateSettings:', err.message);
    return false;
  }
}

// 2. Migrate Global Finishes, Groups, and Surcharge Tiers
async function migrateFinishes() {
  console.log('\n[STAGE 2/3] Migrating Global Finishes & Surcharge Tiers...');
  try {
    const res = await fetch(`${STAGING_URL}/wp-json/exacoat-core/v1/finishes`);
    if (!res.ok) {
      console.error(`Failed to fetch finishes from staging: HTTP ${res.status}`);
      return false;
    }
    const data = await res.json();
    console.log(`Fetched ${data.finishes ? data.finishes.length : 0} finishes and ${(data.surcharge_tiers || []).length} surcharge tiers.`);

    const transformed = transformMediaUrls(data);

    const pushRes = await fetch(`${PROD_URL}/wp-json/exacoat-core/v1/finishes/save-all`, {
      method: 'POST',
      headers: prodAuthHeaders(),
      body: JSON.stringify(transformed),
    });

    const pushJson = await pushRes.json();
    if (pushJson.success) {
      console.log('✓ Successfully saved all finishes & surcharge tiers to Production CMS.');
      return true;
    } else {
      console.error('Failed saving finishes:', pushJson.message || pushJson);
      return false;
    }
  } catch (err) {
    console.error('Error in migrateFinishes:', err.message);
    return false;
  }
}

// 3. Migrate All 249 Product Configurator Profiles
async function migrateProductProfiles() {
  console.log('\n[STAGE 3/3] Migrating All Product Configurator Profiles...');
  try {
    const catalogRes = await fetch(`${STAGING_URL}/wp-json/exacoat-core/v1/configurator/profiles?per_page=500`);
    if (!catalogRes.ok) {
      console.error(`Failed fetching catalog from staging: HTTP ${catalogRes.status}`);
      return false;
    }
    const catalogData = await catalogRes.json();
    const profiles = catalogData.profiles || [];
    console.log(`Scanning ${profiles.length} products on staging catalog...`);

    let successCount = 0;
    let skippedCount = 0;
    let failCount = 0;

    for (let i = 0; i < profiles.length; i++) {
      const item = profiles[i];
      const pid = item.product_id;

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

        // Transform mask and texture URLs to media.exacoat.com
        const transformedProfile = transformMediaUrls(profile);

        // Save to Production CMS
        const saveRes = await fetch(`${PROD_URL}/wp-json/exacoat-core/v1/configurator/save`, {
          method: 'POST',
          headers: prodAuthHeaders(),
          body: JSON.stringify({
            ...transformedProfile,
            product_id: pid,
          }),
        });

        const saveJson = await saveRes.json();
        if (saveJson.success) {
          successCount++;
          process.stdout.write(`\r[${i + 1}/${profiles.length}] Synced #${pid} (${item.name.slice(0, 32)}): ${profile.layers.length} layers ✓`);
        } else {
          failCount++;
          console.log(`\nNotice on #${pid} (${item.name}):`, saveJson.message || 'Error saving');
        }
      } catch (err) {
        failCount++;
        console.log(`\nError on #${pid}:`, err.message);
      }

      await sleep(40);
    }

    console.log('\n\n---------------------------------------------------------------');
    console.log(`Profiles Migration Finished: ${successCount} profiles synced, ${skippedCount} items without custom layers, ${failCount} errors.`);
    console.log('---------------------------------------------------------------');
    return true;
  } catch (err) {
    console.error('Error in migrateProductProfiles:', err.message);
    return false;
  }
}

async function main() {
  const s1 = await migrateSettings();
  const s2 = await migrateFinishes();
  const s3 = await migrateProductProfiles();

  console.log('\n===============================================================');
  console.log('       MASTER MIGRATION PIPELINE EXECUTION COMPLETED            ');
  console.log('===============================================================');
}

main().catch(console.error);
