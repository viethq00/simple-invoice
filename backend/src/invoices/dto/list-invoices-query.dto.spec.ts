import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/validation.pipe';
import { ListInvoicesQueryDto } from './list-invoices-query.dto';

const pipe = createValidationPipe();

const parse = (query: Record<string, unknown>) =>
  pipe.transform(query, {
    type: 'query',
    metatype: ListInvoicesQueryDto,
  }) as Promise<ListInvoicesQueryDto>;

async function messagesFor(query: Record<string, unknown>): Promise<string[]> {
  try {
    await parse(query);
    return [];
  } catch (error) {
    if (!(error instanceof BadRequestException)) throw error;
    return (error.getResponse() as { message: string[] }).message;
  }
}

describe('ListInvoicesQueryDto', () => {
  it('applies defaults', async () => {
    expect({ ...(await parse({})) }).toEqual({
      page: 1,
      pageSize: 10,
      sortBy: 'invoiceDate',
      ordering: 'DESC',
    });
  });

  it('coerces query-string numbers', async () => {
    expect(await parse({ page: '3', pageSize: '25' })).toMatchObject({ page: 3, pageSize: 25 });
  });

  it('matches enum-like values case-insensitively', async () => {
    expect(
      await parse({ ordering: 'asc', status: 'overdue', sortBy: 'TOTALAMOUNT' }),
    ).toMatchObject({ ordering: 'ASC', status: 'Overdue', sortBy: 'totalAmount' });
  });

  it('ignores blank parameters', async () => {
    const query = await parse({ page: '', keyword: '   ', status: '', fromDate: '', toDate: '' });
    expect(query.page).toBe(1);
    expect(query.keyword).toBeUndefined();
    expect(query.status).toBeUndefined();
    expect(query.fromDate).toBeUndefined();
    expect(query.toDate).toBeUndefined();
  });

  it('trims the keyword', async () => {
    expect((await parse({ keyword: '  paul ' })).keyword).toBe('paul');
  });

  it('accepts an inclusive date range', async () => {
    expect(await messagesFor({ fromDate: '2026-01-01', toDate: '2026-01-01' })).toEqual([]);
  });

  it.each([
    [{ page: '0' }, 'page must be a positive integer'],
    [{ page: '-1' }, 'page must be a positive integer'],
    [{ page: 'abc' }, 'page must be a positive integer'],
    [{ page: '1.5' }, 'page must be a positive integer'],
    [{ page: '100001' }, 'page must not exceed 100000'],
    [{ pageSize: '0' }, 'pageSize must be a positive integer'],
    [{ pageSize: '101' }, 'pageSize must not exceed 100'],
    [{ sortBy: 'customerName' }, 'sortBy must be one of: invoiceDate, dueDate, totalAmount'],
    [{ ordering: 'up' }, 'ordering must be one of: ASC, DESC'],
    [{ status: 'Archived' }, 'status must be one of: Draft, Pending, Paid, Overdue'],
    [{ fromDate: '2026-13-01' }, 'fromDate must be a valid date in YYYY-MM-DD format'],
    [{ fromDate: '2026-02-01', toDate: '2026-01-31' }, 'toDate must be on or after fromDate'],
    [{ keyword: 'x'.repeat(101) }, 'keyword must be at most 100 characters'],
    [{ keyword: 'a\u0000b' }, 'keyword must not contain control characters'],
    [{ pageSize: ['5', '50'] }, 'pageSize must be a positive integer'],
    [{ page: ['1', '2'] }, 'page must be a positive integer'],
    [{ status: ['Paid', 'Draft'] }, 'status must be one of: Draft, Pending, Paid, Overdue'],
    [{ sort: 'dueDate' }, 'property sort should not exist'],
  ])('rejects %p', async (query, message) => {
    expect(await messagesFor(query)).toEqual([message]);
  });
});
