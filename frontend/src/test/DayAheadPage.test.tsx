import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { DayAheadPage } from '@/features/day-ahead/DayAheadPage';
import { renderRoute } from './render';
import { fixtures, server } from './server';

const loaded = () => screen.findByText(/Bottom line for Thursday 15 January/);

describe('DayAheadPage', () => {
  it('renders the plain-language summary and KPIs for the date in the URL', async () => {
    const seen: string[] = [];
    server.use(
      http.get('*/api/v1/day-ahead', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json(fixtures.dayAhead);
      }),
    );
    renderRoute(<DayAheadPage />, '/?date=2026-01-15&cutoff=09:00');

    expect(await loaded()).toBeInTheDocument();
    expect(screen.getByText('Shortfall cover')).toBeInTheDocument();
    expect(screen.getByText(/too high/)).toBeInTheDocument(); // fixture month is biased high
    expect(seen[0]).toContain('delivery_date=2026-01-15');
    expect(seen[0]).toContain('cutoff_time=09%3A00');
  });

  it('updates the URL when stepping to the next day', async () => {
    const { router } = renderRoute(<DayAheadPage />, '/?date=2026-01-15');
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Next day' }));
    await waitFor(() => expect(router.state.location.search).toContain('date=2026-01-16'));
  });

  it('shows hindsight metrics only when comparing with what happened', async () => {
    renderRoute(<DayAheadPage />, '/?date=2026-01-15');
    await loaded();
    expect(screen.queryByText('How the forecast did on this day')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: /compare/i }));
    expect(await screen.findByText('How the forecast did on this day')).toBeInTheDocument();
  });

  it('switches to an hourly table view', async () => {
    renderRoute(<DayAheadPage />, '/?date=2026-01-15');
    await loaded();
    await userEvent.click(screen.getByRole('radio', { name: 'Table' }));
    const table = await screen.findByRole('table');
    // header row + 24 delivery hours
    expect(table.querySelectorAll('tr')).toHaveLength(25);
  });

  it('shows an error state with the API problem detail', async () => {
    server.use(
      http.get('*/api/v1/day-ahead', () =>
        HttpResponse.json({ title: 'Data unavailable', detail: 'Upstream down' }, { status: 503 }),
      ),
    );
    renderRoute(<DayAheadPage />, '/?date=2026-01-15');
    expect(await screen.findByRole('alert')).toHaveTextContent('Upstream down');
  });
});
