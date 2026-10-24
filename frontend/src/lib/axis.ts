/** "Nice" axis ticks (steps of 1, 2, 2.5 or 5 x 10^k) from zero to just above the data max. */
export function niceTicks(max: number, target = 5): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Y-axis props for a MW series rendered in GW: domain pinned to the nice ticks. */
export function gwAxis(values: (number | null | undefined)[]) {
  const max = Math.max(0, ...values.filter((v): v is number => v != null));
  const ticks = niceTicks(max);
  const step = ticks[1] ?? 1000;
  const decimals = step < 1000 ? 1 : 0;
  return {
    ticks,
    domain: [0, ticks.at(-1) ?? 0] as [number, number],
    tickFormatter: (v: number) => `${(v / 1000).toFixed(decimals)} GW`,
  };
}

/** Timestamps (ms) on whole hours that are multiples of `everyH` in UK time. */
export function hourTicks(times: number[], everyH = 3): number[] {
  return times.filter((t) => {
    const d = new Date(t);
    return d.getUTCMinutes() === 0 && ukHour(d) % everyH === 0;
  });
}

function ukHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Europe/London',
    }).format(d),
  );
}

/** UK-midnight timestamps (ms) within the data, thinned to at most `maxTicks`. */
export function dayTicks(times: number[], maxTicks = 10): number[] {
  const midnights = times.filter((t) => {
    const d = new Date(t);
    return d.getUTCMinutes() === 0 && ukHour(d) === 0;
  });
  const every = Math.max(1, Math.ceil(midnights.length / maxTicks));
  return midnights.filter((_, i) => i % every === 0);
}
