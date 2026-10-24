import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, apiGet, buildQuery } from '@/api/client';
import { server } from './server';

describe('buildQuery', () => {
  it('skips nullish values and repeats arrays', () => {
    expect(buildQuery({ a: 1, b: undefined, c: null, h: [1, 2] })).toBe('?a=1&h=1&h=2');
    expect(buildQuery(undefined)).toBe('');
  });
});

describe('apiGet', () => {
  it('returns parsed JSON on success', async () => {
    const meta = await apiGet('/api/v1/meta');
    expect(meta.delivery_start).toBe('2026-01-02');
  });

  it('maps problem+json responses to ApiError', async () => {
    server.use(
      http.get('*/api/v1/metrics', () =>
        HttpResponse.json(
          { title: 'Out of range', status: 422, detail: 'Dates must be within the window' },
          { status: 422 },
        ),
      ),
    );
    const err = await apiGet('/api/v1/metrics', { start: '2025-01-01', end: '2025-01-02' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).message).toBe('Dates must be within the window');
  });
});
