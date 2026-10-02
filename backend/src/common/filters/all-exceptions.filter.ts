import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

export interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

const reasonPhrase = (status: number): string => STATUS_CODES[status] ?? 'Error';

const isMessage = (value: unknown): value is string | string[] =>
  typeof value === 'string' ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string'));

// Errors thrown by Express middleware (body-parser, http-errors) carry their own status.
function middlewareStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { status, statusCode } = exception as { status?: unknown; statusCode?: unknown };
  const candidate = typeof status === 'number' ? status : statusCode;
  return typeof candidate === 'number' && candidate >= 400 && candidate < 500
    ? candidate
    : undefined;
}

export function toErrorBody(exception: unknown): ErrorBody {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return { statusCode, message: payload, error: reasonPhrase(statusCode) };
    }
    const { message, error } = payload as { message?: unknown; error?: unknown };
    return {
      statusCode,
      message: isMessage(message) ? message : exception.message,
      error: typeof error === 'string' ? error : reasonPhrase(statusCode),
    };
  }

  const status = middlewareStatus(exception);
  if (status !== undefined) {
    const { expose, message } = exception as { expose?: unknown; message?: unknown };
    return {
      statusCode: status,
      message: expose === true && typeof message === 'string' ? message : reasonPhrase(status),
      error: reasonPhrase(status),
    };
  }

  // Don't send internals (SQL, hosts) to the client.
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
    error: reasonPhrase(HttpStatus.INTERNAL_SERVER_ERROR),
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);
    if (body.statusCode >= 500 && !(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
