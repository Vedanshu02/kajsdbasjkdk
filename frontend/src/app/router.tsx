import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AccuracyPage } from '@/features/accuracy/AccuracyPage';
import { DayAheadPage } from '@/features/day-ahead/DayAheadPage';
import { MethodologyPage } from '@/features/methodology/MethodologyPage';
import { Layout } from './Layout';
import { RouteError } from './RouteError';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/day-ahead" replace /> },
      { path: 'day-ahead', element: <DayAheadPage />, errorElement: <RouteError /> },
      { path: 'accuracy', element: <AccuracyPage />, errorElement: <RouteError /> },
      { path: 'methodology', element: <MethodologyPage />, errorElement: <RouteError /> },
      { path: '*', element: <Navigate to="/day-ahead" replace /> },
    ],
  },
]);
