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

All FR-REG thresholds (HCSF, micro rates, notary %, DPE calendar) live in **one versioned config file** `config/fr_rules_2026.yaml`, checked once a year.

## 3. Display rules
- Hide any market cell with `n_sales < 10`; show "low confidence" for 10–29.
- Every KPI carries `source`, `period`, `n`, `computed_at` for the UI tooltip.
- No page lists individual DVF sales in MVP; individual sales (V2) are served with `noindex` + `robots.txt` exclusion (LPF art. L112 A, décret 2018-1350).

## 4. Listing extension (V2/Later)
Read only the page the user is viewing (LeBonCoin, SeLoger…) → extract price, surface, postcode, rooms in the browser → call our API for the M-KPIs of that commune/segment → show D2, D6, D12 inline. Never crawl, never store listings (site ToS + case law LeBonCoin v. Entreparticuliers 2021 + GDPR).
