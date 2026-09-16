# WordPress Design & Architecture Guidelines

---

## 1. Sliders, Carousels & Horizontal Tracks
- **Overflow Gradient Masking**:
  Whenever horizontal tracks, pill lists, chips rows, or artwork sliders overflow the viewport or parent container:
  - **Always apply a right-edge gradient alpha mask** so trailing items softly dissolve into the dark background rather than being chopped abruptly at the container boundary.
  - **Standard CSS Mask Syntax**:
    ```css
    .artmatter-track-mask {
      position: relative;
      width: 100%;
      min-width: 0;
      overflow: hidden;
      mask-image: linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%);
      -webkit-mask-image: linear-gradient(to right, black 0%, black calc(100% - 32px), transparent 100%);
    }
    ```
  - **Smooth Momentum Scrolling**:
    ```css
    .artmatter-track-row {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-right: 28px;
    }
    .artmatter-track-row::-webkit-scrollbar {
      display: none;
    }
    ```

---

## 2. Creator Badges & Status Pills
- **Pill Geometry**: Height `24px`, padding `0 11px`, border-radius `9999px`, font-size `11px`, `font-weight: 350-400`, letter-spacing `0.04em`.
- **No Sparkles**: Clean, modern typography and muted glassmorphic borders with zero decorative sparkle icons.
- **Unified Color Palette**:
  - `Curated Artist` & `Featured`: Electric Mint (`#a9ff5d`) with `rgba(169, 255, 93, 0.09)` fill.
  - `Verified Artist` & `New`: Electric Cyan (`#38bdf8`) with `rgba(56, 189, 248, 0.09)` fill.
  - `Public Domain` & `Artist of the Month`: Warm Gold (`#fbbf24`) with `rgba(251, 191, 36, 0.09)` fill.
  - `Artmatter Studio`: Lavender Purple (`#c084fc`) with `rgba(168, 85, 247, 0.09)` fill.
  - `Community Creator`: Muted Zinc (`#a1a1aa`) with `rgba(255, 255, 255, 0.05)` fill.

---

## 3. Museum Mat Boards & Feelform Artworks
- **Consistent Frame Padding**: 6-item mini-showcases use scaled museum mat boards (`padding: 16px 12px` desktop, `12px 10px` mobile).
- **Studio Lighting**: Radial warm specular illumination `radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.38) 0%, ..., #c6c5c2)`.
- **Tactile WebP Delivery**:
  - Keep `art-{$id}-flat.webp` at a maximum `1400px` edge for artwork detail views and other large presentations.
  - Generate the proportional `artmatter_tactile_preview` derivative at a maximum `800px` edge whenever the flat tactile WebP is saved.
  - Store that derivative as `art-{$id}-flat-thumbnail.webp` rather than a dimension-based WordPress filename.
  - Use the 800px tactile preview for storefront artwork cards and other storefront surfaces that intentionally present the FeelForm render.
  - Fall back from the tactile preview to the full flat WebP, then to the standard artwork image.
  - Do not generate intermediate sizes for tactile still images.
  - Preserve aspect ratio for every artwork derivative. Do not crop the artwork composition.

### Artwork Image Contract

Artmatter Core owns the image sizes used by Manager and storefront artwork surfaces. Do not depend on WooCommerce or theme image-size settings for these views.

| Size | Default maximum edge | Crop | Intended use |
| :--- | :--- | :--- | :--- |
| `artmatter_preview` | `480px` | No | Standard artwork fallback for compact lists and cards. |
| `artmatter_tactile_preview` | `800px` | No | Flat tactile WebP for storefront surfaces that intentionally present FeelForm. |
| `artmatter_display` | `1200px` | No | Manager and Creator Studio previews, artwork detail views, and larger presentation. |

- The dimensions are managed under **Artmatter Core > Artwork Vault > Artwork Image Sizes**.
- New uploads and new tactile flat renders create their derivatives automatically.
- After changing a dimension, run **Regenerate Artwork Images** to update existing artwork.
- Regeneration includes product artwork attachments and flat tactile attachments, but excludes tactile stills and protected master files.
- Manager and Creator Studio consumers should use `image_variants.display`, followed by `image_variants.preview`, `preview_url`, and `image_url`. These workspaces must not substitute tactile WebP renders for the uploaded artwork.
- Storefront consumers may use `metadata.tactile_flat_preview_url` or the full tactile flat URL where the FeelForm presentation is intentional.
- `preview_url` stores the standard uploaded-art preview. Tactile preview URLs belong only in `metadata.tactile_flat_preview_url`.
- Keep legacy scalar image fields during migration so older consumers retain a safe fallback.

---

## 4. Typography & Excerpt Truncation
- **Bio Excerpt Truncation**:
  - Always clean and strip HTML tags before trimming: `wp_trim_words( $bio, 13, '...' )`.
  - In CSS, use multi-line clamp with text ellipsis:
    ```css
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;
    word-break: break-word;
    ```
