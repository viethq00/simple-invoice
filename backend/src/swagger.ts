import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { AUTH_COOKIE_NAME } from './auth/auth.constants';

export const SWAGGER_PATH = 'api/docs';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const options = new DocumentBuilder()
    .setTitle('SimpleInvoice API')
    .setDescription(
      [
        'REST API for SimpleInvoice.',
        '',
        '**Try it:** call `POST /auth/login` with the reviewer credentials from the README, copy',
        '`accessToken`, click **Authorize** and paste it under *bearer*. The browser app uses the',
        'HttpOnly cookie that login also sets.',
        '',
        'Totals are always calculated by the server. Money values are JSON numbers with at most two',
        'decimal places. Errors share one shape: `{ statusCode, message, error }`.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addCookieAuth(
      AUTH_COOKIE_NAME,
      { type: 'apiKey', in: 'cookie', name: AUTH_COOKIE_NAME },
      'cookie',
    )
    .build();
  return SwaggerModule.createDocument(app, options);
}

export function setupSwagger(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    customSiteTitle: 'SimpleInvoice API',
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  });
  return document;
}
