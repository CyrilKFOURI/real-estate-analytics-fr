# PRD

## Problem
Evaluating a French rental investment means juggling DVF sales, rent maps, INSEE stats and a spreadsheet simulator spread over many sites. Existing tools are paywalled (Horiz.io, MeilleursAgents) or show prices without yield/cash-flow.

## Target users
1. Primary: me — a solo investor preparing a first/next rental purchase in France.
2. Later: individual investors (beginner → intermediate) doing BRRRR / LMNP / classic rental.

## MVP features
1. Commune page: median €/m², spread, sales count, trend (DVF).
2. Rent €/m² and market gross yield per commune (ANIL).
3. Ranking/filter of communes by yield, price, trend, vacancy.
4. Deal simulator (D1–D9, D12 of KPI_SPEC) prefilled from commune KPIs.
5. Web first (Expo web); same codebase ships to mobile later.

## Out of scope
Accounts, paid plans, listing crawling/storage, price history of listings, ML valuation, Alsace-Moselle/Mayotte data, individual-sale pages indexed by search engines.

## Success criteria
- Pipeline full run < 60 min on the laptop; commune medians within 5% of explore.data.gouv.fr for Paris/Lyon/Marseille.
- Commune page loads < 1 s (single JSON ≤ 20 KB).
- I use it to screen a real deal end to end.
