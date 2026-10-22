<!-- docs/features/ holds one folder per feature (e.g. 001-auth/) with spec.md (user stories + GIVEN/WHEN/THEN) and tasks.md -->
# PLAN

## Roadmap (vertical slices: data → API → UI, testable end to end)
- [x] 000 Docs skeleton + research (books, state of the art, data sources) + KPI_SPEC + PIPELINE_RUN_SPEC
- [x] 001 DVF pipeline: S0 refs → S1 ingest → S2 clean → S3 M1–M6 per commune → V2 check vs explore.data.gouv.fr (Python only, no UI)
- [x] 002 Commune page: publish JSON → Expo web page "search a commune → price KPIs + trend chart"
- [x] 003 Rents + yield: ANIL ingest → M8, M9 → shown on commune page + ranking list (/ranking, filters: type, risk, département, budget, sort)
- [x] 004 Deal simulator: core-kpi D1–D9, D12 + screen, prefilled from commune KPIs
- [x] 005 Map: Leaflet choropleth, France by département → communes, 10 metrics, quintile classes (browser check pending, see NIGHT_LOG)
- [x] 006 INSEE + DPE + REI + rent control + market score: M11–M17 all done
- [x] 007 Scheduled runs: `rea auto` (change detection by ETag/SHA-256, rebuild only if needed) + PowerShell script; Task Scheduler registration left to the user (docs/PIPELINE_RUN_SPEC.md §4)
- [x] 008 Browser extension: Manifest V3, no dependency, reads the open listing on click and opens the prefilled dashboard (apps/extension)
- [x] 015 Advanced screen filters on Explorer (budget, ranges, cash-flow sign, population, vacancy, F/G, rent control, risky out, région; design: docs/features/015-advanced-filters/spec.md)
- [x] 009 Mobile app ready to build: same DOM screens on iOS/Android, data from the published site, Cyfouri branding, eas.json (design: docs/features/009-mobile/spec.md; the signed build needs the user's Expo account)
- [x] 010 Tax regimes (D13), IRR with resale (D14), leverage (D15), BRRRR (D16), break-even (D17)
- [x] 011 Price check ML: keep land/lots/VEFA/coordinates in clean sales, hedonic baseline vs LightGBM quantiles, SHAP explanations, comparables, /estimate API (design: docs/features/011-price-check-ml/spec.md)
- [x] 012 Property analysis dashboard: verdict + price + rent + money + risks + area for one property (design: docs/features/012-property-dashboard/spec.md; needs 004 and 011)
- [x] 013 Comparable segments: like-for-like cells (type × size × new/existing × period), surface-adjusted rents, exact-cell yields, OLL, typed DPE/INSEE/score, frontend precomputes (design: docs/features/013-comparable-segments/spec.md, study: docs/research/segmentation_study.md)
- [x] 014 Web dashboard: design system, shell, town page, MapLibre map, property page, ranking + compare, simulator, method page (design: docs/features/014-web-dashboard/spec.md; needs 013)

Priority after 004: 011 prerequisites (coordinates) → 011 → 012; 005–010 fit around them.
