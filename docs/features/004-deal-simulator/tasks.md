# 004 tasks
- [x] core-kpi: rules.ts (dated FR rules + defaults) and deal.ts (D1–D3, D5–D12), 9 unit tests (`npm test`)
- [x] NumberField component (French number input)
- [x] /simulator screen, results first, prefilled from the commune segment (median price, surface = median price / median €/m², ANIL rent)
- [x] "Simuler un achat ici" link on the commune page
- [x] Verified in browser: Angers T2 prefill, live update on price change
- Known limits: taxe foncière prefilled with ~1 month of rent until REI rates are ingested (006); ANIL rent includes charges, the user must subtract recoverable charges; no tax (step 010).
- Test files are excluded from `tsc` (no @types/node without approval); Node strips types when running them.
