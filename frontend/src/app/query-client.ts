import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { markSessionExpired, sessionQueryKey } from '@/features/auth/session';
import { isApiError } from '@/lib/api-client';

interface QueryClientOptions {
  retry?: boolean;
}

// Retry network errors and 5xx twice. 4xx responses are final.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient({ retry = true }: QueryClientOptions = {}): QueryClient {
  const handleUnauthorized = (error: unknown) => {
    if (isApiError(error) && error.status === 401) markSessionExpired(queryClient);
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== sessionQueryKey[0]) handleUnauthorized(error);
      },
    }),
    mutationCache: new MutationCache({ onError: handleUnauthorized }),
    defaultOptions: {
      queries: {
        retry: retry ? shouldRetry : false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });

  return queryClient;
}
