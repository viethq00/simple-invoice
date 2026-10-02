import { isDateOnly } from './dates';

export abstract class Clock {
  abstract now(): Date;
  abstract today(): string;
}

export class SystemClock extends Clock {
  private readonly formatter: Intl.DateTimeFormat;

  constructor(
    timeZone: string,
    private readonly currentInstant: () => Date = () => new Date(),
  ) {
    super();
    this.formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  now(): Date {
    return this.currentInstant();
  }

  today(): string {
    const parts = this.formatter.formatToParts(this.now());
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((candidate) => candidate.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
}

export class FixedClock extends Clock {
  constructor(private readonly date: string) {
    super();
    if (!isDateOnly(date)) throw new RangeError(`Invalid date: ${JSON.stringify(date)}`);
  }

  now(): Date {
    return new Date(`${this.date}T12:00:00.000Z`);
  }

  today(): string {
    return this.date;
  }
}
