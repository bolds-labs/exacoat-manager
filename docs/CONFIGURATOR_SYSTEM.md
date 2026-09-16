# Exacoat Composable Product Configurator System Architecture

> **Permanent System Reference**: This document defines the mission, data contracts, rendering engines, UI workflows, and REST endpoints for the **Exacoat Product Configurator Studio** and the headless WooCommerce configurator engine. Any AI agent or engineer extending or maintaining configurators must follow the specifications documented here.

---

## 1. Vision & Core Philosophy

Exacoat designs and produces precision-cut vinyl skins for smartphones, laptops (MacBooks), tablets (iPads), keyboards (Magic Keyboards), consoles, and accessories. 

The **Product Configurator Studio** provides an industrial-grade, Apple/Figma-style creative workspace within the Exacoat Manager ERP to:
1. **Eliminate fragile legacy data entry**: Move away from complex, unmaintainable MKL multi-table forms into clean JSON metadata stored under `_exacoat_configurator_profile`.
2. **Speed up new device rollouts**: Duplicate existing device setups (e.g. iPhone 17 Pro to iPhone 18 Pro) and run instant URL Find & Replace to launch new product lines in seconds.
3. **Guarantee pricing accuracy**: Keep WooCommerce product prices and configurator base prices strictly synchronized bidirectionally.
4. **Support material restrictions**: Accommodate hardware parts with limited finish options (such as Magic Keyboards that only support Swarm and Black Camo).

---

## 2. Dual Rendering Engine Architecture: V1 vs V2

The configurator architecture supports two distinct rendering pipelines, selectable per product via `configurator_version`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           V1 LEGACY ENGINE                              │
│  Layer 1: Base Device Hardware Render (PNG chassis with ports/lenses)   │
│  Layer 2: Transparent Photoshop PNG Overlays (1 custom PNG per finish)  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           V2 MODERN ENGINE                              │
│  Layer 1: Base Device Hardware Render (with dynamic hex color tint)     │
│  Layer 2: Vector Cutout Mask (SVG / Alpha PNG) + Global Texture Swatch  │
│  Layer 3: Realistic Multiply Shadow & Ambient Occlusion Overlay (PNG)   │
└─────────────────────────────────────────────────────────────────────────┘
```

### V1 Legacy Engine (Production Standard)
* **How It Works**:
  * **Layer 1 (Chassis)**: The neutral hardware render of the device (ports, camera glass, bezels) configured per angle in `views[].background_url`.
  * **Layer 2 (Skins)**: Transparent PNG overlays created specifically in Photoshop for each finish and angle (e.g. `iphone-17-pro-back-swarm.png`).
* **Advantages**: 100% pixel-perfect photo-realism, exact Photoshop bevels and reflections, zero client-side SVG clipping bugs, full backwards-compatibility with existing WooCommerce carts and orders.
* **Storage**: Texture maps are indexed by finish slug under `layer.assets_by_view[view_id].render_texture_map[finish_slug]`.

### V2 Modern Engine (Dynamic Compositing Preview)
* **How It Works**:
  * **Layer 1 (Chassis & Color)**: Neutral device body image tinted dynamically using device color hex codes (`space-gray`, `silver`, `midnight`, `starlight`).
  * **Layer 2 (Vector Mask & Texture)**: An SVG path or Alpha PNG mask (`mask_svg_url`) clipped dynamically to tile a global texture pattern.
  * **Layer 3 (Photoshop Multiply Shadow)**: A transparent PNG containing realistic ambient occlusion, drop shadows, and bevel highlights (`shadow_png_url`) rendered with `mix-blend-mode: multiply`.
* **Advantages**: Eliminates exporting 24+ individual PNGs per angle for new devices; a single mask and shadow overlay can render any global texture swatch.

---

## 3. Configurator Studio Workspace Layout (2-Pane Design)

The Studio UI in `src/pages/ConfiguratorStudioPage.tsx` follows a minimalist 2-pane creative workstation layout:

### Left / Center Pane: Interactive Device Canvas Stage
* **Viewing Angle Pills**: Positioned at the top for switching between `Top View`, `Bottom View`, `Trackpad View`, etc.
* **Device Stage Viewport**: Large, centered preview canvas (up to 420x420px) rendering composites in correct z-index order.
* **Stage Layer Toggles**: Quick pill toggles allowing product managers to toggle skin layers on/off live to inspect fit.
* **Floating Bottom Dock**:
  * Active texture test badge showing the material swatch and name.
  * Live calculated storefront total price (`IDR 310,000`) accounting for base price, active layer up-charges, and finish tier surcharges.

### Draggable Vertical Splitter
* A tactile vertical divider (`cursor-col-resize`) sits between the stage and the inspector.
* Allows dragging left or right to adjust inspector panel width between **340px and 850px** (defaults to 480px).

### Right Pane: Inspector Panel (3 Focused Tabs)
1. **`Skin Parts`**:
   * Horizontal pill bar of customizable skin parts: `[ Top Lid ]  [ Bottom Base ]  [ Trackpad ]  [ + Add Skin Part... ]`.
   * Selected Part Summary: Name, required vs optional toggle, extra price up-charge (`+IDR 15,000`).
   * Material Availability Settings: Toggle between `All Finishes` and `Restricted` (see Section 4).
   * Texture Swatches Grid: Filterable by material group (`Signature skins`, `Pastels`, `Camouflage`, etc.) with clean status pills (`Mapped` vs `Unassigned`) and a dedicated link button to edit the transparent PNG URL.
2. **`Hardware Base`**:
   * Management of Layer 1 neutral chassis body image (`background_url`) for each angle.
   * Add / remove viewing angles (`+ Back View`, `+ Inner View`, `+ Trackpad View`).
3. **`Settings`**:
   * Device Base Price (IDR).
   * Device Family (`phone`, `laptop`, `tablet`, `foldable`, `keyboard`, `case`, `console`, `accessory`).
   * Size Surcharge Multiplier (e.g. 1.0x for phones, 1.8x for tablets, 2.5x for laptops).
   * Rendering Engine Architecture switch (`v1 Legacy` vs `v2 Modern`).

---

## 4. Finish Material Availability Restrictions

Certain specialized products only support specific vinyl materials. For instance, the **Apple Magic Keyboard** only supports `swarm` and `black-camo` due to material thickness and heat dissipation requirements.

### Data Contract (`ConfiguratorLayer`)
```typescript
export interface ConfiguratorLayer {
  id: string;
  name: string;
  group: 'primary' | 'accent' | 'protection';
  is_required: boolean;
  is_optional: boolean;
  default_selected: boolean;
  extra_price: number;
  z_index: number;
  allowed_finish_groups?: string[];
  allowed_finish_slugs?: string[]; // Empty = all finishes allowed; array = restricted to these slugs
  assets_by_view: Record<string, ConfiguratorLayerAsset>;
}
```

### Studio Controls:
* **All Finishes**: Sets `allowed_finish_slugs` to `[]` (all 24+ catalog finishes selectable).
* **Restricted**: Restricts selection to specified slugs.
* **Quick Preset**: 1-click button to apply **Swarm & Black Camo only** (`['swarm', 'black-camo']`).
* **Auto-Detect Mapped**: Scans existing texture URLs on the layer and restricts availability to only finishes that have active URLs assigned.

---

## 5. Find & Replace in URLs Workflow

When rolling out seasonal product updates (e.g. iPhone 17 Pro -> iPhone 18 Pro, MacBook Pro M3 -> M4):
1. Duplicate the previous product in the manager catalog (see Section 6).
2. Open the newly duplicated product in the Configurator Studio.
3. Click **Find & Replace in URLs** (`Wand2` icon) in the header.
4. Set **Find String**: e.g. `17` or `iphone-17-pro`.
5. Set **Replace With**: e.g. `18` or `iphone-18-pro`.
6. Select Scope:
   * `All URLs (Textures & Chassis)` (default)
   * `Finish Textures Only`
   * `Hardware Chassis Only`
7. Inspect the live match count and before/after sample diff.
8. Click **Replace All**: Instantly updates all URLs across all angles and composable layers.
9. Click **Save Configurator** to commit changes to WooCommerce.

---

## 6. Base Price & Product Duplication Architecture

### Base Price Synchronicity
* **Single Source of Truth**: The `base_price` of a device is the WooCommerce product's regular price (`_regular_price` and `_price`).
* **Bidirectional Sync**:
  * When fetching product data, the engine reads `$product->get_price()` / `$product->get_regular_price()`.
  * When saving the profile via `POST /configurator/save` or updating price via `POST /configurator/set-price`, the backend updates both `_regular_price` and `_price` metadata, calls `$product->save()`, and updates the profile JSON.

### Product Duplication
In the catalog grid, clicking the **Duplicate** button (`Copy` icon) on any product card opens the duplication modal:
* **Inputs**: New Product Name (e.g. `iPhone 18 Pro`), New Slug (e.g. `iphone-18-pro`), Base Price, and a toggle for "Copy Full Configurator Setup".
* **Backend Action**: Calls `POST /configurator/duplicate-product`. The server duplicates the WooCommerce product (using `wc_duplicate_product` or fallback post creation), clones terms and prices, clones `_exacoat_configurator_profile` with the new product ID and device name, and copies legacy MKL metadata for storefront compatibility.
* **Automated Launch**: Once duplicated, the studio automatically opens the new product so the engineer can run Find & Replace immediately.

---

## 7. REST API Endpoints Contract

All endpoints are registered under `/wp-json/exacoat-core/v1/`:

| Route | Method | Purpose | Permissions |
|---|---|---|---|
| `/configurator/profiles` | `GET` | List all catalog products with configurator summary (counts, angles, price, family). | Public |
| `/configurator/(?P<id_or_slug>...)` | `GET` | Fetch complete normalized profile (layers, views, texture maps, restrictions). | Public |
| `/configurator/save` | `POST` | Save/update a device profile JSON and sync WooCommerce regular price. | Bridge Auth |
| `/configurator/set-price` | `POST` | Directly update product regular price and profile base price. | Bridge Auth |
| `/configurator/duplicate-product` | `POST` | Clone a WooCommerce product and its configurator profile. | Bridge Auth |
| `/configurator/batch-migrate` | `POST` | Batch-convert all legacy MKL products into modern composable profile metadata. | Bridge Auth |
| `/finishes` | `GET` | Fetch global finish materials list with stock statuses and extra prices. | Public |
| `/finishes/save` | `POST` | Add or update global finish material definition. | Bridge Auth |
| `/finishes/toggle-stock` | `POST` | Toggle in-stock status for a finish across all products. | Bridge Auth |

---

## 8. Typography, Styling & Quality Rules

### Typography Architecture
* **Sans Interface (`font-sans`)**: Use system sans-serif (`Inter`, `-apple-system`, `BlinkMacSystemFont`) for all interface labels, section headings, buttons, and helper text.
* **Monospace Operational Data (`font-mono`)**: Exclusively reserved for:
  * Prices (`IDR 310,000`, `+IDR 15,000`)
  * SKU and Product IDs (`#12480`)
  * Multipliers (`1.8x`, `2.5x`)
  * URLs and technical identifiers

### Strict Antislop & Copywriting Rules
* **No Em Dashes (`—`)**: Never use the em dash character (`—`) in UI copy, buttons, labels, toasts, or comments. Use colons, commas, parentheses, or periods instead.
* **Primary Buttons**: Follow the Flatter 3D Button specification defined in `DESIGN.md`: amber gradient (`from-[#f6b328] to-[#ea9c0f]`), bold uppercase sans-serif text, and `#08090b` high-contrast dark foreground (9.6:1 WCAG AAA compliance).
* **Keyboard Accessibility**: ESC must close all open dialogs, drawers, and studio overlays.
