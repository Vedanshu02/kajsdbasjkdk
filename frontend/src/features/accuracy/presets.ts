import { addDays } from '@/lib/dates';
import { ukDate } from '@/lib/format';

export interface DatePreset {
  label: string;
  start: string;
  end: string;
}

/** Quick date ranges: the whole window plus consecutive 7-day blocks. */
export function datePresets(min: string, max: string): DatePreset[] {
  const presets: DatePreset[] = [{ label: 'Whole period', start: min, end: max }];
  for (let s = min; s <= max; s = addDays(s, 7)) {
    const e = addDays(s, 6) < max ? addDays(s, 6) : max;
    const label = s === e ? ukDate(s, 'd MMM') : `${ukDate(s, 'd MMM')} – ${ukDate(e, 'd MMM')}`;
    presets.push({ label, start: s, end: e });
  }
  return presets;
}
