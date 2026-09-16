const https = require('https');
const http = require('http');

const urls = [
  { name: 'Storefront Homepage', url: 'https://artmatter.co/' },
  { name: 'Storefront Shop Archive', url: 'https://artmatter.co/shop/' },
  { name: 'Storefront REST API Root', url: 'https://artmatter.co/wp-json/' },
  { name: 'Artist Studio Vercel/Domain', url: 'https://artist.artmatter.co/' },
  { name: 'Manager Domain', url: 'https://manager.artmatter.co/' },
  { name: 'Supabase Auth Endpoint', url: 'https://vamdbdbbltxjfcrsbgsq.supabase.co/auth/v1/health' },
  { name: 'Supabase REST Endpoint', url: 'https://vamdbdbbltxjfcrsbgsq.supabase.co/rest/v1/' }
];

async function measureUrl(target) {
  return new Promise((resolve) => {
    const start = Date.now();
    let firstByte = null;

    const req = https.get(target.url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ArtmatterDiagnostics/1.0' } }, (res) => {
      res.once('data', () => {
        if (!firstByte) firstByte = Date.now() - start;
      });

      let totalBytes = 0;
      res.on('data', (chunk) => {
        totalBytes += chunk.length;
      });

      res.on('end', () => {
        const totalTime = Date.now() - start;
        resolve({
          name: target.name,
          url: target.url,
          status: res.statusCode,
          ttfbMs: firstByte || totalTime,
          totalMs: totalTime,
          sizeKb: (totalBytes / 1024).toFixed(2),
          error: null
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        name: target.name,
        url: target.url,
        status: 'ERROR',
        ttfbMs: null,
        totalMs: Date.now() - start,
        sizeKb: 0,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: target.name,
        url: target.url,
        status: 'TIMEOUT',
        ttfbMs: null,
        totalMs: 15000,
        sizeKb: 0,
        error: 'Timeout > 15s'
      });
    });
  });
}

async function run() {
  console.log('=== ARTMATTER NETWORK & TTFB LATENCY DIAGNOSTIC ===');
  for (const item of urls) {
    const result = await measureUrl(item);
    console.log(`[${result.status}] ${result.name} (${result.url})`);
    if (result.error) {
      console.log(`   ❌ Error: ${result.error} in ${result.totalMs}ms`);
    } else {
      console.log(`   ⏱️ TTFB: ${result.ttfbMs}ms | Total: ${result.totalMs}ms | Size: ${result.sizeKb} KB`);
    }
  }
}

run();