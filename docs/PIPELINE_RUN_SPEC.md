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

Order is enforced by `rea build`, which runs stages sequentially in one process and stops at the first failed gate.

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
| DVF official (DGFiP, data.gouv.fr API) | April + October | within 2 weeks of release | **full rebuild of all files** (releases rewrite history; window = 5 years by half-years, e.g. 2021-H2 → 2026-H1). Chosen over geo-DVF, which lags the official release by weeks |
| ANIL carte des loyers | yearly | on release | full, edition stored as `vintage` (not comparable YoY) |
| INSEE Comparateur de territoires (pop, logement, Filosofi, emploi) | yearly | on release (ETag check) | full |
| DPE ADEME | continuous | monthly | incremental by `date_etablissement` |
| REI / OFGL | yearly | on release | full |
| Banque de France rates | monthly | monthly | append (feeds simulator defaults) |
| COG | yearly (Jan) | January | full, then re-run S2+ |

A weekly job runs `uv run rea auto` (script `pipeline/scripts/auto_update.ps1`, log `data/runs/auto.log`): it re-downloads only what changed (ETag, or SHA-256 when the server sends none), rebuilds S0→S5 only if a source changed, then refreshes the app data. Up to date = ~15 s, no download.

Register it on the laptop (Windows Task Scheduler, Sunday 03:00), from PowerShell:
```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\cyril\Documents\2_Projects\23_Real_Estate_App\pipeline\scripts\auto_update.ps1"'
Register-ScheduledTask -TaskName "RealEstateApp-auto-update" -Action $action -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am) -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable)
```
On the future home server: a cron/systemd timer running the same command.

## 5. Validation gates
- **V1 (clean):** row counts within ±20% of previous release per department; no null `code_commune`; sha256 logged.
- **V2 (marts):** national median €/m² within ±10% of previous run; Paris/Lyon/Marseille medians within 5% of explore.data.gouv.fr; no KPI cell with `n < 10` published.
- Failure → stop, keep previous `serve/` live, write report to `data/runs/<run_id>/report.md`.

## 6. Run commands (target)
```
cd pipeline
uv run rea ingest              # S1: refs + DVF, skipped when upstream ETag unchanged
uv run rea build               # S0→S1→S2→V1→S3→V2→publish (implemented for DVF)
uv run rea build --skip-ingest # rebuild from files already downloaded
uv run rea publish             # S5 only: rebuild data/serve (JSON + ranking.json) from the published marts
uv run rea sync-app            # copy data/serve into the app
uv run rea clean-runs          # delete reports of failed runs
```
First full run estimate on the laptop: ~30–60 min (DVF ≈ 1 GB gz, DPE the slowest). Disk: reserve ~60 GB (CLAUDE.md says ~281 GB free — recheck before).

## 7. Run metadata
Every run writes `data/runs/<run_id>/manifest.json`: sources + releases + sha256, code git hash, rules config version, row counts, duration. Each served KPI row carries `run_id` → full traceability.

## 8. Periods
KPIs are computed per calendar year (`period_type='year'`) and per half-year (`'half'`, e.g. `2026-H1`). A year with only one half in the release is `is_partial` and has no YoY; half-years compare with the same half one year earlier.
