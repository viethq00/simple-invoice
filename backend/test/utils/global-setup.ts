import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

// Throwaway Postgres container for the e2e suite. TEST_DATABASE_URL can point at an
// existing database instead. Its name must end in _test, since tables get truncated.
export default async function globalSetup(): Promise<void> {
  if (process.env.TEST_DATABASE_URL) return;
  const container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('simpleinvoice_test')
    .withUsername('simpleinvoice')
    .withPassword('simpleinvoice')
    .start();
  process.env.TEST_DATABASE_URL = container.getConnectionUri();
  globalThis.__POSTGRES_CONTAINER__ = container;
}
