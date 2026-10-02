import type { Invoice, User } from '@/lib/api-types';

export const DEMO_EMAIL = 'admin@simpleinvoice.test';
export const DEMO_PASSWORD = 'Password123!';
export const DEMO_ACCESS_TOKEN = 'header.payload.signature';

export const demoUser: User = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: DEMO_EMAIL,
  fullname: 'Jordan Lee',
  createdAt: '2026-06-01T09:00:00.000Z',
};

// Appendix A as the API returns it: stored as Pending, served as Overdue.
export const appendixInvoice: Invoice = {
  invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  currencySymbol: 'AU$',
  description: 'Invoice is issued to Kanglee',
  status: 'Overdue',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  items: [
    {
      id: 'b1c2d3e4-0000-0000-0000-000000000001',
      name: 'Honda RC150',
      quantity: 2,
      rate: 1000,
      amount: 2000,
    },
  ],
  taxPercent: 10,
  invoiceSubTotal: 2000,
  totalTax: 200,
  totalDiscount: 20,
  totalAmount: 2180,
  totalPaid: 1451.34,
  balanceAmount: 728.66,
  createdAt: '2026-06-03T12:03:26.995Z',
  createdBy: demoUser.id,
};

const CUSTOMERS = [
  'Northwind Traders',
  'Lan Nguyen',
  'Harbour Coffee Co',
  'Ravi Patel',
  'Mia Chen',
];
const STATUSES = ['Draft', 'Pending', 'Paid', 'Overdue'] as const;

export function makeInvoice(index: number, overrides: Partial<Invoice> = {}): Invoice {
  const day = String((index % 28) + 1).padStart(2, '0');
  const subTotal = 100 * (index + 1);
  const tax = subTotal / 10;
  return {
    ...appendixInvoice,
    invoiceId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    invoiceNumber: `INV-${String(index).padStart(4, '0')}`,
    invoiceReference: null,
    invoiceDate: `2026-08-${day}`,
    dueDate: `2026-09-${day}`,
    description: null,
    status: STATUSES[index % STATUSES.length] ?? 'Draft',
    customer: {
      fullname: CUSTOMERS[index % CUSTOMERS.length] ?? 'Customer',
      email: `billing${index}@example.com`,
      mobileNumber: null,
      address: null,
    },
    items: [
      { id: `item-${index}`, name: 'Consulting', quantity: 1, rate: subTotal, amount: subTotal },
    ],
    invoiceSubTotal: subTotal,
    totalTax: tax,
    totalDiscount: 0,
    totalAmount: subTotal + tax,
    totalPaid: 0,
    balanceAmount: subTotal + tax,
    createdAt: `2026-08-${day}T10:00:00.000Z`,
    ...overrides,
  };
}

export function makeInvoices(count: number): Invoice[] {
  return Array.from({ length: count }, (_, index) => makeInvoice(index + 1));
}
