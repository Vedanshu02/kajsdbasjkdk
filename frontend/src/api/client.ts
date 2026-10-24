/**
 * Typed API client. Paths, query params and response bodies are all derived from
 * the backend's OpenAPI schema (`npm run gen:api`), so FE/BE drift fails `tsc`.
 */
import type { components, paths } from './schema';

export type Schemas = components['schemas'];

type GetPath = { [P in keyof paths]: paths[P] extends { get: unknown } ? P : never }[keyof paths];
type GetOp<P extends GetPath> = paths[P]['get'];
export type QueryOf<P extends GetPath> =
  GetOp<P> extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;
export type ResponseOf<P extends GetPath> =
  GetOp<P> extends {
    responses: { 200: { content: { 'application/json': infer R } } };
  }
    ? R
    : never;

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** RFC 7807 problem details surfaced by the backend. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: unknown,
  ) {
    super(typeof detail === 'string' ? detail : title);
    this.name = 'ApiError';
  }
}

export function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function apiGet<P extends GetPath>(
  path: P,
  query?: QueryOf<P>,
  init?: RequestInit,
): Promise<ResponseOf<P>> {
  const url = `${BASE_URL}${path}${buildQuery(query as Record<string, unknown> | undefined)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, ...init });
  if (!res.ok) {
    let title = res.statusText;
    let detail: unknown = undefined;
    try {
      const body = await res.json();
      title = body.title ?? title;
      detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, title, detail);
  }
  return (await res.json()) as ResponseOf<P>;
}
