import { dataDictionaryDoc, type Column, type Schema } from './data-dictionary';

const column = (name: string, type: string, extra: Partial<Column> = {}): Column => ({
  name,
  type,
  nullable: false,
  default: null,
  comment: null,
  ...extra,
});

const schema: Schema = {
  tables: [
    {
      name: 'accounts',
      comment: 'People who can sign in.',
      columns: [
        column('id', 'uuid', { default: 'gen_random_uuid()' }),
        column('email', 'character varying(254)', { comment: 'Stored lowercase.' }),
      ],
      constraints: [
        {
          name: 'accounts_pkey',
          kind: 'p',
          definition: 'PRIMARY KEY (id)',
          columns: ['id'],
          refTable: null,
          refColumns: [],
        },
      ],
      indexes: [
        {
          name: 'uq_accounts_email',
          definition:
            'CREATE UNIQUE INDEX uq_accounts_email ON public.accounts USING btree (lower((email)::text))',
        },
      ],
    },
    {
      name: 'profiles',
      comment: null,
      columns: [column('account_id', 'uuid'), column('bio', 'text', { nullable: true })],
      constraints: [
        {
          name: 'profiles_pkey',
          kind: 'p',
          definition: 'PRIMARY KEY (account_id)',
          columns: ['account_id'],
          refTable: null,
          refColumns: [],
        },
        {
          name: 'fk_profiles_account',
          kind: 'f',
          definition: 'FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE',
          columns: ['account_id'],
          refTable: 'accounts',
          refColumns: ['id'],
        },
      ],
      indexes: [],
    },
    {
      name: 'sessions',
      comment: null,
      columns: [
        column('id', 'uuid'),
        column('account_id', 'uuid', { nullable: true }),
        column('created_at', 'timestamp with time zone', { default: 'now()' }),
      ],
      constraints: [
        {
          name: 'sessions_pkey',
          kind: 'p',
          definition: 'PRIMARY KEY (id)',
          columns: ['id'],
          refTable: null,
          refColumns: [],
        },
        {
          name: 'fk_sessions_account',
          kind: 'f',
          definition: 'FOREIGN KEY (account_id) REFERENCES accounts(id)',
          columns: ['account_id'],
          refTable: 'accounts',
          refColumns: ['id'],
        },
        {
          name: 'ck_sessions_id',
          kind: 'c',
          definition: "CHECK ((id <> '00000000-0000-0000-0000-000000000000'::uuid))",
          columns: ['id'],
          refTable: null,
          refColumns: [],
        },
      ],
      indexes: [
        {
          name: 'ix_sessions_account',
          definition:
            'CREATE INDEX ix_sessions_account ON public.sessions USING btree (account_id)',
        },
      ],
    },
  ],
  enums: [{ name: 'session_kind', values: ['web', 'api'] }],
  extensions: ['pg_trgm'],
};

describe('dataDictionaryDoc', () => {
  const doc = dataDictionaryDoc(schema);
  const section = (heading: string) => doc.sections.find((s) => s.heading === heading)?.body ?? '';

  it('draws an ER diagram with short types and keys', () => {
    const body = section('Entity relationship diagram');
    for (const line of [
      '  accounts {',
      '    uuid id PK',
      // A unique expression index on lower(email) still makes email a unique key.
      '    varchar email UK',
      '    uuid account_id PK, FK',
      '    timestamptz created_at',
    ]) {
      expect(body).toContain(line);
    }
  });

  it('reads cardinality from the foreign key: required or not, one-to-one or not', () => {
    const body = section('Entity relationship diagram');
    expect(body).toContain('  accounts ||--o| profiles : "account_id"');
    expect(body).toContain('  accounts |o--o{ sessions : "account_id"');
  });

  it('lists columns, constraints and indexes per table', () => {
    const accounts = section('accounts');
    expect(accounts).toContain('People who can sign in.');
    expect(accounts).toContain(
      '| `email` | `character varying(254)` | no |  | unique (`uq_accounts_email`); Stored lowercase. |',
    );
    expect(accounts).toContain('| `uq_accounts_email` | yes | `btree (lower((email)::text))` |');
    const sessions = section('sessions');
    expect(sessions).toContain('| `account_id` | `uuid` | yes |  | references `accounts.id` |');
    expect(sessions).toContain(
      "| `ck_sessions_id` | check | `CHECK ((id <> '00000000-0000-0000-0000-000000000000'::uuid))` |",
    );
    expect(sessions).toContain('| `ix_sessions_account` | no | `btree (account_id)` |');
  });

  it('lists enum types and extensions', () => {
    const body = section('Types and extensions');
    expect(body).toContain('| `session_kind` | `web`, `api` |');
    expect(body).toContain('Extensions: `pg_trgm`.');
  });
});
