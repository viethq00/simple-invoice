import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { STORED_INVOICE_STATUSES, type StoredInvoiceStatus } from '../domain/invoice-status';
import { CustomerDetails } from './customer-details';
import { InvoiceItem } from './invoice-item.entity';

@Entity({ name: 'invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @Column({ name: 'invoice_reference', type: 'varchar', length: 100, nullable: true })
  invoiceReference: string | null;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'currency_symbol', type: 'varchar', length: 8 })
  currencySymbol: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: STORED_INVOICE_STATUSES, enumName: 'invoice_status' })
  status: StoredInvoiceStatus;

  @Column(() => CustomerDetails, { prefix: false })
  customer: CustomerDetails;

  @Column({ name: 'tax_percent', type: 'numeric', precision: 5, scale: 2 })
  taxPercent: string;

  @Column({ name: 'invoice_sub_total', type: 'numeric', precision: 15, scale: 2 })
  invoiceSubTotal: string;

  @Column({ name: 'total_tax', type: 'numeric', precision: 15, scale: 2 })
  totalTax: string;

  @Column({ name: 'total_discount', type: 'numeric', precision: 15, scale: 2 })
  totalDiscount: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 15, scale: 2 })
  totalAmount: string;

  @Column({ name: 'total_paid', type: 'numeric', precision: 15, scale: 2 })
  totalPaid: string;

  @Column({ name: 'balance_amount', type: 'numeric', precision: 15, scale: 2 })
  balanceAmount: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: ['insert'] })
  items: InvoiceItem[];
}
