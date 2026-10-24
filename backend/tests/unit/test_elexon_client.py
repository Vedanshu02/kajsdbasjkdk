from __future__ import annotations

from datetime import date, datetime, timezone

import httpx
import pytest

from app.repositories.elexon import ElexonClient


def _client(handler: httpx.MockTransport) -> ElexonClient:
    return ElexonClient("https://example.test/api", transport=handler)


def test_fetch_actuals_sends_wind_filter_and_parses() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.url.params)
        seen["path"] = request.url.path
        return httpx.Response(
            200,
            json=[
                {
                    "startTime": "2026-01-02T00:00:00Z",
                    "publishTime": "2026-01-02T00:30:00Z",
                    "fuelType": "WIND",
                    "generation": 12000,
                }
            ],
        )

    with _client(httpx.MockTransport(handler)) as client:
        records = client.fetch_actuals(date(2026, 1, 2), date(2026, 1, 3))
    assert seen["path"].endswith("/datasets/FUELHH/stream")
    assert seen["fuelType"] == "WIND"
    assert seen["settlementDateFrom"] == "2026-01-02"
    assert records[0].generation == 12000


def test_fetch_forecasts_formats_publish_window() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.url.params)
        return httpx.Response(200, json=[])

    with _client(httpx.MockTransport(handler)) as client:
        client.fetch_forecasts(
            datetime(2026, 1, 1, tzinfo=timezone.utc), datetime(2026, 1, 2, tzinfo=timezone.utc)
        )
    assert seen["publishDateTimeFrom"] == "2026-01-01T00:00:00Z"
    assert seen["publishDateTimeTo"] == "2026-01-02T00:00:00Z"


def test_retries_transient_errors_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("tenacity.nap.time.sleep", lambda _: None)
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(503) if calls["n"] < 3 else httpx.Response(200, json=[])

    with _client(httpx.MockTransport(handler)) as client:
        assert (
            client.fetch_forecasts(
                datetime(2026, 1, 1, tzinfo=timezone.utc), datetime(2026, 1, 2, tzinfo=timezone.utc)
            )
            == []
        )
    assert calls["n"] == 3


def test_rejects_non_list_payload() -> None:
    handler = httpx.MockTransport(lambda r: httpx.Response(200, json={"error": "x"}))
    with _client(handler) as client, pytest.raises(ValueError):
        client.fetch_actuals(date(2026, 1, 2), date(2026, 1, 2))
