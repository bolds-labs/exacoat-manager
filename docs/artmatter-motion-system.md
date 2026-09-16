# Artmatter Motion & Interaction Design System

> **Canonical Motion Standard for Artist Studio & Manager Ecosystem**
> 
> *Artmatter motion is smooth, premium, responsive, intentional, calm, and fast. Motion exists strictly to support the interface, never to become the interface.*

---

## 1. Core Principles

- **Calm & Restrained**: No excessive bouncing, exaggerated 3D rotations, continuous glowing pulses, or SaaS template effects.
- **Fast & Direct**: Micro-transitions complete in `180ms - 240ms` with GPU-accelerated cubic-bezier curves (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Subtle Layering**: Transitions use lightweight `opacity` + small `translateY` (4-8px) or `scale` (0.98 -> 1.0).
- **Zero Layout Shift**: All animations run via CSS `transform` and `opacity` to eliminate reflow and maintain 60/120fps fluid performance.
- **Accessibility & Reduced Motion**: Automatically respect `prefers-reduced-motion: reduce` by setting durations to instant 0.01ms.

---

## 2. Terminology & Brand Rule

> **Always use "Artist" — NEVER use "Creator"**
> - **Artist Studio** (not Creator Studio)
> - **Artist Application** (not Creator Application)
> - **Artist Onboarding** (not Creator Onboarding)
> - **Artist Profile** (not Creator Profile)
> - **Artist Privilege** (not Creator Privilege)

---

## 3. Motion Tokens & Classes

### 3.1 Page Transitions
- Class: `.animate-page-enter`
- Duration: `200ms cubic-bezier(0.16, 1, 0.3, 1)`
- Behavior: `opacity: 0 -> 1`, `translateY(5px) -> translateY(0)`

### 3.2 Card & Grid Entrances
- Class: `.animate-card-enter`
- Duration: `240ms cubic-bezier(0.16, 1, 0.3, 1)`
- Behavior: `opacity: 0 -> 1`, `scale(0.985) translateY(4px) -> scale(1) translateY(0)`

### 3.3 Modal & Dialog Entrances
- Backdrop: `.animate-backdrop-fade` (`180ms ease-out`)
- Content: `.animate-modal-enter` (`200ms cubic-bezier(0.16, 1, 0.3, 1)`)

### 3.4 Stagger Delays
For ordered lists and structured sequences (such as Onboarding):
- `.motion-stagger-1`: `40ms`
- `.motion-stagger-2`: `80ms`
- `.motion-stagger-3`: `120ms`
- `.motion-stagger-4`: `160ms`
- `.motion-stagger-5`: `200ms`

### 3.5 Interactive Feedback
- Class: `.interactive-hover`
- Hover: `-translate-y-[2px]`, subtle border highlight
- Active: `scale-[0.985]`
- Status Badge Transition: `.status-badge-transition` (smooth 200ms color & background interpolation)

---

## 4. Reduced Motion Compliance

```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
