# Edit configuration on webstore data: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The order panel's Edit configuration pop-up (`src/components/orders/EditOrderItemModal.tsx`) offers exactly what exacoat.com offers for the product and recalculates the price the webstore way, editable by staff.

**Architecture:** Read the storefront's resolved configurator data (`GET {web}/api/configurator/{productId}`, exacoat-web `app/api/configurator/[slug]/route.ts`, CORS added on exacoat-web branch `feat/manager-configurator-cors`). Pure helpers in a new `src/lib/webstoreConfigurator.ts` mirror the few UI rules the storefront component applies on top of that data; the modal renders from them with the design kit.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind tokens, kit `src/components/ds`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-14-edit-configuration-design.md`

## Global Constraints
- Save payload and meta wording unchanged: same `updateOrderDirect` call, same `specs` / `parsed_configurator` / `formatted_meta` shape and labels the modal writes today (read the current code; e.g. `Model Cut`, `With Logo Cutout`). Printed documents must not change.
- No invented options: if the webstore data cannot be loaded, show an error with Retry and leave the item's specs read-only. Remove the old synthesized profiles and global-finish fallbacks from this modal.
- AGENTS.md s62 design rules: tokens only, kit Select (never native select), kit Modal, light and dark, no em dashes, English UI.
- AGENTS.md s3: no localStorage for shared state.
- Version: unreleased 0.1.228 on branch `design/manager-redesign`; no version bump (Ruling: folds into 0.1.228).

## Review Focus
1. Product without a configurator (404 from the webstore) or webstore unreachable: clear message, Retry, no crash, existing item untouched.
2. Order item whose saved finish or option no longer exists: preselect what still exists, flag the rest "Not available any more", never silently swap.
3. Warranty, redeem and marketplace items (zero or marketplace price): price is not changed unless staff press "Use webstore price".
4. Devices without coverage choice (`model_cut_only`, `none`, foldables) or without logo cutout, finish that disables the logo cutout (`disabled_logo_cutout_finishes`): option hidden or forced exactly as the storefront does.
5. Out of stock and coming soon finishes visible but not selectable; inactive finishes absent (they are absent from the webstore data already).

---

### Task 1: Webstore data and rules

**Files:** Create `src/lib/webstoreConfigurator.ts`, `src/lib/webstoreConfigurator.test.ts`, fixture `src/lib/__fixtures__/webstore-configurator-iphone-17-pro.json` (trimmed real payload of `https://exacoat.com/api/configurator/537268`; keep layers, choicesByLayer, groupsByLayer, variants, v2Profile.coverage_and_cutouts, basePrice, productName, slug; drop images/angles/descriptions). Modify `vite.config.ts` (dev proxy) only if needed for local reads.

**Interfaces (produces):**
- `fetchWebstoreConfigurator(productId: number): Promise<{ ok: true; data: WebstoreConfigurator } | { ok: false; status: number | 'network' }>`; base URL from `VITE_WEB_URL` (default `https://exacoat.com`); in dev, a Vite proxy path may be used so local testing works before the CORS change is deployed.
- `getWebstoreOptions(data): { coverage: { offered: boolean; model360Price: number }; logo: { offered: boolean }; pencil: { offered: boolean; label: string }; variants: Variant[] }` mirroring exacoat-web `components/configurator/device-skin-configurator.tsx` (`isNoModel360Device`, `hasModelCoverageOption`, `hasLogoCutoutOption`, `hasPencilCutoutOption`, `activeVariants`, lines ~401-500) and `isLogoCutoutDisabledByFinish(data, backChoice)` (lines ~760-790).
- `computeWebstoreTotal(data, selection): { total: number; lines: { label: string; amount: number }[] }` = basePrice + selected choices' `extraPrice` + Model 360 price when chosen and offered + variant `price_diff`s (lines ~575-590).
- `preselectFromSpecs(data, specs): { selection: Selection; missing: string[] }` and `selectionToSpecs(data, selection): Spec[]` producing the exact labels the modal saves today.

- [ ] Write failing tests on the fixture: total for Back = Swarm (+30000) with Model 360 (+40000) equals basePrice + 70000; Matte Black only equals basePrice; coverage offered for iPhone 17 Pro, not offered when `coverage_type` is `model_cut_only` or name contains Fold; logo not offered when `has_logo_cutout` false; Burgundy back disables logo cutout; out of stock choice not selectable; preselect round trip `selectionToSpecs(preselectFromSpecs(specs))` keeps labels; unknown finish name lands in `missing`.
- [ ] Run, expect FAIL; implement; run, expect PASS; commit `feat(orders): read webstore configurator data for item edits`.

### Task 2: Rebuild the pop-up

**Files:** Modify `src/components/orders/EditOrderItemModal.tsx` (split new parts into `src/components/orders/editItem/*` if it helps); tests in `src/components/orders/editItem/*.test.tsx`.

- [ ] Keep: product search and the existing device keyword lookup for marketplace and warranty items (to find the product id), quantity, the save and remove flows.
- [ ] Replace option loading with Task 1. Layout per the spec: a section per layer in webstore order; finishes grouped in `groupsByLayer` order with thumbnail, name, price (`+Rp 30.000`), out of stock / coming soon disabled with a tag; optional layers addable and removable, required not; kit parts tagged; Coverage, Logo cutout, custom cutout (Studio label), variants as kit RadioCard groups or kit Select.
- [ ] Price box: breakdown from `computeWebstoreTotal`, unit price field. Webstore orders: unit price follows the total until staff edit it (then a "Reset to webstore price" link). Warranty, redeem and marketplace items: price unchanged plus a "Use webstore price" button. Detect these with the helpers already used in the panel (`getWarrantyClaimMeta`, `getRedeemClaimMeta`, order channel).
- [ ] Loading, error with Retry, missing-options notice.
- [ ] Tests: renders layers and groups from the fixture; changing a finish updates the total; staff edit sticks; warranty item keeps price until the button; error state shows Retry.
- [ ] `npx tsc --noEmit`, `npm test`; commit `feat(orders): edit configuration matches the webstore`.

### Task 3: Docs
- [ ] AGENTS.md: new section "Edit configuration reads webstore data" (endpoint, CORS dependency on exacoat-web, price rules, no fallback). CHANGELOG 0.1.228 line. `npm run build`; commit `docs(orders): edit configuration source of truth`.
