import { useId, useState } from 'react';

/** Small accessible "i" tooltip for metric definitions. */
export function InfoTip({ text, inverted = false }: { text: string; inverted?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="More info"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          inverted ? 'bg-white/20 text-white' : 'bg-slate-200 text-ink-soft'
        }`}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-1/2 top-6 z-20 w-64 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
