const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../reference/wpcode-snippets-full-audit.json');
const snippets = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

['14577', '12819', '10117', '12532', '6902', '12916', '12843', '12366', '12727'].forEach(id => {
  const s = snippets.find(item => String(item.id) === id);
  if (s) {
    console.log(`\n================================================================`);
    console.log(`SNIPPET #${s.index} | ID: ${s.id} | ${s.title}`);
    console.log(`================================================================`);
    console.log(s.code);
  }
});
