"""Forecast selection: which WINDFOR run was "the latest available" for each target time.

Core rule, for target time ``t`` and cutoff ``c``::

    F(t, c) = forecast for startTime == t from the run with the greatest
              publishTime such that publishTime <= c and publishTime <= t

Runs published after the target (``publishTime > startTime``) are backfill, not
forecasts, and are never selected. Everything here is pure and side-effect free.
"""

from __future__ import annotations

from datetime import time

import pandas as pd

SELECTED_COLUMNS = ["start_time", "cutoff", "forecast_mw", "publish_time", "horizon_h"]


def day_ahead_cutoffs(
    start_times: pd.Series, cutoff_time: time, tz: str = "Europe/London"
) -> pd.Series:
    """Cutoff for each target: ``cutoff_time`` (market local) on the day before delivery.

    The delivery day is the *local* calendar date of the target, matching GB
    settlement days, so this stays correct across BST transitions.
    """
    local = start_times.dt.tz_convert(tz)
    decision_day = local.dt.normalize().dt.tz_localize(None) - pd.Timedelta(days=1)
    naive_cutoff = decision_day + pd.Timedelta(hours=cutoff_time.hour, minutes=cutoff_time.minute)
    cutoff = naive_cutoff.dt.tz_localize(tz, ambiguous="NaT", nonexistent="shift_forward")
    result: pd.Series = cutoff.dt.tz_convert("UTC")
    return result


def horizon_cutoffs(start_times: pd.Series, horizon_h: float) -> pd.Series:
    """Cutoff for each target: ``horizon_h`` hours before the target."""
    return start_times - pd.Timedelta(hours=horizon_h)


def select_latest_before(
    forecasts: pd.DataFrame, start_times: pd.Series, cutoffs: pd.Series
) -> pd.DataFrame:
    """For each (target, cutoff) pair, pick the latest valid run published by the cutoff.

    Targets with no qualifying run get NaN ``forecast_mw`` (they are kept so that
    callers can report coverage).
    """
    targets = pd.DataFrame(
        {"start_time": start_times.to_numpy(), "cutoff": cutoffs.to_numpy()}
    ).astype({"start_time": "datetime64[ns, UTC]", "cutoff": "datetime64[ns, UTC]"})

    valid = forecasts.loc[forecasts["publish_time"] <= forecasts["start_time"]]
    valid = valid.sort_values("publish_time")

    known = targets.dropna(subset=["cutoff"]).sort_values("cutoff")
    merged = pd.merge_asof(
        known,
        valid,
        left_on="cutoff",
        right_on="publish_time",
        by="start_time",
        direction="backward",
    )
    out = targets.merge(merged, on=["start_time", "cutoff"], how="left")
    out["horizon_h"] = (out["start_time"] - out["publish_time"]).dt.total_seconds() / 3600
    return out.loc[:, SELECTED_COLUMNS].sort_values("start_time").reset_index(drop=True)


def select_day_ahead(
    forecasts: pd.DataFrame,
    start_times: pd.Series,
    cutoff_time: time,
    tz: str = "Europe/London",
) -> pd.DataFrame:
    """Forecast the desk would have seen at the D-1 decision cutoff."""
    return select_latest_before(
        forecasts, start_times, day_ahead_cutoffs(start_times, cutoff_time, tz)
    )


def select_at_horizon(
    forecasts: pd.DataFrame, start_times: pd.Series, horizon_h: float
) -> pd.DataFrame:
    """Latest forecast published at least ``horizon_h`` hours before each target."""
    return select_latest_before(forecasts, start_times, horizon_cutoffs(start_times, horizon_h))
