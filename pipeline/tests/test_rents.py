"""Rent loading and gross-yield rules (docs/KPI_SPEC.md M8–M10)."""
import json
from pathlib import Path

import duckdb
import pytest

from rea_pipeline import rents

HEADER = '"id_zone";"INSEE_C";"LIBGEO";"EPCI";"DEP";"REG";"loypredm2";"lwr.IPm2";"upr.IPm2";"TYPPRED";"nbobs_com";"nbobs_mail";"R2_adj"'

COMMUNES = [
    {"code": "49007", "type": "commune-actuelle", "nom": "Angers", "departement": "49", "region": "52"},
    {"code": "75056", "type": "commune-actuelle", "nom": "Paris", "departement": "75", "region": "11"},
    {"code": "75101", "type": "arrondissement-municipal", "commune": "75056", "nom": "Paris 1", "departement": "75", "region": "11"},
    {"code": "75120", "type": "arrondissement-municipal", "commune": "75056", "nom": "Paris 20", "departement": "75", "region": "11"},
]

# code -> (rent €/m², listings, source)
APARTMENT_RENTS = {
    "49007": ("15,0", 3000, "commune"),
    "75101": ("40,0", 1000, "commune"),
    "75120": ("30,0", 3000, "commune"),
}


def _write_rent_files(directory: Path) -> None:
    directory.mkdir(parents=True)
    for stem in rents.SEGMENTS:
        lines = [HEADER]
        for code, (rent, n, source) in APARTMENT_RENTS.items():
            # LIBGEO with "œ": files are Windows-1252, not latin-1
            lines.append(f'"1";"{code}";"Bœuf é";"1";"{code[:2]}";"52";{rent};10,0;20,0;"{source}";{n};{n};0,8')
        (directory / f"{stem}.csv").write_bytes("\r\n".join(lines).encode("cp1252"))


@pytest.fixture
def con(tmp_path: Path) -> duckdb.DuckDBPyConnection:
    communes = tmp_path / "communes.json"
    communes.write_text(json.dumps(COMMUNES))
    _write_rent_files(tmp_path / "2025")
    connection = duckdb.connect()
    connection.execute(
        f"""CREATE TABLE commune_map AS
            SELECT code,
                   CASE WHEN type = 'arrondissement-municipal' THEN commune ELSE code END AS code_commune,
                   CASE WHEN type = 'arrondissement-municipal' THEN code END AS code_arrondissement,
                   nom, departement, region
            FROM read_json_auto('{communes.as_posix()}')"""
    )
    connection.execute(
        """CREATE TABLE kpi_price (geo_level VARCHAR, geo_code VARCHAR, period_type VARCHAR,
               period VARCHAR, year INTEGER, property_type VARCHAR, rooms_bucket VARCHAR,
               n_sales INTEGER, median_price_m2 DOUBLE, run_id VARCHAR)"""
    )
    for geo_level, code, price, n in (
        ("commune", "49007", 3000, 1500),
        ("commune", "75056", 9600, 14000),
        ("arrondissement", "75120", 9000, 2000),
        ("france", "FR", 2600, 400000),
    ):
        for year in (2024, 2025):
            connection.execute(
                "INSERT INTO kpi_price VALUES (?, ?, 'year', ?, ?, 'apartment', 'all', ?, ?, 't')",
                [geo_level, code, str(year), year, n, price],
            )
    rents.load_rents(connection, tmp_path / "2025", 2025)
    rents.build_yield_kpis(connection)
    return connection


def _yield(con, level, code, period="2025"):
    return con.execute(
        """SELECT rent_m2, gross_yield, price_to_rent_years FROM kpi_yield
           WHERE geo_level = ? AND geo_code = ? AND period = ?
             AND property_type = 'apartment' AND rooms_bucket = 'all'""",
        [level, code, period],
    ).fetchone()


def test_gross_yield_and_price_to_rent(con):
    rent, gross, years = _yield(con, "commune", "49007")
    assert rent == 15.0
    assert gross == pytest.approx(12 * 15 / 3000)
    assert years == pytest.approx(3000 / (12 * 15))


def test_paris_rent_is_listing_weighted_mean_of_arrondissements(con):
    rent, *_ = _yield(con, "commune", "75056")
    assert rent == pytest.approx((40 * 1000 + 30 * 3000) / 4000)


def test_arrondissement_keeps_its_own_rent(con):
    assert _yield(con, "arrondissement", "75120")[0] == 30.0


def test_rent_edition_never_paired_with_older_prices(con):
    assert _yield(con, "commune", "49007", period="2024") is None


def test_rooms_segments_expanded(con):
    buckets = {
        b for (b,) in con.execute(
            "SELECT DISTINCT rooms_bucket FROM rent_commune WHERE property_type = 'apartment'"
        ).fetchall()
    }
    assert buckets == {"all", "1", "2", "3", "4", "5+"}


def test_no_yield_on_implausibly_low_prices(con):
    con.execute("UPDATE kpi_price SET median_price_m2 = 142 WHERE geo_code = '49007'")
    rents.build_yield_kpis(con)
    assert _yield(con, "commune", "49007") is None
