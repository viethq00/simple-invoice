import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysToIsoDate,
  formatDate,
  formatDeduction,
  formatMoney,
  formatPercent,
  formatTimestamp,
  isIsoDate,
  todayIsoDate,
} from './format';

describe('formatMoney', () => {
  it('prefixes the currency symbol and always shows two decimals with grouping', () => {
    expect(formatMoney(2180, 'AU$')).toBe('AU$2,180.00');
    expect(formatMoney(728.66, 'AU$')).toBe('AU$728.66');
    expect(formatMoney(0.3, '£')).toBe('£0.30');
    expect(formatMoney(2_000_000_000_000, 'US$')).toBe('US$2,000,000,000,000.00');
  });

  it('uses a true minus sign before the symbol for negative amounts', () => {
    expect(formatMoney(-20, 'AU$')).toBe('−AU$20.00');
  });
});

describe('formatDeduction', () => {
  it('shows subtracted amounts as negatives, but leaves zero unsigned', () => {
    expect(formatDeduction(20, 'AU$')).toBe('−AU$20.00');
    expect(formatDeduction(1451.34, 'AU$')).toBe('−AU$1,451.34');
    expect(formatDeduction(0, 'AU$')).toBe('AU$0.00');
  });
});

describe('formatPercent', () => {
  it('drops trailing zeros', () => {
    expect(formatPercent(10)).toBe('10%');
    expect(formatPercent(7.5)).toBe('7.5%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('isIsoDate', () => {
  it('accepts real YYYY-MM-DD dates, including leap days', () => {
    expect(isIsoDate('2026-06-03')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
  });

  it.each([
    '2026-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-6-3',
    '03/06/2026',
    '2026-06-03T00:00:00Z',
    '',
  ])('rejects %j', (value) => expect(isIsoDate(value)).toBe(false));
});

describe('formatDate', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    // Assigning undefined would store the string "undefined".
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('formats calendar dates as day, short month and year', () => {
    expect(formatDate('2026-06-03')).toBe('3 Jun 2026');
    expect(formatDate('2026-09-15')).toBe('15 Sep 2026');
  });

  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Los_Angeles', 'UTC'])(
    'never shifts the day in time zone %s',
    (timeZone) => {
      process.env.TZ = timeZone;
      expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
      expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
    },
  );

  it('returns unparseable input unchanged', () => {
    expect(formatDate('soon')).toBe('soon');
  });
});

describe('formatTimestamp', () => {
  it('formats an instant as a date', () => {
    expect(formatTimestamp('2026-06-03T12:03:26.995Z')).toBe('3 Jun 2026');
  });
});

describe('todayIsoDate', () => {
  it("uses the viewer's local calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 1, 23, 30));
    expect(todayIsoDate()).toBe('2026-10-01');
    vi.useRealTimers();
  });
});

describe('addDaysToIsoDate', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDaysToIsoDate('2026-10-01', 30)).toBe('2026-10-31');
    expect(addDaysToIsoDate('2026-12-15', 30)).toBe('2027-01-14');
    expect(addDaysToIsoDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('throws on an invalid date', () => {
    expect(() => addDaysToIsoDate('2026-02-30', 1)).toThrow(RangeError);
  });
});
