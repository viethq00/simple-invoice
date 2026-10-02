export type InvoiceStatus = 'Draft' | 'Pending' | 'Paid' | 'Overdue';

export interface User {
  id: string;
  email: string;
  fullname: string;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

export interface Customer {
  fullname: string;
  email: string;
  mobileNumber: string | null;
  address: string | null;
}

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceReference: string | null;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  currencySymbol: string;
  description: string | null;
  status: InvoiceStatus;
  customer: Customer;
  items: InvoiceItem[];
  taxPercent: number;
  invoiceSubTotal: number;
  totalTax: number;
  totalDiscount: number;
  totalAmount: number;
  totalPaid: number;
  balanceAmount: number;
  createdAt: string;
  createdBy: string;
}

export interface Paging {
  page: number;
  pageSize: number;
  total: number;
}

export interface InvoiceListResponse {
  data: Invoice[];
  paging: Paging;
}

export type InvoiceSortField = 'invoiceDate' | 'dueDate' | 'totalAmount';
export type SortOrder = 'ASC' | 'DESC';

export interface InvoiceListParams {
  page: number;
  pageSize: number;
  sortBy: InvoiceSortField;
  ordering: SortOrder;
  status?: InvoiceStatus;
  keyword?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CreateInvoiceRequest {
  invoiceNumber: string;
  invoiceReference?: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  description?: string;
  customer: {
    fullname: string;
    email: string;
    mobileNumber?: string;
    address?: string;
  };
  items: [{ name: string; quantity: number; rate: number }];
  taxPercent?: number;
  discount?: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}
