# Changelog

All notable changes to the Exacoat Manager ERP workstation and the `exacoat-core` WordPress plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.40] - 2026-09-24

### 1-Year Store Credit Expiration Lifecycle & Pre-Expiry Warnings
- **1-Year Expiration Integration (`Exacoat_Store_Credit_Manager`)**:
  - Configured 1-year individual FIFO store credit expiration calculated from the completion date of each qualifying cashback order.
  - Added timestamp and human-readable expiry metadata to orders (`_exacoat_cashback_expiry_ts`, `_exacoat_cashback_expiry_date`).
  - Added 30-day pre-expiry warning Action Scheduler job (`pre_expiry_30d`) enqueued for 335 days post-grant, triggering an urgency email to drive repeat purchases before expiration.
- **Email Template & Manager Preview Enhancements (`Exacoat_Email_Engine` & Manager ERP)**:
  - Updated `customer_cashback_earned` and `customer_store_credit_reminder` templates to prominently display 1-year validity and exact expiration dates.
  - Updated client-side email previewer in Exacoat Manager (`#emails`) with 1-year validity copy and preloaded expiration defaults.

## [0.1.39] - 2026-09-24

### Store Credit & Cashback Email Overrides via ZeptoMail
- **Native Cashback Email Templates (`Exacoat_Email_Engine`)**:
  - Registered `customer_cashback_earned` in the universal transactional email engine, dispatched whenever an order earning cashback reaches completion.
  - Registered `customer_store_credit_reminder` in the universal transactional email engine, dispatched to remind customers of their available store credit balance.
  - Implemented `render_store_credit_html()` featuring the official Exacoat brand logo SVG, prominent store credit balance display, order reference pill badge, and direct call-to-action button linking to the storefront.
- **Store Credit & Cashback Subsystem (`Exacoat_Store_Credit_Manager`)**:
  - Automatically suppresses default unstyled WooCommerce emails registered by Advanced Coupons for WooCommerce (`acfw_store_credit_reminder_email`, `acfw_store_credit_email`, `customer_store_credit`), ensuring 100% of store credit communications route through Zoho ZeptoMail API.
  - Added order completion hook (`woocommerce_order_status_completed`) with deduplication locks (`_exacoat_cashback_email_sent`) to prevent duplicate notices.
  - Implemented dynamic order cashback resolution (`resolve_order_cashback`), inspecting order metadata and ACFW coupon definitions.
  - Integrated Action Scheduler (`exacoat-store-credit` queue) for an automated 7-day follow-up reminder (`exacoat_send_store_credit_reminder_job`), evaluating positive balance and recent purchase activity.

## [0.1.38] - 2026-09-24

### Hardware Body Colors UX Streamlining & CORS-Safe Color Detection
- **Configurator Studio Hardware Body Colors (`src/pages/ConfiguratorStudioPage.tsx`)**:
  - Removed redundant hex text input field on the left side of the wand button; manual adjustments are cleanly handled via the native color swatch picker.
  - Implemented `sanitizeHexForColorInput()` helper across all color picker inputs, preventing browser console warnings (`The specified value "#f" does not conform to the required format`) when partial hex values are handled.
  - Resolved browser CORS policy blocks (`net::ERR_FAILED`) and canvas security taint on dominant color detection by routing chassis image sampling through `loadCorsSafeImageBlobUrl()` and the WordPress image proxy.
  - Added automatic color detection on chassis image input blur and media library selection when color is unconfigured or default.
- **CORS Image Loader Optimization (`src/lib/imageLoader.ts`)**:
  - Optimized `loadCorsSafeImageBlobUrl()` to intelligently bypass direct cross-origin static fetches for WordPress uploads (`/wp-content/uploads/`), routing directly through `/wp-json/exacoat-core/v1/image-proxy` to prevent noisy browser console CORS errors.

## [0.1.37] - 2026-09-24

### Hardware Body Colors Enhancement & Resilient Canvas Rendering
- **Hardware Body Colors in Configurator Studio (`src/pages/ConfiguratorStudioPage.tsx`)**:
  - Added visual image thumbnail preview (11x11) for every color variant with direct click-to-browse WordPress Media Library.
  - Implemented automatic dominant color extraction (`detectDominantColorFromImage`) from uploaded chassis renders, sampling the median interquartile luminance band to capture authentic paint hues (e.g. `#ee7e40` for Cosmic Orange, `#3a3f4f` for Sierra Blue) with manual hex override and 1-click re-sampling wand button.
  - Added HTML5 drag-and-drop reordering with vertical grip handles (`GripVertical`), drag-over line feedback, and precision Up/Down chevron buttons.
  - Added active preview toggle button and status pill, allowing operators to click any color card in the list to immediately render it on the viewport canvas.
  - Added broken-link tracking (`failedColorImages`) and a red "404 Not Found" badge on cards when asset URLs fail to load.
- **Resilient Viewport Canvas Layer 1 Rendering**:
  - Replaced catastrophic `<img onError>` display collapse with graceful fallback to the viewing angle's base chassis background (`currentView.background_url`).
  - Added informative canvas alert badge when a color variant 404s, ensuring the device body remains visible at all times.

## [0.1.36] - 2026-09-24

### Brand Favicon Suite & Web App Manifest
- Generated complete multi-resolution favicon suite from master logo asset (`P:\EXACOAT\Logo Images\New Logo\Logo V5\Exacoat Manager Favicon.png`):
  - `favicon.ico` containing 4 embedded 32-bit ARGB resolutions (16x16, 32x32, 48x48, 64x64).
  - High-precision Lanczos PNG derivatives: `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`, `apple-touch-icon.png` (180x180), `android-chrome-192x192.png`, and `android-chrome-512x512.png`.
  - Added `public/site.webmanifest` and updated `index.html` with modern browser and mobile icon links.

## [0.1.27] - 2026-09-24

### Outside Click Modal Dismissal, Issues Popover Fix & Studio Engine Column Removal
- **Universal Outside Click Modal Dismissal**:
  - Configured backdrop and wrapper click dismissal across the entire Exacoat Manager interface:
    - Base Modal component (`src/components/ui/Modal.tsx`): Added `onClick={onClose}` to both outer flex wrapper and dark backdrop, stopping propagation on dialog cards. Closes all 15+ modals using `Modal.tsx` on outside click.
    - Command Palette (`src/components/layout/CommandPalette.tsx`): Added backdrop click dismissal.
    - Refund Overlay (`src/components/orders/OrderDetailDrawer.tsx`): Added outside click dismissal.
    - Materials Stock Page (`src/pages/MaterialsStockPage.tsx`): Added outside click dismissal for Add Finish and Edit Material modals.
    - Reviews Page (`src/pages/ReviewsPage.tsx`): Added outside click dismissal for full-size photo and video media lightbox.
    - Configurator Studio (`src/pages/ConfiguratorStudioPage.tsx`): Added outside click dismissal across all 15 inline dialogs (Catalog Asset Audit, Master Textures, Image Picker, Add New Finish, Delete Finish Confirmation, Quick Price Edit, Duplicate Product, Find & Replace in URLs, Texture Map Edit, Asset Integrity Audit, 3D Shading Extractor, Group Display Settings, Presets Manager, Per-Device Curated Look Edit, and Transfer Setup / JSON Modal).
- **Studio Table Issues Popover Alignment Fix (`src/pages/ConfiguratorStudioPage.tsx`)**:
  - Anchored the issues hover popover to `left-2 top-full` instead of `left-1/2 -translate-x-1/2`, styled with `w-80 max-w-[calc(100vw-3rem)]`.
  - Prevents the popover from overflowing the left boundary of the first column, resolving table overflow-x clipping.
- **Engine Column Removal from Studio Catalog Table (`src/pages/ConfiguratorStudioPage.tsx`)**:
  - Removed the obsolete "Engine" column header and table cell, simplifying the catalog overview.

## [0.1.26] - 2026-09-24

### iPad Skin Alpha Masks Configuration & Tablet Texture Scales (110% Ultra / 120% Standard)
- **iPad Alpha Mask Configuration (`mask_svg_url`)**:
  - Populated authentic 200 OK alpha cut masks (`mask_svg_url`) across all 15 iPad products and keyboard accessories in both `layer.assets_by_view[view_id]` and `layer.mask_svg_url`.
  - Solved the issue where iPad skin layers rendered blank in the v2 canvas engine due to missing alpha masks:
    - iPad Pro 2020 (#334335), M1 (#334392), and M2 (#446933): Configured `iPad-Pro-2020-Skins-Matte-Black.png` (Back), `iPad-Pro-2020-Side-Matte-Black.png` (Sides), and `iPad-Pro-2020-Accents-Matte-Black.png` (Accents).
    - iPad Pro M4 (#516605) and M5 (#539802): Configured `iPad-Pro-2024-M4-Skins-Matte-Black.png` (Back), `iPad-Pro-2024-M4-Sides-Skins-Matte-Black.png` (Sides), and `iPad-Pro-2024-M4-Accents-Matte-Black.png` (Accents).
    - iPad Air 4 / 5 (#339317), Air M2 (#521095), Air M3 (#529234), and Air M4 (#540536): Configured `iPad-Air-4-Skins-Matte-Black.png` (Back), `iPad-Air-4-Side-Skins-Matte-Black.png` (Side), and `iPad-Air-4-Accents-Matte-Black.png` (Accents).
    - iPad Mini 6 / 7 (#361082): Configured `iPad-Mini-6-Skins-Matte-Black.png` (Back), `iPad-Mini-6-Side-Matte-Black.png` (Side), and `iPad-Mini-6-Accents-Matte-Black.png` (Accents).
    - iPad Pro 2018-2019 (#311643): Configured `iPad-Pro-2018-Skins-Matte-Black.png` (Back).
    - Magic Keyboard iPad Pro M4 & M5 (#516583): Configured `Magic-Keyboard-iPad-M4-Skins-Black-Camo.png` (Top + Bottom) and `Magic-Keyboard-iPad-M4-Palm-Rest-Skins-Black-Camo.png` (Palm Rest).
    - Magic Keyboard iPad Air M2, M3, M4 (#541664): Configured `Magic-Keyboard-iPad-Air-Skins-Black-Camo.png` (Top + Bottom) and `Magic-Keyboard-iPad-M4-Palm-Rest-Skins-Black-Camo.png` (Palm Rest).
    - Smart Keyboard Folio (#446787) & Magic Keyboard iPad Pro M2 (#362642): Maintained authentic cut masks and verified 100% 200 OK responses.
- **Galaxy Tab & Book Cover Texture Scale Synchronization**:
  - Ultra Models (110% / `1.10`): Configured `texture_scale = 1.10` on profile and all views for Galaxy Tab S8 Ultra (#422869), S9 Ultra (#513783), S10 Ultra (#521363), and their Book Cover Keyboard accessories (#422911, #513811, #521362).
  - Standard, Plus, and FE Models (120% / `1.20`): Configured `texture_scale = 1.20` on profile and all views for Galaxy Tab S7 / S7+, S7 FE, S8, S8+, S9, S9 FE+, S9+, S10+, S10 FE, and their Book Cover accessories.
  - iPads (120% / `1.20`): Configured `texture_scale = 1.20` on profile and all views across all 15 iPad products.
- **Backend Invariant (`class-configurator-engine.php`)**:
  - Updated `rest_save_product_configurator` to automatically fall back to the WordPress post title (`$post->post_title`) and slug (`$post->post_name`) when `device_name` or `device_slug` is omitted or empty in incoming save payloads.

## [0.1.25] - 2026-09-24

### Master Texture Pattern Tiling, Issue Details Breakdown & Tablet/Foldable Shading Defaults
- **Master Texture Seamless Pattern Tiling Reversion (`ConfiguratorStudioPage.tsx`, `stacked-layer-canvas.tsx`)**:
  - Restored seamless pattern tiling (`createPattern(texImg, 'repeat')`) for master materials, reverting the non-alpha bounding box cover stretching that enlarged repeating pattern tiles (e.g. Swarm, Black Camo) on smartphones like iPhone 17 Pro.
  - Pattern tiles now repeat naturally at authentic physical density according to angle texture scale.
- **Detailed Issue Breakdown & Interactive Inspection in Studio Table (`ConfiguratorStudioPage.tsx`, `class-configurator-engine.php`)**:
  - Added `_configurator_audit_details` WordPress post meta persistence in `class-configurator-engine.php` and returned `audit_details` in `rest_get_configurator_profiles`.
  - Upgraded the status column in the Configurator Studio table from an ambiguous dot into interactive status pills (`[✓ Clean]`, `[! X issues]`, `[Unaudited]`).
  - Implemented a rich hover popover detailing the exact broken assets (e.g. broken chassis URL, missing alpha cut mask) and ghost angles.
  - Added 1-click inspection: clicking the issue badge loads the device in the editor and opens the Asset Integrity Audit dialog with 1-click cleanup actions (e.g. Remove Ghost Angle, Clear Broken Texture).
  - Probed and synced all 71 staging products previously marked with issues: verified 64 false positives as Clean and recorded detailed issue breakdowns for the 7 products with real broken assets.
- **Disabled Generated 3D Shading for Tablets, iPads, Keyboards & Foldables**:
  - Updated 33 tablet, iPad, and foldable models on staging with `generated_shadow.enabled = false`.
  - Updated code-level fallback defaults in `ConfiguratorStudioPage.tsx` and `stacked-layer-canvas.tsx` so tablets, iPads, keyboards, and foldables default `shouldApplyGeneratedShadow` to `false` when no authentic 3D shading file exists.

## [0.1.23] - 2026-09-23

### Resilient Audit Probing & Xiaomi Pad Side View Cleanup
- **Audit Probe Resilience & False-Positive Elimination (`ConfiguratorStudioPage.tsx`)**:
  - Implemented an in-flight URL session cache (`probedUrlCacheRef`) during catalog audits to eliminate duplicate requests for shared assets (chassis renders, brand logos, and perimeter frame masks), reducing network hit volume by ~40% to 60%.
  - Increased image probe timeout from 7s to 12s and added an automatic retry with a 500ms delay before declaring an image broken, eliminating false-positive 404/broken errors caused by temporary browser socket exhaustion.
  - Reduced worker concurrency from 6 to 4 per device and introduced a 40ms pacing delay between products to prevent exhausting browser HTTP connection pools and triggering CDN/LiteSpeed burst throttling.
  - Added a 12s timeout guard to profile fetch requests in catalog audits to eliminate hanging or frozen scans.
  - Added an operator "Stop Audit" control in the global audit progress bar to allow immediate, graceful cancellation.
  - Ensured single-device audits invalidate cached probe entries for the target device to guarantee live re-verification.
- **Xiaomi Pad Side View Removal**:
  - Cleaned configurator profiles for all Xiaomi Pad models (#540777 Xiaomi Pad 8 / 8 Pro, #487486 Xiaomi Pad 6 / 6 Pro, and #396113 Xiaomi Pad 5 / 5 Pro), removing the obsolete `side_view` and `sides` layer.
  - Verified that all remaining assets across these models return HTTP 200 OK.
  - Confirmed that tablet side views are strictly reserved for iPad Pro models with flat-edge aluminum wrap skins.

## [0.1.22] - 2026-09-23

### Streamlined Asset Integrity Audit for v2 Modern Engine
- **v2 Asset Pipeline Probing (`ConfiguratorStudioPage.tsx`)**:
  - Streamlined both single-device and catalog-wide Asset Integrity Audits to probe the true v2 rendering pipeline: hardware chassis renders (`background_url`), body color variants (`device_colors`), skin layer alpha cut masks (`mask_svg_url`), cutout masks (`logo_cutout_mask_url`, `pencil_cutout_mask_url`, `model_cut_mask_url`), and overlays (`shadow_png_url`, `highlight_png_url`).
  - Standard finishes inherit from global master textures in v2; eliminated probing obsolete finish slices, reducing probe volume by ~85% (~6-10 assets per device down from 60+) and preventing false-positive empty texture warnings.
  - Dedicated custom finishes (`is_custom_per_device`) and legacy v1 finish slices continue to be audited thoroughly.
- **Accurate Ghost Angle Detection**:
  - Enhanced ghost angle evaluator: a viewing angle is classified as a ghost angle only if its chassis render is missing or broken (404) AND it contains 0 active skin alpha cut masks or custom textures.
  - If an angle has active skin alpha masks but a broken chassis image, it is treated as a broken asset needing URL correction rather than a ghost angle, preventing accidental deletion of valid viewing angles.
- **Enhanced Audit UI & Color-Coded Badges**:
  - Upgraded audit modal UI with distinct, color-coded badges for each asset type: Chassis Render, Body Color, Skin Cut Mask, Cutout Mask, Overlay, Custom Artwork, and Legacy Texture.
  - Updated empty counter label from "Empty Mappings" to "Empty Assets".

### Model Coverage Disabling & Clearing Architecture
- **Model Coverage Disabling Resolution (`ConfiguratorStudioPage.tsx`, `class-configurator-engine.php`)**:
  - Resolved race condition in the Studio toggle by upgrading `handleSetCoverageAndCutouts` to use a functional state updater and support atomic batch patches.
  - Corrected backend auto-healing in `rest_get_product_configurator()` to honor `coverage_type = 'none'` as an intentional administrator setting rather than overwriting it back to `model_cut_and_360`.
- **Perimeter Mask Clearing Resolution**:
  - Upgraded the Clear button to completely clear `model_cut_mask_url` across all views and purge `model_cutout_url` and `has_model_cut` from `coverage_and_cutouts`.
  - Updated `rest_save_product_configurator()` to prevent reviving cleared mask URLs from legacy fallback keys.

## [0.1.20] - 2026-09-23

### Layer Finish Restrictions & Whitelist Precedence
- **Material Availability Whitelist Precedence (`configurator-loader.ts`)**:
  - Enforced strict whitelist priority for `allowed_finish_slugs` over default `allowed_finish_groups`, preventing restricted materials from exposing unselected catalog finishes.
  - Added slug normalization to ensure punctuation parity (`black-camo` vs `black_camo`).
- **Model Coverage Architecture in Studio Cutouts**:
  - Restored Model Coverage under the Cutouts tab in Configurator Studio.
  - Automated auto-healing in `class-configurator-engine.php` to promote smartphones to `model_cut_and_360` with authentic perimeter frame masks.
- **Hardware Production Variants Extraction**:
  - Ensured physical dimensions/connectivity are placed in variants rather than composable skin layers.
  - Standardized accent rotation to 0 degrees catalog-wide.

## [0.1.14] - 2026-09-21

### Advanced Coupons Cashback & Store Credit Display Invariants
- **Store Credit Raw HTML Display Resolution (`account-dashboard.tsx`)**:
  - Identified and resolved raw HTML string output (`<span class="woocommerce-Price-amount amount">...`) on the Store Credit account page.
  - Advanced Coupons Store API `balance_text` is formatted via WooCommerce `wc_price()`, returning escaped HTML tags.
  - Switched customer account dashboard to strictly render numeric `credit.balance` formatted via `formatOrderMoney(credit.balance, currency)`, achieving full parity with Artmatter.
- **Cashback Discount Type Alignment (`class-customer-auth.php`, `class-checkout-engine.php`)**:
  - Discovered root cause of cashback coupons decreasing price totals: coupons configured as `'percent'` discount type trigger WooCommerce core percentage deductions.
  - In Advanced Coupons, true cashback coupons must be configured with `discount_type = 'acfw_percentage_cashback'`, which applies 0 discount to the cart total and credits store credit upon order delivery.
  - Updated staging coupon `cashback10` to `acfw_percentage_cashback`.
  - Aligned `is_cashback` evaluation in `class-customer-auth.php` and `class-checkout-engine.php` to strictly inspect `false !== strpos( $discount_type, 'cashback' ) || 'yes' === get_post_meta( $id, '_is_coupon_cashback', true )`.
  - Refined headless checkout coupon filtering and calculation (`checkout-review.tsx`) to prioritize server-evaluated `exacoatCoupon.is_cashback`.

## [0.1.13] - 2026-09-21

### Custom Device Finishes 100% Texture Scale Invariant
- **Locked 100% Scale for Custom Device Finishes (`ConfiguratorStudioPage.tsx`)**:
  - Custom device finishes (uploaded per device template, such as Everything Skins or custom limited edition artwork) are now strictly locked to 100% texture scale (`textureScale = 1.0`).
  - Angle Texture Zoom / Scale (e.g. 75% for repeating patterns) continues to scale pattern materials (leather, matte, carbon, camo) without shrinking or tiling custom device-aligned artwork.
  - Added dedicated `100% Scale` badge and interactive click-to-preview capability in the "Custom Device Finishes" sidebar panel.
  - Updated helper description under the "Angle Texture Zoom / Scale" slider to clarify that custom device finishes always render at 100% scale regardless of the viewing angle slider.
- **Headless Storefront & Composite Image Parity (`exacoat-web`)**:
  - Added `isCustomPerDevice` flag propagation in `configurator-loader.ts` and `configurator-types.ts`.
  - Upgraded `stacked-layer-canvas.tsx` to automatically render custom device finishes at 100% scale.
  - Upgraded cart/order composite image generator (`device-skin-configurator.tsx`) to lock custom device finishes to 100% scale with 1.0 fallback zoom.

## [0.1.12] - 2026-09-21

### Advanced Coupons, Store Credits & Cashback Engine Parity
- **Robust Cashback Coupon Recognition (`class-checkout-engine.php`, `class-customer-auth.php`)**:
  - Upgraded cashback coupon evaluation across Store API cart extensions (`exacoat_coupons` / `artmatter_coupons`) and `/auth/coupons` endpoint.
  - Detects Advanced Coupons cashback offers configured with standard `'percent'` or `'fixed_cart'` discount types by inspecting `_is_coupon_cashback`, `_acfw_cashback_waiting_period`, and code nomenclature.
  - Implemented percentage-based calculation (`$cart_subtotal * ($amount / 100.0)`) and maximum discount cap enforcement (`_acfw_percentage_discount_cap`) for accurate rewards calculations.
- **Store Credit Stacking Lockout Exemption (`class-review-manager.php`)**:
  - Exempted virtual store credit coupons (`'store credit'`, `'store-credit'`, `'store_credit'`) from `prevent_coupon_stacking()`.
  - Customers can now seamlessly apply store credit alongside promotional discounts and single-use Exacoat Perks review coupons without triggering Exception 109.
- **Decoupled Store API Callbacks & Session Sync (`class-checkout-engine.php`)**:
  - Replaced legacy `artmatter_store_credit_*` error codes with `exacoat_store_credit_*` and updated localization text domain to `exacoat-core`.
  - Automatically synchronizes authenticated customer ID to `WC()->customer` during Store API extension updates when cart sessions start anonymously.
- **Headless Storefront UI Parity (`exacoat-web/components/checkout/checkout-review.tsx`)**:
  - Added One-Click Apply promotional cards parsed from `acfwp_block.one_click_apply.notices` with direct 1-click application.
  - Added interactive `+{cashbackPercent}% Cashback` badge and popover terms tooltip to applied coupon items.
  - Added "Cashback earned" summary line item in the price calculations breakdown with delivery maturation terms.
  - Strongly typed `AdvancedCouponExtensions` and cleaned `any` casts on `StoreCart`.

## [0.1.11] - 2026-09-21

### Brand Isolation & Complete Legacy Reference Decoupling
- **Customer Reviews Engine Migration (`class-review-manager.php`)**:
  - Migrated central reviews database table from `wp_artmatter_reviews` to `wp_exacoat_reviews` with automatic table rename migration in `check_table_schema()`, ensuring zero data loss for existing review submissions.
  - Upgraded schema version key to `exacoat_reviews_schema_version` with fallback to `artmatter_reviews_schema_version`.
  - Updated review uploads storage folder to `wp-content/uploads/exacoat-reviews/`.
  - Migrated review invitation Action Scheduler jobs to `exacoat_send_review_invitation_job` under queue `exacoat-reviews`, retaining backward-compatible event listener for in-flight tasks.
  - Migrated order review metadata to `_exacoat_review_invited_at`, `_exacoat_review_invite_scheduled_at`, `_exacoat_has_review`, `_exacoat_review_id`, and `_exacoat_review_reward`, maintaining backward-compatible fallback readers for legacy order records.
  - Registered primary review REST routes under `exacoat-core/v1/reviews/*` and reward settings under `exacoat_review_reward_settings`.
- **Core Subsystem Class Prioritization (`class-exacoat-core.php`, `class-wc-biteship-shipping-method.php`)**:
  - Prioritized `Exacoat_*` subsystem classes (`Exacoat_Diagnostics`, `Exacoat_Email_Engine`, `Exacoat_Logger`, `Exacoat_Checkout_Engine`, `Exacoat_Store_Enhancements`) across plugin bootstrap, REST endpoints, and Biteship shipping calculations.
  - Cleaned image proxy allowed hosts to Exacoat domains (`exacoat.com`, `www.exacoat.com`, `cms.exacoat.com`, `media.exacoat.com`, `staging.exacoat.com`).
  - Updated textdomain from `artmatter-core` to `exacoat-core` in `class-wc-biteship-shipping-method.php`.
- **Checkout Templates & Shortcodes Modernization**:
  - Updated checkout templates (`form-checkout.php`, `form-pay.php`, `review-order.php`, `thankyou.php`) header comments, textdomains, and engine references to Exacoat standards.
  - Registered `[exacoat_order_tracking]` and `[exacoat_track_order]` shortcodes, and updated admin AJAX actions in `settings-page.php` to `exacoat_*`.
- **Frontend Hygiene & Asset Cleanup**:
  - Purged obsolete legacy Artmatter exports in `brandAssets.ts` and `logo.ts`.
  - Cleaned `imageLoader.ts` to request `exacoat-core/v1` proxy endpoints.
  - Updated storage keys in `auditLogger.ts` and `ThemeContext.tsx`, and removed unused CSS classes in `index.css`.
  - Updated `docker-compose.yml` service and container name to `exacoat-manager`.
  - Purged obsolete external reference documentation and n8n files.

## [0.1.10] - 2026-09-21

### Fulfillment & Multi-Zone Shipping Region Persistence Fix
- **Eliminated Premature Form Closure in Admin Settings (`settings-page.php`)**:
  - Replaced nested `<form id="form-whatsapp-settings">` inside the outer `<form id="exacoatSettingsForm">` with a `<div id="form-whatsapp-settings">`.
  - Resolved browser HTML parser issue where the inner form closing tag prematurely terminated `exacoatSettingsForm` at line 1145, leaving the entire Fulfillment & Shipping pane orphaned outside any form element.
  - Refactored WhatsApp AJAX settings save handler to construct `FormData` directly from the div container elements.
- **Explicit HTML5 Form Ownership on All Shipping Inputs**:
  - Attached explicit `form="exacoatSettingsForm"` to all shipping method and shipping zone table inputs (both PHP rendered and dynamically created JavaScript rows in `window.addShippingZoneRow`).
  - Added hidden `shipping_zones_present` sentinel so region modifications and total region deletions are saved reliably in `sanitize_settings()`.
- **Unconditional Click Handlers on Action Buttons**:
  - Bound direct inline `onclick="window.addShippingZoneRow()"` to `+ Add Shipping Region` and `onclick="window.addCurrencyRow()"` to `+ Add Custom Currency` to safeguard against deferred `DOMContentLoaded` script timing.
  - Added dynamic counter badge recalculation (`#shipping-zones-count-badge`) upon adding or deleting shipping region rows.
  - Implemented robust `document.readyState` check on script initialization.

## [0.1.09] - 2026-09-21

### Critical Syntax Fix in Configurator Engine
- **Resolved Fatal PHP Parse Error on Line 2404 (`class-configurator-engine.php`)**:
  - Restored missing closing brace for `if ($product)` block within `rest_get_product_configurator`, which had caused an unexpected token error on the subsequent `public static function rest_save_product_configurator` declaration.
  - Eliminated the 500 critical error on staging WordPress environment (`https://staging.exacoat.com`).

## [0.1.08] - 2026-09-21

### Login Page Revamp, Official Exacoat Brand Logo & Phone Model Variant Elimination
- **Login Page Revamp & Official Exacoat Logo Adoption**:
  - Replaced legacy generic `EX` square text box with the official Exacoat vector logo component (`ExacoatLogo.tsx`) identical to `exacoat-web`, featuring authentic wordmark typography and registered trademark circle-R glyph.
  - Copied standalone vector asset to `public/assets/brand/exacoat-logo.svg` for static asset referencing.
  - Updated `Sidebar.tsx` brand header to display the official Exacoat logo alongside the ERP version badge.
  - Revamped `LoginPage.tsx` with luxury dark obsidian workstation aesthetic (`#060608`), ambient gold illumination, `SectionPill` status badge, password visibility eye toggle, Chakra Petch typography, and high-contrast amber action buttons with loading indicators.
- **Elimination of Phone Model Production Variants (Strict Device Separation)**:
  - Enforced domain invariant: iPhones and smartphones are always cataloged as separate individual products in WooCommerce (e.g. iPhone 17 Pro Skins and iPhone 17 Pro Max Skins are separate items), and must never have model production variants combining two different phones.
  - **Configurator Engine Updates (`class-configurator-engine.php`)**:
    - Updated `convert_mkl_to_profile` to discard legacy model selector layers on phone devices, preventing them from being converted into variants.
    - Upgraded `sanitize_variants` with device family and context parameters to automatically detect and prune any phone model variants or options (`17 Pro`, `Pro Max`, `iPhone`, etc.).
    - Updated `rest_get_product_configurator`, `rest_save_product_configurator`, and `rest_sync_device_families` to auto-heal and strip phone model variants catalog-wide.
  - **Configurator Studio Updates (`ConfiguratorStudioPage.tsx`)**:
    - Added `sanitizeDeviceVariants` helper across profile loading, v2 conversion, save, and the Settings tab.
    - Added operator guidance in the Production Variants card clarifying that phones are separate products and physical cut variants are reserved for tablets (e.g. iPad Wi-Fi vs Cellular).

## [0.1.07] - 2026-09-21

### Full Catalog Synchronization & MacBook/iPad Discovery (249 Configurators)
- **Resolved Missing MacBooks, iPads, and Keyboards**:
  - Expanded active device configurators from 215 to 249 across the entire store catalog.
  - Discovered and fully restored all 26 MacBooks (Macbook Air 11", 13" M1-M5, 2012-2020, and Macbook Pro 13", 14", 15", 16" M1-M5), 15 iPads (iPad Pro M1-M5, iPad Air M2-M4, iPad Mini), and Magic Keyboards in Configurator Studio.
- **Root Cause Resolution in Configurator Engine (`class-configurator-engine.php`)**:
  - **MKL Layers Evaluation**: Updated `is_product_configurator` to check `_mkl_product_configurator_layers` and `_mkl_pc__is_configurable` instead of legacy non-existent `_layers` key.
  - **Stub Profile Auto-Healing**: Enhanced `rest_get_configurator_profiles` and `rest_get_product_configurator` to detect stub profiles that lack customizable layers (`empty($profile['layers'])`), automatically converting full views, layers, and cutouts from legacy MKL definitions and persisting healed profiles to WordPress post meta.
  - **Multi-Pass JSON Unescaping (`parse_meta_json`)**: Enhanced parser with multi-pass stripslashes loop to safely decode double-escaped quotes (`\"`) and slashes from WordPress post meta without premature break.
- **Catalog-Wide Batch Migration & Clean Non-Configurator Scoping**:
  - Migrated and healed all 33 previously unmigrated devices with 100% active layers, appropriate device families (`laptop`, `tablet`, `keyboard`), and standard `2.0x` size multipliers.
  - Confirmed 0 configurators have 0 layers across the entire 249-device catalog.
  - Cleanly flagged 35 genuine non-configurators (Heritage Skins, Titanium+ Kits, Sienna, G.64, Limited Drops, Screen Protectors, Standalone Accessories) with `_is_configurator: 'no'`, preventing catalog pollution.

## [0.1.06] - 2026-09-21

### Multi-Attribute Device Family Inference & Universal Size Pricing Multipliers
- **Multi-Attribute Device Family Inference Engine (`infer_device_family`)**:
  - Implemented multi-attribute heuristic regex engine analyzing product name, slug, and category taxonomy hierarchy to classify device families and assign correct pricing size multipliers:
    - **Tablets** (`/\b(tab|pad|surface pro|surface go|tablet|ipad)\b/i`): family `'tablet'`, multiplier `2.0x`. Corrects Galaxy Tab (S10 Ultra, S9+, S8, etc.), Xiaomi Pad, and Microsoft Surface devices previously misclassified as phones.
    - **Laptops** (`/\b(macbook|xps|laptop|notebook|zenbook|thinkpad|blade|surface laptop|surface book|realme book|galaxy book|redmibook)\b/i`): family `'laptop'`, multiplier `2.0x`.
    - **Foldables** (`/\b(fold|flip|razr)\b/i`): family `'foldable'`, multiplier `1.3x`. Corrects Galaxy Z Fold and Flip devices.
    - **Keyboards** (`/\b(keyboard|folio|book cover)\b/i`): family `'keyboard'`, multiplier `2.0x`. Corrects Magic Keyboard and Book Cover accessories.
    - **Consoles** (`/\b(deck|rog ally|legion go|switch|playstation|ps5|ps4|xbox|console)\b/i`): family `'console'`, multiplier `2.0x`.
    - **Smartphones**: family `'phone'`, multiplier `1.0x`.
  - Audited all 215 catalog products: accurately classified 18 tablets, 5 laptops, 9 keyboards, and 12 foldables with zero false positives.
- **REST Auto-Healing & Central Database Sync**:
  - Auto-heals legacy profiles on demand in `rest_get_configurator_profiles` and `rest_get_product_configurator`, persisting corrected family and size multiplier to WordPress post meta (`_is_configurator_profile`).
  - Added dedicated endpoint `POST /wp-json/exacoat-core/v1/configurator/sync-device-families` to perform catalog-wide family and size multiplier updates in a single atomic operation.
- **Configurator Studio Sync & Selection Controls**:
  - Added "Sync Families" quick-action button in the Configurator Studio catalog toolbar with real-time feedback toast.
  - Expanded Device Family dropdown in Studio Settings to support all 7 families (`phone` 1.0x, `tablet` 2.0x, `laptop` 2.0x, `foldable` 1.3x, `keyboard` 2.0x, `console` 2.0x, `accessory` 0.8x).
- **Storefront Fallback & High-Resolution Asset Scaling (`exacoat-web`)**:
  - Added client-side and server-side fallback `inferWebDeviceFamily` in `lib/server/configurator-loader.ts` to ensure tablets, foldables, and laptops always receive correct pricing size multipliers even before background database sync.
  - Updated `isLargeDevice` in `device-skin-configurator.tsx` and `stacked-layer-canvas.tsx` to include `tablet_laptop`, `keyboard`, `console`, and any device with `size_multiplier >= 1.5`, ensuring proper high-res texture sizing across all large form factors.

## [0.1.05] - 2026-09-21

### Seamless Master Texture Tiling, Configurable Generated Shading & Soft Ambient Drop Shadows
- **Seamless Master Texture Tiling (`createPattern`)**:
  - Replaced single `drawImage` with `ctx.createPattern(texImg, 'repeat')` and `DOMMatrix` rotation and scaling across both `exacoat-manager` and `exacoat-web`.
  - Ensures master finishes seamlessly tile to fill the entire 1000x1000 canvas area prior to `destination-in` alpha mask clipping, permanently resolving horizontal and vertical clipping on accent strips and edge wraps (e.g. Galaxy S25 / S24 accents spanning Y=8 to Y=991).
  - Includes robust geometric bounding box fallback if pattern creation fails.
- **Configurable Generated 3D Directional Shading**:
  - Inverted default directional shadow vector from top-left to bottom-right (+distance, +distance) so inner bevels and cutout holes (such as camera rings and ports) naturally cast shadows downwards and rightwards.
  - Replaced binary pixel offset subtraction with smooth Gaussian blur (`filter: blur(...)`), producing soft, photorealistic ambient contact bevels.
  - Added interactive **Generated 3D Directional Shading** settings card under "Angle 3D Shading & Highlights" in Configurator Studio with live on/off toggle and custom sliders:
    - Shadow Softness (1px to 16px, default 6px).
    - Shadow Distance (1px to 10px, default 3px).
    - Shadow Opacity (0% to 100%, default 40%).
    - Specular Highlight Opacity (0% to 100%, default 25%).
    - Direction toggle (Bottom-Right standard vs Top-Left inverted).
    - One-click reset to recommended defaults.
- **Soft Omnidirectional Ambient Drop Shadow**:
  - Softened canvas drop shadow for all skin layers to `filter drop-shadow-[0_0_1.5px_rgba(0,0,0,0.28)]` with zero offset.
  - Directional inner shading is strictly scoped to primary body skin layers, preventing secondary accent and camera trim strips from receiving harsh directional shading.

## [0.1.04] - 2026-09-21

### Universal v2 Migration, Synthetic Directional Shading & Catalog Case Isolation
- **Universal Catalog v2 Migration (100% v2 Modern Engine)**:
  - Migrated Galaxy S25+ (`#523445`) to modern v2 with authentic `Galaxy-S25-Shadows.png`, `Galaxy-S25-Skins-Matte-Black.png`, rotated accents (90 deg), and `Galaxy-S25-Camera-Matte-Black.png`.
  - Migrated Galaxy S24+ (`#508106`) with authentic `Galaxy-S24-Shadows.png` and masks inherited from Galaxy S24 (`#508107`).
  - Migrated all 126 remaining legacy v1 device skins across the entire WooCommerce catalog to modern v2, extracting layer alpha masks directly from `matte-black` skin assets and pruning redundant legacy slice texture maps.
  - Verified catalog status: 215 active configurators on v2 (100% of device catalog, 0 remaining on v1).
- **Synthetic Directional Edge Shading Engine**:
  - Implemented real-time dynamic canvas shading (`applySyntheticDirectionalShading`) across both `exacoat-web` (`stacked-layer-canvas.tsx`) and `exacoat-manager` (`ConfiguratorStudioPage.tsx`).
  - For devices without pre-baked 3D raytraced shadow maps (`!hasViewShadow`), automatically simulates top-left incident studio lighting:
    - Specular rim highlight on top and left edges (`screen` blend mode, opacity 0.35).
    - Inner drop shadow on bottom and right edges (`multiply` blend mode, opacity 0.55).
  - Eliminates flat appearances on legacy devices while preserving baked 3D raytraced shadows for models with dedicated shadow PNGs.
- **Catalog Scope & Dusk Hybrid Case Isolation**:
  - Excluded 19 Dusk Hybrid Case items from active configurators (`_is_configurator: 'no'`), keeping Configurator Studio focused strictly on customizable skin devices.
- **Storefront Edge Cache Revalidation**:
  - Dispatched full catalog revalidation across Next.js and Cloudflare edge networks via `/wp-json/exacoat-core/v1/configurator/revalidate-web`.

## [0.1.03] - 2026-09-21

### Configurator Asset Discrepancy Repair, Sibling Inheritance, and Model 360° Unicode Sanitization
- **Authentic Asset Resolution for iPhone 16 Pro & iPhone 16 Pro Max**:
  - Replaced legacy iPhone 15 Pro visual fallback assets with verified authentic iPhone 16 Pro renders and masks across Product `#521962` (iPhone 16 Pro) and Product `#522046` (iPhone 16 Pro Max).
  - Configured authentic View Background (`iPhone-16-Pro-Body.png`), 3D Shadows (`iPhone-16-Pro-Shadows.png`), Logo Cutout (`iPhone-16-Pro-Logo.png`), and Model Cutout Frame (`iPhone-16-Pro-Frame.png`).
  - Mapped authentic alpha masks: Back (`iPhone-16-Pro-Skins-Matte-Black.png`), Accents (`iPhone-16-Pro-Accents-Matte-Black.png` with 90-degree rotation), and Additional Camera (`iPhone-16-Pro-Camera-Matte-Black.png`).
- **Sibling Device Visual Setup Inheritance**:
  - Synchronized sibling models that share identical physical CAD/device dimensions directly to modern v2 engine:
    - Galaxy S26+ (`#540514`) inherited Galaxy S26 (`#540510`) visual setup.
    - iPhone 16 Plus (`#524074`) inherited iPhone 16 (`#524020`) visual setup.
    - iPhone 17e (`#541338`) inherited iPhone 16e (`#529006`) visual setup.
    - iPhone 15 Pro Max (`#486198`) and iPhone 15 Plus (`#486197`) inherited iPhone 15 Pro / iPhone 15 visual setups.
    - iPhone 14 Pro Max (`#439872`) and iPhone 13 Pro Max (`#361888`) inherited iPhone 14 Pro / iPhone 13 Pro visual setups.
- **Model 360° Unicode Sanitization & Legacy Variant Elimination**:
  - Identified root cause of `Model 360u00b0`: legacy MKL `model` variants containing unescaped `\u00b0` unicode sequences that were stripped by WordPress `wp_unslash()`.
  - Updated `sanitize_variants()` in `class-configurator-engine.php` and `wordpressBridge.ts` to automatically strip redundant `model` variants (since coverage is handled first-class via `coverage_and_cutouts`) and sanitize any remaining `u00b0` sequences to `°`.
  - Used `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES` wrapped in `wp_slash()` during JSON serialization in WordPress master plugin to permanently preserve degree symbols.
  - Executed catalog-wide database migration repairing 152 products; verified 0 corrupted degree occurrences remaining catalog-wide.
- **Storefront Curated Presets ("Shop the Look") Hygiene**:
  - Updated `effectivePresets` evaluation in `exacoat-web` (`device-skin-configurator.tsx`) to strictly return device-specific presets (`data.v2Profile?.presets`).
  - Completely eliminated fallback to global mock presets, ensuring the "Shop the Look" floating action button and modal are cleanly hidden on devices with 0 configured presets.
  - Purged Cloudflare cache and revalidated Next.js cache for `/product/iphone-16-pro-skins`.

## [0.1.02] - 2026-09-21

### Configurator Studio Setup Transfer, Portable JSON Profiles & Storefront Catalog Hygiene
- **Configurator Studio Setup Transfer Engine**:
  - Added dedicated **Transfer Setup / JSON** modal in Configurator Studio top bar.
  - **Copy To Device**: Seamlessly clone the active device visual configuration (views, 3D raytraced lighting, alpha masks, skin layers, texture rotation, and curated looks) into any other existing device in the WooCommerce catalog (e.g. Galaxy S26 to Galaxy S26+), strictly preserving the target product's unique Product ID, Name, Slug, Base Price, Currency, and Categories.
  - **Copy From Device**: Load and adopt any existing device setup as a template directly into the active studio workspace for real-time visual preview before saving.
  - **Selective Element Cloning**: Checkbox toggles for Views & 3D Lighting, Skin Layers & Cutouts, Curated Looks / Presets, Device Family & Multiplier, and Color Variants.
  - **Export Profile JSON**: 1-click formatted JSON profile export (`{device_slug}-profile.json`) and instant clipboard copying with visual confirmation.
  - **Import Profile JSON**: Drag-and-drop or paste raw JSON profiles into the editor with optional identity protection toggle (`importPreserveTargetMeta`).
- **Storefront Catalog & Search Hygiene (iPhone 18 Pro Purge)**:
  - Discovered and eliminated hardcoded phantom devices (`iphone-18-pro-max-skins`, `iphone-18-pro-skins`, `iphone-18-skins`) from `category-fallbacks.json` and `search-catalog.ts` in `exacoat-web`.
  - Purged dummy product `#542251` (iPhone 18 Pro Max Skins) from WooCommerce staging database.
  - Deployed verified typechecked fix to `exacoat-web` main branch.

## [0.1.01] - 2026-09-21

### Batch v2 Modern Engine Migration: 3D Shadows, Alpha Masks & Accents Rotation
- **Batch v2 Configurator Upgrade**:
  - Migrated 73 device product models catalog-wide on `https://staging.exacoat.com` to the modern v2 compositing engine (`configurator_version: 'v2'`).
- **View-Level 3D Raytraced Shadows**:
  - Configured each device view with its uploaded 3D shadow render URL (`https://staging.exacoat.com/wp-content/uploads/<filename>`) across `shadow_png_url` and `shading_image_url`.
  - Set default realistic shadow multiply opacity (0.85) and screen highlight opacity (0.35).
  - Multi-view devices (MacBook Pro 14" M1, MacBook Pro 16" M1, Xiaomi Pad 8) mapped with view-specific precision (`bottom_view`, `main_view`).
- **Alpha Mask Inheritance from Matte Black**:
  - Replaced legacy per-finish bitmap dictionaries with clean alpha masks (`mask_svg_url`) derived from each layer's `matte-black` PNG asset.
  - Cleared legacy `render_texture_map` so all standard and premium finishes dynamically inherit high-resolution master textures clipped via canvas `destination-in`.
- **Accent Layer 90-Degree Texture Rotation**:
  - Automatically applied `texture_rotation: 90` to all `accents` layers to create visual directional contrast against the primary back skin.
  - Preserved camera plate covers (`additional-camera`, `camera-panel`), back skins, and laptop chassis layers at 0 degrees.

## [0.0.98] - 2026-09-21

### Per-Device Presets ("Shop the Look") Architecture & Visual Cards Redesign
- **Strict v1 Configurator Isolation**:
  - Global finish presentation settings (`group_settings`: compact dots, collapsible drawers, custom visible limits) strictly shielded to `isV2 === true`.
  - Legacy v1 configurators continue rendering standard tactile swatch cards without modification.
- **Presets Modal Visual Image Cards Redesign**:
  - Removed all recipe text clutter (titles, descriptions, coverage tags, recipe text chips) from modal.
  - Visual grid of device image cards dressed in exact skin combinations via `<StackedLayerCanvas compactPreview={true}>` or custom preview renders.
  - Added high-contrast badge pills (`POPULAR`, `STAFF PICK`) on top-left of image cards.
  - Replaced primary yellow button with a clean secondary button underneath each card labeled `"Apply Look"` / `"✓ Applied"`.
- **Deterministic Layer Matching**:
  - Replaced substring fuzzy matching with exact key matching first (`normKey === layerId || normKey === layerClass || normKey === layerSlug || normKey === layerNameLower`), eliminating duplicate label collisions (e.g. "Additional Camera & Back Glass" colliding with "Camera").
- **Per-Device Presets Authoring in Configurator Studio**:
  - Dedicated **Presets** tab in Configurator Studio Inspector panel.
  - Add / edit modal supporting Title, Badge dropdown (`None`, `POPULAR`, `STAFF PICK`), Coverage, Logo Cutout, per-layer finish selectors, and optional preview image URL.
  - 1-click **"Use Canvas Look"** button to capture current live simulator selections into a preset.
  - 1-click **"Test"** button to preview presets on the live simulator canvas immediately.
  - Persisted per-device into WordPress post meta `_exacoat_configurator_profile`.
- **Configurator Catalog Table Presets Column**:
  - Added **Presets** column to the Configurator catalog table displaying the number of active looks on each device (`{n} Looks` or `0`).

## [0.0.97] - 2026-09-21

### Swatch Sizing (40x40px), Mobile Alignment & Model 360 Extra Price Resolution
- **Compact Dot Sizing (40x40px) & Expander Height**:
  - Compact finish dots are sized to exactly `40x40px` (`w-[40px] h-[40px]`), enclosed within a minimum 44px by 44px tap hitbox (`min-w-[44px] min-h-[44px] p-0.5`) to satisfy mobile touch accessibility standards.
  - The inline `+x more` / `Less` expander button uses the exact same `40px` height (`h-10` / `h-[40px]`), ensuring visual uniformity with adjacent circular swatches.
  - In mobile carousel card view (`lg:hidden`), the `+x more` button container matches the height of the swatch capsule image (`h-[50px] sm:h-[54px] flex items-center justify-center`), vertically centering the expander pill with the swatches image of the card.
- **Model 360 Upcharge Resolution & Persistence Invariant**:
  - When a device enables Model 360 frame wrap (`coverage_type === 'model_cut_and_360'`), the upcharge is configured in `model_360_extra_price` (standard IDR 40,000).
  - Studio Persistence: In `ConfiguratorStudioPage.tsx`, both `handleSaveProfile` and `handleSetCoverageAndCutouts` ensure `model_360_extra_price` is explicitly stored as a numeric value in post meta rather than remaining undefined.
  - Backend Defaulting: In WordPress plugin `class-configurator-engine.php`, both `rest_get_product_configurator` and `rest_save_product_configurator` validate and default `model_360_extra_price` to 40000 when missing or non-numeric.
  - Storefront Resolution: In `device-skin-configurator.tsx`, `model360ExtraPrice` resolves via `typeof raw360 === "number" ? raw360 : 40000`. Authentic CMS prices (including explicit 0 for free wrap) are respected, while legacy unpersisted profiles default safely to standard 40,000 IDR.

## [0.0.96] - 2026-09-21

### Dynamic Finish Group Presentation, Shop the Look Presets & Custom Limits
- **Dynamic Group Presentation Engine**:
  - Configurable display style (`compact_dots` vs `cards`), collapsible drawer mode, and custom visible item limits (`show_more_limit`).
  - Added custom numeric limit input with quick preset badges (3, 4, 6, 8, 12, All) in Materials & Finishes Inventory modal.

## [0.0.95] - 2026-09-21

### Configurator Metadata Physical Hierarchy & Universal Configured Skin Image Display
- **Layer & Metadata Physical Hierarchy Invariant**:
  - Replaced arbitrary alphabetical attribute and addon sorting with physical device hierarchy:
    1. Primary base skin (Back Skin, Top Lid, Main Body) strictly on top (Line 1).
    2. Secondary physical components (Camera, Additional Camera & Back Glass, Accents, Frame, Hinge) at Line 2+.
    3. Configuration options (Coverage, Logo Cutout, Stylus Cutout) at the bottom.
  - Implemented `sort_addon_layers` in `class-configurator-engine.php` to sort WooCommerce cart items and order line item metadata.
  - Implemented `sortItemSpecs` in `orderItems.ts` to ensure Exacoat Manager Order Detail drawers, packing slips, and shipping labels render Back Skin on top.
- **Universal Configured Skin Image Display Pipeline**:
  - Registered dual `/configurator/composite/upload` and `/composite/upload` REST endpoints in `class-configurator-engine.php` with open CORS headers.
  - Line items in `enrichOrder` (`wordpressBridge.ts`) dynamically extract `_configured_image_url`, `_configurator_image`, `_thumbnail_url`, and `image_url` into `item.image_url` so the Order Detail drawer displays the configured skin thumbnail.
  - Preserved permanent composite image URLs across all media helpers, cart drawers, checkout reviews, order confirmations, and transactional emails.

## [0.0.94] - 2026-09-21

### Finish Group Renaming, UI Beautification & 0.22mm Physical Skin Micro-Shadow
- **Finish Group Renaming Architecture**:
  - Implemented `POST /wp-json/exacoat-core/v1/finishes/rename-group` in `class-configurator-engine.php`.
  - Atomically renames groups in `_exacoat_finish_groups` while migrating all assigned finishes in `exacoat_global_finishes` from `old_name` to `new_name`.
  - Automatically dispatches Next.js storefront revalidation (`tag=finishes`).
  - Added frontend bridge `renameFinishGroupDirect` and interactive inline editing on group chips in Configurator Studio's Group Management Tray.
- **Master Textures Form Controls & UI Beautification**:
  - Upgraded all form inputs in Master Textures finish cards to meet Antislop UI standards:
    - Finish name inputs: styled with dark inner background, refined border, and focus ring.
    - Group selector: customized container with explicit `ChevronDown` dropdown indicator.
    - Extra price input: financial input pill with `+IDR` prefix badge.
    - Active / Inactive and In Stock / Out of Stock toggles: glowing status dots with subtle glassmorphic borders.
    - "Custom per device": replaced default HTML checkbox with an animated toggle switch.
    - Storefront Badge: composer pill with circular color swatch picker and uppercase badge preview.
    - 3D Shading Sliders: percentage indicators and sleek track styling.
    - Media texture slots: glass border with emerald "Assigned" status dot.
- **0.22mm Physical Skin Micro-Shadow Invariant**:
  - Calibrated the physical skin edge drop shadow from `drop-shadow-[0_1px_2.5px_rgba(0,0,0,0.55)]` down to `drop-shadow-[0_0.75px_1.5px_rgba(0,0,0,0.38)]` across both `exacoat-web` storefront canvas and `exacoat-manager` Studio viewport.
  - Accurately represents real 0.22mm vinyl thickness and eliminates dark halo smudges around light skins and cutout edges.

## [0.0.93] - 2026-09-21

### Master Textures Batch Save & Automated Storefront Revalidation
- **Unified Dirty Tracking & Footer Controls**:
  - Implemented centralized dirty tracking (`isFinishDirty` and `dirtyFinishes`) across all master finish editing states (texture URLs, thumbnails, names, groups, prices, stock, active status, badges, shadow opacities, highlight opacities).
  - When unsaved modifications exist, the Master Textures modal footer displays an animated amber indicator (`{count} finish(es) with unsaved changes`), a "Cancel" button to discard uncommitted changes, and a "Save All Changes ({count})" button.
  - When all changes are saved or clean, the modal footer displays the standard "Done" button.
- **Individual Card Save State Cleanup**:
  - Saving an individual finish card via `handleSaveMasterFinish` now cleanly purges that finish from all editing maps upon success, instantly transitioning the card button from "Save Changes" to "Saved".
  - Replaced inline duplicated dirty check on cards with `isFinishDirty(f)` for consistent state synchronization across the studio.
- **Automated Storefront Cache Revalidation**:
  - `rest_save_finish` and `rest_save_all_finishes` in `class-configurator-engine.php` now automatically dispatch cache revalidation requests (`tag=finishes`, `path=/api/configurator/finishes`) to the Next.js storefront (`web.exacoat.com`).
  - Finishes in v2 Modern Engine are globally inherited: modifying master finishes automatically updates all store configurators without requiring individual product revalidation.

## [0.0.92] - 2026-09-21

### Finish Group Persistence & Preservation Fix in Master Textures
- **Empty & Custom Group Preservation Invariant**:
  - User-created finish groups (such as newly added groups like "Other" or custom brand lines) are permanently preserved in the WordPress database option `_exacoat_finish_groups`, even if they currently contain 0 assigned finishes.
  - Fixed backend `Exacoat_Configurator_Engine::get_finish_groups()` which previously pruned any group not actively present in `$active_groups`, causing newly added groups to vanish immediately upon moving or saving.
  - Restricted pruning exclusively to obsolete legacy sample default groups (`Pastels & Colors`, `Special editions`) when empty.
- **Studio Group Management Tray Enhancements**:
  - Synchronized `res.groups` response across `handleAddNewGroup`, `handleMoveGroup`, and `handleDeleteGroup`.
  - Added live finish count badges (`(0)`, `(5)`) next to each group chip in the Group Management tray.
  - Added 1-click empty group deletion (`handleDeleteGroup`), while guarding against deleting groups that still contain active finishes.
  - Updated Master Textures filter tabs to include all stored finish groups, with a clean empty state card displayed when viewing groups with 0 finishes.

## [0.0.91] - 2026-09-21

### Strict Separation of Production Variants from Logo Cutouts & Coverage Options
- **Strict Separation Invariant**:
  - Production variants (`variants`) are strictly reserved for physical hardware models requiring distinct vinyl cut templates (e.g. Wi-Fi vs Cellular, or Surface Pro models).
  - Logo Cutouts and Coverage Styles (Model Cut vs Model 360) are managed exclusively by `coverage_and_cutouts`, eliminating duplicate +IDR 0 variant rows in Studio Settings and Pricing.
- **Backend Sanitization (`sanitize_variants`)**:
  - Added `Exacoat_Configurator_Engine::sanitize_variants()` in `class-configurator-engine.php` to filter out any variant whose ID or name matches `logo`, `cutout`, `coverage`, or `model cut`.
  - Applied `sanitize_variants` across legacy MKL conversion (`convert_mkl_to_profile`), profile fetch (`rest_get_product_configurator`), and profile persistence (`rest_save_product_configurator`).
- **Bridge & Studio Alignment**:
  - Removed legacy hardcoded pushing of `logo_cutout` and `coverage` into `convertedVariants` in `wordpressBridge.ts`.
  - Added frontend variant sanitization across `fetchProductConfiguratorProfileDirect`, `saveProductConfiguratorProfileDirect`, and Studio profile lifecycle (`handleOpenDevice`, `handleConvertToV2`, `handleSaveProfile`).
  - Added filter guard in Studio Pricing Settings tab and simulator dock so legacy cache artifacts never render "Logo Cutout" as production variant rows or price differentials.

## [0.0.90] - 2026-09-21

### Legacy v1 Read-Only Protection, Convert to v2 Engine, Standardized 2.0x Multiplier & Production Variants UI
- **Legacy v1 Read-Only Safeguard**:
  - Locked all legacy v1 configurator devices in Read-Only Mode (`configurator_version !== 'v2'`) to prevent unintended mutation or corruption of live WooCommerce MKL settings powering `web.exacoat.com`.
  - Replaced header "Save Configurator" action with "Convert to v2 Modern Engine" and added an amber notice banner above the device viewport.
- **Convert to v2 Modern Engine & Optional 3D Shadows Workflow**:
  - Implemented 1-click in-memory conversion upgrading `configurator_version` to `'v2'`, normalizing laptop/tablet size multipliers to 2.0x, and unlocking studio editing.
  - In v2 Modern Engine, 3D shadows are completely optional: if no shadow PNG is uploaded (`shadow_png_url`), devices render cleanly without shadow until CAD renders become available.
- **Standardized 2.0x Size Multiplier for Laptops and Tablets**:
  - Standardized size multiplier to `2.0` across all laptops and tablets (replacing legacy `2.5` and `1.8`), establishing uniform +IDR 60,000 premium material up-prices across the webstore and Studio simulation.
  - Updated in PHP backend (`convert_mkl_to_profile`, `rest_get_configurator_profiles`), TypeScript bridge (`wordpressBridge.ts`), and Studio device initialization (`handleOpenDevice`, `handleConvertToV2`).
- **Production Variants UI Overhaul**:
  - Completely redesigned production variants from raw cramped input boxes into a clean, modern card interface with index badges (`#1`), group name inputs, option index pills, formatted price differential inputs (`+IDR [amount]`), and dashed "+ Add Cut Option" action buttons.
- **v1 MacBook Neo Apple Logo Overlay & Viewport Parity**:
  - Restored missing Apple logo on MacBook Neo (`#542139`) and other v1 devices in the viewport canvas by rendering the v1 logo cutout overlay image (`Macbook-Neo-Logo.png` at z-index 35) on top of the vinyl skin when logo cutout is enabled.
  - Synchronized Logo Cutout toggle in the simulator dock bidirectionally with device variants.
- **Views Tab v1 Hygiene**:
  - Strictly hid "Angle 3D Shading & Highlights" and "Angle Texture Zoom / Scale" controls when inspecting v1 devices, eliminating irrelevant controls.

## [0.0.89] - 2026-09-21

### Finish Texture Reordering within Groups & Global Finish Deactivation (is_active)
- **Finish Texture Reordering within Groups**:
  - Implemented Move Up and Move Down controls on every finish card within the Master Textures modal.
  - Finishes are ordered strictly by explicit numeric sequence within their respective group, ensuring custom arrangements (such as placing Forged Carbon immediately after Black Camo) persist directly to WordPress database options.
  - Storefront engine (`configurator-loader.ts`) now sorts swatches inside each group strictly by `(a.order ?? 0) - (b.order ?? 0)`, perfectly mirroring the Studio arrangement on customer-facing configurators.
- **Global Finish Deactivation (`is_active`)**:
  - Added global activation toggle (`is_active`) across WordPress backend (`class-configurator-engine.php`), bridge (`wordpressBridge.ts`), and storefront engine (`configurator-loader.ts`).
  - Added 1-click Active / Inactive status toggle button on each finish card in Master Textures and Materials & Stock.
  - Deactivated finishes are completely hidden from customer-facing configurators while remaining visible to store admins in Master Textures with a distinct Inactive status pill for immediate re-activation.
  - Added status filtering tabs (All, Active, Inactive) with live counts to the Master Textures modal header.
- **REST Endpoints & Database Invariants**:
  - Registered `POST /wp-json/exacoat-core/v1/finishes/toggle-active` for fast optimistic toggle synchronization.
  - Updated `rest_save_finish` and `rest_save_all_finishes` to preserve `is_active` and `order` properties without data loss.
  - Updated `get_finishes()` to guarantee fallback defaults for legacy finishes.

## [0.0.88] - 2026-09-21

### Finish-Level 3D Shading Tone, Highlight Single-Source Fallback, Master Textures Row Overhaul & White Cutout Slots
- **Specular Highlight Single-Source Shading Fallback**:
  - Fixed highlight not rendering on storefront canvas and composite generator by adding fallback to `shadowSrc` (`currentView.highlight_png_url || shadowSrc`). Single universal shading maps now properly project specular screen highlights when highlight opacity is set.
- **Finish-Level 3D Shading & Specular Lighting Controls**:
  - Added `shadow_opacity` and `highlight_opacity` to `GlobalFinish` in database, REST API (`rest_save_finish`), and storefront types (`GlobalFinishItem`, `ConfiguratorChoice`).
  - Operators can now fine-tune shadow multiply depth and screen highlight intensity individually per color/finish directly in Master Textures (v2).
  - Live storefront canvas (`stacked-layer-canvas.tsx`), composite generator (`device-skin-configurator.tsx`), and Studio viewport automatically evaluate finish-level shading tone with fallback to angle defaults.
- **Master Textures Modal Finish Row Overhaul**:
  - Completely redesigned finish rows into structured, clean cards with zero clutter.
  - Distinct Header (Swatch mini, Name, Group select, Slug, Stock toggle pill, Surcharge input, Delete, and Save button).
  - Content Grid: 3 clearly defined Media Texture Slots (Swatch, Master v2, Big Texture) and a dedicated 3D Shading Tone tuning card (Shadow Multiply and Highlight Screen sliders with real-time percentage indicators).
  - Bottom Options Bar: Storefront badge configuration (text, color, preview) and "Custom per device" toggle.
- **High-Contrast White Background for All Cutout Preview Buttons**:
  - Updated Model Cut Perimeter Mask, Logo Cutout Mask, and Custom / Stylus Cutout Mask thumbnail preview buttons to bright white background (`bg-white border-white/20 shadow-sm`) with dark icons, ensuring transparent black cutout paths remain clearly visible.

## [0.0.87] - 2026-09-21

### Universal View-Level 3D Shading, White Preview Thumbnail Slot & Layer Shading Pruning
- **Universal View-Level 3D Shading & Storefront Precedence**:
  - Unified 3D shading and highlights to the view/angle level (`currentView.shadow_png_url` and `currentView.shading_image_url`).
  - Resolved frontend update issue: storefront canvas and add-to-cart composite generator now prioritize universal view-level shading over stale legacy per-layer assets.
  - Automatically prune obsolete per-layer shading from layers in state and in `rest_save_product_configurator` on save.
- **White Background Clickable Shading Thumbnail Slot in Studio**:
  - Removed "Extract from Render" and "Use Base" buttons and raw URL text inputs.
  - Added a clickable 56x56 square media slot with a pure white background (`bg-white`) so that dark transparent shadow PNGs display with crisp contrast.
  - Added direct WordPress Media Library browsing, filename display, and 1-click Clear action.

## [0.0.86] - 2026-09-21

### v2 Configured Composite Generation, Permanent WordPress Upload, View-Level Texture Scale & Order Meta Standardization
- **v2 Configured Skins Composite Image Generation**:
  - Rendered complete photorealistic v2 composite images on client canvas during add-to-cart, combining hardware chassis, master textures, alpha masks, cutout punching, and raytraced shading.
  - Persisted configured composite images across mini bag, checkout review, transactional emails, and Exacoat Manager order details, preventing bare device fallbacks.
- **Permanent WordPress Composite Upload Endpoint**:
  - Added `POST /wp-json/exacoat-core/v1/composite/upload` endpoint in `class-configurator-engine.php` to persist composite PNGs to `wp-content/uploads/composites/`.
  - Replaced transient relative URLs with permanent, immutable CDN-backed absolute URLs with CORS headers.
- **View-Level Texture Scale**:
  - Relocated texture scale to the view/angle level (`view.texture_scale`) to account for differing POV, camera framing, and zoom across device angles.
  - Added dedicated Texture Zoom / Scale slider to each view card in the Views / Angles tab.
  - Updated catalog table to display primary view scale percentage.
- **Order Line-Item Meta Standardization**:
  - Cleaned Model Cut choice name to strictly `"Model Cut"` (stripping `(Back only)` explanations).
  - Standardized Logo Cutout to `"With Logo Cutout"` or `"No Logo Cutout"`.

## [0.0.85] - 2026-09-21

### Device-Level Texture Scale, Persistent Hardware Chassis & Cutouts Switch UI Overhaul
- **Persistent Hardware Chassis**:
  - Eliminated all blinking and flickering on bare device when switching skins, changing coverage, or toggling cutouts.
  - Layer 0 uses a persistent static chassis image without unmounting or re-animating opacity.
  - Canvas skin layers pre-composite offscreen and blit atomically without dropping opacity.
- **Device-Level Texture Scale**:
  - Moved texture scale to device level (`texture_scale`) in Configurator Studio Skins tab (50% to 150%, default 75%).
  - Added "Scale" percentage column to the Configurator Studio catalog table.
  - Removed redundant per-layer texture zoom slider from inside the Skin Part inspector card.
- **Cutouts & Coverage Switch UI Overhaul**:
  - Replaced `Cutout / Solid` preview buttons in Logo Cutout with an iOS-style toggle switch for "Buyer Choice on Webstore", removing the redundant bottom checkbox row.
  - Hidden Stylus/Custom Cutout section by default; added `+ Add Custom Cutout` button with iOS switch and delete button.
  - Replaced Model Coverage preview buttons with an iOS-style toggle switch and removed `None (Flat Cut)` from coverage mode buttons.

## [0.0.84] - 2026-09-21

### Double-Buffered Canvas Crossfade, Dual Resolution Master Textures, Media Slot Previews & Part Texture Controls
- **Double-Buffered Skin Swatch Crossfade**:
  - Eliminated bare device flickering when switching skins: previous skin texture stays 100% visible on back canvas while the new texture downloads.
  - New texture fades in smoothly on front canvas directly on top (opacity `0 -> 1` in 220ms), completely preventing bare chassis flash.
- **Dual Resolution Master Textures**:
  - Added support for large master textures (`texture_big_url`, 3000x2000) for laptops, keyboards, and tablets alongside standard textures (`texture_url`, 2000x3000).
  - Devices automatically select `texture_big_url` for laptop and tablet families or when configured per-part.
- **Per-Part Texture Controls**:
  - Added Texture Zoom / Scale slider (50% to 150%, default 75% for ~25% smaller pattern definition).
  - Added Texture Rotation buttons (0°, 90°, 180°, 270°).
  - Added Texture Resolution selector (Auto, Standard, Big).
- **Out of Stock Inventory Flag**:
  - Added real-time In Stock / Out of Stock toggle in Master Textures modal; Patina set to out of stock.
- **Studio Media Slot Previews**:
  - Replaced raw URL text inputs for Alpha Masks, Hardware Chassis Renders, and Cutout Masks with clickable 56x56 square thumbnail previews opening the WordPress Media Library.
- **Cleaned Badges & Swatch Header**:
  - Removed redundant 'Included' labels from Coverage and Cutout accordions and cards.
  - Lowered 'NEW' badge slightly for flush alignment with swatch rims.

## [0.0.81] - 2026-09-20

### Dual-Image Master Finishes, Group Ordering, Custom Device Artwork & Media Library Overhaul
- **Dual-Image Master Finish Architecture**:
  - Configures both Image 1 (Swatch Thumbnail for selector circles/tooltips) and Image 2 (Master Texture clipped by device cut masks on v2 canvas).
  - Both images have dedicated inputs, live 44x44 checkered previews, and direct 1-click WordPress Media Library browsing.
- **Finish & Group Management**:
  - Added "+ Add Finish" modal to create new global finishes with custom names, slugs, groups, thumbnails, textures, and extra prices.
  - Added Delete Finish workflow with confirmation dialog.
  - Added "Manage Groups" tray enabling operators to reorder groups left/right (up/down) and add new groups.
  - Group sequence is persisted in WordPress database option `exacoat_global_finish_groups` via REST API.
- **Custom Design per Device ("Everything Skins")**:
  - Finishes with `is_custom_per_device` flag are registered globally but only appear on devices where custom artwork is uploaded.
  - Dedicated "Custom Device Finishes" card in the Studio Skins tab provides 1-click upload or assignment per device part.
  - Storefront (`configurator-loader.ts`) and Studio Live Dock filter out custom finishes unless artwork is set on that device, cleanly suppressing empty groups.
- **WordPress Media Library 2-Column List View Overhaul (`MediaLibraryModal.tsx`)**:
  - Eliminated UI layout shifts by enforcing fixed modal containers (`h-[480px]`).
  - Implemented 2-column detailed list view displaying full filenames, checkered thumbnails, file extensions, and emerald-highlighted dimension badges for 1000x1000 assets.

## [0.0.80] - 2026-09-20

### Configurator Studio: Apple and Notion-Inspired Sidebar Redesign & Universal Cutout Punching
- **Universal Cutout Punching (`V2SkinCanvasLayer`)**:
  - Solved issue where pre-cut skin overlays that lack masks (such as Back Glass Skin overlaying Back Skin) were not being cut out by logo, pencil, or model cutouts on both manager preview and webstore canvas.
  - Made `maskUrl` optional in `V2SkinCanvasLayer` across `exacoat-manager` and `exacoat-web`.
  - When `maskUrl` is missing but `textureUrl` is present, the pre-cut texture is rendered directly onto the 1000x1000 HTML5 canvas, and canvas `destination-out` punches through `logoCutoutUrl`, `pencilCutoutUrl`, and `modelCutoutUrl`.
- **Embedded Hardware Body Colors per View**:
  - Moved hardware color configuration directly inside each viewing angle card under the Hardware Body Image URL.
  - Color swatches, names, hex codes, and view-specific body image URLs are configured directly per angle with 1-click WordPress Media Library browsing.
  - Completely removed the redundant detached bottom card.
- **Apple & Notion-Inspired Sidebar Overhaul with Tooltips**:
  - Removed confusing clutter badges (`Included`, `FRONT`, `BASE`, `✓ Mask`, `No Mask`, `✓ Textures`, `No Textures`).
  - Completely removed the redundant 21-swatch finish simulation grid from the sidebar (since all finishes are already interactive on the canvas and tester dock).
  - Compact layer stack with reorder controls, visibility toggle, price indicator, and inline name editing.
  - Eliminated walls of text by migrating explanatory guidance into interactive hover tooltips (`InfoTooltip`).
  - Streamlined Cutouts & Coverage and Pricing & Settings stages into compact, modern glassmorphic cards.

## [0.0.79] - 2026-09-20

### Configurator Studio v2: 4-Stage Redesign & Storefront Duplicated Product Resolution
- **Storefront Duplicated Product v2 Profile Priority**:
  - Solved issue where duplicated products (e.g. iPhone 18 Pro Max cloned from iPhone 17 Pro Max) failed to apply saved v2 profiles on `exacoat-web`.
  - Backend (`class-configurator-engine.php`): saving a v2 profile now explicitly deletes legacy MKL post meta keys (`_mkl_product_configurator_layers` and `_mkl_product_configurator_content`), sets `_configurator_version = 'v2'`, and updates `_is_configurator = 'yes'`.
  - Storefront (`configurator-loader.ts`): loader prioritizes `_exacoat_configurator_profile` whenever `configurator_version === 'v2'` or v2 views exist, preventing old MKL metadata from overriding v2 configurations.
- **Inspector Redesign into 4 Focused Stages**:
  - Restructured Studio inspector into 4 clean stages: `Device`, `Skins`, `Cutouts`, and `Pricing`.
  - Stage 1 (`Device`): Centralizes hardware chassis render (Layer 1), angle switcher, single-source 3D raytraced shading & highlights with opacity sliders and extractor, device hardware colors (visual-only, strictly excluded from cart metadata), and asset integrity audit.
  - Stage 2 (`Skins`): Composable skin parts vertical stack with Figma/Photoshop order, quick presets (`Additional Accents`, `Additional Camera`, `Additional Camera & Back Glass`), custom parts with collision-free unique slugs, optional skin layer toggles with upcharges, and support for custom finish texture overrides (such as S26 Ultra Everything skins).
  - Stage 3 (`Cutouts`): Unified alpha masks and buyer options for Logo Cutout, Pencil Groove Cutout, and Model Coverage & Perimeter Frame Cut, complete with in-studio simulation preview toggles (`[Cutout]` vs `[Solid]`, `[Model Cut]` vs `[Model 360]`).
  - Stage 4 (`Pricing`): Storefront publication status (Draft vs Published), base price (IDR), family sizing multipliers, universal signature upcharge calculation breakdown, production variants, and URL Find & Replace.

## [0.0.78] - 2026-09-20

### Configurator Studio: Complete v1 Legacy Device Backward Compatibility & Multi-Angle Resolution
- **Hardware Logo Overlay Restored (Layer 4)**:
  - Fixed issue where logo overlays were invisible on v1 legacy devices (e.g. iPhones, MacBooks, iPads).
  - Restored canvas Layer 4 rendering of `currentView.logo_url` at `zIndex={30}`, respecting the buyer logo toggle ("With Cutout" vs "Solid / No Logo").
  - Restored the dedicated "Hardware Accent / Logo Overlay URL (v1 Overlay)" input card with WordPress Media Library integration in Tab 2 (Hardware Base).
- **Multi-Angle Intelligent Angle Switching (`handleSelectSkinPart`)**:
  - Solved the issue where bottom skins on multi-angle devices (such as MacBook Pro with Top, Bottom, and Trackpad views) appeared missing when inspecting or clicking "Bottom" from Top View.
  - Clicking any skin part in Tab 1 or the tester dock now automatically switches `activeSimView` to the angle containing textures or masks for that part (e.g. auto-switching to "Bottom View" when selecting "Bottom").
  - Prevents parts assigned to other angles from rendering on incorrect camera angles while ensuring single-angle devices fall back gracefully.
- **Smart View Asset Resolution & v1 Texture Fallbacks**:
  - In Tab 1 inspector, resolved texture maps now evaluate the active angle and fall back to `main_view` or any angle with configured textures if the active view has an empty texture map object, eliminating false "Unassigned" states.
  - In canvas Layer 2 rendering for v1 devices, if a part's finish does not have a texture matching the active finish slug, it automatically falls back to the global simulation finish or the first available texture slice in its map rather than returning `null`.
- **v1 Badge Hygiene in Vertical Layer Stack**:
  - Replaced misleading "No Mask" amber badges on v1 profiles with clean `✓ {count} Textures` (emerald) or `No Textures` (amber), reserving mask badges strictly for modern v2 devices.

## [0.0.77] - 2026-09-20

### Configurator Studio: Vertical Layer Stack, Priority Reordering & Accents Visibility Fix
- **Canvas Z-Index Ascending Render Order**:
  - Fixed issue where Accents (e.g. Camera Accent on iPhone 18 Pro Max) failed to appear on top of Back Skin.
  - The rendering loop now strictly sorts skin layers by `z_index` ascending before drawing (`(a.z_index || 1) - (b.z_index || 1)`), ensuring base layers render first and accent layers render on top.
- **Vertical Layer Hierarchy Stack (Front to Back)**:
  - Replaced crowded horizontal pill buttons in Tab 1 (Skin Parts) with a clean Photoshop/Figma style vertical layer stack.
  - Interactive Move Up (`ChevronUp`) and Move Down (`ChevronDown`) controls dynamically swap layer priority and re-index `z_index` from total down to 1.
  - Highlights `FRONT` (highest z-index) and `BASE` (lowest z-index) positions.
- **Accents Auto-Activation in Testing Dock**:
  - Selecting a part tab or clicking any finish swatch in the tester dock now automatically activates that layer in simulation (`selectedSimLayers[partId] = true`).
  - Added live `Eye` / `EyeOff` toggles on both the tester dock tabs and the vertical layer stack rows.
- **Direct 1-Click Layer Deletion**:
  - Added a dedicated `Trash2` deletion icon directly on each row in the vertical layer stack with immediate re-indexing and toast confirmation.
- **Cognitive Overload Elimination**:
  - Removed duplicate layer selector strips from the top of the canvas viewport, consolidating all layer management into the structured vertical stack.
  - Made the Family Preset Pack selector compact and inline.

### Dual Storefront Revalidation & Admin Draft Preview Architecture
- **On-Demand Storefront Cache Revalidation**:
  - Implemented `POST /configurator/revalidate-web` in `class-configurator-engine.php` and `revalidateStorefrontWebDirect()` in `wordpressBridge.ts`.
  - Dispatches immediate ISR cache invalidation to Next.js storefront (`POST https://web.exacoat.com/api/revalidate?secret=...`).
  - Automatically clears Next.js cache tags (`products`, `configurators`, `product-{slug}`, `category-{category}`) and paths (`/product/{slug}`, `/shop/{category}`, `/shop`, `/`).
- **Cloudflare Edge Cache Integration**:
  - Automatically queries Cloudflare Zone credentials from `wp-config.php` (`EXA_CLOUDFLARE_ZONE_ID`, `EXACOAT_CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ZONE_ID`, `AM_CLOUDFLARE_ZONE_ID` and corresponding API tokens).
  - Purges specific storefront URLs or full network cache via Cloudflare Zone API v4 (`https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache`).
- **Automated Lifecycle Hooks**:
  - Automatically triggers dual revalidation upon saving configurator profiles (`rest_save_product_configurator`), changing prices (`rest_set_product_price`), duplicating devices (`rest_duplicate_product`), toggling configurator status (`rest_toggle_configurator`), and standard WooCommerce product updates (`save_post_product`).
- **Studio Quick-Action Controls**:
  - Added dedicated "Revalidate Web" buttons in the Configurator Studio PageHeroHeader and Studio Editor header with real-time spinners and toast notifications.
- **Admin Draft Preview on Storefront**:
  - Storefront detects authenticated administrator session cookies (`exacoat_customer_session`).
  - Allows admins to discover and test draft products on `web.exacoat.com` with a prominent amber sticky notice banner while remaining completely hidden from the public.

## [0.0.76] - 2026-09-20

### Configurator Studio v2: Per-Angle Hardware Color CAD Renders, Device Production Variants & Accents Preset Refinement
- **Integrated Hardware Color CAD Renders**:
  - Replaced flat CSS color overlays with per-angle hardware body image URLs (`body_images_by_view[currentView.id]`) for each hardware colorway.
  - When switching colors in the floating viewport pill (e.g. Cosmic Orange vs Space Gray), the chassis render swaps to the exact photorealistic CAD image for the active viewing angle.
  - Added dedicated per-angle Image URL inputs with direct WordPress Media Library browsing in Tab 2 (Hardware Base).
  - Removed all hardcoded mock color presets. Fallbacks default cleanly to an empty list without imposing Apple colors on third-party devices.
- **Device Production Variants (Template Splits)**:
  - Added full support for physical device hardware variants (e.g. iPad Wi-Fi Only vs Wi-Fi + Cellular) that require different vinyl cutting templates in production.
  - Added a dedicated "Device Production Variants" manager in Tab 3 (Settings) with 1-click iPad Connectivity preset, custom variant addition, and configurable option price surcharges (+IDR).
  - Added real-time interactive variant selector pills in the tester dock with live simulated total price updates.
- **Accents Preset & Non-Destructive Preset Packs**:
  - Changed 'Camera Accent' preset to 'Accents' with standard IDR 35,000 extra price.
  - Built a custom glassmorphic dropdown with frosted backdrop, colored indicator dots, and formatted currency badges for adding preset layers.
  - Removed 'Top Back Skin', 'Bottom Back Skin', and 'Pencil Skin' from common presets.
  - Simplified Foldable preset pack to Back Skin, Camera Skin (+15k), and Hinge / Spine (+25k).
  - Simplified Tablet preset pack to Back Skin and Accents (+35k).
  - Configured preset pack selection to strictly append customizable skin parts without wiping or replacing existing layers, and without altering coverage or cutouts.
- **Larger Viewport Canvas**:
  - Expanded the viewport canvas preview box from max-w-[420px] to max-w-[560px] lg:max-w-[620px] xl:max-w-[680px] for high-resolution visual inspection.
- **Cutout Punching vs Skin Layer Invariant**:
  - Formalized that Logo Cutout is not a skin layer; it is an angle-level alpha mask that punches holes through all applied skins using destination-out compositing, cleanly revealing the metallic brand logo on Layer 1.

## [0.0.75] - 2026-09-20

### Configurator v2 Single-Source 3D Shading & Viewport Hardware Color Architecture
- **Single-Source 3D Shading & Highlight Engine**:
  - Unified the 3D shading pipeline from dual shadow/highlight files into a single image source (`shading_image_url` on `ConfiguratorView`), with backward compatibility for legacy configs.
  - Replaced redundant dual shadow/highlight input cards in Studio Inspector Tab 2 with a clean "3D Shading & Highlight Map (Single Source)" card.
  - Added "Use Base" shortcut button and WordPress Media Library browsing.
  - Provided independent live opacity sliders for Shadow Opacity (Multiply, 0% to 100%) and Highlight Opacity (Screen, 0% to 100%) driven from the single image source.
- **Floating Viewport Hardware Color Selector**:
  - Relocated device hardware chassis finishes (e.g. Titanium, Silver, Space Gray) out of bottom dock and accordion menus directly into a floating glassmorphic pill in the viewport canvas stage (`top-4 right-4`).
  - **Single Color Gate**: When a device has 0 or 1 hardware color configured (`device_colors.length <= 1`), the selector is completely hidden from the viewport.
  - **Visual-Only Invariant**: Hardware chassis colors are strictly visual aids for buyers to preview cutouts against physical device finishes and are never saved to WooCommerce order item metadata.
  - Added dedicated Hardware Device Colors manager in Tab 2 with color swatches, native color picker, hex codes, and 1-click presets (Titanium, MacBook/iPad) or 1-click Clear.
  - Changed fallback `device_colors` from hardcoded 4 Apple colors to `[]` so non-Apple devices do not show unwanted color pickers by default.

## [0.0.74] - 2026-09-20

### Configurator v2 Unified Device Families, Preset Packs, Cutouts & Coverage Architecture
- **Flexible Device Family Preset Packs & Custom Skin Parts**:
  - Added standardized 1-click Preset Packs for Smartphone, Foldable (Z Flip/Fold), Laptop (MacBook), Tablet (iPad/Galaxy Tab), and Keyboard (Magic Keyboard).
  - Presets inject foundational skin parts with distinct pricing (e.g. Laptop Bottom Base +IDR 120,000, Trackpad +IDR 40,000, Palm Rest +IDR 80,000; or Smartphone Camera Skin +IDR 15,000, Back Glass +IDR 25,000).
  - Added "+ Custom Part" inline input in Studio Inspector Tab 1, allowing operators to create arbitrary named parts with independent extra prices (+IDR) and selection attributes.
  - Active skin parts display interactive pills with assigned finish counts and colored extra price badges.
- **Universal Multi-Layer Cutout Punching Invariant**:
  - Removed confusing single-layer target dropdowns and redundant hardware accent/logo overlay URLs.
  - When "With Logo Cutout" is selected, destination-out punches out the brand logo across all applied skin layers on that viewing angle, exposing the metallic chassis logo photorealistically.
  - When "With Pencil Cutout" is selected (Tablets: iPad, Galaxy Tab), destination-out punches out the magnetic pencil charging strip from all applied skins on that viewing angle.
  - When "Model Cut" is selected (or when device is `model_cut_only` like Galaxy Z Flip), destination-out punches out side flaps from all applied skins on that viewing angle, exposing the bare metal frame.
- **Clean Coverage Taxonomy & Buyer Options Architecture**:
  - Streamlined `coverage_type` options: `none` (Laptops, Keyboards, Accessories), `model_cut_and_360` (Smartphones with configurable Model 360 upcharge), `model_cut_only` (Foldables like Z Flip), and `model_360_only`.
  - Foldables display a clean non-interactive badge for Model Cut without displaying a redundant 360 wrap toggle.
  - Consolidated Buyer Options (Coverage style, Logo Cutout choice, Pencil Cutout choice) into a dedicated card in Studio Inspector Tab 3 Settings.
  - Angle-specific cutout masks (Logo Cutout Mask, Pencil Cutout Mask, Model Cut Mask) are organized under Hardware Base & Angles (Tab 2) with 1-click WordPress Media Library browsing.

## [0.0.73] - 2026-09-20

### Configurator Duplication Draft Invariant, Full Asset Preservation & Storefront Status Control
- **Duplication Draft Status Invariant**:
  - Duplicated configurator products (`rest_duplicate_product`) are now strictly created in `draft` status (both via WooCommerce product status and `wp_posts.post_status`).
  - Duplicated devices are never published automatically, preventing unfinished configurations from leaking into the live webstore.
- **Complete Asset & Metadata Fidelity**:
  - Featured Image (`_thumbnail_id`) and Product Gallery (`_product_image_gallery`) are faithfully duplicated from the source product.
  - Short Description (`post_excerpt`), Full Description (`post_content`), and Menu Order (`menu_order`) are fully copied.
  - Product Categories (`product_cat`) and Tags (`product_tag`) are assigned to the new product.
  - Configurator flags (`_is_configurator`, `_device_family`, `_size_multiplier`, `_configurator_version`) and full composable JSON profile (`_exacoat_configurator_profile`) are preserved using `wp_slash(wp_json_encode())`.
  - Audit timestamps on duplicate products are cleared to start fresh in `unaudited` status.
- **Studio Draft Visibility & Inspector Status Control**:
  - `rest_get_configurator_profiles` now queries both `publish` and `draft` post statuses so operators can immediately view and edit draft products in Configurator Studio.
  - Product cards display an amber `[Draft]` badge when in draft status.
  - Added a 1-click Storefront Publication Status selector (`Draft` vs `Published`) in the Studio Inspector Settings tab, allowing operators to publish directly to WooCommerce when editing is complete.
  - Duplicate modal features an informative note confirming draft status and asset preservation.

## [0.0.72] - 2026-09-20

### Decoupled View Shading, Dynamic Coverage & Multi-Part Live Studio Configurator Simulator
- **Decoupled View-Wide 3D Shading & Specular Highlights**:
  - Moved raytraced Multiply Shadow PNG (`shadow_png_url`) and Screen Highlight PNG (`highlight_png_url`) from individual skin parts to the viewing angle (`ConfiguratorView`).
  - View-level shading is composited once over all skin layers at controllable opacities, avoiding duplicate shadow maps on separate parts.
  - Shading controls (Multiply Shadow URL, Screen Highlight URL, opacity sliders, and 1-click Extraction) are integrated directly in the Hardware Base inspector tab.
- **Dynamic Coverage & Cutout Architecture (`DeviceCoverageAndCutouts`)**:
  - Added dedicated Coverage & Cutout Options (v2) card in the Hardware Base inspector tab.
  - Supports configurable Logo Cutout option (With Logo Cutout vs Solid / No Logo) with custom silhouette mask URL and target layer selection.
  - Supports configurable Coverage option (Back Only vs Full Frame 360) with custom silhouette mask URL and target layer selection.
  - Persisted in WordPress database post meta via authenticated REST endpoint (`/configurator/save-profile`).
- **Interactive Multi-Part Live Configurator Testing Dock**:
  - Integrated interactive testing dock directly at the bottom of the device stage canvas in Configurator Studio.
  - Operators can switch between skin parts (Back, Camera, Accents), inspect each part's current finish, and pick from allowed finishes using group filters and live swatches.
  - Independent finish testing per part (e.g. Swarm back, Matte Black camera, Emerald Green accents) composited simultaneously on the 1000x1000 HTML5 canvas.
  - Includes live toggles for Logo Cutout and Coverage style with immediate visual feedback.
  - Real-time Price Calculator dynamically reflects base device price + family size multiplier * finish surcharges per part.

## [0.0.71] - 2026-09-20

### v2 Canvas Punch Cutouts, Shading Extraction Engine & Dynamic Opacity Controls
- **Aspect-Ratio Preserving Texture Scaling**:
  - Upgraded `<V2SkinCanvasLayer>` to compute center-crop scale (`Math.max(1000/w, 1000/h)`), ensuring master finish textures are never stretched or squeezed.
- **Canvas `destination-out` Cutout Punching (Logo & Model Cut)**:
  - Supports punch masks for Apple logo cutouts (`logo_cutout_url`) and Model Cut perimeter framing (`model_cutout_url`).
  - Uses `ctx.globalCompositeOperation = 'destination-out'` to physically erase vinyl pixels, cleanly exposing the underlying phone chassis metal and logo.
- **Raytraced Shading Extraction Endpoint (`POST /configurator/extract-shading`)**:
  - Integrated server-side PHP GD endpoint that analyzes neutral Matte White 3D CAD renders.
  - Automatically isolates raytraced ambient occlusion and camera plateau drop shadows into a transparent Multiply Shadow PNG, and isolates curved chamfers into a Screen Highlight PNG.
  - Generates web-ready assets saved directly to `wp-content/uploads/configurator-shading/`.
- **Interactive Shading Extractor Modal & Dynamic Sliders**:
  - Added dedicated "Extract Shading from 3D Render" modal in Configurator Studio with customizable Shadow Contrast and Highlight Sensitivity sliders.
  - Added dynamic live sliders on each layer: **Shadow Opacity (0% to 100%)** and **Highlight Opacity (0% to 100%)**, combining baked raytraced accuracy with interactive tuning.
- **WordPress Post Meta `wp_slash` Persistence Fix**:
  - Wrapped `rest_save_product_configurator` JSON encoding in `wp_slash()`, resolving the core WordPress `update_metadata` bug that stripped backslashes from URLs and quotes.
- **Modal Stacking & Inspector Sidebar Expansion**:
  - Configured `MediaLibraryModal` to render at `z-[200]` with customizable `zIndex` prop, preventing it from being occluded by studio overlays.
  - Widened Studio inspector sidebar default width to 540px (resizable up to 950px) for comfortable asset configuration.
- **Studio Non-Closing Save**:
  - Updated "Save Configurator" action to save and update state in place with toast feedback without kicking operators out of the active studio editor.

## [0.0.69] - 2026-09-20

### Category Combobox Dropdown & v2 Master Finish Textures Architecture
- **Searchable Category Combobox Dropdown**:
  - Replaced the overflowing horizontal category button strip with a compact, glassmorphic combobox dropdown.
  - Features real-time brand/category search filtering, dynamic device counts per category (`categoryCounts`), active selection checkmarks, and 1-click reset to "All Categories".
- **v2 Master Texture Architecture**:
  - Added `texture_url` field to `GlobalFinish` in `wordpressBridge.ts` and `exacoat-core` (`class-configurator-engine.php`).
  - Operators configure the master textured image once per finish (e.g. Swarm, Black Camo, Patina) and all v2 Modern devices inherit it automatically, clipped by their device alpha mask.
  - Configurator stage viewport evaluates `customLayerTexUrl || activeFinish.texture_url || activeFinish.thumbnail`.
- **Global Master Textures Manager in Configurator Studio**:
  - Added **Master Textures (v2)** button in the Studio top bar and Layer Settings inspector.
  - Provides a dedicated modal allowing operators to search finishes, inspect live previews of master textures, and save updated texture URLs with real-time feedback.
- **Materials & Finishes Inventory Upgrades (`MaterialsStockPage`)**:
  - Added **Edit Material** modal to configure material details and master texture URLs.
  - Added "Master Texture Image URL (v2)" field to the "Add Finish" modal.
  - Added v2 texture readiness badges on all material cards (`Master Ready` vs `Using Swatch`).

## [0.0.68] - 2026-09-20

### Persistent Device Audit Tracking & Unaudited Scanning Workflow
- **Persistent Device Audit Invariants in Post Meta**:
  - Implemented `_configurator_last_audited`, `_configurator_audit_status` (`clean` | `issues`), and `_configurator_audit_issues` in WooCommerce product post meta.
  - Strictly prevents browser `localStorage` isolation (Rule 3 Invariant), allowing multiple operators across different physical workstations to see unified audit statuses in real time.
- **REST Persistence Endpoints**:
  - Added `POST /configurator/mark-audited` to persist single device audit results.
  - Added `POST /configurator/batch-mark-audited` for bulk audit result persistence during catalog scans.
  - Added `POST /configurator/reset-audit` to reset audit status on single products or the entire catalog.
  - Updated `rest_get_configurator_profiles` to return `last_audited_at`, `audit_status`, and `audit_issues` on all profile summaries.
- **Targeted vs Full Catalog Scanning**:
  - Added **Audit Unaudited ({count})** button in top bar and modal header to quickly audit only new or unverified devices without rescanning the entire catalog.
  - Maintained **Audit All ({count})** button to re-probe all devices catalog-wide.
  - Automatically hides "Audit Unaudited" button once all devices are verified clean.
- **Studio Interface & Card Hygiene**:
  - Added **Audited Clean** and **Unaudited Devices** counters in the metrics row.
  - Added filter tabs in the catalog filter bar: **All Audit**, **Audited**, **Unaudited**, and **Issues**.
  - Added persistent visual status badges on each product card (`[✓ Audited]`, `[! Issues]`, `[Unaudited]`) next to SKU.

## [0.0.67] - 2026-09-20

### Device Configurator Checkbox, Catalog Scope & 500-Product Retrieval
- **Full 500-Product Catalog Retrieval**:
  - Increased `rest_get_configurator_profiles` cap from 100 to 500 items, allowing all 297 store products to load completely.
  - Solved missing Samsung Galaxy A54 (`#474343`) and other devices that were previously pushed outside the 100-item cutoff by newer merchandise drops.
  - Enhanced search bar to match product names, slugs, and numeric SKUs (e.g. searching `474343` or `A54`).
- **Product Configurator Post Meta Flag (`_is_configurator`)**:
  - Added dedicated **Device Configurator** checkbox to the WooCommerce product edit screen (General tab).
  - Implemented intelligent fallback evaluator (`is_product_configurator`): products with composable skin layers default to configurators, while drops with 0 layers (such as Heritage `#541934`, Sienna `#534063`, G.64 `#519190`, and Titanium+ Back Glass Kit `#537903`) are automatically excluded from the configurator catalog without manual database migration.
- **REST Endpoint & 1-Click Toggle Controls**:
  - Added REST endpoint `POST /configurator/toggle-configurator` for instantaneous toggling directly from Exacoat Manager.
  - Added interactive status pills (`Configurator` vs `Excluded`) on product cards in the catalog grid and in the Fullscreen Studio top navigation bar.
  - Added catalog scope toggle in Studio filter bar (`Configurators` vs `All Products`) to easily manage non-configurator store items.

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
