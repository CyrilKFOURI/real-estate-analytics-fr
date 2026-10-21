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

## Morning (2026-10-21)
- `rea-ml serve` was never registered in the CLI (an edit that silently did not apply): fixed + CLI test.
- **Property dashboard verified end to end** in the browser on "12 rue Lenepveu, Angers", T2 45 m², 150 k€: section 49007000BS, estimate 167 979 € (125–223 k€), verdict consistent (−10.7 %), 5 comparables in the same section, rent 750 €/month, cash-flow −325 €/month.
- Explanation: for a flat, land and type effects merged into "Appartement (sans terrain)".
- Taxe foncière default now scales the one-month rule by the commune rate / national median (40.3 %): Angers ≈ 1 054 €/yr instead of 750.


## 2026-10-21 — 013 comparable segments rebuilt

Build 20261021T191231Z: every gate OK (V1–V8, incl. the new "size cells add up" and "yields paired with
their own cell"). Large-land cap raised to 5 ha (at 5 000 m² up to 22 % of houses went in Gers/Lot/Creuse;
at 5 ha the worst département, Lozère, loses 2.8 %). Commune files: 8.1 KB on average, 42.7 KB max (target
< 40 KB: Nantes; acceptable for now). OLL: 72 agglomerations, 3 313 communes, Aix-Marseille missing (zip
corrupt at the source). Browser check: Angers flats/house T4, ranking per segment, map by type, simulator
prefill from the typical deal, property page — no console error. Known: the Leaflet map fits all overseas
départements (world view); replaced by MapLibre in 014.

### Before / after on 20 reference towns (latest complete year)
Latest complete year: 2025

| Town | Cell | n before → after | €/m² before → after | Gross yield before → after |
|---|---|---|---|---|
| Paris 11e | apartment all | 2 360 → 2 355 | 9 925 → 9 929 | 3.8% → 4.0% |
| Paris 11e | apartment 1 | 684 → 689 | 9 688 → 9 704 | 4.1% → 4.3% |
| Paris 11e | apartment 2 | 935 → 936 | 9 889 → 9 888 | 4.0% → 4.1% |
| Paris 11e | apartment 4 | 150 → 148 | 10 154 → 10 173 | 3.6% → 3.5% |
| Paris 11e | apartment 5+ | 84 → 79 | 9 674 → 9 685 | 3.8% → 3.6% |
| Lyon 3e | apartment all | 1 309 → 1 279 | 4 491 → 4 490 | 4.4% → 4.2% |
| Lyon 3e | apartment 1 | 261 → 259 | 4 773 → 4 787 | 4.7% → 4.9% |
| Lyon 3e | apartment 2 | 365 → 364 | 4 571 → 4 562 | 5.0% → 4.4% |
| Lyon 3e | apartment 4 | 206 → 200 | 4 329 → 4 317 | 4.2% → 3.9% |
| Lyon 3e | apartment 5+ | 104 → 92 | 4 367 → 4 325 | 4.2% → 3.6% |
| Lyon 3e | house all | 53 → 50 | 5 848 → 5 665 | 3.7% → 3.6% |
| Lyon 3e | house 4 | 18 → 16 | 5 789 → 5 538 | — → 3.7% |
| Lyon 3e | house 6+ | — → 11 | — → 5 596 | — → 3.6% |
| Marseille 8e | apartment all | 1 212 → 1 167 | 4 268 → 4 241 | 5.1% → 4.8% |
| Marseille 8e | apartment 1 | 107 → 108 | 4 740 → 4 751 | 5.2% → 5.3% |
| Marseille 8e | apartment 2 | 268 → 266 | 4 493 → 4 503 | 5.4% → 5.0% |
| Marseille 8e | apartment 4 | 293 → 282 | 4 167 → 4 119 | 4.9% → 4.6% |
| Marseille 8e | apartment 5+ | 116 → 99 | 3 974 → 3 861 | 5.1% → 4.6% |
| Marseille 8e | house all | 103 → 93 | 7 421 → 7 051 | 3.3% → 3.5% |
| Marseille 8e | house 1-3 | — → 42 | — → 7 004 | — → 3.9% |
| Marseille 8e | house 4 | 21 → 14 | 8 573 → 7 267 | — → 3.4% |
| Marseille 8e | house 6+ | — → 18 | — → 7 714 | — → 3.0% |
| Lille | apartment all | 2 436 → 2 375 | 3 720 → 3 700 | 5.1% → 5.2% |
| Lille | apartment 1 | 617 → 621 | 4 250 → 4 259 | 5.1% → 5.6% |
| Lille | apartment 2 | 851 → 833 | 3 750 → 3 728 | 5.8% → 5.3% |
| Lille | apartment 4 | 278 → 267 | 3 135 → 3 048 | 5.6% → 5.3% |
| Lille | apartment 5+ | 90 → 79 | 3 279 → 3 103 | 5.3% → 4.8% |
| Lille | house all | 874 → 859 | 2 803 → 2 772 | 5.5% → 5.6% |
| Lille | house 1-3 | — → 228 | — → 2 740 | — → 6.3% |
| Lille | house 4 | 262 → 256 | 2 843 → 2 779 | — → 5.7% |
| Lille | house 6+ | — → 154 | — → 3 026 | — → 4.8% |
| Nantes | apartment all | 3 624 → 3 581 | 3 396 → 3 396 | 5.1% → 5.1% |
| Nantes | apartment 1 | 717 → 727 | 3 824 → 3 835 | 5.2% → 5.6% |
| Nantes | apartment 2 | 1 127 → 1 126 | 3 370 → 3 370 | 5.9% → 5.4% |
| Nantes | apartment 4 | 568 → 545 | 3 148 → 3 124 | 5.2% → 4.9% |
| Nantes | apartment 5+ | 179 → 168 | 3 222 → 3 185 | 5.1% → 4.4% |
| Nantes | house all | 936 → 936 | 4 128 → 4 099 | 4.2% → 4.1% |
| Nantes | house 1-3 | — → 229 | — → 4 386 | — → 4.4% |
| Nantes | house 4 | 277 → 271 | 3 878 → 3 864 | — → 4.5% |
| Nantes | house 6+ | — → 212 | — → 4 292 | — → 3.8% |
| Angers | apartment all | 1 638 → 1 590 | 3 147 → 3 138 | 5.6% → 5.5% |
| Angers | apartment 1 | 347 → 356 | 3 941 → 3 986 | 5.0% → 5.7% |
| Angers | apartment 2 | 495 → 485 | 3 255 → 3 244 | 6.1% → 5.6% |
| Angers | apartment 4 | 290 → 269 | 2 500 → 2 464 | 6.2% → 6.0% |
| Angers | apartment 5+ | 82 → 78 | 2 411 → 2 376 | 6.5% → 5.8% |
| Angers | house all | 515 → 479 | 3 289 → 3 165 | 4.8% → 4.9% |
| Angers | house 1-3 | — → 76 | — → 3 631 | — → 4.9% |
| Angers | house 4 | 173 → 166 | 3 343 → 3 244 | — → 5.0% |
| Angers | house 6+ | — → 114 | — → 2 994 | — → 5.0% |
| Brest | apartment all | 1 860 → 1 841 | 2 167 → 2 170 | 6.7% → 6.1% |
| Brest | apartment 1 | 271 → 274 | 2 764 → 2 770 | 6.6% → 7.8% |
| Brest | apartment 2 | 423 → 422 | 2 344 → 2 349 | 7.8% → 6.6% |
| Brest | apartment 4 | 488 → 477 | 1 918 → 1 918 | 6.7% → 6.2% |
| Brest | apartment 5+ | 162 → 156 | 1 801 → 1 794 | 7.1% → 5.9% |
| Brest | house all | 588 → 600 | 2 420 → 2 420 | 5.4% → 5.3% |
| Brest | house 1-3 | — → 80 | — → 2 682 | — → 5.9% |
| Brest | house 4 | 141 → 144 | 2 605 → 2 600 | — → 5.4% |
| Brest | house 6+ | — → 167 | — → 2 464 | — → 4.8% |
| Limoges | apartment all | 1 285 → 1 211 | 1 512 → 1 502 | 8.2% → 8.1% |
| Limoges | apartment 1 | 270 → 261 | 1 699 → 1 698 | 9.5% → 9.7% |
| Limoges | apartment 2 | 345 → 339 | 1 610 → 1 611 | 10.0% → 8.1% |
| Limoges | apartment 4 | 240 → 217 | 1 254 → 1 217 | 9.5% → 8.6% |
| Limoges | apartment 5+ | 62 → 51 | 1 377 → 1 308 | 8.7% → 7.4% |
| Limoges | house all | 550 → 542 | 1 857 → 1 836 | 6.5% → 6.7% |
| Limoges | house 1-3 | — → 159 | — → 1 919 | — → 7.3% |
| Limoges | house 4 | 212 → 207 | 1 903 → 1 870 | — → 6.6% |
| Limoges | house 6+ | — → 63 | — → 1 681 | — → 6.6% |
| Saint-Étienne | apartment all | 2 211 → 2 109 | 1 200 → 1 195 | 9.9% → 9.3% |
| Saint-Étienne | apartment 1 | 411 → 408 | 1 417 → 1 418 | 9.7% → 10.1% |
| Saint-Étienne | apartment 2 | 512 → 505 | 1 199 → 1 207 | 11.4% → 10.0% |
| Saint-Étienne | apartment 4 | 472 → 434 | 1 146 → 1 143 | 9.5% → 8.9% |
| Saint-Étienne | apartment 5+ | 165 → 147 | 1 193 → 1 150 | 9.1% → 7.9% |
| Saint-Étienne | house all | 221 → 218 | 2 250 → 2 215 | 4.8% → 4.8% |
| Saint-Étienne | house 1-3 | — → 43 | — → 2 294 | — → 5.0% |
| Saint-Étienne | house 4 | 76 → 76 | 2 390 → 2 390 | — → 4.5% |
| Saint-Étienne | house 6+ | — → 41 | — → 1 866 | — → 5.5% |
| Perpignan | apartment all | 1 499 → 1 416 | 1 507 → 1 510 | 9.7% → 9.0% |
| Perpignan | apartment 1 | 150 → 142 | 1 618 → 1 645 | 10.1% → 11.9% |
| Perpignan | apartment 2 | 393 → 373 | 1 708 → 1 708 | 9.6% → 9.3% |
| Perpignan | apartment 4 | 336 → 319 | 1 335 → 1 325 | 9.2% → 9.2% |
| Perpignan | apartment 5+ | 105 → 93 | 1 333 → 1 292 | 9.2% → 8.4% |
| Perpignan | house all | 534 → 542 | 2 224 → 2 228 | 6.4% → 6.3% |
| Perpignan | house 1-3 | — → 122 | — → 2 402 | — → 6.7% |
| Perpignan | house 4 | 200 → 203 | 2 325 → 2 333 | — → 6.3% |
| Perpignan | house 6+ | — → 86 | — → 1 931 | — → 6.8% |
| Pau | apartment all | 1 401 → 1 340 | 2 193 → 2 189 | 6.6% → 6.4% |
| Pau | apartment 1 | 302 → 305 | 2 493 → 2 500 | 6.7% → 7.3% |
| Pau | apartment 2 | 387 → 376 | 2 267 → 2 280 | 7.3% → 6.7% |
| Pau | apartment 4 | 269 → 251 | 1 984 → 1 923 | 6.7% → 6.4% |
| Pau | apartment 5+ | 78 → 66 | 1 942 → 1 899 | 6.8% → 6.0% |
| Pau | house all | 246 → 251 | 2 533 → 2 532 | 5.5% → 5.3% |
| Pau | house 1-3 | — → 32 | — → 2 679 | — → 5.7% |
| Pau | house 4 | 73 → 74 | 2 639 → 2 628 | — → 5.4% |
| Pau | house 6+ | — → 64 | — → 2 246 | — → 5.8% |
| Troyes | apartment all | 839 → 792 | 1 568 → 1 566 | 8.5% → 8.3% |
| Troyes | apartment 1 | 142 → 147 | 2 146 → 2 183 | 7.7% → 8.4% |
| Troyes | apartment 2 | 255 → 240 | 1 629 → 1 626 | 10.1% → 8.7% |
| Troyes | apartment 4 | 140 → 127 | 1 433 → 1 431 | 8.2% → 7.7% |
| Troyes | apartment 5+ | 36 → 28 | 1 552 → 1 520 | 7.6% → 6.0% |
| Troyes | house all | 210 → 208 | 1 896 → 1 875 | 6.6% → 6.8% |
| Troyes | house 1-3 | — → 77 | — → 2 011 | — → 7.6% |
| Troyes | house 4 | 71 → 71 | 1 840 → 1 831 | — → 6.9% |
| Troyes | house 6+ | — → 28 | — → 1 734 | — → 6.6% |
| Guéret | apartment all | 51 → 44 | 1 048 → 1 060 | 10.8% → 9.6% |
| Guéret | apartment 2 | 11 → 10 | 1 224 → 1 185 | 10.9% → 9.9% |
| Guéret | apartment 4 | 12 → 10 | 989 → 884 | 9.8% → 10.3% |
| Guéret | house all | 74 → 75 | 1 181 → 1 184 | 9.7% → 9.6% |
| Guéret | house 1-3 | — → 13 | — → 1 339 | — → 10.3% |
| Guéret | house 4 | 23 → 23 | 1 233 → 1 233 | — → 9.6% |
| Guéret | house 6+ | — → 14 | — → 856 | — → 12.3% |
| Vierzon | apartment all | 78 → 75 | 895 → 938 | 12.1% → 12.0% |
| Vierzon | apartment 1 | 13 → 13 | 943 → 943 | 13.7% → 16.0% |
| Vierzon | apartment 2 | 38 → 36 | 966 → 975 | 13.4% → 11.8% |
| Vierzon | house all | 304 → 308 | 1 030 → 1 019 | 9.3% → 10.1% |
| Vierzon | house 1-3 | — → 110 | — → 1 035 | — → 11.1% |
| Vierzon | house 4 | 120 → 120 | 1 037 → 1 037 | — → 9.9% |
| Vierzon | house 6+ | — → 26 | — → 915 | — → 9.6% |
| Arcachon | apartment all | 315 → 217 | 7 429 → 6 818 | 2.7% → 3.2% |
| Arcachon | apartment 1 | 104 → 86 | 7 380 → 7 205 | 3.2% → 3.6% |
| Arcachon | apartment 2 | 92 → 60 | 7 410 → 6 804 | 3.1% → 3.2% |
| Arcachon | apartment 4 | 31 → 17 | 7 012 → 6 235 | 2.7% → 2.8% |
| Arcachon | house all | 136 → 126 | 8 455 → 8 293 | 2.3% → 2.3% |
| Arcachon | house 1-3 | — → 41 | — → 7 833 | — → 2.9% |
| Arcachon | house 4 | 33 → 29 | 8 580 → 8 370 | — → 2.3% |
| Arcachon | house 6+ | — → 34 | — → 8 373 | — → 2.2% |
| Annecy | apartment all | 1 618 → 1 545 | 5 117 → 5 090 | 4.8% → 4.6% |
| Annecy | apartment 1 | 236 → 236 | 5 986 → 5 986 | 4.2% → 4.7% |
| Annecy | apartment 2 | 415 → 410 | 5 298 → 5 299 | 4.7% → 4.8% |
| Annecy | apartment 4 | 365 → 344 | 4 565 → 4 439 | 4.7% → 5.0% |
| Annecy | apartment 5+ | 97 → 85 | 4 526 → 4 366 | 4.8% → 4.8% |
| Annecy | house all | 190 → 190 | 6 021 → 6 075 | 3.7% → 3.6% |
| Annecy | house 1-3 | — → 15 | — → 5 289 | — → 4.4% |
| Annecy | house 4 | 54 → 54 | 6 097 → 6 097 | — → 3.7% |
| Annecy | house 6+ | — → 49 | — → 6 143 | — → 3.5% |
| Rennes | apartment all | 2 684 → 2 629 | 3 706 → 3 710 | 4.8% → 4.6% |
| Rennes | apartment 1 | 520 → 530 | 4 428 → 4 444 | 4.7% → 5.1% |
| Rennes | apartment 2 | 675 → 671 | 3 900 → 3 900 | 5.3% → 4.9% |
| Rennes | apartment 4 | 573 → 552 | 3 123 → 3 122 | 5.3% → 5.0% |
| Rennes | apartment 5+ | 198 → 182 | 3 113 → 3 049 | 5.3% → 4.7% |
| Rennes | house all | 459 → 451 | 4 515 → 4 500 | 4.1% → 3.9% |
| Rennes | house 1-3 | — → 79 | — → 5 122 | — → 4.1% |
| Rennes | house 4 | 122 → 115 | 4 645 → 4 579 | — → 4.0% |
| Rennes | house 6+ | — → 134 | — → 3 992 | — → 4.3% |
| Toulouse | apartment all | 6 277 → 6 070 | 3 270 → 3 242 | 5.1% → 5.1% |
| Toulouse | apartment 1 | 1 101 → 1 106 | 4 093 → 4 096 | 4.8% → 5.3% |
| Toulouse | apartment 2 | 1 833 → 1 803 | 3 278 → 3 256 | 6.0% → 5.5% |
| Toulouse | apartment 4 | 1 001 → 939 | 2 915 → 2 865 | 5.3% → 5.0% |
| Toulouse | apartment 5+ | 255 → 222 | 3 250 → 3 183 | 4.7% → 4.1% |
| Toulouse | house all | 1 114 → 1 075 | 3 720 → 3 651 | 4.1% → 4.2% |
| Toulouse | house 1-3 | — → 234 | — → 4 098 | — → 4.2% |
| Toulouse | house 4 | 417 → 398 | 3 690 → 3 610 | — → 4.3% |
| Toulouse | house 6+ | — → 171 | — → 3 586 | — → 4.0% |
| Fort-de-France | apartment all | 282 → 264 | 2 649 → 2 628 | 7.2% → 6.9% |
| Fort-de-France | apartment 1 | 32 → 33 | 2 557 → 2 568 | 8.6% → 9.4% |
| Fort-de-France | apartment 2 | 70 → 67 | 3 127 → 3 093 | 7.0% → 6.5% |
| Fort-de-France | apartment 4 | 62 → 56 | 2 304 → 2 270 | 7.7% → 7.2% |
| Fort-de-France | apartment 5+ | 11 → — | 1 750 → — | 10.1% → — |
| Fort-de-France | house all | 156 → 157 | 1 734 → 1 742 | 10.5% → 11.2% |
| Fort-de-France | house 1-3 | — → 50 | — → 1 506 | — → 14.7% |
| Fort-de-France | house 4 | 66 → 65 | 1 402 → 1 429 | — → 13.3% |
| Fort-de-France | house 6+ | — → 11 | — → 2 215 | — → 7.8% |

T1 flat yields up: 18/18; T4/T5+ flat yields down: 28/33
