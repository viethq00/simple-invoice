import { DataSource } from 'typeorm';
import { loadEnvFiles } from '../config/load-env-files';
import { validateEnv, type EnvironmentVariables } from '../config/env.validation';
import { buildDataSourceOptions } from './data-source-options';

export function createScriptDataSource(): { env: EnvironmentVariables; dataSource: DataSource } {
  loadEnvFiles();
  const env = validateEnv(process.env);
  const dataSource = new DataSource(
    buildDataSourceOptions({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      username: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      database: env.POSTGRES_DB,
    }),
  );
  return { env, dataSource };
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
