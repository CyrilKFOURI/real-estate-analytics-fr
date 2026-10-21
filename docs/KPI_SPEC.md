# KPI Specification

Sources: `research/books_kpis.md` (books), `research/state_of_the_art.md` (existing apps), `research/data_sources.md` (data).
Rule: **market KPIs are precomputed by the pipeline and stored; deal KPIs are computed on the fly from user inputs + stored market KPIs. Raw data is never served.**

Legend — Tier: **MVP** / **V2** / **Later** · Kind: **M** = market (precomputed) · **D** = deal (on the fly)

## 1. Market KPIs (precomputed, per `geo_level × geo_code × period × segment`)

Geo levels: `commune` (INSEE code, 5 chars), `arrondissement` (Paris/Lyon/Marseille), `departement`, `region`, `france`; `iris` (9 chars) in V2. Periods: `year`, `rolling_12m`, `half` (S1/S2). Segments: `apartment` / `house` × rooms bucket (1, 2, 3, 4, 5+) × `all`.

| # | KPI | Formula / method | Source | Tier | Kept because |
|---|---|---|---|---|---|
| M1 | Median price €/m² | median(valeur_fonciere / surface_reelle_bati) at **mutation level**, single-lot residential sales, P1–P99 trimmed | DVF | MVP | Every comparable shows it |
| M2 | P25 / P75 €/m² | quantiles, same population | DVF | MVP | Shows dispersion, needed for listing-vs-market |
| M3 | Sales count | count(distinct id_mutation) | DVF | MVP | Liquidity; also gates display (n < 10 → hidden) |
| M4 | YoY change €/m² | M1(t) / M1(t−1) − 1 | DVF | MVP | Trend |
| M5 | 5-year CAGR €/m² | (M1(t)/M1(t−4))^(1/4) − 1 | DVF | V2 | Long trend (DVF holds ~5 y) |
| M6 | Median price per property | median(valeur_fonciere) | DVF | MVP | Budget filtering |
| M7 | Median surface | median(surface_reelle_bati) | DVF | V2 | Typology |
| M8 | Asking rent €/m² (+ low/high band) | ANIL Carte des loyers, per segment | ANIL | MVP | Needed for any yield |
| M9 | **Market gross yield** | 12 × M8 / M1 | DVF + ANIL | MVP | Core KPI of Horiz.io-type tools |
| M10 | Price-to-rent ratio | M1 / (12 × M8) | DVF + ANIL | V2 | Inverse view of M9 |
| M11 | Vacancy rate | vacant dwellings / total dwellings | INSEE | MVP | Risk (books: avoid > ~10%) |
| M12 | Population growth (5 y) | pop(t)/pop(t−5) − 1 | INSEE | V2 | Demand signal (Delagrandanne) |
| M13 | Median income & tenant affordability | Filosofi median income; M8×surface ×3 ≤ income | INSEE | V2 | "Tenant income ≥ 3× rent" rule |
| M14 | Share of DPE F/G | n(F,G) / n(all DPE) | ADEME | V2 | Rental bans (G 2025, F 2028) |
| M15 | Taxe foncière rate | commune + intercommunal TFPB rate | REI/OFGL | V2 | Default input for D-KPIs |
| M16 | Rent-cap zone flag | encadrement des loyers yes/no + reference rents | Gov lists | V2 | Compliance check |
| M17 | Market score (0–100) | weighted z-scores of M9, M4, M11, M12, M3 | derived | V2 | One-glance ranking; weights documented in code |

**Removed / postponed**
- Repeat-sales or hedonic index → *Later*: complex, the Notaires-INSEE index exists (show it as reference for depts only).
- Price history of a listing (Castorus-like) → *Later*: requires collecting listings server-side (legal risk, see §4).
- Days-on-market, listing stock → not in open data; dropped.
- Predicted rent per m² by ML → *Later*; ANIL data is good enough for MVP.

### Implementation notes (M8–M10, done)
- Source: latest ANIL "Carte des loyers" edition (2025, Q3-2025 listings, **charges included**), auto-discovered on data.gouv.fr. Editions are not comparable over time, so only the latest is used, and only paired with price periods ≥ its year (2025, 2025-H1/H2, 2026-H1).
- Segments: ANIL gives apartment (all), apartment 1–2 rooms, 3+ rooms, house. The 1–2 rooms rent is applied to both T1 and T2, and the 3+ rent to T3, T4 and T5+. So T1 yields are slightly understated: a T1 rents for more per m² than a T2.
- Paris/Lyon/Marseille: ANIL publishes arrondissements only; the city rent is the listing-weighted mean. Département, région and France rents are commune rents weighted by sales in the segment.
- `rent_source = 'maille'` means the commune has too few listings and borrows the rent of a group of neighbouring communes: show it as lower confidence.
- A very high gross yield (> 10 %) usually signals risk (vacancy, degraded condominiums, falling population), not a bargain. That's why M11–M13 and the M17 score matter.

### Implementation notes (M11–M13, done) — `kpi_socio.parquet`
- Source: INSEE "Comparateur de territoires" (one long-format file, census 2023 vs 2017, Filosofi 2023), already published for commune, arrondissement, département, région and France, so no aggregation is done.
- Columns: population, population_growth_yearly, dwellings, vacancy_rate, vacancy_change_pts, second_home_share, renter_share, median_living_standard, poverty_rate, jobs, jobs_growth_yearly.
- Flags: `flag_high_vacancy` (> 10 %), `flag_population_decline` (< −0.2 %/year). They explain most extreme yields: 6 of the top 8 gross yields carry at least one flag.
- Filosofi values are null where INSEE applies statistical secrecy (small communes).
- INSEE codes overlap between geo levels (a "bassin de vie" can be 49007): always filter on GEO_OBJECT.

### Implementation notes (M5, M7, M13–M17 and price bands, done)
- **M5 trend** (`kpi_price.cagr`, `cagr_since`): annualised change of the median €/m² since the first *complete* year of the DVF window (2022 → 2025 today); 3–4 years only, because DVF keeps 5 years.
- **M7** `median_surface_m2`; **price bands** (`kpi_price_bands`): share of sales < 100 k€, 100–200, 200–300, 300–500, > 500 k€ per geo × year × type (idea from the 2024 ECE DataViz project).
- **M13** `kpi_score.rent_to_income`: yearly rent of a 45 m² 2-room flat (ANIL T1–T2 rent) / median living standard (Filosofi, per consumption unit). Rule of thumb: ≤ 1/3.
- **M14** `kpi_dpe` (ADEME API `dpe03existant`, aggregated per commune × label, one call per département): shares A–G and F+G among DPE done since July 2021 — mostly homes sold or let, not the whole stock.
- **M15** `kpi_local_tax.tfpb_rate` (DGFiP REI): sum of the built-property tax rates levied on the commune (commune E12, syndicates E22, intercommunality E32, TSE E52, GEMAPI, TASA). The tax ≈ ½ cadastral rental value × rate. The REI amount per "article" was rejected as a per-home estimate (it mixes business premises).
- **M16** `rent_control`: communes from `pipeline/config/rent_control.json` (71 communes, 2026-09 list; Lyon/Villeurbanne under appeal but still applied), resolved to INSEE codes; unknown names fail the run. "Zones tendues" (1 434 communes) are not in open data: not done.
- **M17** `kpi_score`: weighted mean of percentile ranks among communes of the same level and type with ≥ 30 sales; weights in `pipeline/config/score_weights.json` (yield 30, trend 15, population 15, vacancy 15, jobs 10, F/G 10, sales 5); missing criteria are dropped and weights renormalised; two strengths and two weaknesses kept for the UI.
- Yields above 30 % are not published (`rents.MAX_PLAUSIBLE_YIELD`): they come from tiny odd cells; validation V3 checks they stay < 0.5 % of cells.

### Implementation notes (D14–D17, done — apps/app/src/core-kpi/projection.ts)
- **D14 IRR**: yearly projection over 10/15/20 years; rents and costs indexed, annuity amortisation, tax of the best eligible regime each year (LMNP réel: depreciation carried forward), resale at the commune trend (default +1 %/yr, capped ±5 %), capital gains tax with holding allowances (income tax exempt after 22 years, social charges after 30), flat 7.5 % fees and 15 % works after 5 years, LMNP depreciation added back since the 2025 finance law. Surtax above 50 k€ of gain not modelled.
- **D15 leverage**: re = rp + (rp − rd) × D/E with rp = NOI / total cost, rd = loan rate + insurance.
- **D16 BRRRR**: max offer = 70 % × after-repair value − works; refinance = 75 % × ARV; cash left = total cost − refinance.
- **D17 break-even occupancy**: (taxe foncière + condo charges + PNO + debt service) / (12 × rent × (1 − management − maintenance)).

## 2. Deal KPIs (on the fly, client side, pure functions in `packages/core-kpi`)

Inputs: price, notary fees (default 7.5% old / 2.5% new), works, furniture, rent, charges, taxe foncière (default M15), PNO insurance, management %, vacancy (default from M11, min 1 month/yr), loan (rate, years, down payment, insurance), tax regime, TMI.

| # | KPI | Formula | Tier |
|---|---|---|---|
| D1 | Total acquisition cost | price + notary + agency + works + furniture | MVP |
| D2 | Gross yield | 12 × rent / D1 | MVP |
| D3 | Net yield | (12×rent − vacancy − non-recoverable charges − TF − insurance − mgmt) / D1 | MVP |
| D4 | Net-net yield | (D3 numerator − tax) / D1 | V2 |
| D5 | Monthly loan payment | P × r / (1 − (1+r)^−n) + insurance | MVP |
| D6 | Monthly cash-flow (pre/post tax) | rent×(1−vac) − charges − payment (− tax/12) | MVP |
| D7 | Quick cash-flow test | 0.70 × rent − payment ≥ 0 (Delagrandanne) | MVP |
| D8 | Cash-on-cash | annual cash-flow / cash invested | MVP |
| D9 | HCSF debt ratio | (existing debt + D5) / (income + 0.70 × rent) ≤ 35% | MVP |
| D10 | DSCR | NOI / annual debt service (target ≥ 1.25) | V2 |
| D11 | Cap rate | NOI / price | V2 |
| D12 | Listing price vs market | price/m² ÷ M1 − 1, plus position in P25–P75 | MVP |
| D13 | Tax by regime | micro-foncier (30%), réel (déficit cap 10 700 €), LMNP micro-BIC / réel with depreciation | V2 |
| D14 | IRR (TRI) 10–20 y | cash-flows + resale at M5-projected price − capital-gain tax (LMNP depreciation re-added since LF 2025) | V2 |
| D15 | Leverage effect | re = rp + (rp − rd) × D/E | Later |
| D16 | BRRRR | max price = ARV×0.70 − works; refi = ARV×0.75; equity left; ARV from M1/M2 comparables | Later |
| D17 | Break-even occupancy | (opex + debt service) / gross potential rent | Later |
| D18 | Recoverable charges provision | ANIL rent (charges incl.) − provision × surface = rent excl. charges; provision 1.5 €/m²/month (flats), 0.5 (houses), editable. Order of magnitude between USH 2020 social-housing charges (~0.8 €/m²/month, no heating) and private flats with collective heating (2.5–4 €/m²/month). Checked 2026-10-21 (`CHARGES_RULES`, `deals.py`) | Done |

All FR-REG thresholds (HCSF, micro rates, notary %, DPE calendar) live in **one versioned config file** `config/fr_rules_2026.yaml`, checked once a year.

### Comparable segments (013, done — docs/research/segmentation_study.md)
- Cells: area × type (apartment / house) × size (flats T1–T4, 5+; houses 1-3, 4, 5, 6+) × condition (existing / new
  build, VEFA all sizes only) × period. Type `all` is context only: never a yield, score, band, map colour or rank.
- One threshold set: published from 10 sales, `reliability = low` under 30, rankings / scores / map colours from 30.
- Rent per m² read on each commune's ANIL curve at the cell's median surface (slope fitted on the 37/52/72 m² flat
  files, clamped to [−0.8, 0], surface clamped to 25–110 m²); houses borrow the flat slope (`house_approx`).
  Yields pair exactly the same cell; implausible ones are published with `status = excluded` and a reason.
- `typical_deal` (D1–D3, D5–D7, D11, taxe foncière estimate) is precomputed per cell with the default financing and
  the D18 provision, with the same formulas as core-kpi (shared fixture `pipeline/tests/fixtures/typical_deal_cases.json`).
- OLL rents in place (hors charges) per agglomeration and year 2014–2025, attached to the agglomeration's communes.

## 3. Display rules
- Hide any market cell with `n_sales < 10`; show "low confidence" for 10–29.
- Every KPI carries `source`, `period`, `n`, `computed_at` for the UI tooltip.
- No page lists individual DVF sales in MVP; individual sales (V2) are served with `noindex` + `robots.txt` exclusion (LPF art. L112 A, décret 2018-1350).

## 4. Listing extension (V2/Later)
Read only the page the user is viewing (LeBonCoin, SeLoger…) → extract price, surface, postcode, rooms in the browser → call our API for the M-KPIs of that commune/segment → show D2, D6, D12 inline. Never crawl, never store listings (site ToS + case law LeBonCoin v. Entreparticuliers 2021 + GDPR).
