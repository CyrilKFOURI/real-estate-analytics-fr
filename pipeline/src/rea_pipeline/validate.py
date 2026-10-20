"""Validation gates (docs/PIPELINE_RUN_SPEC.md §5). Each check returns (name, ok, detail)."""
from pathlib import Path

import duckdb

# Sanity bands for apartment median €/m² at commune level, from public figures
# (explore.data.gouv.fr / notaires). Generous on purpose: they catch pipeline bugs
# (double counting, wrong units), not market moves. Refine once compared side by side.
REFERENCE_BANDS = {
    ("75056", 2024): (8_500, 11_500),  # Paris
    ("69123", 2024): (4_000, 5_800),  # Lyon
    ("13055", 2024): (3_000, 4_500),  # Marseille
}
MAX_NATIONAL_DRIFT = 0.10

Check = tuple[str, bool, str]


def check_reference_bands(con: duckdb.DuckDBPyConnection) -> list[Check]:
    checks = []
    for (code, year), (low, high) in REFERENCE_BANDS.items():
        row = con.execute(
            """SELECT median_price_m2, n_sales FROM kpi_price
               WHERE geo_level = 'commune' AND geo_code = ? AND year = ?
                 AND property_type = 'apartment' AND rooms_bucket = 'all'""",
            [code, year],
        ).fetchone()
        if row is None:
            checks.append((f"band {code} {year}", False, "missing"))
            continue
        median, n = row
        checks.append(
            (f"band {code} {year}", low <= median <= high, f"median={median:.0f} n={n} band=[{low},{high}]")
        )
    return checks


def check_national_drift(con: duckdb.DuckDBPyConnection, previous_marts: Path | None) -> list[Check]:
    if previous_marts is None or not previous_marts.exists():
        return [("national drift", True, "no previous run to compare")]
    query = """SELECT median(median_price_m2) FROM {src}
               WHERE geo_level = 'departement' AND property_type = 'all' AND rooms_bucket = 'all'"""
    current = con.execute(query.format(src="kpi_price")).fetchone()[0]
    previous = con.execute(query.format(src=f"'{previous_marts.as_posix()}'")).fetchone()[0]
    drift = abs(current / previous - 1)
    return [("national drift", drift <= MAX_NATIONAL_DRIFT, f"drift={drift:.1%}")]


def check_clean(con: duckdb.DuckDBPyConnection) -> list[Check]:
    duplicates = con.execute(
        "SELECT count(*) - count(DISTINCT id_mutation) FROM dvf_sales"
    ).fetchone()[0]
    null_communes = con.execute(
        "SELECT count(*) FROM dvf_sales WHERE code_commune IS NULL"
    ).fetchone()[0]
    return [
        ("one row per mutation", duplicates == 0, f"duplicates={duplicates}"),
        ("no null commune", null_communes == 0, f"nulls={null_communes}"),
    ]
