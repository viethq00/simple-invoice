import { Navigate, type RouteObject } from 'react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { PublicOnly, RequireAuth } from '@/features/auth/route-guards';
import { CreateInvoicePage } from '@/features/invoices/CreateInvoicePage';
import { InvoiceDetailPage } from '@/features/invoices/InvoiceDetailPage';
import { InvoiceListPage } from '@/features/invoices/InvoiceListPage';
import { NotFoundPage } from './NotFoundPage';
import { RouteErrorPage } from './RouteErrorPage';

export const appRoutes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnly />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <Navigate to="/invoices" replace /> },
          { path: '/invoices', element: <InvoiceListPage /> },
          { path: '/invoices/new', element: <CreateInvoicePage /> },
          { path: '/invoices/:invoiceId', element: <InvoiceDetailPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
