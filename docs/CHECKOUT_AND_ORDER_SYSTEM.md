# Exacoat Checkout & Order Architecture Reference

> **Purpose**: This document serves as the permanent system reference for the **Exacoat Checkout, Order Confirmation (Thank You), and Repayment Engines**. Any AI agent or developer modifying checkout, shipping, coupons, or order confirmation must adhere to the patterns and contracts documented here.

---

## 1. System Architecture & Template Hierarchy

The Exacoat checkout experience replaces standard WooCommerce multi-page/cluttered forms with a bespoke, distraction-free, 3-step modern flow.

### Overridden WooCommerce Templates
All templates reside in `wordpress-plugin/exacoat-core/templates/checkout/`:
1. **`form-checkout.php`**: The primary 3-step checkout interface (Information -> Shipping -> Payment). Includes customer recap cards, sticky order summary sidebar, and quick login drawer.
2. **`review-order.php`**: Real-time totals breakdown (Subtotal, Shipping, Coupons, Discount, Tax, Final Total). Replaced seamlessly via WooCommerce AJAX fragments (`.woocommerce-checkout-review-order-table` and `.artmatter-co-totals-table`).
3. **`thankyou.php`**: Order receipt with distinct Lucide fulfillment milestone tracking icons, live Biteship courier tracking, item thumbnail grid, and customer support links.
4. **`form-pay.php`**: Seamless repayment gateway interface for pending/failed orders (e.g. Midtrans expired sessions or invoice links).

---

## 2. 3-Step Stepper Engine

```
[ Step 1: Information ] -> [ Step 2: Shipping ] -> [ Step 3: Payment ]
```

### State Management (`assets/js/checkout.js`)
* Steps are controlled via `currentStep` (`'information' | 'shipping' | 'payment'`).
* Panels are designated by `.artmatter-co-step-panel` with IDs `#artmatter-step-info`, `#artmatter-step-shipping`, and `#artmatter-step-payment`.
* Stepper buttons and links use `data-action="goto-step"` and `data-target-step="stepName"`.
* On step advancement, forward navigation triggers strict client-side field validation (`validateStep(currentStep)`).

### Step 1: Information
* **Contact Email**: Auto-detects logged-in status. When a guest types an email belonging to an existing account, `#artmatter-account-modal` appears offering 1-click password login and address auto-fill.
* **Biteship Automated Address**:
  * For Indonesia (`ID`), displays `#biteship_automated_address_field` for instant subdistrict/district autocomplete.
  * Auto-extracts postal code, district, and province into hidden inputs (`#biteship_subdistrict_override`, `#biteship_district_override`).
  * 5-digit postal code validation with inline error messaging (`.artmatter-field-inline-error`).
* **International Addresses**:
  * Switching country hides the automated Indonesian finder and activates standard city, state, postal code, and country select dropdowns.

### Headless Address Contract
The storefront uses Exacoat Core as the authoritative address service:

* **Country Configuration**: `GET /wp-json/exacoat-core/v1/checkout/config?country={code}` returns WooCommerce allowed countries and states.
* **Indonesian Resolution**: `POST /wp-json/exacoat-core/v1/checkout/address` accepts JSON `{ "country": "ID", "postcode": "12345" }` and returns `postcode`, `province`, WooCommerce `state` code, `city`, `district`, and `subdistrict`.
* **Security Boundary**: The Biteship API key is read from the enabled `biteship_shipping` WooCommerce shipping-zone instance. It is never returned by REST or sent to the browser.
* **Input Scope**: Only country `ID` and a five-digit postcode are accepted. Other input returns HTTP 400.
* **Abuse Controls**: Successful lookups are cached for one day. Uncached lookups are limited to 20 requests per validated client IP per 10 minutes.
* **Customer Data**: The endpoint receives no name, email, phone, or street address. It sends only the postcode to Biteship.
* **Form Behavior**: Frontend hides automatically resolved Indonesian city, province, district, and subdistrict fields. International field visibility and required state follow WooCommerce locale rules, including hiding state/province for Singapore.
* **Failure Rule**: Frontend must not advance to shipping for an Indonesian address until lookup succeeds. This prevents empty hidden address fields from reaching WooCommerce shipping calculation.

### Headless Multicurrency Contract
The webstore and WooCommerce share one explicit currency context:

* **Automatic Detection**: Forwarded visitor IP is exposed to currency resolution so country rules remain authoritative.
* **Explicit Context**: Once detected or manually selected, requests send `X-Exacoat-Currency`. Core accepts only `IDR` or currencies registered in `Exacoat_Store_Enhancements::get_currency_rates()`.
* **Request Scope**: Core maps the validated header to the currency cookie and the `woocommerce_currency` filter before Store API price calculation.
* **Configuration**: `GET /wp-json/exacoat-core/v1/checkout/config` returns the resolved active currency with country and state options.
* **Pricing Authority**: Exacoat Core owns FX conversion, global markup, per-currency rounding, and custom pricing.
* **Checkout Authority**: WooCommerce Store API cart totals remain final. Browser cart prices are display estimates and are requoted whenever currency changes.

#### Rounding Source of Truth

`Exacoat_Store_Enhancements::calculate_price_for_currency()` is the supported conversion implementation. It reads `currency_global_markup` and the configured currency registry. `none` preserves two decimals; zero-decimal psychological rules remain zero-decimal. `_regular_currency_prices` and `_sale_currency_prices` use matching decimal precision.

### Step 2: Shipping
* **Customer Info Recap Card**:
  * Displays Contact Email and Shipping Address.
  * Each row includes a `"Change"` link that immediately navigates back to Step 1 (`#information`).
* **Shipping Method Selection**:
  * Rendered via `wc_cart_totals_shipping_html()`.
  * Fully responsive, styled as dark cards (`#141418`, `border-radius: 14px`).
  * Displays courier title, estimated transit duration (e.g. `1 - 2 business days`), and right-aligned price.
* **Always-Visible Shipping Under Subtotal**:
  * In Step 1 (before shipping is selected), the Order Summary displays:
    $$\text{Shipping} \quad \longrightarrow \quad \text{"Calculated at next step"}$$
  * Selecting a rate in Step 2 instantly updates the order review total.

### Step 3: Payment
* **Full Customer & Method Recap Card**: Displays Contact, Address, and Chosen Shipping Courier with individual `"Change"` links.
* **Payment Gateways**:
  * Supports Midtrans Snap, Virtual Accounts, Credit Cards, GoPay, ShopeePay, QRIS, and Alfamart.
  * **Smooth Accordion Animation**: `.payment_box` animates using CSS transitions (`max-height: 0 -> 800px`, `opacity: 0 -> 1`, `padding`, `margin`) tied directly to `:has(input[type="radio"]:checked)`.
* **Terms & Conditions Box**:
  * Styled as a dark surface card (`background: #0d0d10`, `border-radius: 12px`).
  * Entire card is clickable to toggle agreement.
  * Text is regular weight (`font-weight: 400 !important;`) and vertically centered with the checkbox.

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
* **AJAX Endpoint**: Handled by `Exacoat_Checkout_Engine::ajax_apply_coupon`.
* **HTML Entity Decoding**: WooCommerce error and success notices (which often contain `&quot;code&quot;`) are decoded using:
  ```php
  html_entity_decode( wp_strip_all_tags( $raw_msg ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
  ```
  JavaScript decodes any residual entities via `textarea.value` before displaying feedback in `$feedback`.
* **Top Coupon Bar Suppressed**: The generic WooCommerce top bar `Have a coupon? [Click here to enter your code]` is permanently suppressed in PHP via `remove_action('woocommerce_before_checkout_form', 'woocommerce_checkout_coupon_form', 10)` and hidden via CSS, centralizing all promo interaction cleanly inside the sidebar drawer.
* **Live AJAX Review Update & Borderless Totals**:
  * `<div class="artmatter-co-totals-table woocommerce-checkout-review-order-table">` carries the `.woocommerce-checkout-review-order-table` class required by WooCommerce core's update action.
  * Completely borderless: all default WooCommerce table borders (`border: none !important;`) are stripped for a seamless aesthetic.
  * Applying or removing a coupon triggers `$body.trigger('update_checkout')`, which immediately updates the totals table via AJAX with zero full-page reload.
* **Coupon Line Item Styling**:
  * Title/Code (`Coupon: xyz`): Subtle muted secondary (`#a1a1aa`), regular weight (`font-weight: 400`).
  * Discount Amount (`-$14.75`): Monospace font, regular weight (`font-weight: 400`).
  * Remove Link (`[Remove]`): Subtle grey (`#71717a`), no red background, clean text underline on hover.
  * Zero bold weights across all total rows.

---

## 5. Notice Placement & Mobile Architecture

### Top Notice Anchor (`#artmatter-checkout-notices-top`)
* All WooCommerce notices (coupons, payment errors) must be anchored at the absolute top of the page.
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
   1. **Workshop Progress Bar (Top)**: 6 manufacturing stages with Lucide SVG stroke icons:
      * **Confirmed**: `check`
      * **In Production**: `palette` (cutting and production)
      * **Quality Check**: `shield-check` (verification badge)
      * **Ready to Ship**: `package` (sealed parcel)
      * **Shipped**: `truck` (delivery courier)
      * **Delivered**: `home` (doorstep arrival)
      * **Connecting Track**: Placed at `left: 37px; right: 37px;` matching Circle 1 and Circle 6 centers. The active progress line is nested inside the track container, terminating cleanly under the Delivered circle with zero trailing overshoot.
      * **Top-Right Status Badge**: Subtly styled pill matching `.artmatter-order-status-pill` palette (`#86efac` soft mint for Delivered) with balanced padding (`padding: 5px 8px; line-height: 1;`).
   2. **Dedicated Courier Shipment Tracking Timeline (Bottom Card)**: Powered by **TrackingMore API v4** (`class-shipping-tracker.php`):
      * Merges origin (e.g. POS Indonesia / Goorita) and destination (e.g. DHL Germany / USPS) checkpoints chronologically, prioritizing clean destination updates.
      * Displays vertical progress path with live status dot, event description, location, and monospace timestamp.
      * When awaiting courier intake scans, displays a notice card (*"Manifest Registered with Carrier"*), eliminating mock step progression.
      * Zero external courier links: Outbound links are removed across customer views to keep users within Exacoat.
      * Standardized typography.
      * Includes live customer refresh button with rotating Lucide icon.
      * Customer tracking: Clicking `Track ->` opens an interactive modal overlay with live timeline without leaving the page.
* **Full Logistics Reference**: See [`docs/SHIPPING_AND_TRACKING_SYSTEM.md`](file:///c:/AI/exacoat-manager/docs/SHIPPING_AND_TRACKING_SYSTEM.md) for full API details, webhook push setup, and carrier codes.

---

## 7. Versioning & Deployment Protocol

### Mandatory Multi-File Version Sync
Whenever modifying checkout, templates, or styles, bump the plugin version in all required locations:
1. `wordpress-plugin/exacoat-core/exacoat-core.php` (`Version: X.Y.Z` and `EXACOAT_CORE_VERSION`)
2. `package.json` (`"version": "X.Y.Z"`)
3. `src/config/version.ts` (updated automatically by `npm run build`)
4. `CHANGELOG.md` (add release entry)

### Build & Deploy Commands
```bash
# 1. Compile bundle & generate plugin zip
npm run build

# 2. Push changes to GitHub
git add .
git commit -m "feat(checkout): description (vX.Y.Z)"
git push origin main
```

---

## 8. Store Credits, Advanced Coupons & Cashback Integration

### Store API Extension Endpoints & Namespaces
Exacoat Core registers Store API callbacks to support headless cart operations:
- **`exacoat-store-credit`** (and legacy alias `artmatter-store-credit`):
  - Callback: `Exacoat_Checkout_Engine::handle_store_credit_update(array $data)`
  - Accepts `{ amount: number }`. When amount is `0`, clears store credit session and removes virtual `'store credit'` coupon.
  - Verifies user authentication and automatically synchronizes `$user_id` to `WC()->customer` if the Store API cart was initialized prior to authentication headers.
  - Validates requested amount against available customer balance retrieved from Advanced Coupons (`ACFWF()->Store_Credits_Calculate->get_customer_balance()` or user meta `acfw_store_credit_balance`).
- **`exacoat_coupons`** (and legacy alias `artmatter_coupons`):
  - Callback: `Exacoat_Checkout_Engine::get_store_api_coupons_data()`
  - Enriches applied coupons in Store API cart with metadata: `is_cashback`, `cashback_percent`, `cashback_waiting_period`, and calculated `cashback_amount`.

### Robust Cashback Detection Invariant
In Advanced Coupons for WooCommerce (ACFW), cashback coupons frequently declare standard WooCommerce discount types (such as `'percent'` or `'fixed_cart'`) rather than dedicated `'acfw_percentage_cashback'` strings:
- Both `class-checkout-engine.php` and `class-customer-auth.php` evaluate cashback status comprehensively:
  ```php
  $is_cashback = (
      false !== strpos( $discount_type, 'cashback' )
      || 'yes' === get_post_meta( $id, '_is_coupon_cashback', true )
      || metadata_exists( 'post', $id, '_acfw_cashback_waiting_period' )
      || false !== stripos( $code, 'cashback' )
  );
  ```
- Cashback calculations support percent-based formulas for `'percent'` discount types (`$cart_subtotal * ($amount / 100.0)`) and respect optional maximum caps configured in `_acfw_percentage_discount_cap`.

### Virtual Store Credit Stacking Exemption
WooCommerce injects virtual coupons (`'store credit'`, `'store-credit'`, `'store_credit'`) into the cart to represent applied store credit deductions:
- In `Exacoat_Review_Manager::prevent_coupon_stacking()`, virtual store credit is explicitly exempted at the start of the filter and inside coupon comparison loops.
- This ensures customers can freely combine earned store credit with promotional codes (including single-use Exacoat Perks review codes) without triggering coupon lockout exceptions (Exception 109).

### Headless Webstore Presentation (`checkout-review.tsx`)
1. **One-Click Apply Notices**:
   - Parses `acfwp_block.one_click_apply.notices` HTML button payloads via `parseOneClickNotice()`.
   - Filters out already applied codes and displays featured and collapsible promotional cards with direct 1-click apply action.
2. **Applied Coupons with Cashback Badges**:
   - Displays `+{cashbackPercent}% Cashback` badge and interactive popover terms tooltip showing calculated store credit reward and delivery waiting periods.
3. **Cashback Summary Row**:
   - When cashback is active on an order, renders a dedicated `Cashback earned: +{amount}` line item in the totals recap with full terms tooltip.
