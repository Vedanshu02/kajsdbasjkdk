from __future__ import annotations

from datetime import time

import pandas as pd

from app.domain.selection import (
    day_ahead_cutoffs,
    select_at_horizon,
    select_day_ahead,
    select_latest_before,
)
from tests.conftest import forecasts_frame, ts


def _targets(*values: str) -> pd.Series:
    return pd.Series(pd.to_datetime(list(values), utc=True))


class TestDayAheadCutoffs:
    def test_cutoff_is_previous_day_at_local_time_in_winter(self) -> None:
        cutoffs = day_ahead_cutoffs(_targets("2026-01-15T12:00Z"), time(9, 0))
        assert cutoffs.iloc[0] == ts("2026-01-14T09:00Z")  # GMT == UTC

    def test_cutoff_respects_bst(self) -> None:
        cutoffs = day_ahead_cutoffs(_targets("2026-07-15T12:00Z"), time(9, 0))
        assert cutoffs.iloc[0] == ts("2026-07-14T08:00Z")  # 09:00 BST == 08:00 UTC

    def test_delivery_day_uses_local_date(self) -> None:
        # 23:30 UTC on 14 July is 00:30 BST on 15 July, so the cutoff is 14 July.
        cutoffs = day_ahead_cutoffs(_targets("2026-07-14T23:30Z"), time(9, 0))
        assert cutoffs.iloc[0] == ts("2026-07-14T08:00Z")


class TestSelectDayAhead:
    def test_picks_latest_run_before_cutoff(self, sample_forecasts: pd.DataFrame) -> None:
        out = select_day_ahead(sample_forecasts, _targets("2026-01-15T12:00Z"), time(9, 0))
        row = out.iloc[0]
        assert row["forecast_mw"] == 9500.0
        assert row["publish_time"] == ts("2026-01-14T07:30Z")
        assert row["horizon_h"] == 28.5

    def test_later_cutoff_picks_later_run(self, sample_forecasts: pd.DataFrame) -> None:
        out = select_day_ahead(sample_forecasts, _targets("2026-01-15T12:00Z"), time(12, 0))
        assert out.iloc[0]["forecast_mw"] == 10000.0

    def test_no_run_before_cutoff_gives_nan(self, sample_forecasts: pd.DataFrame) -> None:
        out = select_day_ahead(sample_forecasts, _targets("2026-01-15T12:00Z"), time(0, 0))
        # 2026-01-14 00:00 cutoff: only the 2026-01-13 22:30 run qualifies.
        assert out.iloc[0]["forecast_mw"] == 9000.0
        out = select_at_horizon(sample_forecasts, _targets("2026-01-15T12:00Z"), 48)
        assert pd.isna(out.iloc[0]["forecast_mw"])

    def test_unknown_target_kept_with_nan(self, sample_forecasts: pd.DataFrame) -> None:
        out = select_day_ahead(
            sample_forecasts, _targets("2026-01-15T12:00Z", "2026-01-15T13:00Z"), time(9, 0)
        )
        assert len(out) == 2
        assert pd.isna(out.iloc[1]["forecast_mw"])


class TestSelectAtHorizon:
    def test_horizon_is_minimum_lead_time(self, sample_forecasts: pd.DataFrame) -> None:
        out = select_at_horizon(sample_forecasts, _targets("2026-01-15T12:00Z"), 4)
        assert out.iloc[0]["forecast_mw"] == 10000.0
        assert out.iloc[0]["horizon_h"] >= 4

    def test_backfill_rows_never_selected(self, sample_forecasts: pd.DataFrame) -> None:
        # Even with a cutoff after the backfill publish time, the backfill is ignored.
        out = select_latest_before(
            sample_forecasts, _targets("2026-01-15T12:00Z"), _targets("2026-01-16T00:00Z")
        )
        assert out.iloc[0]["forecast_mw"] == 10000.0

    def test_multiple_targets_select_independently(self) -> None:
        fc = forecasts_frame(
            [
                ("2026-01-15T10:00Z", "2026-01-15T02:30Z", 1.0),
                ("2026-01-15T10:00Z", "2026-01-15T04:30Z", 2.0),
                ("2026-01-15T11:00Z", "2026-01-15T02:30Z", 3.0),
                ("2026-01-15T11:00Z", "2026-01-15T04:30Z", 4.0),
            ]
        )
        out = select_at_horizon(fc, _targets("2026-01-15T10:00Z", "2026-01-15T11:00Z"), 6)
        # 10:00 - 6h = 04:00 -> 02:30 run; 11:00 - 6h = 05:00 -> 04:30 run
        assert out["forecast_mw"].tolist() == [1.0, 4.0]
