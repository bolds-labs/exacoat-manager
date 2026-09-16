const https = require('https');

function checkUrl(url) {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    console.log(`[${res.statusCode}] ${url}`);
    if (res.headers.location) {
      console.log(`  -> Redirect to: ${res.headers.location}`);
      checkUrl(res.headers.location);
      return;
    }
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      if (body.includes('artmatter-error-card') || body.includes('Administrator Diagnostics') || body.includes('critical error')) {
        console.log('  ❌ CRITICAL ERROR SCREEN DETECTED!');
        console.log(body.slice(0, 1000));
      } else {
        console.log(`  ✅ Successfully rendered page! Length: ${body.length} bytes`);
      }
    });
  });
}

checkUrl('https://artmatter.co/shop?HSdhasg');