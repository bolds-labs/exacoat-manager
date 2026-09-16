const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../reference/wpcode-snippets-full-audit.json');
const snippets = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

['10117', '5059', '12843', '12916'].forEach(id => {
  const s = snippets.find(item => String(item.id) === id);
  if (s) {
    console.log(`\n================================================================`);
    console.log(`SNIPPET #${s.index} | ID: ${s.id} | ${s.title}`);
    console.log(`================================================================`);
    console.log(s.code);
  }
});
