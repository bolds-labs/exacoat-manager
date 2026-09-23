const https = require('https');

const auth = Buffer.from('ck_d3c2e9b67aa61b8c189dc89d7b99974002420cec:cs_c0ff3f48991c0c0a66cb5c7b14749cbc0f6a5b52').toString('base64');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      ...options,
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(e.message + ' ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function main() {
  console.log('Fetching product 540536 from staging...');
  const res = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/540536');
  if (!res.success || !res.profile) {
    console.error('Failed to fetch profile:', res);
    process.exit(1);
  }

  const profile = res.profile;
  console.log('Current variants:', JSON.stringify(profile.variants, null, 2));

  profile.variants = [
    {
      id: 'series',
      name: 'Series',
      options: [
        {
          id: 'ipad-air-11-m4',
          name: 'iPad Air 11" (M4)',
          price_diff: 0
        },
        {
          id: 'ipad-air-13-m4',
          name: 'iPad Air 13" (M4)',
          price_diff: 40000
        }
      ]
    }
  ];

  console.log('Saving updated profile for 540536...');
  const saveRes = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/save', {
    method: 'POST',
    body: {
      product_id: 540536,
      ...profile
    }
  });

  console.log('Save result:', saveRes.success ? 'SUCCESS' : saveRes);

  console.log('Verifying saved profile...');
  const verifyRes = await request('https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/540536');
  console.log('Verified variants:', JSON.stringify(verifyRes.profile?.variants, null, 2));
}

main().catch(console.error);
