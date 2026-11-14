# Staff dashboard: build report

Spec: `docs/superpowers/specs/2026-11-14-staff-dashboard-design.md`. Branch `design/manager-redesign`, plugin version stays 0.1.228 (unreleased).

## What was built

### Plugin (exacoat-core)
- New class `includes/class-staff-dashboard.php` (`Exacoat_Staff_Dashboard`), loaded and initialised in `exacoat-core.php`. Routes in `exacoat-core/v1` and `exacoat/v1`, every one with `Exacoat_Core::verify_bridge_permission` (no header trust):
  - `GET /staff/notes`, `POST /staff/notes` `{ text }`, `POST|PUT|PATCH /staff/notes/{id}` `{ pinned?, done? }`, `DELETE /staff/notes/{id}`.
  - `GET /staff/overdue-international`.
- Notes live in option `exacoat_staff_notes` (autoload off), capped at 300 (done first, then unpinned, oldest first). Text goes through `sanitize_textarea_field`, max 2000 characters. Author id and display name are stored at write time. Delete: author or `manage_options`. Writes need a signed-in user (403 otherwise).
- Overdue rule: `ready-to-ship`, shipping country (billing fallback) set and not `ID`, more than 48 hours since pickup. Pickup time: `_goorita_booked_at`, else Rayspeed booking (`_exacoat_tracking_info.created_at` when `_rayspeed_awb` exists), else the latest status change note into Waiting for Courier Pickup, else date modified. `wc_get_orders` (HPOS-safe), oldest 300 orders, `truncated` flag. Response holds only id, number, customer name, country, country name, courier, pickup time, pickup source and days.
- Times are returned as UTC with a `Z` suffix because the manager's `parseStoreDate` reads `+00:00` as legacy store time and would shift it by 7 hours.
- Test: `tests/staff-dashboard-test.php` (pickup source order, 48 hour boundary, whole days, international check, site-timezone parsing, status-note matching, notes cap, delete permission).

### Manager
- `src/lib/staffDashboard.ts`: strict parsers (notes, notes response, overdue rows), `splitNotes` (pinned first, newest first, done folded), `notesReducer`, `canDeleteNote`, labels, `normalizePendingReviews` (the reviews endpoint sends string ids).
- `src/lib/staffDashboardApi.ts`: requests for the five routes. A `rest_no_route` or non-JSON 404 returns `missing: true`; a note 404 (`exacoat_staff_note_missing`) stays a normal error.
- `src/pages/StaffDashboardPage.tsx` (lazy) with cards in `src/components/staff/`: KPI row (Payment confirmed and Warranty to review from the shared counts, with the same processing-count fallback the Dashboard uses; Reviews to approve from `stats.pending`; Overdue international), Overdue international orders with Open order, Team notes (add, pin, done, delete with confirmation, done notes folded), Reviews waiting for approval (stars, customer, product, text, photos, Approve and Reject), Quick links. Header Refresh and the page Refresh reload all cards.
- Navigation: tab `staff` "Staff dashboard" in Operations under Dashboard, in `SHOP_MANAGER_ALLOWED_TABS`, Header title, Command palette entry, URL aliases `#staff`, `#staff-dashboard`. Shop managers are redirected to `#staff` (was `#orders`) for any tab they cannot open, so they land there after sign-in. Admins still land on Dashboard.
- `SELF_LOADING_TABS` no longer exists; the order list is an allowlist (`tabNeedsOrderList`, only `skin_performance`). Added `staff` to the workspaceTabs test and corrected the stale AGENTS.md reference.
- Docs: AGENTS.md section 63, CHANGELOG 0.1.228 "Staff dashboard", changelog line in `scripts/package-plugin.cjs`.

## Verification
- `php -l` on the new class and `exacoat-core.php`: clean. `php tests/staff-dashboard-test.php`: OK. `tests/counts-bucket-test.php`: OK.
- `npx tsc --noEmit`: clean. `npm test`: 43 files, 441 tests passed (new: staffDashboard 13, staffDashboardApi 8, nav and workspaceTabs additions).
- `npm run build`: passed; zips regenerated at 0.1.228 and include the new class and test. Initial JS (entry plus modulepreloads in `dist/index.html`): 891,990 bytes (limit 900,000). The page is its own chunk.
- Dev server (port 3005, signed in, staging):
  - Dark and light: title row, KPIs, cards and quick links render with tokens. Notes and overdue cards show "Install the latest plugin" (staging has no new routes, the request 404s once, no retry loop).
  - Reviews: 2 real pending reviews listed with photo; Approve and Reject open the confirmation pop-up, both cancelled (Cancel button and Escape). No review was changed.
  - With the staff routes mocked in the browser (fetch override, nothing written to the store): notes list with pinned on top, add, done notes folded and expandable, delete icon only on own notes; overdue rows with days chip; Open order switched to Orders and opened the order panel for a real order.
  - Role simulation as shop manager: landing on `/` went to `#staff`; sidebar shows Staff dashboard, Orders, Reviews.

## Decisions and concerns
- The Reviews screen approves and rejects without a confirmation. The task asked for "the same confirmations"; I added a confirmation pop-up here because approving publishes the review and the screen is a quick action surface. The status call is identical.
- Initial JS is 891,990 bytes, only about 8 KB under the 900,000 limit. The additions here were small (App lazy import, nav and palette entry), but the margin is thin for the next screen.
- Notes use read-modify-write on one option; two staff saving in the same instant could drop one change. Acceptable for a team notes list; a custom table would remove it.
- Overdue uses the latest status change note into Waiting for Courier Pickup and matches the label `Waiting for Courier Pickup`, `Ready to ship` and the slug; a renamed status label in WooCommerce is picked up through `wc_get_order_status_name`.
- Orders whose country is empty are not treated as international.
- The endpoints are not live until the 0.1.228 zip is installed; nothing was installed or pushed.

## Fix round 1

1. **Notes write lock**: create, update and delete now hold a lock row `exacoat_staff_notes_lock` around the read-change-write. The lock is taken with `INSERT IGNORE` on the options table instead of `add_option()`, because `add_option()` uses `ON DUPLICATE KEY UPDATE` and is not an atomic mutex. It tries 5 times, 150 ms apart, and is released in `finally` by deleting only its own token. A lock older than 10 s is broken with a conditional delete on the exact value read. When the lock cannot be taken the route returns HTTP 409 `exacoat_staff_notes_busy` ("Notes are busy, try again."). The notes option cache is dropped before reading inside the lock. The manager passes the error code through, shows the message and keeps the typed text. PHP tests cover stale detection, retries, pauses, busy result, release after work and release when the work throws.
2. **Payment confirmed fallback**: App keeps the processing count as `null` until its request succeeds. `paymentConfirmedFallback` (`src/lib/countsFallback.ts`, tested) shows no number when both the counts endpoint and the fallback are unavailable, on both the Dashboard and the Staff dashboard. The sidebar badge still uses 0 as before.
3. **Note deleted elsewhere**: an update or delete that returns 404 `exacoat_staff_note_missing` removes the note with a "Note removed" notice instead of restoring it (component test).
4. **Review thumbnails**: videos without `poster_url` show a video icon tile (component test). The unreachable `missing` state was removed from the reviews card type and its render branch.
5. **Delete note pop-up**: Cancel is disabled and Escape and outside clicks are ignored while the delete runs (component test).

Left as they are, as asked: the overdue query cost and the Rayspeed time precision.

Checks: `php -l` clean; both PHP tests OK; `npx tsc --noEmit` clean; `npm test` 45 files, 449 tests passed; `npm run build` passed at 0.1.228 with rebuilt zips; initial JS 892,075 bytes. The dev server reload still renders the screen with Payment confirmed from the fallback.
