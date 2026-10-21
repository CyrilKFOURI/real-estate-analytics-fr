# UI / UX — Cyfouri workbench

Direction set by the user's brief "zero-slop institutional workbench" (2026-10-21). Code:
`apps/app/src/web/styles/tokens.css`, `base.css`, `apps/app/src/web/components/`.

## Principles
1. **Continuous docked surface.** Full width and height. Panels sit side by side on a 12-column grid and are
   separated by 1 px lines (their own right/bottom borders). No gaps, no floating boxes, no box inside a box.
2. **Ribbons and tables instead of cards.** Key figures in one horizontal ribbon split by 1 px rules
   (`Ribbon`); lists as dense tables (`DataTable`) with sticky headers, hairline rows and row hover.
3. **Colour means something.** Warm paper + graphite ink. Colour only for: positive / negative / warning,
   the selected item, and map scales (RdYlGn green = good end, viridis as colour-blind alternative).
4. **Three text levels.** `--ink-1` values and active data; `--ink-2` labels; `--ink-3` units, metadata.
5. **Numbers.** `tabular-nums` everywhere; labels left, numbers right.
6. **Flat controls.** Segmented buttons and selects with 3 px radius, flush in the filter bar; primary action =
   ink-on-paper inverse button, never a saturated colour.
7. **Explain every figure.** `InfoTip` (ⓘ) reads the KPI catalogue (`src/data/catalogue.ts`): definition, how
   to read it, source. Low data shown with `ReliabilityBadge`, never hidden silently.

## Forbidden (brief blacklist)
Stacks of rounded cards, radii > 4 px, drop shadows, glassmorphism, gradients, rainbow colour per card,
narrow centred content, pill-shaped toy buttons.

## Tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #f4f2ec | #131210 | app background (paper) |
| `--surface` / `--surface-2` | #fbfaf7 / #efece5 | #1a1916 / #211f1b | panels / headers, table heads |
| `--line` / `--line-strong` | #e1ddd3 / #cbc5b8 | #2d2a25 / #3d3a33 | separators / control borders |
| `--ink-1/2/3` | #1d1c1a / #5d5951 / #8e887d | #ece9e2 / #a8a297 / #77726a | text levels |
| `--accent` | #2c4a6b | #93b2d6 | selection, focus |
| `--pos` / `--neg` / `--warn` | #2f7a4f / #b0402f / #9a6514 | #72c08f / #e2806c / #d8a650 | meaning only |
Type: Inter 13 px base, 10.5 px micro-caps labels (letter-spacing 0.08 em), 20 px ribbon values; brand
wordmark in Marcellus. Radius 3 px on controls, 0 on panels. Theme: system by default, toggle in the sidebar.

## Layout
`Shell` = sidebar (212 px: logo, navigation grouped Marché / Investir / Aide, theme) + top bar (title,
breadcrumb, tools) + filter bar + scrolling content. Under 900 px the sidebar becomes a top strip and every
panel spans the full width.

## Screens are DOM components
Each route in `src/app/` is a thin wrapper (`useScreen`: URL → filters, actions → router) around a screen in
`src/web/screens/` marked `'use dom'` (React DOM + CSS on web, a webview on native later).

## Checklist before shipping a screen (from the brief)
1. Any floating card stack or big radius? → docked panels with 1 px lines.
2. Empty space or loose padding? → tighten to professional density.
3. Colours or effects without meaning? → remove.
4. Does it look like a mature professional tool, not a template?
