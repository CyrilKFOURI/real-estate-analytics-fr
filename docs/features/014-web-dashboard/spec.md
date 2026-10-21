# 014 — Web dashboard (full frontend)

Status: **design, not built**. Needs 013 (comparable segments) for its data contract. Replaces the current
screens' layout; keeps their routes. Mobile (009) comes after and reuses the same code.

## 1. Goal and users
A professional web dashboard that shows every KPI (M1–M17, D1–D17, price check) with real charts and maps,
that a first-time visitor can use without help, and that stays fast because it reads precomputed JSON.

- **Newcomer:** "is this town a good place to rent out a flat?" — must get an answer in 3 clicks.
- **Active investor:** compares towns, checks a listing, tests financing.

Success: a newcomer reaches a town page and a property verdict without reading docs; every figure explains
itself in one hover/tap; no screen computes market figures on the device.

## 2. Technical choices (approved 2026-10-21)
- Stay in the Expo Router app (`apps/app`), web output.
- Charts and maps as Expo DOM components (`'use dom'`): real web libraries on the web, rendered in a webview
  on mobile later. New dependencies: `maplibre-gl` (vector map, WebGL) and `echarts` (charts, imported through
  `echarts/core` with only the chart types used). `leaflet` and `@types/leaflet` are removed.
- Basemap: OpenFreeMap (free vector tiles, no key) under the choropleth and comparables; the app still works
  with the basemap blocked (choropleth on plain background).
- Filters live in the URL (`?type=apartment&size=3&period=2025`): shareable links, back button works.
- Only the simulator computes on the device (user inputs, pure arithmetic in `core-kpi`). Everything that
  depends only on public data is read from JSON (013 publishes the missing pieces). The price check calls the
  local API; when it is down the page shows the rest and "estimation indisponible".

## 3. Information architecture

| Route | Screen | Main question |
|---|---|---|
| `/` | Accueil | "Par où commencer ?" — search + 3 entry paths (une ville / une annonce / un financement) + national snapshot |
| `/map` | Carte | where are prices, yields, risks? |
| `/place/[level]/[code]` | Marché (France → région → département → commune → arrondissement) | what is this market like for my segment? |
| `/ranking` | Classement | which towns fit my criteria? |
| `/compare?codes=…` | Comparer (new) | these 2–4 towns side by side, same segment |
| `/property` | Analyser un bien | is this listing's price right, does it pay? |
| `/simulator` | Simulateur | does my financing work? |
| `/method` | Méthode & glossaire (new) | what does each KPI mean, where does it come from? |

Shell: left sidebar on wide screens (≥ 1024 px), bottom tabs on narrow ones; global search (town) in the top
bar; the segment filter bar sits under the page title on every market screen.

## 4. Shared rules
1. **Segment filter bar:** area · type (Appartement / Maison) · size (apartments T1…T5+, houses ≤3…6+) ·
   period (year or half-year). Default: Appartement, all sizes, latest complete year. "Tous biens" is a
   separate "vue d'ensemble" toggle, labelled as a mix, never ranked or mapped.
2. **A card whose KPI ignores a filter** says "même valeur pour tous les biens" (INSEE, tax, rent control).
3. **Every figure has an ⓘ:** definition, how to read it, source, period, n, basis ("cellule exacte" /
   "toutes tailles"), reliability. Content comes from one catalogue (`src/data/kpi-catalog.ts`) also rendered
   on `/method`.
4. **Comparisons lock the segment;** a missing cell shows "pas de donnée pour ce segment".
5. **Time words:** "ventes signées 2025" for prices, "loyers d'annonce 2025" (ANIL), "loyers en place" (OLL).
6. **Low data shown, not hidden:** reliability badge, grey on maps, excluded values say why.
7. **No advice wording; noindex on every page** showing DVF-derived data.

## 5. Screens

### 5.1 Accueil
Search box (towns, départements, with population and price hint), three cards for the entry paths, a short
"comment lire l'app" (3 steps, dismissible, remembered on the device), national KPI strip, links to the map
and ranking.

### 5.2 Marché (town page, all levels)
- **Header:** breadcrumb, name, population, period, reliability, mini-map locating the area; actions
  "Simuler un achat ici", "Comparer", "Analyser un bien ici".
- **KPI strip (selected segment):** €/m² (with P25–P75), 1-year change, CAGR, rent €/m² (ANIL, level and
  caution), gross yield (charges incl.), score /100, sales count.
- **Sections (anchored tabs):**
  - *Prix:* half-year line with P25–P75 band; size breakdown table (€/m², median price, surface, n per size);
    price bands per year (stacked bars); new vs existing premium.
  - *Loyers & rendement:* ANIL rent with interval per size (surface-adjusted), OLL rent in place and trend
    where available, gross yield and price-to-rent per size, excluded cells explained.
  - *Rentabilité type:* typical deal of the segment's median property with default financing (013 publishes
    it): total cost, net yield, monthly payment, cash-flow, 70 % test, cap rate — with "Ajuster dans le
    simulateur".
  - *Demande & population:* population trend, vacancy and change, income, tenants share, second homes,
    stock by type and rooms.
  - *Énergie:* DPE label distribution for the selected type; rental ban calendar (G 2025, F 2028, E 2034).
  - *Fiscalité & règles:* property tax rate and estimate for the typical property, rent control.
  - *Score:* the score's criteria with each one's value and rank (radar or bar list).
  - *Comparer au territoire:* same segment for département, région, France (read from their JSON).
  - *Voisins:* communes nearby with the same segment (013 publishes the list).

### 5.3 Carte
Full-height MapLibre map, France by département, click → communes of that département; metric picker
grouped by theme (Prix, Rendement, Demande, Énergie, Fiscalité, Score); segment filter bar; quintile legend
with the breaks published by the pipeline; hover tooltip (value, n, reliability); click → side panel with the
area's KPI card and links. Communes under 30 sales grey.

### 5.4 Classement
Data table: sortable columns (score, yield, €/m², change, CAGR, population growth, vacancy, DPE F/G, tax
rate, sales), segment filter bar plus filters (département/région, budget for the typical property, rent
control out, risky towns out, min sales), paging, "ajouter à la comparaison", CSV export of the visible rows
(aggregates only).

### 5.5 Comparer
2–4 towns in columns, same segment, rows grouped like the town page, best value per row highlighted
(direction-aware: lower price, higher yield…), small trend lines per town, a map with the towns.

### 5.6 Analyser un bien
Form (address, type, size, surface, land, new build, price, DPE, outbuildings) or extension prefill.
Results: verdict badges and one sentence; price block (asked vs estimate interval chart, waterfall of the
explanation, comparables on a map + sale cards: type, date, surface, rooms, €/m², distance); market block (the
property's own cell, fallback labelled); rent block (ANIL at the property's surface, OLL if any); money block
(short simulator summary + "Ajuster le financement"); risks checklist.

### 5.7 Simulateur
Same maths as today (core-kpi), new layout: inputs left, results right; tabs Cash-flow / Fiscalité / Long
terme (IRR, leverage, break-even) / BRRRR; charts for the yearly cash-flow and equity build-up; rent prefilled
excluding charges (provision shown).

### 5.8 Méthode & glossaire
Every KPI from the catalogue: definition, formula, source, segments it supports, limits; data sources with
dates and licences; the comparability rules (from the segmentation study) in plain French.

## 6. Design system
- Written in `docs/UI_UX.md` in step 1 (direction, tokens, component rules), then applied everywhere.
- Direction: sober professional data tool — light by default with a dark mode, one accent colour, Inter with
  tabular figures, dense but airy cards, no decorative effects.
- Tokens in `src/constants/theme.ts`: colours (surfaces, text, accent, positive/negative/warning), chart
  palettes (categorical, sequential colour-blind safe for maps, official DPE colours), type scale, spacing,
  radii, elevation. No hard-coded colour outside the tokens.
- Components (`src/components/`): AppShell, SegmentBar, KpiCard, InfoTip, Section, Badge, ReliabilityBadge,
  DataTable, ChartFrame + chart DOM components (line with band, bars, stacked bars, waterfall, interval,
  radar), MapView DOM component, EmptyState, ErrorState, Skeleton.

## 7. Performance
- Each route loads its JSON only (town page ≤ 40 KB + parents ≈ 3 × 40 KB); charts and map code are loaded per
  route (lazy), ECharts trimmed to used modules.
- Budget on a laptop (dev build excluded, `expo export` build measured): town page usable < 1.5 s, map first
  render < 2 s, filter change < 100 ms (no network), JS per route ≤ 600 KB gzipped for map routes and
  ≤ 300 KB otherwise.

## 8. Testing
- Unit: catalogue completeness (every KPI id of KPI_SPEC has an entry), segment/URL helpers, comparison
  highlighting, existing core-kpi tests.
- Typecheck and lint clean.
- Browser check of each screen after each step: console errors, network (no failed JSON), screenshots at
  1440 px and 390 px, light and dark.

## 9. Delivery order
1. Design system + shell + SegmentBar + InfoTip/catalogue + `/method` (and UI_UX.md).
2. Town page.
3. Map (MapLibre) — Leaflet removed.
4. Property page.
5. Ranking + Compare.
6. Simulator layout, Accueil, onboarding.
Each step is verified in the browser before the next one starts.

## 10. Acceptance
- GIVEN a newcomer on `/` WHEN they type a town and pick "Maison" THEN the town page shows house figures only,
  each with an ⓘ, in under 3 clicks.
- GIVEN two towns in `/compare` THEN every row uses the same type, size and period, and a missing cell says so.
- GIVEN any market screen THEN no market figure is computed on the device (only formatting, sorting,
  filtering of published values).
- GIVEN the price-check API is down THEN `/property` still shows market, rent, money and risk blocks.
