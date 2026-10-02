import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './env.validation';

export interface DatabaseSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  private value<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): EnvironmentVariables['NODE_ENV'] {
    return this.value('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.value('BACKEND_PORT');
  }

  get database(): DatabaseSettings {
    return {
      host: this.value('POSTGRES_HOST'),
      port: this.value('POSTGRES_PORT'),
      username: this.value('POSTGRES_USER'),
      password: this.value('POSTGRES_PASSWORD'),
      database: this.value('POSTGRES_DB'),
    };
  }

  get jwt(): { secret: string; expiresIn: number } {
    return { secret: this.value('JWT_SECRET'), expiresIn: this.value('JWT_EXPIRES_IN') };
  }

  get cookieSecure(): boolean {
    return this.value('COOKIE_SECURE');
  }

  get corsOrigins(): string[] {
    return this.value('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim());
  }

  get trustProxy(): number {
    return this.value('TRUST_PROXY');
  }

  get timezone(): string {
    return this.value('APP_TIMEZONE');
  }

  get loginRateLimit(): number {
    return this.value('LOGIN_RATE_LIMIT');
  }

  get logLevel(): string {
    return this.value('LOG_LEVEL');
  }
}
