# 014 — Web dashboard (full frontend, rebuilt)

Status: **design, revised 2026-10-21** after the user's review of the current app ("il manque beaucoup",
"le frontend est catastrophique"). Priority: rebuild the whole frontend and put every KPI on screen with
many more charts, filters and maps. Needs 013 (comparable segments, merged first). Mobile (009) after.

## 1. Goal and users
A professional, dense, interactive dashboard — the "institutional workbench" of French residential
investment — that shows every KPI (M1–M17, D1–D18, price check and every 013 indicator) with evolution
curves, maps at every level, many filter combinations, and a newcomer can still use it without help.

- **Newcomer:** "is this town a good place to rent out a flat?" — answer in 3 clicks.
- **Active investor:** explores départements and communes, compares, filters, checks a listing, tests financing.

Success: every KPI of KPI_SPEC and every 013 field is visible somewhere (coverage matrix §7); every
figure explains itself on hover; no screen computes a market figure (only the simulator and the
property page compute from the user's own inputs).

## 2. Design direction (user brief "Zero-slop institutional workbench", 2026-10-21)
- **Forbidden:** stacks of floating cards, big radii (> 4 px), heavy or coloured shadows, glassmorphism,
  rainbow palettes and gradients, narrow centred content with empty sides, pill-shaped toy buttons.
- **Continuous docked surface:** full width and height, adjacent panels separated by 1 px lines; each panel
  has a compact header carrying its title and its tools (no box inside a box).
- **Ribbons and grids instead of boxes:** KPIs in one horizontal ribbon split by 1 px vertical rules;
  lists as dense tables (row hover, bottom hairlines), numbers right-aligned in `tabular-nums`.
- **Colour discipline:** one restrained base palette everywhere; colour only carries meaning (alert,
  positive/negative, selection, map scales). Text in 3 contrast levels (value / label / unit-meta).
- **Controls flush with the grid:** flat tabs with an underline indicator, dropdowns and segmented controls
  with 2–4 px radii, thin inputs. Not too square either: subtle radii on interactive controls.
- **Brand:** Cyfouri logo (assets/images/logo-cyfouri.jpg) in the sidebar header; warm paper background
  that matches it (light theme default), graphite ink; a dark theme with the same structure.
- Written in `docs/UI_UX.md` (tokens, components, do/don't, the 4-point checklist of the brief) in step 2.

## 3. Technical choices (approved 2026-10-21)
- Expo Router app (`apps/app`), web output; charts and maps as Expo DOM components (`'use dom'`).
- `maplibre-gl` (WebGL map, smooth with tens of thousands of points) — the user asked for a "Folium" map:
  Folium draws Leaflet maps; MapLibre gives the same choropleths and markers, faster and smoother.
  `echarts` (`echarts/core`, only used modules) for every chart. `leaflet` removed.
- Basemap OpenFreeMap (free vector tiles, no key); the app still works with the basemap blocked.
- Filters live in the URL: shareable links, back button works.
- **Individual sales are never in the public files** (DVF licence: no re-identification, no indexing).
  The finest public grain is the cadastral section with ≥ 10 sales. Individual sales appear only through the
  local price-check API (comparables on the property page), as today.

## 4. Global filters (one filter bar, on every market screen)
| Filter | Values | Notes |
|---|---|---|
| Area level | France · région · département · commune (· arrondissement) | drives the map drill-down and the tables |
| Area | search + breadcrumb | |
| Type | Appartement · Maison · (vue d'ensemble, labelled mix) | |
| Size | flats T1…T5+, houses 1-3 / 4 / 5 / 6+, all | buckets of the selected type |
| Condition | Ancien · Neuf (VEFA) | price KPIs only |
| Period | year 2021–2026 or half-year 2021-H2…2026-H1 | partial years compared by half-year only |
| Indicator | any map/table metric (§7) | |
| Reliability | all published (≥ 10 sales) · reliable only (≥ 30) | |
Screen filters on top: budget (typical price), €/m² range, yield range, cash-flow sign, population
range, vacancy max, DPE F/G max, rent control in/out, risky towns out, département/région.

## 5. Screens

### 5.1 Shell
Left sidebar (logo, navigation, theme toggle), top bar (global search, breadcrumb, filter bar), docked
content panels. Bottom tabs on narrow screens.

### 5.2 Accueil — national dashboard
KPI ribbon for France (selected segment); France choropleth by département (§5.3, compact); national
evolution curve (half-years, P25–P75 band) with flats/houses lines; top / bottom 10 départements and
communes for the selected indicator; "Par où commencer ?" with the 3 entry paths (ville / annonce /
financement), dismissible.

### 5.3 Carte — interactive map (two modes, same filters)
- **Choropleth mode (Folium-like):** régions → départements → communes (Paris/Lyon/Marseille by
  arrondissement). Diverging colour scale for prices and yields: **green = cheap / high yield, red =
  expensive / low yield** (RdYlGn), quintile breaks published by the pipeline, legend with the breaks;
  a colour-blind-safe palette toggle. Grey = not enough sales. Indicator picker grouped by theme.
- **Points mode (placed by longitude / latitude):** one point per commune (centroid) sized by sales and
  coloured by the indicator; zooming into a département switches to **cadastral-section points** (section
  centroid, ≥ 10 sales over the last two complete years) for street-level reading.
- **Hover:** tooltip with the key figures (name, €/m², 1-year change, rent, gross yield, typical cash-flow,
  sales, reliability).
- **Click:** docked side panel = mini dashboard of the place (KPI ribbon, evolution sparkline, size table,
  link to the full page), without leaving the map.

### 5.4 Explorer — prices by commune and département (new)
Pick a level (départements of France, communes of a département, arrondissements of a city):
- dense sortable table, one row per place, columns = every indicator, column filters;
- scatter chart price €/m² × gross yield (bubble = sales), hover = tooltip, click = select;
- distribution histogram of the indicator with the selected place marked;
- export CSV of the visible rows (aggregates only).
Replaces the current "Classement" (ranking per segment becomes a preset of this table).

### 5.5 Évolution — curves (new)
Up to 6 places (any level) on one chart: median €/m² per half-year (or year), P25–P75 band for one
place, index base 100 toggle, flats vs houses, sizes, new vs existing; second chart: yearly sales count
(liquidity); third: OLL rents in place over 2014–2025 where available. Table of the plotted values.

### 5.6 Marché — town page (every level)
Header (breadcrumb, name, population, period, reliability, actions: simuler, comparer, analyser un bien
ici, voir sur la carte) + KPI ribbon (€/m² with P25–P75, 1-year, CAGR, rent ANIL at the cell's surface,
gross yield, typical net yield and cash-flow, score, sales). Anchored sections, each a docked panel:
Prix (evolution curve with band, size table: €/m², median price, surface, land, outbuilding share, n,
reliability per size; new vs existing; price bands by year as a stacked chart) · Loyers & rendement (ANIL
per size with interval and level, OLL rents in place and trend, yield and price-to-rent per size,
excluded cells explained) · Rentabilité type (typical deal per size: total cost, gross/net yield, cap rate,
payment, cash-flow, 70 % test, taxe foncière) · Demande (population, jobs, vacancy and changes, income,
poverty, tenants, second homes) · Parc de logements (houses/flats share, rooms, construction period by
type, social housing) · Énergie (DPE by type, ban calendar) · Fiscalité & règles (tax rate, typical tax,
rent control) · Score (criteria with values and ranks) · Territoire (same segment vs département, région,
France, chart + table) · Voisins (neighbours table + mini map).

### 5.7 Analyser un bien
Form or extension prefill → verdict ribbon; price panel (asked vs estimate interval chart, explanation
waterfall, comparables on a map with their sale cards: type, date, surface, rooms, €/m², distance — local
API only); market panel (the property's own cell, fallback labelled); rent panel (ANIL at the property's
surface — curve parameters published, see §6 — and OLL); money panel (short simulation, link to the
simulator); risks checklist.

### 5.8 Comparer
2–4 places in columns, same segment, rows grouped like the town page, best value highlighted
(direction-aware), evolution lines overlaid, map with the places.

### 5.9 Simulateur
Inputs left, results right (ribbon + tabs Cash-flow / Fiscalité / Long terme / BRRRR), yearly cash-flow
and equity charts, amortisation table, sensitivity table (rate × price), rent excluding charges prefilled.

### 5.10 Méthode & glossaire
Every KPI from the catalogue (definition, formula, source, segments, limits), sources with dates and
licences, comparability rules.

## 6. Data to precompute (pipeline, step 1 of the delivery)
- `series/departements.json`, `series/regions.json`: median €/m², P25/P75, n per half-year and year, per
  type × size × condition (évolution and accueil without fetching 100 files).
- `explorer/<level>/<parent>.json`: one compact row per child place with every table indicator (no
  geometry); `explorer/departements.json` for France.
- `points/communes.json`: commune centroids with key indicators per type (points mode).
- `points/sections/<dep>.json`: cadastral-section aggregates (≥ 10 sales over the last two complete years,
  existing homes, per type): centroid, median €/m², n, period.
- Rent curve parameters per place and type (`rent_curve: {ref_rent_m2, ref_surface, slope}`) so the
  property page reads the rent at its exact surface (user input → computed like the simulator).
- Map breaks for every metric and level, including points layers; diverging scales centred on the
  national median.

## 7. KPI coverage matrix (every KPI has a home)
| KPI | Accueil | Carte | Explorer | Évolution | Marché | Bien | Comparer | Simul. |
|---|---|---|---|---|---|---|---|---|
| M1–M3 €/m², P25/P75, sales | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| M4–M5 1-year, CAGR | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ (resale) |
| M6–M7 median price, surface (+ land, outbuildings) | | tooltip | ✓ | | ✓ | ✓ | ✓ | ✓ (prefill) |
| M8–M10 rent, gross yield, price-to-rent | ✓ | ✓ | ✓ | OLL | ✓ | ✓ | ✓ | ✓ |
| M11–M13 vacancy, population, income | | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| M14 DPE by type | | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| M15–M16 tax rate, rent control | | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ |
| M17 score | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| D1–D12 deal KPIs (incl. D11 cap rate) | | typical | typical | | typical | ✓ | typical | ✓ |
| D13–D18 tax, IRR, leverage, BRRRR, break-even, charges | | | | | | link | | ✓ |
| Price check (ML) | | | | | | ✓ | | |
| 013: new-build premium, OLL, housing stock, neighbours, reliability, sources | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

## 8. Performance
Each route loads only its files (town page ≤ 45 KB + parents; explorer ≤ 300 KB per département; points
per département ≤ 500 KB; series files ≤ 1 MB). Charts and map code lazy per route. Budget on the
exported build: first view < 1.5 s on a laptop, filter change < 100 ms (no network when the data is
loaded), map pan/zoom at 60 fps with all communes as points.

## 9. Testing
Unit: catalogue completeness (every KPI id of KPI_SPEC has an entry), URL ↔ filter state, scale/legend
helpers, comparison highlighting, pipeline tests for every new file (no individual sale in any public
file: every section point has n ≥ 10). Typecheck and lint. Browser check of each screen after each step:
console, network, screenshots at 1440 px and 390 px, light and dark, against the brief's checklist.

## 10. Delivery order (each step verified in the browser before the next)
1. Pipeline precomputes (§6) + data loaders.
2. Design system (UI_UX.md, tokens, logo), shell, filter bar with URL state, InfoTip + catalogue, Méthode.
3. Carte: choropleth (RdYlGn) + points (communes, sections), hover tooltips, docked detail panel.
4. Explorer (table, scatter, histogram) and Évolution (multi-place curves).
5. Marché town page with every section.
6. Analyser un bien (rent at exact surface, comparables map).
7. Comparer, Simulateur, Accueil national dashboard.

## 11. Acceptance
- GIVEN the map WHEN a user picks "Prix appartement" THEN départements show green (cheap) to red (expensive),
  hovering one shows its key figures, clicking it shows its communes, and points mode shows communes and,
  zoomed in, section points placed at their coordinates.
- GIVEN Explorer on a département THEN every commune with published sales is a row, sortable by any
  indicator, and the scatter shows price × yield with the same filters.
- GIVEN Évolution with 3 places THEN their half-year curves share one chart, switchable to base 100.
- GIVEN any screen THEN it passes the brief's checklist (no floating card stacks, 1 px docked panels,
  restrained palette, tabular numbers right-aligned).
- GIVEN any public file THEN no individual sale appears (sections need ≥ 10 sales).
