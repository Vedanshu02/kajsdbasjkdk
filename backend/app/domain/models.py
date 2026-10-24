"""Domain records and the canonical DataFrame schemas used throughout the app.

Canonical frames (all timestamps are tz-aware UTC):

* actuals:   ``start_time``, ``actual_mw``                    (30-min resolution)
* forecasts: ``start_time``, ``publish_time``, ``forecast_mw`` (60-min resolution)
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime

import pandas as pd
from pydantic import BaseModel, ConfigDict, Field

ACTUAL_COLUMNS = ["start_time", "actual_mw"]
FORECAST_COLUMNS = ["start_time", "publish_time", "forecast_mw"]


class ActualRecord(BaseModel):
    """One FUELHH row (wind only)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    start_time: datetime = Field(alias="startTime")
    publish_time: datetime = Field(alias="publishTime")
    fuel_type: str = Field(alias="fuelType")
    generation: float


class ForecastRecord(BaseModel):
    """One WINDFOR row."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    start_time: datetime = Field(alias="startTime")
    publish_time: datetime = Field(alias="publishTime")
    generation: float


def actuals_to_frame(records: Iterable[ActualRecord]) -> pd.DataFrame:
    """Build the canonical actuals frame; keep the latest publication per period."""
    rows = [(r.start_time, r.publish_time, r.generation) for r in records if r.fuel_type == "WIND"]
    df = pd.DataFrame(rows, columns=["start_time", "publish_time", "actual_mw"])
    df = _utc(df, ["start_time", "publish_time"])
    df = (
        df.sort_values(["start_time", "publish_time"])
        .drop_duplicates("start_time", keep="last")
        .loc[:, ACTUAL_COLUMNS]
        .astype({"actual_mw": "float64"})
        .reset_index(drop=True)
    )
    return df


def forecasts_to_frame(records: Iterable[ForecastRecord]) -> pd.DataFrame:
    """Build the canonical forecasts frame; one value per (target, run)."""
    rows = [(r.start_time, r.publish_time, r.generation) for r in records]
    df = pd.DataFrame(rows, columns=FORECAST_COLUMNS)
    df = _utc(df, ["start_time", "publish_time"])
    df = (
        df.drop_duplicates(["start_time", "publish_time"], keep="last")
        .sort_values(["start_time", "publish_time"])
        .astype({"forecast_mw": "float64"})
        .reset_index(drop=True)
    )
    return df


def _utc(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    for col in cols:
        df[col] = pd.to_datetime(df[col], utc=True).astype("datetime64[ns, UTC]")
    return df
