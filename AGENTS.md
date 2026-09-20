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
  In v2 alpha masks, cutouts (such as the Apple logo on iPhone back skins) are transparent pixels (alpha = 0). Drawing the mask with `destination-in` automatically leaves that area transparent, exposing the underlying hardware base chassis render (`view.background_url`).
- **Hardware Accent / Logo Overlay (`logo_url`)**:
  `ConfiguratorView` supports an optional `logo_url` field. When present, it renders directly above the skin cutout, allowing specular foil reflections, metallic logo emblems, or glossy highlights (`iPhone-17-Pro-Logo.png`) to be layered on top of the base.

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

