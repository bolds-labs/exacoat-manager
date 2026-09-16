# Artmatter WordPress Design System & UI Component Standards

> **Master Design Reference for Artmatter WordPress Storefront, Shortcodes & Bricks Builder**  
> *Version: 1.6.0 (Unified with Core Engine v5.0.0+)*

---

## 1. Brand Philosophy & Aesthetic

Artmatter is designed with an **architectural, luxury dark obsidian aesthetic**.
- **Tone**: Minimalist, elegant, high-end museum gallery feel.
- **Typography Principle**: Unweighted, refined typography (**300 Light** for body/descriptions/counts/captions, **400 Regular** for headings/titles). **Never use bold heavy marketing fonts**.
- **Universal Animation Standard**: **`0.5s ease`** across all cards, modals, dropdowns, and FLIP layout animations.
- **Artwork Medium**: Solid archival aluminum metal plates with satin matte finish (non-glossy).
- **Ceiling Track Spotlight**: Directional overhead gallery spotlight cast onto warm archival pedestal mat boards.
- **Satin Matte Studio Lighting Engine**: Soft-light ambient radial reflection (`mix-blend-mode: soft-light`) with 0.5px micro-bevel edge highlight.
- **Optional WebGL 3D Displacement Engine**: Reversible `feelform="flat"` shortcode toggle for real-time WebGL normal map displacement, strictly aligned with backend *Static Flat Textured Image Settings* (`flat_brightness: 1.35`, `flat_hemi: 1.6`, `flat_light: 7.5`).
- **WebGL Context Pooling & Virtualization**: Virtualized max-8 active context pool prevents browser WebGL context loss and blank white frame crashes during scrolling.
- **Scalability Architecture**: High-speed **Progressive Infinite Scrolling** (`IntersectionObserver`) with in-memory keystroke search capable of handling 500+ to 2,000+ creators and artworks at 60fps.

---

## 2. Color System & Design Tokens

```css
:root {
  /* Brand Accents */
  --primary: #a9ff5d;              /* Artmatter Electric Lime / Green Accent */
  --primary-tint: rgba(169, 255, 93, 0.09);
  --primary-border: rgba(169, 255, 93, 0.38);
  --primary-badge: rgba(169, 255, 93, 0.22);

  /* Dark Obsidian Surfaces */
  --dark-0: #0a0a0c;              /* Deep canvas black */
  --dark-1: #101010;              /* Page / Section Background */
  --dark-2: #111114;              /* Primary Card Container */
  --dark-3: #141417;              /* Input / Dropdown / Chip Surface */
  --dark-4: #18181d;              /* Hover & Elevation Surfaces */

  /* Neutral Typography */
  --light-1: #ffffff;             /* Primary Headings & Active Items */
  --light-2: #ececec;             /* Secondary Text */
  --light-3: #d4d4d8;             /* Muted Highlights */
  --gray-1: #a1a1aa;              /* Subtitles / Excerpts */
  --gray-2: #71717a;              /* Metadata / Secondary Counts */
  --gray-3: #52525b;              /* Borders & Icons */

  /* Warm Archival Gallery Wall Pedestal (Search Results) */
  --gallery-mat: #c6c5c2;          /* Warm limestone / alabaster gallery tone */
  --gallery-mat-hover: #cecdca;

  /* Elevation Shadows */
  --shadow-still: 2px 2px 2px 0 hsl(0 0% 0% / 0.5);
  --shadow-hover: 6px 6px 8px 0 hsl(0 0% 0% / 0.5);

  /* Universal Transitions */
  --transition-default: 0.5s ease;
  --transition-quick: 0.2s ease;
}
```

---

## 3. Directory & Search Component Layout Standards

### 3.1. Unified Single-Row Directory Toolbar (`.artmatter-dir-topbar`)
- **Left Side**: Scrollable category filter pills (`All Creators`, `Curated Artist`, etc.) with gradient overflow masks.
- **Right Side**:
  - **Shuffle Pill Button**: `height: 32px; border-radius: 9999px; background: #111114;` (clicking triggers fluid FLIP card shuffle directly with zero dropdown friction).
  - **Search Circle Button**: `32px × 32px; border-radius: 50%; background: #111114;` (clicking expands the sleek search field inline smoothly).

### 3.2. Museum Mat Gallery Frame (`.artmatter-museum-mat-card`)
- **Ceiling Track Spotlight & Warm Pedestal**:
  `background: radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.05) 55%, transparent 80%), #c6c5c2;`
- **Equal 4-Side Gallery Padding**: Padding on top, bottom, left, and right must always be strictly identical:
  - Desktop: `padding: 54px;` (equal on all 4 sides)
  - Tablet: `padding: 38px;` (equal on all 4 sides)
  - Mobile: `padding: 24px;` (equal on all 4 sides)
- **Generous Grid Gaps**: `gap: 36px;` (desktop portrait), `gap: 40px;` (desktop landscape), `gap: 24px;` (tablet), `gap: 18px;` (mobile).
- **Tight Minimalist Caption**: `0px gap` between Title and Artist Name with clickable creator profile link.

### 3.3. Matching Creators & Fandoms Discovery
- **Hover Border Rule (CRITICAL)**: **NEVER SHOW GREEN BORDERS ON HOVER**. On card hover, always use neutral luxury border elevation (`border-color: rgba(255, 255, 255, 0.18)`), subtle background lift (`#16161a`), and deep drop shadow (`box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4)`). Green accent is strictly reserved for active selected states or pill tags.
- **Badge Pill Symmetrical Spacing**: Symmetrical top/bottom and left/right padding (`padding: 3px 8px; line-height: 1; display: inline-flex; align-items: center; justify-content: center;`).

### 3.4. FeelForm™ 3D Flat Micro-Embossed Metal Plate Engine
- **Sobel Tangent Normal Map**: Real-time Sobel normal mapping provides genuine physical relief contours.
- **Grazing Top-Left Sunlight**: Sun rays hit from top-left (`Light X: -5.5`, `Light Y: 7.5`, `Light Z: 2.0`), casting fine highlights on top-left edges and deep shadow on bottom-right edges.
- **Calibrated Depth & Strength Handlers**: Micro-embossing is kept subtle, refined, and luxurious via `flat_disp_scale: 0.003` and `flat_normal_strength: 1.25`, fully adjustable from WordPress Admin Settings.

---

## 4. Shortcode Library Reference

| Shortcode | Purpose | Example |
| :--- | :--- | :--- |
| `[artmatter_artists]` | Interactive Our Artists exploration directory | `[artmatter_artists columns="2" sort="random"]` |
| `[artmatter_artists feelform="flat"]` | Directory with FeelForm 3D WebGL displacement | `[artmatter_artists feelform="flat"]` |
| `[artmatter_artist_artworks]` | Artist Public Profile Museum Mat Artworks Gallery | `[artmatter_artist_artworks]` or `[artmatter_artist_artworks feelform="flat"]` |
| `[artmatter_search_results]` | Dedicated Museum Mat search discovery page | `[artmatter_search_results columns="3"]` |
| `[artmatter_search_results feelform="flat"]` | Museum Mat page with FeelForm 3D displacement | `[artmatter_search_results feelform="flat"]` |
| `[artmatter_search]` | Spotlight live keystroke search input bar | `[artmatter_search placeholder="Search..."]` |
| `[artmatter_search_button]` | Spotlight modal trigger button / icon | `[artmatter_search_button label="Search" kbd="true"]` |
| `[feelform_finish_selector]` | FeelForm 3D print finish selector & addon pricing | `[feelform_finish_selector layout="segmented"]` |
| `[artmatter_artist_notice]` | Artist revenue sharing guarantee badge pill | `[artmatter_artist_notice]` |
| `[artmatter_reviews]` | Collector reviews gallery (grid, slider, column) | `[artmatter_reviews layout="slider" limit="8"]` |
| `[artmatter_custom_reviews]` | Dedicated custom art design reviews (/posters/custom) | `[artmatter_custom_reviews layout="slider" limit="6"]` |
| `[artmatter_order_review]` | Zero-login collector review submission portal | `[artmatter_order_review]` |
