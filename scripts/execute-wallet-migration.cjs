const fs = require('fs');
const https = require('https');

try { require('dotenv').config(); } catch (e) {}

const ck = process.env.WC_CONSUMER_KEY || process.env.VITE_WC_CONSUMER_KEY || '';
const cs = process.env.WC_CONSUMER_SECRET || process.env.VITE_WC_CONSUMER_SECRET || '';
const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64');

const PLAN_FILE = 'scripts/wallet-migration-plan.json';
const PROGRESS_FILE = 'scripts/wallet-migration-progress.json';

const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });

function postEntry(userId, amount, note) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      user_id: userId,
      amount: amount,
      type: 'increase',
      action: 'admin_increase',
      note: note,
    });

    const req = https.request('https://cms.exacoat.com/wp-json/wc-store-credits/v1/entries', {
      method: 'POST',
      agent: agent,
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, statusCode: res.statusCode, data: j });
          } else {
            resolve({ success: false, statusCode: res.statusCode, error: j.message || data });
          }
        } catch {
          resolve({ success: false, statusCode: res.statusCode, error: data.slice(0, 150) });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout' });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(PLAN_FILE)) {
    console.error('Plan file not found:', PLAN_FILE);
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
  console.log('Loaded migration plan:', plan.totalUsers, 'users, total value: Rp', plan.grandTotalIdr.toLocaleString('id-ID'));
  console.log('Target Expiry:', plan.expiryDateStr);

  let progress = { completed: {}, failed: {} };
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`Resuming with ${Object.keys(progress.completed).length} already completed.`);
    } catch {}
  }

  const itemsToProcess = plan.items.filter(item => !progress.completed[item.userId]);
  console.log(`Remaining items to process: ${itemsToProcess.length}`);

  const CONCURRENCY = 5;
  let successCount = Object.keys(progress.completed).length;
  let failCount = Object.keys(progress.failed).length;

  for (let i = 0; i < itemsToProcess.length; i += CONCURRENCY) {
    const chunk = itemsToProcess.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async (item) => {
      let attempts = 0;
      let ok = false;
      let lastErr = '';

      while (attempts < 3 && !ok) {
        attempts++;
        const res = await postEntry(item.userId, item.amountIdr, item.note);
        if (res.success) {
          ok = true;
          progress.completed[item.userId] = {
            amountIdr: item.amountIdr,
            currency: item.currency,
            migratedAt: new Date().toISOString(),
          };
          delete progress.failed[item.userId];
          successCount++;
        } else {
          lastErr = res.error || `HTTP ${res.statusCode}`;
          if (attempts < 3) {
            await new Promise(r => setTimeout(r, 1000 * attempts));
          }
        }
      }

      if (!ok) {
        progress.failed[item.userId] = {
          amountIdr: item.amountIdr,
          error: lastErr,
          failedAt: new Date().toISOString(),
        };
        failCount++;
      }
    }));

    // Save progress periodically
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

    const pct = (((successCount + failCount) / plan.totalUsers) * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${successCount}/${plan.totalUsers} (${pct}%) | Failed: ${failCount}`);
  }

  console.log('\n\n=== MIGRATION COMPLETED ===');
  console.log('Total Successfully Migrated:', successCount);
  console.log('Total Failed:', failCount);
}

main();
