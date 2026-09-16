/**
 * Artmatter - Batch Artwork Recrop to 1:1.414 (ISO A) Migration Runner
 * 
 * Usage:
 *   node scripts/recrop-all-artworks-iso-a.cjs                # Run full migration (auto-resumes if stopped)
 *   node scripts/recrop-all-artworks-iso-a.cjs --test 10106   # Test single artwork by WordPress ID
 *   node scripts/recrop-all-artworks-iso-a.cjs --limit 5      # Run next 5 artworks
 *   node scripts/recrop-all-artworks-iso-a.cjs --retry-failed # Retry failed artworks
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://vamdbdbbltxjfcrsbgsq.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const WP_API_URL = 'https://artmatter.co/wp-json/artmatter-core/v1/artwork/recrop-iso-a';

const STATE_FILE = path.join(__dirname, '.migration_ratio_state.json');

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
      console.warn('⚠️ Warning: Could not read state file, starting fresh state.');
    }
  }
  return { completed: {}, failed: {}, lastRun: null };
}

function saveState(state) {
  state.lastRun = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function fetchAllArtworks() {
  console.log('📡 Fetching catalog from Supabase...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?select=id,title,orientation,image_url,wp_id,status,metadata&order=created_at.asc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch artworks: ${res.statusText}`);
  }

  const data = await res.json();
  return data.filter(a => a.wp_id);
}

async function updateSupabaseMetadata(artworkId, currentMetadata) {
  const updatedMeta = {
    ...(currentMetadata || {}),
    aspect_ratio_standard: '1:1.414',
    ratio_v2_migrated: true,
    migrated_at: new Date().toISOString()
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/artworks?id=eq.${artworkId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ metadata: updatedMeta })
    });
    return res.ok;
  } catch (err) {
    console.warn(`[Supabase Meta Error] ${artworkId}:`, err.message);
    return false;
  }
}

function getR2KeyForArtwork(art) {
  if (art.metadata?.r2_key) return art.metadata.r2_key;
  if (art.metadata?._artmatter_r2_key) return art.metadata._artmatter_r2_key;
  if (art.image_url) {
    const match = art.image_url.match(/arts\/artists\/([^/]+)\/(.+)$/);
    if (match) {
      const artistSlug = match[1];
      const filename = match[2];
      const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
      return `arts-master/artists/${artistSlug}/${nameWithoutExt}-master.jpg`;
    }
  }
  return '';
}

async function recropArtworkOnWordPress(wpId, r2Key = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(WP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Artmatter-Ratio-Migrator/1.0'
      },
      body: JSON.stringify({ product_id: wpId, r2_key: r2Key }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { success: false, message: `Server HTTP ${res.status}: ${text.substring(0, 80)}` };
    }
    return json;
  } catch (err) {
    clearTimeout(timeout);
    return { success: false, message: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes('--test');
  const testIdIndex = args.indexOf('--test');
  const testWpId = isTest && testIdIndex !== -1 ? parseInt(args[testIdIndex + 1], 10) : null;

  const isLimit = args.includes('--limit');
  const limitIndex = args.indexOf('--limit');
  const maxLimit = isLimit && limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : Infinity;

  const isRetryFailed = args.includes('--retry-failed');

  console.log('\n=============================================================');
  console.log('📐 ARTMATTER RATIO MIGRATION ENGINE (1:1.414 / ISO A)');
  console.log('=============================================================\n');

  if (testWpId) {
    console.log(`🧪 TEST MODE: Processing single artwork with WordPress ID #${testWpId}...`);
    const res = await recropArtworkOnWordPress(testWpId);
    console.log('Result:', JSON.stringify(res, null, 2));
    return;
  }

  const state = loadState();
  const artworks = await fetchAllArtworks();
  console.log(`✅ Loaded ${artworks.length} total artworks from Supabase.`);

  // Filter artworks to process
  let queue = artworks.filter(art => {
    const wpIdStr = String(art.wp_id);

    // Skip trashed or physical accessory items
    if (art.status === 'trash' || art.wp_id === 12805) {
      delete state.failed[wpIdStr];
      return false;
    }

    if (isRetryFailed) {
      return state.failed[wpIdStr];
    }
    // Skip if already in state.completed and not forced
    if (state.completed[wpIdStr]) {
      return false;
    }
    // Skip if already marked in Supabase metadata
    if (art.metadata?.aspect_ratio_standard === '1:1.414' && art.metadata?.ratio_v2_migrated) {
      state.completed[wpIdStr] = {
        title: art.title,
        already_migrated: true,
        timestamp: new Date().toISOString()
      };
      return false;
    }
    return true;
  });

  if (maxLimit < queue.length) {
    queue = queue.slice(0, maxLimit);
  }

  saveState(state);

  const completedCount = Object.keys(state.completed).length;
  console.log(`📊 Status: ${completedCount} already completed, ${queue.length} in queue to process.\n`);

  if (queue.length === 0) {
    console.log('🎉 All artworks are already up to date with 1:1.414 standard ratio! No action needed.\n');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < queue.length; i++) {
    const art = queue[i];
    const wpId = art.wp_id;
    const progress = `[${i + 1}/${queue.length}]`;
    const percent = Math.round(((i + 1) / queue.length) * 100);

    process.stdout.write(`⏳ ${progress} (${percent}%) Recropping #${wpId} "${art.title}"... `);

    const r2Key = getR2KeyForArtwork(art);
    const result = await recropArtworkOnWordPress(wpId, r2Key);

    if (result && result.success) {
      successCount++;
      state.completed[String(wpId)] = {
        title: art.title,
        old_dimensions: result.old_dimensions,
        new_dimensions: result.new_dimensions,
        orientation: result.orientation,
        already_exact: result.already_exact,
        timestamp: new Date().toISOString()
      };
      delete state.failed[String(wpId)];

      // Sync Supabase metadata
      await updateSupabaseMetadata(art.id, art.metadata);

      const dimChange = result.already_exact ? '(already exact 1:1.414)' : `${result.old_dimensions} ➔ ${result.new_dimensions}`;
      console.log(`✅ OK ${dimChange}`);
    } else {
      failCount++;
      const errMsg = result?.message || 'Unknown error';
      state.failed[String(wpId)] = {
        title: art.title,
        error: errMsg,
        timestamp: new Date().toISOString()
      };
      console.log(`❌ FAILED: ${errMsg}`);
    }

    // Save state after every single artwork for bulletproof resumability
    saveState(state);

    // Minor throttle to keep server nice and cool
    await new Promise(r => setTimeout(r, 200));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=============================================================');
  console.log('🏁 MIGRATION RUN COMPLETE');
  console.log(`⏱️ Elapsed Time: ${elapsed}s`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`💾 State saved to: ${STATE_FILE}`);
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('\n💥 Fatal Migration Error:', err);
  process.exit(1);
});
