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
