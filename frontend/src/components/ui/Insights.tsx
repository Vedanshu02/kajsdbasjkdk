import type { ReactNode } from 'react';

/** Highlighted panel of plain-language findings. */
export function InsightPanel({
  id,
  title,
  children,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white px-5 py-4"
    >
      <h2 id={id} className="text-xs font-semibold uppercase tracking-wide text-brand-700">
        {title}
      </h2>
      <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-ink-soft">{children}</ul>
    </section>
  );
}

/** One finding. `warn` marks something the reader should act on. */
export function Insight({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={`mt-[9px] h-2 w-2 shrink-0 rounded-full ${
          tone === 'warn'
            ? 'bg-amber-500 ring-4 ring-amber-100'
            : 'bg-brand-500 ring-4 ring-brand-100'
        }`}
      />
      <span>
        {tone === 'warn' && <span className="sr-only">Important: </span>}
        {children}
      </span>
    </li>
  );
}

/** Bold figure inside an insight sentence. */
export function Em({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}
