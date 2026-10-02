import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { escapeText, mermaid, nodeId, REPO_ROOT, type Doc, type Section } from './markdown';
import {
  constructorDependencies,
  ownClasses,
  packageOf,
  property,
  readModules,
  type NestModule,
  type Provider,
} from './source';

interface ComposeService {
  image?: string;
  build?: { context: string; dockerfile?: string; args?: Record<string, string> };
  ports?: { host_ip?: string; published?: string | number; target: number }[];
  depends_on?: Record<string, { condition: string }>;
  volumes?: { type: string; source?: string; target: string; read_only?: boolean }[];
  environment?: Record<string, string | null>;
}

export interface ComposeConfig {
  services: Record<string, ComposeService>;
  volumes?: Record<string, unknown>;
}

// The compose model as Docker resolves it, with every ${VAR:-default} at its default: no .env
// file and none of this machine's environment variables.
export function readCompose(): ComposeConfig {
  const result = spawnSync(
    'docker',
    ['compose', '--env-file', '/dev/null', 'config', '--format', 'json'],
    { cwd: REPO_ROOT, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME } },
  );
  if (result.status !== 0) {
    throw new Error(`docker compose config failed: ${result.stderr || result.error?.message}`);
  }
  return JSON.parse(result.stdout) as ComposeConfig;
}

function dockerfile(service: ComposeService): string | undefined {
  if (!service.build) return undefined;
  return readFileSync(
    path.resolve(service.build.context, service.build.dockerfile ?? 'Dockerfile'),
    'utf8',
  );
}

// The image a service runs: the last FROM, followed through earlier stage names.
function runtimeImage(service: ComposeService): string {
  const stages = new Map<string, string>();
  let image = service.image ?? '?';
  for (const line of dockerfile(service)?.split('\n') ?? []) {
    const match = /^\s*FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
    if (!match) continue;
    image = stages.get(match[1].toLowerCase()) ?? match[1];
    if (match[2]) stages.set(match[2].toLowerCase(), image);
  }
  return image;
}

// Locations an nginx config copied into the image passes on with proxy_pass.
function proxiedLocations(service: ComposeService): string[] {
  const context = service.build?.context;
  if (!context) return [];
  const locations: string[] = [];
  const copies = dockerfile(service)?.matchAll(/^\s*COPY\s+(?:--\S+\s+)*(\S+)\s+\/etc\/nginx\//gim);
  for (const [, source] of copies ?? []) {
    const file = path.resolve(context, source);
    if (!existsSync(file)) continue;
    for (const [, location, body] of readFileSync(file, 'utf8').matchAll(
      /location\s+([^{]+?)\s*\{([^}]*)\}/g,
    )) {
      if (/\bproxy_pass\b/.test(body)) locations.push(location);
    }
  }
  return locations;
}

const DATABASE_IMAGE = /^(postgres|mysql|mariadb|mongo|redis)\b/;

const CONDITIONS: Record<string, string> = {
  service_healthy: 'is healthy',
  service_started: 'has started',
  service_completed_successfully: 'has finished',
};

function containersSection(compose: ComposeConfig): Section {
  const { services } = compose;
  const lines = [
    'flowchart LR',
    '  host(["Host machine"])',
    '  subgraph compose["docker compose"]',
  ];
  const edges: string[] = [];
  for (const [name, service] of Object.entries(services)) {
    const image = runtimeImage(service);
    const details = [
      name,
      image,
      ...proxiedLocations(service).map((location) => `proxies ${location}`),
      ...Object.entries(service.build?.args ?? {}).map(
        ([key, value]) => `build arg ${key}=${value}`,
      ),
    ].map(escapeText);
    const label = `"${details.join('<br/>')}"`;
    lines.push(`    ${nodeId(name)}${DATABASE_IMAGE.test(image) ? `[(${label})]` : `[${label}]`}`);

    for (const port of service.ports ?? []) {
      const binding = [port.host_ip, port.published, port.target].filter(Boolean).join(':');
      edges.push(`  host -->|"${escapeText(binding)}"| ${nodeId(name)}`);
    }
    // A setting that names another service as its host is a connection to it:
    // POSTGRES_HOST=db, BACKEND_UPSTREAM=backend:4000, API_URL=http://backend:4000.
    const connected = new Set<string>();
    for (const [key, value] of Object.entries(service.environment ?? {})) {
      const host = value ? /^(?:[a-z]+:\/\/)?([^:/\s]+)/i.exec(value)?.[1] : undefined;
      if (!host || host === name || !services[host]) continue;
      const condition = service.depends_on?.[host]?.condition;
      const label = [`${key}=${value}`];
      if (condition) label.push(`starts once ${host} ${CONDITIONS[condition] ?? condition}`);
      edges.push(`  ${nodeId(name)} -->|"${label.map(escapeText).join('<br/>')}"| ${nodeId(host)}`);
      connected.add(host);
    }
    for (const [dependency, { condition }] of Object.entries(service.depends_on ?? {})) {
      if (connected.has(dependency)) continue;
      const label = `starts once ${dependency} ${CONDITIONS[condition] ?? condition}`;
      edges.push(`  ${nodeId(name)} -.->|"${escapeText(label)}"| ${nodeId(dependency)}`);
    }
    for (const volume of service.volumes ?? []) {
      if (volume.type !== 'volume' || !volume.source) continue;
      const label = `${volume.target}${volume.read_only ? ', read-only' : ''}`;
      edges.push(
        `  ${nodeId(name)} ---|"${escapeText(label)}"| ${nodeId('volume', volume.source)}`,
      );
    }
  }
  for (const volume of Object.keys(compose.volumes ?? {})) {
    lines.push(`    ${nodeId('volume', volume)}[("volume ${escapeText(volume)}")]`);
  }
  lines.push('  end');
  return {
    heading: 'Containers',
    body: [
      '`docker compose up` with no `.env`. Edge labels on the left are published ports ' +
        '(host address, host port, container port).',
      mermaid([...lines, ...edges]),
    ].join('\n\n'),
  };
}

// Root modules first, then what each one imports, in declaration order.
function moduleOrder(modules: NestModule[]): NestModule[] {
  const byName = new Map(modules.map((module) => [module.name, module]));
  const imported = new Set(modules.flatMap((module) => module.imports.map((i) => i.name)));
  const queue = modules.filter((module) => !imported.has(module.name));
  const ordered: NestModule[] = [];
  while (queue.length > 0) {
    const module = queue.shift() as NestModule;
    if (ordered.includes(module)) continue;
    ordered.push(module);
    queue.push(...module.imports.flatMap((i) => byName.get(i.name) ?? []));
  }
  return [...ordered, ...modules.filter((module) => !ordered.includes(module))];
}

function modulesSection(modules: NestModule[]): Section {
  const lines = ['flowchart LR'];
  const libraries = new Set<string>();
  const edges: string[] = [];
  for (const module of modules) {
    const title = `${module.name}${module.global ? '<br/>global' : ''}`;
    lines.push(`  ${nodeId(module.name)}["${title}"]`);
    for (const target of module.imports) {
      const id = target.own ? nodeId(target.name) : nodeId('lib', target.name);
      if (!target.own) libraries.add(target.name);
      const how = [target.method, target.args.length > 0 && `(${target.args.join(', ')})`]
        .filter(Boolean)
        .join('');
      edges.push(`  ${nodeId(module.name)} -->${how ? `|"${escapeText(how)}"|` : ''} ${id}`);
    }
  }
  for (const name of libraries) lines.push(`  ${nodeId('lib', name)}["${name}"]`);
  const styles = libraries.size
    ? [
        '  classDef library stroke-dasharray: 4 3',
        `  class ${[...libraries].map((name) => nodeId('lib', name)).join(',')} library`,
      ]
    : [];
  return {
    heading: 'API modules',
    body: [
      'Nest modules and what each one imports. Dashed boxes are library modules.',
      mermaid([...lines, ...edges, ...styles]),
    ].join('\n\n'),
  };
}

function providersSection(program: ts.Program, modules: NestModule[]): Section {
  const checker = program.getTypeChecker();
  const classes = ownClasses(program);
  const lines = ['flowchart LR'];
  const external = new Map<string, string>();
  const edges: string[] = [];
  const dependsOn = (from: string, type: string, own: boolean, declaration?: ts.Node) => {
    let target = nodeId(type);
    if (!own) {
      target = nodeId('lib', type);
      const library = packageOf(declaration);
      external.set(target, `${escapeText(type)}${library ? `<br/>${escapeText(library)}` : ''}`);
    }
    edges.push(`  ${from} --> ${target}`);
  };

  const shape = (name: string, notes: string[], kind: 'controller' | 'guard' | 'provider') => {
    const label = `"${[name, ...notes].map(escapeText).join('<br/>')}"`;
    return kind === 'controller'
      ? `([${label}])`
      : kind === 'guard'
        ? `{{${label}}}`
        : `[${label}]`;
  };

  for (const module of modules) {
    if (module.controllers.length === 0 && module.providers.length === 0) continue;
    lines.push(`  subgraph ${nodeId('module', module.name)}["${module.name}"]`);
    for (const name of module.controllers) {
      lines.push(`    ${nodeId(name)}${shape(name, [], 'controller')}`);
    }
    for (const provider of module.providers) {
      lines.push(
        `    ${nodeId(provider.name)}${shape(provider.name, notes(module, provider), kind(provider))}`,
      );
    }
    lines.push('  end');

    for (const name of [...module.controllers, ...module.providers.map((p) => p.name)]) {
      const declaration = classes.get(name);
      const provider = module.providers.find((p) => p.name === name);
      if (provider?.kind === 'useFactory') {
        for (const injected of provider.inject)
          dependsOn(nodeId(name), injected, classes.has(injected));
      } else if (declaration) {
        for (const dependency of constructorDependencies(checker, declaration)) {
          dependsOn(nodeId(name), dependency.type, dependency.own, dependency.declaration);
        }
      }
    }
  }
  for (const [id, label] of external) lines.push(`  ${id}["${label}"]`);
  const styles = external.size
    ? [
        '  classDef library stroke-dasharray: 4 3',
        `  class ${[...external.keys()].join(',')} library`,
      ]
    : [];
  return {
    heading: 'API providers',
    body: [
      'Controllers and providers in each module, with an arrow to everything their constructor ' +
        'injects. Dashed boxes come from libraries.',
      mermaid([...lines, ...edges, ...styles]),
    ].join('\n\n'),
  };
}

function kind(provider: Provider): 'guard' | 'provider' {
  return provider.token === 'APP_GUARD' ? 'guard' : 'provider';
}

function notes(module: NestModule, provider: Provider): string[] {
  return [
    provider.token === 'APP_GUARD' ? 'global guard' : provider.token && `as ${provider.token}`,
    provider.kind === 'useFactory' && 'factory',
    module.exports.includes(provider.name) && 'exported',
  ].filter((note): note is string => typeof note === 'string');
}

interface Route {
  path?: string;
  index: boolean;
  element?: string;
  redirect?: string;
  errorElement?: string;
  children: Route[];
}

const FRONTEND_SRC = path.join(REPO_ROOT, 'frontend', 'src');

function jsx(expression: ts.Expression | undefined): { name?: string; to?: string } {
  if (!expression || !(ts.isJsxSelfClosingElement(expression) || ts.isJsxElement(expression))) {
    return {};
  }
  const opening = ts.isJsxElement(expression) ? expression.openingElement : expression;
  const to = opening.attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText() === 'to',
  );
  const value = to && ts.isJsxAttribute(to) ? to.initializer : undefined;
  return {
    name: opening.tagName.getText(),
    to: value && ts.isStringLiteral(value) ? value.text : undefined,
  };
}

function readRoute(expression: ts.Expression): Route {
  const text = (name: string) => {
    const value = property(expression, name);
    return value && ts.isStringLiteral(value) ? value.text : undefined;
  };
  const element = jsx(property(expression, 'element'));
  const children = property(expression, 'children');
  return {
    path: text('path'),
    index: property(expression, 'index')?.kind === ts.SyntaxKind.TrueKeyword,
    element: element.name === 'Navigate' ? undefined : element.name,
    redirect: element.name === 'Navigate' ? element.to : undefined,
    errorElement: jsx(property(expression, 'errorElement')).name,
    children:
      children && ts.isArrayLiteralExpression(children) ? children.elements.map(readRoute) : [],
  };
}

// Route tables are arrays annotated as RouteObject[] (React Router).
function readRoutes(dir: string): { file: string; routes: Route[] }[] {
  const tables: { file: string; routes: Route[] }[] = [];
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .sort();
  for (const file of files) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    if (!text.includes('RouteObject[]')) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.type?.getText() === 'RouteObject[]' &&
        node.initializer &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        tables.push({
          file: path.relative(REPO_ROOT, path.join(dir, file)),
          routes: node.initializer.elements.map(readRoute),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return tables;
}

function routesSection(frontendSrc: string): Section {
  const lines = ['flowchart LR'];
  const pages = new Set<string>();
  const edges: string[] = [];
  const pathIds = new Map<string, string>();
  const redirects: { from: string; to: string }[] = [];
  let count = 0;

  const join = (parent: string, child: string) =>
    child.startsWith('/') ? child : `${parent.replace(/\/$/, '')}/${child}`;

  const add = (route: Route, parentPath: string, indent: string) => {
    const fullPath = route.path === undefined ? parentPath : join(parentPath, route.path);
    if (route.children.length > 0) {
      const title = [
        route.element,
        route.errorElement && `errors: ${route.errorElement}`,
        route.path !== undefined && fullPath,
      ].filter((part): part is string => typeof part === 'string');
      lines.push(
        `${indent}subgraph layout_${count++}["${title.map(escapeText).join('<br/>') || 'layout'}"]`,
      );
      for (const child of route.children) add(child, fullPath, `${indent}  `);
      lines.push(`${indent}end`);
      return;
    }
    const id = `route_${count++}`;
    const label = route.index ? `${fullPath || '/'} (index)` : fullPath;
    lines.push(`${indent}${id}["${escapeText(label)}"]`);
    pathIds.set(label, id);
    if (route.element) {
      pages.add(route.element);
      edges.push(`  ${id} --> ${nodeId('page', route.element)}`);
    }
    if (route.redirect) redirects.push({ from: id, to: route.redirect });
  };

  const tables = readRoutes(frontendSrc);
  if (tables.length === 0) throw new Error(`No RouteObject[] route table in ${frontendSrc}`);
  for (const { routes } of tables) for (const route of routes) add(route, '', '  ');
  for (const page of pages) lines.push(`  ${nodeId('page', page)}(["${page}"])`);
  for (const { from, to } of redirects) {
    let target = pathIds.get(to);
    if (!target) {
      target = `route_${count++}`;
      lines.push(`  ${target}["${escapeText(to)}"]`);
    }
    edges.push(`  ${from} -.->|redirects| ${target}`);
  }
  return {
    heading: 'Web app routes',
    body: [
      `From ${tables.map(({ file }) => `\`${file}\``).join(', ')}. Boxes around routes are ` +
        'layout routes: the guard or error boundary that wraps them.',
      mermaid([...lines, ...edges]),
    ].join('\n\n'),
  };
}

export function architectureDoc(
  program: ts.Program,
  compose: ComposeConfig,
  frontendSrc = FRONTEND_SRC,
): Doc {
  const modules = moduleOrder(readModules(program));
  return {
    file: 'architecture.md',
    title: 'Architecture',
    intro:
      'Read from `docker-compose.yml` and the Dockerfiles, the Nest module metadata and ' +
      'constructors, and the web app route table.',
    sections: [
      containersSection(compose),
      modulesSection(modules),
      providersSection(program, modules),
      routesSection(frontendSrc),
    ],
  };
}
