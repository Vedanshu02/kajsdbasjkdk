"""Dependency wiring: settings -> repository -> service (one instance per process)."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.repositories.base import DataRepository
from app.repositories.elexon import ElexonRepository
from app.repositories.snapshot import SnapshotRepository
from app.services.analysis import AnalysisService


@lru_cache
def get_repository() -> DataRepository:
    settings = get_settings()
    if settings.data_source == "live":
        return ElexonRepository(settings)
    return SnapshotRepository(settings.data_dir)


@lru_cache
def get_service() -> AnalysisService:
    return AnalysisService(get_repository(), get_settings())
