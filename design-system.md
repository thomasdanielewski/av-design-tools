# AV Room Planner — Design System

## Color Palette

### Primary Accent (Gensler Red)
| Token | Value (Dark) | Value (Light) | Usage |
|-------|-------------|---------------|-------|
| `--red` | `#EE3224` | `#D92A1D` | Primary accent, active states |
| `--red-hover` | `#F54D40` | `#EE3224` | Hover state for primary actions |
| `--red-dim` | `rgba(238, 50, 36, 0.10)` | same | Background tint, toggle-on fill |
| `--red-glow` | `rgba(238, 50, 36, 0.04)` | same | Subtle glow effects |

### Surfaces
| Token | Value (Dark) | Value (Light) | Usage |
|-------|-------------|---------------|-------|
| `--bg-base` | `#111113` | `#F5F5F7` | Page background, canvas area |
| `--bg-panel` | `#18181B` | `#FFFFFF` | Sidebar, header bars |
| `--bg-elevated` | `#222225` | `#EEEEF0` | Tooltips, overlays |
| `--bg-input` | `#1A1A1D` | `#F0F0F2` | Input fields, select boxes |
| `--bg-hover` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.03)` | Interactive hover backgrounds |

### Borders
| Token | Value (Dark) | Value (Light) | Usage |
|-------|-------------|---------------|-------|
| `--border-subtle` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` | Section dividers |
| `--border-default` | `rgba(255,255,255,0.09)` | `rgba(0,0,0,0.10)` | Input borders |
| `--border-focus` | `rgba(255,255,255,0.18)` | `rgba(0,0,0,0.22)` | Focus rings |

### Text Hierarchy
| Token | Value (Dark) | Value (Light) | Usage |
|-------|-------------|---------------|-------|
| `--text-primary` | `rgba(255,255,255,0.92)` | `rgba(0,0,0,0.88)` | Headings, active values |
| `--text-secondary` | `rgba(255,255,255,0.64)` | `rgba(0,0,0,0.55)` | Labels, body text |
| `--text-tertiary` | `rgba(255,255,255,0.30)` | `rgba(0,0,0,0.30)` | Hints, inactive items |

### Scrollbar
| Token | Value (Dark) | Usage |
|-------|-------------|-------|
| `--scrollbar-thumb` | `rgba(255,255,255,0.10)` | Scrollbar thumb |
| `--scrollbar-thumb-hover` | `rgba(255,255,255,0.16)` | Scrollbar thumb hover |

### Functional Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--camera-blue` | `#5B9CF5` | Camera FOV overlay |
| `--mic-green` | `#4ADE80` | Mic range overlay |
| `--warning-amber` | `#F59E0B` | Mic range warnings |
| `--error-red` | `#EF4444` | Layout conflicts |

### Brand Themes
| Token | Value (Dark) | Value (Light) | Usage |
|-------|-------------|---------------|-------|
| `--neat-purple` | `#7C3AED` | `#6D28D9` | Neat Systems accent |
| `--neat-purple-dim` | `rgba(124,58,237,0.12)` | same | Neat background tint |
| `--logi-teal` | `#14B8A6` | `#0D9488` | Logitech accent |
| `--logi-teal-dim` | `rgba(20,184,166,0.12)` | same | Logitech background tint |

Brand themes are applied via `.theme-neat` and `.theme-logi` classes on the root element. They override the primary accent color and its variants.

---

## Spacing (8px Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Fine adjustments, small gaps |
| `--space-sm` | `8px` | Default element gaps, margins |
| `--space-md` | `16px` | Section padding, control margins |
| `--space-lg` | `24px` | Panel padding, layout gutters |
| `--space-xl` | `32px` | Canvas area padding |

All spacing should be a multiple of 4px. Use the tokens above — avoid hardcoded pixel values.

---

## Layout

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar-width` | `360px` | Fixed sidebar width at desktop breakpoints |

The app uses a dual-canvas stack layout: a background canvas (room outline, grid, dimensions) and a foreground canvas (tables, equipment, interactive overlays).

---

## Typography

| Token | Size | Font | Usage |
|-------|------|------|-------|
| `--text-xs` | 10px | Mono | Tiny labels, presets |
| `--text-sm` | 12px | Body/Mono | Secondary text, badges |
| `--text-base` | 13px | Body | Default UI text |
| `--text-md` | 14px | Display | Section headings |
| `--text-lg` | 18px | Display | App title |
| `--text-xl` | 20px | Display | Reserved |

### Font Stack
- **Display**: `Geist Sans` (400–700) — headings, brand buttons
- **Body**: `DM Sans` (300–700) — labels, descriptions
- **Mono**: `JetBrains Mono` (400–600) — values, badges, presets

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `12px` | Canvas, cards, overlays |
| `--radius-sm` | `8px` | Buttons, inputs, toggles |
| Pill | `100px` | Preset pills, scrollbar |

---

## Shadow System

Three tiers of elevation used throughout the UI:

| Tier | Value | Usage |
|------|-------|-------|
| Subtle | `0 1px 3px rgba(0,0,0,0.2)` | Slider thumbs, small elements |
| Medium | `0 4px 16px rgba(0,0,0,0.2)` | Canvas container, cards |
| Heavy | `0 12px 48px rgba(0,0,0,0.15)` | Info overlays, frosted panels |

Frosted glass elements layer multiple shadows with `inset 0 1px 0 rgba(255,255,255,0.05)` for an inner highlight.

---

## Motion

| Token | Easing | Usage |
|-------|--------|-------|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Default for all transitions |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | Bi-directional animations |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Spring-like bounce (toggles) |

### Duration Guidelines
- Hover effects: `0.2s`
- Slider track update: `0.15s`
- View mode transition: `0.18s` (opacity + scale)
- Expand/collapse: `0.3–0.4s`
- Toggle switch: `0.35s` (spring easing)
- Toast enter/exit: `0.4s`

### Key Animations
| Name | Behavior |
|------|----------|
| `fadeIn` | `opacity 0→1` + `translateY(4px → 0)` |
| `valuePulse` | `scale(1 → 1.06 → 1)` on slider value change |
| `drag-hint-float` | Float-up with opacity fade for drag hints |

### Reduced Motion
All animations respect `prefers-reduced-motion: reduce` — durations collapse to `0.01ms`.

---

## Component Patterns

### Slider (Range Input)
- 4px track with accent fill via `--slider-pct` CSS variable
- 16px white circular thumb with shadow (`0 1px 3px rgba(0,0,0,0.3)`)
- Hover: `scale(1.15)` + accent glow ring
- Active: `scale(1.05)` with `--red-dim` shadow
- Value badge: mono font, click-to-edit, micro-pulse on change

### Toggle Switch
- 40×22px capsule, 16px knob
- Off: `rgba(255,255,255,0.08)` background
- On: `--red-dim` background, `--red` knob with glow
- Transition: `0.35s` with `--ease-spring`

### Segmented Control (Toggle Group)
- Container: `rgba(255,255,255,0.04)` background, `1px --border-subtle`, `--radius-sm`
- Padding: `3px` internal spacing
- Active segment: `--red-dim` fill, `--red` text, `font-weight: 600`
- Inner shadow: `inset 0 1px 0 rgba(255,255,255,0.04)`

### Brand Toggle
- Two-button segment, same pattern as toggle group
- Active Neat: `--neat-purple-dim` background, `--neat-purple` text, glow
- Active Logitech: `--logi-teal-dim` background, `--logi-teal` text, glow
- Active border: `rgba(color, 0.20)` with `0 0 16px` glow

### Buttons
- **Primary (Download)**: `--red` background, `font-weight: 600`, shadow with inset highlight
  - Hover: `--red-hover`, `translateY(-1px)`, larger shadow
  - Active: `scale(0.98)`
- **Secondary**: Transparent, `--text-secondary` text, `1px --border-default`
  - Hover: `--bg-hover`, `--border-focus`, `--text-primary`
- **Tertiary (Pills, Icon)**: Transparent, `--border-subtle`
  - Hover: `--border-focus`, `--bg-hover`

### Input Fields
- Background: `--bg-input`
- Border: `1px solid --border-default`
- Border-radius: `6px` (small inputs), `8px` (larger)
- Focus: `box-shadow: 0 0 0 3px --red-dim`
- Edit mode: `--border-focus` with `--red-dim` glow

### Select Dropdowns
- Custom SVG dropdown arrow
- Padding: `9px 14px`, `36px` right padding for arrow
- Hover: `--border-focus`
- Focus: `--red-dim` shadow ring

### Accordion Section
- Expanded: left border accent (2px `--red`), subtle background tint
- Chevron rotates 90° on collapse
- Body animates `max-height` + `opacity` (0.4s `--ease-out`)

### Tooltip
- Background: `--bg-elevated`
- Border: `1px --border-default`, border-radius: `12px`
- Padding: `12px 16px`
- Shadow: `0 12px 32px rgba(0,0,0,0.5)`
- Positioned above element with `translateX` centering
- Transition: `0.3s --ease-out` on opacity + transform

### Toast Notification
- Fixed top-right, slides in from right (`translateX(120%) → 0`)
- Frosted glass: `rgba(22, 22, 26, 0.85)` with `blur(16px) saturate(1.2)`
- Border-radius: `8px`, padding: `12px 16px`
- Types: `error` (red border), `success` (green border), `info` (blue icon bg)
- Auto-dismiss after 4 seconds

### Info Overlay (Frosted Glass)
- Background: `rgba(22, 22, 26, 0.70)` with `blur(24px) saturate(1.4)`
- Border: `1px rgba(255,255,255,0.08)`, border-radius: `16px`
- Padding: `16px 24px`, min-width: `290px`
- Layered shadow: heavy + medium + inner highlight

---

## Canvas Theme

Canvas rendering uses a separate color palette defined in `theme.js` as the `CANVAS_THEME` object, with dark and light variants:

| Token | Usage |
|-------|-------|
| `bg` | Canvas background fill |
| `surface` | Device/table fill |
| `displayFill` / `displayStroke` / `displayShadow` | Monitor rendering |
| `label` / `labelBright` | Dimension text |
| `gridDot` / `gridAxis` | Grid visualization |
| `wallAccent` | Red wall accent indicators |
| `viewGradStart` / `viewGradEnd` | Gradient overlays |
| `povDimTick` / `povDimDash` | POV dimension markers |

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `>900px` | CSS Grid: sidebar (`360px`) + main |
| `≤900px` | Flex column, sidebar stacks above (max `45vh`) |
| `≤768px` | Compact header, hide undo/redo buttons, smaller fonts |
| `≤600px` | Reduced padding, smaller title, compact controls |

### Container Query
Sidebar uses `container-type: inline-size` — at `≤320px` width, controls and labels shrink automatically.

---

## Accessibility

### Focus Ring
All interactive elements use a double-ring focus pattern via `:focus-visible`:
```
--focus-ring: 0 0 0 2px var(--bg-panel), 0 0 0 4px var(--red);
```
Brand themes override the outer ring color (purple for Neat, teal for Logitech).

### High Contrast Mode
When `prefers-contrast: more` is active:
- Border opacity increases (6% → 40%)
- Text secondary opacity increases (64% → 72%)

### Reduced Motion
All transitions and animations respect `prefers-reduced-motion: reduce` — durations collapse to `0.01ms`.

### Semantic Markup
- Accordion titles are keyboard-navigable (`tabindex`, `role`)
- Toasts use `aria-live` regions for screen reader announcements
- Interactive elements have descriptive `aria-label` attributes
