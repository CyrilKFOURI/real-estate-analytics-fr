# 010 — Tax regimes (first year)

Compares the after-tax monthly cash-flow of a long-term rental under the four usual regimes, for the
user's marginal rate (TMI). Pure functions in `apps/app/src/core-kpi/tax.ts`, rules in `rules.ts` (TAX_RULES).

| Regime | Taxable income | Ceiling |
|---|---|---|
| Micro-foncier (unfurnished) | 70 % of collected rent | 15 000 €/yr |
| Réel foncier (unfurnished) | rent − operating costs − first-year interest − borrower insurance; a deficit is reported (offsettable up to 10 700 € excluding interest) | — |
| LMNP micro-BIC (furnished, long term) | 50 % of collected rent | 77 700 €/yr |
| LMNP réel (furnished) | same as réel minus depreciation (building 85 % of price / 30 yrs, furniture / 7, works / 15), never below zero; the rest is carried | — |

Tax = taxable × (TMI + social charges 17.2 %).

Simplifications shown in the UI: first year only; same rent furnished or not; the deficit is not offset
against the user's other income; accounting fees for LMNP réel not counted; since the 2025 finance law,
LMNP depreciation is added back to the capital gain at resale (not modelled: needs the 10–20-year IRR, D14).
To verify yearly: social charges rate (LFSS), micro ceilings and allowances.
