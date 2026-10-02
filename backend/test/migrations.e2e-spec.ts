import { createTestApp, type TestContext } from './utils/test-app';

const APP_TABLES = ['invoice_items', 'invoices', 'users'];

describe('Migrations (e2e)', () => {
  let ctx: TestContext;

  const existingTables = async (): Promise<string[]> =>
    (
      await ctx.dataSource.query<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ANY($1) ORDER BY table_name`,
        [APP_TABLES],
      )
    ).map((row) => row.table_name);

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    // Leave the schema in place for the other suites.
    await ctx.dataSource.runMigrations({ transaction: 'each' });
    await ctx.app.close();
  });

  it('reverts the initial schema completely and re-applies it', async () => {
    expect(await existingTables()).toEqual(APP_TABLES);

    await ctx.dataSource.undoLastMigration({ transaction: 'all' });
    expect(await existingTables()).toEqual([]);
    const statusType = await ctx.dataSource.query(
      `SELECT 1 FROM pg_type WHERE typname = 'invoice_status'`,
    );
    expect(statusType).toEqual([]);

    await ctx.dataSource.runMigrations({ transaction: 'each' });
    expect(await existingTables()).toEqual(APP_TABLES);
  });
});
