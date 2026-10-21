# Web Dashboard (014) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rebuild the whole frontend as a dense, interactive "institutional workbench" that shows every KPI with maps (choropleth + lat/lon points), evolution curves, an explorer and many filter combinations.

**Architecture:** the pipeline precomputes the extra files the screens need (series, explorer tables, points, section aggregates, rent curves). Each screen is an Expo DOM component (`'use dom'`, React DOM + CSS) wrapped by a thin Expo Router route that reads URL params and passes them as props; filter changes go back through an async native action that updates the URL. Pure logic (filters ↔ URL, catalogue, scales, formatting, selections) lives in plain TS modules with node tests.

**Tech Stack:** Python/DuckDB pipeline; Expo SDK 58 + Expo Router; React DOM in `'use dom'` components; MapLibre GL; ECharts (`echarts/core`); plain CSS with custom properties.

**Spec:** `docs/features/014-web-dashboard/spec.md` (user brief "zero-slop institutional workbench" in §2).

## Global Constraints

- No individual DVF sale in any public file; section points need ≥ 10 sales (`MIN_PUBLISHED_SALES`).
- Every page showing DVF-derived data carries `<meta name="robots" content="noindex">`.
- Design: no floating card stacks, radii ≤ 4 px, no shadows beyond a 1 px border, one restrained palette, numbers `tabular-nums` right-aligned, 1 px separators between docked panels.
- Map scale for prices/yields: green = cheap / high yield → red = expensive / low yield (RdYlGn, 5 quintile classes from published breaks), grey = < 30 sales; colour-blind toggle (viridis).
- New deps allowed (approved 2026-10-21): `maplibre-gl`, `echarts`; remove `leaflet`, `@types/leaflet`. Install with `npx expo install`.
- Route paths kept for links from the browser extension: `/place/[level]/[code]`, `/property`, `/simulator`; `/ranking` redirects to `/explorer`.
- Commit after each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A département with no published commune (Mayotte): explorer and points files exist and are empty, screens show an empty state, no crash.
2. A section whose sales straddle two communes: the section key includes the commune, never merged across communes.
3. Filters in the URL that no longer exist (old link, `rooms=5+` on houses): normalised to the nearest valid value, not a blank screen.
4. Basemap tiles blocked (offline, corporate proxy): the choropleth still draws on a plain background.
5. A place whose JSON fails to load (404 / schema mismatch): the screen shows an error panel with a retry, other panels keep working.

---

### Task 1: Pipeline precomputes for the dashboard

**Files:** Create `pipeline/src/rea_pipeline/dashboard.py`, `pipeline/tests/test_dashboard.py`; modify `publish.py` (call it, add `rent_curve` to place docs), `mapdata.py` (breaks for points).

**Interfaces — produces (in data/serve):**
- `series/areas.json`: `{fields: [level, code, condition, type, size, period_type, period, n, median, p25, p75], rows}` for france, régions, départements (n ≥ 10).
- `explorer/departements.json`, `explorer/regions.json`, `explorer/communes/<dep>.json`: `{period, fields, rows}`; one row per place × type (apartment, house) × size, latest complete year, n ≥ 10. Fields: `code, name, level, parent, type, size, n_sales, reliability, median_price_m2, p25_price_m2, p75_price_m2, median_price, median_surface_m2, yoy_change, cagr, new_premium, rent_m2, gross_yield, net_yield, cash_flow_monthly, cap_rate, score, share_fg, vacancy_rate, population, population_growth_yearly, median_living_standard, tenant_share, tfpb_rate, rent_control, flag_high_vacancy, flag_population_decline`.
- `points/communes.json`: `{fields: [code, level, name, dep, lon, lat, type, n, median_price_m2, yoy_change, gross_yield, cash_flow_monthly], rows}` latest complete year, all sizes, n ≥ 10.
- `points/sections/<dep>.json`: `{period, fields: [section, commune, lon, lat, type, n, median_price_m2], rows}` — existing homes, market sales (trimmed like kpi_price), last two complete years pooled, n ≥ 10, key = section id (includes commune code).
- Place docs: `rent_curve: {apartment|house: {ref_rent_m2, ref_surface, slope}}` for communes/arrondissements with a single ANIL code.
- `map/breaks.json` gains `points` (commune points metrics) and `sections` (`price_apartment`, `price_house`).
- `dashboard.write(con, staging, min_sales) -> dict` (stats), called by `publish.publish`.

- [ ] Step 1: failing tests (`test_dashboard.py`) on a small DuckDB fixture: series rows only n ≥ 10 and both period types; explorer rows per type × size with typical deal fields; commune points with coordinates; section points never below 10 sales and keyed by section; empty département file written for a département without rows; rent_curve present for a single-code commune and absent for a multi-code city.
- [ ] Step 2: run `cd pipeline && uv run pytest tests/test_dashboard.py -q` → FAIL.
- [ ] Step 3: implement (SQL in DuckDB, `json.dumps(..., allow_nan=False)`).
- [ ] Step 4: full suite green; commit `feat(pipeline): dashboard precomputes (series, explorer, points, sections, rent curves)`.

### Task 2: Design system, shell and filters

**Files:** Create `apps/app/src/web/` (DOM side): `styles/tokens.css`, `styles/base.css`, `components/` (`Shell`, `Sidebar`, `TopBar`, `FilterBar`, `Panel`, `Ribbon`, `DataTable`, `InfoTip`, `Segmented`, `Select`, `EmptyState`, `ErrorPanel`), `catalogue.ts`; create `apps/app/src/data/filters.ts` (+ test), `apps/app/src/data/catalogue.test.ts`; `docs/UI_UX.md`; route `src/app/method.tsx` + `src/web/screens/MethodScreen.tsx`; update `_layout.tsx` (no native header on web: the shell draws it).

**Interfaces:**
- `filters.ts`: `type Filters = { level, code, type: DwellingType | 'all', size: RoomsBucket, condition: 'existing'|'new', periodType: 'year'|'half', period: string | null, metric: string, reliable: boolean }`; `parseFilters(params: Record<string,string|undefined>): Filters` (normalises invalid values: house `5+` → `5`, unknown type → `apartment`); `toParams(f: Filters): Record<string,string>` (omits defaults).
- `catalogue.ts`: `KPI_CATALOGUE: KpiEntry[]` with `{ id, label, short, unit, format, higherIsBetter, definition, howToRead, source, segments: ('type'|'size'|'condition'|'period')[] }`; every KPI id M1–M17, D1–D18 and 013 fields.
- Screen contract: every screen is `export default function XScreen(props: { filters: Filters; onFilters: (next: Partial<Filters>) => Promise<void>; dom?: DOMProps })`.

- [ ] Step 1: failing tests: `filters.test.ts` (round trip, normalisation of invalid size/type/period), `catalogue.test.ts` (every id of KPI_SPEC §1/§2 present, no duplicate id, every metric used by the map has an entry).
- [ ] Step 2: implement; `npx expo install maplibre-gl echarts`; remove leaflet deps.
- [ ] Step 3: UI_UX.md (tokens, rules from the brief, checklist); shell with logo; Méthode screen listing the catalogue.
- [ ] Step 4: `npm test`, `npx tsc --noEmit`, `npx expo lint`; browser check of `/method` at 1440 and 390, light and dark; commit.

### Task 3: Carte

**Files:** `src/web/maps/MapView.tsx` (MapLibre wrapper), `src/web/screens/MapScreen.tsx`, `src/data/scales.ts` (+ test), route `src/app/map.tsx`.

**Interfaces:** `scales.ts`: `classOf(value, breaks)`, `colorFor(value, breaks, palette: 'rdylgn'|'viridis', higherIsBetter: boolean)` (green for the good end), `legendItems(breaks, format)`.
- [ ] Step 1: failing `scales.test.ts` (direction-aware colours, grey for missing, legend bounds).
- [ ] Step 2: implement map: choropleth (régions → départements → communes), points mode (communes; sections when zoomed into a département), hover tooltip, docked detail panel (ribbon + sparkline + size table + link).
- [ ] Step 3: tests/tsc/lint; browser check (hover, click, drill-down, points, basemap blocked); commit.

### Task 4: Explorer and Évolution

**Files:** `src/web/charts/Chart.tsx` (ECharts wrapper), `src/web/screens/ExplorerScreen.tsx`, `src/web/screens/EvolutionScreen.tsx`, `src/data/explorer.ts` (+ test), routes `explorer.tsx`, `evolution.tsx`, `ranking.tsx` → redirect.
**Interfaces:** `explorer.ts`: `filterRows(rows, filters, ranges)`, `sortRows(rows, key, dir)`, `toCsv(rows, fields)`; `evolution.ts`: `seriesFor(places, filters)`, `rebase(series, base = 100)`.
- [ ] Step 1: failing tests for filtering/sorting/CSV and rebase.
- [ ] Step 2: implement table + scatter + histogram; évolution multi-place (search to add up to 6 places), base 100, sales chart, OLL chart.
- [ ] Step 3: checks + browser; commit.

### Task 5: Marché (town page)
**Files:** `src/web/screens/PlaceScreen.tsx` + section components; route `place/[level]/[code].tsx`.
- [ ] Every section of spec §5.6 with its charts; territory comparison loads parent files; neighbours table + mini map. Tests for pure helpers it adds; browser check (Angers, Paris 11e, a small commune, a département, France); commit.

### Task 6: Analyser un bien
**Files:** `src/web/screens/PropertyScreen.tsx`, `src/data/rent.ts` (+ test: `rentAt(curve, surface)` matches the pipeline's `rent_at` on the shared fixture values); route `property.tsx`.
- [ ] Verdict ribbon, price panel (interval chart, waterfall, comparables map + cards via local API), market, rent at the exact surface, money, risks; API down → other panels still shown. Checks + browser; commit.

### Task 7: Comparer, Simulateur, Accueil
**Files:** `src/web/screens/CompareScreen.tsx`, `SimulatorScreen.tsx`, `HomeScreen.tsx`; routes `compare.tsx`, `simulator.tsx`, `index.tsx`.
- [ ] Compare 2–4 places (direction-aware best value, overlaid curves, map); simulator rebuilt (ribbon, tabs, cash-flow and equity charts, amortisation and sensitivity tables) on unchanged core-kpi; national home dashboard. Old components removed. Checks + browser on every screen; update PLAN.md, tasks.md; commit.
