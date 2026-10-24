import type { ErrorSummary, HorizonRow, HourRow } from '@/api/types';

export interface Takeaways {
  typicalMissMw: number | null;
  typicalMissPct: number | null;
  p90Mw: number | null;
  biasMw: number | null;
  /** |bias| is a large share of the typical miss, i.e. the error is mostly systematic. */
  mostlySystematic: boolean;
  /** P95 of signed error: wind shortfall vs forecast not exceeded in 19 of 20 hours. */
  shortMw: number | null;
  nearMae: number | null;
  farMae: number | null;
  nearH: number | null;
  farH: number | null;
  worstHours: number[];
}

/** Headline facts for the "what this means" card, derived from API results. */
export function deriveTakeaways(
  summary: ErrorSummary,
  horizon: HorizonRow[] | undefined,
  byHour: HourRow[] | undefined,
): Takeaways {
  const scored = (horizon ?? []).filter((r) => r.mae_mw != null);
  const near = scored[0];
  const far = scored.at(-1);
  const worstHours = [...(byHour ?? [])]
    .filter((r) => r.mae_mw != null)
    .sort((a, b) => (b.mae_mw ?? 0) - (a.mae_mw ?? 0))
    .slice(0, 3)
    .map((r) => r.hour)
    .sort((a, b) => a - b);

  const bias = summary.bias_mw ?? null;
  const mae = summary.mae_mw ?? null;
  return {
    typicalMissMw: mae,
    typicalMissPct: summary.nmae_pct ?? null,
    p90Mw: summary.p90_abs_mw ?? null,
    biasMw: bias,
    mostlySystematic: bias != null && mae != null && mae > 0 && Math.abs(bias) > 0.5 * mae,
    shortMw: summary.p95_error_mw ?? null,
    nearMae: near?.mae_mw ?? null,
    farMae: far && far !== near ? (far.mae_mw ?? null) : null,
    nearH: near?.horizon_h ?? null,
    farH: far && far !== near ? far.horizon_h : null,
    worstHours,
  };
}

/** "03:00, 05:00 and 06:00" */
export function listHours(hours: number[]): string {
  const labels = hours.map((h) => `${String(h).padStart(2, '0')}:00`);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}
