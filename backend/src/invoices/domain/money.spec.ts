import { calculateInvoiceTotals, DiscountExceedsTotalError, lineAmount } from './money';

describe('calculateInvoiceTotals', () => {
  it('reproduces the Appendix A invoice exactly', () => {
    expect(
      calculateInvoiceTotals({
        quantity: 2,
        rate: 1000,
        taxPercent: 10,
        discount: 20,
        totalPaid: 1451.34,
      }),
    ).toEqual({
      invoiceSubTotal: '2000.00',
      totalTax: '200.00',
      totalDiscount: '20.00',
      totalAmount: '2180.00',
      totalPaid: '1451.34',
      balanceAmount: '728.66',
    });
  });

  it('applies subTotal = quantity * rate, tax = subTotal * tax% / 100, total = subTotal + tax - discount', () => {
    const totals = calculateInvoiceTotals({ quantity: 3, rate: 250, taxPercent: 8, discount: 15 });
    expect(totals.invoiceSubTotal).toBe('750.00');
    expect(totals.totalTax).toBe('60.00');
    expect(totals.totalAmount).toBe('795.00');
  });

  it('defaults totalPaid to zero so the balance equals the total for new invoices', () => {
    const totals = calculateInvoiceTotals({
      quantity: 1,
      rate: 99.99,
      taxPercent: 10,
      discount: 0,
    });
    expect(totals.totalPaid).toBe('0.00');
    expect(totals.balanceAmount).toBe(totals.totalAmount);
    expect(totals.totalAmount).toBe('109.99');
  });

  it('supports a zero tax rate', () => {
    const totals = calculateInvoiceTotals({ quantity: 4, rate: 12.5, taxPercent: 0, discount: 0 });
    expect(totals).toMatchObject({
      invoiceSubTotal: '50.00',
      totalTax: '0.00',
      totalAmount: '50.00',
    });
  });

  it('avoids binary floating-point drift (3 * 0.10 = 0.30, 0.1 + 0.2 style sums)', () => {
    expect(
      calculateInvoiceTotals({ quantity: 3, rate: 0.1, taxPercent: 0, discount: 0 }),
    ).toMatchObject({ invoiceSubTotal: '0.30', totalAmount: '0.30' });
    expect(
      calculateInvoiceTotals({ quantity: 1, rate: 0.1, taxPercent: 100, discount: 0.2 }),
    ).toMatchObject({ invoiceSubTotal: '0.10', totalTax: '0.10', totalAmount: '0.00' });
  });

  it('rounds tax half-up to the cent', () => {
    // 0.05 * 10% = 0.005, rounds to 0.01
    expect(
      calculateInvoiceTotals({ quantity: 1, rate: 0.05, taxPercent: 10, discount: 0 }),
    ).toMatchObject({ totalTax: '0.01', totalAmount: '0.06' });
    // 33.33 * 7.5% = 2.49975, rounds to 2.50
    expect(
      calculateInvoiceTotals({ quantity: 1, rate: 33.33, taxPercent: 7.5, discount: 0 }).totalTax,
    ).toBe('2.50');
    // 10.01 * 12.25% = 1.226225, rounds to 1.23
    expect(
      calculateInvoiceTotals({ quantity: 1, rate: 10.01, taxPercent: 12.25, discount: 0 }).totalTax,
    ).toBe('1.23');
  });

  it('stays exact at the largest accepted inputs', () => {
    expect(
      calculateInvoiceTotals({
        quantity: 1_000_000,
        rate: 1_000_000,
        taxPercent: 100,
        discount: 0,
      }),
    ).toMatchObject({
      invoiceSubTotal: '1000000000000.00',
      totalTax: '1000000000000.00',
      totalAmount: '2000000000000.00',
    });
    expect(
      calculateInvoiceTotals({
        quantity: 999_999,
        rate: 999_999.99,
        taxPercent: 99.99,
        discount: 0.01,
      }),
    ).toMatchObject({
      invoiceSubTotal: '999998990000.01',
      // 999998990000.01 * 0.9999 = 999898990101.009999, rounds to 999898990101.01
      totalTax: '999898990101.01',
      totalAmount: '1999897980101.01',
    });
  });

  it('allows a discount that brings the total to exactly zero', () => {
    const totals = calculateInvoiceTotals({
      quantity: 1,
      rate: 100,
      taxPercent: 10,
      discount: 110,
    });
    expect(totals.totalAmount).toBe('0.00');
  });

  it('rejects a discount larger than subtotal plus tax', () => {
    expect(() =>
      calculateInvoiceTotals({ quantity: 1, rate: 100, taxPercent: 10, discount: 110.01 }),
    ).toThrow(DiscountExceedsTotalError);
  });

  it('rejects a payment larger than the total', () => {
    expect(() =>
      calculateInvoiceTotals({
        quantity: 1,
        rate: 100,
        taxPercent: 0,
        discount: 0,
        totalPaid: 100.01,
      }),
    ).toThrow(RangeError);
  });

  it('accepts decimal strings as returned by PostgreSQL numeric columns', () => {
    expect(
      calculateInvoiceTotals({
        quantity: 2,
        rate: '1000.00',
        taxPercent: '10.00',
        discount: '20.00',
      }).totalAmount,
    ).toBe('2180.00');
  });
});

describe('lineAmount', () => {
  it('multiplies quantity by rate to the cent', () => {
    expect(lineAmount(2, 1000)).toBe('2000.00');
    expect(lineAmount(3, '0.10')).toBe('0.30');
    expect(lineAmount(7, 19.99)).toBe('139.93');
  });
});
