// Caps keep totals within numeric(15,2) and within what a JSON number holds exactly:
// 1,000,000 * 1,000,000.00 * (1 + 100%) = 2,000,000,000,000.00.
export const INVOICE_LIMITS = {
  invoiceNumberMaxLength: 50,
  invoiceReferenceMaxLength: 100,
  descriptionMaxLength: 1000,
  customerNameMaxLength: 120,
  emailMaxLength: 254,
  mobileNumberMaxLength: 30,
  addressMaxLength: 255,
  itemNameMaxLength: 200,
  maxQuantity: 1_000_000,
  maxRate: 1_000_000,
  maxTaxPercent: 100,
  maxDiscount: 2_000_000_000_000,
  defaultTaxPercent: 10,
  defaultDiscount: 0,
} as const;

export const INVOICE_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/#-]*$/;

export const MOBILE_NUMBER_PATTERN = /^(?=(?:\D*\d){6})\+?[0-9 ()-]+$/;
