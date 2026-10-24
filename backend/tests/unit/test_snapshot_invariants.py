"""Invariants checked against the real committed snapshot (no look-ahead, full coverage)."""

from __future__ import annotations

from datetime import time

import pytest

from app.core.config import get_settings
from app.domain.alignment import forecast_targets
from app.domain.selection import select_at_horizon, select_day_ahead
from app.repositories.snapshot import SnapshotRepository


@pytest.fixture(scope="module")
def repo() -> SnapshotRepository:
    return SnapshotRepository(get_settings().data_dir)


@pytest.mark.parametrize("cutoff", [time(6, 0), time(9, 0), time(11, 0)])
def test_day_ahead_never_uses_future_runs(repo: SnapshotRepository, cutoff: time) -> None:
    targets = forecast_targets(repo.actuals())
    sel = select_day_ahead(repo.forecasts(), targets, cutoff)
    chosen = sel.dropna(subset=["forecast_mw"])
    assert (chosen["publish_time"] <= chosen["cutoff"]).all()
    assert (chosen["publish_time"] <= chosen["start_time"]).all()
    assert len(chosen) == len(targets)  # every delivery hour has a day-ahead forecast


@pytest.mark.parametrize("horizon", [1, 6, 24, 48])
def test_horizon_selection_respects_lead_time(repo: SnapshotRepository, horizon: int) -> None:
    sel = select_at_horizon(repo.forecasts(), forecast_targets(repo.actuals()), horizon)
    assert (sel["horizon_h"].dropna() >= horizon).all()


def test_actuals_are_complete_half_hours(repo: SnapshotRepository) -> None:
    a = repo.actuals()
    assert a["start_time"].is_unique
    assert len(a) == 31 * 48
