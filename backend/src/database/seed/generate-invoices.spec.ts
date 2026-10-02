import { CURRENCY_CODES } from '../../invoices/domain/currencies';
import { deriveInvoiceStatus } from '../../invoices/domain/invoice-status';
import { calculateInvoiceTotals } from '../../invoices/domain/money';
import { generateSeedInvoices } from './generate-invoices';
import { APPENDIX_A_INVOICE } from './seed-data';

const TODAY = '2026-10-01';

describe('generateSeedInvoices', () => {
  const invoices = generateSeedInvoices(TODAY);

  it('generates 40 invoices (20 to 50 required) with unique numbers', () => {
    expect(invoices).toHaveLength(40);
    expect(new Set(invoices.map((invoice) => invoice.invoiceNumber.toLowerCase())).size).toBe(40);
    expect(invoices.map((invoice) => invoice.invoiceNumber)).not.toContain(
      APPENDIX_A_INVOICE.invoiceNumber,
    );
  });

  it('is deterministic for the same date and seed', () => {
    expect(generateSeedInvoices(TODAY)).toEqual(invoices);
  });

  it('stores only Draft, Pending and Paid', () => {
    expect(new Set(invoices.map((invoice) => invoice.status))).toEqual(
      new Set(['Draft', 'Pending', 'Paid']),
    );
  });

  it('covers every effective status, including Overdue derived from Draft and Pending', () => {
    const effective = invoices.map((invoice) =>
      deriveInvoiceStatus(invoice.status, invoice.dueDate, TODAY),
    );
    const count = (status: string) => effective.filter((value) => value === status).length;
    expect(count('Overdue')).toBe(10);
    expect(count('Pending')).toBe(8);
    expect(count('Draft')).toBe(6);
    expect(count('Paid')).toBe(16);
    expect(invoices.some((invoice) => invoice.status === 'Draft' && invoice.dueDate < TODAY)).toBe(
      true,
    );
    expect(invoices.some((invoice) => invoice.status === 'Paid' && invoice.dueDate < TODAY)).toBe(
      true,
    );
  });

  it('varies dates, customers, currencies and amounts', () => {
    expect(new Set(invoices.map((invoice) => invoice.invoiceDate)).size).toBeGreaterThan(20);
    expect(new Set(invoices.map((invoice) => invoice.dueDate)).size).toBeGreaterThan(20);
    expect(new Set(invoices.map((invoice) => invoice.customer.fullname)).size).toBeGreaterThan(8);
    expect(new Set(invoices.map((invoice) => invoice.currency)).size).toBeGreaterThan(3);
    const totals = invoices.map(
      (invoice) =>
        calculateInvoiceTotals({ ...invoice.item, ...invoice, totalPaid: invoice.totalPaid })
          .totalAmount,
    );
    expect(new Set(totals).size).toBeGreaterThan(25);
  });

  it('only produces records that satisfy the business rules and DB constraints', () => {
    for (const invoice of invoices) {
      expect(CURRENCY_CODES).toContain(invoice.currency);
      expect(invoice.dueDate >= invoice.invoiceDate).toBe(true);
      expect(invoice.item.quantity).toBeGreaterThan(0);
      expect(Number.isInteger(invoice.item.quantity)).toBe(true);
      // Throws if the discount or payment would make the totals inconsistent.
      const totals = calculateInvoiceTotals({
        quantity: invoice.item.quantity,
        rate: invoice.item.rate,
        taxPercent: invoice.taxPercent,
        discount: invoice.discount,
        totalPaid: invoice.totalPaid,
      });
      if (invoice.status === 'Paid') expect(totals.balanceAmount).toBe('0.00');
      if (invoice.status === 'Draft') expect(totals.totalPaid).toBe('0.00');
      expect(invoice.createdAt.slice(0, 10) <= TODAY).toBe(true);
    }
  });

  it('numbers invoices in invoice-date order', () => {
    const dates = invoices.map((invoice) => invoice.invoiceDate);
    expect(dates).toEqual([...dates].sort());
    expect(invoices[0].invoiceNumber).toBe('INV-0001');
    expect(invoices[39].invoiceNumber).toBe('INV-0040');
  });
});
