# Notion Inspired Design System

> Source: [getdesign.md/notion/design-md](https://getdesign.md/notion/design-md)  
> From: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) on GitHub  
> Not an official Notion design system. A curated starting point for building Notion-like UIs with your AI coding agent.

---

## 1. Visual Theme & Atmosphere

Notion's website embodies the philosophy of the tool itself: a blank canvas that gets out of your way. The design system is built on warm neutrals rather than cold grays, creating a distinctly approachable minimalism that feels like quality paper rather than sterile glass.

The page canvas is pure white (`#ffffff`) but the text isn't pure black — it's a warm near-black (`rgba(0,0,0,0.95)`) that softens the reading experience imperceptibly. The warm gray scale (`#f6f5f4`, `#31302e`, `#615d59`, `#a39e98`) carries subtle yellow-brown undertones, giving the interface a tactile, almost analog warmth.

The custom **NotionInter** font (a modified Inter) is the backbone of the system. At display sizes (64px), it uses aggressive negative letter-spacing (−2.125px), creating headlines that feel compressed and precise. The weight range is broader than typical systems: 400 for body, 500 for UI elements, 600 for semi-bold labels, and 700 for display headings. OpenType features `"lnum"` (lining numerals) and `"locl"` (localized forms) are enabled on larger text.

What makes Notion's visual language distinctive is its **border philosophy**. Rather than heavy borders or shadows, Notion uses ultra-thin `1px solid rgba(0,0,0,0.1)` borders — borders that exist as whispers. The shadow system is equally restrained: multi-layer stacks with cumulative opacity never exceeding 0.05.

### Key Characteristics

- **NotionInter** (modified Inter) with negative letter-spacing at display sizes (−2.125px at 64px)
- Warm neutral palette: grays carry yellow-brown undertones (`#f6f5f4` warm white, `#31302e` warm dark)
- Near-black text via `rgba(0,0,0,0.95)` — not pure black, creating micro-warmth
- Ultra-thin borders: `1px solid rgba(0,0,0,0.1)` throughout — whisper-weight division
- Multi-layer shadow stacks with sub-0.05 opacity for barely-there depth
- **Notion Blue** (`#0075de`) as the singular accent color for CTAs and interactive elements
- Pill badges (9999px radius) with tinted blue backgrounds for status indicators
- 8px base spacing unit with an organic, non-rigid scale

---

## 2. Color Palette & Roles

### Core Colors

| Token | Hex | Use |
|-------|-----|-----|
| Notion Black | `rgba(0,0,0,0.95)` / `#000000f2` | Primary text, headings, body copy |
| Pure White | `#ffffff` | Page background, card surfaces, button text on blue |
| Notion Blue | `#0075de` | Primary CTA, link color, interactive accent |
| Deep Navy | `#213183` | Secondary brand color, dark feature sections |
| Active Blue | `#005bab` | Button active/pressed state |

### Warm Neutral Scale

| Token | Hex | Use |
|-------|-----|-----|
| Warm White | `#f6f5f4` | Background surface tint, section alternation |
| Warm Dark | `#31302e` | Dark surface background |
| Warm Gray 500 | `#615d59` | Secondary text, descriptions, muted labels |
| Warm Gray 300 | `#a39e98` | Placeholder text, disabled states, captions |

### Semantic Accent Colors

| Token | Hex | Use |
|-------|-----|-----|
| Teal | `#2a9d99` | Success states |
| Green | `#1aae39` | Confirmation, completion badges |
| Orange | `#dd5b00` | Warning states |
| Pink | `#ff64c8` | Decorative accent, feature highlights |
| Purple | `#391c57` | Premium features |
| Brown | `#523410` | Earthy accent |

### Interactive Colors

| Token | Hex | Use |
|-------|-----|-----|
| Link Blue | `#0075de` | Primary link color |
| Link Light Blue | `#62aef0` | Links on dark backgrounds |
| Focus Blue | `#097fe8` | Focus ring |
| Badge Blue Bg | `#f2f9ff` | Pill badge background |
| Badge Blue Text | `#097fe8` | Pill badge text |

### Shadows & Depth

**Card Shadow:**
```
rgba(0,0,0,0.04) 0px 4px 18px,
rgba(0,0,0,0.027) 0px 2.025px 7.84688px,
rgba(0,0,0,0.02) 0px 0.8px 2.925px,
rgba(0,0,0,0.01) 0px 0.175px 1.04062px
```

**Deep Shadow:**
```
rgba(0,0,0,0.01) 0px 1px 3px,
rgba(0,0,0,0.02) 0px 3px 7px,
rgba(0,0,0,0.02) 0px 7px 15px,
rgba(0,0,0,0.04) 0px 14px 28px,
rgba(0,0,0,0.05) 0px 23px 52px
```

**Whisper Border:** `1px solid rgba(0,0,0,0.1)`

---

## 3. Typography Rules

**Font Family:** `NotionInter, Inter, -apple-system, system-ui, Segoe UI, Helvetica, Arial`  
**OpenType Features:** `"lnum"` and `"locl"` enabled on display and heading text.

### Type Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Display Hero | 64px (4.00rem) | 700 | 1.00 | −2.125px | Maximum compression |
| Display Secondary | 54px (3.38rem) | 700 | 1.04 | −1.875px | Secondary hero |
| Section Heading | 48px (3.00rem) | 700 | 1.00 | −1.5px | Feature section titles |
| Sub-heading Large | 40px (2.50rem) | 700 | 1.50 | normal | Card headings |
| Sub-heading | 26px (1.63rem) | 700 | 1.23 | −0.625px | Section sub-titles |
| Card Title | 22px (1.38rem) | 700 | 1.27 | −0.25px | Feature cards |
| Body Large | 20px (1.25rem) | 600 | 1.40 | −0.125px | Introductions |
| Body | 16px (1.00rem) | 400 | 1.50 | normal | Standard reading |
| Body Medium | 16px (1.00rem) | 500 | 1.50 | normal | Navigation, UI |
| Body Semibold | 16px (1.00rem) | 600 | 1.50 | normal | Strong labels |
| Nav / Button | 15px (0.94rem) | 600 | 1.33 | normal | Navigation links |
| Caption | 14px (0.88rem) | 500 | 1.43 | normal | Metadata |
| Caption Light | 14px (0.88rem) | 400 | 1.43 | normal | Descriptions |
| Badge | 12px (0.75rem) | 600 | 1.33 | +0.125px | Pill badges, tags |
| Micro Label | 12px (0.75rem) | 400 | 1.33 | +0.125px | Timestamps |

### Typography Principles

- **Compression at scale:** −2.125px at 64px, progressively relaxing to normal at 16px
- **Four-weight system:** 400 (body), 500 (UI), 600 (emphasis), 700 (headings/display)
- **Warm scaling:** Line height tightens as size increases (1.50 → 1.00)
- **Badge micro-tracking:** Only positive letter-spacing in the system (+0.125px at 12px)

---

## 4. Component Stylings

### Buttons

**Primary**
```
Background: #0075de
Text: #ffffff
Padding: 8px 16px
Radius: 4px
Border: 1px solid transparent
Hover: background → #005bab
Active: scale(0.9) transform
Focus: 2px solid focus outline
```

**Secondary / Tertiary**
```
Background: rgba(0,0,0,0.05)
Text: #000000
Padding: 8px 16px
Radius: 4px
Hover: text color shifts, scale(1.05)
Active: scale(0.9) transform
```

**Ghost / Link Button**
```
Background: transparent
Text: rgba(0,0,0,0.95)
Decoration: underline on hover
```

**Pill Badge Button**
```
Background: #f2f9ff
Text: #097fe8
Padding: 4px 8px
Radius: 9999px (full pill)
Font: 12px weight 600
```

### Cards & Containers

```
Background: #ffffff
Border: 1px solid rgba(0,0,0,0.1)
Radius: 12px (standard) / 16px (featured/hero)
Shadow: [Card Shadow — see above]
Hover: subtle shadow intensification
```

### Inputs & Forms

```
Background: #ffffff
Text: rgba(0,0,0,0.9)
Border: 1px solid #dddddd
Padding: 6px
Radius: 4px
Focus: blue outline ring
Placeholder: #a39e98
```

### Navigation

- Clean horizontal nav on white, not sticky
- Brand logo left-aligned
- Links: 15px weight 500–600, near-black text
- CTA: blue pill button right-aligned
- Mobile: hamburger menu collapse

### Border Radius Scale

| Size | Value | Use |
|------|-------|-----|
| Micro | 4px | Buttons, inputs |
| Subtle | 5px | Links, menu items |
| Standard | 8px | Small cards |
| Comfortable | 12px | Standard cards |
| Large | 16px | Hero cards |
| Full Pill | 9999px | Badges, pills |
| Circle | 100% | Avatars |

---

## 5. Layout Principles

### Spacing System

**Base unit: 8px**  
Scale: `2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 16, 24, 32px` (with fractional values for micro-adjustments)

### Grid & Container

- Max content width: ~1200px
- Hero: centered single-column, 80–120px top padding
- Feature sections: 2–3 column card grids
- Full-width `#f6f5f4` section backgrounds for alternation

### Whitespace Philosophy

- **Generous vertical rhythm:** 64–120px between major sections
- **Warm alternation:** White ↔ Warm White (`#f6f5f4`) sections
- **Content-first density:** Compact body text (line-height 1.50) surrounded by ample margin

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (0) | No shadow | Page background, text blocks |
| Whisper (1) | `1px solid rgba(0,0,0,0.1)` | Card outlines, dividers |
| Soft Card (2) | 4-layer shadow (max opacity 0.04) | Content cards |
| Deep Card (3) | 5-layer shadow (max opacity 0.05, 52px blur) | Modals, hero elements |
| Focus | `2px solid focus color` | Keyboard focus |

---

## 7. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile Small | <400px | Tight single column |
| Mobile | 400–600px | Stacked layout |
| Tablet Small | 600–768px | 2-column grids begin |
| Tablet | 768–1080px | Full card grids |
| Desktop Small | 1080–1200px | Standard desktop |
| Desktop | 1200–1440px | Full layout |
| Large Desktop | >1440px | Centered, generous margins |

### Collapsing Strategy

- Hero: 64px → 40px → 26px on mobile
- Navigation: horizontal links → hamburger menu
- Feature cards: 3-column → 2-column → single column
- Section spacing: 80px+ → 48px on mobile

---

## 8. Accessibility & States

### Interactive States

| State | Treatment |
|-------|-----------|
| Default | Standard appearance with whisper borders |
| Hover | Color shift, scale(1.05) on buttons, underline on links |
| Active/Pressed | scale(0.9) transform, darker background |
| Focus | 2px solid blue outline + shadow |
| Disabled | Warm gray (`#a39e98`) text, reduced opacity |

### Color Contrast

- Primary text on white: ~18:1 (WCAG AAA)
- Secondary text (`#615d59`) on white: ~5.5:1 (WCAG AA)
- Blue CTA (`#0075de`) on white: ~4.6:1 (WCAG AA large text)
- Badge text on badge bg: ~4.5:1 (WCAG AA large text)

---

## 9. Agent Prompt Guide

### Quick Color Reference

```
Primary CTA:       #0075de  (Notion Blue)
Background:        #ffffff  (Pure White)
Alt Background:    #f6f5f4  (Warm White)
Heading text:      rgba(0,0,0,0.95)
Body text:         rgba(0,0,0,0.95)
Secondary text:    #615d59
Muted text:        #a39e98
Border:            1px solid rgba(0,0,0,0.1)
Link:              #0075de
Focus ring:        #097fe8
```

### Example Component Prompts

**Hero Section:**
> "Create a hero section on white background. Headline at 64px NotionInter weight 700, line-height 1.00, letter-spacing −2.125px, color rgba(0,0,0,0.95). Subtitle at 20px weight 600, line-height 1.40, color #615d59. Blue CTA button (#0075de, 4px radius, 8px 16px padding, white text) and ghost button (transparent bg, near-black text, underline on hover)."

**Card:**
> "Design a card: white background, 1px solid rgba(0,0,0,0.1) border, 12px radius. Shadow stack: rgba(0,0,0,0.04) 0px 4px 18px, rgba(0,0,0,0.027) 0px 2.025px 7.85px, rgba(0,0,0,0.02) 0px 0.8px 2.93px, rgba(0,0,0,0.01) 0px 0.175px 1.04px. Title at 22px weight 700, letter-spacing −0.25px. Body at 16px weight 400, color #615d59."

**Pill Badge:**
> "Build a pill badge: #f2f9ff background, #097fe8 text, 9999px radius, 4px 8px padding, 12px weight 600, letter-spacing +0.125px."

**Navigation:**
> "Create navigation: white header. 15px weight 600 links, near-black text. Blue pill CTA 'Get Notion free' right-aligned (#0075de bg, white text, 4px radius)."

**Alternating Sections:**
> "Design an alternating section layout: white sections alternate with warm white (#f6f5f4). Each section: 64–80px vertical padding, max-width 1200px centered. Section heading at 48px weight 700, line-height 1.00, letter-spacing −1.5px."

### Iteration Guide

- Always use **warm neutrals** — Notion's grays have yellow-brown undertones, never blue-gray
- Letter-spacing scales with size: −2.125px @ 64px → −0.625px @ 26px → normal @ 16px
- Four weights only: 400 (read), 500 (interact), 600 (emphasize), 700 (announce)
- Borders are whispers: `1px solid rgba(0,0,0,0.1)` — never heavier
- Shadows: 4–5 layers, individual opacity never exceeding 0.05
- Warm White (`#f6f5f4`) section alternation is essential for visual rhythm
- Pill badges (9999px) for status/tags; 4px radius for buttons and inputs
- **Notion Blue** (`#0075de`) is the only saturated color — use sparingly for CTAs and links
