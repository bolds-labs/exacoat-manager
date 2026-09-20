# Changelog

All notable changes to the Exacoat Manager ERP workstation and the `exacoat-core` WordPress plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
