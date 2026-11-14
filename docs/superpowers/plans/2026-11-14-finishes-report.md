# Finishes & Stock: report

Branch `design/manager-redesign`, version 0.1.228 (unchanged, no plugin changes, zips and `public/version.json` restored after the build).

## What changed

- **Inventory**: `docs/superpowers/plans/2026-11-14-finishes-inventory.md` lists 55 actions from both editors (Materials & Stock and the Studio Master Textures pop-up with its sub pop-ups), each mapped to its new place. Nothing is unmapped. One deliberate loss: Studio's canvas no longer previews unsaved surface shading (the panel previews it on the texture slots instead).
- **Rules** (`src/lib/finishesEditor.ts`, TDD, 22 tests): group order (stored order, then extra groups), grouping with empty groups, status and search filters, counts, move finish within group with renumbering, move group, delete-only-when-empty, group name validation, drafts with defaults, dirty detection, full save payload, new finish payload (slug, id, class name, order, texture fallback).
- **Screen** (`src/pages/MaterialsStockPage.tsx`, export name kept, tab key `materials` kept; sidebar, header breadcrumb and command palette now say "Finishes & Stock"):
  - Header: Refresh, Groups, Price tiers, Add finish. Header Refresh (workspace refresh) also reloads.
  - Filter tabs with counts: All, Active, Inactive, Out of stock, Coming soon; group select (kit Select); search on name, slug and group; no-match state with Clear filters.
  - One kit Card per group in storefront order, empty groups shown, display setting shortcut in each card header.
  - Rows (`src/components/finishes/FinishRow.tsx`): position, thumbnail (hidden when the image fails), name, badge, Inactive / Out of stock / Coming soon / Per device chips, slug, "swatch used as texture" hint, price and accent rule, Stock select, Active switch, Move up/down, Edit. Stock, Active and order save immediately and revert on failure.
  - Edit and Add panel (`src/components/finishes/FinishEditPanel.tsx`, kit Drawer 600px): name, slug (Add) or slug and CSS class (Edit), group, stock, show on storefront, main extra, accent override, three Media slots (`MediaSlot.tsx`: preview, URL, Browse via the existing `MediaLibraryModal`, open, clear), shadow and highlight sliders, surface shading switch and strength, badge text and colour with preview, custom per device, disable logo cutout. Unsaved changes chip, Save disabled until something changes, discard confirmation, Delete with confirmation. Add blocks an existing slug.
  - Groups pop-up (`FinishGroupsModal.tsx`, kit Modal): move, rename inline (Enter), display settings inline (Cards or Dots RadioCardGroup, collapsed switch, show more after presets and custom number), delete only when empty, add group with validation.
  - Price tiers: the existing `FinishSurchargeTiersModal`.
- **Studio** (`src/pages/ConfiguratorStudioPage.tsx`, about 2,890 lines removed): Master Textures pop-up, image picker, Add finish, Delete finish, group display pop-up, all finish edit state and handlers removed. "Master Textures (v2)" button is now "Finishes" and opens `#materials` (same tab from the catalog, new tab while a device editor is open so device edits survive). The layer inspector "Tone Settings" link does the same. Studio re-reads finishes, groups and tiers on window focus. The canvas now reads surface shading from saved finish values. The global looks manager (store-wide presets) stays in Studio and opens from a new "Global looks" button in the Presets inspector tab. Price tiers buttons in Studio unchanged.
- **Docs**: AGENTS.md sections 16, 20, 21, 27, 41, 44, 45, 48, 50 and the surcharge tiers section updated to name the one editor; new section 63. CHANGELOG 0.1.228 has a "Design: Finishes & Stock" block.

## Write paths (verified by tests and code reading, not in the browser)

Bridge calls are unchanged and used as before: `fetchGlobalFinishesDirect`, `saveGlobalFinishDirect`, `saveAllGlobalFinishesDirect` (reorder), `toggleFinishActiveDirect`, `toggleFinishStockDirect`, `deleteGlobalFinishDirect`, `reorderFinishGroupsDirect` (order, add, delete group), `renameFinishGroupDirect`, `saveFinishGroupSettingsDirect`, surcharge tiers through `FinishSurchargeTiersModal`. `src/pages/MaterialsStockPage.test.tsx` (9 tests, mocked bridge) checks: group order and empty groups, filters and search, Active switch call, reorder payload (renumbered group, stored groups), edge buttons disabled, Edit save sends the whole finish (accent price, badge, custom flag, active, order kept), Add blocks a taken slug, add group payload, delete disabled for a non-empty group.

## Bug found and fixed

`/finishes/save` (`rest_save_finish`) overwrites every field it does not receive with a default. The old Materials edit did not send badge, custom per device or `is_active`, so it erased badges and re-activated inactive finishes; the Studio card save did not send `accent_extra_price`, so it reset the accent override to 0. The new panel always sends the whole record (`buildFinishSavePayload`).

## Checks

- `npx tsc --noEmit`: clean.
- `npm test`: 47 files, 480 tests passed (31 new).
- `npm run build`: passed. Initial JS (entry plus modulepreloads in `dist/index.html`): 892,405 bytes (limit 900,000; before 892,075, +330 bytes from the nav and palette text). The screen is its own lazy chunk (`MaterialsStockPage-*.js`, 34 KB); Studio chunk dropped to 408 KB.
- No em dashes in the diff; no legacy palette classes, `/NN` token opacity or backdrop blur in the new files; kit Select for every dropdown; floating surfaces use kit Modal and Drawer (`bg-pop`, `bg-panel`).

## Browser (dev server, signed in, nothing saved)

Opened the screen in dark and light, the Edit panel (typed into the draft, closed, saw the discard prompt, discarded), the Add panel, the Media Library over the panel (Escape closes only the picker), the Groups pop-up with Colors display settings, Price tiers, mobile width (no horizontal scroll), Studio "Finishes" button (lands on `#materials`) and the Studio Presets tab "Global looks" pop-up. No saves, toggles, reorders, renames or deletes.

Screenshots in `docs/superpowers/screens/`: `before-finishes-materials-dark.jpg`, `before-finishes-materials-light.jpg`, `before-finishes-studio-master-textures.jpg`, `after-finishes-dark.jpg`, `after-finishes-light.jpg`, `after-finishes-edit-panel-dark.jpg`, `after-finishes-add-panel-light.jpg`, `after-finishes-groups-dark.jpg`.

## Concerns

- `toggleFinishStockDirect` and `toggleFinishActiveDirect` return `success: true` even when the request fails (local cache fallback), so a failed row toggle looks saved until the next refresh. Not changed here because the bridge was out of scope; noted in AGENTS s63.
- Reorder uses save-all with the whole list, as Studio did: if two staff edit finishes at the same moment, the later reorder can overwrite the other's change.
- The Groups pop-up closes on Escape while renaming (Radix handles Escape before the field), losing only the unsent rename text.
- `MediaLibraryModal` and `FinishSurchargeTiersModal` are legacy styled (unchanged), so they look older than the screen, especially in light mode.
- Global looks (`exacoat_configurator_presets`) are kept in Studio but the storefront no longer shows them; consider retiring them.
