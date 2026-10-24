"""Fetch FUELHH (wind) and WINDFOR from Elexon and write the committed snapshot.

Usage (from ``backend/``)::

    python -m scripts.ingest            # writes data/*.csv + data/manifest.json
    python -m scripts.ingest --out DIR  # write somewhere else
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.domain.models import actuals_to_frame, forecasts_to_frame
from app.repositories.elexon import FUELHH_PATH, WINDFOR_PATH, ElexonClient, window_bounds
from app.repositories.snapshot import ACTUALS_FILE, FORECASTS_FILE, MANIFEST_FILE, write_frame

logger = logging.getLogger("ingest")


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _sanity_report(actuals: pd.DataFrame, forecasts: pd.DataFrame) -> dict[str, object]:
    expected = pd.date_range(
        actuals["start_time"].min(), actuals["start_time"].max(), freq="30min", tz="UTC"
    )
    missing_actuals = expected.difference(pd.DatetimeIndex(actuals["start_time"]))
    horizon_h = (forecasts["start_time"] - forecasts["publish_time"]).dt.total_seconds() / 3600
    runs = forecasts["publish_time"].nunique()
    return {
        "actual_periods": len(actuals),
        "actual_missing_periods": len(missing_actuals),
        "actual_mw_range": [float(actuals["actual_mw"].min()), float(actuals["actual_mw"].max())],
        "forecast_rows": len(forecasts),
        "forecast_runs": int(runs),
        "forecast_negative_horizon_rows": int((horizon_h < 0).sum()),
        "forecast_max_horizon_h": float(horizon_h.max()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    settings = get_settings()
    parser.add_argument("--out", type=Path, default=settings.data_dir)
    args = parser.parse_args()
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    configure_logging("INFO")
    a_from, a_to, f_from, f_to = window_bounds(settings)

    with ElexonClient(settings.elexon_base_url, settings.elexon_timeout_s) as client:
        logger.info("Fetching FUELHH (WIND) %s..%s", a_from, a_to)
        actuals = actuals_to_frame(client.fetch_actuals(a_from, a_to))
        logger.info("Fetching WINDFOR published %s..%s", f_from, f_to)
        forecasts = forecasts_to_frame(client.fetch_forecasts(f_from, f_to))

    write_frame(actuals, out / ACTUALS_FILE)
    write_frame(forecasts, out / FORECASTS_FILE)

    report = _sanity_report(actuals, forecasts)
    manifest = {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": {
            "actuals": {
                "url": settings.elexon_base_url + FUELHH_PATH,
                "params": {
                    "settlementDateFrom": str(a_from),
                    "settlementDateTo": str(a_to),
                    "fuelType": "WIND",
                },
            },
            "forecasts": {
                "url": settings.elexon_base_url + WINDFOR_PATH,
                "params": {
                    "publishDateTimeFrom": f_from.isoformat(),
                    "publishDateTimeTo": f_to.isoformat(),
                },
            },
        },
        "files": {
            ACTUALS_FILE: {"rows": len(actuals), "sha256": _sha256(out / ACTUALS_FILE)},
            FORECASTS_FILE: {"rows": len(forecasts), "sha256": _sha256(out / FORECASTS_FILE)},
        },
        "quality": report,
    }
    (out / MANIFEST_FILE).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    logger.info("Snapshot written to %s: %s", out, json.dumps(report))


if __name__ == "__main__":
    main()
