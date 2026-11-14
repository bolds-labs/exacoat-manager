# Hardcoded fallbacks audit (manager)

Rule: where WordPress holds the truth, the manager never shows or saves a built-in copy. If the data cannot load, the screen says so and offers Retry, and writes stay off.

## Removed from the manager

| # | What | Where | Was used for | Now |
|---|---|---|---|---|
| 1 | `DEFAULT_GLOBAL_FINISHES` (26 finishes with prices, stock and textures) | `src/lib/wordpressBridge.ts` | Last fallback of `fetchGlobalFinishesDirect`; first state of the endorsement, manual warranty and image injector pop-ups; seed list of the skin performance report | Deleted. `fetchGlobalFinishesDirect` returns `success: false, finishes: []` with an error when WordPress and the webstore copy both fail. Pop-ups start empty and show `FinishesLoadError` (Retry). Skin performance takes the live list and shows an error with Retry |
| 2 | Per-PC finishes copy (`exacoat_finishes_inventory_cache`, `exacoat_finishes_inventory_v2` in localStorage) | `fetchGlobalFinishesDirect`, `skinPerformanceService.getMasterTexturesList` | Display fallback and extra report rows | No longer read anywhere (AGENTS section 3: no shared state in localStorage) |
| 3 | `DEFAULT_FINISH_SURCHARGE_TIERS` (3 price tiers) | `wordpressBridge.ts`, Studio and Finishes first state, `FinishSurchargeTiersModal` | Returned by `fetchFinishSurchargeTiersDirect` and `fetchGlobalFinishesDirect` on failure; shown when the modal got no tiers; "Reset defaults" button | Deleted. Tier requests report failure. The modal shows the tiers it is given (WordPress returns its own defaults from `get_default_surcharge_tiers()` when none are saved) and refuses to save an empty list. The Reset defaults button is gone (its copy could drift from the plugin's). Studio's Price tiers button is off until tiers load |
| 4 | Hardcoded Burgundy, Titanium+ and Everything finishes with prices | `skinPerformanceService.getMasterTexturesList` | Extra report rows even when the store had no such finish | Deleted; only live finishes are reported |
| 5 | WooCommerce fallback for the configurator list (families and multipliers guessed from category names, texture scale 0.75) | `fetchConfiguratorProfilesDirect` | Used when the plugin route failed, and also when it answered with an empty list | Deleted. An empty list is a valid answer; a failure returns an error. Products and Studio show "Configurator data did not load" with Retry and turn the Configurator column and filter off |
| 6 | WooCommerce meta conversion for one profile (client-side MKL conversion, guessed family, default Back Skin layer) | `fetchProductConfiguratorProfileDirect` | Used when the profile route failed; Studio could then save the invented profile over the real one | Deleted. A failed load returns an error; a product WordPress says has no profile returns `isNew: true` |
| 7 | Studio blank workspace after any failed profile load | `ConfiguratorStudioPage.handleOpenEditor` | Saving it overwrote the real profile with one blank layer | Only built for `isNew` products (no configurator yet). A failed load shows an error and closes the editor. Transfer Setup also stops when the target profile fails to load |
| 8 | Silent WooCommerce fallback in `setProductPriceDirect` | `wordpressBridge.ts` | Changed the WooCommerce price without the configurator base price and still reported success | Deleted; the call reports failure and the product panel offers "Update configurator price" |
| 9 | Shopee listing price fallback Rp 149.000 | Products Shopee tab (`getShopeeItemPrice`), Shopee duplicator preview | Shown as the price when Shopee sent none | Shows "No price" |
| 10 | Shopee duplicator defaults: sample listing URL loaded on open, source "iPhone 17 Pro Max", target "iPhone 18 Pro Max" (an unreleased device, see AGENTS section 37) | `ShopeeProductDuplicatorModal.tsx`, `MarketplaceImageGeneratorModal.tsx` | Pre-filled every duplicator opened without a source | Fields start empty; the sample stays behind its explicit "Use iPhone 17 Pro Max Sample" link |
| 11 | Image injector headline fallback "iPhone 18 Pro Max" | `ShopeeImageInjectorModal.tsx` | Headline when the listing title could not be parsed | Empty headline for staff to type |
| 12 | Default category "Skins" on duplicate | Products duplicate pop-up | Sent as `category_name` | Sends the source's first category (the plugin ignores the field; the copy keeps the source categories) |
| 13 | Mock Shopee and TikTok orders | `src/data/mockShopeeOrders.ts`, `src/data/mockTikTokOrders.ts` | Nothing (dead files) | Deleted |
| 14 | Studio price editing (quick price pop-up, Pricing tab input, base price sent with every profile save) | Studio | A second price editor; `/configurator/save` wrote any `base_price` it received into WooCommerce and forced `_price`, ending sales | Prices are edited only in the Products panel. `saveProductConfiguratorProfileDirect` never sends `base_price`, so WordPress keeps the profile base price equal to the product price |

Plugin change in the same round: `rest_set_product_price` (`/configurator/set-price`) sets only the regular price and lets WooCommerce work out the active price, so a running sale is kept (it used to force `_price` to the regular price).

## Remaining fallbacks and why

| What | Where | Why it stays |
|---|---|---|
| Webstore copy of finishes (`{VITE_WEB_URL}/api/configurator/finishes`) | `fetchGlobalFinishesDirect` | Real store data served by exacoat-web from WordPress, used read-only when WordPress does not answer. Marked `source: 'fallback'`; the Finishes screen blocks every write on it, Studio's focus reload ignores it |
| Blank configurator workspace (one Back Skin, Top Lid or Main Body layer) | Studio `handleOpenEditor` | Only for products WordPress says have no configurator yet: it is the starting point for building one, not a stand-in for data that failed to load |
| `allowed_finish_groups: ['Signature skins', 'Colors', 'Natural']` on new layers | Studio new-layer helpers | Contract with the storefront filter (AGENTS section 47: an empty list could restrict a layer to nothing). Needs a storefront change before it can follow the live group names |
| Model 360 extra price default 40000 | Studio simulator and save | Mirrors the plugin and storefront default (AGENTS section 33); the stored value always wins |
| Accent surcharge cap `Math.min(extra, 15000)` when no tier matches | Studio price simulator | Simulation only, never saved; mirrors the storefront rule |
| Listing price defaults 149000 and 189000 | Image injector variant pricing | Marketplace listing prices are not held in WordPress; staff see and can change them before injecting |
| Default feature cards and badge text | `marketplaceCanvasRenderer.ts` | Marketing copy for generated images, not store data |
| Settings defaults (`DEFAULT_ZONES`, `DEFAULT_CARRIERS`, `DEFAULT_CURRENCIES`, `DEFAULT_SEEDS`), `DEFAULT_EXCHANGE_RATES`, `DEFAULT_JNE_EMAIL_CONFIG`, `DEFAULT_CUSTOM_LABEL_SENDER` | Settings sections, formatters, export, custom label | Outside this round (settings and shipping). Not reviewed for silent use; listed so the next round checks them |
| Studio simulator default finish `swarm` | Studio | Which swatch the simulator shows first; not store data |

## exacoat-web equivalents to remove later (not edited here)

All in `C:\AI\exacoat-web`. These need a webstore change and deploy (ask before pushing).

| What | Where |
|---|---|
| `DEFAULT_GLOBAL_FINISHES` (finish list with prices) | `lib/server/configurator-loader.ts` (line ~104) |
| `DEFAULT_FINISH_SURCHARGE_TIERS` | `lib/server/configurator-loader.ts` (line ~59) |
| `globalFinishGroupsCache` default `["Limited", "Signature skins", "Colors", "Natural"]` | `lib/server/configurator-loader.ts` (line ~83) |
| Base price fallback `129000` and the "under 1000 means 129000" rule | `lib/server/configurator-loader.ts` (`rawBasePrice`, `sanitizedBasePrice`, product loader around line ~1847) |
| Add-on fallback products with fixed ids and prices (Titanium+ 487005 at 149000/169000, Forged Carbon 330490 at 149000/189000) | `lib/server/configurator-loader.ts` (around line ~2054) |
| `category-fallbacks.json` (synthesizes product pages, AGENTS section 37) | `lib/category-fallbacks.json`, imported by `configurator-loader.ts` |
| Static iPhone product list with prices | `lib/iphone-data.ts`, `lib/server/iphone-loader.ts` |
| `POPULAR_ITEMS` search suggestions | `lib/search-catalog.ts` |
| Price fallback `129000` in the Google Merchant feed and the analytics purchase value | `app/api/feeds/google-merchant.xml/route.ts`, `app/api/commerce/[...path]/route.ts` (~641) |
| Configurator fixtures used outside tests (check) | `lib/configurator/phone-fixture-537442.json`, `lib/configurator/macbook-fixture-539616.json` |
