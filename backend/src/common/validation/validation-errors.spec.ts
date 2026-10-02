import type { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './validation-errors';

const error = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({ property, constraints, children });

describe('flattenValidationErrors', () => {
  it('keeps top-level messages unchanged', () => {
    expect(
      flattenValidationErrors([
        error('dueDate', { isOnOrAfter: 'dueDate must be on or after invoiceDate' }),
      ]),
    ).toEqual(['dueDate must be on or after invoiceDate']);
  });

  it('prefixes nested object and array errors with the full path', () => {
    expect(
      flattenValidationErrors([
        error('customer', undefined, [error('email', { isEmail: 'email must be an email' })]),
        error('items', undefined, [
          error('0', undefined, [error('quantity', { isInt: 'quantity must be an integer' })]),
        ]),
      ]),
    ).toEqual(['customer.email must be an email', 'items.0.quantity must be an integer']);
  });

  it('names unexpected properties by their full path', () => {
    expect(
      flattenValidationErrors([
        error('status', { whitelistValidation: 'property status should not exist' }),
        error('customer', undefined, [
          error('vip', { whitelistValidation: 'property vip should not exist' }),
        ]),
      ]),
    ).toEqual(['property status should not exist', 'property customer.vip should not exist']);
  });

  it('falls back to "path: message" when a message does not start with the property', () => {
    expect(flattenValidationErrors([error('page', { custom: 'Too large' })])).toEqual([
      'page: Too large',
    ]);
  });
});
