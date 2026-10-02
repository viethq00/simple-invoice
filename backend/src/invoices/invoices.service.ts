import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { Clock } from '../common/clock';
import { isUniqueViolation } from '../database/postgres-errors';
import { currencySymbol } from './domain/currencies';
import {
  calculateInvoiceTotals,
  DiscountExceedsTotalError,
  type InvoiceTotals,
} from './domain/money';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { InvoiceListResponseDto, InvoiceResponseDto } from './dto/invoice-response.dto';
import type { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { INVOICE_LIMITS } from './invoice.constraints';
import { toInvoiceResponse } from './invoice.mapper';
import { INVOICE_NUMBER_UNIQUE_INDEX, InvoicesRepository } from './invoices.repository';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly invoices: InvoicesRepository,
    private readonly clock: Clock,
  ) {}

  async list(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    const today = this.clock.today();
    const [rows, total] = await this.invoices.list(query, today);
    return {
      data: rows.map((invoice) => toInvoiceResponse(invoice, today)),
      paging: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findOne(id: string): Promise<InvoiceResponseDto> {
    const invoice = await this.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return toInvoiceResponse(invoice, this.clock.today());
  }

  // The unique index decides duplicates, so concurrent requests still get one 201.
  async create(dto: CreateInvoiceDto, userId: string): Promise<InvoiceResponseDto> {
    const [item] = dto.items;
    const taxPercent = dto.taxPercent ?? INVOICE_LIMITS.defaultTaxPercent;
    const totals = this.totalsFor(item.quantity, item.rate, taxPercent, dto.discount);

    const invoice = this.invoices.build({
      invoiceNumber: dto.invoiceNumber,
      invoiceReference: dto.invoiceReference ?? null,
      invoiceDate: dto.invoiceDate,
      dueDate: dto.dueDate,
      currency: dto.currency,
      currencySymbol: currencySymbol(dto.currency),
      description: dto.description ?? null,
      status: 'Draft',
      customer: {
        fullname: dto.customer.fullname,
        email: dto.customer.email,
        mobileNumber: dto.customer.mobileNumber ?? null,
        address: dto.customer.address ?? null,
      },
      taxPercent: new Decimal(taxPercent).toFixed(2),
      ...totals,
      createdBy: userId,
      items: [
        { name: item.name, quantity: item.quantity, rate: new Decimal(item.rate).toFixed(2) },
      ],
    });

    let id: string;
    try {
      id = await this.invoices.insert(invoice);
    } catch (error) {
      if (isUniqueViolation(error, INVOICE_NUMBER_UNIQUE_INDEX)) {
        throw new ConflictException('Invoice number already exists');
      }
      throw error;
    }
    return this.findOne(id);
  }

  private totalsFor(
    quantity: number,
    rate: number,
    taxPercent: number,
    discount: number | undefined,
  ): InvoiceTotals {
    try {
      return calculateInvoiceTotals({
        quantity,
        rate,
        taxPercent,
        discount: discount ?? INVOICE_LIMITS.defaultDiscount,
      });
    } catch (error) {
      if (error instanceof DiscountExceedsTotalError) {
        throw new BadRequestException([error.message]);
      }
      throw error;
    }
  }
}
