# Products and Configurator Studio cleanup: report

Branch `design/manager-redesign`, version kept at 0.1.228. Not pushed.

## Commits

| Commit | What |
|---|---|
| `acc2a8e` | docs(products): action inventory (`docs/superpowers/plans/2026-11-14-products-inventory.md`), every action of both lists mapped |
| `c901aed` | feat(products): shared product list and product panel |
| `0db1416` | feat(studio): catalog uses the shared product list, price editing removed from Studio |
| `ed36229` | refactor(manager): no built-in copies of store data (audit: `docs/superpowers/plans/2026-11-14-hardcoded-audit.md`) |
| `5474d60` | docs(products): AGENTS section 67, CHANGELOG, plugin zips, screenshots; injector lazy-loaded |

## What changed

1. **Shared list** (`src/components/products/ProductList.tsx`, `MarketplaceList.tsx`, `ProductCells.tsx`, `ConfiguratorChip.tsx`): kit table in the Orders style. Products: Webstore, Shopee and TikTok tabs; search, category (WooCommerce categories), status, configurator and sort. Configurator column from the profile summaries: Clean, N issues (tooltip with the issue list), Unaudited, Excluded, No configurator. Configurator filters become a WooCommerce `include` list, so paging stays on the server. Marketplace writes (Shopee live or draft, TikTok activate, deactivate, remove) moved into row menus behind kit confirmations.
2. **Product panel** (`ProductPanel.tsx`, kit Drawer): Details (name, regular and sale price, status, categories), Images and SEO (existing modals reused; they are legacy `ui/Modal` at `z-[220]`, above the drawer), Configurator summary (coverage read on demand) with Open in Configurator Studio, Marketplaces (listings found by name, labelled so). Deep link `#products?product={id}`.
3. **Single price editor**: Details save sends only changed fields through `updateProductDirect`; a regular price change on a product with a profile then syncs the profile `base_price` with `setProductPriceDirect` (the webstore configurator reads `profile.base_price` before the product price). `saveProductConfiguratorProfileDirect` never sends `base_price`, so Studio saves, transfers and audit clean-ups cannot change a price. Studio shows the price read-only with "Edit price" (list) and "Edit in Products" (Pricing tab).
4. **Studio catalog**: the shared list with "Has configurator" preselected and a Setup column. Header: Finishes, Price tiers, Check unaudited (n), Catalog tools menu (Check all devices, Revalidate webstore, Sync device families (restored; AGENTS section 41 documented it but the button was gone), Auto-migrate). Row menu: Open in Studio, Product details, Check assets, Marketplace images, Duplicate (shared `DuplicateProductModal`), Publish or Move to draft, Include or Exclude configurator. Every write except the audit run is behind a confirmation. `#configurator?product={id}` opens the editor.
5. **Fallback cleanup**: see the audit file. Removed `DEFAULT_GLOBAL_FINISHES`, `DEFAULT_FINISH_SURCHARGE_TIERS` (and the tiers Reset defaults), the per-PC finishes copy, WooCommerce guesses for configurator lists and single profiles, the silent price fallback, the Rp 149.000 Shopee price, phantom "iPhone 18 Pro Max" defaults, dead mock order files. Finishes failures show `FinishesLoadError` with Retry; the Finishes screen still blocks writes on the webstore copy and now also when nothing loaded.
6. **Plugin** (`class-configurator-engine.php`): `/configurator/set-price` no longer forces `_price` to the regular price, so a running sale survives a price change. Zips rebuilt at 0.1.228; `scripts/package-plugin.cjs` changelog updated.
7. **Load size**: `Layout` imported `ShopeeImageInjectorModal` statically; once it used the kit Select it pulled Radix Select into the first load (962 KB). It now loads on first open and stays mounted for background jobs.

## Checks

- `npx tsc --noEmit`: clean.
- `npm test`: 51 files, 539 tests passed. New: `src/lib/productList.test.ts` (25: status mapping, filters and counts, query building with include and id search, rupiah parsing and formatting, Shopee price without invention, details payload and validation, numeric prices from plugin filters, hash parsing, listing sort and name match), `src/lib/productsBridge.test.ts` (11: include, sort and rupiah on product requests, single product, categories paging, categories in updates, no `base_price` in profile saves, no silent price fallback, failed profile load, `isNew`, empty profile list accepted, tiers failure), `src/lib/skinPerformanceService.test.ts` (2). Updated Finishes screen and bridge tests for the no-copy rule (+1 screen test: nothing loaded shows an error with Retry).
- `npm run build`: passed. Initial JS (entry plus modulepreloads in `dist/index.html`): 669,398 bytes (limit 900,000; before this work 892,075). ProductsPage chunk about 26 KB, the shared list and panel are in their own chunks.
- No em dashes in any added line (checked with a grep over `git diff bf78662`). New files use tokens and kit components only; no native `<select>` in the products components (the two in the image injector were replaced with the kit Select).

## Browser (manager-dev, read-only)

Opened only: Products list (Webstore and Shopee tabs), product panels (Details, Configurator, Marketplaces), row menus, Studio catalog and its row menu, the image injector pop-up (closed without injecting), Studio editor from `#configurator?product=542441` (closed with Escape, hash cleared). Nothing was saved, deleted, duplicated, published, toggled, synced, revalidated, audited or pushed. One crash found and fixed during the check: some products return prices as numbers, which broke the price parser (test added).

Screenshots in `docs/superpowers/screens/`: `before-products-1366-{dark,light}.jpg`, `before-studio-catalog-1366-{dark,light}.jpg`, `after-products-1366-dark.jpg`, `after-products-light.jpg`, `after-products-shopee-dark.jpg`, `after-product-panel-details-{dark,light}.jpg`, `after-product-panel-configurator-dark.jpg`, `after-product-panel-marketplaces-light.jpg`, `after-studio-catalog-{dark,light}.jpg`. The before shots show the old light mode breaking (white text on white). Mid-session the browser pane was zoomed to 125%, which made emulated 1366px captures crop, so later shots use the pane's own width (about 1000px).

## Concerns and follow-ups

- **Plugin install needed for the sale fix**: until the new zip is installed, saving a new regular price on a configurator product with a running sale still ends the sale (the old `set-price` forces the active price), because the panel calls it to sync the configurator base price. The WooCommerce save itself is correct.
- **Marketplace listings are not linked** to webstore products, so the panel's Marketplaces section searches by name (TikTok's API ignored the search term in testing; results are filtered by title words). The spec's "Shopee, TikTok" column on list rows was not built because there is no link data to fill it honestly.
- **Studio list pages now** (24 per page through WooCommerce) instead of showing all 269 devices at once; counts per state are in the Configurator filter.
- **Price tiers Reset defaults was removed** (its copy could drift from the plugin's defaults). WordPress already returns its own defaults when none are saved.
- **New-layer default groups** (`['Signature skins', 'Colors', 'Natural']`) remain in Studio; changing them needs a storefront check (AGENTS section 47).
- **exacoat-web** still has its own built-in finishes, tiers, group order, 129000 price fallbacks, add-on fallback products and fallback product lists. Listed in the audit file; needs a webstore change and deploy (ask before pushing).
- The editor (fullscreen Studio) is unchanged apart from the read-only price; its own legacy styling and native selects remain (non-goal this round).

## Fix round 1

Review fixes, commit `fix(products): stable configurator base price, sale-safe price sync`.

1. **Stable configurator base price** (plugin): `rest_save_product_configurator` keeps the stored profile `base_price` when none is sent and otherwise falls back to the regular price; `get_product_base_price` is regular-price first (variable products: minimum regular variation price), which also fixes the duplicate fallback (it used `get_price()`, the sale price). `prepareWordPressRequest` adds `aelia_cs_currency=IDR` to configurator routes (`/wp-json/exacoat(-core)/v1/configurator/*`, tested in `requestAuth.test.ts`). The Studio Pricing label now reads "Configurator Base Price (IDR)" with an accurate tooltip.
2. **Sale-safe price sync**: `configuratorPriceSync` (tested) syncs only for a stored profile, skips with a notice when summaries failed, and during a sale only when `/health` reports `features: ['set_price_keeps_sale']` (new in the plugin; `fetchPluginFeaturesDirect`, cached). The version alone cannot tell because 0.1.228 zips without the fix already exist. Panel tests cover all four paths.
3. **Studio Duplicate** has no price field; the copy keeps the source's regular price (sent explicitly, so older plugins also keep it).
4. **Texture scale** is back in Studio's Setup column.
5. **Minors**: trash-hidden rows show under the Trash filter and are dropped from the hidden set when a fresh load returns them; saved overrides are replaced by fresh data (`onLoaded`, tested); Studio search placeholder no longer mentions slugs; `parsePriceInput` handles "129000.00" and rejects non-zero decimals; ConfiguratorSection clears the previous profile and ignores stale answers; MarketplacesSection ignores stale searches (request id) and resets the search term per product.

Checks: `php -l` clean on both changed plugin files; `npx tsc --noEmit` clean; `npm test` and `npm run build` results below. Browser: read-only reload of Products and Studio after the change; nothing saved.

Still open (as documented): no marketplace column on list rows; exacoat-web fallbacks.
