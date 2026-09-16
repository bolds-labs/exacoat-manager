const https = require('https');

https.get('https://manager.artmatter.co/version.json', { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log(`[${res.statusCode}] https://manager.artmatter.co/version.json`);
    console.log(body);
  });
});