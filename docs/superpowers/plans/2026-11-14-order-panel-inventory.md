# Order panel body inventory (Plan 2, Task 5)

Every section and conditional block the order panel body rendered before the rebuild (`OrderDetailDrawer.tsx` at 3a08073, body region lines 1140 to 2968), mapped to its target card from spec 8.2. Header items (PanelHeader, ClaimBanner, StatusNavigator) were done in Task 4 and are not repeated here. Pop-ups opened from the body (refund overlay, custom skin lightbox, review media, guarantee reject, track order, edit address, edit item, WhatsApp, Goorita booking, confirmations, printed documents) are unchanged and only their triggers move.

Legend: `[x]` seen present and working in the rebuilt panel on real orders (#542887 courier, #542886 pickup, #542888 warranty, #542883 US Goorita, dark and light at 1920x950, 375px for 75 and 76); `[t]` covered by `src/components/orders/panel/PanelBody.test.tsx` because no current order carries that data; `[c]` mapped and wired to the same handler as before, but no real order with that data was available and it has no dedicated test. State-changing actions (save tracking, status, refund, cancel, trash, send email, invite, AWB booking) were checked for presence and enabled state only, never clicked, to avoid writing to live orders.

## Body banners (top of the old body)

| # | Old block (condition) | Target card | Status |
|---|---|---|---|
| 1 | Influencer endorsement PR card (`isEndorsement`): creator name, handle, platform, campaign, admin notes | Customer & delivery (Endorsement section under the contact grid) | [c] |
| 2 | Parent warranty claim notice (`parentWarrantyClaimId`): link to claim order, Pending review / Approved / Rejected pill, Review claim proof (opens WarrantyReviewModal for the claim order) | Items (linked claim strip at the top) | [t] |
| 3 | Parent redeem claim notice (`parentRedeemClaimId`): link to redeem order | Items (linked claim strip at the top) | [c] |
| 4 | 30-day guarantee return card (`guaranteeDetails`): status pill, method, amount, destination, return hub, return courier and resi or "not uploaded" note, reason | Refund (guarantee return section) | [t] |
| 5 | Guarantee actions: Mark Package Received (`pending_return`), Approve & Issue Refund and Reject (`pending_return` or `package_received`), disabled while processing | Refund (guarantee return section) | [t] |

## Customer & delivery

| # | Old block (condition) | Target | Status |
|---|---|---|---|
| 6 | Customer profile link button (not shop manager): navigates to customer and closes panel | Customer & delivery header, "Customer profile" button | [x] |
| 7 | Plain customer name chip (shop manager) | Customer & delivery, Recipient value | [x] |
| 8 | Recipient name | Customer & delivery left | [x] |
| 9 | Email with mailto link and copy (`customer_email`) | Customer & delivery left (empty state "No email") | [x] |
| 10 | Phone with tel link, copy, WhatsApp (`customer_phone`) | Customer & delivery left (empty state "No phone") | [x] |
| 11 | Destination address (courier) or store pickup location (pickup), with Edit | Customer & delivery right | [x] |
| 12 | Store pickup / Switch to courier toggle with Updating state (`isSwitchingFulfillment`) | Customer & delivery header (Store pickup switch, or Switch to courier button) | [x] |
| 13 | Store address warning with Edit Address (`isStoreAddress`) | Customer & delivery right | [c] |
| 14 | Customer note (cleaned of courier lines, only when not empty) | Customer & delivery, under the grid | [c] |

## Items

| # | Old block (condition) | Target | Status |
|---|---|---|---|
| 15 | Header: item count, total units, Add item (opens EditOrderItemModal with no item) | Items header | [x] |
| 16 | Thumbnail or package fallback, quantity | Items row | [x] |
| 17 | Name (strike when refunded) | Items row | [x] |
| 18 | Redeem replacement badge (`order_type === 'Redeem'`), Warranty replacement badge (`order_type === 'Warranty'`) | Items row tags | [x] |
| 19 | Custom order badge (name starts with "custom order" or `is_custom`) | Items row tags | [c] |
| 20 | Refunded quantity badge (`qty_refunded > 0`) | Items row tags | [c] |
| 21 | Product ID and SKU | Items row | [x] |
| 22 | Configuration specs as labelled tags (image and URL specs filtered out) | Items row | [x] |
| 23 | Edit configuration (opens EditOrderItemModal for the item) | Items row | [x] |
| 24 | View custom skin (custom item with image): opens lightbox with Download High-Res / Download Asset (custom skin asset download) | Items row | [c] |
| 25 | Price: strike-through subtotal when discounted, line total, refunded amount, discount, DDP tax, commission cut | Items row right | [x] |
| 26 | No items (new empty state) | Items "No items on this order" | [t] |

## Shipping & tracking

| # | Old block (condition) | Target | Status |
|---|---|---|---|
| 27 | Info tooltip (Biteship verification) | Shipping header info icon | [x] |
| 28 | Latest tracking status pill (`tracking.latest_status`) | Shipping header | [c] |
| 29 | Track order button (real resi): opens tracking modal, syncs when no checkpoints; modal has the public tracking link | Shipping header | [c] |
| 30 | Sync status button (real resi) with spinner | Shipping header | [c] |
| 31 | Courier select (legacy ui/Select) with service tag or raw courier match | Shipping, kit Select with tag | [x] |
| 32 | Tracking number input; custom courier name; custom tracking URL with "%s" hint (`courier === 'custom'`) | Shipping form (kit TextField) | [x] |
| 33 | Save tracking (disabled while saving, without resi, or custom without name) | Shipping form | [x] |
| 34 | Goorita domestic JNE consolidation block (`isConsolidationOrder`): hub tags, consolidated order IDs, Print A6 JNE label | Shipping section | [c] |
| 35 | Goorita US shipment block (`isUsOrder`): destination, service, Goorita ID, Book / Re-generate AWB, Print label, View official AWB PDF (`gooritaAwbUrl`) | Shipping section | [x] |
| 36 | Rayspeed block (`isRayspeedOrder`): destination, resi, Dispatch / Re-generate AWB with busy state, Track on Rayspeed link | Shipping section | [c] |
| 37 | Carrier checkpoints: count, latest checkpoint card, expand/collapse history | Shipping section | [c] |
| 38 | Store pickup orders: pickup notice and Workshop label button | Shipping card (pickup variant) | [x] |
| 39 | "Label not printed" warning (new per spec, from `isPrinted`) | Shipping header | [x] |

## Order summary

| # | Old block (condition) | Target | Status |
|---|---|---|---|
| 40 | Refund button (`remainingAvailableRefund > 0`): prefills amount, opens refund overlay | Summary header | [x] |
| 41 | Currency | Summary rows | [x] |
| 42 | Items subtotal | Summary rows | [x] |
| 43 | Discount with coupon codes (`discount_total > 0`) | Summary rows | [c] |
| 44 | Fees, or fee total adjustment | Summary rows | [c] |
| 45 | Shipping with method; promo tag, original rate and shipping discount (`shippingDiscount > 0`) | Summary rows | [x] |
| 46 | Tax (`total_tax > 0`) | Summary rows | [c] |
| 47 | Unique payment code (`_bca_unique_code`) | Summary rows | [x] |
| 48 | Order total | Summary rows | [x] |
| 49 | Refund ledger: amount refunded, net amount, refund history (`totalRefunded > 0`) | Refund card | [t] |
| 50 | Payment line: paid date and amount, confirmed with method, or pending | Summary payment chip line | [x] |
| 51 | Midtrans transaction ID (`_midtrans_transaction_id`) | Summary reference line | [c] |
| 52 | BCA webhook mutation (`_bca_mutation_desc`) | Summary reference line | [c] |

## Coupons & adjustments

| # | Old block (condition) | Target | Status |
|---|---|---|---|
| 53 | Card only when coupons or fees exist | Coupons card always rendered, empty state "No coupons or adjustments" | [x] |
| 54 | Coupons with Shipping promo tag and amount | Coupons card | [t] |
| 55 | Fees with sign and DDP tax | Coupons card | [c] |

## Review & feedback

| # | Old block (condition) | Target | Status |
|---|---|---|---|
| 56 | Review status pill, or Awaiting collector / Pre-delivery | Review header pill | [x] |
| 57 | Review: stars, rating, Verified, date, title, content, customer name and location | Review card | [c] |
| 58 | Review media grid (photo / video), opens media preview | Review card | [c] |
| 59 | No review: invite sent / auto-scheduled pill | Review card | [c] |
| 60 | Send / Resend review invitation (delivered or completed), busy state | Review card | [t] |
| 61 | Auto invite note (other statuses) | Review card | [x] |

## Activity & notes

| # | Old block (condition) | Target | Status |
|---|---|---|---|
| 62 | Count | Activity header | [x] |
| 63 | Add note form: textarea, Customer note checkbox, Add note with busy state | Activity composer (opened by Add note in header) | [x] |
| 64 | Loading and empty states | Activity feed | [x] |
| 65 | Note: HTML render, avatar, author, role pill, date, Customer tag, customer note tint | Activity feed | [x] |
| 66 | All / Customer notes filter (new per spec) | Activity header | [x] |

## Resend transactional email, store link, admin

| # | Old block (condition) | Target | Status |
|---|---|---|---|
| 67 | Confirmation sent pill (`_artmatter_confirmation_email_sent`) | Resend email header | [x] |
| 68 | Recipient address with Change / Done edit toggle | Resend email recipient field (always editable, prefilled) | [x] |
| 69 | Template native select (7 templates, plus store pickup ready on pickup orders) | Resend email kit Select | [x] |
| 70 | Resend email button with Sending state and no-recipient disable | Resend email Send | [x] |
| 71 | Last send result with latency | Resend email | [c] |
| 72 | Delivery logs link (closes panel) | Resend email links row | [x] |
| 73 | Open store order (wp-admin link) | Resend email links row | [x] |
| 74 | Administrator actions (`isAdmin` only): description, Cancel order (disabled when cancelled, busy label), Move to trash (busy label) | Administrator actions card, "Admin only" pill | [x] |

## Carried from Task 4

| # | Item | Status |
|---|---|---|
| 75 | ClaimBanner at 375px: content stacks, Review claim proof below the text, title wraps normally | [x] |
| 76 | Header meta line at 375px: no break that orphans the payment method separator | [x] |
