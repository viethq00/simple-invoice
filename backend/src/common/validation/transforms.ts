import { Transform } from 'class-transformer';

export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

export const TrimToUndefined = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

export const NormalizeEmail = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

// "paid" -> "Paid". Unknown values pass through so @IsIn can report them.
export const ToCanonical = (allowed: readonly string[]): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return allowed.find((option) => option.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
  });

// Non-numeric text and repeated params (arrays) become NaN so @IsInt rejects them.
export const ToInteger = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return Number.NaN;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    return /^-?\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
  });

export const EmptyToUndefined = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  );
