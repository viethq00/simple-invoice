import type { OpenAPIObject } from '@nestjs/swagger';
import { apiSpecDoc } from './api-spec';

const json = (schema: object) => ({ description: '', content: { 'application/json': { schema } } });

const document = {
  openapi: '3.0.0',
  info: { title: 'Shop API', version: '2.0.0' },
  paths: {
    '/orders': {
      get: {
        operationId: 'OrdersController_list',
        summary: 'List orders',
        tags: ['Orders'],
        security: [{ bearer: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            description: 'Only this status.',
            schema: { type: 'string', enum: ['Open', 'Paid'] },
          },
        ],
        responses: {
          '200': json({ type: 'array', items: { $ref: '#/components/schemas/OrderDto' } }),
          '401': { description: 'Not signed in.' },
        },
      },
    },
    '/health': {
      get: {
        operationId: 'HealthController_check',
        summary: 'Health',
        tags: ['Health'],
        responses: { '200': json({ type: 'object', properties: { status: { type: 'string' } } }) },
      },
    },
    '/docs': {
      get: {
        operationId: 'HealthController_docs',
        summary: 'Docs',
        tags: ['Health'],
        responses: { '302': { description: 'To the docs.' } },
      },
    },
  },
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      OrderDto: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['Open', 'Paid'] },
          lines: { type: 'array', items: { $ref: '#/components/schemas/LineDto' } },
          note: { type: 'string', nullable: true },
          gift: {
            type: 'array',
            items: { $ref: '#/components/schemas/LineDto' },
            minItems: 1,
            maxItems: 1,
          },
        },
        required: ['id', 'status', 'lines', 'note'],
      },
      LineDto: { type: 'object', properties: { sku: { type: 'string' } } },
    },
  },
} as unknown as OpenAPIObject;

describe('apiSpecDoc', () => {
  const doc = apiSpecDoc(document);
  const section = (heading: string) => doc.sections.find((s) => s.heading === heading)?.body ?? '';

  it('has an authentication section, one section per tag and the schemas', () => {
    expect(doc.intro).toContain('Shop API 2.0.0');
    expect(doc.sections.map((s) => s.heading)).toEqual([
      'Authentication',
      'Orders endpoints',
      'Health endpoints',
      'Schemas',
    ]);
    expect(section('Authentication')).toContain(
      '| `bearer` | `Authorization: Bearer <JWT>` header |',
    );
  });

  it('draws each endpoint between its inputs and its response', () => {
    const body = section('Orders endpoints');
    expect(body).toContain('  OrdersController_list["GET /orders<br/>List orders<br/>signed in"]');
    expect(body).toContain('  OrdersController_list_query[/"query<br/>page, status"/]');
    expect(body).toContain('  OrdersController_list_query --> OrdersController_list');
    expect(body).toContain('  OrdersController_list -->|200| OrdersController_list_response_body');
    expect(body).toContain(
      '| `GET /orders` | List orders | signed in | query `page`, `status` | 200 `OrderDto[]`<br>401 Not signed in. |',
    );
  });

  it('lists parameters with their defaults and rules', () => {
    const body = section('Orders endpoints');
    expect(body).toContain(
      '| `GET /orders` | `page` | query | integer | no | `1` |  | At least 1 |',
    );
    expect(body).toContain(
      '| `GET /orders` | `status` | query | string | no |  | Only this status. | One of `Open`, `Paid` |',
    );
  });

  it('labels an inline response by its fields and leaves out the parameter table when empty', () => {
    const body = section('Health endpoints');
    expect(body).toContain('  HealthController_check_response_body[/"#123; status #125;"/]');
    expect(body).toContain('| `GET /health` | Health | public |  | 200 `{ status }` |');
    expect(body).not.toContain('| Parameter |');
  });

  it('draws a redirect-only endpoint with its 3xx as the outcome', () => {
    const body = section('Health endpoints');
    expect(body).toContain('  HealthController_docs -->|302| HealthController_docs_response_empty');
    expect(body).toContain('| `GET /docs` | Docs | public |  | 302 no body |');
  });

  it('draws the schemas as classes, with enums and relations', () => {
    const body = section('Schemas');
    for (const line of [
      '  class OrderDto {',
      '    +id: uuid',
      '    +status: Status',
      '    +lines: LineDto[]',
      '    +note: string or null',
      '  class LineDto {',
      '    +sku?: string',
      '  class Status {',
      '    <<enumeration>>',
      '    Open',
      '  OrderDto ..> Status',
      '  OrderDto --> "*" LineDto : lines',
      '  OrderDto --> "1" LineDto : gift',
    ]) {
      expect(body).toContain(line);
    }
  });
});
