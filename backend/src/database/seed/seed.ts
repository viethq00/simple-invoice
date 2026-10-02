import { compare, hash } from 'bcryptjs';
import Decimal from 'decimal.js';
import type { DataSource, EntityManager } from 'typeorm';
import { BCRYPT_COST } from '../../auth/auth.constants';
import { currencySymbol } from '../../invoices/domain/currencies';
import { calculateInvoiceTotals } from '../../invoices/domain/money';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { User } from '../../users/user.entity';
import { generateSeedInvoices } from './generate-invoices';
import { APPENDIX_A_INVOICE, APPENDIX_A_USER_ID, type SeedInvoice } from './seed-data';

export interface SeedUserOptions {
  email: string;
  password: string;
  fullname: string;
}

export interface SeedResult {
  user: { email: string; status: 'created' | 'updated' | 'unchanged' };
  invoices: { inserted: number; skipped: number };
}

// Safe to re-run: only invoice numbers that don't exist yet are inserted.
export async function seedDatabase(
  dataSource: DataSource,
  user: SeedUserOptions,
  today: string,
): Promise<SeedResult> {
  return dataSource.transaction(async (manager) => {
    const { reviewer, status } = await upsertReviewer(manager, user);
    const invoices = [APPENDIX_A_INVOICE, ...generateSeedInvoices(today)];
    let inserted = 0;
    for (const seed of invoices) {
      if (await invoiceNumberExists(manager, seed.invoiceNumber)) continue;
      await manager.getRepository(Invoice).save(toInvoiceEntity(manager, seed, reviewer.id));
      inserted += 1;
    }
    return {
      user: { email: reviewer.email, status },
      invoices: { inserted, skipped: invoices.length - inserted },
    };
  });
}

async function upsertReviewer(
  manager: EntityManager,
  { email, password, fullname }: SeedUserOptions,
): Promise<{ reviewer: User; status: SeedResult['user']['status'] }> {
  const users = manager.getRepository(User);
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await users
    .createQueryBuilder('user')
    .addSelect('user.passwordHash')
    .where('user.email = :email', { email: normalizedEmail })
    .getOne();

  if (!existing) {
    const idTaken = await users.existsBy({ id: APPENDIX_A_USER_ID });
    const reviewer = await users.save(
      users.create({
        ...(idTaken ? {} : { id: APPENDIX_A_USER_ID }),
        email: normalizedEmail,
        fullname,
        passwordHash: await hash(password, BCRYPT_COST),
      }),
    );
    return { reviewer, status: 'created' };
  }

  // Reset a changed password so the login in the README keeps working.
  const passwordMatches = await compare(password, existing.passwordHash);
  if (passwordMatches && existing.fullname === fullname) {
    return { reviewer: existing, status: 'unchanged' };
  }
  existing.fullname = fullname;
  if (!passwordMatches) existing.passwordHash = await hash(password, BCRYPT_COST);
  return { reviewer: await users.save(existing), status: 'updated' };
}

function invoiceNumberExists(manager: EntityManager, invoiceNumber: string): Promise<boolean> {
  return manager
    .getRepository(Invoice)
    .createQueryBuilder('invoice')
    .where('lower(invoice.invoiceNumber) = lower(:invoiceNumber)', { invoiceNumber })
    .getExists();
}

function toInvoiceEntity(manager: EntityManager, seed: SeedInvoice, createdBy: string): Invoice {
  const totals = calculateInvoiceTotals({
    quantity: seed.item.quantity,
    rate: seed.item.rate,
    taxPercent: seed.taxPercent,
    discount: seed.discount,
    totalPaid: seed.totalPaid,
  });
  return manager.getRepository(Invoice).create({
    ...(seed.id ? { id: seed.id } : {}),
    invoiceNumber: seed.invoiceNumber,
    invoiceReference: seed.invoiceReference,
    invoiceDate: seed.invoiceDate,
    dueDate: seed.dueDate,
    currency: seed.currency,
    currencySymbol: currencySymbol(seed.currency),
    description: seed.description,
    status: seed.status,
    customer: seed.customer,
    taxPercent: new Decimal(seed.taxPercent).toFixed(2),
    ...totals,
    createdBy,
    createdAt: new Date(seed.createdAt),
    items: [
      {
        ...(seed.item.id ? { id: seed.item.id } : {}),
        name: seed.item.name,
        quantity: seed.item.quantity,
        rate: new Decimal(seed.item.rate).toFixed(2),
      },
    ],
  });
}
