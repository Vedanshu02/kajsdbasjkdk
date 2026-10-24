import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import dayAhead from './fixtures/dayAhead.json';
import meta from './fixtures/meta.json';
import metrics from './fixtures/metrics.json';

export const fixtures = { dayAhead, meta, metrics };

export const handlers = [
  http.get('*/api/v1/meta', () => HttpResponse.json(meta)),
  http.get('*/api/v1/day-ahead', () => HttpResponse.json(dayAhead)),
  http.get('*/api/v1/metrics', () => HttpResponse.json(metrics)),
];

export const server = setupServer(...handlers);
