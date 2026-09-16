const https = require('https');

function testEndpoint(url) {
  const t0 = Date.now();
  https.get(url, { timeout: 10000 }, res => {
    console.log(`[${res.statusCode}] ${url} in ${Date.now() - t0}ms`);
  }).on('error', err => {
    console.log(`[ERR] ${url}: ${err.message} in ${Date.now() - t0}ms`);
  }).on('timeout', () => {
    console.log(`[TIMEOUT] ${url} > 10000ms`);
  });
}

testEndpoint('https://analytics.artmatter.co/api/script.js');
testEndpoint('https://node.exacoat.com');