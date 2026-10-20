# CLAUDE.md

## Project
French rental-investment analytics: offline pipeline precomputes market KPIs from open data (DVF, ANIL, INSEE…); web + Expo app and browser extension read only those KPIs.

## Stack
Pipeline: Python 3.12 + uv + DuckDB (pipeline/). App: Expo SDK 58 + Expo Router + TypeScript, npm (apps/app/). See docs/TRD.md.

## Commands
- build KPIs: `cd pipeline && uv run rea build` (`--skip-ingest` to reuse downloads)
- download only: `cd pipeline && uv run rea ingest`
- test: `cd pipeline && uv run pytest -q`
- copy KPIs into the app: `cd pipeline && uv run rea sync-app`
- app dev (web): `cd apps/app && npx expo start --web` (never with CI=1: it disables file watching)
- lint: `cd apps/app && npx expo lint`
- typecheck: `cd apps/app && npx tsc --noEmit`

## Code structure
- pipeline/src/rea_pipeline: ingest (S1), refs (S0), clean (S2), marts (S3), validate (gates), cli
- data/ (gitignored): raw, clean, marts, serve (JSON for the app), runs
- apps/app/src: app/ (routes), components/, data/ (types, fetch, format, search, select); read apps/app/AGENTS.md before touching Expo APIs
- docs/KPI_SPEC.md, docs/PIPELINE_RUN_SPEC.md: what KPIs and how they're run

## Docs
| File | Read it when… |
|---|---|
| docs/PRD.md | before any new feature — what we build and why |
| docs/TRD.md | choosing a library, a service, or touching architecture/security |
| docs/APP_FLOW.md | adding or changing a screen or a user flow |
| docs/UI_UX.md | building any UI |
| docs/BACKEND_SCHEMA.md | touching the database, the API or access rules |
| PLAN.md | starting or finishing a step |
| docs/features/NNN-name/ | working on that feature (spec.md + tasks.md) |

## Working rules
- Read docs/PRD.md and PLAN.md before any new feature
- Before coding a feature, create docs/features/NNN-name/spec.md and tasks.md
- One feature at a time; propose a plan before coding
- Verify your work (tests, lint, typecheck) before saying it's done
- Don't add a dependency without asking
- Update PLAN.md and tasks.md after each step
- Secrets only in .env (never committed)

## Mistakes not to repeat
- DVF repeats the sale price on every row of a mutation: aggregate per id_mutation first.
- Source is the official DVF (data.gouv.fr API, URLs change each release); it has no mutation id: rebuilt as md5(date|nature|valeur|dept|commune|disposition). Commune codes are unpadded (971 + "2" -> 97102).
- A DVF release is a rolling window of half-years (e.g. 2021-H2 → 2026-H1): edge years are is_partial, compare them by half-year only.
- ANIL rent files are Windows-1252 (contain 'œ'), not latin-1. On Windows, write converted text with newline="" or CRLF becomes CR CR LF.
- Expo Router `<Link asChild>` throws on array styles in dev: use `<Link style={...}>` without asChild.
- Paris/Lyon/Marseille appear in DVF as arrondissement codes (751xx, 6938x, 132xx).
