import type { ReactNode } from 'react';
import type { Invoice } from '@/lib/api-types';
import { cn } from '@/lib/cn';
import {
  formatDate,
  formatDeduction,
  formatMoney,
  formatPercent,
  formatTimestamp,
} from '@/lib/format';
import { StatusStamp } from './StatusBadge';

export function InvoiceSheet({ invoice }: { invoice: Invoice }) {
  const money = (amount: number) => formatMoney(amount, invoice.currencySymbol);
  const { customer } = invoice;

  return (
    <article
      aria-labelledby="invoice-title"
      className="relative mx-auto w-full max-w-4xl rounded-sheet bg-paper px-5 pt-10 pb-8 shadow-paper sm:px-10 sm:pt-12 sm:pb-12 print:max-w-none print:px-0 print:pt-6 print:shadow-none"
    >
      <StatusStamp
        status={invoice.status}
        className="absolute -top-3.5 right-4 sm:right-10 print:top-0"
      />

      <header className="flex flex-col gap-1 border-b border-rule pb-6">
        <h1 id="invoice-title" tabIndex={-1} data-route-focus className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">Invoice</span>{' '}
          <span className="font-display text-3xl break-all text-ink sm:text-4xl">
            {invoice.invoiceNumber}
          </span>
        </h1>
        {invoice.invoiceReference && (
          <p className="text-sm wrap-anywhere text-ink-soft">
            Reference {invoice.invoiceReference}
          </p>
        )}
      </header>

      <div className="grid gap-8 border-b border-rule py-6 sm:grid-cols-2">
        <section aria-labelledby="bill-to">
          <h2 id="bill-to" className="text-sm font-medium text-ink-soft">
            Bill to
          </h2>
          <address className="mt-2 flex flex-col gap-0.5 text-sm not-italic">
            <span className="text-base font-semibold wrap-anywhere text-ink">
              {customer.fullname}
            </span>
            <span className="break-all text-ink">{customer.email}</span>
            {customer.mobileNumber && <span className="text-ink">{customer.mobileNumber}</span>}
            {customer.address && (
              <span className="whitespace-pre-line wrap-anywhere text-ink">{customer.address}</span>
            )}
          </address>
        </section>

        <section aria-labelledby="invoice-details">
          <h2 id="invoice-details" className="sr-only">
            Invoice details
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm tabular-nums sm:justify-self-end">
            <DetailRow term="Invoice date">{formatDate(invoice.invoiceDate)}</DetailRow>
            <DetailRow term="Due date">{formatDate(invoice.dueDate)}</DetailRow>
            <DetailRow term="Currency">
              {invoice.currency} ({invoice.currencySymbol})
            </DetailRow>
            <DetailRow term="Created">{formatTimestamp(invoice.createdAt)}</DetailRow>
          </dl>
        </section>
      </div>

      {invoice.description && (
        <p className="border-b border-rule py-5 text-sm whitespace-pre-line wrap-anywhere text-ink">
          {invoice.description}
        </p>
      )}

      <section aria-labelledby="line-items" className="py-6">
        <h2 id="line-items" className="sr-only">
          Line items
        </h2>
        <table className="w-full text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b border-ink text-xs text-ink-soft">
              <th scope="col" className="py-2 pr-4 font-medium">
                Item
              </th>
              <th scope="col" className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                Qty
              </th>
              <th scope="col" className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                Rate
              </th>
              <th scope="col" className="py-2 pl-4 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 pr-4 wrap-anywhere text-ink">
                  {item.name}
                  <span className="mt-0.5 block text-xs text-ink-soft sm:hidden">
                    {item.quantity} × {money(item.rate)}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right text-ink sm:table-cell">
                  {item.quantity}
                </td>
                <td className="hidden px-4 py-3 text-right whitespace-nowrap text-ink sm:table-cell">
                  {money(item.rate)}
                </td>
                <td className="py-3 pl-4 text-right font-medium whitespace-nowrap text-ink">
                  {money(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="totals" className="flex justify-end">
        <h2 id="totals" className="sr-only">
          Totals
        </h2>
        <dl className="grid w-full grid-cols-[1fr_auto] gap-x-8 text-sm tabular-nums sm:w-auto sm:min-w-80">
          <TotalRow term="Subtotal">{money(invoice.invoiceSubTotal)}</TotalRow>
          <TotalRow term={`Tax (${formatPercent(invoice.taxPercent)})`}>
            {money(invoice.totalTax)}
          </TotalRow>
          <TotalRow term="Discount">
            {formatDeduction(invoice.totalDiscount, invoice.currencySymbol)}
          </TotalRow>
          <TotalRow term="Total" strong>
            {money(invoice.totalAmount)}
          </TotalRow>
          <TotalRow term="Paid">
            {formatDeduction(invoice.totalPaid, invoice.currencySymbol)}
          </TotalRow>
          <TotalRow term="Balance due" emphasis>
            {money(invoice.balanceAmount)}
          </TotalRow>
        </dl>
      </section>
    </article>
  );
}

function DetailRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-soft">{term}</dt>
      <dd className="text-right text-ink sm:text-left">{children}</dd>
    </>
  );
}

function TotalRow({
  term,
  children,
  strong,
  emphasis,
}: {
  term: string;
  children: ReactNode;
  strong?: boolean;
  emphasis?: boolean;
}) {
  return (
    // One subgrid row per total, so a rule spans both columns without a gap.
    <div
      className={cn(
        'col-span-2 grid grid-cols-subgrid py-1',
        (strong || emphasis) && 'mt-1 border-t pt-2.5',
        strong && 'border-rule font-semibold',
        emphasis && 'border-ink',
      )}
    >
      <dt
        className={cn(
          'text-ink-soft',
          (strong || emphasis) && 'text-ink',
          emphasis && 'self-center text-base font-semibold',
        )}
      >
        {term}
      </dt>
      <dd className={cn('text-right wrap-anywhere text-ink', emphasis && 'font-display text-xl')}>
        {children}
      </dd>
    </div>
  );
}
