import { PageHeader } from '@/components/PageHeader';
import { ButtonLink } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-6">
      <PageHeader
        title="Page not found"
        description="This address doesn't match any page. Check the link, or go back to your invoices."
      />
      <ButtonLink to="/invoices" variant="secondary">
        Go to invoices
      </ButtonLink>
    </div>
  );
}
