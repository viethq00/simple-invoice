import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createValidationPipe } from './common/validation/validation.pipe';
import { AppConfig } from './config/app-config';
import { setupSwagger } from './swagger';

// Shared with the e2e tests so they run against the production HTTP setup.
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.trustProxy);
  // HSTS and upgrade-insecure-requests only behind HTTPS. Over plain HTTP they break Swagger UI.
  const httpsOnly = config.cookieSecure;
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: httpsOnly ? [] : null } },
      strictTransportSecurity: httpsOnly,
    }),
  );
  app.use(cookieParser());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
  });
  // JSON bodies only. This also stops cross-site HTML form posts.
  app.use((request: Request, _response: Response, next: NextFunction) => {
    const hasBody =
      request.headers['transfer-encoding'] !== undefined ||
      Number(request.headers['content-length'] ?? 0) > 0;
    next(
      hasBody && !request.is('application/json')
        ? new UnsupportedMediaTypeException('Content-Type must be application/json')
        : undefined,
    );
  });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  setupSwagger(app);
}
