const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createPluginZip() {
  const pluginDir = path.join(__dirname, '../wordpress-plugin/exacoat-core');
  const mainPhpFile = path.join(pluginDir, 'exacoat-core.php');

  // Extract version from exacoat-core.php
  let phpContent = fs.readFileSync(mainPhpFile, 'utf8');
  const versionMatch = phpContent.match(/Version:\s*([0-9.]+)/i);
  const version = versionMatch ? versionMatch[1] : '0.0.19';
  console.log(`[ZIP BUILDER] Detected Plugin Version: v${version}`);

  // Guarantee EXACOAT_CORE_VERSION constant matches header
  const updatedPhp = phpContent.replace(
    /define\(\s*['"]EXACOAT_CORE_VERSION['"],\s*['"][^'"]+['"]\s*\);/g,
    `define( 'EXACOAT_CORE_VERSION', '${version}' );`
  );
  if (updatedPhp !== phpContent) {
    fs.writeFileSync(mainPhpFile, updatedPhp, 'utf8');
  }

  const zip = new JSZip();
  const rootFolder = zip.folder('exacoat-core');

  function addDirectoryToZip(dirPath, zipFolder) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const subFolder = zipFolder.folder(item);
        addDirectoryToZip(fullPath, subFolder);
      } else {
        const fileData = fs.readFileSync(fullPath);
        zipFolder.file(item, fileData);
      }
    }
  }

  console.log('[ZIP BUILDER] Reading plugin directory:', pluginDir);
  addDirectoryToZip(pluginDir, rootFolder);

  console.log('[ZIP BUILDER] Generating UNIX-compliant ZIP with forward slashes...');
  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX', // Ensures standard POSIX forward-slash paths
  });

  const targets = [
    path.join(__dirname, '../public/exacoat-core.zip'),
    path.join(__dirname, `../public/exacoat-core-v${version}.zip`),
    path.join(__dirname, '../dist/exacoat-core.zip'),
    path.join(__dirname, `../dist/exacoat-core-v${version}.zip`),
    path.join(__dirname, '../exacoat-core.zip'),
    path.join(__dirname, `../exacoat-core-v${version}.zip`),
    path.join(__dirname, `../wordpress-plugin/exacoat-core-v${version}.zip`),
  ];

  targets.forEach((target) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    console.log(`[ZIP BUILDER] Wrote archive to: ${path.basename(target)}`);
  });

  // Write version manifest to public/version.json for automated WordPress updates
  const manifest = {
    name: 'Exacoat Core Engine',
    slug: 'exacoat-core',
    version: version,
    author: 'Exacoat Engineering',
    author_profile: 'https://exacoat.com',
    requires: '6.0',
    tested: '6.7',
    requires_php: '7.4',
    download_url: `https://manager.exacoat.com/exacoat-core-v${version}.zip?v=${version}`,
    homepage: 'https://manager.exacoat.com',
    last_updated: new Date().toISOString(),
    sections: {
      description: 'The core bridge between Exacoat Manager ERP, WooCommerce orders, custom status, and fulfillment tracking.',
      changelog: `### Version ${version}\n- High-speed order management & ready-to-ship custom status\n- Integrated courier tracking and A6 label metadata synchronization`,
    },
  };

  const manifestPath = path.join(__dirname, '../public/version.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[ZIP BUILDER] Wrote update manifest to: public/version.json`);

  // Update src/config/version.ts
  const versionTsPath = path.join(__dirname, '../src/config/version.ts');
  const today = new Date().toISOString().split('T')[0];
  const versionTsContent = `/**
 * Global App & Plugin Version Configuration
 * Single source of truth for versioning across Manager ERP & WordPress Plugin
 */

export const APP_VERSION = '${version}';
export const PLUGIN_VERSION = '${version}';
export const PLUGIN_ZIP_NAME = \`exacoat-core-v\${PLUGIN_VERSION}.zip\`;
export const PLUGIN_LATEST_ZIP_NAME = 'exacoat-core.zip';
export const APP_BUILD_DATE = '${today}';
`;
  fs.writeFileSync(versionTsPath, versionTsContent);
  console.log(`[ZIP BUILDER] Updated src/config/version.ts to v${version}`);

  // Verify contents
  const verifyZip = await JSZip.loadAsync(content);
  console.log('[ZIP BUILDER] Verified entry paths:');
  Object.keys(verifyZip.files).forEach((f) => console.log('  ✓ ' + f));
}

createPluginZip().catch((err) => {
  console.error('[ZIP BUILDER ERROR]', err);
  process.exit(1);
});
