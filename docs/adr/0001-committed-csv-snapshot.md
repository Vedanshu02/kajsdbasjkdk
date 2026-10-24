# ADR 0001: Serve a committed CSV snapshot instead of a database

- **Status:** Accepted
- **Date:** 2026-10-24

## Context
The pilot covers a fixed, historical window (delivery days 2 Jan to 1 Feb 2026): about 1.5k actual
half-hours and 20k forecast rows. That data no longer changes. The app is deployed as a Vercel
Python function, which has a ~250 MB bundle limit and no persistent disk.

## Decision
`scripts/ingest.py` fetches both datasets from Elexon once, validates them, and writes
`backend/data/{actuals,forecasts}.csv` plus a `manifest.json` (source URLs, parameters, row counts,
sha256, data-quality report). The files are committed. The API reads them through
`SnapshotRepository`. A `DATA_SOURCE=live` switch selects `ElexonRepository` behind the same
`DataRepository` interface.

CSV was chosen over parquet: at ~1 MB size isn't a concern, CSV diffs well in review, and it avoids
shipping `pyarrow` (~100+ MB) in the serverless bundle.

## Consequences
- Reproducible results, fast cold starts, and the demo works if Elexon is unavailable.
- No database to run or secure.
- Extending the window means re-running the ingest. For a rolling production product, swap in
  a database-backed repository (e.g. TimescaleDB plus a scheduled ingest). Services don't change.
