# State of the art: open-data real-estate analytics and rental-investment apps (France)

Researched 2026-10-20. Items marked `[to verify]` were not confirmed against a primary source during this pass.

## Frame

- **Theme:** open-data real-estate market analytics and rental-investment analysis for France.
- **Sub-domains:** DVF pipelines, €/m² aggregation and indices, rental-yield estimation, open-source DVF explorers, commercial comparables, investment simulators, browser extensions annotating listings (LeBonCoin, SeLoger...).
- **End goal:** lightweight web + Expo mobile app serving **precomputed KPIs** (not raw DVF rows), plus a browser extension annotating listings.
- **Research axes:** (1) robust price statistics from noisy transaction data (cleaning, aggregation, hedonic/repeat-sales indices); (2) rent estimation and yield computation from sparse rent data.
- **Hard constraints:** DVF is semi-annual (April/October), each release replaces all files, about 5 years of history; no Alsace-Moselle and no Mayotte; one `id_mutation` spans several rows (lots, parcels, dependencies), so naive sums double count; **legal: no re-identification and no search-engine indexing of DVF data**; solo dev on 32 GB RAM, cheap hosting, so aggregate offline and ship small static files (Parquet/JSON/PMTiles).

---

## 1. Open-source repositories

Domain criteria: (a) ingests official DVF or DVF géolocalisées; (b) correctly handles multi-row mutations and filters (sale type, property type, surface); (c) produces aggregates or a usable explorer; (d) maintained by a public body or widely forked.

| Repo / project | Author | Lang | Maturity signals | Why it matters for the end goal |
|---|---|---|---|---|
| [etalab/DVF-app](https://github.com/etalab/DVF-app) | Etalab / DINUM | Python (Flask) + JS | About 576 stars, 103 forks, Apache-2.0; powers app.dvf.etalab.gouv.fr | Reference explorer by parcel/section. Shows how they block indexing and render mutations. **Partly superseded** by explore.data.gouv.fr/immobilier. |
| [datagouv/dvf](https://github.com/datagouv/dvf) | data.gouv.fr team | Node.js | Official scripts that produce "DVF géolocalisées" (geocoded, normalised CSV per year/department) | Best starting schema: per-row CSV with lat/lon, `id_mutation`, `valeur_fonciere`, `surface_reelle_bati`, `type_local`. Use its output rather than raw DGFiP `.txt`. |
| explore.data.gouv.fr/immobilier (new DVF app) | data.gouv.fr | JS front `[to verify: repo name]` | Linked from the official DVF dataset page as the current app | Already shows **precomputed stats** (median €/m² by commune/section, counts). This is the closest model of your "KPIs, not raw" approach. |
| "Statistiques DVF" dataset on data.gouv.fr `[to verify exact title]` | data.gouv.fr | CSV | Precomputed medians by geographic level and month | Can serve as a validation baseline for your own aggregates. |
| [Cerema DVF+ open-data](https://www.data.gouv.fr/datasets/dvf-open-data) | Cerema | PostgreSQL/PostGIS model | Official structured version of DVF (mutation-level tables, typology flags) | Mutation-level modelling (one row per sale, with derived types such as "un appartement") fixes the double-count problem. Good reference for cleaning rules. DV3F (richer) is restricted access. |
| [datagouv/decoupage-administratif](https://github.com/datagouv/decoupage-administratif) | Etalab | JSON / npm | Maintained npm package | Commune, EPCI, department codes for your KPI keys, in both the Python pipeline and the TS front. |
| api.cquest.org/dvf (Christian Quest) | C. Quest | `[to verify: still online]` | Cited in the DVF-app FAQ as the unofficial API | Historical example of a DVF API. Do not depend on it. |
| [Abonia1/Real-Estate-France-DVF](https://github.com/Abonia1/Real-Estate-France-DVF) | community | Python notebooks | Small, educational | Pandas EDA examples only. Not production quality. |
| Kaggle "immobilier france" (benoitfavier) | community | CSV | Joins DVF+ with the 2018 rent map | Shows a DVF + rent join for yield. Data is dated. |

Search keywords for more community repos: `github dvf parquet duckdb`, `topic:dvf`, `"valeurs foncieres" streamlit`.

## 2. Reference books and manuals

**(a) Domain**
- *Les indices Notaires-Insee de prix des logements anciens*, Insee Méthodes n°132 (June 2019). The hedonic stratification method. Read: strata definition, reference basket, quality-constant pricing.
- DGFiP *Notice descriptive DVF* plus *Conditions générales d'utilisation* (shipped with the dataset). Field semantics and legal obligations.
- Cerema, *Guide / modèle de données DVF+* (`[to verify exact title]`, published on datafoncier.cerema.fr). Mutation typology and cleaning.
- Eurostat, *Handbook on Residential Property Prices Indices (RPPIs)* (2013). Hedonic, repeat-sales and stratification methods compared.

**(b) Engineering**
- Wes McKinney, *Python for Data Analysis*, 3rd ed. (2022). Groupby, time-series resampling.
- Martin Kleppmann, *Designing Data-Intensive Applications* (2017). Batch-precompute versus serve design (chapter 10, batch processing).
- DuckDB and Polars official docs (no book needed). Out-of-core Parquet aggregation on a laptop.

## 3. Research papers and literature

Venues: Insee Méthodes / Économie et Statistique, Journal of Housing Economics, Real Estate Economics, Cybergeo, arXiv (stat.AP).

| Paper | Authors | Venue / year | Contribution |
|---|---|---|---|
| Les indices Notaires-Insee de prix des logements anciens | Insee & Notaires | Insee Méthodes n°132, 2019 | Hedonic model per stratum estimates quality-constant prices. It is the French official reference for any price index you build. |
| Une aubaine pour les géographes ? Intérêts des fichiers open DVF... et précautions d'usage | Casanova Enault, Boulay, Coulon `[to verify authors]` | Cybergeo / ResearchGate, 2019 | Catalogues DVF pitfalls (multi-lot mutations, missing surfaces, outliers). Its filtering rules fit straight into a cleaning step. |
| A Method of Estimating Real Estate Price Indexes (repeat sales) | Bailey, Muth, Nourse | JASA, 1963 | The original repeat-sales estimator. Usable on DVF when the same parcel or lot is sold twice. |
| House price indices: Case–Shiller weighted repeat sales | Case & Shiller | AER, 1989 | Heteroskedasticity-weighted repeat sales. This is the basis of the US S&P/Case-Shiller indices. |
| Carte des loyers methodology note | ANIL / SDES, with Igeat et al. `[to verify]` | data.gouv.fr, annual since 2018 | Hedonic model on listing rents (SeLoger, leboncoin and PAP data) gives commune-level predicted rent per m² with prediction intervals. It is the only national open rent source. |
| Hedonic price indices in France using DVF / ML valuation of French housing `[to verify specific titles]` | various | arXiv, 2020-2024 | Gradient boosting and spatial features on DVF for automated valuation (AVM). Search keywords: `arxiv DVF house price prediction France`. |

## 4. Courses, labs and resources

| Resource | Author | Format | What to take |
|---|---|---|---|
| data.gouv.fr DVF dataset page + CGU | DGFiP / Etalab | Docs | Update cadence, legal obligations, notice. |
| app.dvf.etalab.gouv.fr/faq.html | Etalab | FAQ | Edge cases: surface used, missing communes, communes nouvelles, parcel joins. |
| groupe-dvf.fr vademecum (fiches) | Groupe national DVF (Cerema et al.) | Practical guides | Fiche n°2 "Respecter le cadre légal", plus methodological fiches on medians and thresholds. |
| datafoncier.cerema.fr | Cerema | Docs + data | DVF+ schema and typology. |
| Insee Méthodes n°132 | Insee | PDF | Index method. |
| DuckDB docs (Parquet, spatial extension) | DuckDB Labs | Docs | Aggregating about 20M rows in seconds on a laptop. |
| PMTiles / Protomaps docs | Protomaps | Docs | Static vector tiles served from S3/R2, so no tile server is needed. |
| Expo docs + Chrome/Firefox MV3 extension docs (WXT or Plasmo frameworks) | Expo / Google / Mozilla | Docs | Shared TS code across web, mobile and extension. |

## 5. Commercial and community comparables

| Product | Type | What it shows | Notes |
|---|---|---|---|
| MeilleursAgents | Web + app | €/m² map down to street level, estimation with low/high range, price trend, rent €/m² | Mixes DVF, agency data and its own model. Proprietary. |
| SeLoger (prix immobilier pages) | Web | €/m² by city and district, rent €/m², trend | Listing-based plus partner data. |
| Castorus | Web + Chrome/Firefox extension | **Listing price history** (price drops, relisting, days online) injected into listing pages | Confirmed: castorus.com advertises its extension. It is the canonical "annotate listings" example. |
| Horiz.io (formerly Rendement Locatif) | Web, mobile app, **browser plugin** (Firefox addon "rendement-locatif") | Auto **gross yield** on listings of major sites, estimated rent, cash-flow simulator | Confirmed: horiz.io plugin pages and AMO listing. Freemium. |
| LocService | Rental platform | Rent levels by city from its own data `[to verify feature set]` | Possible rent-data comparator. |
| explore.data.gouv.fr/immobilier | Public | DVF medians and transactions | Free and official. Your app must add investment KPIs to differentiate. |
| Dometrio, DomSequa, Normi | Small startups | DVF + rent map + DPE aggregated pages / API | Proof that "precomputed open-data KPIs" is a live niche. Check how they handle indexing (see legal section). |

## KPIs used by existing projects

| KPI | Projects showing it | Formula / method |
|---|---|---|
| Median price per m² (by commune/section/IRIS, by type) | DVF-app, explore.data.gouv.fr, MeilleursAgents, SeLoger, Dometrio | median(`valeur_fonciere` / `surface_reelle_bati`) over single-dwelling sales (one apartment or one house per mutation), `nature_mutation = Vente`, with outliers trimmed (for example the 1st-99th percentiles, or bounds such as 500-30,000 €/m²). |
| Mean €/m² and quartiles (Q1/Q3) | explore.data.gouv.fr `[to verify Q1/Q3]`, groupe-dvf fiches | Percentiles of the same distribution. Show n (count) and suppress cells when n < ~5-10. |
| Transaction volume | Insee (12-month rolling count), explore.data.gouv.fr | Count of distinct `id_mutation` per period and zone. Rolling 12-month sum. |
| Price trend / YoY change | Notaires-Insee, MeilleursAgents, SeLoger | (median_t / median_{t-12m}) − 1. A quality-constant variant uses a hedonic or repeat-sales index. |
| Quality-constant price index | Notaires-Insee | Hedonic regression per stratum, revaluing a reference basket each quarter. |
| Estimated value range | MeilleursAgents | Model point estimate ± interval. Simple version: comparable median × surface, with Q1-Q3 as the band. |
| Rent per m² (predicted) | Carte des loyers (ANIL/DGALN), MeilleursAgents, SeLoger, Horiz.io | Carte des loyers: hedonic prediction per commune with a 95% interval (separate apartment/house, typology). |
| Gross rental yield | Horiz.io plugin, Rendement Locatif, MeilleursAgents `[to verify]` | (monthly rent × 12) / purchase price. Zone version: (rent €/m² × 12) / price €/m². |
| Net yield | Horiz.io simulator | (annual rent − charges − taxe foncière − insurance − management − vacancy) / (price + notary fees ~7-8% + works). |
| Net-net yield / after tax | Horiz.io (premium) | Net yield after income tax and social contributions under the regime chosen (micro-foncier, réel, LMNP micro-BIC or réel). |
| Monthly cash-flow | Horiz.io, generic simulators | rent − loan payment − charges − taxes (monthly). |
| Loan payment | All simulators | P·r/(1−(1+r)^−n) + insurance. |
| Price-to-rent ratio | Analyst blogs | price / annual rent (the inverse of gross yield). |
| Listing price vs local median (over/under-pricing) | Castorus `[partially]`, Horiz.io | (listing €/m² / zone median €/m²) − 1. |
| Listing price history / days on market / price drops | Castorus | Tracked by crawling listings over time. Not derivable from open data. |
| Rent cap compliance (encadrement des loyers) | Paris / Lille / Lyon official simulators | Compare rent €/m² with the reference rent × 1.2 (loyer de référence majoré). Open data exists per city. |
| Energy class (DPE) mix / "passoire" share | Dometrio, Normi | ADEME DPE open data aggregated by zone. This matters for rental bans on G/F-rated dwellings. |

## Legal and ToS notes

### DVF licence and usage restrictions
- **Legal basis:** article L112 A of the Livre des procédures fiscales (loi ESSOC, 10 August 2018) and décret n° 2018-1350 of 28 December 2018 (articles R112 A-1 and following).
- **No re-identification:** reuse "must neither have as purpose nor effect" the re-identification of the persons concerned (R112 A-3). Do not join DVF with owner names, cadastre owner files, or listing photos to pinpoint sellers. Prefer zone aggregates. If you show individual transactions, keep them at section/parcel level without addresses tied to people.
- **No search-engine indexing:** reused DVF data must not be indexable by external search engines. Etalab implemented technical measures for this. Practically: serve per-transaction or detailed pages behind JS/API, with `robots.txt` Disallow and `X-Robots-Tag: noindex` / `<meta name="robots" content="noindex">`. Do not build SEO pages listing transactions. Whether *aggregated* statistics such as a median €/m² per commune are covered is debated (see the teamopendata.org thread). Aggregates are generally treated as no longer being "DVF data about persons", but this is `[to verify with the CGU / CNIL]`. A cautious default is to noindex any page that displays individual mutations.
- Data **cannot be erased** on request, but data subjects keep access/rectification rights. Republish the latest release (each release replaces the previous one) and propagate DGFiP corrections.
- The dataset carries a licence notice on data.gouv.fr (Licence Ouverte / CGU DGFiP `[to verify exact licence]`). Attribution "Source: DGFiP, DVF" is expected.
- Carte des loyers, DPE (ADEME) and Insee data are under Licence Ouverte 2.0 (attribution required).

### Scraping listing sites (LeBonCoin, SeLoger)
- **Sui generis database right (CPI L341-1 and following):** LeBonCoin won against Entreparticuliers (CA Paris, 2 February 2021, n° 17/17688). The extraction of a substantial part of its real-estate database was an infringement, and the purpose of the extraction was irrelevant.
- **Counter-trend:** TJ Paris, 21 February 2025 (LeBonCoin v. DirectAnnonces). The right was recognised, but it could not be enforced because LeBonCoin failed to show that the scraping threatened the return on its investment. This is a case-by-case balancing, not a green light.
- **ToS:** both sites' CGU prohibit automated extraction `[to verify current wording]`. They also use anti-bot systems such as DataDome. Bypassing them raises risk (and possibly article 323-1 of the Code pénal for fraudulent access if technical protections are circumvented).
- **GDPR:** listings contain personal data (seller names, phone numbers, photos). Storing them makes you a data controller.
- **Lower-risk extension design (the Horiz.io / Castorus model):** the extension reads the DOM **of the page the user is already viewing**, extracts price, surface and postcode **client-side**, and calls your API with only those fields to fetch zone KPIs. Do **not** store listings server-side, do not crawl, do not rebuild a listing database. Price-history features like Castorus's require server-side collection and carry the highest legal risk. Keep them out of scope for an MVP. Chrome Web Store and AMO policies also require a clear privacy policy and minimal permissions (host permissions limited to the target sites).

---

## 6. Project roadmap

### Level 1: DVF KPI pipeline (foundations)
- **Goal:** turn DVF géolocalisées (5 years, about 15-20M rows) into a commune × type × semester KPI table.
- **Architecture:** download CSV.gz per year, load with DuckDB (or Polars) into Parquet, collapse to mutation level (keep single-dwelling sales, `Vente`), compute €/m², trim outliers, group by commune/section, compute median/Q1/Q3/n/YoY, suppress cells with small n, write `kpi_commune.parquet` and one JSON per department.
- **Stack:** Python 3.12, DuckDB, Polars, pytest. Runs well under 8 GB RAM.
- **Reuses:** datagouv/dvf output format, Cerema DVF+ typology rules, Cybergeo pitfalls paper, groupe-dvf fiches.
- **Success metric:** commune medians within ±5% of explore.data.gouv.fr for 50 sampled communes, and a full run in under 5 minutes.
- **Main risk:** multi-lot mutation handling and `surface_reelle_bati` gaps biasing medians.

### Level 2: Yield map web + Expo app
- **Goal:** join price KPIs with Carte des loyers (rent €/m²) to get gross yield, price-to-rent ratio and trend per commune. Serve them statically.
- **Architecture:** pipeline output becomes static JSON/Parquet plus PMTiles (communes with KPI properties) on Cloudflare R2 or GitHub Pages. A shared TS `@kpi/core` package holds the yield and loan formulas. Next.js (or Vite) web app with MapLibre. Expo app with the same core and a list/search UI.
- **Stack:** Python pipeline, run by a semi-annual GitHub Actions cron aligned on the April/October DVF releases. TypeScript monorepo (pnpm/Turborepo), MapLibre GL / react-native-maplibre.
- **Reuses:** DVF-app UI ideas, decoupage-administratif, Carte des loyers methodology, Horiz.io KPI definitions.
- **Success metric:** total artifact under 50 MB, first map paint under 2 s, hosting cost under €5/month.
- **Main risk:** Carte des loyers is listing-based and lags (annual), so yields are indicative. Show the confidence interval.

### Level 3: Listing-annotating extension + simulator
- **Goal:** an MV3 extension (Chrome + Firefox via WXT) on LeBonCoin and SeLoger listing pages that shows zone median €/m², over/under-pricing %, estimated rent, gross/net yield and cash-flow. Add an in-app full simulator (LMNP/micro-foncier regimes, loan) and optionally a hedonic or repeat-sales index per area.
- **Architecture:** a content script parses price, surface, postcode or INSEE code and type from the DOM. It calls a tiny edge API (Cloudflare Worker) that serves KPI lookups from KV/R2, and renders a shadow-DOM badge. No listing storage. Optional per-department LightGBM AVM trained offline on DVF + DPE features, exported as lookup tables or ONNX.
- **Stack:** WXT + TS, Cloudflare Workers, Python (LightGBM, statsmodels for the hedonic index).
- **Reuses:** Castorus and Horiz.io UX patterns, Insee hedonic method, Bailey-Muth-Nourse / Case-Shiller, legal notes above.
- **Success metric:** badge renders in under 300 ms on 95% of listing pages. The AVM reaches MdAPE ≤ 15% on a held-out DVF period.
- **Main risks:** DOM changes on the target sites (selectors break), and legal or ToS exposure. Mitigate by parsing client-side only and never crawling.

## Start here
1. https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres (plus the CGU PDF), for the legal frame and the data.
2. https://github.com/datagouv/dvf and the "DVF géolocalisées" files, as the pipeline input.
3. https://explore.data.gouv.fr/immobilier together with the Carte des loyers dataset, as the baseline your KPIs must match and beat.
