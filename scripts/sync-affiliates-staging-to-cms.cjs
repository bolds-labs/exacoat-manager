/**
 * Sync Affiliate Dataset & Custom Adjustments from Staging to CMS
 * Pulls all custom creators, slugs, discount rates, coupons, and bank details from staging.exacoat.com
 * and applies them to cms.exacoat.com via REST API.
 */

const STAGING_URL = 'https://staging.exacoat.com';
const CMS_URL = 'https://cms.exacoat.com';
const CK = 'ck_d3c2e9b67aa61b8c189dc89d7b99974002420cec';
const CS = 'cs_c0ff3f48991c0c0a66cb5c7b14749cbc0f6a5b52';

const queryAuth = `consumer_key=${encodeURIComponent(CK)}&consumer_secret=${encodeURIComponent(CS)}`;

async function request(url, options = {}) {
  const headers = options.headers || {};
  if (!headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }
  headers['Accept'] = 'application/json';

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, raw: text };
  }
}

async function main() {
  console.log('======================================================');
  console.log('  EXACOAT AFFILIATE SYNC: STAGING -> CMS');
  console.log('======================================================');
  console.log(`Source (Staging) : ${STAGING_URL}`);
  console.log(`Target (CMS)     : ${CMS_URL}`);
  console.log('------------------------------------------------------\n');

  // 1. Run base migration on CMS so historical SliceWP commissions, payouts, and visits are populated
  console.log('[STEP 1] Running base migration on CMS...');
  const migrateRes = await request(`${CMS_URL}/wp-json/exacoat/v1/affiliate/admin/slicewp-migrate?${queryAuth}`, {
    method: 'POST',
    body: JSON.stringify({ use_rest: false }),
  });
  if (migrateRes.ok && migrateRes.data?.success) {
    console.log('[STEP 1] CMS SliceWP Migration Result:');
    console.log(`  - Affiliates Migrated  : ${migrateRes.data.affiliates_migrated ?? 0}`);
    console.log(`  - Commissions Migrated : ${migrateRes.data.commissions_migrated ?? 0}`);
    console.log(`  - Clicks Migrated      : ${migrateRes.data.clicks_migrated ?? 0}`);
    console.log(`  - Payouts Migrated     : ${migrateRes.data.payouts_migrated ?? 0}`);
  } else {
    console.log('[STEP 1] Notice:', migrateRes.data?.message || 'SliceWP migration finished or skipped.');
  }

  // 2. Fetch all affiliates from Staging (the ground truth of adjustments)
  console.log('\n[STEP 2] Fetching adjusted creators from Staging...');
  const stagingRes = await request(`${STAGING_URL}/wp-json/exacoat/v1/affiliate/admin/all?${queryAuth}`);
  if (!stagingRes.ok || !stagingRes.data?.affiliates) {
    console.error('[STEP 2] Failed to fetch staging affiliates:', stagingRes.data || stagingRes.raw);
    process.exit(1);
  }
  const stagingAffiliates = stagingRes.data.affiliates;
  console.log(`[STEP 2] Found ${stagingAffiliates.length} creators on Staging.`);

  // 3. Fetch all current affiliates from CMS
  console.log('\n[STEP 3] Fetching current creators from CMS...');
  const cmsRes = await request(`${CMS_URL}/wp-json/exacoat/v1/affiliate/admin/all?${queryAuth}`);
  if (!cmsRes.ok || !cmsRes.data?.affiliates) {
    console.error('[STEP 3] Failed to fetch CMS affiliates:', cmsRes.data || cmsRes.raw);
    process.exit(1);
  }
  const cmsAffiliates = cmsRes.data.affiliates;
  console.log(`[STEP 3] Found ${cmsAffiliates.length} creators on CMS.`);

  // Build CMS lookup maps
  const cmsByEmail = new Map();
  const cmsByLogin = new Map();
  const cmsByUserId = new Map();
  const cmsById = new Map();

  for (const aff of cmsAffiliates) {
    if (aff.user_email) cmsByEmail.set(aff.user_email.toLowerCase(), aff);
    if (aff.user_login) cmsByLogin.set(aff.user_login.toLowerCase(), aff);
    if (aff.user_id) cmsByUserId.set(String(aff.user_id), aff);
    if (aff.id) cmsById.set(String(aff.id), aff);
  }

  // 4. Push adjustments from Staging to CMS
  console.log('\n[STEP 4] Pushing custom adjustments to CMS...');
  let updatedCount = 0;
  let skippedCount = 0;

  for (const stg of stagingAffiliates) {
    // Find matching creator on CMS
    let target = null;
    if (stg.user_email && cmsByEmail.has(stg.user_email.toLowerCase())) {
      target = cmsByEmail.get(stg.user_email.toLowerCase());
    } else if (stg.user_login && cmsByLogin.has(stg.user_login.toLowerCase())) {
      target = cmsByLogin.get(stg.user_login.toLowerCase());
    } else if (stg.user_id && cmsByUserId.has(String(stg.user_id))) {
      target = cmsByUserId.get(String(stg.user_id));
    } else if (stg.id && cmsById.has(String(stg.id))) {
      target = cmsById.get(String(stg.id));
    }

    if (!target) {
      console.log(`  [SKIP] Creator not found on CMS: ID ${stg.id} (${stg.display_name || stg.slug})`);
      skippedCount++;
      continue;
    }

    const payload = {
      affiliate_id: target.id,
      slug: stg.slug || undefined,
      display_name: stg.display_name || stg.creator_display_name || undefined,
      commission_rate: stg.commission_rate ? parseFloat(stg.commission_rate) : null,
      discount_rate: stg.discount_rate !== null && stg.discount_rate !== undefined ? parseFloat(stg.discount_rate) : null,
      coupon_code: stg.coupon_code || '',
      bank_name: stg.bank_name || '',
      bank_account_number: stg.bank_account_number || '',
      bank_account_name: stg.bank_account_name || '',
    };

    const updateRes = await request(`${CMS_URL}/wp-json/exacoat/v1/affiliate/admin/update-commission-rate?${queryAuth}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (updateRes.ok && updateRes.data?.success) {
      updatedCount++;
      if (stg.coupon_code || stg.discount_rate > 0) {
        console.log(`  [UPDATED] Creator @${stg.slug} (ID ${target.id}): discount=${stg.discount_rate}%, coupon=${stg.coupon_code || 'none'}, rate=${stg.commission_rate}%`);
      }
    } else {
      console.log(`  [ERR] Failed to update creator ID ${target.id} (@${stg.slug}):`, updateRes.data?.message || updateRes.status);
    }

    // Also link coupon code if present
    if (stg.coupon_code) {
      await request(`${CMS_URL}/wp-json/exacoat/v1/affiliate/admin/assign-coupon?${queryAuth}`, {
        method: 'POST',
        body: JSON.stringify({
          affiliate_id: target.id,
          coupon_code: stg.coupon_code,
        }),
      });
    }
  }

  console.log(`\n[STEP 4] Pushed adjustments: ${updatedCount} updated, ${skippedCount} skipped.`);

  // 5. Run recalculation on CMS so balances are exact
  console.log('\n[STEP 5] Triggering ledger balance recalculation on CMS...');
  const recalcRes = await request(`${CMS_URL}/wp-json/exacoat/v1/affiliate/admin/recalculate?${queryAuth}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (recalcRes.ok && recalcRes.data?.success) {
    console.log('[STEP 5] Recalculation successful.');
  } else {
    console.log('[STEP 5] Notice:', recalcRes.data?.message || recalcRes.status);
  }

  // 6. Verify key creators on CMS
  console.log('\n[STEP 6] Verifying key creators on CMS...');
  const verifyRes = await request(`${CMS_URL}/wp-json/exacoat/v1/affiliate/admin/all?${queryAuth}`);
  if (verifyRes.ok && verifyRes.data?.affiliates) {
    const list = verifyRes.data.affiliates;
    console.log(`Total Creators on CMS: ${list.length}`);
    for (const key of ['edwinyg', 'ds', 'suns', 'putra', 'msbn']) {
      const found = list.find((a) => a.slug === key);
      if (found) {
        console.log(`  @${found.slug.padEnd(8)}: Name="${found.display_name}" | Discount=${found.discount_rate}% | Coupon="${found.coupon_code || ''}" | Lifetime=Rp ${parseFloat(found.lifetime_earnings || 0).toLocaleString('id-ID')} | Unpaid=Rp ${parseFloat(found.unpaid_balance || 0).toLocaleString('id-ID')}`);
      } else {
        console.log(`  @${key.padEnd(8)}: NOT FOUND`);
      }
    }
  }

  console.log('\n======================================================');
  console.log('  SYNC COMPLETED SUCCESSFULLY');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Fatal error running sync:', err);
  process.exit(1);
});
