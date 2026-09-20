---
name: Calm Commerce Studio
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#464555'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#555f73'
  on-secondary: '#ffffff'
  secondary-container: '#d6e0f8'
  on-secondary-container: '#596377'
  tertiary: '#005522'
  on-tertiary: '#ffffff'
  tertiary-container: '#00702f'
  on-tertiary-container: '#78f591'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#d9e3fb'
  secondary-fixed-dim: '#bdc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3d475a'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.02em
  data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-lg: 1.75rem
  margin: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
elevation:
  level-0: 'none'
  level-1: '0 1px 3px rgba(0, 0, 0, 0.04)'
  level-2: '0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
  level-3: '0 16px 32px -8px rgba(0, 0, 0, 0.08)'
---

# Calm Commerce Studio — Design System

**Origin Project**: Solo Retail POS Manager (`projects/1203123875469000231`)  
**Target Platform**: Desktop POS / Retail Manager (Responsive down to Tablet/Mobile)  
**Theme**: Light (Modern Functional Minimalism)  

---

## 1. Brand & Style Philosophy

This design system is tailored for an independent, single-operator business running retail sales, custom print/photocopy orders, and inventory tracking without cognitive overload. The emotional response prioritizes tranquility, systematic clarity, and quiet competence. It eschews the chaotic visual noise, hyper-dense feeds, and alarms of legacy ERP or trading terminals in favor of the refined, breathing utility found in Linear, Notion, and Stripe.

The design movement is **Modern Functional Minimalism**:
- **Pristine Canvas**: Daylight-neutral canvases paired with crisp white containers.
- **Restrained Color**: The canvas remains quiet until interaction demands focus.
- **Generous Whitespace**: Micro- and macro-whitespace prevents sensory fatigue during long point-of-sale operational hours.
- **Linear Precision**: Clean single-pixel borders, optical vertical alignments, and structured typographic hierarchy with monospaced data clarity.

---

## 2. Design Tokens Reference

### A. Color Palette

#### Canvas, Surfaces & Boundaries
| Token Name | Hex | Usage |
| :--- | :--- | :--- |
| `surface` / `background` | `#f8f9fb` | Cool daylight paper background tone |
| `surface-container-lowest` | `#ffffff` | Pure white cards, tables, panels, modals |
| `surface-container-low` | `#f2f4f6` | Secondary wells, inputs, muted tabs |
| `surface-container` | `#edeef0` | Section backgrounds, structural trays |
| `surface-container-high` | `#e7e8ea` | Hover surface, segmented control track |
| `surface-container-highest` | `#e1e2e4` | Active chip background, border accents |
| `surface-dim` | `#d9dadc` | Inactive control background |
| `outline` | `#777587` | Strong border, input outline on hover |
| `outline-variant` | `#c7c4d8` | Subtle interior table divider lines |
| `border-standard` | `#e6e8ec` | Card borders, container dividers (1px solid) |

#### Text & Foreground
| Token Name | Hex | Usage |
| :--- | :--- | :--- |
| `on-surface` / `text-primary` | `#191c1e` (`#14181F`) | Deep slate-black for high contrast primary text |
| `on-surface-variant` / `text-muted` | `#464555` (`#667085`) | Calm graphite for column headers, metadata, timestamps |
| `on-primary` | `#ffffff` | Text on primary brand buttons |

#### Primary & Interactive Accent (Indigo)
| Token Name | Hex | Usage |
| :--- | :--- | :--- |
| `primary` | `#3525cd` | Primary interactive color |
| `primary-container` | `#4f46e5` | Indigo 600 button background, checkout commit |
| `on-primary-container` | `#dad7ff` | Highlighted text in primary badges |
| `primary-fixed` | `#e2dfff` | Light indigo badge tint |
| `surface-tint` | `#4d44e3` | Active focus rings (`0 0 0 3px rgba(79, 70, 229, 0.12)`) |

#### Secondary & Neutral Utility (Slate Blue)
| Token Name | Hex | Usage |
| :--- | :--- | :--- |
| `secondary` | `#555f73` | Secondary icon accents and secondary button text |
| `secondary-container` | `#d6e0f8` | Secondary action card and filter pill background |
| `on-secondary-container` | `#596377` | Secondary text in filter pills |

#### Semantic Status & Alerts
| Status | Background | Text | Border | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `#f0fdf4` (`#00702f` container) | `#16a34a` / `#ffffff` | `#dcfce7` | Completed jobs, cleared payments, healthy stock |
| **Warning** | `#fffbeb` | `#d97706` | `#fef3c7` | Low stock, low toner, pending sync |
| **Danger / Error** | `#fef2f2` (`#ffdad6` container) | `#dc2626` (`#ba1a1a`) | `#fee2e2` | Out-of-stock, voided transactions, cash discrepancy |

---

### B. Typography Tokens

- **Prose, Headings, and Interface**: `Inter, system-ui, sans-serif`
- **Monetary Sums, SKUs, Inventory Counts, Counters**: `JetBrains Mono, monospace` (with `font-variant-numeric: tabular-nums`)

| Style | Font Family | Size | Line Height | Weight | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display` | Inter | 32px | 40px | 600 (SemiBold) | -0.02em |
| `headline-lg` | Inter | 24px | 32px | 600 (SemiBold) | -0.015em |
| `headline-md` | Inter | 20px | 28px | 600 (SemiBold) | -0.01em |
| `headline-sm` | Inter | 16px | 24px | 600 (SemiBold) | -0.005em |
| `body-lg` | Inter | 16px | 24px | 400 (Regular) | normal |
| `body-md` | Inter | 14px | 20px | 400 (Regular) | normal |
| `body-sm` | Inter | 13px | 18px | 400 (Regular) | normal |
| `label-md` | Inter | 12px | 16px | 500 (Medium) | +0.01em |
| `label-sm` | Inter | 11px | 14px | 500 (Medium) | +0.02em |
| `data-lg` | JetBrains Mono | 24px | 32px | 500 (Medium) | -0.02em |
| `data-md` | JetBrains Mono | 14px | 20px | 400 (Regular) | normal |
| `data-sm` | JetBrains Mono | 12px | 16px | 400 (Regular) | normal |

---

### C. Spacing Scale

| Token | Rem | Px | Usage |
| :--- | :--- | :--- | :--- |
| `space-xs` | 0.25rem | 4px | Micro padding, icon gaps |
| `space-sm` | 0.5rem | 8px | Button inner padding (Y), tight gaps |
| `space-md` | 1.0rem | 16px | Standard component gap, table cell X padding |
| `space-lg` | 1.5rem | 24px | Card inner padding, section separation |
| `space-xl` | 2.25rem | 36px | Large layout margin, header bottom gap |
| `gutter` | 1.25rem | 20px | Grid gutter standard |
| `gutter-lg` | 1.75rem | 28px | Grid gutter on large desktop screens |
| `margin` | 1.5rem | 24px | Canvas padding (tablet/standard) |
| `margin-lg` | 2.5rem | 40px | Canvas padding (desktop >= 1280px) |

---

### D. Corner Radius Tokens

| Token | Value | Applied To |
| :--- | :--- | :--- |
| `sm` | `0.25rem` (4px) | Checkboxes, tooltips, micro badges |
| `DEFAULT` | `0.5rem` (8px) | Buttons, action controls, form fields |
| `md` | `0.75rem` (12px) | Interactive inputs, dropdown triggers |
| `lg` | `1.0rem` (16px) | Standard surface panels, cards |
| `xl` | `1.5rem` (24px) | Modals, transaction sheets, drawer containers |
| `full` | `9999px` | Status badges, category pills, switch toggles |

---

### E. Elevation & Shadow Tokens

| Level | Shadow Value | Border / Scrim | Usage |
| :--- | :--- | :--- | :--- |
| **Level 0** | `none` | None | Base canvas background (`#f8f9fb`) |
| **Level 1** | `0 1px 3px rgba(0, 0, 0, 0.04)` | `1px solid #e6e8ec` | Cards, data tables, panel containers |
| **Level 2** | `0 4px 12px -2px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.03)` | `1px solid #e6e8ec` | Dropdowns, popovers, context menus |
| **Level 3** | `0 16px 32px -8px rgba(0, 0, 0, 0.08)` | Scrim: `rgba(20, 24, 31, 0.25)` | Modals, transaction dialogs, cash checkout drawer |

---

## 3. Screen Inventory & Architecture

### Master Screen List in Project `1203123875469000231` (13 Items)

| # | Screen / Asset Title | Stitch Screen ID | Category | Status |
| :-: | :--- | :--- | :--- | :--- |
| 1 | **Lock Screen - PIN Entry** | `42ce6ffeeb104dc38f7ecbf6051d010b` | Application Screen | Core UI |
| 2 | **Dashboard** | `0d66b37c05944264a8b4f5219cdada4e` | Application Screen | Core UI |
| 3 | **POS / Quick Sale** | `6ace4d68e3ff4d5f997f2b533d408394` | Application Screen | Core UI |
| 4 | **Inventory Management** | `57ddae7e7c6b46f0ba11480fdb8b24cb` | Application Screen | Core UI |
| 5 | **Reports & Analytics** | `cc9a9dca29c849ef985caf0431371926` | Application Screen | Core UI |
| 6 | **Accounts & Wallets** | `ff0e4000e2c54073a0772d3d5b6c0aca` | Application Screen | Core UI |
| 7 | **Business Expenses** | `0149d2cfc17344529e53d476ec8447a4` | Application Screen | Core UI |
| 8 | **Customer Directory** | `3bf6038b212c4c2aaca3ca1566b32798` | Application Screen | Core UI |
| 9 | **Daily Drawer Closing** | `6428741c80f04410ac93d1c31679bdeb` | Application Screen | Core UI |
| 10 | **System Settings** | `8c8e8f336ce343c6a7542a335caa3b20` | Application Screen | Core UI |
| 11 | **Yaqoob Enterprises Logo** | `5ad823a70e5345d5aae833983f1274d0` | Asset / Graphic | Brand Logo Asset |
| 12 | **Owner Avatar Portrait** | `1c7905d4d25c44f8a63acab86d3f6d33` | Asset / Graphic | Profile Image Asset |
| 13 | **Design System Board** | `assets_1290437da0654c849095a600d421e827` | Design Token Canvas | Reference Board |

### Screen Mapping to User Requirements

All 10 application screens requested map 1-to-1 without duplicates or alternate variants:

| User Required Screen | Corresponding Stitch Screen | ID |
| :--- | :--- | :--- |
| **Lock Screen (PIN Entry)** | `Lock Screen - PIN Entry` | `42ce6ffeeb104dc38f7ecbf6051d010b` |
| **Dashboard** | `Dashboard` | `0d66b37c05944264a8b4f5219cdada4e` |
| **POS / Quick Sale** | `POS / Quick Sale` | `6ace4d68e3ff4d5f997f2b533d408394` |
| **Inventory Management** | `Inventory Management` | `57ddae7e7c6b46f0ba11480fdb8b24cb` |
| **Reports & Analytics** | `Reports & Analytics` | `cc9a9dca29c849ef985caf0431371926` |
| **Accounts** | `Accounts & Wallets` | `ff0e4000e2c54073a0772d3d5b6c0aca` |
| **Expenses** | `Business Expenses` | `0149d2cfc17344529e53d476ec8447a4` |
| **Customers** | `Customer Directory` | `3bf6038b212c4c2aaca3ca1566b32798` |
| **Closings** | `Daily Drawer Closing` | `6428741c80f04410ac93d1c31679bdeb` |
| **Settings** | `System Settings` | `8c8e8f336ce343c6a7542a335caa3b20` |

---

## 4. Component Implementation Specifications

### Buttons
- **Primary**: Solid Indigo (`#4f46e5`) fill, white text, `rounded-lg` (8px), height 40px, font weight 500. Hover: `#4338ca`. Active: scale(0.99).
- **Secondary / Subtle**: `#ffffff` background with `1px solid #e6e8ec`, `#14181f` text. Hover: `#f8f9fb`.
- **Ghost**: Transparent background, `#667085` text. Hover: `#14181f` with `#f0f2f5` background fill.

### Input Fields & Selects
- Height 40px, `rounded-md` (10px / 12px), `#ffffff` fill, `1px solid #e6e8ec`.
- Focus state: `1px solid #4f46e5` with `box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12)`.
- Numeric / Financial inputs: font-family `JetBrains Mono` with trailing unit labels (`PKR`, `gsm`, `sheets`).

### Chips & Status Badges
- Padding: `2px 8px`, pill-radius (`rounded-full`), font-size: 11px, font-weight 500.
- **Paid / Complete**: Light green `#f0fdf4`, text `#16a34a`, border `1px solid #dcfce7`.
- **Pending / Queue**: Light amber `#fffbeb`, text `#d97706`, border `1px solid #fef3c7`.
- **Low Stock / Void**: Light red `#fef2f2`, text `#dc2626`, border `1px solid #fee2e2`.

### Cards & Panels
- Background: `#ffffff`, border: `1px solid #e6e8ec`, `rounded-xl` (16px), padding: `1.5rem` (`24px`).
- Card header: 16px semi-bold (`headline-sm`) aligned with contextual actions / badges, `1rem` bottom margin.
