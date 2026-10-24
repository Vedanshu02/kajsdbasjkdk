import { NavLink, Outlet } from 'react-router-dom';
import { useMeta } from '@/api/queries';
import { ukDate } from '@/lib/format';

const NAV = [
  { to: '/day-ahead', label: 'Day-ahead decision' },
  { to: '/accuracy', label: 'Forecast accuracy' },
  { to: '/methodology', label: 'Methodology' },
];

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0e7490" />
      <path
        d="M16 16 L16 6 M16 16 L24.7 21 M16 16 L7.3 21"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.5" fill="#fff" />
    </svg>
  );
}

export function Layout() {
  const meta = useMeta();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <NavLink to="/day-ahead" className="flex items-center gap-2.5">
            <Logo />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">WindSight</div>
              <div className="text-[11px] text-ink-soft">GB day-ahead wind monitor</div>
            </div>
          </NavLink>
          <nav aria-label="Main" className="-mx-1 flex gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {meta.data && (
            <div className="ml-auto hidden text-xs text-ink-soft lg:block">
              Delivery {ukDate(meta.data.delivery_start, 'd MMM')} –{' '}
              {ukDate(meta.data.delivery_end, 'd MMM yyyy')} · Elexon BMRS
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-ink-faint sm:px-6">
        Data: Elexon BMRS FUELHH (wind outturn) and WINDFOR (wind forecast). Times in UK local time.
      </footer>
    </div>
  );
}
