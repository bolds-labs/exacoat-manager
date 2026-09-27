const fs = require('fs');
const readline = require('readline');

async function main() {
  const filePath = 'C:\\Users\\shand\\Downloads\\Edge\\users_wallet.csv';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let totalRows = 0;
  let zeroOrNegative = 0;
  let positiveCount = 0;
  let below2000 = [];
  let aboveOrEqual2000 = [];

  let isHeader = true;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isHeader) {
      isHeader = false;
      console.log('Header line:', trimmed);
      continue;
    }

    totalRows++;
    const parts = trimmed.split(',').map(s => s.replace(/["']/g, '').trim());
    if (parts.length < 2) {
      console.log('Malformed row:', trimmed);
      continue;
    }

    const userId = parseInt(parts[0], 10);
    const balance = parseFloat(parts[1]);

    if (isNaN(balance) || balance <= 0) {
      zeroOrNegative++;
      continue;
    }

    positiveCount++;
    if (balance < 2000) {
      below2000.push({ userId, balance });
    } else {
      aboveOrEqual2000.push({ userId, balance });
    }
  }

  console.log('=== CSV ANALYSIS ===');
  console.log('Total rows parsed:', totalRows);
  console.log('Zero or negative balances:', zeroOrNegative);
  console.log('Positive balances (> 0):', positiveCount);
  console.log('Balances >= 2000 (IDR):', aboveOrEqual2000.length);
  console.log('Balances < 2000 (Foreign currencies):', below2000.length);

  console.log('\nSample below 2000 (first 20):');
  console.table(below2000.slice(0, 20));

  const totalIdrDirect = aboveOrEqual2000.reduce((acc, u) => acc + u.balance, 0);
  console.log('\nTotal IDR value for balances >= 2000: Rp ' + totalIdrDirect.toLocaleString('id-ID'));
}

main();
