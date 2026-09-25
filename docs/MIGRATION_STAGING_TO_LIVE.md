# Migration Guide: Staging (staging.exacoat.com) to Production (exacoat.com)

This document outlines the step-by-step procedure to migrate configurator data, global texture finishes, and app connections from the staging environment to the live production store.

---

## 1. System Overview & Architecture

Configurator setups and materials are distributed across three distinct layers:

1. **WordPress Database (Staging vs Production):**
   - **Global Finishes & Materials:** Stored in `wp_options` under:
     - `exacoat_global_finishes` (all textures, albedo maps, normal maps, roughness, active/stock flags)
     - `exacoat_global_finish_groups` & `exacoat_finish_group_settings` (group ordering and presentation)
     - `exacoat_finish_surcharge_tiers` (premium tier pricing)
     - `exacoat_configurator_presets` (popular curated setups)
     - `exacoat_addon_schemas` (hardware/skin add-ons)
   - **Device Configurator Profiles:** Stored in `wp_postmeta` under meta key `_exacoat_configurator_profile` on each WooCommerce product (layers, mask PNGs, scales, offsets, camera plateau setups, 360 cuts).
2. **Media Storage (`/wp-content/uploads/`):**
   - All uploaded texture image files, bump maps, normal maps, and device cut mask PNGs reside in WordPress uploads.
3. **Exacoat Manager ERP (React / Vite):**
   - Connects to WordPress via REST API endpoints (`/wp-json/wc/v3` and `/wp-json/exacoat-core/v1`).
   - Resolves target URL via `localStorage`, `.env` (`VITE_WORDPRESS_URL`), and internal fallbacks.

---

## 2. Four-Step Migration Procedure

### Step 1: Synchronize Media Uploads (`/wp-content/uploads/`)
Before switching data or endpoints, ensure all assets referenced by the configurator exist on the production server:
- Copy new texture image files (thumbnails, high-res texture maps, normal maps) and device mask PNGs from `staging.exacoat.com/wp-content/uploads/` to `exacoat.com/wp-content/uploads/`.
- Tools: SFTP / rsync / hosting control panel file manager / WordPress media sync plugin.
- Note: If both staging and production share a common CDN or media bucket, verify that files uploaded during staging configuration are publicly accessible on the production domain.

---

### Step 2: Migrate Configurator Data from Staging to Production

Do not simply change the URL in the app without migrating the data first, or production will show empty or outdated texture lists.

#### Method A: Automated Sync via REST API (Recommended)
You can run an automated sync script using the `exacoat-core` REST API bridge:
1. **Fetch from Staging:**
   - Finishes, groups, settings, presets: `GET https://staging.exacoat.com/wp-json/exacoat-core/v1/finishes`
   - Surcharge tiers: `GET https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/surcharge-tiers`
   - Device profiles: `GET https://staging.exacoat.com/wp-json/exacoat-core/v1/configurator/profiles?per_page=500`
2. **Transform URLs:**
   - Search and replace `https://staging.exacoat.com` with `https://exacoat.com` inside all texture big URLs, thumbnails, normal maps, and layer mask URLs.
3. **Push to Production:**
   - Batch save finishes and groups: `POST https://exacoat.com/wp-json/exacoat-core/v1/finishes/save-all`
   - Save surcharge tiers: `POST https://exacoat.com/wp-json/exacoat-core/v1/configurator/surcharge-tiers`
   - Save each device profile: `POST https://exacoat.com/wp-json/exacoat-core/v1/configurator/save` (authenticated with production WooCommerce Consumer Key & Secret).

#### Method B: Database Export / Better Search Replace
If performing database-level export:
1. Export the `wp_options` records listed in Section 1.
2. Export all `wp_postmeta` records where `meta_key = '_exacoat_configurator_profile'`.
3. Import into the production database.
4. Run **Better Search Replace** plugin (or `wp search-replace` via WP-CLI) on `wp_options` and `wp_postmeta` to replace `https://staging.exacoat.com` with `https://exacoat.com`.

---

### Step 3: Deploy Plugin and Configure Production API Keys

1. **Package Latest Plugin:**
   In `exacoat-manager`, run:
   ```bash
   node scripts/package-plugin.cjs
   ```
   This generates the current release ZIP at `public/exacoat-core.zip`.
2. **Update Plugin on Production:**
   - Go to `exacoat.com` WP Admin -> Plugins -> Add New -> Upload Plugin.
   - Upload and replace the existing `exacoat-core` plugin.
3. **Generate REST API Credentials:**
   - Go to `exacoat.com` WP Admin -> WooCommerce -> Settings -> Advanced -> REST API.
   - Click **Add Key**.
   - Description: `Exacoat Manager Production`.
   - User: Administrator account.
   - Permissions: **Read/Write**.
   - Copy the **Consumer Key** (`ck_...`) and **Consumer Secret** (`cs_...`).

---

### Step 4: Update Exacoat Manager Configuration

1. **Update `.env` file:**
   ```env
   VITE_APP_NAME="Exacoat Manager"
   VITE_WORDPRESS_URL=https://exacoat.com
   VITE_WC_CONSUMER_KEY=ck_production_key_here
   VITE_WC_CONSUMER_SECRET=cs_production_secret_here
   VITE_ADMIN_EMAIL=admin@exacoat.com
   ```

2. **Update Code Fallbacks:**
   - `src/lib/env.ts`: Update default fallback from `https://staging.exacoat.com` to `https://exacoat.com`.
   - `vite.config.ts`: Update local proxy target fallback to `https://exacoat.com`.
   - `src/lib/imageLoader.ts`: Set fallback proxy origin to `https://exacoat.com`.

3. **Reset In-Browser LocalStorage:**
   - Open Exacoat Manager in your browser.
   - Navigate to **Settings** -> **WordPress API & Bridge**.
   - Click the preset button **exacoat.com (live)** or click **Reset Default** to clear cached staging URLs from `localStorage`.
   - Verify that your production WooCommerce Consumer Key and Secret are filled in.

---

## 3. Post-Migration Verification Checklist

- [ ] **Materials Inventory:** Open Materials Stock page in Exacoat Manager. Verify all configured textures (concrete, camo, colors) appear with correct stock and active toggles.
- [ ] **Configurator Studio:** Open a device in Configurator Studio. Check that 3D preview loads, masks render properly, and texture scaling is preserved.
- [ ] **Orders & RMA:** Open Orders view. Verify live orders load without REST API authentication errors. Test opening Manual Warranty / Redeem modal.
- [ ] **Image Proxy:** Test opening a product item preview or generating a composite thumbnail to confirm CORS and proxy headers function properly on `exacoat.com`.
