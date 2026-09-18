import os
import sys
import re
import json
import zipfile
from datetime import datetime

def package_plugin():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    plugin_dir = os.path.join(base_dir, 'wordpress-plugin', 'exacoat-core')
    main_php = os.path.join(plugin_dir, 'exacoat-core.php')

    with open(main_php, 'r', encoding='utf-8') as f:
        php_content = f.read()

    match = re.search(r'Version:\s*([0-9.]+)', php_content, re.IGNORECASE)
    version = match.group(1) if match else '0.0.16'
    print(f"[ZIP BUILDER (Python)] Detected Plugin Version: v{version}")

    # Ensure constant matches
    updated_php = re.sub(
        r"define\(\s*['\"]EXACOAT_CORE_VERSION['\"],\s*['\"][^'\"]+['\"]\s*\);",
        f"define( 'EXACOAT_CORE_VERSION', '{version}' );",
        php_content
    )
    if updated_php != php_content:
        with open(main_php, 'w', encoding='utf-8') as f:
            f.write(updated_php)

    def create_zip(target_path, root_folder):
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with zipfile.ZipFile(target_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            for root, dirs, files in os.walk(plugin_dir):
                # Sort for deterministic archive
                dirs.sort()
                files.sort()
                for f in files:
                    full_path = os.path.join(root, f)
                    rel_path = os.path.relpath(full_path, plugin_dir)
                    arcname = root_folder + '/' + rel_path.replace('\\', '/')
                    zf.write(full_path, arcname)
        print(f"[ZIP BUILDER (Python)] Wrote archive to: {os.path.basename(target_path)} ({os.path.getsize(target_path)} bytes)")

    # Exacoat core targets
    create_zip(os.path.join(base_dir, 'exacoat-core.zip'), 'exacoat-core')
    create_zip(os.path.join(base_dir, f'exacoat-core-v{version}.zip'), 'exacoat-core')
    create_zip(os.path.join(base_dir, 'public', 'exacoat-core.zip'), 'exacoat-core')
    create_zip(os.path.join(base_dir, 'public', f'exacoat-core-v{version}.zip'), 'exacoat-core')
    create_zip(os.path.join(base_dir, 'wordpress-plugin', f'exacoat-core-v{version}.zip'), 'exacoat-core')

    # Legacy artmatter-core compatibility targets
    create_zip(os.path.join(base_dir, 'artmatter-core.zip'), 'artmatter-core')
    create_zip(os.path.join(base_dir, f'artmatter-core-v{version}.zip'), 'artmatter-core')
    create_zip(os.path.join(base_dir, 'public', 'artmatter-core.zip'), 'artmatter-core')
    create_zip(os.path.join(base_dir, 'public', f'artmatter-core-v{version}.zip'), 'artmatter-core')

    # Manifest update
    manifest = {
        "name": "Exacoat Core Engine",
        "slug": "exacoat-core",
        "version": version,
        "author": "Exacoat Engineering",
        "author_profile": "https://exacoat.com",
        "requires": "6.0",
        "tested": "6.7",
        "requires_php": "7.4",
        "download_url": f"https://exacoat.com/exacoat-core-v{version}.zip?v={version}",
        "homepage": "https://exacoat.com",
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "sections": {
            "description": "The core bridge between Exacoat Manager ERP, WooCommerce orders, custom status, and fulfillment tracking.",
            "changelog": f"### Version {version}\n- High-speed order management & ready-to-ship custom status\n- Integrated courier tracking and A6 label metadata synchronization"
        }
    }
    manifest_path = os.path.join(base_dir, 'public', 'version.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print("[ZIP BUILDER (Python)] Wrote update manifest to: public/version.json")

    # Update version.ts
    today = datetime.utcnow().strftime('%Y-%m-%d')
    version_ts_content = f"""/**
 * Global App & Plugin Version Configuration
 * Single source of truth for versioning across Manager ERP & WordPress Plugin
 */

export const APP_VERSION = '{version}';
export const PLUGIN_VERSION = '{version}';
export const PLUGIN_ZIP_NAME = `exacoat-core-v${{PLUGIN_VERSION}}.zip`;
export const PLUGIN_LATEST_ZIP_NAME = 'exacoat-core.zip';
export const APP_BUILD_DATE = '{today}';
"""
    version_ts_path = os.path.join(base_dir, 'src', 'config', 'version.ts')
    with open(version_ts_path, 'w', encoding='utf-8') as f:
        f.write(version_ts_content)
    print(f"[ZIP BUILDER (Python)] Updated src/config/version.ts to v{version}")

    # Verify with zipfile
    with zipfile.ZipFile(os.path.join(base_dir, f'exacoat-core-v{version}.zip'), 'r') as zf:
        bad_file = zf.testzip()
        if bad_file:
            print(f"[ZIP BUILDER ERROR] Corrupt file in zip: {bad_file}")
            sys.exit(1)
        print(f"[ZIP BUILDER (Python)] CRC32 & Header Consistency Check: 100% PASSED ({len(zf.namelist())} files)")

if __name__ == '__main__':
    package_plugin()
