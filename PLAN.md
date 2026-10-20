<!-- docs/features/ holds one folder per feature (e.g. 001-auth/) with spec.md (user stories + GIVEN/WHEN/THEN) and tasks.md -->
# PLAN

## Roadmap (vertical slices: data → API → UI, testable end to end)
- [x] 000 Docs skeleton + research (books, state of the art, data sources) + KPI_SPEC + PIPELINE_RUN_SPEC
- [x] 001 DVF pipeline: S0 refs → S1 ingest → S2 clean → S3 M1–M6 per commune → V2 check vs explore.data.gouv.fr (Python only, no UI)
- [ ] 002 Commune page: publish JSON → Expo web page "search a commune → price KPIs + trend chart"
- [ ] 003 Rents + yield: ANIL ingest → M8, M9 → shown on commune page + ranking list
- [ ] 004 Deal simulator: core-kpi D1–D9, D12 + screen, prefilled from commune KPIs
- [ ] 005 Map: PMTiles choropleth of M1 / M9
- [ ] 006 INSEE + DPE + REI: M11–M15, market score M17
- [ ] 007 Scheduled runs (Task Scheduler, upstream change check) + run reports
- [ ] 008 Browser extension (WXT) annotating listing pages
- [ ] 009 Expo mobile build (iOS/Android)
- [ ] 010 Tax regimes + IRR (D13, D14), BRRRR (D16)
