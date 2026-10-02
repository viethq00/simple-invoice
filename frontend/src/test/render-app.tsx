import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Not react-router/dom: under Node it resolves to a second copy with its own context.
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { createQueryClient } from '@/app/query-client';
import { appRoutes } from '@/app/routes';
import { mockDb } from './mock-api';

interface RenderAppOptions {
  authenticated?: boolean;
}

export function renderApp(path: string, { authenticated = true }: RenderAppOptions = {}) {
  mockDb.authenticated = authenticated;
  const queryClient = createQueryClient({ retry: false });
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const user = userEvent.setup();

  const view = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );

  return { ...view, user, router, queryClient };
}

export function currentUrl(router: ReturnType<typeof createMemoryRouter>): string {
  const { pathname, search } = router.state.location;
  return `${pathname}${search}`;
}
