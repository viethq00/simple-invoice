import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { flattenValidationErrors } from './validation-errors';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    stopAtFirstError: true,
    transformOptions: { exposeUnsetFields: false },
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => new BadRequestException(flattenValidationErrors(errors)),
  });
}
