import type { FieldPath } from 'react-hook-form';
import type { CreateInvoiceFormValues } from './create-invoice-schema';

type CreateInvoiceField = FieldPath<CreateInvoiceFormValues>;

const FIELD_LABELS = {
  'customer.fullname': 'Customer name',
  'customer.email': 'Email address',
  'customer.mobileNumber': 'Mobile number',
  'customer.address': 'Address',
  invoiceNumber: 'Invoice number',
  invoiceReference: 'Reference',
  invoiceDate: 'Invoice date',
  dueDate: 'Due date',
  currency: 'Currency',
  description: 'Description',
  'items.0.name': 'Item name',
  'items.0.quantity': 'Quantity',
  'items.0.rate': 'Rate',
  taxPercent: 'Tax',
  discount: 'Discount',
} satisfies Partial<Record<CreateInvoiceField, string>>;

type MappedField = keyof typeof FIELD_LABELS;

const REPHRASED: Record<string, string> = {
  'dueDate must be on or after invoiceDate': 'The due date must be on or after the invoice date',
  'discount must not exceed subtotal plus tax':
    "The discount can't be more than the subtotal plus tax",
};

// Longest paths first so `items.0.rate` wins over a shorter prefix.
const PATHS = (Object.keys(FIELD_LABELS) as MappedField[]).sort((a, b) => b.length - a.length);

export interface MappedServerErrors {
  fields: Partial<Record<MappedField, string>>;
  general: string[];
}

// Each API message starts with its field path ("customer.email must be ...").
export function mapServerErrors(messages: readonly string[]): MappedServerErrors {
  const result: MappedServerErrors = { fields: {}, general: [] };
  for (const message of messages) {
    const path = PATHS.find((candidate) => message.startsWith(`${candidate} `));
    if (!path) {
      result.general.push(message);
      continue;
    }
    result.fields[path] ??=
      REPHRASED[message] ?? `${FIELD_LABELS[path]} ${message.slice(path.length + 1)}`;
  }
  return result;
}
