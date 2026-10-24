"""Forecast accuracy responses: summary statistics and their breakdowns."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class ErrorSummary(BaseModel):
    count: int = Field(description="Periods scored")
    missing: int = Field(description="Periods with no qualifying forecast")
    mean_actual_mw: float | None
    mean_forecast_mw: float | None
    mae_mw: float | None = Field(description="Mean absolute error")
    rmse_mw: float | None = Field(description="Root mean squared error")
    bias_mw: float | None = Field(description="Mean of forecast - actual (+ = over-forecast)")
    nmae_pct: float | None = Field(description="MAE as % of mean actual")
    mape_pct: float | None = Field(description="MAPE over periods with actual >= 1 GW")
    mape_excluded: int
    p50_abs_mw: float | None
    p90_abs_mw: float | None
    p95_abs_mw: float | None
    max_abs_mw: float | None
    p05_error_mw: float | None
    p95_error_mw: float | None
    correlation: float | None


class HorizonRow(ErrorSummary):
    horizon_h: int


class HourRow(ErrorSummary):
    hour: int = Field(description="Hour of day, market local time")


class DailyRow(ErrorSummary):
    date: date


class Histogram(BaseModel):
    edges: list[float]
    counts: list[int]
