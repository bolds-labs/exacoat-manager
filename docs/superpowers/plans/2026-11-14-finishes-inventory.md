# Finishes editors: action inventory

Two editors changed the same global finishes before this change:

- **M**: Materials & Stock (`src/pages/MaterialsStockPage.tsx`).
- **S**: Configurator Studio Master Textures pop-up (`src/pages/ConfiguratorStudioPage.tsx`, `showMasterTexturesModal`), plus the pop-ups it opened (Add finish, Delete confirm, image picker, group display settings, bespoke presets manager).

Every action below is mapped to where it lives after the change. "Screen" means the new Finishes & Stock screen (`#materials`). "Panel" means the Edit side panel (kit Drawer) on that screen.

## Loading and navigation

| # | Action today | Where | New home |
|---|---|---|---|
| 1 | Load finishes, groups, group settings, price tiers (`fetchGlobalFinishesDirect`) | M, S | Screen loads on mount |
| 2 | Refresh button | M (Refresh), S (Refresh Catalog reloads finishes too) | Screen: Refresh icon button; header Refresh (`onWorkspaceRefresh`) also reloads. Studio keeps Refresh Catalog and reloads finishes when its window regains focus |
| 3 | Open the editor | S: "Master Textures (v2)" top bar button | Studio button "Finishes" opens `#materials` (same tab from the catalog; new tab while a device is open so device edits are kept) |
| 4 | "Tone Settings" shortcut in the layer inspector shading card | S | Same link, now opens the Finishes screen (same rule as 3) |
| 5 | Escape closes the pop-up | S | Kit Drawer and kit Modal close on Escape |

## Summary and filters

| # | Action today | Where | New home |
|---|---|---|---|
| 6 | Totals: total, in stock, coming soon, depleted | M (metric cards) | Screen: status filter tabs carry counts (All, Active, Inactive, Out of stock, Coming soon) |
| 7 | Filter All / Active / Inactive with counts | S | Screen: status filter tabs |
| 8 | Filter by group (All groups + one tab per group) | M, S | Screen: Group select (kit Select) next to search |
| 9 | Search by name, slug or group | M (name, slug, group), S (name, slug) | Screen: search field, matches name, slug and group |
| 10 | Clear search (x) | S | Kit SearchField (type=search clear) |
| 11 | Empty state for a group with no finishes / no matches | S, M | Screen: empty group rows say "No finishes in this group", no-match state when filters hide everything |

## Finish list (inline row controls, save immediately)

| # | Action today | Where | New home |
|---|---|---|---|
| 12 | Grouped in storefront group order, finishes by `order` then name | S | Screen: one section per group in `exacoat_global_finish_groups` order |
| 13 | Swatch thumbnail, name, group, slug shown | M, S | Row: thumbnail, name, slug |
| 14 | Price shown (main extra, accent extra or "tiers") | M | Row: "+Rp 30.000", accent override or "Accent by tiers" |
| 15 | CSS class shown | M | Panel: read-only Slug and CSS class |
| 16 | "v2 Texture: Master Ready / Using Swatch" | M | Row hint "Swatch used as texture" when no master texture |
| 17 | Inactive badge "Hidden from storefront" | M, S | Row: muted "Inactive" chip and dimmed row |
| 18 | Badge preview (NEW, HOT) | S | Row: badge pill in its colour |
| 19 | Stock cycle In stock / Out of stock / Coming soon, saved immediately (`toggleFinishStockDirect`) | M | Row: Stock select (kit Select), saves immediately |
| 20 | Stock cycle as an unsaved edit, saved with Save | S | Row Stock select (immediate) and Panel Stock field (saved with Save) |
| 21 | Active / Inactive toggle, saved immediately (`toggleFinishActiveDirect`) | M, S | Row: Active switch, saves immediately |
| 22 | Move finish up / down within its group, `#n` position (`saveAllGlobalFinishesDirect`) | S | Row: Up and Down icon buttons; position number in the row |
| 23 | Delete finish with confirmation (`deleteGlobalFinishDirect`) | S | Panel footer: Delete, then kit Modal confirmation |
| 24 | Open edit | M (Edit), S (inline fields) | Row: Edit button opens the Panel |

## Edit panel (one Save)

| # | Field / action today | Where | New home |
|---|---|---|---|
| 25 | Name | M, S | Panel |
| 26 | Group | M (fixed list of 4), S (stored groups) | Panel: kit Select of stored groups |
| 27 | Main extra price | M, S | Panel |
| 28 | Accent extra price override | M only (S save wiped it, see note) | Panel |
| 29 | Stock status (3 states) | M, S | Panel: kit Select |
| 30 | Active (storefront + marketplace vs marketplace only) | S (and Add form) | Panel: switch "Show on storefront" |
| 31 | Swatch thumbnail URL + Media Library | M (URL), S (picker pop-up + Media Library) | Panel media slot: preview, URL field, Browse media (MediaLibraryModal), Clear, Open |
| 32 | Master texture URL + Media Library + Preview link | M, S | Panel media slot (same controls) |
| 33 | Big texture (laptop and tablet) + Media Library | S | Panel media slot (same controls) |
| 34 | Shadow multiply opacity | M (kept on save), S (slider) | Panel: slider 0 to 100% |
| 35 | Highlight screen opacity | M (kept), S (slider) | Panel: slider 0 to 100% |
| 36 | Surface shading on/off + strength (5 to 60%) with preview on the texture tiles | S | Panel: switch + slider, preview on the texture slots |
| 37 | Storefront badge text (max 15) + colour | S | Panel: text field + colour picker + preview pill |
| 38 | Custom per device | S | Panel: switch |
| 39 | Disable logo cutout | S | Panel: switch |
| 40 | Per-finish Save, disabled when nothing changed | S | Panel: Save, disabled when clean |
| 41 | Unsaved changes indicator and count; Save All; Cancel discards | S | Panel header shows "Unsaved changes"; closing with changes asks to discard. Only one finish is edited at a time, so Save All becomes the panel Save |
| 42 | Studio canvas previewed unsaved surface shading | S | Not kept: the texture slots in the Panel show the shading preview; the Studio canvas shows saved values |

## Add finish

| # | Field / action today | Where | New home |
|---|---|---|---|
| 43 | Add finish button | M, S | Screen header "Add finish" opens the Panel in create mode |
| 44 | Name, slug (auto from name, editable), group, price, accent price, status, thumbnail, texture, badge, custom per device, disable logo cutout, active | M + S (union) | Panel create mode has all of them plus big texture and shading |
| 45 | `order` = end of list; `class_name` = `cfg-{slug}`; texture falls back to thumbnail | M, S | Same rules (`buildNewFinishPayload`) |

## Groups

| # | Action today | Where | New home |
|---|---|---|---|
| 46 | Show/hide group tray (Manage Groups) | S | Screen: "Groups" button opens the Groups pop-up (kit Modal) |
| 47 | Reorder groups up/down (`reorderFinishGroupsDirect`) | S | Groups pop-up: Up/Down per group; group sections on the screen follow |
| 48 | Add group (`reorderFinishGroupsDirect`) | S | Groups pop-up: name field + Add |
| 49 | Delete empty group, blocked with notice when not empty | S | Groups pop-up: Delete enabled only when count is 0 |
| 50 | Rename group inline, Enter saves, Escape cancels (`renameFinishGroupDirect`) | S | Groups pop-up: Rename inline, same keys |
| 51 | Finish count per group | S | Groups pop-up and section headers |
| 52 | Display style indicator (Cards/Dots, collapsed, limit) | S | Section header and Groups pop-up show "Cards" or "Dots", "Collapsed", "Show 6" |
| 53 | Group display settings: style, collapsed by default, show more after N (presets All/3/4/6/8 + custom) (`saveFinishGroupSettingsDirect`) | S | Group display pop-up (kit Modal) opened from the section header or the Groups pop-up |

## Price tiers

| # | Action today | Where | New home |
|---|---|---|---|
| 54 | Surcharge Tiers pop-up (`FinishSurchargeTiersModal`) | M header, S top bar, S pricing tab | Screen header "Price tiers"; Studio keeps its top bar and pricing tab entries |

## Kept in Studio (not finish fields)

| # | Action today | Where | New home |
|---|---|---|---|
| 55 | Bespoke Presets manager (global `exacoat_configurator_presets`) opened from the Master Textures header | S | Stays in Studio, now opened from the Presets inspector tab ("Global looks"). The storefront only shows per-device looks (AGENTS s38), so this is a legacy list |

## Data-safety note found during the inventory

`/finishes/save` overwrites every field it does not receive with a default (`accent_extra_price` 0, `is_active` true, badge empty, `is_custom_per_device` false). Materials & Stock's Edit save therefore reset badge, custom-per-device and reactivated inactive finishes, and the Studio card save reset the accent price override. The new Panel always sends the complete finish (`buildFinishSavePayload`), so no field is lost.
