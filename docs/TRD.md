# TRD

## Stack
- **Data pipeline:** Python 3.12, DuckDB, Polars, `uv` for envs and the `rea` CLI as task runner. Pytest.
- **API:** small read-only service (FastAPI or Cloudflare Worker) over the SQLite serve DB. Decision deferred to slice 2.
- **Web + mobile:** one TypeScript app with npm for now (`apps/app`; a pnpm/Turborepo monorepo only when core-kpi and the extension exist): **Expo (React Native) with Expo Router**, web via `react-native-web`, so one codebase gives the site now and the phone app later. Maps: MapLibre (web) / MapLibre RN (mobile) with PMTiles.
- **Shared logic:** `packages/core-kpi` — pure TS functions for all deal KPIs (D1–D17) + rules config, unit-tested, used by app and extension.
- **Browser extension (V2):** WXT (Chrome + Firefox), reuses `core-kpi`.

## Architecture
```
 [open data] ──S1..S5 offline pipeline (laptop → home server)──▶ data/serve
                                                                   │
              SQLite (API: filters, rankings)   static JSON + PMTiles (CDN: map, commune pages)
                          │                                │
                          └──────────── apps/app (Expo web + mobile) ◀── core-kpi (deal KPIs, on device)
                                                          ▲
                                     apps/extension ──────┘ (reads listing page, calls API)
```
Why it stays light: the client never touches raw data; a commune page = 1 JSON (~5–20 KB); deal KPIs are pure functions computed instantly on device; no server compute per request beyond indexed SQLite reads.

Repo layout:
```
pipeline/        Python: sources/, clean/, marts/, publish/, tests/
config/          fr_rules_2026.yaml, kpi_weights.yaml
packages/core-kpi
apps/app         Expo (web + iOS/Android)
apps/extension   WXT (V2)
data/            gitignored (raw, clean, marts, serve, runs)
docs/
```
Full run order and schedules: `docs/PIPELINE_RUN_SPEC.md`. KPI definitions: `docs/KPI_SPEC.md`.

## External services / APIs
data.gouv.fr (geo-DVF, ANIL loyers, INSEE, DPE, REI), BAN geocoding API (address search), Banque de France Webstat. Hosting target: Cloudflare Pages + R2 (static + PMTiles) < 5 €/month.

## Security & auth
MVP has no accounts; simulations stored locally on device. DVF legal rules: no re-identification, no search-engine indexing of individual sales (`noindex`, robots.txt). Extension never stores or uploads listing content.

## Constraints
Solo dev; laptop 32 GB RAM / 1 TB SSD (reserve ~60 GB); DVF excludes 57/67/68/976; DVF releases rewrite history → full rebuilds; KPIs with n < 10 hidden.
