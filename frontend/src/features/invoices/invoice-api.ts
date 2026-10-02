import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api-client';
import type {
  CreateInvoiceRequest,
  Invoice,
  InvoiceListParams,
  InvoiceListResponse,
} from '@/lib/api-types';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (params: InvoiceListParams) => [...invoiceKeys.lists(), params] as const,
  detail: (id: string) => [...invoiceKeys.all, 'detail', id] as const,
};

export function listInvoices(params: InvoiceListParams, signal?: AbortSignal) {
  return apiRequest<InvoiceListResponse>('/invoices', { query: { ...params }, signal });
}

export function getInvoice(invoiceId: string, signal?: AbortSignal) {
  return apiRequest<Invoice>(`/invoices/${encodeURIComponent(invoiceId)}`, { signal });
}

export function createInvoice(body: CreateInvoiceRequest) {
  return apiRequest<Invoice>('/invoices', { method: 'POST', body });
}

export function useInvoiceList(params: InvoiceListParams, { enabled = true } = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: ({ signal }) => listInvoices(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: ({ signal }) => getInvoice(invoiceId, signal),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: (invoice) => {
      queryClient.setQueryData(invoiceKeys.detail(invoice.invoiceId), invoice);
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}
