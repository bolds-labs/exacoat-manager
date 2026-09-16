# Exacoat Design System Specification (`DESIGN.md`)

This document defines the official visual identity, component architecture, and design tokens for the **Exacoat Manager ERP Workstation** and its connected services.

---

## 1. Design Direction & Dials

- **Product Identity**: Industrial-grade e-commerce operations workstation and headless WordPress management engine for Exacoat skins & wraps.
- **Visual Mood**: Clean, authoritative, modern, tactile, and precision-engineered.
- **Antislop Configuration**:
  - `Dial: ENERGY 2 / RHYTHM 2 / MOTION 1`
  - **ENERGY 2 (Balanced)**: Polished, focused, and executive without excessive decorative noise.
  - **RHYTHM 2 (Structured)**: Predictable modular panels, data grids, slide-out drawers, and stat cards.
  - **MOTION 1 (Subtle Micro-Transitions)**: 250ms–300ms ease-out transitions for hover, focus, and state toggles; zero perpetual animation loops.

---

## 2. Color Palette & Hierarchy

### Core Brand Colors
| Role | Color Code | Tailwind Equiv. / Raw Value | Purpose |
|---|---|---|---|
| **Primary Brand Accent** | `#f3aa18` | `rgb(243, 170, 24)` | Primary brand identity, active tabs, focus rings |
| **Flatter Gradient Top** | `#f6b328` | Amber-400 tint | Button top surface |
| **Flatter Gradient Bottom** | `#ea9c0f` | Amber-600 tone | Button bottom surface |
| **Primary Bevel Border** | `#d97706` / `40%` | Amber-600 / 40% | Subtle button perimeter definition |
| **Specular Center Light** | `#ffedd5` / `80%` | Orange-100 warm peach | Top-center specular glimmer |
| **Primary Text (on Brand)** | `#08090b` | Dark Charcoal Near-Black | **9.6:1 WCAG AAA** contrast on amber |

### Dark Canvas & Neutral Surfaces
| Role | Value | Purpose |
|---|---|---|
| **Canvas Background** | `#090a0d` | Main app window background |
| **Card & Panel Surface** | `#121316` / `#16171d` | Surface for data tables, settings cards |
| **Elevated Surface** | `#1a1b22` | Modal dialogs, slide drawers, dropdown menus |
| **Subtle Borders** | `rgba(255, 255, 255, 0.08)` | Dark mode panel dividers |
| **Subtle Hover** | `rgba(255, 255, 255, 0.05)` | Table row hover, ghost button hover |

### Semantic Status Indicators
| Status | Accent | Foreground | Purpose |
|---|---|---|---|
| **Success / Completed** | `#10b981` (Emerald) | `#34d399` | Delivered orders, healthy sync, verified status |
| **In Production** | `#0284c7` (Sky) | `#38bdf8` | Printing, cutting, vinyl lamination active |
| **Quality Check / Review** | `#f59e0b` (Amber) | `#fbbf24` | Ready for inspection, customer reviews |
| **Warning / On Hold** | `#ea580c` (Orange) | `#fb923c` | Awaiting customer clarification, address review |
| **Failed / Destructive** | `#ef4444` (Rose) | `#f87171` | Payment failed, refund processed, critical error |

---

## 3. The Flatter 3D Button Architecture

### Visual Philosophy
Buttons must feel physical, satisfying, and intentional—resembling precision machinery controls rather than generic flat templates or bulbous toy bubbles. 

### The Specification
```css
/* Container Base */
display: inline-flex;
align-items: center;
justify-content: center;
border-radius: 0.75rem; /* rounded-xl */
font-family: var(--font-sans);
font-weight: 700; /* bold */
text-transform: uppercase;
letter-spacing: 0.05em; /* tracking-wider */
transition: all 300ms ease-out;
cursor: pointer;
outline: none;
position: relative;
overflow: hidden;
```

#### 1. Top-Center Specular Light (Not Full Top)
Instead of a continuous white line along the entire top rim:
- **Placement**: Centered horizontally (`top-0 left-1/2 -translate-x-1/2`).
- **Gradient**: Horizontal feathering `bg-gradient-to-r from-transparent via-[#ffedd5]/80 to-transparent`.
- **Resting Width**: `16` (64px / ~30% of button width).
- **Height**: `2px` with rounded tips.
- **Smooth Hover Transition**: On hover, width widens smoothly to `28` (112px / ~55% of button width) and peaks at `#fff7ed` with `opacity-100` via `transition-all duration-300 ease-out`.

#### 2. Flatter Surface Profile
- **Surface**: Subtle 2-stop gradient `linear-gradient(180deg, #f6b328 0%, #ea9c0f 100%)`.
- **Bottom Rim**: Soft, flat bottom bevel `inset_0_-1.5px_0_rgba(0,0,0,0.18)` plus subtle drop shadow `0_1px_2px_rgba(0,0,0,0.06)`.
- **Hover Surface**: Brightens softly to `linear-gradient(180deg, #f8ba3a 0%, #efa518 100%)` with amber ambient glow `0_3px_8px_rgba(243,170,24,0.22)`.
- **Active Depression**: `active:scale-[0.985]` with inner depression shadow `inset_0_1px_2px_rgba(0,0,0,0.25)`.

#### 3. Typography Rules
- **Size Scale**:
  - `default` / `md`: `text-xs` (12px)
  - `sm`: `text-[11px]`
  - `xs`: `text-[10px]`
- **Letter Spacing**: `tracking-wider` (0.05em) for crisp uppercase legibility.
- **Link Variant Exception**: Text links (`variant="link"`) override uppercase and letter-spacing to `normal-case font-normal tracking-normal`.

---

## 4. Typography Architecture

- **Sans Interface**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `sans-serif`
  - High legibility, neutral personality, optimized for data density.
- **Monospace Operational Data**: `ui-monospace`, `"JetBrains Mono"`, `SFMono-Regular`, `monospace`
  - Exclusively used for: Order numbers (`#12480`), courier waybills / AWB, SKU codes, prices, dates, IP addresses, and API keys.

---

## 5. Accessibility & Craftsmanship Standards

- **WCAG AAA Compliance**: Primary interactive buttons utilize `#08090b` dark text on amber `#f3aa18` (contrast ratio **9.6:1**, exceeding WCAG AAA 7:1 standard).
- **Focus Rings**: `focus-visible:ring-2 focus-visible:ring-[#f3aa18]/60 focus-visible:ring-offset-2` retained on all actionable elements.
- **Touch Targets**: Minimum tap height of 36px–44px maintained across mobile and desktop breakpoints.
