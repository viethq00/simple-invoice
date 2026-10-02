import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ToCanonical, Trim, TrimToUndefined } from '../../common/validation/transforms';
import {
  HasNoControlCharacters,
  IsDateOnly,
  IsNumberWithMaxDecimals,
  IsOnOrAfter,
  MaxCharacters,
} from '../../common/validation/validators';
import { CURRENCY_CODES, type CurrencyCode } from '../domain/currencies';
import {
  INVOICE_LIMITS as LIMITS,
  INVOICE_NUMBER_PATTERN,
  MOBILE_NUMBER_PATTERN,
} from '../invoice.constraints';

// class-validator runs decorators bottom-up (with stopAtFirstError), so the basic checks
// sit closest to the property and each field reports a single message.

const required = { message: '$property is required' };
// null is rejected rather than quietly replaced by the 10% default.
const unlessOmitted = (_dto: object, value: unknown): boolean => value !== undefined;

export class CustomerInputDto {
  @ApiProperty({ example: 'Paul', maxLength: LIMITS.customerNameMaxLength })
  @HasNoControlCharacters()
  @MaxCharacters(LIMITS.customerNameMaxLength)
  @IsNotEmpty(required)
  @IsString({ message: '$property must be text' })
  @IsDefined(required)
  @Trim()
  fullname: string;

  @ApiProperty({ example: 'paul@101digital.io', format: 'email', maxLength: LIMITS.emailMaxLength })
  @HasNoControlCharacters()
  @MaxCharacters(LIMITS.emailMaxLength)
  @IsEmail({}, { message: '$property must be a valid email address' })
  @IsDefined(required)
  @Trim()
  email: string;

  @ApiPropertyOptional({
    example: '+61 412 345 678',
    maxLength: LIMITS.mobileNumberMaxLength,
    pattern: MOBILE_NUMBER_PATTERN.source,
  })
  @Matches(MOBILE_NUMBER_PATTERN, {
    message: '$property must contain at least 6 digits and only digits, spaces, +, -, ( or )',
  })
  @MaxCharacters(LIMITS.mobileNumberMaxLength)
  @IsString({ message: '$property must be text' })
  @IsOptional()
  @TrimToUndefined()
  mobileNumber?: string;

  @ApiPropertyOptional({
    example: '1 Raffles Place, Singapore',
    maxLength: LIMITS.addressMaxLength,
  })
  @HasNoControlCharacters()
  @MaxCharacters(LIMITS.addressMaxLength)
  @IsString({ message: '$property must be text' })
  @IsOptional()
  @TrimToUndefined()
  address?: string;
}

export class InvoiceItemInputDto {
  @ApiProperty({ example: 'Honda RC150', maxLength: LIMITS.itemNameMaxLength })
  @HasNoControlCharacters()
  @MaxCharacters(LIMITS.itemNameMaxLength)
  @IsNotEmpty(required)
  @IsString({ message: '$property must be text' })
  @IsDefined(required)
  @Trim()
  name: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: LIMITS.maxQuantity, type: 'integer' })
  @Max(LIMITS.maxQuantity, { message: '$property must not exceed $constraint1' })
  @IsPositive({ message: '$property must be a positive integer' })
  @IsInt({ message: '$property must be a positive integer' })
  @IsDefined(required)
  quantity: number;

  @ApiProperty({
    example: 1000,
    exclusiveMinimum: true,
    minimum: 0,
    maximum: LIMITS.maxRate,
    multipleOf: 0.01,
    description: 'Unit price in the invoice currency (max 2 decimal places).',
  })
  @Max(LIMITS.maxRate, { message: '$property must not exceed $constraint1' })
  @IsPositive({ message: '$property must be a positive number' })
  @IsNumberWithMaxDecimals(2)
  @IsDefined(required)
  rate: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    example: 'INV-2026-0042',
    maxLength: LIMITS.invoiceNumberMaxLength,
    pattern: INVOICE_NUMBER_PATTERN.source,
    description: 'User-provided and unique (case-insensitive).',
  })
  @Matches(INVOICE_NUMBER_PATTERN, {
    message:
      '$property must start with a letter or digit and contain only letters, digits and . _ / # -',
  })
  @MaxCharacters(LIMITS.invoiceNumberMaxLength)
  @IsNotEmpty(required)
  @IsString({ message: '$property must be text' })
  @IsDefined(required)
  @Trim()
  invoiceNumber: string;

  @ApiPropertyOptional({ example: 'PO-4471', maxLength: LIMITS.invoiceReferenceMaxLength })
  @HasNoControlCharacters()
  @MaxCharacters(LIMITS.invoiceReferenceMaxLength)
  @IsString({ message: '$property must be text' })
  @IsOptional()
  @TrimToUndefined()
  invoiceReference?: string;

  @ApiProperty({ example: '2026-10-01', format: 'date' })
  @IsDateOnly()
  @IsDefined(required)
  invoiceDate: string;

  @ApiProperty({ example: '2026-10-31', format: 'date', description: 'On or after invoiceDate.' })
  @IsOnOrAfter('invoiceDate')
  @IsDateOnly()
  @IsDefined(required)
  dueDate: string;

  @ApiProperty({ enum: CURRENCY_CODES, example: 'AUD' })
  @IsIn(CURRENCY_CODES, { message: `$property must be one of: ${CURRENCY_CODES.join(', ')}` })
  @IsDefined(required)
  @ToCanonical(CURRENCY_CODES)
  currency: CurrencyCode;

  @ApiPropertyOptional({
    example: 'Thank you for your business.',
    maxLength: LIMITS.descriptionMaxLength,
  })
  @HasNoControlCharacters()
  @MaxCharacters(LIMITS.descriptionMaxLength)
  @IsString({ message: '$property must be text' })
  @IsOptional()
  @TrimToUndefined()
  description?: string;

  @ApiProperty({ type: CustomerInputDto })
  @ValidateNested()
  @Type(() => CustomerInputDto)
  @IsObject({ message: '$property must be an object' })
  @IsDefined(required)
  customer: CustomerInputDto;

  @ApiProperty({
    type: [InvoiceItemInputDto],
    minItems: 1,
    maxItems: 1,
    description: 'Exactly one line item (the data model supports more in future).',
  })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInputDto)
  @IsObject({ each: true, message: '$property must be a list of line-item objects' })
  @ArrayMaxSize(1, { message: '$property must contain exactly one line item' })
  @ArrayMinSize(1, { message: '$property must contain exactly one line item' })
  @IsArray({ message: '$property must be an array' })
  @IsDefined(required)
  items: InvoiceItemInputDto[];

  @ApiPropertyOptional({
    example: 10,
    default: LIMITS.defaultTaxPercent,
    minimum: 0,
    maximum: LIMITS.maxTaxPercent,
    multipleOf: 0.01,
    description: 'Tax percentage applied to the subtotal.',
  })
  @Max(LIMITS.maxTaxPercent, { message: '$property must not exceed $constraint1' })
  @Min(0, { message: '$property must not be negative' })
  @IsNumberWithMaxDecimals(2)
  @ValidateIf(unlessOmitted)
  taxPercent?: number = LIMITS.defaultTaxPercent;

  @ApiPropertyOptional({
    example: 20,
    default: LIMITS.defaultDiscount,
    minimum: 0,
    maximum: LIMITS.maxDiscount,
    multipleOf: 0.01,
    description: 'Absolute discount in the invoice currency; cannot exceed subtotal plus tax.',
  })
  @Max(LIMITS.maxDiscount, { message: '$property must not exceed $constraint1' })
  @Min(0, { message: '$property must not be negative' })
  @IsNumberWithMaxDecimals(2)
  @ValidateIf(unlessOmitted)
  discount?: number = LIMITS.defaultDiscount;
}
