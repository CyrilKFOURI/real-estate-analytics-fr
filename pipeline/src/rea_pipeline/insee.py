"""INSEE "Comparateur de territoires": population, housing, income and jobs per territory.

S1 ingest + S3 marts M11 (vacancy), M12 (population growth), M13 (income) and context
indicators — docs/KPI_SPEC.md §1. INSEE already publishes every geo level we use, so no
aggregation is done here: values are only reshaped and turned into rates.
"""
import zipfile
from pathlib import Path

import duckdb
import httpx

from . import paths
from .ingest import download

COMPARATEUR_URL = "https://www.insee.fr/fr/statistiques/fichier/2521169/comparateur_csv.zip"
INSEE_DIR = paths.RAW / "insee"
HEADERS = {"User-Agent": "Mozilla/5.0 (rea-pipeline; open data ingestion)"}

# INSEE GEO_OBJECT (+ GEO code for France) -> our geo_level. Codes overlap between levels
# (a "bassin de vie" can be coded 49007 like the commune), so always filter on GEO_OBJECT.
GEO_LEVELS = {"COM": "commune", "ARM": "arrondissement", "DEP": "departement", "REG": "region"}
FRANCE_GEO = "F"  # France incl. overseas; 'FM' is metropolitan only

MEASURES = (
    "POP", "DWELLINGS", "DWELLINGS_OCS_DW_VAC", "DWELLINGS_OCS_DW_MAIN",
    "DWELLINGS_OCS_DW_MAIN_TSH_100", "DWELLINGS_OCS_DW_SEC_DW_OCC",
    "MED_SL", "PR_MD60", "NBEMP_EMPFORM_2",
)
CENSUS_YEAR, PREVIOUS_CENSUS_YEAR = 2023, 2017

# Risk thresholds shown as flags in the app (books: avoid vacancy above ~10 %).
HIGH_VACANCY = 0.10
POPULATION_DECLINE = -0.002  # per year


def ingest_insee() -> dict:
    with httpx.Client(follow_redirects=True, timeout=300, headers=HEADERS) as client:
        archive = INSEE_DIR / "comparateur_csv.zip"
        meta = download(COMPARATEUR_URL, archive, client)
    with zipfile.ZipFile(archive) as zf:
        zf.extract("comparateur.csv", INSEE_DIR)
    return meta


def comparateur_file() -> Path:
    return INSEE_DIR / "comparateur.csv"


def build_socio_kpis(con: duckdb.DuckDBPyConnection, comparateur_csv: Path, run_id: str) -> None:
    """Create table kpi_socio: one row per geo with census, income and jobs indicators."""
    measures = ", ".join(f"'{m}'" for m in MEASURES)
    level_case = " ".join(f"WHEN '{obj}' THEN '{level}'" for obj, level in GEO_LEVELS.items())
    con.execute(
        f"""
        CREATE OR REPLACE TABLE insee_long AS
        SELECT CASE GEO_OBJECT {level_case} WHEN 'FRANCE' THEN 'france' END AS geo_level,
               CASE WHEN GEO_OBJECT = 'FRANCE' THEN 'FR' ELSE GEO END AS geo_code,
               CAST(TIME_PERIOD AS INTEGER) AS year,
               TAB_MEASURE AS measure,
               TRY_CAST(OBS_VALUE AS DOUBLE) AS value
        FROM read_csv('{comparateur_csv.as_posix()}', delim = ';', header = true,
                      all_varchar = true)
        WHERE TAB_MEASURE IN ({measures})
          AND (GEO_OBJECT IN ({", ".join(f"'{o}'" for o in GEO_LEVELS)})
               OR (GEO_OBJECT = 'FRANCE' AND GEO = '{FRANCE_GEO}'))
        """
    )

    def pick(measure: str, year: int | None = CENSUS_YEAR) -> str:
        year_filter = f"AND year = {year}" if year else ""
        return f"max(value) FILTER (WHERE measure = '{measure}' {year_filter})"

    span = CENSUS_YEAR - PREVIOUS_CENSUS_YEAR
    con.execute(
        f"""
        CREATE OR REPLACE TABLE kpi_socio AS
        WITH wide AS (
            SELECT geo_level, geo_code,
                   {pick("POP")} AS population,
                   {pick("POP", PREVIOUS_CENSUS_YEAR)} AS population_prev,
                   {pick("DWELLINGS")} AS dwellings,
                   {pick("DWELLINGS_OCS_DW_VAC")} AS vacant,
                   {pick("DWELLINGS_OCS_DW_VAC", PREVIOUS_CENSUS_YEAR)} AS vacant_prev,
                   {pick("DWELLINGS", PREVIOUS_CENSUS_YEAR)} AS dwellings_prev,
                   {pick("DWELLINGS_OCS_DW_MAIN")} AS main_homes,
                   {pick("DWELLINGS_OCS_DW_MAIN_TSH_100")} AS owner_homes,
                   {pick("DWELLINGS_OCS_DW_SEC_DW_OCC")} AS second_homes,
                   {pick("NBEMP_EMPFORM_2")} AS jobs,
                   {pick("NBEMP_EMPFORM_2", PREVIOUS_CENSUS_YEAR)} AS jobs_prev,
                   -- Filosofi values are missing where INSEE applies statistical secrecy
                   {pick("MED_SL", None)} AS median_living_standard,
                   {pick("PR_MD60", None)} AS poverty_rate_pct
            FROM insee_long GROUP BY geo_level, geo_code
        )
        SELECT geo_level, geo_code,
               {CENSUS_YEAR} AS census_year,
               population,
               pow(population / nullif(population_prev, 0), 1.0 / {span}) - 1 AS population_growth_yearly,
               dwellings,
               vacant / nullif(dwellings, 0) AS vacancy_rate,
               vacant / nullif(dwellings, 0) - vacant_prev / nullif(dwellings_prev, 0) AS vacancy_change_pts,
               second_homes / nullif(dwellings, 0) AS second_home_share,
               1 - owner_homes / nullif(main_homes, 0) AS renter_share,
               median_living_standard,
               poverty_rate_pct / 100 AS poverty_rate,
               jobs,
               pow(jobs / nullif(jobs_prev, 0), 1.0 / {span}) - 1 AS jobs_growth_yearly,
               vacant / nullif(dwellings, 0) > {HIGH_VACANCY} AS flag_high_vacancy,
               pow(population / nullif(population_prev, 0), 1.0 / {span}) - 1
                   < {POPULATION_DECLINE} AS flag_population_decline,
               '{run_id}' AS run_id
        FROM wide
        WHERE geo_level IS NOT NULL AND population IS NOT NULL
        """
    )


def export_published(con: duckdb.DuckDBPyConnection, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    con.execute(
        f"COPY (SELECT * FROM kpi_socio ORDER BY geo_level, geo_code) "
        f"TO '{dest.as_posix()}' (FORMAT parquet, COMPRESSION zstd)"
    )
    return con.execute("SELECT count(*) FROM kpi_socio").fetchone()[0]
