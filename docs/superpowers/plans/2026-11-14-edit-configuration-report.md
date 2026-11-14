# Edit configuration on webstore data: report

Status: DONE_WITH_CONCERNS (all three tasks done; concerns below are judgement calls for the owner, not blockers).

Branch `design/manager-redesign`, not pushed, no version bump (0.1.228 unreleased, plugin unchanged).

## Commits
- `993abfe` feat(orders): read webstore configurator data for item edits
- `bae7adc` feat(orders): edit configuration matches the webstore
- `98270f6` docs(orders): edit configuration source of truth

## What was built

### Task 1: `src/lib/webstoreConfigurator.ts`
- `fetchWebstoreConfigurator(productId)`: `GET {base}/api/configurator/{id}`, 15 s timeout; returns `{ ok: true, data }` or `{ ok: false, status: number | 'network' | 'invalid' }` (`'invalid'` added for a 200 without layers/choices). Base is `/webstore` in dev (Vite proxy) and `VITE_WEB_URL` (default `https://exacoat.com`) in builds.
- `getWebstoreOptions`, `isLogoCutoutDisabledByFinish`, `primaryBackLayer`, `isLayerOptional`, `isChoiceSelectable`, `choiceAvailabilityTag`, `groupedLayerChoices`, `computeWebstoreTotal`: copies of the storefront rules (device-skin-configurator.tsx lines ~300-500, 575-590, 760-790).
- `Selection` = layers (layer id to choice id), coverage, logo, pencil, variants, plus `unavailable` (saved values no longer offered, kept on save until replaced), `kept` (non-configurator details such as Original Invoice), `unset` (offered options the item never recorded).
- `preselectFromSpecs(data, specs, titleHint?)` reads manager wording and webstore checkout wording; `selectionToSpecs` writes the manager's existing wording.
- Fixture `src/lib/__fixtures__/webstore-configurator-iphone-17-pro.json`: trimmed live payload of product 537268.
- `vite.config.ts`: dev proxy `/webstore` to `VITE_WEB_URL || https://exacoat.com`.

### Task 2: pop-up rebuild
- `EditOrderItemModal.tsx` rewritten (2270 lines to about 480) on the kit: Modal, Button, TextField, RadioCardGroup, Select (variants), IconButton. Tokens only, no native select, no backdrop blur.
- `editItem/ConfigurationEditor.tsx`: variants (kit Select), one collapsible section per layer in webstore order with Required / Optional / Kit part tags, finishes grouped by `groupsByLayer` order with thumbnail, name, `+Rp 30.000`, badge, Out of stock / Coming soon tags (disabled); Remove for optional layers; Coverage, Logo cutout (forced to No Logo Cutout with a note when the back finish disables it), custom cutout under its Studio label.
- `editItem/PriceBox.tsx`: breakdown lines, webstore price, quantity stepper, unit price, line total, "Reset to webstore price" (webstore orders) or "Use webstore price" (warranty, redeem, marketplace).
- `editItem/itemLookup.ts`: `isLinkedProductId`, `extractDeviceKeywords` (moved from the modal, re-exported), `keepsOwnPrice` (warranty / redeem via `getWarrantyClaimMeta`, `getRedeemClaimMeta`, `rma.order_type`, `_rma_marketplace_channel` / `_marketplace_invoice` meta, Shopee/TikTok in `created_via` or `payment_method`, or an item without a real product id).
- Removed: synthesized profiles, global finish catalog fallback, raw profile reads, Form mode with editable custom specs.
- Kept: product search (Change device), keyword lookup for marketplace and warranty items, quantity, save payload (same `updateOrderDirect` shape and `specs` / `parsed_configurator` / `formatted_meta` / `meta_data`), remove flow and its confirm text.
- Added a "Will be saved as" list so staff see the exact specs that Save writes.

### Task 3: docs
- AGENTS.md section 63 "Edit Configuration Reads Webstore Data" (endpoint, CORS dependency and dev proxy, mirrored rules, saved wording, no invented values, price rules, product lookup).
- CHANGELOG 0.1.228 line.
- `npm run build` passes. It only rewrote the plugin zips and `public/version.json` timestamp (plugin unchanged), so those regenerated files were reverted, not committed.

## RED / GREEN evidence
- `webstoreConfigurator.test.ts`: written first against a stub module that throws; run showed all 25 tests failing with "not implemented" (missing module before that). After implementation: 26 passed. Later additions, each seen failing first: generic label `Variation` (1 failed, then pass), unset coverage/logo and title hint (3 failed, then pass); final 29 passed.
- `itemLookup.test.ts`: the warranty title case failed first (`'[Warranty Replacement] Exacoat iPhone...'` instead of `'iPhone 13'`), found in the browser; fixed, then pass.
- Modal tests (`editItem/EditOrderItemModal.test.tsx`, 12) were written with the component and passed on first run; not strictly test-first.

## Test output
- `npx tsc --noEmit`: clean.
- `npm test`: 34 files, 346 tests passed.

## Browser checks (dev server port 3005, Vite proxy, real orders, nothing saved)
- #542876 iPhone 17 Pro Max (webstore): preselected Back Burgundy, Model 360, logo forced to No Logo Cutout with the note; webstore price Rp 199.000 = saved price. Matte Black: total Rp 169.000, unit price followed. This pop-up was closed in that shared tab by someone else's click, not by me; I never pressed Save.
- #542877 and #542884 warranty items: Ark camera protector correctly shows "exacoat.com has no configurator for this product" with Retry and read-only current details. iPhone 13 warranty item first failed the keyword lookup (bracket tag kept in the search), fixed; then found product 361887, preselected Emerald Green from `Variation`, Model 360 from the title, logo "Not recorded on this item". Picking Swarm left the unit price at 0; "Use webstore price" set 199000. Cancelled.
- #542886 MacBook Pro 14 (M4): Top and Trackpad Forged Carbon preselected, Bottom optional and not included, no coverage, logo offered; webstore price Rp 420.000 against paid Rp 405.000, unit price kept and "Reset to webstore price" offered. Checked in dark and light. Cancelled.
- #542882 Galaxy Z Fold 7: no coverage choice; webstore total Rp 238.000 equals the saved line total. Cancelled.
- Console: one TypeError from a hot reload mid-edit (an old selection without `unset`), not seen on a fresh load. 404s are expected (webstore 404 for the Ark product).

## Concerns and decisions for the owner
1. **Price on open**: for webstore orders the unit price stays as saved when the pop-up opens and only follows the webstore total after a configuration change (otherwise opening and saving would silently reprice coupon or old-price orders, as #542886 shows: 405.000 paid vs 420.000 today). The spec says "follows the total until staff type their own"; I read that as from the first change.
2. **Custom cutout wording**: saved as `Pencil Cutout: With Pencil Cutout` (the manager's existing wording) even when Studio names it, for example, S-Pen Cutout. The pop-up shows the Studio label. The webstore checkout saves `{label}: With {label}`. Kept as instructed (saved wording unchanged); worth aligning later.
3. **Coverage wording** stays `360° Full Coverage` while the webstore saves `Model 360°`; both are read back.
4. **Generic specs are relabelled**: an item saved as `Variation: Emerald Green` or `Finish: Woven` is saved back as `Back: Emerald Green`, because it is preselected onto the base layer.
5. **Model 360 from the title**: when an item never recorded coverage but its title says 360, Coverage is preselected and saved as `360° Full Coverage` (the old modal did the same). Other unrecorded options are left unpicked and not saved.
6. **Non-configurator products lose spec editing**: the old Form mode let staff type specs for merch and kits. Per the plan these are now read-only with a notice; name, quantity and price stay editable.
7. **Camera-only claims**: a required base layer may stay empty on an existing item (warranty claims for a camera piece). Coverage and logo are then hidden and not saved, as before. Save is blocked only for new items or after a device change.
8. **Production dependency**: until exacoat-web `feat/manager-configurator-cors` is deployed, the built manager (manager.exacoat.com) cannot read the route and will show "Could not reach exacoat.com" with Retry for every item. Ship the storefront change first.
9. **Not mirrored**: presets (Shop the Look), device colours and the canvas preview (out of scope); non-IDR session currencies (`currencyPrices`), since order prices are edited in the order currency with IDR webstore amounts. Choosing a default finish for a new item (the storefront picks Swarm or the first in stock) is not mirrored: new items start with nothing chosen and Save asks for a base finish.

## Files
- `src/lib/webstoreConfigurator.ts`, `src/lib/webstoreConfigurator.test.ts`, `src/lib/__fixtures__/webstore-configurator-iphone-17-pro.json`
- `src/components/orders/EditOrderItemModal.tsx`
- `src/components/orders/editItem/ConfigurationEditor.tsx`, `PriceBox.tsx`, `itemLookup.ts`, `itemLookup.test.ts`, `EditOrderItemModal.test.tsx`
- `vite.config.ts`, `AGENTS.md`, `CHANGELOG.md`

## Fix round 1

Commit `4be2379` fix(orders): edit configuration keeps warranty specs, free-form edits and saved options. `npx tsc --noEmit` is clean and `npm test` passes 34 files / 360 tests. No version bump, not pushed, Save never pressed on a real order.

Every item below got a failing test before the fix (RED: 4 lib tests and 1 lookup test, then 4 modal tests, then 2 modal tests, each run and seen failing).

1. **Warranty specs kept**: `GENERIC_FINISH_LABEL` is back to the old set (`finish|skin|texture|varian|warna|option`, anchored). If any spec is labelled `Claimed Part`, every non-layer line is kept unchanged, generic labels are not mapped and the title is not read for Model 360. Test: `Claimed Part: Camera`, `Original Invoice`, `Variation: Emerald Green` round-trip exactly, with no Back, Coverage or Logo lines. In the browser, #542884 now shows "Will be saved as" with its original five lines unchanged.
2. **No invented variants**: variants the item never recorded go into `unset` as `variant:{id}`. They are left out of the specs and the price until staff pick one, and the Select shows no option with "{name} is not recorded on this item". A saved option that is no longer offered stays unset and is saved unchanged. Fresh configurations still default to the first option, as the storefront does. Tests: lib (iPad-like payload) and modal.
3. **Free-form editing restored** for the 404 / `none` state: staff can add, edit and remove label and value rows (`FreeSpecEditor`). Rows start from the item's specs, and empty rows are dropped on save in the same spec format. The unreachable `error` state stays read-only.
4. **Device change + failed load**: Save is blocked with "Could not load the options for this device. Retry, or cancel to keep the item as it is." The notice shows the same text. The old "details stay as they are" line no longer appears after a device change.
5. **Non-IDR orders**: the unit price never follows the webstore total and no webstore price button is shown. A note says "Webstore prices are in IDR; this order is in USD, so the unit price is not changed." Breakdown amounts and finish prices are always formatted in the webstore currency (IDR). Browser check: #542890 (USD) kept unit 19 after picking Swarm, and the breakdown was shown in Rp.
6. **Endorsements** keep their own price (`_order_badge` ENDORSEMENT or `_is_endorsement` yes, same check as `financialAnalyticsService.ts`).
7. **Minor fixes**:
   - A failed product search during the keyword lookup now shows the unreachable error.
   - A saved logo value on a back finish that disables the cutout is kept (`preserveLogo`), with the note "The saved value stays until you change something". Any change clears it, and the storefront rule (No Logo Cutout) then applies.
   - `PriceBox` keys are now index plus label.

Docs: the price-on-open behaviour (saved price on open, follows the webstore after the first change) is now stated in the design doc (untracked file, edited in place) and AGENTS.md section 63. AGENTS.md also covers the generic labels, claim items, free-form editing, the device-change block, non-IDR and endorsement rules.

Concerns resolved by this round: 4 (relabelling) and 6 (free-form editing) from the list above. The rest still stand. On item 1, any spec line that names a layer (for example `Back: Swarm`) on a claim item is still read as that layer and saved in the same wording, so nothing changes for it.
