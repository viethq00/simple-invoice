import { http, HttpResponse, type PathParams } from 'msw';
import type {
  ApiErrorBody,
  CreateInvoiceRequest,
  Invoice,
  InvoiceListResponse,
  LoginRequest,
  LoginResponse,
} from '@/lib/api-types';
import {
  appendixInvoice,
  DEMO_ACCESS_TOKEN,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  demoUser,
  makeInvoices,
} from './fixtures';

export const mockDb = {
  authenticated: true,
  invoices: [] as Invoice[],
  listRequests: [] as URL[],
  createRequests: [] as CreateInvoiceRequest[],
};

export function resetMockDb(): void {
  mockDb.authenticated = true;
  mockDb.invoices = [appendixInvoice, ...makeInvoices(24)];
  mockDb.listRequests = [];
  mockDb.createRequests = [];
}

export const API = (path: string) => `/api${path}`;

export function errorResponse(statusCode: number, message: string | string[], error: string) {
  return HttpResponse.json<ApiErrorBody>({ statusCode, message, error }, { status: statusCode });
}

const unauthorized = () => errorResponse(401, 'Authentication required', 'Unauthorized');

const SORT_VALUE: Record<string, (invoice: Invoice) => string | number> = {
  invoiceDate: (invoice) => invoice.invoiceDate,
  dueDate: (invoice) => invoice.dueDate,
  totalAmount: (invoice) => invoice.totalAmount,
};

function listInvoices(url: URL): InvoiceListResponse {
  const query = url.searchParams;
  const page = Number(query.get('page') ?? 1);
  const pageSize = Number(query.get('pageSize') ?? 10);
  const keyword = query.get('keyword')?.toLowerCase();
  const status = query.get('status');
  const fromDate = query.get('fromDate');
  const toDate = query.get('toDate');
  const sortValue = SORT_VALUE[query.get('sortBy') ?? 'invoiceDate'] ?? SORT_VALUE.invoiceDate!;
  const direction = query.get('ordering') === 'ASC' ? 1 : -1;

  const matches = mockDb.invoices
    .filter(
      (invoice) =>
        !keyword ||
        invoice.invoiceNumber.toLowerCase().includes(keyword) ||
        invoice.customer.fullname.toLowerCase().includes(keyword),
    )
    .filter((invoice) => !status || invoice.status === status)
    .filter((invoice) => !fromDate || invoice.invoiceDate >= fromDate)
    .filter((invoice) => !toDate || invoice.invoiceDate <= toDate)
    .sort((a, b) =>
      sortValue(a) > sortValue(b) ? direction : sortValue(a) < sortValue(b) ? -direction : 0,
    );

  return {
    data: matches.slice((page - 1) * pageSize, page * pageSize),
    paging: { page, pageSize, total: matches.length },
  };
}

function createInvoice(body: CreateInvoiceRequest): Invoice {
  const [item] = body.items;
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const subTotal = round2(item.quantity * item.rate);
  const tax = round2((subTotal * (body.taxPercent ?? 10)) / 100);
  const discount = body.discount ?? 0;
  const total = round2(subTotal + tax - discount);
  return {
    invoiceId: crypto.randomUUID(),
    invoiceNumber: body.invoiceNumber,
    invoiceReference: body.invoiceReference ?? null,
    invoiceDate: body.invoiceDate,
    dueDate: body.dueDate,
    currency: body.currency,
    currencySymbol: body.currency === 'AUD' ? 'AU$' : '$',
    description: body.description ?? null,
    status: 'Draft',
    customer: {
      fullname: body.customer.fullname,
      email: body.customer.email,
      mobileNumber: body.customer.mobileNumber ?? null,
      address: body.customer.address ?? null,
    },
    items: [{ id: crypto.randomUUID(), ...item, amount: subTotal }],
    taxPercent: body.taxPercent ?? 10,
    invoiceSubTotal: subTotal,
    totalTax: tax,
    totalDiscount: discount,
    totalAmount: total,
    totalPaid: 0,
    balanceAmount: total,
    createdAt: new Date().toISOString(),
    createdBy: demoUser.id,
  };
}

export const handlers = [
  http.get(API('/auth/me'), () =>
    mockDb.authenticated ? HttpResponse.json(demoUser) : unauthorized(),
  ),

  http.post<PathParams, LoginRequest, LoginResponse | ApiErrorBody>(
    API('/auth/login'),
    async ({ request }) => {
      const { email, password } = await request.json();
      if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
        return errorResponse(401, 'Invalid email or password', 'Unauthorized');
      }
      mockDb.authenticated = true;
      return HttpResponse.json<LoginResponse>({
        accessToken: DEMO_ACCESS_TOKEN,
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: demoUser,
      });
    },
  ),

  http.post(API('/auth/logout'), () => {
    mockDb.authenticated = false;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(API('/invoices'), ({ request }) => {
    if (!mockDb.authenticated) return unauthorized();
    const url = new URL(request.url);
    mockDb.listRequests.push(url);
    return HttpResponse.json(listInvoices(url));
  }),

  http.get(API('/invoices/:invoiceId'), ({ params }) => {
    if (!mockDb.authenticated) return unauthorized();
    const invoice = mockDb.invoices.find((candidate) => candidate.invoiceId === params.invoiceId);
    return invoice
      ? HttpResponse.json(invoice)
      : errorResponse(404, 'Invoice not found', 'Not Found');
  }),

  http.post(API('/invoices'), async ({ request }) => {
    if (!mockDb.authenticated) return unauthorized();
    const body = (await request.json()) as CreateInvoiceRequest;
    mockDb.createRequests.push(body);
    const taken = mockDb.invoices.some(
      (invoice) => invoice.invoiceNumber.toLowerCase() === body.invoiceNumber.toLowerCase(),
    );
    if (taken) return errorResponse(409, 'Invoice number already exists', 'Conflict');
    const invoice = createInvoice(body);
    mockDb.invoices.unshift(invoice);
    return HttpResponse.json(invoice, { status: 201 });
  }),
];
