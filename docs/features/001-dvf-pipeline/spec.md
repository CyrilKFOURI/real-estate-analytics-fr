# 001 — DVF pipeline to per-commune price KPIs

## User stories
- As the developer, I run one command and get per-commune price KPIs (M1–M6) from the latest geo-DVF release.
- As the developer, I can trust the numbers because they're validated against a reference.

## Acceptance criteria
- GIVEN no local data WHEN `just build dvf` runs THEN raw files + manifest (URL, sha256) are in data/raw/dvf/<release>/.
- GIVEN an unchanged upstream release WHEN ingest runs again THEN nothing is re-downloaded.
- GIVEN raw DVF WHEN clean runs THEN each id_mutation appears once, only single-dwelling 'Vente' kept, merged communes remapped, 57/67/68/976 flagged no_data.
- GIVEN clean data WHEN marts run THEN data/marts/dvf_commune.parquet has M1–M6 per commune × year × segment, with n, run_id.
- GIVEN marts WHEN validation runs THEN cells with n<10 are excluded and Paris/Lyon/Marseille medians are within 5% of explore.data.gouv.fr, else the run fails and serve/ is untouched.
- Unit tests cover the cleaning rules on a small fixture CSV.
