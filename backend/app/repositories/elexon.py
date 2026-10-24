"""Elexon BMRS client and the live repository built on it."""

from __future__ import annotations

import logging
import threading
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import httpx
import pandas as pd
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import Settings
from app.core.errors import DataUnavailableError
from app.domain.models import (
    ActualRecord,
    ForecastRecord,
    actuals_to_frame,
    forecasts_to_frame,
)

logger = logging.getLogger(__name__)

FUELHH_PATH = "/datasets/FUELHH/stream"
WINDFOR_PATH = "/datasets/WINDFOR/stream"


class ElexonClient:
    """Thin, retrying client for the two BMRS stream endpoints we use."""

    def __init__(
        self,
        base_url: str,
        timeout_s: float = 30.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(base_url=base_url, timeout=timeout_s, transport=transport)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> ElexonClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        stop=stop_after_attempt(4),
        reraise=True,
    )
    def _get(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        response = self._client.get(path, params=params)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, list):
            raise ValueError(f"Unexpected payload from {path}: {type(payload).__name__}")
        return payload

    def fetch_actuals(self, from_date: date, to_date: date) -> list[ActualRecord]:
        """Wind outturn for settlement dates ``from_date``..``to_date`` (inclusive)."""
        raw = self._get(
            FUELHH_PATH,
            {
                "settlementDateFrom": from_date.isoformat(),
                "settlementDateTo": to_date.isoformat(),
                "fuelType": "WIND",
            },
        )
        return [ActualRecord.model_validate(r) for r in raw]

    def fetch_forecasts(self, publish_from: datetime, publish_to: datetime) -> list[ForecastRecord]:
        """All WINDFOR runs published in ``[publish_from, publish_to]``."""
        raw = self._get(
            WINDFOR_PATH,
            {
                "publishDateTimeFrom": _iso(publish_from),
                "publishDateTimeTo": _iso(publish_to),
            },
        )
        return [ForecastRecord.model_validate(r) for r in raw]


def window_bounds(settings: Settings) -> tuple[date, date, datetime, datetime]:
    """Fetch window derived from the business window in settings."""
    publish_from = datetime.combine(settings.forecast_publish_start, time(0), tzinfo=timezone.utc)
    # Up to the end of the last delivery day so short horizons are covered too.
    publish_to = datetime.combine(
        settings.delivery_end + timedelta(days=1), time(0), tzinfo=timezone.utc
    )
    return settings.delivery_start, settings.delivery_end, publish_from, publish_to


class ElexonRepository:
    """Live repository: fetches once on first use, then serves from memory."""

    source_name = "live"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = threading.Lock()
        self._actuals: pd.DataFrame | None = None
        self._forecasts: pd.DataFrame | None = None
        self._fetched_at: datetime | None = None

    def _load(self) -> None:
        with self._lock:
            if self._actuals is not None:
                return
            a_from, a_to, f_from, f_to = window_bounds(self._settings)
            try:
                with ElexonClient(
                    self._settings.elexon_base_url, self._settings.elexon_timeout_s
                ) as client:
                    self._forecasts = forecasts_to_frame(client.fetch_forecasts(f_from, f_to))
                    self._actuals = actuals_to_frame(client.fetch_actuals(a_from, a_to))
            except (httpx.HTTPError, ValueError) as exc:
                logger.exception("Elexon fetch failed")
                raise DataUnavailableError(f"Could not fetch data from Elexon: {exc}") from exc
            self._fetched_at = datetime.now(timezone.utc)

    def actuals(self) -> pd.DataFrame:
        self._load()
        assert self._actuals is not None
        return self._actuals

    def forecasts(self) -> pd.DataFrame:
        self._load()
        assert self._forecasts is not None
        return self._forecasts

    def manifest(self) -> dict[str, Any]:
        self._load()
        return {
            "source": "live",
            "fetched_at": _iso(self._fetched_at) if self._fetched_at else None,
            "base_url": self._settings.elexon_base_url,
            "rows": {
                "actuals": len(self.actuals()),
                "forecasts": len(self.forecasts()),
            },
        }


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
