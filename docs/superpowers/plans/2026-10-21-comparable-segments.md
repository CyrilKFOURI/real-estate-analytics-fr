# Comparable Segments (013) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every published KPI belongs to one comparable cell (area × type × size × new/existing × period), carries its sample size and reliability, and is paired only with values of the same cell; plus the precomputed blocks the 014 frontend reads.

**Architecture:** changes stay inside the existing pipeline stages (S2 clean → S3 marts/rents/dpe/insee/scores → S5 publish) and their gates; the published JSON gains `schema_version: 2`, and the app's data layer (`types.ts`, `select.ts`) is adapted so current screens stay correct until 014 replaces them.

**Tech Stack:** Python 3.12, uv, DuckDB, httpx, pytest; TypeScript + node:test for the app side.

**Spec:** `docs/features/013-comparable-segments/spec.md` (study: `docs/research/segmentation_study.md`).

## Global Constraints

- Publish threshold `MIN_PUBLISHED_SALES = 10`; `reliability = "low"` for 10–29; ranking, score and map colours need n ≥ 30 (`RELIABLE_SALES = 30`, one constant in `marts.py`, imported elsewhere).
- Apartment buckets `1, 2, 3, 4, 5+`; house buckets `1-3, 4, 5, 6+`; `all` per type; column name `rooms_bucket` kept.
- Type `all` (flats + houses): price context only — no yield, no score, no band, no map colour scale, no ranking row.
- Yield column name `gross_yield` kept; meaning documented as "loyer charges comprises".
- ANIL apartment reference surfaces 37 m² (T1-T2), 52 m² (all), 72 m² (T3+); house 92 m²; rent read at the cell's median surface clamped to [25, 110] m².
- DVF rules from CLAUDE.md "Mistakes not to repeat" still hold (aggregate per mutation, arrondissement codes, partial years).
- No new Python or npm dependency. Downloads > 50 MB: say so before starting (user CLAUDE.md).
- Commit after each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A commune with prices but no ANIL row (Mayotte, new communes): yield cells absent, not an exception; test in Task 3.
2. A cell whose median surface is outside 25–110 m² (studios of 18 m², 200 m² houses): rent clamped, never extrapolated; test in Task 3.
3. An ANIL commune whose three apartment rents give a positive surface slope (rent/m² rising with surface): slope clamped to [-0.8, 0]; test in Task 3.
4. Houses with unknown rooms or rooms = 0: excluded from every size cell and from "all", counts still add up (V8); test in Task 2.
5. Département/region yields where some communes lack rents: `rent_coverage` < 1 published, not silently treated as full; test in Task 3.

---

### Task 1: Cleaning — dwelling count by lot, market-cell flags

**Files:**
- Modify: `pipeline/src/rea_pipeline/clean.py` (per_mutation CTE, final SELECT)
- Test: `pipeline/tests/test_pipeline.py`

**Interfaces:**
- Produces: `dvf_sales` gains `n_dwelling_lots INTEGER`, `has_second_building BOOLEAN`, `market_excluded VARCHAR` (NULL when the sale enters market cells, else `'large_land'` or `'outbuildings'`). Constants `MAX_HOUSE_LAND_M2 = 5_000`, `MAX_OUTBUILDINGS = 2` in `clean.py`.

- [ ] **Step 1: Write failing tests** in `test_pipeline.py` (add fixture rows with unique prices):
  - `test_identical_flats_sold_together_are_dropped`: two `Appartement` rows, same surface 45 / rooms 2, `lot` "3" and "4", price 333333 → no row with price 333333 in `dvf_sales`.
  - `test_same_flat_on_two_parcels_kept` (existing 200000 case keeps passing).
  - `test_large_land_house_flagged`: Maison 120 m², land 8000, price 444444 → `market_excluded == 'large_land'`.
  - `test_many_outbuildings_flagged`: Appartement + 3 `Dépendance` rows with lots "21","22","23", price 222222 → `market_excluded == 'outbuildings'`; with 1 dépendance (existing 200000 case) → NULL.
- [ ] **Step 2: Run** `cd pipeline && uv run pytest tests/test_pipeline.py -q` → new tests FAIL.
- [ ] **Step 3: Implement.** Dwelling key for apartments: `concat_ws('|', type_local, surface_reelle_bati, nombre_pieces_principales, nullif(lot_1, ''))`; houses keep today's key (a house repeats per parcel without lot). `market_excluded` is computed in the final SELECT (`property_type='house' AND land_m2 > MAX_HOUSE_LAND_M2` → `'large_land'`; `n_dependencies > MAX_OUTBUILDINGS` → `'outbuildings'`). Rows stay in `dvf_sales` (the ML model uses them).
- [ ] **Step 4: Run** the same command → PASS; also `uv run pytest -q` (all 39+ pass).
- [ ] **Step 5: Commit** `feat(clean): count dwellings by lot, flag large-land and many-outbuilding sales`.

### Task 2: Marts — size buckets, per-département trim, new-build cells, reliability, bands

**Files:**
- Modify: `pipeline/src/rea_pipeline/marts.py`
- Modify: `pipeline/src/rea_pipeline/validate.py` (add `check_bucket_sums`)
- Modify: `pipeline/src/rea_pipeline/cli.py` (V2 gate includes `check_bucket_sums`; land-cap share in the run report)
- Test: `pipeline/tests/test_pipeline.py`

**Interfaces:**
- Consumes: `dvf_sales.market_excluded` (Task 1).
- Produces:
  - `marts.RELIABLE_SALES = 30`; `marts.rooms_bucket_sql(property_type_col, rooms_col) -> str` (SQL CASE, apartments `1..4,5+`, houses `1-3,4,5,6+`, else `'unknown'`).
  - `kpi_price` gains `condition VARCHAR` (`'existing'` / `'new'`) and `reliability VARCHAR` (`'low'` / `'ok'`); `condition='new'` rows exist only for `rooms_bucket='all'` and `property_type IN ('apartment','house')`; `new_premium DOUBLE` on existing `all`-rooms rows of the same key.
  - `kpi_price_bands` without `property_type='all'`, every year.
  - `validate.check_bucket_sums(con) -> list[Check]` (V8).
  - `marts.land_cap_share(con) -> dict[str, float]` share of house sales removed by `large_land` per département.

- [ ] **Step 1: Write failing tests:**
  - `test_house_buckets`: houses with rooms 2, 3, 4, 5, 7 → buckets `1-3, 1-3, 4, 5, 6+`.
  - `test_unknown_rooms_out_of_all`: a sale with rooms 0 appears in no cell (n of `all` = sum of buckets).
  - `test_no_type_all_bands` and `test_bands_every_year` (fixture with 2023 and 2024 sales → both years present).
  - `test_new_build_cell`: 10 VEFA apartments + 10 existing in one commune/year → a `condition='new'` row with n 10, and `new_premium` on the existing row = new median / existing median − 1.
  - `test_reliability`: n 12 → `'low'`, n 30 → `'ok'`.
  - `test_bucket_sums_gate`: `check_bucket_sums` OK on the fixture, FAIL after deleting one bucket row.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Trim: compute bounds once per `(code_departement, property_type, rooms_bucket, year)` on sales with `market_excluded IS NULL AND NOT is_new_build`, keep sales within [P1, P99], then expand to geo levels and periods (new builds get their own bounds per `(code_departement, property_type, year)`). Unknown rooms dropped before the `all` union. Type `all` rows built from the trimmed existing sales. Bands use the same trimmed sales, per type and year. `reliability` from `n_sales`. YoY/CAGR joins add `condition` to the key.
- [ ] **Step 4: Run** `uv run pytest -q` → PASS.
- [ ] **Step 5: Commit** `feat(marts): comparable size buckets, per-département trim, new-build cells, reliability`.

### Task 3: Rents — surface-adjusted rent, exact-cell yields, excluded status, rental-home weights

**Files:**
- Modify: `pipeline/src/rea_pipeline/rents.py`, `pipeline/src/rea_pipeline/insee.py` (add `rental_homes`), `pipeline/src/rea_pipeline/validate.py` (`check_yields`)
- Test: `pipeline/tests/test_rents.py`, `pipeline/tests/test_insee.py`

**Interfaces:**
- Consumes: `kpi_price.median_surface_m2`, `condition`, `rooms_bucket` (Task 2); `kpi_socio.rental_homes`.
- Produces:
  - `rent_curve(geo_level, geo_code, property_type, ref_rent_m2, ref_surface_m2, slope, rent_low_ratio, rent_high_ratio, rent_level, rent_caution, n_listings, vintage)`: one row per area and type. Apartments: least squares of ln(rent) on ln(surface) through the 3 ANIL points, `ref_surface_m2 = 52`; houses: ANIL 92 m² point with the commune's apartment slope.
  - `rents.rent_at(ref_rent_m2: float, ref_surface_m2: float, slope: float, surface_m2: float) -> float` (Python twin used in tests and Task 6): `ref * (clamp(surface,25,110)/ref_surface) ** slope`.
  - Constants `SLOPE_BOUNDS = (-0.8, 0.0)`, `SURFACE_BOUNDS = (25, 110)`, `REFERENCE_SURFACES = {"pred-app12-mef-dhup": 37, "pred-app-mef-dhup": 52, "pred-app3-mef-dhup": 72, "pred-mai-mef-dhup": 92}`.
  - `kpi_yield` columns: `geo_level, geo_code, period_type, period, property_type, rooms_bucket, n_sales, median_price_m2, rent_m2, rent_low_m2, rent_high_m2, rent_surface_m2, rent_method ('surface_adjusted'|'house_approx'), rent_level ('commune'|'epci'|'maille'|'aggregate'), rent_caution BOOLEAN, rent_coverage DOUBLE, n_listings, rent_vintage, gross_yield, price_to_rent_years, status ('ok'|'excluded'), reason, run_id`. Only `condition='existing'`, `property_type IN ('apartment','house')`. Excluded rows: `gross_yield` and `price_to_rent_years` NULL.
  - `kpi_socio.rental_homes = main_homes - owner_homes`.

- [ ] **Step 1: Write failing tests** (`test_rents.py`, extend the fixture with per-file rents: T1-T2 18, all 15, T3+ 13 €/m², house 11):
  - `test_rent_at_matches_reference_points`: `rent_at(15, 52, slope, 52) == 15`; slope from the 3 points is negative.
  - `test_rent_clamped_outside_surface_bounds`: rent at 18 m² == rent at 25 m²; at 200 m² == at 110 m².
  - `test_positive_slope_clamped`: a commune with T1-T2 10, T3+ 14 → slope 0.
  - `test_yield_uses_cell_surface`: apartment T1 cell with median surface 28 → `rent_m2 > 18`, `rent_surface_m2 == 28`; T4 at 85 m² → `rent_m2 < 13`.
  - `test_house_yield_per_size`: house `4` cell gets a yield with `rent_method == 'house_approx'`; no yield row for `property_type='all'`.
  - `test_excluded_yield_kept_with_reason`: price 200 €/m² → row with `status='excluded'`, `gross_yield IS NULL`.
  - `test_departement_rent_weighted_by_rental_homes` and `test_rent_coverage_below_one` when one commune of the département has no rent.
  - `test_missing_anil_commune_has_no_yield` (Review Focus 1).
  - `test_insee.py::test_rental_homes`.
- [ ] **Step 2: Run** `uv run pytest tests/test_rents.py tests/test_insee.py -q` → FAIL.
- [ ] **Step 3: Implement** (SQL in DuckDB; slope via `regr_slope(ln(rent), ln(surface))` over the 3 points per commune, clamped). `rent_level` from TYPPRED lowercased ("commune", "epci", "maille"). `rent_caution = nbobs_com < 30 OR R2_adj < 0.5`. Commune level for Paris/Lyon/Marseille = arrondissements weighted by `rental_homes`. Higher levels: mean of commune rents at the higher cell's median surface weighted by `rental_homes`, `rent_coverage` = covered rental homes / all rental homes of the area. Update `check_yields`: coverage computed on `status='ok'` cells of both types per size; excluded share ≤ 0.5 %.
- [ ] **Step 4: Run** `uv run pytest -q` → PASS.
- [ ] **Step 5: Commit** `feat(rents): rent at the cell's surface, exact-cell yields, explicit exclusions`.

### Task 4: DPE by type, INSEE stock by type, typed score, merged-commune tax rate

**Files:**
- Modify: `pipeline/src/rea_pipeline/dpe.py`, `insee.py`, `scores.py`, `localtax.py`, `validate.py`
- Test: `pipeline/tests/test_dpe.py`, `test_insee.py`, `test_scores.py`, `test_localtax.py`

**Interfaces:**
- Produces:
  - `counts.csv` columns `code,type,label,n` (`type` ∈ appartement/maison/immeuble from `type_batiment`); `kpi_dpe` gains `property_type` (`'all'`, `'apartment'`, `'house'`; immeuble counts only in `all`).
  - `kpi_socio` gains `share_houses`, `share_apartments`, `main_homes_by_rooms` (5 shares 1..5+), `homes_before_1946_share`, `homes_after_2005_share` — from the comparateur if its measures exist, else from the INSEE "Logement 2022" commune base (Step 1 decides; announce size before downloading if > 50 MB).
  - Score: `share_fg` taken from `kpi_dpe` of the same `property_type`; `rent_to_income` = apartment: 12 × rent at 45 m² of the apartment curve × 45 / income; house: 12 × rent at 90 m² of the house curve × 90 / income (uses `rents.rent_at` equivalent in SQL).
  - `kpi_local_tax` for merged communes: rate of the code equal to `code_commune` if present, else population-weighted mean (`kpi_socio` not available at that stage → use REI base column if present, decided in Step 1).
- [ ] **Step 1: Inspect sources** (no code): list comparateur measures matching house/apartment/rooms/period (`duckdb` query over `comparateur.csv` distinct `TAB_MEASURE`); list REI columns for TFPB base; query the ADEME API once with `field=code_insee_ban;type_batiment;etiquette_dpe` for one département and check `total_other` stays 0 with `agg_size` 1000. Write findings as a comment block at the top of each module change.
- [ ] **Step 2: Write failing tests:** `test_dpe_by_type` (fixture counts with types → apartment and house shares, `all` includes immeuble); `test_socio_stock_by_type`; `test_house_score_uses_house_dpe` and `test_rent_to_income_per_type`; `test_merged_commune_rate_prefers_chef_lieu`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** Re-ingest DPE (≈100 API calls with the existing 1 s pause). `check_dpe` adds "apartment share F/G Paris present".
- [ ] **Step 5: Run** `uv run pytest -q` → PASS. **Step 6: Commit** `feat: DPE and housing stock by type, typed score, merged-commune tax rate`.

### Task 5: OLL rents in place (spike-gated)

**Files:**
- Create: `pipeline/src/rea_pipeline/oll.py`
- Modify: `pipeline/src/rea_pipeline/cli.py` (ingest + build + auto), `publish.py`
- Test: `pipeline/tests/test_oll.py`

**Interfaces:**
- Produces: `oll.ingest_oll() -> dict` (files `data/raw/oll/Base_OP_{YYYY}_Nationale.csv`, 2014–2025, via `ingest.download`); `oll.build_oll_kpis(con, directory: Path) -> None` → table `kpi_rent_oll(geo_level, geo_code, year, property_type, rooms ('1','2','3','4+','all'), period_built, tenancy ('all','new'), rent_m2_median, rent_m2_d1, rent_m2_d9, n_obs, observatory)`.
- [ ] **Step 1: Spike (no code kept):** download the 2025 file (~1.4 MB), confirm columns and the zone → commune link. If the national file has no commune codes, find the OLL zoning files on observatoires-des-loyers.org / data.gouv. Decision rule: with a commune mapping → publish per commune and per agglomeration; without → publish per agglomeration and attach it to the communes named as `Ville centre` by matching `agglomeration` names against `commune_map.nom` within the observatory's département, flagged `oll_scope='ville_centre'`. Record the decision in the spec §2.4.
- [ ] **Step 2: Failing tests** on a 6-row cp1252 fixture with decimal commas: parsing, `tenancy='new'` from "Moins de 1 an", rows with misaligned codes (`L7501.4.x` in a dimension column) skipped and counted.
- [ ] **Step 3: Implement, Step 4: run** `uv run pytest -q` → PASS. **Step 5: Commit** `feat: OLL rents in place`.

### Task 6: Frontend precomputes and JSON contract v2

**Files:**
- Create: `pipeline/src/rea_pipeline/deals.py`, `pipeline/tests/fixtures/typical_deal_cases.json`, `pipeline/tests/test_deals.py`, `apps/app/src/core-kpi/typical-deal.test.ts`
- Modify: `publish.py`, `mapdata.py`, `apps/app/src/core-kpi/rules.ts` (`CHARGES_RULES`), `docs/KPI_SPEC.md`
- Test: `pipeline/tests/test_publish.py`, `test_mapdata.py`

**Interfaces:**
- Produces:
  - `deals.typical_deal(price: float, surface_m2: float, rent_m2: float, tfpb_rate: float | None) -> dict` with keys `price, surface_m2, rent_monthly, total_cost, gross_yield, net_yield, cap_rate, payment_monthly, cash_flow_monthly, quick_test_monthly, taxe_fonciere_yearly` — same formulas and DEFAULTS as `core-kpi` (`analyzeDeal`, `estimateTaxeFonciere`, `rules.ts DEFAULTS`/`FR_RULES`), rent excluding charges = rent_m2 × surface − `CHARGES_RULES` provision.
  - `CHARGES_RULES = { apartmentM2Monthly, houseM2Monthly, source }` in `rules.ts`, mirrored in `deals.py`; values sourced in Step 1 and written in KPI_SPEC D-section.
  - Place JSON v2: `schema_version: 2`; `price_fields`/`yield_fields` updated; `latest: {<type>: {<bucket>: {year: <price row index>, half: <index>, basis}}}`; `typical_deal: {<type>: {<bucket>: {...typical_deal, basis, period}}}`; `energy: {all, apartment, house}`; `price_bands: {<year>: {<type>: {n_sales, bands}}}`; `oll` block where present; `neighbours: [[code, name, distance_km]]` (≤ 8, nearest commune points with a published `apartment`/`house` cell); `meta: {prices: {source, release, computed_at}, rents: {...}, socio, dpe, tax, oll}`.
  - `ranking.json`: one row per area × type × rooms_bucket (n ≥ 30, status ok), adds `rooms_bucket`, `typical_price`, `cash_flow_monthly`, `cap_rate`, `reliability`.
  - Map layers: properties per type only (`price_apartment`, `price_house`, `trend_apartment`, `trend_house`, `sales_apartment`, `sales_house`, yields, scores, `share_fg_apartment`, `share_fg_house`, …) and `map/breaks.json`: `{<metric>: [q20, q40, q60, q80]}` computed over communes with n ≥ 30.
- [ ] **Step 1: Source the charges provision** (web: a published observatory of recoverable charges per m², e.g. ANIL/ARC/UNIS); record value, source and date in KPI_SPEC.
- [ ] **Step 2: Shared fixture test:** `typical_deal_cases.json` with 3 cases (Angers T2 apartment, Paris 11e T1, Guéret house 4) — inputs and expected outputs computed by `analyzeDeal` in `typical-deal.test.ts`; `test_deals.py` asserts the Python results equal the fixture ± 0.01. Write the TS test first (it generates nothing: expected values are written into the fixture once from a node run, then both sides assert).
- [ ] **Step 3: Failing publish tests:** `schema_version == 2`; no map property or ranking row for type `all`; `breaks.json` has 4 increasing values per metric; `neighbours` ≤ 8 and excludes the place itself; `latest` points at the last complete year row.
- [ ] **Step 4: Implement, run** `uv run pytest -q` and `cd apps/app && npm test` → PASS.
- [ ] **Step 5: Commit** `feat(publish): JSON v2 with latest, typical deal, neighbours, typed map layers and breaks`.

### Task 7: App data layer on v2 (keep current screens right)

**Files:**
- Modify: `apps/app/src/data/types.ts`, `select.ts`, `map.ts`, `rank.ts`, `apps/app/src/components/place-sections.tsx`, `apps/app/src/app/place/[level]/[code].tsx`, `ranking.tsx`, `map.tsx`, `property.tsx`, `simulator.tsx`
- Test: `apps/app/src/data/select.test.ts` (create), `rank.test.ts`, `map.test.ts`

**Interfaces:**
- Consumes: JSON v2 (Task 6).
- Produces: `RoomsBucket` = `'1'|'2'|'3'|'4'|'5+'|'1-3'|'6+'|'all'`; `bucketsFor(type: PropertyType): RoomsBucket[]`; `yieldFor` matches the exact cell (no house → `all` fallback); `YieldRow.status`; `checkSchema(doc): boolean` (false → screens show "données en cours de mise à jour").
- [ ] **Step 1: Failing tests:** `yieldFor` returns the house `4` row for a house `4` segment and `undefined` when absent; `bucketsFor('house')` = `['all','1-3','4','5','6+']`; ranking filter by rooms bucket; map breaks read from `breaks.json`.
- [ ] **Step 2: Implement**; segment picker shows house buckets; excluded yields show "valeur exclue (hors bornes)"; DPE section uses the selected type; simulator prefill uses `typical_deal` and the charges provision.
- [ ] **Step 3: Run** `cd apps/app && npm test && npx tsc --noEmit && npx expo lint` → all clean.
- [ ] **Step 4: Commit** `feat(app): read comparable segments (JSON v2)`.

### Task 8: Full rebuild, before/after report, browser check, ML retrain

- [ ] **Step 1:** save the current `data/marts/kpi_price.parquet` and `kpi_yield.parquet` as `data/runs/pre013/`.
- [ ] **Step 2:** `cd pipeline && uv run rea build --skip-ingest` (after the DPE and OLL ingests of Tasks 4–5) → all gates V1–V8 OK.
- [ ] **Step 3:** before/after report on the 20 reference towns of spec §3 (script in the scratchpad, results table appended to `docs/NIGHT_LOG.md`): €/m² change per cell, yield change per size; expected T1 yields up, T4/T5+ down; land-cap share per département < 3 % (else raise `MAX_HOUSE_LAND_M2` and rerun).
- [ ] **Step 4:** `uv run rea sync-app`; browser check of `/place/commune/49007` (house T4 shows its own yield, "approximation maison"), `/ranking` (no "tous biens"), `/map` (house metrics), `/property` on "12 rue Lenepveu Angers"; console clean.
- [ ] **Step 5:** relaunch `cd ml && uv run rea-ml train` in the background (sales changed by Task 1); restart the estimate API on the new model when done.
- [ ] **Step 6:** update `PLAN.md` (013 done), `docs/features/013-comparable-segments/tasks.md`, KPI_SPEC notes; commit `chore: 013 rebuilt and verified`.
