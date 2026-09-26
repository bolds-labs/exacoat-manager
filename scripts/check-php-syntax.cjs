const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.php')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('wordpress-plugin/exacoat-core');
let errs = 0;
files.forEach(f => {
  try {
    const out = execSync(`php -l "${f}"`, { encoding: 'utf8' });
    if (!out.includes('No syntax errors detected')) {
      console.log(out);
      errs++;
    }
  } catch (e) {
    console.error('Syntax error in', f, e.stdout || e.message);
    errs++;
  }
});
if (errs === 0) console.log(`All ${files.length} PHP files syntax-checked: NO SYNTAX ERRORS!`);
