const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

function buildZipBuffer(sourceDir, rootFolderName) {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({
      zlib: { level: 9 },
      forceLocalTime: true,
    });

    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err) => reject(err));

    archive.directory(sourceDir, rootFolderName);
    archive.finalize();
  });
}

async function createPluginZip() {
  const pluginDir = path.join(__dirname, '../wordpress-plugin/exacoat-core');
  const mainPhpFile = path.join(pluginDir, 'exacoat-core.php');

  // Extract version from exacoat-core.php
  let phpContent = fs.readFileSync(mainPhpFile, 'utf8');
  const versionMatch = phpContent.match(/Version:\s*([0-9.]+)/i);
  const version = versionMatch ? versionMatch[1] : '0.0.17';
  console.log(`[ZIP BUILDER] Detected Plugin Version: v${version}`);

  // Guarantee EXACOAT_CORE_VERSION constant matches header
  const updatedPhp = phpContent.replace(
    /define\(\s*['"]EXACOAT_CORE_VERSION['"],\s*['"][^'"]+['"]\s*\);/g,
    `define( 'EXACOAT_CORE_VERSION', '${version}' );`
  );
  if (updatedPhp !== phpContent) {
    fs.writeFileSync(mainPhpFile, updatedPhp, 'utf8');
  }

  console.log('[ZIP BUILDER] Packaging exacoat-core using pure Node.js ZipArchive...');
  const exacoatBuffer = await buildZipBuffer(pluginDir, 'exacoat-core');

  const targets = [
    path.join(__dirname, '../public/exacoat-core.zip'),
    path.join(__dirname, `../public/exacoat-core-v${version}.zip`),
    path.join(__dirname, '../exacoat-core.zip'),
    path.join(__dirname, `../exacoat-core-v${version}.zip`),
    path.join(__dirname, `../wordpress-plugin/exacoat-core-v${version}.zip`),
  ];

  targets.forEach((target) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, exacoatBuffer);
    console.log(`[ZIP BUILDER] Wrote archive to: ${path.basename(target)} (${exacoatBuffer.length} bytes)`);
  });

  // Also build artmatter-core archive for seamless drop-in on servers with legacy artmatter-core folders
  console.log('[ZIP BUILDER] Packaging artmatter-core compatibility archive...');
  const artmatterBuffer = await buildZipBuffer(pluginDir, 'artmatter-core');

  const artmatterTargets = [
    path.join(__dirname, '../public/artmatter-core.zip'),
    path.join(__dirname, `../public/artmatter-core-v${version}.zip`),
    path.join(__dirname, '../artmatter-core.zip'),
    path.join(__dirname, `../artmatter-core-v${version}.zip`),
  ];

  artmatterTargets.forEach((target) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, artmatterBuffer);
    console.log(`[ZIP BUILDER] Wrote legacy compatibility archive to: ${path.basename(target)} (${artmatterBuffer.length} bytes)`);
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
    download_url: `https://exacoat.com/exacoat-core-v${version}.zip?v=${version}`,
    homepage: 'https://exacoat.com',
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
}

createPluginZip().catch((err) => {
  console.error('[ZIP BUILDER ERROR]', err);
  process.exit(1);
});
