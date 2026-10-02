import type { Invoice } from './entities/invoice.entity';
import { toInvoiceResponse } from './invoice.mapper';

const appendixA = (): Invoice => ({
  id: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  invoiceNumber: 'IV1780488206995',
  invoiceReference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  currencySymbol: 'AU$',
  description: 'Invoice is issued to Kanglee',
  status: 'Pending',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  taxPercent: '10.00',
  invoiceSubTotal: '2000.00',
  totalTax: '200.00',
  totalDiscount: '20.00',
  totalAmount: '2180.00',
  totalPaid: '1451.34',
  balanceAmount: '728.66',
  createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  createdAt: new Date('2026-06-03T12:03:26.995Z'),
  items: [
    {
      id: 'b1c2d3e4-0000-0000-0000-000000000001',
      invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
      name: 'Honda RC150',
      quantity: 2,
      rate: '1000.00',
    },
  ],
});

describe('toInvoiceResponse', () => {
  it('maps the Appendix A record to the API shape with exact numbers', () => {
    expect(toInvoiceResponse(appendixA(), '2026-10-01')).toEqual({
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
      createdBy: 'ad1e0902-1928-4345-b513-60c86c94fc91',
    });
  });

  it('keeps the stored status while the invoice is not yet due', () => {
    expect(toInvoiceResponse(appendixA(), '2026-07-03').status).toBe('Pending');
  });

  it('keeps optional customer fields as null', () => {
    const invoice = appendixA();
    invoice.customer.mobileNumber = null;
    invoice.customer.address = null;
    expect(toInvoiceResponse(invoice, '2026-07-01').customer).toEqual({
      fullname: 'Paul',
      email: 'paul@101digital.io',
      mobileNumber: null,
      address: null,
    });
  });

  it('round-trips the largest supported amounts exactly', () => {
    const invoice = appendixA();
    invoice.totalAmount = '1999897980101.01';
    expect(JSON.parse(JSON.stringify(toInvoiceResponse(invoice, '2026-07-01'))).totalAmount).toBe(
      1999897980101.01,
    );
    expect(String(toInvoiceResponse(invoice, '2026-07-01').totalAmount)).toBe('1999897980101.01');
  });
});
