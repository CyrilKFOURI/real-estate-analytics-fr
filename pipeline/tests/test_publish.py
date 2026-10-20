"""Serve layer written for the app (docs/features/002-commune-page/spec.md)."""
import json
from pathlib import Path

import duckdb

from rea_pipeline import publish


def _con() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute(
        """CREATE TABLE commune_map AS SELECT * FROM (VALUES
               ('49007', '49007', NULL, 'Angers', '49', '52'),
               ('75056', '75056', NULL, 'Paris', '75', '11'),
               ('75101', '75056', '75101', 'Paris 1er', '75', '11'))
           t(code, code_commune, code_arrondissement, nom, departement, region)"""
    )
    price_columns = ", ".join(f"NULL AS {f}" for f in publish.PRICE_FIELDS[5:])
    con.execute(
        f"""CREATE TABLE kpi_price AS
            SELECT * REPLACE (n AS n_sales, 3100.0 AS median_price_m2) FROM (
                SELECT geo_level, geo_code, 'year' AS period_type, '2025' AS period,
                       false AS is_partial, 'apartment' AS property_type, 'all' AS rooms_bucket,
                       {price_columns}, n
                FROM (VALUES ('commune', '49007', 1600), ('commune', '75056', 9),
                             ('arrondissement', '75101', 300), ('france', 'FR', 800000))
                     v(geo_level, geo_code, n))"""
    )
    con.execute(
        """CREATE TABLE kpi_yield AS SELECT 'commune' AS geo_level, '49007' AS geo_code,
               'year' AS period_type, '2025' AS period, 'apartment' AS property_type, 'all' AS rooms_bucket,
               14.6 AS rent_m2, 11.0 AS rent_low_m2, 19.0 AS rent_high_m2,
               'commune' AS rent_source, 29741 AS n_listings, 0.0555 AS gross_yield,
               18.0 AS price_to_rent_years, 1600 AS n_sales"""
    )
    socio_columns = ", ".join(f"NULL AS {f}" for f in publish.SOCIO_FIELDS if f != "population")
    con.execute(
        f"""CREATE TABLE kpi_socio AS SELECT 'commune' AS geo_level, '49007' AS geo_code,
               159022 AS population, {socio_columns}"""
    )
    return con


def _with_extras(con: duckdb.DuckDBPyConnection) -> duckdb.DuckDBPyConnection:
    con.execute("CREATE TABLE kpi_local_tax AS SELECT 'commune' AS geo_level, '49007' AS geo_code, "
                "2025 AS tax_year, 0.5665 AS tfpb_rate")
    con.execute("CREATE TABLE rent_control AS SELECT '75101' AS code")
    con.execute("CREATE TABLE kpi_score AS SELECT 'commune' AS geo_level, '49007' AS geo_code, '2025' AS period, "
                "'apartment' AS property_type, 71.5 AS score, 7 AS n_criteria, ['jobs_growth_yearly'] AS strengths, "
                "['gross_yield'] AS weaknesses, 0.33 AS rent_to_income")
    return con


def test_publish_adds_tax_rent_control_and_score(tmp_path: Path):
    serve = tmp_path / "serve"
    publish.publish(_with_extras(_con()), min_sales=10, run_id="r3", serve_dir=serve)
    angers = json.loads((serve / "geo" / "commune" / "49007.json").read_text(encoding="utf-8"))
    assert angers["local_tax"]["tfpb_rate"] == 0.5665
    assert angers["score"]["apartment"]["score"] == 71.5
    assert "rent_control" not in angers
    paris1 = json.loads((serve / "geo" / "arrondissement" / "75101.json").read_text(encoding="utf-8"))
    assert paris1["rent_control"] is True
    ranking = json.loads((serve / "ranking.json").read_text(encoding="utf-8"))
    row = dict(zip(ranking["fields"], ranking["rows"][0]))
    assert row["score"] == 71.5 and row["tfpb_rate"] == 0.5665 and row["rent_control"] is False


def test_publish_writes_index_and_geo_files(tmp_path: Path):
    serve = tmp_path / "serve"
    stats = publish.publish(_con(), min_sales=10, run_id="r1", serve_dir=serve)

    # Paris commune has n=9 < 10: not published; the others are
    assert stats["files"] == 3
    assert not (serve / "geo" / "commune" / "75056.json").exists()

    angers = json.loads((serve / "geo" / "commune" / "49007.json").read_text(encoding="utf-8"))
    assert angers["name"] == "Angers" and angers["socio"]["population"] == 159022
    row = dict(zip(angers["yield_fields"], angers["yields"][0]))
    assert row["gross_yield"] == 0.0555

    index = json.loads((serve / "index.json").read_text(encoding="utf-8"))
    names = [place[2] for place in index["places"]]
    # communes and arrondissements only, biggest population first
    assert names == ["Angers", "Paris 1er"]
    assert json.loads((serve / "geo" / "france" / "FR.json").read_text())["name"] == "France"

    # ranking: Angers apartments (1 600 sales ≥ 30) with their yield
    ranking = json.loads((serve / "ranking.json").read_text(encoding="utf-8"))
    rows = [dict(zip(ranking["fields"], row)) for row in ranking["rows"]]
    assert ranking["period"] == "2025" and len(rows) == 1
    assert rows[0]["name"] == "Angers" and rows[0]["gross_yield"] == 0.0555


def test_publish_replaces_previous_serve_layer(tmp_path: Path):
    serve = tmp_path / "serve"
    (serve / "geo" / "commune").mkdir(parents=True)
    (serve / "geo" / "commune" / "99999.json").write_text("{}")
    publish.publish(_con(), min_sales=10, run_id="r2", serve_dir=serve)
    assert not (serve / "geo" / "commune" / "99999.json").exists()
