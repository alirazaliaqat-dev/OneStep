# Clearline CRM — Humanized Design System & Visual Constitution

> **Platform Scope:** One-stop Meta Ads Query Command Center, Full-Lifecycle CRM Pipeline, and Organization & Employee Management System.  
> **Aesthetic Direction:** Apple-inspired **Liquid Glass** (macOS & iOS translucency, specular hairline edges, fluid spring physics) rendered exclusively in our curated deep-navy to ice-snow blue palette.

---

## 1. Strict Color Palette (100% Palette Fidelity)

Every surface, border, ink token, chart series, and glass highlight in Clearline CRM is derived **exclusively** from the six approved palette swatches:

| Token Name | Hex Code | Role & Semantic Usage |
| :--- | :--- | :--- |
| **Deep Midnight Ink** | `#091F5C` | Primary headings, body copy, high-contrast primary CTAs, dark glass anchors, primary chart line |
| **Royal Cobalt** | `#334DAF` | Primary interactive brand accent, active navigation highlight, keyboard `focus-visible` ring, hover CTA state |
| **Steel Cornflower** | `#7096D1` | Secondary visual accent, structural chart series, subtle icon strokes, inactive border accents |
| **Ice Sky** | `#D0E4FE` | Liquid glass tint, selected row/tab wash, elevated hairline border highlight, soft metric accent fill |
| **Frost Mist** | `#E8F2FE` | Structural secondary surface, sidebar frosted glass base, table header fill, subtle divider tint |
| **Pure Snow** | `#F9FBFF` | 60% dominant canvas background, primary glass card specular top layer, inverse text on `#091F5C` / `#334DAF` |

### 60-30-10 Spatial Color Distribution
- **60% Dominant Canvas:** `#F9FBFF` ambient canvas with ultra-soft radial gradient washes of `#E8F2FE` and `#D0E4FE` behind frosted glass panes.
- **30% Structural Surfaces:** Translucent frosted layers derived from `#F9FBFF` (`76%` opacity) and `#E8F2FE` (`62%` opacity) with `1px` `#D0E4FE` / `#7096D1` hairline boundaries.
- **10% High-Intent Accent:** `#091F5C` and `#334DAF` reserved strictly for primary calls to action, active navigation states, and key performance figures.

### Accessibility Contrast Verification (WCAG 2.1 AA)
- `#091F5C` on `#F9FBFF`: **14.3:1** (AAA)
- `#091F5C` on `#E8F2FE`: **12.9:1** (AAA)
- `#091F5C` on `#D0E4FE`: **10.6:1** (AAA)
- `#334DAF` on `#F9FBFF`: **7.1:1** (AAA)
- `#F9FBFF` on `#091F5C`: **14.3:1** (AAA)
- `#F9FBFF` on `#334DAF`: **7.1:1** (AAA)
- **No Hue-Only Signaling:** Because our palette is monochromatic blue, every operational status (`Urgent`, `Qualified`, `Active`, `Paused`, `SLA Breach Risk`) is always paired with an explicit plain-English label and directional/semantic icon—never color alone.

---

## 2. Typography Constitution (`Inter` Only)

Clearline CRM enforces **Inter** across 100% of the interface—headings, body prose, buttons, navigation, and tabular metrics.

- **Font Stack:** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
- **Weights Loaded:** `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold)
- **Tabular Numerals:** All currency values, ROAS figures, lead counts, timestamps, and table columns enforce `font-variant-numeric: tabular-nums` so numbers align vertically with zero horizontal jitter.

### Type Scale
| Role | Size | Weight | Line Height | Tracking |
| :--- | :--- | :--- | :--- | :--- |
| **Workspace Display Title** | `24px–28px` (`clamp(1.5rem, 2.2vw, 1.75rem)`) | `600` | `1.2` | `-0.025em` |
| **Section Heading** | `16px–18px` | `600` | `1.3` | `-0.015em` |
| **Body & Table Cell** | `14px` | `400 / 500` | `1.5` | `-0.005em` |
| **Interactive Button / Tab** | `13px–14px` | `500 / 600` | `1.2` | `-0.01em` |
| **Quiet Metadata** | `12px` | `500` | `1.4` | `0em` |

### Humanized Text Rules
- **No Orphan Headline Words:** Section and modal headlines use `text-wrap: balance`.
- **Zero-Pill Metadata Discipline:** Static metadata (timestamps, Meta channel source, campaign tags, department names) renders as clean unboxed text separated by `·` rather than pill-box clutter.
- **No Mechanical Prefixes:** No `//`, `>_`, snake_case headers, or synthetic version tags.

---

## 3. Liquid Glass Materiality & Motion Physics

Inspired by macOS and iOS Liquid Glass:

### Surface Recipe
1. **Primary Liquid Glass Panel (`.glass-panel`):**
   - Background: `linear-gradient(145deg, rgba(249, 251, 255, 0.68) 0%, rgba(232, 242, 254, 0.44) 52%, rgba(208, 228, 254, 0.52) 100%)`
   - Backdrop Filter: `blur(28px) saturate(185%) brightness(1.03)`
   - Directional Specular Fresnel Rim (`::before` masked `1px` edge): `135deg` luminous `#F9FBFF` corner highlights fading softly across neutral diagonal shoulders (`rgba(112, 150, 209, 0.22)`).
   - Inner Specular Rim: `inset 0 1.5px 0 rgba(249, 251, 255, 0.92), inset 0 -1px 0 rgba(112, 150, 209, 0.24)`
   - Ambient Depth Shadow: `0 20px 44px -18px rgba(9, 31, 92, 0.16), 0 4px 12px -2px rgba(9, 31, 92, 0.06)`
2. **Nested Recessed Frosted Well (`.glass-recessed`):**
   - Background: `linear-gradient(150deg, rgba(51, 77, 175, 0.08), rgba(9, 31, 92, 0.05))`
   - Backdrop Filter: `blur(18px) saturate(160%)` for multi-layer widget depth without heavy borders.
3. **Elevated Liquid Floating Sheet / Drawer (`.glass-sheet`):**
   - Background: `linear-gradient(160deg, rgba(249, 251, 255, 0.86), rgba(232, 242, 254, 0.74), rgba(208, 228, 254, 0.78))`
   - Backdrop Filter: `blur(36px) saturate(195%) brightness(1.03)`
   - Shadow: `0 28px 64px -16px rgba(9, 31, 92, 0.22)`

### Liquid Spring Motion Curves
- **Shared-Element Liquid Indicator:** Navigation and segmented control highlights glide smoothly between targets using `motion/react` `layoutId` with spring physics (`stiffness: 420, damping: 34, mass: 0.8`).
- **Micro-Interaction Latency:** Button hover and press compression (`scale(0.975)`) settle within `140ms` using `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Compositor-Only Animation:** Only `transform`, `opacity`, and `backdrop-filter` animate—never layout geometry (`width`, `height`, `margin`).
- **`prefers-reduced-motion`:** All spring translations and ambient background drifts collapse gracefully to instant opacity transitions when reduced motion is enabled.

---

## 4. Single-Line Interactive Control Contract

To preserve visual clarity across desktop (`1440px`) and mobile (`375px`):
- **Every `<button>`, `<a>`, tab, and segmented control** strictly uses `whitespace-nowrap shrink-0` and `inline-flex items-center justify-center`.
- Button labels are concise human verbs (`Sync Meta`, `Assign`, `Convert Deal`, `Add Member`, `Save Changes`).
- Dynamic entity labels inside buttons or list rows include `truncate` with constrained max-width so no control ever wraps onto two lines.
- **Touch Targets:** Minimum `40px` height on desktop controls and `44px` minimum height on mobile interactive controls.

---

## 5. Tactile Haptic Feedback & Accessibility Architecture

- **Haptic Engine (`src/utils/haptics.ts`):**
  - Triggers native device vibration (`navigator.vibrate`) across all touch interactions:
    - `selection`: `8ms` pulse (tab switch, filter click, row select)
    - `light`: `10ms` pulse (button tap, drawer open/close)
    - `medium`: `16ms` pulse (stage transition, employee assignment)
    - `success`: `[10, 28, 14]` pattern (deal converted, reply sent, Meta synced)
    - `warning`: `[16, 36, 16]` pattern (destructive confirmation, validation alert)
  - Paired with synchronized visual micro-spring compression (`active:scale-[0.97]`) so desktop and iOS Safari users also feel immediate tactile response.
  - Toggleable in Workspace Settings and automatically muted if user disables haptics.
- **Full Keyboard & Screen Reader Support:**
  - Semantic landmarks (`<aside>`, `<header>`, `<nav>`, `<main>`).
  - `aria-current="page"` on active navigation, `role="tablist"` / `role="tab"` / `aria-selected` on segmented switches.
  - `aria-live="polite"` status announcer for async Meta syncs, assignments, and saved records.
  - `Escape` closes all slide-over drawers and modals with focus restoration.

---

## 6. Responsive Desktop & Mobile Architecture

- **Desktop (`>= 1024px`, 1440px baseline):**
  - Fixed `256px` frosted glass sidebar + fluid main workspace (`max-w-[1360px]`) + clean 3-zone top bar (`Page Title / Breadcrumb` — `Global Search` — `Primary CTA`).
- **Tablet (`768px – 1023px`):**
  - Collapsible drawer navigation + responsive 2-column grids and horizontal scroll-safe tables.
- **Mobile (`< 768px`):**
  - Compact single-row top header + bottom frosted-glass tab bar (`64px` height, strictly `< 10%` of viewport height, 4 single-line core tabs + "More" drawer trigger) + stacked single-column master/detail flow for Meta Queries.
