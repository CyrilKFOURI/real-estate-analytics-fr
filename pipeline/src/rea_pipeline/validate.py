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
               WHERE geo_level = 'commune' AND geo_code = ? AND period_type = 'year'
                 AND period = CAST(? AS VARCHAR) AND property_type = 'apartment' AND rooms_bucket = 'all'""",
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
    columns = {row[0] for row in con.execute(
        f"DESCRIBE SELECT * FROM '{previous_marts.as_posix()}'").fetchall()}
    if "period_type" not in columns:
        return [("national drift", True, "previous run has the old schema, not comparable")]
    query = """SELECT median(median_price_m2) FROM {src}
               WHERE geo_level = 'departement' AND period_type = 'year' AND NOT is_partial
                 AND property_type = 'all' AND rooms_bucket = 'all'"""
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


# Gross yield bands (12 × asking rent / median price) for apartments, latest full year.
# Paris is known for ~3–4.5 %, the national figure for ~5–7 %.
YIELD_BANDS = {
    ("commune", "75056"): (0.025, 0.05),
    ("france", "FR"): (0.04, 0.09),
}
MIN_RENT_COVERAGE = 0.95


def check_yields(con: duckdb.DuckDBPyConnection) -> list[Check]:
    latest = con.execute(
        "SELECT max(period) FROM kpi_yield WHERE period_type = 'year' AND period IN "
        "(SELECT period FROM kpi_price WHERE period_type = 'year' AND NOT is_partial)"
    ).fetchone()[0]
    if latest is None:
        return [("yield period", False, "no complete year matches the rent edition")]
    checks = []
    for (level, code), (low, high) in YIELD_BANDS.items():
        row = con.execute(
            """SELECT gross_yield FROM kpi_yield WHERE geo_level = ? AND geo_code = ?
               AND period = ? AND property_type = 'apartment' AND rooms_bucket = 'all'""",
            [level, code, latest],
        ).fetchone()
        ok = row is not None and low <= row[0] <= high
        detail = "missing" if row is None else f"yield={row[0]:.2%} band=[{low:.1%},{high:.1%}]"
        checks.append((f"yield {code} {latest}", ok, detail))
    # share of published commune price cells that found a rent
    coverage = con.execute(
        f"""SELECT count(y.geo_code)::DOUBLE / count(*) FROM kpi_price p
            LEFT JOIN kpi_yield y USING (geo_level, geo_code, period, property_type, rooms_bucket)
            WHERE p.geo_level = 'commune' AND p.period = '{latest}' AND p.n_sales >= 10
              -- ANIL publishes rents by rooms for apartments only
              AND (p.property_type = 'apartment' OR (p.property_type = 'house' AND p.rooms_bucket = 'all'))"""
    ).fetchone()[0]
    checks.append(("rent coverage", coverage >= MIN_RENT_COVERAGE, f"{coverage:.1%} of commune cells"))
    return checks
