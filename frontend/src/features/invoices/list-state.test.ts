import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIST_STATE,
  getPageItems,
  hasActiveFilters,
  isDateRangeInverted,
  parseListState,
  serializeListState,
  toApiParams,
  updateListState,
} from './list-state';

const parse = (search: string) => parseListState(new URLSearchParams(search));

describe('parseListState', () => {
  it('uses defaults for an empty URL', () => {
    expect(parse('')).toEqual(DEFAULT_LIST_STATE);
    expect(DEFAULT_LIST_STATE).toMatchObject({
      sortBy: 'invoiceDate',
      ordering: 'DESC',
      page: 1,
      pageSize: 10,
    });
  });

  it('reads every supported parameter', () => {
    expect(
      parse(
        'keyword=paul&status=Overdue&sortBy=totalAmount&ordering=ASC&page=3&pageSize=50&fromDate=2026-06-01&toDate=2026-06-30',
      ),
    ).toEqual({
      keyword: 'paul',
      status: 'Overdue',
      sortBy: 'totalAmount',
      ordering: 'ASC',
      page: 3,
      pageSize: 50,
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });
  });

  it('accepts status and ordering in any case', () => {
    expect(parse('status=paid&ordering=asc')).toMatchObject({ status: 'Paid', ordering: 'ASC' });
  });

  it('falls back to defaults for invalid values', () => {
    expect(
      parse(
        'status=Lost&sortBy=customer&ordering=up&page=0&pageSize=15&fromDate=2026-02-30&toDate=soon',
      ),
    ).toEqual(DEFAULT_LIST_STATE);
    expect(parse('page=-2')).toMatchObject({ page: 1 });
    expect(parse('page=2.5')).toMatchObject({ page: 1 });
  });

  it('trims the keyword and caps its length', () => {
    expect(parse('keyword=%20%20IV178%20').keyword).toBe('IV178');
    expect(parse(`keyword=${'a'.repeat(150)}`).keyword).toHaveLength(100);
  });

  it('keeps an edited URL within what the API accepts', () => {
    expect(parse('page=200000')).toMatchObject({ page: 100000 });
    expect(parse('keyword=%00IV%7F178').keyword).toBe('IV178');
  });
});

describe('serializeListState', () => {
  it('omits defaults', () => {
    expect(serializeListState(DEFAULT_LIST_STATE).toString()).toBe('');
  });

  it('round-trips through the URL', () => {
    const state = parse(
      'keyword=paul&status=Paid&sortBy=dueDate&ordering=ASC&page=2&pageSize=20&fromDate=2026-01-01&toDate=2026-12-31',
    );
    expect(parseListState(serializeListState(state))).toEqual(state);
  });
});

describe('updateListState', () => {
  it('goes back to page 1 when anything but the page changes', () => {
    const onPage3 = { ...DEFAULT_LIST_STATE, page: 3 };
    expect(updateListState(onPage3, { status: 'Paid' })).toMatchObject({ status: 'Paid', page: 1 });
    expect(updateListState(onPage3, { pageSize: 50 })).toMatchObject({ pageSize: 50, page: 1 });
  });

  it('keeps an explicit page change', () => {
    expect(updateListState(DEFAULT_LIST_STATE, { page: 4 })).toMatchObject({ page: 4 });
  });
});

describe('toApiParams', () => {
  it('always sends paging and sorting, and only the filters that are set', () => {
    expect(toApiParams(DEFAULT_LIST_STATE)).toEqual({
      page: 1,
      pageSize: 10,
      sortBy: 'invoiceDate',
      ordering: 'DESC',
      status: undefined,
      keyword: undefined,
      fromDate: undefined,
      toDate: undefined,
    });
    expect(toApiParams(parse('keyword=paul&status=Draft'))).toMatchObject({
      keyword: 'paul',
      status: 'Draft',
    });
  });
});

describe('filters', () => {
  it('knows when any filter is active', () => {
    expect(hasActiveFilters(DEFAULT_LIST_STATE)).toBe(false);
    expect(hasActiveFilters(parse('sortBy=dueDate&page=2'))).toBe(false);
    expect(hasActiveFilters(parse('keyword=a'))).toBe(true);
    expect(hasActiveFilters(parse('toDate=2026-01-01'))).toBe(true);
  });

  it('detects a start date after the end date', () => {
    expect(isDateRangeInverted(parse('fromDate=2026-07-01&toDate=2026-06-30'))).toBe(true);
    expect(isDateRangeInverted(parse('fromDate=2026-06-30&toDate=2026-06-30'))).toBe(false);
    expect(isDateRangeInverted(parse('fromDate=2026-07-01'))).toBe(false);
  });
});

describe('getPageItems', () => {
  it('lists every page when there are few', () => {
    expect(getPageItems(1, 1)).toEqual([1]);
    expect(getPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses runs of pages into gaps', () => {
    expect(getPageItems(1, 12)).toEqual([1, 2, 3, 4, 5, 'gap', 12]);
    expect(getPageItems(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(getPageItems(12, 12)).toEqual([1, 'gap', 8, 9, 10, 11, 12]);
  });
});
