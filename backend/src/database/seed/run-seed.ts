import 'reflect-metadata';
import { SystemClock } from '../../common/clock';
import { createScriptDataSource, describeError } from '../script-data-source';
import { seedDatabase } from './seed';

async function main(): Promise<void> {
  const { env, dataSource } = createScriptDataSource();
  const { SEED_USER_EMAIL: email, SEED_USER_PASSWORD: password } = env;
  if (!email || !password) {
    throw new Error('SEED_USER_EMAIL and SEED_USER_PASSWORD must be set (see .env.example).');
  }

  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    if (applied.length > 0) {
      console.log(`Applied migrations: ${applied.map((migration) => migration.name).join(', ')}`);
    }
    const today = new SystemClock(env.APP_TIMEZONE).today();
    const result = await seedDatabase(
      dataSource,
      { email, password, fullname: env.SEED_USER_FULLNAME ?? 'Demo Reviewer' },
      today,
    );
    console.log(
      `Seed complete: reviewer ${result.user.email} (${result.user.status}); ` +
        `${result.invoices.inserted} invoices inserted, ${result.invoices.skipped} already present.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${describeError(error)}`);
  process.exit(1);
});
