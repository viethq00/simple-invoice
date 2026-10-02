import 'reflect-metadata';
import { createScriptDataSource, describeError } from './script-data-source';

async function main(): Promise<void> {
  const revert = process.argv.includes('--revert');
  const { dataSource } = createScriptDataSource();
  await dataSource.initialize();
  try {
    if (revert) {
      await dataSource.undoLastMigration({ transaction: 'each' });
      console.log('Reverted the most recent migration.');
      return;
    }
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length > 0
        ? `Applied migrations: ${applied.map((migration) => migration.name).join(', ')}`
        : 'Database schema is up to date.',
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(`Migration failed: ${describeError(error)}`);
  process.exit(1);
});
