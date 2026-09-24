# Store Credit & Cashback Notification System

This document outlines the architecture, email overrides, and Action Scheduler lifecycle for customer cashback and store credit balance reminders in Exacoat.

---

## 1. Architectural Overview & Problem Context

Exacoat uses **Advanced Coupons for WooCommerce (ACFW)** to issue cashback and manage customer store credit balances (`acfw_store_credit_balance`).
By default:
1. ACFW deposits cashback into the customer's store credit balance once an order reaches a qualifying status (e.g. `completed`) or clears the waiting period.
2. ACFW email notifications use default WooCommerce email styling (light mode, generic layout, basic table) dispatched via standard WordPress `wp_mail()`.
3. Standard ACFW balance reminders only trigger after long periods of customer inactivity (e.g., 30 or 60 days of zero logins or orders), missing the high-intent window immediately following a purchase.

### Solution Architecture
Exacoat Core introduces [`Exacoat_Store_Credit_Manager`](file:///c:/AI/exacoat-manager/wordpress-plugin/exacoat-core/includes/class-store-credit-manager.php) integrated with [`Exacoat_Email_Engine`](file:///c:/AI/exacoat-manager/wordpress-plugin/exacoat-core/includes/class-email-engine.php):
- **Default Email Suppression**: All unstyled ACFW WooCommerce emails (`acfw_store_credit_reminder_email`, `acfw_store_credit_email`, `customer_store_credit`) are suppressed via standard filters.
- **Immediate Cashback Notification**: When an order earning cashback transitions to `completed`, Exacoat dispatches `customer_cashback_earned` directly via the Zoho ZeptoMail API.
- **Automated Lifecycle Follow-Up**: Action Scheduler enqueues a 7-day follow-up reminder (`exacoat_send_store_credit_reminder_job`) in queue `exacoat-store-credit`.
- **Intelligent Balance & Order Verification**: The reminder only sends if the customer still has an active balance (> 0), has not placed an order in the interim, and has not received a reminder within the last 14 days.

---

## 2. Invariants & System Boundaries

1. **Brand Consistency**:
   - All customer communications must use Exacoat's light/dark-mode quiet luxury design system rendered by `Exacoat_Email_Engine::render_store_credit_html()`.
   - Emails feature the official Exacoat brand logo SVG, clear typography, highlighted balance cards, and direct storefront CTAs.
   - Deliverability is handled through Zoho ZeptoMail API rather than local server `wp_mail()`.

2. **Deduplication Invariant**:
   - Order meta `_exacoat_cashback_email_sent` (`'yes'`) is set immediately upon dispatch, preventing duplicate emails during rapid status toggles or webhook retries.
   - User meta `_exacoat_last_sc_reminder_sent` (timestamp) enforces a 14-day minimum cooldown between balance reminders for the same user.

3. **Multi-Source Cashback Resolution**:
   - `Exacoat_Store_Credit_Manager::resolve_order_cashback()` checks order metadata (`_cashback_earned`, `cashback_earned`, `_acfw_cashback_earned`, `_acfw_order_cashback`).
   - If meta is absent or uncalculated, it inspects applied coupon definitions on the order for `_is_coupon_cashback` or discount types containing `cashback`, calculating the reward dynamically from the order subtotal and discount caps.

---

## 3. Email Template Specifications

### A. Cashback Earned (`customer_cashback_earned`)
* **Category**: Store Credits
* **Trigger**: Order transitions to `completed` with eligible cashback coupon.
* **Subject**: `You received {{cashback_amount}} cashback on order #{{order_number}}`
* **Badge**: `Store Credit`
* **Visual Card**: Highlighted balance container showing:
  * Total available store credit balance (large 34px bold text).
  * Pill badge: `+{{cashback_amount}} Cashback from Order #{{order_number}}`.
  * Help note: `Applied automatically at checkout when signed in`.
* **Primary CTA**: `Shop Device Skins →` linking to `https://exacoat.com/shop/`.

### B. Store Credit Reminder (`customer_store_credit_reminder`)
* **Category**: Store Credits
* **Trigger**: Action Scheduler 7-day lifecycle follow-up or ACFW reminder cron.
* **Subject**: `You have {{store_credit_balance}} store credit waiting in your Exacoat account`
* **Badge**: `Store Credit`
* **Visual Card**: Available store credit balance with quiet luxury styling.
* **Primary CTA**: `Use Your Credit →` linking to `https://exacoat.com/shop/`.

---

## 4. 1-Year Expiration Lifecycle & Action Scheduler

### Individual FIFO Expiration Model
* **Separate Expiry per Credit**: Each cashback issuance is stamped with its own expiration date (`_exacoat_cashback_expiry_ts` and `_exacoat_cashback_expiry_date`), calculated exactly 1 year from the date of the qualifying order.
* **FIFO Consumption**: Advanced Coupons deducts store credit balances using First-In-First-Out (FIFO). When a customer spends credit, the earliest-expiring credit is used first.
* **Independent Expiry**: If a customer earned Rp 25.000 in January and Rp 50.000 in March, only the January credit expires after 1 year, while the March credit remains valid until March of the following year.

### Dual Action Scheduler Lifecycle Jobs
* **Queue Group**: `exacoat-store-credit`
* **Action Hook**: `exacoat_send_store_credit_reminder_job`
* **Job 1 (Day 7 Follow-Up)**:
  Enqueued for 7 days post-purchase (`time() + ( 7 * DAY_IN_SECONDS )`). Reminds customer to return and use their credit while purchase excitement is high.
* **Job 2 (Day 335 Pre-Expiry Alert - 30 Days Left)**:
  Enqueued for 335 days post-purchase (`time() + ( 335 * DAY_IN_SECONDS )`). Warns customer that their credit will expire in 30 days, creating real urgency to complete another order.
* **Safety Checks**: Both jobs verify that customer store credit balance is still > 0, ensure no intermediate order was placed, and respect a 14-day anti-spam cooldown.

---

## 5. Testing & Verification

1. **AJAX Test Endpoints**:
   - `POST /wp-admin/admin-ajax.php?action=exacoat_test_cashback_email`
   - `POST /wp-admin/admin-ajax.php?action=exacoat_test_store_credit_reminder`
2. **Visual HTML Preview**:
   - `GET /wp-admin/admin-ajax.php?action=exacoat_preview_email_html&event=customer_cashback_earned`
   - `GET /wp-admin/admin-ajax.php?action=exacoat_preview_email_html&event=customer_store_credit_reminder`
