"""ANIL / DHUP "Carte des loyers": asking rents per m² (charges included) by commune.

S1 ingest of the latest edition + S3 marts M8 (rent €/m²), M9 (gross yield) and M10
(price-to-rent ratio) — docs/KPI_SPEC.md §1.

Only the latest edition is used: ANIL states editions are not comparable over time. Rents
apply to listings of the edition's year, so yields are only paired with price periods from
that year onwards.
"""
import re
from pathlib import Path

import duckdb
import httpx

from . import paths
from .ingest import download

DATASET_SEARCH_API = "https://www.data.gouv.fr/api/1/datasets/?q=carte%20des%20loyers&page_size=20"
SLUG = re.compile(r"^carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-(\d{4})$")
RENTS_DIR = paths.RAW / "rents"
# Below this median €/m² a "market" is made of non-market sales (shares of undivided property,
# ruins): a yield would be meaningless (Sainte-Rose, Guadeloupe: 142 €/m² -> 104 %).
MIN_PLAUSIBLE_PRICE_M2 = 300

# ANIL file stem -> (property_type, rooms buckets of kpi_price it applies to)
SEGMENTS = {
    "pred-app-mef-dhup": ("apartment", ["all"]),
    "pred-app12-mef-dhup": ("apartment", ["1", "2"]),
    "pred-app3-mef-dhup": ("apartment", ["3", "4", "5+"]),
    "pred-mai-mef-dhup": ("house", ["all"]),
}


def _latest_edition(client: httpx.Client) -> tuple[int, list[dict]]:
    response = client.get(DATASET_SEARCH_API)
    response.raise_for_status()
    editions = {
        int(match.group(1)): dataset
        for dataset in response.json()["data"]
        if (match := SLUG.match(dataset["slug"]))
    }
    year = max(editions)
    return year, [r for r in editions[year]["resources"] if r["format"] == "csv"]


def ingest_rents() -> dict:
    with httpx.Client(follow_redirects=True, timeout=120) as client:
        year, resources = _latest_edition(client)
        files = {}
        for resource in resources:
            stem = resource["url"].rsplit("/", 1)[-1].removesuffix(".csv")
            if stem in SEGMENTS:
                files[stem] = download(resource["url"], RENTS_DIR / str(year) / f"{stem}.csv", client)
    missing = set(SEGMENTS) - set(files)
    if missing:
        raise RuntimeError(f"rent edition {year} is missing files: {sorted(missing)}")
    (RENTS_DIR / "edition.txt").write_text(str(year))
    return {"edition": year, "files": files}


def edition() -> int:
    return int((RENTS_DIR / "edition.txt").read_text())


def _as_utf8(path: Path) -> Path:
    """ANIL files are Windows-1252 (they contain 'œ', which latin-1 lacks): convert once."""
    target = path.with_name(path.stem + ".utf8.csv")
    if not target.exists() or target.stat().st_mtime < path.stat().st_mtime:
        target.write_text(path.read_bytes().decode("cp1252"), encoding="utf-8", newline="")
    return target


def load_rents(con: duckdb.DuckDBPyConnection, directory: Path, vintage: int) -> None:
    """Create table rent_commune(code, property_type, rooms_bucket, rent_m2, rent_low_m2,
    rent_high_m2, rent_source, n_listings, vintage). `code` is the INSEE code of the file:
    a commune, or an arrondissement for Paris/Lyon/Marseille."""
    selects = []
    for stem, (property_type, buckets) in SEGMENTS.items():
        bucket_list = ", ".join(f"'{b}'" for b in buckets)
        selects.append(
            f"""
            SELECT INSEE_C AS code, '{property_type}' AS property_type,
                   unnest([{bucket_list}]) AS rooms_bucket,
                   CAST(replace(loypredm2, ',', '.') AS DOUBLE) AS rent_m2,
                   CAST(replace("lwr.IPm2", ',', '.') AS DOUBLE) AS rent_low_m2,
                   CAST(replace("upr.IPm2", ',', '.') AS DOUBLE) AS rent_high_m2,
                   -- 'commune': estimated from the commune's own listings;
                   -- 'maille': borrowed from a group of neighbouring communes
                   TYPPRED AS rent_source,
                   CAST(nbobs_com AS INTEGER) AS n_listings,
                   {vintage} AS vintage
            FROM read_csv('{_as_utf8(directory / f"{stem}.csv").as_posix()}', delim = ';',
                          header = true, all_varchar = true)
            """
        )
    con.execute(f"CREATE OR REPLACE TABLE rent_commune AS {' UNION ALL '.join(selects)}")


def build_yield_kpis(con: duckdb.DuckDBPyConnection) -> None:
    """Create table kpi_yield from rent_commune + kpi_price + commune_map.

    Rents are rolled up to every geo level of kpi_price:
    - arrondissement: as published;
    - commune: as published, or for Paris/Lyon/Marseille the listing-weighted mean of
      their arrondissements;
    - departement / region / france: mean of commune rents weighted by that commune's
      number of sales in the segment (where the investable stock is).
    """
    con.execute(
        """
        CREATE OR REPLACE TABLE rent_geo AS
        WITH located AS (
            SELECT r.*, m.code_commune, m.code_arrondissement, m.departement, m.region
            FROM rent_commune r JOIN commune_map m ON m.code = r.code
        ),
        arrondissements AS (
            SELECT 'arrondissement' AS geo_level, code_arrondissement AS geo_code, property_type,
                   rooms_bucket, rent_m2, rent_low_m2, rent_high_m2, rent_source, n_listings, vintage
            FROM located WHERE code_arrondissement IS NOT NULL
        ),
        communes AS (
            SELECT 'commune' AS geo_level, code_commune AS geo_code, property_type, rooms_bucket,
                   sum(rent_m2 * greatest(n_listings, 1)) / sum(greatest(n_listings, 1)) AS rent_m2,
                   sum(rent_low_m2 * greatest(n_listings, 1)) / sum(greatest(n_listings, 1)) AS rent_low_m2,
                   sum(rent_high_m2 * greatest(n_listings, 1)) / sum(greatest(n_listings, 1)) AS rent_high_m2,
                   CASE WHEN bool_and(rent_source = 'commune') THEN 'commune' ELSE 'maille' END AS rent_source,
                   sum(n_listings) AS n_listings, any_value(vintage) AS vintage
            FROM located GROUP BY ALL
        ),
        weights AS (
            SELECT geo_code AS code_commune, property_type, rooms_bucket, sum(n_sales) AS w
            FROM kpi_price WHERE geo_level = 'commune' AND period_type = 'year'
            GROUP BY ALL
        ),
        weighted AS (
            SELECT c.*, m.departement, m.region, coalesce(w.w, 0) AS w
            FROM communes c
            JOIN commune_map m ON m.code = c.geo_code
            LEFT JOIN weights w ON w.code_commune = c.geo_code
              AND w.property_type = c.property_type AND w.rooms_bucket = c.rooms_bucket
            WHERE c.geo_code IN (SELECT code FROM commune_map WHERE code = code_commune)
        ),
        higher AS (
            SELECT level AS geo_level, code AS geo_code, property_type, rooms_bucket,
                   sum(rent_m2 * w) / sum(w) AS rent_m2,
                   sum(rent_low_m2 * w) / sum(w) AS rent_low_m2,
                   sum(rent_high_m2 * w) / sum(w) AS rent_high_m2,
                   'aggregate' AS rent_source, sum(n_listings) AS n_listings,
                   any_value(vintage) AS vintage
            FROM (
                SELECT 'departement' AS level, departement AS code, * FROM weighted
                UNION ALL SELECT 'region', region, * FROM weighted
                UNION ALL SELECT 'france', 'FR', * FROM weighted
            )
            WHERE w > 0
            GROUP BY level, code, property_type, rooms_bucket
        )
        SELECT * FROM arrondissements
        UNION ALL SELECT * FROM communes
        UNION ALL SELECT * FROM higher
        """
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE kpi_yield AS
        SELECT p.geo_level, p.geo_code, p.period_type, p.period, p.property_type, p.rooms_bucket,
               p.n_sales, p.median_price_m2,
               r.rent_m2, r.rent_low_m2, r.rent_high_m2, r.rent_source, r.n_listings,
               r.vintage AS rent_vintage,
               12 * r.rent_m2 / p.median_price_m2 AS gross_yield,
               p.median_price_m2 / (12 * r.rent_m2) AS price_to_rent_years,
               p.run_id
        FROM kpi_price p
        JOIN rent_geo r USING (geo_level, geo_code, property_type, rooms_bucket)
        -- a rent edition describes its own year: never pair it with older prices
        WHERE p.year >= r.vintage
          AND p.median_price_m2 >= {MIN_PLAUSIBLE_PRICE_M2}
        """
    )


def export_published(con: duckdb.DuckDBPyConnection, dest: Path, min_sales: int) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    query = f"SELECT * FROM kpi_yield WHERE n_sales >= {min_sales}"
    con.execute(
        f"COPY ({query} ORDER BY geo_level, geo_code, property_type, rooms_bucket, period) "
        f"TO '{dest.as_posix()}' (FORMAT parquet, COMPRESSION zstd)"
    )
    return con.execute(f"SELECT count(*) FROM ({query})").fetchone()[0]
