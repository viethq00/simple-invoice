import request from 'supertest';
import { Invoice } from '../src/invoices/entities/invoice.entity';
import type { User } from '../src/users/user.entity';
import {
  createTestApp,
  createUser,
  insertInvoice,
  login,
  resetDatabase,
  type TestContext,
} from './utils/test-app';

interface InvoiceBody {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  customer: { fullname: string };
  [key: string]: unknown;
}
interface ListBody {
  data: InvoiceBody[];
  paging: { page: number; pageSize: number; total: number };
}

const newInvoice = (overrides: Record<string, unknown> = {}) => ({
  invoiceNumber: 'INV-E2E-0001',
  invoiceReference: 'PO-77',
  invoiceDate: '2026-10-01',
  dueDate: '2026-10-31',
  currency: 'AUD',
  description: 'Thank you for your business.',
  customer: {
    fullname: 'Harbour Lane Studio',
    email: 'accounts@harbourlane.example',
    mobileNumber: '+61 2 9555 0100',
    address: '1 George Street, Sydney NSW 2000',
  },
  items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
  taxPercent: 10,
  discount: 20,
  ...overrides,
});

describe('Invoices (e2e)', () => {
  let ctx: TestContext;
  let user: User;
  let token: string;

  const api = () => ({
    get: (path: string) => request(ctx.server).get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object) =>
      request(ctx.server).post(path).set('Authorization', `Bearer ${token}`).send(body),
  });

  const list = async (query = ''): Promise<ListBody> =>
    (await api().get(`/invoices${query}`).expect(200)).body as ListBody;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    user = await createUser(ctx.dataSource);
    token = await login(ctx.server);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('authorization', () => {
    it.each([
      ['GET', '/invoices'],
      ['GET', '/invoices/099ca7da-a290-40fa-93b9-1c43ae7bb887'],
      ['POST', '/invoices'],
    ])('%s %s requires a valid JWT', async (method, path) => {
      const call =
        method === 'GET' ? request(ctx.server).get(path) : request(ctx.server).post(path);
      const response = await call.send(method === 'POST' ? newInvoice() : undefined).expect(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
    });
  });

  describe('create, list and detail workflow', () => {
    it('creates a Draft invoice with server-side totals and lists it', async () => {
      const created = await api().post('/invoices', newInvoice()).expect(201);
      expect(created.body).toEqual({
        invoiceId: expect.any(String),
        invoiceNumber: 'INV-E2E-0001',
        invoiceReference: 'PO-77',
        invoiceDate: '2026-10-01',
        dueDate: '2026-10-31',
        currency: 'AUD',
        currencySymbol: 'AU$',
        description: 'Thank you for your business.',
        status: 'Draft',
        customer: {
          fullname: 'Harbour Lane Studio',
          email: 'accounts@harbourlane.example',
          mobileNumber: '+61 2 9555 0100',
          address: '1 George Street, Sydney NSW 2000',
        },
        items: [
          { id: expect.any(String), name: 'Honda RC150', quantity: 2, rate: 1000, amount: 2000 },
        ],
        taxPercent: 10,
        invoiceSubTotal: 2000,
        totalTax: 200,
        totalDiscount: 20,
        totalAmount: 2180,
        totalPaid: 0,
        balanceAmount: 2180,
        createdAt: expect.any(String),
        createdBy: user.id,
      });

      const listed = await list('?keyword=e2e-0001');
      expect(listed.paging).toEqual({ page: 1, pageSize: 10, total: 1 });
      expect(listed.data[0]).toEqual(created.body);

      const detail = await api().get(`/invoices/${created.body.invoiceId}`).expect(200);
      expect(detail.body).toEqual(created.body);
    });

    it('persists only Draft and the computed amounts', async () => {
      const created = await api().post('/invoices', newInvoice()).expect(201);
      const row = await ctx.dataSource
        .getRepository(Invoice)
        .findOneByOrFail({ id: created.body.invoiceId as string });
      expect(row).toMatchObject({
        status: 'Draft',
        invoiceSubTotal: '2000.00',
        totalTax: '200.00',
        totalDiscount: '20.00',
        totalAmount: '2180.00',
        totalPaid: '0.00',
        balanceAmount: '2180.00',
        createdBy: user.id,
      });
    });

    it('applies the default tax (10%) and discount (0) when omitted', async () => {
      const { taxPercent, discount, ...rest } = newInvoice();
      expect([taxPercent, discount]).toEqual([10, 20]);
      const created = await api().post('/invoices', rest).expect(201);
      expect(created.body).toMatchObject({
        taxPercent: 10,
        totalTax: 200,
        totalDiscount: 0,
        totalAmount: 2200,
      });
    });

    it('derives Overdue immediately for a back-dated draft', async () => {
      const created = await api()
        .post('/invoices', newInvoice({ invoiceDate: '2026-08-01', dueDate: '2026-08-31' }))
        .expect(201);
      expect(created.body.status).toBe('Overdue');
      const row = await ctx.dataSource
        .getRepository(Invoice)
        .findOneByOrFail({ id: created.body.invoiceId as string });
      expect(row.status).toBe('Draft');
    });
  });

  describe('uniqueness of invoice numbers', () => {
    it('rejects a duplicate number, ignoring case and surrounding spaces', async () => {
      await api().post('/invoices', newInvoice()).expect(201);
      for (const invoiceNumber of ['INV-E2E-0001', 'inv-e2e-0001', '  Inv-E2E-0001  ']) {
        const response = await api().post('/invoices', newInvoice({ invoiceNumber })).expect(409);
        expect(response.body).toEqual({
          statusCode: 409,
          message: 'Invoice number already exists',
          error: 'Conflict',
        });
      }
    });

    it('lets exactly one of several concurrent duplicates succeed (database-enforced)', async () => {
      const attempts = await Promise.all(
        Array.from({ length: 6 }, () =>
          api().post('/invoices', newInvoice({ invoiceNumber: 'RACE-1' })),
        ),
      );
      const statuses = attempts.map((response) => response.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409, 409]);
      expect((await list('?keyword=RACE-1')).paging.total).toBe(1);
    });
  });

  describe('validation', () => {
    it('rejects a due date before the invoice date with the documented body', async () => {
      const response = await api()
        .post('/invoices', newInvoice({ invoiceDate: '2026-10-10', dueDate: '2026-10-09' }))
        .expect(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: ['dueDate must be on or after invoiceDate'],
        error: 'Bad Request',
      });
    });

    it('reports every invalid field', async () => {
      const response = await api()
        .post('/invoices', {
          ...newInvoice({ invoiceNumber: '' }),
          customer: { fullname: ' ', email: 'nope' },
          items: [{ name: 'Thing', quantity: 0, rate: -1 }],
        })
        .expect(400);
      expect(response.body.message).toEqual([
        'invoiceNumber is required',
        'customer.fullname is required',
        'customer.email must be a valid email address',
        'items.0.quantity must be a positive integer',
        'items.0.rate must be a positive number',
      ]);
    });

    it('rejects a discount larger than subtotal plus tax', async () => {
      const response = await api()
        .post('/invoices', newInvoice({ discount: 2200.01 }))
        .expect(400);
      expect(response.body.message).toEqual(['discount must not exceed subtotal plus tax']);
    });

    it('rejects client-supplied status and totals', async () => {
      const response = await api()
        .post('/invoices', newInvoice({ status: 'Paid', totalAmount: 1 }))
        .expect(400);
      expect(response.body.message).toEqual([
        'property status should not exist',
        'property totalAmount should not exist',
      ]);
    });

    it('requires exactly one line item', async () => {
      const response = await api()
        .post(
          '/invoices',
          newInvoice({
            items: [
              { name: 'A', quantity: 1, rate: 1 },
              { name: 'B', quantity: 1, rate: 1 },
            ],
          }),
        )
        .expect(400);
      expect(response.body.message).toEqual(['items must contain exactly one line item']);
    });

    it.each([
      [
        'a rate below 0.01',
        { items: [{ name: 'A', quantity: 1, rate: 1e-7 }] },
        'items.0.rate must be a number with at most 2 decimal places',
      ],
      ['a nested items array', { items: [[]] }, 'items must be a list of line-item objects'],
      [
        'a NUL character',
        { customer: { fullname: 'X\u0000Y', email: 'x@example.com' } },
        'customer.fullname must not contain control characters',
      ],
      [
        // 122 characters to Postgres, 61 to class-validator's MaxLength.
        'a name of emoji with variation selectors, too long for its column',
        { customer: { fullname: '\u2764\uFE0F'.repeat(61), email: 'x@example.com' } },
        'customer.fullname must be at most 120 characters',
      ],
      [
        'an explicit null tax',
        { taxPercent: null },
        'taxPercent must be a number with at most 2 decimal places',
      ],
    ])('answers 400 for %s', async (_case, overrides, message) => {
      const response = await api().post('/invoices', newInvoice(overrides)).expect(400);
      expect(response.body.message).toEqual([message]);
      expect(await ctx.dataSource.getRepository(Invoice).count()).toBe(0);
    });

    it('accepts JSON bodies only', async () => {
      const response = await request(ctx.server)
        .post('/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify(newInvoice()))
        .expect(415);
      expect(response.body).toEqual({
        statusCode: 415,
        message: 'Content-Type must be application/json',
        error: 'Unsupported Media Type',
      });
    });

    it('rejects malformed JSON with the standard error shape', async () => {
      const response = await request(ctx.server)
        .post('/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json')
        .send('{"invoiceNumber":')
        .expect(400);
      expect(response.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });
  });

  describe('GET /invoices/:id', () => {
    it('returns 404 with the documented body for an unknown id', async () => {
      const response = await api()
        .get('/invoices/6f1c2b9e-1d1a-4c55-9a51-111111111111')
        .expect(404);
      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Invoice not found',
        error: 'Not Found',
      });
    });

    it('returns 400 for an id that is not a UUID', async () => {
      const response = await api().get('/invoices/123').expect(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: ['id must be a valid UUID'],
        error: 'Bad Request',
      });
    });
  });

  describe('listing', () => {
    // Today is frozen at 2026-10-01 (see test-app.ts).
    beforeEach(async () => {
      const add = (fixture: Parameters<typeof insertInvoice>[2]) =>
        insertInvoice(ctx.dataSource, user.id, fixture);
      await add({
        invoiceNumber: 'A-001',
        customerName: 'Acme Pty Ltd',
        status: 'Pending',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-31',
        rate: 500,
      });
      await add({
        invoiceNumber: 'A-002',
        customerName: 'Beta Labs',
        status: 'Pending',
        invoiceDate: '2026-09-15',
        dueDate: '2026-10-01',
        rate: 300,
      });
      await add({
        invoiceNumber: 'A-003',
        customerName: 'Gamma Foods',
        status: 'Paid',
        invoiceDate: '2026-07-01',
        dueDate: '2026-07-31',
        rate: 900,
      });
      await add({
        invoiceNumber: 'A-004',
        customerName: 'Acme Holdings',
        status: 'Draft',
        invoiceDate: '2026-09-01',
        dueDate: '2026-09-30',
        rate: 100,
      });
      await add({
        invoiceNumber: 'B-005',
        customerName: 'Delta 50% Off',
        status: 'Draft',
        invoiceDate: '2026-09-20',
        dueDate: '2026-10-20',
        rate: 700,
      });
      await add({
        invoiceNumber: 'B-006',
        customerName: 'Epsilon_Co',
        status: 'Pending',
        invoiceDate: '2026-09-25',
        dueDate: '2026-11-25',
        rate: 200,
      });
    });

    const numbers = (body: ListBody) => body.data.map((invoice) => invoice.invoiceNumber);

    it('derives Overdue for unpaid invoices past their due date (not Paid, not due today)', async () => {
      const statuses = Object.fromEntries(
        (await list('?pageSize=100')).data.map((invoice) => [
          invoice.invoiceNumber,
          invoice.status,
        ]),
      );
      expect(statuses).toEqual({
        'A-001': 'Overdue',
        'A-002': 'Pending',
        'A-003': 'Paid',
        'A-004': 'Overdue',
        'B-005': 'Draft',
        'B-006': 'Pending',
      });
    });

    it.each([
      ['Overdue', ['A-001', 'A-004']],
      ['Pending', ['A-002', 'B-006']],
      ['Draft', ['B-005']],
      ['Paid', ['A-003']],
    ])('filters by the effective status %s, with matching totals', async (status, expected) => {
      const body = await list(`?status=${status}&sortBy=invoiceDate&ordering=ASC`);
      expect(numbers(body).sort()).toEqual(expected);
      expect(body.paging.total).toBe(expected.length);
      expect(body.data.every((invoice) => invoice.status === status)).toBe(true);
    });

    it('searches invoice number or customer name, partially and case-insensitively', async () => {
      expect(numbers(await list('?keyword=ACME&sortBy=invoiceDate&ordering=ASC'))).toEqual([
        'A-001',
        'A-004',
      ]);
      expect(numbers(await list('?keyword=b-00'))).toEqual(['B-006', 'B-005']);
      expect(numbers(await list('?keyword=gamma'))).toEqual(['A-003']);
      expect((await list('?keyword=zzz')).paging.total).toBe(0);
    });

    it('treats LIKE wildcards in the keyword literally', async () => {
      expect(numbers(await list('?keyword=50%25'))).toEqual(['B-005']);
      expect(numbers(await list('?keyword=_co'))).toEqual(['B-006']);
      // A bare "%" only matches a literal percent sign.
      expect(numbers(await list('?keyword=%25'))).toEqual(['B-005']);
    });

    it.each([
      ['invoiceDate', 'ASC', ['A-003', 'A-001', 'A-004', 'A-002', 'B-005', 'B-006']],
      ['invoiceDate', 'DESC', ['B-006', 'B-005', 'A-002', 'A-004', 'A-001', 'A-003']],
      ['dueDate', 'ASC', ['A-003', 'A-001', 'A-004', 'A-002', 'B-005', 'B-006']],
      ['totalAmount', 'DESC', ['A-003', 'B-005', 'A-001', 'A-002', 'B-006', 'A-004']],
      ['totalAmount', 'ASC', ['A-004', 'B-006', 'A-002', 'A-001', 'B-005', 'A-003']],
    ])('sorts by %s %s', async (sortBy, ordering, expected) => {
      expect(numbers(await list(`?sortBy=${sortBy}&ordering=${ordering}`))).toEqual(expected);
    });

    it('defaults to invoiceDate descending', async () => {
      expect(numbers(await list())).toEqual(['B-006', 'B-005', 'A-002', 'A-004', 'A-001', 'A-003']);
    });

    it('paginates on the server with an accurate total', async () => {
      const page1 = await list('?page=1&pageSize=4&sortBy=invoiceDate&ordering=ASC');
      const page2 = await list('?page=2&pageSize=4&sortBy=invoiceDate&ordering=ASC');
      expect(page1.paging).toEqual({ page: 1, pageSize: 4, total: 6 });
      expect(numbers(page1)).toEqual(['A-003', 'A-001', 'A-004', 'A-002']);
      expect(page2.paging).toEqual({ page: 2, pageSize: 4, total: 6 });
      expect(numbers(page2)).toEqual(['B-005', 'B-006']);
      const beyond = await list('?page=9&pageSize=4');
      expect(beyond.data).toEqual([]);
      expect(beyond.paging.total).toBe(6);
    });

    it('combines filters before paginating', async () => {
      const body = await list(
        '?keyword=a-00&status=Overdue&pageSize=1&sortBy=dueDate&ordering=DESC',
      );
      expect(body.paging).toEqual({ page: 1, pageSize: 1, total: 2 });
      expect(numbers(body)).toEqual(['A-004']);
    });

    it('filters by an inclusive invoice-date range', async () => {
      expect(
        numbers(
          await list('?fromDate=2026-09-01&toDate=2026-09-20&sortBy=invoiceDate&ordering=ASC'),
        ),
      ).toEqual(['A-004', 'A-002', 'B-005']);
      expect(numbers(await list('?fromDate=2026-09-25'))).toEqual(['B-006']);
      expect(numbers(await list('?toDate=2026-07-01'))).toEqual(['A-003']);
    });

    it('rejects invalid query parameters with a 400', async () => {
      const response = await api()
        .get(
          '/invoices?page=0&pageSize=500&sortBy=customer&ordering=sideways&status=Archived&fromDate=2026-02-30',
        )
        .expect(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: [
          'page must be a positive integer',
          'pageSize must not exceed 100',
          'sortBy must be one of: invoiceDate, dueDate, totalAmount',
          'ordering must be one of: ASC, DESC',
          'status must be one of: Draft, Pending, Paid, Overdue',
          'fromDate must be a valid date in YYYY-MM-DD format',
        ],
        error: 'Bad Request',
      });
    });

    it.each([
      ['a NUL in the keyword', '?keyword=a%00b', 'keyword must not contain control characters'],
      ['a repeated page size', '?pageSize=5&pageSize=50', 'pageSize must be a positive integer'],
    ])('answers 400 for %s', async (_case, query, message) => {
      const response = await api().get(`/invoices${query}`).expect(400);
      expect(response.body.message).toEqual([message]);
    });
  });
});
