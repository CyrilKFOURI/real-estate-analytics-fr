"""S3: market price KPIs M1–M4 and M6 (docs/KPI_SPEC.md §1) per geo × period × segment.

Periods: calendar years ('2025') and half-years ('2026-H1'). DVF releases cover a rolling
window that starts and ends on half-years (e.g. 2021-H2 → 2026-H1), so a year present for
only one half is flagged is_partial and gets no year-on-year change.
"""
from pathlib import Path

import duckdb

MIN_PUBLISHED_SALES = 10
TRIM_LOW, TRIM_HIGH = 0.01, 0.99

# geo_level -> column of dvf_sales holding the geo_code
GEO_LEVELS = {
    "commune": "code_commune",
    "arrondissement": "code_arrondissement",
    "departement": "code_departement",
    "region": "code_region",
    "france": "'FR'",
}


def build_price_kpis(con: duckdb.DuckDBPyConnection, run_id: str) -> None:
    """Create table kpi_price for every geo level, period and segment."""
    by_level = " UNION ALL ".join(
        f"SELECT '{level}' AS geo_level, {column} AS geo_code, * FROM dvf_sales "
        # market KPIs describe existing housing: new builds (VEFA) sell ~15–25 % dearer
        f"WHERE {column} IS NOT NULL AND NOT is_new_build"
        for level, column in GEO_LEVELS.items()
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE kpi_price AS
        WITH coverage AS (
            -- a year is complete only if the release contains both of its halves
            SELECT year, count(DISTINCT half) = 2 AS is_complete FROM dvf_sales WHERE NOT is_new_build GROUP BY year
        ),
        geo AS ({by_level}),
        periods AS (
            SELECT *, 'year' AS period_type, CAST(year AS VARCHAR) AS period FROM geo
            UNION ALL
            SELECT *, 'half', year || '-H' || half FROM geo
        ),
        bounds AS (
            -- outlier bounds per geo × period × property type (P1–P99 of €/m²)
            SELECT geo_level, geo_code, period_type, period, property_type,
                   quantile_cont(price_m2, {TRIM_LOW}) AS lo,
                   quantile_cont(price_m2, {TRIM_HIGH}) AS hi
            FROM periods GROUP BY ALL
        ),
        trimmed AS (
            SELECT p.*,
                   CASE WHEN p.rooms >= 5 THEN '5+'
                        WHEN p.rooms >= 1 THEN CAST(p.rooms AS VARCHAR)
                        ELSE 'unknown' END AS rooms_bucket
            FROM periods p
            JOIN bounds b USING (geo_level, geo_code, period_type, period, property_type)
            WHERE p.price_m2 BETWEEN b.lo AND b.hi
        ),
        segmented AS (
            SELECT geo_level, geo_code, period_type, period, year, half, property_type,
                   rooms_bucket, price_m2, price
            FROM trimmed WHERE rooms_bucket <> 'unknown'
            UNION ALL
            SELECT geo_level, geo_code, period_type, period, year, half, property_type,
                   'all', price_m2, price FROM trimmed
            UNION ALL
            SELECT geo_level, geo_code, period_type, period, year, half, 'all',
                   'all', price_m2, price FROM trimmed
        ),
        agg AS (
            SELECT geo_level, geo_code, period_type, period, year,
                   CASE WHEN period_type = 'half' THEN any_value(half) END AS half,
                   property_type, rooms_bucket,
                   count(*) AS n_sales,
                   median(price_m2) AS median_price_m2,
                   quantile_cont(price_m2, 0.25) AS p25_price_m2,
                   quantile_cont(price_m2, 0.75) AS p75_price_m2,
                   median(price) AS median_price
            FROM segmented GROUP BY geo_level, geo_code, period_type, period, year,
                                    property_type, rooms_bucket
        ),
        flagged AS (
            SELECT a.*, period_type = 'year' AND NOT c.is_complete AS is_partial
            FROM agg a JOIN coverage c USING (year)
        ),
        with_prev AS (
            -- compare with the same period one year earlier (2026-H1 vs 2025-H1)
            SELECT cur.*, prev.median_price_m2 AS prev_median, prev.is_partial AS prev_partial
            FROM flagged cur
            LEFT JOIN flagged prev
              ON prev.geo_level = cur.geo_level AND prev.geo_code = cur.geo_code
             AND prev.period_type = cur.period_type
             AND prev.property_type = cur.property_type AND prev.rooms_bucket = cur.rooms_bucket
             AND prev.year = cur.year - 1 AND prev.half IS NOT DISTINCT FROM cur.half
        )
        SELECT geo_level, geo_code, period_type, period, year, half, is_partial,
               property_type, rooms_bucket, n_sales,
               median_price_m2, p25_price_m2, p75_price_m2, median_price,
               CASE WHEN NOT is_partial AND NOT prev_partial
                    THEN median_price_m2 / prev_median - 1 END AS yoy_change,
               '{run_id}' AS run_id
        FROM with_prev
        """
    )


def export_published(con: duckdb.DuckDBPyConnection, dest: Path) -> int:
    """Write only publishable cells (n_sales >= MIN_PUBLISHED_SALES)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    query = f"SELECT * FROM kpi_price WHERE n_sales >= {MIN_PUBLISHED_SALES}"
    con.execute(
        f"COPY ({query} ORDER BY geo_level, geo_code, property_type, rooms_bucket, period_type, period) "
        f"TO '{dest.as_posix()}' (FORMAT parquet, COMPRESSION zstd)"
    )
    return con.execute(f"SELECT count(*) FROM ({query})").fetchone()[0]
