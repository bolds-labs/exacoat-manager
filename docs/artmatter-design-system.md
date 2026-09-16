# Artmatter Design System & UI/UX Standards

This document establishes the official, unified design language and component architecture shared across **Studio Manager ERP** (`manager.artmatter.co`) and **Creator Hub** (`artist.artmatter.co`).

---

## 1. Core Principles

1. **Aesthetic Minimalism & Focus**: Deep obsidian dark themes (`#08090B` / `#101216`) with crisp translucent glass panels (`backdrop-blur-2xl`), hairline borders (`border-white/[0.08]`), and vibrant lime accents (`#a9ff5d`).
2. **Zero Inconsistency**: Modals, dropdowns, buttons, search bars, inputs, and typography must use identical tokens and layout grids across both Manager and Creator portals.
3. **Typography Hierarchy**:
   - **Primary Font**: Clean Sans-Serif (`font-sans`, Inter / system-ui).
   - **Monospace Accent**: Data values, IDs, dates, currency, and code snippets (`font-mono`, JetBrains Mono / SFMono).
   - **Display Heading**: Bold tracking-tight headings (`font-bold tracking-tight text-white`).

---

## 2. Color Palette & Surface Tokens

| Token | Dark Mode Value | Usage |
| :--- | :--- | :--- |
| **Canvas Background** | `#08090B` | Main window viewport |
| **Sidebar Surface** | `#0a0b0e` / `#080808` | Fixed navigation sidebar |
| **Card Surface (Base)** | `#101216` | Glass cards and panels |
| **Card Surface (Hover)** | `#15181e` | Interactive card hover states |
| **Modal / Dialog Surface**| `#101216` | Rounded-3xl modals with `bg-black/80 backdrop-blur-sm` |
| **Border (Subtle)** | `border-white/[0.06]` | Internal section dividers |
| **Border (Default)** | `border-white/[0.08]` | Card and component borders |
| **Border (Focus / Hover)** | `border-[#a9ff5d]` or `border-white/20` | Active input focus ring |
| **Accent Primary** | `#a9ff5d` (Lime) | Primary actions, live indicators, active states |
| **Accent Secondary** | `#38bdf8` (Sky) | AI operations, informational tooltips |
| **Warning / Hold** | `#f59e0b` (Amber) | 28-day holding balances, pending reviews |
| **Success / Verified** | `#10b981` (Emerald) | Cleared commissions, KYC approved |
| **Danger / Reject** | `#f43f5e` (Rose) | Revocations, rejected submissions |

---

## 3. Standard Component Library

### A. Primary Action Button
```tsx
<button className="px-4 py-2 rounded-xl bg-[#a9ff5d] hover:bg-[#b8ff75] text-zinc-950 font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer">
  <Icon className="w-4 h-4" />
  <span>Action Title</span>
</button>
```

### B. Secondary Zinc Button
```tsx
<button className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.03] hover:bg-zinc-200 dark:hover:bg-white/[0.07] border border-zinc-200 dark:border-white/[0.08] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5 cursor-pointer">
  <Icon className="w-4 h-4" />
  <span>Secondary Action</span>
</button>
```

### C. GlassCard Container
```tsx
<div className="bg-white dark:bg-[#101216] border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm">
  {children}
</div>
```

### D. Modal / Drawer Wrapper
```tsx
<div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div className="bg-[#101216] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
    <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
      <h2 className="text-base font-bold text-white">{title}</h2>
      <button onClick={onClose} className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white">✕</button>
    </div>
    {children}
  </div>
</div>
```

### E. Standard Input & Select
```tsx
<input className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#a9ff5d] transition-colors" />
<select className="w-full px-3.5 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#a9ff5d] transition-colors" />
```

---

## 4. Master Artwork Print & Upload Specification

All uploads in the **Artist Studio** must enforce these official requirements:

1. **Resolution & Aspect Ratio**:
   - **Portrait Standard**: `1:1.4` (ISO 216 A-series). Minimum `4000 × 5600 px` (300 DPI); Recommended `5000 × 7000 px`.
   - **Landscape Standard**: `1.4:1` (ISO 216 A-series). Minimum `5600 × 4000 px` (300 DPI); Recommended `7000 × 5000 px`.
   - *Automated Upscaling*: Files uploaded below minimum resolution are automatically upscaled by the Artmatter AI engine to guarantee gallery quality.
2. **File Specification**:
   - Allowed formats: **PNG, JPG (Maximum Quality)**.
   - Color profile: **sRGB IEC61966-2.1**.
   - Maximum file size: **100 MB**.
3. **Content Guidelines**:
   - Creator must own 100% full commercial rights.
   - Zero tolerance for hate speech, violence, or illegal content.
4. **Final Artwork Notice**:
   - Artmatter prints directly from creator-provided files.
   - Revisions must be submitted as new artworks.

---

## 5. Obsidian Glass Multi-Step Flow & Card Architecture

This pattern governs multi-step wizards, focused creator onboarding, profile setup modals, and high-focus transactional cards.

### 5.1 Visual & Surface Tokens

- **Canvas Background**: Deep obsidian `#080808` with a subtle top radial gradient highlight:
  ```tsx
  className="min-h-screen bg-[#080808] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/[0.03] via-[#080808] to-[#080808] text-zinc-100 font-sans"
  ```
- **Obsidian Glass Card**: Semi-transparent dark glass with hairline border, high blur radius, and deep ground shadow:
  ```tsx
  className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)]"
  ```
- **Input Surface**:
  ```tsx
  className="w-full px-3.5 py-3 bg-[#080808e6] border border-white/10 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#a9ff5d] transition-colors"
  ```
- **Prefix Input Container** (for handles, URLs):
  ```tsx
  <div className="flex items-center w-full px-3.5 py-2.5 rounded-xl bg-[#080808e6] border border-white/10 focus-within:border-[#a9ff5d] transition-colors font-sans">
    <span className="text-zinc-500 text-xs font-mono select-none shrink-0 pr-0.5">instagram.com/</span>
    <input className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none font-sans" />
  </div>
  ```

### 5.2 Framer Motion Whole-Card Physics

Rather than animating only sub-elements, the entire card smoothly transitions horizontally with a gaussian blur fade.

```tsx
<AnimatePresence mode="wait" custom={direction} initial={false}>
  <motion.form
    key={step}
    custom={direction}
    variants={{
      enter: (dir: number) => ({
        x: dir > 0 ? 48 : -48,
        opacity: 0,
        filter: 'blur(16px)',
        scale: 0.98,
      }),
      center: {
        x: 0,
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
      },
      exit: (dir: number) => ({
        x: dir > 0 ? -48 : 48,
        opacity: 0,
        filter: 'blur(16px)',
        scale: 0.98,
      }),
    }}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{
      duration: 0.48,
      ease: [0.16, 1, 0.3, 1], // Quintic out ease
    }}
    className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)]"
  >
    {/* Step content */}
  </motion.form>
</AnimatePresence>
```

### 5.3 Vertically Centered Layout & Zero-Layout-Shift Anchor

To keep the onboarding card vertically centered on the viewport without vertical jumps during step transitions, wrap the flow in `my-auto justify-center` and give the card container a matched `min-h-[500px] flex flex-col justify-between` alongside a fixed title container height (`h-[72px]`):

```tsx
<main className="my-auto flex-1 flex flex-col items-center justify-center max-w-xl w-full mx-auto px-4 py-8 sm:py-12 space-y-6">
  {/* Fixed height container eliminates vertical jumping during step crossfade */}
  <div className="relative h-[72px] flex items-center justify-center">
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={step}
        custom={direction}
        variants={{
          enter: (dir) => ({ y: dir > 0 ? 10 : -10, opacity: 0, filter: 'blur(8px)' }),
          center: { y: 0, opacity: 1, filter: 'blur(0px)' },
          exit: (dir) => ({ y: dir > 0 ? -10 : 10, opacity: 0, filter: 'blur(8px)' }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-1.5 text-center"
      >
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 font-sans max-w-md mx-auto leading-relaxed">
          {subtitle}
        </p>
      </motion.div>
    </AnimatePresence>
  </div>
</main>
```

### 5.4 Step Pill Switcher

Pill navigation with live completion status dots:
```tsx
<div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-zinc-900/80 border border-white/10 text-xs">
  <button
    className={clsx(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium transition-all cursor-pointer",
      isActive ? "bg-white dark:bg-white/15 text-zinc-950 dark:text-white shadow-xs font-semibold" : "text-zinc-400 hover:text-white"
    )}
  >
    <span className={clsx("w-1.5 h-1.5 rounded-full", isCompleted ? "bg-[#a9ff5d]" : "bg-zinc-500")} />
    <span>1. Identity</span>
  </button>
</div>
```

### 5.5 AI Translation Action Icon (Icon Only)

Placed cleanly in the textarea's header row alongside the character counter as a compact icon-only action:
```tsx
<button
  type="button"
  onClick={handleTranslate}
  disabled={isTranslating || !text.trim()}
  className={clsx(
    "p-1.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer active:scale-95",
    isTranslating
      ? "border-[#a9ff5d]/50 bg-[#a9ff5d]/10 text-[#a9ff5d]"
      : text.trim()
      ? "border-white/10 bg-white/[0.05] hover:bg-white/10 text-zinc-300 hover:text-white"
      : "border-white/[0.04] bg-white/[0.02] text-zinc-600 cursor-not-allowed opacity-40"
  )}
  title="Translate text to English using AI"
  aria-label="Translate text to English"
>
  {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#a9ff5d]" /> : <Languages className="w-3.5 h-3.5 text-[#a9ff5d]" />}
</button>
```

### 5.6 Form Validation Hygiene & Step Isolation

1. **Independent Step Attempt Flags**: Never use a single shared `hasAttemptedSubmit` across steps. Use `hasAttemptedStep1Submit`, `hasAttemptedStep2Submit` so arriving at a subsequent step never triggers premature red error outlines.
2. **Disabled Submit Guard with Microcopy**: Disable the continue/submit button until criteria are satisfied (`disabled={bio.length < 32 || !practice.trim()}`), accompanied by explanatory microcopy below the button explaining exactly how many characters remain.
3. **Draft LocalStorage Recovery**: Save form state automatically to `localStorage` keyed by user ID (`artmatter_creator_draft_${user.id}`) on change; hydrate on mount, and purge upon verified submission.

---

## 6. Card Eyebrow Typography & Calm Neutral Controls

### 6.1 Canonical Card Eyebrow (`<CardEyebrow>`)
Card eyebrows across all metrics, sales, commissions, reports, and artist dashboards must adhere strictly to the unified typography token:
```tsx
import { CardEyebrow } from '@/components/ui/CardEyebrow';

<CardEyebrow>Total Sales</CardEyebrow>
// Renders:
// font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate
```
- **Case Rule**: Pass strings in Title Case (`Total Units Sold`, `Cleared Earnings`, `Available for Payout`). The component's `uppercase tracking-wider` applies the canonical letter-spacing without hard-coded all-caps source strings.

### 6.2 Calm Dropdown System (Never Lime for Neutral Menus)
Dropdown menus, comboboxes, and collection selectors must remain calm and neutral. Lime (`#a9ff5d`) is reserved strictly for primary affirmative brand actions, never for neutral UI options or closed/open border rings:
- **Trigger Open Border**: `border-zinc-400 dark:border-white/30 ring-2 ring-zinc-200 dark:ring-white/10`
- **Selected Option Background**: `bg-zinc-100 dark:bg-white/[0.08]` (or `bg-white/[0.12]` on deep black surfaces)
- **Checkmark Indicator**: `text-zinc-900 dark:text-white`
- **Collection Actions**: Use `<FolderPlus className="text-zinc-300" />` with `<span>Add Collection</span>` (no redundant `+` prefix).

### 6.3 Subtle Selections (Date Granularity, Density & Pagination)
Subtle selection toggles (such as Daily/Weekly/Monthly granularity, 4/5/6 column density, Grid/List view mode, and pagination page numbers) must use elevated neutral bright/dark states rather than lime:
- **Active State**: `bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs font-bold` (or `bg-white dark:bg-white/15 text-zinc-950 dark:text-white shadow-xs font-semibold`)
- **Inactive State**: `text-zinc-500 hover:text-zinc-900 dark:hover:text-white`

### 6.4 Adaptive Tab Scroll Masks (Zero Static Gradients)
Do not apply static gradient masks (e.g. `.manager-scroll-mask`) over tab bars. On desktop screens where tabs fit within container width, tabs must render with 100% crisp, solid edges. Gradient masks must only be applied dynamically when the container overflows (e.g. on mobile screens), and only on edges where content is actively hidden beyond the viewport.


