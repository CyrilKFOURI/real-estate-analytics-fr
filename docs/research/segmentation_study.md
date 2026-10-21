# Segmentation study: compare like with like

Date: 2026-10-21. Sources checked: the current code (pipeline, ml, app) and the documentation of each open source.
Goal: every figure the app shows, and every comparison it makes (between towns, periods, segments, or a
property and its market), must put side by side things of the same kind. This study sets the rules; the
frontend spec and the pipeline changes follow from it.

## 1. Principles

1. **Apartments and houses are never mixed in a comparison.** "Tous biens" stays as context only
   (volume of the market), labelled "mélange appartements + maisons", never as a default, never ranked,
   never on a map by default.
2. **A segment is (area, type, size, new/existing, period).** Two figures are comparable only if they share
   the segment except for the one dimension being compared (two towns, same type/size/period; two periods,
   same town/type/size).
3. **A fallback is always visible.** When a cell is too thin, we use a broader segment, but the figure says
   so ("T3 → tous T", "commune → maille ANIL") and carries its sample size.
4. **Each source keeps its own meaning.** DVF = past signed prices; ANIL = current asking rents of new
   lettings, unfurnished, charges included; OLL = rents in place (stock). Labels say which.
5. **Not comparable over time when the source says so.** ANIL editions change method each year: no rent
   trend from ANIL.

## 2. What each source allows (summary)

| Source | Type | Size | New / existing | Construction period | Furnished | Area | Time |
|---|---|---|---|---|---|---|---|
| DVF (prices) | maison / appartement | rooms, built surface (not Carrez), land | VEFA = new | ✗ | ✗ | parcel → all levels | half-year 2021-H2 → 2026-H1 |
| ANIL 2025 (asking rents) | 3 apartment files + houses | via reference surface: T1-T2 37 m², all 52 m², T3+ 72 m², houses 92 m² | ✗ | ✗ | unfurnished only | commune / EPCI / maille (TYPPRED) | one edition, not comparable to earlier ones |
| OLL (rents in place) | apartment / house | rooms 1P–4P+ (houses 1-3P / 4P+) | ✗ | 5 periods | unfurnished (to confirm) | 52 agglomerations, centre / outskirts | yearly 2014–2025, comparable |
| Paris / Lyon rent control | apartment | rooms 1–4+ | ✗ | 4 periods | furnished / unfurnished | quartier | yearly |
| ADEME DPE | appartement / maison / immeuble | surface | existing (new = other set) | 10 periods | ✗ | commune | since 2021-07 |
| INSEE census 2022 | stock of houses / flats | main residences by rooms, by type | ✗ | 6 periods, by type | ✗ | commune, IRIS | one census (5-year rolling) |
| Filosofi, REI tax, rent-control perimeters | area only | | | | | commune | yearly |

What no open source gives: floor, lift, condition, parking value, furnished sales. The notaires' indices
use them from closed databases (BIEN/Perval); we cannot, so our strata are type × size × new/existing.

## 3. Problems found in the current pipeline/app (audit)

Ordered by impact on what the user reads. Refs are `pipeline/src/rea_pipeline/` unless stated.

| # | Problem | Where | Effect |
|---|---|---|---|
| P1 | Place page shows a house T3 price next to a yield computed on houses "all rooms" | `apps/app/src/data/select.ts:25-31` | yield and price from two segments, unlabelled |
| P2 | One rent/m² per ANIL file applied to every size: T1 and T2 share the 37 m² rent, T3/T4/T5+ the 72 m² rent, houses of every size the 92 m² rent | `rents.py:31-33` | rent/m² falls with surface → yields of small units understated, large ones overstated |
| P3 | Yield called "gross" but ANIL rent is charges included | `rents.py:174` | overstates yield vs the books' definition (rent excl. charges) |
| P4 | "Tous biens" price, trend, sales and price bands on map/ranking mix flats and houses | `mapdata.py`, `marts.py:126-162` | differences between towns reflect the mix, not prices |
| P5 | "All rooms" includes sales with unknown rooms that no rooms bucket contains | `marts.py:57, 65-68` | buckets don't add up to "all" |
| P6 | Outlier trim per type, not per rooms bucket | `marts.py:47-60` | a 5+ house cell is trimmed with bounds set by small houses |
| P7 | Land and outbuildings included in price/m² with no control | `clean.py:94, 118` | house €/m² driven by land size; flats sold with parking look dearer |
| P8 | Identical flats sold together pass the single-dwelling filter (doubled price) | `clean.py:89-91` | outliers in €/m² |
| P9 | Score: house row uses the apartment T2 rent for rent-to-income; DPE share is whole-stock while prices are typed | `scores.py:68-69, 37-38` | house score partly built on apartment data |
| P10 | Yields > 30 % or price < 300 €/m² removed silently; app says "pas de loyer publié" | `rents.py:181-182` | user can't tell "no data" from "excluded" |
| P11 | Price bands: whole price, untrimmed, no rooms split, latest year only | `marts.py:126-162` | not consistent with the €/m² figures on the same page |
| P12 | Higher-level rents weighted over communes that have a rent, prices over all communes | `rents.py:139-160` | rent and price of a département cover different areas |
| P13 | Property check maps houses and rooms < 1 to "all" without saying so | `apps/app/src/app/property.tsx:73-74, 147` | unlabelled fallback |
| P14 | New builds (VEFA) excluded from prices but not published anywhere | `marts.py:30` | lost information (new-build premium) |
| P15 | Merged communes take an arbitrary tax rate | `localtax.py:63` | wrong TF estimate in a few communes |
| P16 | Ranking/score need 30 sales, publication 10, app warns under 30: three thresholds | `marts.py:12`, `publish.py:181`, `score_weights.json` | inconsistent "reliable" meaning |

## 4. The segment model (target)

### 4.1 Dimensions

| Dimension | Values | Notes |
|---|---|---|
| Area | France, région, département, commune, arrondissement (Paris/Lyon/Marseille) | unchanged |
| Type | `apartment`, `house`; `all` = context only | `all` never compared, ranked, or mapped by default |
| Size (apartment) | T1, T2, T3, T4, T5+ | by rooms, as today |
| Size (house) | ≤3 p, 4 p, 5 p, 6+ p | houses are larger: today's 2/3/4/5+ puts half the houses in 4 and 5+ |
| New / existing | `existing` (default, all KPIs), `new` (VEFA, price only) | new published as its own figure where n ≥ 10 |
| Period | half-year and calendar year; partial years compared by half-year only | unchanged |

Surface bands are not a separate filter: rooms are what buyers search for, and the median surface of each
cell is published next to it so users see what "T3" means locally.

### 4.2 Cleaning rules to add

- Single-dwelling sales: count dwellings by lot, not by distinct (type, surface, rooms) — fixes P8.
- Houses: exclude land > 5 000 m² from €/m² KPIs (estates, farms) and publish `median_land_m2` per house
  cell. To validate: measure the share of sales removed per département before adopting (target < 3 %).
- Outbuildings: keep (a cellar or parking is normal with a flat) but exclude sales with ≥ 3 outbuildings or
  a second building; publish `share_with_outbuilding`.
- Unknown rooms: excluded from size buckets **and** from "all sizes" so that buckets add up (P5).
- Trim P1–P99 per (département × type × size × year) instead of per cell or per type (P6): stable bounds even
  for thin commune cells.

### 4.3 Thresholds (one meaning everywhere, fixes P16)

| n sales in the cell | Shown | Label | Used in ranking, score, map colour |
|---|---|---|---|
| < 10 | no (falls back, see 4.4) | — | no |
| 10–29 | yes | "fiabilité faible" | no (grey on map) |
| ≥ 30 | yes | — | yes |

For rents: ANIL's own rule (`nbobs_com` < 30 or R² < 0.5 → "à interpréter avec prudence"), and the
prediction level (commune / EPCI / maille) always shown.

### 4.4 Fallback order (always labelled)

1. Exact cell (area × type × size × period).
2. Same area and type, all sizes ("T3 → tous T").
3. Same type and size in the parent area — only for the property check and the simulator prefill, never on a
   town page (a town page shows its own data or nothing).

Each published value carries `basis` (`exact` / `all_sizes` / `parent_area`) and `n`.

## 5. Rents and yields (the most sensitive pairing)

- **Rent at the cell's own surface (fixes P2).** ANIL gives three apartment rents per m² for 37, 52 and 72 m².
  Rent per m² is fitted per commune as a log-linear function of surface through those three points, then read
  at the cell's median surface (T1 at 28 m² gets a higher €/m² than the 37 m² reference, T5 at 100 m² a lower
  one; extrapolation capped at the 25–110 m² range). Houses have one point (92 m²): use the apartment slope of
  the same commune, flagged "approximation maison". Label: "loyer ajusté à la surface médiane (X m²)".
- **Yield pairs exactly the same cell** (type × size × area × period). No yield for `all` (P1 fixed by
  publishing house yields per size instead of mapping to "all").
- **Charges (P3):** ANIL rents include charges and no open source gives recoverable charges by commune. We
  rename the KPI "rendement brut (loyer charges comprises)" everywhere and the simulator asks for the rent
  excluding charges, prefilled with ANIL minus a provision the user sees and edits. The provision value is an
  open decision (see §8).
- **Excluded yields are explicit (P10):** publish the cell with `status: "excluded"` and the reason
  ("loyer ou prix hors des bornes plausibles") instead of dropping it.
- **Département / région rents (P12):** weight by the number of rental main residences (INSEE `P22_RP_LOC`)
  of communes with a rent, and pair with a price computed over the same communes.
- **OLL (new source, 52 agglomerations):** rents in place by type × rooms × construction period, comparable
  over time 2014–2025 → a real rent trend where it exists, and a second opinion next to ANIL. Small files
  (≈1.4 MB/year).
- **Paris / Lyon reference rents (new source):** rooms × period × furnished × quartier → on the property page,
  check that a rent is legal in a rent-control zone.

## 6. Other KPIs

| KPI | Segment today | Target |
|---|---|---|
| Price bands | area × type, latest year, untrimmed | area × type × year, every year, trimmed like €/m² (P11); flats and houses separate |
| DPE labels | area, all dwellings | area × type (`type_batiment` via the ADEME aggregation API), existing stock |
| INSEE context | area | add per area: share of flats/houses, main residences by rooms and by type, construction period by type, share of tenants (all available in the 2022 census) |
| Score /100 | per type, mixes typed and area inputs | per type with typed inputs where they exist (DPE by type, rent-to-income with the type's own rent) (P9) |
| Map / ranking | type or "all" | always one type selected (default apartment), size filter available, `all` removed from colour scales (P4) |
| New-build price | not published | `new` cell next to existing where n ≥ 10, with the premium in % |
| Property check | houses → "all" | property mapped to its own cell (type × size), fallback per §4.4, labelled (P13) |

## 7. Frontend rules that follow

1. One filter bar on every market screen: area · type (apartment / house) · size · period. "Tous biens" is a
   separate "contexte" toggle, never the default.
2. When a KPI does not depend on a filter (INSEE, tax, rent control), the card says "même valeur pour tous les
   biens de la commune" instead of changing silently.
3. Comparisons (towns side by side, town vs département/France, property vs market) lock the segment: same
   type, size and period on every column; a missing cell shows "pas de donnée pour ce segment", never a
   fallback from another segment.
4. Each figure shows its basis and n on hover (ⓘ): "Appartements T3 · 2025 · 214 ventes · cellule exacte".
5. Prices (signed, past) and rents (asking, current) are never called by the same time word: "ventes 2025",
   "loyers d'annonce T3 2025".

## 8. Decisions (taken 2026-10-21)

1. **Charges provision:** a €/m²/month by type (apartment / house), shown and editable in the simulator,
   value and source recorded in KPI_SPEC.
2. **House size buckets:** ≤3 / 4 / 5 / 6+ rooms.
3. **New sources:** OLL yes. Paris/Lyon reference rents: not now.

## 9. Order of work

1. Cleaning and thresholds (4.2, 4.3) + `basis`/`n` on every value — pipeline tests, gate V3 on yields.
2. Rents at matched surface and exact-cell yields (§5) — compare old vs new yields on 20 known towns.
3. Typed DPE, INSEE stock by type, typed score (§6).
4. New source OLL.
5. Then the frontend spec builds on the published segments (§7).
