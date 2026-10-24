from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from app.domain.alignment import build_comparison, forecast_targets
from app.domain.metrics import error_histogram, planning_band, summarize, summarize_by
from tests.conftest import actuals_frame


def _selected(rows: list[tuple[str, float | None]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["start_time", "forecast_mw"])
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    df["cutoff"] = df["start_time"] - pd.Timedelta(hours=24)
    df["publish_time"] = df["start_time"] - pd.Timedelta(hours=25)
    df["horizon_h"] = 25.0
    return df


@pytest.fixture
def actuals() -> pd.DataFrame:
    return actuals_frame(
        [
            ("2026-01-15T10:00Z", 1000.0),
            ("2026-01-15T10:30Z", 1100.0),
            ("2026-01-15T11:00Z", 1200.0),
            ("2026-01-15T11:30Z", 1300.0),
        ]
    )


class TestAlignment:
    def test_forecast_targets_are_on_the_hour(self, actuals: pd.DataFrame) -> None:
        assert [t.minute for t in forecast_targets(actuals)] == [0, 0]

    def test_hourly_comparison_and_sign_convention(self, actuals: pd.DataFrame) -> None:
        sel = _selected([("2026-01-15T10:00Z", 1500.0), ("2026-01-15T11:00Z", 1000.0)])
        cmp = build_comparison(actuals, sel)
        assert len(cmp) == 2
        assert cmp["error_mw"].tolist() == [500.0, -200.0]  # forecast - actual

    def test_interpolation_fills_half_hours_inside_only(self, actuals: pd.DataFrame) -> None:
        sel = _selected([("2026-01-15T10:00Z", 1000.0), ("2026-01-15T11:00Z", 2000.0)])
        cmp = build_comparison(actuals, sel, interpolate=True)
        assert len(cmp) == 4
        assert cmp.loc[1, "forecast_mw"] == 1500.0
        assert math.isnan(cmp.loc[3, "forecast_mw"])  # no extrapolation past last hour


class TestMetrics:
    def _cmp(self, actual: list[float], forecast: list[float | None]) -> pd.DataFrame:
        df = pd.DataFrame({"actual_mw": actual, "forecast_mw": forecast}, dtype=float)
        df["error_mw"] = df["forecast_mw"] - df["actual_mw"]
        return df

    def test_hand_computed_values(self) -> None:
        s = summarize(self._cmp([1000, 2000, 3000, 4000], [1100, 1800, 3300, 4000]))
        # errors: +100, -200, +300, 0
        assert s.count == 4
        assert s.mae_mw == 150.0
        assert s.bias_mw == 50.0
        assert s.rmse_mw == pytest.approx(math.sqrt((100**2 + 200**2 + 300**2) / 4), abs=1e-3)
        assert s.max_abs_mw == 300.0
        assert s.nmae_pct == pytest.approx(150 / 2500 * 100, abs=1e-3)

    def test_missing_forecasts_are_counted_not_scored(self) -> None:
        s = summarize(self._cmp([1000, 2000], [1100, None]))
        assert (s.count, s.missing, s.mae_mw) == (1, 1, 100.0)

    def test_mape_excludes_low_wind(self) -> None:
        s = summarize(self._cmp([500, 2000], [1000, 2200]), mape_floor_mw=1000)
        assert s.mape_excluded == 1
        assert s.mape_pct == 10.0

    def test_empty_input(self) -> None:
        s = summarize(self._cmp([1000], [None]))
        assert s.count == 0 and s.mae_mw is None and s.missing == 1

    def test_summarize_by_groups(self) -> None:
        df = self._cmp([1000, 1000, 1000], [1100, 1300, 900])
        rows = summarize_by(df, pd.Series(["a", "a", "b"]), "group")
        assert [(r["group"], r["mae_mw"]) for r in rows] == [("a", 200.0), ("b", 100.0)]

    def test_histogram_counts_everything(self) -> None:
        df = self._cmp([0.0] * 5, [-700, -100, 0, 100, 1200])
        hist = error_histogram(df, bins=6)
        assert sum(hist["counts"]) == 5
        assert hist["edges"][0] == -hist["edges"][-1]

    def test_planning_band_maps_error_quantiles_and_clips(self) -> None:
        low, high = planning_band(pd.Series([5000.0, 200.0]), p05_error_mw=-1000, p95_error_mw=3000)
        assert low.tolist() == [2000.0, 0.0]
        assert high.tolist() == [6000.0, 1200.0]
        assert np.all(low <= high)
