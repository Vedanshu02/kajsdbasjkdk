"""Application settings, loaded from environment variables (12-factor)."""

from __future__ import annotations

from datetime import date, time
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "UK Wind Forecast Monitor"
    version: str = "0.1.0"
    log_level: str = "INFO"

    # Where data comes from: committed parquet snapshot (default) or Elexon live.
    data_source: Literal["snapshot", "live"] = "snapshot"
    data_dir: Path = BACKEND_ROOT / "data"

    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    elexon_timeout_s: float = 30.0

    # Business window: purchase decisions made in January 2026, i.e. delivery days
    # 2026-01-02 .. 2026-02-01 (inclusive).
    delivery_start: date = date(2026, 1, 2)
    delivery_end: date = date(2026, 2, 1)
    # Forecasts are fetched from a few days earlier so long horizons are covered.
    forecast_publish_start: date = date(2025, 12, 29)

    # Day-ahead decision cutoff on D-1, in market (UK) local time.
    default_cutoff_time: time = time(9, 0)
    market_timezone: str = "Europe/London"

    min_horizon_h: int = 1
    max_horizon_h: int = 48

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
