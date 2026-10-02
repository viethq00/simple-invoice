import type { DataSource } from 'typeorm';
import {
  byText,
  code,
  escapeText,
  markdownTable,
  mermaid,
  type Doc,
  type Section,
} from './markdown';

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  comment: string | null;
}

export interface Constraint {
  name: string;
  kind: 'p' | 'u' | 'f' | 'c' | 'x';
  definition: string;
  columns: string[];
  refTable: string | null;
  refColumns: string[];
}

export interface Index {
  name: string;
  definition: string;
}

export interface Table {
  name: string;
  comment: string | null;
  columns: Column[];
  constraints: Constraint[];
  indexes: Index[];
}

export interface Schema {
  tables: Table[];
  enums: { name: string; values: string[] }[];
  extensions: string[];
}

const columnNames = (key: string, relation: string) =>
  `ARRAY(SELECT a.attname::text FROM unnest(con.${key}) WITH ORDINALITY k(attnum, n)
    JOIN pg_attribute a ON a.attrelid = con.${relation} AND a.attnum = k.attnum ORDER BY k.n)`;

// Reads the public schema from the catalog: what the migrations actually built.
export async function readSchema(dataSource: DataSource): Promise<Schema> {
  const tableRows: { name: string; comment: string | null }[] = await dataSource.query(
    `SELECT c.relname AS name, obj_description(c.oid, 'pg_class') AS comment
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> $1`,
    [dataSource.options.migrationsTableName ?? 'migrations'],
  );
  const tables: Table[] = [];
  for (const { name, comment } of tableRows.sort((a, b) => byText(a.name, b.name))) {
    const columns: Column[] = await dataSource.query(
      `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type,
              NOT a.attnotnull AS nullable, pg_get_expr(d.adbin, d.adrelid) AS default,
              col_description(a.attrelid, a.attnum) AS comment
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`,
      [name],
    );
    const constraints: Constraint[] = await dataSource.query(
      `SELECT con.conname AS name, con.contype AS kind, pg_get_constraintdef(con.oid) AS definition,
              ${columnNames('conkey', 'conrelid')} AS columns,
              ref.relname AS "refTable", ${columnNames('confkey', 'confrelid')} AS "refColumns"
       FROM pg_constraint con LEFT JOIN pg_class ref ON ref.oid = con.confrelid
       WHERE con.conrelid = $1::regclass AND con.contype IN ('p', 'u', 'f', 'c', 'x')`,
      [name],
    );
    // An index behind a primary key or unique constraint is listed as that constraint.
    const indexes: Index[] = await dataSource.query(
      `SELECT i.relname AS name, pg_get_indexdef(i.oid) AS definition
       FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
       WHERE x.indrelid = $1::regclass
         AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = x.indexrelid)`,
      [name],
    );
    const kindOrder = 'pufcx';
    constraints.sort(
      (a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || byText(a.name, b.name),
    );
    indexes.sort((a, b) => byText(a.name, b.name));
    tables.push({ name, comment, columns, constraints, indexes });
  }

  const enums: { name: string; values: string[] }[] = await dataSource.query(
    `SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS values
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
     GROUP BY t.typname`,
  );
  const extensions: { name: string }[] = await dataSource.query(
    `SELECT extname AS name FROM pg_extension WHERE extname <> 'plpgsql'`,
  );
  return {
    tables,
    enums: enums.sort((a, b) => byText(a.name, b.name)),
    extensions: extensions.map(({ name }) => name).sort(byText),
  };
}

const KIND_NAMES: Record<Constraint['kind'], string> = {
  p: 'primary key',
  u: 'unique',
  f: 'foreign key',
  c: 'check',
  x: 'exclusion',
};

// "CREATE UNIQUE INDEX name ON public.invoices USING btree (x)" -> "btree (x)"
const indexMethod = (index: Index): string =>
  index.definition.replace(/^CREATE (UNIQUE )?INDEX \S+ ON \S+ USING /, '');

const isUniqueIndex = (index: Index): boolean => index.definition.startsWith('CREATE UNIQUE ');

const primaryKey = (table: Table): string[] =>
  table.constraints.find((c) => c.kind === 'p')?.columns ?? [];

// Column sets that must be unique, including expression indexes such as lower(email).
function uniqueKeys(table: Table): { name: string; columns: string[] }[] {
  const indexed = table.indexes.filter(isUniqueIndex).map((index) => {
    const expression = indexMethod(index).replace(/ WHERE .*$/, '');
    const columns = table.columns
      .map((column) => column.name)
      .filter((name) => new RegExp(`\\b${name}\\b`).test(expression));
    return { name: index.name, columns };
  });
  const constrained = table.constraints.filter((c) => c.kind === 'u');
  return [...constrained.map(({ name, columns }) => ({ name, columns })), ...indexed];
}

// Mermaid attribute types are a single word: "character varying(254)" -> "varchar".
function shortType(type: string): string {
  const aliases: Record<string, string> = {
    'character varying': 'varchar',
    character: 'char',
    'timestamp with time zone': 'timestamptz',
    'timestamp without time zone': 'timestamp',
    'time with time zone': 'timetz',
    'time without time zone': 'time',
    'double precision': 'float8',
  };
  const base = type.replace(/\(.*?\)/, '');
  return (aliases[base] ?? base).replace(/\[\]$/, '_array').replace(/\s+/g, '_');
}

function erDiagram(schema: Schema): string {
  const lines = ['erDiagram'];
  for (const table of schema.tables) {
    const primary = primaryKey(table);
    const foreign = table.constraints.filter((c) => c.kind === 'f').flatMap((c) => c.columns);
    const unique = uniqueKeys(table).flatMap((key) => key.columns);
    lines.push(`  ${table.name} {`);
    for (const column of table.columns) {
      const keys = [
        primary.includes(column.name) && 'PK',
        foreign.includes(column.name) && 'FK',
        unique.includes(column.name) && 'UK',
      ].filter(Boolean);
      const suffix = keys.length > 0 ? ` ${keys.join(', ')}` : '';
      lines.push(`    ${shortType(column.type)} ${column.name}${suffix}`);
    }
    lines.push('  }');
  }
  for (const table of schema.tables) {
    const keys = [primaryKey(table), ...uniqueKeys(table).map((key) => key.columns)].filter(
      (key) => key.length > 0,
    );
    for (const fk of table.constraints.filter((c) => c.kind === 'f')) {
      const required = fk.columns.every(
        (name) => table.columns.find((column) => column.name === name)?.nullable === false,
      );
      const oneToOne = keys.some((key) => key.every((name) => fk.columns.includes(name)));
      const relation = `${required ? '||' : '|o'}--${oneToOne ? 'o|' : 'o{'}`;
      const label = escapeText(fk.columns.join(', '));
      lines.push(`  ${fk.refTable} ${relation} ${table.name} : "${label}"`);
    }
  }
  return mermaid(lines);
}

function tableSection(table: Table): Section {
  const primary = primaryKey(table);
  const unique = uniqueKeys(table);
  const references = new Map<string, string>();
  for (const fk of table.constraints.filter((c) => c.kind === 'f')) {
    fk.columns.forEach((name, i) => references.set(name, `${fk.refTable}.${fk.refColumns[i]}`));
  }

  const columnRows = table.columns.map((column) => {
    const reference = references.get(column.name);
    const notes = [
      primary.includes(column.name) && 'primary key',
      ...unique
        .filter((key) => key.columns.includes(column.name))
        .map((key) => `unique (${code(key.name)})`),
      reference && `references ${code(reference)}`,
      column.comment,
    ].filter(Boolean);
    return [
      code(column.name),
      code(column.type),
      column.nullable ? 'yes' : 'no',
      column.default === null ? '' : code(column.default),
      notes.join('; '),
    ];
  });

  const parts = [
    ...(table.comment ? [table.comment] : []),
    markdownTable(['Column', 'Type', 'Nullable', 'Default', 'Notes'], columnRows),
  ];
  if (table.constraints.length > 0) {
    parts.push(
      markdownTable(
        ['Constraint', 'Kind', 'Definition'],
        table.constraints.map((c) => [code(c.name), KIND_NAMES[c.kind], code(c.definition)]),
      ),
    );
  }
  if (table.indexes.length > 0) {
    parts.push(
      markdownTable(
        ['Index', 'Unique', 'Definition'],
        table.indexes.map((index) => [
          code(index.name),
          isUniqueIndex(index) ? 'yes' : 'no',
          code(indexMethod(index)),
        ]),
      ),
    );
  }
  return { heading: table.name, body: parts.join('\n\n') };
}

export function dataDictionaryDoc(schema: Schema): Doc {
  const sections: Section[] = [
    { heading: 'Entity relationship diagram', body: erDiagram(schema) },
    ...schema.tables.map(tableSection),
  ];
  const types: string[] = [];
  if (schema.enums.length > 0) {
    types.push(
      markdownTable(
        ['Enum type', 'Values'],
        schema.enums.map((e) => [code(e.name), e.values.map(code).join(', ')]),
      ),
    );
  }
  if (schema.extensions.length > 0) {
    types.push(`Extensions: ${schema.extensions.map(code).join(', ')}.`);
  }
  if (types.length > 0)
    sections.push({ heading: 'Types and extensions', body: types.join('\n\n') });
  return {
    file: 'data-dictionary.md',
    title: 'Data dictionary',
    intro:
      'The PostgreSQL schema, read from the database catalog after the API has started against ' +
      'an empty database and run its migrations.',
    sections,
  };
}
