# Manager Redesign, Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared design system (tokens, fonts, status map, component kit, app shell) so every later screen is built from the same pieces, and every existing screen picks up the new fonts and colours immediately.

**Architecture:** Colour tokens are CSS variables on `:root` (light) and `.dark` (dark) in `src/index.css`, exposed to Tailwind as semantic colour names. A new kit in `src/components/ds/` implements the design sheet; legacy `src/components/ui/` components are restyled to the tokens without API changes. Order status presentation comes from one pure module, `src/lib/orderStatus.ts`. A hidden `#design-system` tab renders every kit component for visual checks.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 3 (`darkMode: 'class'`), lucide-react, Radix (dialog, dropdown-menu already installed), sonner, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-manager-redesign-design.md` (sections 5, 7, 9 phase 1). Mockups: `docs/superpowers/specs/2026-11-14-manager-redesign/design-sheet.html`, `orders-screen.html` (shell only).

## Global Constraints

- English UI; no em dashes in code, comments, copy, commits; no sparkle icons.
- Never store shared operational state in localStorage (theme preference `exacoat_theme` is fine).
- Performance invariants (AGENTS.md section 61): no catch-all vendor chunk, no animated or large blur on always-visible layout, no `backdrop-filter` in the shell.
- Official logo only: `ExacoatLogo` variant `current` plus the existing ERP badge.
- Control heights: 36px (`h-9`), small controls in card headers 30px (`h-[30px]`); control radius 9px, card radius 14px, card padding 18 to 20px, card gap 16px.
- Type: Geist 400/500/600 for UI, Geist Mono 400/500 for IDs, money, resi; sizes 26 / 14 / 14 / 13 / 12, count badges 11.5; 600 only for titles, primary button, totals.
- Token values are exactly the table in spec section 7.1; status families exactly section 7.2.
- New components must not use the legacy colour classes overridden in `index.css` (`bg-zinc-900`, `bg-neutral-900`, `bg-[#141417]`, and the rest of the `html:not(.dark)` list); use token classes only.
- Version bump protocol (AGENTS.md section 2) for the release task. Pin any new dev dependency to an exact version.

## Review Focus

1. Light mode on screens not yet redesigned: the legacy `html:not(.dark)` overrides plus the new token body colours must not produce dark text on dark or white on white; spot-check Orders, Settings, Configurator Studio in light mode after Task 1 and Task 7.
2. Unknown or new WooCommerce statuses (for example a future custom status): the status chip must still render with the raw label prettified and a neutral style, never crash or show blank.
3. Store pickup orders in `ready-to-ship` / `awaiting-pickup` must read "Ready for pickup", not "Waiting for courier" (Task 2 test).
4. Shop managers: the redesigned sidebar must show only their allowed tabs (`SHOP_MANAGER_ALLOWED_TABS` in `App.tsx`), same as today.
5. Print previews (`ShippingLabelA6Modal`, `PackingSlipModal`, `CustomerInvoiceModal`) must look identical after the font swap where they print; they may set their own fonts explicitly (Task 1 check).

---

### Task 1: Tokens, fonts, Tailwind mapping

**Files:**
- Modify: `src/index.css` (`@layer base :root` block and `body`), `tailwind.config.js` (`theme.extend.colors`, `fontFamily`), `index.html:16` (Google Fonts link)
- Create: `src/lib/designTokens.ts`, `src/lib/designTokens.test.ts`

**Interfaces:**
- Produces: Tailwind colour names `bg`, `panel`, `card`, `card-border`, `field`, `field-border`, `fg`, `muted`, `faint`, `line`, `chip`, `accent`, `accent-soft`, `accent-fg` (amber text: #f3aa18 dark, #b45309 light), and per family `st-act`, `st-wait`, `st-prog`, `st-done`, `st-stop` each with `-fg` and `-bg` (for example `text-st-act-fg bg-st-act-bg`). Font families `sans` = Geist, `mono` = Geist Mono, `heading` = Geist (keep the `chakra` key unchanged for legacy uses).
- Produces: `export const TOKEN_NAMES: readonly string[]` in `src/lib/designTokens.ts` listing every CSS variable name (for tests and the design-system page).

- [ ] **Step 1: Write the failing test** `src/lib/designTokens.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { TOKEN_NAMES } from './designTokens';
import config from '../../tailwind.config.js';

const css = readFileSync('src/index.css', 'utf8');
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
const darkBlock = css.slice(css.indexOf('.dark {'), css.indexOf('}', css.indexOf('.dark {')));

describe('design tokens', () => {
  it('defines every token in light and dark', () => {
    for (const name of TOKEN_NAMES) {
      expect(lightBlock).toContain(`--${name}:`);
      expect(darkBlock).toContain(`--${name}:`);
    }
  });
  it('uses the spec values for key tokens', () => {
    expect(darkBlock).toMatch(/--bg:\s*#09090b/);
    expect(lightBlock).toMatch(/--bg:\s*#f4f4f1/);
    expect(darkBlock).toMatch(/--fg:\s*#e8e8eb/);
    expect(lightBlock).toMatch(/--fg:\s*#18181b/);
    expect(darkBlock).toMatch(/--accent:\s*#f3aa18/);
  });
  it('maps tokens into Tailwind and sets Geist fonts', () => {
    const colors = (config as any).theme.extend.colors;
    expect(colors.card).toBe('var(--card)');
    expect(colors['st-act'].fg).toBe('var(--st-act-fg)');
    expect((config as any).theme.extend.fontFamily.sans[0]).toBe('Geist');
    expect((config as any).theme.extend.fontFamily.mono[0]).toBe('"Geist Mono"');
  });
});
```

- [ ] **Step 2: Run** `npm test -- src/lib/designTokens.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement.** Add the variables to `:root` (light values) and a new `.dark {}` block (dark values) inside `@layer base`, keeping the existing legacy variables (`--bg-primary` and friends) so old CSS keeps working. Set `body` font to `Geist, ui-sans-serif, system-ui, sans-serif`, background `var(--bg)`, colour `var(--fg)`. Replace the Google Fonts link in `index.html` with Chakra Petch (kept for legacy pages) plus `Geist:wght@400;500;600` and `Geist+Mono:wght@400;500`; remove the `@import` of Plus Jakarta Sans and Montserrat from `index.css` only if no file references `font-montserrat`/`font-bebas` (grep first; keep them otherwise). Halve the alpha of the three static background gradients in `src/components/layout/Layout.tsx` (spec 7.1). Status family values from spec 7.2 (dark fg / light fg in the design sheet: act #fbbf24/#b45309, wait #c4b5fd/#6d28d9, prog #7dd3fc/#0369a1, done #4ade80/#15803d, stop #fb7185/#be123c; bg tints as listed).

- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS, no type errors.

- [ ] **Step 5: Visual check.** Start `manager-dev` (`.claude/launch.json`), open Orders, Settings and Configurator Studio at 1920x950 in dark and light; confirm text renders in Geist, nothing is unreadable (Review Focus 1), and the three print previews (open one order, Packing slip and Invoice; Custom label page) look as before (Review Focus 5). If a print preview changed, pin its previous font family on its print container.

- [ ] **Step 6: Commit** `feat(design): add colour tokens and Geist fonts`

### Task 2: Order status map

**Files:**
- Create: `src/lib/orderStatus.ts`, `src/lib/orderStatus.test.ts`

**Interfaces:**
- Consumes: `isStorePickupOrder(order)` from `src/lib/orderUtils.ts`; `Order` from `src/types`.
- Produces:
  - `export type StatusFamily = 'act' | 'wait' | 'prog' | 'done' | 'stop' | 'neutral'`
  - `export interface StatusMeta { key: string; label: string; family: StatusFamily; icon: LucideIcon }`
  - `export function getOrderStatusMeta(order: Pick<Order, 'status'> & Partial<Order>): StatusMeta`
  - `export function getWarrantyClaimMeta(order: Partial<Order>): { label: 'Pending' | 'Approved' | 'Rejected'; family: StatusFamily } | null` (null when the order is not a warranty replacement; reads `rma.status` first, then `warranty_claim_status`, per AGENTS.md section 7)
  - `export interface StatusStep { status: string; label: string; icon: LucideIcon }`
  - `export function getStatusSteps(order: Partial<Order>): StatusStep[]` (courier flow or pickup flow) and `export function getCurrentStepIndex(order: Partial<Order>, steps: StatusStep[]): number`

- [ ] **Step 1: Write failing tests** covering, as `it.each` rows, every row of spec section 7.2's WooCommerce table (input status, expected label and family), with `wc-` prefixes stripped (`wc-processing` behaves like `processing`). Plus:
  - pickup context: `{ status: 'ready-to-ship', shipping_lines: [{ method_id: 'local_pickup' }] }` (or whatever input makes `isStorePickupOrder` true; check its implementation) gives `Ready for pickup`, family `prog`; `completed` on a pickup order gives `Picked up`.
  - unknown status `'awaiting-qc'` gives label `Awaiting qc`, family `neutral` (Review Focus 2).
  - `getWarrantyClaimMeta`: non-warranty order gives null; `rma: { order_type: 'Warranty', status: 'approved' }` with stale `warranty_claim_status: 'pending'` gives Approved; `pending` and `in_review` give Pending; `rejected` gives Rejected.
  - `getStatusSteps` returns the six courier labels `Awaiting payment, To prepare, Preparing, Waiting for courier, Shipped, Completed` for a courier order and the five pickup labels `Awaiting payment, To prepare, Preparing, Ready for pickup, Picked up` for a pickup order; each step's `status` is the WooCommerce status the existing drawer timeline sends (`on-hold, processing, preparing-order, ready-to-ship, shipped, completed` and `on-hold, processing, preparing-order, smb-ready, completed`, from `OrderDetailDrawer.tsx` around line 1480).
  - `getCurrentStepIndex` for `processing` is 1; for `pending` is 0; for `delivered` on the courier flow is 5.

- [ ] **Step 2: Run** `npm test -- src/lib/orderStatus.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** with a lookup table keyed by normalised status; icons from lucide-react as in spec 7.2 (Clock, Package, Wrench, Hourglass, Store, CircleCheck, Truck, PackageCheck, XCircle, Undo2, AlertCircle).

- [ ] **Step 4: Run** `npm test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(design): add shared order status map`

### Task 3: Component test setup and kit primitives

**Files:**
- Modify: `package.json` (devDependencies `jsdom` and `@testing-library/react`, exact versions), `vitest.config.ts` or `vite.config.ts` test block (`environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']]`)
- Create: `src/components/ds/Button.tsx`, `IconButton.tsx`, `CountPill.tsx`, `TextField.tsx`, `Select.tsx`, `SearchField.tsx`, `Checkbox.tsx`, `Switch.tsx`, `RadioCard.tsx`, `index.ts`, `primitives.test.tsx`

**Interfaces:**
- Produces (all forward refs and spread native props):
  - `Button({ variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; icon?: LucideIcon; trailingIcon?: LucideIcon })` (md = `h-9`, sm = `h-[30px]`)
  - `IconButton({ icon: LucideIcon; label: string; size?: 'md' | 'sm'; variant?: 'secondary' | 'ghost' })` (square, `aria-label={label}`)
  - `CountPill({ value: number; tone?: 'neutral' | 'hot' })`
  - `TextField({ label?: string; mono?: boolean; trailing?: ReactNode })`
  - `Select({ label?: string; value: string; options: { value: string; label: string }[]; onChange(v: string): void; tag?: string })` (native select styled, tag rendered as the service pill)
  - `SearchField({ placeholder: string; shortcut?: string })`
  - `Checkbox`, `Switch({ checked: boolean; onCheckedChange(v: boolean): void; label?: string })`, `RadioCard({ selected: boolean; icon: LucideIcon; title: string; description?: string; onSelect(): void })`

- [ ] **Step 1: Install** `npm install -D jsdom@<latest at least two weeks old> @testing-library/react@<same rule>` with exact versions, and add the jsdom glob.
- [ ] **Step 2: Write failing tests** in `primitives.test.tsx`: Button md has class `h-9`, sm has `h-[30px]`, primary has `bg-accent`; IconButton renders `aria-label`; CountPill tone hot uses `text-accent-fg`; TextField and Select render their label text and are `h-9`; Switch calls `onCheckedChange(true)` on click; RadioCard selected has `aria-checked="true"`.
- [ ] **Step 3: Run** `npm test -- src/components/ds`. Expected: FAIL.
- [ ] **Step 4: Implement** using only token classes (Global Constraints). Visual reference: design-sheet.html "Buttons", "Fields", "Tabs, switch, navigation".
- [ ] **Step 5: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(design): add kit primitives`

### Task 4: Kit composites: Card, KPI, Tabs, chips, Menu, Modal, Drawer, Toast

**Files:**
- Create: `src/components/ds/Card.tsx`, `KpiCard.tsx`, `Tabs.tsx`, `StatusChip.tsx`, `WarrantyChip.tsx`, `Menu.tsx`, `Modal.tsx`, `Drawer.tsx`, `toast.ts`, `composites.test.tsx`; update `src/components/ds/index.ts`
- Modify: `src/components/ui/sonner.tsx` (toast styling to tokens)

**Interfaces:**
- Consumes: Task 2 `getOrderStatusMeta`, `getWarrantyClaimMeta`; Task 3 primitives.
- Produces:
  - `Card({ icon?: LucideIcon; title?: ReactNode; count?: number; actions?: ReactNode; children })` (header row 30px: icon and title left, actions right; padding 18 to 20px; radius 14px)
  - `KpiCard({ icon: LucideIcon; value: ReactNode; label: string; highlight?: boolean })` (value in mono; icon tile amber only when highlight)
  - `Tabs({ items: { key: string; label: string; count?: number; hot?: boolean }[]; value: string; onChange(key: string): void; trailing?: ReactNode })` (pill tabs)
  - `StatusChip({ order?: Partial<Order>; meta?: StatusMeta; size?: 'md' | 'sm' })` (order wins over meta)
  - `WarrantyChip({ order: Partial<Order> })` (renders null when `getWarrantyClaimMeta` is null)
  - `Menu({ trigger: ReactNode; items: ({ icon: LucideIcon; title: string; description?: string; onSelect(): void; danger?: boolean } | 'separator')[]; align?: 'start' | 'end' })` built on `@radix-ui/react-dropdown-menu`
  - `Modal({ open: boolean; onOpenChange(v: boolean): void; title: string; reference?: string; children; footer?: ReactNode; width?: number })` built on `@radix-ui/react-dialog` (header, body, tinted footer bar)
  - `Drawer({ open: boolean; onOpenChange(v: boolean): void; header: ReactNode; children; width?: number })` (pinned header, scrolling body, default width 1180, `max-w-[calc(100vw-48px)]`)
  - `toast.success(title: string, description?: string)`, `toast.error(...)` wrappers around sonner

- [ ] **Step 1: Write failing tests** in `composites.test.tsx`: StatusChip for `{ status: 'processing' }` shows "To prepare" with class `text-st-act-fg`; StatusChip for a pickup order in `smb-ready` shows "Ready for pickup"; WarrantyChip renders "Warranty" and "Pending" for a pending warranty order and nothing for a normal order; Tabs marks the active item `aria-selected="true"` and renders hot counts with `text-accent-fg`; Card renders title and actions; Modal renders title, reference and footer when open; Menu item with `danger` has class `text-st-stop-fg` (open the menu in the test with a pointer event on the trigger).
- [ ] **Step 2: Run** `npm test -- src/components/ds`. Expected: FAIL.
- [ ] **Step 3: Implement** to match design-sheet.html (Menu, Pop-up, Toast) and order-panel.html (Drawer, Card).
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(design): add kit composites`

### Task 5: Design system page

**Files:**
- Create: `src/pages/DesignSystemPage.tsx`
- Modify: `src/App.tsx` (lazy route for tab key `design_system`, URL `#design-system`, visible only to `super_admin`, not listed in the sidebar)

**Interfaces:**
- Consumes: everything exported from `src/components/ds`.

- [ ] **Step 1: Implement** a page that renders every kit component and state from design-sheet.html (all buttons, fields, tabs, switch, all status chips for every row of the status map, warranty chips, menu open, a modal trigger with the Refund example content, toast triggers, a KPI row, a Card), with a heading per group.
- [ ] **Step 2: Verify** in the browser at 1920x950: switch dark and light from the top bar; compare against design-sheet.html side by side; every control measures 36px (30px for small) using the browser inspector or `getBoundingClientRect`.
- [ ] **Step 3: Run** `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 4: Commit** `feat(design): add hidden design system page`

### Task 6: App shell: sidebar, top bar, layout

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/Layout.tsx`
- Test: `src/components/layout/sidebarNav.test.ts` (pure nav config), with the nav groups extracted to `src/components/layout/sidebarNav.ts`

**Interfaces:**
- Produces: `export interface NavItem { key: NavItemKey; label: string; icon: LucideIcon; children?: NavItem[] }`, `export const NAV_GROUPS: { label: string; items: NavItem[] }[]`, `export function navForRole(role: ExacoatRole): { label: string; items: NavItem[] }[]` in `sidebarNav.ts`. Sidebar accepts `counts?: Partial<Record<NavItemKey, number>>` (filled in Plan 2).

- [ ] **Step 1: Write failing tests:** `navForRole('shop_manager')` contains only keys in `SHOP_MANAGER_ALLOWED_TABS` (import it from `App.tsx` or move it into `sidebarNav.ts` and import it back into `App.tsx`); `navForRole('super_admin')` contains every existing nav key the current sidebar shows (list them from today's `Sidebar.tsx` before refactoring); no group is empty.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement** the shell per orders-screen.html and spec 7.6: 248px sidebar, `ExacoatLogo` plus ERP badge, groups Operations / Catalog / Growth (plus any group needed for existing items such as System), lucide icons, Orders children with thin guide line, active item soft background plus the separate 4x14px amber bar at the left edge (no bordered edge with radius), counts (`CountPill`, hot only on the active item), user block with role. Top bar 58px: breadcrumb (group / page), centred `SearchField` that opens the existing command palette on click and Ctrl K, theme switch Dark / Light using `ThemeContext`. No backdrop blur. Keep the mobile bottom bar working.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Verify** at 1920x950 and 375x812 in both modes; sign in as a shop manager account (owner provides) or use the existing role simulation to confirm Review Focus 4.
- [ ] **Step 6: Commit** `feat(design): redesign app shell`

### Task 7: Restyle legacy ui components to tokens

**Files:**
- Modify: `src/components/ui/Button.tsx`, `Modal.tsx`, `Input.tsx`, `Select.tsx`, `Tabs.tsx`, `GlassCard.tsx`, `StatCard.tsx`, `PageHeroHeader.tsx`, `SlideDrawer.tsx`, `Badge.tsx`, `ModalCard.tsx`, `FilterSelect.tsx`

**Interfaces:**
- No API changes. Visual-only: token colours, 36px controls, 9px and 14px radii, Geist, title sizes from Global Constraints, toned-down glass (spec 7.1).

- [ ] **Step 1:** For each file, record the props and variants it accepts (do not change them), then restyle with token classes.
- [ ] **Step 2: Run** `npx tsc --noEmit` and `npm test`. Expected: PASS.
- [ ] **Step 3: Verify** before and after screenshots at 1920x950 dark and light of Dashboard, Reviews, RMA Claims, Settings, Products (screens that use these components heavily); nothing broken or unreadable (Review Focus 1).
- [ ] **Step 4: Commit** `refactor(design): restyle shared ui components to tokens`

### Task 8: Docs and release

**Files:**
- Modify: `AGENTS.md` (section 36 typography rule: Geist for all UI text including titles, Chakra Petch no longer required; new section "Design System Invariants" summarising tokens, status map, kit location, control heights, and "build new UI from `src/components/ds`"), `CHANGELOG.md`, version files per AGENTS.md section 2 (`package.json`, `wordpress-plugin/exacoat-core/exacoat-core.php` header and constant, `scripts/package-plugin.cjs` changelog line)

- [ ] **Step 1:** Update docs; no em dashes (`git diff | grep -c "—"` prints 0).
- [ ] **Step 2: Run** `npm test`, then `npm run build`. Expected: all tests pass, build exits 0, initial JS stays at or below 0.9 MB raw (`node` the initial-JS measurement used in v0.1.226, or sum the entry plus modulepreload files in `dist/index.html`).
- [ ] **Step 3:** Production preview (`npx vite preview`), sign in, click through Orders, an order panel, Settings, the design system page in both modes; no console errors.
- [ ] **Step 4: Commit and hand off** `feat(design): design system foundation (vX.Y.Z)`; push only with the owner's go-ahead.
