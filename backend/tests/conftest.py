from __future__ import annotations

import pandas as pd
import pytest


def ts(value: str) -> pd.Timestamp:
    return pd.Timestamp(value, tz="UTC")


def forecasts_frame(rows: list[tuple[str, str, float]]) -> pd.DataFrame:
    """Rows of (start_time, publish_time, forecast_mw)."""
    df = pd.DataFrame(rows, columns=["start_time", "publish_time", "forecast_mw"])
    for col in ("start_time", "publish_time"):
        df[col] = pd.to_datetime(df[col], utc=True)
    return df


def actuals_frame(rows: list[tuple[str, float]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["start_time", "actual_mw"])
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    return df


@pytest.fixture
def sample_forecasts() -> pd.DataFrame:
    """Three runs for target 2026-01-15 12:00Z, plus a backfill row."""
    return forecasts_frame(
        [
            ("2026-01-15T12:00Z", "2026-01-13T22:30Z", 9000.0),
            ("2026-01-15T12:00Z", "2026-01-14T07:30Z", 9500.0),
            ("2026-01-15T12:00Z", "2026-01-14T11:30Z", 10000.0),  # after a 09:00 cutoff
            ("2026-01-15T12:00Z", "2026-01-15T13:30Z", 12000.0),  # backfill: after target
        ]
    )
