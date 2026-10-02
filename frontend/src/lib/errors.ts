import { isApiError, NETWORK_ERROR_STATUS } from './api-client';

export const NETWORK_ERROR_MESSAGE =
  "Can't reach the server. Check your connection, then try again.";
export const SERVER_ERROR_MESSAGE = 'The server ran into a problem. Try again in a moment.';
export const UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Try again.';

export function describeError(error: unknown): string {
  if (!isApiError(error)) return UNKNOWN_ERROR_MESSAGE;
  if (error.status === NETWORK_ERROR_STATUS) return NETWORK_ERROR_MESSAGE;
  if (error.status >= 500) return SERVER_ERROR_MESSAGE;
  return error.messages[0] ?? UNKNOWN_ERROR_MESSAGE;
}
