import { plainToInstance } from 'class-transformer';
import { IsOptional, validateSync } from 'class-validator';
import {
  HasNoControlCharacters,
  IsDateOnly,
  IsNumberWithMaxDecimals,
  IsOnOrAfter,
  MaxCharacters,
} from './validators';

class Period {
  @IsDateOnly()
  invoiceDate: string;

  @IsDateOnly()
  @IsOnOrAfter('invoiceDate')
  dueDate: string;
}

class OptionalRange {
  @IsOptional()
  @IsDateOnly()
  fromDate?: string;

  @IsOptional()
  @IsDateOnly()
  @IsOnOrAfter('fromDate')
  toDate?: string;
}

class Amount {
  @IsNumberWithMaxDecimals(2)
  value: unknown;
}

class Note {
  @HasNoControlCharacters()
  text: unknown;
}

class Name {
  @MaxCharacters(4)
  text: unknown;
}

const messages = <T extends object>(cls: new () => T, plain: object) =>
  validateSync(plainToInstance(cls, plain)).flatMap((e) => Object.values(e.constraints ?? {}));

describe('IsDateOnly / IsOnOrAfter', () => {
  it('accepts a due date on the invoice date', () => {
    expect(messages(Period, { invoiceDate: '2026-10-01', dueDate: '2026-10-01' })).toEqual([]);
  });

  it('accepts a due date after the invoice date', () => {
    expect(messages(Period, { invoiceDate: '2026-10-01', dueDate: '2026-10-31' })).toEqual([]);
  });

  it('rejects a due date before the invoice date with the documented message', () => {
    expect(messages(Period, { invoiceDate: '2026-10-01', dueDate: '2026-09-30' })).toEqual([
      'dueDate must be on or after invoiceDate',
    ]);
  });

  it('reports malformed dates once, without a misleading comparison error', () => {
    expect(messages(Period, { invoiceDate: '2026-02-30', dueDate: '2026-01-01' })).toEqual([
      'invoiceDate must be a valid date in YYYY-MM-DD format',
    ]);
    expect(messages(Period, { invoiceDate: '2026-01-01', dueDate: 'tomorrow' })).toEqual([
      'dueDate must be a valid date in YYYY-MM-DD format',
    ]);
  });

  it('skips the comparison when the other bound is absent', () => {
    expect(messages(OptionalRange, { toDate: '2026-01-01' })).toEqual([]);
    expect(messages(OptionalRange, { fromDate: '2026-02-01', toDate: '2026-01-01' })).toEqual([
      'toDate must be on or after fromDate',
    ]);
  });
});

describe('IsNumberWithMaxDecimals', () => {
  it.each([0, 7, 10.5, 1000.25, -3.1, 2_000_000_000_000])('accepts %p', (value) => {
    expect(messages(Amount, { value })).toEqual([]);
  });

  it.each([10.555, 0.001, 1e-7, 5e-324, Number.NaN, Infinity, '10', null])(
    'rejects %p without throwing',
    (value) => {
      expect(messages(Amount, { value })).toEqual([
        'value must be a number with at most 2 decimal places',
      ]);
    },
  );
});

describe('HasNoControlCharacters', () => {
  it.each(['Paul', 'Line one\nLine two', 'Tab\tseparated', 'Windows\r\nbreak', 'Nguyễn Văn An'])(
    'accepts %p',
    (text) => {
      expect(messages(Note, { text })).toEqual([]);
    },
  );

  it.each(['a\u0000b', '\u0007bell', 'del\u007f', 'c1\u0085'])('rejects %p', (text) => {
    expect(messages(Note, { text })).toEqual(['text must not contain control characters']);
  });

  it('leaves non-strings to the type validators', () => {
    expect(messages(Note, { text: 42 })).toEqual([]);
  });
});

describe('MaxCharacters', () => {
  it('counts code points, the way a varchar column does', () => {
    expect(messages(Name, { text: 'Paul' })).toEqual([]);
    // Four emoji outside the BMP: 8 UTF-16 units, but 4 characters to Postgres.
    expect(messages(Name, { text: '\u{1F600}'.repeat(4) })).toEqual([]);
    // U+2764 U+FE0F is two characters to Postgres; class-validator's MaxLength counts one.
    expect(messages(Name, { text: '\u2764\uFE0F'.repeat(3) })).toEqual([
      'text must be at most 4 characters',
    ]);
  });

  it('leaves non-strings to the type validators', () => {
    expect(messages(Name, { text: 42 })).toEqual([]);
  });
});
