# WindSight: GB Day-ahead Wind Forecast Monitor

A web app for a UK utility's day-ahead trading desk. It answers two questions:

1. **What did the latest national wind forecast say when we had to place our day-ahead bids?**
2. **How wrong are those forecasts, in MW, and how much buffer should we plan for?**

Data: Elexon BMRS [`FUELHH`](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
(actual wind output) and [`WINDFOR`](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
(wind forecasts), for purchase decisions made in **January 2026** (delivery days 2 Jan to 1 Feb 2026).

**Live app:** _<Vercel URL: added after deployment>_

| Day-ahead decision | Forecast accuracy |
|---|---|
| Forecast available at the D-1 cutoff, with a P5–P95 planning band and optional hindsight actuals | MAE / RMSE / bias / P90 error, error vs lead time, by hour of day, error distribution, daily table with CSV export |

### Headline findings (January 2026, 09:00 D-1 cutoff)
- Day-ahead forecasts missed by **~2.0 GW on average** (MAE), and 90% of hours were within **~4.2 GW**.
- Forecasts ran **~1.75 GW high on average**, even at 1 h ahead. The error is mostly systematic,
  likely because metered output reflects curtailment that the forecast doesn't. That makes it
  correctable before bidding.
- Error grows steadily with lead time (MAE ~1.7 GW at 1 h, ~2.3 GW at 48 h).

---

## Quick start

### Docker (recommended)
```bash
docker compose up --build
# App:      http://localhost:8080
# API docs: http://localhost:8000/api/docs
```
If port 8000 or 8080 is taken: `BACKEND_PORT=8001 FRONTEND_PORT=8081 docker compose up --build`.

### Native (for development)
Requires Python ≥ 3.10 and Node ≥ 20.
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload                        # http://localhost:8000/api/docs

# Frontend (second terminal)
cd frontend
npm install
npm run dev                                          # http://localhost:5173 (proxies /api to :8000)
```

### Checks
```bash
cd backend  && ruff check . && ruff format --check . && mypy app && pytest --cov=app
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

### Refresh the data snapshot
```bash
cd backend && python -m scripts.ingest   # re-fetches from Elexon; output is byte-reproducible
```
Set `DATA_SOURCE=live` to have the API fetch from Elexon on startup instead of using the snapshot.

---

## Repository layout

```
.
├── api/index.py               # Vercel serverless entrypoint → backend FastAPI app
├── backend/                   # Python 3 · FastAPI · pandas
│   ├── app/
│   │   ├── main.py            # App factory: middleware (request ID, JSON logs, gzip, CORS), routers
│   │   ├── core/              # Settings (env vars), structured logging, RFC 7807 error handling
│   │   ├── api/               # HTTP layer: dependency wiring, v1 routes
│   │   ├── schemas/           # Pydantic response contracts → OpenAPI → generated FE types
│   │   ├── services/          # Use cases: day-ahead view, metrics and breakdowns (with caching)
│   │   ├── domain/            # Pure logic: record models, forecast selection, alignment, metrics
│   │   └── repositories/      # Data access: DataRepository interface, CSV snapshot, Elexon client
│   ├── data/                  # Committed snapshot: actuals.csv, forecasts.csv, manifest.json
│   ├── scripts/ingest.py      # Fetches Elexon data and writes the snapshot
│   ├── tests/                 # unit/ (domain, client), integration/ (API via TestClient)
│   ├── Dockerfile             # Multi-stage, non-root, health check
│   └── pyproject.toml         # Dependencies and ruff/mypy/pytest config
├── frontend/                  # React 18 · TypeScript · Vite · TanStack Query · Recharts · Tailwind
│   ├── src/
│   │   ├── app/               # App root, providers, router, layout, route error boundary
│   │   ├── api/               # Typed fetch client, generated OpenAPI types (schema.d.ts), queries
│   │   ├── features/          # day-ahead/, accuracy/, methodology/ (page, hooks, charts)
│   │   ├── components/ui/     # Card, KpiTile, InfoTip, controls, loading/error/empty states
│   │   ├── lib/               # Formatting (UK time), axis helpers, URL state hook, chart theme
│   │   └── test/              # Vitest + Testing Library + MSW tests and fixtures
│   ├── Dockerfile             # Build → nginx (serves SPA, proxies /api to backend)
│   └── nginx.conf
├── docs/adr/                  # Architecture decision records
├── docker-compose.yml         # Backend + frontend on one port (8080)
├── vercel.json                # Static frontend + Python function routing
├── requirements.txt           # Vercel Python deps → backend/requirements.txt
└── .github/workflows/ci.yml   # Lint, type-check, test, build, Docker smoke test
```

## Architecture in brief

- **Backend:** layered architecture: `api → services → domain ← repositories`. All forecast
  selection and metric logic is pure and unit-tested in `app/domain`. The core rule:
  *for each delivery hour, use the latest forecast published at or before the D-1 cutoff (UK time)*,
  never one published later. See [ADR 0002](docs/adr/0002-forecast-selection-rule.md).
- **Frontend:** feature-based folders. TanStack Query handles server state. Filters live in URL
  params, so every view is shareable. Request and response types are generated from the backend's
  OpenAPI schema (`npm run gen:api`), so API drift fails the TypeScript check.
- **Data:** a committed, reproducible CSV snapshot, with no database
  ([ADR 0001](docs/adr/0001-committed-csv-snapshot.md)).

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health`, `/meta` | Health; data window, defaults and provenance |
| `GET /api/v1/day-ahead?delivery_date=&cutoff_time=` | Forecast at cutoff, planning band, hindsight |
| `GET /api/v1/series?start=&end=&mode=&horizon_h=` | Actuals + selected forecasts |
| `GET /api/v1/metrics[/by-horizon\|/by-hour\|/daily\|/distribution]` | Accuracy summary and breakdowns |

Interactive docs: `/api/docs`. Errors are `application/problem+json`.

## Use of AI tools

This project was built with the help of an AI coding assistant (**Claude Code**, Anthropic). It was
used for research on the Elexon datasets, the design document and plan, code generation, tests,
and documentation. All design decisions, data findings and outputs were reviewed and verified
by running the code, the test suites and the app.
