import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { ApiError, apiRequest, buildApiUrl, NETWORK_ERROR_STATUS } from './api-client';
import {
  describeError,
  NETWORK_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
} from './errors';

describe('buildApiUrl', () => {
  it('prefixes the API base and drops empty query values', () => {
    expect(
      buildApiUrl('/invoices', { page: 1, keyword: '', status: undefined, sortBy: 'dueDate' }),
    ).toBe('/api/invoices?page=1&sortBy=dueDate');
  });

  it('encodes query values', () => {
    expect(buildApiUrl('/invoices', { keyword: 'Cedar & Co' })).toBe(
      '/api/invoices?keyword=Cedar+%26+Co',
    );
  });
});

describe('apiRequest', () => {
  it('sends JSON with credentials and returns the parsed body', async () => {
    let seen:
      { credentials: RequestCredentials; contentType: string | null; body: unknown } | undefined;
    server.use(
      http.post('/api/echo', async ({ request }) => {
        seen = {
          credentials: request.credentials,
          contentType: request.headers.get('content-type'),
          body: await request.json(),
        };
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(apiRequest('/echo', { method: 'POST', body: { a: 1 } })).resolves.toEqual({
      ok: true,
    });
    expect(seen).toEqual({
      credentials: 'include',
      contentType: 'application/json',
      body: { a: 1 },
    });
  });

  it('resolves to undefined for 204 responses', async () => {
    server.use(http.post('/api/empty', () => new HttpResponse(null, { status: 204 })));
    await expect(apiRequest('/empty', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('turns an error body into an ApiError with every validation message', async () => {
    server.use(
      http.post('/api/fail', () =>
        HttpResponse.json(
          {
            statusCode: 400,
            message: ['dueDate must be on or after invoiceDate', 'currency must be one of: AUD'],
            error: 'Bad Request',
          },
          { status: 400 },
        ),
      ),
    );

    const error = await apiRequest('/fail', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      error: 'Bad Request',
      messages: ['dueDate must be on or after invoiceDate', 'currency must be one of: AUD'],
      message: 'dueDate must be on or after invoiceDate',
    });
  });

  it('normalises a single error message to a list', async () => {
    server.use(
      http.get('/api/missing', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Invoice not found', error: 'Not Found' },
          { status: 404 },
        ),
      ),
    );
    await expect(apiRequest('/missing')).rejects.toMatchObject({
      status: 404,
      messages: ['Invoice not found'],
    });
  });

  it('still reports the status when the error body is not JSON', async () => {
    server.use(http.get('/api/broken', () => new HttpResponse('Bad gateway', { status: 502 })));
    await expect(apiRequest('/broken')).rejects.toMatchObject({ status: 502, messages: [] });
  });

  it('reports network failures with status 0', async () => {
    server.use(http.get('/api/offline', () => HttpResponse.error()));
    await expect(apiRequest('/offline')).rejects.toMatchObject({ status: NETWORK_ERROR_STATUS });
  });
});

describe('describeError', () => {
  it('explains each kind of failure in one sentence', () => {
    expect(describeError(new ApiError(0, [], 'Network Error'))).toBe(NETWORK_ERROR_MESSAGE);
    expect(
      describeError(new ApiError(500, ['Internal server error'], 'Internal Server Error')),
    ).toBe(SERVER_ERROR_MESSAGE);
    expect(describeError(new ApiError(404, ['Invoice not found'], 'Not Found'))).toBe(
      'Invoice not found',
    );
    expect(describeError(new Error('boom'))).toBe(UNKNOWN_ERROR_MESSAGE);
  });
});
