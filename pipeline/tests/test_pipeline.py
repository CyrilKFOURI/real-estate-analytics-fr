"""Cleaning and KPI rules on a hand-made DVF fixture (docs/features/001-dvf-pipeline/spec.md)."""
import csv
import json
from pathlib import Path

import duckdb
import pytest

from rea_pipeline import clean, marts, refs

HEADER = list(clean.DVF_COLUMNS)

COMMUNES = [
    {"code": "01001", "type": "commune-actuelle", "nom": "A", "departement": "01"},
    {"code": "01002", "type": "commune-deleguee", "chefLieu": "01001", "nom": "Old", "departement": "01"},
    # the chef-lieu is also listed as its own delegated commune: must not duplicate sales
    {"code": "01001", "type": "commune-deleguee", "chefLieu": "01001", "nom": "A", "departement": "01"},
    {"code": "75056", "type": "commune-actuelle", "nom": "Paris", "departement": "75"},
    {"code": "75101", "type": "arrondissement-municipal", "commune": "75056", "nom": "Paris 1", "departement": "75"},
]


def row(mid, price, commune, type_local, surface, rooms=2, nature="Vente", date="2024-03-01", parcelle="P1"):
    return [mid, date, nature, price, commune, parcelle, type_local, surface, rooms, 2.0, 48.0]


ROWS = [
    # M1: apartment + dependency, price repeated on 2 parcels -> kept once, 200 000 / 50
    row("M1", 200000, "01001", "Appartement", 50, parcelle="P1"),
    row("M1", 200000, "01001", "Appartement", 50, parcelle="P2"),
    row("M1", 200000, "01001", "Dépendance", None, parcelle="P1"),
    # M2: two different dwellings in one sale -> dropped
    row("M2", 500000, "01001", "Appartement", 40),
    row("M2", 500000, "01001", "Appartement", 60, rooms=3),
    # M3: not a sale -> dropped
    row("M3", 100000, "01001", "Maison", 100, nature="Echange"),
    # M4: merged commune 01002 -> remapped to 01001
    row("M4", 300000, "01002", "Maison", 100, rooms=4),
    # M5: surface below 9 m² -> dropped
    row("M5", 50000, "01001", "Appartement", 8, rooms=1),
    # M6: Paris arrondissement -> commune 75056 + arrondissement 75101
    row("M6", 500000, "75101", "Appartement", 50),
    # M7: shop in the sale -> dropped
    row("M7", 400000, "01001", "Appartement", 50),
    row("M7", 400000, "01001", "Local industriel. commercial ou assimilé", 30),
]


@pytest.fixture
def con(tmp_path: Path) -> duckdb.DuckDBPyConnection:
    communes = tmp_path / "communes.json"
    communes.write_text(json.dumps(COMMUNES))
    dvf = tmp_path / "dvf.csv"
    with dvf.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(HEADER)
        writer.writerows(ROWS)
    connection = duckdb.connect()
    refs.build_commune_map(connection, communes)
    clean.load_raw(connection, [dvf])
    clean.build_sales(connection)
    return connection


def sales(con) -> dict[str, tuple]:
    rows = con.execute(
        "SELECT id_mutation, price, price_m2, code_commune, code_arrondissement, property_type FROM dvf_sales"
    ).fetchall()
    return {r[0]: r[1:] for r in rows}


def test_kept_mutations(con):
    assert set(sales(con)) == {"M1", "M4", "M6"}
    assert con.execute("SELECT count(*) FROM dvf_sales").fetchone()[0] == 3


def test_price_counted_once(con):
    price, price_m2, *_ = sales(con)["M1"]
    assert price == 200000
    assert price_m2 == 4000


def test_merged_commune_remapped(con):
    assert sales(con)["M4"][2] == "01001"


def test_arrondissement_mapped_to_parent(con):
    _, _, commune, arrondissement, _ = sales(con)["M6"]
    assert (commune, arrondissement) == ("75056", "75101")


def test_small_cells_not_published(con, tmp_path):
    marts.build_price_kpis(con, "test")
    assert marts.export_published(con, tmp_path / "kpi.parquet") == 0


def test_kpis_and_yoy(con):
    # 12 apartments per year in commune 01001, +10% from 2023 to 2024
    for year, price_m2 in ((2023, 3000), (2024, 3300)):
        for i in range(12):
            con.execute(
                """INSERT INTO dvf_sales VALUES (?, ?, ?, ?, 50, ?, 'apartment', 2,
                   '01001', NULL, '01', 2.0, 48.0)""",
                [f"Y{year}-{i}", f"{year}-06-01", year, price_m2 * 50, price_m2],
            )
    marts.build_price_kpis(con, "test")
    median, n, yoy = con.execute(
        """SELECT median_price_m2, n_sales, yoy_change FROM kpi_price
           WHERE geo_level = 'commune' AND geo_code = '01001' AND year = 2024
             AND property_type = 'apartment' AND rooms_bucket = 'all'"""
    ).fetchone()
    assert median == pytest.approx(3300, rel=0.01)
    assert n >= 10
    assert yoy == pytest.approx(0.10, abs=0.01)
