# AV Room Planner — Design System

## Color Palette

### Surfaces (Dark Mode)
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#111113` | Page background, canvas area |
| `--bg-panel` | `#18181B` | Sidebar, header bars |
| `--bg-elevated` | `#222225` | Tooltips, overlays, hover states |
| `--bg-input` | `#1A1A1D` | Input fields, select boxes |

### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `--border-subtle` | `rgba(255,255,255,0.06)` | Section dividers |
| `--border-default` | `rgba(255,255,255,0.09)` | Input borders |
| `--border-focus` | `rgba(255,255,255,0.18)` | Focus rings |

### Text Hierarchy
| Token | Opacity | Usage |
|-------|---------|-------|
| `--text-primary` | 92% | Headings, active values |
| `--text-secondary` | 56% | Labels, body text |
| `--text-tertiary` | 30% | Hints, inactive items |

### Functional Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--camera-blue` | `#5B9CF5` | Camera FOV overlay |
| `--mic-green` | `#4ADE80` | Mic range overlay |
| `--warning-amber` | `#F59E0B` | Mic range warnings |
| `--error-red` | `#EF4444` | Layout conflicts |

### Brand Themes
- **Neat**: `--neat-purple` `#7C3AED` — overrides accent on brand select
- **Logitech**: `--logi-teal` `#14B8A6` — overrides accent on brand select

## Spacing (8px Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Fine adjustments, small gaps |
| `--space-sm` | `8px` | Default element gaps, margins |
| `--space-md` | `16px` | Section padding, control margins |
| `--space-lg` | `24px` | Panel padding, layout gutters |
| `--space-xl` | `32px` | Canvas area padding |

All spacing should be a multiple of 4px. Use the tokens above — avoid hardcoded pixel values.

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

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `12px` | Canvas, cards, overlays |
| `--radius-sm` | `8px` | Buttons, inputs, toggles |
| Pill | `100px` | Preset pills, scrollbar |

## Motion

| Token | Easing | Usage |
|-------|--------|-------|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Default for all transitions |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | Bi-directional animations |

### Duration Guidelines
- Hover effects: `0.2s`
- Expand/collapse: `0.3–0.4s`
- View mode transition: `0.18s` (opacity+scale)
- Toast enter/exit: `0.4s`

### Reduced Motion
All animations respect `prefers-reduced-motion: reduce` — durations collapse to `0.01ms`.

## Component Patterns

### Slider (Range Input)
- 4px track with accent fill via `--slider-pct` CSS variable
- 16px white circular thumb with shadow
- Hover: 1.15× scale + accent glow ring
- Value badge: mono font, click-to-edit, micro-pulse on change

### Toggle Switch
- 40×22px capsule, 16px knob
- Off: `rgba(255,255,255,0.08)` background
- On: `--red-dim` background, `--red` knob with glow

### Segmented Control (Toggle Group)
- Pill background container with 3px padding
- Active segment: `--red-dim` fill, `--red` text, subtle shadow

### Brand Toggle
- Two-button segment, same pattern as toggle group
- Active Neat: purple dim background + purple text
- Active Logitech: teal dim background + teal text

### Accordion Section
- Expanded: left border accent (2px `--red`), subtle background tint
- Chevron rotates 90° on collapse
- Body animates `max-height` + `opacity`

### Toast Notification
- Fixed top-right, slides in from right
- Types: `error` (red border), `success` (green border), `info` (blue border)
- Auto-dismiss after 4 seconds
- Frosted glass background with blur

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| `>900px` | CSS Grid: sidebar + main |
| `≤900px` | Flex column, sidebar stacks above (max 45vh) |
| `≤768px` | Compact header, hide undo/redo buttons |
| `≤600px` | Reduced padding, smaller title, compact controls |

### Container Query
Sidebar uses `container-type: inline-size` — at `≤320px` width, controls and labels shrink automatically.
