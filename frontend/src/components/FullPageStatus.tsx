import { Button } from './ui/Button';
import { Alert, Spinner } from './ui/feedback';
import { Wordmark } from './Wordmark';

export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div role="status" className="flex flex-col items-center gap-4 text-ink-soft">
        <Wordmark />
        <p className="flex items-center gap-2 text-sm">
          <Spinner />
          {label}
        </p>
      </div>
    </div>
  );
}

export function FullPageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Wordmark />
        <Alert
          tone="error"
          title="SimpleInvoice couldn't start"
          className="w-full"
          action={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {message}
        </Alert>
      </div>
    </div>
  );
}
