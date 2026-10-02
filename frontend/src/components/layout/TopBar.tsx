import { LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';
import { useLogout } from '@/features/auth/session';
import type { User } from '@/lib/api-types';
import { cn } from '@/lib/cn';
import { Button } from '../ui/Button';
import { Wordmark } from '../Wordmark';

const NAV_ITEMS = [
  { to: '/invoices', label: 'Invoices', isActive: (path: string) => isInvoicesSection(path) },
  {
    to: '/invoices/new',
    label: 'New invoice',
    isActive: (path: string) => path === '/invoices/new',
  },
] as const;

function isInvoicesSection(path: string): boolean {
  return (path === '/invoices' || path.startsWith('/invoices/')) && path !== '/invoices/new';
}

export function TopBar({ user }: { user: User }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const logout = useLogout();

  // Close the mobile menu whenever the route changes.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const signOut = () =>
    logout.mutate(undefined, {
      onError: () => toast.error("Couldn't sign you out. Check your connection, then try again."),
    });

  return (
    <header className="border-b border-rule bg-paper print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link to="/invoices" className="rounded-control" aria-label="SimpleInvoice, go to invoices">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} to={item.to} active={item.isActive(pathname)}>
              {item.label}
            </NavItem>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 md:flex">
          <span className="text-sm text-ink-soft">{user.fullname}</span>
          <Button variant="secondary" size="sm" onClick={signOut} disabled={logout.isPending}>
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </Button>
        </div>

        <Button
          variant="ghost"
          className="ml-auto md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
          <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
        </Button>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="border-t border-rule px-4 pt-2 pb-4 md:hidden">
          <nav aria-label="Main" className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={item.isActive(pathname) ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-control px-3 text-base font-medium',
                  item.isActive(pathname) ? 'bg-pen-wash text-pen-deep' : 'text-ink hover:bg-desk',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-rule pt-3">
            <span className="truncate text-sm text-ink-soft">{user.fullname}</span>
            <Button variant="secondary" size="sm" onClick={signOut} disabled={logout.isPending}>
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

function NavItem({ to, active, children }: { to: string; active: boolean; children: string }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center px-3 text-sm font-medium transition-colors',
        'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full',
        active
          ? 'text-ink after:bg-pen'
          : 'text-ink-soft hover:text-ink hover:after:bg-rule-strong',
      )}
    >
      {children}
    </Link>
  );
}
