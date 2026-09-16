const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../reference/wpcode-snippets-full-audit.json');
const snippets = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

console.log(`Auditing ALL ${snippets.length} snippets against plugin files...\n`);

const pluginFiles = [
  'artmatter-core.php',
  'admin/class-admin-settings.php',
  'admin/class-github-updater.php',
  'admin/views/settings-page.php',
  'includes/class-artist-manager.php',
  'includes/class-artmatter-core.php',
  'includes/class-artwork-vault.php',
  'includes/class-bricks-bridge.php',
  'includes/class-bricks-migrator.php',
  'includes/class-commission-engine.php',
  'includes/class-shipping-tracker.php',
  'includes/class-store-enhancements.php',
  'includes/class-supabase-sync.php',
  'includes/class-webhook-dispatcher.php',
];

const pluginContents = {};
pluginFiles.forEach(f => {
  const fullPath = path.join(__dirname, '../wordpress-plugin/artmatter-core', f);
  if (fs.existsSync(fullPath)) {
    pluginContents[f] = fs.readFileSync(fullPath, 'utf8');
  }
});

const report = [];

snippets.forEach(s => {
  const item = {
    id: s.id,
    title: s.title,
    active: s.active,
    status: 'UNKNOWN',
    matches: [],
    analysis: ''
  };

  // Find occurrences of key functions or hooks
  const hooks = [...s.code.matchAll(/add_action\s*\(\s*['"]([^'"]+)['"]/g), ...s.code.matchAll(/add_filter\s*\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  
  let matchFound = false;
  for (const [file, content] of Object.entries(pluginContents)) {
    // Check if snippet ID is mentioned
    if (content.includes(String(s.id))) {
      item.matches.push(file);
      matchFound = true;
    }
  }

  report.push(item);
});

console.log(JSON.stringify(report, null, 2));
