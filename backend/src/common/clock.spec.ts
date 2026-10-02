import { FixedClock, SystemClock } from './clock';

describe('SystemClock', () => {
  // 10:30 UTC on 1 Oct is 30 Sep in Pago Pago (UTC-11) and 2 Oct in Kiritimati (UTC+14).
  const instant = new Date('2026-10-01T10:30:00Z');

  it.each([
    ['UTC', '2026-10-01'],
    ['Pacific/Pago_Pago', '2026-09-30'],
    ['Pacific/Kiritimati', '2026-10-02'],
    ['Australia/Sydney', '2026-10-01'],
  ])('returns the calendar date in %s', (timeZone, expected) => {
    const clock = new SystemClock(timeZone, () => instant);
    expect(clock.today()).toBe(expected);
  });

  it('returns the current instant', () => {
    const clock = new SystemClock('UTC', () => instant);
    expect(clock.now()).toEqual(instant);
  });

  it('rejects an unknown time zone', () => {
    expect(() => new SystemClock('Mars/Olympus_Mons')).toThrow(RangeError);
  });
});

describe('FixedClock', () => {
  it('always reports the configured date', () => {
    const clock = new FixedClock('2026-10-01');
    expect(clock.today()).toBe('2026-10-01');
    expect(clock.now().toISOString()).toBe('2026-10-01T12:00:00.000Z');
  });

  it('rejects an invalid date', () => {
    expect(() => new FixedClock('2026-02-30')).toThrow(RangeError);
  });
});
