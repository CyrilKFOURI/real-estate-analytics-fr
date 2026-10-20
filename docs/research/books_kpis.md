# Real-Estate KPIs Extracted from the Reference Books

Sources (summaries in `3_Learn/06_Entrepreneurship_and_Real_Estate/02_Real_Estate_Investment_and_Leverage`):

| Code | Book |
|---|---|
| **JD** | Julien Delagrandanne, *L'investissement locatif intelligent* (2nd ed., 2021). French market and tax rules |
| **DG** | David M. Greene, *Buy, Rehab, Rent, Refinance, Repeat (BRRRR)* (BiggerPockets, 2019) |
| **BF** | Brueggeman & Fisher, *Real Estate Finance and Investments* (McGraw-Hill, 17th ed.) |
| **FR-REG** | Not in the books: French regulation or market convention added because the app needs it. Check against current law before shipping. |

Scope legend: **Market** = can be computed from public data (DVF, INSEE, Clameur/observatoires des loyers, Banque de France rates, DPE open data). **Deal** = needs user inputs (price, rent, loan, taxes, works). **Both** = a market version exists, used as a default or benchmark for the deal version.

Chapter refs are the summary sections (JD A.x/B.x/C.x/D.x, DG step, BF chapter number in the summary). The PDFs were not opened because the summaries had the formulas needed.

---

## 1. Acquisition cost and price

| KPI | Formula | Inputs | Typical thresholds / rules | Source | Scope |
|---|---|---|---|---|---|
| Total acquisition cost (coût total d'acquisition) | `Price_net_vendeur + Frais_notaire + Frais_agence + Travaux (+ Mobilier)` | price, notary fees, agency fees, works, furniture | Denominator of every French yield | JD A.2 | Deal |
| Frais de notaire | ≈ `7–8% × price` (old property, DMTO ~5.8%, up to ~6.3% in departments that raised it in 2025) ; ≈ `2–3%` (new / VEFA) | price, old/new, department | Rule of thumb 7.5% old, 2.5% new | FR-REG | Both (department rate is public) |
| Price per m² | `Price / Surface_Carrez` | price, surface | Benchmarks: metropoles 5,000–10,000+ €/m² ; mid-size cities 2,000–3,500 ; small towns < 1,200 | JD A.3 | Market (DVF) |
| Discount vs market (décote) | `(Market_price_m² − Offer_price_m²) / Market_price_m²` | offer price, DVF median €/m² | "Never buy at market price" (Commandment 1). F/G DPE units: 20–35% discount achievable | JD D.3, F (DPE) | Both |
| Negotiation target from works | `Offer = Asking_price − Quoted_mandatory_works` | asking price, contractor quotes | Negotiate on quotes, not impressions | JD D.3 | Deal |
| Days on market | `Today − listing_date` | listing date | Listings online > 3–6 months = tired seller, aggressive offers | JD D.1 | Market (listing data) |
| MAO, 70% rule | `MAO = ARV × 0.70 − Rehab_cost` | ARV, rehab budget | Buying at MAO lets a 70–75% LTV refi return all cash | DG Buy | Deal |
| Safety margin at purchase | `(ARV − (Price + Rehab + Costs)) / ARV` | ARV, all-in cost | ≥ 25–30% or walk away | DG §8 | Deal |
| Building (IDR) discount | `1 − Price_building / Σ(lot values if sold separately)` | building price, per-lot comps | IDR typically 15–30% cheaper than sum of lots | JD E/F (IDR) | Both |

## 2. Yields (rendements)

| KPI | Formula | Inputs | Typical thresholds | Source | Scope |
|---|---|---|---|---|---|
| Gross yield (rendement brut) | `Annual_rent_HC / Total_acquisition_cost × 100` | rent hors charges, total cost | Metropoles 3–4.5% ; mid-size 6–8.5% (sweet spot) ; small towns 10–15% (risky). Studio meublé 6–8%, T2/T3 nu 4.5–6%, coloc 8–11%, IDR 8–12%, LCD 12–20% | JD A.2, A.3, C.1 | Both (market version = median rent/m² × 12 / median price/m²) |
| Net yield (rendement net de charges) | `(Rent − Non-recoverable copro − Taxe foncière − PNO − Management/GLI − Maintenance − Vacancy provision) / Total_cost × 100` | rent + each charge line | Charges ≈ 30% of rent as a default (Commandment 2) | JD A.2 | Deal |
| Net-net yield (rendement net-net / réel) | `(Net operating income − Income tax − Social charges 17.2%) / Total_cost × 100` | net income, tax regime, TMI | Core decision metric for JD | JD A.2 | Deal |
| Cap rate (taux de capitalisation) | `R0 = NOI_1 / Value` | NOI year 1, price/value | Equivalent of net yield on price; take from comparable sales | BF 4 | Both |
| Cap rate via Gordon | `R0 = r − g` | required return r, rent growth g | Sanity check for implied growth | BF 4 | Both |
| Total yield split | `Total = Market yield + Entrepreneurial yield` | market rent vs post-works rent | Entrepreneurial levers: lot division (+38% rent example), T1→T2 (+15–20%), furnished premium, coloc | JD B.2 | Deal |
| Rent uplift from works | `(Rent_after − Rent_before) / Rent_before` | before/after rent | 15–40% depending on lever | JD B.2, DG Rehab | Deal |

## 3. Operating income (pro-forma)

| KPI | Formula | Inputs | Typical thresholds | Source | Scope |
|---|---|---|---|---|---|
| Potential Gross Income (PGI) | `Σ market rents × 12` at 100% occupancy | rents per unit | | BF 4 | Both |
| Vacancy & collection loss | `PGI × vacancy_rate` | vacancy rate | JD default: 1 month/yr (≈ 8.3%) provision for vacancy+maintenance ; furnished studio higher turnover (1–2 yrs), T2/T3 nu 3–5 yrs | BF 4, JD A.2, C.1 | Both (INSEE vacancy rate by commune) |
| Effective Gross Income (EGI) | `PGI − Vacancy + Other income` | | | BF 4 | Deal |
| Operating expenses (OpEx) | taxe foncière (excl. TEOM) + copro non-récupérable + PNO + management/GLI + repairs + non-billed utilities | each line | Exclude debt service and income tax | BF 4, JD A.2 | Deal |
| Replacement reserve (CapEx) | annual provision | | | BF 4 | Deal |
| NOI (revenu net d'exploitation) | `EGI − OpEx − CapEx reserve` | | Independent of financing | BF 4 | Deal |
| Expense ratio quick rule | `Net rent ≈ 0.70 × Gross rent` | gross rent | Use 30% charges in any quick screen | JD B.1, §7 | Deal |
| Taxe foncière burden | `TF / Annual rent` | TF amount (or commune rate × base) | JD example ~10% of rent (60 €/600 €) | JD B.1 | Both (commune TF rates are public) |
| Break-even occupancy (BER) | `(OpEx + Debt service) / PGI` | | Lower is safer; must stay well below expected occupancy | BF 5 | Deal |

## 4. Cash-flow and equity returns

| KPI | Formula | Inputs | Typical thresholds | Source | Scope |
|---|---|---|---|---|---|
| Monthly cash-flow | `Rent − (Loan payment incl. insurance + (Annual charges + TF + Taxes)/12)` | rent, payment, charges, tax | Target: positive net-net from day 1. "Rent = payment" is a trap (JD example −165 €/month) | JD B.1 | Deal |
| Quick cash-flow screen | `0.70 × Gross rent > Monthly payment (20-yr loan)` → likely positive | rent, payment | | JD B.1 | Deal |
| Cash-on-cash / ROI on equity | `Annual pre-tax (or after-tax) cash-flow / Equity left in deal` | cash-flow, equity | BRRRR goal: equity left = 0 → ROI = ∞ | DG §1 | Deal |
| Equity left in deal | `Price + Rehab + Costs − Refinance loan` | | Target ≤ 0 | DG §2, §6 | Deal |
| Levered return (effet de levier) | `re = rp + (rp − rd) × D/E` | property IRR rp, cost of debt rd, D/E | Positive leverage iff rp > rd ; negative if rp < rd. Leverage raises volatility and default risk | BF 5 | Deal (rd: market rate is public) |
| Leverage spread | `Cap rate (or rp) − Loan constant / rate` | | > 0 required | BF 5 | Both |
| IRR / TRI (property and equity) | Rate solving `0 = −Equity_0 + Σ CF_t/(1+IRR)^t + (Sale_N − Loan balance_N − Sale costs)/(1+IRR)^N` | yearly CF, exit value, loan balance | Compare to hurdle (PE pref 7–8%) | BF 4, 5, 7 | Deal |
| DCF value | `V0 = Σ NOI_t/(1+r)^t + Reversion_N/(1+r)^N`, `Reversion_N = NOI_{N+1}/R_T − Sale costs` | NOI path, discount rate, terminal cap rate | | BF 4 | Deal |
| Velocity of money | Number of deals financed with the same initial equity | | BRRRR: recycle 100% every ~6 months | DG §1 | Deal |

## 5. Financing and debt

| KPI | Formula | Inputs | Typical thresholds | Source | Scope |
|---|---|---|---|---|---|
| Monthly payment (CPM) | `PMT = PV × i(1+i)^n / ((1+i)^n − 1)`, `i = rate/12`, `n = 12 × years` | loan, rate, term | | BF 2 | Deal |
| Amortization split | `Interest_t = Balance_{t−1} × i`, `Principal_t = PMT − Interest_t` | | Early payments > 80% interest | BF 2 | Deal |
| Loan duration rule | | | Borrow on max term (20–25 yrs) to maximize cash-flow and preserve debt ratio | JD C.2 | Deal |
| 110% financing | `Loan = Price + Notary + Works` | | Keep savings as safety cushion | JD C.2 | Deal |
| Deferred amortization (différé) | interest-only or total deferral for 12–24 months | | Negotiate during works | JD C.2 | Deal |
| Borrower insurance cost | `rate × initial capital` (bank group) vs `rate × outstanding capital` (delegation) | | Group 0.35–0.45% vs delegation 0.08–0.15% ; saving 5–15 k€ (Loi Lemoine: switch anytime) | JD E | Deal |
| Effective borrowing cost (EBC) | IRR solving `PV − Points − Fees = Σ PMT/(1+EBC)^t + (Balance_m + Prepay penalty)/(1+EBC)^m` | fees, points, IRA, holding period | Early repayment inflates EBC | BF 2 | Deal |
| Taux d'endettement (HCSF) | `(All monthly loan payments incl. insurance) / Net monthly income` ; rental income counted at **70%** (or differential method) | income, payments, rents | **≤ 35%**, max term 25 yrs (27 with deferral for new/works) | FR-REG (JD cites the 35% cap, A.3) | Deal |
| Front-end DTI (US) | `PITI / Gross monthly income` | | ≤ 28% | BF 3 | Deal |
| Back-end DTI (US) | `All debts / Gross monthly income` | | ≤ 36–43% | BF 3 | Deal |
| Reste à vivre | `Net income − All loan payments` | | Bank criterion, no fixed national threshold | FR-REG | Deal |
| LTV | `Loan / Appraised value` | | ≤ 65–75% (institutional), ≤ 80% residential before PMI ; BRRRR refi at 75% | BF 3, 5 ; DG §6 | Deal |
| DSCR | `NOI / Annual debt service` | | ≥ 1.20–1.35 (1.25 typical) | BF 5 | Deal |
| Debt yield | `NOI / Loan amount` | | ≥ 8–10% | BF 5 | Deal |
| ARM composite rate | `Index + Margin`, subject to annual and lifetime caps | | | BF 2 | Deal |

## 6. BRRRR / refinance metrics

| KPI | Formula | Inputs | Typical thresholds | Source | Scope |
|---|---|---|---|---|---|
| ARV (after repair value) | Comparable sales €/m² × surface (3 best recent comps within ~500 m) | comps, surface | Basis of everything in BRRRR | DG Buy, Refinance | Both (DVF comps) |
| All-in cost | `Price + Rehab + Closing costs (+ carrying costs)` | | | DG §2 | Deal |
| Refinance loan | `ARV × LTV_refi` | ARV, LTV | 75% (70–80%) | DG §6 | Deal |
| Cash-out at refi | `Refi loan − Short-term debt repaid − Refi fees` | | > 0 = capital returned plus bonus (not taxable income, it is debt) | DG §6 | Deal |
| Capital recovery ratio | `Refi loan / All-in cost` | | ≥ 100% = full recycle | DG §2 | Deal |
| Forced appreciation | `ARV − All-in cost` | | Should exceed 25–30% margin | DG §8 | Deal |
| Post-refi cash-flow | `Rent − New loan payment − OpEx` | | Must stay positive after refi | DG §2 | Deal |
| Rehab draw schedule | 15% / 25% / 25% / 25% / 10% holdback ; deposit ≤ 10–15% | | | DG Rehab | Deal |
| Seasoning period | Time between purchase and refi allowed by lender | | Check lender; in France "rachat de crédit" after works typically needs a new appraisal | DG §6 | Deal |

## 7. French tax (fiscalité)

| KPI | Formula | Inputs | Typical thresholds | Source | Scope |
|---|---|---|---|---|---|
| Global tax rate on rental profit | `TMI + 17.2%` social charges | TMI (0/11/30/41/45%) | 28.2% / 47.2% / 58.2% / 62.2% | JD A.1 | Deal |
| Micro-foncier (unfurnished) | `Taxable = 70% × Rent` (30% flat allowance) | rent | Eligible if unfurnished rents ≤ 15,000 €/yr | JD D.4 ; ceiling FR-REG | Deal |
| Régime réel foncier | `Taxable = Rent − Interest − TF − Insurance − Copro − Works (maintenance/improvement) − Management` | actual charges | Déficit foncier deductible from global income up to **10,700 €/yr** (excluding interest), rest carried forward 10 yrs | JD D.4 | Deal |
| Micro-BIC (furnished, LMNP) | `Taxable = 50% × Rent` (classic furnished) | rent | JD says 50%. Since the 2025 finance law: 50% up to 77,700 €; furnished tourist rentals (meublé de tourisme) not classé 30% up to 15,000 € | JD D.4 ; 2025 change FR-REG | Deal |
| LMNP réel: depreciation | `Building (excl. land ~15–20%) / 25–30 yrs + Furniture / 5–10 yrs + Fees` | price split land/building/furniture | Tax ≈ 0 for 8–15 years. Depreciation cannot create a deficit (carried forward) | JD D.4 | Deal |
| LMNP capital gain | JD: depreciation NOT added back (private capital-gain regime) | | **FR-REG update**: since the 2025 finance law (sales from 15 Feb 2025), LMNP depreciation IS added back into the capital gain (except student/senior residences). JD's "fiscal miracle" is outdated | JD D.4 ; FR-REG | Deal |
| SCI à l'IS | `IS = 15% up to 42,500 € + 25% above` on profit after depreciation | | Exit gain = Sale price − Net book value (professional regime) ; dividend tax extra | JD D.4 | Deal |
| SCI à l'IR | Transparent: partners taxed at TMI + 17.2% | | | JD D.4 | Deal |
| Private capital-gain tax | Gain taxed 19% IR + 17.2% PS, with holding-period allowances: IR exempt after 22 yrs, PS after 30 yrs | purchase/sale price, holding years | | JD D.4 (mentions 30-yr exemption) ; schedule FR-REG | Deal |
| After-tax cash-flow | `Pre-tax cash-flow − Tax due under chosen regime` | | Compare regimes and pick the lowest tax | JD A.2, D.4 | Deal |

## 8. Market and location (mostly public data)

| KPI | Formula | Inputs | Typical thresholds | Source | Scope |
|---|---|---|---|---|---|
| City size class | INSEE population | | Metropole / mid-size 100–300k (sweet spot) / small < 30k (illiquid, mono-industry risk) | JD A.3 | Market |
| Market gross yield | `Median rent €/m² × 12 / Median DVF price €/m²` | DVF, rent observatory | See yield bands in §2 | JD A.3 | Market |
| Liquidity | Number of DVF transactions per year per commune (or per 1,000 dwellings) | DVF | Low volume = hard resale | JD A.3 | Market |
| Price trend | YoY change of median €/m² | DVF time series | Don't rely on passive appreciation (DG) | JD A.4, DG §8 | Market |
| Rental vacancy | Vacant dwellings / total (INSEE) | INSEE | Lower = rental tension | JD A.3 | Market |
| Rental tension | Universities, diversified employers, TGV/motorway access, population trend | INSEE, SIRENE | Qualitative score | JD A.3 | Market |
| DPE share F/G | Share of F/G dwellings in area | ADEME DPE open data | Rental ban: G 2025, F 2028, E 2034 ; F/G = 20–35% discount opportunity | JD F (DPE) | Both |
| Interest-rate environment | Banque de France average mortgage rate | BdF | Feeds rd in leverage equation | JD A.4, BF 5 | Market |
| Gordon implied growth | `g = r − Cap rate` | market cap rate, required return | | BF 4 | Market |

## 9. Risk and tenant rules

| KPI / rule | Formula | Threshold | Source | Scope |
|---|---|---|---|---|
| Tenant income ratio | `Net monthly income / Rent CC` | ≥ 3× (CDI, outside trial period) | JD D.5, DG Rent | Deal |
| Stress test | Recompute cash-flow with rent −10%, vacancy +1 month, rate +1–2 pts | Cash-flow stays ≥ 0 | JD B.3 | Deal |
| Leverage risk | Variance of re grows with D/E | | BF 5 | Deal |
| Copro risk check | Planned works in AG minutes, pré-état daté, fonds travaux | | JD E/F | Deal |
| Mandatory checks at visit | Roof, façade cracks, humidity, electrical (30 mA), lead pipes, boiler, glazing, insulation | Cost each into works budget | JD D.2 | Deal |

---

### Notes for the app
1. Default charge ratio: 30% of rent when the user has no line items (JD).
2. Market-level KPIs feasible from DVF + INSEE + ADEME: price/m², liquidity, price trend, market gross yield (needs a rent source), vacancy, DPE share, comps for ARV.
3. Points marked FR-REG need a yearly refresh: notary/DMTO rates, HCSF rules, micro-BIC thresholds, LMNP depreciation add-back (2025), capital-gain allowances.
