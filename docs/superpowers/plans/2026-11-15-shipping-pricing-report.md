# Shipping charged by the server: report

Follows `2026-11-14-server-pricing-report.md`, which left three client-priced shipping routes open. All three are closed, plus the related ones found while auditing. Plugin stays 0.1.228 (unreleased).

## Problem
- Checkout: the page sent `biteship_rate` (price, discount, promo code). The storefront proxy turned it into `X-Exacoat-Shipping-Total`, which `attach_headless_shipping_before_payment` charged, and it rewrote the order's shipping line from the same numbers after checkout. cms Store API is public, so anyone could also send that header to WordPress directly.
- Warranty pay portal: `/api/commerce/update-order-shipping` and `/api/commerce/pay-order` wrote any posted `shippingCost` to the order, on any order the customer could open, paid or not.
- Warranty claims: storefront `/api/warranty/submit-claim` and the plugin's public `/warranty/submit-claim` charged the posted `shipping_cost` (and a cost of 0 made the claim a free store pickup in the storefront route).

## Design: signed courier quotes, decided on the server
- The storefront server already asks Biteship for rates. It now signs every quote it hands to the browser: HMAC-SHA256 with `EXACOAT_CART_PRICE_SECRET` over `exacoat-ship-v1`, context, courier, service, country, postcode, item count, IDR amount and expiry, joined by newlines. Token `{exp}.{hex}`, 30 minute life, at most 2 hours ahead. Code: exacoat-web `lib/server/shipping-quote-signature.ts`, exacoat-core `includes/class-shipping-quote.php`. Shared vectors in both test suites.
- **What is bound and why**: the courier price depends on destination and weight. Weight is item count x 100 g (storefront) or a fixed 150 g parcel (warranty), so the item count is the cart property that matters. Checkout quotes use context `checkout` and the cart item count; warranty quotes use `warranty:{order ref}` (the original order or invoice for claims, the replacement order for the pay portal) and count 1. The declared value is not bound because it does not change the Biteship price (no insurance is requested).
- **Checkout**: the page sends `biteship_rate: { rate_id, quote, quote_amount }`. The proxy verifies it against the Store API cart's item count and the posted shipping address, then forwards `X-Exacoat-Shipping-Mode/-Courier/-Service/-Amount/-Quote`. exacoat-core verifies again against the order itself (shipping country, postcode, line quantities; Indonesia, JNE or SiCepat only), so a direct Store API call cannot skip the proxy. It then decides the discount from the order: the zone free shipping rule (`Exacoat_Store_Enhancements::free_shipping_rule`, extracted unchanged from `apply_zone_tiered_shipping_discount`, AGENTS section 11) on the order subtotal, and the shipping promo coupon (`get_shipping_promo_config`) when the coupon is on the order; free shipping wins, as on the page. Non-IDR orders convert with `calculate_price_for_currency( x, currency, false, 1.0 )` (new optional markup argument), which matches the page's `calculatePriceForCurrency(x, currency, 1.0)`. Total, discount and raw headers are never read.
- **Why not re-quote Biteship in WordPress at order creation**: it would add a Biteship call (seconds, and a failure point) inside checkout, and the price could move between what the customer saw and what they are charged. The signed quote charges exactly the rate shown and fails closed when it is stale. The plugin's public warranty route is the exception (below), because the plugin already owns its own rate lookup there and has the parent order.
- **Fail closed**: missing, expired or changed quote: 409 `shipping_quote_invalid`, "Shipping rates changed, please choose a courier again." The checkout page and the claim wizard reload rates on that error. Missing secret: checkout rate list is empty; warranty courier choices cannot be submitted.
- **Store pickup**: stays free. `X-Exacoat-Shipping-Mode: pickup`; the proxy and the plugin set the shipping address to the store (Ruby Commercial TB12, 17142) and `_is_store_pickup = yes`, so a pickup flag can no longer ship free to a home address.
- **BCA unique code**: unchanged rules. The storefront post-checkout step now computes it from the order's own total (which carries the server-decided shipping). Pay portal codes are bounded to 1 to 50.

## Routes and verdicts
| Route | Before | Verdict now |
|---|---|---|
| Checkout `X-Exacoat-Shipping-Total` from `biteship_rate` (storefront proxy and `attach_headless_shipping_before_payment`) | browser price and discount charged | **Fixed**: signed quote verified twice, discount decided by the plugin |
| Storefront post-checkout `PUT /orders/{id}` shipping lines and `_shipping_*` meta | browser price | **Fixed**: removed; the plugin writes them |
| Free shipping zone discount (headless) | browser `isSelectedRateFree` | **Fixed**: plugin, zone rule on the order subtotal |
| ONGKIR15 shipping promo (headless) | browser `discount` | **Fixed**: plugin, from the order's coupons and the promo settings |
| Store pickup (checkout) | browser flag, any address, 0 | **Fixed**: free, address forced to the store |
| `/api/warranty/shipping-rates` | unsigned prices; browser postcode preferred over the order's | **Fixed**: signed; a WooCommerce order is always quoted for its own address |
| `/api/commerce/update-order-shipping` | any `shippingCost`, any status, any `uniqueCode` | **Fixed**: courier change only with a quote for this order, only while pending, on-hold or failed; code 1 to 50 |
| `/api/commerce/pay-order` | any `shippingCost`; Midtrans charged the browser amount when the order total was 0 | **Fixed**: same quote rule; Midtrans charges the WooCommerce total only |
| Storefront `/api/warranty/submit-claim` `shipping_cost` | charged; cost 0 meant free pickup | **Fixed**: cost, label and method id from a valid quote for the claim destination; pickup only when chosen |
| Plugin public `/warranty/submit-claim` `shipping_cost` | charged (default 10,000) | **Fixed**: prices `courier_id` from its own `rest_get_shipping_rates` for the parent order, 409 when not offered |
| International rates (WooCommerce zones: Goorita Send, POS, DHL, FedEx) | WooCommerce selected cart rate | **Already server-priced** (zone methods, zone free shipping and currency markup filters in WordPress); unchanged |
| Goorita and Rayspeed services (`/shipping/goorita/*`, `/shipping/rayspeed/*`) | staff routes | **Not customer-facing** (staff permission); unchanged |
| WC Biteship shipping method (`class-wc-biteship-shipping-method.php`) | computed in WordPress | **Server-priced**; used when the storefront sends no headless shipping |
| BCA unique code at checkout (`X-Exacoat-Bca-Unique-Code`) | bounded 1 to 50 and collision checked in `class-bca-payment-webhook.php` | **OK** (a code only adds 1 to 50 rupiah) |
| Store credit amount (`handle_store_credit_update`) | refused above the customer's balance | **OK** |
| `/api/commerce/confirm-payment` amount | compared with a real bank mutation | **OK** |
| Manager manual claims and consolidation orders (`shipping_cost`, `actual_shipping_cost`) | staff routes | **Staff-only**; unchanged |
| Midtrans Snap gross amount (checkout and pay portal) | order total | **OK** (the total is now server-decided) |

## Test evidence (2026-11-15)
- exacoat-manager: `php -l` clean on every changed PHP file; PHP tests pass: `shipping-quote-test.php` (shared vectors, tampering, expiry, charge rules), `headless-shipping-test.php` (decision bound to the order's postcode and item count, old unsigned total refused, free shipping, express never free, promo cap, currency conversion without markup, attach writes the line, pickup moves the address), `cart-price-signature-test.php`, counts bucket, staff dashboard. `npx tsc --noEmit` clean; `npm test` 559 tests pass; `npm run build` passes and rebuilt the 0.1.228 zips (the zip contains `class-shipping-quote.php`).
- exacoat-web: `npm test` 9 files, 101 tests pass (new: `shipping-quote-signature.test.ts`, `warranty-shipping.test.ts`, `checkout-shipping.test.ts`); `next build --webpack` passes.
- Read-only local check (dev server with a test secret, staging WordPress): `/api/commerce/shipping-rates` for postcode 40115 returned signed JNE REG 12,000 and JNE YES 24,000 quotes; `/api/commerce/checkout` with that quote and `quote_amount: 1000` answered 409 with the message, before anything reached WooCommerce checkout; `/api/warranty/shipping-rates` returned signed courier rates and an unsigned free store pickup. No order, payment, shipment or booking was created.

## Deploy steps
1. `EXACOAT_CART_PRICE_SECRET` must already be set in wp-config.php and the storefront environment (same value, from the cart price rollout).
2. Install the 0.1.228 plugin zip.
3. Deploy the storefront immediately after. Between steps 2 and 3, Indonesian courier checkouts are refused with the message above (store pickup and international checkout keep working). Do not deploy the storefront first: the old plugin ignores the new headers and the new storefront no longer rewrites the line, so the order would keep WooCommerce's auto-selected cart rate.
4. Check: an Indonesian courier checkout on staging shows the same shipping on the order as on the page, with and without free shipping and ONGKIR15.

## Concerns
- Not verified end to end: no checkout was placed. The early refusal relies on `woocommerce_store_api_checkout_update_order_from_request` (order addresses and lines set); the attach on `woocommerce_store_api_checkout_order_processed` also refuses, as a fallback.
- A quote can be reused within 30 minutes for the same destination and item count (by design; same price).
- A checkout sent straight to the Store API without these headers is charged WooCommerce's selected cart rate. If `local_pickup` is selected with a home address, the order is a 0 shipping pickup order; staff see it as pickup.
- Fallback rates when Biteship fails (storefront warranty 12,000 and 24,000; plugin 10,000 and 20,000 and a 7 day rate cache per postcode) are server values but fixed or possibly stale.
- Non-IDR orders to Indonesia now convert in PHP with the plugin's currency registry; this assumes it matches the storefront's `lib/money.ts` registry.
- Not in scope, noticed: the pay portal routes authorise `customerId === 99999` sessions for any order; the stale `.next/types` check flags the existing `cleanItemTitle` export in the warranty route under plain `tsc` (the Next build passes).

## Commits
- exacoat-web `chore/remove-hardcoded-fallbacks`: signed courier quotes; checkout shipping from signed quotes; warranty shipping from signed quotes; docs.
- exacoat-manager `design/manager-redesign`: server-decided headless checkout shipping; plugin warranty claim prices its own shipping; docs, changelog, zips and this report.

## Fix round 1 (2026-11-15, review)

Important:
- **I1, checkouts without shipping headers**: `headerless_shipping_decision()` in the plugin. Outside Indonesia WooCommerce's selected rate stays. In Indonesia a `local_pickup` order gets the store address and `_is_store_pickup` exactly like the header path; any other method, including a `biteship_shipping` line without a verified decision, is refused with the 409 message. The proxy now refuses an Indonesian non-pickup checkout without a signed quote.
- **I2, pay portal**: `resolvePayPortalShipping` changes a courier only on warranty replacement orders (`_is_warranty = yes`, any `_rma_order_type`, or `_order_badge = WARRANTY`), for both `update-order-shipping` and `pay-order`. `/api/warranty/shipping-rates` signs quotes only for claim parents (paid statuses, not a replacement), replacement orders and marketplace invoices (not WooCommerce orders); other orders get prices without quotes, which cannot be submitted.
- **I3, international warranty claims**: non-ID destinations get exacoat-core's international rates (zone lookup or its international fallback, paid courier rates only via `internationalCourierRates`) and are priced again from exacoat-core when the claim is submitted; an unknown courier is refused (409). The domestic 12,000/24,000 fallback is never used for them. The pay portal cannot change the courier on an international replacement (no quotes); it charges the order's existing line.
- **I4, bag count**: checkout quotes are signed for the Store API cart's item count when the bag is on the server (`resolveQuoteQuantity`), the same count the checkout compares against, so a different count on the page no longer loops on 409. Test added.

Minor:
- **M1, currency markup**: the intended value is the global `currency_global_markup` (default 1.8; AGENTS section 7 says `lib/money.ts` and `calculate_price_for_currency` share markup 1.8, and the page's `calculatePriceForCurrency(baseIdr, activeCurrency)` uses that default). The plugin side was wrong (1.0 override); it now calls `calculate_price_for_currency( x, currency )` and the override argument is gone. The storefront AGENTS note is corrected.
- **M2**: marketplace pickup claims ship to the store address, like webstore ones.
- **M3**: the decision cache is removed; attach computes the decision again from the order. Test: a quote that stops matching between the two hooks is refused at attach.
- **M4**: message is now "Shipping rates changed, please choose a courier again. If the courier options do not reload, refresh the page." (storefront and plugin).
- **M5, plugin public `/warranty/submit-claim`**: needs ownership proof (`order_key`, the billing email as `billing_email` or `email`, or the signed-in customer of the order), answering the same 404 as a missing order otherwise; 10 claims per IP per hour (staff exempt). Public domestic rate lookups cache a failed postcode for 5 minutes and allow 30 live Biteship lookups per IP per 10 minutes (staff exempt). The limit uses `REMOTE_ADDR`; behind a proxy that hides visitor IPs it limits the proxy as a whole.
- **M6**: the plugin's international zone lookup drops `local_pickup`, `pickup_location`, `free_shipping`, zero cost and formula cost methods (`is_courier_rate`).
- Domestic fallback amounts (storefront 12,000 and 24,000, plugin 10,000 and 20,000) are unchanged as documented. They are Java-centric: remote areas (for example Papua, Maluku, NTT) cost much more, so a Biteship outage undercharges those claims.
- The `customerId === 99999` checks in `pay-order` and `update-order-shipping` were left alone here; the separate sign-in hotfix (exacoat-web-hotfix) removes them.

Evidence (fix round 1):
- exacoat-manager: `php -l` clean; PHP tests pass (headless shipping now covers checkouts without headers, the second check at attach and the global markup; new `warranty-claim-guard-test.php` covers ownership proof, the per IP limit and the courier rate filter); `npx tsc --noEmit` clean; `npm test` 559 pass; `npm run build` rebuilt the 0.1.228 zips.
- exacoat-web: `npm test` 105 pass; `next build --webpack` passes.
- Read-only local check: an Indonesian checkout without a quote answered 409 with the new message before reaching WooCommerce; `/api/warranty/shipping-rates` for a US destination returned the plugin's zone rates (Goorita 120,000, DHL Express 549,500, FedEx 385,000) with no domestic fallback; checkout rates were still signed.
