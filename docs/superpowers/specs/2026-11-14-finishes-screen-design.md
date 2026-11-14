# One Finishes screen (short design)

## Intent
Materials & Stock and Configurator Studio's Master Textures pop-up both edit the same global finish list (`exacoat_global_finishes`, plus `exacoat_global_finish_groups`, group settings and `exacoat_finish_surcharge_tiers`). Two editors for one thing confuse staff and invite conflicting saves. Owner wants one clear place.

## Goals
- One screen, "Finishes & Stock" (replaces Materials & Stock in the sidebar), that does everything both editors do today.
- Configurator Studio keeps a "Finishes" button that opens this screen (no second editor inside Studio).
- Same data, same endpoints, same storefront revalidation; nothing a staff member can do today disappears.

## Non-goals
- No change to the finish data format, endpoints or how the webstore reads finishes.

## Approaches
1. **Keep the richer Studio editor's abilities, move them into a rebuilt Materials screen, delete the Studio pop-up (chosen).** One editor, built on the kit.
2. Keep both and share one component. Rejected: still two entry points with different scopes for staff to learn.

## Layout
```
Finishes & Stock                      [All] [Active] [Inactive] [Out of stock]   Search   Price tiers   Add finish
| Limited (2)          drag to reorder groups, rename, display: cards / dots, show more after N            |
|   [thumb] Titanium+   +Rp 30.000   In stock   Active   NEW badge                         Edit  Up Down   |
| Signature skins (8)                                                                                       |
|   [thumb] Swarm       +Rp 30.000   In stock   Active                                     Edit  Up Down   |
| Colors (10) ...                                                                                           |
```
- Row actions inline: stock (In stock, Out of stock, Coming soon), Active switch, order up and down.
- Edit opens a side panel: name, group, main price, accent price override, storefront badge, custom per device, swatch thumbnail, master texture, big texture (each with the Media Library picker), shading tone (shadow and highlight).
- Groups: rename, reorder, add, delete when empty, display style and "show more after" settings.
- Price tiers: the existing surcharge tiers pop-up, reachable from here and from Studio's pricing tab.
- Unsaved changes indicator and one Save for the panel; list toggles save immediately as today.

## Left to the builder
Component split, exact controls, screenshots in both modes, removal of the Studio pop-up code.
