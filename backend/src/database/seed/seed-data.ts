import type { CurrencyCode } from '../../invoices/domain/currencies';
import type { StoredInvoiceStatus } from '../../invoices/domain/invoice-status';

export interface SeedInvoice {
  id?: string;
  invoiceNumber: string;
  invoiceReference: string | null;
  invoiceDate: string;
  dueDate: string;
  currency: CurrencyCode;
  description: string | null;
  status: StoredInvoiceStatus;
  customer: {
    fullname: string;
    email: string;
    mobileNumber: string | null;
    address: string | null;
  };
  item: { id?: string; name: string; quantity: number; rate: number };
  taxPercent: number;
  discount: number;
  totalPaid: number;
  createdAt: string;
}

// Appendix A's createdBy. The seeded reviewer account gets this id.
export const APPENDIX_A_USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91';

// Appendix A as given, except that Overdue is derived: it is stored as Pending (part paid,
// past due). Its type and invoiceGrossTotal fields aren't part of the model.
export const APPENDIX_A_INVOICE: SeedInvoice = {
  id: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  description: 'Invoice is issued to Kanglee',
  status: 'Pending',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  item: {
    id: 'b1c2d3e4-0000-0000-0000-000000000001',
    name: 'Honda RC150',
    quantity: 2,
    rate: 1000,
  },
  taxPercent: 10,
  discount: 20,
  totalPaid: 1451.34,
  createdAt: '2026-06-03T12:03:26.995Z',
};

export interface SeedCustomer {
  fullname: string;
  email: string;
  mobileNumber: string | null;
  address: string | null;
  currency: CurrencyCode;
  taxPercent: number;
}

export const SEED_CUSTOMERS: readonly SeedCustomer[] = [
  {
    fullname: 'Northwind Traders Pty Ltd',
    email: 'accounts@northwind.example',
    mobileNumber: '+61 2 9555 0142',
    address: '18 Market Street, Sydney NSW 2000, Australia',
    currency: 'AUD',
    taxPercent: 10,
  },
  {
    fullname: 'Bluegum Bakery',
    email: 'hello@bluegumbakery.example',
    mobileNumber: '+61 3 9555 0187',
    address: '42 Smith Street, Fitzroy VIC 3065, Australia',
    currency: 'AUD',
    taxPercent: 10,
  },
  {
    fullname: 'Emily Carter',
    email: 'emily.carter@example.com',
    mobileNumber: '+61 412 555 019',
    address: 'Brisbane QLD 4000, Australia',
    currency: 'AUD',
    taxPercent: 10,
  },
  {
    fullname: 'Ravi Sharma',
    email: 'ravi.sharma@example.com',
    mobileNumber: null,
    address: 'Perth WA 6000, Australia',
    currency: 'AUD',
    taxPercent: 10,
  },
  {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
    currency: 'AUD',
    taxPercent: 10,
  },
  {
    fullname: 'Aurora Analytics Pte Ltd',
    email: 'finance@aurora-analytics.example',
    mobileNumber: '+65 6555 0123',
    address: '1 Raffles Place, Singapore 048616',
    currency: 'SGD',
    taxPercent: 9,
  },
  {
    fullname: 'Linh Nguyen',
    email: 'linh.nguyen@example.com',
    mobileNumber: '+84 90 555 0198',
    address: 'District 1, Ho Chi Minh City, Vietnam',
    currency: 'USD',
    taxPercent: 0,
  },
  {
    fullname: 'Mekong Foods JSC',
    email: 'ap@mekongfoods.example',
    mobileNumber: '+84 24 5550 0171',
    address: 'Hoan Kiem, Hanoi, Vietnam',
    currency: 'USD',
    taxPercent: 0,
  },
  {
    fullname: 'Kiwi Coast Surf Co',
    email: 'orders@kiwicoast.example',
    mobileNumber: '+64 9 555 0134',
    address: 'Ponsonby, Auckland 1011, New Zealand',
    currency: 'NZD',
    taxPercent: 15,
  },
  {
    fullname: 'Thames Studio Ltd',
    email: 'billing@thamesstudio.example',
    mobileNumber: '+44 20 7946 0958',
    address: '12 Bankside, London SE1 9TG, United Kingdom',
    currency: 'GBP',
    taxPercent: 20,
  },
  {
    fullname: 'Maple Leaf Logistics Inc',
    email: 'payables@mapleleaf.example',
    mobileNumber: '+1 416 555 0175',
    address: '100 King Street W, Toronto ON, Canada',
    currency: 'CAD',
    taxPercent: 13,
  },
  {
    fullname: 'Café Lumière',
    email: 'compta@cafelumiere.example',
    mobileNumber: '+33 1 55 50 01 23',
    address: '8 Rue Cler, 75007 Paris, France',
    currency: 'EUR',
    taxPercent: 20,
  },
  {
    fullname: 'Golden Gate Robotics Inc',
    email: 'ap@goldengaterobotics.example',
    mobileNumber: '+1 415 555 0110',
    address: '500 Howard Street, San Francisco CA, USA',
    currency: 'USD',
    taxPercent: 0,
  },
  {
    fullname: 'Harbourview Dental',
    email: 'reception@harbourviewdental.example',
    mobileNumber: '+852 2555 0166',
    address: 'Central, Hong Kong',
    currency: 'HKD',
    taxPercent: 0,
  },
];

export interface SeedProduct {
  name: string;
  rate: number;
  minQuantity: number;
  maxQuantity: number;
}

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  { name: 'Website redesign', rate: 4800, minQuantity: 1, maxQuantity: 1 },
  { name: 'Monthly SEO retainer', rate: 1250, minQuantity: 1, maxQuantity: 3 },
  { name: 'Brand identity package', rate: 3200, minQuantity: 1, maxQuantity: 1 },
  { name: 'Cloud hosting (12 months)', rate: 960, minQuantity: 1, maxQuantity: 2 },
  { name: 'UX research sprint', rate: 2750, minQuantity: 1, maxQuantity: 2 },
  { name: 'Mobile app maintenance', rate: 1800, minQuantity: 1, maxQuantity: 3 },
  { name: 'Consulting hours', rate: 165, minQuantity: 4, maxQuantity: 40 },
  { name: 'Product photography session', rate: 680, minQuantity: 1, maxQuantity: 4 },
  { name: 'Honda RC150', rate: 1000, minQuantity: 1, maxQuantity: 3 },
  { name: 'Ergonomic office chair', rate: 289, minQuantity: 2, maxQuantity: 12 },
  { name: 'Laptop stand', rate: 79.95, minQuantity: 5, maxQuantity: 20 },
  { name: 'Barista training workshop', rate: 450, minQuantity: 1, maxQuantity: 6 },
  { name: 'Annual software licence', rate: 1199, minQuantity: 1, maxQuantity: 5 },
];

export const SEED_DESCRIPTIONS: readonly (string | null)[] = [
  'Thank you for your business.',
  'Payment due within the agreed terms. Bank transfer preferred.',
  'Covers all work completed during the billing period.',
  null,
  null,
];
