import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Invoice, InvoiceSortField } from '@/lib/api-types';
import { cn } from '@/lib/cn';
import { formatDate, formatMoney } from '@/lib/format';
import { SORT_LABELS, type InvoiceListState } from '../list-state';
import { StatusBadge } from './StatusBadge';

export interface InvoiceLinkState {
  listSearch: string;
}

interface InvoiceResultsProps {
  invoices: Invoice[];
  state: InvoiceListState;
  linkState: InvoiceLinkState;
  onSort: (field: InvoiceSortField) => void;
}

export function InvoiceResults(props: InvoiceResultsProps) {
  return (
    <>
      <InvoiceTable {...props} />
      <InvoiceRows invoices={props.invoices} linkState={props.linkState} />
    </>
  );
}

function InvoiceTable({ invoices, state, linkState, onSort }: InvoiceResultsProps) {
  const navigate = useNavigate();

  const openRow = (event: MouseEvent<HTMLTableRowElement>, invoice: Invoice) => {
    // Let real links and text selection behave normally.
    if ((event.target as HTMLElement).closest('a, button')) return;
    if (window.getSelection()?.toString()) return;
    void navigate(`/invoices/${invoice.invoiceId}`, { state: linkState });
  };

  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="sr-only">
          Invoices, sorted by {SORT_LABELS[state.sortBy].toLowerCase()},{' '}
          {state.ordering === 'ASC' ? 'ascending' : 'descending'}
        </caption>
        <thead>
          <tr className="border-b border-rule text-xs text-ink-soft">
            <th scope="col" className="px-4 py-3 font-medium">
              Invoice number
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Customer
            </th>
            <SortableHeader field="invoiceDate" state={state} onSort={onSort} />
            <SortableHeader field="dueDate" state={state} onSort={onSort} />
            <SortableHeader field="totalAmount" state={state} onSort={onSort} align="right" />
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {invoices.map((invoice) => (
            <tr
              key={invoice.invoiceId}
              onClick={(event) => openRow(event, invoice)}
              className="cursor-pointer transition-colors hover:bg-[#f4f6f9]"
            >
              <td className="px-4 py-3.5">
                <Link
                  to={`/invoices/${invoice.invoiceId}`}
                  state={linkState}
                  className="font-semibold text-ink underline-offset-4 hover:text-pen hover:underline"
                >
                  {invoice.invoiceNumber}
                </Link>
              </td>
              <td className="max-w-64 px-4 py-3.5">
                <p className="truncate font-medium text-ink">{invoice.customer.fullname}</p>
                <p className="truncate text-xs text-ink-soft">{invoice.customer.email}</p>
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-ink">
                {formatDate(invoice.invoiceDate)}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-ink">
                {formatDate(invoice.dueDate)}
              </td>
              <td className="px-4 py-3.5 text-right font-semibold whitespace-nowrap text-ink">
                {formatMoney(invoice.totalAmount, invoice.currencySymbol)}
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge status={invoice.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  field,
  state,
  onSort,
  align = 'left',
}: {
  field: InvoiceSortField;
  state: InvoiceListState;
  onSort: (field: InvoiceSortField) => void;
  align?: 'left' | 'right';
}) {
  const active = state.sortBy === field;
  const Icon = !active ? ArrowUpDown : state.ordering === 'ASC' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (state.ordering === 'ASC' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-2 py-1.5 font-medium', align === 'right' && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1.5 rounded-control px-2 hover:bg-desk hover:text-ink',
          active && 'text-ink',
          align === 'right' && 'flex-row-reverse',
        )}
      >
        {SORT_LABELS[field]}
        <Icon aria-hidden="true" className={cn('size-3.5', !active && 'opacity-50')} />
      </button>
    </th>
  );
}

function InvoiceRows({
  invoices,
  linkState,
}: {
  invoices: Invoice[];
  linkState: InvoiceLinkState;
}) {
  return (
    <ul className="divide-y divide-rule lg:hidden">
      {invoices.map((invoice) => (
        <li key={invoice.invoiceId}>
          <Link
            to={`/invoices/${invoice.invoiceId}`}
            state={linkState}
            className="flex flex-col gap-2 px-4 py-4 active:bg-desk"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-semibold break-all text-ink">
                {invoice.invoiceNumber}
              </span>
              <StatusBadge status={invoice.status} />
            </span>
            <span className="flex items-end justify-between gap-4">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-ink">{invoice.customer.fullname}</span>
                <span className="text-xs text-ink-soft tabular-nums">
                  Issued {formatDate(invoice.invoiceDate)}
                </span>
                <span className="text-xs text-ink-soft tabular-nums">
                  Due {formatDate(invoice.dueDate)}
                </span>
              </span>
              <span className="shrink-0 text-base font-semibold text-ink tabular-nums">
                {formatMoney(invoice.totalAmount, invoice.currencySymbol)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
