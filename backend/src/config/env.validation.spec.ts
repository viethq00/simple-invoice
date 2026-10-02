import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateEnv } from './env.validation';

const minimal = {
  POSTGRES_USER: 'simpleinvoice',
  POSTGRES_PASSWORD: 'secret-password',
  POSTGRES_DB: 'simpleinvoice',
  JWT_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('applies documented defaults', () => {
    const env = validateEnv(minimal);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      BACKEND_PORT: 4000,
      POSTGRES_HOST: 'localhost',
      POSTGRES_PORT: 5432,
      JWT_EXPIRES_IN: 3600,
      COOKIE_SECURE: false,
      TRUST_PROXY: 0,
      APP_TIMEZONE: 'UTC',
      LOGIN_RATE_LIMIT: 10,
      LOG_LEVEL: 'info',
    });
    expect(env.CORS_ORIGINS).toBe('http://localhost:8080,http://localhost:5173');
  });

  it('converts numeric and boolean strings', () => {
    const env = validateEnv({
      ...minimal,
      BACKEND_PORT: '4100',
      JWT_EXPIRES_IN: '900',
      COOKIE_SECURE: 'true',
      TRUST_PROXY: '1',
    });
    expect(env).toMatchObject({
      BACKEND_PORT: 4100,
      JWT_EXPIRES_IN: 900,
      COOKIE_SECURE: true,
      TRUST_PROXY: 1,
    });
  });

  it('treats empty values as unset so defaults apply', () => {
    expect(validateEnv({ ...minimal, JWT_EXPIRES_IN: '', BACKEND_PORT: '' })).toMatchObject({
      JWT_EXPIRES_IN: 3600,
      BACKEND_PORT: 4000,
    });
  });

  it('accepts a CORS allow-list with spaces around the commas', () => {
    expect(() =>
      validateEnv({
        ...minimal,
        CORS_ORIGINS: ' https://app.example.com , http://localhost:3000 ',
      }),
    ).not.toThrow();
  });

  describe('secrets from files (<KEY>_FILE)', () => {
    let dir: string;
    const secretFile = (name: string, contents: string): string => {
      const path = join(dir, name);
      writeFileSync(path, contents);
      return path;
    };
    const { POSTGRES_PASSWORD: _password, JWT_SECRET: _secret, ...withoutSecrets } = minimal;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'env-secrets-'));
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it('reads blank secrets from their files, ignoring a trailing newline', () => {
      const env = validateEnv({
        ...withoutSecrets,
        POSTGRES_PASSWORD: '',
        POSTGRES_PASSWORD_FILE: secretFile('postgres_password', 'from-file\n'),
        JWT_SECRET_FILE: secretFile('jwt_secret', `${'f'.repeat(64)}\n`),
      });
      expect(env.POSTGRES_PASSWORD).toBe('from-file');
      expect(env.JWT_SECRET).toBe('f'.repeat(64));
    });

    it('lets an explicit value (e.g. from .env) win over the file', () => {
      const env = validateEnv({
        ...minimal,
        JWT_SECRET_FILE: secretFile('jwt_secret', 'g'.repeat(64)),
      });
      expect(env.JWT_SECRET).toBe(minimal.JWT_SECRET);
    });

    it('reports a secret file that cannot be read', () => {
      expect(() =>
        validateEnv({ ...withoutSecrets, JWT_SECRET_FILE: join(dir, 'missing') }),
      ).toThrow(/JWT_SECRET_FILE could not be read/);
    });

    it('validates file contents like any other value', () => {
      expect(() =>
        validateEnv({ ...withoutSecrets, JWT_SECRET_FILE: secretFile('jwt_secret', 'short') }),
      ).toThrow(/JWT_SECRET must be at least 32 characters/);
    });
  });

  it('names the actual problem for a bad port', () => {
    expect(() => validateEnv({ ...minimal, BACKEND_PORT: 'http' })).toThrow(
      'BACKEND_PORT must be an integer number',
    );
  });

  it('explains how to provide a missing secret', () => {
    expect(() => validateEnv({ ...minimal, JWT_SECRET: '' })).toThrow(
      'JWT_SECRET is required: set it in .env (`npm run setup` generates one) or point JWT_SECRET_FILE at a file',
    );
  });

  it.each([
    ['a short JWT secret', { JWT_SECRET: 'too-short' }, 'JWT_SECRET'],
    ['a missing database password', { POSTGRES_PASSWORD: undefined }, 'POSTGRES_PASSWORD'],
    ['a non-numeric port', { BACKEND_PORT: 'http' }, 'BACKEND_PORT'],
    ['a non-positive token lifetime', { JWT_EXPIRES_IN: '0' }, 'JWT_EXPIRES_IN'],
    ['an ambiguous boolean', { COOKIE_SECURE: 'yes' }, 'COOKIE_SECURE'],
    ['an unknown time zone', { APP_TIMEZONE: 'Mars/Base' }, 'APP_TIMEZONE'],
    ['an origin with a path', { CORS_ORIGINS: 'http://localhost:8080/app' }, 'CORS_ORIGINS'],
    ['an unknown NODE_ENV', { NODE_ENV: 'staging' }, 'NODE_ENV'],
    ['an invalid seed email', { SEED_USER_EMAIL: 'not-an-email' }, 'SEED_USER_EMAIL'],
  ])('rejects %s', (_label, overrides, key) => {
    expect(() => validateEnv({ ...minimal, ...overrides })).toThrow(key);
  });

  it('reports every problem at once', () => {
    expect(() => validateEnv({})).toThrow(/POSTGRES_USER[\s\S]*JWT_SECRET/);
  });
});
