# 004 — Deal simulator

## User stories
- As an investor, from a commune page I open a simulator prefilled with that commune's figures (price/m², rent/m²) and adjust price, surface, rent, loan and charges.
- I instantly see cash-flow, yields, loan payment, debt ratio and how the asked price compares with the market.

## Scope (KPI_SPEC §2)
D1 total cost · D2 gross yield · D3 net yield · D5 loan payment · D6 monthly cash-flow (before tax) · D7 quick 70 % test · D8 cash-on-cash · D9 HCSF debt ratio · D10 DSCR · D11 cap rate · D12 price vs market.
Out of scope: tax regimes and after-tax figures (D4, D13), IRR (D14): step 010.

## Architecture
- `apps/app/src/core-kpi/`: pure TypeScript functions, no React, no I/O; reusable by the extension and the dashboard (012). French rules (notary %, HCSF 35 %, 70 % rent counting, 25-year max) in one file `rules.ts`, dated, checked once a year.
- Tests with Node's built-in runner (`node --test`), no new dependency.
- Route `/simulator?level=&code=&type=&rooms=`; the commune page links to it with the current segment.

## Formulas (monthly unless stated)
- notary = price × rate (7.5 % old, 2.5 % new) · total cost = price + notary + agency + works + furniture
- loan = total cost − down payment · payment = L·r / (1 − (1+r)^−n) + L × insurance rate / 12
- effective rent / year = rent × (12 − vacancy months)
- operating costs / year = taxe foncière + non-recoverable condo charges + PNO insurance + management % × effective rent + maintenance % × effective rent
- NOI = effective rent − operating costs (year)
- gross yield = 12 × rent / total cost · net yield = NOI / total cost · cap rate = NOI / price
- cash-flow = (NOI − 12 × payment) / 12 · quick test = 0.70 × rent − payment
- cash-on-cash = 12 × cash-flow / down payment (null when nothing is put in)
- DSCR = NOI / (12 × payment) · HCSF = (existing debts + payment) / (income + 0.70 × rent), limit 35 %, term ≤ 25 years
- price vs market = (price / surface) / median €/m² − 1, and position vs P25–P75

## Acceptance criteria
- GIVEN price 200 000 €, 20 % down, 3.5 % over 20 years THEN the payment matches the standard annuity formula (unit test with a reference value).
- GIVEN zero down payment THEN cash-on-cash is shown as "—" (infinite), not an error.
- GIVEN Angers, apartment T2 WHEN opening the simulator from the commune page THEN price/m² and rent/m² are prefilled from the 2025 KPIs and editable.
- GIVEN any input change THEN every result updates without a network call.
- GIVEN HCSF > 35 % or term > 25 years THEN a warning explains the bank rule.
