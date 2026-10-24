"""API tests via TestClient against the committed snapshot."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

API = "/api/v1"
RANGE = {"start": "2026-01-05", "end": "2026-01-11"}


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    r = client.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert "x-request-id" in r.headers


def test_meta_exposes_window_and_provenance(client: TestClient) -> None:
    body = client.get(f"{API}/meta").json()
    assert body["delivery_start"] == "2026-01-02"
    assert body["delivery_end"] == "2026-02-01"
    assert body["data"]["source"] == "snapshot"


def test_day_ahead_shape_and_no_lookahead(client: TestClient) -> None:
    r = client.get(
        f"{API}/day-ahead", params={"delivery_date": "2026-01-15", "cutoff_time": "09:00"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["cutoff_utc"].startswith("2026-01-14T09:00")
    assert len(body["points"]) == 24
    assert len(body["actuals"]) == 48
    for p in body["points"]:
        assert p["publish_time"] <= body["cutoff_utc"]
        assert p["band_low_mw"] <= p["forecast_mw"] or p["band_low_mw"] <= p["band_high_mw"]
    assert body["forecast"]["coverage"] == "24/24"
    assert body["band"]["bias_mw"] > 0 and body["band"]["mae_mw"] > 0


def test_metrics_day_ahead_vs_short_horizon(client: TestClient) -> None:
    da = client.get(f"{API}/metrics", params=RANGE).json()
    h1 = client.get(f"{API}/metrics", params={**RANGE, "mode": "horizon", "horizon_h": 1}).json()
    assert da["count"] == 7 * 24
    assert da["mae_mw"] > 0 and h1["mae_mw"] > 0


def test_by_horizon_returns_requested_rows(client: TestClient) -> None:
    r = client.get(f"{API}/metrics/by-horizon", params={**RANGE, "horizons": [1, 12, 24, 99]})
    rows = r.json()
    assert [row["horizon_h"] for row in rows] == [1, 12, 24]  # 99 is out of range -> dropped


def test_breakdowns(client: TestClient) -> None:
    hours = client.get(f"{API}/metrics/by-hour", params=RANGE).json()
    days = client.get(f"{API}/metrics/daily", params=RANGE).json()
    hist = client.get(f"{API}/metrics/distribution", params={**RANGE, "bins": 20}).json()
    assert [h["hour"] for h in hours] == list(range(24))
    assert len(days) == 7
    assert len(hist["counts"]) == 20 and sum(hist["counts"]) == 7 * 24


def test_series_with_interpolation(client: TestClient) -> None:
    body = client.get(
        f"{API}/series", params={"start": "2026-01-10", "end": "2026-01-10", "interpolate": True}
    ).json()
    assert len(body["actuals"]) == 48
    assert len(body["points"]) == 48


@pytest.mark.parametrize(
    "params",
    [
        {"start": "2025-12-01", "end": "2026-01-05"},  # before window
        {"start": "2026-01-10", "end": "2026-01-05"},  # start after end
        {**RANGE, "mode": "horizon", "horizon_h": 0},  # horizon out of bounds
        {**RANGE, "mode": "bogus"},
    ],
)
def test_invalid_requests_return_problem_json(
    client: TestClient, params: dict[str, object]
) -> None:
    r = client.get(f"{API}/metrics", params=params)
    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["status"] == 422
