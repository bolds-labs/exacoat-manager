const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../reference/wpcode-snippets-full-audit.json');
const snippets = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const s1 = snippets.find(s => String(s.id) === '1235');
console.log('=== SNIPPET #1 (ID: 1235) CODE ===');
console.log(s1.code);
