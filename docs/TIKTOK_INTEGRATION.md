# Exacoat TikTok Shop Open Platform API Integration

Comprehensive architectural and technical reference for the TikTok Shop Open Platform API integration (API version 202309) connecting Exacoat Manager and the Exacoat Core WordPress backend engine.

---

## 1. Architectural Overview

The TikTok Shop integration connects Exacoat operations to the TikTok Shop partner ecosystem across two coordinated tiers:

1. **Frontend Operations UI (manager.exacoat.com)**:
   - React 19 + TypeScript + Vite Single-Page Application.
   - Channel switcher tab in OrdersView.tsx.
   - Dedicated marketplace view (src/components/orders/TikTokOrdersView.tsx).
   - Thermal AWB HTML Generator (src/lib/tiktokAwbGenerator.ts).
   - Partner configuration modal (src/components/settings/TikTokSettingsModal.tsx).
   - Warranty claim linkage in ManualWarrantyModal.tsx.

2. **Backend Engine (exacoat-core/includes/class-tiktok-client.php)**:
   - Embedded inside exacoat-core WordPress plugin.
   - HMAC-SHA256 signature calculation engine.
   - OAuth 2.0 token management with automatic refresh (7-day access token buffer).
   - Order synchronization via /order/202309/orders/search and /order/202309/orders.
   - Localized option cache (_exacoat_tiktok_orders_cache).
   - Package fulfillment router (/fulfillment/202309/packages/{package_id}/ship).
   - Official TikTok shipping document PDF stream (/fulfillment/202309/packages/{package_id}/shipping_documents).
   - Inbound webhook push listener with signature verification.
   - Public warranty claim validation endpoint.

`
+-------------------------------------------------------------+
|               Exacoat Manager (React SPA)                   |
|  - TikTokOrdersView (Sync, Filter, Details, Status)         |
|  - TikTokSettingsModal (Service ID, App Key, Secret)        |
|  - Thermal AWB Printer & Label Streamer                     |
+-------------------------------------------------------------+
                              |
               REST API (Authenticated WP Nonce/JWT)
                              v
+-------------------------------------------------------------+
|             WordPress Core (exacoat-core Plugin)            |
|  Class: Exacoat_TikTok_Client                               |
|  - HMAC-SHA256 Signing Engine                               |
|  - OAuth 2.0 Token Storage & Auto-Refresh                   |
|  - Cached Order Store (_exacoat_tiktok_orders_cache)        |
|  - Webhook Receiver: /wp-json/exacoat-core/v1/tiktok/webhook|
|  - Warranty Verifier against WooCommerce _marketplace_inv   |
+-------------------------------------------------------------+
                              |
                     HTTPS + HMAC-SHA256
                              v
+-------------------------------------------------------------+
|                 TikTok Shop Open Platform                   |
|  - Auth: auth.tiktok-shops.com                              |
|  - API: open-api.tiktokglobalshop.com                       |
|  - Partner Service ID: 7686433028542351124                  |
+-------------------------------------------------------------+
`

---

## 2. Environments and Credentials

TikTok Shop uses Partner Center Service ID 7686433028542351124:

| Setting | Value / Target | Notes |
| :--- | :--- | :--- |
| **Service ID** | 7686433028542351124 | Registered in TikTok Shop Partner Center |
| **Auth Base URL** | https://auth.tiktok-shops.com | OAuth token exchange & refresh |
| **API Base URL** | https://open-api.tiktokglobalshop.com | Global Shop Open API v2 |
| **Partner Auth URL**| https://services.tiktokshop.com/open/authorize | Seller consent authorization portal |
| **App Key** | Stored in _exacoat_tiktok_settings | From Partner Center app details |
| **App Secret** | Stored in _exacoat_tiktok_settings | Private HMAC signing key |
| **Shop Cipher** | Stored in _exacoat_tiktok_settings | Store identifier / cipher string |
| **Redirect URL** | https://manager.exacoat.com/tiktok/callback | OAuth redirect destination |
| **Webhook URL** | https://exacoat.com/wp-json/exacoat-core/v1/tiktok/webhook | Receives order and fulfillment pushes |

Configuration data is stored in WordPress wp_options under key _exacoat_tiktok_settings.

---

## 3. Cryptographic Signature Rules (HMAC-SHA256)

TikTok Shop Open Platform requires signing every API request using HMAC-SHA256 with `app_secret` as the key.

### Signature Algorithm Steps
1. Gather all URL query parameters excluding `sign` and `access_token`.
2. Sort parameter keys in ascending ASCII alphabetical order.
3. Concatenate each key and value: `key1value1key2value2...`
4. Construct the base message string:
   ```text
   base_string = app_secret + api_path + sorted_query_string + request_body + app_secret
   ```
   *Note: For GET requests or empty bodies, request_body is an empty string.*
5. Calculate the HMAC-SHA256 digest:
   ```php
   $sign = hash_hmac('sha256', $base_string, $app_secret);
   ```
6. Send the resulting hex string as query parameter `sign`.
7. Pass `access_token` in the HTTP header `x-tts-access-token`.

---

## 4. Authentication, Permissions, and Token Lifecycle

### 4.1 Required Scopes in TikTok Shop Partner Center
Every endpoint in TikTok Shop Open API 202309 requires specific OAuth scopes. If any scope is missing, the API rejects the request with:
`Access denied. This app has not been granted any access scope required by this endpoint.`

Configure the following scopes in TikTok Shop Partner Center (`https://partner.tiktokshop.com` > **App & Service** > **My Services / Custom App** > **Permissions / Manage API**):

| Scope Identifier | Required For Endpoint | Description |
| :--- | :--- | :--- |
| **`seller.authorization.info`** | `GET /authorization/202309/shops` | Discovers authorized shops and extracts the required `shop_cipher`. |
| **`seller.order.info`** | `POST /order/202309/orders/search`<br>`GET /order/202309/orders` | Searches orders, fetches line items, customer details, and order status. |
| **`seller.fulfillment.basic`** | `POST /fulfillment/202309/packages/{id}/ship`<br>`GET /fulfillment/202309/packages/{id}/shipping_documents` | Ships packages, assigns couriers, and downloads official A6 thermal PDF labels. |
| **`seller.product.basic`** *(Optional)* | `GET /product/202309/products` | Cross-references SKU codes and variation attributes. |

### 4.2 Resolving "Access denied. This app has not been granted any access scope"
When you see this error during order sync or shop detection:

1. **Add Scopes in Partner Center**:
   - Log into https://partner.tiktokshop.com
   - Navigate to **App & Service** > Select your App (Service ID `7686433028542351124`, App Key `6lauu7vv75n01`).
   - Go to **Permissions** / **Manage API** / **Categories**.
   - Enable **Shop Authorization** (`seller.authorization.info`), **Order Management** (`seller.order.info`), and **Fulfillment** (`seller.fulfillment.basic`).
   - Click **Save** / **Submit**.

2. **Re-Authorize the Seller Account (Mandatory)**:
   - Adding scopes to an app does not update existing tokens. A new token must be issued with seller consent.
   - Open Exacoat Manager: **Orders > TikTok Shop > Settings** (or click the Settings button).
   - Click **Connect TikTok Shop** (or **Re-Authorize**).
   - Sign in with your Exacoat TikTok Shop seller account.
   - You will see the new permissions requested. Click **Authorize**.

3. **Auto-Discovery of Shop Cipher**:
   - Upon completing authorization, Exacoat automatically calls `GET /authorization/202309/shops` with the newly scoped token.
   - The official `shop_cipher` (e.g. `ROW_...`) is automatically retrieved and saved to WordPress database.
   - Click **Sync Orders** to pull live orders immediately.

### 4.3 Token Lifecycle and Auto-Refresh
1. **Authorization Code Exchange**:
   - TikTok redirects to the callback with query parameter `code`.
   - Backend calls `GET https://auth.tiktok-shops.com/api/v2/token/get` with `app_key`, `app_secret`, and `auth_code`.
   - Returns `access_token` (valid 7 days) and `refresh_token` (valid 30 days).
2. **Auto-Refresh Routine**:
   - Before any Open API request, `ensure_valid_token()` checks if `token_expires_at <= time() + 3600` (1-hour safety buffer).
   - When renewal is required, it automatically calls `GET https://auth.tiktok-shops.com/api/v2/token/refresh` with `grant_type=refresh_token`, saves the new token to options, and proceeds seamlessly without interrupting work.

---

## 5. Core Operational Endpoints

### 5.1 Order Synchronization
- **Search Orders**:
  - POST /order/202309/orders/search
  - Body contains pagination (page_size: 50) and optional status filters (AWAITING_SHIPMENT, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED).
  - Retrieves order IDs and status metadata.
- **Batch Order Details**:
  - GET /order/202309/orders?ids={id1,id2}
  - Fetches product SKUs, variations, recipient addresses, buyer contact details, and assigned shipping provider.
- **Cache Persistence**:
  - Stored in _exacoat_tiktok_orders_cache for instant rendering in Exacoat Manager.

### 5.2 Logistics and Shipment Arrangement
- **Ship Package**:
  - POST /fulfillment/202309/packages/{package_id}/ship
  - Updates order status to AWAITING_COLLECTION or IN_TRANSIT.
  - Captures courier tracking number (resi) and writes to order cache.

### 5.3 Shipping Labels (Air Waybill / AWB)
- **Official Shipping Document**:
  - GET /fulfillment/202309/packages/{package_id}/shipping_documents?document_type=SL&document_size=A6
  - Retrieves official doc_url (PDF) generated by TikTok logistics.
  - Exacoat Core proxies this PDF directly to the browser for instant printing on 100x150mm thermal printers.
- **Client-Side Thermal HTML Generator (	iktokAwbGenerator.ts)**:
  - Offline and staging fallback rendering standard A6 shipping labels with Code128 barcodes for Order ID and Tracking Number.

---

## 6. Real-Time Webhook Push Notifications

The endpoint /wp-json/exacoat-core/v1/tiktok/webhook receives push notifications from TikTok Shop:

| Event Name | Description | Action in Exacoat |
| :--- | :--- | :--- |
| ORDER_STATUS_CHANGE | Buyer paid, order awaiting shipment, delivered, cancelled | Updates cached order_status |
| PACKAGE_UPDATE | Courier tracking assigned or updated | Updates 	racking_number |
| REVERSE_STATUS_CHANGE| Buyer requested return or refund | Flags order for admin attention |

All received webhooks are acknowledged with HTTP 200 and body {"code": 0, "message": "success"} within 2 seconds.

---

## 7. Warranty Claim Linkage

When an agent enters a TikTok invoice in ManualWarrantyModal.tsx or a customer uses the warranty form:
1. System checks _marketplace_invoice = {order_id} in WooCommerce orders.
2. If already claimed, rejects duplicate replacement and displays the previous replacement order number.
3. If valid, pulls purchased skin configurations from _exacoat_tiktok_orders_cache and pre-populates customer details for immediate one-click warranty fulfillment.
