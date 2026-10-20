"""S3: market price KPIs M1–M4 and M6 (docs/KPI_SPEC.md §1) per geo × year × segment."""
from pathlib import Path

import duckdb

MIN_PUBLISHED_SALES = 10
TRIM_LOW, TRIM_HIGH = 0.01, 0.99

# geo_level -> column of dvf_sales holding the geo_code
GEO_LEVELS = {
    "commune": "code_commune",
    "arrondissement": "code_arrondissement",
    "departement": "code_departement",
}


def build_price_kpis(con: duckdb.DuckDBPyConnection, run_id: str) -> None:
    """Create table kpi_price for every geo level and segment."""
    by_level = " UNION ALL ".join(
        f"SELECT '{level}' AS geo_level, {column} AS geo_code, * FROM dvf_sales "
        f"WHERE {column} IS NOT NULL"
        for level, column in GEO_LEVELS.items()
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE kpi_price AS
        WITH geo AS ({by_level}),
        bounds AS (
            -- outlier bounds per geo × year × property type (P1–P99 of €/m²)
            SELECT geo_level, geo_code, year, property_type,
                   quantile_cont(price_m2, {TRIM_LOW}) AS lo,
                   quantile_cont(price_m2, {TRIM_HIGH}) AS hi
            FROM geo GROUP BY ALL
        ),
        trimmed AS (
            SELECT g.*,
                   CASE WHEN g.rooms >= 5 THEN '5+'
                        WHEN g.rooms >= 1 THEN CAST(g.rooms AS VARCHAR)
                        ELSE 'unknown' END AS rooms_bucket
            FROM geo g JOIN bounds b USING (geo_level, geo_code, year, property_type)
            WHERE g.price_m2 BETWEEN b.lo AND b.hi
        ),
        segmented AS (
            SELECT geo_level, geo_code, year, property_type, rooms_bucket, price_m2, price
            FROM trimmed WHERE rooms_bucket <> 'unknown'
            UNION ALL
            SELECT geo_level, geo_code, year, property_type, 'all', price_m2, price FROM trimmed
            UNION ALL
            SELECT geo_level, geo_code, year, 'all', 'all', price_m2, price FROM trimmed
        ),
        agg AS (
            SELECT geo_level, geo_code, year, property_type, rooms_bucket,
                   count(*) AS n_sales,
                   median(price_m2) AS median_price_m2,
                   quantile_cont(price_m2, 0.25) AS p25_price_m2,
                   quantile_cont(price_m2, 0.75) AS p75_price_m2,
                   median(price) AS median_price
            FROM segmented GROUP BY ALL
        ),
        with_prev AS (
            SELECT *,
                   lag(median_price_m2) OVER w AS prev_median,
                   lag(year) OVER w AS prev_year
            FROM agg
            WINDOW w AS (PARTITION BY geo_level, geo_code, property_type, rooms_bucket ORDER BY year)
        )
        SELECT geo_level, geo_code, year, property_type, rooms_bucket, n_sales,
               median_price_m2, p25_price_m2, p75_price_m2, median_price,
               -- YoY only between consecutive years
               CASE WHEN prev_year = year - 1 THEN median_price_m2 / prev_median - 1 END AS yoy_change,
               '{run_id}' AS run_id
        FROM with_prev
        """
    )


def export_published(con: duckdb.DuckDBPyConnection, dest: Path) -> int:
    """Write only publishable cells (n_sales >= MIN_PUBLISHED_SALES)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    query = f"SELECT * FROM kpi_price WHERE n_sales >= {MIN_PUBLISHED_SALES}"
    con.execute(
        f"COPY ({query} ORDER BY geo_level, geo_code, property_type, rooms_bucket, year) "
        f"TO '{dest.as_posix()}' (FORMAT parquet, COMPRESSION zstd)"
    )
    return con.execute(f"SELECT count(*) FROM ({query})").fetchone()[0]
