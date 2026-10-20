"""Map layer: GeoJSON per département with KPIs (docs/features/005-map/spec.md)."""
import gzip
import json
from pathlib import Path

import duckdb

from rea_pipeline import mapdata


def _square(x: float) -> dict:
    return {"type": "Polygon", "coordinates": [[[x, 45], [x + 0.1, 45], [x + 0.1, 45.1], [x, 45.1], [x, 45]]]}


def _contours(directory: Path) -> None:
    directory.mkdir(parents=True)
    communes = [
        {"code": "49007", "nom": "Angers", "departement": "49"},
        {"code": "49099", "nom": "Small", "departement": "49"},
        {"code": "75056", "nom": "Paris", "departement": "75"},
        {"code": "75101", "nom": "Paris 1er", "departement": "75"},
    ]
    layers = {
        "communes-100m": [{"type": "Feature", "properties": c, "geometry": _square(i)} for i, c in enumerate(communes)],
        "departements-1000m": [{"type": "Feature", "properties": {"code": d, "nom": d}, "geometry": _square(i)}
                               for i, d in enumerate(("49", "75"))],
    }
    for name, features in layers.items():
        with gzip.open(directory / f"{name}.geojson.gz", "wt", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": features}, f)


def test_map_layer(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(mapdata, "CONTOURS_DIR", tmp_path / "contours")
    _contours(tmp_path / "contours")
    con = duckdb.connect()
    con.execute(
        """CREATE TABLE kpi_price AS SELECT * FROM (VALUES
             ('commune', '49007', 'year', '2025', false, 'apartment', 'all', 1600, 3147.0, -0.01),
             ('commune', '49007', 'year', '2025', false, 'all', 'all', 2800, 3000.0, -0.01),
             ('commune', '49099', 'year', '2025', false, 'all', 'all', 4, 2000.0, NULL),
             ('arrondissement', '75101', 'year', '2025', false, 'all', 'all', 300, 13000.0, 0.0),
             ('departement', '49', 'year', '2025', false, 'all', 'all', 9000, 2500.0, 0.0))
           t(geo_level, geo_code, period_type, period, is_partial, property_type, rooms_bucket, n_sales,
             median_price_m2, cagr)"""
    )
    con.execute("""CREATE TABLE kpi_yield AS SELECT 'commune' AS geo_level, '49007' AS geo_code, 'year' AS period_type,
                   '2025' AS period, 'apartment' AS property_type, 'all' AS rooms_bucket, 0.0555 AS gross_yield""")
    con.execute("""CREATE TABLE kpi_socio AS SELECT 'commune' AS geo_level, '49007' AS geo_code,
                   0.059 AS vacancy_rate, 0.007 AS population_growth_yearly""")
    con.execute("CREATE TABLE rent_control AS SELECT '75101' AS code")

    sizes = mapdata.write_map_layer(con, tmp_path / "serve", min_sales=10)
    assert sizes["commune_files"] == 2

    anjou = json.loads((tmp_path / "serve" / "map" / "communes" / "49.geojson").read_text(encoding="utf-8"))
    props = {f["properties"]["code"]: f["properties"] for f in anjou["features"]}
    assert props["49007"]["price_apartment"] == 3147.0 and props["49007"]["yield_apartment"] == 0.0555
    assert "price_all" not in props["49099"]  # 4 sales: not published

    paris = json.loads((tmp_path / "serve" / "map" / "communes" / "75.geojson").read_text(encoding="utf-8"))
    codes = [f["properties"]["code"] for f in paris["features"]]
    assert codes == ["75101"]  # the city polygon is replaced by its arrondissements
    assert paris["features"][0]["properties"]["rent_control"] is True

    deps = json.loads((tmp_path / "serve" / "map" / "departements.geojson").read_text(encoding="utf-8"))
    assert {f["properties"]["code"]: f["properties"].get("price_all") for f in deps["features"]} == {"49": 2500.0, "75": None}
