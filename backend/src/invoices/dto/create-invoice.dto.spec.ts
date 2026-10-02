import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/validation.pipe';
import { CreateInvoiceDto, CustomerInputDto, InvoiceItemInputDto } from './create-invoice.dto';

const pipe = createValidationPipe();

const transform = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: CreateInvoiceDto }) as Promise<CreateInvoiceDto>;

async function messagesFor(body: unknown): Promise<string[]> {
  try {
    await transform(body);
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    const response = error.getResponse() as {
      statusCode: number;
      message: string[];
      error: string;
    };
    expect(response.statusCode).toBe(400);
    expect(response.error).toBe('Bad Request');
    return response.message;
  }
}

const validPayload = () => ({
  invoiceNumber: 'INV-2026-0042',
  invoiceDate: '2026-10-01',
  dueDate: '2026-10-31',
  currency: 'AUD',
  customer: { fullname: 'Paul', email: 'paul@101digital.io' },
  items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
});

type Payload = ReturnType<typeof validPayload> & Record<string, unknown>;
const withChanges = (change: (payload: Payload) => void): Payload => {
  const payload = validPayload() as Payload;
  change(payload);
  return payload;
};

describe('CreateInvoiceDto validation', () => {
  it('accepts the minimal valid payload and applies tax/discount defaults', async () => {
    const dto = await transform(validPayload());
    expect(dto).toBeInstanceOf(CreateInvoiceDto);
    expect(dto.customer).toBeInstanceOf(CustomerInputDto);
    expect(dto.items[0]).toBeInstanceOf(InvoiceItemInputDto);
    expect(dto.taxPercent).toBe(10);
    expect(dto.discount).toBe(0);
  });

  it('accepts every optional field', async () => {
    const dto = await transform({
      ...validPayload(),
      invoiceReference: '#5721662',
      description: 'Invoice is issued to Kanglee',
      customer: {
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: '947717364111',
        address: 'Singapore',
      },
      taxPercent: 7.5,
      discount: 20,
    });
    expect(dto).toMatchObject({ invoiceReference: '#5721662', taxPercent: 7.5, discount: 20 });
    expect(dto.customer).toMatchObject({ mobileNumber: '947717364111', address: 'Singapore' });
  });

  it('trims text and treats blank optional text as not provided', async () => {
    const dto = await transform({
      ...validPayload(),
      invoiceNumber: '  INV-7  ',
      invoiceReference: '   ',
      description: '',
      customer: {
        fullname: '  Paul  ',
        email: ' paul@101digital.io ',
        mobileNumber: ' ',
        address: '',
      },
      items: [{ name: '  Honda RC150 ', quantity: 1, rate: 5 }],
    });
    expect(dto.invoiceNumber).toBe('INV-7');
    expect(dto.invoiceReference).toBeUndefined();
    expect(dto.description).toBeUndefined();
    expect(dto.customer).toMatchObject({ fullname: 'Paul', email: 'paul@101digital.io' });
    expect(dto.customer.mobileNumber).toBeUndefined();
    expect(dto.customer.address).toBeUndefined();
    expect(dto.items[0].name).toBe('Honda RC150');
  });

  it('normalises the currency code case', async () => {
    expect((await transform({ ...validPayload(), currency: 'usd' })).currency).toBe('USD');
  });

  describe('required fields', () => {
    it.each([
      ['invoiceNumber', (p: Payload) => delete (p as Partial<Payload>).invoiceNumber],
      ['invoiceDate', (p: Payload) => delete (p as Partial<Payload>).invoiceDate],
      ['dueDate', (p: Payload) => delete (p as Partial<Payload>).dueDate],
      ['currency', (p: Payload) => delete (p as Partial<Payload>).currency],
      ['customer', (p: Payload) => delete (p as Partial<Payload>).customer],
      ['items', (p: Payload) => delete (p as Partial<Payload>).items],
      [
        'customer.fullname',
        (p: Payload) => delete (p.customer as Partial<Payload['customer']>).fullname,
      ],
      ['customer.email', (p: Payload) => delete (p.customer as Partial<Payload['customer']>).email],
      ['items.0.name', (p: Payload) => delete (p.items[0] as Partial<Payload['items'][0]>).name],
      [
        'items.0.quantity',
        (p: Payload) => delete (p.items[0] as Partial<Payload['items'][0]>).quantity,
      ],
      ['items.0.rate', (p: Payload) => delete (p.items[0] as Partial<Payload['items'][0]>).rate],
    ])('reports a missing %s', async (path, remove) => {
      expect(await messagesFor(withChanges(remove))).toEqual([`${path} is required`]);
    });

    it('rejects a whitespace-only customer name or invoice number', async () => {
      expect(
        await messagesFor(
          withChanges((p) => {
            p.customer.fullname = '   ';
            p.invoiceNumber = ' ';
          }),
        ),
      ).toEqual(['invoiceNumber is required', 'customer.fullname is required']);
    });
  });

  it('reports every invalid field in a single response', async () => {
    expect(await messagesFor({})).toEqual([
      'invoiceNumber is required',
      'invoiceDate is required',
      'dueDate is required',
      'currency is required',
      'customer is required',
      'items is required',
    ]);
  });

  describe('dates', () => {
    it('rejects a due date before the invoice date with the documented message', async () => {
      expect(await messagesFor({ ...validPayload(), dueDate: '2026-09-30' })).toEqual([
        'dueDate must be on or after invoiceDate',
      ]);
    });

    it('accepts a due date equal to the invoice date', async () => {
      expect(await messagesFor({ ...validPayload(), dueDate: '2026-10-01' })).toEqual([]);
    });

    it.each(['2026-02-30', '01/10/2026', '2026-10-01T00:00:00Z', 20261001])(
      'rejects the invalid invoice date %p',
      async (invoiceDate) => {
        expect(await messagesFor({ ...validPayload(), invoiceDate })).toEqual([
          'invoiceDate must be a valid date in YYYY-MM-DD format',
        ]);
      },
    );
  });

  describe('customer', () => {
    it.each(['paul', 'paul@', 'paul@101digital', 'pa ul@101digital.io'])(
      'rejects the invalid email %p',
      async (email) => {
        expect(await messagesFor(withChanges((p) => (p.customer.email = email)))).toEqual([
          'customer.email must be a valid email address',
        ]);
      },
    );

    it.each(['+61 412 345 678', '947717364111', '(02) 9876-5432'])(
      'accepts the mobile number %p',
      async (mobileNumber) => {
        expect(
          await messagesFor({
            ...validPayload(),
            customer: { ...validPayload().customer, mobileNumber },
          }),
        ).toEqual([]);
      },
    );

    it.each(['call me', '12345', '+61-ABC-123'])(
      'rejects the mobile number %p',
      async (mobileNumber) => {
        expect(
          await messagesFor({
            ...validPayload(),
            customer: { ...validPayload().customer, mobileNumber },
          }),
        ).toEqual([
          'customer.mobileNumber must contain at least 6 digits and only digits, spaces, +, -, ( or )',
        ]);
      },
    );

    it('rejects a non-object customer', async () => {
      expect(await messagesFor({ ...validPayload(), customer: 'Paul' })).toEqual([
        'customer must be an object',
      ]);
    });

    it('enforces maximum lengths', async () => {
      expect(
        await messagesFor(withChanges((p) => (p.customer.fullname = 'x'.repeat(121)))),
      ).toEqual(['customer.fullname must be at most 120 characters']);
    });
  });

  describe('line item', () => {
    it.each([0, -1, 1.5, '2', null])('rejects the quantity %p', async (quantity) => {
      expect(
        await messagesFor(
          withChanges((p) => ((p.items[0] as Record<string, unknown>).quantity = quantity)),
        ),
      ).toEqual([
        quantity === null
          ? 'items.0.quantity is required'
          : 'items.0.quantity must be a positive integer',
      ]);
    });

    it('caps the quantity', async () => {
      expect(await messagesFor(withChanges((p) => (p.items[0].quantity = 1_000_001)))).toEqual([
        'items.0.quantity must not exceed 1000000',
      ]);
    });

    it.each([
      [0, 'items.0.rate must be a positive number'],
      [-25, 'items.0.rate must be a positive number'],
      [10.555, 'items.0.rate must be a number with at most 2 decimal places'],
      [1e-7, 'items.0.rate must be a number with at most 2 decimal places'],
      ['1000', 'items.0.rate must be a number with at most 2 decimal places'],
      [1_000_000.01, 'items.0.rate must not exceed 1000000'],
    ])('rejects the rate %p', async (rate, message) => {
      expect(
        await messagesFor(
          withChanges((p) => ((p.items[0] as Record<string, unknown>).rate = rate)),
        ),
      ).toEqual([message]);
    });

    it.each([
      [[], 'items must contain exactly one line item'],
      [
        [
          { name: 'A', quantity: 1, rate: 1 },
          { name: 'B', quantity: 1, rate: 1 },
        ],
        'items must contain exactly one line item',
      ],
      [{ name: 'A', quantity: 1, rate: 1 }, 'items must be an array'],
      [[[]], 'items must be a list of line-item objects'],
      [[[{ name: 'A', quantity: 1, rate: 1 }]], 'items must be a list of line-item objects'],
      [[5], 'items must be a list of line-item objects'],
      [[null], 'items must be a list of line-item objects'],
    ])('requires exactly one item (%p)', async (items, message) => {
      expect(await messagesFor({ ...validPayload(), items })).toEqual([message]);
    });
  });

  describe('tax and discount', () => {
    it.each([
      [{ taxPercent: -1 }, 'taxPercent must not be negative'],
      [{ taxPercent: 100.01 }, 'taxPercent must not exceed 100'],
      [{ taxPercent: 7.125 }, 'taxPercent must be a number with at most 2 decimal places'],
      [{ taxPercent: '10' }, 'taxPercent must be a number with at most 2 decimal places'],
      [{ discount: -0.01 }, 'discount must not be negative'],
      [{ discount: 1.001 }, 'discount must be a number with at most 2 decimal places'],
      [{ taxPercent: 0.0000001 }, 'taxPercent must be a number with at most 2 decimal places'],
      [{ discount: 5e-324 }, 'discount must be a number with at most 2 decimal places'],
      [{ taxPercent: null }, 'taxPercent must be a number with at most 2 decimal places'],
      [{ discount: null }, 'discount must be a number with at most 2 decimal places'],
    ])('rejects %p', async (change, message) => {
      expect(await messagesFor({ ...validPayload(), ...change })).toEqual([message]);
    });

    it('accepts zero tax and zero discount', async () => {
      expect(await messagesFor({ ...validPayload(), taxPercent: 0, discount: 0 })).toEqual([]);
    });
  });

  describe('control characters', () => {
    it.each([
      ['customer.fullname', (p: Payload) => (p.customer.fullname = 'Pa\u0000ul')],
      // IsEmail allows control characters inside a quoted local part.
      ['customer.email', (p: Payload) => (p.customer.email = '"pa\u0001ul"@101digital.io')],
      ['customer.address', (p: Payload) => Object.assign(p.customer, { address: '1\u0000 Way' })],
      ['items.0.name', (p: Payload) => (p.items[0].name = 'Honda\u0000')],
      ['invoiceReference', (p: Payload) => (p.invoiceReference = 'PO\u0000')],
      ['description', (p: Payload) => (p.description = 'Thanks\u0007')],
    ])('rejects them in %s', async (path, change) => {
      expect(await messagesFor(withChanges(change))).toEqual([
        `${path} must not contain control characters`,
      ]);
    });

    it('rejects NUL in the invoice number via its pattern', async () => {
      expect(await messagesFor({ ...validPayload(), invoiceNumber: 'INV\u00001' })).toEqual([
        'invoiceNumber must start with a letter or digit and contain only letters, digits and . _ / # -',
      ]);
    });

    it('keeps line breaks in the description', async () => {
      expect(await messagesFor({ ...validPayload(), description: 'Line one\nLine two' })).toEqual(
        [],
      );
    });
  });

  describe('invoice number', () => {
    it.each(['INV 001', '-INV-1', 'INV@1', 'ÍNV-1'])('rejects %p', async (invoiceNumber) => {
      expect(await messagesFor({ ...validPayload(), invoiceNumber })).toEqual([
        'invoiceNumber must start with a letter or digit and contain only letters, digits and . _ / # -',
      ]);
    });

    it.each(['IV1780488206995', 'INV-2026/001', 'inv_7.b#2'])(
      'accepts %p',
      async (invoiceNumber) => {
        expect(await messagesFor({ ...validPayload(), invoiceNumber })).toEqual([]);
      },
    );

    it('enforces the maximum length', async () => {
      expect(await messagesFor({ ...validPayload(), invoiceNumber: 'A'.repeat(51) })).toEqual([
        'invoiceNumber must be at most 50 characters',
      ]);
    });
  });

  it('rejects unsupported currencies', async () => {
    expect(await messagesFor({ ...validPayload(), currency: 'JPY' })).toEqual([
      'currency must be one of: AUD, USD, EUR, GBP, SGD, NZD, CAD, HKD',
    ]);
  });

  it('rejects server-owned and unknown fields', async () => {
    expect(
      await messagesFor({
        ...validPayload(),
        status: 'Paid',
        totalAmount: 1,
        customer: { ...validPayload().customer, vip: true },
      }),
    ).toEqual([
      'property status should not exist',
      'property totalAmount should not exist',
      'property customer.vip should not exist',
    ]);
  });
});
