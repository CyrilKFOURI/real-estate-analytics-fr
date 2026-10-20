"""S5: publish the serve layer read by the app (docs/features/002-commune-page/spec.md).

data/serve/
  index.json                 searchable places: [code, level, name, departement, population]
  geo/<level>/<code>.json    everything about one place: socio, prices, yields
Files are written to a staging folder and swapped in at the end, so the app never reads a
half-written serve layer.
"""
import json
import shutil
from decimal import Decimal
from pathlib import Path

import duckdb

from . import paths

SEARCHABLE_LEVELS = ("commune", "arrondissement")
PRICE_FIELDS = ("period_type", "period", "is_partial", "property_type", "rooms_bucket", "n_sales",
                "median_price_m2", "p25_price_m2", "p75_price_m2", "median_price", "yoy_change")
YIELD_FIELDS = ("period", "property_type", "rooms_bucket", "rent_m2", "rent_low_m2",
                "rent_high_m2", "rent_source", "n_listings", "gross_yield", "price_to_rent_years")
SOCIO_FIELDS = ("census_year", "population", "population_growth_yearly", "dwellings",
                "vacancy_rate", "vacancy_change_pts", "second_home_share", "renter_share",
                "median_living_standard", "poverty_rate", "jobs", "jobs_growth_yearly",
                "flag_high_vacancy", "flag_population_decline")


def _rows(con: duckdb.DuckDBPyConnection, query: str, fields: tuple[str, ...]) -> dict:
    """Group query rows by (geo_level, geo_code) as compact column-ordered lists."""
    grouped: dict[tuple[str, str], list] = {}
    for level, code, *values in con.execute(query).fetchall():
        grouped.setdefault((level, code), []).append(
            [round(float(v), 5) if isinstance(v, (float, Decimal)) else v for v in values]
        )
    return grouped


def publish(con: duckdb.DuckDBPyConnection, min_sales: int, run_id: str,
            serve_dir: Path = paths.SERVE) -> dict:
    """Write the serve layer from kpi_price, kpi_yield, kpi_socio and commune_map tables."""
    prices = _rows(
        con,
        f"""SELECT geo_level, geo_code, {", ".join(PRICE_FIELDS)} FROM kpi_price
            WHERE n_sales >= {min_sales} ORDER BY property_type, rooms_bucket, period_type, period""",
        PRICE_FIELDS,
    )
    yields = _rows(
        con,
        f"""SELECT geo_level, geo_code, {", ".join(YIELD_FIELDS)} FROM kpi_yield
            WHERE n_sales >= {min_sales} ORDER BY property_type, rooms_bucket, period""",
        YIELD_FIELDS,
    )
    socio = {
        key: dict(zip(SOCIO_FIELDS, rows[0]))
        for key, rows in _rows(
            con, f"SELECT geo_level, geo_code, {', '.join(SOCIO_FIELDS)} FROM kpi_socio", SOCIO_FIELDS
        ).items()
    }
    names = {
        code: (name, departement, region)
        for code, name, departement, region in con.execute(
            "SELECT code, nom, departement, region FROM commune_map WHERE code = code_commune "
            "OR code = code_arrondissement"
        ).fetchall()
    }

    staging = serve_dir.with_name(serve_dir.name + ".next")
    shutil.rmtree(staging, ignore_errors=True)
    index = []
    sizes = []
    for level, code in sorted(prices):
        name, departement, region = names.get(code, (None, None, None))
        if level == "france":
            name = "France"
        doc = {
            "code": code,
            "level": level,
            "name": name,
            "departement": departement,
            "region": region,
            "run_id": run_id,
            "price_fields": PRICE_FIELDS,
            "prices": prices[(level, code)],
            "yield_fields": YIELD_FIELDS,
            "yields": yields.get((level, code), []),
            "socio": socio.get((level, code)),
        }
        target = staging / "geo" / level / f"{code}.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
        target.write_text(text, encoding="utf-8")
        sizes.append(len(text.encode("utf-8")))
        if level in SEARCHABLE_LEVELS and name:
            population = (doc["socio"] or {}).get("population")
            index.append([code, level, name, departement, population])

    index.sort(key=lambda item: -(item[4] or 0))  # biggest places first in search results
    (staging / "index.json").write_text(
        json.dumps({"run_id": run_id, "fields": ["code", "level", "name", "departement", "population"],
                    "places": index}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    shutil.rmtree(serve_dir, ignore_errors=True)
    staging.rename(serve_dir)
    return {"files": len(sizes), "indexed": len(index),
            "avg_kb": round(sum(sizes) / max(len(sizes), 1) / 1024, 1),
            "max_kb": round(max(sizes, default=0) / 1024, 1)}


def sync_app(app_public_data: Path, serve_dir: Path = paths.SERVE) -> None:
    """Copy the serve layer into the Expo app's public folder (served statically on web)."""
    shutil.rmtree(app_public_data, ignore_errors=True)
    shutil.copytree(serve_dir, app_public_data)
