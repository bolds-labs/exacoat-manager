const fs = require('fs');
const path = require('path');

const filePath = path.resolve('wordpress-plugin/artmatter-core/admin/views/settings-page.php');
const content = fs.readFileSync(filePath, 'utf8');

// Extract all IDs
const idMatches = content.match(/id=["']([a-zA-Z0-9_\-]+)["']/g) || [];
const ids = [...new Set(idMatches.map(m => m.replace(/id=["']|["']/g, '')))];

// Extract all input/select names
const nameMatches = content.match(/name=["']([a-zA-Z0-9_\[\]\-]+)["']/g) || [];
const names = [...new Set(nameMatches.map(m => m.replace(/name=["']|["']/g, '')))];

console.log('✅ Extracted Unique DOM IDs:', ids.length);
console.log('✅ Extracted Unique Form Input Names:', names.length);

// Check critical newly added Dashboard elements
const requiredDashboardIds = [
  'btn-dash-run-audit',
  'btn-dash-sync-manager',
  'dash-visitors-lost',
  'dash-ttfb-val',
  'dash-autoload-val',
  'dash-health-score',
  'dash-rating-text',
  'dash-readiness-passed',
  'dash-readiness-fixes',
  'btn-dash-quick-optimize',
  'dash-reports-container',
  'dash-live-passed',
  'dash-live-fixes',
  'btn-run-local-audit-circle'
];

let allDashPresent = true;
for (const reqId of requiredDashboardIds) {
  if (!ids.includes(reqId)) {
    console.error('❌ Missing Dashboard ID:', reqId);
    allDashPresent = false;
  }
}

if (allDashPresent) {
  console.log('🎉 All 14 new BoltAudit Dashboard IDs confirmed present and verified!');
}

// Check critical core settings form IDs
const criticalCoreIds = [
  'mainSettingsForm',
  'btn-top-save',
  'btn-check-update',
  'btn-update-now',
  'btn-flush-permalinks',
  'artmatter-settings-search'
];

let allCorePresent = true;
for (const cId of criticalCoreIds) {
  if (!ids.includes(cId)) {
    console.error('❌ Missing Core ID:', cId);
    allCorePresent = false;
  }
}

if (allCorePresent) {
  console.log('🎉 All critical core settings & form elements 100% retained!');
}
