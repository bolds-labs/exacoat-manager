# Products and Studio catalog: action inventory

Two screens kept their own product list before this change:

- **P**: Products (`src/pages/ProductsPage.tsx`), with the Webstore, Shopee and TikTok tabs and the pop-ups it opened (`ProductImageManagerModal`, `ProductSeoModal`, `BatchSeoModal`, `ShopeeProductDuplicatorModal`, the webstore Duplicate pop-up, the Delete confirmation, the marketplace image injector from `MarketplaceInjectionContext`).
- **S**: Configurator Studio's catalog (`src/pages/ConfiguratorStudioPage.tsx`, everything shown while no device is open).

After the change both use one list component, `src/components/products/ProductList.tsx`, with `mode="products"` on Products and `mode="studio"` in Studio. "Panel" means the product panel (kit Drawer, `src/components/products/ProductPanel.tsx`). "Row menu" is the kit Menu at the end of a row. "Toolbar" is the list's filter bar; "Studio tools" is the Studio header above the list.

Every action is mapped. Nothing is removed without a replacement, except where the table says so and why.

## Loading, navigation and layout

| # | Action today | Where | New home |
|---|---|---|---|
| 1 | Load webstore products, 24 per page, server search and status (`fetchProductsDirect`) | P | List, Webstore tab: same request, plus category, sort and configurator filters on the server (`include` ids for configurator filters) |
| 2 | Load Shopee listings, 24 per page (`fetchShopeeProductsDirect`) | P | List, Shopee tab (unchanged request) |
| 3 | Load TikTok listings, 24 per page with page token (`fetchTikTokProductsDirect`) | P | List, TikTok tab (unchanged request) |
| 4 | Load configurator summaries for all configurators (`fetchConfiguratorProfilesDirect`) | S | Studio loads them as before and passes them to the list; Products loads them once for the Configurator column |
| 5 | Load global finishes with the catalog | S | Unchanged in Studio (editor and price simulator need them) |
| 6 | Channel switcher with counts (Webstore, Shopee, TikTok) | P | Toolbar: kit Tabs with counts |
| 7 | Grid or table view toggle (remembered in localStorage) | P | Removed: one kit table (Orders style) on desktop and a compact list on phones. The localStorage key is no longer written |
| 8 | Refresh catalog | P (Refresh icon), S (Refresh Catalog) | Toolbar Refresh icon button in both modes; header Refresh (`onWorkspaceRefresh`) also reloads |
| 9 | Pagination: Previous and Next (webstore pages, Shopee offset, TikTok page token) | P | List footer, same paging per channel; Studio now pages too (24 per page) |
| 10 | Metrics row: Catalog devices, Audited clean, Unaudited, Multi-angle setups | S | Studio mode: counts in the Configurator filter options (Clean, Issues, Unaudited) and in the Audit button label. Multi-angle count dropped (it is visible per row in the Setup column) |
| 11 | Migration result banner after Auto-migrate | S | Toast after the run (same numbers) |
| 12 | Loading, error with Retry, and empty states per channel | P, S | List: one loading row, error card with Retry, empty state with Clear filters, per channel |

## Search, filters and sort

| # | Action today | Where | New home |
|---|---|---|---|
| 13 | Search by name, SKU or id (debounced, server search plus client token filter) | P | Toolbar SearchField. Server search; an all-digits query matches the product id |
| 14 | Search by name, slug or id | S | Same SearchField (studio mode) |
| 15 | Clear search (x) | P | Kit SearchField clear and Clear filters in the empty state |
| 16 | Status filter: All, Published, Draft, Private, Trash (webstore); All, Active, Draft (UNLIST), Banned (Shopee); All, Active, Deactivated, Draft (TikTok) | P | Toolbar Status select (kit Select), options per channel |
| 17 | Draft badge on catalog rows | S | Status column chip (Published, Draft, Private, Trash) in both modes |
| 18 | Category combobox with search and counts | S | Toolbar Category select (kit Select, WooCommerce categories with product counts) on the Webstore tab |
| 19 | Scope: Configurators only or All products | S | Toolbar Configurator select: All products, Has configurator (Studio default), Clean, Issues, Unaudited, Excluded, No configurator. Choosing a value that needs non-configurators reloads Studio's summaries with all products, as All products did |
| 20 | Configured filter: All or Active | S | Same Configurator select (Has configurator) |
| 21 | Audit filter: All audit, Audited, Unaudited, Issues (with counts) | S | Same Configurator select (Clean, Issues, Unaudited, with counts) |
| 22 | Sort: recently updated, oldest updated, name A to Z and Z to A, price high to low and low to high | P | Toolbar Sort select. Webstore sorts on the server (`orderby`, `order`), marketplaces sort the loaded page as before |

## Row content

| # | Action today | Where | New home |
|---|---|---|---|
| 23 | Thumbnail, name, SKU, id, image count, first category, Configurable badge | P | Product column (thumbnail, name, id and SKU), Category column, Configurator column |
| 24 | Price (regular or price) | P | Price column: sale price with the regular price struck through when on sale |
| 25 | Price with click-to-edit (quick price pop-up, `setProductPriceDirect`) | S | Removed from Studio: the price is read-only with an "Edit price" link that opens the Products panel for that product (`#products?product={id}`); in a new tab while a device is open |
| 26 | Audit badge: Clean, N issues (hover list of issues, click opens the asset audit), Unaudited | S | Configurator column in both modes: Clean, N issues (tooltip with the issue list), Unaudited, Excluded, No configurator. Studio mode: clicking the issues chip opens the asset audit for that device, as before |
| 27 | Configurator Active or Excluded toggle per row (`toggleProductConfiguratorDirect`) | S | Studio row menu: Exclude from configurators / Include as configurator (confirmation first) |
| 28 | Setup: views and layers count, texture scale, presets count | S | Studio mode Setup column: views, layers, presets |
| 29 | Shopee row: image, name, item id, price (fallback Rp 149.000 when Shopee sent none), status, stock | P | Shopee table. A missing price shows "No price" (the invented Rp 149.000 is gone) |
| 30 | TikTok row: image, title, product id, first SKU price, variant count, stock, status | P | TikTok table, same fields |

## Row actions: webstore

| # | Action today | Where | New home |
|---|---|---|---|
| 31 | Open the device in the editor (row click, Open button) | S | Studio mode: row click and row menu Open in Studio |
| 32 | Status dropdown: Published, Draft, Private (`updateProductDirect` status) | P | Panel, Details: Status select, saved with Save. Studio row menu: Publish / Move to draft (confirmation first, same call) |
| 33 | Images button and thumbnail click (ProductImageManagerModal) | P | Panel, Images section: gallery preview and Manage images (opens the same pop-up above the drawer) |
| 34 | SEO button (ProductSeoModal) | P | Panel, SEO section: current slug and short description, Edit SEO (same pop-up) |
| 35 | Duplicate (name, slug, price, copy configurator, auto SEO, category) (`duplicateProductDirect`) | P | Row menu Duplicate and panel header menu Duplicate: shared Duplicate pop-up (`DuplicateProductModal`, kit Modal) with Auto SEO on |
| 36 | Duplicate product and profile, then open the copy in the editor | S | Studio row menu Duplicate: same shared pop-up (no Auto SEO option, as before), then opens the copy in Studio |
| 37 | View on live store (permalink) | P | Row menu View on store, panel header View on store |
| 38 | Move to trash (confirmation, `deleteProductDirect`) | P | Row menu Move to trash and panel header menu, kit Modal confirmation |
| 39 | Generate 1500x1500 marketplace images for a device | S | Studio row menu Marketplace images (opens the device and the generator, as before) |
| 40 | Open the asset audit for one device | S | Studio row menu Check assets, and the issues chip |

## Row actions: Shopee and TikTok

| # | Action today | Where | New home |
|---|---|---|---|
| 41 | Shopee status dropdown: Live (NORMAL) or Draft (UNLIST) (`setShopeeProductStatusDirect`) | P | Shopee row menu: Set live / Move to draft, kit Modal confirmation |
| 42 | Shopee Duplicate listing to another device (ShopeeProductDuplicatorModal) | P | Shopee row menu Duplicate listing (same pop-up); panel Marketplaces section also offers it for a matched listing |
| 43 | Shopee Inject images (marketplace injector) | P | Shopee row menu Inject images; panel Marketplaces section |
| 44 | Open in Shopee Seller Centre | P | Shopee row menu Open in Seller Centre; panel Marketplaces section |
| 45 | Shopee delete (`deleteShopeeProductDirect`): wired in the delete handler but no button showed it | P | Not offered, as before (no visible button existed). Noted in the report |
| 46 | TikTok status dropdown: Active or Deactivated (`setTikTokProductStatusDirect`) | P | TikTok row menu: Activate / Deactivate, kit Modal confirmation |
| 47 | TikTok Inject images | P | TikTok row menu Inject images; panel Marketplaces section |
| 48 | TikTok Deactivate / Remove (`deleteTikTokProductDirect`, confirmation) | P | TikTok row menu Remove from TikTok, kit Modal confirmation |

## Catalog-wide tools

| # | Action today | Where | New home |
|---|---|---|---|
| 49 | Batch SEO Optimizer (BatchSeoModal over the loaded page) | P | Toolbar (Webstore tab) button Batch SEO, same pop-up and page |
| 50 | Finishes (opens `#materials`) | S | Studio tools: Finishes |
| 51 | Surcharge tiers pop-up | S | Studio tools: Price tiers (same pop-up). Price tiers are not product prices; they stay |
| 52 | Revalidate web (purge all) | S | Studio tools menu: Revalidate webstore (confirmation first) |
| 53 | Audit unaudited (count) | S | Studio tools: Audit unaudited (count) button, unchanged handler |
| 54 | Audit all (count) | S | Studio tools menu: Audit all devices |
| 55 | Global audit pop-up (results, clean ghost angles, stop) | S | Unchanged, opened by the audit buttons |
| 56 | Auto-migrate all products | S | Studio tools menu: Auto-migrate all products (confirmation first) |
| 57 | Sync families (`syncDeviceFamiliesDirect`; documented in AGENTS section 41, the button was missing from the screen) | S | Studio tools menu: Sync device families (confirmation first), restored |
| 58 | Transfer setup / JSON | S (editor header, needs an open device) | Unchanged in the editor header; it copies between the open device and another one, so it is not a list action |
| 59 | Duplicate Shopee listing from scratch (duplicator without a source) | P (only from a row) | Toolbar on the Shopee tab: Duplicate listing |
| 60 | Add product | none | Toolbar Add product: opens WordPress Add New Product in a new tab (there was no add flow before; the spec layout asks for one) |

## Panel (new)

| # | Section | Content and actions |
|---|---|---|
| 61 | Details | Name, regular price, sale price, status, categories. One Save (`updateProductDirect`, only changed fields). When a configurator profile exists and the regular price changed, the profile base price is synced through `setProductPriceDirect`, so the webstore configurator (which reads `profile.base_price` first) shows the same price. Unsaved changes ask before closing |
| 62 | Images | Gallery preview, Manage images |
| 63 | SEO | Slug, short description preview, Edit SEO |
| 64 | Configurator | Has one, engine version, family and multiplier, views, layers, presets, coverage (read from the profile on demand), last check and issues list, Open in Configurator Studio (`#configurator?product={id}`) |
| 65 | Marketplaces | Shopee and TikTok listings found by product name (read only search), status, Open in Seller Centre, Duplicate listing, Inject images. Clearly labelled as matched by name because listings are not linked to webstore products |
