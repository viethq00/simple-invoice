import { describe, expect, it } from 'vitest';
import {
  createInvoiceDefaults,
  createInvoiceSchema,
  toCreateInvoiceRequest,
  type CreateInvoiceFormValues,
} from './create-invoice-schema';

function validValues(overrides: Partial<CreateInvoiceFormValues> = {}): CreateInvoiceFormValues {
  return {
    ...createInvoiceDefaults('2026-10-01'),
    customer: { fullname: 'Paul', email: 'paul@101digital.io', mobileNumber: '', address: '' },
    invoiceNumber: 'INV-2026-001',
    items: [{ name: 'Honda RC150', quantity: '2', rate: '1000' }],
    ...overrides,
  };
}

function errorsFor(values: unknown): Record<string, string> {
  const result = createInvoiceSchema.safeParse(values);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[issue.path.join('.')] ??= issue.message;
  return errors;
}

describe('createInvoiceDefaults', () => {
  it('starts today, due in 30 days, in AUD with one unit, 10% tax and no discount', () => {
    expect(createInvoiceDefaults('2026-10-01')).toMatchObject({
      invoiceDate: '2026-10-01',
      dueDate: '2026-10-31',
      currency: 'AUD',
      items: [{ name: '', quantity: '1', rate: '' }],
      taxPercent: '10',
      discount: '0',
    });
  });
});

describe('createInvoiceSchema', () => {
  it('accepts a complete invoice', () => {
    expect(errorsFor(validValues())).toEqual({});
  });

  it('requires every mandatory field', () => {
    expect(errorsFor(createInvoiceDefaults('2026-10-01'))).toEqual({
      'customer.fullname': "Enter the customer's name",
      'customer.email': "Enter the customer's email address",
      invoiceNumber: 'Enter an invoice number',
      'items.0.name': 'Enter the item name',
      'items.0.rate': 'Enter a rate',
    });
  });

  it('rejects a whitespace-only customer name', () => {
    expect(
      errorsFor(validValues({ customer: { ...validValues().customer, fullname: '   ' } })),
    ).toEqual({ 'customer.fullname': "Enter the customer's name" });
  });

  it('validates the email format', () => {
    expect(
      errorsFor(validValues({ customer: { ...validValues().customer, email: 'paul@' } })),
    ).toEqual({ 'customer.email': 'Enter a valid email address, like name@example.com' });
  });

  it.each([
    ['+61 400 123 456', true],
    ['(02) 9876-5432', true],
    ['947717364111', true],
    ['12345', false],
    ['0400 123 abc', false],
    ['61+400123456', false],
  ])('checks the mobile number %j', (mobileNumber, valid) => {
    const errors = errorsFor(
      validValues({ customer: { ...validValues().customer, mobileNumber } }),
    );
    expect('customer.mobileNumber' in errors).toBe(!valid);
  });

  it.each([
    ['IV1780488206995', true],
    ['INV/2026#7.a_b-c', true],
    ['-INV', false],
    ['INV 001', false],
    ['a'.repeat(51), false],
  ])('checks the invoice number %j', (invoiceNumber, valid) => {
    expect('invoiceNumber' in errorsFor(validValues({ invoiceNumber }))).toBe(!valid);
  });

  it('requires the due date to be on or after the invoice date', () => {
    expect(errorsFor(validValues({ invoiceDate: '2026-10-01', dueDate: '2026-09-30' }))).toEqual({
      dueDate: 'The due date must be on or after the invoice date',
    });
    expect(errorsFor(validValues({ invoiceDate: '2026-10-01', dueDate: '2026-10-01' }))).toEqual(
      {},
    );
  });

  it('reports the date order even while other fields are invalid', () => {
    const errors = errorsFor({
      ...validValues({ invoiceDate: '2026-10-01', dueDate: '2026-09-30' }),
      invoiceNumber: '',
    });
    expect(errors).toMatchObject({
      invoiceNumber: 'Enter an invoice number',
      dueDate: 'The due date must be on or after the invoice date',
    });
  });

  it('rejects impossible dates', () => {
    expect(errorsFor(validValues({ invoiceDate: '2026-02-30' }))).toEqual({
      invoiceDate: 'Enter a real date',
    });
  });

  it.each([
    ['0', 'Quantity must be at least 1'],
    ['1.5', 'Quantity must be a whole number, like 1 or 12'],
    ['-1', 'Quantity must be a whole number, like 1 or 12'],
    ['1000001', "Quantity can't be more than 1,000,000"],
  ])('rejects quantity %j', (quantity, message) => {
    expect(errorsFor(validValues({ items: [{ name: 'Item', quantity, rate: '10' }] }))).toEqual({
      'items.0.quantity': message,
    });
  });

  it.each([
    ['0', 'The rate must be more than 0'],
    ['-5', 'Enter a rate with up to 2 decimal places, like 1250.50'],
    ['10.555', 'Enter a rate with up to 2 decimal places, like 1250.50'],
    ['1,000', 'Enter a rate with up to 2 decimal places, like 1250.50'],
    ['1000000.01', "The rate can't be more than 1,000,000"],
  ])('rejects rate %j', (rate, message) => {
    expect(errorsFor(validValues({ items: [{ name: 'Item', quantity: '1', rate }] }))).toEqual({
      'items.0.rate': message,
    });
  });

  it('accepts rates like 0.10 and .5', () => {
    expect(
      errorsFor(validValues({ items: [{ name: 'Item', quantity: '3', rate: '0.10' }] })),
    ).toEqual({});
    expect(
      errorsFor(validValues({ items: [{ name: 'Item', quantity: '3', rate: '.5' }] })),
    ).toEqual({});
  });

  it('reads a decimal comma, as typed on comma-locale keypads', () => {
    expect(
      errorsFor(
        validValues({
          items: [{ name: 'Item', quantity: '1', rate: '12,50' }],
          taxPercent: '7,5',
          discount: '0,25',
        }),
      ),
    ).toEqual({});
  });

  it.each(['1,000', '1,234,56', '12,', ',5'])(
    'rejects %j, where the comma is not clearly a decimal point',
    (rate) => {
      expect(errorsFor(validValues({ items: [{ name: 'Item', quantity: '1', rate }] }))).toEqual({
        'items.0.rate': 'Enter a rate with up to 2 decimal places, like 1250.50',
      });
    },
  );

  it('limits tax to 0-100% with two decimals and allows a blank value', () => {
    expect(errorsFor(validValues({ taxPercent: '' }))).toEqual({});
    expect(errorsFor(validValues({ taxPercent: '0' }))).toEqual({});
    expect(errorsFor(validValues({ taxPercent: '7.25' }))).toEqual({});
    expect(errorsFor(validValues({ taxPercent: '100.01' }))).toEqual({
      taxPercent: "Tax can't be more than 100%",
    });
    expect(errorsFor(validValues({ taxPercent: '-1' }))).toEqual({
      taxPercent: 'Enter a tax rate of 0 or more, with up to 2 decimal places',
    });
  });

  it('requires a non-negative discount with two decimals and allows a blank value', () => {
    expect(errorsFor(validValues({ discount: '' }))).toEqual({});
    expect(errorsFor(validValues({ discount: '19.95' }))).toEqual({});
    expect(errorsFor(validValues({ discount: '-20' }))).toEqual({
      discount: 'Enter a discount of 0 or more, with up to 2 decimal places',
    });
  });

  it('rejects an unsupported currency', () => {
    expect(errorsFor({ ...validValues(), currency: 'JPY' })).toEqual({
      currency: 'Choose a currency',
    });
  });

  it('caps optional text lengths', () => {
    expect(errorsFor(validValues({ description: 'x'.repeat(1001) }))).toEqual({
      description: 'Description must be 1,000 characters or fewer',
    });
  });
});

describe('toCreateInvoiceRequest', () => {
  it('converts numbers, trims text and leaves out blank optional fields', () => {
    const values = validValues({
      invoiceNumber: '  INV-2026-001 ',
      taxPercent: '',
      discount: '',
    });
    expect(toCreateInvoiceRequest(values)).toEqual({
      invoiceNumber: 'INV-2026-001',
      invoiceDate: '2026-10-01',
      dueDate: '2026-10-31',
      currency: 'AUD',
      customer: { fullname: 'Paul', email: 'paul@101digital.io' },
      items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
    });
  });

  it('sends amounts typed with a decimal comma as numbers', () => {
    const values = validValues({
      items: [{ name: 'Item', quantity: '1', rate: '12,50' }],
      taxPercent: ' 7,5 ',
      discount: '0,25',
    });
    expect(toCreateInvoiceRequest(values)).toMatchObject({
      items: [{ name: 'Item', quantity: 1, rate: 12.5 }],
      taxPercent: 7.5,
      discount: 0.25,
    });
  });

  it('includes optional fields that were filled in', () => {
    const values = validValues({
      invoiceReference: '#5721662',
      description: 'Invoice is issued to Kanglee',
      customer: {
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: '947717364111',
        address: 'Singapore',
      },
      taxPercent: '10',
      discount: '20',
    });
    expect(toCreateInvoiceRequest(values)).toMatchObject({
      invoiceReference: '#5721662',
      description: 'Invoice is issued to Kanglee',
      customer: { mobileNumber: '947717364111', address: 'Singapore' },
      taxPercent: 10,
      discount: 20,
    });
  });
});
