# Night log (2026-10-20 → 21)

Rule followed: code → tests → real-data checks (pipeline gates) → browser check → commit. Nothing moved on before the step passed.

## Done and verified

| # | Step | Verification | Commit |
|---|---|---|---|
| 1 | **Market KPIs** — M5 price trend since 2022, M7 median surface, price bands, M13 rent-to-income, M14 DPE F/G (ADEME API, no 30 GB download), M15 property-tax rate (REI), M16 rent control (71 communes), M17 market score /100 with strengths/weaknesses | 39 pipeline tests; full build with **7 gates all green**: Paris tax 21.1 %, Angers 56.7 %; F/G France 9.9 %, Paris 18.2 %; score median 50.5, range 2–95, 100 % coverage | `0f2b431` |
| 2 | **Deal KPIs** — D14 IRR over 10/15/20 years with resale and capital-gains tax (holding allowances, LMNP depreciation added back since 2025), D15 leverage, D16 BRRRR, D17 break-even occupancy | 7 new app tests (IRR makes NPV 0, CGT schedule, LMNP add-back…); Angers T2: IRR 7.2 % in LMNP réel over 15 years | `0f2b431` |
| 3 | **Maps** — pipeline GeoJSON per département with KPIs (Etalab contours), Leaflet map, 10 metrics, 5 quintile classes, France → département → communes, Paris/Lyon/Marseille by arrondissement | Map test; browser: 109 départements coloured, legend, drill-down Landes (327 communes), Paris 20 arrondissements | `e277864`, `33782a7` |
| 4 | **New KPIs in the app** — commune page (score card, DPE label bar, tax rate, rent control, trend since 2022, surface, price bands), ranking (score sort, rent-control filter) | Browser on Angers: every block shows the right values (score 52, F/G 5.8 %, tax 56.7 %, bands 61 % in 100–200 k€) | `6592033` |

## Problems found and fixed during the night
- **Gate V3 stopped a publication**: one commune cell at 35 % gross yield (tiny half-year/room cell). Fix: yields > 30 % are not published; a new check makes sure that stays rare (0.011 % of cells).
- ADEME API: max 1 000 values per aggregation (fits: Pas-de-Calais has ~890 communes) and rate limit (HTTP 429): polite pacing + retries honouring Retry-After.
- DuckDB DECIMAL values broke JSON writing (twice): converted at write time.
- Publication tests were reading the real contours in data/raw: isolated.
- Metro cannot bundle Leaflet's CSS (it references images): vendored copy without image rules.
- **Dev server stalled** (blank page, bundle request pending) while ML training + pipeline build saturated the CPU. The production web export (`npx expo export`) works; all browser checks above were done on it.

## Still running at the end of the night
- **Price model training** (`data/runs/ml_train.log`): feature selection kept 16 of 17 groups (dropped "location precision": 99.9 % of sales share the same value). The evaluated model used 2 998 of 3 000 allowed rounds, so it was still improving: raise `max_rounds` next time. Then test metrics and the final model on all 4.3 M sales.
- Once it finishes: start `uv run rea-ml serve` and check the property dashboard end to end on a real address.

## Not done (needs a decision or out of scope tonight)
- "Zones tendues" (1 434 communes): no open-data list, only the decree.
- Mobile build (009): needs hosting for the data/model and a native map library.
- Design pass: postponed on purpose (you asked to focus on features).

## Price model finished (02:02)
- Package: `data/models/rea-price-check-fr/20261021/` (not published).
- Out-of-time test (801 k sales, 2025-H2 → 2026-H1): median abs. error **16.0 %**, 59 % within ±20 %, bias −1.5 %, P10–P90 coverage **79.8 %** (target 80 %) — see `metrics.json` for baselines and segments.
- Next: `cd ml && uv run rea-ml serve`, then test "Analyser un bien" on a real address; raise `max_rounds` (best iteration hit the 3 000 cap).
