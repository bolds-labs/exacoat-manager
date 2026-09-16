# Artmatter Shipping, Logistics & Tracking Architecture Reference

> **Purpose**: This document serves as the permanent system architecture reference for the **Artmatter Shipping, Logistics, Courier Tracking, and Automated Delivery Detection Engine**. Any developer or AI agent modifying fulfillment, courier integration, tracking numbers, or order status progression must adhere to the patterns and contracts documented here.

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Carrier Integration & TrackingMore v4](#2-carrier-integration--trackingmore-v4)
3. [End-to-End Tracking Lifecycle & Automated Delivery](#3-end-to-end-tracking-lifecycle--automated-delivery)
4. [Multi-Leg Checkpoint Merging Engine](#4-multi-leg-checkpoint-merging-engine)
5. [Webhook Push Notifications](#5-webhook-push-notifications)
6. [UI Architecture: Dual-Timeline Separation](#6-ui-architecture-dual-timeline-separation)
7. [Brand Voice & Design Constraints](#7-brand-voice--design-constraints)
8. [Customer Access & Zero-Login Tracking](#8-customer-access--zero-login-tracking)
9. [Admin Operations & 1-Click Diagnostics](#9-admin-operations--1-click-diagnostics)
10. [Metadata Schema Reference](#10-metadata-schema-reference)

---

## 1. Architecture Overview

Artmatter's logistics layer consolidates order fulfillment across local Indonesian logistics (Biteship, JNE, SiCepat, POS Indonesia) and international export couriers (Goorita USA, DHL Express, FedEx, Deutsche Post).

The system decouples internal workshop manufacturing status from external courier parcel progress:
* **Internal Workshop Timeline**: Tracks artwork production through 6 stages (*Confirmed → In Production → Quality Check → Ready to Ship → Shipped → Delivered*).
* **Courier Shipment Tracking Timeline**: Tracks physical transit checkpoints reported by carriers via the **TrackingMore API v4** engine.

```
[ WooCommerce / ACF / HPOS Order ]
             │
             ▼ (Order marked Shipped or Tracking # entered)
[ Artmatter_Shipping_Tracker::handle_order_save() ]
             │
             ├──► Auto-Detect Courier Code (e.g. indonesia-post, jne, dhl)
             ├──► POST /v4/trackings/create (TrackingMore v4 API)
             └──► GET /v4/trackings/get (Initial Checkpoint Sync)
                          │
                          ▼
            [ Multi-Leg Checkpoint Merge ]
        (Origin Info + Destination Info Events)
                          │
                          ▼
        [ Store in _artmatter_tracking_checkpoints ]
                          │
                          ▼
       [ Webhook / Polling: Delivery Scan Received ]
                          │
                          ▼
[ Transition Order to 'completed' (Delivered) ]
  ├── Start 28-Day Artist Commission Clearance
  └── Send Customer Luxury Arrival Notice
```

---

## 2. Carrier Integration & TrackingMore v4

### Why TrackingMore?
* **Zero Ongoing Cost**: TrackingMore provides a permanent free plan with **50 tracked shipments/month**, perfectly sized for Artmatter's volume without recurring overhead.
* **Modern REST v4 API**: Fast JSON endpoints with unified carrier detection and multi-language checkpoint translation.

### API Credentials & Header Auth
* **API Key**: Managed in Artmatter Settings (`artmatter_core_settings[trackingmore_api_key]`), defaulting to active account key `bkows1gc-6uu5-si5b-f4st-bqvk3lae9u5c`.
* **Auth Header**:
  ```http
  Tracking-Api-Key: [API_KEY]
  Content-Type: application/json
  ```

### Official Courier Code Mapping
| Internal Carrier ID | Carrier Name | TrackingMore `courier_code` | Notes |
| :--- | :--- | :--- | :--- |
| `pos`, `pos indonesia` | POS Indonesia | `indonesia-post` | Primary international export carrier |
| `goorita` | Goorita Send USA | `indonesia-post` | Goorita routes via POS Indonesia export |
| `jne`, `jne express` | JNE Express | `jne` | Domestic Indonesia |
| `sicepat` | SiCepat | `sicepat` | Domestic Indonesia |
| `jnt`, `j&t` | J&T Express | `j-and-t-express` | Domestic & SE Asia |
| `lion`, `lion parcel`| Lion Parcel | `lion-parcel` | Domestic air cargo |
| `dhl`, `dhl express` | DHL Express | `dhl` | International express |
| `fedex` | FedEx | `fedex` | International priority |
| `anteraja` | Anteraja | `anteraja` | Domestic Indonesia |
| `tiki` | TIKI | `tiki` | Domestic Indonesia |
| `ninja` | Ninja Van | `ninja-van-id` | Domestic & regional |

### Courier Auto-Detection Fallback
If a carrier is unspecified or set to "auto", `Artmatter_Shipping_Tracker::detect_trackingmore_courier()` queries `POST https://api.trackingmore.com/v4/couriers/detect` with the tracking number to identify the courier before registration.

---

## 3. End-to-End Tracking Lifecycle & Automated Delivery

### 1. Registration
When an order is updated with a tracking number in WooCommerce Admin (HPOS, classic postmeta, or ACF), `handle_order_save()` triggers `register_with_trackingmore()`:
* Sends `POST /v4/trackings/create`.
* Both HTTP 200 (`meta.code: 200`) and Duplicate Shipment (`meta.code: 4101` - *"Tracking No. already exists"*) are treated as successful states.
* Flags order as registered (`_artmatter_trackingmore_registered = 1`).

### 2. Live Synchronization
`sync_order_tracking( $order_id )`:
* Calls `GET https://api.trackingmore.com/v4/trackings/get?tracking_numbers=[NUMBER]`.
* If not yet registered in TrackingMore, it automatically executes registration and retries retrieval.

### 3. Automated Delivery Transition
When TrackingMore detects that the package has reached the recipient:
* `delivery_status` evaluates to `'delivered'`.
* Order status automatically transitions to **Delivered** (`wc-completed`).
* The 28-day commission clearance countdown for the artwork's creator starts immediately.
* Order status note is recorded: `TrackingMore: Package delivered by courier ([NUMBER]). [Latest Event]`.

When `delivery_status` is `'transit'` or `'pickup'`, any order in `processing` or `awaiting-pickup` automatically advances to `shipped`.

---

## 4. Multi-Leg Checkpoint Merging Engine

International shipments (such as POS Indonesia / Goorita to the USA, UK, or Germany) involve two postal networks:
1. **Origin Carrier** (e.g. POS Indonesia): Handles parcel pickup, Bali processing hub, Jakarta international gateway, and outbound flight departure.
2. **Destination Carrier** (e.g. Deutsche Post, USPS, Royal Mail): Handles customs clearance, regional sorting hub, and final doorstep courier delivery.

TrackingMore separates these into `origin_info.trackinfo` and `destination_info.trackinfo`.

### Merging Algorithm (`process_trackingmore_item_update`):
1. **Combine**: Merges all events from `origin_info.trackinfo` and `destination_info.trackinfo`.
2. **De-duplicate**: Uses an MD5 fingerprint of `time + description` to discard duplicate scans reported by both postal systems.
3. **Sort Chronologically Descending**: Sorts newest timestamp first (`$b <=> $a`), ensuring the latest courier milestone is always at index `0`.
4. **Format Standard Checkpoint**:
   ```php
   [
       'time'        => '2026-08-29 12:59:00',
       'description' => 'Sudah Diterima, Kiriman berhasil diserahkan',
       'location'    => 'GERMANY - Germany',
       'stage'       => 'delivered',
   ]
   ```
5. **Persist**: Saves directly to `_artmatter_tracking_checkpoints` across both HPOS and postmeta.

---

## 5. Webhook Push Notifications

To receive immediate delivery notifications without waiting for hourly cron jobs:

### Endpoint URLs
* Primary Route: `https://artmatter.shop/wp-json/artmatter-core/v1/shipping/trackingmore-webhook`
* Legacy Alias: `https://artmatter.shop/wp-json/artmatter-core/v1/shipping/17track-webhook`

### Configuration in TrackingMore Dashboard
1. Log in to [my.trackingmore.com](https://my.trackingmore.com/).
2. Navigate to **Settings** → **Webhook**.
3. Set the Webhook Callback URL to:
   ```
   https://artmatter.shop/wp-json/artmatter-core/v1/shipping/trackingmore-webhook
   ```
4. Select all status events (`Pickup`, `Transit`, `Delivered`, `Exception`).
5. Save settings.

The webhook endpoint accepts JSON payloads, processes single or batch updates, matches orders via HPOS (`wc_orders_meta`) or postmeta, updates checkpoints, and transitions order status.

---

## 6. UI Architecture: Dual-Timeline Separation & Modal Experience

To prevent customer confusion, tracking interfaces distinctly separate internal production from courier delivery:

### A. Top: Workshop Production Stepper
A 6-step progress bar showing fine art manufacturing:
1. **Confirmed** (Payment secured)
2. **In Production** (Giclée printing & FeelForm™ 3D texturing)
3. **Quality Check** (Museum inspection & master sealing)
4. **Ready to Ship** (Packaging & manifest generation)
5. **Shipped** (Transferred to courier)
6. **Delivered** (Doorstep arrival confirmed)

#### Track Line Geometry & Zero Overshoot
* The progress bar connects Circle 1 (*Confirmed*) to Circle 6 (*Delivered*).
* In a 6-stage layout with `padding: 0 10px;` and `54px` stage column widths, Circle 1 center is at `37px` from the left edge (`10px + 54px / 2`), and Circle 6 center is at `37px` from the right edge.
* The grey connecting track is positioned at `left: 37px; right: 37px; height: 2px;`.
* The active green progress line is nested **inside** this track container (`position: absolute; top: 0; left: 0; height: 100%; width: [0..100]%;`).
* When the stage is at 100% (*Delivered*), the green line terminates at `right: 37px`, cleanly concealed under the 28px "Delivered" circle (`z-index: 3`). **Zero line overshoots past 'Delivered'.**

#### Top-Right Status Badge Refinement
* Styled as a quiet-luxury pill matching the `.artmatter-order-status-pill` status palette (`#86efac` soft mint for Delivered/Completed, `#93c5fd` for Shipped, `#e2c08d` for In Production, etc.).
* Enforces `display: inline-flex; align-items: center; justify-content: center; line-height: 1; padding: 5px 8px; border-radius: 9999px; font-weight: 400; font-size: 11px;`.
* Eliminates inherited line-height bloat, ensuring that top/bottom visual spacing is completely equal to left/right spacing (~5–6px all around).

### B. Bottom Card: Courier Shipment Tracking Timeline
A dedicated vertical timeline rendering physical transit:
* **When Checkpoints Exist**:
  * Displays chronological vertical path with green pulse dot for the latest scan.
  * Shows exact timestamp (`M j, Y • H:i`), location, and clean English courier checkpoint description (prioritizing destination scan data).
* **When Checkpoints are Awaiting Carrier Scan**:
  * Completely eliminates deceptive mock milestones.
  * Displays an honest single quiet-luxury notice card (*"Manifest Registered with Carrier"*):
    > Electronic shipping manifest registered with [Carrier]. Initial intake and route checkpoints will appear here once the carrier scans the parcel at their processing hub.
* **Zero External Courier Links**: Outbound `"Courier portal →"` links have been removed across all customer-facing views (`class-order-manager.php`, `thankyou.php`) to preserve customer engagement exclusively within the Artmatter brand ecosystem.

### C. Customer Orders Portal Live Tracking Modal (`[artmatter_orders]`)
* In the customer orders portal, each fulfilled order row features a `Track ->` button alongside `View`.
* Clicking `Track ->` does not redirect the customer away from the page.
* Instead, it opens an interactive modal dialog overlaying the portal:
  * Triggers AJAX action `artmatter_get_order_tracking_timeline`.
  * Auto-syncs live checkpoints with TrackingMore before returning the HTML.
  * Injects the complete 6-stage workshop stepper and live courier timeline into `#artmatter-modal-body-content`.
  * Displays an elegant luxury loading spinner while fetching.
  * Supports real-time status refresh directly inside the modal.
  * Dismissible via close button (`✕`), clicking outside on the blurred backdrop, or pressing the `Escape` key. Background page scrolling is automatically locked while the modal is open.
* The `View` button remains unchanged and navigates directly to full order details.

---

## 7. Brand Voice & Design Constraints

All tracking interfaces strictly enforce the Artmatter luxury design system:

* **Brand Typography**:
  * All tracking views, pills, timestamps, modals, and notices strictly use the brand typography stack:
    ```css
    font-family: "Neue Haas Display", "Neue Haas Grotesk Text Pro", inherit, sans-serif !important;
    ```
  * Raw OS system fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`) are prohibited.
* **Zero Cartoon Emojis**: Never render emojis (`📦`, `🚚`, `🎨`, `✓`, `🛰️`) on user-facing tracking cards. All icons must be pure Lucide SVG vector outlines.
* **Quiet Luxury Tone**:
  * Strictly no exclamation marks (`!`).
  * Regular font weight (`font-weight: 400 !important;`) on all reassurance and status copy.
* **Honest Brand Reassurance**:
  * Zero fake step progression. If a carrier hasn't scanned yet, explain intake truthfully.

---

## 8. Customer Access & Zero-Login Tracking

### Customer Completed Order Email
The email tracking card links directly to the native Artmatter order tracking page:
```php
$billing_email = $order->get_billing_email();
$tracking_url  = add_query_arg( [
    'order_id'    => $order->get_order_number(),
    'order_email' => $billing_email,
    'key'         => $order->get_order_key(),
], home_url( '/track' ) );
```
* Bypasses WordPress account login walls entirely.
* Collectors land directly on `https://artmatter.co/track?order_id=18516&order_email=hi%40artmatter.co` where the shortcode validates credentials and renders the complete dual-timeline immediately.

### Public Tracking Shortcode
* **Shortcodes**: `[artmatter_order_tracking]` and `[artmatter_track_order]`
* Allows any customer to track their shipment using:
  1. **Order Number** (e.g. `18516`)
  2. **Billing Email** (e.g. `customer@example.com`)
* Verifies email match against the WooCommerce order record before rendering details.

### Live Customer Refresh Button
The customer tracking card features a live refresh button (`#artmatter-refresh-tracking-btn`):
* Secured via customer-scoped nonce (`artmatter_customer_tracking_{order_id}`).
* Triggers AJAX action `artmatter_refresh_order_tracking`.
* Animates the Lucide refresh vector icon with a smooth CSS spin and updates checkpoints on the fly.

---

## 9. Admin Operations & 1-Click Diagnostics

### Admin Order Meta Box ("TrackingMore & Logistics")
Rendered on the WooCommerce Order Edit screen (supporting both HPOS and classic CPT):
* Displays assigned Carrier and Monospace Tracking Number.
* Shows live registration dot:
  * `● Registered & Monitored` (Green)
  * `○ Not registered yet` (Orange)
* Displays latest courier checkpoint summary.
* **"Sync with TrackingMore Now" Button**: Triggers `artmatter_admin_sync_trackingmore` AJAX endpoint to re-fetch live scan data on demand.
* **"View Courier Portal" Link**: Direct deep link to the carrier or TrackingMore tracking portal.

### Settings Diagnostics
In **Artmatter Settings** → **Logistics & Carriers**:
* Configure API key and copy Webhook URL.
* **"Test TrackingMore Connection" Button**: Queries `GET /v4/couriers/all` to verify API key validity and quota health without touching production data.

---

## 10. Metadata Schema Reference

The following metadata keys are maintained across HPOS and postmeta:

| Meta Key | Type | Description |
| :--- | :--- | :--- |
| `tracking_number` | `string` | Primary courier tracking number / AirWayBill |
| `carrier_id` | `string` | Carrier slug (e.g. `pos`, `jne`, `dhl`) |
| `_artmatter_trackingmore_registered` | `int` (`1`/`0`) | Flag indicating successful TrackingMore registration |
| `_artmatter_trackingmore_registered_number` | `string` | The exact number registered with TrackingMore |
| `_artmatter_trackingmore_carrier_code` | `string` | Official courier code (e.g. `indonesia-post`) |
| `_artmatter_trackingmore_latest_status` | `string` | Latest status (e.g. `delivered`, `transit`, `pickup`) |
| `_artmatter_trackingmore_error` | `string` | Last API error message (if any) |
| `_artmatter_tracking_checkpoints` | `array` | Chronological list of parsed, de-duplicated checkpoints |
| `_artmatter_17track_*` | *(various)* | Preserved backward-compatibility aliases |
