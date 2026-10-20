"""Cleaning and KPI rules on a hand-made official-DVF fixture (docs/features/001-dvf-pipeline/spec.md)."""
import csv
import json
from pathlib import Path

import duckdb
import pytest

from rea_pipeline import clean, marts, refs

HEADER = ["No disposition", "Date mutation", "Nature mutation", "Valeur fonciere",
          "Code departement", "Code commune", "Prefixe de section", "Section", "No plan",
          "Type local", "Surface reelle bati", "Nombre pieces principales"]

COMMUNES = [
    {"code": "01001", "type": "commune-actuelle", "nom": "A", "departement": "01"},
    {"code": "01002", "type": "commune-deleguee", "chefLieu": "01001", "nom": "Old", "departement": "01"},
    # the chef-lieu is also listed as its own delegated commune: must not duplicate sales
    {"code": "01001", "type": "commune-deleguee", "chefLieu": "01001", "nom": "A", "departement": "01"},
    {"code": "75056", "type": "commune-actuelle", "nom": "Paris", "departement": "75"},
    {"code": "75101", "type": "arrondissement-municipal", "commune": "75056", "nom": "Paris 1", "departement": "75"},
    {"code": "97102", "type": "commune-actuelle", "nom": "Anse-Bertrand", "departement": "971"},
]


def row(price, commune, type_local, surface, rooms=2, nature="Vente", date="01/03/2024", plan="1"):
    """One line of an official DVF file: unpadded commune code, French decimals, dd/mm/yyyy."""
    dep = commune[:3] if commune.startswith("97") else commune[:2]
    com = str(int(commune[len(dep):]))
    surface = "" if surface is None else str(surface).replace(".", ",")
    return ["000001", date, nature, f"{price},00", dep, com, "", "AB", plan, type_local, surface, rooms]


# Each test sale has a unique price, used as its key in the assertions.
ROWS = [
    # apartment + dependency, price repeated on 2 parcels -> kept once, 200 000 / 50
    row(200000, "01001", "Appartement", 50, plan="1"),
    row(200000, "01001", "Appartement", 50, plan="2"),
    row(200000, "01001", "Dépendance", None, plan="1"),
    # two different dwellings in one sale -> dropped
    row(500001, "01001", "Appartement", 40),
    row(500001, "01001", "Appartement", 60, rooms=3),
    # not a sale -> dropped
    row(100000, "01001", "Maison", 100, nature="Echange"),
    # merged commune 01002 -> remapped to 01001
    row(300000, "01002", "Maison", 100, rooms=4),
    # surface below 9 m² -> dropped
    row(50000, "01001", "Appartement", 8, rooms=1),
    # Paris arrondissement -> commune 75056 + arrondissement 75101
    row(500000, "75101", "Appartement", 50),
    # shop in the sale -> dropped
    row(400000, "01001", "Appartement", 50),
    row(400000, "01001", "Local industriel. commercial ou assimilé", 30),
    # overseas: departement 971 + commune "2" -> 97102; French decimal surface
    row(150000, "97102", "Maison", 75.5, rooms=3, date="15/09/2024"),
]


@pytest.fixture
def con(tmp_path: Path) -> duckdb.DuckDBPyConnection:
    communes = tmp_path / "communes.json"
    communes.write_text(json.dumps(COMMUNES))
    dvf = tmp_path / "ValeursFoncieres-test.txt"
    with dvf.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="|")
        writer.writerow(HEADER)
        writer.writerows(ROWS)
    connection = duckdb.connect()
    refs.build_commune_map(connection, communes)
    clean.load_raw(connection, [dvf])
    clean.build_sales(connection)
    return connection


def sales(con) -> dict[int, tuple]:
    rows = con.execute(
        """SELECT CAST(price AS INTEGER), price_m2, code_commune, code_arrondissement,
                  date_mutation, half, surface_m2
           FROM dvf_sales"""
    ).fetchall()
    return {r[0]: r[1:] for r in rows}


def test_kept_sales(con):
    assert set(sales(con)) == {200000, 300000, 500000, 150000}
    assert con.execute("SELECT count(*) FROM dvf_sales").fetchone()[0] == 4


def test_price_counted_once(con):
    assert sales(con)[200000][0] == 4000


def test_merged_commune_remapped(con):
    assert sales(con)[300000][1] == "01001"


def test_arrondissement_mapped_to_parent(con):
    _, commune, arrondissement, *_ = sales(con)[500000]
    assert (commune, arrondissement) == ("75056", "75101")


def test_overseas_code_date_and_decimals(con):
    _, commune, _, date, half, surface = sales(con)[150000]
    assert commune == "97102"
    assert str(date) == "2024-09-15" and half == 2
    assert surface == 75.5


def test_small_cells_not_published(con, tmp_path):
    marts.build_price_kpis(con, "test")
    assert marts.export_published(con, tmp_path / "kpi.parquet") == 0


def _add_sales(con, year: int, half: int, price_m2: float, n: int = 12) -> None:
    month = 3 if half == 1 else 9
    for i in range(n):
        con.execute(
            """INSERT INTO dvf_sales VALUES (?, ?, ?, ?, ?, 50, ?, 'apartment', 2,
               '01001', NULL, '01', NULL, NULL)""",
            [f"{year}-{half}-{i}", f"{year}-{month:02d}-01", year, half, price_m2 * 50, price_m2],
        )


def _kpi(con, period: str):
    return con.execute(
        """SELECT median_price_m2, yoy_change, is_partial FROM kpi_price
           WHERE geo_level = 'commune' AND geo_code = '01001' AND period = ?
             AND property_type = 'apartment' AND rooms_bucket = 'all'""",
        [period],
    ).fetchone()


def test_yoy_on_full_years_and_half_years(con):
    # release window 2023-H2 → 2026-H1, like a real DVF release
    _add_sales(con, 2023, 2, 3000)
    for year, price in ((2024, 3000), (2025, 3300)):
        _add_sales(con, year, 1, price)
        _add_sales(con, year, 2, price)
    _add_sales(con, 2026, 1, 3465)
    marts.build_price_kpis(con, "test")

    median, yoy, partial = _kpi(con, "2025")
    assert median == pytest.approx(3300) and yoy == pytest.approx(0.10) and not partial

    # 2026 only has its first half: flagged partial, no year-on-year
    _, yoy, partial = _kpi(con, "2026")
    assert partial and yoy is None
    # but the half-year compares with the same half of 2025: 3465 / 3300 - 1 = +5%
    _, yoy, partial = _kpi(con, "2026-H1")
    assert yoy == pytest.approx(0.05) and not partial

    # 2024 compared with partial 2023: no year-on-year
    assert _kpi(con, "2024")[1] is None
