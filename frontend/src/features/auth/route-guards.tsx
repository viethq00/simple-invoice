import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageError, FullPageLoader } from '@/components/FullPageStatus';
import { AppShell } from '@/components/layout/AppShell';
import { describeError } from '@/lib/errors';
import { useSession } from './session';

export interface LoginLocationState {
  from?: string;
  reason?: 'expired';
}

export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <FullPageLoader label="Checking your session" />;
  // Only a failed first check is fatal. A failed re-check keeps the known session.
  if (session.isLoadingError) {
    return (
      <FullPageError
        message={describeError(session.error)}
        onRetry={() => void session.refetch()}
      />
    );
  }

  if (session.data.status === 'anonymous') {
    const state: LoginLocationState = {
      from: `${location.pathname}${location.search}${location.hash}`,
      reason: session.data.reason,
    };
    return <Navigate to="/login" replace state={state} />;
  }

  return <AppShell user={session.data.user} />;
}

export function PublicOnly() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <FullPageLoader label="Checking your session" />;

  if (session.data?.status === 'authenticated') {
    return <Navigate to={returnPath(location.state as LoginLocationState | null)} replace />;
  }

  return <Outlet />;
}

// Only paths inside the app. "//host" and "/\host" would leave the site.
function returnPath(state: LoginLocationState | null): string {
  const from = state?.from;
  if (typeof from !== 'string' || !/^\/(?![/\\])/.test(from) || from === '/login') {
    return '/invoices';
  }
  return from;
}
