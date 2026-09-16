const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../reference/wpcode-snippets-full-audit.json');
const snippets = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const targetIds = ['14577', '10117', '12819', '12532', '14819', '15132', '13537', '13600', '14015', '12477', '14067', '2979', '6902', '12913', '14478', '14576'];

snippets.filter(s => targetIds.includes(String(s.id))).forEach(s => {
  console.log(`\n================================================================`);
  console.log(`SNIPPET #${s.index} | ID: ${s.id} | ${s.title}`);
  console.log(`================================================================`);
  console.log(s.code);
});
