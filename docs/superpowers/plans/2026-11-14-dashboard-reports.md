# Dashboard and Sales & Reports redesign: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dashboard becomes a calm summary with previous-period comparisons; Sales & Reports keeps its content but is rebuilt on the design kit; both use one shared metrics loader so their numbers agree.

**Architecture:** Extract the data loading in `src/pages/ReportsPage.tsx` (webstore 500 orders, Shopee and TikTok caches, normalizers, `aggregateFinancialMetrics` from `src/lib/financialAnalyticsService.ts`) into a hook. A pure helper computes the current and previous windows and the change. Both pages render from it with the kit.

**Tech Stack:** React 19, TypeScript, Tailwind tokens, kit `src/components/ds`, recharts 3, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-dashboard-reports-design.md`

## Global Constraints
- No change to money rules: reuse `normalize*` and `aggregateFinancialMetrics` as they are; cancelled, refunded and unpaid orders stay excluded (AGENTS.md s9). CSV export and Shopee history backfill behave as today.
- AGENTS.md s62: tokens only, kit components (KpiCard, Card, Tabs, Select, Button, SearchField, StatusChip, Menu), no native select, no /NN on token colours, no legacy palette classes, no backdrop blur, bg-pop for floating surfaces (chart tooltips), light and dark. Charts follow the `dataviz` skill (load it before writing chart code): token colours, few gridlines, readable in both themes.
- AGENTS.md s61: the Dashboard must not trigger the app-wide 500-order list if the shared hook loads its own data (update `SELF_LOADING_TABS` / `tabNeedsOrderList` accordingly and keep the initial JS under 900,000 bytes; pages stay lazy-loaded).
- AGENTS.md s3: no localStorage for shared state (a remembered period choice per viewer is fine).
- English UI, no em dashes, IDR formatting as the pages use today.
- No version bump (unreleased 0.1.228 on `design/manager-redesign`).

## Review Focus
1. Not enough history for the previous window (marketplace caches about 30 days, webstore 500 orders): show "Not enough history", never a wrong percentage.
2. Previous period with zero (division by zero): show "New" or no percentage, never Infinity or NaN.
3. A marketplace fetch fails: page still renders with the other channels and a small notice.
4. Shop manager role: whatever the Dashboard showed or hid for them today stays the same (check App routing and `isShopManager`).
5. Dashboard and Reports show the same Sales, Orders and AOV for the same period and channels.

---

### Task 1: Shared loader and comparison
**Files:** Create `src/hooks/useFinancialMetrics.ts`, `src/lib/periodComparison.ts`, `src/lib/periodComparison.test.ts`; modify `src/pages/ReportsPage.tsx` to use the hook (no visual change yet).
- Produces `periodWindows(preset, now): { current: {startMs, endMs}; previous: {startMs, endMs} }` for today, 7 days, 30 days, this month (previous = same length immediately before; this month vs the same number of days of last month), `compareMetric(cur, prev, coverage): { value; delta: number | null; state: 'up' | 'down' | 'flat' | 'new' | 'no-history' }`, and `hasHistory(oldestRecordMs, previousStartMs)`.
- [ ] Tests first (store timezone Asia/Jakarta via the existing formatters): window boundaries for each preset; delta +12% case; previous 0 gives `new`; missing history gives `no-history`; flat within 0.5%. Watch fail, implement, pass. Commit `feat(reports): shared financial metrics loader and period comparison`.

### Task 2: Dashboard
**Files:** Rewrite `src/pages/DashboardPage.tsx`; new parts in `src/components/dashboard/` as needed; remove now-unused dashboard components only if nothing else imports them.
- [ ] Layout per the spec sketch: period tabs; five KpiCards (Sales, Orders, Avg order value, Payout after fees, Items sold) with change chips; sales trend card (current solid, previous dashed); sales by channel card with amount, share and change; top 5 products; Needs attention (Payment confirmed count and Warranty to review from `useOrderCounts`, linking to Orders and RMA; hidden counts when null); quick links (Full report, Orders, Reviews, Store health). No recent orders, no status ring.
- [ ] Tests for the KPI change chip states. Before and after screenshots at 1920x950 dark and light, and a check at 1366x768. Commit `feat(dashboard): summary with previous-period comparison`.

### Task 3: Sales & Reports
**Files:** `src/pages/ReportsPage.tsx`, `src/components/analytics/*`.
- [ ] Same content and controls on the kit: title row, date range and channel filter, KPI cards with change chips, restyled revenue chart, channel cards (Gross, Fees, Payout large; fee lines collapsible), top products, ledger in the Orders table style, backfill notice, export. Before and after screenshots both modes. Commit `feat(reports): rebuild sales and reports on the design kit`.

### Task 4: Docs and build
- [ ] AGENTS.md: section on the shared metrics hook, comparison rules and dashboard contents; CHANGELOG 0.1.228 lines. `npx tsc --noEmit`, `npm test`, `npm run build`, initial JS under 900,000 bytes. Commit `docs(dashboard): dashboard and reports redesign`.
