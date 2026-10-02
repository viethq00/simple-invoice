import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { API, errorResponse, mockDb } from '@/test/mock-api';
import { currentUrl, renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import { SEARCH_DEBOUNCE_MS } from './components/InvoiceFilters';

function lastListParams(): Record<string, string> {
  const url = mockDb.listRequests.at(-1);
  if (!url) throw new Error('No list request was made');
  return Object.fromEntries(url.searchParams);
}

async function findTable() {
  return screen.findByRole('table', { name: /^Invoices, sorted by/ });
}

function bodyRows(table: HTMLElement) {
  return within(table).getAllByRole('row').slice(1);
}

const searchBox = () => screen.getByRole('searchbox', { name: 'Search invoices' });

const outlastSearchDelay = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 200)));

describe('invoice list', () => {
  it('shows the first page with every required column, newest first', async () => {
    renderApp('/invoices');
    const table = await findTable();

    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'Invoice number',
      'Customer',
      'Invoice date',
      'Due date',
      'Total amount',
      'Status',
    ]);

    const rows = bodyRows(table);
    expect(rows).toHaveLength(10);
    const firstRow = within(rows[0]!);
    expect(firstRow.getByRole('link', { name: 'INV-0024' })).toBeInTheDocument();
    expect(firstRow.getByText('Mia Chen')).toBeInTheDocument();
    expect(firstRow.getByText('25 Aug 2026')).toBeInTheDocument();
    expect(firstRow.getByText('25 Sep 2026')).toBeInTheDocument();
    expect(firstRow.getByText('AU$2,750.00')).toBeInTheDocument();
    expect(firstRow.getByText('Draft')).toBeInTheDocument();

    expect(screen.getByText('Showing 1–10 of 25 invoices')).toBeInTheDocument();
    expect(lastListParams()).toEqual({
      page: '1',
      pageSize: '10',
      sortBy: 'invoiceDate',
      ordering: 'DESC',
    });
  });

  it('searches by invoice number or customer once typing pauses', async () => {
    const { user, router } = renderApp('/invoices');
    await findTable();
    const requestsBefore = mockDb.listRequests.length;

    await user.type(screen.getByRole('searchbox', { name: 'Search invoices' }), 'paul');

    await waitFor(() => expect(lastListParams()).toMatchObject({ keyword: 'paul', page: '1' }));
    expect(mockDb.listRequests.length - requestsBefore).toBe(1);
    expect(await screen.findByText('Showing 1–1 of 1 invoice')).toBeInTheDocument();
    expect(
      within(await findTable()).getByRole('link', { name: 'IV1780488206995' }),
    ).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/invoices?keyword=paul');
  });

  it('filters by status, including the derived Overdue status', async () => {
    const { user, router } = renderApp('/invoices');
    await findTable();

    await user.click(screen.getByRole('radio', { name: 'Overdue' }));

    await waitFor(() => expect(lastListParams()).toMatchObject({ status: 'Overdue', page: '1' }));
    expect(screen.getByRole('radio', { name: 'Overdue' })).toBeChecked();
    expect(currentUrl(router)).toBe('/invoices?status=Overdue');
    await waitFor(() => {
      const statuses = bodyRows(screen.getByRole('table')).map(
        (row) => within(row).getAllByRole('cell').at(-1)?.textContent,
      );
      expect(statuses.length).toBeGreaterThan(0);
      expect(new Set(statuses)).toEqual(new Set(['Overdue']));
    });

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await waitFor(() => expect(lastListParams()).not.toHaveProperty('status'));
  });

  it('sorts by each field in both directions', async () => {
    const { user } = renderApp('/invoices');
    const table = await findTable();

    expect(within(table).getByRole('columnheader', { name: /Invoice date/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await user.selectOptions(screen.getByLabelText('Sort by'), 'totalAmount');
    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ sortBy: 'totalAmount', ordering: 'DESC' }),
    );
    expect(
      within(screen.getByRole('table')).getByRole('columnheader', { name: /Total amount/ }),
    ).toHaveAttribute('aria-sort', 'descending');

    await user.click(screen.getByRole('button', { name: 'Sort order: Highest first' }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ ordering: 'ASC' }));
    expect(screen.getByRole('button', { name: 'Sort order: Lowest first' })).toBeInTheDocument();

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: /Due date/ }));
    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ sortBy: 'dueDate', ordering: 'DESC' }),
    );

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: /Due date/ }));
    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ sortBy: 'dueDate', ordering: 'ASC' }),
    );
  });

  it('pages through results on the server', async () => {
    const { user, router } = renderApp('/invoices');
    await findTable();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ page: '2' }));
    expect(await screen.findByText('Showing 11–20 of 25 invoices')).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/invoices?page=2');

    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(await screen.findByText('Showing 21–25 of 25 invoices')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('changes the page size and starts again from page one', async () => {
    const { user } = renderApp('/invoices?page=2');
    await screen.findByText('Showing 11–20 of 25 invoices');

    await user.selectOptions(screen.getByLabelText('Rows per page'), '20');

    await waitFor(() => expect(lastListParams()).toMatchObject({ pageSize: '20', page: '1' }));
    expect(await screen.findByText('Showing 1–20 of 25 invoices')).toBeInTheDocument();
  });

  it('filters by an invoice date range', async () => {
    const { router } = renderApp('/invoices');
    await findTable();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-10' } });
    await waitFor(() => expect(lastListParams()).toMatchObject({ fromDate: '2026-08-10' }));

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-12' } });
    await waitFor(() =>
      expect(lastListParams()).toMatchObject({ fromDate: '2026-08-10', toDate: '2026-08-12' }),
    );
    expect(await screen.findByText('Showing 1–3 of 3 invoices')).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/invoices?fromDate=2026-08-10&toDate=2026-08-12');
  });

  it('waits for a typed date to have its full year before filtering', async () => {
    const { router } = renderApp('/invoices');
    await findTable();
    const requests = mockDb.listRequests.length;
    const from = screen.getByLabelText('From');

    // Chrome reports the date after each digit of the year.
    for (const value of ['0002-08-10', '0020-08-10', '0202-08-10']) {
      fireEvent.change(from, { target: { value } });
      expect(from).toHaveValue(value);
    }
    expect(currentUrl(router)).toBe('/invoices');

    fireEvent.change(from, { target: { value: '2026-08-10' } });
    await waitFor(() => expect(lastListParams()).toMatchObject({ fromDate: '2026-08-10' }));
    expect(mockDb.listRequests).toHaveLength(requests + 1);
    expect(currentUrl(router)).toBe('/invoices?fromDate=2026-08-10');

    fireEvent.change(from, { target: { value: '' } });
    await waitFor(() => expect(currentUrl(router)).toBe('/invoices'));
    expect(from).toHaveValue('');
  });

  it('explains an inverted date range instead of querying', async () => {
    renderApp('/invoices?fromDate=2026-09-01&toDate=2026-08-01');

    expect(
      await screen.findByText('The start date must be on or before the end date.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Fix the invoice date range to see results.')).toBeInTheDocument();
    expect(mockDb.listRequests).toHaveLength(0);
  });

  it('restores filters, sorting and paging from the URL', async () => {
    renderApp('/invoices?status=Paid&sortBy=totalAmount&ordering=ASC&pageSize=20&keyword=inv');
    await findTable();

    expect(lastListParams()).toEqual({
      page: '1',
      pageSize: '20',
      sortBy: 'totalAmount',
      ordering: 'ASC',
      status: 'Paid',
      keyword: 'inv',
    });
    expect(screen.getByRole('radio', { name: 'Paid' })).toBeChecked();
    expect(screen.getByLabelText('Sort by')).toHaveValue('totalAmount');
    expect(screen.getByLabelText('Rows per page')).toHaveValue('20');
    expect(screen.getByRole('searchbox', { name: 'Search invoices' })).toHaveValue('inv');
  });

  it('offers to clear filters when nothing matches', async () => {
    const { user, router } = renderApp('/invoices?keyword=zzz');

    expect(await screen.findByText('No invoices match these filters.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);

    expect(await findTable()).toBeInTheDocument();
    expect(currentUrl(router)).toBe('/invoices');
    expect(screen.getByRole('searchbox', { name: 'Search invoices' })).toHaveValue('');
  });

  it('invites creating the first invoice when there are none', async () => {
    mockDb.invoices = [];
    renderApp('/invoices');

    expect(await screen.findByText('There are no invoices yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create invoice' })).toHaveAttribute(
      'href',
      '/invoices/new',
    );
  });

  it('shows an error with a retry when the list fails to load', async () => {
    server.use(
      http.get(
        API('/invoices'),
        () => errorResponse(500, 'Internal server error', 'Internal Server Error'),
        { once: true },
      ),
    );
    const { user } = renderApp('/invoices');

    expect(await screen.findByText("We couldn't load invoices")).toBeInTheDocument();
    expect(
      screen.getByText('The server ran into a problem. Try again in a moment.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await findTable()).toBeInTheDocument();
  });

  it('moves to the last page when the requested page is past the end', async () => {
    server.use(
      http.get(API('/invoices'), async ({ request }) => {
        if (new URL(request.url).searchParams.get('page') === '3') await delay(200);
        return undefined; // fall through to the mock API
      }),
    );
    // Record every summary shown, to catch a brief misleading state.
    const shown = new Set<string>();
    const observer = new MutationObserver(() => {
      const summary = document.getElementById('results-summary')?.textContent;
      if (summary) shown.add(summary);
      if (document.body.textContent?.includes('There are no invoices yet.')) shown.add('empty');
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    const { router } = renderApp('/invoices?page=9');

    expect(await screen.findByText('Showing 21–25 of 25 invoices')).toBeInTheDocument();
    observer.disconnect();
    expect(currentUrl(router)).toBe('/invoices?page=3');
    expect([...shown]).toEqual(['Loading invoices…', 'Showing 21–25 of 25 invoices']);
  });

  it('opens an invoice and comes back to the same view', async () => {
    const { user, router } = renderApp('/invoices?status=Overdue');
    const table = await findTable();

    await user.click(within(table).getByRole('link', { name: 'IV1780488206995' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /IV1780488206995/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to invoices' }));
    await findTable();
    expect(currentUrl(router)).toBe('/invoices?status=Overdue');
  });

  it('keeps a space typed at a word boundary', async () => {
    const { user, router } = renderApp('/invoices');
    await findTable();

    await user.type(searchBox(), 'Harbour ');
    await waitFor(() => expect(currentUrl(router)).toBe('/invoices?keyword=Harbour'));
    await user.type(searchBox(), 'Coffee');

    await waitFor(() => expect(currentUrl(router)).toBe('/invoices?keyword=Harbour+Coffee'));
    expect(searchBox()).toHaveValue('Harbour Coffee');
  });

  it('keeps other changes made while a search is still being typed', async () => {
    const { user, router } = renderApp('/invoices');
    await findTable();

    await user.type(searchBox(), 'paul');
    await user.click(screen.getByRole('radio', { name: 'Overdue' }));
    await user.selectOptions(screen.getByLabelText('Sort by'), 'totalAmount');

    await waitFor(() =>
      expect(currentUrl(router)).toBe('/invoices?keyword=paul&status=Overdue&sortBy=totalAmount'),
    );
    await outlastSearchDelay();
    expect(currentUrl(router)).toBe('/invoices?keyword=paul&status=Overdue&sortBy=totalAmount');
    expect(screen.getByRole('radio', { name: 'Overdue' })).toBeChecked();
    expect(screen.getByLabelText('Sort by')).toHaveValue('totalAmount');
    expect(lastListParams()).toMatchObject({ keyword: 'paul', status: 'Overdue' });
  });

  it('drops a search still being typed when the filters are cleared', async () => {
    const { user, router } = renderApp('/invoices?status=Paid');
    await findTable();

    await user.type(searchBox(), 'inv');
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);

    await outlastSearchDelay();
    expect(currentUrl(router)).toBe('/invoices');
    expect(searchBox()).toHaveValue('');
  });

  it('drops a search still being typed when going back', async () => {
    const { user, router } = renderApp('/invoices?keyword=lan');
    await findTable();
    await user.click(screen.getByRole('radio', { name: 'Paid' }));
    await waitFor(() => expect(currentUrl(router)).toBe('/invoices?keyword=lan&status=Paid'));

    await user.type(searchBox(), 'x');
    await act(() => router.navigate(-1));

    await outlastSearchDelay();
    expect(currentUrl(router)).toBe('/invoices?keyword=lan');
    expect(searchBox()).toHaveValue('lan');
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  });

  it('links to invoice creation', async () => {
    renderApp('/invoices');
    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('link', { name: 'New invoice' })).toHaveAttribute(
      'href',
      '/invoices/new',
    );
  });
});
