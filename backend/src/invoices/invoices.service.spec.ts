import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { FixedClock } from '../common/clock';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import type { Invoice } from './entities/invoice.entity';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

const USER_ID = 'ad1e0902-1928-4345-b513-60c86c94fc91';
const NEW_ID = '7f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

const dto = (overrides: Partial<CreateInvoiceDto> = {}): CreateInvoiceDto => ({
  invoiceNumber: 'INV-2026-0042',
  invoiceDate: '2026-10-01',
  dueDate: '2026-10-31',
  currency: 'AUD',
  customer: { fullname: 'Paul', email: 'paul@101digital.io' },
  items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
  taxPercent: 10,
  discount: 20,
  ...overrides,
});

const storedFrom = (values: Partial<Invoice>): Invoice =>
  ({
    ...values,
    id: NEW_ID,
    createdAt: new Date('2026-10-01T09:00:00.000Z'),
    items: (values.items ?? []).map((item, index) => ({ ...item, id: `item-${index}` })),
  }) as Invoice;

const uniqueViolation = (constraint: string) =>
  new QueryFailedError(
    'INSERT INTO "invoices" ...',
    [],
    Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint,
    }),
  );

describe('InvoicesService', () => {
  let repository: jest.Mocked<Pick<InvoicesRepository, 'build' | 'insert' | 'findById' | 'list'>>;
  let service: InvoicesService;
  let built: Partial<Invoice> | undefined;

  beforeEach(() => {
    built = undefined;
    repository = {
      build: jest.fn((values) => {
        built = values as Partial<Invoice>;
        return values as Invoice;
      }),
      insert: jest.fn().mockResolvedValue(NEW_ID),
      findById: jest.fn((_id: string) => Promise.resolve(built ? storedFrom(built) : null)),
      list: jest.fn(),
    };
    service = new InvoicesService(
      repository as unknown as InvoicesRepository,
      new FixedClock('2026-10-01'),
    );
  });

  describe('create', () => {
    it('stores a Draft invoice with server-calculated totals and the creator', async () => {
      const result = await service.create(dto(), USER_ID);

      expect(built).toMatchObject({
        invoiceNumber: 'INV-2026-0042',
        invoiceReference: null,
        description: null,
        status: 'Draft',
        currency: 'AUD',
        currencySymbol: 'AU$',
        customer: {
          fullname: 'Paul',
          email: 'paul@101digital.io',
          mobileNumber: null,
          address: null,
        },
        taxPercent: '10.00',
        invoiceSubTotal: '2000.00',
        totalTax: '200.00',
        totalDiscount: '20.00',
        totalAmount: '2180.00',
        totalPaid: '0.00',
        balanceAmount: '2180.00',
        createdBy: USER_ID,
        items: [{ name: 'Honda RC150', quantity: 2, rate: '1000.00' }],
      });
      expect(repository.insert).toHaveBeenCalledTimes(1);
      expect(repository.findById).toHaveBeenCalledWith(NEW_ID);
      expect(result).toMatchObject({
        invoiceId: NEW_ID,
        status: 'Draft',
        totalAmount: 2180,
        balanceAmount: 2180,
        items: [{ name: 'Honda RC150', quantity: 2, rate: 1000, amount: 2000 }],
      });
    });

    it('defaults tax to 10% and discount to 0 when omitted', async () => {
      await service.create(dto({ taxPercent: undefined, discount: undefined }), USER_ID);
      expect(built).toMatchObject({
        taxPercent: '10.00',
        totalTax: '200.00',
        totalDiscount: '0.00',
        totalAmount: '2200.00',
      });
    });

    it('rejects a discount larger than subtotal plus tax', async () => {
      const attempt = service.create(dto({ discount: 2200.01 }), USER_ID);
      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toMatchObject({
        response: { statusCode: 400, message: ['discount must not exceed subtotal plus tax'] },
      });
      expect(repository.insert).not.toHaveBeenCalled();
    });

    it('maps a duplicate invoice number to 409 Conflict', async () => {
      repository.insert.mockRejectedValueOnce(uniqueViolation('uq_invoices_invoice_number'));
      const attempt = service.create(dto(), USER_ID);
      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toMatchObject({
        response: { statusCode: 409, message: 'Invoice number already exists', error: 'Conflict' },
      });
    });

    it('does not mask other unique violations or database errors', async () => {
      const otherViolation = uniqueViolation('some_other_index');
      repository.insert.mockRejectedValueOnce(otherViolation);
      await expect(service.create(dto(), USER_ID)).rejects.toBe(otherViolation);

      const outage = new Error('connection terminated');
      repository.insert.mockRejectedValueOnce(outage);
      await expect(service.create(dto(), USER_ID)).rejects.toBe(outage);
    });
  });

  describe('findOne', () => {
    it('throws 404 with the documented message when the invoice does not exist', async () => {
      repository.findById.mockResolvedValueOnce(null);
      const attempt = service.findOne(NEW_ID);
      await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
      await expect(attempt).rejects.toMatchObject({
        response: { statusCode: 404, message: 'Invoice not found', error: 'Not Found' },
      });
    });
  });

  describe('list', () => {
    it('derives statuses for today and echoes paging', async () => {
      const pastDue = storedFrom({
        invoiceNumber: 'INV-1',
        status: 'Pending',
        invoiceDate: '2026-09-01',
        dueDate: '2026-09-30',
        customer: { fullname: 'Paul', email: 'p@x.io', mobileNumber: null, address: null },
        taxPercent: '10.00',
        invoiceSubTotal: '100.00',
        totalTax: '10.00',
        totalDiscount: '0.00',
        totalAmount: '110.00',
        totalPaid: '0.00',
        balanceAmount: '110.00',
        items: [],
      });
      repository.list.mockResolvedValueOnce([[pastDue], 41]);
      const query = {
        page: 2,
        pageSize: 10,
        sortBy: 'invoiceDate',
        ordering: 'DESC',
      } as ListInvoicesQueryDto;

      const result = await service.list(query);

      expect(repository.list).toHaveBeenCalledWith(query, '2026-10-01');
      expect(result.paging).toEqual({ page: 2, pageSize: 10, total: 41 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        invoiceNumber: 'INV-1',
        status: 'Overdue',
        totalAmount: 110,
      });
    });
  });
});
