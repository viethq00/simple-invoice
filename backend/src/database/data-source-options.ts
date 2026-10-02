import { types } from 'pg';
import type { DataSourceOptions } from 'typeorm';
import type { DatabaseSettings } from '../config/app-config';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { User } from '../users/user.entity';
import { InitialSchema1790812800000 } from './migrations/1790812800000-InitialSchema';

// Keep DATE columns as 'YYYY-MM-DD' strings. Local-midnight Dates shift the day outside UTC.
const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value: string) => value);

export const ENTITIES = [User, Invoice, InvoiceItem];
export const MIGRATIONS = [InitialSchema1790812800000];

export function buildDataSourceOptions(db: DatabaseSettings): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
    // TypeORM would log failing SQL with its parameters (customer data).
    logging: false,
  };
}
