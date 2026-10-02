import Decimal from 'decimal.js';

// Each component is rounded half-up to the cent before it's combined, like a printed invoice.
const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

type Numeric = number | string;

export interface InvoiceTotalsInput {
  quantity: number;
  rate: Numeric;
  taxPercent: Numeric;
  discount: Numeric; // an amount, not a percentage
  totalPaid?: Numeric;
}

export interface InvoiceTotals {
  invoiceSubTotal: string;
  totalTax: string;
  totalDiscount: string;
  totalAmount: string;
  totalPaid: string;
  balanceAmount: string;
}

export class DiscountExceedsTotalError extends Error {
  constructor() {
    super('discount must not exceed subtotal plus tax');
    this.name = 'DiscountExceedsTotalError';
  }
}

const toCents = (value: Decimal): Decimal => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export function calculateInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subTotal = toCents(new Money(input.quantity).times(input.rate));
  const tax = toCents(subTotal.times(input.taxPercent).dividedBy(100));
  const discount = toCents(new Money(input.discount));
  const beforeDiscount = subTotal.plus(tax);
  if (discount.greaterThan(beforeDiscount)) throw new DiscountExceedsTotalError();

  const total = beforeDiscount.minus(discount);
  const paid = toCents(new Money(input.totalPaid ?? 0));
  if (paid.greaterThan(total)) throw new RangeError('totalPaid must not exceed totalAmount');

  return {
    invoiceSubTotal: subTotal.toFixed(2),
    totalTax: tax.toFixed(2),
    totalDiscount: discount.toFixed(2),
    totalAmount: total.toFixed(2),
    totalPaid: paid.toFixed(2),
    balanceAmount: total.minus(paid).toFixed(2),
  };
}

export function lineAmount(quantity: number, rate: Numeric): string {
  return toCents(new Money(quantity).times(rate)).toFixed(2);
}
