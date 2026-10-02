import { ApiProperty } from '@nestjs/swagger';
import { CURRENCY_CODES } from '../domain/currencies';
import { INVOICE_STATUSES, type InvoiceStatus } from '../domain/invoice-status';

export class CustomerResponseDto {
  @ApiProperty({ example: 'Paul' })
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io' })
  email: string;

  @ApiProperty({ type: String, nullable: true, example: '947717364111' })
  mobileNumber: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Singapore' })
  address: string | null;
}

export class InvoiceItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Honda RC150' })
  name: string;

  @ApiProperty({ type: 'integer', example: 2 })
  quantity: number;

  @ApiProperty({ example: 1000 })
  rate: number;

  @ApiProperty({ example: 2000, description: 'quantity * rate, calculated by the server.' })
  amount: number;
}

export class InvoiceResponseDto {
  @ApiProperty({ format: 'uuid', example: '099ca7da-a290-40fa-93b9-1c43ae7bb887' })
  invoiceId: string;

  @ApiProperty({ example: 'IV1780488206995' })
  invoiceNumber: string;

  @ApiProperty({ type: String, nullable: true, example: '#5721662' })
  invoiceReference: string | null;

  @ApiProperty({ format: 'date', example: '2026-06-03' })
  invoiceDate: string;

  @ApiProperty({ format: 'date', example: '2026-07-03' })
  dueDate: string;

  @ApiProperty({ enum: CURRENCY_CODES, example: 'AUD' })
  currency: string;

  @ApiProperty({ example: 'AU$' })
  currencySymbol: string;

  @ApiProperty({ type: String, nullable: true, example: 'Invoice is issued to Kanglee' })
  description: string | null;

  @ApiProperty({
    enum: INVOICE_STATUSES,
    example: 'Overdue',
    description:
      'Effective status: Overdue is derived when an unpaid invoice is past its due date.',
  })
  status: InvoiceStatus;

  @ApiProperty({ type: CustomerResponseDto })
  customer: CustomerResponseDto;

  @ApiProperty({ type: [InvoiceItemResponseDto] })
  items: InvoiceItemResponseDto[];

  @ApiProperty({ example: 10, description: 'Tax percentage applied to the subtotal.' })
  taxPercent: number;

  @ApiProperty({ example: 2000, description: 'Sum of quantity * rate.' })
  invoiceSubTotal: number;

  @ApiProperty({ example: 200 })
  totalTax: number;

  @ApiProperty({ example: 20 })
  totalDiscount: number;

  @ApiProperty({ example: 2180, description: 'invoiceSubTotal + totalTax - totalDiscount.' })
  totalAmount: number;

  @ApiProperty({ example: 1451.34 })
  totalPaid: number;

  @ApiProperty({ example: 728.66, description: 'totalAmount - totalPaid.' })
  balanceAmount: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'uuid', description: 'User who created the invoice.' })
  createdBy: string;
}

export class PagingDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 41, description: 'Total number of invoices matching the filters.' })
  total: number;
}

export class InvoiceListResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data: InvoiceResponseDto[];

  @ApiProperty({ type: PagingDto })
  paging: PagingDto;
}
