# Dashboard and Sales & Reports redesign (short design)

## Intent
Owner: the Dashboard should give the overall picture and the important numbers (sales, orders, average order value and similar), each compared with the previous period (last 7 days vs the 7 days before, and so on), without the recent order activity list. Sales & Reports keeps what it shows but must look clean, easy to read and consistent with the redesigned Orders screen.

## Goals
- Dashboard: a calm one-screen summary at 1920x950 and usable on a 14 inch 1080p laptop.
- Every Dashboard number has a comparison with the previous period of the same length.
- Dashboard and Reports use the same numbers: same data loading and the same `aggregateFinancialMetrics` rules (all channels; cancelled, refunded and unpaid orders excluded, AGENTS.md s9).
- Both pages on the design kit and tokens, light and dark.

## Non-goals
- No change to how money is calculated, fees, payouts or the CSV export.
- No new backend endpoint.

## Approaches
1. **One shared metrics loader for both pages, both rebuilt on the kit (chosen).** The Dashboard today computes its own numbers from the 500 latest webstore orders only, so it disagrees with Reports and ignores Shopee and TikTok. Moving the Reports loading into a shared hook gives one truth and makes the comparison easy (run the same aggregation on the previous window).
2. Restyle both pages only. Rejected: the Dashboard would keep numbers that differ from Reports, and the comparison would only cover webstore orders.

## Dashboard (my layout; you can change it)
```
Dashboard                                     [Today] [7 days] [30 days] [This month]   Refresh
-------------------------------------------------------------------------------------------------
| Sales            | Orders           | Avg order value  | Payout after fees | Items sold       |
| Rp 42.8 jt       | 198              | Rp 225.293       | Rp 38.1 jt        | 260              |
| +12% vs prev 7d  | -4% vs prev 7d   | +16%             | +10%              | +3%              |
-------------------------------------------------------------------------------------------------
| Sales trend: this period (solid) vs previous (dashed) | Sales by channel                       |
|                                                       | Webstore 58%  Shopee 30%  TikTok 12%   |
|                                                       | each with amount and change            |
-------------------------------------------------------------------------------------------------
| Top products (5)                  | Needs attention                  | Quick links             |
| name, units, sales                | Payment confirmed 7  -> Orders   | Full report, Orders,     |
|                                   | Warranty to review 2 -> RMA      | Reviews, Store health    |
```
- Change shown as a small up or down chip (done or stop family colours), "vs previous 7 days" on hover and in a caption.
- When the loaded data does not reach back to the start of the previous period (marketplace caches keep about 30 days), the change chip is replaced by "Not enough history" instead of a wrong number.
- Recent order activity, the order status ring and the long order list are removed.

## Sales & Reports
Same content and controls (date range, channel filter, KPI cards, revenue chart, channel reconciliation and fees, top products, ledger, Shopee history backfill notice, export), rebuilt on the kit:
- Title row with the date range and channel filter as kit tabs; one row of kit KPI cards (with the same previous-period change chips).
- Revenue chart restyled with tokens (fewer gridlines, one accent per channel, tooltip on `bg-pop`).
- Channel reconciliation as one clean card per channel: Gross, Fees, Payout in large numbers, the fee lines in a collapsible list instead of always-open dense rows.
- Ledger table in the Orders table style.

## Left to the builder
Exact chart styling within the dataviz rules, component split, empty and loading states, before and after screenshots for sign-off.
