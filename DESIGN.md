# PixelForge — DESIGN.md

Machine-shop drafting sheet for a 3D editor. Warm graphite paper, oxide-red
accent, monospace instrumentation. The page is meant to feel like the printed
specification that ships beside a precision tool — not like a SaaS landing page.

Every value in `styles/site.css` resolves to a token declared in `:root`. If a
value is not in this document, it does not belong in the stylesheet.

---

## Personality

The site behaves like the product: an instrument you can grab. Three rules
carry that voice.

1. **Measured, never loud.** Numbers are stated plainly and are always real to
   the fiction (`42 vertices`, `6 targets`, `0 third-party scripts`). No
   superlatives, no "revolutionary", no exclamation marks.
2. **The page is instrumented.** Section numbers read as plate numbers, the
   hero facts sit on a ruled rail, the editor frame carries corner
   registration ticks. Chrome that a draughtsman would recognise.
3. **Motion is feedback, never decoration.** Things move because you touched
   them. Nothing animates on its own except the viewport, which is the product.

---

## Colour

A single chromatic accent against a warm graphite neutral ramp. No gradients,
no glows, no second accent competing for the eye.

### Light (default)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f0f1f2` | Page canvas. Never pure white. |
| `--panel` | `#f7f8f8` | Raised surfaces, hovered rows. |
| `--sunken` | `#e6e8ea` | Recessed wells: viewport, code, thumbnails. |
| `--raised` | `#fcfcfc` | Dialogs and toasts, the only true top layer. |
| `--ink-900` | `#0d1216` | Headings and primary text. |
| `--ink-700` | `#29333a` | Body copy. |
| `--ink-600` | `#3e4a52` | Secondary copy, section intros. |
| `--ink-500` | `#5a666e` | Meta, captions, monospace labels. |
| `--ink-400` | `#7a858c` | Disabled and placeholder. |
| `--border` | `#d5d9db` | Every hairline rule. |
| `--border-strong` | `#7a858c` | Emphasised edges: the editor frame. |
| `--accent` | `#c4350b` | Oxide red. Fills, ticks, marks. |
| `--accent-ink` | `#a62b08` | Accent on text and links (contrast-safe). |
| `--accent-tint` | `#f5e3dc` | The featured plan surface, nothing else. |

Status colours (`--ok`, `--warn`, `--danger`) exist only for form and system
feedback. They never appear as decoration.

Dark theme remaps the same token names in `[data-theme="dark"]`. The accent
warms to `#ff6b3d` because oxide red goes muddy on a dark ground. Backgrounds
are dark grey (`#0e1113`), never `#000`.

### Rules

- One accent. If something needs to stand out and is not the single primary
  action, use weight, size or space instead of a new colour.
- Accent on text uses `--accent-ink`, never `--accent`.
- No gradient anywhere. No glow, no aurora, no blurred blob, no mouse spotlight.
- Layer with surface colour and hairline borders, not with shadow spread.

---

## Typography

Two families. A variable grotesque for structure, a mono for anything that
represents a measurement, a filename, or machine output.

- **Archivo** (`--sans`), weights 400–800, self-hosted, subset to Latin.
  Headings at 700, body at 400.
- **IBM Plex Mono** (`--mono`), 400/500/600, self-hosted. Overlines, section
  indices, spec values, code, captions, HUD readouts, timestamps.

The mono is the voice of the machine. If a string is something the editor would
print, it is mono and uppercase with `--ls-label` tracking.

### Scale

| Token | Size | Line height |
| --- | --- | --- |
| `--fs-display` | `clamp(2.5rem, 6.2vw, 4.75rem)` | `1.02` |
| `--fs-h1` | `clamp(2rem, 4.4vw, 3.25rem)` | `1.14` |
| `--fs-h2` | `clamp(1.55rem, 2.9vw, 2.25rem)` | `1.14` |
| `--fs-h3` | `clamp(1.2rem, 1.7vw, 1.5rem)` | `1.14` |
| `--fs-lead` | `clamp(1.0625rem, 1.4vw, 1.25rem)` | `1.5` |
| `--fs-body` | `1rem` | `1.62` |
| `--fs-sm` | `0.875rem` | `1.62` |
| `--fs-mono` | `0.75rem` | `1.35` |

Tracking tightens as size grows: `--ls-display` `-0.03em`, `--ls-heading`
`-0.018em`, `--ls-label` `+0.09em` for uppercase mono.

Body text is capped at `--measure` (`62ch`); the hero deck at `54ch`.

---

## Space

An eleven-step ramp, `--s-1` (`0.25rem`) through `--s-11` (`7rem`), roughly
1.5× between adjacent steps. Sections use `--s-9` block padding, section heads
`--s-7` bottom margin, cards `--s-5` padding, inline gaps `--s-2`/`--s-3`.

Layout: `--container` `76rem`, `--gutter` `clamp(1.25rem, 4vw, 3rem)`.

---

## Shape and depth

| Token | Value | Use |
| --- | --- | --- |
| `--r-xs` | `2px` | Focus ring rounding, micro badges. |
| `--r-sm` | `4px` | Buttons, inputs, chips. |
| `--r-md` | `8px` | Frames, thumbnails, dialogs. |
| `--r-lg` | `14px` | Reserved; currently unused. |

Radii nest concentrically: a child never has a larger radius than its parent.

Shadows are layered — ambient plus direct — and only three exist. `--shadow-1`
is a contact hairline, `--shadow-2` lifts an element off the page, `--shadow-3`
is reserved for modal surfaces. Resting cards use borders, not shadows.

---

## Motion

`--dur-fast` `120ms` for colour, `--dur` `190ms` for transforms, `--dur-slow`
`340ms` for panels. Everything eases on `--ease`
`cubic-bezier(0.2, 0.7, 0.2, 1)`.

Only these properties animate: `transform`, `opacity`, `color`,
`background-color`, `border-color`, `box-shadow`. Never `width`, `height`,
`top` or `left`.

`prefers-reduced-motion: reduce` collapses every duration to `0.01ms` and stops
the viewport's idle rotation.

---

## Icons

Icons live as individual files in `media/icons/` and are painted through a CSS
mask by the `.i` class:

```html
<span class="i i--export" aria-hidden="true"></span>
```

```css
.i--export { --i-src: url("../media/icons/export.svg"); }
```

The mask means an icon inherits `currentColor` and both themes for free, while
the path data stays in one file per glyph. Size is set by `--i-size` on the
context, not by the icon.

Icons are always `aria-hidden` and always sit beside a real text label. No icon
carries meaning on its own.

The brand lockup is a real image (`media/logo-mark.svg`, plus a `-dark`
variant) served through `<picture>`, so it can be dropped into a deck or a
README unchanged.

**No SVG artwork is inlined into any page.** Decorative inline SVG in a hero is
a documented build fingerprint, and geometry belongs in files anyway.

---

## Components

- **Buttons** — `--r-sm`, 44px minimum target, three variants: `--primary`
  (accent fill, one per screen), `--secondary` (bordered), `--quiet` (text).
  Hover always increases contrast.
- **Capabilities** — a ruled list, not a card grid. Hover lights a 2px accent
  edge and insets the row, mirroring outliner selection.
- **Plans** — three columns divided by hairlines, no floating cards. The
  featured plan is marked by a tinted surface and a 2px accent edge.
- **Frame** — the editor mock. `--border-strong` edge, layered shadow, corner
  registration ticks in accent at 55% opacity.
- **Tables** — real `<table>` markup with `<caption>` and scoped headers.
  Numeric cells use `.num-col` and tabular figures.

---

## Do

- Put every new value in `:root` first, then reference the token.
- Use the spacing utilities (`.mt-4`, `.pblock-7`, `.t-muted`) instead of an
  inline `style` attribute.
- Keep numbers concrete and consistent with the rest of the site.
- Separate a number from its unit with a non-breaking space (`500&nbsp;MB`).
- Let hairline borders and surface colour do the work of separation.

## Don't

- No purple, indigo, or violet. No gradient of any kind.
- No inline SVG artwork, especially in a hero.
- No card nested inside a card. No bento grid.
- No glassmorphism, noise overlay, animated grid, or cursor spotlight.
- No Inter or Geist. No third font.
- No emoji in interface copy.
- No fake social proof, invented metrics, or unnamed testimonials.
- No `!important` outside the reduced-motion and responsive-override blocks.
