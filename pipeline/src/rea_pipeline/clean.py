"""S2: DVF cleaning (docs/PIPELINE_RUN_SPEC.md §3).

Output table dvf_sales: one row per kept mutation = one single-dwelling residential sale.
"""
from pathlib import Path

import duckdb

DVF_COLUMNS = {
    "id_mutation": "VARCHAR",
    "date_mutation": "DATE",
    "nature_mutation": "VARCHAR",
    "valeur_fonciere": "DOUBLE",
    "code_commune": "VARCHAR",
    "id_parcelle": "VARCHAR",
    "type_local": "VARCHAR",
    "surface_reelle_bati": "DOUBLE",
    "nombre_pieces_principales": "DOUBLE",
    "longitude": "DOUBLE",
    "latitude": "DOUBLE",
}
DWELLING_TYPES = ("Appartement", "Maison")
MIN_SURFACE_M2 = 9
MIN_PRICE_EUR = 1_000


def load_raw(con: duckdb.DuckDBPyConnection, files: list[Path]) -> None:
    """Load official DVF files (data.gouv.fr 'ValeursFoncieres-*.txt') into table dvf_raw.

    The official format has no mutation id, unpadded commune codes, French decimals
    ("130000,00") and dd/mm/yyyy dates; this normalises it to DVF_COLUMNS.
    """
    file_list = ", ".join(f"'{f.as_posix()}'" for f in files)
    commune = (
        '"Code departement" || lpad("Code commune", CAST(5 - length("Code departement") AS INTEGER), \'0\')'
    )
    con.execute(
        f"""
        CREATE OR REPLACE TABLE dvf_raw AS
        SELECT
            -- no id in the official files: every row of a sale shares these fields
            md5(concat_ws('|', "Date mutation", "Nature mutation", "Valeur fonciere",
                          "Code departement", "Code commune", "No disposition")) AS id_mutation,
            TRY_CAST(strptime("Date mutation", '%d/%m/%Y') AS DATE) AS date_mutation,
            "Nature mutation" AS nature_mutation,
            TRY_CAST(replace("Valeur fonciere", ',', '.') AS DOUBLE) AS valeur_fonciere,
            {commune} AS code_commune,
            {commune} || lpad(coalesce("Prefixe de section", ''), 3, '0')
                || lpad("Section", 2, '0') || lpad("No plan", 4, '0') AS id_parcelle,
            "Type local" AS type_local,
            TRY_CAST(replace("Surface reelle bati", ',', '.') AS DOUBLE) AS surface_reelle_bati,
            TRY_CAST("Nombre pieces principales" AS DOUBLE) AS nombre_pieces_principales,
            NULL::DOUBLE AS longitude,
            NULL::DOUBLE AS latitude
        FROM read_csv([{file_list}], header = true, all_varchar = true, union_by_name = true,
                      delim = '|', quote = '')
        """
    )


def build_sales(con: duckdb.DuckDBPyConnection) -> None:
    """Create table dvf_sales from dvf_raw + commune_map."""
    dwellings = ", ".join(f"'{t}'" for t in DWELLING_TYPES)
    con.execute(
        f"""
        CREATE OR REPLACE TABLE dvf_sales AS
        WITH per_mutation AS (
            SELECT
                id_mutation,
                min(date_mutation) AS date_mutation,
                -- the sale price is repeated on every row of a mutation: take it once
                min(valeur_fonciere) AS price,
                max(valeur_fonciere) AS price_max,
                count(DISTINCT code_commune) AS n_communes,
                -- rows repeat per parcel/lot: count distinct dwellings, not rows
                count(DISTINCT CASE WHEN type_local IN ({dwellings})
                      THEN concat_ws('|', type_local, surface_reelle_bati,
                                     nombre_pieces_principales) END) AS n_dwellings,
                count(*) FILTER (WHERE type_local IS NOT NULL
                                 AND type_local NOT IN ({dwellings}, 'Dépendance')) AS n_other_premises,
                any_value(type_local) FILTER (WHERE type_local IN ({dwellings})) AS property_type,
                max(surface_reelle_bati) FILTER (WHERE type_local IN ({dwellings})) AS surface_m2,
                max(nombre_pieces_principales) FILTER (WHERE type_local IN ({dwellings})) AS rooms,
                any_value(code_commune) AS code_commune_raw,
                avg(longitude) AS longitude,
                avg(latitude) AS latitude
            FROM dvf_raw
            WHERE nature_mutation = 'Vente'
            GROUP BY id_mutation
        )
        SELECT
            m.id_mutation,
            m.date_mutation,
            year(m.date_mutation) AS year,
            CASE WHEN month(m.date_mutation) <= 6 THEN 1 ELSE 2 END AS half,
            m.price,
            m.surface_m2,
            m.price / m.surface_m2 AS price_m2,
            CASE m.property_type WHEN 'Appartement' THEN 'apartment' ELSE 'house' END AS property_type,
            CAST(m.rooms AS INTEGER) AS rooms,
            coalesce(c.code_commune, m.code_commune_raw) AS code_commune,
            c.code_arrondissement,
            CASE WHEN m.code_commune_raw LIKE '97%' THEN left(m.code_commune_raw, 3)
                 ELSE left(m.code_commune_raw, 2) END AS code_departement,
            c.region AS code_region,
            m.longitude,
            m.latitude
        FROM per_mutation m
        LEFT JOIN commune_map c ON c.code = m.code_commune_raw
        WHERE m.n_dwellings = 1
          AND m.n_other_premises = 0
          AND m.n_communes = 1
          AND m.price = m.price_max
          AND m.surface_m2 >= {MIN_SURFACE_M2}
          AND m.price >= {MIN_PRICE_EUR}
        """
    )


def export(con: duckdb.DuckDBPyConnection, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY dvf_sales TO '{dest.as_posix()}' (FORMAT parquet, COMPRESSION zstd)")
    return con.execute("SELECT count(*) FROM dvf_sales").fetchone()[0]
