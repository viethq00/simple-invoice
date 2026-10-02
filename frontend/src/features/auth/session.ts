import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api-client';
import type { LoginRequest, User } from '@/lib/api-types';
import { fetchCurrentUser, login, logout } from './auth-api';

// 'expired' lets the login page explain why a valid session ended.
export type Session =
  { status: 'authenticated'; user: User } | { status: 'anonymous'; reason?: 'expired' };

export const sessionQueryKey = ['session'] as const;

// Typed parameter on purpose: TanStack's NoInfer updater rejects inline union literals.
function setSession(queryClient: QueryClient, session: Session): void {
  queryClient.setQueryData<Session>(sessionQueryKey, session);
}

async function resolveSession(queryClient: QueryClient, signal: AbortSignal): Promise<Session> {
  try {
    return { status: 'authenticated', user: await fetchCurrentUser(signal) };
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      const previous = queryClient.getQueryData<Session>(sessionQueryKey);
      return previous?.status === 'authenticated'
        ? { status: 'anonymous', reason: 'expired' }
        : { status: 'anonymous' };
    }
    throw error;
  }
}

export function useSession() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => resolveSession(queryClient, signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

// Runs on any 401. Already anonymous means a wrong password, not an expired session.
export function markSessionExpired(queryClient: QueryClient): void {
  const current = queryClient.getQueryData<Session>(sessionQueryKey);
  if (current?.status !== 'authenticated') return;
  setSession(queryClient, { status: 'anonymous', reason: 'expired' });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    // The cookie carries the session, so the token in the response is not kept.
    mutationFn: async (credentials: LoginRequest) => (await login(credentials)).user,
    onSuccess: (user) => {
      setSession(queryClient, { status: 'authenticated', user });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      setSession(queryClient, { status: 'anonymous' });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionQueryKey[0] });
    },
  });
}
