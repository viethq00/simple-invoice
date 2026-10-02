import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
  type ValidationArguments,
} from 'class-validator';
import { readFileSync } from 'node:fs';

const ORIGIN_LIST = /^\s*https?:\/\/[^/\s,]+\s*(,\s*https?:\/\/[^/\s,]+\s*)*$/;

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

// These can also be read from a file named by <KEY>_FILE (Docker secrets convention).
const FILE_SECRETS = ['POSTGRES_PASSWORD', 'JWT_SECRET'] as const;

const secretMessage = (key: string, problem: string): string =>
  `${key} ${problem}: set it in .env (\`npm run setup\` generates one) or point ${key}_FILE at a file`;

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  BACKEND_PORT = 4000;

  @IsString()
  @IsNotEmpty()
  POSTGRES_HOST = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  POSTGRES_PORT = 5432;

  @IsString()
  @IsNotEmpty()
  POSTGRES_USER: string;

  @IsNotEmpty({ message: secretMessage('POSTGRES_PASSWORD', 'is required') })
  POSTGRES_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_DB: string;

  @MinLength(32, {
    message: ({ value }: ValidationArguments) =>
      secretMessage(
        'JWT_SECRET',
        value === undefined ? 'is required' : 'must be at least 32 characters',
      ),
  })
  JWT_SECRET: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_592_000)
  JWT_EXPIRES_IN = 3600;

  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE = false;

  @IsString()
  @Matches(ORIGIN_LIST, {
    message: 'CORS_ORIGINS must be a comma-separated list of origins such as http://localhost:8080',
  })
  CORS_ORIGINS = 'http://localhost:8080,http://localhost:5173';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  TRUST_PROXY = 0;

  @IsTimeZone()
  APP_TIMEZONE = 'UTC';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  LOGIN_RATE_LIMIT = 10;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL = 'info';

  @IsOptional()
  @IsEmail()
  SEED_USER_EMAIL?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  SEED_USER_PASSWORD?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SEED_USER_FULLNAME?: string;
}

const isBlank = (value: unknown): boolean => value === undefined || value === '';

const configurationError = (problems: string[]): Error =>
  new Error(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);

// A value set directly wins over the file, so .env can override the generated secrets.
function resolveSecretFiles(raw: Record<string, unknown>): Record<string, unknown> {
  const resolved = { ...raw };
  for (const key of FILE_SECRETS) {
    const file = raw[`${key}_FILE`];
    if (!isBlank(raw[key]) || typeof file !== 'string' || file === '') continue;
    try {
      resolved[key] = readFileSync(file, 'utf8').trim();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw configurationError([`${key}_FILE could not be read (${reason})`]);
    }
  }
  return resolved;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  // Blank values count as unset so the defaults apply.
  const provided = Object.fromEntries(
    Object.entries(resolveSecretFiles(raw)).filter(([, value]) => !isBlank(value)),
  );
  const env = plainToInstance(EnvironmentVariables, provided, { exposeUnsetFields: false });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw configurationError(errors.flatMap((error) => Object.values(error.constraints ?? {})));
  }
  return env;
}
