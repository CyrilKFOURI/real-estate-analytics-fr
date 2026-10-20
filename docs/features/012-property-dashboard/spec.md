# 012 — Property analysis dashboard

Status: **design, not built**. Composes 004 (simulator), 011 (price check) and the market
data already published. Read docs/KPI_SPEC.md first.

## 1. Idea
One property = one page that answers, in this order, the questions an investor asks:
1. **Is the price right?** (011)
2. **Will it rent, for how much?** (rent estimate, demand)
3. **Does the money work?** (cash-flow, yields, loan, debt ratio: 004)
4. **What can go wrong?** (vacancy, population, DPE ban, rent cap, low data)
5. **Where is it?** (area context and trend)

A verdict line on top summarises everything; every number below can be expanded to see how it was computed. Nothing is shown without its source and confidence.

## 2. How a property enters the app
- **Manual form:** address or commune, type, surface, rooms, land, price, DPE (optional).
- **Browser extension (008):** reads the listing page the user is on and opens the dashboard prefilled.
- Later: paste a listing URL. Only the page the user opened is read, never crawled (site terms, case law in research/state_of_the_art.md).

## 3. Layout (top to bottom, one column on mobile, two on wide screens)
| Block | Content | Source |
|---|---|---|
| **Verdict** | 3 badges: Price (below / consistent / above), Cash-flow (positive / ~0 / negative), Risk (low / medium / high), plus one sentence in plain French | 011, 004, socio flags |
| **Price** | Asked vs estimate with P10–P90 bar, €/m² vs area median and P25–P75, SHAP waterfall (max 6 lines), 5 comparables (date, surface, €/m², distance) | 011, kpi_price |
| **Rent** | Rent estimate €/m² and €/month with low–high range, rent source (commune / neighbours), renter share, rent-cap zone check | kpi_yield, kpi_socio, M16 |
| **Money** | Simulator prefilled (price, notary, rent, taxe foncière, rate): cash-flow per month, gross / net yield, cash-on-cash, DSCR, HCSF debt ratio; editable inputs; later tax regimes and 10–20-year IRR (D13–D14) | 004 |
| **Risks** | Vacancy, population and jobs trends, DPE ban calendar (G 2025, F 2028, E 2034) if DPE known, low-data warnings, high-yield-means-risk note | kpi_socio, rules config |
| **Area** | Half-year price trend, yield vs département and France, links to the commune page | kpi_price, kpi_yield |

## 4. Design principles
- **Answer first, detail on demand:** the verdict fits on one phone screen; blocks are collapsible.
- **Every number explains itself:** tap → formula, inputs, source, date, sample size.
- **Uncertainty is visible:** intervals, not single numbers; "low confidence" whenever n < 30 or the rent is borrowed from neighbours.
- **Past vs present:** prices are past signed sales, rents are current listings; say it on the page.
- **No advice wording:** the app describes ("cash-flow négatif de 120 €/mois"), it does not tell the user to buy.

## 5. Data and performance
- Market blocks reuse the published per-commune JSON (no new download).
- Price check calls the 011 API once per property; the simulator runs on device (pure functions).
- A saved analysis is stored on the device first (no account needed); sharing/accounts later.

## 6. Acceptance (to refine when building)
- GIVEN a property entered manually WHEN the dashboard opens THEN the verdict, price, rent, money and risk blocks are filled in < 1.5 s on a laptop.
- GIVEN a changed input in the money block THEN all money figures update instantly, without a network call.
- GIVEN a commune with too few sales THEN the price verdict says "pas assez de données" instead of a guess.
