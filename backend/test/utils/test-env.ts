// Runs before each e2e file: test database and fixed config, whatever a local .env says.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is not set (global setup did not run?)');

const url = new URL(databaseUrl);
const database = url.pathname.slice(1);
if (!database.endsWith('_test')) {
  throw new Error(`Refusing to run e2e tests against "${database}": the name must end in _test.`);
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  POSTGRES_HOST: url.hostname,
  POSTGRES_PORT: url.port || '5432',
  POSTGRES_USER: decodeURIComponent(url.username),
  POSTGRES_PASSWORD: decodeURIComponent(url.password),
  POSTGRES_DB: database,
  JWT_SECRET: 'e2e-test-secret-that-is-at-least-32-characters-long',
  JWT_EXPIRES_IN: '3600',
  COOKIE_SECURE: 'false',
  CORS_ORIGINS: 'http://localhost:8080',
  APP_TIMEZONE: 'UTC',
  LOGIN_RATE_LIMIT: '1000',
  TRUST_PROXY: '0',
  LOG_LEVEL: 'silent',
});
