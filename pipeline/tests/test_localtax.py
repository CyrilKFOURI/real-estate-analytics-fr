"""Property tax rate from the REI (M15)."""
from pathlib import Path

import duckdb
import pytest

from rea_pipeline import localtax

HEADER = "DEP;DIR;COM;LIBCOM;E12;E22;E32;E52;E52gGEMAPI;E52TASA"


@pytest.fixture
def con(tmp_path: Path) -> duckdb.DuckDBPyConnection:
    csv = tmp_path / "REI.csv"
    # Paris: commune rate only (+ TSE, GEMAPI); Angers: commune + intercommunality; empty cells = 0
    csv.write_bytes("\n".join([
        HEADER,
        "75;0;056;VILLE DE PARIS;20.50000;0.00000;0.00000;0.22100;0.14300;",
        "49;0;007;ANGERS;54.24000;0.00000;2.18000;0.00000;0.23300;",
        "971;0;01;LES ABYMES;30.00000;;1.00000;;;",
    ]).encode("latin-1"))
    connection = duckdb.connect()
    connection.execute(
        """CREATE TABLE commune_map AS SELECT * FROM (VALUES
               ('75056', '75056', NULL), ('75101', '75056', '75101'), ('49007', '49007', NULL),
               ('97101', '97101', NULL)) t(code, code_commune, code_arrondissement)"""
    )
    localtax.build_local_tax_kpis(connection, csv, 2025)
    return connection


def rate(con, level, code):
    return con.execute(
        "SELECT tfpb_rate FROM kpi_local_tax WHERE geo_level = ? AND geo_code = ?", [level, code]
    ).fetchone()[0]


def test_global_rate_sums_every_levy(con):
    assert rate(con, "commune", "75056") == pytest.approx(0.20864)
    assert rate(con, "commune", "49007") == pytest.approx(0.56653)


def test_overseas_code_and_arrondissements(con):
    assert rate(con, "commune", "97101") == pytest.approx(0.31)
    assert rate(con, "arrondissement", "75101") == rate(con, "commune", "75056")
