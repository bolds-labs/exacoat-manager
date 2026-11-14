# Manager Redesign, Plan 2: Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Orders screen, the order detail panel and the pop-ups opened from them exactly as the settled mockups, with store-wide counts from a new read-only endpoint, and give the Shopee and TikTok views the new look without changing their layout.

**Architecture:** A new plugin route `GET /orders/counts` returns numbers only; the manager reads it through `fetchOrderCountsDirect` and one hook. The Orders screen and panel are recomposed from the Plan 1 kit (`src/components/ds`) while keeping every existing data call and handler; large files are split into focused presentational components next to them.

**Tech Stack:** as Plan 1, plus PHP (WordPress plugin `exacoat-core`).

**Spec:** `docs/superpowers/specs/2026-11-14-manager-redesign-design.md` (sections 8.1, 8.2, 8.3, 9 phase 2). Mockups: `orders-screen.html`, `order-panel.html`, `design-sheet.html` in `docs/superpowers/specs/2026-11-14-manager-redesign/`.

**Depends on:** Plan 1 merged (kit, tokens, `src/lib/orderStatus.ts`, shell with `counts` prop).

## Global Constraints

- Everything in Plan 1 Global Constraints.
- No business logic changes: reuse existing bridge calls and drawer handlers (`handleStatusChange`, `handleProcessRefund`, `handleCancelOrder`, `handleTrashOrder`, `handleSaveTracking`, `handleCourierChange`, `handleToggleStorePickup`, `handleAddNote`, `handleResendEmail`, `handleGuaranteeAction`, `handleSendReviewInvite`, and the rest in `OrderDetailDrawer.tsx`). Status transition rules, confirmations and emails behave exactly as today.
- Nothing staff use today disappears (spec goal 5, section 8.2 inventory). Bulk actions, pagination, page size, table search stay.
- Counts endpoint returns numbers only, never order data; protected by `verify_bridge_permission`; plugin version bump.
- Orders table row: two lines (three with a warranty chip); truncate, never wrap.

## Review Focus

1. Counts endpoint unreachable (old plugin version installed, network error): KPI cards, tabs, channel and sidebar counts show no number at all (not 0), and the screen still works (Task 2 test).
2. Orders with missing data (no shipping address, no items, zero total, foreign currency, very long product names, very long customer names): rows keep two lines, panel cards show sensible empty states, nothing overflows (Task 3 and Task 5 checks on real orders #542887, #542886, #542888, plus one order without address).
3. Status navigator on the first and last steps and on statuses outside the flow (cancelled, refunded, failed): previous or next is disabled, "All steps" still works, nothing crashes (Task 4 test).
4. Shop manager role: Administrator actions card hidden; Create menu shows only actions allowed today (check today's guards in `OrdersView.tsx` and the drawer's `isAdmin`).
5. Light mode on every new screen and pop-up (screenshots in every task use both modes).

---

### Task 1: Counts endpoint (plugin)

**Files:**
- Modify: `wordpress-plugin/exacoat-core/includes/class-order-manager.php` (new `public static function get_order_counts( WP_REST_Request $request ): WP_REST_Response`), `wordpress-plugin/exacoat-core/includes/class-exacoat-core.php` (register `/orders/counts` next to `/orders/analytics`, GET, `verify_bridge_permission`; register it before the `/orders/(?P<id>\d+)` route is irrelevant because the regex needs digits, but keep it adjacent to `/orders/analytics`)

**Interfaces:**
- Produces JSON:
```json
{
  "success": true,
  "webstore": { "all": 0, "awaiting_payment": 0, "to_prepare": 0, "preparing": 0, "waiting_for_courier": 0, "ready_for_pickup": 0, "picked_up": 0, "shipped": 0, "completed": 0, "warranty": 0, "warranty_pending": 0, "redeem": 0, "endorsement": 0 },
  "shipped_last_7_days": 0,
  "channels": { "webstore": 0, "shopee": 0, "tiktok": 0 },
  "generated_at": "2026-11-14T10:00:00+07:00"
}
```
- Status buckets use the spec 7.2 mapping (pending, on-hold, pending-payment for awaiting_payment; processing for to_prepare; preparing-order, in-production for preparing; ready-to-ship and awaiting-pickup on non-pickup orders for waiting_for_courier; smb-ready, plus ready-to-ship and awaiting-pickup on pickup orders, for ready_for_pickup; smb-picked for picked_up; shipped; completed and delivered for completed). `all` excludes cancelled, refunded, failed, trash, matching today's All tab.
- `warranty`, `redeem`, `endorsement` come from `Exacoat_Order_Manager::get_specialized_order_ids( $tab )` counts (warranty limited to active statuses as today's tab does); `warranty_pending` counts warranty replacement orders whose `_rma_status` is pending or in_review.
- `shipped_last_7_days`: orders with `_shipped_at` in the last 7 days; fall back to status shipped, delivered or completed with `date_modified` in the last 7 days when `_shipped_at` is missing.
- `channels`: orders that need action. Webstore = `to_prepare`; Shopee = cached orders (`Exacoat_Shopee_Client::ORDERS_CACHE_KEY`) with `order_status === 'READY_TO_SHIP'`; TikTok = cached orders (`Exacoat_TikTok_Client::ORDERS_CACHE_KEY`) awaiting shipment (use the status the TikTok "Perlu Dikirim" tab uses today in `TikTokOrdersView.tsx`).
- Use count queries (`wc_orders_count`, `COUNT(*)` SQL against HPOS or postmeta as `get_specialized_order_ids` does); never call `format_order_for_manager`. Pickup detection in SQL: reuse the same meta keys `is_store_pickup_order` reads in PHP (check `class-order-manager.php`).

- [ ] **Step 1:** Implement and lint: `php -l` on both files. Expected: no syntax errors.
- [ ] **Step 2:** Add a plugin unit-style check script `wordpress-plugin/exacoat-core/tests/counts-bucket-test.php` that includes a pure helper `Exacoat_Order_Manager::bucket_for_status( string $status, bool $is_pickup ): ?string` (extract it as a static method) and asserts each mapping row above; run `php wordpress-plugin/exacoat-core/tests/counts-bucket-test.php`. Expected: prints `OK` (write the assertions first and watch them fail before extracting the helper).
- [ ] **Step 3:** After the owner installs the plugin build from Task 8, verify live: `curl -s -o /dev/null -w "%{http_code}" https://cms.exacoat.com/wp-json/exacoat-core/v1/orders/counts` prints 401 without auth; signed in through the manager, the network tab shows 200 with the JSON shape above and numbers matching today's tab totals for All and To prepare.
- [ ] **Step 4: Commit** `feat(orders): add read-only order counts endpoint`

### Task 2: Counts in the manager

**Files:**
- Modify: `src/lib/wordpressBridge.ts` (add `fetchOrderCountsDirect`), `src/types/index.ts` (add `OrderCounts`), `src/App.tsx` (pass counts to `Sidebar`)
- Create: `src/hooks/useOrderCounts.ts`, `src/hooks/useOrderCounts.test.ts`

**Interfaces:**
- Consumes: Task 1 JSON.
- Produces: `export interface OrderCounts { webstore: Record<'all'|'awaiting_payment'|'to_prepare'|'preparing'|'waiting_for_courier'|'ready_for_pickup'|'picked_up'|'shipped'|'completed'|'warranty'|'warranty_pending'|'redeem'|'endorsement', number>; shipped_last_7_days: number; channels: { webstore: number; shopee: number; tiktok: number } }`; `fetchOrderCountsDirect(): Promise<{ success: boolean; counts?: OrderCounts }>`; `useOrderCounts(): { counts: OrderCounts | null; refresh(): Promise<void> }` (loads on mount and on `refresh`; null on failure, never throws). Sidebar counts: `orders = webstore.to_prepare`, `warranty = webstore.warranty_pending`.

- [ ] **Step 1: Write failing tests** for `useOrderCounts` with `fetchOrderCountsDirect` mocked: success sets counts; a rejected promise or `{ success: false }` leaves `counts` null and does not throw (Review Focus 1); `refresh()` refetches.
- [ ] **Step 2: Run** `npm test -- src/hooks`. Expected: FAIL.
- [ ] **Step 3: Implement**; wire `App.tsx` so the sidebar shows counts; replace the existing processing-count request from v0.1.226 with `counts.webstore.to_prepare` when counts are present.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(orders): load store-wide counts`

### Task 3: Orders screen: header, KPIs, channels, tabs, table

**Files:**
- Modify: `src/components/orders/OrdersView.tsx`, `src/components/orders/OrderTable.tsx`
- Create: `src/components/orders/table/OrderRowCells.tsx` (cell components), `src/components/orders/table/ordersTabs.ts` (tab config), `src/components/orders/table/ordersTabs.test.ts`

**Interfaces:**
- Consumes: Plan 1 kit (`Button`, `IconButton`, `Menu`, `KpiCard`, `Tabs`, `StatusChip`, `WarrantyChip`, `Checkbox`, `SearchField`, `Select`), `useOrderCounts`.
- Produces: `export const ORDER_TABS: { key: string; label: string; countKey?: keyof OrderCounts['webstore']; hot?: boolean; inMore?: boolean }[]` with, in order: All, Awaiting payment (hot), To prepare (hot), Preparing, Waiting for courier, Ready for pickup, Shipped, Completed, Warranty claims (hot, count `warranty`), and in More: Redeem, Endorsements, Store pickup: all, Store pickup: ready, Store pickup: picked up. Each `key` is the filter value `OrderTable.tsx` sends today for that tab (map them from the current tab definitions around line 669; "Waiting for courier" uses today's "Waiting for Pickup" key).

- [ ] **Step 1: Write failing tests** for `ordersTabs.ts`: every tab key today's `OrderTable.tsx` supports appears exactly once in `ORDER_TABS` (list today's keys in the test); the first nine are not `inMore`; hot tabs are exactly Awaiting payment, To prepare, Warranty claims.
- [ ] **Step 2: Run** `npm test -- src/components/orders`. Expected: FAIL.
- [ ] **Step 3: Implement** per spec 8.1 and orders-screen.html: title row with icon-only Refresh and the Create `Menu` (Warranty claim, Redeem, Endorsement, Custom label, opening today's flows); channel segmented control with `counts.channels`; four `KpiCard`s (To prepare highlighted, Awaiting payment, Ready for pickup, Shipped last 7 days); table card with `Tabs` (counts from `useOrderCounts`, More as a pill `Menu`), filters (courier `Select`, label `Select`, table search field using today's server-side search), checkbox column, cells (Order ID mono plus date plus `WarrantyChip`; customer name plus city and province or plain "Store Pickup"; "N item(s)" plus truncated product name; total mono plus payment method; `StatusChip`; courier and service plus resi mono with copy, or "Resi not assigned yet", or store icon plus pickup location; actions eye, amber printer when label not printed, violet shield when a claim needs review). Keep today's bulk actions, pagination and page size, restyled. Call `refresh()` from the counts hook whenever the table refreshes.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Verify** at 1920x950 in dark and light against orders-screen.html, and Review Focus 2 rows; every action (select, bulk print, open order, copy resi, search for a resi, switch tabs and More items, Create menu items) works as before.
- [ ] **Step 6: Commit** `feat(orders): rebuild orders screen`

### Task 4: Order panel shell: header and status navigator

**Files:**
- Modify: `src/components/orders/OrderDetailDrawer.tsx` (header region only)
- Create: `src/components/orders/panel/StatusNavigator.tsx`, `src/components/orders/panel/StatusNavigator.test.tsx`, `src/components/orders/panel/PanelHeader.tsx`

**Interfaces:**
- Consumes: `getStatusSteps`, `getCurrentStepIndex`, `getOrderStatusMeta` (Plan 1 Task 2), kit `Drawer`, `Menu`, `Button`, `WarrantyChip`.
- Produces: `StatusNavigator({ order: Order; onChangeStatus(status: string): void; disabled?: boolean })` (previous block, current block with family-coloured icon tile, "Step N of M" caption and segment track, next block, All steps `Menu`); `PanelHeader({ order; onClose; onPrintLabel; onInvoice; onPackingSlip; moreItems; banner?: ReactNode })`.

- [ ] **Step 1: Write failing tests:** for `{ status: 'processing' }` previous shows "Awaiting payment", current "To prepare" and "Step 2 of 6", next "Preparing"; clicking next calls `onChangeStatus('preparing-order')`; on step 1 previous is disabled; on Completed next is disabled; for `cancelled` (outside the flow) both previous and next are disabled, current shows "Cancelled", All steps still lists the six steps (Review Focus 3); pickup order in `smb-ready` shows "Step 4 of 5".
- [ ] **Step 2: Run** `npm test -- src/components/orders/panel`. Expected: FAIL.
- [ ] **Step 3: Implement** per order-panel.html: header (order ID mono with copy, warranty or Store Pickup chip, meta line date · payment method · IP, Print label primary, Invoice, Packing slip, More `Menu` with Warranty, Redeem and any other secondary action today's header shows, close), warranty claim banner (title, original reference and channel, reason, Review claim proof opening today's review flow), `StatusNavigator` wired to `handleStatusChange` so confirmations and side effects stay as today. Header is pinned; body scrolls (`Drawer`).
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(orders): new order panel header and status navigator`

### Task 5: Order panel body

**Files:**
- Modify: `src/components/orders/OrderDetailDrawer.tsx` (body region)
- Create: `src/components/orders/panel/CustomerDeliveryCard.tsx`, `ItemsCard.tsx`, `ShippingCard.tsx`, `ActivityCard.tsx`, `SummaryCard.tsx`, `CouponsCard.tsx`, `ReviewCard.tsx`, `ResendEmailCard.tsx`, `AdminActionsCard.tsx`, `docs/superpowers/plans/2026-11-14-order-panel-inventory.md`

**Interfaces:**
- Consumes: kit `Card`, `Button`, `TextField`, `Select`, `Switch`, `StatusChip`; existing drawer state and handlers passed as props (no new data fetching).

- [ ] **Step 1: Inventory first.** Before moving anything, list every section and conditional block today's drawer renders (grep the JSX for each `{condition && (` block and each section title) into `2026-11-14-order-panel-inventory.md`, each mapped to its target card from spec 8.2 (including guarantee refund flow, AWB PDF, custom skin asset download, tracking links, Rayspeed booking, store credit info, workshop label). No item may be left unmapped.
- [ ] **Step 2: Implement** the two-column body per spec 8.2 and order-panel.html, one card component per file, each receiving existing state and handlers as props. Customer & delivery: recipient, email (copy), phone (copy, WhatsApp) left; address with Edit right; Store pickup switch (or Switch to courier) in the header. Coupons card always rendered with the empty state. Administrator actions only when `isAdmin` (Review Focus 4).
- [ ] **Step 3: Run** `npx tsc --noEmit` and `npm test`. Expected: PASS.
- [ ] **Step 4: Verify** with real orders #542887 (courier), #542886 (pickup), #542888 (warranty) and one order without a shipping address, in dark and light at 1920x950: every inventory item is present and works (tick each line in the inventory file), no overflow (Review Focus 2).
- [ ] **Step 5: Commit** `feat(orders): rebuild order panel body`

### Task 6: Pop-ups from Orders and the panel

**Files:**
- Modify: the refund, cancel and trash modals inside `OrderDetailDrawer.tsx`; `src/components/orders/EditOrderItemModal.tsx`, `ManualWarrantyModal.tsx`, `WarrantyReviewModal.tsx`, the edit address modal, redeem and endorsement creation modals, and the chrome (not the printed content) of `ShippingLabelA6Modal.tsx`, `PackingSlipModal.tsx`, `CustomerInvoiceModal.tsx` (find each with `grep -rln "Modal" src/components/orders`)

**Interfaces:**
- Consumes: kit `Modal`, `RadioCard`, `TextField`, `Select`, `Checkbox`, `Button`, `toast`.

- [ ] **Step 1:** Rebuild the Refund pop-up exactly as design-sheet.html (summary box, Original payment vs Store credit radio cards, Amount and Reason, Restock items, hint, Cancel and "Refund {amount}"); store credit keeps today's shipping subsidy deduction and suggested net refund lines.
- [ ] **Step 2:** Move every other listed modal onto kit `Modal` with the same header, body and footer pattern; destructive confirms use the danger button; success messages use `toast`. Do not change printed content; compare a printed or PDF output before and after for one label, one packing slip, one invoice.
- [ ] **Step 3: Run** `npx tsc --noEmit` and `npm test`. Expected: PASS.
- [ ] **Step 4: Verify** each pop-up opens, validates and submits as before (use a test or cancelled order for refunds; do not issue real refunds), in both modes.
- [ ] **Step 5: Commit** `feat(orders): move order pop-ups to the shared modal`

### Task 7: Shopee and TikTok restyle (no layout change)

**Files:**
- Modify: `src/components/orders/ShopeeOrdersView.tsx`, `TikTokOrdersView.tsx`, `ShopeeOrderDetailModal.tsx`, `TikTokOrderDetailModal.tsx`
- Create: `src/lib/marketplaceStatus.ts`, `src/lib/marketplaceStatus.test.ts`

**Interfaces:**
- Produces: `getShopeeStatusMeta(order): StatusMeta` and `getTikTokStatusMeta(order): StatusMeta` (native labels kept, Indonesian allowed; families: needs-to-ship act, unpaid wait, processed or shipped prog, completed done, cancelled, in-cancel and to-return stop).

- [ ] **Step 1: Write failing tests** for both maps: `READY_TO_SHIP` is family act, `UNPAID` wait, `SHIPPED` prog, `COMPLETED` done, `CANCELLED` stop, unknown is neutral with the raw label.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the maps; restyle the four files with token classes, kit `StatusChip` (meta prop), kit buttons and 36px controls, keeping their layout, tabs and behaviour.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS. Verify both channels in both modes; cancelled-order hygiene from AGENTS.md section 5 unchanged.
- [ ] **Step 5: Commit** `feat(orders): restyle Shopee and TikTok views`

### Task 8: Docs and release

**Files:**
- Modify: `AGENTS.md` (Orders screen and panel structure, counts endpoint contract, status navigator), `CHANGELOG.md`, version files per AGENTS.md section 2

- [ ] **Step 1:** Update docs; `git diff | grep -c "—"` prints 0.
- [ ] **Step 2: Run** `npm test` and `npm run build`. Expected: pass, exit 0, initial JS at or below 0.9 MB raw.
- [ ] **Step 3:** Production preview, signed in: full staff flow on a test order (open, move status forward and back, save tracking, print label preview, add note, resend email preview) in both modes; no console errors.
- [ ] **Step 4: Commit** `feat(orders): orders redesign (vX.Y.Z)`; push only with the owner's go-ahead; owner installs the plugin zip, then run Task 1 Step 3 live checks.
