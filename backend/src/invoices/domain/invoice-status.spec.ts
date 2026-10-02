import { deriveInvoiceStatus, INVOICE_STATUSES, STORED_INVOICE_STATUSES } from './invoice-status';

describe('deriveInvoiceStatus', () => {
  const today = '2026-10-01';

  it.each([
    // stored,   dueDate,      expected
    ['Draft', '2026-09-30', 'Overdue'],
    ['Pending', '2026-09-30', 'Overdue'],
    ['Paid', '2026-09-30', 'Paid'],
    ['Draft', '2026-10-01', 'Draft'],
    ['Pending', '2026-10-01', 'Pending'],
    ['Paid', '2026-10-01', 'Paid'],
    ['Draft', '2026-10-02', 'Draft'],
    ['Pending', '2026-10-02', 'Pending'],
    ['Paid', '2026-10-02', 'Paid'],
    ['Pending', '2025-12-31', 'Overdue'],
  ] as const)('%s due %s is %s', (stored, dueDate, expected) => {
    expect(deriveInvoiceStatus(stored, dueDate, today)).toBe(expected);
  });

  it('never stores Overdue: it is only a derived status', () => {
    expect(STORED_INVOICE_STATUSES).toEqual(['Draft', 'Pending', 'Paid']);
    expect(INVOICE_STATUSES).toEqual(['Draft', 'Pending', 'Paid', 'Overdue']);
  });
});
