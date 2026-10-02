import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { Clock, FixedClock } from '../../src/common/clock';
import { calculateInvoiceTotals } from '../../src/invoices/domain/money';
import type { StoredInvoiceStatus } from '../../src/invoices/domain/invoice-status';
import { Invoice } from '../../src/invoices/entities/invoice.entity';
import { User } from '../../src/users/user.entity';

export const TODAY = '2026-10-01';

export const REVIEWER = {
  email: 'reviewer@simpleinvoice.test',
  password: 'Correct-Horse-9',
  fullname: 'Riley Reviewer',
};

export interface TestContext {
  app: NestExpressApplication;
  dataSource: DataSource;
  server: Server;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue(new FixedClock(TODAY))
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  const dataSource = app.get(DataSource);
  await dataSource.runMigrations({ transaction: 'each' });
  return { app, dataSource, server: app.getHttpServer() };
}

export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE invoice_items, invoices, users RESTART IDENTITY CASCADE');
}

export async function createUser(
  dataSource: DataSource,
  user: { email: string; password: string; fullname: string } = REVIEWER,
): Promise<User> {
  const users = dataSource.getRepository(User);
  return users.save(
    users.create({
      email: user.email,
      fullname: user.fullname,
      passwordHash: await hash(user.password, 4),
    }),
  );
}

export async function login(server: Server, user = REVIEWER): Promise<string> {
  const response = await request(server)
    .post('/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);
  return (response.body as { accessToken: string }).accessToken;
}

export interface InvoiceFixture {
  invoiceNumber: string;
  customerName?: string;
  status?: StoredInvoiceStatus;
  invoiceDate?: string;
  dueDate?: string;
  quantity?: number;
  rate?: number;
  createdAt?: string;
}

// Bypasses the API so a test can store any status.
export async function insertInvoice(
  dataSource: DataSource,
  createdBy: string,
  fixture: InvoiceFixture,
): Promise<Invoice> {
  const quantity = fixture.quantity ?? 1;
  const rate = fixture.rate ?? 100;
  const status = fixture.status ?? 'Pending';
  const totals = calculateInvoiceTotals({ quantity, rate, taxPercent: 10, discount: 0 });
  const invoices = dataSource.getRepository(Invoice);
  return invoices.save(
    invoices.create({
      invoiceNumber: fixture.invoiceNumber,
      invoiceReference: null,
      invoiceDate: fixture.invoiceDate ?? '2026-09-01',
      dueDate: fixture.dueDate ?? '2026-10-15',
      currency: 'AUD',
      currencySymbol: 'AU$',
      description: null,
      status,
      customer: {
        fullname: fixture.customerName ?? 'Fixture Customer',
        email: 'fixture@example.com',
        mobileNumber: null,
        address: null,
      },
      taxPercent: '10.00',
      ...totals,
      ...(status === 'Paid' ? { totalPaid: totals.totalAmount, balanceAmount: '0.00' } : {}),
      createdBy,
      ...(fixture.createdAt ? { createdAt: new Date(fixture.createdAt) } : {}),
      items: [{ name: 'Fixture item', quantity, rate: rate.toFixed(2) }],
    }),
  );
}
