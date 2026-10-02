import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { architectureDoc, type ComposeConfig } from './architecture';
import { shopProgram } from './fixtures/shop-program';

const ROUTES = `
import { Navigate, type RouteObject } from 'react-router';

export const routes: RouteObject[] = [
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth />,
    errorElement: <Oops />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: '/home', element: <Home /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
];
`;

describe('architectureDoc', () => {
  const program = shopProgram();
  let dir: string;
  let compose: ComposeConfig;

  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'diagrams-'));
    const write = (file: string, text: string) => {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), text);
    };
    write('api/Dockerfile', 'FROM node:24-alpine\nCMD ["node", "main.js"]\n');
    write(
      'web/Dockerfile',
      [
        'FROM node:24-alpine AS build',
        'RUN npm run build',
        'FROM nginx:1.30-alpine AS runtime',
        'COPY nginx/site.conf /etc/nginx/conf.d/default.conf',
      ].join('\n'),
    );
    write(
      'web/nginx/site.conf',
      'server {\n  location /api/ {\n    proxy_pass http://api:3000;\n  }\n  location / {\n    try_files $uri /index.html;\n  }\n}\n',
    );
    write('src/routes.tsx', ROUTES);
    compose = {
      services: {
        api: {
          build: { context: path.join(dir, 'api') },
          environment: { DB_HOST: 'db', TZ: 'UTC', EMPTY: null },
          depends_on: { db: { condition: 'service_healthy' } },
          ports: [{ host_ip: '127.0.0.1', published: '3000', target: 3000 }],
        },
        db: {
          image: 'postgres:17-alpine',
          volumes: [{ type: 'volume', source: 'data', target: '/var/lib/postgresql/data' }],
        },
        web: {
          build: { context: path.join(dir, 'web'), args: { API_URL: '/api' } },
          depends_on: { api: { condition: 'service_started' } },
          ports: [{ published: 8080, target: 80 }],
        },
      },
      volumes: { data: {} },
    };
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const section = (heading: string) =>
    architectureDoc(program, compose, path.join(dir, 'src')).sections.find(
      (s) => s.heading === heading,
    )?.body ?? '';

  it('draws containers from the compose model and the Dockerfiles', () => {
    const body = section('Containers');
    expect(body).toContain('    api["api<br/>node:24-alpine"]');
    expect(body).toContain('    db[("db<br/>postgres:17-alpine")]');
    expect(body).toContain(
      '    web["web<br/>nginx:1.30-alpine<br/>proxies /api/<br/>build arg API_URL=/api"]',
    );
    expect(body).toContain('    volume_data[("volume data")]');
    expect(body).toContain('  host -->|"127.0.0.1:3000:3000"| api');
    expect(body).toContain('  host -->|"8080:80"| web');
    // A setting that names another service is a connection; TZ=UTC is not.
    expect(body).toContain('  api -->|"DB_HOST=db<br/>starts once db is healthy"| db');
    expect(body).not.toContain('UTC');
    // depends_on without a connection is only a start order.
    expect(body).toContain('  web -.->|"starts once api has started"| api');
    expect(body).toContain('  db ---|"/var/lib/postgresql/data"| volume_data');
  });

  it('draws the Nest modules and what they import', () => {
    expect(section('API modules')).toContain(
      '  ShopModule -->|"forFeature(Order)"| lib_TypeOrmModule',
    );
  });

  it('draws providers inside their module with an arrow to each injected dependency', () => {
    const body = section('API providers');
    for (const line of [
      '  subgraph module_ShopModule["ShopModule"]',
      '    OrdersController(["OrdersController"])',
      '    OrdersService["OrdersService<br/>exported"]',
      '    ApiKeyGuard{{"ApiKeyGuard<br/>global guard"}}',
      '  lib_Repository_Order_["Repository#60;Order#62;<br/>typeorm"]',
      '  OrdersController --> OrdersService',
      '  OrdersService --> OrdersRepository',
      '  OrdersRepository --> lib_Repository_Order_',
      '  ApiKeyGuard --> lib_Reflector',
    ]) {
      expect(body).toContain(line);
    }
  });

  it('draws the route table, with layout routes as boxes and redirects as dotted arrows', () => {
    const body = section('Web app routes');
    for (const line of [
      '  route_0["/login"]',
      '  subgraph layout_1["RequireAuth<br/>errors: Oops"]',
      '    route_2["/ (index)"]',
      '    route_3["/home"]',
      '    route_4["/settings"]',
      '  route_0 --> page_Login',
      '  route_4 --> page_Settings',
      '  route_2 -.->|redirects| route_3',
    ]) {
      expect(body).toContain(line);
    }
  });
});
