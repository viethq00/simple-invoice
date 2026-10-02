import type { InvoiceStatus } from '@/lib/api-types';
import { cn } from '@/lib/cn';

const BADGE_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'bg-draft-wash text-draft-ink',
  Pending: 'bg-pending-wash text-pending-ink',
  Paid: 'bg-paid-wash text-paid-ink',
  Overdue: 'bg-overdue-wash text-overdue-ink',
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        BADGE_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

const STAMP_STYLES: Record<InvoiceStatus, string> = {
  Draft: 'stamp-draft',
  Pending: 'stamp-pending',
  Paid: 'stamp-paid',
  Overdue: 'stamp-overdue',
};

export function StatusStamp({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <p className={cn('stamp', STAMP_STYLES[status], className)}>
      <span className="sr-only">Status: </span>
      {status}
    </p>
  );
}
