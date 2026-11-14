# Dashboard and Sales & Reports redesign: report

Branch `design/manager-redesign`, from d72ff35. Not pushed, version not bumped (still unreleased 0.1.228).

## Status

DONE_WITH_CONCERNS (concerns at the end; none block the work).

## Commits

| Commit | Task |
|---|---|
| bfa3182 | feat(reports): shared financial metrics loader and period comparison |
| 25cc5aa | feat(dashboard): summary with previous-period comparison |
| bc46267 | feat(reports): rebuild sales and reports on the design kit |
| e805e69 | docs(dashboard): dashboard and reports redesign |

## What changed

### Task 1: shared loader and comparison
- `src/hooks/useFinancialMetrics.ts`: the Reports loading moved into a hook (latest 500 webstore orders, Shopee and TikTok caches, `normalize*`). Reports it per-channel failures (`failedChannels`) instead of silently dropping them, and the oldest loaded order per channel (`oldestByChannel`; webstore counts as cut off only when the 500 list is full). `autoSyncEscrow` keeps the Reports one-time escrow sync; the Dashboard does not pass it, so it never writes the caches. `buildPeriodComparison` aggregates the current and previous windows with the unchanged `aggregateFinancialMetrics` and compares Sales, Orders, AOV, Payout, Items and per-channel sales.
- `src/lib/periodComparison.ts`: `periodWindows(preset, now)` for today, 7 days, 30 days, this month (store time); `previousWindowFor` for other ranges; `compareMetric` (up, down, flat under 0.5%, new, no-history; never Infinity or NaN); `hasHistory` (one day of slack). The previous window covers only the same elapsed time, so 10:00 today compares with yesterday until 10:00, and this month with the same days of last month (clamped to its end).
- `ReportsPage` used the hook with no visual change in this commit (same 1,616 orders before and after on live data).

### Task 2: Dashboard
- `DashboardPage` rewritten: period tabs (remembered per viewer in localStorage, convenience only), five KpiCards (Sales, Orders, Avg order value, Payout after fees, Items sold) with `ChangeChip`, a caption naming both date ranges and any channel without history, sales trend (current solid accent line, previous dashed; Today is cumulative by store hour), sales by channel (share bar, amount, orders, change), top 5 products, Needs attention (Payment confirmed, Warranty to review; links to Orders and RMA) and quick links (Full sales report, Orders, Reviews, Store health). Recent orders and the status ring are gone; their four components were deleted (nothing else imported them).
- `tabNeedsOrderList` is now true only for `skin_performance`, so the Dashboard (and unknown tabs, which fall back to it) no longer download the app-wide 500-order list. The unused `handleSelectOrder` in App was removed.
- Shop managers never reach the Dashboard (App routing unchanged), so nothing changes for them.
- Kit: `KpiCard` gets optional `icon` and `footer` (backwards compatible). New tokens `viz-1..3` (light and dark) for channel identity, added to `index.css`, `tailwind.config.js` and `TOKEN_NAMES`. `useCssVars` resolves tokens for recharts (SVG attributes) and re-reads on theme change.
- `formatCompactMoney` ("Rp 75,5 jt", full amount on hover) keeps five KPI cards readable at 1366.
- The live `orders/counts` endpoint returns 404 (plugin 0.1.228 not installed on the server), so Payment confirmed uses the same processing-count fallback as the sidebar badge; Warranty to review shows no number until the endpoint exists.

### Task 3: Sales & Reports
- Same content and controls on the kit: title row (Updated time, Skin analytics, Refresh and sync), range Tabs (Today, 7 days, 30 days, This month) plus a kit Select for Last month, 90 days, This year, All time, Custom range (two date fields), channel toggles (All channels or any combination, as before), a caption with order and unit counts and the comparison window, the Shopee history notice with its sync button, six KPI cards (Gross sales, Paid orders, Avg order value, Platform fees and vouchers, Payout after fees, Buyer paid at checkout) with change chips where a rise is good, all previous captions kept (take rate, paid-then-cancelled, units, cancelled left out, payout per order, platform vouchers).
- `RevenueChart` replaces `MultiChannelRevenueChart`: Daily/Weekly/Monthly and By channel / Stacked / Gross vs payout as kit Tabs, 2px lines, stacked bars with surface gaps, solid hairline grid, legend always shown, the full per-day breakdown tooltip on `bg-pop`.
- `ChannelReconciliationCard` (one per channel): gross with change chip, fees and payout in large numbers, "Fee lines and checkout" collapsible (commission, service, transaction, AMS, seller vouchers, buyer paid, platform vouchers, shipping, AOVs, cancelled), "Show only" replaces the old click-to-focus.
- `FinancialLedgerTable` rebuilt in the Orders table style (same th/td classes, chip-coloured status, kit Tabs for Paid / Cancelled or unpaid / All placed with counts, kit Select for channel, SearchField, Export CSV, totals strip, expandable reconciliation rows, Prev/Next pagination). CSV export is unchanged (`exportFinancialReportToCsv`).
- `TopProductsList` shared by both pages (Reports shows 10 with share and channel dots).
- Old `ChannelFilterPills`, `ChannelRevenueBreakdownCard`, `MultiChannelRevenueChart`, `TopFinancialProductsCard` deleted (no other importers). `DateRangePicker` is kept for Skin Performance.

### Task 4: docs and build
- AGENTS.md section 64 (shared hook, escrow auto-sync scope, comparison and history rules, dashboard contents, chart tokens, kit additions) and section 61 updated (only skin performance uses the order list). CHANGELOG 0.1.228 lines added.

## TDD evidence

`src/lib/periodComparison.test.ts` was written first. RED with a stub that throws:

```
Tests  20 failed (20)
```

GREEN after the implementation:

```
 ✓ src/lib/periodComparison.test.ts (20 tests) 17ms
      Tests  20 passed (20)
```

Covered: window boundaries for each preset in Asia/Jakarta (including UTC midnight, January, shorter last month), elapsed-time matching, +12% rise, fall, flat within 0.5%, previous 0 gives `new`, both 0 is flat, missing history gives `no-history` with no previous value, no Infinity or NaN, `hasHistory` slack.

Also test-first: `workspaceTabs.test.ts` (2 new expectations failed, then passed) and `ChangeChip.test.tsx` (chip states and hover text; one test expectation of my own was wrong against the one-decimal rule and was corrected). `compactMoney.test.ts` added with the helper.

## Tests and checks

- `npx tsc --noEmit`: clean.
- `npm test`: 37 files, 396 tests passed.
- `npm run build`: passed. The packaging step rewrote the plugin zips and `public/version.json` timestamp only (no plugin change), so those were restored and not committed.
- Initial JS (entry plus modulepreloads in `dist/index.html`): **890,268 bytes** (under 900,000). `DashboardPage` chunk 12,411 bytes, `ReportsPage` 55,879 bytes, both lazy.
- No em dashes, native selects, `/NN` on token colours, legacy palette classes or backdrop blur in the new or changed files.
- Chart palette run through the dataviz validator: light (on white) all checks pass with a contrast WARN for aqua (2.82:1), relieved by visible channel labels next to every colour and the ledger as table view; dark (on #0f0f11) all pass.

## Same numbers on Dashboard and Reports (live data, same session, all channels)

| Period | Dashboard: Sales, Orders, AOV, Payout | Reports: Sales, Orders, AOV, Payout |
|---|---|---|
| Today | Rp 4.684.757, 33, Rp 141.962, Rp 3.990.769 | Rp 4.684.757, 33, Rp 141.962, Rp 3.990.769 |
| 7 days | Rp 75.497.977, 524, Rp 144.080, Rp 63.175.954 | Rp 75.497.977, 524, Rp 144.080, Rp 63.175.954 |
| 30 days | Rp 243.129.996, 1,614, Rp 150.638, Rp 217.544.789 | Rp 243.129.996, 1,614, Rp 150.638, Rp 217.544.789 |
| This month | Rp 158.575.786, 1,089, Rp 145.616, Rp 134.841.642 | Rp 158.575.786, 1,089, Rp 145.616, Rp 134.841.642 |

(Dashboard values read from the full-amount hover text of the compact tiles.) Before this work the Dashboard showed Rp 42.805.734 and 198 orders for 30 days (webstore only) while Reports showed Rp 243 jt and 1,616 orders.

## Screenshots (`docs/superpowers/screens/`)

Before: `before-dashboard-1920-dark.png`, `before-dashboard-1920-light.png`, `before-dashboard-1366-light.png`, `before-reports-1920-dark.png`, `before-reports-1920-light.png`, `before-reports-1366-light.png`.

After: `after-dashboard-1920-dark.png`, `after-dashboard-1920-light.png`, `after-dashboard-1366-dark.png`, `after-dashboard-1366-light.png`, `after-reports-1920-dark.png`, `after-reports-1920-dark-lower.png` (channel cards with fee lines open, ledger row expanded), `after-reports-1920-light.png`, `after-reports-1366-dark.png`, `after-reports-1366-light.png`.

No horizontal page scroll at 1366 (scrollWidth 1366).

## Concerns

1. **Screenshot method**: the browser pane was too small for its own screenshots, so the files were rendered with html2canvas from the page and saved by a temporary local receiver. html2canvas draws some text a few pixels low (labels look slightly clipped at the bottom, e.g. sidebar items and the "More ranges" select). That is a capture artefact, not the app; the before and after shots have it equally.
2. **Reports still auto-syncs escrow on open** (existing behaviour kept as the plan required): opening Reports runs one Shopee and TikTok sync when cached orders lack escrow details, which writes the marketplace caches. It happened during verification without pressing anything; no backfill or export button was pressed. The Dashboard does not do this, so its Payout after fees can lag Reports until some sync has run (Sales, Orders and AOV are unaffected; they matched exactly).
3. **History is short**: the Shopee cache held 13 to 16 days, so 30-day and This month comparisons show "Not enough history" for all-channel KPIs and Shopee/TikTok channel rows; 7 days and Today compare normally. This is the intended safe behaviour, but the owner will see many "Not enough history" chips until the caches hold longer history.
4. **Order counts endpoint is 404 on the live server** (plugin 0.1.228 not installed). Needs attention shows Payment confirmed from the processing-count fallback and no Warranty to review number until it is.
5. **Dashboard at 1920x950**: everything except the 4th and 5th top-product rows fits above the fold; the bottom row needs a short scroll. At 1366x768 the KPI row, trend and channel cards fit; the bottom row is below the fold.
6. Reports channel toggles keep the old multi-select behaviour as a button group (aria-pressed) styled like the Orders channel switcher, rather than single-choice kit Tabs, so combinations such as Webstore + Shopee remain possible.

## Fix round 1

Commit 1d1eca5 `fix(dashboard): exact history check, failed channels and refresh`.

1. **Exact history check**: `hasHistory` no longer allows a day of slack. The oldest loaded order must be at or before the previous window start, for marketplace caches and for the full 500-order webstore list alike (the webstore check had the same flaw, since that list is also cut part way through a day). New tests: oldest order 10 hours after the start gives no history; exactly at the start is covered; Today with the oldest order from yesterday afternoon gives `no-history`; a covered window gives a real +20%.
2. **Failed channels**: `buildPeriodComparison(..., failedChannels)` treats a failed selected channel as no history, for the totals and for that channel's row. The new `comparable` flag is false when every selected channel failed, and then both pages show no chips. Failed channels that are not selected are ignored. Notices now list channels with `joinList` ("Webstore, Shopee and TikTok Shop").
3. **Header Refresh**: `refreshAll` in App follows `refreshPlan(tab)`. It refreshes counts, emits `emitWorkspaceRefresh` (new `src/lib/workspaceRefresh.ts`, which `useFinancialMetrics` subscribes to) and calls `loadWorkspaceData` only where `tabNeedsOrderList` is true. Checked in the browser: one header Refresh on the Dashboard made one `per_page=500` request (the hook's reload) and no app-wide list request. The Dashboard numbers refreshed.
4. **Sync horizon**: Reports "Refresh and sync" and the Shopee history button now sync `requiredSyncDays(rangeStart, previousStart, now)` days, so 30 days now syncs 62 days instead of 32. The automatic escrow sync on open keeps the old range-only horizon, so opening the page does not fetch more.
5. **Granularity**: `resolveGranularity` draws and highlights Daily when Monthly was chosen and the range becomes shorter than 25 days.

TDD: I wrote the tests first. RED: 7 failing assertions plus 4 test files failing on missing modules (`refreshPlan`, the hasHistory 10-hour and yesterday-afternoon cases, `requiredSyncDays`, and `workspaceRefresh`, `listFormat`, `chartGranularity`, `useFinancialMetrics.test.ts`). GREEN: `npx tsc --noEmit` is clean and `npm test` passes 41 files and 417 tests. `npm run build` passes, with initial JS at 890,517 bytes. I restored the regenerated plugin zips and the `version.json` timestamp.

AGENTS.md section 64 is updated: no slack, failed channels, refresh plan, sync horizon.
