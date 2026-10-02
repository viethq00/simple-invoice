import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790812800000 implements MigrationInterface {
  name = 'InitialSchema1790812800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`CREATE TYPE invoice_status AS ENUM ('Draft', 'Pending', 'Paid')`);

    await queryRunner.query(`
      CREATE TABLE users (
        id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        email         varchar(254) NOT NULL,
        password_hash varchar(100) NOT NULL,
        fullname      varchar(120) NOT NULL,
        created_at    timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT ck_users_email_lowercase CHECK (email = lower(email))
      )`);

    await queryRunner.query(`
      CREATE TABLE invoices (
        id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number    varchar(50)    NOT NULL,
        invoice_reference varchar(100),
        invoice_date      date           NOT NULL,
        due_date          date           NOT NULL,
        currency          char(3)        NOT NULL,
        currency_symbol   varchar(8)     NOT NULL,
        description       varchar(1000),
        status            invoice_status NOT NULL DEFAULT 'Draft',
        customer_fullname varchar(120)   NOT NULL,
        customer_email    varchar(254)   NOT NULL,
        customer_mobile   varchar(30),
        customer_address  varchar(255),
        tax_percent       numeric(5,2)   NOT NULL DEFAULT 10,
        invoice_sub_total numeric(15,2)  NOT NULL,
        total_tax         numeric(15,2)  NOT NULL,
        total_discount    numeric(15,2)  NOT NULL DEFAULT 0,
        total_amount      numeric(15,2)  NOT NULL,
        total_paid        numeric(15,2)  NOT NULL DEFAULT 0,
        balance_amount    numeric(15,2)  NOT NULL,
        created_by        uuid           NOT NULL,
        created_at        timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT fk_invoices_created_by FOREIGN KEY (created_by)
          REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT ck_invoices_invoice_number_not_blank CHECK (btrim(invoice_number) <> ''),
        CONSTRAINT ck_invoices_due_date CHECK (due_date >= invoice_date),
        CONSTRAINT ck_invoices_currency CHECK (currency ~ '^[A-Z]{3}$'),
        CONSTRAINT ck_invoices_tax_percent CHECK (tax_percent BETWEEN 0 AND 100),
        CONSTRAINT ck_invoices_amounts_non_negative CHECK (
          invoice_sub_total >= 0 AND total_tax >= 0 AND total_discount >= 0
          AND total_amount >= 0 AND total_paid >= 0 AND balance_amount >= 0
        ),
        CONSTRAINT ck_invoices_total_amount
          CHECK (total_amount = invoice_sub_total + total_tax - total_discount),
        CONSTRAINT ck_invoices_balance_amount CHECK (balance_amount = total_amount - total_paid)
      )`);

    await queryRunner.query(`
      CREATE TABLE invoice_items (
        id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id uuid          NOT NULL,
        name       varchar(200)  NOT NULL,
        quantity   integer       NOT NULL,
        rate       numeric(12,2) NOT NULL,
        CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id)
          REFERENCES invoices (id) ON DELETE CASCADE,
        CONSTRAINT ck_invoice_items_quantity CHECK (quantity > 0),
        CONSTRAINT ck_invoice_items_rate CHECK (rate > 0)
      )`);

    // INV-1 and inv-1 count as the same number.
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_invoices_invoice_number ON invoices (lower(invoice_number))`,
    );
    await queryRunner.query(`CREATE INDEX ix_invoices_invoice_date ON invoices (invoice_date)`);
    await queryRunner.query(`CREATE INDEX ix_invoices_due_date ON invoices (due_date)`);
    await queryRunner.query(`CREATE INDEX ix_invoices_total_amount ON invoices (total_amount)`);
    // status + due_date also serves the derived Overdue filter.
    await queryRunner.query(
      `CREATE INDEX ix_invoices_status_due_date ON invoices (status, due_date)`,
    );
    await queryRunner.query(`CREATE INDEX ix_invoices_created_by ON invoices (created_by)`);
    // Trigram indexes for ILIKE '%term%' search.
    await queryRunner.query(
      `CREATE INDEX ix_invoices_invoice_number_trgm ON invoices USING gin (invoice_number gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_invoices_customer_fullname_trgm ON invoices USING gin (customer_fullname gin_trgm_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_invoice_items_invoice_id ON invoice_items (invoice_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE invoice_items`);
    await queryRunner.query(`DROP TABLE invoices`);
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TYPE invoice_status`);
  }
}
