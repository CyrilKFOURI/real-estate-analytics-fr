"""S1: download upstream files into data/raw with metadata; skip files whose ETag is unchanged."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import httpx

from . import paths

DVF_YEARS = [2021, 2022, 2023, 2024, 2025]
DVF_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/full.csv.gz"
COMMUNES_URL = "https://unpkg.com/@etalab/decoupage-administratif@6.0.0/data/communes.json"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, dest: Path, client: httpx.Client) -> dict:
    """Download url to dest unless the stored metadata says the remote ETag is unchanged."""
    meta_path = dest.with_name(dest.name + ".meta.json")
    head = client.head(url)
    head.raise_for_status()
    etag = head.headers.get("etag")
    if dest.exists() and meta_path.exists():
        meta = json.loads(meta_path.read_text())
        if etag and meta.get("etag") == etag:
            return meta | {"skipped": True}

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    with client.stream("GET", url) as response:
        response.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in response.iter_bytes(1 << 20):
                f.write(chunk)
    tmp.replace(dest)

    meta = {
        "url": url,
        "etag": etag,
        "sha256": _sha256(dest),
        "bytes": dest.stat().st_size,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
    }
    meta_path.write_text(json.dumps(meta, indent=2))
    return meta | {"skipped": False}


def dvf_files() -> list[Path]:
    return [paths.RAW / "dvf" / f"{year}.csv.gz" for year in DVF_YEARS]


def communes_file() -> Path:
    return paths.RAW / "refs" / "communes.json"


def ingest_dvf() -> list[dict]:
    with httpx.Client(follow_redirects=True, timeout=600) as client:
        return [
            download(DVF_URL.format(year=year), dest, client)
            for year, dest in zip(DVF_YEARS, dvf_files())
        ]


def ingest_refs() -> dict:
    with httpx.Client(follow_redirects=True, timeout=120) as client:
        return download(COMMUNES_URL, communes_file(), client)
