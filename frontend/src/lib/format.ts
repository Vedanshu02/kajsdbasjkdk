import { formatInTimeZone } from 'date-fns-tz';

export const MARKET_TZ = 'Europe/London';

const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** "12,345 MW", or an em dash for missing values. */
export function mw(value: number | null | undefined): string {
  return value == null ? '—' : `${nf0.format(value)} MW`;
}

/** Compact GW for large magnitudes: "12.3 GW". */
export function gw(value: number | null | undefined): string {
  return value == null ? '—' : `${nf1.format(value / 1000)} GW`;
}

export function gwh(mwh: number | null | undefined): string {
  return mwh == null ? '—' : `${nf1.format(mwh / 1000)} GWh`;
}

/** Compact energy range: "152–304 GWh". */
export function gwhRange(lowMwh: number | null | undefined, highMwh: number | null | undefined) {
  if (lowMwh == null || highMwh == null) return '—';
  return `${nf0.format(lowMwh / 1000)}–${nf0.format(highMwh / 1000)} GWh`;
}

export function pct(value: number | null | undefined): string {
  return value == null ? '—' : `${nf1.format(value)}%`;
}

export function signedMw(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value > 0 ? '+' : ''}${nf0.format(value)} MW`;
}

export function hours(value: number | null | undefined): string {
  return value == null ? '—' : `${nf1.format(value)} h`;
}

/** Format an ISO timestamp in UK market time. */
export function ukTime(iso: string | null | undefined, pattern = 'HH:mm'): string {
  return iso ? formatInTimeZone(new Date(iso), MARKET_TZ, pattern) : '—';
}

/** Format a plain date (YYYY-MM-DD) or timestamp as a UK calendar date. */
export function ukDate(iso: string, pattern = 'EEE d MMM yyyy'): string {
  // Plain dates are anchored at midday UTC so no time zone can shift the day.
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return formatInTimeZone(d, MARKET_TZ, pattern);
}
