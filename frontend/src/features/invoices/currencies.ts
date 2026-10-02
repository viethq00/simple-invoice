export const CURRENCIES = [
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'HKD', name: 'Hong Kong dollar' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export const CURRENCY_CODES = CURRENCIES.map((currency) => currency.code) as [
  CurrencyCode,
  ...CurrencyCode[],
];

export const DEFAULT_CURRENCY: CurrencyCode = 'AUD';
