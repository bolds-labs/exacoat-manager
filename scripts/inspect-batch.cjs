const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../reference/wpcode-snippets-full-audit.json');
const snippets = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

// Group into sets of 5 to inspect their exact logic
const ranges = [
  [0, 5],
  [5, 10],
  [10, 15],
  [15, 20],
  [20, 25],
  [25, 30],
  [30, 35],
  [35, 39]
];

const idx = parseInt(process.argv[2] || '0', 10);
const [start, end] = ranges[idx];

console.log(`=== SNIPPETS ${start + 1} to ${end} ===\n`);

snippets.slice(start, end).forEach(s => {
  console.log(`----------------------------------------------------------------`);
  console.log(`SNIPPET #${s.index} | ID: ${s.id} | ${s.title}`);
  console.log(`----------------------------------------------------------------`);
  console.log(s.code);
  console.log(`\n`);
});
