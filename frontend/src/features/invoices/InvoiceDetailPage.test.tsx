import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { appendixInvoice, makeInvoice } from '@/test/fixtures';
import { API, errorResponse, mockDb } from '@/test/mock-api';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

function valueOf(term: string): string | null | undefined {
  return screen.getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('invoice detail', () => {
  it('shows the invoice, customer, line item and every total exactly as returned', async () => {
    renderApp(`/invoices/${appendixInvoice.invoiceId}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice IV1780488206995' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Reference #5721662')).toBeInTheDocument();
    expect(screen.getByText('Status:', { exact: false }).closest('p')).toHaveTextContent(
      'Status: Overdue',
    );

    const billTo = screen.getByRole('region', { name: 'Bill to' });
    for (const line of ['Paul', 'paul@101digital.io', '947717364111', 'Singapore']) {
      expect(within(billTo).getByText(line)).toBeInTheDocument();
    }

    expect(valueOf('Invoice date')).toBe('3 Jun 2026');
    expect(valueOf('Due date')).toBe('3 Jul 2026');
    expect(valueOf('Currency')).toBe('AUD (AU$)');
    expect(valueOf('Created')).toBe('3 Jun 2026');
    expect(screen.getByText('Invoice is issued to Kanglee')).toBeInTheDocument();

    const items = within(screen.getByRole('region', { name: 'Line items' }));
    const [, row] = items.getAllByRole('row');
    const [itemCell, ...figures] = within(row!).getAllByRole('cell');
    // The phone layout repeats quantity and rate under the item name.
    expect(itemCell).toHaveTextContent(/^Honda RC1502 × AU\$1,000\.00$/);
    expect(figures.map((cell) => cell.textContent)).toEqual(['2', 'AU$1,000.00', 'AU$2,000.00']);

    expect(valueOf('Subtotal')).toBe('AU$2,000.00');
    expect(valueOf('Tax (10%)')).toBe('AU$200.00');
    expect(valueOf('Discount')).toBe('−AU$20.00');
    expect(valueOf('Total')).toBe('AU$2,180.00');
    expect(valueOf('Paid')).toBe('−AU$1,451.34');
    expect(valueOf('Balance due')).toBe('AU$728.66');
  });

  it('leaves out optional details that are missing', async () => {
    const invoice = makeInvoice(99, { status: 'Paid', totalPaid: 0 });
    mockDb.invoices = [invoice];
    renderApp(`/invoices/${invoice.invoiceId}`);

    await screen.findByRole('heading', { level: 1, name: `Invoice ${invoice.invoiceNumber}` });
    expect(screen.queryByText(/^Reference /)).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Bill to' })).getAllByText(/./)).toHaveLength(
      3,
    );
    expect(screen.getByText('Status:', { exact: false }).closest('p')).toHaveTextContent(
      'Status: Paid',
    );
  });

  it('prints the invoice', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { user } = renderApp(`/invoices/${appendixInvoice.invoiceId}`);

    await user.click(await screen.findByRole('button', { name: 'Print' }));

    expect(print).toHaveBeenCalledOnce();
  });

  it('says when an invoice does not exist', async () => {
    renderApp('/invoices/7d6f8a8e-3f7a-4c52-9a43-0c1e6a2b9f10');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice not found' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Back to invoices' })[0]).toHaveAttribute(
      'href',
      '/invoices',
    );
  });

  it('treats a malformed invoice id as not found', async () => {
    server.use(
      http.get(API('/invoices/:invoiceId'), () =>
        errorResponse(400, ['id must be a valid UUID'], 'Bad Request'),
      ),
    );
    renderApp('/invoices/not-a-uuid');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice not found' }),
    ).toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    server.use(
      http.get(
        API('/invoices/:invoiceId'),
        () => errorResponse(500, 'Internal server error', 'Internal Server Error'),
        { once: true },
      ),
    );
    const { user } = renderApp(`/invoices/${appendixInvoice.invoiceId}`);

    expect(await screen.findByText("We couldn't load this invoice")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice IV1780488206995' }),
    ).toBeInTheDocument();
  });
});
