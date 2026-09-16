# Changelog

All notable changes to the Exacoat Manager ERP workstation and the `exacoat-core` WordPress plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.8] - 2026-09-15

### WordPress Storefront Safety & Flat Media Reversion Engine
- **Native Product Permalinks & Storefront Isolation**:
  - Gated `post_type_link` behind `EXACOAT_ENABLE_HEADLESS_LINKS` so native WooCommerce product URLs (`https://exacoat.com/products/iphone-17-pro-max-skins` or `/product/...`) are completely untouched on WordPress.
  - Removed `force_product_slug_with_id` (`wp_unique_post_slug` filter) to ensure clean product slugs without appended post IDs.
  - Removed legacy poster rewrite rules (`^posters/...`), coming-soon maintenance redirects, and taxonomy removals (`product_brand`).
  - Gated custom checkout and cart template overrides behind `enable_headless_checkout` (default disabled `0`), preserving native WooCommerce and Bricks checkout and cart behavior on live sites.
- **Media Flattening & Reversion Engine**:
  - Maintained strictly flat physical storage in `/wp-content/uploads/` for all configurator textures and assets.
  - Implemented `Exacoat_Store_Enhancements::revert_assets_to_flat_uploads()` to safely consolidate any nested files from `/wp-content/uploads/Assets/` back into root `/uploads/`, remove empty directories, and update database attachment postmeta (`_wp_attached_file`) and GUIDs.
  - Added a 1-click **"Consolidate to /uploads"** button in the Exacoat Core WP admin settings panel and a REST endpoint `POST /wp-json/exacoat/v1/system/revert-media`.

## [0.0.7] - 2026-09-15

### Redeclaration Conflict, Brand Constants & Error Screen Assets
- **WPCode Snippet Compatibility**:
  - Deferred global compatibility helpers in `class-shipping-tracker.php` and `class-wishlist-engine.php` to `init` at priority 999 to eliminate `Cannot redeclare function exacoat_get_carrier_tracking_url()` fatal conflicts with legacy WPCode snippets.
- **Brand Constant Aliases**:
  - Added `ARTMATTER_WEB_URL` and `ARTMATTER_MEDIA_URL` backwards-compatibility aliases in `exacoat-core.php`.
  - Converted direct constant usages in `class-checkout-engine.php` and `class-order-manager.php` to safe helper calls with fallbacks.
- **Offline Error Screen Branding**:
  - Embedded high-resolution Exacoat dark wordmark logo directly as base64 PNG data URI in `class-logger.php` to ensure 100% reliable rendering on local, offline, and staging environments.
- **Dual Archive Packaging**:
  - Updated `scripts/package-plugin.cjs` to package both `exacoat-core.zip` and `artmatter-core.zip` for seamless updates on servers retaining either slug.

## [0.0.6] - 2026-09-15

### Virtual Upload Folder Path Resolver & Media Normalization
- **Dynamic Virtual Upload Resolution**:
  - Implemented `resolve_virtual_upload` in `Exacoat_Store_Enhancements` hooked to `init` at priority 1 to catch incoming requests for virtual nested folders under `/wp-content/uploads/` (such as `Assets/Image/Skin Textures/<file>`).
  - Resolved requested assets dynamically to physical files residing in the flat uploads directory without requiring physical folder creation on the server.
  - Added direct binary streaming with HTTP 200 OK, full browser and Cloudflare edge caching headers (`Cache-Control: public, max-age=31536000, immutable`), `Access-Control-Allow-Origin: *` (preventing WebGL/Three.js texture CORS errors), and 304 Not Modified cache validation.
- **Media Normalization & Fallbacks**:
  - Filtered `wp_get_attachment_url` to proactively resolve virtual folder references to canonical flat URLs.
  - Updated universal image proxy in `class-artmatter-core.php` with virtual upload discovery fallback.
  - Updated `exacoat_media_url` and `exacoat_media_urls_in_text` to normalize virtual paths in HTML markup.
  - Added virtual upload diagnostics check to `class-diagnostics.php`.

## [0.0.5] - 2026-09-15

### WordPress Plugin Lifecycle & Critical Activation Error Fix
- **Fixed WordPress Fatal Activation Error**:
  - Resolved `woocommerce_store_api_register_endpoint_data` fatal crash during plugin activation by verifying `!did_action('woocommerce_blocks_loaded')` before registering Store API schemas.
  - Guarded all top-level functions and plugin lifecycle hooks (`register_activation_hook`, `register_deactivation_hook`) with `try / catch (\Throwable $e)` to prevent activation blocks on live stores.
  - Isolated all module initializations in `Exacoat_Core::init_modules()` within independent `try / catch` blocks to eliminate cascade initialization failures.
  - Resolved PHP syntax brace closure errors in `class-admin-settings.php` and `class-wishlist-engine.php`.
  - Added comprehensive class aliases (`class_alias('Exacoat_*', 'Artmatter_*')`) and dual REST route handlers (`exacoat-core/v1` and `artmatter-core/v1`) to guarantee 100% backward compatibility for existing store integrations.

### Legacy Platform Cleanup & Exacoat Rebrand
- **Removed Artmatter Legacy Concepts across Plugin and Manager**:
  - Purged obsolete artist multi-vendor modules, artist KYC documents, artist payouts, and print-grade downscaling routines.
  - Cleaned client-side and server-side review flows: updated review invitations, subject tokens, and product previews for precision skins.
  - Updated default shipping methods and customer labels across checkout, reviews, and shipping trackers.
  - Cleaned audit logger, system logs table, and telemetry channels to focus on orders, inventory, courier tracking, and store synchronization.

---

## [0.0.4] - 2026-09-14

### WordPress Admin Console Fix
- **Rebuilt Empty WordPress Admin Settings Page (`settings-page.php`)**:
  - **Root Cause Identified**: The settings page previously suffered a fatal PHP execution halt at line 1610 due to undefined `ARTMATTER_CORE_VERSION` and calls to removed Artmatter classes, causing WordPress to display a blank/empty black screen with an "Artmatter Core" title.
  - **Complete Architectural Overhaul**: Replaced the 6,833-line legacy Artmatter view with a sleek, 100% resilient Exacoat Core Platform console (~22 KB).
  - **Streamlined into 4 Purposeful Tabs**:
    1. *Dashboard & Status*: Live system metrics, WooCommerce connectivity, and runtime environment (PHP, Memory, WP).
    2. *Headless REST API*: Bricks Builder headless pages routes (`/wp-json/exacoat/v1/pages`), Customer Auth, Reviews, and Wishlist endpoints with 1-click browser test links.
    3. *Fulfillment & Courier*: Manufacturing pipeline documentation (`wc-in-production`, `wc-quality-check`), courier waybills, and Biteship integration status.
    4. *Diagnostics & Logs*: Real-time database telemetry log viewer and 1-click self-test diagnostics runner.
  - **Backward Compatibility Constants**: Defined `ARTMATTER_CORE_VERSION`, `ARTMATTER_CORE_FILE`, and `ARTMATTER_CORE_URL` aliased to `EXACOAT_CORE_*` to prevent fatal errors across all plugin subsystems.
  - **Admin Menu Routing**: Registered primary `exacoat-core` menu slug while maintaining backward-compatible hidden routing for `artmatter-core`.
- **Plugin Footprint**: Further reduced plugin package size with 0 PHP errors.

---

## [0.0.3] - 2026-09-14

### UI & Styling
- **Refined Flatter 3D Button Architecture**:
  - Transformed the specular top light from full-width rim to **top-center only** (`before:left-1/2 -translate-x-1/2`) using a horizontal feathered gradient (`from-transparent via-[#ffedd5]/80 to-transparent`).
  - Added **smooth hover transitions** (`transition-all duration-300 ease-out`), widening the specular highlight from `w-16` to `w-28` with smooth amber ambient glow.
  - Flattened surface profile from steep 3-tier gradient to modern subtle 2-stop gradient (`#f6b328` to `#ea9c0f`) with streamlined `-1.5px` depth bevel.
  - Authored comprehensive [`DESIGN.md`](file:///c:/AI/exacoat-manager/DESIGN.md) documenting brand direction, dials (`ENERGY 2 / RHYTHM 2 / MOTION 1`), palette tokens, button architecture, and typography standards.

### WordPress Plugin & Updater
- **Decoupled Updater from Legacy Server**:
  - Replaced legacy `manager.artmatter.co` endpoint with `manager.exacoat.com` (configurable via `EXACOAT_UPDATE_MANIFEST_URL` and `exacoat_core_update_manifest_url` filter).
  - Renamed core updater class to `Exacoat_Plugin_Updater` with alias `Artmatter_GitHub_Updater`.
  - Added strict guardrails to reject any remote manifest with version `>= 7.0` (legacy Artmatter versions).
  - Implemented automatic cleanup in constructor to flush legacy cached transients (`artmatter_core_remote_version_manifest` and `update_plugins`), resolving the erroneous `View version 7.12.98 details` update alert in WordPress admin.
- **Packaging**:
  - Synchronized version `0.0.3` across `package.json`, `exacoat-core.php`, `version.ts`, and `version.json`.
  - Generated release distribution archive `exacoat-core-v0.0.3.zip`.

---

## [0.0.2] - 2026-09-14

### UI & Styling
- **Button 3D Aesthetics**:
  - Replaced the harsh white specular top bevel highlight on 3D buttons with a warm light orange (`rgba(254, 215, 170, 0.65)` / `#ffedd5`).
  - Adjusted inset depth shadows to soften the rim glare and blend seamlessly into the `#f3aa18` brand gradient.
  - Added tactile button depression states (`active:scale-[0.985]` with inner inset shadow).
- **Button Typography**:
  - Standardized button text to small text (`text-xs` / `text-[11px]`).
  - Added uppercase transformation and clean letter spacing (`tracking-wider`).
  - Set bold/semibold font weights (`font-bold` for primary/default/lime buttons, `font-semibold` for secondary/outline).
  - Maintained normal casing and tracking for text links (`variant="link"`).

### Core Engine & Build
- Synchronized version `0.0.2` across `package.json`, `wordpress-plugin/exacoat-core/exacoat-core.php`, `src/config/version.ts`, and `public/version.json`.
- Generated release distribution archive `exacoat-core-v0.0.2.zip`.

---

## [0.0.1] - 2026-09-14

### Initial Exacoat Migration & Modernization
- **Rebranding & Design System**:
  - Transitioned primary accent palette from legacy lime green to official Exacoat brand color (`#f3aa18`).
  - Replaced legacy references across navigation, headers, and UI components.
- **Decommissioned Modules & Asset Cleanup**:
  - Removed FeelForm form builder modules and integration endpoints.
  - Removed Drime and Cloudflare direct object storage integration layers while preserving Cloudflare Cache Purge capabilities.
  - Removed obsolete AI classifier scripts, legacy 3D scripts (`three.module.min.js`), and oversized third-party vendor assets (`pintura.js`), shrinking plugin footprint by 76% (from 1.5 MB down to ~350 KB).
  - Purged unused maintenance mode and artist-specific email templates, retaining core WooCommerce transactional emails, password resets, account registrations, and customer reviews.
- **WordPress Integration**:
  - Retained native WordPress media library handling without custom physical placement overrides.
  - Implemented headless Bricks Builder content endpoints (`/wp-json/exacoat/v1/pages` and `/wp-json/exacoat/v1/pages/{slug}`).
