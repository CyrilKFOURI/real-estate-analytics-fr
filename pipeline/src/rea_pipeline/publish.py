"""S5: publish the serve layer read by the app (docs/features/002-commune-page/spec.md).

data/serve/
  index.json                 searchable places: [code, level, name, departement, population]
  geo/<level>/<code>.json    everything about one place: socio, prices, yields, local tax,
                             energy (DPE), rent control, market score, price bands
  ranking.json               communes/arrondissements with yield, score and risk fields
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
                "median_price_m2", "p25_price_m2", "p75_price_m2", "median_price", "yoy_change",
                "median_surface_m2", "cagr", "cagr_since")
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


DPE_FIELDS = ("n_dpe", "share_a", "share_b", "share_c", "share_d", "share_e", "share_f", "share_g", "share_fg")


def _has_table(con: duckdb.DuckDBPyConnection, table: str) -> bool:
    return con.execute(
        "SELECT count(*) FROM information_schema.tables WHERE table_name = ?", [table]
    ).fetchone()[0] > 0


def _columns(con: duckdb.DuckDBPyConnection, table: str) -> set[str]:
    return {row[0] for row in con.execute(f"DESCRIBE {table}").fetchall()}


def _select(con: duckdb.DuckDBPyConnection, table: str, fields: tuple[str, ...]) -> str:
    """Select list for `fields`, NULL for columns an older table does not have yet."""
    existing = _columns(con, table)
    return ", ".join(f if f in existing else f"NULL AS {f}" for f in fields)


def _extras(con: duckdb.DuckDBPyConnection) -> dict[tuple[str, str], dict]:
    """Optional per-place blocks from the newer KPI tables (absent tables are skipped)."""
    extras: dict[tuple[str, str], dict] = {}

    def put(key, name, value):
        extras.setdefault(key, {})[name] = value

    if _has_table(con, "kpi_local_tax"):
        for level, code, year, rate in con.execute(
            "SELECT geo_level, geo_code, tax_year, tfpb_rate FROM kpi_local_tax"
        ).fetchall():
            put((level, code), "local_tax", {"tax_year": year, "tfpb_rate": round(rate, 5)})
    if _has_table(con, "kpi_dpe"):
        for level, code, *values in con.execute(
            f"SELECT geo_level, geo_code, {', '.join(DPE_FIELDS)} FROM kpi_dpe WHERE n_dpe >= 10"
        ).fetchall():
            put((level, code), "energy",
                {f: (round(v, 5) if isinstance(v, float) else v) for f, v in zip(DPE_FIELDS, values)})
    if _has_table(con, "rent_control"):
        for (code,) in con.execute("SELECT code FROM rent_control").fetchall():
            for level in ("commune", "arrondissement"):
                put((level, code), "rent_control", True)
    if _has_table(con, "kpi_score"):
        for level, code, period, ptype, score, n, strengths, weaknesses, rti in con.execute(
            "SELECT geo_level, geo_code, period, property_type, score, n_criteria, strengths, weaknesses, "
            "rent_to_income FROM kpi_score"
        ).fetchall():
            extras.setdefault((level, code), {}).setdefault("score", {})[ptype] = {
                "period": period, "score": score, "n_criteria": n, "strengths": strengths,
                "weaknesses": weaknesses, "rent_to_income": None if rti is None else round(rti, 4)}
    if _has_table(con, "kpi_price_bands"):
        for level, code, year, ptype, band, share, n in con.execute(
            """WITH latest AS (SELECT max(year) AS y FROM kpi_price WHERE period_type = 'year' AND NOT is_partial)
               SELECT geo_level, geo_code, year, property_type, band, share, n_sales
               FROM kpi_price_bands, latest WHERE year = latest.y AND n_sales >= 10
               ORDER BY geo_level, geo_code, property_type, band_order"""
        ).fetchall():
            bands = extras.setdefault((level, code), {}).setdefault("price_bands", {"year": year})
            bands.setdefault(ptype, {"n_sales": n, "bands": []})["bands"].append([band, round(share, 4)])
    return extras


def publish(con: duckdb.DuckDBPyConnection, min_sales: int, run_id: str,
            serve_dir: Path = paths.SERVE) -> dict:
    """Write the serve layer from kpi_price, kpi_yield, kpi_socio and commune_map tables."""
    prices = _rows(
        con,
        f"""SELECT geo_level, geo_code, {_select(con, "kpi_price", PRICE_FIELDS)} FROM kpi_price
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
    extras = _extras(con)
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
            **extras.get((level, code), {}),
        }
        target = staging / "geo" / level / f"{code}.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(doc, ensure_ascii=False, separators=(",", ":"), default=float)  # DuckDB DECIMAL
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
    ranking = _write_ranking(con, staging / "ranking.json", run_id)
    shutil.rmtree(serve_dir, ignore_errors=True)
    staging.rename(serve_dir)
    return {"files": len(sizes), "indexed": len(index), "ranked": ranking,
            "avg_kb": round(sum(sizes) / max(len(sizes), 1) / 1024, 1),
            "max_kb": round(max(sizes, default=0) / 1024, 1)}


# A ranking is only meaningful on stable medians: stricter than the n >= 10 publication rule.
RANKING_MIN_SALES = 30
RANKING_FIELDS = ("code", "level", "name", "departement", "region", "property_type", "n_sales",
                  "median_price_m2", "yoy_change", "rent_m2", "rent_source", "gross_yield", "population",
                  "population_growth_yearly", "vacancy_rate", "flag_high_vacancy", "flag_population_decline",
                  "cagr", "score", "share_fg", "tfpb_rate", "rent_control")


def _write_ranking(con: duckdb.DuckDBPyConnection, dest: Path, run_id: str) -> int:
    """Communes and arrondissements with a yield for the latest complete year, all rooms,
    apartments and houses: one compact file the app filters and sorts on device."""
    joins = []
    cagr = "round(p.cagr, 4)" if "cagr" in _columns(con, "kpi_price") else "NULL"
    score = share_fg = tfpb_rate = rent_control = "NULL"
    if _has_table(con, "kpi_score"):
        joins.append("LEFT JOIN kpi_score sc ON sc.geo_level = y.geo_level AND sc.geo_code = y.geo_code "
                     "AND sc.property_type = y.property_type")
        score = "sc.score"
    if _has_table(con, "kpi_dpe"):
        joins.append("LEFT JOIN kpi_dpe d ON d.geo_level = y.geo_level AND d.geo_code = y.geo_code")
        share_fg = "round(d.share_fg, 4)"
    if _has_table(con, "kpi_local_tax"):
        joins.append("LEFT JOIN kpi_local_tax t ON t.geo_level = y.geo_level AND t.geo_code = y.geo_code")
        tfpb_rate = "round(t.tfpb_rate, 4)"
    if _has_table(con, "rent_control"):
        rent_control = "y.geo_code IN (SELECT code FROM rent_control)"
    joins = "\n        ".join(joins)
    rows = con.execute(
        f"""
        WITH latest AS (
            SELECT max(period) AS latest_period FROM kpi_price WHERE period_type = 'year' AND NOT is_partial
        )
        SELECT y.geo_code, y.geo_level, m.nom, m.departement, m.region, y.property_type, y.n_sales,
               round(p.median_price_m2), round(p.yoy_change, 4), round(y.rent_m2, 2), y.rent_source,
               round(y.gross_yield, 4), s.population, round(s.population_growth_yearly, 4),
               round(s.vacancy_rate, 4), s.flag_high_vacancy, s.flag_population_decline,
               {cagr}, {score}, {share_fg}, {tfpb_rate}, {rent_control}
        FROM kpi_yield y
        JOIN latest ON y.period = latest.latest_period
        JOIN kpi_price p USING (geo_level, geo_code, period_type, period, property_type, rooms_bucket)
        JOIN commune_map m ON m.code = y.geo_code
        LEFT JOIN kpi_socio s ON s.geo_level = y.geo_level AND s.geo_code = y.geo_code
        {joins}
        WHERE y.geo_level IN ('commune', 'arrondissement') AND y.rooms_bucket = 'all'
          AND y.property_type IN ('apartment', 'house') AND y.n_sales >= {RANKING_MIN_SALES}
        ORDER BY y.gross_yield DESC
        """
    ).fetchall()
    period = con.execute(
        "SELECT max(period) FROM kpi_price WHERE period_type = 'year' AND NOT is_partial"
    ).fetchone()[0]
    dest.write_text(
        json.dumps({"run_id": run_id, "period": period, "min_sales": RANKING_MIN_SALES,
                    "fields": RANKING_FIELDS, "rows": [list(r) for r in rows]},
                   ensure_ascii=False, separators=(",", ":"), default=float),
        encoding="utf-8",
    )
    return len(rows)


def sync_app(app_public_data: Path, serve_dir: Path = paths.SERVE) -> None:
    """Copy the serve layer into the Expo app's public folder (served statically on web)."""
    shutil.rmtree(app_public_data, ignore_errors=True)
    shutil.copytree(serve_dir, app_public_data)
