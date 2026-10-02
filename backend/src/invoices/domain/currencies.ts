// Two-decimal currencies only, since amounts are stored as numeric(15,2).
export const SUPPORTED_CURRENCIES = {
  AUD: 'AU$',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
  SGD: 'S$',
  NZD: 'NZ$',
  CAD: 'CA$',
  HKD: 'HK$',
} as const;

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

export const CURRENCY_CODES = Object.keys(SUPPORTED_CURRENCIES) as CurrencyCode[];

export function currencySymbol(code: CurrencyCode): string {
  return SUPPORTED_CURRENCIES[code];
}
