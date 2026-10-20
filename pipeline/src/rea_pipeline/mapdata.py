"""S5 map layer: GeoJSON with KPIs for the app's choropleth maps (docs/features/005-map/spec.md).

data/serve/map/
  departements.geojson         every département with its KPIs (France view)
  communes/<departement>.geojson  its communes (Paris/Lyon/Marseille as arrondissements), loaded on click
Geometries: Etalab "contours administratifs" (communes simplified to 100 m, départements to 1 km).
Only published KPI cells are attached (same n >= 10 rule as everywhere else).
"""
import gzip
import json
from decimal import Decimal
from pathlib import Path

import duckdb
import httpx

from . import paths
from .ingest import download

CONTOURS_URL = "https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/latest/geojson/{name}.geojson.gz"
CONTOURS_DIR = paths.RAW / "contours"
LAYERS = {"communes": "communes-100m", "departements": "departements-1000m"}
CITY_WITH_ARRONDISSEMENTS = ("75056", "69123", "13055")

# property name in the GeoJSON -> SQL expression over the KPI tables (latest complete year)
METRICS = {
    "price_apartment": "max(p.median_price_m2) FILTER (WHERE p.property_type = 'apartment')",
    "price_house": "max(p.median_price_m2) FILTER (WHERE p.property_type = 'house')",
    "price_all": "max(p.median_price_m2) FILTER (WHERE p.property_type = 'all')",
    "trend_all": "max(p.cagr) FILTER (WHERE p.property_type = 'all')",
    "sales_all": "max(p.n_sales) FILTER (WHERE p.property_type = 'all')",
    "yield_apartment": "max(y.gross_yield) FILTER (WHERE y.property_type = 'apartment')",
    "yield_house": "max(y.gross_yield) FILTER (WHERE y.property_type = 'house')",
}


def ingest_contours() -> dict:
    with httpx.Client(follow_redirects=True, timeout=600) as client:
        return {layer: download(CONTOURS_URL.format(name=name), CONTOURS_DIR / f"{name}.geojson.gz", client)
                for layer, name in LAYERS.items()}


def _load(layer: str) -> list[dict]:
    with gzip.open(CONTOURS_DIR / f"{LAYERS[layer]}.geojson.gz", "rt", encoding="utf-8") as f:
        return json.load(f)["features"]


def _has(con: duckdb.DuckDBPyConnection, table: str) -> bool:
    return con.execute("SELECT count(*) FROM information_schema.tables WHERE table_name = ?", [table]).fetchone()[0] > 0


def _kpis(con: duckdb.DuckDBPyConnection, levels: tuple[str, ...], min_sales: int) -> dict[tuple[str, str], dict]:
    """Map properties per (geo_level, geo_code) for the latest complete year."""
    price_columns = {row[0] for row in con.execute("DESCRIBE kpi_price").fetchall()}
    # an older kpi_price may lack newer columns (e.g. cagr): those metrics are left empty
    metrics = ", ".join(
        f"{expr if 'p.cagr' not in expr or 'cagr' in price_columns else 'NULL'} AS {name}"
        for name, expr in METRICS.items()
    )
    level_list = ", ".join(f"'{l}'" for l in levels)
    rows = con.execute(
        f"""
        WITH latest AS (
            SELECT max(period) AS latest_period FROM kpi_price WHERE period_type = 'year' AND NOT is_partial
        )
        SELECT p.geo_level, p.geo_code, {metrics}
        FROM kpi_price p
        JOIN latest ON p.period = latest.latest_period
        LEFT JOIN kpi_yield y USING (geo_level, geo_code, period_type, period, property_type, rooms_bucket)
        WHERE p.geo_level IN ({level_list}) AND p.rooms_bucket = 'all' AND p.n_sales >= {min_sales}
        GROUP BY p.geo_level, p.geo_code
        """
    ).fetchall()
    out = {(level, code): dict(zip(METRICS, values)) for level, code, *values in rows}

    def add(query: str, names: tuple[str, ...]):
        for level, code, *values in con.execute(query).fetchall():
            if (level, code) in out:
                out[(level, code)].update(dict(zip(names, values)))

    add(f"SELECT geo_level, geo_code, vacancy_rate, population_growth_yearly FROM kpi_socio "
        f"WHERE geo_level IN ({level_list})", ("vacancy", "population_growth"))
    if _has(con, "kpi_dpe"):
        add(f"SELECT geo_level, geo_code, share_fg FROM kpi_dpe WHERE geo_level IN ({level_list}) AND n_dpe >= 10",
            ("share_fg",))
    if _has(con, "kpi_score"):
        add("SELECT geo_level, geo_code, max(score) FILTER (WHERE property_type = 'apartment'), "
            "max(score) FILTER (WHERE property_type = 'house') FROM kpi_score GROUP BY ALL",
            ("score_apartment", "score_house"))
    if _has(con, "kpi_local_tax"):
        add(f"SELECT geo_level, geo_code, tfpb_rate FROM kpi_local_tax WHERE geo_level IN ({level_list})",
            ("tfpb_rate",))
    return out


def _clean(values: dict) -> dict:
    return {k: (round(float(v), 4) if isinstance(v, (float, Decimal)) else v) for k, v in values.items() if v is not None}


def _write(path: Path, features: list[dict]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def write_map_layer(con: duckdb.DuckDBPyConnection, serve_dir: Path, min_sales: int) -> dict:
    """Write map/departements.geojson and map/communes/<dep>.geojson into serve_dir."""
    departement_kpis = _kpis(con, ("departement",), min_sales)
    commune_kpis = _kpis(con, ("commune", "arrondissement"), min_sales)
    rent_control = (
        {c for (c,) in con.execute("SELECT code FROM rent_control").fetchall()} if _has(con, "rent_control") else set()
    )

    departements = [
        {"type": "Feature", "geometry": f["geometry"],
         "properties": {"code": f["properties"]["code"], "nom": f["properties"]["nom"],
                        **_clean(departement_kpis.get(("departement", f["properties"]["code"]), {}))}}
        for f in _load("departements")
    ]
    sizes = {"departements": _write(serve_dir / "map" / "departements.geojson", departements)}

    by_departement: dict[str, list[dict]] = {}
    for feature in _load("communes"):
        props = feature["properties"]
        code = props["code"]
        if code in CITY_WITH_ARRONDISSEMENTS:
            continue  # shown as its arrondissements
        level = "arrondissement" if code[:3] in ("751", "132") or code.startswith("6938") else "commune"
        by_departement.setdefault(props["departement"], []).append({
            "type": "Feature", "geometry": feature["geometry"],
            "properties": {"code": code, "nom": props["nom"], "level": level,
                           **({"rent_control": True} if code in rent_control else {}),
                           **_clean(commune_kpis.get((level, code), {}))},
        })
    commune_bytes = [
        _write(serve_dir / "map" / "communes" / f"{dep}.geojson", features) for dep, features in by_departement.items()
    ]
    sizes |= {"commune_files": len(commune_bytes), "commune_max_kb": round(max(commune_bytes) / 1024),
              "departements_kb": round(sizes["departements"] / 1024)}
    return sizes
