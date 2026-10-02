import { describe, expect, it } from 'vitest';
import { mapServerErrors } from './server-errors';

describe('mapServerErrors', () => {
  it('assigns messages to fields by their property path', () => {
    expect(
      mapServerErrors([
        'customer.email must be a valid email address',
        'items.0.quantity must be a positive integer',
        'invoiceNumber is required',
      ]),
    ).toEqual({
      fields: {
        'customer.email': 'Email address must be a valid email address',
        'items.0.quantity': 'Quantity must be a positive integer',
        invoiceNumber: 'Invoice number is required',
      },
      general: [],
    });
  });

  it('rephrases rules that mention other fields', () => {
    expect(
      mapServerErrors([
        'dueDate must be on or after invoiceDate',
        'discount must not exceed subtotal plus tax',
      ]).fields,
    ).toEqual({
      dueDate: 'The due date must be on or after the invoice date',
      discount: "The discount can't be more than the subtotal plus tax",
    });
  });

  it('keeps only the first message per field', () => {
    expect(
      mapServerErrors(['taxPercent must not be negative', 'taxPercent must not exceed 100']).fields,
    ).toEqual({ taxPercent: 'Tax must not be negative' });
  });

  it('reports messages without a matching field as general errors', () => {
    expect(
      mapServerErrors(['property status should not exist', 'items must contain exactly 1 item']),
    ).toEqual({
      fields: {},
      general: ['property status should not exist', 'items must contain exactly 1 item'],
    });
  });

  it('does not confuse fields that share a prefix', () => {
    expect(mapServerErrors(['invoiceDateX is odd']).general).toEqual(['invoiceDateX is odd']);
  });
});
