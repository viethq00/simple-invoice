import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  EmptyToUndefined,
  ToCanonical,
  ToInteger,
  TrimToUndefined,
} from '../../common/validation/transforms';
import {
  HasNoControlCharacters,
  IsDateOnly,
  IsOnOrAfter,
} from '../../common/validation/validators';
import { INVOICE_STATUSES, type InvoiceStatus } from '../domain/invoice-status';

export const INVOICE_SORT_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export const SORT_ORDERS = ['ASC', 'DESC'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 100_000;

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: MAX_PAGE, default: 1 })
  @Max(MAX_PAGE, { message: '$property must not exceed $constraint1' })
  @Min(1, { message: '$property must be a positive integer' })
  @IsInt({ message: '$property must be a positive integer' })
  @ToInteger()
  page: number = 1;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: 10 })
  @Max(MAX_PAGE_SIZE, { message: '$property must not exceed $constraint1' })
  @Min(1, { message: '$property must be a positive integer' })
  @IsInt({ message: '$property must be a positive integer' })
  @ToInteger()
  pageSize: number = 10;

  @ApiPropertyOptional({ enum: INVOICE_SORT_FIELDS, default: 'invoiceDate' })
  @IsIn(INVOICE_SORT_FIELDS, {
    message: `$property must be one of: ${INVOICE_SORT_FIELDS.join(', ')}`,
  })
  @ToCanonical(INVOICE_SORT_FIELDS)
  sortBy: InvoiceSortField = 'invoiceDate';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'DESC' })
  @IsIn(SORT_ORDERS, { message: `$property must be one of: ${SORT_ORDERS.join(', ')}` })
  @ToCanonical(SORT_ORDERS)
  ordering: SortOrder = 'DESC';

  @ApiPropertyOptional({
    enum: INVOICE_STATUSES,
    description:
      'Filters on the effective status, so Overdue invoices are not listed as Draft/Pending.',
  })
  @IsIn(INVOICE_STATUSES, { message: `$property must be one of: ${INVOICE_STATUSES.join(', ')}` })
  @IsOptional()
  @ToCanonical(INVOICE_STATUSES)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Case-insensitive partial match on invoice number or customer name.',
  })
  @HasNoControlCharacters()
  @MaxLength(100, { message: '$property must be at most $constraint1 characters' })
  @IsString({ message: '$property must be text' })
  @IsOptional()
  @TrimToUndefined()
  keyword?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Invoices dated on/after (YYYY-MM-DD).' })
  @IsDateOnly()
  @IsOptional()
  @EmptyToUndefined()
  fromDate?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Invoices dated on/before (YYYY-MM-DD).' })
  @IsOnOrAfter('fromDate')
  @IsDateOnly()
  @IsOptional()
  @EmptyToUndefined()
  toDate?: string;
}
