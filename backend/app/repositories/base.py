"""Repository interface: services depend on this, not on a concrete data source."""

from __future__ import annotations

from typing import Any, Protocol

import pandas as pd


class DataRepository(Protocol):
    source_name: str

    def actuals(self) -> pd.DataFrame:
        """Canonical actuals frame (see ``app.domain.models``)."""
        ...

    def forecasts(self) -> pd.DataFrame:
        """Canonical forecasts frame (see ``app.domain.models``)."""
        ...

    def manifest(self) -> dict[str, Any]:
        """Provenance metadata: source URLs, fetch time, row counts."""
        ...
