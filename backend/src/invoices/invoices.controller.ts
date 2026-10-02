import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { ErrorResponseDto } from '../common/error-response.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceListResponseDto, InvoiceResponseDto } from './dto/invoice-response.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { InvoicesService } from './invoices.service';

const invoiceIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException(['id must be a valid UUID']),
});

@ApiTags('Invoices')
@ApiBearerAuth('bearer')
@ApiCookieAuth('cookie')
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description: 'Missing, invalid or expired token.',
})
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'List invoices',
    description:
      'Server-side search (case-insensitive, partial: invoice number or customer name), status ' +
      'filter (on the effective status, incl. derived Overdue), invoice-date range, sorting and ' +
      'pagination.',
  })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid query parameters.' })
  list(@Query() query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    return this.invoices.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice with its customer, line items and totals' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'The invoiceId.' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'id is not a valid UUID.' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Invoice not found.' })
  findOne(@Param('id', invoiceIdPipe) id: string): Promise<InvoiceResponseDto> {
    return this.invoices.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an invoice',
    description:
      'Creates a Draft invoice with exactly one line item. Subtotal, tax, discount, total and ' +
      'balance are calculated by the server; status and totals cannot be supplied.',
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Validation failed.' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Invoice number already exists.' })
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceResponseDto> {
    return this.invoices.create(dto, user.id);
  }
}
