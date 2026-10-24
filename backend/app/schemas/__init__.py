"""API response contracts. These drive the OpenAPI schema and the generated FE types."""

from app.schemas.forecast import (
    ActualPoint,
    Band,
    ComparisonPoint,
    DayAhead,
    DayAheadForecast,
    DayAheadPoint,
    Series,
)
from app.schemas.metrics import DailyRow, ErrorSummary, Histogram, HorizonRow, HourRow
from app.schemas.system import Health, Meta

__all__ = [
    "ActualPoint",
    "Band",
    "ComparisonPoint",
    "DailyRow",
    "DayAhead",
    "DayAheadForecast",
    "DayAheadPoint",
    "ErrorSummary",
    "Health",
    "Histogram",
    "HorizonRow",
    "HourRow",
    "Meta",
    "Series",
]
