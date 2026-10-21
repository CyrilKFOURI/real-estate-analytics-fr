# 013 — Comparable segments

Status: **design, not built**. Implements docs/research/segmentation_study.md (read it first: problems
P1–P16, target model §4–§6, decisions §8). Pipeline only, plus the small app changes needed to keep the
current screens consistent until 014 replaces them.

## 1. Goal
Every published value belongs to one exact cell (area × type × size × new/existing × period), carries its
sample size and how it was obtained, and is paired only with values of the same cell.

## 2. Changes

### 2.1 Cleaning (clean.py)
- Count dwellings per mutation by lot (fixes identical flats sold together, P8).
- Houses: land > 5 000 m² excluded from €/m² cells; `median_land_m2` published per house cell. Adopt only if
  the share removed is < 3 % in every département (logged in the run report; otherwise raise the cap).
- Sales with ≥ 3 outbuildings or a second building excluded; `share_with_outbuilding` published per cell.
- Unknown rooms excluded from every size cell including "all sizes".

### 2.2 Segments and thresholds (marts.py)
- Size buckets: apartments `1, 2, 3, 4, 5+`; houses `≤3, 4, 5, 6+`; `all` per type.
- New builds (VEFA) get their own cells (`condition = new`), price KPIs only, published where n ≥ 10, with
  `new_premium` = median €/m² new / existing − 1 when both exist.
- Trim P1–P99 per (département × type × size × year).
- One threshold set: publish n ≥ 10; `reliability = "low"` for 10–29; ranking, score and map colours n ≥ 30.
- Every value carries `n` and `basis` (`exact` / `all_sizes` / `parent_area`). Town pages publish `exact` and
  `all_sizes` only; `parent_area` is used by the property check and simulator prefill only.
- Price bands per area × type × year (every year), trimmed like €/m²; type `all` dropped from bands.

### 2.3 Rents and yields (rents.py)
- Apartment rent/m² per commune fitted as log-linear in surface through the three ANIL references
  (37, 52, 72 m²), read at the cell's median surface, clamped to 25–110 m². Houses: the commune's apartment
  slope applied to the 92 m² house reference, `rent_method = "house_approx"`.
- Fields per yield cell: `rent_m2`, `rent_low_m2`, `rent_high_m2` (prediction interval scaled the same way),
  `rent_surface_m2`, `rent_method` (`surface_adjusted` / `house_approx`), `rent_level` (commune / EPCI /
  maille, from TYPPRED), `rent_caution` (ANIL rule: nbobs_com < 30 or R² < 0.5), `gross_yield_cc`
  (charges included, renamed), `price_to_rent_years`.
- Yield only on the exact same cell; none for type `all`; house yields per size.
- Implausible cells kept with `status = "excluded"` and `reason`, value null (P10).
- Higher levels: rents weighted by rental main residences (INSEE `P22_RP_LOC`) of communes that have a rent;
  the paired price is the median over the same communes.

### 2.4 OLL (new source, rents.py + ingest)
- Download `Base_OP_{YYYY}_Nationale.csv` 2014–2025 (cp1252, `;`, decimal comma, ≈1.4 MB each); validate
  columns before parsing (some Paris rows carry zone codes in the period/rooms columns).
- Publish per agglomeration and its communes: rent in place €/m² (median, deciles 1/9) by type × rooms ×
  construction period × tenancy (< 1 year = new lettings proxy), yearly series, `n_obs`.
- Shown as "loyers en place (OLL)" next to ANIL, with a trend; never mixed with ANIL in one figure.

### 2.5 Other KPIs
- DPE by `type_batiment` (apartment / house) per commune via the ADEME aggregation API; higher levels summed.
- INSEE 2022 census per area: share of flats / houses, main residences by rooms and by type, construction
  period by type (use the IRIS-style unambiguous variable names), share of tenants.
- Score per type with typed inputs: DPE of that type, rent-to-income with the type's own rent (apartment T2,
  house `all`); area inputs (population, jobs, vacancy) unchanged.
- Merged communes: tax rate weighted by built-property tax base, not `any_value` (P15).
- KPI metadata per value group: `{source, period, n, computed_at}` (KPI_SPEC §3).

### 2.6 Charges provision (KPI_SPEC + app rules)
- `CHARGES_RULES`: default recoverable charges in €/m²/month per type, value and source written in KPI_SPEC
  (sourced from a published charges observatory before implementation), used only to prefill the simulator's
  rent excluding charges; shown and editable.

### 2.7 Precomputed for the frontend (014: no market figure computed on the device)
- `latest` block per type × size: the cell of the latest complete year and of the latest half-year.
- `typical_deal` per type × size (latest complete year): the median property (median price and surface,
  surface-adjusted rent) with the default financing of `core-kpi` DEFAULTS → total cost, gross/net yield,
  monthly payment, cash-flow, 70 % test, cap rate, taxe foncière estimate. Computed in Python with the same
  formulas as `core-kpi`, checked against it by a shared fixture test (same inputs → same outputs ± 0.01).
- `neighbours`: up to 8 nearest communes (centroid distance) that have a published cell, per commune.
- Map and ranking: quintile breaks per metric × type (× size where it applies) shipped with the layers;
  `typical_price` per row for the budget filter; ranking rows per type × size.

### 2.8 Published JSON (contract change)
- `prices`/`yields` rows gain `condition`, `basis`, `reliability`, and the new rent fields; `rooms_bucket`
  becomes `size` with the new house buckets. `index.json`, `ranking.json` and map layers are rebuilt with
  type-specific values only (no `price_all` colour scale). A `schema_version` field is added; the app checks
  it and shows "données en cours de mise à jour" on mismatch.
- Size target: a commune file stays < 40 KB (today max 26 KB).

## 3. Validation
- Gates: V3 extended (yield cells: every published yield has a price cell with the same key; no yield on
  type `all`); new V8 (bucket sums: n of size cells = n of `all` for each type and period).
- Before/after report on 20 reference towns (Paris 11e, Lyon 3e, Marseille 8e, Lille, Nantes, Angers, Brest,
  Limoges, Saint-Étienne, Mulhouse, Perpignan, Pau, Troyes, Guéret, Vierzon, Arcachon, Annecy, Rennes,
  Toulouse, Fort-de-France): €/m² change per cell, yield change per size; T1 yields expected up, T4/T5 down.
- Unit tests for the surface interpolation, the dwelling count, the bucket mapping and the excluded status.

## 4. Acceptance
- GIVEN a house T4 cell on a town page WHEN the yield is shown THEN it is computed on the house-4-rooms price
  and a rent labelled "approximation maison".
- GIVEN any published value THEN it carries `n`, `basis` and `reliability`.
- GIVEN the map or ranking THEN no colour scale or rank uses type `all`.
- GIVEN a yield removed as implausible THEN the app shows "valeur exclue (hors bornes)" not "pas de loyer".
