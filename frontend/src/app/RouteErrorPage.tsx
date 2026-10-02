import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback';
import { Wordmark } from '@/components/Wordmark';
import { useDocumentTitle } from '@/lib/use-document-title';

export function RouteErrorPage() {
  useDocumentTitle('Something went wrong');

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <Wordmark />
        <Alert
          tone="error"
          title="Something went wrong"
          className="w-full"
          action={
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          This page ran into an unexpected problem. Reload to try again.
        </Alert>
      </div>
    </div>
  );
}
