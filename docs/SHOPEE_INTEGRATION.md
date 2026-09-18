# Exacoat Shopee Open Platform API v2 Integration

Comprehensive architectural and technical reference for the Shopee Open Platform API v2 integration connecting Exacoat Manager and the Exacoat Core WordPress backend engine.

---

## 1. Architectural Overview

The Shopee integration connects the Exacoat operations team to the Shopee marketplace ecosystem across two operational layers:

1. **Frontend Operations UI (manager.exacoat.com)**:
   - Single-Page Application (React 19 + TypeScript + Vite).
   - Dedicated marketplace view (src/components/orders/ShopeeOrdersView.tsx).
   - Thermal Shipping Label generator (src/lib/shopeeAwbGenerator.ts).
   - Shipment arrangement modal (src/components/orders/ArrangeShipmentModal.tsx).
   - Partner and Shop settings configuration modal (src/components/settings/ShopeeSettingsModal.tsx).
   - Manual warranty claim linkage (src/components/orders/ManualWarrantyModal.tsx).

2. **Backend Engine (exacoat-core/includes/class-shopee-client.php)**:
   - Resides inside the WordPress/WooCommerce plugin (exacoat-core).
   - Cryptographic signing engine (HMAC-SHA256).
   - OAuth 2.0 token lifecycle manager with auto-refresh (4-hour expiration buffer).
   - Order retrieval, batch item expansion, and localized option cache (_exacoat_shopee_orders_cache).
   - Logistics fulfillment router (dropoff vs pickup, tracking code extraction).
   - Official Shopee thermal PDF proxy.
   - Incoming webhook push event listener with signature verification.
   - Public warranty claim validation endpoint.

`
+-------------------------------------------------------------+
|               Exacoat Manager (React SPA)                   |
|  - ShopeeOrdersView (Sync, Filter, Details, Status)         |
|  - ArrangeShipmentModal (Dropoff / Pickup)                  |
|  - ShopeeSettingsModal (Partner ID, Keys, Sandbox/Live)     |
|  - Thermal AWB Printer & Label Renderer                     |
+-------------------------------------------------------------+
                              |
               REST API (Authenticated WP Nonce/JWT)
                              v
+-------------------------------------------------------------+
|             WordPress Core (exacoat-core Plugin)            |
|  Class: Exacoat_Shopee_Client                               |
|  - HMAC-SHA256 Signing Engine                               |
|  - OAuth 2.0 Token Storage & Auto-Refresh                   |
|  - Cached Order Store (_exacoat_shopee_orders_cache)        |
|  - Webhook Receiver: /wp-json/exacoat-core/v1/shopee/webhook|
|  - Warranty Verifier against WooCommerce _marketplace_inv   |
+-------------------------------------------------------------+
                              |
                     HTTPS + HMAC-SHA256
                              v
+-------------------------------------------------------------+
|                 Shopee Open Platform API v2                 |
|  - Sandbox: partner.test-stable.shopeemobile.com            |
|  - Production: partner.shopeemobile.com                     |
+-------------------------------------------------------------+
`

---

## 2. Environments and Credentials

Shopee separates development and live operations into distinct endpoints and partner credentials:

| Setting | Sandbox (Test-Stable) | Production (Live) |
| :--- | :--- | :--- |
| **Base URL** | https://partner.test-stable.shopeemobile.com | https://partner.shopeemobile.com |
| **Partner ID** | Stored in 	est_partner_id (Default: 1244885) | Stored in live_partner_id (Default: 2011551) |
| **Partner Key** | Stored in 	est_partner_key | Stored in live_partner_key |
| **Push Partner Key** | Stored in 	est_push_partner_key | Stored in live_push_partner_key |
| **Default Shop ID** | 227918647 (Sandbox Exacoat ID) | Configured upon seller authorization |
| **Redirect URL** | https://manager.exacoat.com/shopee/callback | Configured in Shopee Partner Console |
| **Push Webhook URL** | https://exacoat.com/wp-json/exacoat-core/v1/shopee/webhook | Same public HTTPS URL |

Configuration data is stored in the WordPress wp_options table under key _exacoat_shopee_settings.

---

## 3. Cryptographic Signature Rules (HMAC-SHA256)

Shopee Open Platform API v2 rejects any request lacking an exact HMAC-SHA256 signature calculated with the active partner_key.

### A. Public API Endpoints
Used for authorization URLs and initial token exchange where no ccess_token exists yet:
- Example paths: /api/v2/shop/auth_partner, /api/v2/auth/token/get
- **Base String**:
  `
  base_string = partner_id + path + timestamp
  `
- **Signature**:
  `php
   = hash_hmac('sha256', , );
  `

### B. Shop API Endpoints
Used for all authenticated store operations (orders, logistics, fulfillment):
- Example paths: /api/v2/order/get_order_list, /api/v2/logistics/ship_order
- **Base String**:
  `
  base_string = partner_id + path + timestamp + access_token + shop_id
  `
- **Signature**:
  `php
   = hash_hmac('sha256', , );
  `

### C. Push Webhook Event Verification
When Shopee pushes an event to /shopee/webhook, the Authorization header contains the signature:
- **Base String**:
  `
  base_string = full_request_url + "|" + raw_request_body
  `
- **Verification**:
  `php
   = hash_hmac('sha256', , );
   = hash_equals(strtolower(), strtolower());
  `

---

## 4. Authentication and Token Lifecycle

1. **Authorization URL Generation**:
   - User clicks "Connect Shopee Store" in ShopeeSettingsModal.tsx.
   - Frontend calls GET /wp-json/exacoat-core/v1/shopee/auth-url.
   - Backend constructs signed redirect to https://partner.shopeemobile.com/api/v2/shop/auth_partner.
2. **Seller Consent & Callback**:
   - The seller logs into Shopee Seller Centre and grants permissions.
   - Shopee redirects the seller browser to https://manager.exacoat.com/shopee/callback?code=...&shop_id=....
   - The callback exchanges the one-time code via POST /api/v2/auth/token/get.
3. **Token Storage**:
   - Response provides ccess_token (valid 4 hours / 14,400s) and efresh_token (valid 30 days).
   - Saved with timestamp 	oken_expires_at = time() + expire_in.
4. **Transparent Auto-Refresh**:
   - Prior to executing any Shop API call, ensure_valid_token() checks if 	oken_expires_at <= time() + 300 (5-minute safety threshold).
   - If expiring soon, it automatically calls POST /api/v2/auth/access_token/get using the efresh_token, updates database options, and proceeds without interrupting the user.

---

## 5. Core Operational Endpoints

### 5.1 Orders Retrieval and Synchronization
- **Endpoint**: POST /wp-json/exacoat-core/v1/shopee/sync
- **Underlying Shopee APIs**:
  1. GET /api/v2/order/get_order_list:
     - Queries 	ime_range_field=create_time over specified window (default 15 days).
     - Returns batch of order_sn identifiers (up to 50 per page).
  2. GET /api/v2/order/get_order_detail:
     - Queries full details for the retrieved order_sn_list in a single batch request.
     - Fetches buyer details, items, recipient address, shipping carrier, and package metadata.
- **Normalization**:
  - Raw Shopee items are normalized into consistent objects: item_id, item_name, model_name, quantity, price.
  - Stored in _exacoat_shopee_orders_cache for instant sub-millisecond retrieval by the React frontend.

### 5.2 Logistics and Shipment Arrangement
- **Retrieve Shipping Parameters**:
  - GET /wp-json/exacoat-core/v1/shopee/shipping-parameter?order_sn={order_sn}
  - Under the hood: GET /api/v2/logistics/get_shipping_parameter
  - Returns eligible courier options: Dropoff branch list or pickup address time slots.
- **Arrange Shipment (Atur Pengiriman)**:
  - POST /wp-json/exacoat-core/v1/shopee/ship-order
  - Under the hood: POST /api/v2/logistics/ship_order with payload {"dropoff": ...} or {"pickup": ...}.
  - Automatically fetches tracking number via GET /api/v2/logistics/get_tracking_number.
  - Updates local order cache status to PROCESSED and persists tracking number immediately.

### 5.3 Shipping Labels (Air Waybill / AWB)
- **Official Shopee PDF Stream**:
  - GET /wp-json/exacoat-core/v1/shopee/shipping-document?order_sn={order_sn}
  - Initiates POST /api/v2/logistics/create_shipping_document (THERMAL_AIR_WAYBILL).
  - Calls POST /api/v2/logistics/download_shipping_document.
  - Streams pure binary PDF directly with header Content-Type: application/pdf.
- **Client-side Thermal HTML Generator (shopeeAwbGenerator.ts)**:
  - When offline, testing in sandbox, or when an instant browser print is preferred:
  - Generates standard 100mm x 150mm thermal AWB with Code128 barcodes for Order SN and Tracking Number.
  - Formats shipping carrier, delivery routing code, item breakdown, and recipient contact.

---

## 6. Real-time Webhook Push Notifications

The endpoint /wp-json/exacoat-core/v1/shopee/webhook receives push event notifications from Shopee Open Platform:

| Event Code | Event Name | Action Taken in Exacoat |
| :--- | :--- | :--- |
| 3 | order_status_push | Updates order_status in cache (e.g. READY_TO_SHIP, SHIPPED, COMPLETED, CANCELLED). |
| 4 | order_trackingno_push | Updates courier 	racking_number (resi) in cache. |
| 30 | package_fulfillment_status_push | Updates ulfillment_status and package tracking. |
| 1 | shop_authorization_push | Logs store authorization event. |
| 2 | shop_authorization_canceled_push| Logs store revocation event and alerts administrators. |

All received webhooks respond with HTTP 200 and body {"code": 0, "message": "success"} within Shopee SLA.

---

## 7. Warranty Claim Verification Flow

When a customer submits a replacement claim on https://exacoat.com/warranty or an agent enters an invoice in ManualWarrantyModal.tsx:

1. Request sent to GET /wp-json/exacoat-core/v1/shopee/verify-order?order_sn={invoice}.
2. System checks WooCommerce database for existing orders with meta key _marketplace_invoice = {order_sn}:
   - If already claimed: Rejects claim and provides existing WooCommerce order ID and claim type (Warranty vs Redeem).
3. If not claimed:
   - Checks _exacoat_shopee_orders_cache for order line items, purchase date, and buyer details.
   - If present, auto-populates skin products in the warranty claim UI for single-click replacement processing.
