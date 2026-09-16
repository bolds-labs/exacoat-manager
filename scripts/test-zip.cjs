const https = require('https');

https.get('https://manager.artmatter.co/artmatter-core-v7.0.42.zip', { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  console.log(`[${res.statusCode}] https://manager.artmatter.co/artmatter-core-v7.0.42.zip`);
  console.log('Content-Length:', res.headers['content-length']);
  console.log('Content-Type:', res.headers['content-type']);
});