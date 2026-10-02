import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { buildOpenApiDocument } from '../../src/swagger';
import { readSchema, type Schema } from './data-dictionary';

export interface Snapshot {
  openApi: OpenAPIObject;
  schema: Schema;
}

// Boots the app against an empty database, runs the migrations, then reads the OpenAPI
// document and the schema. Like the e2e tests it starts PostgreSQL in Docker, unless
// TEST_DATABASE_URL points at a database whose name ends in _test.
export async function takeSnapshot(): Promise<Snapshot> {
  const container = process.env.TEST_DATABASE_URL
    ? undefined
    : await new PostgreSqlContainer('postgres:17-alpine').start();
  try {
    const url = new URL(container?.getConnectionUri() ?? process.env.TEST_DATABASE_URL ?? '');
    const database = url.pathname.slice(1);
    if (!container && !database.endsWith('_test')) {
      throw new Error(`Refusing to use "${database}": the name must end in _test.`);
    }
    Object.assign(process.env, {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      POSTGRES_HOST: url.hostname,
      POSTGRES_PORT: url.port || '5432',
      POSTGRES_USER: decodeURIComponent(url.username),
      POSTGRES_PASSWORD: decodeURIComponent(url.password),
      POSTGRES_DB: database,
      JWT_SECRET: 'only-used-to-generate-diagrams-not-a-real-secret',
    });
    // Loaded only now: ConfigModule.forRoot() reads and validates the environment as soon as
    // app.module is loaded. (A dynamic import() would be an ES module import under nodenext.)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('../../src/app.module') as typeof import('../../src/app.module');
    const app = await NestFactory.create(AppModule, { logger: false });
    try {
      const dataSource = app.get(DataSource);
      await dataSource.runMigrations({ transaction: 'each' });
      return { openApi: buildOpenApiDocument(app), schema: await readSchema(dataSource) };
    } finally {
      await app.close();
    }
  } finally {
    await container?.stop();
  }
}
