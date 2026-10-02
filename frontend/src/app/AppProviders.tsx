import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';

export function AppProviders({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        closeButton
        toastOptions={{
          classNames: {
            toast: '!font-sans !rounded-control !border-rule !text-ink !shadow-paper',
            success: '!text-paid-ink',
            error: '!text-overdue-ink',
          },
        }}
      />
    </QueryClientProvider>
  );
}
