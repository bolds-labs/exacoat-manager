const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../reference/wordpress-wpcode/wpcode-snippets-export-2026-08-15.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);

console.log(`Total snippets found: ${data.length || Object.keys(data).length}`);

const snippets = Array.isArray(data) ? data : (data.snippets || Object.values(data));

snippets.forEach((s, idx) => {
  console.log(`\n========================================`);
  console.log(`[#${idx + 1}] ID: ${s.id || s.snippet_id || s.name} | Title: ${s.title || s.name}`);
  console.log(`Status: ${s.status || s.active ? 'ACTIVE' : 'INACTIVE'} | Code Type: ${s.code_type || s.type}`);
  console.log(`Location: ${s.location || s.insert_number || 'N/A'}`);
  console.log(`--- CODE PREVIEW (First 20 lines) ---`);
  const lines = (s.code || s.snippet_code || '').split('\n').slice(0, 25).join('\n');
  console.log(lines);
});
