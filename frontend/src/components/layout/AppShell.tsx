import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import type { User } from '@/lib/api-types';
import { TopBar } from './TopBar';

// Focus the new page's heading after client-side navigation, for keyboard and screen readers.
function useFocusOnNavigation() {
  const { pathname, key } = useLocation();
  const focusedPathname = useRef<string | null>(null);

  useEffect(() => {
    const previous = focusedPathname.current;
    focusedPathname.current = pathname;
    // Skip query-only changes and the first page load.
    if (previous === pathname || (previous === null && key === 'default')) return;

    const main = document.getElementById('main');
    if (!main) return;
    const heading = () => main.querySelector<HTMLElement>('[data-route-focus]');
    // Scrolling is left to ScrollRestoration.
    const focus = (target: HTMLElement) => target.focus({ preventScroll: true });

    const current = heading();
    if (current) {
      focus(current);
      return;
    }

    // A page still loading its data renders the heading later. Move focus to it then,
    // unless the user has already moved focus elsewhere.
    focus(main);
    const observer = new MutationObserver(() => {
      const loaded = heading();
      if (!loaded) return;
      observer.disconnect();
      if (document.activeElement === main) focus(loaded);
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, key]);
}

export function AppShell({ user }: { user: User }) {
  useFocusOnNavigation();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Keyed by path: filters and paging keep the scroll position, a new page starts at the top. */}
      <ScrollRestoration getKey={(location) => location.pathname} />
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-ink px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <TopBar user={user} />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-16 focus:outline-none sm:px-6 sm:pt-10 print:max-w-none print:p-0"
      >
        <Outlet />
      </main>
    </div>
  );
}
