# Edit configuration: match the webstore (short design)

## Intent
Staff use Edit configuration (order panel, Items card) to change what a customer ordered: device, skin per layer, coverage, cutouts, variants. Today the page reads raw configurator data and its own fallbacks, so it ignores most Configurator Studio rules and staff type the price by hand. Owner wants the page to show exactly what the webstore shows for that device, and the price to follow the webstore, with staff able to change it.

## Goals
- Same layers, finishes, groups and order, availability (inactive hidden, out of stock disabled, coming soon disabled), per-device custom finishes, kit parts, coverage modes, logo and custom cutouts (with their Studio names), production variants, and prices as `exacoat.com` for the same product.
- Price recalculated the webstore way when the configuration changes; staff can edit it before saving.
- New design kit look (tokens, kit Select, kit Modal), light and dark.

## Non-goals
- No change to how the order item is saved (same `updateOrderDirect` payload, same meta keys and wording such as `Model Cut`, `With Logo Cutout`), so packing slips, labels and production keep working.
- No live canvas preview of the skin.

## Approaches
1. **Read the webstore's own configurator data (chosen).** `GET https://exacoat.com/api/configurator/{productId}` already returns the resolved layers, choices with final prices, groups in order, statuses, variants and the Studio profile. One source of truth: anything set in Studio that reaches the webstore reaches this page with no copied rules. Needs one small change in exacoat-web: allow the manager origins (manager.exacoat.com and local dev) to read that route (CORS).
2. Copy the webstore's ~500 lines of rules into the manager. Rejected: two copies drift apart, which is the problem today.
3. Have the WordPress plugin resolve everything. Rejected: a third copy of the rules.

## Design
- **Loading:** find the product id as today (item `product_id`, else the existing device keyword search for marketplace and warranty items), then fetch the webstore data. If the webstore cannot be reached, show an error with Retry and keep the current specs read-only; never fall back to invented options.
- **Layers:** one section per layer in webstore order, with the layer's allowed finishes grouped under the Studio group order, finish order kept, finish thumbnail, name and price. Optional layers can be added or removed; required ones cannot. Kit parts show a Kit part tag.
- **Options:** Coverage (Model Cut or Model 360 with its price) only when the webstore offers the choice; Logo cutout only when offered and not disabled by the chosen back finish; custom cutout with its Studio label; production variants with their price differences. Same rules as `device-skin-configurator.tsx`.
- **Current selection:** preselect from the item's saved specs (layer name to finish name, coverage, logo, cutout, variants); anything that no longer exists is shown as "Not available any more" so staff notice.
- **Price:** webstore total = base price + chosen finishes' prices + Model 360 price + variant differences. Shown with a breakdown. Webstore orders: the saved unit price is kept when the pop-up opens; after the first configuration change the unit price follows the total until staff type their own (then "Reset to webstore price"), so opening and saving never reprices an order paid with a coupon or an older price. Warranty, redeem, endorsement and marketplace items: price stays as it is, with a "Use webstore price" button (my call: those prices are not webstore prices). Orders not in IDR never follow the webstore total (webstore prices are IDR) and get no webstore price button.
- **Changing device:** keeps the product search; switching device reloads the webstore data and clears choices.

## Left to the builder
Component split, loading states, exact layout within the kit, tests for the price and preselect logic.
