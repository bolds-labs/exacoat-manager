# exacoat-core auth and ownership: report

Plugin only (exacoat-manager `design/manager-redesign`, plugin 0.1.228, unreleased). The storefront side is fixed separately in the hotfix branch; nothing in exacoat-web or exacoat-web-hotfix was touched. Rules are in AGENTS.md section 59b.

## Design
- One trusted client IP helper for every limit, `Exacoat_Request_Guard::client_ip()` (new `includes/class-request-guard.php`): a storefront-signed `X-Exacoat-Client-IP`, else `CF-Connecting-IP` only from a Cloudflare edge address, else `REMOTE_ADDR`. `X-Forwarded-For` is never read. The shipping work's IP code now delegates here.
- Ownership by WordPress customer id. Emails on an account are user-settable and unverified, so they never grant access.
- Weak proofs (order number plus email) get less data and bounded attempts; strong proofs (owner, order key) keep the full answer.

## Header the storefront must send (for the hotfix branch)
On every server-side call it makes for a customer (auth, `/auth/order`, warranty, tracking):
- `X-Exacoat-Client-IP: <customer IP>`
- `X-Exacoat-Client-IP-Ts: <Unix seconds>` (accepted within 300 seconds of the plugin's clock)
- `X-Exacoat-Client-IP-Sig: <lowercase hex HMAC-SHA256(EXACOAT_CART_PRICE_SECRET, "exacoat-client-ip-v1\n" + ip + "\n" + ts)>`
Vector (secret `test-secret-0123456789abcdef0123456789abcdef`): payload `exacoat-client-ip-v1\n198.51.100.7\n1800000000`, signature `hash_hmac('sha256', payload, secret)` as asserted in `tests/request-guard-test.php`. Until the hotfix sends these, every storefront customer shares the storefront server's IP bucket (limits below are sized so normal traffic fits, but a burst can trip them).

## Findings and fixes
1. **Warranty eligibility** (`rest_check_eligibility`, Shopee and TikTok checks). Before: verification only when a value was sent (empty skipped it entirely and still returned address, phone and email), and phones matched on the last 8 digits (masked marketplace numbers with `*` stripped matched suffixes). Now: proof always required. Webstore: signed-in customer by customer id, exact billing email, or full normalised phone (9+ digits, masked never matches). Marketplace: full recipient phone, or exact buyer username with all recipient data removed (`address_hidden`). Lookups are exact (order id, order number, tracking number, marketplace id); there is no free-text search in the plugin. Limits: 120 per IP per 10 minutes, 10 failed proofs per order per hour.
2. **Customer order ownership** (`rest_orders`, `rest_order`, `user_owns_order`). Before: orders matched by account email or `billing_email` meta, so setting a victim's email on one's own profile listed their guest orders, with order keys and Snap tokens. Now: `owns_order()` by customer id only; `/auth/orders` by customer id only. Guest reads by order number plus billing email return no `orderKey`, `snapToken`, `snapUrl`, `viewUrl`, with 60 lookups per IP per 10 minutes and 10 failed proofs per order per hour. `/shipping/track` called `rest_order` with the order key after an email match, which handed out the full payload; it now strips the same fields and uses the same limits (also the tracking shortcode).
3. **Profile email change and register**. With ownership by customer id, a new email (profile, register, or Store API update-customer writing `billing_email`) no longer drives any access in the plugin. `billing_email` meta is kept as contact data. The affiliate email fallback was the other place an account email granted access (item 5).
4. **Sign-in rate limit** (`is_rate_limited`). Before: trusted `X-Exacoat-Client-IP`, `CF-Connecting-IP` and `X-Forwarded-For` from anyone, so any client could choose a fresh bucket per attempt. Now: trusted client IP only, plus a per-account limit (10 failures per email per 15 minutes, counted for unknown emails too, cleared on success, generic 429 message). Checkout quick login (classic AJAX) now uses the same per-account limit and one generic message instead of "No account found"; the user exists check no longer returns the display name.
5. **Other public routes**:

| Route | Verdict |
|---|---|
| `/bca-webhook`, `exawebhook/v1/endpoint`, `?exacoat_bca_webhook=1` | **Fixed (critical)**: anyone could post an amount and the matcher marked the pending BCA order with that total paid. Now needs `EXACOAT_BCA_WEBHOOK_TOKEN` (or option) as `?token=` or `X-Exacoat-Webhook-Token`; fails closed. |
| `/affiliate` portal, settings, payout (email fallback) | **Fixed**: registering or changing the account email to an affiliate's email (no verification) gave their portal, bank details and payout requests. Linked user id only now. |
| `/auth/order`, `/shipping/track`, tracking shortcode | **Fixed** (item 2). |
| `/warranty/check-eligibility` | **Fixed** (item 1). |
| `/warranty/submit-claim`, `/warranty/shipping-rates` | Fixed in the shipping work (ownership proof, limits). |
| `/checkout/cancel-order` | OK: needs the order key. |
| `/guarantee/check-eligibility`, `/submit-claim`, `/update-resi` | OK: exact billing email; no rate limit yet (follow-up: use `guest_lookup_blocked`). |
| `/reviews/verify-order` | OK: exact email, key or review token; returns items and the customer's own reviews only. |
| `/shopee/verify-order`, `/tiktok/verify-order` | Low: return buyer username, note, items and tracking for a known marketplace id (ids are long and not sequential). The storefront uses `buyer_username`, so it was left; it is also why username proof returns no recipient data. |
| `/shopee/tracking-info`, `/tiktok/tracking-info`, `/shipping/*-webhook`, `/zeptomail-webhook` | Not reviewed in depth here (carrier status and provider webhooks); section 60 already says unsigned webhooks may only trigger a fresh provider read. |
| `/auth/coupons`, `/auth/me`, profile, password, delete | OK: Bearer session required. |
| `/cart/track`, `/affiliate/register`, `/affiliate/lookup`, `/checkout/config`, `/checkout/address`, `/checkout/price` | No personal data returned. |

## Evidence (2026-11-15)
- `php -l` clean on every include. PHP tests pass: new `request-guard-test.php` (signed IP vector, stale or wrong signature, unsigned headers and X-Forwarded-For ignored, Cloudflare IPv4/IPv6, counters), `customer-auth-guard-test.php` (ownership by id, guest payload, per-account sign-in limit, guest lookup limits), `warranty-verification-test.php` (owner, email, full phone, suffix and postcode guesses refused, masked phones, marketplace username hides data), `bca-webhook-auth-test.php` (fails closed, wrong and missing token, query and header token), plus the existing ones.
- `npx tsc --noEmit` clean, `npm test` passes, `npm run build` rebuilt the 0.1.228 zips.

## Deploy steps
1. Set `EXACOAT_BCA_WEBHOOK_TOKEN` (24+ random characters) in wp-config.php and add `?token=<same>` to the webhook URL in MesinOtomatis. Do this first: after the zip is installed, unsigned BCA mutations are refused and BCA orders are no longer confirmed automatically.
2. Install the 0.1.228 zip.
3. Update the storefront (hotfix) to send the three `X-Exacoat-Client-IP*` headers.

## Concerns
- Customers who placed guest orders before registering no longer see them in their account history (they can still look them up by number and email). Linking them needs a verified email flow, which does not exist.
- A per-order failure limit lets someone pause guest lookups for a known order number for an hour (owners and key links unaffected).
- Until the storefront sends the signed IP header, all storefront customers share one IP bucket.
- Not in scope, noticed: `class-affiliate-manager.php` `ensure_edwin_yang_setup()` hardcodes a real person's email address in plugin code; it should move to data.
