import { ArrowLeft, Printer } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { isApiError } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { InvoiceLinkState } from './components/InvoiceResults';
import { InvoiceSheet } from './components/InvoiceSheet';
import { useInvoice } from './invoice-api';

export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams();
  const location = useLocation();
  const listSearch = (location.state as InvoiceLinkState | null)?.listSearch ?? '';
  const backTo = `/invoices${listSearch}`;
  const invoice = useInvoice(invoiceId);

  const notFound =
    isApiError(invoice.error) && (invoice.error.status === 404 || invoice.error.status === 400);
  useDocumentTitle(
    invoice.data
      ? `Invoice ${invoice.data.invoiceNumber}`
      : notFound
        ? 'Invoice not found'
        : 'Invoice',
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-h-11 items-center justify-between gap-3 print:hidden">
        <Link
          to={backTo}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to invoices
        </Link>
        {invoice.isSuccess && (
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden="true" className="size-4" />
            Print
          </Button>
        )}
      </div>

      {invoice.isPending ? (
        <SheetSkeleton />
      ) : notFound ? (
        <div className="flex flex-col items-start gap-3 rounded-sheet border border-rule bg-paper p-6 shadow-paper-sm sm:p-10">
          <h1 tabIndex={-1} data-route-focus className="font-display text-2xl">
            Invoice not found
          </h1>
          <p className="text-ink-soft">
            This invoice doesn't exist or the link is incomplete. Check the address or find the
            invoice in the list.
          </p>
          <ButtonLink to={backTo} variant="secondary" className="mt-2">
            Back to invoices
          </ButtonLink>
        </div>
      ) : invoice.isError ? (
        <>
          <h1 tabIndex={-1} data-route-focus className="sr-only">
            Invoice
          </h1>
          <Alert
            tone="error"
            title="We couldn't load this invoice"
            action={
              <Button variant="secondary" size="sm" onClick={() => void invoice.refetch()}>
                Retry
              </Button>
            }
          >
            {describeError(invoice.error)}
          </Alert>
        </>
      ) : (
        <InvoiceSheet invoice={invoice.data} />
      )}
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading invoice"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-sheet bg-paper px-5 py-10 shadow-paper sm:px-10"
    >
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-6 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-28" />
      <Skeleton className="ml-auto h-36 w-full sm:w-80" />
    </div>
  );
}
