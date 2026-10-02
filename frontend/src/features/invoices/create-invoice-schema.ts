import { z } from 'zod';
import type { CreateInvoiceRequest } from '@/lib/api-types';
import { addDaysToIsoDate, isIsoDate, todayIsoDate } from '@/lib/format';
import { CURRENCY_CODES, DEFAULT_CURRENCY } from './currencies';

// Same rules as the API, checked here for faster feedback.
const INVOICE_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/#-]*$/;
const MOBILE_PATTERN = /^(?=(?:\D*\d){6})\+?[0-9 ()-]+$/;
const WHOLE_NUMBER_PATTERN = /^\d+$/;
const AMOUNT_PATTERN = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;
const DECIMAL_COMMA_PATTERN = /^\d+,\d{1,2}$/;

const MAX_QUANTITY = 1_000_000;
const MAX_RATE = 1_000_000;
const MAX_TAX_PERCENT = 100;
const MAX_DISCOUNT = 2_000_000_000_000;

// Comma-locale keypads have no decimal point, and "12,50" can only mean 12.50.
function normalizeDecimalComma(value: string): string {
  return DECIMAL_COMMA_PATTERN.test(value) ? value.replace(',', '.') : value;
}

function maxLength(label: string, max: number) {
  return `${label} must be ${max.toLocaleString('en-US')} characters or fewer`;
}

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, maxLength(label, max));

const isoDateField = (missing: string) =>
  z.string().trim().min(1, missing).refine(isIsoDate, 'Enter a real date');

// Blank is allowed: the API then applies its default.
const optionalAmount = (invalid: string, max: number, tooLarge: string) =>
  z
    .string()
    .trim()
    .overwrite(normalizeDecimalComma)
    .refine((value) => value === '' || AMOUNT_PATTERN.test(value), invalid)
    .refine(
      (value) => value === '' || !AMOUNT_PATTERN.test(value) || Number(value) <= max,
      tooLarge,
    );

const lineItemSchema = z.object({
  name: z.string().trim().min(1, 'Enter the item name').max(200, maxLength('Item name', 200)),
  quantity: z
    .string()
    .trim()
    .min(1, 'Enter a quantity')
    .regex(WHOLE_NUMBER_PATTERN, 'Quantity must be a whole number, like 1 or 12')
    .refine((value) => Number(value) >= 1, 'Quantity must be at least 1')
    .refine(
      (value) => Number(value) <= MAX_QUANTITY,
      `Quantity can't be more than ${MAX_QUANTITY.toLocaleString('en-US')}`,
    ),
  rate: z
    .string()
    .trim()
    .overwrite(normalizeDecimalComma)
    .min(1, 'Enter a rate')
    .regex(AMOUNT_PATTERN, 'Enter a rate with up to 2 decimal places, like 1250.50')
    .refine((value) => Number(value) > 0, 'The rate must be more than 0')
    .refine(
      (value) => Number(value) <= MAX_RATE,
      `The rate can't be more than ${MAX_RATE.toLocaleString('en-US')}`,
    ),
});

export const createInvoiceSchema = z
  .object({
    customer: z.object({
      fullname: z
        .string()
        .trim()
        .min(1, "Enter the customer's name")
        .max(120, maxLength('Customer name', 120)),
      email: z
        .string()
        .trim()
        .min(1, "Enter the customer's email address")
        .max(254, maxLength('Email address', 254))
        .pipe(z.email('Enter a valid email address, like name@example.com')),
      mobileNumber: optionalText('Mobile number', 30).refine(
        (value) => value === '' || MOBILE_PATTERN.test(value),
        'Use at least 6 digits. Only digits, spaces, brackets, hyphens and a leading + are allowed',
      ),
      address: optionalText('Address', 255),
    }),
    invoiceNumber: z
      .string()
      .trim()
      .min(1, 'Enter an invoice number')
      .max(50, maxLength('Invoice number', 50))
      .regex(
        INVOICE_NUMBER_PATTERN,
        'Start with a letter or number, then use only letters, numbers and . _ / # -',
      ),
    invoiceReference: optionalText('Reference', 100),
    invoiceDate: isoDateField('Enter the invoice date'),
    dueDate: isoDateField('Enter the due date'),
    currency: z.enum(CURRENCY_CODES, { error: 'Choose a currency' }),
    description: optionalText('Description', 1000),
    items: z.tuple([lineItemSchema]),
    taxPercent: optionalAmount(
      'Enter a tax rate of 0 or more, with up to 2 decimal places',
      MAX_TAX_PERCENT,
      "Tax can't be more than 100%",
    ),
    discount: optionalAmount(
      'Enter a discount of 0 or more, with up to 2 decimal places',
      MAX_DISCOUNT,
      `The discount can't be more than ${MAX_DISCOUNT.toLocaleString('en-US')}`,
    ),
  })
  .refine((values) => values.dueDate >= values.invoiceDate, {
    path: ['dueDate'],
    message: 'The due date must be on or after the invoice date',
    // Check the dates even while other fields still have errors.
    when: ({ value }) => {
      const { invoiceDate, dueDate } = (value ?? {}) as {
        invoiceDate?: unknown;
        dueDate?: unknown;
      };
      return (
        typeof invoiceDate === 'string' &&
        typeof dueDate === 'string' &&
        isIsoDate(invoiceDate.trim()) &&
        isIsoDate(dueDate.trim())
      );
    },
  });

export type CreateInvoiceFormValues = z.input<typeof createInvoiceSchema>;

export function createInvoiceDefaults(today: string = todayIsoDate()): CreateInvoiceFormValues {
  return {
    customer: { fullname: '', email: '', mobileNumber: '', address: '' },
    invoiceNumber: '',
    invoiceReference: '',
    invoiceDate: today,
    dueDate: addDaysToIsoDate(today, 30),
    currency: DEFAULT_CURRENCY,
    description: '',
    items: [{ name: '', quantity: '1', rate: '' }],
    taxPercent: '10',
    discount: '0',
  };
}

export function toCreateInvoiceRequest(values: CreateInvoiceFormValues): CreateInvoiceRequest {
  const optional = (value: string) => {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  };
  const amount = (value: string) => Number(normalizeDecimalComma(value.trim()));
  const [item] = values.items;
  const customer = values.customer;

  const request: CreateInvoiceRequest = {
    invoiceNumber: values.invoiceNumber.trim(),
    invoiceDate: values.invoiceDate.trim(),
    dueDate: values.dueDate.trim(),
    currency: values.currency,
    customer: { fullname: customer.fullname.trim(), email: customer.email.trim() },
    items: [{ name: item.name.trim(), quantity: Number(item.quantity), rate: amount(item.rate) }],
  };

  const reference = optional(values.invoiceReference);
  if (reference) request.invoiceReference = reference;
  const description = optional(values.description);
  if (description) request.description = description;
  const mobileNumber = optional(customer.mobileNumber);
  if (mobileNumber) request.customer.mobileNumber = mobileNumber;
  const address = optional(customer.address);
  if (address) request.customer.address = address;
  const taxPercent = optional(values.taxPercent);
  if (taxPercent !== undefined) request.taxPercent = amount(taxPercent);
  const discount = optional(values.discount);
  if (discount !== undefined) request.discount = amount(discount);

  return request;
}
