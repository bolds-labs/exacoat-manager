const fs = require('fs');
const path = require('path');

const pluginDir = path.join(__dirname, '../wordpress-plugin/artmatter-core');

function getPhpFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(getPhpFiles(p));
    } else if (item.name.endsWith('.php')) {
      files.push(p);
    }
  }
  return files;
}

const phpFiles = getPhpFiles(pluginDir);

console.log(`Found ${phpFiles.length} PHP files in plugin:\n`);
phpFiles.forEach(f => {
  const rel = path.relative(pluginDir, f);
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n').length;
  console.log(`- ${rel} (${lines} lines, ${(content.length/1024).toFixed(1)} KB)`);
});
