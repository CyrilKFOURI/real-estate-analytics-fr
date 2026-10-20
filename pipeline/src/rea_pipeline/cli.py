"""Command line entry point: `uv run rea <command>` (see docs/PIPELINE_RUN_SPEC.md §6).

Stages run strictly in order S0 → S1 → S2 → V1 → S3 → V2 → publish; any failed gate stops
the run and leaves the previously published marts untouched.
"""
import argparse
import json
import shutil
import sys
import time
from datetime import datetime, timezone

import duckdb

from . import clean, geo, ingest, insee, marts, paths, publish, refs, rents, validate

PUBLISHED_PRICE_KPIS = paths.MARTS / "kpi_price.parquet"
PUBLISHED_YIELD_KPIS = paths.MARTS / "kpi_yield.parquet"
PUBLISHED_SOCIO_KPIS = paths.MARTS / "kpi_socio.parquet"
APP_PUBLIC_DATA = paths.ROOT.parent / "apps" / "app" / "public" / "data"


class GateFailed(Exception):
    pass


def _gate(name: str, checks: list[validate.Check], report: dict) -> None:
    report["gates"][name] = [{"check": c, "ok": ok, "detail": d} for c, ok, d in checks]
    for check, ok, detail in checks:
        print(f"  [{'OK ' if ok else 'FAIL'}] {check}: {detail}")
    if not all(ok for _, ok, _ in checks):
        raise GateFailed(name)


def build_dvf(skip_ingest: bool) -> int:
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = paths.RUNS / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    report: dict = {"run_id": run_id, "stages": {}, "gates": {}}
    started = time.perf_counter()

    def stage(name: str, result) -> None:
        report["stages"][name] = {"seconds": round(time.perf_counter() - started, 1), "result": result}
        print(f"[{name}] done at {report['stages'][name]['seconds']}s")

    con = duckdb.connect(str(run_dir / "work.duckdb"))
    status = 0
    try:
        if not skip_ingest:
            stage("S1 ingest refs", ingest.ingest_refs())
            stage("S1 ingest dvf", ingest.ingest_dvf())
            stage("S1 ingest geo-dvf", geo.ingest_geo_dvf())
            stage("S1 ingest rents", rents.ingest_rents())
            stage("S1 ingest insee", insee.ingest_insee())
        refs.build_commune_map(con, ingest.communes_file())
        stage("S0 refs", con.execute("SELECT count(*) FROM commune_map").fetchone()[0])

        geo.build_location_tables(con, geo.geo_dvf_files())
        stage("S0 locations", con.execute("SELECT count(*) FROM section_point").fetchone()[0])
        geo.export_location_tables(con, paths.MARTS)

        clean.load_raw(con, ingest.dvf_files())
        stage("S2 load raw", con.execute("SELECT count(*) FROM dvf_raw").fetchone()[0])
        clean.build_sales(con)
        n_sales = clean.export(con, paths.CLEAN / "dvf" / "sales.parquet")
        stage("S2 clean", n_sales)
        _gate("V1", validate.check_clean(con), report)

        marts.build_price_kpis(con, run_id)
        stage("S3 marts", con.execute("SELECT count(*) FROM kpi_price").fetchone()[0])
        _gate(
            "V2",
            validate.check_reference_bands(con)
            + validate.check_national_drift(con, PUBLISHED_PRICE_KPIS),
            report,
        )

        vintage = rents.edition()
        rents.load_rents(con, rents.RENTS_DIR / str(vintage), vintage)
        rents.build_yield_kpis(con)
        stage("S3 yields", con.execute("SELECT count(*) FROM kpi_yield").fetchone()[0])
        _gate("V3", validate.check_yields(con), report)

        insee.build_socio_kpis(con, insee.comparateur_file(), run_id)
        stage("S3 socio", con.execute("SELECT count(*) FROM kpi_socio").fetchone()[0])
        _gate("V4", validate.check_socio(con), report)

        # publish atomically: write every file next to its target, then rename them all
        price_next = PUBLISHED_PRICE_KPIS.with_name("kpi_price.next.parquet")
        yield_next = PUBLISHED_YIELD_KPIS.with_name("kpi_yield.next.parquet")
        stage("publish prices", marts.export_published(con, price_next))
        socio_next = PUBLISHED_SOCIO_KPIS.with_name("kpi_socio.next.parquet")
        stage("publish yields", rents.export_published(con, yield_next, marts.MIN_PUBLISHED_SALES))
        stage("publish socio", insee.export_published(con, socio_next))
        price_next.replace(PUBLISHED_PRICE_KPIS)
        yield_next.replace(PUBLISHED_YIELD_KPIS)
        socio_next.replace(PUBLISHED_SOCIO_KPIS)
        stage("S5 publish json", publish.publish(con, marts.MIN_PUBLISHED_SALES, run_id))
        report["status"] = "success"
    except GateFailed as failed:
        report["status"] = f"failed at gate {failed}"
        print(f"Run stopped: gate {failed} failed; published marts unchanged.", file=sys.stderr)
        status = 1
    finally:
        con.close()
        (run_dir / "manifest.json").write_text(json.dumps(report, indent=2, default=str))
        (run_dir / "work.duckdb").unlink(missing_ok=True)
    print(f"Run {run_id}: {report['status']} — report in {run_dir}")
    return status


def main() -> None:
    parser = argparse.ArgumentParser(prog="rea")
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="run the full DVF pipeline S0→publish")
    build.add_argument("--skip-ingest", action="store_true", help="reuse files already in data/raw")
    sub.add_parser("ingest", help="S1 only: download refs, DVF, rents and INSEE")
    sub.add_parser("clean-runs", help="delete run folders of failed runs")
    sub.add_parser("sync-app", help="copy data/serve into apps/app/public/data")
    sub.add_parser("publish", help="S5 only: rebuild data/serve from the published marts")
    sub.add_parser("locations", help="rebuild and export section/commune points from geo-DVF only")
    args = parser.parse_args()

    if args.command == "build":
        sys.exit(build_dvf(args.skip_ingest))
    if args.command == "ingest":
        print(json.dumps([ingest.ingest_refs(), *ingest.ingest_dvf(), rents.ingest_rents(),
                          insee.ingest_insee()],
                         indent=2, default=str))
    if args.command == "publish":
        con = duckdb.connect()
        refs.build_commune_map(con, ingest.communes_file())
        for table, path in (("kpi_price", PUBLISHED_PRICE_KPIS), ("kpi_yield", PUBLISHED_YIELD_KPIS),
                            ("kpi_socio", PUBLISHED_SOCIO_KPIS)):
            con.execute(f"CREATE TABLE {table} AS SELECT * FROM '{path.as_posix()}'")
        run_id = con.execute("SELECT any_value(run_id) FROM kpi_price").fetchone()[0]
        print(json.dumps(publish.publish(con, marts.MIN_PUBLISHED_SALES, run_id), indent=2))
    if args.command == "locations":
        con = duckdb.connect()
        geo.build_location_tables(con, geo.geo_dvf_files())
        geo.export_location_tables(con, paths.MARTS)
        print(f"Exported section_point and commune_point to {paths.MARTS}")
    if args.command == "sync-app":
        publish.sync_app(APP_PUBLIC_DATA)
        print(f"Copied {paths.SERVE} -> {APP_PUBLIC_DATA}")
    if args.command == "clean-runs":
        for run in paths.RUNS.glob("*"):
            manifest = run / "manifest.json"
            if manifest.exists() and json.loads(manifest.read_text()).get("status") != "success":
                shutil.rmtree(run)
