import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <div role="alert" className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">This view hit an unexpected error</h1>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
      <Link to="/day-ahead" className="mt-4 inline-block text-sm font-medium text-brand-600">
        Back to the day-ahead view
      </Link>
    </div>
  );
}
