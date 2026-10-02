import { ValidateBy, type ValidationArguments, type ValidationOptions } from 'class-validator';
import Decimal from 'decimal.js';
import { isDateOnly } from '../dates';

// Control characters other than tab and line breaks. Postgres can't store NUL at all.
const FORBIDDEN_CONTROL_CHARACTER = /(?![\t\n\r])\p{Cc}/u;

// class-validator's maxDecimalPlaces throws on exponent notation (1e-7), so use decimal.js.
export function IsNumberWithMaxDecimals(
  maxDecimalPlaces: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isNumberWithMaxDecimals',
      constraints: [maxDecimalPlaces],
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' &&
          Number.isFinite(value) &&
          new Decimal(value).decimalPlaces() <= maxDecimalPlaces,
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property} must be a number with at most ${maxDecimalPlaces} decimal places`,
      },
    },
    options,
  );
}

export function HasNoControlCharacters(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'hasNoControlCharacters',
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'string' || !FORBIDDEN_CONTROL_CHARACTER.test(value),
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property} must not contain control characters`,
      },
    },
    options,
  );
}

// Counts code points, as a varchar(n) column does. class-validator's MaxLength skips
// U+FE0E/U+FE0F, so text it accepts could still be too long for the column.
export function MaxCharacters(max: number, options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxCharacters',
      constraints: [max],
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || [...value].length <= max,
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property} must be at most ${max} characters`,
      },
    },
    options,
  );
}

export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDateOnly',
      validator: {
        validate: (value: unknown) => isDateOnly(value),
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property} must be a valid date in YYYY-MM-DD format`,
      },
    },
    options,
  );
}

// Skips missing or malformed dates, which @IsDateOnly already reports.
export function IsOnOrAfter(property: string, options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isOnOrAfter',
      constraints: [property],
      validator: {
        validate: (value: unknown, args?: ValidationArguments) => {
          const other = (args?.object as Record<string, unknown> | undefined)?.[property];
          if (!isDateOnly(value) || !isDateOnly(other)) return true;
          return value >= other;
        },
        defaultMessage: (args?: ValidationArguments) =>
          `${args?.property} must be on or after ${property}`,
      },
    },
    options,
  );
}
