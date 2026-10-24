import type { Schemas } from './client';

export type Meta = Schemas['Meta'];
export type DayAhead = Schemas['DayAhead'];
export type DayAheadPoint = Schemas['DayAheadPoint'];
export type ErrorSummary = Schemas['ErrorSummary'];
export type HorizonRow = Schemas['HorizonRow'];
export type HourRow = Schemas['HourRow'];
export type DailyRow = Schemas['DailyRow'];
export type Histogram = Schemas['Histogram'];
export type Series = Schemas['Series'];
export type Mode = 'day_ahead' | 'horizon';

export interface SelectionQuery {
  start: string;
  end: string;
  mode: Mode;
  cutoff_time: string;
  horizon_h: number;
}
