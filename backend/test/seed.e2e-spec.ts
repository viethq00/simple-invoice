import request from 'supertest';
import { APPENDIX_A_USER_ID } from '../src/database/seed/seed-data';
import { seedDatabase } from '../src/database/seed/seed';
import { Invoice } from '../src/invoices/entities/invoice.entity';
import { createTestApp, login, resetDatabase, TODAY, type TestContext } from './utils/test-app';

const seedUser = {
  email: 'admin@simpleinvoice.test',
  password: 'Password123!',
  fullname: 'Jordan Lee',
};

describe('Seed (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('seeds the reviewer and 41 invoices, then is idempotent', async () => {
    const first = await seedDatabase(ctx.dataSource, seedUser, TODAY);
    expect(first).toEqual({
      user: { email: seedUser.email, status: 'created' },
      invoices: { inserted: 41, skipped: 0 },
    });

    const second = await seedDatabase(ctx.dataSource, seedUser, TODAY);
    expect(second).toEqual({
      user: { email: seedUser.email, status: 'unchanged' },
      invoices: { inserted: 0, skipped: 41 },
    });
    expect(await ctx.dataSource.getRepository(Invoice).count()).toBe(41);
  });

  it("gives the reviewer Appendix A's createdBy id and lets them sign in", async () => {
    await seedDatabase(ctx.dataSource, seedUser, TODAY);
    const token = await login(ctx.server, seedUser);
    const me = await request(ctx.server).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.id).toBe(APPENDIX_A_USER_ID);
  });

  it('stores Appendix A as Pending and serves it as Overdue with its exact amounts', async () => {
    await seedDatabase(ctx.dataSource, seedUser, TODAY);
    const row = await ctx.dataSource
      .getRepository(Invoice)
      .findOneByOrFail({ invoiceNumber: 'IV1780488206995' });
    expect(row.status).toBe('Pending');

    const token = await login(ctx.server, seedUser);
    const response = await request(ctx.server)
      .get('/invoices/099ca7da-a290-40fa-93b9-1c43ae7bb887')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body).toMatchObject({
      invoiceNumber: 'IV1780488206995',
      invoiceReference: '#5721662',
      status: 'Overdue',
      currencySymbol: 'AU$',
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
      invoiceSubTotal: 2000,
      totalTax: 200,
      totalDiscount: 20,
      totalAmount: 2180,
      totalPaid: 1451.34,
      balanceAmount: 728.66,
      createdAt: '2026-06-03T12:03:26.995Z',
      createdBy: APPENDIX_A_USER_ID,
    });
  });

  it('never stores Overdue and covers every effective status', async () => {
    await seedDatabase(ctx.dataSource, seedUser, TODAY);
    const stored = await ctx.dataSource.query<{ status: string }[]>(
      'SELECT DISTINCT status::text AS status FROM invoices ORDER BY 1',
    );
    expect(stored.map((row) => row.status)).toEqual(['Draft', 'Paid', 'Pending']);

    const token = await login(ctx.server, seedUser);
    for (const status of ['Draft', 'Pending', 'Paid', 'Overdue']) {
      const response = await request(ctx.server)
        .get(`/invoices?status=${status}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.paging.total).toBeGreaterThan(0);
    }
  });

  it('resets a changed reviewer password and never overwrites existing invoices', async () => {
    await seedDatabase(ctx.dataSource, seedUser, TODAY);
    await ctx.dataSource.query(
      `UPDATE invoices SET description = 'edited' WHERE invoice_number = 'INV-0001'`,
    );

    const result = await seedDatabase(
      ctx.dataSource,
      { ...seedUser, password: 'A-new-password-1' },
      TODAY,
    );
    expect(result.user.status).toBe('updated');
    await login(ctx.server, { ...seedUser, password: 'A-new-password-1' });

    const row = await ctx.dataSource
      .getRepository(Invoice)
      .findOneByOrFail({ invoiceNumber: 'INV-0001' });
    expect(row.description).toBe('edited');
  });
});
