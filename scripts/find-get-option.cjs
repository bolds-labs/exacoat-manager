const fs = require('fs');
const path = require('path');

const pluginDir = path.join(__dirname, '../wordpress-plugin/artmatter-core');

function searchPattern(dir, pattern) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) {
      searchPattern(p, pattern);
    } else if (item.name.endsWith('.php')) {
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          console.log(`${path.relative(pluginDir, p)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

console.log("=== Searching for get_option('artmatter_core_settings') ===");
searchPattern(pluginDir, /get_option\s*\(\s*['"]artmatter_core_settings['"]/);
