import type {
  InvoiceListParams,
  InvoiceSortField,
  InvoiceStatus,
  SortOrder,
} from '@/lib/api-types';
import { isIsoDate } from '@/lib/format';

export interface InvoiceListState {
  keyword: string;
  status?: InvoiceStatus;
  sortBy: InvoiceSortField;
  ordering: SortOrder;
  page: number;
  pageSize: PageSize;
  fromDate?: string;
  toDate?: string;
}

export const STATUSES: readonly InvoiceStatus[] = ['Draft', 'Pending', 'Paid', 'Overdue'];
export const SORT_FIELDS: readonly InvoiceSortField[] = ['invoiceDate', 'dueDate', 'totalAmount'];
export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const SORT_LABELS: Record<InvoiceSortField, string> = {
  invoiceDate: 'Invoice date',
  dueDate: 'Due date',
  totalAmount: 'Total amount',
};

export const DEFAULT_LIST_STATE: InvoiceListState = {
  keyword: '',
  sortBy: 'invoiceDate',
  ordering: 'DESC',
  page: 1,
  pageSize: 10,
};

const MAX_KEYWORD_LENGTH = 100;
// The API's limits. A URL edited past them falls back to something the API accepts.
const MAX_PAGE = 100_000;
const CONTROL_CHARACTERS = /(?![\t\n\r])\p{Cc}/gu;

export function normalizeKeyword(value: string): string {
  return value.replace(CONTROL_CHARACTERS, '').trim().slice(0, MAX_KEYWORD_LENGTH);
}

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  return allowed.find((option) => option.toLowerCase() === lower);
}

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : undefined;
}

function isoDate(value: string | null): string | undefined {
  return value && isIsoDate(value) ? value : undefined;
}

export function parseListState(params: URLSearchParams): InvoiceListState {
  const pageSize = positiveInt(params.get('pageSize'));
  return {
    keyword: normalizeKeyword(params.get('keyword') ?? ''),
    status: pick(params.get('status'), STATUSES),
    sortBy: pick(params.get('sortBy'), SORT_FIELDS) ?? DEFAULT_LIST_STATE.sortBy,
    ordering: pick(params.get('ordering'), ['ASC', 'DESC'] as const) ?? DEFAULT_LIST_STATE.ordering,
    page: Math.min(positiveInt(params.get('page')) ?? DEFAULT_LIST_STATE.page, MAX_PAGE),
    pageSize: PAGE_SIZES.find((size) => size === pageSize) ?? DEFAULT_LIST_STATE.pageSize,
    fromDate: isoDate(params.get('fromDate')),
    toDate: isoDate(params.get('toDate')),
  };
}

export function serializeListState(state: InvoiceListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.keyword) params.set('keyword', state.keyword);
  if (state.status) params.set('status', state.status);
  if (state.sortBy !== DEFAULT_LIST_STATE.sortBy) params.set('sortBy', state.sortBy);
  if (state.ordering !== DEFAULT_LIST_STATE.ordering) params.set('ordering', state.ordering);
  if (state.fromDate) params.set('fromDate', state.fromDate);
  if (state.toDate) params.set('toDate', state.toDate);
  if (state.pageSize !== DEFAULT_LIST_STATE.pageSize)
    params.set('pageSize', String(state.pageSize));
  if (state.page !== DEFAULT_LIST_STATE.page) params.set('page', String(state.page));
  return params;
}

export function updateListState(
  state: InvoiceListState,
  patch: Partial<InvoiceListState>,
): InvoiceListState {
  return { ...state, ...patch, page: patch.page ?? 1 };
}

export function toApiParams(state: InvoiceListState): InvoiceListParams {
  return {
    page: state.page,
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    ordering: state.ordering,
    status: state.status,
    keyword: state.keyword || undefined,
    fromDate: state.fromDate,
    toDate: state.toDate,
  };
}

export function hasActiveFilters(state: InvoiceListState): boolean {
  return Boolean(state.keyword || state.status || state.fromDate || state.toDate);
}

export function isDateRangeInverted(state: InvoiceListState): boolean {
  return Boolean(state.fromDate && state.toDate && state.fromDate > state.toDate);
}

export type PageItem = number | 'gap';

// getPageItems(6, 12) -> [1, 'gap', 5, 6, 7, 'gap', 12]
export function getPageItems(current: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, current - 1, current, current + 1]);
  if (current <= 4) [2, 3, 4, 5].forEach((page) => pages.add(page));
  if (current >= totalPages - 3)
    [0, 1, 2, 3].forEach((offset) => pages.add(totalPages - 1 - offset));

  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: PageItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) items.push('gap');
    items.push(page);
  });
  return items;
}
