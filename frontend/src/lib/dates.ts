/** Helpers for plain calendar dates (YYYY-MM-DD), free of time zone pitfalls. */

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function clampDate(isoDate: string, min: string, max: string): string {
  if (isoDate < min) return min;
  if (isoDate > max) return max;
  return isoDate;
}
