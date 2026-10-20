# Pipeline Run Specification — how, when and in what order KPIs are generated

Principle: **heavy work runs offline on the laptop (later the home server); the app only reads small precomputed KPI files.**
Raw ≈ 25–45 GB → clean ≈ 3–5 GB → served aggregates ≈ 150–300 MB (see `research/data_sources.md`).

## 1. Layers

| Layer | Path | Format | Kept? | Content |
|---|---|---|---|---|
| raw | `data/raw/<source>/<release>/` | as downloaded (csv.gz, zip) | last release only, gitignored | untouched files + `manifest.json` (URL, sha256, date) |
| clean | `data/clean/<source>/` | Parquet, partitioned by `dep` | yes, gitignored | typed, deduplicated, filtered rows |
| marts | `data/marts/` | Parquet | yes | KPI tables (one row per geo × period × segment) |
| serve | `data/serve/` | **SQLite** (API) + **static JSON/PMTiles** per commune (CDN) | published | only what the app reads |

Engine: **Python + DuckDB** (SQL on Parquet, out-of-core, fits 32 GB RAM). Polars allowed for transforms. No Spark.

## 2. Stages (DAG) — each stage only starts when its inputs passed validation

```
S0 refs      COG communes + merges, IRIS, departements           (yearly, January)
   │
S1 ingest    download → raw + manifest (idempotent: skip if sha256 unchanged)
   │
S2 clean     per source → data/clean          ─┐ validation gate V1
   │                                            │
S3 marts     M1–M7 (DVF)   M8 (ANIL)   M11–M13 (INSEE)   M14 (DPE)   M15 (REI)
   │         ── independent, can run in parallel ──
S4 derived   M9, M10, M17   (need S3 DVF + ANIL + INSEE done)   ─ validation gate V2
   │
S5 publish   build SQLite + JSON/PMTiles → atomic swap (write to new file, then rename)
```

Order is enforced by the runner (`make`/`just` targets or a tiny Python DAG with Prefect-free plain functions); a stage refuses to run if its upstream `_SUCCESS` marker for the same `run_id` is missing.

## 3. DVF cleaning rules (S2) — mandatory
1. Keep `nature_mutation = 'Vente'` (and VEFA flagged separately).
2. Group by `id_mutation`; price is repeated per row → take it **once**.
3. Keep mutations with exactly **one** residential lot (Appartement/Maison), dependencies allowed; drop multi-dwelling sales from €/m² KPIs.
4. Drop `surface_reelle_bati < 9` m², price < 1 000 €, €/m² outside commune P1–P99.
5. Remap merged communes to current COG code (S0).
6. Mark Bas-Rhin, Haut-Rhin, Moselle, Mayotte as `no_data` (not zero).

## 4. Schedules

| Source | Upstream cadence | Our run | Mode |
|---|---|---|---|
| geo-DVF | April + October | within 2 weeks of release | **full rebuild of all years** (releases rewrite history) |
| ANIL carte des loyers | yearly | on release | full, edition stored as `vintage` (not comparable YoY) |
| INSEE pop / logement / Filosofi | yearly | on release | full |
| DPE ADEME | continuous | monthly | incremental by `date_etablissement` |
| REI / OFGL | yearly | on release | full |
| Banque de France rates | monthly | monthly | append (feeds simulator defaults) |
| COG | yearly (Jan) | January | full, then re-run S2+ |

A weekly check job only polls upstream metadata (data.gouv.fr API `last_modified`) and triggers S1 if changed. On the laptop: Windows Task Scheduler; later the home server: cron/systemd timer.

## 5. Validation gates
- **V1 (clean):** row counts within ±20% of previous release per department; no null `code_commune`; sha256 logged.
- **V2 (marts):** national median €/m² within ±10% of previous run; Paris/Lyon/Marseille medians within 5% of explore.data.gouv.fr; no KPI cell with `n < 10` published.
- Failure → stop, keep previous `serve/` live, write report to `data/runs/<run_id>/report.md`.

## 6. Run commands (target)
```
just refs           # S0
just ingest dvf     # S1 for one source
just build          # S1→S5 for all sources whose upstream changed
just build --full   # force full rebuild
just validate       # V1 + V2 only
just publish        # S5 only, from existing marts
```
First full run estimate on the laptop: ~30–60 min (DVF ≈ 1 GB gz, DPE the slowest). Disk: reserve ~60 GB (CLAUDE.md says ~281 GB free — recheck before).

## 7. Run metadata
Every run writes `data/runs/<run_id>/manifest.json`: sources + releases + sha256, code git hash, rules config version, row counts, duration. Each served KPI row carries `run_id` → full traceability.
