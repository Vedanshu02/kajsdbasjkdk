"""Forecast error metrics.

Sign convention: ``error = forecast - actual``. A positive error means wind was
over-forecast, so less wind arrived than planned and the desk is short.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import numpy as np
import pandas as pd

# Below this actual output, percentage errors are meaningless and are excluded from MAPE.
DEFAULT_MAPE_FLOOR_MW = 1000.0


@dataclass(frozen=True)
class ErrorSummary:
    count: int
    missing: int
    mean_actual_mw: float | None
    mean_forecast_mw: float | None
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    nmae_pct: float | None
    mape_pct: float | None
    mape_excluded: int
    p50_abs_mw: float | None
    p90_abs_mw: float | None
    p95_abs_mw: float | None
    max_abs_mw: float | None
    p05_error_mw: float | None
    p95_error_mw: float | None
    correlation: float | None

    def to_dict(self) -> dict[str, float | int | None]:
        return asdict(self)


def _f(value: float) -> float | None:
    return None if value is None or not np.isfinite(value) else round(float(value), 3)


def summarize(df: pd.DataFrame, mape_floor_mw: float = DEFAULT_MAPE_FLOOR_MW) -> ErrorSummary:
    """Summary statistics over a comparison frame (see ``alignment.build_comparison``)."""
    valid = df.dropna(subset=["actual_mw", "forecast_mw"])
    missing = len(df) - len(valid)
    if valid.empty:
        return ErrorSummary(
            count=0,
            missing=missing,
            mean_actual_mw=None,
            mean_forecast_mw=None,
            mae_mw=None,
            rmse_mw=None,
            bias_mw=None,
            nmae_pct=None,
            mape_pct=None,
            mape_excluded=0,
            p50_abs_mw=None,
            p90_abs_mw=None,
            p95_abs_mw=None,
            max_abs_mw=None,
            p05_error_mw=None,
            p95_error_mw=None,
            correlation=None,
        )

    actual = valid["actual_mw"].to_numpy(dtype=float)
    forecast = valid["forecast_mw"].to_numpy(dtype=float)
    err = forecast - actual
    abs_err = np.abs(err)

    mape_mask = actual >= mape_floor_mw
    mape = (
        float(np.mean(abs_err[mape_mask] / actual[mape_mask]) * 100) if mape_mask.any() else np.nan
    )
    has_spread = len(valid) > 1 and actual.std() > 0 and forecast.std() > 0
    corr = float(np.corrcoef(actual, forecast)[0, 1]) if has_spread else np.nan
    mean_actual = float(actual.mean())

    return ErrorSummary(
        count=len(valid),
        missing=missing,
        mean_actual_mw=_f(mean_actual),
        mean_forecast_mw=_f(float(forecast.mean())),
        mae_mw=_f(float(abs_err.mean())),
        rmse_mw=_f(float(np.sqrt(np.mean(err**2)))),
        bias_mw=_f(float(err.mean())),
        nmae_pct=_f(float(abs_err.mean() / mean_actual * 100)) if mean_actual else None,
        mape_pct=_f(mape),
        mape_excluded=int((~mape_mask).sum()),
        p50_abs_mw=_f(float(np.percentile(abs_err, 50))),
        p90_abs_mw=_f(float(np.percentile(abs_err, 90))),
        p95_abs_mw=_f(float(np.percentile(abs_err, 95))),
        max_abs_mw=_f(float(abs_err.max())),
        p05_error_mw=_f(float(np.percentile(err, 5))),
        p95_error_mw=_f(float(np.percentile(err, 95))),
        correlation=_f(corr),
    )


def summarize_by(df: pd.DataFrame, key: pd.Series, key_name: str) -> list[dict[str, Any]]:
    """One summary row per group, e.g. per hour of day or per delivery day."""
    rows: list[dict[str, Any]] = []
    for value, group in df.groupby(key.to_numpy(), sort=True):
        rows.append({key_name: value, **summarize(group).to_dict()})
    return rows


def error_histogram(df: pd.DataFrame, bins: int = 40) -> dict[str, list[float] | list[int]]:
    """Histogram of signed error; symmetric bin edges so zero sits on an edge."""
    err = df["error_mw"].dropna().to_numpy(dtype=float)
    if err.size == 0:
        return {"edges": [], "counts": []}
    bound = float(np.ceil(np.abs(err).max() / 500) * 500) or 500.0
    counts, edges = np.histogram(err, bins=bins, range=(-bound, bound))
    return {"edges": [round(float(e), 1) for e in edges], "counts": [int(c) for c in counts]}


def planning_band(
    forecast_mw: pd.Series, p05_error_mw: float, p95_error_mw: float
) -> tuple[pd.Series, pd.Series]:
    """Range of likely actuals given a forecast and the historical error spread.

    With ``error = forecast - actual``: ``actual = forecast - error``, so the
    5-95% error interval maps to ``[forecast - p95, forecast - p05]``. Output is
    clipped at zero (wind cannot generate negative power).
    """
    low = (forecast_mw - p95_error_mw).clip(lower=0)
    high = (forecast_mw - p05_error_mw).clip(lower=0)
    return low, high
