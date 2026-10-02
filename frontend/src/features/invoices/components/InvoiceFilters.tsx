import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from 'lucide-react';
import { useEffect, useState, type ComponentProps, type FormEvent } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/controls';
import type { InvoiceSortField, SortOrder } from '@/lib/api-types';
import { cn } from '@/lib/cn';
import { isIsoDate } from '@/lib/format';
import {
  hasActiveFilters,
  normalizeKeyword,
  SORT_FIELDS,
  SORT_LABELS,
  STATUSES,
  type InvoiceListState,
} from '../list-state';

export const SEARCH_DEBOUNCE_MS = 300;
const FULL_YEAR_DATE = /^[1-9]\d{3}-/;

const DIRECTION_LABELS: Record<InvoiceSortField, Record<SortOrder, string>> = {
  invoiceDate: { DESC: 'Newest first', ASC: 'Oldest first' },
  dueDate: { DESC: 'Latest first', ASC: 'Soonest first' },
  totalAmount: { DESC: 'Highest first', ASC: 'Lowest first' },
};

interface InvoiceFiltersProps {
  state: InvoiceListState;
  onChange: (patch: Partial<InvoiceListState>, options?: { replace?: boolean }) => void;
  onClear: () => void;
  dateRangeInverted: boolean;
}

export function InvoiceFilters({
  state,
  onChange,
  onClear,
  dateRangeInverted,
}: InvoiceFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <KeywordSearch keyword={state.keyword} onSearch={onChange} />
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 sm:w-52 sm:flex-none">
            <label htmlFor="sort-by" className="sr-only">
              Sort by
            </label>
            <Select
              id="sort-by"
              value={state.sortBy}
              onChange={(event) => onChange({ sortBy: event.target.value as InvoiceSortField })}
            >
              {SORT_FIELDS.map((field) => (
                <option key={field} value={field}>
                  Sort by {SORT_LABELS[field].toLowerCase()}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            aria-label={`Sort order: ${DIRECTION_LABELS[state.sortBy][state.ordering]}`}
            onClick={() => onChange({ ordering: state.ordering === 'ASC' ? 'DESC' : 'ASC' })}
          >
            {state.ordering === 'ASC' ? (
              <ArrowUpNarrowWide aria-hidden="true" className="size-4" />
            ) : (
              <ArrowDownWideNarrow aria-hidden="true" className="size-4" />
            )}
            {DIRECTION_LABELS[state.sortBy][state.ordering]}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <StatusFilter value={state.status} onChange={(status) => onChange({ status })} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <DateRange
            fromDate={state.fromDate}
            toDate={state.toDate}
            inverted={dateRangeInverted}
            onChange={onChange}
          />
          {hasActiveFilters(state) && (
            <Button variant="ghost" onClick={onClear} className="self-start sm:self-auto">
              <X aria-hidden="true" className="size-4" />
              Clear filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function KeywordSearch({
  keyword,
  onSearch,
}: {
  keyword: string;
  onSearch: InvoiceFiltersProps['onChange'];
}) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [value, setValue] = useState(keyword);
  const [synced, setSynced] = useState({ keyword, locationKey: location.key });

  if (location.key !== synced.locationKey) {
    setSynced({ keyword, locationKey: location.key });
    // Back/Forward shows that entry's keyword and drops unsent typing. Other changes only
    // replace the text if nothing was typed since the last sync, so no keystroke is lost.
    const showUrlKeyword =
      navigationType === NavigationType.Pop
        ? normalizeKeyword(value) !== keyword
        : keyword !== synced.keyword && normalizeKeyword(value) === synced.keyword;
    if (showUrlKeyword) setValue(keyword);
  }

  // Re-armed on every URL change, so the search lands on top of changes made meanwhile.
  useEffect(() => {
    const next = normalizeKeyword(value);
    if (next === keyword) return;
    const timer = window.setTimeout(
      () => onSearch({ keyword: next }, { replace: true }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [value, keyword, onSearch]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const next = normalizeKeyword(value);
    if (next !== keyword) onSearch({ keyword: next }, { replace: true });
  };

  return (
    <form role="search" onSubmit={handleSubmit} className="relative min-w-0 flex-1">
      <label htmlFor="invoice-search" className="sr-only">
        Search invoices
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft"
      />
      <Input
        id="invoice-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by invoice number or customer"
        autoComplete="off"
        maxLength={100}
        className="pl-9"
      />
    </form>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: InvoiceListState['status'];
  onChange: (status: InvoiceListState['status']) => void;
}) {
  const options = [undefined, ...STATUSES];
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium text-ink">Status</legend>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="inline-flex rounded-control border border-rule-strong bg-paper p-0.5">
          {options.map((status) => {
            const checked = status === value;
            return (
              <label
                key={status ?? 'all'}
                className={cn(
                  'relative flex min-h-10 cursor-pointer items-center rounded-[4px] px-3.5 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-9',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-pen',
                  checked ? 'bg-pen text-white' : 'text-ink-soft hover:bg-desk hover:text-ink',
                )}
              >
                <input
                  type="radio"
                  name="status"
                  value={status ?? ''}
                  checked={checked}
                  onChange={() => onChange(status)}
                  className="sr-only"
                />
                {status ?? 'All'}
              </label>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

function DateRange({
  fromDate,
  toDate,
  inverted,
  onChange,
}: {
  fromDate?: string;
  toDate?: string;
  inverted: boolean;
  onChange: InvoiceFiltersProps['onChange'];
}) {
  return (
    <fieldset aria-describedby={inverted ? 'date-range-error' : undefined} className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium text-ink">Invoice date</legend>
      <div className="flex items-center gap-2">
        <label htmlFor="from-date" className="sr-only">
          From
        </label>
        <DateInput
          id="from-date"
          value={fromDate}
          max={toDate}
          aria-invalid={inverted || undefined}
          onDateChange={(date) => onChange({ fromDate: date })}
        />
        <span aria-hidden="true" className="text-ink-soft">
          to
        </span>
        <label htmlFor="to-date" className="sr-only">
          To
        </label>
        <DateInput
          id="to-date"
          value={toDate}
          min={fromDate}
          aria-invalid={inverted || undefined}
          onDateChange={(date) => onChange({ toDate: date })}
        />
      </div>
      {inverted && (
        <p id="date-range-error" className="mt-1.5 text-xs font-medium text-overdue-ink">
          The start date must be on or before the end date.
        </p>
      )}
    </fieldset>
  );
}

// Chrome reports a date after each digit of the year (0002, 0020, 0202, 2026). The field
// keeps what was typed and passes on only full dates, so a partial year never reaches the URL.
function DateInput({
  value,
  onDateChange,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  value?: string;
  onDateChange: (date: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [synced, setSynced] = useState(value);

  // Back/Forward and Clear filters change the date from outside.
  if (value !== synced) {
    setSynced(value);
    setDraft(value ?? '');
  }

  return (
    <Input
      {...props}
      type="date"
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (!next) {
          if (value) onDateChange(undefined);
        } else if (FULL_YEAR_DATE.test(next) && isIsoDate(next) && next !== value) {
          onDateChange(next);
        }
      }}
      className="min-w-0 flex-1 px-2 sm:w-40 sm:flex-none sm:px-3"
    />
  );
}
