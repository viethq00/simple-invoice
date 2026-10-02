import { deriveInvoiceStatus } from './domain/invoice-status';
import { lineAmount } from './domain/money';
import type { InvoiceResponseDto } from './dto/invoice-response.dto';
import type { Invoice } from './entities/invoice.entity';

// Safe: at most 15 significant digits, which a double holds exactly.
const toNumber = (value: string): number => Number(value);

export function toInvoiceResponse(invoice: Invoice, today: string): InvoiceResponseDto {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceReference: invoice.invoiceReference,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    description: invoice.description,
    status: deriveInvoiceStatus(invoice.status, invoice.dueDate, today),
    customer: {
      fullname: invoice.customer.fullname,
      email: invoice.customer.email,
      mobileNumber: invoice.customer.mobileNumber,
      address: invoice.customer.address,
    },
    items: (invoice.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      rate: toNumber(item.rate),
      amount: toNumber(lineAmount(item.quantity, item.rate)),
    })),
    taxPercent: toNumber(invoice.taxPercent),
    invoiceSubTotal: toNumber(invoice.invoiceSubTotal),
    totalTax: toNumber(invoice.totalTax),
    totalDiscount: toNumber(invoice.totalDiscount),
    totalAmount: toNumber(invoice.totalAmount),
    totalPaid: toNumber(invoice.totalPaid),
    balanceAmount: toNumber(invoice.balanceAmount),
    createdAt: invoice.createdAt.toISOString(),
    createdBy: invoice.createdBy,
  };
}
