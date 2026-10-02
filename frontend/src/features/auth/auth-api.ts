import { apiRequest } from '@/lib/api-client';
import type { LoginRequest, LoginResponse, User } from '@/lib/api-types';

export function login(credentials: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: credentials });
}

export function fetchCurrentUser(signal?: AbortSignal): Promise<User> {
  return apiRequest<User>('/auth/me', { signal });
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}
