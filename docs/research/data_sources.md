# Open Data Sources: French Real-Estate Investment Analytics

Compiled 2026-10-20. Status legend: **[V]** = checked against the live web page during this research; **[K]** = known from documentation and prior releases but not re-checked today. Re-check sizes and versions before ingesting anything. Sizes are approximate.

## 1. DVF: Demandes de valeurs foncières (DGFiP)

- **URL**: https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres/ (id `5c4ae55a634f4117716d5656`) [V]. Also available through the DGFiP portal at app.dvf.etalab.gouv.fr (map explorer).
- **Licence**: Licence Ouverte / Etalab 2.0. DVF's legal framework (Code général des impôts, art. L112 A, and décret 2018-1350) also forbids re-identifying people and forbids indexing by search engines of pages that expose individual transactions. Do not publish row-level data with addresses in pages that search engines can index.
- **Coverage**: a rolling window of the 5 most recent years plus the current half-year. The listing currently shows **2021 to 2025** [V].
- **Refresh cadence**: twice a year, in **April and October** [V]. The most recent release is dated 5 to 7 April 2026 [V], so the October 2026 release should appear any day. Each release deletes and replaces all files [V], and older year files can gain late-recorded mutations [V]. Re-ingest every year, not only the new one.
- **Format**: one pipe-delimited (`|`) `.txt` file per year (`ValeursFoncieres-YYYY.txt`, also as zip). Decimal comma, dates as `DD/MM/YYYY`, encoding latin-1/UTF-8 varies by release [K].
- **Size**: about 0.4 to 0.6 GB uncompressed per year, about 3.5 to 4.7 M rows per year. About 2.5 GB uncompressed for 5 years [K].
- **Key columns** (43 columns) [K]: `No disposition`, `Date mutation`, `Nature mutation` (Vente, VEFA, Échange, Adjudication, Expropriation, Vente terrain à bâtir), `Valeur fonciere`, address fields (`No voie`, `Type de voie`, `Voie`, `Code postal`, `Commune`), `Code departement`, `Code commune` (3 digits, so INSEE = dept + commune), `Section`, `No plan`, `Lot 1..5` with `Surface Carrez du lot 1..5`, `Nombre de lots`, `Code type local` / `Type local` (Maison, Appartement, Dépendance, Local industriel/commercial), `Surface reelle bati`, `Nombre pieces principales`, `Nature culture`, `Surface terrain`. There is no mutation ID.
- **Geographic gaps**: **Bas-Rhin (67), Haut-Rhin (68) and Moselle (57) are absent** because they use the Livre foncier, the local land register. **Mayotte (976) is absent** [K]. A discussion thread on Alsace-Moselle exists on the dataset page [V]. For those areas, the main fallback is the per-commune price statistics published by notaires and Perval.

### Known pitfalls

1. **Multi-row mutations**: one sale appears as N rows, one per (parcel × local × culture) combination. `Valeur fonciere` is the **total price repeated on every row**. Summing it overcounts; take it once per mutation.
2. **No mutation ID in raw DVF**: build one by grouping on (`Date mutation`, `Valeur fonciere`, `No disposition`, commune, section, `No plan`), or use DVF+ / geo-dvf, which provide `id_mutation`.
3. **Multi-lot / multi-local sales** (whole buildings, apartment + parking + cellar): you cannot compute a price per m² from a single row. Keep only mutations with exactly one Appartement or Maison local (dépendances allowed). Compute price per m² as `valeur / surface_reelle_bati`.
4. **Duplicate rows per lot**: the same local repeats once per parcel or culture line. Deduplicate on (mutation, `Code type local`, `Surface reelle bati`, lot) before summing surfaces.
5. `Surface reelle bati` is empty for Dépendances and land. `Surface Carrez` is filled only for co-ownership lots over 8 m².
6. **Outliers**: symbolic €1 transfers, sales within families, and VEFA (off-plan new builds) in bulk. Filter on `Nature mutation = Vente`, and trim price per m² by commune (for example the P1 to P99 range, or the median ± 3×IQR).
7. Communes merged or split over time: map to the current commune list with the INSEE COG table of commune changes before joining.
8. No information on the buyer or seller, and no DPE label or construction year.

## 2. DVF+ (Cerema) and geo-dvf (Etalab)

- **geo-dvf** (Etalab): https://files.data.gouv.fr/geo-dvf/latest/csv/ (dataset "Demandes de valeurs foncières géolocalisées") [K]. These are cleaned CSVs, one row per (mutation × local), with `id_mutation`, `id_parcelle` (14 characters), `code_commune` (INSEE, 5 characters), `longitude` and `latitude` from the cadastre parcel centroid. Files are split by year / department / commune, in `.csv.gz`. Size: about 0.8 to 1 GB uncompressed for the full 5 years [K]. Refreshed with each DGFiP release. Licence Ouverte 2.0. **Recommended primary input.** An API is available at `api.cquest.org/dvf` (community-run, not guaranteed).
- **DVF+ open data** (Cerema): https://datafoncier.cerema.fr/donnees/autres-donnees-foncieres/dvfplus-open-data [K]. A PostgreSQL/PostGIS dump, or GeoPackage per region. It is normalised into a mutation table, a local table and a parcel table, with derived fields (`codtypbien`, `libtypbien`, `sbati`, `vefa` flag, number of locals by type). Size: about 10 to 20 GB as a PostGIS dump nationally. Licence Ouverte. This is the best choice for detailed classification of property types, but it is heavier to run.
- **Dependencies**: geo-dvf depends on the DGFiP DVF release and on the cadastre (Etalab) for coordinates. Rows whose parcel is missing from the cadastre have no coordinates (a few %).

## 3. Carte des loyers (ANIL / DHUP, Ministère du Logement)

- **URL**: 2025 edition: https://www.data.gouv.fr/datasets/693aa2feed1bf4da603faa49/ [V]. Earlier editions, one dataset per year: 2018, 2022, 2023, 2024 [V]. User guide: https://www.ecologie.gouv.fr/sites/default/files/documents/guide-dutilisation-des-donnees-carte-loyers.pdf [V].
- **Content**: an estimated **asking rent in €/m², charges included**, per commune, for an unfurnished reference home, in 4 segments: apartment (all), T1-T2, T3+, and house. Each estimate comes with a 95 % prediction interval and the number of listings (`nbobs_com`, `nbobs_mail`). The model uses about 9 M listings from SeLoger and leboncoin [V]. For the 2025 file, the listings date from **Q3 2025** and commune boundaries are those of 1 January 2025 [V].
- **Format / size**: CSV (`;` separator, decimal comma), 4 files of about 35 k rows, about 3 to 5 MB each [K]. Licence Ouverte 2.0.
- **Refresh cadence**: once a year, published around December [V].
- **Join key**: `INSEE_C` (INSEE commune code) [K].
- **Pitfall**: the editions **cannot be compared over time**, because methodology and boundaries change [V]. Small communes get model-based estimates (check `TYPPRED` and the width of the interval). These are **asking** rents, not signed rents.

## 4. Observatoires locaux des loyers (OLL)

- **URL**: https://www.observatoires-des-loyers.org/ (open data section) and on data.gouv.fr ("Résultats nationaux des observatoires locaux des loyers") [K].
- **Content**: **observed** rents in force on private leases, about 30 observatories covering about 60 agglomerations [V]. Results are broken down by zone, property type, number of rooms, construction period and tenure length. The OLL results are used to set the rent-control caps (encadrement des loyers) in Paris, Lille, Lyon and other cities.
- **Format / size**: CSV, a few MB per year. Licence Ouverte. Refreshed once a year, for year N-1.
- **Join key**: the observatory's own zone (`Zone_complementaire`, "agglomeration" level), which needs a mapping table from zone to INSEE commune or IRIS, supplied in OLL shapefiles and documentation.
- **Related source**: the rent-control reference rents (`loyers de référence`) published as open data by Paris, Lyon and Lille, per quartier.

## 5. INSEE

| Dataset | URL | Format / size | Refresh | Key | KPIs |
|---|---|---|---|---|---|
| Population légale (recensement) | insee.fr/fr/statistiques/ "Populations légales" | XLSX/CSV, about 35 k rows, < 5 MB | Yearly (late December, reference year N-3) | Commune (`CODGEO`) | Population, 5-year growth |
| Base recensement **Logement** (communes / IRIS) | insee.fr "Bases infracommunales : Logement" | CSV, about 50 k IRIS rows, about 50 to 100 MB | Yearly | IRIS (9 characters), commune | **Vacancy rate** (`P_LOGVAC/P_LOG`), owner share, renter share, social housing share, building age, number of rooms |
| **Filosofi** (revenus, pauvreté) | insee.fr "Revenus, pauvreté et niveau de vie" (communes, IRIS) | CSV/XLSX, 10 to 50 MB | Yearly (data for year N-2) | Commune, IRIS (statistical secrecy for small units) | Median disposable income per consumption unit, poverty rate, rent-to-income ratio |
| Filosofi carroyé (200 m grid) | insee.fr "Données carroyées" | GPKG/CSV, about 1 to 2 GB | Irregular | 200 m grid cell | Very local income data |
| IRIS contours (IGN / INSEE "CONTOURS-IRIS") | geoservices.ign.fr/contoursiris | GPKG/SHP, about 200 to 300 MB | Yearly | IRIS | Mapping, point-in-polygon for DVF |
| COG (Code officiel géographique) | insee.fr/fr/information/2560452 | CSV, < 5 MB | Yearly (1 January) | Commune, history of commune changes | Join harmonisation |
| LOVAC (vacant private housing, CEREMA / DGALN) | data.gouv.fr "LOVAC" | CSV, about 30 MB | Yearly | Commune | Structural vacancy (vacant 2 years or more) |

Licence: Licence Ouverte for all. All INSEE tables share the 5-character `CODGEO` commune code and the 9-character `IRIS` code [K].

## 6. DPE ADEME (energy performance certificates)

- **URL**: https://data.ademe.fr/datasets/dpe03existant (existing homes, DPE since July 2021), `dpe02neuf` (new homes), `dpe-v2-logements-existants` older, and `dpe-france` (before July 2021) [K]. API: `https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines` (JSON / CSV export, paginated, 10 000 rows per page).
- **Licence**: Licence Ouverte 2.0.
- **Size**: about 12 to 14 M certificates since July 2021, with more than 200 columns. Full CSV export: **about 20 to 40 GB**. Select columns at extraction time.
- **Refresh cadence**: continuous, updated daily or weekly.
- **Key columns**: `numero_dpe`, `etiquette_dpe`, `etiquette_ges`, `conso_5_usages_par_m2_ep`, `surface_habitable_logement`, `annee_construction`, `type_batiment`, `code_insee_ban`, `identifiant_ban`, `adresse_ban`, `coordonnee_cartographique_x_ban/_y_ban` (Lambert 93).
- **Join key**: BAN address ID (`identifiant_ban`) and INSEE commune. To attach a DPE label to a DVF sale, match on address and parcel (geocode DVF with BAN) and on approximate surface. Expect a 30 to 60 % match rate.
- **KPIs**: share of F and G "passoires" (energy sieves) by commune or IRIS, a green-value or brown-discount model (price per m² by label), and **rental-ban risk under the Climat & Résilience law**: G-rated homes cannot be newly let from 2025, F-rated from 2028, E-rated from 2034.
- **Pitfalls**: several DPE can exist for the same home (keep the latest), the calculation method changed in July 2021 and January 2024 (small surfaces), and some certificates are fraudulent or erroneous.

## 7. Taxe foncière rates: REI (DGFiP) and OFGL

- **REI** (Recensement des éléments d'imposition): https://www.data.gouv.fr/datasets/impots-locaux/ and `data.economie.gouv.fr` "Fichier de recensement des éléments d'imposition à la fiscalité directe locale (REI)" [K]. It contains voted rates by commune, intercommunality, department and syndicate: TFPB, TFPNB, TH on secondary homes, TEOM. Format: CSV or XLSX, about 35 k rows × about 1 000 columns, 100 to 200 MB. Refreshed once a year (data for year N published around N+1). Licence Ouverte.
- **OFGL**: https://data.ofgl.fr/ ("Fiscalité locale des particuliers", per commune, Opendatasoft API) [K]. It gives cleaner, aggregated rates and tax bases per commune, with an API and CSV export of a few MB.
- **Join key**: INSEE commune code (REI uses DEP + COM, 2 + 3 characters, concatenate them).
- **KPIs**: total TFPB rate (commune + intercommunality + TEOM). Combined with an estimated rental value (`valeur locative cadastrale`), the rate gives the annual property tax, which is a **net-yield deduction**. The rate's 5-year trend can also be tracked.
- **Pitfall**: the property tax itself needs the cadastral rental value of the property, which is not open data. Use a proxy, for example tax per m² by commune from the "Observatoire de la taxe foncière" data, or let the user enter the amount.

## 8. Cadastre (Etalab / DGFiP PCI)

- **URL**: https://cadastre.data.gouv.fr/datasets/cadastre-etalab [K]. GeoJSON, by department or commune: `parcelles`, `batiments`, `sections`, `communes`. The PCI vecteur/EDIGEO format is also available. Licence Ouverte 2.0.
- **Size**: about 100 M parcels nationally. Full GeoJSON is **about 30 to 50 GB uncompressed** (about 6 to 8 GB gzipped).
- **Refresh cadence**: quarterly.
- **Join key**: `id` parcel = 14 characters (INSEE commune 5 + prefix 3 + section 2 + number 4), the same as DVF `id_parcelle`.
- **KPIs**: land surface, building footprint, mapping of DVF sales. Optional: the parcel centroid already sits in geo-dvf.
- **Related source**: **Fichiers fonciers** (Cerema) are richer but restricted to approved public bodies, so they are not usable here.

## 9. BAN: Base Adresse Nationale (geocoding)

- **URL**: https://adresse.data.gouv.fr/data/ban/adresses/latest/csv/ (CSV per department) [K]. The geocoding API was at `api-adresse.data.gouv.fr` and is moving to the IGN Géoplateforme (`data.geopf.fr/geocodage`). It supports `/search/csv` batch geocoding.
- **Licence**: Licence Ouverte 2.0 (since 2020).
- **Size**: about 26 M addresses, **about 4 to 5 GB uncompressed** for the full CSV.
- **Refresh cadence**: daily or weekly.
- **Keys**: `id` (BAN id `CCCCC_VVVV_NNNNN`), `code_insee`, `cad_parcelles`, lon/lat.
- **Use**: geocode user-entered addresses, join DPE (`identifiant_ban`) with DVF addresses, attach IRIS by point-in-polygon. Rate limit for the API: about 50 requests/s per IP. Use the batch CSV endpoint or the local file for bulk work.

## 10. Banque de France: mortgage rates

- **URL**: Webstat https://webstat.banque-france.fr/ (API key free on registration). Relevant series [K]:
  - `MIR1.M.FR.B.A22.A.R.A.2254U6.EUR.N`: average rate on new housing loans to households (monthly).
  - The breakdown by initial fixation period (over 10 years).
  - The "Crédits à l'habitat" statistical publication (outstanding loans and new loans).
- **Format**: SDMX/JSON/CSV via the API, tiny size (< 1 MB).
- **Refresh cadence**: monthly, about 5 weeks after the end of the month.
- **Licence**: Banque de France reuse terms (free reuse with attribution, similar to Licence Ouverte).
- **Join key**: date (month), national level only.
- **KPIs**: monthly mortgage payment, borrowing capacity, financed yield and cash-flow simulations, price-to-rate cycle charts.
- **Related sources**: Observatoire Crédit Logement / CSA (rates by duration, press releases only, not open data), and the usury rate (`taux d'usure`, published quarterly by the Banque de France).

## 11. Notaires price indices

- **Indices Notaires-INSEE** (quality-adjusted price indices for existing homes): https://www.insee.fr/fr/statistiques/series/ (the "Indices des prix des logements anciens" series, by region and for large cities) [K]. They are on INSEE BDM via the SDMX API. Quarterly, published about 2 months after quarter-end. Licence Ouverte. Size < 1 MB.
- **Notaires de France median prices** (immobilier.notaires.fr, BIEN for Île-de-France, Perval for the rest): median price per m² by commune or district. Free to view on the website, but **not open data**: scraping is restricted by the site's terms, and bulk data requires a licence. Use these figures only as a reference or for Alsace-Moselle coverage, after checking the terms.
- **KPIs**: price trend and momentum by region, deflating DVF prices, and coverage of Alsace-Moselle (where Perval covers the area and DVF does not).

## 12. Summary table

| # | Source | Licence | Format | Raw size | Refresh | Join key | Main KPIs |
|---|---|---|---|---|---|---|---|
| 1 | DVF (DGFiP) | LO 2.0 + legal restrictions | Pipe-delimited TXT | about 2.5 GB / 5 years | Twice a year (April, October) | Commune, parcel | Price per m², volumes, liquidity |
| 2 | geo-dvf / DVF+ | LO 2.0 | CSV.gz / PostGIS | about 1 GB / 10 to 20 GB | Twice a year | `id_mutation`, parcel, lon/lat | Same, geolocated, IRIS-level |
| 3 | Carte des loyers | LO 2.0 | CSV | about 15 MB | Yearly | Commune | Rent per m², **gross yield** |
| 4 | OLL | LO 2.0 | CSV | < 20 MB | Yearly | OLL zone → commune | Observed rents, rent-cap checks |
| 5 | INSEE (RP, Filosofi, IRIS, COG) | LO 2.0 | CSV/GPKG | about 0.5 GB (2 GB with grid) | Yearly | Commune, IRIS | Demand, vacancy, income, affordability |
| 6 | DPE ADEME | LO 2.0 | API/CSV | 20 to 40 GB | Daily | BAN id, commune | F/G share, rental-ban risk, green value |
| 7 | REI / OFGL | LO 2.0 | CSV | about 200 MB | Yearly | Commune | Property-tax rate, net yield |
| 8 | Cadastre | LO 2.0 | GeoJSON | 30 to 50 GB | Quarterly | Parcel | Land, footprint, mapping |
| 9 | BAN | LO 2.0 | CSV/API | 4 to 5 GB | Daily | BAN id, commune | Geocoding, joins |
| 10 | Banque de France | BdF terms | API | < 1 MB | Monthly | Month | Credit cost, cash flow |
| 11 | Notaires-INSEE indices | LO 2.0 | API | < 1 MB | Quarterly | Region, month | Price trend |

## 13. KPIs enabled (by combining sources)

- **Median price per m²** and its trend, by commune or IRIS, house vs apartment: DVF, COG, IRIS.
- **Transaction volume and turnover rate** (sales / housing stock): DVF and RP Logement.
- **Gross yield** = 12 × rent per m² / price per m²: Carte des loyers (or OLL) and DVF.
- **Net yield**: gross yield minus property tax (REI), charges, and vacancy (RP / LOVAC).
- **Cash flow and leveraged return**: add Banque de France rates.
- **Affordability** = price / (median income × years): Filosofi and DVF.
- **Demand momentum**: population growth, vacancy trend.
- **Energy risk**: share of F and G homes, compliance timeline (ADEME DPE).
- **Price-to-rent ratio**, and a comparison of market rent vs capped rent (OLL / rent-control zones).

## 14. Recommended ingestion order

1. **COG + IRIS contours**: the reference geography that every other join depends on.
2. **geo-dvf** (5 years): the core dataset. Build the cleaned mutation table and the price per m² aggregates. Fall back to raw DVF only to validate.
3. **Carte des loyers 2025** (+ earlier editions for reference): enables gross yield right away.
4. **INSEE RP Logement + Filosofi + population**: context and demand KPIs.
5. **REI / OFGL**: property-tax rates, for net yield.
6. **Banque de France rates + Notaires-INSEE indices**: small time series, cheap to add.
7. **OLL**: observed rents for the ~60 covered agglomerations, via the zone mapping.
8. **BAN** (batch API, or the department files on demand): needed for user addresses and for the DPE join.
9. **DPE ADEME**: large. Extract only the needed columns, through the API or a column-filtered export.
10. **Cadastre**: only if parcel-level maps or land analysis are needed. Otherwise the geo-dvf coordinates are enough.

## 15. Raw vs aggregated size estimate

| Layer | Raw | After cleaning (Parquet, selected columns) | Aggregated for the app |
|---|---|---|---|
| DVF / geo-dvf 5 years | 1 to 2.5 GB | about 300 to 500 MB | Commune × type × quarter: about 35 k × 2 × 20 → about 1.4 M rows, **about 50 MB**; IRIS level about 150 MB |
| Carte des loyers | 15 MB | 3 MB | 3 MB |
| INSEE (RP, Filosofi, COG, IRIS contours) | about 0.5 GB | about 100 MB | about 20 MB (+ simplified IRIS geometry about 50 MB) |
| DPE | 20 to 40 GB | about 1.5 to 3 GB | Commune / IRIS label shares: about 10 MB |
| REI / OFGL | 200 MB | 5 MB | 2 MB |
| BAN | 4 to 5 GB | about 1 GB (if kept locally) | Not stored, used only for joins |
| Cadastre | 30 to 50 GB | Optional, skip | Not stored |
| BdF, Notaires-INSEE, OLL | < 30 MB | < 10 MB | < 5 MB |
| **Total** | **about 55 to 100 GB** with cadastre, **about 25 to 45 GB** without | **about 3 to 5 GB** | **about 150 to 300 MB** |

The serving database (commune and IRIS aggregates plus time series) fits easily in SQLite, DuckDB or a small Postgres instance. The heavy raw files (DPE, cadastre, BAN) can be processed with streaming or DuckDB and deleted afterwards. Check free disk space before downloading the DPE and cadastre bulks.

## Sources checked during this research

- [DVF dataset on data.gouv.fr](https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres/)
- [Carte des loyers 2025](https://www.data.gouv.fr/datasets/693aa2feed1bf4da603faa49/)
- [Carte des loyers 2024](https://www.data.gouv.fr/datasets/6751be987c09f4be821c6934)
- [Carte des loyers user guide](https://www.ecologie.gouv.fr/sites/default/files/documents/guide-dutilisation-des-donnees-carte-loyers.pdf)
