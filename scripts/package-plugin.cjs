const { execSync } = require('child_process');
const path = require('path');

try {
  const pyScript = path.join(__dirname, 'package-plugin.py');
  execSync(`python "${pyScript}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('[ZIP BUILDER ERROR] Failed to run python packaging script:', err.message);
  process.exit(1);
}
