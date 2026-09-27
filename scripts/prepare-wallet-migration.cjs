const fs = require('fs');
const readline = require('readline');
const https = require('https');

try { require('dotenv').config(); } catch (e) {}

const ck = process.env.WC_CONSUMER_KEY || process.env.VITE_WC_CONSUMER_KEY || '';
const cs = process.env.WC_CONSUMER_SECRET || process.env.VITE_WC_CONSUMER_SECRET || '';
const auth = 'Basic ' + Buffer.from(`${ck}:${cs}`).toString('base64');

const wps_ck = process.env.WPS_CONSUMER_KEY || '';
const wps_cs = process.env.WPS_CONSUMER_SECRET || '';

const FALLBACK_RATES = {
  USD: 16129.03,
  EUR: 17241.38,
  GBP: 22222.22,
  AUD: 10600.00,
  SGD: 12200.00,
  CAD: 11800.00,
  JPY: 105.00,
  MYR: 3650.00,
  CHF: 18000.00,
  HKD: 2050.00,
};

function getJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { Authorization: auth, Accept: 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, text: data });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function resolveForeignCurrency(userId, rawBalance) {
  // 1. Check last WooCommerce order
  const orderRes = await getJson(`https://cms.exacoat.com/wp-json/wc/v3/orders?customer=${userId}&per_page=1`);
  if (Array.isArray(orderRes.json) && orderRes.json.length > 0) {
    const order = orderRes.json[0];
    const currency = (order.currency || 'USD').toUpperCase();
    const rateMeta = order.meta_data?.find(m => m.key === '_base_currency_exchange_rate' || m.key === '_aelia_cs_exchange_rate');
    const rate = rateMeta ? parseFloat(rateMeta.value) : (FALLBACK_RATES[currency] || 16129.03);
    const convertedIdr = Math.round(rawBalance * rate);
    return {
      currency,
      rate,
      convertedIdr,
      orderId: order.id,
      source: 'wc_order'
    };
  }

  // 2. Fallback to WPSwings transaction
  const txRes = await getJson(`https://cms.exacoat.com/wp-json/wsfw-route/v1/wallet/transactions/${userId}?consumer_key=${wps_ck}&consumer_secret=${wps_cs}`);
  if (Array.isArray(txRes.json) && txRes.json.length > 0) {
    const tx = txRes.json[0];
    const currency = (tx.currency || 'USD').toUpperCase();
    const rate = FALLBACK_RATES[currency] || 16129.03;
    const convertedIdr = Math.round(rawBalance * rate);
    return {
      currency,
      rate,
      convertedIdr,
      source: 'wps_tx'
    };
  }

  // 3. Default fallback to USD if no orders found
  const rate = FALLBACK_RATES.USD;
  return {
    currency: 'USD',
    rate,
    convertedIdr: Math.round(rawBalance * rate),
    source: 'default_usd'
  };
}

async function main() {
  const csvPath = 'C:\\Users\\shand\\Downloads\\Edge\\users_wallet.csv';
  console.log('Reading:', csvPath);

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  const idrItems = [];
  const foreignItems = [];

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isHeader) {
      isHeader = false;
      continue;
    }

    const parts = trimmed.split(',').map(s => s.replace(/["']/g, '').trim());
    if (parts.length < 2) continue;

    const userId = parseInt(parts[0], 10);
    const balance = parseFloat(parts[1]);

    if (isNaN(balance) || balance <= 0) continue;

    if (balance < 2000) {
      foreignItems.push({ userId, balance });
    } else {
      idrItems.push({ userId, balance: Math.round(balance) });
    }
  }

  console.log(`Parsed ${idrItems.length} IDR users and ${foreignItems.length} foreign currency users.`);
  console.log('Resolving foreign currencies in parallel (concurrency 5)...');

  const resolvedForeign = [];
  const concurrency = 5;

  for (let i = 0; i < foreignItems.length; i += concurrency) {
    const batch = foreignItems.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (item) => {
        const resolution = await resolveForeignCurrency(item.userId, item.balance);
        return {
          userId: item.userId,
          rawBalance: item.balance,
          ...resolution
        };
      })
    );
    resolvedForeign.push(...results);
    process.stdout.write(`\rResolved ${resolvedForeign.length}/${foreignItems.length} foreign users...`);
  }

  console.log('\n\n=== RESOLVED SAMPLE FOREIGN CURRENCIES ===');
  console.table(resolvedForeign.slice(0, 15).map(f => ({
    User: f.userId,
    Raw: f.rawBalance,
    Currency: f.currency,
    Rate: Math.round(f.rate),
    ConvertedIDR: 'Rp ' + f.convertedIdr.toLocaleString('id-ID'),
    Source: f.source
  })));

  // Currency breakdown
  const currencyStats = {};
  for (const f of resolvedForeign) {
    currencyStats[f.currency] = (currencyStats[f.currency] || 0) + 1;
  }
  console.log('\nForeign Currency Breakdown:', currencyStats);

  const totalForeignIdr = resolvedForeign.reduce((acc, f) => acc + f.convertedIdr, 0);
  const totalDirectIdr = idrItems.reduce((acc, u) => acc + u.balance, 0);
  const grandTotalIdr = totalDirectIdr + totalForeignIdr;

  console.log('\n=== MIGRATION GRAND TOTALS ===');
  console.log('IDR Customers (>= 2000)     :', idrItems.length, 'users, Rp', totalDirectIdr.toLocaleString('id-ID'));
  console.log('Foreign Customers (< 2000) :', resolvedForeign.length, 'users, Rp', totalForeignIdr.toLocaleString('id-ID'));
  console.log('Total Customers to Migrate :', idrItems.length + resolvedForeign.length);
  console.log('Total Store Credit Value   : Rp', grandTotalIdr.toLocaleString('id-ID'));

  // Build unified migration plan
  const migrationPlan = {
    generatedAt: new Date().toISOString(),
    expiryDateStr: 'September 27, 2027',
    expiryTs: Math.floor(new Date('2027-09-27T23:59:59Z').getTime() / 1000),
    totalUsers: idrItems.length + resolvedForeign.length,
    grandTotalIdr,
    items: [
      ...idrItems.map(item => ({
        userId: item.userId,
        amountIdr: item.balance,
        rawAmount: item.balance,
        currency: 'IDR',
        note: 'Migrated from wallet v1'
      })),
      ...resolvedForeign.map(f => ({
        userId: f.userId,
        amountIdr: f.convertedIdr,
        rawAmount: f.rawBalance,
        currency: f.currency,
        note: `Migrated from wallet v1 (${f.rawBalance} ${f.currency} converted)`
      }))
    ]
  };

  const outputPath = 'scripts/wallet-migration-plan.json';
  fs.writeFileSync(outputPath, JSON.stringify(migrationPlan, null, 2));
  console.log(`\nMigration plan saved to ${outputPath} (${migrationPlan.items.length} items ready).`);
}

main();
