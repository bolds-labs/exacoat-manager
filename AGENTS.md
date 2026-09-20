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
- **Intelligent Fallback Evaluator**:
  When `_is_configurator` has not yet been explicitly saved on a legacy product:
  - If the product contains composable skin layers (`layers_count > 0`), it defaults to active configurator (`true`).
  - If the product contains 0 layers (such as Heritage, Sienna, G.64, and Back Glass Kits), it defaults to non-configurator (`false`).
  This ensures real devices (e.g. Galaxy A54 `#474343`) are immediately discovered without requiring manual database migration.
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
- **The Hybrid Architecture**:
  The optimal approach combines baked 3D raytraced precision with real-time dynamic slider control:
  1. **One-Time Extraction from Matte White 3D Render**: `POST /configurator/extract-shading` processes a neutral white CAD render (`iPhone-17-Pro-Skins-Matte-White.png`), extracting a transparent Multiply Shadow PNG (`mix-blend-mode: multiply`) and a Screen Highlight PNG (`mix-blend-mode: screen`).
  2. **Dynamic Live Intensity Controls**: In Configurator Studio, operators tune **Shadow Opacity (0% to 100%)** and **Highlight Opacity (0% to 100%)** sliders per layer/device. This provides complete interactive control without sacrificing raytraced realism across any vinyl finish.

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



