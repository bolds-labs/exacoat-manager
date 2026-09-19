# Changelog

All notable changes to the Exacoat Manager ERP workstation and the `exacoat-core` WordPress plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.64] - 2026-09-20

### Multi-Zone Free Shipping Threshold Persistence & 3-Zone Architecture Consolidation
- **Free Shipping Threshold Save & Persistence Fix**:
  - Fixed issue where updating shipping zone thresholds (e.g. United States from 50 to 30) did not persist when saved.
  - Merged posted values with existing settings in `sanitize_settings()` so partial form submissions do not overwrite unposted configuration.
  - Implemented bi-directional synchronization between `exacoat_core_settings` and legacy `artmatter_core_settings` with recursion guard (`self::$is_syncing`).
  - Added option synchronization across both `add_option_*` and `update_option_*` hooks.
  - Deferred disabling of form submit buttons via `setTimeout` to prevent browser aborts of HTTP POST requests.
  - Added tab state persistence via `sessionStorage` and URL hash (`#shipping`) so the active settings tab is preserved across form redirects.
- **Consolidation to Official Exacoat Shipping Zones**:
  - Replaced legacy 10-region Artmatter presets with Exacoat's 3 official shipping zones:
    1. `indonesia`: Country `ID`, Currency `IDR`, Free shipping threshold: `300,000`.
    2. `united_states`: Country `US`, Currency `USD`, Free shipping threshold: `30`.
    3. `default`: Country `*`, Currency `USD`, Free shipping threshold: `50`.
  - Updated default configurations in both `class-store-enhancements.php` and `ShippingSettingsSection.tsx`.
- **Decoupled Regional Free Shipping Engine**:
  - Confirmed and documented independent package country evaluation (`$package['destination']['country']`).
  - Adding specific country regions (e.g. `SG` with `SGD 30`) immediately applies direct thresholds without requiring WooCommerce shipping zones or exchange rate decimal artifacts.
- **Order Thumbnail Filters for WooCommerce**:
  - Filtered order item thumbnails in WooCommerce admin and transactional emails to display custom configured skins.

## [0.0.63] - 2026-09-20

### Exacoat Brand Voice System Prompt, Custom Model Entry & Direct AI Fetch
- **Exacoat Brand Voice System Prompt**:
  - Overhauled collection description prompt in `AiToolsPage` to strictly reflect Exacoat's brand voice.
  - Purged all legacy references to classical art, museum prints, and artists.
  - Strictly banned exclamation marks and fake sci-fi buzzwords (e.g. "aerospace-grade metal", "revolutionary shield").
  - Grounded descriptions in real tactile and visual traits: precision fit, scratch defense without added bulk, and authentic material finishes (matte, textured, brushed, satin).
  - Automatically sanitizes and upgrades legacy prompts stored in browser cache and WordPress database.
- **Custom Model Entry & gpt-5 Prioritization**:
  - Added "+ Custom Model" action toggle and text input under both OpenAI and Gemini selectors, allowing operators to type and apply any model (e.g. `gpt-5.6-terra`, custom fine-tunes, or private endpoints).
  - Prioritized `gpt-5*` models at the top of the OpenAI dropdown with a `Next-Gen` badge.
  - Removed restrictive regex filters so all generative models returned by the API are displayed.
- **Direct Client Fetch Fallback**:
  - Updated `testOpenAiDirect` and `testGeminiDirect` to query provider endpoints directly when an API key is present in the client, ensuring live models are pulled even if the remote WordPress staging server has an older plugin version.
  - Implemented `/fandom/generate` backend route in `class-exacoat-core.php` with direct client-side generation fallback in `generateFandomDescriptionAi`.

---

## [0.0.62] - 2026-09-20

### Dynamic AI Model Pulling & Latest Model Integration
- **Dynamic Model Retrieval for Google Gemini and OpenAI**:
  - Added dynamic model fetching in `AiToolsPage` for both Gemini and OpenAI with dedicated "Pull Latest" action buttons.
  - Dual-source key resolution: queries WordPress backend diagnostic endpoints (`/diagnostics/test-gemini` and `/diagnostics/test-openai`), allowing models to be retrieved whether API keys are entered directly in the UI or securely stored on the server via `wp-config.php` (`EXACOAT_GEMINI_API_KEY`, `EXACOAT_OPENAI_API_KEY`).
- **Smart Model Filtering & Capability Sorting**:
  - OpenAI models: parsed from `/v1/models` and filtered strictly for generative chat and reasoning models (`gpt-4o`, `gpt-4o-mini`, `o3-mini`, `o1`, `gpt-4.5-preview`, `gpt-4-turbo`), while excluding non-generative models (embeddings, audio, whisper, tts, moderation).
  - Gemini models: parsed from `/v1beta/models`, stripped of `models/` prefix, filtered for `generateContent`, and ordered with latest 2.5 and 2.0 models at the top (`gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`).
- **Enhanced Select Badges & Subtitles**:
  - Added descriptive badges (`Pro 2.5`, `Flash 2.5`, `Flash 2.0`, `Lite 2.0`, `Reasoning`, `Flagship`, `Fast`, `Preview`, `Active`) and explanatory subtitles in `CustomSelect` options for easy model identification.
  - Model selection automatically persists to WordPress options via `savePluginSettings`.

---

## [0.0.61] - 2026-09-20

### Order List Status Column Streamlining & RMA Claims Infinite Loop Fix
- **Order List Status Column Cleanup**:
  - Removed redundant "Redeem" and "Warranty Claim" badges from the Status column in `OrderTable`, as these badges are already clearly displayed in the primary Order Number column.
  - Keeps the Status column strictly focused on actual order fulfillment states (e.g. processing, completed, cancelled, store pickup).
- **RMA & Redeem Claims Re-render Loop Fix**:
  - Resolved infinite re-fetch and loading spinner flicker on `RmaClaimsPage`.
  - Root cause: `analyticsData` state was included in the `loadClaims` callback dependency array; setting analytics data on each fetch recreated `loadClaims` and immediately triggered another fetch cycle.
  - Decoupled `analyticsData` from `loadClaims` dependencies and introduced `analyticsFetchedRef` to track one-time background analytics loading.

---

## [0.0.60] - 2026-09-20

### Marketplace SLA Deadline Guarding & Hourly Courier Time Slots
- **Marketplace SLA Deadline Enforcement**:
  - Added real-time shipping deadline banner (`shipDeadline`) to `ArrangeShipmentModal` based on Shopee `ship_by_date` and `ship_by_timestamp`.
  - Enforced deadline guarding on pickup dates: disabled "Besok" if the deadline expires today or before tomorrow morning pickup.
  - Enforced deadline guarding on pickup time slots: disabled any courier or fallback slots that start after the order's deadline with a `⚠️ (Lewat Batas Kirim)` warning badge.
  - Auto-selects the earliest valid non-expired time slot and date.
- **Instant Courier Same-Day Policy**:
  - For Instant couriers (e.g. SPX Instant), restricted pickup scheduling strictly to "Hari Ini" and disabled tomorrow options.
- **Hourly Fallback Time Windows**:
  - Added granular 1-hour interval slots (e.g. `12:00 - 13:00`, `13:00 - 14:00`, `14:00 - 15:00`) to the fallback time selection list.
  - Enabled detection of past elapsed hours today so operators cannot select time slots that have already passed.
- **Address-Level Slot Resolution**:
  - Added `time_slot_list` parsing from `ShopeePickupAddress` (`address_list[].time_slot_list`), ensuring couriers that return slots scoped to warehouse addresses are correctly detected.

---

## [0.0.59] - 2026-09-20

### Configurable Pickup Scheduling & Staging Environment Enforcement
- **Configurable Pickup Date & Time Window**:
  - Replaced static fallback in `ArrangeShipmentModal` with a unified 2-column selector for Tanggal Pickup and Rentang Waktu.
  - Tanggal Pickup dynamically maps available dates from Shopee API, or defaults to configurable Today/Tomorrow selectors.
  - Rentang Waktu allows operator selection across courier time slots or standard working windows (09:00 - 12:00, 12:00 - 15:00, 13:00 - 17:00, 17:00 - 20:00 WIB).
  - Added visual helper indicator for Instant couriers (e.g. SPX Instant).
- **Backend Permissions & Staging Routing**:
  - Updated `check_admin_permission` in `class-shopee-client.php` and `class-tiktok-client.php` to authorize Exacoat Manager REST calls.
  - Enforced `staging.exacoat.com` backend across Vite proxies, WordPress base URL fallbacks, and video proof URL normalization.
  - Enhanced `ship_order` in `class-shopee-client.php` to auto-resolve default pickup address ID if missing and sanitize empty time slot parameters.

---

## [0.0.40] - 2026-09-19

### Server-Side Courier Filtering, Amber Print Labels & Role Access
- **Server-Side Courier & Status Filtering**:
  - Added courier parameter handling to `/exacoat/v1/orders` REST route across `woocommerce_order_items` and order carrier metadata (`carrier_id`, `_tracking_provider`, `_artmatter_tracking_info`).
  - Added courier keyword matching for POS Indonesia, JNE, Goorita, Lion Parcel, SiCepat, J&T, Biteship, and Store Pickup.
  - Returns exact `total_orders` and `max_pages` for filtered order queries.
  - Synchronized client `OrderTable` and `OrdersView` pagination calculations so filtered views display accurate order ranges (e.g. Showing 1 to 3 of 3 orders).
- **Print 4x6 Label Styling**:
  - Updated 4x6 shipping label buttons to display an amber accent with a status dot when unprinted.
  - Switches to normal grey once clicked or printed, with cross-component event broadcasting across table rows, mobile cards, and order details.
- **WordPress Role Sync & Shop Manager Restrictions**:
  - Synchronized WordPress administrator and shop_manager accounts with Manager ERP team roles.
  - Restricted shop_manager operators to orders management only.
- **Document Template Streamlining**:
  - Removed redundant billing/shipping duplicate sections, QC check, and picking footer blocks from customer invoice and packing slip templates.

---

## [0.0.39] - 2026-09-19

### RMA Duplicate Claim Admin Override & Packing Slip Enhancements
- **RMA Duplicate Claim Admin Override**:
  - Added "Allow duplicate claim (Admin Override)" checkbox to `ManualWarrantyModal` when an external marketplace invoice has already been claimed or redeemed under a prior replacement order.
  - Added "Allow secondary RMA claim (Admin Override)" toggle for existing WooCommerce orders that were previously processed for an RMA replacement.
  - Enabled authorized operators to submit replacement orders even if prior orders exist (e.g., for multi-item orders, staging test orders, or customer service approved exceptions).
  - Enhanced backend `Exacoat_Warranty_Manager::rest_create_manual_claim` to accept `allow_duplicate` and `override_duplicate` parameters.
  - Stored `_rma_duplicate_override = 'yes'`, `_rma_prior_order_number`, and logged an audit note in order history when an override is authorized.
- **Packing Slip Customization Summary Fix**:
  - Corrected `ItemCustomizationSpec` array formatting in `PackingSlipModal` print templates and interactive previews.
  - Rendered clean dot-separated attribute summaries (Back, Frame, Camera, Model, Texture) for precision skins.

---

## [0.0.38] - 2026-09-19

### Decimal Psychological Rounding & Exacoat Skin Pricing Alignment
- **Decimal Psychological Rounding Engine**:
  - Implemented `90_decimal` (.90 suffix, e.g. 129K IDR converts to $14.90 USD).
  - Implemented `99_decimal` (.99 suffix, e.g. $14.99 USD) and `50_decimal` (.50 step, e.g. $14.50 USD).
  - Configured USD, EUR, AUD, SGD, GBP, CAD, CHF, and HKD to default to `90_decimal`.
  - Preserved zero-decimal step rounding for IDR, JPY (`50_step`), KRW (`500_step`), and THB (`90_end`).
  - Updated `Exacoat_Store_Enhancements::get_currency_decimals()` to return 2 decimals for decimal regimes and 0 for zero-decimal currencies.
- **Admin Settings & Simulator Alignment**:
  - Added decimal regimes (`90_decimal`, `99_decimal`, `50_decimal`) to `$allowed_roundings` in `Exacoat_Admin_Settings::sanitize_settings()`.
  - Updated simulator base price input to 129,000 IDR with presets calibrated for Exacoat skins: 129K (Base Skin), 149K (Full Skin), 199K (Tablet Skin), and 299K (Laptop Skin).
  - Updated currency conversion JavaScript to render 2 fixed decimal places for decimal currencies (`$14.90`).
  - Added decimal rounding options to both the PHP currency table and the client-side row generator (`addCurrencyRow`).
- **Headless Checkout & Free Shipping Refinement**:
  - Updated `Exacoat_Checkout_Engine::get_headless_checkout_config()` to preserve 2 decimal places for decimal currencies in `thresholds_by_currency`.
  - Aligned default zone free shipping thresholds with Exacoat skin order values (Domestic IDR 300,000, US $50, Asia SGD 60, Europe EUR 50, Australia AUD 75, UK GBP 40, Default USD 60).

---

## [0.0.37] - 2026-09-19

### Multi-Currency Matrix & Free Shipping Threshold Admin Controls
- **Interactive Multi-Currency Exchange Rates & Price Matrix**:
  - Integrated dedicated "Store & Currency" (`pane-currency`) navigation pane in the Exacoat Core WordPress admin dashboard.
  - Added real-time Base Price FX simulator with quick presets (350K, 450K, 750K, 1.2M) and live converted chip grid reflecting safety markup multiplier (+15% default) and psychological rounding.
  - Added interactive Currencies Table with inline code, symbol, exchange rate vs IDR, and psychological rounding rules: `9_end`, `90_end`, `50_step`, `500_step`, and `none`.
  - Added dynamic row addition (`+ Add Custom Currency`) and deletion.
- **Interactive Multi-Zone Free Shipping Thresholds Table**:
  - Added dedicated Multi-Zone Free Shipping card in `pane-shipping` with target shipping method IDs configuration (`shipping_target_method_ids`).
  - Added dynamic Regional Thresholds table allowing administrators to configure zone names, country codes, target currency selector, 100% free qualification threshold, and courier filter matches.
  - Added dynamic region addition (`+ Add Shipping Region`) and deletion.
- **WordPress Options Sanitization & Persistence**:
  - Enhanced `Exacoat_Admin_Settings::sanitize_settings` to validate and persist `currency_global_markup`, `currency_rates`, `shipping_target_method_ids`, and `shipping_zones` under `exacoat_core_settings`.
  - Wrapped admin panes in primary options form (`options.php`) with header and in-card "Save Changes" triggers.
  - Added automated memoized settings cache clearing on option update.

---

## [0.0.36] - 2026-09-19

### Wishlist Engine Purge, Multi-Currency Rounding & Free Shipping Engine
- **Complete Wishlist Purge**:
  - Permanently removed legacy `class-wishlist-engine.php`, `wishlist-engine.css`, and `wishlist-engine.js` from the codebase.
  - Purged "Customer Wishlist Engine" cards, module statuses, and REST routes from WordPress admin `settings-page.php`.
- **Multi-Currency Pricing & Psychological Rounding Matrix (1:1 with artmatter-core)**:
  - Synchronized `calculate_price_for_currency` with full psychological rounding rules: `9_end`, `90_end`, `500_step`, `50_step`, and `none`.
  - Configurable global markup (`currency_global_markup`) and currency rates registry for USD, EUR, AUD, SGD, JPY, GBP, CAD, CHF, HKD, THB, and KRW.
  - Automatic WooCommerce product meta synchronization (`_regular_currency_prices` and `_sale_currency_prices`) compatible with Aelia Currency Switcher.
- **Multi-Zone Free Shipping Threshold Contract**:
  - Wired `/checkout/config` REST endpoint to return `free_shipping_threshold`, `thresholds_by_currency`, and `shipping_zones` across both `exacoat-core/v1` and `exacoat/v1` namespaces.
  - Direct integration powering headless storefront Cart Drawer and Checkout Free Shipping progress bars.
  - Package rate discount filter applying 100% Free Shipping (`$rate->cost = 0`, `is_free_shipping`, `original_cost`) when qualified.

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
