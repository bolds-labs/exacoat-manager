# Exacoat Manager & Core Platform - Agent Rules & Architecture Reference

This document is the authoritative operational guideline, system boundaries, and architectural reference for AI agents and developers working in this repository.

---

## 1. Mandatory Knowledge Preservation Directive (Save to Docs / Markdown)

**CRITICAL PROTOCOL FOR ALL AI AGENTS AND DEVELOPERS:**
- Whenever you solve a non-trivial bug, introduce or alter domain rules, implement new workflows, configure marketplace webhooks/keys, or make architectural decisions, you **MUST immediately record these learnings, root causes, and architectural invariants into `AGENTS.md` and/or the relevant markdown documentation files in `docs/`**.
- **Never leave architectural knowledge or bug fixes solely in transient chat context.**
- Check and update relevant docs when touching specific subsystems:
  - Warranty & RMA Review: [`docs/WARRANTY_SYSTEM.md`](file:///c:/AI/exacoat-manager/docs/WARRANTY_SYSTEM.md)
  - Shopee Open Platform API v2: [`docs/SHOPEE_INTEGRATION.md`](file:///c:/AI/exacoat-manager/docs/SHOPEE_INTEGRATION.md)
  - TikTok Shop Integration: [`docs/TIKTOK_INTEGRATION.md`](file:///c:/AI/exacoat-manager/docs/TIKTOK_INTEGRATION.md)
  - Shipping & Tracking System: [`docs/SHIPPING_AND_TRACKING_SYSTEM.md`](file:///c:/AI/exacoat-manager/docs/SHIPPING_AND_TRACKING_SYSTEM.md)
  - Multi-Channel Marketplace Architecture: [`docs/MARKETPLACE_ARCHITECTURE.md`](file:///c:/AI/exacoat-manager/docs/MARKETPLACE_ARCHITECTURE.md)
  - Checkout & Order Engine: [`docs/CHECKOUT_AND_ORDER_SYSTEM.md`](file:///c:/AI/exacoat-manager/docs/CHECKOUT_AND_ORDER_SYSTEM.md)
  - User Changelog: [`CHANGELOG.md`](file:///c:/AI/exacoat-manager/CHANGELOG.md)
- Always inspect recent git commits (`git log -n 25 --oneline`) before starting to understand recent context and avoid reverting intentional changes.

---

## 2. Mandatory System & Brand Boundaries

- **Exacoat Manager strictly manages Exacoat e-commerce operations.**
- **NEVER use or reference `artmatter-core` in active runtime code.**
- The WordPress master plugin for Exacoat is **`exacoat-core`** (located in `wordpress-plugin/exacoat-core/`).
- **Active WordPress Environment**: Always use `https://staging.exacoat.com` as the active WordPress backend environment. `exacoat.com` does not have `exacoat-core` installed.
- **Language Boundary**: Do not use Indonesian for internal Exacoat systems or UI components. Use English ("Claim Warranty", "Redeem Gift", "Export Shipments"), reserving Indonesian terms only for customer-facing channel contexts (e.g. Shopee marketplace tabs) when necessary.
- **Antislop Rule**: Never use em dashes (`—`) anywhere in UI copy, code comments, commit messages, or markdown documentation. Use hyphens (`-`), colons (`:`), commas, or parentheses instead.
- **Brand Isolation & Decoupling Invariants**:
  - **Reviews Database Table**: The central customer reviews table is `wp_exacoat_reviews`. `check_table_schema()` in `class-review-manager.php` automatically runs an `ALTER TABLE wp_artmatter_reviews RENAME TO wp_exacoat_reviews` query if the legacy table is detected, guaranteeing zero data loss.
  - **Review Invitations Queue**: Invitations are enqueued under Action Scheduler queue `exacoat-reviews` with hook `exacoat_send_review_invitation_job`. A legacy listener for `artmatter_send_review_invitation_job` is retained for in-flight tasks.
  - **Review Metadata Keys**: Writes strictly persist to `_exacoat_review_invited_at`, `_exacoat_review_invite_scheduled_at`, `_exacoat_has_review`, `_exacoat_review_id`, and `_exacoat_review_reward`. Readers inspect `_exacoat_*` first with fallback to legacy keys to ensure existing order records remain intact.
  - **Primary Subsystem Classes**: All subsystem classes must prioritize `Exacoat_*` (`Exacoat_Diagnostics`, `Exacoat_Email_Engine`, `Exacoat_Logger`, `Exacoat_Checkout_Engine`, `Exacoat_Store_Enhancements`).
  - **Shortcodes & AJAX Actions**: Shortcodes must use `[exacoat_order_tracking]` and `[exacoat_track_order]`. AJAX actions use `exacoat_*` prefixes with legacy aliases preserved for backwards compatibility.

---

## 3. Multi-Admin Architecture: No LocalStorage for Shared State

Exacoat operations run across multiple admins using different physical PCs simultaneously.

### The Invariant
**NEVER store operational or fulfillment state (such as print status, order tags, or booking flags) in browser `localStorage`.**
- `localStorage` is isolated to a single browser profile on a single physical machine. If Admin A marks an order printed on PC 1, Admin B on PC 2 would never see the updated status.
- **All shared operational state must be persisted in the WordPress database** (e.g., `_exacoat_shopee_orders_cache` option, post meta, or custom tables) via authenticated REST endpoints.
- When any admin performs an action, the backend database is updated, ensuring all other admins immediately see the identical state upon refresh or live sync.

---

## 4. Shopee Open Platform API v2 & Live Push Integration

### Active Credentials & Endpoints
- **App Name**: `Exacoat n8n` (App ID: `220533`)
- **Console URL**: `https://open.shopee.com/console/push/220533`
- **Deployment Service Area**: `Singapore` (standard SEA gateway for Shopee Indonesia)
- **Live Callback URL**:
  ```
  https://exacoat.com/wp-json/exacoat-core/v1/shopee/webhook
  ```
  (Staging: `https://staging.exacoat.com/wp-json/exacoat-core/v1/shopee/webhook`)
- **Live Push Partner Key**:
  ```
  58724959565954534b6d797147587a55505a4f79614243526464424a66686e63
  ```
- **Live Push Status**: `ON` with `Status: Normal` (all 30 push mechanisms enabled).

### Supported Push Event Codes in Backend (`class-shopee-client.php`)
- **Code 1 (`shop_authorization_push`)**: Store connected.
- **Code 2 (`shop_authorization_canceled_push`)**: Store disconnected.
- **Code 3 (`order_status_push`)**: Real-time order status transitions (`READY_TO_SHIP`, `PROCESSED`, `SHIPPED`, `COMPLETED`, `CANCELLED`).
- **Code 4 & 24 (`order_trackingno_push` / `booking_trackingno_push`)**: Courier tracking number (resi) assigned or updated.
- **Code 12 (`open_api_authorization_expiry`)**: Alerts 30 days before authorization expires.
- **Code 15 & 25 (`shipping_document_status_push` / `booking_shipping_document_status_push`)**: Shipping document generation status. When Shopee signals `PRINTED`, backend updates `shipping_document_status = 'PRINTED'` and `is_printed = true` in the central cache.
- **Code 23 (`booking_status_push`)**: Logistics pickup/dropoff booking updates.
- **Code 29 (`return_updates_push`)**: Buyer return and refund requests.
- **Code 30 (`package_fulfillment_status_push`)**: Package fulfillment lifecycle.
- **Code 37 (`courier_delivery_binding_status_push`)**: Driver binding for Instant and Same Day couriers.
- **Code 47 (`package_info_push`)**: Parcel weight and dimension updates.

### Fulfillment Status Determination
- `order_status === 'READY_TO_SHIP'`: Order is unarranged ("Perlu Diproses" / "Perlu Diatur Pengiriman"). Prominently displays orange **Atur Pengiriman** button.
- `order_status === 'PROCESSED'`: Order has been arranged with courier ("Telah Diproses" / "Siap Diambil Kurir").
- `is_arranged` is strictly evaluated as `order_status === 'PROCESSED'`. Do not treat pre-generated logistics flags (`LOGISTICS_REQUEST_CREATED`, `LOGISTICS_READY`) as arranged.

### Print Status Workflow
- Single source of truth: `order.is_printed || order.shipping_document_status === 'PRINTED'`.
- Interactive `Perlu Dicetak →` action pill directly downloads the thermal PDF and marks printed in the database.
- Once printed, `Cetak Ulang Label` is tucked inside the 3-dots action menu (`⋮`).
- On-demand verification: `fetch_single_order_live()` calls `/api/v2/logistics/get_shipping_document_result` for arranged orders to pull true printed status from Shopee and update the database cache.
- Sync safety: Order synchronization in `sync_orders_direct` preserves `$was_printed` so past printed orders are never reverted by general order sync.

### Configurable Pickup Scheduling
- Endpoint `/api/v2/logistics/get_shipping_parameter` returns `pickup.time_slot_list`.
- Each slot includes `date` (timestamp), `time_text` (e.g., `14:00 - 16:00`), and `pickup_time_id`.
- [ArrangeShipmentModal.tsx](file:///c:/AI/exacoat-manager/src/components/orders/ArrangeShipmentModal.tsx) groups slots by date, allowing operators to configure both:
  1. **Tanggal Pickup** (e.g. `Hari Ini (Sabtu, 20 Sep)` or `Besok (Minggu, 21 Sep)`), and
  2. **Rentang Waktu** (e.g. `14:00 - 16:00 WIB`).
- Submitting passes `pickup: { address_id, pickup_time_id }` directly to `/api/v2/logistics/ship_order`.

---

## 5. Cancelled Orders Policy across Marketplaces

In both Shopee and TikTok views:
- **Default View**: Cancelled orders (`CANCELLED`, `IN_CANCEL`, `TO_RETURN`) are strictly excluded from the `Semua` (`ALL`) filter tab.
- **Dedicated Tab**: Cancelled orders are viewed only within the `Dibatalkan` tab.
- **Card and Modal Hygiene**: Cancelled order cards do NOT display countdown timers, resi tracking numbers, print action pills, "Atur Pengiriman" buttons, or 3-dots menus (`⋮`). Only a clean rose `Dibatalkan` status badge is shown.

---

## 6. Item Title Sanitization (`cleanItemTitle`)

- Product titles often come from WooCommerce or marketplaces with `[EXACOAT]` prefixes.
- Always clean item titles using `cleanItemTitle(name)` from `src/lib/orderItems.ts` across:
  - `WarrantyReviewModal`
  - `ShippingLabelA6Modal`
  - `PackingSlipModal`
  - `CustomerInvoiceModal`
```typescript
export function cleanItemTitle(name?: string): string {
  if (!name) return '';
  return name.replace(/\[\s*EXACOAT\s*\]\s*/gi, '').trim();
}
```

---

## 7. Warranty Claim Review & Storage Purge

- **Video Proof URL Normalization**: URLs starting with `/` must be resolved to `https://exacoat.com/...`; Exacoat Manager runs on `manager.exacoat.com` and relative URLs will 404.
- **Disk Purge Invariant**: When a warranty claim is reviewed (approved or rejected via `reviewWarrantyClaimDirect`), the uploaded video proof file is immediately purged from disk via WordPress REST API to comply with disk limits and privacy.
- **CPT Table Status Prefix**: When querying WooCommerce classic CPT tables (`shop_order`) in WordPress via `WP_Query`, post statuses are prefixed with `wc-` (`wc-pending`, `wc-processing`, etc.). Omitting `wc-` causes queries to return empty results.
- **Deduplication Check**: Queries across `_rma_original_invoice`, `_rma_original_order_id`, and `_rma_original_order_number` to prevent duplicate replacements on the same order.

---

## 8. A6 Thermal Shipping Labels & Packing Slips

- **Page Capacity**: Single A6 sheet holds up to 4 items on page 1 alongside full header, sender, recipient, and barcode. Larger orders use multi-page chunking (`chunkOrderItems`).
- **Item Title Line-Height**: Item titles on labels use compact line-height (`1.08`) and tight letter-spacing to prevent awkward wrapping.
- **Separated Specs**: In `formatSeparatedItemSpecs`, channel and original invoice numbers are strictly separated from production parts (e.g. *Back*, *Camera*, *Accents*) to help production immediately cut the right vinyl piece.

---

## 9. Financial Analytics and Reporting

- **Strict Exclusion**: All sales reports, revenue aggregations, and financial analytics must strictly exclude cancelled, refunded, and unpaid orders across all sales channels (Webstore, Shopee, TikTok Shop).
- Multi-channel financial reports must respect channel and timespan filters without double-counting adjustments or warranty replacement orders.

---

## 10. Export Shipments & JNE Email Dispatch

- Automated server-side email dispatch with attachments via `class-export-manager.php`.
- Uses `exacoat-core/templates/excel/goorita_bulk_shipment.xlsx`.
- Validates ZeptoMail/SMTP service readiness before flagging shipments as emailed to prevent false-positive sent states.
- All email service notices, toasts, and UI tools are localized in English.

---

## 11. Multi-Zone Free Shipping Threshold Architecture

- **3 Official Shipping Zones**: Exacoat maintains 3 official delivery regions:
  - `indonesia` (Country `ID`, Currency `IDR`, Free threshold: `300000`)
  - `united_states` (Country `US`, Currency `USD`, Free threshold: `30`)
  - `default` (Country `*`, Currency `USD`, Free threshold: `50`)
- **Decoupled from WooCommerce Zones**: Free shipping discount calculations in `Exacoat_Store_Enhancements::apply_zone_tiered_shipping_discount()` evaluate the destination country (`$package['destination']['country']`) directly. Adding a country region (e.g. `SG` with `SGD 30`) immediately applies to checkout without creating a WooCommerce shipping zone.
- **Bi-directional Synchronization**: Changes to `exacoat_core_settings` are synchronized with `artmatter_core_settings` using recursive loop guards (`$is_syncing`) across both `add_option_*` and `update_option_*` hooks.
- **Tab State & Form Non-Blocking**: The settings page stores the active tab in `sessionStorage` and URL hash (`#shipping`), and defers submit button disabling via `setTimeout` to prevent browser cancellation of the HTTP POST request.
- **Single Form Hierarchy & Input Form Ownership Invariant**: In `settings-page.php`, all settings panes are submitted via the master `<form id="exacoatSettingsForm">`. Nested `<form>` tags are strictly forbidden as browser HTML parsers drop nested form start tags and close the outer master form on the inner form's closing `</form>` tag. All shipping inputs (both PHP-rendered and dynamically created JavaScript rows) must explicitly declare `form="exacoatSettingsForm"`.
- **Shipping Zone Deletion Sentinel**: A hidden input `shipping_zones_present` must be submitted with the form so `sanitize_settings()` can distinguish between an omitted field and an explicit deletion of all zones.

---

## 12. Build, Packaging, and Release Workflow

Whenever any changes are made to the frontend or the `wordpress-plugin/exacoat-core` plugin:
1. **Bump Version**: Update version in:
   - `package.json`
   - `wordpress-plugin/exacoat-core/exacoat-core.php` (`Version` and `EXACOAT_CORE_VERSION`)
2. **Build and Package**: Run:
   ```bash
   npm run build
   ```
   This executes:
   - `node scripts/package-plugin.cjs` (creates `exacoat-core-vX.X.XX.zip` and `exacoat-core.zip` in root and `public/`)
   - `tsc` (TypeScript typecheck)
   - `vite build` (compiles React frontend into `dist/`)
   - Updates `public/version.json` and `src/config/version.ts`.
3. **Type Check**: Verify with `npx tsc --noEmit`.
4. **Style Check**: Confirm zero em dashes with `git diff | Select-String "—"`.
5. **Git Commit & Push**:
   ```bash
   git add .
   git commit -m "feat/fix(scope): clear description without em dashes"
   git push origin main
   ```

---

## 13. Configurator Asset Integrity & Ghost Angle Architecture

- **Ghost Angle Invariant**:
  A viewing angle in WooCommerce configurator metadata (`_mkl_product_configurator_angles`) is classified as a **Ghost Angle** if:
  1. It has 0 active, non-empty finish texture maps across all composable skin layers, **and**
  2. Its hardware chassis render (`view.background_url`) is missing or fails to load (404/redirect).
- **Template Duplication Chain**:
  When new device models are created by duplicating older products (e.g. tablet cloned from an iPad Pro template), legacy viewing angles (such as `Side View`) and empty texture maps (`""`) can leak into the new product.
- **Audit Tooling in Studio**:
  Configurator Studio (`src/pages/ConfiguratorStudioPage.tsx`) provides an integrated Asset Integrity Audit:
  - Probes all chassis images, layer texture PNGs, and canvas overlays via concurrent browser image requests.
  - Automatically identifies ghost angles and provides 1-click removal of ghost angles and unused layer assets.
  - Provides 1-click pruning of empty texture entries (`""`) from the option cache.
- **Storefront Addon Synchronization**:
  Tablets with flat back skin cuts only (such as Xiaomi Pad models) must never offer "Add Side Frame Skin" in `addon-evaluator.ts`. Side wrap skins are reserved strictly for tablets and foldables with physical flat-edge vinyl cuts (such as iPad Pro models and Galaxy Tab S series).

---

## 14. Device Configurator Product Flag & Catalog Scope (`_is_configurator`)

- **Non-Configurator Exclusion Invariant**:
  Non-configurator catalog items (such as limited edition drops, merchandise, cases, standalone camera or back glass kits) must not pollute the Configurator Studio catalog or be scanned by asset integrity audits.
- **Post Meta Storage**:
  Configurator status is explicitly tracked in WooCommerce product post meta via `_is_configurator` (`'yes'` or `'no'`).
- **WooCommerce Admin Integration**:
  A dedicated checkbox labeled **Device Configurator** is added to the General tab in the WooCommerce product edit screen, allowing admins to toggle configurator status directly in WordPress.
- **Intelligent Fallback Evaluator & Stub Profile Healing**:
  When `_is_configurator` has not yet been explicitly saved on a legacy product:
  - If the product contains composable skin layers (`layers_count > 0`), it defaults to active configurator (`true`).
  - If the profile in `_exacoat_configurator_profile` is empty or a stub lacking layers (`empty($profile['layers'])`), `rest_get_configurator_profiles` and `rest_get_product_configurator` automatically convert legacy MKL layers from `_mkl_product_configurator_layers` and heal the post meta directly.
  - A product is evaluated as a configurator if `_mkl_pc__is_configurable === 'yes'` or if `_mkl_product_configurator_layers` contains non-device skin layers.
  - If the product contains 0 layers (such as Heritage, Sienna, G.64, and Back Glass Kits), it defaults to non-configurator (`false`).
  This ensures real devices (e.g. MacBooks, iPads, Galaxy A54) are discovered and preserved without requiring manual database migration.
- **REST Toggling & Studio Controls**:
  - Endpoint `POST /configurator/toggle-configurator` provides 1-click toggling from Exacoat Manager.
  - Catalog cards and the Studio top bar display interactive status badges (`Configurator` vs `Excluded`).
  - The catalog header provides a scope selector (`Configurators` vs `All Products`) and searches across names, slugs, and numeric SKUs (e.g. searching `474343` or `A54`).
- **Catalog Pagination**:
  `rest_get_configurator_profiles` accepts `per_page` up to `500` (or `per_page: -1`) to load the entire store catalog in a single request, eliminating the previous 100-item cutoff.

---

## 15. Persistent Device Audit Tracking & Catalog Audit Workflow

- **Shared State Persistence Invariant**:
  Audit status must never be stored in browser `localStorage` (Rule 3). In a multi-admin setup, device audit history is permanently recorded in WooCommerce post meta:
  - `_configurator_last_audited`: ISO timestamp string of the last scan completion.
  - `_configurator_audit_status`: `'clean'` (0 broken assets, 0 ghost angles) or `'issues'` (one or more broken assets or ghost angles).
  - `_configurator_audit_issues`: Integer count of detected broken assets and ghost angles.
- **REST Persistence Endpoints**:
  - `POST /configurator/mark-audited`: Persists audit outcome for an individual device.
  - `POST /configurator/batch-mark-audited`: Efficient batch persistence for catalog-wide audits.
  - `POST /configurator/reset-audit`: Clears audit records for individual devices or the entire catalog.
- **Targeted Audit vs Full Catalog Scan**:
  - **Audit Unaudited ({count})**: Filters catalog to products where `last_audited_at` is empty or status is `'unaudited'`. Allows operators to pick up incremental audits without re-probing hundreds of already-verified devices.
  - **Audit All ({count})**: Re-probes all active configurators catalog-wide to catch newly expired CDN URLs or broken chassis links.
- **Studio UI & Card Badges**:
  - Top bar metrics row tracks **Audited Clean** and **Unaudited Devices** in real time.
  - Catalog filter bar includes **All Audit**, **Audited**, **Unaudited**, and **Issues** tabs.
  - Each product card displays persistent status badges (`[✓ Audited]`, `[! Issues]`, `[Unaudited]`) next to SKU.

---

## 16. Configurator v2 Master Textures & Category Combobox Architecture

- **v2 Master Texture Inheritance Invariant**:
  In v2 Modern Engine, operators do not upload slice textures per phone model or part. All devices automatically inherit high-resolution master finish textures (`texture_url` on `GlobalFinish` persisted in `exacoat_global_finishes`), clipped on the client or canvas by each device's 1000x1000 alpha mask (`mask_svg_url`).
- **Texture URL Hierarchy**:
  Viewport rendering and simulation evaluate textures in order:
  `customLayerTexUrl || activeFinish.texture_url || activeFinish.thumbnail || ''`.
- **Global Master Textures Management**:
  - Managed globally in **Materials & Finishes Inventory** (`MaterialsStockPage.tsx`) via dedicated Edit Material modal and "Master Texture URL (v2)" field.
  - Directly accessible inside **Configurator Studio** (`ConfiguratorStudioPage.tsx`) via the "Master Textures (v2)" header button and layer inspector shortcut, enabling operators to inspect live previews and update master textures without leaving the studio.
- **Category Combobox Dropdown**:
  Replaces overflowing horizontal category button strips with a compact, glassmorphic combobox dropdown featuring real-time brand search, live device counts per category, and 1-click reset to "All Categories".

---

## 17. v2 Canvas Mask Compositing & Cutout Logo Architecture

- **Canvas `destination-in` Invariant**:
  Modern Chromium browsers enforce strict cross-origin restrictions on CSS `mask-image: url(...)`. Because static image uploads on `exacoat.com` lack explicit CORS headers, CSS masks are silently blocked.
  Configurator Studio renders v2 skin layers using an HTML5 `<canvas width={1000} height={1000}>` with `ctx.globalCompositeOperation = 'destination-in'`. This clips textures directly without triggering cross-origin canvas taint errors.
- **Cutout Logo Invariant**:
  In v2 alpha masks, cutouts (such as the Apple logo on iPhone back skins or magnetic pencil groove on iPads) are transparent pixels (alpha = 0). Drawing the mask with `destination-in` automatically leaves that area transparent, exposing the underlying hardware base chassis render (`view.background_url`).
- **Hardware Chassis Direct Exposure**:
  The underlying hardware render (Layer 1) already contains the metallic Apple/brand logo, ports, and camera bump. When `destination-out` punches through the skin layers, Layer 1 shines through photorealistically without requiring redundant overlay images.

---

## 18. WordPress Media Library Integration (`MediaLibraryModal`)

- **REST Endpoint**:
  `GET /wp-json/exacoat-core/v1/media/list` in `class-configurator-engine.php` provides paginated media attachment queries with full CORS headers (`Access-Control-Allow-Origin: *`), search, and thumbnail URLs.
- **Interactive Asset Selector**:
  `MediaLibraryModal.tsx` provides 1-click browsing directly from Exacoat Manager into WordPress uploads. Operators can filter for 1000x1000 canvas assets and select chassis renders, alpha masks, overlays, and master textures without copying and pasting URLs.

---

## 19. Universal Signature Pricing & Family Multipliers

- **Family Size Multipliers**:
  Standardized in `ConfiguratorStudioPage.tsx` Settings tab:
  - Phone: 1.0x
  - Foldable: 1.3x
  - Tablet: 1.8x
  - Keyboard: 2.0x
  - Laptop: 2.5x
  - Console: 2.0x
  - Accessory: 0.8x
- **Universal Surcharge Formula**:
  Signature and premium finish group up-prices (configured globally in Finishes) are dynamically multiplied by the device's `size_multiplier` (e.g. IDR 30,000 * 2.5x = +IDR 75,000 on Laptop). Operators do not need to configure extra prices individually per device.

---

## 20. v2 Canvas Cutout Punching & Modal Stacking Architecture

- **`destination-out` Punching Invariant**:
  When punching holes into a skin layer (such as the Apple logo cutout or Model Cut perimeter frame to reveal phone chassis metal):
  - Canvas renders base master texture -> clips boundary using alpha mask (`mask_svg_url`) via `destination-in`.
  - Logo cutout silhouette (`logo_cutout_url`) is drawn using `ctx.globalCompositeOperation = 'destination-out'`.
  - Model cut silhouette (`model_cutout_url`) is drawn using `ctx.globalCompositeOperation = 'destination-out'`.
  This physically erases the vinyl pixels at those coordinates, cleanly exposing the hardware base chassis below.
- **WordPress Post Meta JSON Unslash Invariant**:
  WordPress core's `update_metadata()` runs `$meta_value = wp_unslash( $meta_value )`. When saving JSON profiles containing escaped slashes in URLs or quotes, unslashing corrupts the JSON string. `update_post_meta( $id, $key, wp_slash( wp_json_encode( $profile ) ) )` is strictly mandatory.
- **Modal Stacking & z-Index Hierarchy**:
  - Fullscreen Studio runs at `z-[100]`.
  - In-studio dialogs (Master Textures modal, Shading Extractor modal) run at `z-[120]` to `z-[150]`.
  - `MediaLibraryModal` accepts a configurable `zIndex` prop defaulting to `'z-50'`, and runs at `zIndex="z-[200]"` in Studio so it always renders cleanly on top of any active dialog.

---

## 21. v2 Shading Engine: 3D Raytraced Extraction vs Dynamic Controls

- **3D Geometric Elevation Invariant**:
  Flat 2D CSS/SVG filters (such as `drop-shadow` or `box-shadow`) only apply to the outer element bounds and cannot simulate internal 3D height elevations (such as camera plateau drop shadows cast downwards onto the back glass, camera lens bevels, or physical edge falloffs).
- **The Hybrid Architecture & Finish-Level Tone Invariant**:
  The optimal approach combines baked 3D raytraced precision with real-time dynamic slider control:
  1. **One-Time Extraction from Matte White 3D Render**: `POST /configurator/extract-shading` processes a neutral white CAD render (`iPhone-17-Pro-Skins-Matte-White.png`), extracting a transparent Multiply Shadow PNG (`mix-blend-mode: multiply`) and a Screen Highlight PNG (`mix-blend-mode: screen`).
  2. **Finish-Level Shading & Highlight Tone**: Because different vinyl finishes reflect light differently (e.g. dark textured finishes like Black Camo benefit from stronger highlights, while bright white finishes require deeper multiply shadows), shadow multiply depth (`shadow_opacity`) and screen highlight intensity (`highlight_opacity`) are managed globally per finish on `GlobalFinish` in Master Textures (v2).
  3. **Single-Source Specular Highlight Fallback**: When viewing angles configure a single universal shading map (`shadow_png_url`), the storefront canvas (`stacked-layer-canvas.tsx`) and composite generator (`device-skin-configurator.tsx`) automatically fall back to `shadowSrc` for screen highlights (`currentView.highlight_png_url || shadowSrc`), guaranteeing highlights render whenever highlight opacity exceeds 0%.
  4. **High-Contrast Mask & Cutout Preview Slots**: In Configurator Studio, all mask and cutout thumbnail slots (Skin Part Alpha Mask, Model Coverage Perimeter Mask, Logo Cutout Mask, Stylus / Custom Cutout Mask, and 3D Shading Map) use bright white backgrounds (`bg-white border-white/20 shadow-sm`) so dark transparent PNG paths and vector shapes remain clearly visible to operators.

---

## 22. Decoupled View Shading, Coverage Options & Multi-Part Live Simulator Architecture

- **View-Level Shading Decoupling Invariant**:
  Raytraced Multiply Shadow (`shadow_png_url`) and Screen Highlight (`highlight_png_url`) maps represent geometric lighting and ambient occlusion for a specific viewing perspective (e.g. Back View, Inner View). Shading belongs to `ConfiguratorView`, not individual customizable skin parts. This prevents redundant texture duplication across parts and ensures a single composite shadow/highlight pass across all composited layers.
- **Coverage & Cutout Invariant (`DeviceCoverageAndCutouts`)**:
  - Logo Cutouts (e.g. Apple logo) and Coverage Styles (Back Only vs Full Frame 360) are configurable buyer-facing options defined on the device profile.
  - They dynamically target specific skin layers (defaulting to the primary back layer) and punch holes using canvas `destination-out` during runtime compositing.
  - Persisted centrally in WordPress post meta via authenticated REST endpoint (`/configurator/save-profile`).
- **Multi-Part Independent Testing Invariant**:
  Configurator Studio provides an interactive live simulator dock below the viewport. Operators can test combinations of different finishes simultaneously across separate skin parts (e.g. Swarm back, Matte Black camera, Emerald Green accents), toggle Logo Cutouts and Coverage choices, and verify calculated prices with size multipliers in real time.

---

## 23. Configurator Product Duplication & Storefront Discovery Architecture

- **Duplication Draft Status Invariant**:
  When duplicating a device configurator in Studio (`rest_duplicate_product`), the new duplicate product MUST strictly be created in `'draft'` status (`$new_product->set_status( 'draft' )` and `wp_update_post( [ 'ID' => $new_pid, 'post_status' => 'draft' ] )`). Duplicated products must never be automatically published to prevent unfinished configurations from leaking into the live webstore.
- **Complete Asset & Metadata Fidelity**:
  Duplication must faithfully preserve:
  1. Featured Image (`_thumbnail_id` via `$source_product->get_image_id()`)
  2. Product Gallery (`_product_image_gallery` via `$source_product->get_gallery_image_ids()`)
  3. Short Description (`post_excerpt`) and Full Description (`post_content`)
  4. Menu Order (`menu_order`)
  5. Product Categories (`product_cat`) and Product Tags (`product_tag`)
  6. Configurator Meta (`_is_configurator`, `_device_family`, `_size_multiplier`, `_configurator_version`)
  7. Composable JSON Profile (`_exacoat_configurator_profile` with `wp_slash( wp_json_encode( $profile ) )`)
- **Fresh Audit Stamp Reset**:
  Duplicate products must have legacy audit timestamps cleared (`delete_post_meta` for `_configurator_last_audited`, `_configurator_audit_status`, `_configurator_audit_issues`) so new duplicates start clean in `unaudited` status.
- **Studio Draft Visibility & Inspector Status Control**:
  - `rest_get_configurator_profiles` queries `'post_status' => [ 'publish', 'draft' ]` and returns `status` in the profile summary.
  - Studio catalog displays an amber `[Draft]` badge on draft product cards.
  - Studio Inspector Settings tab provides a 1-click **Storefront Publication Status** toggle (`Draft` vs `Published`). Saving the profile persists the status directly to WooCommerce.
- **Next.js Storefront ISR & Cache Architecture (`web.exacoat.com`)**:
  - Storefront fetches use `next: { revalidate: 3600 }` (1-hour cache). Products published in WordPress will not appear on the storefront until the cache expires or on-demand revalidation (`/api/revalidate`) is triggered.
  - Storefront queries products by explicit numeric category IDs (`CATEGORY_CONFIG`). Products must have the matching category ID assigned and `catalog_visibility` set to `'visible'` or `'catalog'`.

---

## 24. v2 Unified Device Families, Preset Packs, Cutouts & Coverage Architecture

- **Flexible Family Preset Packs**:
  Configurator Studio provides standardized preset packs per device family, adding foundational skin parts with appropriate pricing:
  - **Smartphone**: Back Skin (Required), Camera Skin (+IDR 15,000), Back Glass Skin (+IDR 25,000).
  - **Foldable**: Top Back Skin (Required), Bottom Back Skin (Required), Camera Skin (+IDR 15,000), Hinge / Spine (+IDR 25,000).
  - **Laptop**: Top Lid (Required), Bottom Base (+IDR 120,000), Trackpad (+IDR 40,000), Palm Rest (+IDR 80,000).
  - **Tablet**: Back Skin (Required), Camera Accent (+IDR 15,000), Pencil Skin (+IDR 25,000).
  - **Keyboard**: Top Outer Cover (Required), Bottom Outer Cover (+IDR 60,000), Inner Keyboard Surround (+IDR 60,000).
  - **Custom Skin Parts**: Operators can add custom named parts with independent pricing (+IDR extra_price) and attributes (`is_required`, `default_selected`, `is_optional`).
- **Universal Multi-Layer Cutout Punching Invariant**:
  Cutouts are angle-level properties, not tied to a single target layer:
  - **Logo Cutout**: When "With Logo Cutout" is selected, the logo silhouette is erased via `destination-out` from **all** applied skins on that angle (Back Skin, Back Glass Skin, etc.), letting the hardware chassis logo shine through.
  - **Pencil Cutout**: On tablets (iPad, Galaxy Tab), when "With Pencil Cutout" is selected, the pencil charging groove silhouette is erased via `destination-out` from all applied skins on that angle.
  - **Model Cut**: When "Model Cut" is selected (or when device is `model_cut_only` like Galaxy Z Flip), perimeter frame flaps are erased via `destination-out` from all applied skins on that angle, leaving flat back skin and exposing the phone metal frame.
- **Coverage Type Taxonomy (`coverage_type`)**:
  - `none`: For laptops (MacBook), keyboards, or accessories where frame wraps do not exist.
  - `model_cut_and_360`: For smartphones (iPhone, Galaxy S) where buyer chooses between Model Cut (flat back) or Model 360 (full frame wrap) with configurable upcharge (`model_360_extra_price`).
  - `model_cut_only`: For foldables (Galaxy Z Flip) where hinge/frame wraps cannot be applied; Model Cut is permanently active with no 360 wrap choice displayed.
  - `model_360_only`: For devices where only full wrap is offered.

---

## 25. Single-Source 3D Shading & Viewport Hardware Color Architecture

- **Single-Source 3D Shading Invariant**:
  In v2 modern engine, viewing angles do not require separate shadow and highlight files. A single image (`shading_image_url` on `ConfiguratorView`), such as a neutral CAD render or ambient occlusion map, provides both depth channels simultaneously:
  - Dark pixels darken underlying vinyl via `mix-blend-mode: multiply` at `shadow_opacity` (0% to 100%).
  - Bright specular pixels illuminate underlying vinyl via `mix-blend-mode: screen` at `highlight_opacity` (0% to 100%).
  - Operators can supply one image and tune both sliders independently without dual-file extraction overhead.
- **Floating Viewport Hardware Color Selector**:
  - Device hardware chassis finishes (e.g. Titanium, Silver, Space Gray) are displayed directly inside the viewport canvas stage as a floating glassmorphic pill, not in an accordion menu.
  - **Single Color Gate**: When a device has 0 or 1 hardware color configured (`device_colors.length <= 1`), the selector is completely hidden from the viewport.
  - **Visual Simulation Only**: Hardware chassis colors are strictly visual aids for buyers to preview cutouts against their device finish. Hardware color is never passed to WooCommerce order item metadata or checkout line items.
  - **Clean Fallback Policy**: Fallback profiles and newly created devices default to `device_colors: []` (empty array) rather than hardcoding 4 Apple colors across non-Apple devices. Operators explicitly configure colors when needed without mock presets.

---

## 26. Per-Angle Hardware Color CAD Renders & Device Production Variants Architecture

- **Per-Angle Hardware Color CAD Invariant**:
  Different device colorways (such as Cosmic Orange vs Space Gray) have different CAD renders across viewing perspectives. Storing `body_images_by_view: Record<string, string>` on each color in `device_colors` allows Layer 1 to dynamically render `(activeColor.body_images_by_view?.[currentView.id] || activeColor.body_image_url || currentView.background_url)`.
  This replaces flat CSS tinting with true photorealistic CAD geometry for each angle.
- **Device Production Variants (Template Splits)**:
  Physical device variants (e.g. iPad Wi-Fi Only vs Wi-Fi + Cellular) require different vinyl cutting templates in production due to physical antenna bands or SIM trays.
  - Configured in Studio Settings tab via `variants: ConfiguratorVariant[]`.
  - Stored natively in WooCommerce post meta via REST endpoint `saveProductConfiguratorProfileDirect`.
  - Supports optional variant option price differences (`price_diff`), dynamically factored into storefront and tester total prices.
  - Tested interactively in the Studio viewport tester dock with live price updates.
- **Cutout Punching vs Skin Layer Invariant**:
  Logo Cutout is not a skin part. Operators do not create a "Logo Skin" or "Logo Cutout" layer. A transparent alpha mask of the logo is punched via canvas `destination-out` through all applied skin layers, revealing the metallic brand logo on Layer 1 (Hardware Chassis Render).

---

## 27. Dual Storefront Revalidation & Admin Draft Preview Architecture

- **On-Demand ISR Revalidation Invariant**:
  `web.exacoat.com` uses Next.js Incremental Static Regeneration (ISR). Changes made in Exacoat Manager (such as saving profiles, updating pricing, duplicating products, or toggling configurators) must be reflected immediately on the live storefront without waiting for the default 3,600s cache TTL.
- **Dual Pipeline Mechanism**:
  1. **Next.js Storefront Invalidation**:
     Calls `POST https://web.exacoat.com/api/revalidate?secret=...`.
     Invalidates specific Next.js cache tags (`products`, `configurators`, `product-{slug}`, `category-{category}`) and paths (`/product/{slug}`, `/shop/{category}`, `/shop`, `/`).
  2. **Cloudflare Edge Cache Purge**:
     Queries Cloudflare Zone credentials from `wp-config.php` (`EXA_CLOUDFLARE_ZONE_ID`, `EXACOAT_CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ZONE_ID`, `AM_CLOUDFLARE_ZONE_ID` and corresponding API tokens).
     Dispatches purge requests directly to `https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache` for storefront URLs or full network cache.
- **Automatic Lifecycle Triggers**:
  - `rest_save_product_configurator` (profile save)
  - `rest_set_product_price` (product price update)
  - `rest_duplicate_product` (device cloning)
  - `rest_toggle_configurator` (configurator flag change)
  - `save_post_product` (WordPress admin product saves)
- **Manual Studio Triggers**:
  - Main Catalog header: "Revalidate Web" button purges catalog cache across Next.js and Cloudflare.
  - Studio Editor header: "Revalidate Web" button purges the specific active device profile and category cache.
- **Admin Draft Preview on Storefront**:
  - Authenticated administrators (`role === 'super_admin'` or `roles.includes('administrator')`) possessing the `exacoat_customer_session` cookie can discover and preview draft products directly on `web.exacoat.com` with `cache: "no-store"`.
  - Displays a prominent amber sticky notice banner at the top of the product page indicating draft status and offering a direct link to open the device in Configurator Studio.
  - For unauthenticated or public visitors, draft products return a strict 404 Not Found response and are completely excluded from category catalogs.

---

## 32. Configurator Studio: Vertical Layer Hierarchy, Canvas Stacking & Cognitive Overload Reduction

- **Canvas Z-Index Sorting Invariant**:
  The HTML5 canvas and SVG overlay rendering pipeline must never rely on raw array insertion order. All customizable skin layers are strictly sorted ascending by `z_index` before rendering:
  `[...skinLayers].sort((a, b) => (a.z_index || 1) - (b.z_index || 1)).map(...)`.
  Base skin parts (e.g. Back Skin with `z_index = 1`) render first. Higher priority overlays (e.g. Accents, Camera Accents with `z_index = 2` or `3`) render on top.
- **Figma/Photoshop Style Vertical Layer Stack**:
  Replaces cramped horizontal pill buttons in Tab 1 (Skin Parts) with an intuitive vertical layer stack ordered Front to Back:
  - Top row: Front layer (highest z-index, renders on top of everything).
  - Bottom row: Base layer (lowest z-index, e.g. Back Skin).
  - Each row provides Bring Forward (`ChevronUp`) and Send Backward (`ChevronDown`) buttons that swap positions and reindex `z_index = total - i`.
  - Displays live canvas visibility toggle (`Eye` / `EyeOff`), Part Name, Group badge (`primary` vs `accent`), Price badge (`+IDR 35,000` vs `Included`), Mask indicator (`✓ Mask` vs `No Mask`), and a direct `Trash2` deletion button on every row.
- **Auto-Activation of Simulation Layers**:
  When operators click a part in the testing dock or select a finish swatch, `selectedSimLayers[partId]` is automatically set to `true`. This prevents optional parts (such as Camera Accents with `default_selected: false`) from remaining invisible on the canvas when the user actively tests finishes.
- **Direct 1-Click Layer Deletion**:
  Operators can delete any skin part directly from its row in the vertical stack via `handleRemoveLayer(layerId)`. The handler purges the layer, re-indexes remaining layers from 1 to N, cleans up simulation state, and displays feedback toasts.
- **Cognitive Overload Elimination**:
  Removed duplicate horizontal layer selector strips from the top of the canvas stage. The canvas viewport now only hosts the Angle switcher and the floating hardware color pill, keeping the design workspace focused and clutter-free.

---

## 33. Legacy v1 Backward Compatibility & Multi-Angle Asset Resolution Architecture

- **Hardware Logo Overlay Invariant (Layer 4)**:
  In legacy v1 devices (and devices with custom hardware accents), logos are rendered as top-level overlay PNGs (`currentView.logo_url`) rather than punched through skin masks via canvas `destination-out`.
  - The canvas viewport must render `currentView.logo_url` as Layer 4 at `zIndex={30}` whenever `currentView.logo_url` is present and `selectedLogoCutout` is true.
  - Toggling buyer choice "With Cutout" vs "Solid / No Logo" controls visibility of Layer 4.
  - Tab 2 (Hardware Base) provides a dedicated "Hardware Accent / Logo Overlay URL (v1 Overlay)" input field with full WordPress Media Library selector support (`setMediaPickerConfig`).
- **Multi-Angle Intelligent Angle Switching (`handleSelectSkinPart`)**:
  On multi-angle devices (such as laptops with Top Lid, Bottom Base, and Trackpad angles, or keyboards with Outer and Inner views), individual skin parts belong to specific camera angles:
  - If an operator clicks a skin part (e.g. clicking "Bottom Base" or "Trackpad" from "Top View"), `handleSelectSkinPart` detects that the active angle has 0 textures for this layer and automatically switches `activeSimView` to the angle that contains textures or masks for that part (e.g. auto-switching to "Bottom View").
  - On the canvas stage, layers that are strictly mapped to other angles on a multi-view device are suppressed from rendering on incorrect angles (`hasOtherAngleAssignments`).
  - Single-angle devices fall back gracefully to `main_view` or any view with valid assets.
- **Smart View Asset Resolution & v1 Texture Fallbacks**:
  - In Tab 1 inspector, `textureMap` resolution evaluates the active angle and falls back to `main_view` or any angle containing textures/masks if the active angle is an empty object, preventing false "Unassigned" states across all swatches.
  - In canvas Layer 2 rendering for v1 devices, if a part's finish does not have an exact matching key in its `render_texture_map`, it automatically falls back to `selectedSimFinish` or the first available texture slice in its map rather than returning `null` and hiding the layer.
- **v1 Badge Hygiene in Vertical Layer Stack**:
  v1 devices use pre-cut texture slice maps rather than 1000x1000 SVG/PNG alpha masks. The vertical layer stack displays `✓ {count} Textures` (emerald) or `No Textures` (amber) for v1 devices, reserving `✓ Mask` and `No Mask` strictly for modern v2 devices.

---

## 35. Official Exacoat Brand Logo Architecture & Strict Phone Model Separation

- **Official Exacoat Brand Logo Invariant**:
  - Exacoat Manager uses the authoritative vector Exacoat logo SVG identical to `exacoat-web`:
    - Reusable React component: `src/components/ui/ExacoatLogo.tsx` supporting variants `amber` (`#F3AA18`), `white` (`#FFFFFF`), and `current` (`currentColor`).
    - Registered trademark circle-R SVG glyph is included within the vector paths with exact geometric curves (`viewBox="-10000 -10000 1388000 261000"`).
    - Standalone SVG asset is stored at `public/assets/brand/exacoat-logo.svg`.
    - Never use generic placeholder boxes (e.g. `EX` square) for Exacoat branding in active runtime code.

- **Strict Phone Model Separation Invariant (Zero Phone Variants)**:
  - In Exacoat's catalog architecture, all iPhones and smartphones are strictly individual, standalone products in WooCommerce (e.g. `iPhone 17 Pro Skins` and `iPhone 17 Pro Max Skins` are completely separate products with their own URLs, SKUs, and assets).
  - Phone products must NEVER contain model production variants (e.g. combining iPhone 17 Pro and 17 Pro Max under one product via a variant dropdown).
  - Physical cut variants in `profile.variants` are reserved strictly for tablets (such as iPad Wi-Fi vs Cellular antenna cutouts, or iPad generational differences where physical vinyl cutting paths differ).
  - **Automated Sanitation & Healing**:
    - `convert_mkl_to_profile` discards legacy model selector layers on phone devices, preventing them from becoming variants.
    - `sanitize_variants` evaluates device context (`family`, `device_name`, `device_slug`) and strips any variant containing phone model options (`iPhone`, `17 Pro`, `Pro Max`, `Plus`, `Ultra`, etc.) or generic model selectors on phones.
    - Both `rest_get_product_configurator` and `rest_sync_device_families` automatically heal and strip phone model variants catalog-wide, ensuring clean separation across the entire store.

---

## 34. Studio v2 Redesign into 4 Focused Stages & Storefront Duplication Resolution

- **Storefront Duplication Resolution & v2 Priority**:
  When products are duplicated in WooCommerce (e.g. iPhone 18 Pro Max cloned from iPhone 17 Pro Max), legacy MKL post meta keys (`_mkl_product_configurator_layers`, `_mkl_product_configurator_content`) can persist on the new product and override v2 profile data on the storefront.
  - Backend Invariant (`class-configurator-engine.php`): When saving a v2 profile, `rest_save_product_configurator` explicitly calls `delete_post_meta()` for legacy MKL keys, sets `_configurator_version = 'v2'`, and updates `_is_configurator = 'yes'`.
  - Storefront Invariant (`configurator-loader.ts`): The loader evaluates `_exacoat_configurator_profile` first. If `profile.configurator_version === 'v2'` or `profile.views` exists, it immediately returns the v2 profile without falling back to legacy MKL layers.
- **Device Hardware Colors (Visual Preview Only)**:
  Device hardware colors (e.g. Desert Titanium, Natural Titanium, Black, White) allow shoppers to preview skin combinations against their device's exact hardware color.
  - Excluded from Cart & Order Metadata: Hardware color selections are visual-only in the viewport canvas and are strictly excluded from WooCommerce line items, cart session data, and checkout metadata.
- **Primary & Additional Composable Skin Layers**:
  - Primary skin (e.g. "Back Skin", "Top Skin") is renameable, assigned to viewing angles, and automatically displays the global finish swatch tooltip.
  - Additional skin layers support 1-click presets: `Additional Accents`, `Additional Camera`, `Additional Camera & Back Glass`. Multiple accents can be added without ID collisions via auto-generated unique slugs (`slug_timestamp`).
  - Optional toggle: Additional skins can be set as optional, adding interactive checkboxes on the storefront and canvas with configurable pricing (e.g. `+Rp 30.000`).
  - Custom Finish Texture Overrides: For special skin releases (such as S26 Ultra Everything skin), operators can specify a custom texture URL in `assets.render_texture_map[finishSlug]` to render a bespoke texture on canvas while keeping the global finish thumbnail in swatch tooltips.
- **Unified Cutouts & Coverage Architecture**:
  Centralized in the dedicated **Cutouts** inspector stage (`inspectorTab === 'cutouts'`):
  - 1000x1000 alpha masks erased from vinyl layers via canvas `destination-out`, cleanly exposing the metallic base chassis render below.
  - Combines storefront buyer option toggles ("Offer Logo Cutout Choice", "Offer Pencil Cutout Choice", "Model Coverage Mode") and alpha mask URLs in single unified cards.
  - In-Studio Simulation Controls: Interactive toggle buttons allow operators to test cutout states directly inside the inspector (`[Cutout]` vs `[Solid]`, `[Model Cut]` vs `[Model 360]`) with instant canvas updates.
- **Pricing, Sizing & Production Settings Stage**:
  Centralized in the dedicated **Pricing** inspector stage (`inspectorTab === 'pricing'`):
  - Storefront publication status: 1-click toggle between `Draft (Unpublished)` and `Published (Live)`.
  - Base regular price (IDR) synchronized directly with WooCommerce.
  - Family sizing multiplier (Phone 1.0x, Foldable 1.3x, Tablet 1.8x, Keyboard 2.0x, Laptop 2.5x, Console 2.0x, Accessory 0.8x) with live signature finish surcharge calculation breakdown.
  - Physical hardware production variants (Wi-Fi Only vs Cellular) with per-option surcharges.
  - Rendering engine architecture switcher (v2 Modern vs v1 Legacy) and URL Find & Replace tool.

---

## 26. Configurator Studio Apple & Notion Sidebar Overhaul and Universal Cutout Punching

- **Embedded Per-View Hardware Colors Invariant**:
  Hardware color configurations are directly embedded within each viewing angle card right under the hardware body image URL, rather than separated in a disconnected bottom card.
  - Each view maintains its own chassis body image URL per color variant, alongside color name, hex code swatch, and 1-click WordPress Media Library integration.
  - The colors remain strictly visual-only in the viewport canvas and are never recorded in line item meta or cart orders.
- **Universal Cutout Punching Invariant (`V2SkinCanvasLayer`)**:
  - Previously, skin layers lacking an SVG vector mask (such as pre-cut overlay PNGs like Back Glass Skin or standalone camera vinyl) bypassed canvas `destination-out` because they fell back to basic `<img>` rendering.
  - `V2SkinCanvasLayer` (in both `exacoat-manager` and `exacoat-web`) treats `maskUrl` as optional:
    - If `maskUrl` is present: renders master texture and clips via `ctx.globalCompositeOperation = 'destination-in'`.
    - If `maskUrl` is absent but `textureUrl` is present: draws the pre-cut texture directly onto the 1000x1000 canvas.
    - In both cases: punches through all active cutouts (`logoCutoutUrl`, `pencilCutoutUrl`, `modelCutoutUrl`) via `ctx.globalCompositeOperation = 'destination-out'`.
    - All skin layers, whether masked or pre-cut overlays, are guaranteed to receive logo and frame cutouts cleanly.
- **Apple & Notion Aesthetic and Tooltip Discipline (`InfoTooltip`)**:
  - Clutter badges (`Included`, `FRONT`, `BASE`, `✓ Mask`, `No Mask`, `✓ Textures`, `No Textures`) and the redundant 21-swatch finish simulation grid have been removed from the sidebar.
  - Walls of text are strictly avoided: explanatory details are tucked into interactive hover tooltips (`InfoTooltip`).
  - Layer rows feature compact up/down reordering, visibility toggle, bold layer name, clear price indicators (`Base` or `+IDR 30k`), and single-click delete.

---

## 27. Dual-Image Master Finishes, Group Ordering, and Custom Device Designs ("Everything Skins")

- **Dual-Image Master Finish Architecture**:
  In the v2 Modern Engine, every global finish (`GlobalFinish`) requires two distinct image roles:
  1. **Image 1: Swatch Thumbnail (`thumbnail`)**:
     A square image swatch (e.g. `https://media.exacoat.com/.../Swarm-Texture-Thumbnail.jpg`) used exclusively for circular selector swatches, tooltips, and finish picker previews.
  2. **Image 2: Master Texture (`texture_url`)**:
     A seamless, high-resolution tileable texture drawn onto the 1000x1000 canvas and clipped by the device's alpha SVG/PNG cut mask (`destination-in`).
  - Dual Image Management: In Configurator Studio, both images have independent inputs, 44x44 checkered live previews, and direct 1-click integration with the WordPress Media Library modal.

- **Custom Design per Device Invariant ("Everything Skins")**:
  - Certain skins (such as "Everything", "Acid", or bespoke collaborative editions) have unique artwork tailored per individual phone chassis rather than a universal repeating pattern.
  - Finishes support the `is_custom_per_device` boolean flag:
    - When enabled, the finish is registered in the global inventory (under groups like "Limited") but is **strictly hidden** by default across all device configurators.
    - It is only rendered and selectable on devices where the operator has uploaded that device's bespoke artwork in the device's Skins tab (`assets_by_view[viewId].render_texture_map[finishSlug]`).
    - Storefront and Studio Evaluators (`configurator-loader.ts` and `ConfiguratorStudioPage.tsx`): Exclude `is_custom_per_device` finishes from choices and group tabs unless `render_texture_map[f.slug]` is defined and non-empty. If a group has only custom finishes and none are set for the active device, the group tab is cleanly suppressed.

- **Universal Finish Group Ordering & Storefront Tab Priority**:
  - Group sequence is persisted storewide in WordPress database option `exacoat_global_finish_groups` via REST endpoint `POST /wp-json/exacoat-core/v1/finishes/reorder-groups`.
  - In Configurator Studio, the Master Textures modal provides a "Manage Groups" tray where operators can move groups left/right (up/down) and add new groups (e.g. placing "Limited" at index 0).
  - Storefront and Live Studio Dock (`parseV2ConfiguratorProfile` and `testPartGroups`): Sort group tabs strictly by `storedFinishGroups.indexOf(groupName)`. Placing "Limited" first immediately bubbles the Limited tab to the front of all v2 device configurators storewide.

- **WordPress Media Library 2-Column List View (`MediaLibraryModal.tsx`)**:
  - Layout Shift Prevention: Outer dialog and media containers enforce strict fixed dimensions (`h-[480px]`), eliminating vertical layout jitter while querying or paginating uploads.
  - Two-Column Detailed List: Replaces truncated icon tiles with a comfortable two-column card view displaying full filenames, checkered thumbnails, file extensions, and emerald-highlighted dimension tags for 1000x1000 canvas assets.

---

## 38. Configurator Persistence Architecture & Refined Cutout/Angle Rules

- **Database Storage & Persistence Invariants (Never LocalStorage)**:
  - **Device Profiles**: Saved in MySQL `wp_postmeta` under meta key `_exacoat_configurator_profile` on each product ID (`update_post_meta($id, '_exacoat_configurator_profile', wp_slash(wp_json_encode($profile)))`).
  - **Global Master Finishes**: Saved in MySQL `wp_options` under option key `exacoat_global_finishes`.
  - **Finish Group Sequences**: Saved in MySQL `wp_options` under option key `exacoat_global_finish_groups`.
  - **Audit Metadata**: Saved in `wp_postmeta` under `_configurator_last_audited`, `_configurator_audit_status`, and `_configurator_audit_issues`.
  - **Zero LocalStorage Risk**: All state is saved to the WordPress database via authenticated REST endpoints. Rebuilding frontend code, clearing browser cache, switching computers, or restarting devices never causes data loss.

- **Custom Renamable Cutouts (`pencil_cutout_label`)**:
  - Previously hardcoded as "Stylus / Pencil Cutout", the cutout slot is generalized as a custom, renamable hardware cutout.
  - Operators can label it according to device hardware (e.g. "Apple Pencil Cutout", "S-Pen Cutout", "Antenna Band Cutout", or "Custom Cutout").
  - Automatic Buyer Option Invariant: Whenever a cutout mask URL (`pencil_cutout_mask_url`) is configured, the system automatically enables `has_pencil_cutout = true`, ensuring buyers on the webstore (`exacoat-web`) are presented with an interactive toggle choice ("With Cutout" vs "Solid / Without Cutout").
  - Order Metadata Persistence: Selections are passed through `customLayers` into WooCommerce cart and order line item meta so production operators know exactly whether to cut the vinyl with or without the cutout opening.

- **Custom Named Angles**:
  - Configurator Studio provides a dedicated custom angle name input allowing operators to add any viewing perspective (e.g. "Front View", "Closed View", "Side Frame Angle", "Keyboard Deck").
  - Slugs are sanitized and deduplicated automatically.
  - Active angle names can be renamed inline directly from the angle header card.

- **Preset Layer Hygiene & Pricing Invariants**:
  - "Additional Camera & Back Glass" preset layer is standardized at IDR 85,000 extra price.
  - Redundant legacy "Top Lid" preset is removed in favor of "Top Skin".
  - Quick Add buttons and Quick Preset packs are pruned from the Skins tab for clean, intentional layer additions.

- **Simplified Device Family Multipliers**:
  - Streamlined to two operational categories:
    1. **Phone**: 1.0x multiplier (+IDR 30,000 default signature finish surcharge).
    2. **Tablet & Laptop**: 2.0x multiplier (+IDR 60,000 default signature finish surcharge).
  - Multipliers can still be fine-tuned via the numeric stepper if a specific device requires bespoke sizing.

---

## 38. Modern Configurator Swatch Grouping, Staging Proxy, and Cutout Architecture

- **v2 Swatch Grouping Invariant (`choice.parent = groupNameToIdMap[f.group]`)**:
  In v2 profile loading (`lib/server/configurator-loader.ts`), choices must be mapped to their corresponding group ID (`groupNameToIdMap[f.group]`) rather than defaulting to `parent: 0`. This allows storefront category carousels (Limited, Signature skins, Colors, Natural) to group finishes properly into organized tabs matching v1.
- **Dynamic Layer Finishes Synthesis Invariant**:
  When a device layer defines texture maps (`l.assets_by_view[viewId].render_texture_map`) for a finish (e.g. `titanium-plus`) that does not yet exist in the global catalog cache, the loader dynamically synthesizes the finish definition into `allFinishesList`, guaranteeing it immediately renders in the device options without requiring WordPress cache revalidation.
- **Staging Uploads vs Edge CDN Mask Invariant (`maskMediaUrl`)**:
  `media.exacoat.com` is configured as an edge CDN proxy pointing strictly to production `exacoat.com`. Media uploaded to staging (`staging.exacoat.com/wp-content/uploads/...`) does not exist on production and returns 404 if rewritten to `media.exacoat.com`. `maskMediaUrl` must strictly preserve `staging.exacoat.com` URLs intact.
- **Canvas Washout Prevention & CAD Render Guard**:
  Solid opaque white CAD renders (such as `iPhone-17-Pro-Skins-Matte-White.png`) must never be rendered using `mixBlendMode: "screen"`, as pure white pixels (1.0) under screen blend completely wash out the canvas. Highlight maps strictly require an extracted transparent highlight PNG (`highlight_png_url`), while multiplying shadow maps require a clean multiply shadow PNG (`shadow_png_url`).
- **Hardware Bare Device & Color Selector Layout Invariant**:
  Device hardware color swatches sit directly adjacent to the "Hold to view bare device" pill at the bottom right of the canvas, displayed as circles only with no cluttering text labels.
- **V1-Parity Radio Cards for Coverage and Cutouts**:
  Model Coverage (Model Cut vs Model 360), Logo Cutout, and Custom Cutouts (e.g. Apple Pencil Strip, S-Pen slot) use standardized 2-column radio cards with pill badges (e.g. "Case-Friendly", "Full Protection", "Logo Exposed", or custom configurable badge text) and interactive `(i)` info drawer tooltips rather than simple boolean switches. Custom cutouts dynamically support custom pill text and description configured in Studio.
- **Optional Layer Status Badge Invariant**:
  Optional unselected layers display an `Optional` status pill instead of `+ Add`, clarifying that the layer is an optional skin piece rather than an unconfigured requirement.

---

## 39. Master Texture Resolution, 3D Multiply Shading, and Sidebar Layout Invariants

- **Authoritative Master Texture Resolution (No Static Overrides)**:
  - `lib/configurator/finishes-stock-override.json` is strictly prohibited from hijacking `fetchGlobalFinishes()`. Static override files lack `texture_url` definitions, causing v2 skins to fall back to low-resolution swatch thumbnails (e.g. macro photos of wrinkled paper).
  - `fetchGlobalFinishes()` in `configurator-loader.ts` must always query WordPress REST API (`${CMS_ORIGIN}/wp-json/exacoat-core/v1/finishes`) first to load live master textures (`texture_url`), group sequences, and inventory status.
  - Default fallbacks (`DEFAULT_GLOBAL_FINISHES`) contain full `texture_url` links for all 22 materials so offline environments never render swatch thumbnails on the 3D canvas.

- **Authoritative Finish Group Ordering (`Limited` > `Signature skins` > `Colors` > `Natural`)**:
  - `globalFinishGroupsCache` defaults to `["Limited", "Signature skins", "Colors", "Natural"]` and is dynamically updated by the WordPress database option `exacoat_global_finish_groups`.
  - Group sequence comparison in `parseV2ConfiguratorProfile` uses case-insensitive index matching (`findGroupIndex`), guaranteeing that group tabs on desktop and mobile carousels strictly follow the sequence set in Configurator Studio.
  - Primary/back skin layers automatically include "Limited" finishes (such as Titanium+) even on older device profiles whose `allowed_finish_groups` only stored legacy groups.

- **3D CAD Multiply Shading & Specular Highlight Architecture**:
  - Shading images (`shadow_png_url` or `shading_image_url`) are evaluated across both `currentView` and individual layer assets (`layerAsset?.shadow_png_url`).
  - In CSS `mix-blend-mode: multiply`, pure white pixels (`#FFFFFF`) are mathematically transparent (`1.0 * background = background`), while ambient occlusion bevels and camera plateau drop shadows naturally darken the texture beneath.
  - White CAD renders (such as `iPhone-17-Pro-Skins-Matte-White.png`) must never be suppressed in multiply shadow mode.
  - In contrast, `mix-blend-mode: screen` strictly requires an extracted specular highlight map (`highlight_png_url`) or zero opacity (`highlight_opacity = 0`) to prevent solid white screens.

- **Logo Cutout Option Discovery**:
  - In `device-skin-configurator.tsx`, `hasLogoCutoutOption` must check `data.v2Profile.coverage_and_cutouts.logo_cutout_mask_url`, `currentView.logo_cutout_mask_url`, and `layer.assets_by_view.*.logo_cutout_url`.
  - Checking only `has_logo_cutout` on legacy profiles causes false negatives when the flag is undefined even though cutout mask assets exist.


---

## 40. 3D Canvas Shading Stacking Context, Collapsed Accordions, and Responsive Cutout Cards

- **CSS Stacking Context Isolation in 3D Canvas Shading**:
  - Never wrap elements using `mix-blend-mode: multiply` inside a `<div>` with `opacity` or `transition: opacity`.
  - In CSS specifications, any element with `opacity` or CSS opacity transition creates an isolated stacking context. When a child `<img>` applies `mix-blend-mode: multiply`, it blends only within its local stacking context against a transparent background, causing the browser to render `iPhone-17-Pro-Skins-Matte-White.png` as a solid opaque image covering the entire phone.
  - Render shading `<img>` elements directly as children in the composite canvas container using `<Fragment>`, identical to `ConfiguratorStudioPage.tsx`.
  - Opacity and bare device transitions must be applied directly to the `<img>` element style (`opacity: isPeekingBareDevice ? 0 : shadowOpacity`).
  - Strictly check `typeof currentView.highlight_opacity === "number"` so that `highlight_opacity = 0` is strictly honored and the highlight image is omitted.

- **Collapsed Accordion Architecture for Coverage and Cutouts (v1 Parity)**:
  - Model Coverage, Logo Cutout, and Stylus Cutout are collapsible accordions using virtual IDs (`COVERAGE_ACCORDION_ID = 999900`, `LOGO_ACCORDION_ID = 999901`, `PENCIL_ACCORDION_ID = 999902`).
  - Default state initializes to `interactiveLayers[0]?.id` (Back Skin), ensuring Coverage and Cutouts start cleanly collapsed matching v1 storefront behavior.
  - Clicking any header toggles smooth height and opacity transitions matching primary skin layer accordions.

- **Responsive Card Layout and Direct Desktop Descriptions**:
  - Radio cards inside Coverage and Cutouts have comfortable height and breathing room (`p-3.5 sm:p-4 rounded-xl`).
  - Desktop view (`sm:`): Display description text directly beneath the title (`hidden sm:block text-[11px] text-neutral-400 pl-6`). No `(i)` tooltip button is shown on desktop.
  - Mobile view: Compact card with `(i)` button (`sm:hidden`) that toggles an animated drawer, preserving compact mobile scrolling.
  - Choice titles use `whitespace-nowrap` instead of `truncate` to prevent awkward truncation such as `Model...`.

- **Monochrome Neutral Badges**:
  - Feature badges (`Case-Friendly`, `Full Protection`, `Logo Exposed`, `Full Coverage`) use neutral monochrome styling (`border-white/10 bg-white/[0.05] text-neutral-400 font-mono text-[8px] sm:text-[8.5px]`), eliminating distracting amber/primary colors.

- **Unclipped Thumbnail Custom Tag ('NEW')**:
  - Rendered on the outer capsule container rather than inside the `overflow-hidden` rounded div, preventing the capsule border from clipping custom badges.
  - Positioned top center (`-top-0.5 left-1/2 -translate-x-1/2 z-20`) with slightly larger sizing (`text-[7.5px] sm:text-[8px] px-2 py-[1.5px] font-bold font-mono`).
  - Swatch containers provide `pt-2` headroom so badges never clip against carousel edges or category headers.

---

## 41. Double-Buffered Skin Crossfade, Dual Resolution Master Textures, and Per-Part Texture Controls

- **Double-Buffered Canvas Crossfade Invariant (No Bare Device Flash)**:
  - When switching between finishes or swatch choices, the canvas must never unmount or flash the bare device chassis underneath.
  - In `stacked-layer-canvas.tsx`, the component key uses stable identifiers (`v2-${layer.id}-${currentAngleId}`) without `choice.id`.
  - `V2SkinCanvasLayer` implements a dual-buffered canvas architecture:
    - The previous skin texture remains 100% visible on the back canvas while the new high-resolution texture downloads into browser memory.
    - Once the new texture is fully loaded and drawn to the front canvas, the front canvas smoothly fades in directly on top (opacity `0 -> 1` in 220ms).
    - After the fade transition completes, the back canvas is updated to the new texture and the front canvas resets to 0. Bare hardware chassis is never exposed during transitions.

- **Dual-Resolution Master Textures (`texture_url` vs `texture_big_url`)**:
  - Standard master textures (such as `Exacoat-Texture-Small-Black-Camo.jpg`, 2000x3000 portrait) are optimized for smartphones and small handheld accessories.
  - Large master textures (`texture_big_url`, such as `Exacoat-Texture-Big-Black-Camo.jpg`, 3000x2000 landscape) provide fine-grained pattern definition across expansive laptop lids, keyboard decks, and tablet backs without texture blurring.
  - Automatic Resolution Hierarchy: In both webstore and Studio, devices automatically resolve `texture_big_url` when `family === 'laptop' || family === 'tablet'` or when a layer's `texture_size === 'big'`, falling back to standard `texture_url`.

- **Per-Part Texture Transformation Controls**:
  - `ConfiguratorLayer` persists individual texture transformation properties in WordPress post meta:
    - `texture_scale`: Float scale multiplier (0.50x to 1.50x, default 0.75x for 25% smaller pattern scale).
    - `texture_rotation`: Discrete rotation angle (0°, 90°, 180°, 270°).
    - `texture_size`: Resolution override (`'auto'`, `'small'`, `'big'`).
  - Canvas transformation rotates around center `(500, 500)` with `ctx.translate(500, 500)` and `ctx.rotate(rad)`, accurately swapping dimensions on 90° and 270° turns.

- **Out of Stock Inventory Flag for Master Finishes (`in_stock`)**:
  - Global finishes support `in_stock: boolean` (default `true`).
  - Finishes marked out of stock (such as Patina) display out-of-stock indicators, are disabled from buyer selection, and can be toggled in real time in Configurator Studio's Master Textures modal.

- **Studio Media Slot Previews (No Raw URL Inputs)**:
  - Raw text inputs for Alpha Masks, Hardware Chassis Renders, and Cutout Masks (Logo, Stylus, Model Cut) are replaced with clickable 56x56 square thumbnail previews opening the WordPress Media Library modal directly.
  - Each media slot displays the file basename, status pill (`Configured` vs `Not set`), a direct `Browse Media` action, and a single-click `Clear` button.

- **Removal of Redundant 'Included' Badges**:
  - The redundant label 'Included' is removed across Coverage accordions, Model Cut cards, and Cutout choice pills. If an option carries an up-charge, `+{price}` is displayed; if base, no price badge is shown.

---

## 36. Device-Level Texture Scale, Persistent Chassis, and Cutout Switch Architecture

- **Persistent Bare Hardware Chassis Invariant**:
  - The bare hardware device chassis (Layer 0) must remain completely static and still during all user interactions.
  - Replaced re-animating motion wrappers on the base chassis with a persistent static `<img>`.
  - In `V2SkinCanvasLayer`, offscreen canvas pre-compositing and double-buffered ping-pong rendering ensure newly selected textures or toggled cutouts composite in memory before displaying, eliminating any bare chassis flicker or flashing.
- **Device-Level Texture Scale (`texture_scale`)**:
  - Texture scale is a device-level property, not configured per individual skin part.
  - Configured via a dedicated Device Texture Zoom / Scale slider card at the top of the Skins tab in Configurator Studio (50% to 150%, default 75%).
  - Displayed as a percentage column ("Scale") in the Configurator Studio catalog table (`{Math.round((p.texture_scale ?? 0.75) * 100)}%`).
  - Persisted in WordPress post meta `_exacoat_configurator_profile` via REST API.
- **Cutouts & Coverage Switch UI Overhaul**:
  - **Logo Cutout**: Header preview buttons (`Cutout / Solid`) and bottom checkbox are replaced with an iOS-style toggle switch for "Buyer Choice on Webstore".
  - **Custom / Stylus Cutout**: Hidden by default for devices without a stylus or custom hardware cutout. Operators click `+ Add Custom Cutout` to reveal the section. When active, it features an iOS-style toggle switch and a delete button to clear and hide it.
  - **Model Coverage**: Replaced preview buttons with an iOS-style toggle switch for "Buyer Choice on Webstore". Removed `None (Flat Cut)` from coverage mode selection. Toggling off sets `coverage_type = 'none'`.

---

## 42. v2 Configured Composite Generation, Permanent WordPress Upload, View Texture Scale & Meta Standardization

- **v2 Client-Side Composite Image Generation Invariant**:
  - In v2, the configurator renders composite canvas images on-the-fly during "Add to Cart" or configuration completion.
  - Draws the hardware base chassis (Layer 0), then for each active skin layer: rotates and scales master textures according to the view's framing, applies alpha masks with `ctx.globalCompositeOperation = 'destination-in'`, punches logo/stylus/model cutouts using `ctx.globalCompositeOperation = 'destination-out'`, and layers raytraced shading (`multiply` shadows and `screen` highlights).
  - Exported as a high-quality PNG data URL (`canvas.toDataURL('image/png', 0.92)`).
- **Permanent Composite Upload Invariant (`/composite/upload`)**:
  - Passing relative URLs (such as `/api/configurator/composite?key=...`) breaks external consumers including transactional emails, invoices, and Exacoat Manager order views running on separate origins (`manager.exacoat.com`), and breaks on serverless container restarts.
  - The storefront uploads the composite directly to WordPress via `POST /wp-json/exacoat-core/v1/composite/upload`. The WordPress backend writes the PNG to `wp-content/uploads/composites/{key}.png` via `wp_upload_dir()` and returns a permanent, immutable absolute URL (`https://staging.exacoat.com/wp-content/uploads/composites/...`).
  - Saved to WooCommerce cart and order line items as `_configured_image_url`, `_configurator_image`, `_thumbnail_url`, and `image_url` on both `/?wc-ajax=add_to_cart` and post-checkout `PUT /orders/{id}` updates.
- **View-Level Texture Scaling (`view.texture_scale`)**:
  - Different viewing angles (such as Back, Front, Side, Folded) have different framing, camera distances, and POV.
  - Moved `texture_scale` from the device level to the `ConfiguratorView` level (`view.texture_scale ?? 0.75`).
  - Studio provides a Texture Zoom / Scale slider on each view card in the Views / Angles tab.
  - Studio catalog table displays the primary view scale percentage (`(p.views?.[0]?.texture_scale ?? p.texture_scale ?? 0.75) * 100%`).
- **Standardized Cart & Order Line-Item Meta Formatting**:
  - Model Cut metadata is strictly formatted as `"Model Cut"` (all trailing explanations like `(Back only)` are stripped).
  - Logo Cutout metadata is cleanly formatted as `"With Logo Cutout"` or `"No Logo Cutout"`.
  - Order details, mini bag, and invoices render the true configured skin composite instead of falling back to the bare device.

---

## 43. Universal View-Level 3D Shading, White Preview Thumbnail Slot & Layer Shading Pruning

- **Universal View-Level 3D Shading Invariant**:
  - Photorealistic ambient occlusion and drop shadow maps are universal to the device and viewing angle, not configured per individual skin part.
  - View-level shading maps (`view.shadow_png_url` and `view.shading_image_url`) strictly take precedence over any legacy per-layer asset overrides across all storefront canvas layers, Studio viewport rendering, and add-to-cart composite generators.
  - `highlight_png_url` is strictly optional and only evaluated if explicitly specified on the view; it does not fall back to old extracted layer highlights when a view shadow is present.
- **Automatic Per-Layer Shading Pruning Invariant**:
  - Legacy extraction tools stored `shadow_png_url` and `highlight_png_url` inside `layer.assets_by_view[view_id]`.
  - When updating shading in Studio or saving profiles via `POST /configurator/save` (`rest_save_product_configurator`), all legacy per-layer shading entries are automatically pruned from `layers[].assets_by_view`, preventing stale shadows from overriding updated device shading.
- **Studio White Background Preview Thumbnail Slot**:
  - Replaced legacy "Extract from Render" and "Use Base" buttons with a clean 56x56 square thumbnail slot.
  - The thumbnail button explicitly uses a pure white background (`bg-white`), ensuring dark transparent shadow and shading PNGs are rendered with crisp contrast and visibility.
  - Clicking the white preview opens the WordPress Media Library directly, with 1-click Clear and Browse actions.

---

## 44. Finish-Level 3D Shading Tone, Master Textures Card Overhaul & White Cutout Buttons

- **Specular Highlight Single-Source Fallback Invariant**:
  - If a dedicated specular highlight PNG is not uploaded (`view.highlight_png_url`), the storefront rendering engine and add-to-cart composite generator automatically fall back to the primary shading source (`shadowSrc`) with `mix-blend-mode: screen`. This guarantees that specular highlights appear reliably across devices whenever highlight opacity is configured.
- **Finish-Level Shading & Specular Opacity Invariant**:
  - Different vinyl materials reflect light differently (e.g. dark textured finishes like Black Camo or Black Matte require stronger highlights, while bright white finishes require deeper multiply shadows).
  - Finishes support individual `shadow_opacity` and `highlight_opacity` values on `GlobalFinish`, saved to WordPress options via `saveGlobalFinishDirect` / `rest_save_finish`.
  - Storefront canvas (`stacked-layer-canvas.tsx`), composite generator (`device-skin-configurator.tsx`), and Studio viewport evaluate finish-level opacity before falling back to angle defaults.
- **Master Textures (v2) Structured Card Architecture**:
  - Replaced unstructured horizontal form rows with clean, structured cards.
  - Header: Swatch thumbnail mini, Finish Name, Group dropdown, Slug, Stock toggle, Extra Price input, Delete, and Save button.
  - Media Grid: 3 dedicated slots for Swatch Thumbnail (150x150), Master Texture URL v2 (1000x1000), and Master Texture Big (2000x2000).
  - 3D Shading Tone Card: Dedicated Shadow Multiply and Highlight Screen sliders with live percentage indicators.
- **High-Contrast White Background for All Cutout Buttons**:
  - Model Cut Perimeter Mask, Logo Cutout Mask, and Stylus Cutout Mask thumbnail preview buttons strictly use a bright white background (`bg-white border-white/20 shadow-sm`) with dark icons, ensuring transparent black cutout paths remain clearly visible to operators.

---

## 45. Finish Texture Reordering within Groups & Global Finish Deactivation

- **Finish Reordering within Groups Invariant**:
  - Finishes within each group are ordered strictly by an explicit numeric `order` index (`(a.order ?? 0) - (b.order ?? 0)`).
  - Studio Master Textures modal provides Move Up (`ChevronUp`) and Move Down (`ChevronDown`) controls on each finish card alongside a `#pos` badge.
  - Moving a finish swaps position with adjacent items in the same group, normalizes group sequence (0, 1, 2, ...), and immediately persists the complete order to WordPress database options via `POST /wp-json/exacoat-core/v1/finishes/save-all`.
  - Storefront engine (`configurator-loader.ts`) sorts choices by `(a.order ?? 0) - (b.order ?? 0)`, ensuring customer-facing swatches display in the exact custom sequence configured in Studio.
- **Global Finish Deactivation Invariant (`is_active`)**:
  - Difference from Stock Status:
    - "Out of Stock" (`in_stock: false`) keeps the swatch visible to customers with an unavailable state.
    - "Inactive" (`is_active: false`) completely removes and hides the swatch from the customer configurator across all devices.
  - Admin Visibility: Deactivated finishes remain visible in Studio Master Textures with a distinct "Inactive: Hidden from Storefront" badge and dimmed card styling (`bg-zinc-950/60 border-dashed border-zinc-700/60`) so operators can re-activate or edit them at any time without data loss.
  - 1-Click Toggle: Operators can toggle active status with 1 click using the Active / Inactive button in the card header, synchronizing immediately via `POST /wp-json/exacoat-core/v1/finishes/toggle-active`.
  - Status Filtering: Master Textures modal header includes live filter pills: All, Active, and Inactive with dynamic device counts.

---

## 46. Legacy v1 Read-Only Protection, Convert to v2 Engine & Production Variants Overhaul

- **Legacy v1 Read-Only Mode & Storefront Protection Invariant**:
  - Live products on `web.exacoat.com` read directly from raw WooCommerce MKL post meta (`_mkl_product_configurator_*`).
  - To prevent accidental corruption or schema breakage of live storefront products, all legacy v1 products in Exacoat Manager's Configurator Studio are locked in Read-Only Mode (`editingProfile.configurator_version !== 'v2'`).
  - The header "Save Configurator" action is replaced with "Convert to v2 Modern Engine", and direct save attempts trigger a warning toast prompting conversion.
  - An amber notice banner is displayed above the viewport canvas clarifying that legacy MKL settings are protected.

- **Convert to v2 Modern Engine & Optional 3D Shadows Workflow**:
  - Clicking "Convert to v2 Modern Engine" upgrades `configurator_version` to `'v2'` in memory, initializes modern view texture scaling and optional shading properties, normalizes size multipliers, and unlocks studio editing and save actions.
  - In v2 Modern Engine, 3D shading is completely optional: if an admin has not yet uploaded a shadow map (`shadow_png_url` is empty), the viewport and storefront render cleanly without shadows. The operator can upload or extract shading whenever CAD renders become available.

- **Standardized 2.0x Multiplier for Laptops and Tablets**:
  - Size multipliers for laptops and tablets are standardized to `2.0` across the entire system (replacing legacy `2.5` and `1.8`).
  - Standardizes premium finish up-prices to +IDR 60,000 (IDR 30,000 * 2.0x) on both webstore checkout and Studio simulation.
  - Applied in PHP backend (`convert_mkl_to_profile`, `rest_get_configurator_profiles`), TypeScript bridge (`wordpressBridge.ts`), and Studio device initialization (`handleOpenDevice`, `handleConvertToV2`).

- **Production Variants Modern Card Interface**:
  - Replaced cramped, unstyled input boxes with an Antislop-compliant structured card interface.
  - Variant groups feature numeric badges (`#1`, `#2`), descriptive titles, and delete group actions.
  - Option rows feature sequential index pills, clean option title inputs, formatted price differential inputs (`+IDR [amount]`), and delete option buttons.
  - Empty state provides a clean explanation that single template cuts will be used for production.

- **v1 Logo Cutout Overlay & Viewport Parity**:
  - In legacy v1 MKL, MacBook and Apple devices render the metallic brand logo as an image overlay on top of the vinyl skin (`Macbook-Neo-Logo.png` at z-index 35).
  - Studio viewport renders this logo overlay directly for v1 devices when logo cutout is enabled, restoring the missing Apple logo preview on MacBook Neo (`#542139`).
  - In the simulator dock, the Logo Cutout toggle synchronizes bidirectionally with the device variants map.

- **Views Tab v1 Hygiene**:
  - Controls for "Angle 3D Shading & Highlights" and "Angle Texture Zoom / Scale" are strictly hidden when inspecting v1 devices (`configurator_version !== 'v2'`), eliminating confusion from irrelevant controls.

---

## 47. Strict Separation of Production Variants from Logo Cutouts & Coverage Styles

- **The Separation Invariant**:
  - `variants` are strictly reserved for physical hardware models requiring distinct vinyl cut templates (e.g. Wi-Fi vs Cellular, Surface Pro kickstand editions, or distinct hardware chassis revisions).
  - Logo Cutouts and Coverage Styles (Model Cut vs Model 360) are managed exclusively by `coverage_and_cutouts`.
  - Mixing them previously caused "Logo Cutout" to appear as a production variant group with duplicate options ("With Logo Cutout (+IDR 0)" and "Without Logo Cutout (+IDR 0)") in Studio Pricing and Settings.
- **Backend Sanitization (`sanitize_variants`)**:
  - `Exacoat_Configurator_Engine::sanitize_variants( $variants )` filters out any variant whose ID or name matches `logo`, `cutout`, `coverage`, or `model cut`.
  - Applied across `convert_mkl_to_profile`, `rest_get_product_configurator`, and `rest_save_product_configurator` to ensure backend never persists or returns logo/coverage options as production variants.
- **Frontend & Bridge Defenses**:
  - Removed legacy hardcoded injection of `logo_cutout` and `coverage` into `convertedVariants` in `wordpressBridge.ts`.
  - Studio filters variants during profile loading (`handleOpenDevice`), modern conversion (`handleConvertToV2`), and saving (`handleSaveProfile`).
  - Pricing Settings tab and simulator dock filter variants so legacy cached payloads never render duplicate logo cutout pills or zero-dollar production price rows.

---

## 48. Finish Group Persistence & Preservation Invariant

- **Empty and Custom Group Persistence**:
  - Store administrators frequently create finish groups (e.g. "Other", "Limited Drop", "Wood Series") before assigning finishes to them.
  - User-created finish groups must be permanently preserved in the database option `_exacoat_finish_groups` even if they currently contain 0 finishes.
  - `get_finish_groups()` in `class-configurator-engine.php` must NEVER prune non-empty or user-configured groups simply because they have 0 finishes. Pruning is strictly limited to obsolete legacy defaults (`Pastels & Colors`, `Special editions`).
- **Group Management Tray & Lifecycle Sync**:
  - Reordering or adding groups (`handleAddNewGroup`, `handleMoveGroup`) synchronizes `storedFinishGroups` with the backend response (`res.groups`).
  - Studio displays live finish counts on each group chip (e.g. `Other (0)`).
  - Admins can explicitly delete empty groups with 1 click via `handleDeleteGroup`, while deletion of non-empty groups is blocked with a descriptive notice prompting finish reassignment first.

---

## 49. Master Textures Batch Save & Automated Storefront Revalidation

- **Global Master Texture Inheritance Invariant**:
  - In v2 Modern Engine, device configurators do not store hardcoded texture URLs or finish slice assets in individual WooCommerce product metadata.
  - Devices store exclusively geometric alpha masks (`mask_svg_url`), optional shadow maps (`shadow_png_url`), and base chassis hardware renders (`view.background_url`).
  - On the customer storefront (`web.exacoat.com`), all device configurators dynamically inherit master finish textures from the global finishes endpoint (`/api/configurator/finishes` / `/wp-json/exacoat-core/v1/finishes`).
  - Consequently, **operators do NOT need to revalidate, re-save, or re-audit individual devices when master textures are edited**. Updating a master finish automatically updates every phone, tablet, laptop, and console configurator storewide.

- **Unified Dirty Tracking & Footer Controls**:
  - `isFinishDirty(f)` centralizes dirty detection across all finish editing states (texture URLs, thumbnails, names, groups, prices, stock, active status, badges, shadow opacities, and highlight opacities).
  - Modal footer dynamically reflects dirty state:
    - When dirty: displays animated amber counter badge (`{count} finish(es) with unsaved changes`), "Cancel" button to revert and close, and golden "Save All Changes ({count})" button.
    - When clean: displays informative operational hint and standard "Done" button.
  - Individual card saves (`handleSaveMasterFinish`) cleanly purge the saved finish ID from all editing state maps upon success, instantly transitioning the card button from "Save Changes" to "Saved".

- **Automated Next.js Storefront Cache Revalidation**:
  - Both `rest_save_finish` and `rest_save_all_finishes` in `class-configurator-engine.php` automatically trigger Next.js On-Demand Incremental Static Regeneration (ISR) and Cloudflare edge purge via `Exacoat_Configurator_Engine::trigger_storefront_revalidation()` with `tag=finishes` and `path=/api/configurator/finishes`.
  - Edge and client caches are purged in real time without manual admin intervention.

---

## 50. Finish Group Renaming Architecture & 0.22mm Physical Skin Micro-Shadow Invariant

- **Finish Group Renaming Architecture & Atomic Migration**:
  - Store administrators can rename finish groups directly within the Group Management Tray in Configurator Studio's Master Textures modal.
  - Endpoint `POST /wp-json/exacoat-core/v1/finishes/rename-group` (`rest_rename_finish_group`) in `class-configurator-engine.php` atomically:
    1. Updates the group name in WordPress database option `_exacoat_finish_groups`, strictly preserving the existing tab sequence.
    2. Iterates across all finishes stored in `exacoat_global_finishes` and migrates any finish where `group === old_name` to `new_name`.
    3. Triggers immediate storefront cache revalidation (`tag=finishes`).
  - Studio provides interactive inline editing: clicking the pencil icon (`Edit3`) or group title switches the chip to an inline input field with save (`Check`) and cancel (`X`) buttons, keyboard shortcuts (`Enter` to save, `Escape` to cancel), and loading spinner.

- **Master Textures Form Controls & Input Beautification (Antislop UI Standards)**:
  - Upgraded all form inputs, select elements, toggles, checkboxes, sliders, and badge controls across Master Textures finish cards:
    - **Finish Name**: Dark inner background (`bg-zinc-950/80`), rounded-xl border, and crisp focus ring.
    - **Group Dropdown**: Custom container with explicit `ChevronDown` dropdown indicator replacing generic browser select styling.
    - **Extra Price**: Styled financial input pill with `+IDR` prefix badge and tabular numbers.
    - **Active & Stock Toggles**: Glowing emerald/amber status dots with clear visual states and smooth hover effects.
    - **Custom per Device**: Replaced standard HTML checkbox with a modern, animated toggle switch.
    - **Storefront Badge**: Clean composer pill with circular color swatch picker and uppercase badge preview.
    - **3D Shading Tone Sliders**: Numeric percentage badges and sleek slider track styling.
    - **Media Texture Slots**: Refined glass borders and emerald "Assigned" status indicators.

- **0.22mm Physical Skin Micro-Shadow Invariant**:
  - Real vinyl skins have a physical thickness of 0.22mm.
  - An exaggerated drop-shadow (such as `blur: 2.5px`, `opacity: 0.55`, `y-offset: 1px`) causes an unnatural, heavy dark halo around white skins on light chassis and around Apple logo cutouts, resembling thick plastic/acrylic sheets.
  - Calibrating canvas filters to `drop-shadow-[0_0.75px_1.5px_rgba(0,0,0,0.38)]` accurately simulates the microscopic physical edge bevel of genuine 0.22mm vinyl skins without unsightly dark smudges.
  - Synchronized identically across storefront canvas (`c:\AI\exacoat-web\components\configurator\stacked-layer-canvas.tsx`) and Studio viewport (`c:\AI\exacoat-manager\src\pages\ConfiguratorStudioPage.tsx`).

---

## 51. Configurator Metadata Physical Hierarchy & Universal Configured Skin Image Pipeline

- **Physical Hierarchy Sorting Invariant**:
  - WooCommerce default metadata display and arbitrary JavaScript object iteration previously sorted skin attributes alphabetically (e.g. "Additional Camera & Back Glass" sorted ahead of "Back Skin").
  - Physical devices possess an unequivocal visual and manufacturing hierarchy:
    1. **Primary Base Skin (Rank 0)**: Back Skin, Top Lid, Main Body, Full Body MUST appear strictly at Line 1 (top).
    2. **Secondary Physical Components (Rank 10)**: Camera, Additional Camera & Back Glass, Accents, Frame, Hinge appear at Line 2+.
    3. **Configuration Options (Rank 100-102)**: Model Coverage (100), Logo Cutout (101), Stylus Cutout (102) appear at the bottom.
  - Implemented `sort_addon_layers` in `class-configurator-engine.php` to sort addons before saving order item meta and rendering cart item data.
  - Implemented `sortItemSpecs` in `orderItems.ts` to ensure Exacoat Manager Order Detail drawers, packing slips, and shipping labels render Back Skin at the top.
  - Exported `sortItemLayers` in `exacoat-web` (`lib/cart-store.ts`) and applied across cart drawer, checkout review, and order confirmation pages.

- **Universal Configured Skin Image Display Pipeline**:
  - **Permanent Upload Storage**: Offscreen canvas renders are uploaded to WordPress uploads directory (`wp-content/uploads/composites/{key}.png`) via dual REST endpoints `/configurator/composite/upload` and `/composite/upload` with permissive CORS headers.
  - **No Dimension Suffix Mangling**: Media helpers (`isConfiguredCompositeUrl` in `media-url.ts`) strictly protect composite URLs from having WordPress thumbnail suffixes (`-240x240.png`) appended, preventing 404 HTML errors that previously caused `onError` fallback to the bare phone chassis.
  - **Transactional Emails & Order Views**: `class-checkout-engine.php:filter_order_item_thumbnail` and `class-order-manager.php:1541` dynamically inspect `_configured_image_url`, `_configurator_image`, and `image_url` to display the customized skin in WooCommerce emails, checkout receipts, and Exacoat Manager Order Detail drawers.
  - **Exacoat Manager Bridge Enrichment**: `enrichOrder` in `wordpressBridge.ts` extracts `_configured_image_url` into `item.image_url` for immediate visual inspection by operators and fulfillment staff.

---

## 52. Finish Reordering, Group Changes & Texture Update Integrity Invariant

- **Deterministic Composite Fingerprint Invariant**:
  - Previously, composite image cache fingerprints relied on positional array indices (`${c.layerId}_${c.choiceId}` where `choiceId = layerNumId * 1000 + cIdx + 1`).
  - Positional indices are vulnerable to collisions: swapping or reordering finishes changes `cIdx`, meaning finish B could inherit the cached composite key previously generated for finish A.
  - Upgraded fingerprint generation in `device-skin-configurator.tsx`:
    `${c.layerId}_${c.choiceSlug}${texHash}`
    where `choiceSlug` is the permanent identifier (e.g. `swarm`, `black-camo`) and `texHash` is a deterministic 4-character hash of the master texture URL.
- **Three Operational Invariants**:
  1. **Reordering Finishes**: Reordering finishes within a group or moving them up/down changes display position in the UI tabs but preserves the stable slug (`swarm`). The composite image fingerprint remains identical and never collides with adjacent textures.
  2. **Group Changes**: Changing a finish's group (e.g. moving from "Signature skins" to "Special editions") alters catalog categorization only. The visual texture and composite fingerprint remain completely unchanged.
  3. **Texture File Updates**: When an administrator uploads a new or higher-resolution texture file for an existing finish, the texture URL changes, causing `texHash` to change automatically (e.g. `_8f3a` to `_9k1c`). A brand new composite file is generated and uploaded to WordPress, bypassing stale browser and CDN edge caches without breaking historical order composite images.

---

## 53. Dynamic Finish Group Presentation & Shop the Look Presets Architecture

- **Zero Hardcoded Settings Invariant**:
  - Group presentation styles and curated formulas are 100% data-driven and configurable by store operators in Exacoat Manager ERP.
  - Group settings are stored in WordPress database option `exacoat_finish_group_settings` (`FinishGroupSetting`):
    - `display_style`: `'cards'` (standard tactile capsule cards with texture preview and title) vs `'compact_dots'` (sleek circular finish swatches).
    - `collapsed_by_default`: Boolean flag to render large groups inside an accordion drawer that users can expand when desired.
    - `show_more_limit`: Number of initial swatches shown before collapsing into an inline `+{count} more` expander chip.
  - Presets are stored in WordPress database option `exacoat_configurator_presets` (`ConfiguratorPreset`):
    - `id`: Unique slug identifier.
    - `title`: Curated look title (e.g. "Titanium Stealth Bespoke").
    - `tagline`: Clear aesthetic formula summary.
    - `badge`: Optional status pill (e.g. "POPULAR", "STAFF PICK").
    - `coverage`: Optional coverage lock (`model_360` vs `model_cut`).
    - `logo_cutout`: Optional logo cutout lock (`true` for exposed logo, `false` for full coverage).
    - `layers`: Map of layer keys to target finish slugs (e.g. `{"back": "titanium-plus", "camera": "matte-black", "back-glass": "matte-black"}`).
    - `triggers`: Optional finish slugs that trigger non-intrusive contextual pairing chips (e.g. `["titanium-plus"]`).

- **Compact Dots & Dynamic Header Labeling (Apple Style)**:
  - When a group is configured as `compact_dots` (e.g. "Colors & Pastels"), individual labels underneath each dot are omitted, reducing vertical space usage by ~80% (from ~280px to ~44px).
  - Hovering or selecting any dot dynamically updates the category section header in real time:
    `COLORS & PASTELS: PETAL PINK` with extra price tags if applicable.
  - Mobile & Accessibility Compliance: Each compact dot is housed within a minimum 44px by 44px interactive tap hitbox to prevent accidental mis-taps on mobile devices. Active selections use high-contrast amber gold focus rings (`ring-2 ring-[#f3aa18] ring-offset-2 ring-offset-black`).

- **Shop the Look & Contextual Pairing Assist**:
  - Eliminates buyer confusion regarding how to configure multi-part bespoke formulas (e.g. Titanium+ back with Matte Black camera and back glass).
  - Non-Intrusive Floating Trigger: A clean `[ Compass: Shop the Look ({count}) ]` pill is positioned on the visualizer canvas and in the customizer eyebrow bar. It never interrupts the start of user customization.
  - Contextual In-Flow Pairing: When a customer selects a trigger finish (e.g. Titanium+), an inline suggestion card appears below the Back Skin layer: `Popular Mix: Titanium Stealth Bespoke [Apply Combo]`. Clicking instantly applies the complementary accent layers.

- **Zero Sparkle Policy Across UI & Codebase**:
  - Sparkle icons (`✨` / `Sparkles`) are strictly prohibited across all storefront and manager UI components.
  - Purposeful craft icons (`Compass`, `Palette`, `Layers`, `SlidersHorizontal`, `Wand2`) are used exclusively.

---

## 33. Compact Swatch Sizing, Mobile Alignment & Model 360 Price Resolution

- **Compact Dot Sizing (40x40px) & Expander Height**:
  - Compact finish dots are sized to exactly `40x40px` (`w-[40px] h-[40px]`), enclosed within a minimum 44px by 44px tap hitbox (`min-w-[44px] min-h-[44px] p-0.5`) to satisfy mobile touch accessibility standards.
  - The inline `+x more` / `Less` expander button uses the exact same `40px` height (`h-10` / `h-[40px]`), ensuring visual uniformity with adjacent circular swatches.
  - In mobile carousel card view (`lg:hidden`), the `+x more` button container matches the height of the swatch capsule image (`h-[50px] sm:h-[54px] flex items-center justify-center`), vertically centering the expander pill with the swatches image of the card.

- **Model 360 Upcharge Resolution & Persistence Invariant**:
  - When a device enables Model 360 frame wrap (`coverage_type === 'model_cut_and_360'`), the upcharge is configured in `model_360_extra_price` (standard IDR 40,000).
  - Studio Persistence: In `ConfiguratorStudioPage.tsx`, both `handleSaveProfile` and `handleSetCoverageAndCutouts` ensure `model_360_extra_price` is explicitly stored as a numeric value in post meta rather than remaining undefined.
  - Backend Defaulting: In WordPress plugin `class-configurator-engine.php`, both `rest_get_product_configurator` and `rest_save_product_configurator` validate and default `model_360_extra_price` to 40000 when missing or non-numeric.
  - Storefront Resolution: In `device-skin-configurator.tsx`, `model360ExtraPrice` resolves via `typeof raw360 === "number" ? raw360 : 40000`. Authentic CMS prices (including explicit 0 for free wrap) are respected, while legacy unpersisted profiles default safely to standard 40,000 IDR.

---

## 34. Per-Device Presets ("Shop the Look") Architecture & Visual Cards Redesign

- **Strict v1 Configurator Isolation Invariant**:
  - Global finish presentation settings (`group_settings`: compact circular dots, collapsible drawers, custom visible limits) must NEVER apply to legacy v1 configurators.
  - In `swatch-selector.tsx`, `getGroupSetting` strictly checks `if (!isV2 || !groupSettings) return {};`. Legacy v1 devices always render tactile swatch cards.

- **Presets Modal Visual Image Cards Redesign**:
  - All recipe text clutter (titles, descriptions, coverage tags, recipe text chips) is removed from the modal.
  - Displays a clean visual grid of device image cards showing the device dressed in its exact skin combination:
    - If `preset.image_url` is provided, renders the custom render directly.
    - Otherwise, renders a live visual device canvas using `<StackedLayerCanvas compactPreview={true}>`.
  - Badges: Supported high-contrast badges (`POPULAR`, `STAFF PICK`) rendered as clean pill badges on the top-left of the image cards.
  - Action Button: Each card features a secondary button underneath labeled `"Apply Look"` (or `"✓ Applied"`). Not a primary yellow button.

- **Deterministic Layer Matching (No Substring Fuzzy Collisions)**:
  - Presets resolve layer keys using exact matching first (`normKey === layerId || normKey === layerClass || normKey === layerSlug || normKey === layerNameLower`), eliminating duplicate label collisions (such as "Additional Camera & Back Glass" colliding with "Camera").

- **Per-Device Presets Authoring in Configurator Studio**:
  - Operators author looks per device directly in Configurator Studio (`ConfiguratorStudioPage.tsx`) under the dedicated **Presets** inspector tab.
  - Includes Title, Badge selector (`None`, `POPULAR`, `STAFF PICK`), Coverage, Logo Cutout, Per-layer Finish Selectors, and optional Preview Image URL (with WordPress Media Library browser).
  - Features a 1-click **"Use Canvas Look"** button to capture current visual simulator selections into a new preset.
  - Features a **"Test"** button on each preset card to preview that look on the live simulator canvas immediately.
  - Presets are permanently persisted into WooCommerce post meta `_exacoat_configurator_profile` via `rest_save_product_configurator`.

- **Configurator Catalog Table Presets Column**:
  - Catalog table in Studio features a dedicated **Presets** column displaying the number of active looks on each device (e.g. `2 Looks` or `0`).

---

## 35. Non-Visual Kit Layers, Global Master Texture Priority & 1:1 Canvas Scaling Architecture

- **Non-Visual Kit Layers Invariant (`is_non_visual`)**:
  - Many device models (e.g. laptops like MacBook Neo, keyboards, consoles) offer physical cut parts (such as Bottom Base, Trackpad, Palm Rest, Charger wrap) that lack CAD renders or dedicated 3D viewing angles.
  - Forcing operators to invent dummy viewing angles or upload missing masks creates broken canvas rendering and audit errors.
  - Marking a layer as `is_non_visual: true` classifies it as a physical kit part:
    - **Configurator Studio**: Layer Inspector provides a clean toggle: `Layer Display Mode`: `3D Canvas` vs `Kit Part (No 3D View)`. Kit layers display a `Kit Part` badge, are omitted from 3D viewport draws, and are excluded from asset integrity audits.
    - **Storefront Accordion**: Kit layers display in the options accordion with full swatch choices, accurate pricing (with size multipliers applied), and a subtle `[Kit Part]` badge. Customers can configure and order these parts seamlessly without rendering issues on the 3D canvas.
    - **Composite Canvas**: `stacked-layer-canvas.tsx` skips rendering layers when `layer.isNonVisual || v2Layer?.is_non_visual || !vAsset?.mask_svg_url`.

- **Global Master Texture Priority over Legacy Slices**:
  - In v2 Modern Engine, finishes inherit global master textures (`texture_url` and `texture_big_url`).
  - Layer-level `render_texture_map` slices inherited from duplicated legacy templates must NEVER shadow global master textures.
  - Both Studio and Storefront evaluate textures with strict priority:
    - If `activeFinish.is_custom_per_device === true`: Lookup artwork in `render_texture_map`.
    - Otherwise: Strictly use the global finish master texture (`useBigTexture ? texture_big_url : texture_url`).
  - Configurator Studio Asset Audit provides a 1-click prune tool to strip legacy finish slices from v2 products.

- **1:1 Canvas Texture Scale Invariant**:
  - Default `texture_scale` and `textureScale` across Studio, WordPress plugin, and Storefront is standardized to `1.0` (100%), replacing the legacy `0.75` (75%) fallback.
  - 1000x1000 square textures pass through at 1:1 (`1000 * zoom = 1000px`), eliminating unskinned margin boxes on wide devices like laptops.

---

## 36. Primary Brand Typography (Chakra Petch), Non-Distracting Preset Badges & Configuration Tooltips

- **Primary Brand Typography Hierarchy Invariant (`Chakra Petch`)**:
  - The primary brand typography for Exacoat is `Chakra Petch`.
  - In Storefront (`exacoat-web`):
    - Product title in configurator (`{cleanProductName} SKINS`), floating "Shop the Look" button on canvas, eyebrow triggers, modal titles, and each layer accordion title (`{layer.name}`) strictly utilize `Chakra Petch` in normal weight (`font-['Chakra_Petch'] font-normal`, not bold).
  - In Manager Studio (`exacoat-manager`):
    - Imported via Google Fonts in `index.html` and configured as `font-heading` / `font-chakra` in `tailwind.config.js`.
    - Page titles (`PageHeroHeader`), catalog device names, fullscreen editor top bar titles, inspector stage tabs, and modal titles strictly use `font-heading font-normal` (not bold).

- **Shop the Look Modal Design & Clean Image Canvas**:
  - Presets Modal (`presets-modal.tsx`) features a dedicated subtitle under "Shop the Look" explaining its purpose ("Curated finish combinations designed for this device").
  - Device render containers use a clean, transparent canvas without heavy dark gradient background boxes or borders, letting the device and its drop shadow float naturally on the card surface.
  - Distracting yellow block badges are replaced with an understated frosted glass capsule featuring a glowing micro dot indicator (amber for POPULAR, emerald for STAFF PICK) and normal-weight Chakra Petch micro typography.
  - Badges and Specs triggers are pinned directly to the outer card corners (`absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none`) with top padding on the image container so they never overlay or obscure the device CAD render.

- **Interactive Configuration Specs Popover Architecture (Click-Only & True Data)**:
  - **Click-Only Invariant**: Specs popovers are strictly click-only and never trigger on hover (`activeTooltipPresetId === preset.id`). Operators can toggle via the Specs button, dismiss via the dedicated close `(X)` button, or tap the card canvas.
  - **Dynamic True Data Brand Invariant**: Logo cutout text is never hardcoded. Device brand is dynamically evaluated from product name and profile (e.g. `Apple`, `Samsung`, `Google`, `Xiaomi`).
  - **Capability Guard Invariant**:
    - If the device lacks logo cutout support (`!hasLogoCutoutOption`), the logo row is completely omitted.
    - If supported: displays `preset.logo_cutout ? (brand ? "${brand} Cutout" : "With Cutout") : "Covered"`.
    - If the device lacks coverage choices (`!hasModelCoverageOption`), the coverage badge is omitted.

---

## 37. Configurator Setup Transfer Engine, Portable JSON Profiles & Storefront Fallback Hygiene

- **Configurator Setup Transfer Architecture (`TransferSetupModal`)**:
  - In `ConfiguratorStudioPage.tsx`, operators can transfer full visual configurator setups between device models via the **Transfer Setup / JSON** action modal in the top bar.
  - **Copy To Device Invariant**:
    - When transferring setup from an active device (e.g. Galaxy S26) to another device (e.g. Galaxy S26+), the target product's unique identity is strictly preserved: `product_id`, `device_slug`, `device_name`, `category`, `base_price`, and `currency`.
    - Clones visual structure: `views`, 3D raytraced lighting, alpha masks, `layers`, per-layer texture transforms (scale and 90 degree rotation), curated looks (`presets`), `family`, and `size_multiplier`.
    - Saves directly to WordPress post meta via `saveProductConfiguratorProfileDirect(payload)` and updates the in-memory catalog summary state.
  - **Copy From Device (Template Adoption)**:
    - Adopts an existing configured product template directly into the active editor session for immediate visual preview and interactive adjustment.
    - Requires operator to click "Save Configurator" when satisfied before persisting to the database.
  - **Selective Transfer Toggles**:
    - Supports granular checkboxes: Views & 3D Lighting, Skin Layers & Cutouts, Curated Looks / Presets, Device Family & Multiplier, and Color Variants.
  - **Portable Profile JSON (Export & Import)**:
    - **Export Profile JSON**: Downloads `{device_slug}-profile.json` or copies JSON directly to clipboard with visual confirmation.
    - **Import Profile JSON**: Accepts uploaded `.json` files or raw pasted JSON text, validating schema structure and offering an identity protection toggle (`importPreserveTargetMeta`) before applying to the active editor session.

- **Storefront Fallback Fixtures & Phantom Products Invariant**:
  - In `exacoat-web`, `configurator-loader.ts` falls back to `category-fallbacks.json` if a product is not found in WooCommerce.
  - **Zero Phantom Products Invariant**: Hardcoding speculative or unannounced products (e.g. iPhone 18 Pro) in `category-fallbacks.json` or `POPULAR_ITEMS` in `search-catalog.ts` will cause the storefront to synthesize live HTTP 200 product pages and search suggestions for non-existent items.
  - Fallback fixtures must strictly contain existing, authentic production devices only.

---

## 38. Model 360° Unicode Invariant, Coverage Redundancy Elimination & Sibling Asset Inheritance

- **Degree Symbol Unicode & WordPress Serialization Invariant (`Model 360°`)**:
  - PHP's default `wp_json_encode()` serializes the degree symbol (`°`, U+00B0) as the escape sequence `\u00b0`.
  - In WordPress core, `update_metadata()` runs `$meta_value = wp_unslash( $meta_value )`, which strips the backslash, mutating `\u00b0` into the literal corrupted string `u00b0` (e.g. `Model 360u00b0`).
  - **The Invariant**: All JSON profile serialization in `class-configurator-engine.php` must explicitly pass `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES` wrapped in `wp_slash()`. This ensures the authentic character `°` is stored verbatim in the database post meta without escaping.
  - Additionally, recursive string sanitization (`str_replace(['360u00b0', '360\\u00b0', 'u00b0'], '°', $val)`) must run on both profile fetch and save.

- **Coverage Variant Redundancy Elimination**:
  - Legacy MKL configurator products previously tracked coverage choices ("Model Cut", "Model 360°") as options within a variant group (`id: 'model'`).
  - In the modern v2 configurator engine, coverage is handled first-class via `coverage_and_cutouts` (`coverage_type`, `model_cutout_url`, `model_360_extra_price`).
  - Retaining legacy `model` variants causes duplicate option rows, pricing conflicts, and displays corrupted `Model 360u00b0` text.
  - `sanitize_variants()` in `class-configurator-engine.php` and `wordpressBridge.ts` strictly filters out any variant representing model coverage (`v.id === 'model'`, `v.name === 'model'`, or variants containing `model-cut` or `360` options).

- **Sibling Device Visual Setup & Asset Inheritance**:
  - Sibling devices that share physical CAD dimensions and viewport geometry (e.g. Galaxy S26+ with Galaxy S26, iPhone 16 Plus with iPhone 16, iPhone 16 Pro Max with iPhone 16 Pro, iPhone 17e with iPhone 16e):
    - Must inherit the base device's authentic CAD renders (`views[0].background_url`), 3D raytraced shadow maps (`shadow_png_url`), and alpha masks (`mask_svg_url`) directly to modern v2 engine.
    - Sibling devices must never fall back to older device generations (such as iPhone 16 Pro falling back to iPhone 15 Pro assets).

- **Storefront Curated Presets Isolation ("Shop the Look")**:
  - On `web.exacoat.com` (`device-skin-configurator.tsx`), `effectivePresets` strictly checks `data.v2Profile?.presets`.
  - Fallback to global mock presets (`data.presets`) is strictly eliminated. If a device has 0 configured presets in its profile, the "Shop the Look" floating action button, eyebrow triggers, and presets modal are completely hidden from the viewport.

---

## 39. Universal Catalog v2 Migration & Synthetic Directional Edge Shading

- **Universal Catalog v2 Modern Engine Invariant**:
  - All customizable device skin products across the WooCommerce catalog run on the modern v2 engine (`configurator_version: 'v2'`).
  - Layer alpha masks are extracted directly from authentic `matte-black` skin assets and persisted in `mask_svg_url` and `assets_by_view[viewId].mask_svg_url`.
  - Redundant legacy finish slices (`render_texture_map`) are pruned from database storage, drastically reducing post meta size and eliminating legacy MKL rendering bottlenecks.
  - Sibling models that share CAD dimensions (such as Galaxy S25+ from Galaxy S25, Galaxy S24+ from Galaxy S24) inherit authentic 3D raytraced shadow maps (`shadow_png_url`) and alpha masks.

- **Synthetic Directional Edge Shading Invariant (`applySyntheticDirectionalShading`)**:
  - When a device model does not have a pre-baked 3D raytraced shadow PNG (`!hasViewShadow`), the viewport must not look flat.
  - Dynamic canvas shader simulates top-left incident studio lighting directly on the composited vinyl skin layer:
    - **Top & Left Specular Highlight**: Renders rim highlight using `screen` blend mode (opacity 0.35, offset +1.5px, +1.5px with `destination-out` alpha subtraction).
    - **Bottom & Right Inner Shadow**: Renders inner drop shadow using `multiply` blend mode (opacity 0.55, offset -2px, -2px with `destination-out` alpha subtraction).
  - Active identically across both storefront (`exacoat-web/components/configurator/stacked-layer-canvas.tsx`) and back-office studio (`exacoat-manager/src/pages/ConfiguratorStudioPage.tsx`).

- **Non-Configurator Case Isolation Invariant**:
  - Non-customizable protective accessories (such as Dusk Hybrid Cases) must be explicitly flagged with `_is_configurator: 'no'` via `POST /configurator/toggle-configurator`.
  - This ensures non-skin merchandise does not pollute Configurator Studio listings or trigger false positives during asset integrity audits.

---

## 40. Seamless Master Texture Tiling & Configurable Generated 3D Shading

- **Seamless Master Texture Tiling Invariant (`createPattern` with `DOMMatrix`)**:
  - In modern v2 rendering, skin textures must cover the entire 1000x1000 viewport before being clipped by the layer alpha mask (`destination-in`).
  - Drawing a single rotated texture with `drawImage` shrinks its bounding box on rotated aspects (e.g. 90-degree rotated texture with 0.75 zoom creates a 750px box on a 1000px canvas), causing vertical accent strips (such as Galaxy S25 / S24 accents spanning Y=8 to Y=991) to get clipped at the top and bottom.
  - **The Invariant**: Always draw textures using `ctx.createPattern(texImg, 'repeat')` with a `DOMMatrix` applying center translation, rotation, and scaling. This ensures infinite seamless tiling across the entire canvas area prior to mask clipping.
  - A fallback `drawImage` bounding box calculation (`1000 * cos + 1000 * sin`) must also be maintained in case pattern initialization fails.

- **Configurable Generated 3D Directional Shading Architecture**:
  - Directional shadow vector is cast towards **bottom-right** (+distance, +distance) by default, ensuring internal cutouts (such as camera rings, holes, and ports) receive realistic shadows on their lower and right borders.
  - Specular rim highlights are caught on **top-left** (-distance, -distance).
  - Hard binary pixel subtraction is strictly replaced with smooth Gaussian blur (`filter: blur(${softness}px)`), creating soft photorealistic bevels without harsh edges.
  - Settings are persisted in view metadata via `currentView.generated_shadow` (`GeneratedShadowConfig`):
    - `enabled`: boolean toggle.
    - `softness`: 1px to 16px (default 6px).
    - `distance`: 1px to 10px (default 3px).
    - `shadow_opacity`: 0% to 100% (default 40%).
    - `highlight_opacity`: 0% to 100% (default 25%).
    - `direction`: 'bottom_right' or 'top_left'.
  - Studio provides interactive sliders and live toggles under "Angle 3D Shading & Highlights".

- **Ambient Omnidirectional Drop Shadow on Secondary Layers**:
  - Canvas element drop shadow is standardized to `filter drop-shadow-[0_0_1.5px_rgba(0,0,0,0.28)]` with 0 offset.
  - Directional inner shading applies strictly to primary body skins (`l.group === 'primary'`), never to secondary accent or camera trim strips. This ensures accent strips maintain subtle, uniform vinyl bevels on all sides.

---

## 41. Device Family Multi-Attribute Heuristic Inference & Universal Pricing Multipliers

- **The Problem & Root Cause**:
  - Legacy MKL products imported into the configurator previously defaulted `family` to `'phone'` with `size_multiplier: 1.0` because inference evaluated only the primary brand category (e.g. "Samsung", "Xiaomi", "Microsoft") rather than the product title or slug.
  - As a result, large devices like Galaxy Tab (S10 Ultra, S9+, S8, etc.), Xiaomi Pad, and Microsoft Surface were charged the standard phone rate for signature finishes (+IDR 30,000) instead of the proper large-format tablet rate (+IDR 60,000).
- **Multi-Attribute Heuristic Regex Invariant (`infer_device_family`)**:
  - The inference engine evaluates product title, slug, and category taxonomy with word boundary regexes:
    - **Tablets** (`/\b(tab|pad|surface pro|surface go|tablet|ipad)\b/i`): family `'tablet'`, multiplier `2.0`.
    - **Laptops** (`/\b(macbook|xps|laptop|notebook|zenbook|thinkpad|blade|surface laptop|surface book|realme book|galaxy book|redmibook)\b/i`): family `'laptop'`, multiplier `2.0`.
    - **Foldables** (`/\b(fold|flip|razr)\b/i`): family `'foldable'`, multiplier `1.3`.
    - **Keyboards** (`/\b(keyboard|folio|book cover)\b/i`): family `'keyboard'`, multiplier `2.0`.
    - **Consoles** (`/\b(deck|rog ally|legion go|switch|playstation|ps5|ps4|xbox|console)\b/i`): family `'console'`, multiplier `2.0`.
    - **Accessories** (`/\b(pencil|airpods|buds|watch)\b/i`): family `'accessory'`, multiplier `0.8`.
    - **Default**: family `'phone'`, multiplier `1.0`.
- **Auto-Healing & Central Database Sync (`sync-device-families`)**:
  - Auto-heals in `rest_get_configurator_profiles` and `rest_get_product_configurator` on query.
  - Dedicated endpoint `POST /wp-json/exacoat-core/v1/configurator/sync-device-families` synchronizes all catalog products across WordPress post meta in a single atomic pass.
  - Studio top bar provides a "Sync Families" quick-action button with real-time feedback toast.
- **Storefront Fallback & High-Resolution Asset Scaling (`exacoat-web`)**:
  - Added fallback `inferWebDeviceFamily` in `lib/server/configurator-loader.ts` to ensure tablets, foldables, and laptops always receive correct pricing size multipliers even before background database sync.
  - Updated `isLargeDevice` in `device-skin-configurator.tsx` and `stacked-layer-canvas.tsx` to include `tablet_laptop`, `keyboard`, `console`, and any device with `size_multiplier >= 1.5`, ensuring proper high-res texture sizing across all large form factors.

