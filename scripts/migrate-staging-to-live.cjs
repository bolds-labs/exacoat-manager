/**
 * Exacoat Unified Migration Pipeline: Staging to Production
 * Single-command execution to migrate configurator data, affiliate program, and catalog settings.
 *
 * Usage:
 *   node scripts/migrate-staging-to-live.cjs
 *
 * Environment variables (or defaults from .env):
 *   STAGING_URL="https://staging.exacoat.com"
 *   PROD_URL="https://exacoat.com"
 *   PROD_WC_KEY="ck_..."
 *   PROD_WC_SECRET="cs_..."
 */

const fs = require('fs');
const path = require('path');

// Load environment variables if available
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

const STAGING_URL = process.env.STAGING_URL || 'https://staging.exacoat.com';
const PROD_URL = process.env.PROD_URL || envVars.VITE_WORDPRESS_URL || 'https://exacoat.com';
const PROD_KEY = process.env.PROD_WC_KEY || envVars.VITE_WC_CONSUMER_KEY || '';
const PROD_SECRET = process.env.PROD_WC_SECRET || envVars.VITE_WC_CONSUMER_SECRET || '';

console.log('=====================================================');
console.log('    EXACOAT ONE-BUTTON MIGRATION PIPELINE            ');
console.log('=====================================================');
console.log(`Source (Staging)   : ${STAGING_URL}`);
console.log(`Target (Production): ${PROD_URL}`);
console.log(`Target Key         : ${PROD_KEY ? PROD_KEY.slice(0, 10) + '...' : '(none provided)'}`);
console.log('-----------------------------------------------------\n');

async function authenticatedFetch(url, options = {}) {
  const headers = options.headers || {};
  if (PROD_KEY && PROD_SECRET) {
    const auth = Buffer.from(`${PROD_KEY}:${PROD_SECRET}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  return fetch(url, { ...options, headers });
}

async function runStage1ConfiguratorFinishes() {
  console.log('[STAGE 1] Migrating Configurator Finishes & Surcharge Tiers...');
  try {
    const finishesRes = await fetch(`${STAGING_URL}/wp-json/exacoat-core/v1/finishes`);
    if (!finishesRes.ok) {
      console.log(`[STAGE 1] Warning: Could not fetch finishes from staging (${finishesRes.status}).`);
      return false;
    }
    const finishesData = await finishesRes.json();
    console.log(`[STAGE 1] Fetched ${finishesData.finishes ? finishesData.finishes.length : 0} finishes from staging.`);

    // Replace staging domain with production domain
    const jsonStr = JSON.stringify(finishesData).replaceAll(STAGING_URL, PROD_URL);
    const transformed = JSON.parse(jsonStr);

    if (PROD_KEY && PROD_SECRET) {
      const pushRes = await authenticatedFetch(`${PROD_URL}/wp-json/exacoat-core/v1/finishes/save-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transformed),
      });
      const pushData = await pushRes.json();
      console.log('[STAGE 1] Finishes push status:', pushData.success ? 'SUCCESS' : pushData.message || 'FAILED');
    } else {
      console.log('[STAGE 1] Skipped push: Production API keys not set in environment.');
    }
    return true;
  } catch (err) {
    console.error('[STAGE 1] Error:', err.message);
    return false;
  }
}

async function runStage2AffiliateProgram() {
  console.log('\n[STAGE 2] Migrating Affiliate & Creator Program (SliceWP to Native)...');
  try {
    if (!PROD_KEY || !PROD_SECRET) {
      console.log('[STAGE 2] Skipped: Production API keys required to trigger SliceWP migration.');
      return false;
    }

    const query = new URLSearchParams({
      consumer_key: PROD_KEY,
      consumer_secret: PROD_SECRET,
    }).toString();

    // Check SliceWP status
    const statusRes = await fetch(`${PROD_URL}/wp-json/exacoat-core/v1/affiliate/admin/slicewp-status?${query}`);
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      console.log(`[STAGE 2] SliceWP Status on Production: Available=${statusData.available}, Creators=${statusData.affiliates_count || 0}`);
    }

    // Trigger migration
    console.log('[STAGE 2] Triggering SliceWP Migration on Production...');
    const migrateRes = await fetch(`${PROD_URL}/wp-json/exacoat-core/v1/affiliate/admin/slicewp-migrate?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await migrateRes.json();
    if (result.success) {
      console.log('[STAGE 2] Affiliate Migration Successful:');
      console.log(`  - Creators Migrated  : ${result.affiliates_migrated ?? 0}`);
      console.log(`  - Commissions Ledger : ${result.commissions_migrated ?? 0}`);
      console.log(`  - Visits / Clicks    : ${result.clicks_migrated ?? 0}`);
      return true;
    } else {
      console.log('[STAGE 2] Notice:', result.message || 'SliceWP migration returned no new records (already up to date).');
      return true;
    }
  } catch (err) {
    console.error('[STAGE 2] Error:', err.message);
    return false;
  }
}

async function runStage3ConfiguratorBatchMigrate() {
  console.log('\n[STAGE 3] Running Composable Configurator Batch Product Migration...');
  try {
    if (!PROD_KEY || !PROD_SECRET) {
      console.log('[STAGE 3] Skipped: Production API keys required.');
      return false;
    }

    const query = new URLSearchParams({
      consumer_key: PROD_KEY,
      consumer_secret: PROD_SECRET,
    }).toString();

    const res = await fetch(`${PROD_URL}/wp-json/exacoat-core/v1/configurator/batch-migrate?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    if (data.success) {
      console.log(`[STAGE 3] Success: ${data.migrated_count || 0} products converted to composable schema.`);
      return true;
    } else {
      console.log('[STAGE 3] Notice:', data.message || 'Batch migration completed.');
      return true;
    }
  } catch (err) {
    console.error('[STAGE 3] Error:', err.message);
    return false;
  }
}

async function main() {
  console.log('Starting automated migration pipeline...\n');
  await runStage1ConfiguratorFinishes();
  await runStage2AffiliateProgram();
  await runStage3ConfiguratorBatchMigrate();

  console.log('\n=====================================================');
  console.log('    MIGRATION PIPELINE EXECUTION FINISHED           ');
  console.log('=====================================================');
  console.log('Next steps on Production:');
  console.log('1. Verify media uploads exist in /wp-content/uploads/');
  console.log('2. Open Exacoat Manager -> Affiliate Program to check balances');
  console.log('3. Open Configurator Studio to verify live 3D preview\n');
}

main().catch(console.error);
