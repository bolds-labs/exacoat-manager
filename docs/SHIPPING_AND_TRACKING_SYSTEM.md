# Exacoat Shipping, Logistics & Tracking Architecture Reference

> **Purpose**: This document serves as the permanent system architecture reference for the **Exacoat Shipping, Logistics, Courier Tracking, and Automated Delivery Detection Engine**. Any developer or AI agent modifying fulfillment, courier integration, tracking numbers, or order status progression must adhere to the patterns and contracts documented here.

---

## 1. Architecture Overview

Exacoat's logistics layer consolidates order fulfillment across local Indonesian logistics (Biteship, JNE, SiCepat, POS Indonesia) and international export couriers (Goorita USA, DHL Express, FedEx, Deutsche Post).

The system decouples internal production status from external courier parcel progress:
* **Internal Workshop Timeline**: Tracks vinyl skin production through 6 stages (*Confirmed -> In Production -> Quality Check -> Ready to Ship -> Shipped -> Delivered*).
* **Courier Shipment Tracking Timeline**: Tracks physical transit checkpoints reported by carriers via the **TrackingMore API v4** engine.

```
[ WooCommerce / ACF / HPOS Order ]
             │
             ▼ (Order marked Shipped or Tracking # entered)
[ Exacoat_Shipping_Tracker::handle_order_save() ]
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
         [ Store in _exacoat_tracking_checkpoints ]
                          │
                          ▼
        [ Webhook / Polling: Delivery Scan Received ]
                          │
                          ▼
[ Transition Order to 'completed' (Delivered) ]
```

---

## 2. Carrier Integration & TrackingMore v4

### Why TrackingMore?
* **Zero Ongoing Cost**: TrackingMore provides a permanent free plan with **50 tracked shipments/month**, perfectly sized for volume without recurring overhead.
* **Modern REST v4 API**: Fast JSON endpoints with unified carrier detection and multi-language checkpoint translation.

### API Credentials & Header Auth
* **API Key**: Managed in Exacoat Settings (`exacoat_core_settings[trackingmore_api_key]`).
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
If a carrier is unspecified or set to "auto", `Exacoat_Shipping_Tracker::detect_trackingmore_courier()` queries `POST https://api.trackingmore.com/v4/couriers/detect` with the tracking number to identify the courier before registration.

---

## 3. End-to-End Tracking Lifecycle & Automated Delivery

### 1. Registration
When an order is updated with a tracking number in WooCommerce Admin (HPOS, classic postmeta, or ACF), `handle_order_save()` triggers `register_with_trackingmore()`:
* Sends `POST /v4/trackings/create`.
* Both HTTP 200 (`meta.code: 200`) and Duplicate Shipment (`meta.code: 4101` - *"Tracking No. already exists"*) are treated as successful states.
* Flags order as registered (`_exacoat_trackingmore_registered = 1`).

### 2. Live Synchronization
`sync_order_tracking( $order_id )`:
* Calls `GET https://api.trackingmore.com/v4/trackings/get?tracking_numbers=[NUMBER]`.
* If not yet registered in TrackingMore, it automatically executes registration and retries retrieval.

### 3. Automated Delivery Transition
When TrackingMore detects that the package has reached the recipient:
* `delivery_status` evaluates to `'delivered'`.
* Order status automatically transitions to **Delivered** (`wc-completed`).
* Order status note is recorded: `TrackingMore: Package delivered by courier ([NUMBER]). [Latest Event]`.

When `delivery_status` is `'transit'` or `'pickup'`, any order in `processing` or `awaiting-pickup` automatically advances to `shipped`.

---

## 4. Multi-Leg Checkpoint Merging Engine

International shipments (such as POS Indonesia / Goorita to the USA, UK, or Germany) involve two postal networks:
1. **Origin Carrier** (e.g. POS Indonesia): Handles parcel pickup, regional processing hub, Jakarta international gateway, and outbound flight departure.
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
       'description' => 'Delivered to recipient',
       'location'    => 'GERMANY',
       'stage'       => 'delivered',
   ]
   ```
5. **Persist**: Saves directly to `_exacoat_tracking_checkpoints` across both HPOS and postmeta.

---

## 5. Webhook Push Notifications

To receive immediate delivery notifications without waiting for hourly cron jobs:

### Endpoint URLs
* Primary Route: `https://staging.exacoat.com/wp-json/exacoat-core/v1/shipping/trackingmore-webhook`
* Production Route: `https://exacoat.com/wp-json/exacoat-core/v1/shipping/trackingmore-webhook`

### Configuration in TrackingMore Dashboard
1. Log in to [my.trackingmore.com](https://my.trackingmore.com/).
2. Navigate to **Settings** -> **Webhook**.
3. Set the Webhook Callback URL to your live webhook endpoint.
4. Select all status events (`Pickup`, `Transit`, `Delivered`, `Exception`).
5. Save settings.

The webhook endpoint accepts JSON payloads, processes single or batch updates, matches orders via HPOS (`wc_orders_meta`) or postmeta, updates checkpoints, and transitions order status.

---

## 6. UI Architecture: Dual-Timeline Separation & Modal Experience

To prevent customer confusion, tracking interfaces distinctly separate internal production from courier delivery:

### A. Top: Workshop Production Stepper
A 6-step progress bar showing skin manufacturing:
1. **Confirmed** (Payment secured)
2. **In Production** (Precision cutting and preparation)
3. **Quality Check** (Inspection and verification)
4. **Ready to Ship** (Packaging and label generated)
5. **Shipped** (Transferred to courier)
6. **Delivered** (Doorstep arrival confirmed)

#### Track Line Geometry & Zero Overshoot
* The progress bar connects Circle 1 (*Confirmed*) to Circle 6 (*Delivered*).
* In a 6-stage layout with `padding: 0 10px;` and `54px` stage column widths, Circle 1 center is at `37px` from the left edge (`10px + 54px / 2`), and Circle 6 center is at `37px` from the right edge.
* The grey connecting track is positioned at `left: 37px; right: 37px; height: 2px;`.
* The active progress line is nested **inside** this track container (`position: absolute; top: 0; left: 0; height: 100%; width: [0..100]%;`).
* When the stage is at 100% (*Delivered*), the line terminates at `right: 37px`, cleanly concealed under the 28px "Delivered" circle (`z-index: 3`). **Zero line overshoots past 'Delivered'.**

#### Top-Right Status Badge Refinement
* Styled as a pill matching the status palette (`#86efac` soft mint for Delivered/Completed, `#93c5fd` for Shipped, `#e2c08d` for In Production, etc.).
* Enforces `display: inline-flex; align-items: center; justify-content: center; line-height: 1; padding: 5px 8px; border-radius: 9999px; font-weight: 400; font-size: 11px;`.

### B. Bottom Card: Courier Shipment Tracking Timeline
A dedicated vertical timeline rendering physical transit:
* **When Checkpoints Exist**:
  * Displays chronological vertical path with green pulse dot for the latest scan.
  * Shows exact timestamp (`M j, Y - H:i`), location, and clean English courier checkpoint description.
* **When Checkpoints are Awaiting Carrier Scan**:
  * Displays a notice card (*"Manifest Registered with Carrier"*):
    > Electronic shipping manifest registered with carrier. Initial intake and route checkpoints will appear here once the carrier scans the parcel at their processing hub.
* **Zero External Courier Links**: Outbound links are removed across customer views to keep users within Exacoat.

### C. Customer Orders Portal Live Tracking Modal
* In the customer orders portal, each fulfilled order row features a `Track ->` button alongside `View`.
* Clicking `Track ->` opens an interactive modal dialog overlaying the portal:
  * Triggers AJAX action `exacoat_get_order_tracking_timeline`.
  * Auto-syncs live checkpoints with TrackingMore before returning the HTML.
  * Injects the complete 6-stage workshop stepper and live courier timeline into the modal container.
  * Dismissible via close button (`x`), clicking outside on the blurred backdrop, or pressing the `Escape` key.

---

## 7. Customer Access & Zero-Login Tracking

### Customer Completed Order Email
The email tracking card links directly to the Exacoat order tracking page:
```php
$billing_email = $order->get_billing_email();
$tracking_url  = add_query_arg( [
    'order_id'    => $order->get_order_number(),
    'order_email' => $billing_email,
    'key'         => $order->get_order_key(),
], home_url( '/track' ) );
```
* Bypasses WordPress account login walls entirely.
* Customers land directly on the tracking page where the shortcode validates credentials and renders the complete dual-timeline immediately.

### Public Tracking Shortcode
* **Shortcodes**: `[exacoat_order_tracking]` and `[exacoat_track_order]` (with legacy aliases supported)
* Allows any customer to track their shipment using:
  1. **Order Number** (e.g. `18516`)
  2. **Billing Email** (e.g. `customer@example.com`)
* Verifies email match against the WooCommerce order record before rendering details.

### Live Customer Refresh Button
The customer tracking card features a live refresh button (`#exacoat-refresh-tracking-btn`):
* Secured via customer-scoped nonce (`exacoat_customer_tracking_{order_id}`).
* Triggers AJAX action `exacoat_refresh_order_tracking`.
* Updates checkpoints on the fly.

---

## 8. Admin Operations & 1-Click Diagnostics

### Admin Order Meta Box ("Tracking & Logistics")
Rendered on the WooCommerce Order Edit screen (supporting both HPOS and classic CPT):
* Displays assigned Carrier and Monospace Tracking Number.
* Shows live registration dot:
  * `● Registered & Monitored` (Green)
  * `○ Not registered yet` (Orange)
* Displays latest courier checkpoint summary.
* **"Sync with TrackingMore Now" Button**: Triggers `exacoat_admin_sync_trackingmore` AJAX endpoint to re-fetch live scan data on demand.

### Settings Diagnostics
In **Exacoat Settings** -> **Logistics & Carriers**:
* Configure API key and copy Webhook URL.
* **"Test Tracking Connection" Button**: Queries `GET /v4/couriers/all` to verify API key validity and quota health.

---

## 9. Metadata Schema Reference

The following metadata keys are maintained across HPOS and postmeta:

| Meta Key | Type | Description |
| :--- | :--- | :--- |
| `tracking_number` | `string` | Primary courier tracking number / AirWayBill |
| `carrier_id` | `string` | Carrier slug (e.g. `pos`, `jne`, `dhl`) |
| `_exacoat_trackingmore_registered` | `int` (`1`/`0`) | Flag indicating successful TrackingMore registration |
| `_exacoat_trackingmore_registered_number` | `string` | The exact number registered with TrackingMore |
| `_exacoat_trackingmore_carrier_code` | `string` | Official courier code (e.g. `indonesia-post`) |
| `_exacoat_trackingmore_latest_status` | `string` | Latest status (e.g. `delivered`, `transit`, `pickup`) |
| `_exacoat_trackingmore_error` | `string` | Last API error message (if any) |
| `_exacoat_tracking_checkpoints` | `array` | Chronological list of parsed, de-duplicated checkpoints |
| `_artmatter_tracking_*` | *(various)* | Preserved backward-compatibility fallback readers |

---

## 10. Multi-Zone Free Shipping Threshold Architecture

Exacoat employs a decoupled, zone-tiered free shipping engine that calculates free shipping eligibility independently of WooCommerce shipping zones.

### The 3 Official Shipping Zones
Exacoat operations maintain three standard delivery regions:
1. **Indonesia (`indonesia`)**: Country `ID`, Currency `IDR`, Default Free Shipping Threshold: `IDR 300,000`.
2. **United States (`united_states`)**: Country `US`, Currency `USD`, Default Free Shipping Threshold: `USD 30`.
3. **Default / Rest of World (`default`)**: Country `*`, Currency `USD`, Default Free Shipping Threshold: `USD 50`.

### Decoupled Country-Level Evaluation
* **WooCommerce Zone Independence**: The free shipping discount engine (`Exacoat_Store_Enhancements::apply_zone_tiered_shipping_discount()`) inspects the cart package destination country directly (`$package['destination']['country']`).
* It does **not** depend on whether a separate WooCommerce shipping zone exists for that destination.
* **Adding Specific Regions (e.g. Singapore / SG)**:
  * When an operator adds a region with key `singapore`, country `SG`, currency `SGD`, and threshold `30`, any customer shipping to Singapore will immediately see and be evaluated against the exact threshold of `SGD 30`.
  * Because the country (`SG`) and currency (`SGD`) match the explicit zone definition, the checkout engine avoids conversion rate decimals and applies the clean number directly.
  * For countries without an explicit zone, the fallback `*` zone is used, and the threshold is dynamically converted to the active currency via exchange rates if needed.

### Settings Persistence & Options Synchronization
* **Settings Page Tab Persistence**: When saving settings in WordPress admin, the active tab (`data-pane`) is stored in `sessionStorage` and URL hash (`#shipping`), preserving the active view across form POST redirects.
* **Non-Blocking Form Submission**: Save buttons defer disabling via `setTimeout` during the submit event, preventing browser HTTP request cancellation.
* **Single Form Hierarchy Invariant**: All shipping zone rows explicitly declare `form="exacoatSettingsForm"` to ensure full payload submission without browser nesting cancellation.
