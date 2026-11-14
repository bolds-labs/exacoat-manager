# Exacoat Manager Redesign: Design

Date: 2026-11-14
Size: project (multi-phase)
Mockups (open in a browser, they are self-contained HTML): `docs/superpowers/specs/2026-11-14-manager-redesign/`
- `orders-screen.html`: settled Orders screen, dark and light
- `order-panel.html`: settled order detail panel, courier order (dark) and warranty order (light)
- `design-sheet.html`: approved shared design sheet (tokens, components, Refund pop-up, toast)
- `status-styles.html`: status style comparison; style C was chosen

## 1. Intent

The owner and staff both find Exacoat Manager cramped and badly designed: tiny text (89% of visible text on Orders is 8 to 12px), low contrast, stacked pills and badges, big boxes above the data, one-off styles per screen. The goal is a premium, modern, clean manager that is comfortable on the staff laptop (14 inch, 1920x1080 at 100% scaling, about 1920x950 of browser space) and consistent across every screen, in both dark and light mode.

Why now: speed and security were fixed first (v0.1.224 to v0.1.226). The look is the last item from the owner's list.

## 2. Goals

1. One shared design system (tokens and components) that every screen uses. Same colours, status names, fonts, sizes, spacing, controls, cards, menus, pop-ups and toasts everywhere.
2. Orders screen and order detail panel rebuilt exactly as the settled mockups.
3. Dark mode (default) and light mode, switchable from the top bar, both first-class.
4. Readable on the staff laptop: body text 14px, nothing below 12px except tiny count badges (11.5px).
5. No information lost: every field and action in today's screens stays available (see section 8 for the order panel inventory).
6. Every phase ships on its own and keeps the app fully usable.

## 3. Non-goals

- Changing business logic, data flows, REST endpoints or WordPress plugin behaviour. This is a presentation change. The only allowed logic touches are ones the new layout needs (for example a status chip reading an existing status value). One exception, approved by the owner: a new read-only counts endpoint (section 8.1).
- Mobile-first redesign. The app must stay usable on narrow screens (it already has a mobile bottom bar), but desktop 1920x950 is the target.
- The storefront (exacoat-web).
- Rewriting Configurator Studio internals. It gets the new shell, tokens and shared components in the last phase only.

## 4. Anti-goals (would make this a failure even if it technically works)

- Dropping fields or actions staff use today, or hiding them behind extra clicks without reason.
- A "minimal" look that shows less information. The owner explicitly rejected over-minimal versions.
- Regressing performance: no catch-all vendor chunk, no animated or large blur filters on always-visible layout, no new large downloads at startup (see AGENTS.md section 61).
- Visual inconsistency between redesigned screens (different control heights, different status words for the same state, one-off colours).
- Breaking print outputs (labels, packing slips, invoices). Their printed content is out of scope; only the pop-up chrome around them changes.

## 5. Constraints (from AGENTS.md and this project)

- English UI. Indonesian only in marketplace channel contexts (Shopee and TikTok tabs and their native status labels).
- No em dashes anywhere (UI copy, comments, commits, docs).
- No sparkle icons. Use purposeful icons (lucide-react, already installed).
- Shared operational state never in localStorage. Theme preference per browser is fine (already `exacoat_theme`).
- Version bump and plugin packaging protocol (AGENTS.md section 2) on every release.
- Performance invariants (AGENTS.md section 61).
- AGENTS.md section 36 says page titles use Chakra Petch. The owner approved Geist for all UI text, including titles. The brand wordmark stays the official SVG logo. Section 36 must be updated as part of phase 1.
- The official logo is `src/components/ui/ExacoatLogo.tsx` (variant `current`, white in dark, near-black in light, amber registered mark), with the existing ERP badge next to it. Never a made-up logo.

## 6. Approaches considered

- **A. Foundation first, then screen by screen (chosen by the owner).** Build tokens and the shared component kit, apply new fonts, colours and minimum sizes globally, then redesign screens in priority order. Every phase ships alone; staff screens benefit first. Trade-off: for a while, redesigned screens sit next to older layouts (which already share the new tokens and fonts).
- B. Restyle only. Swap fonts and colours and raise text sizes everywhere without layout changes. Rejected: does not deliver the approved Orders and panel layouts.
- C. Rebuild every screen at once on a branch. Rejected: weeks with nothing shipped, very risky single release of a 125k-line app used daily.

## 7. Design system (decided)

### 7.1 Colour tokens

Defined as CSS variables on `:root` (light) and `.dark` (dark), mapped into Tailwind theme names so components use semantic classes (for example `bg-card`, `text-muted`) instead of raw zinc or neutral values.

| Token | Dark | Light | Use |
|---|---|---|---|
| bg | #09090b | #f4f4f1 | page background |
| panel | #0e0e11 | #f8f8f6 | drawers, side panels |
| card | rgba(255,255,255,.025) on bg (#141418 for menus and pop-ups) | #ffffff | cards, menus, pop-ups |
| card-border | rgba(255,255,255,.065) | rgba(24,24,27,.08) | card and panel borders |
| field | rgba(255,255,255,.04) | #fafaf9 | inputs, selects, secondary buttons |
| field-border | rgba(255,255,255,.08 to .09) | rgba(24,24,27,.10 to .11) | |
| text | #e8e8eb | #18181b | main text |
| muted | #a1a1aa | #5b5b63 | secondary text |
| faint | #6e6e78 | #9a9aa2 | labels, hints, column headers |
| line | rgba(255,255,255,.07) | rgba(24,24,27,.07) | dividers |
| chip | rgba(255,255,255,.06) | rgba(24,24,27,.05) | neutral chips, count pills |
| accent | #f3aa18 | #f3aa18 (text uses #b45309 on light) | primary button, active item, waiting-work counts |
| accent-soft | rgba(243,170,24,.13) | rgba(243,170,24,.16) | accent tints |

Background glow: static radial gradients only (already in Layout since v0.1.226), at about half the old strength.

Glass: kept but toned down. Cards use a subtle gradient (dark: rgba(255,255,255,.032) to .014) with a faint top highlight, no backdrop-filter, shadow at most `0 1px 2px`.

### 7.2 Status system (decided: style C)

Each colour has one meaning; the icon tells statuses inside a group apart. Chip: icon (14px) plus label, 12.5px medium, 7px radius, tinted background, no border. Light mode uses darker text colours (see design sheet).

| Family | Colour (dark text / tint) | Meaning |
|---|---|---|
| act | #fbbf24 / amber 10% | needs staff action |
| wait | #c4b5fd / violet 11% | waiting on customer |
| prog | #7dd3fc / sky 10% | in progress |
| done | #4ade80 / green 9% | finished |
| stop | #fb7185 / rose 9% | stopped |

WooCommerce status mapping (one shared map, used by list chips, panel chips, progress control, dashboard, filters):

| WooCommerce status(es) | Label | Family | Icon (lucide) |
|---|---|---|---|
| pending, on-hold, pending-payment | Awaiting payment | wait | Clock |
| processing | To prepare | act | Package |
| preparing-order, in-production | Preparing | prog | Wrench |
| ready-to-ship, awaiting-pickup (courier orders) | Waiting for courier | prog | Hourglass |
| ready-to-ship, awaiting-pickup (store pickup orders, as the drawer does today) | Ready for pickup | prog | Store |
| smb-ready | Ready for pickup | prog | Store |
| smb-picked, and completed on store pickup orders | Picked up | done | CircleCheck |
| shipped | Shipped | prog | Truck |
| delivered | Delivered | done | PackageCheck |
| completed | Completed | done | CircleCheck |
| cancelled | Cancelled | stop | XCircle |
| refunded | Refunded | stop | Undo2 |
| failed | Payment failed | stop | AlertCircle |

The status map is context-aware: it takes the order (status plus whether it is a store pickup order, using the existing `isStorePickupOrder` logic), not the bare status string. "Pending review" is not an order status; it appears only inside the Warranty chip (the design sheet's "Pending review" status chip was illustrative only).

Warranty claim chip (split chip, shown under the order number on warranty orders): left part "Warranty" with a shield icon (green tint), right part the claim review state: Pending (amber), Approved (green), Rejected (rose). Payment never appears in this chip; payment state lives in the status column.

Marketplace views (Shopee, TikTok) keep their native labels (Indonesian allowed there) but use the same chip component, families and icons via their own mapping table.

### 7.3 Typography

- UI: Geist (400, 500, 600). Numbers, order IDs, money, resi: Geist Mono (400, 500). Load from Google Fonts in `index.html` (already loads Chakra Petch there).
- Sizes: page title 26/600 (letter-spacing -0.025em), card title 14/600, body 14/400, names and emphasis 500, secondary 13, labels and column headers 12, count badges 11.5. Nothing else smaller.
- Bold (600) only for titles, the primary button and order totals.

### 7.4 Spacing, shape, controls

- Spacing steps of 4px. Page padding 28px. Card padding 18 to 20px, radius 14px, gap between cards 16px.
- Controls (button, input, select, search) 36px high, 9px radius. Small controls in card headers 30px, 8px radius.
- Buttons: primary (amber fill, dark text, 600), secondary (field fill and border), ghost, danger (rose text and tint), icon-only (36x36).
- Checkbox 15 to 16px, 4 to 5px radius. Switch 30x18.

### 7.5 Components to build or rebuild (shared kit)

Button, IconButton, TextField, Select (with optional trailing service tag), SearchField (Ctrl K hint), Card (header: icon + title left, actions right), StatusChip, WarrantyChip, CountPill, Tabs (pill style with count pills; amber count only where work is waiting), Switch, Checkbox, Radio card (option tile as in the Refund pop-up), Menu (dropdown with icon, title, one-line description, separators, danger items), Modal (header with title and mono reference, body, footer with ghost Cancel and primary action on a slightly tinted bar), Toast (icon tile, title, one line), Drawer/Panel (pinned header, scrolling body), Sidebar item (soft background plus the small separate amber bar at the left edge, exactly like today's sidebar; never a bordered edge with radius on the item), KPI card (icon tile, number in mono, label), DataTable styles (column headers 12px faint, rows 13 to 14px, hover tint, checkbox column).

Existing ui components (`Button`, `Modal`, `Select`, `Input`, `GlassCard`, `PageHeroHeader`, `FilterSelect`, `Tabs`, `StatCard`, `SlideDrawer`, shadcn-style `dialog`, `dropdown-menu`, `switch`, `checkbox`, `table`) are restyled or replaced in place so existing screens pick up the new look where they already use them.

### 7.6 App shell

- Sidebar 248px: official logo plus ERP badge, nav groups (Operations, Catalog, Growth, plus existing ones as needed), lucide icons, counts on items with waiting work (amber only on the active item, grey otherwise), Orders shows its sub-pages beneath (All orders, Custom label, Export shipments, Tracking pool) with a thin left guide line, user block at the bottom with role and settings.
- Top bar 58px: breadcrumb (section / page), centred search with Ctrl K, theme switch (Dark / Light). No backdrop blur.
- Role behaviour unchanged (shop managers see only their allowed tabs).

## 8. Screens

### 8.1 Orders screen (settled, see orders-screen.html)

- Title row: "Orders" plus one-line description; right side: icon-only Refresh and an amber "Create" dropdown containing Warranty claim, Redeem, Endorsement, Custom label (each with icon and one-line description).
- Channel switcher: Exacoat webstore, Shopee Indonesia, TikTok Shop, each with a count.
- Four compact KPI cards with icons: To prepare (amber icon, the actionable one), Awaiting payment, Ready for pickup, Shipped in the last 7 days (grey icons).
- Table card: pill tabs with counts (All, Awaiting payment, To prepare, Preparing, Waiting for courier, Ready for pickup, Shipped, Completed, Warranty claims), then a "More" pill dropdown holding today's remaining tabs (Redeem, Endorsements, Store pickup: all, ready, picked up) so nothing is lost and the row fits. Builder's call recorded here: Ready for pickup stays pickup-only; Waiting for courier is the courier equivalent (today's "Waiting for Pickup" tab).
- Filters on the right of the tab row: All couriers, All labels, and the table search field (server-side search across all statuses, as today; staff use it daily for resi and customer lookups, so it stays even though the mockup omitted it). The top bar search remains the Ctrl K command palette.
- Bulk selection actions, pagination and page size stay as today, restyled.
- Counts (approved by the owner): a new read-only plugin endpoint, for example `GET /wp-json/exacoat-core/v1/orders/counts`, protected by `verify_bridge_permission`, returns webstore counts per status family and tab (including warranty claims, redeem, endorsements and store pickup states), Shopee and TikTok order counts from their existing caches, and shipped in the last 7 days. It returns numbers only, never order data, and must stay fast (count queries, no order formatting). The KPI cards, tab counts, channel switcher counts and sidebar badges all read from it. Plugin version bump per AGENTS.md section 2.
- Columns: checkbox | Order (ID in mono, date under it, then the Warranty split chip when relevant) | Customer & destination (name, then city and province; store pickup orders show plain "Store Pickup" text, no pill) | Items ("1 item" with a package icon, product name under it, truncated) | Total (mono, payment method under it) | Status (style C chip only, no labels) | Courier & resi (courier and service, resi in mono with copy, or "Resi not assigned yet"; store pickup shows store icon and pickup location) | Actions (eye; amber printer when label not printed; violet shield when a claim needs review).
- Rows are two lines (three when a warranty chip is present). Long text truncates with ellipsis; nothing wraps into tall rows.
- Fixed column widths tuned for about 1600px of content width (see mockup).

### 8.2 Order detail panel (settled, see order-panel.html)

Panel opens on the right, about 1180px wide on a 1920 screen, pinned header, scrolling body.

Header:
- Order ID (mono) with copy, warranty split chip or Store Pickup chip when relevant.
- Meta line: created date and time, payment method, IP when present.
- Actions: Print label (primary), Invoice, Packing slip, More dropdown (Warranty, Redeem and other secondary actions), close.
- Warranty claim banner when the order is a warranty replacement: title (for example "48-hour installation warranty replacement"), original reference and channel, reason, Review claim proof button.
- Status navigator: previous step block (arrow, subtle step icon, caption "Previous", step name), current step block (tinted icon tile in the status family colour, step name, caption "Step N of M", small segment track: done green, current amber), next step block (caption "Next step", step name, step icon, arrow; clicking moves the order to that step), and an "All steps" dropdown to jump to any step. Courier flow steps: Awaiting payment, To prepare, Preparing, Waiting for courier, Shipped, Completed. Pickup flow: Awaiting payment, To prepare, Preparing, Ready for pickup, Picked up. Whatever the current status change rules are (confirmations, emails, store pickup transitions) stay exactly as today.

Body, left column:
- Customer & delivery: header switch "Store pickup" (or "Switch to courier" on pickup orders). Left: Recipient, Email (copy), Phone (copy, WhatsApp), labels above values. Right, after a divider: Destination address with Edit (pickup orders: store pickup location card content, Edit, Switch to courier).
- Items: count and total units, Add item. Each item: thumbnail, quantity, full name, product ID (mono), configuration as small labelled tags, price, Edit configuration.
- Shipping & tracking (courier orders): Courier select with service tag, Tracking number input, Save tracking, "Label not printed" warning when relevant. Pickup orders show the store pickup notice and Workshop label button instead.
- Activity & notes: count, All / Customer notes filter, Add note, full log entries with author and time.

Body, right column (cards):
- Order summary: Refund button in header; currency, items subtotal, shipping line with method, unique payment code when present, order total; payment status chip with paid date and method or the exact pending amount; payment reference in mono.
- Coupons & adjustments: always shown; empty state "No coupons or adjustments".
- Review & feedback: state pill (for example Pre-delivery), review content when one exists, otherwise the invitation note.
- Resend transactional email: template select, recipient field, Send, Delivery logs link, Open store order link.
- Administrator actions (admins only, "Admin only" pill): Cancel order (danger), Move to trash.

Anything else today's panel renders conditionally (guarantee refund flow with Approve & Issue Refund and Mark Package Received, AWB PDF, custom skin asset download, tracking links, store credit info) moves into the matching card above using the same components. Builder: diff the final panel against `OrderDetailDrawer.tsx` and list every conditional block before deleting any.

### 8.3 Pop-ups, menus, toasts (decided pattern, see design-sheet.html)

Refund pop-up is the reference: header (title plus mono order ID, close), body (summary box, radio-card choice Original payment vs Store credit, Amount and Reason fields side by side, Restock items checkbox, hint line; store credit choice also shows the shipping subsidy deduction and suggested net refund as today), footer (ghost Cancel, primary action with the amount). All pop-ups in the app follow this layout. Destructive confirmations use the danger button in the footer.

### 8.4 Remaining screens

Each gets the shell, tokens and shared components, and a layout pass that follows the same rules (title row, compact KPI cards where useful, table card with pill tabs, cards with icon-title-actions headers, 36px controls). No separate mockup round per screen unless the owner asks; the builder shows a before and after screenshot per screen for sign-off.

## 9. Phases

1. Foundation: tokens (CSS variables plus Tailwind mapping), Geist fonts, shared kit (section 7.5), app shell (sidebar, top bar, theme switch), status map module, AGENTS.md section 36 update and a new design-system section. Fonts and colour tokens apply app-wide immediately; the 12px minimum text size is applied per screen as each screen is redesigned (no blanket CSS floor, which would break dense older layouts). Print content (labels, packing slips, invoices) and Configurator Studio are exempt until their own phase.
2. Orders: counts endpoint, Orders screen, order detail panel, and the pop-ups opened from them (refund, cancel, trash, print label, packing slip and invoice chrome, edit item, edit address, warranty review, redeem, create menu flows). Shopee and TikTok views (`ShopeeOrdersView`, `TikTokOrdersView` and their detail modals) get the new tokens, fonts, status chips, table and card styling and 36px controls, but keep their current layout (owner decision).
3. Other staff screens: full layout rebuild of the Shopee and TikTok views and their detail modals to the Orders screen and order panel patterns, then Warranty and RMA, Export shipments, Tracking pool, Custom label, Reviews.
4. Everything else, one screen per release: Dashboard, Products, Customers, Reports and Skin Performance, Materials, Affiliates, Emails, AI tools, Settings and Team, System health, Audit logs, Testing sandbox, then Configurator Studio.

Each phase is one or more releases with a version bump, build, before and after screenshots at 1920x950 in dark and light, and a staff smoke test of the screens touched.

Mockup notes: the earliest mockups used a text logo, a Chakra Petch title, an Inter body and coloured KPI icons. Where a mockup and this document disagree, this document wins (official SVG logo, Geist everywhere, grey KPI icons except To prepare).

## 10. Left to the builder

- Exact Tailwind configuration approach for the tokens (CSS variables with Tailwind theme extension is expected).
- Component file structure, and whether to adapt or replace each existing ui component.
- Icon choices not listed here, as long as they follow the purposeful-icon rule.
- Exact column widths and truncation per screen, within the rules above.
- Order of work inside a phase.
