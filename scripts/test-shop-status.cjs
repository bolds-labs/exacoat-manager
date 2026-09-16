const https = require('https');

https.get('https://artmatter.co/shop/', { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
  console.log(`HTTP Status: ${res.statusCode}`);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    if (body.includes('critical error') || body.includes('Administrator Diagnostics')) {
      console.log('❌ Error screen detected in response!');
      const match = body.match(/Administrator Diagnostics:[^<]*/i);
      if (match) console.log(match[0]);
    } else {
      console.log('✅ Shop page loaded successfully without error screen!');
    }
  });
}).on('error', err => {
  console.log(`Network error: ${err.message}`);
});