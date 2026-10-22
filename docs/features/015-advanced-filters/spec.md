# 015 Advanced screen filters (Explorer)

Completes spec 014 §4 "screen filters on top". Pure selection over the published explorer rows: no new
KPI, no pipeline change.

## Filters (Explorer, kept in the URL so a link reproduces the list)
| Filter | URL | Rule |
|---|---|---|
| Budget | `budget` | typical price (median price of the segment) ≤ budget |
| €/m² range | `pmin`, `pmax` | median €/m² within |
| Gross yield range | `ymin`, `ymax` | typed in %, stored as fraction |
| Positive cash-flow | `cf=pos` | typical cash-flow ≥ 0 |
| Population range | `popmin`, `popmax` | INSEE population |
| Vacancy max | `vacmax` | % |
| F/G max | `fgmax` | % of F/G dwellings |
| Rent control | `rc=in` / `rc=out` | only / without rent-controlled places |
| Risky places out | `risky=out` | drops high vacancy or falling population flags |
| Région | `region` | départements of one région (départements list) |
A filter with no value (or an unparsable one) is off. A row missing the filtered value is dropped when that
filter is on. The bar shows how many filters are on and a "Réinitialiser" button.

## Not in scope (ruling kept from 014)
Explorer and Carte show the latest complete year, existing homes. Period and ancien/neuf live in Évolution
and the Marché page (publishing every period would multiply the explorer files by ~6).

## Acceptance
- GIVEN Explorer on départements WHEN budget 150000 and cash-flow positive THEN only départements whose typical
  property costs ≤ 150 000 € and has a cash-flow ≥ 0 remain, and the URL carries `budget=150000&cf=pos`.
- GIVEN `ymin=6` THEN rows under 6 % gross yield disappear (not under 6.0 as a fraction).
