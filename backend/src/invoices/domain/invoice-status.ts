export const STORED_INVOICE_STATUSES = ['Draft', 'Pending', 'Paid'] as const;
export type StoredInvoiceStatus = (typeof STORED_INVOICE_STATUSES)[number];

// Overdue is derived when reading, never stored.
export const INVOICE_STATUSES = [...STORED_INVOICE_STATUSES, 'Overdue'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// YYYY-MM-DD strings compare chronologically.
export function deriveInvoiceStatus(
  stored: StoredInvoiceStatus,
  dueDate: string,
  today: string,
): InvoiceStatus {
  return stored !== 'Paid' && dueDate < today ? 'Overdue' : stored;
}
