# App Flow

Frontend overview. Details per screen live in `docs/features/NNN-*/spec.md`; visual design is in
`UI_UX.md` (not done yet: features first). Code: `apps/app/src/app/` (Expo Router, one file per route).

## Screen list

| Route | Screen | What it answers | Data | Spec |
|---|---|---|---|---|
| `/` | Accueil / recherche | "Which town?" — search by name, quick picks, links to the three tools | `data/index.json` | 002 |
| `/place/[level]/[code]` | Page d'une ville (commune, arrondissement, département, région, France) | "What is this market like?" — price, trend, rent, gross yield, score /100, price bands, DPE labels, property tax, rent control, INSEE context, risk flags | `data/geo/<level>/<code>.json` | 002 |
| `/simulator` | Simulateur | "Does this deal work?" — cash-flow, yields, loan, HCSF, tax by regime, net-net yield, IRR with resale, leverage, break-even, BRRRR | commune JSON (prefill) + `core-kpi` (on device) | 004, 010 |
| `/property` | Analyser un bien | "Is this property's price right, and does it pay?" — verdict badges, estimate + interval + explanation + comparables, rent, money, risks, area | local API `POST /estimate` + commune JSON | 012, 011 |
| `/ranking` | Classement des villes | "Where to invest?" — communes sorted by score / yield / price / trend / population, filters | `data/ranking.json` | 003 |
| `/map` | Carte | "Where, visually?" — France by département → communes, 10 metrics, quintile colours | `data/map/*.geojson` | 005 |
| (extension) | Popup "Analyser ce bien" | Reads the listing being viewed, opens `/property` prefilled | page DOM only | 008 |

## Main flow — from a city to a decision
1. `/` → type a town → `/place/commune/<code>`.
2. On the town page: pick the segment (apartment / house, T1–T5+) → read market, score and risks.
3. "Simuler un achat ici" → `/simulator?level&code&type&rooms` prefilled with that segment's median price, surface, ANIL rent and commune tax rate.
4. Adjust price, rent, loan, tax bracket → after-tax cash-flow per regime, IRR over 10/15/20 years.

## Secondary flows
- **A specific property** (listing or visit): `/property` (or the browser extension on a listing → `/property?address&type&surface&rooms&price`, fields to confirm) → "Analyser" → verdict + 5 blocks → "Ajuster le financement" → `/simulator` with that property's price, surface and rent.
- **Where to invest**: `/ranking` → filters (type, risky towns out, rent control out, département, max €/m², sort) → a town → town page.
- **Map exploration**: `/map` → metric → click a département → its communes → click a commune → figures + link to its page (only if it has published prices).

## Rules every screen follows
- Past signed prices (DVF) vs current asking rents (ANIL) are labelled as such.
- Low data is shown, not hidden: "fiabilité faible" under 30 sales, nothing published under 10, grey on maps.
- Every figure names its source; the app describes, it never advises to buy.
- Pages showing DVF-derived data carry `noindex`; individual sales appear only in the local `/property` comparables.
- Web first; the same Expo code ships to iOS/Android in step 009 (the map needs a native implementation then).
