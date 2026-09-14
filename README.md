# Exacoat Manager (ERP & Operations Hub)

High-speed enterprise operations hub, order management system, and configurator inspector for the Exacoat headless commerce ecosystem.

Built with **React 19**, **Vite 6**, **Tailwind CSS**, and direct **WooCommerce REST v3 Bridge** with zero live WordPress disruption.

---

## Key Features

1. **Order Hub & Fulfillment Pipeline**:
   - Real-time order synchronization with live `exacoat.com` store (21,000+ orders).
   - Instant filtering by status (`Processing`, `Ready to Ship`, `Completed`, `Cancelled`).
   - Deep configurator item inspector: extracts and displays custom stacked skin layers (Back, Additional Camera, Frame, Model) directly from `_configurator_data` and Store API line item metadata.
   - Quick fulfillment pipeline actions to transition orders between statuses.
   - AWB / Resi tracking number injection directly to order meta (`tracking_number` and `_shipping_carrier`).

2. **A6 Thermal Shipping Label Generator**:
   - Native client-side PDF generator producing standard **105mm x 148mm (A6 portrait)** thermal courier labels via jsPDF.
   - Formatted for Indonesian couriers (JNE, Biteship) and international postal logistics (POS ID).
   - Includes recipient phone, subdistrict, district, city, tracking number barcode, and complete skin layer packing checklist.

3. **Customer Packing Slip & Invoice**:
   - High-fidelity PDF packing slip generator via jsPDF and AutoTable.
   - Itemized line items with custom skin specifications, subtotal, discounts, shipping fees, and multi-currency pricing.

4. **Product & Configurator Hub**:
   - Complete catalog inspector for 300+ Exacoat hardware models and skins.
   - **Marc Lacroix (MKL) Configurator**: inspects stacked layers, layer requirements, swatches, and choice schemas.
   - **Acowebs Custom Product Addons (WCPA)**: recognizes and inspects products using Acowebs forms (e.g., Titanium+ Skins and Back Glass Kits).

5. **Customer Intelligence CRM**:
   - Fast search across 67,000+ customer profiles.
   - Lifetime order history, total spent, and shipping address inspection.

6. **WordPress Companion Plugin (`exacoat-core`)**:
   - Production-safe companion plugin located in `wordpress-plugin/exacoat-core`.
   - Packaged automatically into `exacoat-core.zip` via `npm run package:plugin`.
   - Registers custom order status `wc-ready-to-ship` ("Ready to Ship").
   - Exposes read-safe REST endpoints at `/wp-json/exacoat/v1/health` and `/wp-json/exacoat/v1/orders`.

---

## Antislop Compliance

Strictly engineered under the Antislop Craftsmanship Standard:
- **R-02**: Zero em dashes (`—`) in UI copy or documentation strings.
- **R-03 & R-25**: Mobile responsive touch targets (minimum 44px) and WCAG AAA color contrast ratios.
- **R-26 & R-27**: Zero dead controls, with complete Loading, Empty, and Error states on all data tables and drawers.
- **R-32**: Full keyboard navigation support (Tab, Enter, Escape) and high-contrast visible focus rings.
- **R-37 Dials**: **ENERGY 2 / RHYTHM 2 / MOTION 2**.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start Vite development server with /cms proxy
npm run dev

# Compile TypeScript, build production bundle, and package WordPress plugin
npm run build
```

---

## Environment Variables

Configured in `.env`:
- `VITE_WORDPRESS_URL`: `https://exacoat.com`
- `VITE_WC_CONSUMER_KEY`: WooCommerce REST API consumer key
- `VITE_WC_CONSUMER_SECRET`: WooCommerce REST API consumer secret
- `VITE_SUPABASE_URL`: Supabase backend endpoint
