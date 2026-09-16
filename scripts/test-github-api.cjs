const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'NodeJS' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function check() {
  console.log("Checking GitHub Releases:");
  const rel = await fetchUrl('https://api.github.com/repos/bolds-labs/artmatter-manager/releases');
  console.log("Releases status:", rel.status, Array.isArray(rel.data) ? `Found ${rel.data.length} releases` : rel.data);

  console.log("\nChecking Raw plugin file on main branch:");
  const raw = await fetchUrl('https://raw.githubusercontent.com/bolds-labs/artmatter-manager/main/wordpress-plugin/artmatter-core/artmatter-core.php');
  console.log("Raw status:", raw.status);
  if (raw.raw) {
    const match = raw.raw.match(/Version:\s*([0-9\.]+)/i);
    console.log("Version in main branch raw file:", match ? match[1] : 'Not found');
  }
}

check();
