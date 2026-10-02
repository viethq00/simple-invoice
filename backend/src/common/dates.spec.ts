import { addDays, isDateOnly } from './dates';

describe('isDateOnly', () => {
  it.each(['2026-10-01', '2024-02-29', '2028-02-29', '1999-12-31', '2026-01-31'])(
    'accepts the calendar date %s',
    (value) => expect(isDateOnly(value)).toBe(true),
  );

  it.each([
    ['impossible day', '2026-02-30'],
    ['non-leap 29 Feb', '2026-02-29'],
    ['month 13', '2026-13-01'],
    ['day 00', '2026-01-00'],
    ['missing zero padding', '2026-1-1'],
    ['datetime string', '2026-10-01T00:00:00Z'],
    ['slashes', '2026/10/01'],
    ['two-digit year', '0026-10-01'],
    ['empty string', ''],
    ['surrounding whitespace', ' 2026-10-01'],
  ])('rejects %s (%s)', (_label, value) => expect(isDateOnly(value)).toBe(false));

  it.each([undefined, null, 20261001, new Date()])('rejects non-string %p', (value) =>
    expect(isDateOnly(value)).toBe(false),
  );
});

describe('addDays', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-10-01', 30)).toBe('2026-10-31');
    expect(addDays('2026-12-25', 10)).toBe('2027-01-04');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('throws for an invalid date', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
  });
});
