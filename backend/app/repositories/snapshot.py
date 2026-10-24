"""Snapshot repository: serves the committed CSV files produced by scripts/ingest.py."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

import pandas as pd

from app.core.errors import DataUnavailableError

ACTUALS_FILE = "actuals.csv"
FORECASTS_FILE = "forecasts.csv"
TIME_COLUMNS = ("start_time", "publish_time")
MANIFEST_FILE = "manifest.json"


def write_frame(df: pd.DataFrame, path: Path) -> None:
    """Write a canonical frame as CSV with ISO-8601 UTC timestamps (stable, diffable)."""
    out = df.copy()
    for col in TIME_COLUMNS:
        if col in out:
            out[col] = out[col].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    out.to_csv(path, index=False, lineterminator="\n")


def read_frame(path: Path) -> pd.DataFrame:
    """Inverse of ``write_frame``: restores tz-aware UTC timestamps and float MW."""
    df = pd.read_csv(path)
    for col in TIME_COLUMNS:
        if col in df:
            df[col] = pd.to_datetime(df[col], utc=True).astype("datetime64[ns, UTC]")
    for col in df.columns:
        if col.endswith("_mw"):
            df[col] = df[col].astype("float64")
    return df


class SnapshotRepository:
    source_name = "snapshot"

    def __init__(self, data_dir: Path) -> None:
        self._dir = data_dir
        self._lock = threading.Lock()
        self._cache: dict[str, Any] = {}

    def _read(self, key: str) -> Any:
        with self._lock:
            if key not in self._cache:
                path = self._dir / key
                if not path.exists():
                    raise DataUnavailableError(
                        f"Snapshot file missing: {path.name}. Run `python -m scripts.ingest`."
                    )
                if key.endswith(".csv"):
                    self._cache[key] = read_frame(path)
                else:
                    self._cache[key] = json.loads(path.read_text(encoding="utf-8"))
            return self._cache[key]

    def actuals(self) -> pd.DataFrame:
        df: pd.DataFrame = self._read(ACTUALS_FILE)
        return df

    def forecasts(self) -> pd.DataFrame:
        df: pd.DataFrame = self._read(FORECASTS_FILE)
        return df

    def manifest(self) -> dict[str, Any]:
        manifest: dict[str, Any] = self._read(MANIFEST_FILE)
        return {"source": "snapshot", **manifest}
