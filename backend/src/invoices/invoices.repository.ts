import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, type DeepPartial, type SelectQueryBuilder } from 'typeorm';
import type { InvoiceStatus } from './domain/invoice-status';
import type { InvoiceSortField, ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { Invoice } from './entities/invoice.entity';

export const INVOICE_NUMBER_UNIQUE_INDEX = 'uq_invoices_invoice_number';

const SORT_COLUMNS: Record<InvoiceSortField, string> = {
  invoiceDate: 'invoice.invoiceDate',
  dueDate: 'invoice.dueDate',
  totalAmount: 'invoice.totalAmount',
};

// A search for "50%" should match that text, not act as a wildcard.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class InvoicesRepository {
  constructor(@InjectRepository(Invoice) private readonly invoices: Repository<Invoice>) {}

  build(values: DeepPartial<Invoice>): Invoice {
    return this.invoices.create(values);
  }

  async insert(invoice: Invoice): Promise<string> {
    const saved = await this.invoices.save(invoice);
    return saved.id;
  }

  findById(id: string): Promise<Invoice | null> {
    return this.invoices.findOne({ where: { id }, relations: { items: true } });
  }

  list(query: ListInvoicesQueryDto, today: string): Promise<[Invoice[], number]> {
    const qb = this.invoices
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'item');

    if (query.keyword) {
      const pattern = `%${escapeLikePattern(query.keyword)}%`;
      qb.andWhere(
        new Brackets((where) =>
          where
            .where('invoice.invoiceNumber ILIKE :pattern', { pattern })
            .orWhere('invoice.customer.fullname ILIKE :pattern', { pattern }),
        ),
      );
    }
    if (query.status) applyStatusFilter(qb, query.status, today);
    if (query.fromDate)
      qb.andWhere('invoice.invoiceDate >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate) qb.andWhere('invoice.invoiceDate <= :toDate', { toDate: query.toDate });

    return (
      qb
        .orderBy(SORT_COLUMNS[query.sortBy], query.ordering)
        // Tie-breakers keep pages stable when sort values repeat.
        .addOrderBy('invoice.createdAt', 'DESC')
        .addOrderBy('invoice.id', 'ASC')
        .skip((query.page - 1) * query.pageSize)
        .take(query.pageSize)
        .getManyAndCount()
    );
  }
}

// Same rule as deriveInvoiceStatus(): a past-due Pending invoice is listed as Overdue only.
function applyStatusFilter(
  qb: SelectQueryBuilder<Invoice>,
  status: InvoiceStatus,
  today: string,
): void {
  if (status === 'Overdue') {
    qb.andWhere('invoice.status <> :paid AND invoice.dueDate < :today', { paid: 'Paid', today });
    return;
  }
  qb.andWhere('invoice.status = :status', { status });
  if (status !== 'Paid') qb.andWhere('invoice.dueDate >= :today', { today });
}
