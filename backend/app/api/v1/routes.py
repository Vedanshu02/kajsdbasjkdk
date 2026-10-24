"""HTTP layer: validate query params, call the service, map to response schemas."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app import schemas
from app.api.deps import get_service
from app.core.config import get_settings
from app.services.analysis import AnalysisService, Mode, Selection

router = APIRouter()
Service = Annotated[AnalysisService, Depends(get_service)]

_settings = get_settings()
_DEFAULT_CUTOFF = _settings.default_cutoff_time


@dataclass
class RangeParams:
    start: Annotated[date, Query(description="First delivery day (inclusive)")]
    end: Annotated[date, Query(description="Last delivery day (inclusive)")]


@dataclass
class SelectionParams:
    mode: Annotated[
        Mode,
        Query(
            description="day_ahead: forecast available at the D-1 cutoff; "
            "horizon: latest forecast at least horizon_h before target"
        ),
    ] = "day_ahead"
    cutoff_time: Annotated[
        time, Query(description="D-1 decision cutoff, market local time (HH:MM)")
    ] = _DEFAULT_CUTOFF
    horizon_h: Annotated[int, Query(ge=_settings.min_horizon_h, le=_settings.max_horizon_h)] = 24
    interpolate: Annotated[
        bool, Query(description="Interpolate hourly forecasts onto :30 periods")
    ] = False

    def to_selection(self) -> Selection:
        return Selection(self.mode, self.cutoff_time, self.horizon_h, self.interpolate)


Range = Annotated[RangeParams, Depends()]
Sel = Annotated[SelectionParams, Depends()]


@router.get("/health", response_model=schemas.Health, tags=["system"])
def health() -> dict[str, Any]:
    return {"status": "ok", "version": _settings.version, "data_source": _settings.data_source}


@router.get("/meta", response_model=schemas.Meta, tags=["system"])
def meta(service: Service) -> dict[str, Any]:
    return service.meta()


@router.get("/day-ahead", response_model=schemas.DayAhead, tags=["forecast"])
def day_ahead(
    service: Service,
    delivery_date: Annotated[date, Query(description="Delivery day")],
    cutoff_time: Annotated[time, Query(description="D-1 cutoff, local HH:MM")] = _DEFAULT_CUTOFF,
) -> dict[str, Any]:
    """Forecast available at the D-1 cutoff for one delivery day, with planning band."""
    return service.day_ahead(delivery_date, cutoff_time)


@router.get("/series", response_model=schemas.Series, tags=["forecast"])
def series(service: Service, r: Range, s: Sel) -> dict[str, Any]:
    """Actuals (30 min) and selected forecasts over a date range."""
    return service.series(r.start, r.end, s.to_selection())


@router.get("/metrics", response_model=schemas.ErrorSummary, tags=["accuracy"])
def metrics(service: Service, r: Range, s: Sel) -> dict[str, Any]:
    return service.summary(r.start, r.end, s.to_selection()).to_dict()


@router.get("/metrics/by-horizon", response_model=list[schemas.HorizonRow], tags=["accuracy"])
def metrics_by_horizon(
    service: Service,
    r: Range,
    horizons: Annotated[
        list[int] | None, Query(description="Horizons in hours (default 1..48)")
    ] = None,
) -> list[dict[str, Any]]:
    hs = horizons or list(range(_settings.min_horizon_h, _settings.max_horizon_h + 1))
    hs = [h for h in hs if _settings.min_horizon_h <= h <= _settings.max_horizon_h]
    return service.by_horizon(r.start, r.end, sorted(set(hs)))


@router.get("/metrics/by-hour", response_model=list[schemas.HourRow], tags=["accuracy"])
def metrics_by_hour(service: Service, r: Range, s: Sel) -> list[dict[str, Any]]:
    return service.by_hour(r.start, r.end, s.to_selection())


@router.get("/metrics/daily", response_model=list[schemas.DailyRow], tags=["accuracy"])
def metrics_daily(service: Service, r: Range, s: Sel) -> list[dict[str, Any]]:
    return service.daily(r.start, r.end, s.to_selection())


@router.get("/metrics/distribution", response_model=schemas.Histogram, tags=["accuracy"])
def metrics_distribution(
    service: Service,
    r: Range,
    s: Sel,
    bins: Annotated[int, Query(ge=5, le=200)] = 40,
) -> dict[str, Any]:
    return service.distribution(r.start, r.end, s.to_selection(), bins)
