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


## Fix round 1 (2026-11-15, review)

Critical:
- **C1, REMOTE_ADDR rewrite**: `apply_headless_currency_context` (init -999) copied the unsigned `X-Exacoat-Client-IP` / `X-Artmatter-Client-IP` into `$_SERVER['REMOTE_ADDR']`, so every limit could be bypassed by sending a fresh header. It now uses only `Exacoat_Request_Guard::signed_storefront_ip()`, and the guard captures the web server's `REMOTE_ADDR` when the plugin loads and reads that, so no later rewrite counts. Grep found no other `REMOTE_ADDR` writes. Other IP readers now use the guard: `Exacoat_Affiliate_Manager::get_client_ip()` (it trusted `CF-Connecting-IP` and `X-Forwarded-For` from anyone) and the checkout address lookup limit. `tests/client-ip-init-test.php` runs `Exacoat_Checkout_Engine::init()` and the init -999 callbacks.

Important:
- **I1, owner lockout**: the sign-in lock counts failures per email and client IP (10 in 15 minutes). Failures for one email from many IPs (50) only add a 2 second wait; a correct password still signs in, so staff cannot be locked out from elsewhere. Checkout quick login uses the same gate.
- **I2, marketplace**: `buyer_username` is masked in `/shopee/verify-order` and `/tiktok/verify-order` (the storefront only shows it), the replacement order number is dropped from their already-claimed reply, and both plus `/tracking-info` are limited to 60 per client IP per 10 minutes. The username is no longer warranty proof. A staff claim code mechanism exists (warranty codes with `bound_order_id`, issued in the manager), so marketplace proof is the full recipient phone or a valid code bound to that exact order. The early already-claimed reply in eligibility no longer reveals the replacement order.
- **I3, coupons**: `/auth/coupons` lists an email-restricted coupon only for the user id in `_exacoat_issued_user_id`. Coupon creation found: review reward coupons (`issue_reward_coupon`, now storing the order's customer id); abandoned cart and affiliate code paths create commission or tracking rows, not email-restricted coupons. There is no email verification at registration, so there is no email fallback: older email-restricted coupons (no stored id) no longer show in My Coupons, but still work at checkout with the code from the email. Note: WooCommerce itself checks email restrictions against the checkout billing email, which a buyer types, so an email-restricted code is effectively a bearer code.
- **I4, gates**: eligibility checks the owner session or a correct proof first; only failures (wrong proof, order not found) are counted and gated. Guest order reads gate and count only failed proofs; the owner, the order key and a correct email are never gated.
- **I5, BCA**: only IDR orders with payment method `bacs`, `bca`, `bank_transfer` or `manual_bca` are candidates.
- **I6, BCA duplicate credits**: dedupe used to check only the candidate order's own `_bca_confirmed_mutation`, so a credit delivered twice (forwarder retry, or direct plus storefront relay) could pay a second open bank-transfer order with the same total. Every credit is now recorded in the global store `exa_bca_seen_mutations` (7 day window, under the `exa_bca_seen_lock` INSERT IGNORE lock row) before matching; a repeat answers 200 `duplicate_ignored` and changes nothing. Key: the `mutation_id`/`id` field when MesinOtomatis sends one, else md5 of amount and trimmed description. Without an id, two genuine transfers with the same amount and description inside 7 days are treated as one, and the second must be confirmed by hand. Test: `tests/bca-webhook-dedupe-test.php`.

Minor:
- **Midtrans fallback**: refused when no server key is configured (the signature would be computable by anyone) and unless `gross_amount` equals the order total.
- **Affiliate seed**: the edwinyg seed no longer uses a hardcoded personal email or a fallback user id, never grants the affiliate role by email, stops writing that email into coupon and commission rows, and runs once behind `exacoat_affiliate_seed_edwinyg_done` instead of on every recalculation (it used to reset the balance each time). The callers stay; the function returns early after the first run. Other creator seeds (`ensure_*_setup`) still run on every recalculation and should get the same treatment.
- **Phone proof** also accepts the `_shipping_phone` meta (full match only).
- **Counters**: atomic with a persistent object cache (`wp_cache_add` + `wp_cache_incr`); otherwise a transient read and write, and simultaneous requests can let a few extra attempts through.

Deploy order (updated):
1. Set `EXACOAT_BCA_WEBHOOK_TOKEN` and the MesinOtomatis `?token=` (unchanged).
2. Deploy the storefront hotfix that sends the three signed `X-Exacoat-Client-IP*` headers before or together with this plugin. Without them, after this plugin every storefront customer shares the storefront server's IP for all limits (sign-in, guest lookups, warranty, marketplace verify), and geolocation falls back to the storefront server's address.
3. Install the 0.1.228 zip.

Affiliate rows linked only by email (staff step): portal, settings and payouts now need `user_id` on the affiliate row. For each affected affiliate:
1. In WordPress, Users, find the affiliate's account (ask them to sign up first if they have none) and note the user ID.
2. In the database table `wp_exacoat_affiliates`, set `user_id` on that affiliate's row (match by slug), for example with phpMyAdmin or `wp db query`.
3. Give the user the affiliate role (Users, edit, role) if they do not have it.
4. Ask them to sign in and open the affiliate portal to check.
To find rows needing this: `SELECT id, slug, display_name FROM wp_exacoat_affiliates WHERE user_id IS NULL OR user_id = 0;`

Also noticed (not changed): the export manager has a personal email address as a default JNE recipient; it should move to settings.

Evidence (fix round 1):
- `php -l` clean on every include. All PHP tests pass, including new `client-ip-init-test.php` (real init path), `midtrans-notification-test.php`, and extended `request-guard-test.php` (object cache counters), `customer-auth-guard-test.php` (per email and IP lock, slow path, failures-only gates, coupon listing), `warranty-verification-test.php` (username not proof, bound code, `_shipping_phone`, masking), `bca-webhook-auth-test.php` (IDR bank transfer candidates).
- `npx tsc --noEmit` clean, `npm test` passes, `npm run build` rebuilt the 0.1.228 zips.
