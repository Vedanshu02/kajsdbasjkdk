import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type Parser<T> = (raw: string | null) => T;

/**
 * UI state that lives in the URL (shareable, bookmarkable, survives reload).
 * Each key has a parser, which also supplies the default.
 */
export function useUrlState<S extends Record<string, unknown>>(parsers: {
  [K in keyof S]: Parser<S[K]>;
}): [S, (patch: Partial<S>) => void] {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const out = {} as S;
    for (const key of Object.keys(parsers) as (keyof S)[]) {
      out[key] = parsers[key](params.get(key as string));
    }
    return out;
  }, [params, parsers]);

  const update = useCallback(
    (patch: Partial<S>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === null || v === '') next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [state, update];
}

export const parse = {
  string:
    (fallback: string): Parser<string> =>
    (raw) =>
      raw ?? fallback,
  date:
    (fallback: string): Parser<string> =>
    (raw) =>
      raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback,
  time:
    (fallback: string): Parser<string> =>
    (raw) =>
      raw && /^\d{2}:\d{2}$/.test(raw) ? raw : fallback,
  int:
    (fallback: number, min: number, max: number): Parser<number> =>
    (raw) => {
      const n = raw == null ? NaN : Number.parseInt(raw, 10);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    },
  oneOf:
    <T extends string>(options: readonly T[], fallback: T): Parser<T> =>
    (raw) =>
      options.includes(raw as T) ? (raw as T) : fallback,
  bool:
    (fallback: boolean): Parser<boolean> =>
    (raw) =>
      raw == null ? fallback : raw === '1' || raw === 'true',
};
