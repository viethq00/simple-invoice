import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '@/lib/errors';
import { API, errorResponse, mockDb } from '@/test/mock-api';
import { currentUrl, renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import { DUPLICATE_NUMBER_MESSAGE } from './CreateInvoicePage';

async function openForm() {
  const view = renderApp('/invoices/new');
  await screen.findByRole('heading', { name: 'New invoice', level: 1 });
  return view;
}

async function fillRequiredFields(user: UserEvent, invoiceNumber = 'INV-2026-100') {
  await user.type(screen.getByLabelText('Customer name'), 'Paul');
  await user.type(screen.getByLabelText('Email address'), 'paul@101digital.io');
  await user.type(screen.getByLabelText('Invoice number'), invoiceNumber);
  await user.type(screen.getByLabelText('Item name'), 'Honda RC150');
  await user.clear(screen.getByLabelText('Quantity'));
  await user.type(screen.getByLabelText('Quantity'), '2');
  await user.type(screen.getByLabelText('Rate'), '1000');
}

const submit = (user: UserEvent) =>
  user.click(screen.getByRole('button', { name: 'Create invoice' }));

describe('create invoice', () => {
  beforeEach(() => {
    // Fake only Date, so user-event and toast timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 9, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with sensible defaults', async () => {
    await openForm();

    expect(screen.getByLabelText('Invoice date')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-10-31');
    expect(screen.getByLabelText('Currency')).toHaveValue('AUD');
    expect(screen.getByLabelText('Quantity')).toHaveValue('1');
    expect(screen.getByLabelText('Tax (%) (optional)')).toHaveValue('10');
    expect(screen.getByLabelText('Discount (optional)')).toHaveValue('0');
    expect(screen.getByText('Totals are calculated when you save.')).toBeInTheDocument();
  });

  it('checks required fields first and focuses the first problem', async () => {
    const { user } = await openForm();

    await submit(user);

    expect(await screen.findByText("Enter the customer's name")).toBeInTheDocument();
    expect(screen.getByText("Enter the customer's email address")).toBeInTheDocument();
    expect(screen.getByText('Enter an invoice number')).toBeInTheDocument();
    expect(screen.getByText('Enter the item name')).toBeInTheDocument();
    expect(screen.getByText('Enter a rate')).toBeInTheDocument();
    expect(screen.getByLabelText('Customer name')).toHaveFocus();
    expect(screen.getByLabelText('Customer name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Customer name')).toHaveAccessibleDescription(
      "Enter the customer's name",
    );
    expect(mockDb.createRequests).toHaveLength(0);
  });

  it('rejects a due date before the invoice date', async () => {
    const { user } = await openForm();
    await fillRequiredFields(user);

    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-09-30' } });
    await submit(user);

    expect(
      await screen.findByText('The due date must be on or after the invoice date'),
    ).toBeInTheDocument();
    expect(mockDb.createRequests).toHaveLength(0);
  });

  it('sends exactly what was entered, then confirms and returns to the list', async () => {
    const { user, router } = await openForm();
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText('Mobile number (optional)'), '947717364111');
    await user.type(screen.getByLabelText('Address (optional)'), 'Singapore');
    await user.type(screen.getByLabelText('Reference (optional)'), '#5721662');
    await user.type(
      screen.getByLabelText('Description (optional)'),
      'Invoice is issued to Kanglee',
    );
    await user.selectOptions(screen.getByLabelText('Currency'), 'SGD');
    await user.clear(screen.getByLabelText('Discount (optional)'));
    await user.type(screen.getByLabelText('Discount (optional)'), '20');

    await submit(user);

    await waitFor(() => expect(mockDb.createRequests).toHaveLength(1));
    expect(mockDb.createRequests[0]).toEqual({
      invoiceNumber: 'INV-2026-100',
      invoiceReference: '#5721662',
      invoiceDate: '2026-10-01',
      dueDate: '2026-10-31',
      currency: 'SGD',
      description: 'Invoice is issued to Kanglee',
      customer: {
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: '947717364111',
        address: 'Singapore',
      },
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
      taxPercent: 10,
      discount: 20,
    });

    expect(await screen.findByText('Invoice INV-2026-100 created')).toBeInTheDocument();
    await waitFor(() => expect(currentUrl(router)).toBe('/invoices'));
    const table = await screen.findByRole('table');
    expect(await within(table).findByRole('link', { name: 'INV-2026-100' })).toBeInTheDocument();
  });

  it('leaves blank optional fields out of the request', async () => {
    const { user } = await openForm();
    await fillRequiredFields(user);
    await user.clear(screen.getByLabelText('Tax (%) (optional)'));
    await user.clear(screen.getByLabelText('Discount (optional)'));

    await submit(user);

    await waitFor(() => expect(mockDb.createRequests).toHaveLength(1));
    expect(mockDb.createRequests[0]).toEqual({
      invoiceNumber: 'INV-2026-100',
      invoiceDate: '2026-10-01',
      dueDate: '2026-10-31',
      currency: 'AUD',
      customer: { fullname: 'Paul', email: 'paul@101digital.io' },
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
    });
  });

  it('accepts amounts typed with a decimal comma', async () => {
    const { user } = await openForm();
    await fillRequiredFields(user);
    await user.clear(screen.getByLabelText('Rate'));
    await user.type(screen.getByLabelText('Rate'), '1000,50');
    await user.clear(screen.getByLabelText('Tax (%) (optional)'));
    await user.type(screen.getByLabelText('Tax (%) (optional)'), '7,5');

    await submit(user);

    await waitFor(() => expect(mockDb.createRequests).toHaveLength(1));
    expect(mockDb.createRequests[0]).toMatchObject({
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000.5 }],
      taxPercent: 7.5,
    });
  });

  it('shows a duplicate invoice number on its field', async () => {
    const { user, router } = await openForm();
    await fillRequiredFields(user, 'iv1780488206995');

    await submit(user);

    expect(await screen.findByText(DUPLICATE_NUMBER_MESSAGE)).toBeInTheDocument();
    const field = screen.getByLabelText('Invoice number');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveFocus();
    expect(currentUrl(router)).toBe('/invoices/new');
  });

  it('puts server validation messages on their fields', async () => {
    server.use(
      http.post(API('/invoices'), () =>
        errorResponse(
          400,
          ['discount must not exceed subtotal plus tax', 'property status should not exist'],
          'Bad Request',
        ),
      ),
    );
    const { user } = await openForm();
    await fillRequiredFields(user);

    await submit(user);

    expect(
      await screen.findByText("The discount can't be more than the subtotal plus tax"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Discount (optional)')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('property status should not exist');
  });

  it('explains when the server cannot be reached', async () => {
    server.use(http.post(API('/invoices'), () => HttpResponse.error()));
    const { user } = await openForm();
    await fillRequiredFields(user);

    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(NETWORK_ERROR_MESSAGE);
  });

  it('cancels back to the list', async () => {
    const { user, router } = await openForm();

    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    await waitFor(() => expect(currentUrl(router)).toBe('/invoices'));
  });

  it('cancels back to the list as it was left', async () => {
    const { user, router } = renderApp('/invoices?sortBy=dueDate&page=2');
    await screen.findByRole('heading', { name: 'Invoices', level: 1 });

    await user.click(within(screen.getByRole('main')).getByRole('link', { name: 'New invoice' }));
    await user.click(await screen.findByRole('link', { name: 'Cancel' }));

    await waitFor(() => expect(currentUrl(router)).toBe('/invoices?sortBy=dueDate&page=2'));
  });
});
