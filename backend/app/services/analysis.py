"""Use-cases behind the API: day-ahead view, accuracy metrics and breakdowns.

The service owns orchestration (filtering, caching, choosing a selection mode);
all numerical logic lives in ``app.domain``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from typing import Any, Literal

import pandas as pd

from app.core.config import Settings
from app.core.errors import OutOfRangeError
from app.domain.alignment import build_comparison, forecast_targets
from app.domain.metrics import (
    ErrorSummary,
    error_histogram,
    planning_band,
    summarize,
    summarize_by,
)
from app.domain.selection import select_at_horizon, select_day_ahead
from app.repositories.base import DataRepository

Mode = Literal["day_ahead", "horizon"]


def records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """DataFrame -> JSON-safe records (NaN/NaT become None)."""
    # pandas-stubs does not accept None as `other`, but pandas supports it.
    safe = df.astype(object).where(df.notna(), None)  # type: ignore[call-overload]
    out: list[dict[str, Any]] = safe.to_dict("records")
    return out


@dataclass(frozen=True)
class Selection:
    """How forecasts are chosen for comparison (hashable, so usable as a cache key)."""

    mode: Mode
    cutoff_time: time
    horizon_h: int
    interpolate: bool = False


class AnalysisService:
    def __init__(self, repo: DataRepository, settings: Settings) -> None:
        self._repo = repo
        self._settings = settings
        self._tz = settings.market_timezone
        self._comparison_cached = lru_cache(maxsize=128)(self._comparison_full)

    # ------------------------------------------------------------------ helpers
    def _check_range(self, start: date, end: date) -> None:
        s = self._settings
        if start > end:
            raise OutOfRangeError(f"start ({start}) is after end ({end})")
        if start < s.delivery_start or end > s.delivery_end:
            raise OutOfRangeError(
                f"Dates must be within {s.delivery_start} and {s.delivery_end} (delivery days)"
            )

    def _local_dates(self, ts: pd.Series) -> pd.Series:
        result: pd.Series = ts.dt.tz_convert(self._tz).dt.date
        return result

    def _comparison_full(self, sel: Selection) -> pd.DataFrame:
        actuals = self._repo.actuals()
        forecasts = self._repo.forecasts()
        targets = forecast_targets(actuals)
        if sel.mode == "day_ahead":
            selected = select_day_ahead(forecasts, targets, sel.cutoff_time, self._tz)
        else:
            selected = select_at_horizon(forecasts, targets, sel.horizon_h)
        return build_comparison(actuals, selected, interpolate=sel.interpolate)

    def comparison(self, start: date, end: date, sel: Selection) -> pd.DataFrame:
        self._check_range(start, end)
        df = self._comparison_cached(sel)
        local = self._local_dates(df["start_time"])
        return df.loc[(local >= start) & (local <= end)].reset_index(drop=True)

    # ---------------------------------------------------------------- use-cases
    def meta(self) -> dict[str, Any]:
        s = self._settings
        return {
            "delivery_start": s.delivery_start,
            "delivery_end": s.delivery_end,
            "default_cutoff_time": s.default_cutoff_time.strftime("%H:%M"),
            "timezone": s.market_timezone,
            "min_horizon_h": s.min_horizon_h,
            "max_horizon_h": s.max_horizon_h,
            "data": self._repo.manifest(),
        }

    def summary(self, start: date, end: date, sel: Selection) -> ErrorSummary:
        return summarize(self.comparison(start, end, sel))

    def by_hour(self, start: date, end: date, sel: Selection) -> list[dict[str, Any]]:
        df = self.comparison(start, end, sel)
        hours = df["start_time"].dt.tz_convert(self._tz).dt.hour
        return summarize_by(df, hours, "hour")

    def daily(self, start: date, end: date, sel: Selection) -> list[dict[str, Any]]:
        df = self.comparison(start, end, sel)
        return summarize_by(df, self._local_dates(df["start_time"]), "date")

    def distribution(self, start: date, end: date, sel: Selection, bins: int) -> dict[str, Any]:
        return error_histogram(self.comparison(start, end, sel), bins=bins)

    def by_horizon(self, start: date, end: date, horizons: list[int]) -> list[dict[str, Any]]:
        rows = []
        for h in horizons:
            sel = Selection(
                mode="horizon", cutoff_time=self._settings.default_cutoff_time, horizon_h=h
            )
            rows.append({"horizon_h": h, **self.summary(start, end, sel).to_dict()})
        return rows

    def series(self, start: date, end: date, sel: Selection) -> dict[str, Any]:
        self._check_range(start, end)
        actuals = self._repo.actuals()
        local = self._local_dates(actuals["start_time"])
        actuals = actuals.loc[(local >= start) & (local <= end)]
        return {
            "actuals": records(actuals),
            "points": records(self.comparison(start, end, sel)),
        }

    def day_ahead(self, delivery_date: date, cutoff_time: time) -> dict[str, Any]:
        """Everything the Decision view needs for one delivery day."""
        s = self._settings
        sel = Selection(mode="day_ahead", cutoff_time=cutoff_time, horizon_h=0)
        day = self.comparison(delivery_date, delivery_date, sel)

        # Planning band: historical day-ahead error spread over the whole window
        # (in-sample for v1; a rolling out-of-sample window is the production upgrade).
        history = self.summary(s.delivery_start, s.delivery_end, sel)
        p05 = history.p05_error_mw or 0.0
        p95 = history.p95_error_mw or 0.0
        day["band_low_mw"], day["band_high_mw"] = planning_band(day["forecast_mw"], p05, p95)

        actuals = self.series(delivery_date, delivery_date, sel)["actuals"]
        fc = day.dropna(subset=["forecast_mw"])
        peak = fc.loc[fc["forecast_mw"].idxmax()] if not fc.empty else None
        trough = fc.loc[fc["forecast_mw"].idxmin()] if not fc.empty else None
        runs = sorted(fc["publish_time"].dropna().unique().tolist())

        cutoff_utc = (
            pd.Timestamp(datetime.combine(delivery_date - timedelta(days=1), cutoff_time))
            .tz_localize(self._tz)
            .tz_convert("UTC")
        )
        return {
            "delivery_date": delivery_date,
            "cutoff_time": cutoff_time.strftime("%H:%M"),
            "cutoff_utc": cutoff_utc,
            "timezone": self._tz,
            "forecast": {
                "energy_mwh": round(float(fc["forecast_mw"].sum()), 1),  # hourly MW x 1 h
                "mean_mw": round(float(fc["forecast_mw"].mean()), 1) if not fc.empty else None,
                "peak_mw": float(peak["forecast_mw"]) if peak is not None else None,
                "peak_time": peak["start_time"] if peak is not None else None,
                "trough_mw": float(trough["forecast_mw"]) if trough is not None else None,
                "trough_time": trough["start_time"] if trough is not None else None,
                "runs_used": runs,
                "min_horizon_h": float(fc["horizon_h"].min()) if not fc.empty else None,
                "max_horizon_h": float(fc["horizon_h"].max()) if not fc.empty else None,
                "coverage": f"{len(fc)}/{len(day)}",
            },
            "band": {
                "p05_error_mw": p05,
                "p95_error_mw": p95,
                "bias_mw": history.bias_mw,
                "mae_mw": history.mae_mw,
                "basis": "day-ahead, full window",
            },
            "hindsight": summarize(day).to_dict(),
            "points": records(day),
            "actuals": actuals,
        }
