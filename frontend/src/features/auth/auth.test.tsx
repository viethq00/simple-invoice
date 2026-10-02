import { act, screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ACCESS_TOKEN, DEMO_EMAIL, DEMO_PASSWORD } from '@/test/fixtures';
import { API, errorResponse, mockDb } from '@/test/mock-api';
import { currentUrl, renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import { sessionQueryKey } from './session';

async function signIn(user: UserEvent) {
  await user.type(await screen.findByLabelText('Email address'), DEMO_EMAIL);
  await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

// Past the session's 5 minute staleTime, then the tab becomes visible again.
function returnToTabLater() {
  vi.setSystemTime(Date.now() + 6 * 60 * 1000);
  act(() => {
    window.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('protected routes', () => {
  it('send signed-out visitors to the login screen', async () => {
    const { router } = renderApp('/invoices/new', { authenticated: false });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/login');
    expect(mockDb.listRequests).toHaveLength(0);
  });

  it('show the app shell with the signed-in user', async () => {
    renderApp('/invoices');

    expect(await screen.findByRole('heading', { name: 'Invoices', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('Jordan Lee').length).toBeGreaterThan(0);
  });

  it('redirect signed-in users away from the login screen', async () => {
    const { router } = renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Invoices', level: 1 })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/invoices');
  });
});

describe('login screen', () => {
  it('validates both fields before calling the API', async () => {
    const { user } = renderApp('/login', { authenticated: false });
    const signIn = await screen.findByRole('button', { name: 'Sign in' });

    await user.click(signIn);
    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email address')).toHaveFocus();

    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.click(signIn);
    expect(
      await screen.findByText('Enter a valid email address, like name@example.com'),
    ).toBeInTheDocument();
  });

  it('shows a clear message for wrong credentials', async () => {
    const { user } = renderApp('/login', { authenticated: false });

    await user.type(await screen.findByLabelText('Email address'), DEMO_EMAIL);
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The email or password is incorrect. Check both and try again.',
    );
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveFocus());
  });

  it('explains rate limiting', async () => {
    server.use(
      http.post(API('/auth/login'), () =>
        errorResponse(429, 'ThrottlerException: Too Many Requests', 'Too Many Requests'),
      ),
    );
    const { user } = renderApp('/login', { authenticated: false });

    await user.type(await screen.findByLabelText('Email address'), DEMO_EMAIL);
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-in attempts');
  });

  it('signs in and returns to the page that was requested', async () => {
    const { user, router } = renderApp('/invoices?status=Paid', { authenticated: false });

    await user.type(await screen.findByLabelText('Email address'), `  ${DEMO_EMAIL} `);
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Invoices', level: 1 })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/invoices?status=Paid');
  });

  it.each(['//example.com/phish', '/\\example.com/phish'])(
    'never returns to an address outside the app (%s) after signing in',
    async (path) => {
      const { user, router } = renderApp(path, { authenticated: false });

      await signIn(user);

      expect(
        await screen.findByRole('heading', { name: 'Invoices', level: 1 }),
      ).toBeInTheDocument();
      expect(currentUrl(router)).toBe('/invoices');
    },
  );

  it('does not keep the access token once signed in', async () => {
    const { user, queryClient } = renderApp('/login', { authenticated: false });

    await signIn(user);
    await screen.findByRole('heading', { name: 'Invoices', level: 1 });

    const mutations = queryClient.getMutationCache().getAll();
    const queries = queryClient.getQueryCache().getAll();
    const cached = JSON.stringify([...mutations, ...queries].map((entry) => entry.state.data));
    expect(cached).not.toContain(DEMO_ACCESS_TOKEN);
  });

  it('lands on the invoice list by default after signing in', async () => {
    const { user, router } = renderApp('/login', { authenticated: false });

    await user.type(await screen.findByLabelText('Email address'), DEMO_EMAIL);
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(currentUrl(router)).toBe('/invoices'));
  });

  it('can reveal the password', async () => {
    const { user } = renderApp('/login', { authenticated: false });
    const password = await screen.findByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});

describe('session lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs out and returns to the login screen', async () => {
    const { user, router } = renderApp('/invoices');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(mockDb.authenticated).toBe(false);
  });

  it('sends the user to sign in again when the session expires, then returns them', async () => {
    const { user, router } = renderApp('/invoices');
    expect(await screen.findByRole('heading', { name: 'Invoices', level: 1 })).toBeInTheDocument();

    mockDb.authenticated = false;
    await user.click(screen.getByRole('radio', { name: 'Paid' }));

    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');

    await user.type(screen.getByLabelText('Email address'), DEMO_EMAIL);
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Invoices', level: 1 })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/invoices?status=Paid');
  });

  it('keeps the signed-in app, and unsaved input, when a background session check fails', async () => {
    // Fake only Date, so the session goes stale while timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    const { user, queryClient } = renderApp('/invoices/new');
    await screen.findByRole('heading', { name: 'New invoice', level: 1 });
    await user.type(screen.getByLabelText('Customer name'), 'Paul');

    let checks = 0;
    server.use(
      http.get(API('/auth/me'), () => {
        checks += 1;
        return HttpResponse.error();
      }),
    );
    returnToTabLater();

    await waitFor(() => expect(checks).toBe(1));
    await waitFor(() =>
      expect(queryClient.getQueryState(sessionQueryKey)).toMatchObject({
        status: 'error',
        fetchStatus: 'idle',
      }),
    );
    expect(screen.queryByText("SimpleInvoice couldn't start")).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New invoice', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('Customer name')).toHaveValue('Paul');
  });

  it('sends the user to sign in when a background session check finds the session expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { router } = renderApp('/invoices');
    await screen.findByRole('heading', { name: 'Invoices', level: 1 });

    mockDb.authenticated = false;
    returnToTabLater();

    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('offers a retry when the session check itself fails', async () => {
    server.use(
      http.get(API('/auth/me'), () =>
        errorResponse(503, 'Service Unavailable', 'Service Unavailable'),
      ),
    );
    const { user } = renderApp('/invoices');

    expect(await screen.findByText("SimpleInvoice couldn't start")).toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Invoices', level: 1 })).toBeInTheDocument();
  });
});
