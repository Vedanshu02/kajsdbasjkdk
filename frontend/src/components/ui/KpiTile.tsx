import type { ReactNode } from 'react';
import { InfoTip } from './InfoTip';

interface KpiTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  info?: string;
  tone?: 'default' | 'accent';
}

export function KpiTile({ label, value, hint, info, tone = 'default' }: KpiTileProps) {
  const accent = tone === 'accent';
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        accent ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-200/80 bg-white'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${
          accent ? 'text-brand-100' : 'text-ink-soft'
        }`}
      >
        {label}
        {info && <InfoTip text={info} inverted={accent} />}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <div className={`mt-1 text-xs ${accent ? 'text-brand-100' : 'text-ink-soft'}`}>{hint}</div>
      )}
    </div>
  );
}
