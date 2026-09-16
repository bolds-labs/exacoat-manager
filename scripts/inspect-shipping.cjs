const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../reference/wpcode-snippets-full-audit.json');
const snippets = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

['13537', '13600'].forEach(id => {
  const s = snippets.find(item => String(item.id) === id);
  if (s) {
    console.log(`\n================================================================`);
    console.log(`ID: ${s.id} | Title: ${s.title}`);
    console.log(`================================================================`);
    console.log(s.code);
  }
});
