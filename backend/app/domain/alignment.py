"""Align half-hourly actuals with hourly selected forecasts."""

from __future__ import annotations

import pandas as pd

COMPARISON_COLUMNS = [
    "start_time",
    "actual_mw",
    "forecast_mw",
    "error_mw",
    "publish_time",
    "horizon_h",
]


def forecast_targets(actuals: pd.DataFrame) -> pd.Series:
    """Hourly target times (the WINDFOR grid) covered by the actuals."""
    hourly = actuals.loc[actuals["start_time"].dt.minute == 0, "start_time"]
    result: pd.Series = hourly.reset_index(drop=True)
    return result


def build_comparison(
    actuals: pd.DataFrame, selected: pd.DataFrame, interpolate: bool = False
) -> pd.DataFrame:
    """Join actuals and selected forecasts; ``error_mw = forecast_mw - actual_mw``.

    By default only on-the-hour periods are compared, so no forecast values are
    invented. With ``interpolate=True`` the hourly forecast is linearly
    interpolated onto the :30 periods (publish metadata is carried forward).
    """
    df = actuals.merge(selected.drop(columns=["cutoff"]), on="start_time", how="left")
    if interpolate:
        df = df.sort_values("start_time").set_index("start_time")
        df["forecast_mw"] = df["forecast_mw"].interpolate(
            method="time", limit=1, limit_area="inside"
        )
        df[["publish_time", "horizon_h"]] = df[["publish_time", "horizon_h"]].ffill(limit=1)
        df = df.reset_index()
    else:
        df = df.loc[df["start_time"].dt.minute == 0]

    df["error_mw"] = df["forecast_mw"] - df["actual_mw"]
    return df.loc[:, COMPARISON_COLUMNS].reset_index(drop=True)
