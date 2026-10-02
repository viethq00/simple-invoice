import type { OpenAPIObject } from '@nestjs/swagger';
import { shopProgram } from './fixtures/shop-program';
import { sequenceDoc } from './sequences';

const orderBody = {
  description: '',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
};

const document = {
  openapi: '3.0.0',
  info: { title: 'Shop', version: '1' },
  paths: {
    '/orders/{id}': {
      get: {
        operationId: 'OrdersController_findOne',
        responses: {
          '200': orderBody,
          '400': { description: 'Not a UUID.' },
          '401': { description: 'No API key.' },
        },
      },
    },
    '/orders': {
      post: {
        operationId: 'OrdersController_create',
        responses: { '201': { description: '' }, '400': { description: 'Invalid body.' } },
      },
    },
    '/orders/mine': {
      get: {
        operationId: 'OrdersController_mine',
        responses: { '200': { description: '' }, '401': { description: 'Not signed in.' } },
      },
    },
    '/orders/recent': {
      get: {
        operationId: 'OrdersController_recent',
        responses: {
          '200': { description: '' },
          '400': { description: 'Not a number.' },
          '401': { description: 'Not signed in.' },
        },
      },
    },
  },
} as unknown as OpenAPIObject;

const diagram = (body: string) =>
  body.slice(body.indexOf('sequenceDiagram'), body.lastIndexOf('```'));

describe('sequenceDoc', () => {
  const program = shopProgram();
  const sections = sequenceDoc(program, document).sections;

  it('runs the global guard, then the pipes, then follows the calls down to the database', () => {
    expect(sections[0].heading).toBe('GET /orders/{id}');
    expect(sections[0].body).toBe(
      [
        'Handled by `OrdersController.findOne` in `backend/tools/diagrams/fixtures/shop/orders.controller.ts`.',
        '',
        '```mermaid',
        'sequenceDiagram',
        '  actor Client',
        '  participant ApiKeyGuard',
        '  participant Reflector',
        '  participant ParseUUIDPipe',
        '  participant OrdersController',
        '  participant OrdersService',
        '  participant OrdersRepository',
        '  participant DB as Database',
        '  Client->>ApiKeyGuard: GET /orders/#123;id#125;',
        '  ApiKeyGuard->>+Reflector: get(IS_OPEN, ...)',
        '  Reflector-->>-ApiKeyGuard: boolean #124; undefined',
        "  opt !request.headers['x-api-key']",
        '    ApiKeyGuard--xClient: 401 API key required',
        '  end',
        '  ApiKeyGuard->>ParseUUIDPipe: param id',
        '  opt Not a UUID',
        '    ParseUUIDPipe--xClient: 400 Bad Request',
        '  end',
        '  ParseUUIDPipe->>+OrdersController: findOne(id)',
        '  OrdersController->>+OrdersService: findOne(id)',
        '  OrdersService->>+OrdersRepository: find(id)',
        '  OrdersRepository->>+DB: findOneBy() on orders',
        '  DB-->>-OrdersRepository: Order #124; null',
        '  OrdersRepository-->>-OrdersService: Order #124; null',
        '  opt !order',
        '    OrdersService--xClient: 404 Order not found',
        '  end',
        '  OrdersService-->>-OrdersController: Order',
        '  OrdersController-->>-Client: 200 Order',
        '```',
      ].join('\n'),
    );
  });

  it('skips a global guard for a handler whose decorator sets the metadata the guard reads', () => {
    expect(sections[1].body).not.toContain('ApiKeyGuard');
    expect(sections[1].body).toContain('Client->>ValidationPipe: body CreateOrderDto');
  });

  it('draws loops, caught errors and statuses without a message', () => {
    expect(sections[1].body).toContain(
      [
        '  OrdersService->>+OrdersRepository: saveAll(...)',
        '  loop for each in orders',
        '    OrdersRepository->>+DB: save() on orders',
        '    DB-->>-OrdersRepository: Order',
        '  end',
        '  OrdersRepository-->>-OrdersService: void',
        "  opt on error, if error instanceof Error && error.message.includes('duplicate')",
        '    OrdersService--xClient: 409 Conflict',
        '  end',
      ].join('\n'),
    );
    expect(sections[1].body).toContain('OrdersController-->>-Client: 201 Created');
  });

  it('runs a passport strategy only once passport has authenticated the request', () => {
    expect(diagram(sections[2].body)).toBe(
      [
        'sequenceDiagram',
        '  actor Client',
        '  participant SessionGuard as SessionGuard (SessionStrategy)',
        '  participant OrdersController',
        '  Client->>SessionGuard: GET /orders/mine',
        '  SessionGuard->>SessionGuard: passport-jwt authenticates the request',
        '  opt authenticated',
        '    SessionGuard->>SessionGuard: SessionStrategy.validate(payload)',
        '    opt !payload.sub',
        '      SessionGuard--xClient: 401 Token has no subject',
        '    end',
        '  end',
        '  SessionGuard->>SessionGuard: handleRequest(error, user)',
        '  opt error #124;#124; !user',
        '    SessionGuard--xClient: 401 Sign in first',
        '  end',
        '  SessionGuard->>+OrdersController: mine()',
        '  OrdersController-->>-Client: 200 OK',
        '',
      ].join('\n'),
    );
  });

  it('names guards made by a call and generic pipes with ids Mermaid accepts', () => {
    expect(diagram(sections[3].body)).toBe(
      [
        'sequenceDiagram',
        '  actor Client',
        "  participant AuthGuard_session as AuthGuard('session')",
        '  participant DefaultValuePipe',
        '  participant ParseIntPipe',
        '  participant OrdersController',
        '  Client->>AuthGuard_session: GET /orders/recent',
        '  opt Not signed in',
        '    AuthGuard_session--xClient: 401 Unauthorized',
        '  end',
        '  AuthGuard_session->>DefaultValuePipe: query limit',
        '  DefaultValuePipe->>ParseIntPipe: query limit',
        '  opt Not a number',
        '    ParseIntPipe--xClient: 400 Bad Request',
        '  end',
        '  ParseIntPipe->>+OrdersController: recent(limit)',
        '  OrdersController-->>-Client: 200 OK',
        '',
      ].join('\n'),
    );
  });

  it('fails loudly when an operation has no matching controller method', () => {
    const unknown = {
      ...document,
      paths: { '/x': { get: { operationId: 'MissingController_list', responses: {} } } },
    } as unknown as OpenAPIObject;
    expect(() => sequenceDoc(program, unknown)).toThrow(
      'No controller method for GET /x (operationId MissingController_list)',
    );
  });
});
