const https = require('https');

const endpoints = [
  'https://artmatter.co/wp-json/wp/v2/posts?per_page=5',
  'https://artmatter.co/wp-json/wc/store/v1/products?per_page=5',
  'https://artmatter.co/wp-json/artmatter/v1/artists',
  'https://artmatter.co/wp-json/artmatter/v1/artworks',
  'https://artmatter.co/wp-json/artmatter/v1/diagnostics',
  'https://artmatter.co/artist-directory/',
  'https://artmatter.co/product-category/metal-posters/'
];

async function testWp() {
  console.log('=== WORDPRESS STOREFRONT LATENCY BENCHMARK ===');
  for (const url of endpoints) {
    const t0 = Date.now();
    await new Promise(resolve => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 ArtmatterSpeedTest/1.0' } }, res => {
        let len = 0;
        res.on('data', d => len += d.length);
        res.on('end', () => {
          const ms = Date.now() - t0;
          console.log(`[${res.statusCode}] ${url}`);
          console.log(`   ⏱️ Time: ${ms}ms | Payload: ${(len/1024).toFixed(1)} KB`);
          resolve();
        });
      }).on('error', err => {
        console.log(`[ERR] ${url}: ${err.message} (${Date.now() - t0}ms)`);
        resolve();
      });
    });
  }
}

testWp();