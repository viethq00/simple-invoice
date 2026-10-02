import type { ApiErrorBody } from './api-types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly error: string;

  constructor(status: number, messages: string[], error: string) {
    super(messages[0] ?? error);
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.error = error;
  }
}

export const NETWORK_ERROR_STATUS = 0;

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type QueryValue = string | number | undefined;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Readonly<Record<string, QueryValue>>;
  signal?: AbortSignal;
}

export function buildApiUrl(path: string, query?: ApiRequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE_URL}${path}${search ? `?${search}` : ''}`;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path, query), {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // An aborted request (a superseded query) is not a network error.
    if (signal?.aborted) throw error;
    throw new ApiError(NETWORK_ERROR_STATUS, [], 'Network Error');
  }

  if (response.status === 204) return undefined as T;

  const payload = await readJson(response);
  if (!response.ok) throw toApiError(response, payload);
  return payload as T;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  if (isErrorBody(payload)) {
    const messages = Array.isArray(payload.message) ? payload.message : [payload.message];
    return new ApiError(response.status, messages, payload.error);
  }
  return new ApiError(response.status, [], response.statusText || 'Error');
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.statusCode === 'number' &&
    typeof candidate.error === 'string' &&
    (typeof candidate.message === 'string' || Array.isArray(candidate.message))
  );
}
