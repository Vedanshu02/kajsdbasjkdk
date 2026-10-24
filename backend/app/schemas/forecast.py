"""Forecast responses: time series and the day-ahead decision view."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.metrics import ErrorSummary


class ActualPoint(BaseModel):
    start_time: datetime
    actual_mw: float | None


class ComparisonPoint(BaseModel):
    start_time: datetime
    actual_mw: float | None
    forecast_mw: float | None
    error_mw: float | None
    publish_time: datetime | None
    horizon_h: float | None


class Series(BaseModel):
    actuals: list[ActualPoint]
    points: list[ComparisonPoint]


class DayAheadPoint(ComparisonPoint):
    band_low_mw: float | None
    band_high_mw: float | None


class DayAheadForecast(BaseModel):
    energy_mwh: float
    mean_mw: float | None
    peak_mw: float | None
    peak_time: datetime | None
    trough_mw: float | None
    trough_time: datetime | None
    runs_used: list[datetime]
    min_horizon_h: float | None
    max_horizon_h: float | None
    coverage: str


class Band(BaseModel):
    p05_error_mw: float
    p95_error_mw: float
    bias_mw: float | None = Field(description="Mean day-ahead error over the window")
    mae_mw: float | None = Field(description="Mean absolute day-ahead error over the window")
    basis: str


class DayAhead(BaseModel):
    delivery_date: date
    cutoff_time: str
    cutoff_utc: datetime
    timezone: str
    forecast: DayAheadForecast
    band: Band
    hindsight: ErrorSummary
    points: list[DayAheadPoint]
    actuals: list[ActualPoint]
