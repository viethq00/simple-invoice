import { FilePlus2, SearchX } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Alert, Skeleton, Spinner } from '@/components/ui/feedback';
import type { InvoiceSortField } from '@/lib/api-types';
import { describeError } from '@/lib/errors';
import { InvoiceFilters } from './components/InvoiceFilters';
import { InvoiceResults, type InvoiceLinkState } from './components/InvoiceResults';
import { Pagination } from './components/Pagination';
import { useInvoiceList } from './invoice-api';
import {
  DEFAULT_LIST_STATE,
  hasActiveFilters,
  isDateRangeInverted,
  parseListState,
  serializeListState,
  toApiParams,
  updateListState,
  type InvoiceListState,
} from './list-state';

export function InvoiceListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const state = useMemo(() => parseListState(searchParams), [searchParams]);
  const dateRangeInverted = isDateRangeInverted(state);
  const params = useMemo(() => toApiParams(state), [state]);
  const list = useInvoiceList(params, { enabled: !dateRangeInverted });

  // Router updates render in a transition, so searchParams can lag behind a change just
  // made. Building on the latest params keeps a debounced search from undoing it.
  const latestSearchParams = useRef(searchParams);
  useLayoutEffect(() => {
    latestSearchParams.current = searchParams;
  }, [searchParams]);

  const applyChange = useCallback(
    (patch: Partial<InvoiceListState>, options: { replace?: boolean } = {}) => {
      const next = serializeListState(
        updateListState(parseListState(latestSearchParams.current), patch),
      );
      latestSearchParams.current = next;
      setSearchParams(next, { replace: options.replace });
    },
    [setSearchParams],
  );

  // Remounting the filters on Clear also cancels a search still being typed.
  const [filtersKey, setFiltersKey] = useState(0);
  const clearFilters = () => {
    setFiltersKey((key) => key + 1);
    applyChange({ keyword: '', status: undefined, fromDate: undefined, toDate: undefined });
  };

  const sortBy = (field: InvoiceSortField) =>
    applyChange(
      field === state.sortBy
        ? { ordering: state.ordering === 'ASC' ? 'DESC' : 'ASC' }
        : { sortBy: field, ordering: DEFAULT_LIST_STATE.ordering },
    );

  const invoices = list.data?.data ?? [];
  const paging = list.data?.paging;
  const total = paging?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const isSettled = list.isSuccess && !list.isPlaceholderData;
  // Past the last page the API returns no rows. Show loading until the redirect lands.
  const isLoading = list.isPending || (list.isSuccess && invoices.length === 0 && total > 0);

  useEffect(() => {
    if (isSettled && state.page > totalPages) applyChange({ page: totalPages }, { replace: true });
  }, [isSettled, state.page, totalPages, applyChange]);

  const linkState: InvoiceLinkState = { listSearch: location.search };
  // From the response, because the previous rows stay on screen while a page loads.
  const firstRow = paging ? (paging.page - 1) * paging.pageSize + 1 : 0;
  const lastRow = firstRow + invoices.length - 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        description="Search, filter and open any invoice."
        actions={
          <ButtonLink to="/invoices/new" state={linkState}>
            <FilePlus2 aria-hidden="true" className="size-4" />
            New invoice
          </ButtonLink>
        }
      />

      <InvoiceFilters
        key={filtersKey}
        state={state}
        onChange={applyChange}
        onClear={clearFilters}
        dateRangeInverted={dateRangeInverted}
      />

      <section
        aria-labelledby="results-summary"
        aria-busy={list.isFetching || undefined}
        className="rounded-sheet border border-rule bg-paper shadow-paper-sm"
      >
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-rule px-4 py-3">
          <p id="results-summary" aria-live="polite" className="text-sm text-ink-soft tabular-nums">
            {dateRangeInverted
              ? 'Fix the invoice date range to see results.'
              : isLoading
                ? 'Loading invoices…'
                : list.isError
                  ? 'Invoices could not be loaded.'
                  : total === 0
                    ? 'No invoices to show.'
                    : `Showing ${firstRow}–${lastRow} of ${total} ${total === 1 ? 'invoice' : 'invoices'}`}
          </p>
          {list.isFetching && !isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-ink-soft">
              <Spinner className="size-3.5" />
              Updating
            </span>
          )}
        </div>

        {dateRangeInverted ? null : isLoading ? (
          <ResultsSkeleton />
        ) : list.isError ? (
          <div className="p-4">
            <Alert
              tone="error"
              title="We couldn't load invoices"
              action={
                <Button variant="secondary" size="sm" onClick={() => void list.refetch()}>
                  Retry
                </Button>
              }
            >
              {describeError(list.error)}
            </Alert>
          </div>
        ) : invoices.length === 0 ? (
          <EmptyResults filtered={hasActiveFilters(state)} onClear={clearFilters} />
        ) : (
          <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <InvoiceResults
              invoices={invoices}
              state={state}
              linkState={linkState}
              onSort={sortBy}
            />
            <Pagination
              page={Math.min(state.page, totalPages)}
              totalPages={totalPages}
              pageSize={state.pageSize}
              onPageChange={(page) => applyChange({ page })}
              onPageSizeChange={(pageSize) => applyChange({ pageSize })}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <ul aria-hidden="true" className="divide-y divide-rule">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="flex items-center gap-6 px-4 py-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="h-4 w-20" />
        </li>
      ))}
    </ul>
  );
}

function EmptyResults({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <SearchX aria-hidden="true" className="size-8 text-ink-soft" />
      {filtered ? (
        <>
          <p className="font-medium text-ink">No invoices match these filters.</p>
          <p className="text-sm text-ink-soft">Try another search, status or date range.</p>
          <Button variant="secondary" onClick={onClear} className="mt-2">
            Clear filters
          </Button>
        </>
      ) : (
        <>
          <p className="font-medium text-ink">There are no invoices yet.</p>
          <p className="text-sm text-ink-soft">Create your first invoice to see it here.</p>
          <ButtonLink to="/invoices/new" className="mt-2">
            Create invoice
          </ButtonLink>
        </>
      )}
    </div>
  );
}
