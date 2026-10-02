import { Column } from 'typeorm';

// Snapshot of who was billed, stored on the invoice row.
export class CustomerDetails {
  @Column({ name: 'customer_fullname', type: 'varchar', length: 120 })
  fullname: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'customer_mobile', type: 'varchar', length: 30, nullable: true })
  mobileNumber: string | null;

  @Column({ name: 'customer_address', type: 'varchar', length: 255, nullable: true })
  address: string | null;
}
