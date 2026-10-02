import type {
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger';
import {
  code,
  escapeText,
  markdownTable,
  mermaid,
  nodeId,
  type Doc,
  type Section,
} from './markdown';

const METHODS = ['get', 'put', 'post', 'patch', 'delete'] as const;

export interface Operation {
  method: string;
  path: string;
  operation: OperationObject;
}

export function listOperations(document: OpenAPIObject): Operation[] {
  return Object.entries(document.paths).flatMap(([path, item]) =>
    METHODS.flatMap((method) => {
      const operation = item[method];
      return operation ? [{ method: method.toUpperCase(), path, operation }] : [];
    }),
  );
}

const isRef = (value: object): value is ReferenceObject => '$ref' in value;
const refName = (ref: ReferenceObject): string => ref.$ref.slice(ref.$ref.lastIndexOf('/') + 1);

export function successResponse(operation: OperationObject): {
  status: string;
  schema?: SchemaObject | ReferenceObject;
} {
  // A redirect-only endpoint succeeds with its 3xx.
  const codes = Object.keys(operation.responses);
  const status =
    codes.find((code) => code.startsWith('2')) ??
    codes.find((code) => code.startsWith('3')) ??
    'default';
  const response = operation.responses[status] as ResponseObject | undefined;
  return { status, schema: response?.content?.['application/json']?.schema };
}

function errorResponses(operation: OperationObject): [string, string][] {
  return Object.entries(operation.responses)
    .filter(([status]) => /^[45]/.test(status))
    .map(([status, response]) => [status, (response as ResponseObject).description]);
}

function parameters(operation: OperationObject): ParameterObject[] {
  return (operation.parameters ?? []).filter((p): p is ParameterObject => !isRef(p));
}

function requestSchema(operation: OperationObject): SchemaObject | ReferenceObject | undefined {
  const body = operation.requestBody;
  return body && !isRef(body) ? body.content['application/json']?.schema : undefined;
}

// Formats that say more than the JSON type they refine.
const TYPE_FORMATS = new Set(['date', 'date-time', 'uuid', 'email', 'uri']);

function typeName(schema: SchemaObject | ReferenceObject, enumName?: string): string {
  if (isRef(schema)) return refName(schema);
  const alternatives = schema.oneOf ?? schema.anyOf;
  let name: string;
  if (alternatives) name = alternatives.map((s) => typeName(s)).join(' or ');
  else if (schema.allOf?.length === 1) name = typeName(schema.allOf[0]);
  else if (schema.enum && enumName) name = enumName;
  else if (schema.type === 'array' && schema.items) name = `${typeName(schema.items)}[]`;
  else if (schema.format && TYPE_FORMATS.has(schema.format)) name = schema.format;
  else name = schema.type ?? 'object';
  return schema.nullable ? `${name} or null` : name;
}

// How many items an array holds: "*", "1..*", "1" or "0..5".
function cardinality({ minItems = 0, maxItems }: SchemaObject): string {
  if (maxItems === undefined) return minItems > 0 ? `${minItems}..*` : '*';
  return minItems === maxItems ? String(maxItems) : `${minItems}..${maxItems}`;
}

// A named schema by name, an inline object by its fields.
export function schemaLabel(schema: SchemaObject | ReferenceObject): string {
  if (isRef(schema) || !schema.properties) return typeName(schema);
  return `{ ${Object.keys(schema.properties).join(', ')} }`;
}

function constraints(schema: SchemaObject): string {
  const notes: string[] = [];
  if (schema.enum) notes.push(`one of ${schema.enum.map((v) => code(String(v))).join(', ')}`);
  if (schema.minimum !== undefined) {
    notes.push(`${schema.exclusiveMinimum ? 'above' : 'at least'} ${schema.minimum}`);
  }
  if (schema.maximum !== undefined) notes.push(`at most ${schema.maximum}`);
  if (schema.maxLength !== undefined) notes.push(`up to ${schema.maxLength} characters`);
  if (schema.pattern) notes.push(`matches ${code(schema.pattern)}`);
  const text = notes.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function authentication(document: OpenAPIObject): Section {
  const schemes = Object.entries(document.components?.securitySchemes ?? {}).map(
    ([name, scheme]) => {
      if (isRef(scheme)) return [code(name), refName(scheme)];
      const how =
        scheme.type === 'http'
          ? `${code(`Authorization: Bearer <${scheme.bearerFormat ?? 'token'}>`)} header`
          : scheme.type === 'apiKey'
            ? `${code(scheme.name ?? '')} ${scheme.in ?? ''}`
            : scheme.type;
      return [code(name), how];
    },
  );
  return {
    heading: 'Authentication',
    body: [
      'Endpoints marked "signed in" accept any one of these. The others are public.',
      markdownTable(['Scheme', 'Sent as'], schemes),
    ].join('\n\n'),
  };
}

function endpointsSection(tag: string, operations: Operation[]): Section {
  const nodes = new Map<string, string>();
  const edges: string[] = [];
  const node = (id: string, shape: string) => {
    if (!nodes.has(id)) nodes.set(id, `  ${id}${shape}`);
    return id;
  };
  const dataNode = (prefix: string, schema: SchemaObject | ReferenceObject | undefined) => {
    if (!schema) return node(`${prefix}_empty`, '[/"no body"/]');
    if (isRef(schema)) return node(nodeId('schema', refName(schema)), `[/"${refName(schema)}"/]`);
    return node(`${prefix}_body`, `[/"${escapeText(schemaLabel(schema))}"/]`);
  };

  for (const { method, path, operation } of operations) {
    const id = nodeId(operation.operationId ?? `${method}_${path}`);
    const access = operation.security?.length ? 'signed in' : 'public';
    const label = [`${method} ${path}`, operation.summary ?? '', access].map(escapeText);
    node(id, `["${label.join('<br/>')}"]`);

    const byLocation = new Map<string, string[]>();
    for (const parameter of parameters(operation)) {
      byLocation.set(parameter.in, [...(byLocation.get(parameter.in) ?? []), parameter.name]);
    }
    for (const [location, names] of byLocation) {
      const lines = [location];
      for (let i = 0; i < names.length; i += 2) lines.push(names.slice(i, i + 2).join(', '));
      edges.push(
        `  ${node(`${id}_${location}`, `[/"${lines.map(escapeText).join('<br/>')}"/]`)} --> ${id}`,
      );
    }
    const body = requestSchema(operation);
    if (body) edges.push(`  ${dataNode(`${id}_request`, body)} --> ${id}`);
    const success = successResponse(operation);
    edges.push(`  ${id} -->|${success.status}| ${dataNode(`${id}_response`, success.schema)}`);
  }

  const rows = operations.map(({ method, path, operation }) => {
    const body = requestSchema(operation);
    const success = successResponse(operation);
    const byLocation = new Map<string, string[]>();
    for (const parameter of parameters(operation)) {
      byLocation.set(parameter.in, [...(byLocation.get(parameter.in) ?? []), code(parameter.name)]);
    }
    const request = [
      ...[...byLocation].map(([location, names]) => `${location} ${names.join(', ')}`),
      ...(body ? [`body ${code(schemaLabel(body))}`] : []),
    ];
    const responses = [
      `${success.status} ${success.schema ? code(schemaLabel(success.schema)) : 'no body'}`,
      ...errorResponses(operation).map(([status, description]) => `${status} ${description}`),
    ];
    return [
      code(`${method} ${path}`),
      operation.summary ?? '',
      operation.security?.length ? 'signed in' : 'public',
      request.join('<br>'),
      responses.join('<br>'),
    ];
  });

  const parts = [
    mermaid(['flowchart LR', ...nodes.values(), ...edges]),
    markdownTable(['Endpoint', 'Summary', 'Access', 'Request', 'Responses'], rows),
  ];
  const parameterRows = operations.flatMap(({ method, path, operation }) =>
    parameters(operation).map((p) => {
      const schema = p.schema && !isRef(p.schema) ? p.schema : {};
      return [
        code(`${method} ${path}`),
        code(p.name),
        p.in,
        p.schema ? typeName(p.schema) : '',
        p.required ? 'yes' : 'no',
        schema.default === undefined ? '' : code(String(schema.default)),
        p.description ?? '',
        constraints(schema),
      ];
    }),
  );
  if (parameterRows.length > 0) {
    parts.push(
      markdownTable(
        ['Endpoint', 'Parameter', 'In', 'Type', 'Required', 'Default', 'Description', 'Rules'],
        parameterRows,
      ),
    );
  }
  return { heading: `${tag} endpoints`, body: parts.join('\n\n') };
}

function schemasSection(document: OpenAPIObject): Section {
  const schemas = Object.entries(document.components?.schemas ?? {});
  const enums = new Map<string, string[]>();
  // Inline enums get a class named after the property, e.g. "currency" -> Currency.
  const enumName = (owner: string, property: string, values: string[]): string => {
    const base = property.charAt(0).toUpperCase() + property.slice(1);
    for (const name of [base, `${owner.replace(/Dto$/, '')}${base}`]) {
      const existing = enums.get(name);
      if (!existing) enums.set(name, values);
      if (!existing || existing.join() === values.join()) return name;
    }
    throw new Error(`Cannot name the enum of ${owner}.${property}`);
  };

  const lines = ['classDiagram', '  direction LR'];
  const relations: string[] = [];
  for (const [name, schema] of schemas) {
    if (isRef(schema)) continue;
    lines.push(`  class ${name} {`);
    for (const [property, value] of Object.entries(schema.properties ?? {})) {
      const values = !isRef(value) && value.enum ? value.enum.map(String) : undefined;
      const enumType = values && enumName(name, property, values);
      const optional = schema.required?.includes(property) ? '' : '?';
      lines.push(`    +${property}${optional}: ${typeName(value, enumType)}`);
      if (enumType) relations.push(`  ${name} ..> ${enumType}`);

      const target = isRef(value)
        ? value
        : !isRef(value) && value.items && isRef(value.items)
          ? value.items
          : undefined;
      if (target) {
        const many = !isRef(value) && value.type === 'array' ? `"${cardinality(value)}" ` : '';
        relations.push(`  ${name} --> ${many}${refName(target)} : ${property}`);
      }
    }
    lines.push('  }');
  }
  for (const [name, values] of enums) {
    lines.push(`  class ${name} {`, '    <<enumeration>>', ...values.map((v) => `    ${v}`), '  }');
  }
  return {
    heading: 'Schemas',
    body: [
      'Request and response bodies. `?` marks an optional field.',
      mermaid([...lines, ...relations]),
    ].join('\n\n'),
  };
}

export function apiSpecDoc(document: OpenAPIObject): Doc {
  const operations = listOperations(document);
  const tags = [...new Set(operations.map(({ operation }) => operation.tags?.[0] ?? 'Other'))];
  return {
    file: 'api-spec.md',
    title: 'API spec',
    intro:
      `${document.info.title} ${document.info.version}, from the OpenAPI document the API ` +
      'serves (Swagger UI at `/api/docs`, JSON at `/api/docs-json`).',
    sections: [
      authentication(document),
      ...tags.map((tag) =>
        endpointsSection(
          tag,
          operations.filter(({ operation }) => (operation.tags?.[0] ?? 'Other') === tag),
        ),
      ),
      schemasSection(document),
    ],
  };
}
