# AV Room Planner — Design System

> **For AI assistants**: This document is the single source of truth for all visual styling in this app. When generating or modifying UI code, follow the tokens, patterns, and rules below exactly. Do not invent new tokens or override existing ones.

---

## Tech Stack & Architecture

- **Vanilla HTML / CSS / JS** — no frameworks, no build tools, no bundler
- **Single-page app** served directly from `index.html`
- **Canvas API** for 2D room/equipment rendering (dual-canvas architecture)
- **CSS custom properties** for all design tokens (no Tailwind, no CSS-in-JS)
- **Theme switching** via `data-theme="light"` attribute on `<html>`
- **Brand switching** via `.theme-neat` or `.theme-logi` class on `<body>`
- **State** managed in a plain JS object with undo/redo and URL hash serialization

### File Map

| File | Purpose | When to edit |
|------|---------|--------------|
| `index.html` | All markup, no templates | Adding/removing UI elements |
| `style.css` | All CSS, tokens in `:root` | Styling changes, new components |
| `theme.js` | Canvas color palette (`CANVAS_THEME`), theme toggle | Canvas color changes |
| `constants.js` | Grid spacing, toast duration, shortcuts | Config/tuning values |
| `data.js` | Equipment specs (cameras, mics, bars) | Adding/editing device data |
| `state.js` | App state, undo/redo, URL serialization | New state properties |
| `dom.js` | Canvas setup, DOM element caching, toast system | New DOM references |
| `utils.js` | Pure utility functions | Shared helpers |
| `input.js` | Slider binding, form control handlers | New form controls |
| `ui.js` | UI state management, brand switching, presets | UI logic |
| `tables.js` | Multi-table management, arrangements | Table features |
| `draw.js` | Canvas drawing primitives | New canvas shapes |
| `render.js` | Main rendering orchestration | Render pipeline changes |
| `pov.js` | Point-of-view (first-person) calculations | POV features |
| `drag.js` | Interactive table dragging, pan/zoom | Interaction changes |
| `export.js` | PNG download, JSON import/export | Export features |
| `init.js` | Event binding, initialization (loaded with `defer`) | New event listeners |

Scripts are loaded in the order above via `<script>` tags. `init.js` uses `defer`. There is no module system — all files share the global scope.

---

## Rules for AI Code Generation

1. **Always use CSS custom properties** — never hardcode colors, spacing, font sizes, or radii. Use `var(--token-name)`.
2. **Always use `var(--red)` for the primary accent** — not `#EE3224`. Brand themes remap `--red` to purple/teal automatically, so using the variable ensures brand compatibility.
3. **Spacing must be multiples of 4px** — use `var(--space-*)` tokens. Avoid arbitrary pixel values.
4. **Use the 3-font system** — `var(--font-display)` for headings, `var(--font-body)` for labels/text, `var(--font-mono)` for numeric values and badges.
5. **Respect the shadow tiers** — don't invent new shadow values. Use subtle, medium, or heavy (defined below).
6. **All transitions need `--ease-out`** unless spring bounce is desired (`--ease-spring`).
7. **All animations must respect `prefers-reduced-motion`** — already handled globally in the CSS, but any new `@keyframes` should follow the pattern.
8. **Canvas colors come from `cc()`** — call `cc().tokenName` in JS, not CSS variables. Canvas has its own palette in `theme.js`.
9. **Legacy aliases exist** (see below) — prefer canonical token names in new code.

---

## Design Tokens (CSS Custom Properties)

All tokens are defined in `:root` in `style.css`. Light mode overrides are in `[data-theme="light"]`.

### Surfaces
```css
--bg-base:     #111113;       /* Page background, canvas area         | Light: #F5F5F7  */
--bg-panel:    #18181B;       /* Sidebar, header bars                 | Light: #FFFFFF  */
--bg-elevated: #222225;       /* Tooltips, overlays                   | Light: #EEEEF0  */
--bg-input:    #1A1A1D;       /* Input fields, select boxes           | Light: #F0F0F2  */
--bg-hover:    rgba(255,255,255,0.04);  /* Hover backgrounds          | Light: rgba(0,0,0,0.03) */
--bg-active:   rgba(255,255,255,0.06);  /* Active/pressed backgrounds | Light: rgba(0,0,0,0.05) */
```

### Borders
```css
--border-subtle:  rgba(255,255,255,0.06);  /* Dividers, separators    | Light: rgba(0,0,0,0.06) */
--border-default: rgba(255,255,255,0.09);  /* Input borders           | Light: rgba(0,0,0,0.10) */
--border-focus:   rgba(255,255,255,0.18);  /* Focus/hover borders     | Light: rgba(0,0,0,0.22) */
```

### Text
```css
--text-primary:   rgba(255,255,255,0.92);  /* Headings, active values | Light: rgba(0,0,0,0.88) */
--text-secondary: rgba(255,255,255,0.64);  /* Labels, body text       | Light: rgba(0,0,0,0.55) */
--text-tertiary:  rgba(255,255,255,0.30);  /* Hints, inactive items   | Light: rgba(0,0,0,0.30) */
```

### Primary Accent (Gensler Red)
```css
--red:       #EE3224;                    /* Primary accent             | Light: #D92A1D  */
--red-hover: #F54D40;                    /* Hover state                | Light: #EE3224  */
--red-dim:   rgba(238, 50, 36, 0.10);   /* Background tint            | Light: rgba(217,42,29,0.08) */
--red-glow:  rgba(238, 50, 36, 0.04);   /* Subtle glow                | Light: rgba(217,42,29,0.04) */
```

> **Important**: Brand themes (`.theme-neat`, `.theme-logi`) remap `--red` and its variants to purple/teal. Always use `var(--red)` so brand switching works automatically.

### Functional Colors
```css
--camera-blue:   #5B9CF5;   /* Camera FOV overlay  */
--mic-green:     #4ADE80;   /* Mic range overlay   */
--warning-amber: #F59E0B;   /* Mic range warnings  */
--error-red:     #EF4444;   /* Layout conflicts    */
```

### Brand Colors
```css
--neat-purple:     #7C3AED;                   /* Neat Systems accent    | Light: #6D28D9  */
--neat-purple-dim: rgba(124, 58, 237, 0.12);  /* Neat background tint   | Light: 0.08 alpha */
--logi-teal:       #14B8A6;                   /* Logitech accent        | Light: #0D9488  */
--logi-teal-dim:   rgba(20, 184, 166, 0.12);  /* Logitech tint          | Light: 0.08 alpha */
```

### Scrollbar
```css
--scrollbar-thumb:       rgba(255,255,255,0.10);
--scrollbar-thumb-hover: rgba(255,255,255,0.16);
```

### Legacy Aliases (do not use in new code)
These exist for backward compatibility. Use the canonical names instead.
```css
--bg-primary    → var(--bg-base)        --accent       → var(--red)
--bg-secondary  → var(--bg-panel)       --accent-bright→ var(--red-hover)
--bg-tertiary   → var(--bg-elevated)    --accent-dim   → var(--red-dim)
--bg-surface    → var(--bg-elevated)    --accent-glow  → var(--red-glow)
--border        → var(--border-default) --cam-color    → var(--camera-blue)
--border-accent → var(--border-default) --mic-color    → var(--mic-green)
--text-muted    → var(--text-secondary) --orange       → var(--warning-amber)
--text-dim      → var(--text-tertiary)
```

---

## Typography

### Font Stacks
```css
--font-display: 'Geist Sans', -apple-system, BlinkMacSystemFont, sans-serif;
--font-body:    'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono:    'JetBrains Mono', ui-monospace, monospace;
```

### Size Scale
```css
--text-xs:   10px;   /* Tiny labels, preset pills        — use with --font-mono   */
--text-sm:   12px;   /* Secondary text, badges            — use with --font-body or --font-mono */
--text-base: 13px;   /* Default UI text                   — use with --font-body   */
--text-md:   14px;   /* Section headings                  — use with --font-display */
--text-lg:   18px;   /* App title                         — use with --font-display */
--text-xl:   20px;   /* Reserved for future use           — use with --font-display */
```

---

## Spacing & Layout

### Spacing Scale (8px grid)
```css
--space-xs: 4px;    /* Fine adjustments, small gaps  */
--space-sm: 8px;    /* Default element gaps, margins */
--space-md: 16px;   /* Section padding, control margins */
--space-lg: 24px;   /* Panel padding, layout gutters */
--space-xl: 32px;   /* Canvas area padding */
```

### Layout Tokens
```css
--sidebar-width: 360px;   /* Fixed sidebar width at desktop breakpoints */
```

---

## Border Radius

```css
--radius:    12px;   /* Canvas, cards, overlays      */
--radius-sm: 8px;    /* Buttons, inputs, toggles     */
/* Pill:     100px;     Preset pills, scrollbar (no token — use literal) */
```

---

## Shadow System

Three tiers of elevation. Copy these exactly — do not create new shadow values.

```css
/* Subtle — slider thumbs, small elements */
box-shadow: 0 1px 3px rgba(0,0,0,0.2);

/* Medium — canvas container, cards */
box-shadow: 0 4px 16px rgba(0,0,0,0.2);

/* Heavy — info overlays, frosted panels */
box-shadow: 0 12px 48px rgba(0,0,0,0.15);

/* Frosted glass inner highlight (combine with heavy) */
box-shadow: 0 12px 48px rgba(0,0,0,0.4),
            0 2px 8px rgba(0,0,0,0.2),
            inset 0 1px 0 rgba(255,255,255,0.05);
```

---

## Focus Ring

```css
--focus-ring: 0 0 0 2px var(--bg-panel), 0 0 0 4px var(--red);
```

Applied via `:focus-visible` on all interactive elements. Brand themes auto-override the outer ring color.

---

## Motion

### Easing Functions
```css
--ease-out:    cubic-bezier(0.22, 1, 0.36, 1);    /* Default for all transitions */
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);    /* Bi-directional animations  */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Spring bounce (toggles)    */
```

### Duration Guidelines
| Context | Duration | Easing |
|---------|----------|--------|
| Hover effects | `0.2s` | `--ease-out` |
| Slider track fill | `0.15s` | `--ease-out` |
| View mode transition | `0.18s` | `--ease-out` (opacity + scale) |
| Expand/collapse | `0.3–0.4s` | `--ease-out` |
| Toggle switch | `0.35s` | `--ease-spring` |
| Toast enter/exit | `0.4s` | `--ease-out` |

### Key Animations
```css
@keyframes fadeIn      { from { opacity: 0; transform: translateY(4px); } }
@keyframes valuePulse  { 50% { transform: scale(1.06); } }             /* On slider value change */
@keyframes drag-hint-float { to { opacity: 0; transform: translateY(-8px); } }
```

### Reduced Motion
All animations respect `prefers-reduced-motion: reduce` — durations collapse to `0.01ms`. This is handled globally. Any new `@keyframes` are automatically covered.

---

## Component Patterns

### Slider (Range Input)
```css
/* Track: 4px height, gradient fill via JS-set --slider-pct variable */
background: linear-gradient(to right, var(--red) var(--slider-pct), rgba(255,255,255,0.08) var(--slider-pct));

/* Thumb: 16px white circle */
width: 16px; height: 16px;
background: white;
border-radius: 50%;
box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.08);

/* Hover: scale up + glow ring */
transform: scale(1.15);
box-shadow: 0 0 0 4px var(--red-dim), 0 1px 6px rgba(0,0,0,0.4);

/* Active: slight squeeze */
transform: scale(1.05);
```

### Toggle Switch
```css
/* Container: 40×22px capsule */
width: 40px; height: 22px;
border-radius: 100px;
background: rgba(255,255,255,0.08);          /* Off state */
/* background: var(--red-dim);               /* On state  */

/* Knob: 16px circle */
width: 16px; height: 16px;
background: rgba(255,255,255,0.25);          /* Off state */
/* background: var(--red);                   /* On state — with glow */
transition: transform 0.35s var(--ease-spring);
```

### Segmented Control (Toggle Group)
```css
/* Container */
background: rgba(255,255,255,0.04);
border: 1px solid var(--border-subtle);
border-radius: var(--radius-sm);
padding: 3px;
box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);

/* Active segment */
background: var(--red-dim);
color: var(--red);
font-weight: 600;
```

### Brand Toggle
Same as segmented control, but active states use brand colors:
```css
/* Neat active */
background: var(--neat-purple-dim);
color: var(--neat-purple);
border-color: rgba(124, 58, 237, 0.20);
box-shadow: 0 0 16px rgba(124, 58, 237, 0.15);

/* Logitech active */
background: var(--logi-teal-dim);
color: var(--logi-teal);
border-color: rgba(20, 184, 166, 0.20);
box-shadow: 0 0 16px rgba(20, 184, 166, 0.15);
```

### Buttons
```css
/* Primary (e.g. Download) */
background: var(--red);
color: white;
font-weight: 600;
border-radius: var(--radius-sm);
box-shadow: 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
/* Hover: background: var(--red-hover); transform: translateY(-1px); */
/* Active: transform: scale(0.98); */

/* Secondary */
background: transparent;
color: var(--text-secondary);
border: 1px solid var(--border-default);
/* Hover: background: var(--bg-hover); border-color: var(--border-focus); color: var(--text-primary); */

/* Tertiary (pills, icon buttons) */
background: transparent;
border: 1px solid var(--border-subtle);
/* Hover: border-color: var(--border-focus); background: var(--bg-hover); */
```

### Input Fields
```css
background: var(--bg-input);
border: 1px solid var(--border-default);
border-radius: 6px;          /* 8px for larger inputs */
color: var(--text-primary);
font-family: var(--font-body);
/* Focus: box-shadow: 0 0 0 3px var(--red-dim); */
```

### Select Dropdowns
```css
background: var(--bg-input);
border: 1px solid var(--border-default);
border-radius: var(--radius-sm);
padding: 9px 36px 9px 14px;  /* Extra right padding for arrow */
/* Custom SVG arrow positioned via background-image */
/* Hover: border-color: var(--border-focus); */
/* Focus: box-shadow: 0 0 0 3px var(--red-dim); */
```

### Accordion Section
```css
/* Expanded state */
border-left: 2px solid var(--red);
background: var(--red-glow);

/* Chevron rotation */
transform: rotate(0deg);      /* Expanded */
transform: rotate(-90deg);    /* Collapsed */

/* Body animation */
transition: max-height 0.4s var(--ease-out), opacity 0.4s var(--ease-out);
```

### Tooltip
```css
background: var(--bg-elevated);
border: 1px solid var(--border-default);
border-radius: 12px;
padding: 12px 16px;
box-shadow: 0 12px 32px rgba(0,0,0,0.5);
transition: opacity 0.3s var(--ease-out), transform 0.3s var(--ease-out);
```

### Toast Notification
```css
/* Frosted glass container */
background: rgba(22, 22, 26, 0.85);
backdrop-filter: blur(16px) saturate(1.2);
border: 1px solid var(--border-default);
border-radius: 8px;
padding: 12px 16px;
box-shadow: 0 8px 32px rgba(0,0,0,0.4);

/* Slide-in from right */
transform: translateX(120%);                              /* Hidden */
transform: translateX(0);                                 /* Visible */
transition: transform 0.4s var(--ease-out);

/* Type variants — left border accent */
/* toast-error:   border-left: 3px solid var(--error-red);   */
/* toast-success: border-left: 3px solid var(--mic-green);   */
/* toast-info:    (blue icon background, no border accent)   */

/* Auto-dismiss: 4 seconds (TOAST_DURATION in constants.js) */
```

### Info Overlay (Frosted Glass)
```css
background: rgba(22, 22, 26, 0.70);
backdrop-filter: blur(24px) saturate(1.4);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 16px;
padding: 16px 24px;
min-width: 290px;
box-shadow: 0 12px 48px rgba(0,0,0,0.4),
            0 2px 8px rgba(0,0,0,0.2),
            inset 0 1px 0 rgba(255,255,255,0.05);
```

---

## Canvas Theme (`theme.js`)

Canvas rendering uses a **separate** color palette — not CSS variables. Access via `cc().tokenName` in JS.

### Dark Mode Canvas Colors
```js
cc().bg              // '#111215'                     — canvas background
cc().surface         // '#1C1D22'                     — device/table fill
cc().displayFill     // '#121820'                     — display body
cc().displayInner    // 'rgba(26,32,44,0.8)'          — display inner
cc().displayStroke   // 'rgba(138,146,164,0.25)'      — display border
cc().displayShadow   // 'rgba(91,156,245,0.15)'       — display glow
cc().label           // '#A0A2AA'                     — dimension labels (WCAG AA)
cc().labelBright     // '#EAEBED'                     — prominent values
cc().gridDot         // 'rgba(255,255,255,0.03)'      — grid dots
cc().gridAxis        // 'rgba(92,94,102,0.5)'         — grid axis lines
cc().roomStroke      // 'rgba(255,255,255,0.06)'      — room outline
cc().wallAccent      // 'rgba(238,50,36,0.05)'        — red wall indicators
cc().tableStroke     // 'rgba(255,255,255,0.08)'      — table outline
cc().viewGradStart   // 'rgba(255,255,255,0.06)'      — view gradient start
cc().viewGradEnd     // 'rgba(255,255,255,0)'          — view gradient end
cc().viewDash        // 'rgba(255,255,255,0.12)'      — view dashed lines
cc().viewPill        // 'rgba(0,0,0,0.75)'            — view label pill
cc().viewText        // 'rgba(255,255,255,0.9)'       — view label text
cc().scaleBarPill    // 'rgba(17,18,21,0.80)'         — scale bar background
cc().scaleBarTick    // 'rgba(139,141,149,0.60)'      — scale bar ticks
cc().povDimDash      // 'rgba(139,141,149,0.40)'      — POV dimension dashes
cc().povDimTick      // 'rgba(139,141,149,0.70)'      — POV dimension ticks
cc().povBadgeStroke  // 'rgba(139,141,149,0.35)'      — POV badge outline
```

Light mode equivalents are defined in `CANVAS_THEME.light` — `cc()` returns the correct set automatically based on `data-theme`.

---

## Responsive Breakpoints

```css
/* Desktop (default) */
@media (min-width: 901px)  → CSS Grid: sidebar (360px) + main

/* Tablet */
@media (max-width: 900px)  → Flex column, sidebar stacks above (max-height: 45vh)

/* Small tablet */
@media (max-width: 768px)  → Compact header, hide undo/redo, smaller fonts

/* Mobile */
@media (max-width: 600px)  → Reduced padding, smaller title, compact controls
```

### Container Query
```css
/* Sidebar uses container query for ultra-narrow widths */
.sidebar { container-type: inline-size; }

@container (max-width: 320px) {
    /* Controls and labels shrink automatically */
}
```

---

## Accessibility

### Focus Ring
All interactive elements use `:focus-visible` with a double-ring pattern:
```css
box-shadow: var(--focus-ring);
/* Expands to: 0 0 0 2px var(--bg-panel), 0 0 0 4px var(--red) */
```
Brand themes auto-override the outer ring color.

### High Contrast Mode
```css
@media (prefers-contrast: more) {
    /* Border opacity: 6% → 40% */
    /* Text secondary opacity: 64% → 72% */
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
    /* All transition/animation durations → 0.01ms */
}
```

### Semantic Markup
- Accordion titles: keyboard-navigable (`tabindex`, `role`)
- Toasts: `aria-live` regions for screen reader announcements
- Interactive elements: descriptive `aria-label` attributes
