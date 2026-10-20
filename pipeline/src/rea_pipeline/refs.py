"""S0: commune reference table mapping any historical or sub-commune code to its current commune."""
from pathlib import Path

import duckdb

# DVF publishes no data for Alsace-Moselle and Mayotte (Livre foncier regime).
NO_DATA_DEPARTEMENTS = ("57", "67", "68", "976")


def build_commune_map(con: duckdb.DuckDBPyConnection, communes_json: Path) -> None:
    """Create table commune_map(code, code_commune, code_arrondissement, nom, departement, region).

    - commune-actuelle -> itself
    - commune-deleguee / commune-associee -> its chefLieu (merged communes)
    - arrondissement-municipal (Paris/Lyon/Marseille) -> parent commune, own code kept
      as code_arrondissement
    """
    con.execute(
        f"""
        CREATE OR REPLACE TABLE commune_map AS
        SELECT
            code,
            CASE type
                WHEN 'commune-actuelle' THEN code
                WHEN 'arrondissement-municipal' THEN commune
                ELSE chefLieu
            END AS code_commune,
            CASE WHEN type = 'arrondissement-municipal' THEN code END AS code_arrondissement,
            nom,
            departement,
            region
        FROM read_json_auto('{communes_json.as_posix()}')
        -- a merged commune's chef-lieu keeps its code as both actuelle and deleguee:
        -- keep one row per code, current commune first
        QUALIFY row_number() OVER (
            PARTITION BY code ORDER BY type <> 'commune-actuelle', type <> 'arrondissement-municipal'
        ) = 1
        """
    )
