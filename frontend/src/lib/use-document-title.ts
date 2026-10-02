import { useEffect } from 'react';

// Names the browser tab, and the file a printed invoice is saved as.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} – SimpleInvoice`;
  }, [title]);
}
