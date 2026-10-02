import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../../config/app-config';

// Path only: query strings can contain customer names. No bodies, cookies or auth headers.
export function buildLoggerOptions(config: AppConfig): Params {
  return {
    pinoHttp: {
      level: config.nodeEnv === 'test' ? 'silent' : config.logLevel,
      genReqId: (_request: IncomingMessage, response: ServerResponse) => {
        const id = randomUUID();
        response.setHeader('X-Request-Id', id);
        return id;
      },
      serializers: {
        req: (request: IncomingMessage & { id?: string }) => ({
          id: request.id,
          method: request.method,
          path: request.url?.split('?')[0],
        }),
        res: (response: ServerResponse) => ({ statusCode: response.statusCode }),
      },
      customLogLevel: (_request, response, error) =>
        error || response.statusCode >= 500
          ? 'error'
          : response.statusCode >= 400
            ? 'warn'
            : 'info',
      autoLogging: { ignore: (request) => request.url === '/health' },
      transport: config.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
          },
    },
  };
}
