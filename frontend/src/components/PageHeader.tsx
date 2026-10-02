import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/lib/use-document-title';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  useDocumentTitle(title);

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div className="min-w-0">
        <h1 tabIndex={-1} data-route-focus className="font-display text-3xl text-ink sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-base text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
