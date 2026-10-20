# 002 — Commune page (web, Expo)

## User stories
- As an investor, I type a commune name and open its page.
- On the page I see price, rent, gross yield and INSEE context, with risk flags, for the segment I pick (apartment/house × rooms).
- I see the price trend by half-year.

## Architecture
- Pipeline stage S5 `publish json` writes `data/serve/`:
  - `index.json`: communes and arrondissements with published prices: code, name, département, population (for search).
  - `geo/<level>/<code>.json`: everything for one place: prices (all periods/segments), yields, socio. Target ≤ 20 KB.
- `uv run rea sync-app` copies `data/serve` into `apps/app/public/data` (gitignored); Expo web serves it statically. No API server in this step.
- App: Expo + Expo Router + TypeScript, web first. No chart library: bars drawn with plain Views.

## Acceptance criteria
- GIVEN a full run WHEN publish runs THEN index.json and one JSON per published commune exist, each ≤ 20 KB on average.
- GIVEN the home page WHEN I type "ang" THEN Angers appears in the results (accent- and case-insensitive).
- GIVEN Angers' page WHEN I pick apartment / 2 rooms THEN median €/m², rent €/m² and gross yield for 2025 match kpi_*.parquet.
- GIVEN a commune with flag_high_vacancy THEN a visible warning is shown.
- GIVEN a cell with n < 30 THEN it is labelled "low confidence"; n < 10 is never shown (not published).
- Pages for individual sales do not exist (DVF indexing rule); commune pages carry `noindex` until the legal check on aggregates is done.
