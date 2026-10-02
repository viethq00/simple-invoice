import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/test/fixtures';
import { mockDb } from '@/test/mock-api';
import { currentUrl, renderApp } from '@/test/render-app';

describe('app shell and routing', () => {
  it('opens on the invoice list', async () => {
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Invoices', level: 1 })).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/invoices');
  });

  it('shows a not-found page for unknown addresses', async () => {
    renderApp('/reports/2026');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to invoices' })).toHaveAttribute(
      'href',
      '/invoices',
    );
  });

  it('marks the current section in the main navigation', async () => {
    renderApp('/invoices/new');
    await screen.findByRole('heading', { name: 'New invoice', level: 1 });

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'New invoice' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Invoices' })).not.toHaveAttribute('aria-current');
  });

  it('leaves focus alone on a fresh page load', async () => {
    renderApp('/invoices');
    const heading = await screen.findByRole('heading', { name: 'Invoices', level: 1 });
    expect(heading).not.toHaveFocus();
  });

  it('focuses the invoice list heading after signing in', async () => {
    const { user } = renderApp('/login', { authenticated: false });

    await user.type(await screen.findByLabelText('Email address'), DEMO_EMAIL);
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const heading = await screen.findByRole('heading', { name: 'Invoices', level: 1 });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('keeps focus on the control when only the filters change', async () => {
    const { user } = renderApp('/invoices');
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'Paid' }));

    await waitFor(() =>
      expect(mockDb.listRequests.at(-1)?.searchParams.get('status')).toBe('Paid'),
    );
    expect(screen.getByRole('radio', { name: 'Paid' })).toHaveFocus();
  });

  it('moves focus to the new page heading after navigating', async () => {
    const { user } = renderApp('/invoices');
    await screen.findByRole('heading', { name: 'Invoices', level: 1 });

    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'New invoice' }));

    const heading = await screen.findByRole('heading', { name: 'New invoice', level: 1 });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('moves focus to an invoice heading once the invoice has loaded', async () => {
    const { user } = renderApp('/invoices');
    const table = await screen.findByRole('table');

    await user.click(within(table).getAllByRole('link')[0]!);

    const heading = await screen.findByRole('heading', { name: /^Invoice INV-/, level: 1 });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('names the browser tab after the page', async () => {
    const { user } = renderApp('/invoices');
    await screen.findByRole('heading', { name: 'Invoices', level: 1 });
    expect(document.title).toBe('Invoices – SimpleInvoice');

    await user.click(within(await screen.findByRole('table')).getAllByRole('link')[0]!);

    await waitFor(() => expect(document.title).toMatch(/^Invoice INV-\S+ – SimpleInvoice$/));
  });

  it('opens and closes the mobile menu', async () => {
    const { user } = renderApp('/invoices');
    await screen.findByRole('heading', { name: 'Invoices', level: 1 });

    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(2);

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('offers a skip link to the main content', async () => {
    renderApp('/invoices');
    expect(await screen.findByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });
});
