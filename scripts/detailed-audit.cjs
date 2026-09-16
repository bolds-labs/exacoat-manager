const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../reference/wordpress-wpcode/wpcode-snippets-export-2026-08-15.json');
const raw = fs.readFileSync(jsonPath, 'utf8');
const data = JSON.parse(raw);
const snippets = Array.isArray(data) ? data : (data.snippets || Object.values(data));

const summary = snippets.map((s, i) => {
  return {
    index: i + 1,
    id: s.id || s.snippet_id || s.name,
    title: s.title || s.name,
    code_length: (s.code || s.snippet_code || '').length,
    code: (s.code || s.snippet_code || '')
  };
});

fs.writeFileSync(
  path.join(__dirname, '../reference/wpcode-snippets-full-audit.json'),
  JSON.stringify(summary, null, 2)
);

console.log(`Wrote full audit of ${summary.length} snippets to reference/wpcode-snippets-full-audit.json`);

summary.forEach(s => {
  console.log(`[#${s.index}] ID: ${s.id} | ${s.title}`);
});
