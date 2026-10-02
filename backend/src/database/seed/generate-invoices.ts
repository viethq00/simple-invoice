import Decimal from 'decimal.js';
import { addDays } from '../../common/dates';
import type { StoredInvoiceStatus } from '../../invoices/domain/invoice-status';
import { calculateInvoiceTotals } from '../../invoices/domain/money';
import { SEED_CUSTOMERS, SEED_DESCRIPTIONS, SEED_PRODUCTS, type SeedInvoice } from './seed-data';

// mulberry32, so every run produces the same data.
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixed mix of stored status and due-date timing, so every status filter has data.
type Scenario = {
  status: StoredInvoiceStatus;
  timing: 'past-due' | 'current' | 'upcoming';
};

const SCENARIO_PLAN: readonly [Scenario, number][] = [
  [{ status: 'Paid', timing: 'past-due' }, 14],
  [{ status: 'Paid', timing: 'current' }, 2],
  [{ status: 'Pending', timing: 'past-due' }, 8],
  [{ status: 'Pending', timing: 'current' }, 8],
  [{ status: 'Draft', timing: 'past-due' }, 2],
  [{ status: 'Draft', timing: 'current' }, 4],
  [{ status: 'Draft', timing: 'upcoming' }, 2],
];

const PAYMENT_TERMS_DAYS = [7, 14, 14, 30, 30, 30, 45, 60] as const;

export function generateSeedInvoices(today: string, seed = 20261001): SeedInvoice[] {
  const random = createRandom(seed);
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

  const scenarios = SCENARIO_PLAN.flatMap(([scenario, count]) =>
    Array.from({ length: count }, () => scenario),
  );

  const drafts = scenarios.map((scenario) => {
    const terms = pick(PAYMENT_TERMS_DAYS);
    const age = // days between invoice date and today
      scenario.timing === 'past-due'
        ? integer(terms + 1, terms + 120)
        : scenario.timing === 'current'
          ? integer(0, terms - 1)
          : -integer(1, 14); // future-dated draft
    const invoiceDate = addDays(today, -age);
    const customer = pick(SEED_CUSTOMERS);
    const product = pick(SEED_PRODUCTS);
    const quantity = integer(product.minQuantity, product.maxQuantity);
    const subTotal = new Decimal(product.rate).times(quantity);

    const discountRoll = random();
    const discount =
      discountRoll < 0.15
        ? subTotal.times(0.05).toDecimalPlaces(2).toNumber()
        : discountRoll < 0.25
          ? subTotal.times(0.1).toDecimalPlaces(2).toNumber()
          : discountRoll < 0.32
            ? Math.min(50, subTotal.toNumber())
            : 0;

    const { totalAmount } = calculateInvoiceTotals({
      quantity,
      rate: product.rate,
      taxPercent: customer.taxPercent,
      discount,
    });
    const partlyPaid = scenario.status === 'Pending' && random() < 0.4;
    const totalPaid =
      scenario.status === 'Paid'
        ? Number(totalAmount)
        : partlyPaid
          ? new Decimal(totalAmount)
              .times(0.2 + random() * 0.5)
              .toDecimalPlaces(2, Decimal.ROUND_DOWN)
              .toNumber()
          : 0;

    return {
      invoiceDate,
      dueDate: addDays(invoiceDate, terms),
      status: scenario.status,
      customer,
      item: { name: product.name, quantity, rate: product.rate },
      discount,
      totalPaid,
      invoiceReference: random() < 0.6 ? `PO-${integer(1000, 9999)}` : null,
      description: pick(SEED_DESCRIPTIONS),
    };
  });

  return drafts
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate))
    .map((draft, index) => {
      // Upcoming invoices are still created today, not in the future.
      const createdOn = draft.invoiceDate < today ? draft.invoiceDate : today;
      const minutes = String(index % 60).padStart(2, '0');
      return {
        invoiceNumber: `INV-${String(index + 1).padStart(4, '0')}`,
        invoiceReference: draft.invoiceReference,
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate,
        currency: draft.customer.currency,
        description: draft.description,
        status: draft.status,
        customer: {
          fullname: draft.customer.fullname,
          email: draft.customer.email,
          mobileNumber: draft.customer.mobileNumber,
          address: draft.customer.address,
        },
        item: draft.item,
        taxPercent: draft.customer.taxPercent,
        discount: draft.discount,
        totalPaid: draft.totalPaid,
        createdAt: `${createdOn}T09:${minutes}:00.000Z`,
      };
    });
}
