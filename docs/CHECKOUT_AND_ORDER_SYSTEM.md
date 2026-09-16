# Artmatter Luxury Checkout & Order Architecture Reference

> **Purpose**: This document serves as the permanent system reference for the **Artmatter Luxury Checkout, Order Confirmation (Thank You), and Repayment Engines**. Any AI agent or developer modifying checkout, shipping, coupons, or order confirmation must adhere to the patterns and contracts documented here.

---

## 1. System Architecture & Template Hierarchy

The Artmatter checkout experience replaces standard WooCommerce multi-page/cluttered forms with a bespoke, distraction-free, 3-step luxury flow tailored for fine art collector purchases.

### Overridden WooCommerce Templates
All templates reside in `wordpress-plugin/artmatter-core/templates/checkout/`:
1. **`form-checkout.php`**: The primary 3-step checkout interface (Information → Shipping → Payment). Includes customer recap cards, sticky museum-mat order summary sidebar, and quick login drawer.
2. **`review-order.php`**: Real-time totals breakdown (Subtotal, Shipping, Coupons, Artist Discount, Tax, Final Total). Replaced seamlessly via WooCommerce AJAX fragments (`.woocommerce-checkout-review-order-table` and `.artmatter-co-totals-table`).
3. **`thankyou.php`**: Luxury order receipt with distinct Lucide fulfillment milestone tracking icons, live Biteship courier tracking, artwork thumbnail grid, and customer support links.
4. **`form-pay.php`**: Seamless repayment gateway interface for pending/failed orders (e.g. Midtrans expired sessions or invoice links).

---

## 2. 3-Step Stepper Engine

```
[ Step 1: Information ] ──› [ Step 2: Shipping ] ──› [ Step 3: Payment ]
```

### State Management (`assets/js/checkout.js`)
* Steps are controlled via `currentStep` (`'information' | 'shipping' | 'payment'`).
* Panels are designated by `.artmatter-co-step-panel` with IDs `#artmatter-step-info`, `#artmatter-step-shipping`, and `#artmatter-step-payment`.
* Stepper buttons and links use `data-action="goto-step"` and `data-target-step="stepName"`.
* On step advancement, forward navigation triggers strict client-side field validation (`validateStep(currentStep)`).

### Step 1: Information
* **Contact Email**: Auto-detects logged-in status. When a guest types an email belonging to an existing account, `#artmatter-account-modal` smoothly appears offering 1-click password login and address auto-fill.
* **Biteship Automated Address**:
  * For Indonesia (`ID`), displays `#biteship_automated_address_field` for instant subdistrict/district autocomplete.
  * Auto-extracts postal code, district, and province into hidden inputs (`#biteship_subdistrict_override`, `#biteship_district_override`).
  * 5-digit postal code validation with inline error messaging (`.artmatter-field-inline-error`).
* **International Addresses**:
  * Switching country hides the automated Indonesian finder and activates standard city, state, postal code, and country select dropdowns.

### Headless React Address Contract (Core 7.10.31+)
The React storefront at `web.artmatter.co/checkout` uses Artmatter Core as the authoritative address service:

* **Country Configuration**: `GET /wp-json/artmatter-core/v1/checkout/config?country={code}` returns WooCommerce allowed countries and states.
* **Indonesian Resolution**: `POST /wp-json/artmatter-core/v1/checkout/address` accepts JSON `{ "country": "ID", "postcode": "12345" }` and returns `postcode`, `province`, WooCommerce `state` code, `city`, `district`, and `subdistrict`.
* **Security Boundary**: The Biteship API key is read from the enabled `biteship_shipping` WooCommerce shipping-zone instance. It is never returned by REST or sent to the browser.
* **Input Scope**: Only country `ID` and a five-digit postcode are accepted. Other input returns HTTP 400.
* **Abuse Controls**: Successful lookups are cached for one day. Uncached lookups are limited to 20 requests per validated client IP per 10 minutes.
* **Customer Data**: The endpoint receives no name, email, phone, or street address. It sends only the postcode to Biteship.
* **React Proxy**: `artmatter-web/app/api/commerce/[...path]/route.ts` explicitly allowlists `address` and proxies it through same-origin `POST /api/commerce/address`. Client components must never call Biteship directly.
* **Form Behavior**: React hides automatically resolved Indonesian city, province, district, and subdistrict fields. International field visibility and required state follow WooCommerce locale rules, including hiding state/province for Singapore.
* **Failure Rule**: React must not advance to shipping for an Indonesian address until lookup succeeds. This prevents empty hidden address fields from reaching WooCommerce shipping calculation.

### Headless Multicurrency Contract (Core 7.10.32+)
The React storefront and WooCommerce share one explicit currency context through the Next.js commerce proxy:

* **Automatic Detection**: The proxy forwards the original visitor IP as `X-Artmatter-Client-IP`. Artmatter Core exposes it to Aelia before currency resolution so Aelia's configured country rules remain authoritative.
* **Explicit Context**: Once detected or manually selected, React sends `X-Artmatter-Currency` on every commerce request. Core accepts only `IDR` or currencies registered in `Artmatter_Store_Enhancements::get_currency_rates()`.
* **Request Scope**: Core maps the validated header to the Aelia request cookie and the `woocommerce_currency` filter before Store API price calculation. It does not trust arbitrary currency codes.
* **Configuration**: `GET /wp-json/artmatter-core/v1/checkout/config` returns the resolved active currency with country and state options.
* **Price Quote**: `GET /wp-json/artmatter-core/v1/checkout/price?product_id={id}` returns `currency`, `minor_unit`, and `prices.standard`, `prices.flat`, and `prices.feelform` as major-unit numbers.
* **Pricing Authority**: Artmatter Core owns FX conversion, global markup, per-currency rounding, and custom-finish prices. React only formats returned values.
* **Checkout Authority**: WooCommerce Store API cart totals remain final. Browser cart prices are display estimates and are requoted whenever currency changes.
* **Formatting**: React renders Store API minor-unit values with each response's `currency_code` and `currency_minor_unit`; no hardcoded symbols are permitted.
* **Persistence**: React stores the selected code in `artmatter_currency` and its commerce session. Currency changes refresh server-rendered catalog data and persisted cart quotes.

#### Rounding Source of Truth

`Artmatter_Store_Enhancements::calculate_price_for_currency()` is the only supported conversion implementation. It reads `currency_global_markup` and the configured currency registry. `none` preserves two decimals; zero-decimal psychological rules remain zero-decimal. `_regular_currency_prices` and `_sale_currency_prices` use matching decimal precision.

### Step 2: Shipping
* **Customer Info Recap Card**:
  * Displays Contact Email and Shipping Address.
  * Each row includes a sleek `"Change"` link that immediately navigates back to Step 1 (`#information`).
* **Shipping Method Selection**:
  * Rendered via `wc_cart_totals_shipping_html()`.
  * Fully responsive, styled as dark luxury cards (`#141418`, `border-radius: 14px`).
  * Displays courier title, estimated transit duration (e.g. `1 - 2 business days`), and right-aligned price.
* **Always-Visible Shipping Under Subtotal**:
  * In Step 1 (before shipping is selected), the Order Summary displays:
    $$\text{Shipping} \quad \longrightarrow \quad \text{"Calculated at next step"}$$
  * Selecting a rate in Step 2 instantly updates the order review total.

### Step 3: Payment
* **Full Customer & Method Recap Card**: Displays Contact, Address, and Chosen Shipping Courier with individual `"Change"` links.
* **Payment Gateways**:
  * Supports Midtrans Snap, Virtual Accounts, Credit Cards, GoPay, ShopeePay, QRIS, and Alfamart.
  * **Smooth Accordion Animation**: `.payment_box` animates using CSS transitions (`max-height: 0 → 800px`, `opacity: 0 → 1`, `padding`, `margin`) tied directly to `:has(input[type="radio"]:checked)`. No jQuery animation collisions or sudden pop-ins.
* **Terms & Conditions Box**:
  * Styled as a luxury dark surface card (`background: #0d0d10`, `border-radius: 12px`).
  * Entire card is clickable to toggle agreement.
  * Text is strictly regular weight (`font-weight: 400 !important;`) and vertically centered with the checkbox.

---

## 3. Shipping Methods & AJAX Fragment Retention

### The Fragment Replacement Rule
When WooCommerce updates checkout totals via AJAX (`update_order_review`), it executes `$(key).replaceWith(fragment)`:
1. **Container Integrity**: In `includes/class-checkout-engine.php`, the fragment filter `add_shipping_methods_fragment` must always wrap `wc_cart_totals_shipping_html()` inside `<div id="artmatter-shipping-methods-container">` so the container is preserved after `replaceWith()`.
2. **Full Width Enforcement**: Table elements (`tr.woocommerce-shipping-totals`, `td`, `ul#shipping_method`) are styled with:
   ```css
   width: 100% !important;
   min-width: 100% !important;
   max-width: 100% !important;
   display: block !important;
   box-sizing: border-box !important;
   align-self: stretch !important;
   flex: 1 1 100% !important;
   ```
   This prevents browsers from shrink-wrapping table elements to text width (`fit-content`).

---

## 4. Coupons & Promo Engine

* **Collapsible Drawer**: Located in the order summary sidebar under the line items (`#artmatter_promo_drawer`).
* **AJAX Endpoint**: Handled by `Artmatter_Checkout_Engine::ajax_apply_coupon`.
* **HTML Entity Decoding**: WooCommerce error and success notices (which often contain `&quot;code&quot;`) are decoded using:
  ```php
  html_entity_decode( wp_strip_all_tags( $raw_msg ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
  ```
  JavaScript decodes any residual entities via `textarea.value` before displaying feedback in `$feedback`.
* **Top Coupon Bar Suppressed**: The generic WooCommerce top bar `Have a coupon? [Click here to enter your code]` is permanently suppressed in PHP via `remove_action('woocommerce_before_checkout_form', 'woocommerce_checkout_coupon_form', 10)` and hidden via CSS, centralizing all promo interaction cleanly inside the sidebar drawer.
* **Live AJAX Review Update & Borderless Totals**:
  * `<div class="artmatter-co-totals-table woocommerce-checkout-review-order-table">` carries the `.woocommerce-checkout-review-order-table` class required by WooCommerce core's update action.
  * Completely borderless: all default WooCommerce and Bricks table borders (`border: none !important;`) are stripped for a seamless, floating aesthetic.
  * Applying or removing a coupon triggers `$body.trigger('update_checkout')`, which immediately updates the totals table via AJAX with zero full-page reload.
* **Coupon Line Item Styling**:
  * Title/Code (`Coupon: xyz`): Subtle muted secondary (`#a1a1aa`), regular weight (`font-weight: 400`), NOT lime.
  * Discount Amount (`-$14.75`): Accent lime (`#a9ff5d`), monospace font, regular weight (`font-weight: 400`).
  * Remove Link (`[Remove]`): Subtle grey (`#71717a`), no red background, clean text underline on hover.
  * Zero bold weights across all total rows.

---

## 5. Notice Placement & Mobile Architecture

### Top Notice Anchor (`#artmatter-checkout-notices-top`)
* All WooCommerce notices (coupons, endorsement orders, payment errors) must be anchored at the absolute top of the page.
* An explicit container `#artmatter-checkout-notices-top` sits directly inside `.artmatter-checkout-wrapper` preceding the Stepper and Form.
* `ensureNoticesOnTop()` in `checkout.js` automatically routes newly injected notices to this anchor on document ready, `updated_checkout`, and `checkout_error`.

### Mobile Layout Hierarchy (`< 768px`)
* **Grid Direction**: `.artmatter-checkout-grid` uses `flex-direction: column !important;` (never `column-reverse`), with:
  1. Top Notices (`#artmatter-checkout-notices-top`)
  2. Stepper (`.artmatter-co-stepper-wrap`)
  3. Order Summary (`.artmatter-checkout-sidebar { order: 1 }`)
  4. Form Steps & Actions (`.artmatter-checkout-main { order: 2 }`)
* **Action Buttons Stacking**:
  * Primary action button (*"Continue to payment"* / *"Place order"*) sits full-width on top (`order: 1`, `height: 46px`).
  * Secondary back button (*"Return to information"*) is centered underneath (`order: 2`, `padding: 10px 0`).
* **Mobile Padding**: `padding: 20px 20px 80px` provides ample touch targets without cramped horizontal borders.

---

## 6. Order Confirmation (Thank You) & Shipment Tracking

* **Dual-Timeline Architecture**:
  The Thank You page and customer order view cleanly separate workshop production from courier transit:
   1. **Workshop Progress Bar (Top)**: 6 fine art manufacturing stages with Lucide SVG stroke icons:
      * **Confirmed**: `check`
      * **In Production**: `palette` (art studio)
      * **Quality Check**: `shield-check` (verification badge)
      * **Ready to Ship**: `package` (sealed parcel)
      * **Shipped**: `truck` (delivery courier)
      * **Delivered**: `home` (doorstep arrival)
      * **Connecting Track**: Placed at `left: 37px; right: 37px;` matching Circle 1 and Circle 6 centers. The active progress line is nested inside the track container, terminating cleanly under the Delivered circle with zero trailing overshoot.
      * **Top-Right Status Badge**: Subtly styled pill matching `.artmatter-order-status-pill` palette (`#86efac` soft mint for Delivered) with balanced, equal top/bottom and left/right padding (`padding: 5px 8px; line-height: 1;`).
   2. **Dedicated Courier Shipment Tracking Timeline (Bottom Card)**: Powered by **TrackingMore API v4** (`class-shipping-tracker.php`):
      * Merges origin (e.g. POS Indonesia / Goorita) and destination (e.g. DHL Germany / USPS) checkpoints chronologically, prioritizing clean English destination updates.
      * Displays vertical progress path with live status dot, event description, location, and monospace timestamp.
      * When awaiting courier intake scans, displays an honest single quiet-luxury notice card (*"Manifest Registered with Carrier"*), completely eliminating deceptive mock step progression.
      * Zero external courier links: Outbound `"Courier portal →"` links are removed across customer views to keep collectors within Artmatter.
      * Strictly zero cartoon emojis (pure Lucide SVG vectors only).
      * Standardized brand typography: `"Neue Haas Display", "Neue Haas Grotesk Text Pro", inherit, sans-serif;`.
      * Includes live customer refresh button with rotating Lucide icon.
      * Customer orders portal (`[artmatter_orders]`): Clicking `Track ->` opens an interactive luxury modal popup overlay with live timeline without leaving the page.
* **Full Logistics Reference**: See [docs/SHIPPING_AND_TRACKING_SYSTEM.md](file:///c:/AntiGravity/artmatter-manager/docs/SHIPPING_AND_TRACKING_SYSTEM.md) for full API details, webhook push setup, and carrier codes.

---

## 7. Versioning & Deployment Protocol

### Mandatory Multi-File Version Sync
Whenever modifying checkout, templates, or styles, bump the plugin version in all 4 required locations:
1. `wordpress-plugin/artmatter-core/artmatter-core.php` (`Version: X.Y.Z` and `ARTMATTER_CORE_VERSION`)
2. `package.json` (`"version": "X.Y.Z"`)
3. `src/config/version.ts` (updated automatically by `npm run build`)
4. `VERSION_HISTORY.md` (add release section)

### Build & Deploy Commands
```bash
# 1. Compile bundle & generate plugin zip
npm run build

# 2. Push changes to GitHub
git add .
git commit -m "feat(checkout): description (vX.Y.Z)"
git push origin main
```

### Cross-Repository Deployment Order
When a React checkout change depends on a new Artmatter Core route:

1. Build and push `artmatter-manager`, then wait for the versioned plugin ZIP and `version.json` to be live on `manager.artmatter.co`.
2. Install the new Artmatter Core version in WordPress and verify the REST route directly.
3. Build and push `artmatter-web`.
4. Verify the React checkout against the live Core route for Indonesia and at least one no-state country such as Singapore.

Do not deploy the dependent React behavior first. A published plugin ZIP does not activate the route; WordPress must be running the new Core version.

### SSH Production Update One-Liner
```bash
cd /home/exacoat/webapps/artmatter/wp-content/plugins/ && \
curl -L -o artmatter-core.zip "https://manager.artmatter.co/artmatter-core.zip" && \
unzip -qo artmatter-core.zip && \
rm -f artmatter-core.zip && \
chown -R exacoat:exacoat /home/exacoat/webapps/artmatter/wp-content/plugins/artmatter-core && \
touch /home/exacoat/webapps/artmatter/index.php && \
killall lsphp 2>/dev/null || true
```
