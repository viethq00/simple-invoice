import { CURRENCY_CODES, currencySymbol } from './currencies';

describe('currencies', () => {
  it('derives display symbols server-side', () => {
    expect(currencySymbol('AUD')).toBe('AU$');
    expect(currencySymbol('USD')).toBe('US$');
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('SGD')).toBe('S$');
  });

  it('supports only two-decimal ISO 4217 currencies', () => {
    expect(CURRENCY_CODES).toEqual(['AUD', 'USD', 'EUR', 'GBP', 'SGD', 'NZD', 'CAD', 'HKD']);
    expect(CURRENCY_CODES.every((code) => /^[A-Z]{3}$/.test(code))).toBe(true);
  });
});
