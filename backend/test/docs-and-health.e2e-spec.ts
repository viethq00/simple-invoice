import request from 'supertest';
import { createTestApp, type TestContext } from './utils/test-app';

interface OpenApiOperation {
  parameters?: { name: string; in: string }[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
  security?: Record<string, unknown>[];
}
type OpenApiDocument = {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: { securitySchemes: Record<string, unknown>; schemas: Record<string, unknown> };
};

describe('API documentation and health (e2e)', () => {
  let ctx: TestContext;
  let document: OpenApiDocument;

  beforeAll(async () => {
    ctx = await createTestApp();
    document = (await request(ctx.server).get('/api/docs-json').expect(200))
      .body as OpenApiDocument;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('serves Swagger UI at /api/docs', async () => {
    const response = await request(ctx.server).get('/api/docs').expect(200);
    expect(response.text).toContain('swagger-ui');
  });

  it('documents every endpoint with its status codes', () => {
    const responses = (path: string, method: string) =>
      Object.keys(document.paths[path]?.[method]?.responses ?? {}).sort();
    expect(responses('/auth/login', 'post')).toEqual(['200', '400', '401', '429']);
    expect(responses('/auth/me', 'get')).toEqual(['200', '401']);
    expect(responses('/auth/logout', 'post')).toEqual(['204']);
    expect(responses('/invoices', 'get')).toEqual(['200', '400', '401']);
    expect(responses('/invoices', 'post')).toEqual(['201', '400', '401', '409']);
    expect(responses('/invoices/{id}', 'get')).toEqual(['200', '400', '401', '404']);
  });

  it('documents the list query parameters', () => {
    const names = document.paths['/invoices'].get.parameters?.map((parameter) => parameter.name);
    expect(names?.sort()).toEqual(
      ['fromDate', 'keyword', 'ordering', 'page', 'pageSize', 'sortBy', 'status', 'toDate'].sort(),
    );
  });

  it('documents request and response schemas', () => {
    expect(document.paths['/invoices'].post.requestBody).toBeDefined();
    expect(document.paths['/auth/login'].post.requestBody).toBeDefined();
    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining([
        'CreateInvoiceDto',
        'InvoiceResponseDto',
        'InvoiceListResponseDto',
        'ErrorResponseDto',
        'LoginDto',
        'LoginResponseDto',
      ]),
    );
  });

  it('declares bearer and cookie authentication on protected routes', () => {
    expect(Object.keys(document.components.securitySchemes).sort()).toEqual(['bearer', 'cookie']);
    expect(document.paths['/invoices'].get.security).toEqual(
      expect.arrayContaining([{ bearer: [] }, { cookie: [] }]),
    );
  });

  it('reports health without authentication', async () => {
    const response = await request(ctx.server).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers unknown routes with the standard error shape', async () => {
    const response = await request(ctx.server).get('/does-not-exist').expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /does-not-exist',
      error: 'Not Found',
    });
  });
});
