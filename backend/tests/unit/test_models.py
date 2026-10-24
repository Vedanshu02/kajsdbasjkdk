from __future__ import annotations

from app.domain.models import (
    ActualRecord,
    ForecastRecord,
    actuals_to_frame,
    forecasts_to_frame,
)


def _actual(start: str, publish: str, gen: float, fuel: str = "WIND") -> ActualRecord:
    return ActualRecord.model_validate(
        {
            "startTime": start,
            "publishTime": publish,
            "fuelType": fuel,
            "generation": gen,
            "settlementPeriod": 1,
        }
    )


def test_actuals_keep_latest_publication_and_wind_only() -> None:
    df = actuals_to_frame(
        [
            _actual("2026-01-15T10:00:00Z", "2026-01-15T10:30:00Z", 100),
            _actual("2026-01-15T10:00:00Z", "2026-01-15T11:00:00Z", 110),  # revision
            _actual("2026-01-15T10:00:00Z", "2026-01-15T10:30:00Z", 999, fuel="CCGT"),
        ]
    )
    assert list(df.columns) == ["start_time", "actual_mw"]
    assert df["actual_mw"].tolist() == [110.0]
    assert str(df["start_time"].dtype) == "datetime64[ns, UTC]"


def test_forecasts_deduplicate_per_target_and_run() -> None:
    raw = {
        "startTime": "2026-01-15T10:00:00Z",
        "publishTime": "2026-01-14T22:30:00Z",
        "generation": 5000,
        "dataset": "WINDFOR",
    }
    df = forecasts_to_frame([ForecastRecord.model_validate(raw)] * 2)
    assert len(df) == 1
    assert list(df.columns) == ["start_time", "publish_time", "forecast_mw"]
