# 011 — Price check (ML): is this property's price consistent?

Status: **design, not built**. Depends on 004 (simulator) for the deal side and on the
pipeline prerequisites in §3.

## 1. Question answered
"For *this* property (type, surface, rooms, land, location, date), what price would the
market have paid, how sure are we, and *why*?" Output for one property:
- an estimated fair price (median) with an interval (P10–P90);
- a verdict: **below / consistent / above** the market, from where the asked price falls in that interval;
- an explanation: which characteristics push the estimate up or down, plus the real comparable sales behind it.

## 2. What the model can and cannot know
- It learns from **past signed sales** (DVF), not from listings. Asking prices are usually a little higher (negotiation), so "above market by 3 %" is not alarming; the verdict uses the interval, not a single number.
- DVF has no condition (renovated or not), floor, view, balcony, exact address (official files) or DPE. Two flats with the same surface in the same street can differ by 20 % for those reasons. **The model measures what the data can see.** The UI must say so, and let the user adjust for condition ("à rénover", "refait à neuf").
- Prices move: every sale is time-adjusted to "today" with our own half-year index (kpi_price) before training, and the date is also a feature.

## 3. Pipeline prerequisites (to build first)
The clean sales table (`data/clean/dvf/sales.parquet`) must keep, per sale:
| Feature | DVF column | Why |
|---|---|---|
| Land surface | `Surface terrain` (sum over parcels) | Main driver of house prices |
| Carrez surface | `Surface Carrez du 1er lot` | More reliable than `Surface reelle bati` for flats |
| Number of lots, dependencies | `Nombre de lots`, rows with `Dépendance` | Parking/cellar add value |
| New build (VEFA) | `Nature mutation = 'Vente en l'état futur d'achèvement'` | New is ~15–25 % dearer |
| **Coordinates** | none in official files | Location is the #1 feature |

**Coordinates plan:** join `id_parcelle` to (a) geo-DVF, which carries lat/lon per parcel for past releases, and (b) the Etalab cadastre (parcel centroids) for parcels not in geo-DVF. Then add the IRIS code (INSEE contours) by point-in-polygon. Without coordinates the model falls back to commune level, which is much weaker in big cities.

## 4. Model
- **Target:** log(price per m²), time-adjusted. Log because errors are proportional; per m² because surface is otherwise a giant trivial feature.
- **Baseline (interpretable):** hedonic linear regression per département (log price/m² ~ surface, rooms, land, VEFA, dependencies, commune/IRIS fixed effects). This is the method behind the Notaires-INSEE index (Insee Méthodes n°132, see docs/research/state_of_the_art.md). It gives a reference error to beat.
- **Main model:** gradient boosting (LightGBM) with **quantile** objectives for P10, P50 and P90, on: lat, lon, IRIS/commune target encodings (out-of-fold to avoid leakage), commune KPIs (median €/m², yield, vacancy), surface, rooms, land, type, VEFA, dependencies, months since sale.
- **Comparables:** k nearest sales (same type, similar surface, ±18 months, by distance) shown next to the estimate. For a human, 5 real sales nearby are the most convincing explanation.

## 5. Explainability: SHAP first, LIME as a comparison
- **SHAP (TreeSHAP)** is exact and fast for tree models. Contributions add up exactly to the estimate ("base price for the area 3 100 €/m², +240 for the land, −180 for 1 room…"), and they are stable: the same property always gets the same explanation.
- **LIME** fits a local linear model on random perturbations. It is model-agnostic but unstable (two runs can disagree) and needs a sampling choice that changes the answer. Useful as a sanity check in the notebook, not in the product.
- Display: a waterfall from "typical price in this area" to "estimate for this property", in plain words, max 6 lines (group the rest as "other").

## 6. Validation (before any number reaches the UI)
- **Time split:** train on sales ≤ 2024, test on 2025–2026 (no future leakage). Also spatial CV by département.
- **Metrics:** median absolute % error (MdAPE), share of sales within ±10 % and ±20 %, P10–P90 interval coverage (must be ~80 %).
- **Acceptance:** beat the hedonic baseline and the "commune median × surface" rule on every metric, and report results per segment (big cities, rural, houses, flats). Where MdAPE is too high (e.g. < 30 sales in the area), the UI shows "not enough data" instead of a verdict.

## 7. Serving (keep the app light)
- Training runs offline in the pipeline (stage S6, after marts), a few minutes on the laptop.
- One prediction needs the model, so not a static file. Options: (a) small FastAPI endpoint on the future home server (simplest, recommended); (b) ONNX export run in the browser (no server, but a few MB to download). Decision when building.
- Comparables are pre-indexed by commune/IRIS so a query reads a few hundred rows.
- Individual DVF sales shown as comparables: `noindex`, no address beyond street level, never listed by person (DVF rules, LPF art. L112 A).

## 8. Deliverables
1. Pipeline prerequisites (§3) + tests.
2. Notebook: baseline vs LightGBM, metrics table, SHAP vs LIME on 20 example properties.
3. Stage S6 `train` + model card (data window, metrics per segment, known limits).
4. API `POST /estimate` → estimate, interval, verdict, SHAP contributions, comparables.
5. UI block used by the property dashboard (012).
