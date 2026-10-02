// Must run before any schema module loads.
import './lib/zod-config';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './app/AppProviders';
import { createQueryClient } from './app/query-client';
import { appRoutes } from './app/routes';
import './index.css';

const queryClient = createQueryClient();
const router = createBrowserRouter(appRoutes);

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
