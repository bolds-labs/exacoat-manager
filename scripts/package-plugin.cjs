const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function packagePlugin() {
  const pluginDir = path.resolve(__dirname, '../wordpress-plugin/exacoat-core');
  const outputZipPath = path.resolve(__dirname, '../exacoat-core.zip');

  if (!fs.existsSync(pluginDir)) {
    console.error('Plugin directory does not exist:', pluginDir);
    process.exit(1);
  }

  const zip = new JSZip();
  const rootFolder = zip.folder('exacoat-core');

  function addFolderToZip(folderPath, zipFolder) {
    const items = fs.readdirSync(folderPath);
    for (const item of items) {
      const fullPath = path.join(folderPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const subFolder = zipFolder.folder(item);
        addFolderToZip(fullPath, subFolder);
      } else {
        const content = fs.readFileSync(fullPath);
        zipFolder.file(item, content);
      }
    }
  }

  console.log('Packaging exacoat-core plugin into zip...');
  addFolderToZip(pluginDir, rootFolder);

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  fs.writeFileSync(outputZipPath, content);
  console.log(`Successfully created plugin package: ${outputZipPath} (${(content.length / 1024).toFixed(1)} KB)`);
}

packagePlugin().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
