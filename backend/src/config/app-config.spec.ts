import type { ConfigService } from '@nestjs/config';
import { AppConfig } from './app-config';
import { validateEnv, type EnvironmentVariables } from './env.validation';

const configFrom = (raw: Record<string, string>): AppConfig => {
  const env = validateEnv({
    POSTGRES_USER: 'simpleinvoice',
    POSTGRES_PASSWORD: 'secret-password',
    POSTGRES_DB: 'simpleinvoice',
    JWT_SECRET: 'a'.repeat(32),
    ...raw,
  });
  const config = { get: (key: keyof EnvironmentVariables) => env[key] };
  return new AppConfig(config as unknown as ConfigService<EnvironmentVariables, true>);
};

describe('AppConfig', () => {
  it('parses and trims the CORS allow-list', () => {
    expect(
      configFrom({ CORS_ORIGINS: ' https://app.example.com , http://localhost:3000 ' }).corsOrigins,
    ).toEqual(['https://app.example.com', 'http://localhost:3000']);
  });

  it('defaults to the local web app origins', () => {
    expect(configFrom({}).corsOrigins).toEqual(['http://localhost:8080', 'http://localhost:5173']);
  });

  it('groups the database settings', () => {
    expect(configFrom({ POSTGRES_HOST: 'db', POSTGRES_PORT: '6543' }).database).toEqual({
      host: 'db',
      port: 6543,
      username: 'simpleinvoice',
      password: 'secret-password',
      database: 'simpleinvoice',
    });
  });
});
