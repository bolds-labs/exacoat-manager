# Exacoat Warranty & RMA Review System (Manager Reference)

> **Authoritative Technical Reference** for Exacoat Manager's warranty review workstation and `exacoat-core` warranty engine.

---

## 1. REST Endpoints (`class-warranty-manager.php`)

* **`POST /wp-json/exacoat/v1/warranty/check-invoice`**:
  - Checks if an invoice or order number has already been claimed.
  - Queries `_rma_original_invoice`, `_rma_original_order_id`, and `_rma_original_order_number`.
  - **Critical**: In classic WooCommerce CPT mode (`shop_order`), post statuses must be queried with `wc-` prefix (`wc-pending`, `wc-on-hold`, `wc-processing`, `wc-completed`).
* **`POST /wp-json/exacoat/v1/warranty/upload-proof`**:
  - Handles customer video uploads (max 100MB).
  - Accepts alphanumeric marketplace invoice IDs (e.g. `260918CXA4DDTX`).
  - Stores files in `wp-content/uploads/warranty/`.
* **`GET /wp-json/exacoat/v1/warranty/claim-details?order_id={id}`**:
  - Returns complete claim metadata, customer information, original order ref, replacement items, and video proof URL.
* **`POST /wp-json/exacoat/v1/warranty/review-claim`**:
  - Accepts `action` (`'approve'` | `'reject'`) and optional `rejection_reason`.
  - Sets `_rma_status` to `approved` or `rejected`.
  - **Disk Purge**: Immediately calls `unlink()` on the physical video proof file to reclaim disk storage.
  - Adds private audit note to the replacement order.

---

## 2. Exacoat Manager UI (`src/components/orders/WarrantyReviewModal.tsx`)

* **Video Playback**:
  - Relative URLs like `/uploads/warranty/...` are normalized to `https://exacoat.com/uploads/...`.
  - Embedded HTML5 `<video controls playsInline />` player.
  - "Open Video in New Tab" link for fullscreen verification of the 5-piece cut skin.
  - If video has been purged post-review, displays a badge: *"Video proof deleted from server disk"*.
* **Title Sanitization**:
  - Item names in the replacement items list are sanitized using `cleanItemTitle(name)` to strip `[EXACOAT]`.
* **Approval / Rejection Workflow**:
  - Approve: Transitions replacement order to processing for production.
  - Reject: Prompts for rejection reason (e.g. *"skin not cut into 5 pieces"*) and updates order status.

---

## 3. Shipping Payment & Unique Code Architecture

* **Order Creation & Unique Code Attachment**:
  - When a customer submits a claim with delivery shipping, the replacement order is generated with `payment_method = 'bacs'`, `_bca_unique_code = code`, and `fee_lines: [{ name: 'Unique Payment Code', total: String(uniqueCode), tax_status: 'none' }]`.
  - In WooCommerce, `meta_data` alone does not alter `order.total`. Attaching the unique code in `fee_lines` guarantees `order.total` matches `shipping_total + uniqueCode` (e.g. Rp 10.029) from the moment of order generation.
* **Customer Pay Portal (`/pay/[id]`)**:
  - Shows exact courier options and payment method selector (Midtrans vs Bank BCA).
  - Top header card displays `activeTab === 'bca' ? totalWithCode : shippingCost`.
  - Switching tabs to Midtrans automatically zeroes the unique code fee line (`total: "0"`), updating order total to pure shipping cost for card/QRIS gateways.
  - Switching tabs to Bank BCA restores the unique code fee line and total.
* **Automated BCA Webhook Reconciliation (`class-bca-payment-webhook.php`)**:
  - Automated bank mutation listener matches against `(int) round( (float) $order->get_total() )`.
  - Because `order.total` is accurately set to `shipping_total + uniqueCode`, the bank mutation matches cleanly and automatically transitions the warranty order to `processing` for fulfillment.

---

## 4. Marketplace Warranty Claim Contact & Destination Address Invariant

* **The Problem**:
  - Marketplace Open Platform APIs (Shopee and TikTok Shop) mask customer personal data after delivery to protect buyer privacy (e.g. `recipient_name: "A******a"`, `recipient_phone: "******5711"`, `recipient_address: "Jl. Bunga ******"`).
  - TikTok Shop sets `buyer_username` to proxy emails like `v4bG3X6BRS7WXONMNVJMD5NX5XU2I@scs2.tiktok.com`, and Shopee sets it to account usernames like `agniamarth`.
  - Previously, eligibility check endpoints returned these proxy strings or usernames as `shipping_address`, pre-filling form inputs and tricking customers or overwriting what they typed when applying warranty codes. Furthermore, missing emails defaulted to internal dummy formats (`@marketplace.internal`).
* **The Invariant**:
  - For marketplace orders (Shopee, TikTok Shop), the eligibility check endpoints (`/warranty/check-eligibility`, `check_shopee_eligibility`, `check_tiktok_eligibility`) must strip masked asterisks (`*`), proxy emails, and usernames from `shipping_address`, returning clean empty strings.
  - The frontend warranty wizard (`warranty-claim-wizard.tsx`) sanitizes eligibility address data and must NEVER overwrite user-typed inputs in `marketplaceAddress` during initial check or warranty extension code redemption (`handleApplyWarrantyCode`).
  - Step 5 and the submission API (`handleSubmitClaim` in `app/api/warranty/[action]/route.ts`) strictly enforce:
    1. **Recipient Name**: Real name without `@`, without `*`, at least 2 characters (rejecting marketplace usernames).
    2. **Phone Number**: Real active number without `*`, at least 9 numeric digits.
    3. **Email**: Real active personal email (rejecting `@marketplace.internal` and `@scs2.tiktok.com`).
    4. **Destination Address**: Complete street address without `*`, at least 10 characters, with 5-digit postal code.
  - User-inputted values are assigned directly to WooCommerce `billing` and `shipping` objects and persisted in metadata (`_customer_name`, `_customer_phone`, `_customer_email`, `_warranty_phone`, `_warranty_email`, `_warranty_destination_address`).
  - Exacoat Manager order and RMA endpoints (`format_order_for_manager`, `rest_get_claim_details`, `rest_get_claims_log`) prioritize clean metadata keys over stale or masked order defaults, ensuring operators always see the true customer contact and shipping details.
