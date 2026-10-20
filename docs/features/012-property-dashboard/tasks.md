# 012 tasks
- [x] Local API (ml/src/rea_ml/api.py): address → BAN geocoding → nearest section point of the commune (same location rule as training) → estimate + interval + verdict + SHAP effects + 5 comparables (same section first, ±25 % surface, 24 months)
- [x] core-kpi/assessment.ts: cash-flow verdict, risk level (vacancy, population, data density, location precision, DPE ban calendar), summary sentence; 6 tests
- [x] /property screen: form (address, type, new build, price, surface, rooms, land, parking, DPE) → verdict badges + 5 blocks (price, rent, money, risks, area), each with its source
- [x] Simulator accepts price/surface/rent from the dashboard
- [x] Home page link "Analysez-le"
- [ ] End-to-end check in the browser once the first model is trained
- Limits: comparables are individual DVF sales → local API only, `noindex`; taxe foncière ≈ 1 month of rent until REI is ingested; HCSF not shown on the dashboard (needs the user's income: simulator).
