"""Health and metadata responses."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


class Health(BaseModel):
    status: Literal["ok"]
    version: str
    data_source: str


class Meta(BaseModel):
    delivery_start: date
    delivery_end: date
    default_cutoff_time: str = Field(examples=["09:00"])
    timezone: str
    min_horizon_h: int
    max_horizon_h: int
    data: dict[str, Any] = Field(description="Data provenance (snapshot manifest or live info)")
