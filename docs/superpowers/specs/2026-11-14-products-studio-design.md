# Products and Configurator Studio: one product list, one source per setting (short design)

## Intent
Products (what is sold everywhere: WooCommerce plus Shopee and TikTok listings) and Configurator Studio (how a skin product is built) do different jobs, but each keeps its own product list and both can change the price. The code was generated quickly and carries hardcoded fallbacks (for example a fixed list of 26 finishes in both the manager and the webstore, default price tiers, fallback devices), so a change in one place does not always reach the others. Owner wants a clean, easy Products screen and settings that have one home.

## Goals
- One product list in Products, on the design kit, with a Configurator column (has one, check status, issues) and filters (channel, category, status, configurator).
- A product panel (kit Drawer) with sections: Details (name, price, sale price, status, categories), Images, SEO, Configurator summary (layers, coverage, presets count, last check, issues) with "Open in Configurator Studio", Marketplace listings (Shopee and TikTok status, open, duplicate).
- Price edited only in Products; Studio shows the price read-only with a link.
- Configurator Studio opens on the same product list filtered to configurators (shared component), then its editor; its own separate catalog list goes away.
- Hardcoded settings removed where WordPress already holds the truth: finishes, groups, price tiers, presets come from WordPress endpoints in the manager and the webstore; when they cannot load, show an error instead of silently using an old copy. Each removal listed in a short audit file.

## Non-goals
- No rewrite of the Studio editor canvas and layer tools in this round (the 14,800 line file gets split only where the catalog moves out).
- No change to product, profile or finish data formats.

## Approaches
1. **Shared product list component plus product panel, then remove fallbacks (chosen).** Staff learn one list; Studio reuses it.
2. Merge Studio into the product panel. Rejected: the editor needs the full screen and its own tools.
3. Restyle both lists separately. Rejected: keeps two lists and two price editors.

## Layout
```
Products                        [Webstore] [Shopee] [TikTok]   Search   Category   Status   Configurator   Add
| [img] iPhone 17 Pro Skins     Rp 129.000   Published   iPhone   Configurator: Clean   Shopee, TikTok  > |
| [img] Ark Screen Protector    Rp 99.000    Published   Accessory  No configurator                    > |
Panel: Details | Images | SEO | Configurator | Marketplaces
```

## Order of work
1. Product list and panel (manager only).
2. Studio uses the shared list; price editing removed from Studio.
3. Fallback cleanup in the manager, then in exacoat-web (needs a webstore deploy; asked before pushing).

## Left to the builder
Component split, which Studio catalog tools (audit buttons, sync families, revalidate) move to the shared list toolbar, screenshots in both modes.
