# Server-side cart pricing, Camera & Back Glass prices, made-up reviews: report

## Problem
`Exacoat_Configurator_Engine::add_addon_data_to_cart_item` stored any posted `exacoat_custom_price`, and `calculate_custom_addon_totals` charged it. Anyone could post a configured skin to `/?wc-ajax=add_to_cart` or the Store API with any price.

## Design chosen: storefront server prices and signs
- Pricing rules stay in one place (exacoat-web `lib/configurator-pricing.ts`, `lib/camera-back-glass-pricing.ts`, `evaluateAddonSelections`). No second copy in PHP.
- Product pages post a selection, not a price. The storefront's commerce proxy (`cart/add-configurator-item`, `cart/add-addon-item`) loads the product from WordPress, prices the selection with the same functions the page shows, builds the cart lines and signs them (HMAC-SHA256, `lib/server/cart-price-signature.ts`, 10 minute expiry).
- exacoat-core verifies the signature (`verify_cart_price_signature`, payload in `cart_price_payload`) and refuses the add to cart without it. Unsigned custom prices left in carts from before are removed with a notice.
- Secret: `EXACOAT_CART_PRICE_SECRET`, 32+ characters, same value in wp-config.php and the storefront environment. Not in code (`.env.example` has an empty placeholder). Missing secret means configured items cannot be added (fail closed).
- Shared test vectors: `wordpress-plugin/exacoat-core/tests/cart-price-signature-test.php` and exacoat-web `lib/server/cart-price-signature.test.ts`.

## Camera & Back Glass
Prices unchanged from main, now from WordPress data: profile `bundle_pricing` edited in Studio, Pricing tab, Part Bundle Prices card.
Values staff must enter for the Camera & Back Glass product: all parts price 90,000; back glass finish surcharge 15,000; camera finish surcharge 5,000 (part prices stay 70,000 back glass, 40,000 camera). Until saved, that page shows as unavailable.

## Made-up reviews
"David M.", "Sarah L." and the static ratings are removed from `lib/review-stats.ts` and product structured data (exacoat-web dd91f14). Ratings now come only from real reviews, or are omitted.

## Other routes that accept a client price (not changed in this round)
- Checkout shipping: `X-Exacoat-Shipping-Total` from the browser's `biteship_rate`.
- Warranty pay portal shipping cost: `/api/commerce/update-order-shipping`.
- Public `/warranty/submit-claim` `shipping_cost`.
These let a customer understate shipping. Recommended next: recompute shipping on the server from Biteship rates.

## Evidence (2026-11-15)
- exacoat-manager: `php -l` clean; PHP tests pass (cart price signature, counts bucket, staff dashboard); `npx tsc --noEmit` clean; `npm test` 55 files, 558 tests pass; `npm run build` passes (0.1.228 zips rebuilt).
- exacoat-web: `npm test` 6 files, 76 tests pass; `next build --webpack` passes.

## Commits
- exacoat-web `chore/remove-hardcoded-fallbacks`: dd91f14, e38b7c6, 7aab9ee.
- exacoat-manager `design/manager-redesign`: 7ba63b6, e645254, plus the docs and zip commit after this report.

## Deploy order
1. Set `EXACOAT_CART_PRICE_SECRET` in wp-config.php and the storefront environment (same value).
2. Install the 0.1.228 plugin zip.
3. Enter the Camera & Back Glass bundle values in Studio.
4. Deploy the storefront.
Deploying the storefront before the plugin is safe for plain products; configured items need both sides.

## Fix round 1 (2026-11-15, security review)

1. **Special skins, devices the product does not offer**: `priceAddon` now accepts only brands and devices from `availableAddonBrands(profile)` (`lib/addons/addon-availability.ts`): no `ipad` or tablet devices when `allowTablets` is false, no `macbook` or laptop devices when `allowLaptops` is false, no brand without devices, bespoke kits iPhone only. The page uses the same list (it now also hides tablets listed under other brands, such as Galaxy Tab, on products without tablets). Tests: MacBook, iPad and Galaxy Tab on Graphic Skins are refused; an unknown brand is refused.
2. **Unsigned configuration data**: exacoat-core `strip_unsigned_configuration_fields()` runs first on every add to cart (filter now priority 1) and keeps only standard WooCommerce fields, `attribute_*`, the print finish fields and the signed exacoat fields. Handled: MKL Product Configurator (`pc_configurator_data`), WCPA / Acowebs Custom Product Addons (form fields such as `text-*`, `select-*`, `wcpa_field_key_checker`), the old exacoat per-label and `addon_*` fields, and any other non-standard field. The proxy stopped sending `pc_configurator_data` and per-label fields: nothing needs them, because `_configurator_data_raw` (written from the signed lines) is read first by the warranty parts parser (exacoat-web `app/api/warranty/[action]/route.ts`), the manager (`src/lib/orderItems.ts`) and `class-order-manager.php`. Not covered: an add-on that reads a Store API JSON body (no `$_POST`) for its own fields.
3. **`_configurator_data_raw`**: the extra `wp_slash` is gone (WooCommerce's meta store slashes values itself), and entries now carry both shapes (`is_choice`, `layer_id`, `layer_name`, `name` plus `layerId`, `layerName`, `choiceName`), so the warranty parser, which needs `is_choice` and `layer_name`, can read them. PHP test decodes the stored value, checks the entry shape, the degree sign, quotes and no doubled slashes.
4. **Always a signed price**: every configured line carries the signed page price, base configurations, special skins, Camera & Back Glass and EDGE included, computed from the page base price (profile `base_price` first), so a WooCommerce sale price cannot make the cart differ from the page. In other currencies the cart converts the IDR price with the shared rules, so the configurator, special skin and Camera & Back Glass totals now convert the same way instead of showing the catalog currency price for base configurations. EDGE goes through the signed wc-ajax path with the live variation price; the unsigned Store API fallback is removed. Why wc-ajax was said to reject EDGE: `docs` note it failed when the parent id was posted with a variation id or attributes were missing. The proxy posts the variation id as `product_id`, and WooCommerce then takes the variation's own attributes (`pa_edge-for` values are set on every live variation), so no fallback is needed. Not verified live (no orders or carts were touched): if wc-ajax still refuses, the customer now sees an error instead of an unsigned add.
5. **Page rules on the server**: out of stock and coming soon finishes are refused; the logo cutout is forced off when the back finish disables it (`isLogoCutoutDisabledByFinish`, shared by the page and the server; Camera & Back Glass uses the back glass finish `disableLogoCutout`).
6. **Checkout re-sync**: EDGE items are re-added by their parent product (`selection.productId`), special skins and EDGE go to the addon endpoint, and every item that cannot be restored shows a toast error (items saved before server pricing ask the customer to add them again). A refused add on `cart/add-addon-item` returns 422, never 200.
7. **Bundle keys**: matched case insensitively on both sides (`bundleKey` in the storefront and the manager, same normalisation as `sanitize_key`); the manager stores keys lowercase.
8. **Secret in the storefront repo**: `.env.example` carried a real-looking Acumbamail newsletter webhook URL with its token, and `app/api/newsletter/subscribe/route.ts` had the same URL as a hardcoded fallback. Both are removed (separate commits); the route answers 503 without `ACUMBAMAIL_NEWSLETTER_WEBHOOK_URL`. **The owner must rotate this webhook token in Acumbamail** (it stays in git history) and set the new URL in the storefront environment. Nothing was rotated here.

Documented minors (not changed):
- A verified price stays on items in persistent and abandoned carts (WooCommerce sessions) until the item is removed, even if the price changes later in WordPress.
- The composite image URL (`exacoat_custom_image`) is not signed; it only affects the picture on the line, not the price or the options.
- The shipping and warranty client-priced routes listed above are unchanged.

Evidence (fix round 1, 2026-11-15):
- exacoat-manager: `php -l` clean; PHP tests pass (cart price signature incl. stripping and `_configurator_data_raw` shape, counts bucket, staff dashboard); `npx tsc --noEmit` clean; `npm test` passes; `npm run build` rebuilt the 0.1.228 zips.
- exacoat-web: `npm test` passes; `next build --webpack` passes.
