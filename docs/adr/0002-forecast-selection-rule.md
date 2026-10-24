# ADR 0002: Forecast selection rule and error alignment

- **Status:** Accepted
- **Date:** 2026-10-24

## Context
WINDFOR publishes ~8 runs a day, each covering up to ~66 h ahead, so every target hour has many
candidate forecasts. Using one published after the decision point would make accuracy look better
than it really was (look-ahead bias). Some rows are published after their target time (backfill).
Forecasts are hourly and actuals half-hourly.

## Decision
- For target `t` and cutoff `c`, use the run with the greatest `publishTime <= min(c, t)`
  (`app/domain/selection.py`, a vectorised `pandas.merge_asof` grouped by target).
- **Day-ahead mode:** `c` = cutoff time (default 09:00, configurable) in UK local time on D-1, where D
  is the target's *local* calendar date. This is correct across BST changes.
- **Horizon mode:** `c = t - h` hours, used for the error-vs-lead-time curve.
- Errors are computed on on-the-hour periods only (no invented values). Linear interpolation to :30
  periods is available behind `interpolate=true`.
- Sign convention: `error = forecast - actual` (positive means the desk was short).

## Consequences
- The no-look-ahead property is an invariant, tested on the full snapshot for several cutoffs.
- Half the actual periods are not scored by default. This is documented in the Methodology page.
